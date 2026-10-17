import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { generate as generateUninstallBat } from './build_uninstall_bat.js';

const rootDir = path.resolve(import.meta.dirname, '..');
const distDir = path.join(rootDir, 'dist');

// Cargo (Rust) の PATH 自動補完 (ターミナルセッションで PATH 未反映の場合の対策)
const cargoBin = path.join(process.env.USERPROFILE || process.env.HOME || '', '.cargo', 'bin');
if (fs.existsSync(cargoBin) && !process.env.PATH?.includes(cargoBin)) {
  process.env.PATH = `${cargoBin}${path.delimiter}${process.env.PATH || ''}`;
}
const exeSrc = path.join(rootDir, 'src-tauri', 'target', 'release', 'LocalBan.exe');
const version = '2.0.0';
const zipName = `LocalBan-v${version}-windows.zip`;
const zipPath = path.join(distDir, zipName);

console.log('=== Step 0: Generating latest uninstall.bat ===');
generateUninstallBat();

console.log('\n=== Step 1: Building Frontend ===');
execSync('npm run build', { cwd: path.join(rootDir, 'frontend'), stdio: 'inherit' });

console.log('\n=== Step 2: Building Tauri Release Binary ===');
execSync('npx --prefix frontend tauri build', { cwd: rootDir, stdio: 'inherit' });

if (!fs.existsSync(exeSrc)) {
  console.error(`Error: Release executable not found at ${exeSrc}`);
  process.exit(1);
}

// uninstall.bat の生成確認
const uninstallBat = path.join(rootDir, 'scripts', 'uninstall.bat');
const distReadme = path.join(rootDir, 'assets', 'dist_README.txt');
const licenseFile = path.join(rootDir, 'LICENSE');
const noticeFile = path.join(rootDir, 'NOTICE.md');

// dist ディレクトリ準備
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// ターゲット exe を dist/ にもコピー
const distExe = path.join(distDir, 'LocalBan.exe');
try {
  fs.copyFileSync(exeSrc, distExe);
  console.log(`Copied LocalBan.exe to ${distExe}`);
} catch (err) {
  console.warn(`Warning: Could not copy to ${distExe} (likely running). Please close LocalBan.exe to update dist copy.`);
}


// インストーラー (NSIS setup.exe) を dist/ にコピー
const nsisDir = path.join(rootDir, 'src-tauri', 'target', 'release', 'bundle', 'nsis');
const setupFiles = fs.existsSync(nsisDir) ? fs.readdirSync(nsisDir).filter((f) => f.endsWith('-setup.exe')) : [];
if (setupFiles.length > 0) {
  const setupSrc = path.join(nsisDir, setupFiles[0]);
  const distSetupExe = path.join(distDir, `LocalBan-v${version}-setup.exe`);
  fs.copyFileSync(setupSrc, distSetupExe);
  console.log(`Copied Installer to ${distSetupExe}`);
}

// 配布 ZIP の生成 (PowerShell Compress-Archive)
console.log(`\n=== Step 3: Packaging Distribution ZIP: ${zipName} ===`);
const tempPackDir = path.join(distDir, 'pack_temp', 'LocalBan');
if (fs.existsSync(tempPackDir)) {
  fs.rmSync(tempPackDir, { recursive: true, force: true });
}
fs.mkdirSync(tempPackDir, { recursive: true });

fs.copyFileSync(exeSrc, path.join(tempPackDir, 'LocalBan.exe'));
if (fs.existsSync(uninstallBat)) fs.copyFileSync(uninstallBat, path.join(tempPackDir, 'uninstall.bat'));
if (fs.existsSync(distReadme)) fs.copyFileSync(distReadme, path.join(tempPackDir, 'README.txt'));
if (fs.existsSync(licenseFile)) fs.copyFileSync(licenseFile, path.join(tempPackDir, 'LICENSE'));
if (fs.existsSync(noticeFile)) fs.copyFileSync(noticeFile, path.join(tempPackDir, 'NOTICE.md'));

if (fs.existsSync(zipPath)) {
  fs.rmSync(zipPath, { force: true });
}

const parentTempDir = path.join(distDir, 'pack_temp');
execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${path.join(parentTempDir, 'LocalBan')}' -DestinationPath '${zipPath}' -Force"`, {
  stdio: 'inherit',
});

fs.rmSync(parentTempDir, { recursive: true, force: true });

const stat = fs.statSync(zipPath);
const sizeMb = (stat.size / (1024 * 1024)).toFixed(2);
console.log('\n==========================================');
console.log(' ZIP PACKAGE CREATED SUCCESSFULLY!');
console.log(` Archive: ${zipPath}`);
console.log(` Size: ${sizeMb} MB`);
console.log('==========================================');
