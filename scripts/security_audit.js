import fs from 'node:fs';
import path from 'node:path';
import { execSync, spawnSync } from 'node:child_process';

const rootDir = path.resolve(import.meta.dirname, '..');
const frontendDir = path.join(rootDir, 'frontend');
const tauriDir = path.join(rootDir, 'src-tauri');
const cargoTomlPath = path.join(tauriDir, 'Cargo.toml');

// Cargo (Rust) の PATH 自動補完
const cargoBin = path.join(process.env.USERPROFILE || process.env.HOME || '', '.cargo', 'bin');
if (fs.existsSync(cargoBin) && !process.env.PATH?.includes(cargoBin)) {
  process.env.PATH = `${cargoBin}${path.delimiter}${process.env.PATH || ''}`;
}

const args = process.argv.slice(2);
const isFixMode = args.includes('--fix');
const isHelp = args.includes('--help') || args.includes('-h');

if (isHelp) {
  console.log(`
Usage:
  node scripts/security_audit.js          監査モード (脆弱性・ライセンスのチェックのみ)
  node scripts/security_audit.js --fix    修復＆検証モード (自動パッチ更新 + ライセンス確認 + ビルド・単体テスト)
`);
  process.exit(0);
}

// 許可するフロントエンド(npm)ライセンス一覧
const ALLOWED_NPM_LICENSES = new Set([
  'MIT',
  'ISC',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  '0BSD',
  'BlueOak-1.0.0',
  'CC0-1.0',
  'CC-BY-3.0',
  'CC-BY-4.0',
  'Unlicense',
  'Python-2.0',
  'MPL-2.0',
  'Zlib',
  '(MIT OR Apache-2.0)',
  '(MIT OR CC0-1.0)',
  '(MPL-2.0 OR Apache-2.0)',
  '(BSD-2-Clause OR MIT OR Apache-2.0)',
  'MIT OR Apache-2.0',
]);

let hasErrors = false;

console.log('==============================================================');
console.log(` LocalBan Security & License Audit (${isFixMode ? 'FIX & VERIFY MODE' : 'CHECK MODE'})`);
console.log('==============================================================\n');

// ---------------------------------------------------------------------------
// Step 1: Frontend (npm) 脆弱性監査
// ---------------------------------------------------------------------------
console.log('=== [1/4] Frontend (npm) Vulnerability Audit ===');
if (isFixMode) {
  console.log('-> Running `npm audit fix` in frontend/ ...');
  const fixRes = spawnSync('npm', ['audit', 'fix'], {
    cwd: frontendDir,
    stdio: 'inherit',
    shell: true,
  });
  if (fixRes.status !== 0) {
    console.warn('Warning: `npm audit fix` exited with non-zero status.');
  }
}

const npmAuditRes = spawnSync('npm', ['audit', '--audit-level=moderate'], {
  cwd: frontendDir,
  stdio: 'inherit',
  shell: true,
});

if (npmAuditRes.status !== 0) {
  console.error('\n[FAIL] Frontend npm audit detected moderate/high/critical vulnerabilities.');
  if (!isFixMode) {
    console.error('  Hint: Run `node scripts/security_audit.js --fix` to apply compatible updates.');
  } else {
    console.error('  Hint: If a transitive dependency cannot be fixed automatically,');
    console.error('        add an `"overrides"` entry in `frontend/package.json`.');
  }
  hasErrors = true;
} else {
  console.log('[PASS] Frontend npm vulnerability audit passed.\n');
}

// ---------------------------------------------------------------------------
// Step 2: Frontend (npm) ライセンス監査
// ---------------------------------------------------------------------------
console.log('=== [2/4] Frontend (npm) License Check ===');
const nodeModulesDir = path.join(frontendDir, 'node_modules');
const disallowedNpmPackages = [];

function scanNodeModulesLicenses(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.name.startsWith('@')) {
      scanNodeModulesLicenses(fullPath);
      continue;
    }
    const pkgJsonPath = path.join(fullPath, 'package.json');
    if (fs.existsSync(pkgJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
        let lic = pkg.license || (pkg.licenses && JSON.stringify(pkg.licenses)) || 'UNKNOWN';
        if (typeof lic === 'object' && lic.type) lic = lic.type;
        const licStr = String(lic);
        // GPL / AGPL / LGPL 等の強いコピーレフトが含まれていないか判定 (OR で MIT 等が選べる場合は許可)
        const isCopyleft =
          /\b(AGPL|GPL|LGPL)\b/i.test(licStr) && !/\b(MIT|Apache-2\.0|BSD|ISC)\b/i.test(licStr);
        if (isCopyleft && !ALLOWED_NPM_LICENSES.has(licStr)) {
          disallowedNpmPackages.push(`${pkg.name}@${pkg.version} (${licStr})`);
        }
      } catch {
        // ignore parse errors in non-standard package.json
      }
    }
  }
}

