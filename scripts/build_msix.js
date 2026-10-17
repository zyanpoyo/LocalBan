import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const rootDir = path.resolve(import.meta.dirname, '..');
const distDir = path.join(rootDir, 'dist');
const tauriConf = JSON.parse(fs.readFileSync(path.join(rootDir, 'src-tauri', 'tauri.conf.json'), 'utf-8'));
const version = tauriConf.version;
const msixName = `LocalBan-v${version}-x64.msix`;
const msixOutputPath = path.join(distDir, msixName);

// Cargo PATH 補完
const cargoBin = path.join(process.env.USERPROFILE || process.env.HOME || '', '.cargo', 'bin');
if (fs.existsSync(cargoBin) && !process.env.PATH?.includes(cargoBin)) {
  process.env.PATH = `${cargoBin}${path.delimiter}${process.env.PATH || ''}`;
}

function findMakeAppx() {
  const sdkRoot = 'C:\\Program Files (x86)\\Windows Kits\\10\\bin';
  if (!fs.existsSync(sdkRoot)) {
    throw new Error(`Windows SDK directory not found at ${sdkRoot}`);
  }
  const versions = fs
    .readdirSync(sdkRoot)
    .filter((d) => /^10\.0\.\d+\.\d+$/.test(d))
    .sort()
    .reverse();

  for (const ver of versions) {
    const candidate = path.join(sdkRoot, ver, 'x64', 'makeappx.exe');
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error('makeappx.exe not found in Windows Kits 10 bin.');
}

const skipTauriBuild = process.argv.includes('--skip-build');
const exeSrc = path.join(rootDir, 'src-tauri', 'target', 'release', 'LocalBan.exe');

if (!skipTauriBuild || !fs.existsSync(exeSrc)) {
  console.log('=== Step 1: Building Frontend ===');
  execSync('npm run build', { cwd: path.join(rootDir, 'frontend'), stdio: 'inherit' });

  console.log('\n=== Step 2: Building Tauri Release Binary (No Bundle) ===');
  execSync('npx --prefix frontend tauri build --no-bundle', { cwd: rootDir, stdio: 'inherit' });
}

if (!fs.existsSync(exeSrc)) {
  console.error(`Error: Release executable not found at ${exeSrc}`);
  process.exit(1);
}

// MSIX タイルアセット確認
const msixAssetsDir = path.join(rootDir, 'assets', 'store', 'msix_assets');
const requiredAssets = [
  'StoreLogo.png',
  'Square44x44Logo.png',
  'Square150x150Logo.png',
  'Wide310x150Logo.png',
  'Square310x310Logo.png',
];

for (const asset of requiredAssets) {
  const p = path.join(msixAssetsDir, asset);
  if (!fs.existsSync(p)) {
    console.error(`Missing MSIX visual asset: ${p}. Run generate_store_assets.py first.`);
    process.exit(1);
  }
}

// ステージングディレクトリ準備
const stageDir = path.join(distDir, 'msix_stage');
if (fs.existsSync(stageDir)) {
  fs.rmSync(stageDir, { recursive: true, force: true });
}
fs.mkdirSync(path.join(stageDir, 'Assets'), { recursive: true });

// 1. AppxManifest.xml コピー
const manifestSrc = path.join(rootDir, 'src-tauri', 'msix', 'AppxManifest.xml');
fs.copyFileSync(manifestSrc, path.join(stageDir, 'AppxManifest.xml'));

// 2. 実行ファイルコピー (Microsoft Store Policy 10.2.7 準拠: uninstall.bat は含めない)
fs.copyFileSync(exeSrc, path.join(stageDir, 'LocalBan.exe'));

// 3. ライセンス・通知・プライバシーポリシー同梱 (Policy 10.2 / 10.5.1 準拠)
for (const docFile of ['LICENSE', 'NOTICE.md', 'PRIVACY_POLICY.md']) {
  const src = path.join(rootDir, docFile);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(stageDir, docFile));
  }
}

// 4. ビジュアルアセットコピー
for (const asset of requiredAssets) {
  fs.copyFileSync(
    path.join(msixAssetsDir, asset),
    path.join(stageDir, 'Assets', asset)
  );
}

// 5. MakeAppx による MSIX パッケージ生成
const makeAppxExe = findMakeAppx();
console.log(`\n=== Step 3: Packing MSIX with ${makeAppxExe} ===`);

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}
if (fs.existsSync(msixOutputPath)) {
  fs.rmSync(msixOutputPath, { force: true });
}

execSync(`"${makeAppxExe}" pack /d "${stageDir}" /p "${msixOutputPath}" /o`, {
  stdio: 'inherit',
});

// ステージング削除
fs.rmSync(stageDir, { recursive: true, force: true });

const stat = fs.statSync(msixOutputPath);
const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
console.log('\n======================================================');
console.log(' MICROSOFT STORE MSIX PACKAGE CREATED SUCCESSFULLY!');
console.log(` Identity Name : zyanpoyo.LocalBan`);
console.log(` Publisher     : CN=E4EF494E-DD77-4239-A4AD-155D145F2C23`);
console.log(` Store ID      : 9P791X11HVB3`);
console.log(` Package Path  : ${msixOutputPath}`);
console.log(` Package Size  : ${sizeMb} MB`);
console.log('======================================================');
