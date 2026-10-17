import fs from 'node:fs';
import path from 'node:path';

const titleStr = 'LocalBan アンインストーラー';
const msgStr =
  'LocalBan をアンインストールしますか？`n`n保存されたすべてのデータ（カンバンボード、タスク、添付ファイル、バックアップ）が完全に削除されます。';
const doneTitleStr = 'アンインストーラー完了';
const doneMsgStr =
  'LocalBan のアンインストールが完了しました。`n`nデータおよび本体ファイルの削除が完了しました。残ったこのフォルダをごみ箱へ移動してください。';

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
