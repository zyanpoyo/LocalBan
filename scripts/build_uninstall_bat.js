import fs from 'node:fs';
import path from 'node:path';

const titleStr = 'LocalBan \\u30a2\\u30f3\\u30a4\\u30f3\\u30b9\\u30c8\\u30fc\\u30e9\\u30fc';
const msgStr =
  'LocalBan \\u3092\\u30a2\\u30f3\\u30a4\\u30f3\\u30b9\\u30c8\\u30fc\\u30eb\\u3057\\u307e\\u3059\\u304b\\uff1f`n`n\\u4fdd\\u5b58\\u3055\\u308c\\u305f\\u3059\\u3079\\u3066\\u306e\\u30c7\\u30fc\\u30bf\\uff08\\u30ab\u30f3\\u30d0\\u30f3\\u30dc\\u30fc\\u30c9\\u3001\\u30bf\\u30b9\\u30af\\u3001\\u6dfb\\u4ed8\\u30d5\\u30a1\\u30a4\\u30eb\\u3001\\u30d0\\u30c3\\u30af\\u30a2\\u30c3\\u30d7\\uff09\\u304c\\u5b8c\\u5168\\u306b\\u524a\\u9664\\u3055\\u308c\\u307e\\u3059\\u3002';
const doneTitleStr = '\\u30a2\\u30f3\\u30a4\\u30f3\\u30b9\\u30c8\\u30fc\\u30e9\\u5b8c\\u4e86';
const doneMsgStr =
  'LocalBan \\u306e\\u30a2\\u30f3\\u30a4\\u30f3\\u30b9\\u30c8\\u30fc\\u30eb\\u304c\\u5b8c\\u4e86\\u3057\\u307e\\u3057\\u305f\\u3002`n`n\\u30c7\\u30fc\\u30bf\\u304a\\u3088\\u3073\\u672c\\u4f53\\u30d7\\u30ed\\u30b8\\u30a7\\u30af\\u30c8\\u30d5\\u30a1\\u30a4\\u30eb\\u306e\\u524a\\u9664\\u304c\\u5b8c\\u4e86\\u3057\\u307e\\u3057\\u305f\\u3002\\u6b8b\\u3063\\u305f\\u3053\\u306e\\u30d5\\u30a9\\u30eb\\u30c0\\u3092\\u3054\\u307f\\u7bb1\\u3078\\u79fb\\u52d5\\u3057\\u3066\\u304f\\u3060\\u3055\\u3044\\u3002';

const psCode = `Add-Type -AssemblyName System.Windows.Forms

$title = "${titleStr}"
$msg = "${msgStr}"
$res = [System.Windows.Forms.MessageBox]::Show($msg, $title, [System.Windows.Forms.MessageBoxButtons]::YesNo, [System.Windows.Forms.MessageBoxIcon]::Warning, [System.Windows.Forms.MessageBoxDefaultButton]::Button2, [System.Windows.Forms.MessageBoxOptions]::DefaultDesktopOnly)

if ($res -ne [System.Windows.Forms.DialogResult]::Yes) {
    exit 0
}

Get-Process LocalBan -ErrorAction SilentlyContinue | Stop-Process -Force

$appData = Join-Path $env:APPDATA "LocalBan"
if (Test-Path -LiteralPath $appData) {
    Remove-Item -LiteralPath $appData -Recurse -Force -ErrorAction SilentlyContinue
}

$localAppData = Join-Path $env:LOCALAPPDATA "com.localban.desktop"
if (Test-Path -LiteralPath $localAppData) {
    Remove-Item -LiteralPath $localAppData -Recurse -Force -ErrorAction SilentlyContinue
}

$scriptDir = (Get-Location).Path
$exePath = Join-Path $scriptDir "LocalBan.exe"
if (Test-Path -LiteralPath $exePath) {
    Remove-Item -LiteralPath $exePath -Force -ErrorAction SilentlyContinue
}

$doneTitle = "${doneTitleStr}"
$doneMsg = "${doneMsgStr}"
[System.Windows.Forms.MessageBox]::Show($doneMsg, $doneTitle, [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information, [System.Windows.Forms.MessageBoxDefaultButton]::Button1, [System.Windows.Forms.MessageBoxOptions]::DefaultDesktopOnly) | Out-Null
`;

// UTF-16LE の Base64
const encoded = Buffer.from(psCode.trim(), 'utf16le').toString('base64');

const batContent = `@echo off
setlocal
cd /d "%~dp0"
title LocalBan Uninstaller

echo ========================================================
echo   LocalBan Uninstaller
echo ========================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}

if %ERRORLEVEL% neq 0 (
    echo.
    echo [ERROR] An unexpected error occurred.
    pause
)
`;

export function generate() {
  const rootDir = path.resolve(import.meta.dirname, '..');
  const target = path.join(rootDir, 'scripts', 'uninstall.bat');
  fs.writeFileSync(target, batContent, 'ascii');
  console.log(`Generated ${target} successfully (${batContent.length} bytes)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  generate();
}
