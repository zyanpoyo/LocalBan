---
name: localban-build
description: LocalBan のモジュールビルド手順および成果物検証。ソースコード修正（src-tauri, frontend/src 等）を行ったセッションの完了前、成果物生成（dist/*.exe, dist/*.msix）の検証、またはビルド免除規定を確認する際に使用する。
---

# LocalBan ビルド & モジュール作成手順

ソースコード修正セッション完了時の成果物（インストーラー・実行バイナリ・MSIXパッケージ）生成および検証手順です。

---

## 1. ビルドコマンド

モジュール作成時は、プロジェクトルートで以下のスクリプトを順に実行します：

```powershell
node scripts/build_dist.js
node scripts/build_msix.js
```

---

## 2. 遵守事項・手順

### ステップ 1: 事前検証
ビルド実行前に、TypeScript型チェックおよびRustコンパイル・テストがパスすることを確認します：
```powershell
# フロントエンド型チェック & ビルド
npm run --prefix frontend build

# Rust コンパイルチェック
cargo check --manifest-path src-tauri/Cargo.toml

# Rust 単体テスト実行 (一時ディレクトリ競合防止のためシングルスレッド)
cargo test --manifest-path src-tauri/Cargo.toml -- --test-threads=1
```

### ステップ 2: モジュールビルド実行
```powershell
node scripts/build_dist.js
node scripts/build_msix.js
```

### ステップ 3: 成果物の確認
`dist/` ディレクトリに以下のモジュールが正常に出力されていることを確認します：
- `dist/LocalBan.exe` (ポータブル実行ファイル)
- `dist/LocalBan-v*-setup.exe` (インストーラー)
- `dist/LocalBan-v*-windows.zip` (ZIPパッケージ)
- `dist/LocalBan-v*-x64.msix` (Windows Store / サイドロード用パッケージ)

### ステップ 4: 完了報告
作業セッションの完了報告メッセージに、成果物の生成完了を含めます。

---

## 3. ビルド免除・例外規定 (Exemption Rules)

以下の条件に該当する場合に限り、全モジュールビルド（`build_dist.js` / `build_msix.js`）の実行は**不要（免除）**とします：

1. **`.gitignore` で定義されているフォルダー・ファイル配下のみの修正**:
   - `.gitignore` で除外指定されているパス（例: `assets/store/promotional/`, `assets/store/screenshots/`, `dist/`, `build/`, `docs/`, 一時ファイル等）配下のファイルのみを修正・生成・追加した場合。
   - アプリ本体のソースコード（`src-tauri/`, `frontend/src/` 等）に変更がないため、バイナリ再生成は不要です。
2. **非実行ファイル・設定単体の軽微な修正**:
   - アプリケーションのコンパイル結果に影響を与えない設定ファイル（`.gitignore`, スキル定義ファイル等）やドキュメントのみの変更。