scanNodeModulesLicenses(nodeModulesDir);

if (disallowedNpmPackages.length > 0) {
  console.error('[FAIL] Disallowed copyleft licenses detected in frontend/node_modules:');
  for (const item of disallowedNpmPackages) {
    console.error(`  - ${item}`);
  }
  hasErrors = true;
} else {
  console.log('[PASS] Frontend npm license check passed (no restricted copyleft packages found).\n');
}

// ---------------------------------------------------------------------------
// Step 3: Backend (Rust / Cargo) 脆弱性・ライセンス・取得元監査 (cargo-deny)
// ---------------------------------------------------------------------------
console.log('=== [3/4] Backend (Rust / Cargo) Security & License Audit ===');

const cargoDenyVersion = spawnSync('cargo', ['deny', '--version'], {
  cwd: rootDir,
  encoding: 'utf-8',
  shell: true,
});

if (cargoDenyVersion.status !== 0) {
  console.error('[ERROR] `cargo-deny` is not installed.');
  console.error('  Please install it once with: cargo install --locked cargo-deny');
  hasErrors = true;
} else {
  console.log(`Using ${cargoDenyVersion.stdout.trim()}`);

  if (isFixMode) {
    console.log('-> Running `cargo update` in src-tauri/ to apply compatible patch updates ...');
    const cargoUpdateRes = spawnSync('cargo', ['update', '--manifest-path', cargoTomlPath], {
      cwd: rootDir,
      stdio: 'inherit',
      shell: true,
    });
    if (cargoUpdateRes.status !== 0) {
      console.error('[FAIL] `cargo update` failed.');
      hasErrors = true;
    }
  }

  const cargoDenyRes = spawnSync(
    'cargo',
    ['deny', '--manifest-path', cargoTomlPath, 'check', 'advisories', 'licenses', 'sources'],
    {
      cwd: rootDir,
      stdio: 'inherit',
      shell: true,
    }
  );

  if (cargoDenyRes.status !== 0) {
    console.error('\n[FAIL] `cargo deny check` reported advisories, license, or source issues.');
    if (!isFixMode) {
      console.error('  Hint: Run `node scripts/security_audit.js --fix` to update Cargo.lock and re-verify.');
    }
    hasErrors = true;
  } else {
    console.log('\n[PASS] Backend Rust advisories, licenses, and sources check passed.\n');
  }
}

// ---------------------------------------------------------------------------
// Step 4: ロックファイル変更検知 & 自動事前検証 (--fix 時)
// ---------------------------------------------------------------------------
console.log('=== [4/4] Dependency Diff & Verification ===');
try {
  const gitDiffFiles = execSync('git status --porcelain frontend/package.json frontend/package-lock.json src-tauri/Cargo.toml src-tauri/Cargo.lock', {
    cwd: rootDir,
    encoding: 'utf-8',
  }).trim();

  if (gitDiffFiles) {
    console.log('[NOTICE] Dependency files were modified:');
    console.log(gitDiffFiles);
    console.log('\n  [!] IMPORTANT: Please verify whether `NOTICE.md` needs to be updated');
    console.log('      (check for newly added dependencies or changed license notices).\n');
  } else {
    console.log('No changes in dependency manifest/lock files.\n');
  }
} catch {
  // ignore if git is unavailable
}

if (isFixMode) {
  console.log('-> Running mandatory pre-verification checks (Frontend Build + Rust Check & Test)...\n');
  try {
    console.log('[Verify 1/3] Frontend TypeScript & Vite Build...');
    execSync('npm run --prefix frontend build', { cwd: rootDir, stdio: 'inherit' });

    console.log('\n[Verify 2/3] Rust Cargo Check...');
    execSync('cargo check --manifest-path src-tauri/Cargo.toml', { cwd: rootDir, stdio: 'inherit' });

    console.log('\n[Verify 3/3] Rust Unit Tests (single-threaded)...');
    execSync('cargo test --manifest-path src-tauri/Cargo.toml -- --test-threads=1', {
      cwd: rootDir,
      stdio: 'inherit',
    });

    console.log('\n[PASS] All pre-verification builds and unit tests succeeded!');
  } catch (err) {
    console.error('\n[FAIL] Pre-verification failed after updating dependencies.');
    hasErrors = true;
  }
}

console.log('\n==============================================================');
if (hasErrors) {
  console.error(' AUDIT RESULT: FAILED (Action Required)');
  console.log('==============================================================');
  process.exit(1);
} else {
  console.log(' AUDIT RESULT: PASSED (All Security & License Checks Clean)');
  console.log('==============================================================');
  process.exit(0);
}
