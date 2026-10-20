# LocalBan プロジェクト開発ルール

## ソースコード修正時のモジュール作成義務 (Mandatory Build Rule)
ソースコードの修正（新機能追加、バグ修正、リファクタリング等）を行った作業セッションでは、作業完了報告の前に**必ず**以下のビルドスクリプトを順に実行して成果物（モジュール）を生成してください。
ユーザーが手元で即座に動作確認を行うために必須の手順です。

```powershell
node scripts/build_dist.js
node scripts/build_msix.js
```

### 遵守事項:
1. **事前検証**:
   - ビルド実行前に、TypeScript型チェック（`npm run --prefix frontend build`）やRustコンパイル・テスト（`cargo check`, `cargo test`）が通る状態であることを確認すること。
2. **成果物の確認**:
   - `dist/` ディレクトリに以下のモジュールが正常に出力されていることを確認すること。
     - `dist/LocalBan.exe` / `LocalBan-v*-setup.exe` / `LocalBan-v*-windows.zip`
     - `dist/LocalBan-v*-x64.msix`
3. **報告**:
   - 成果物の生成完了を完了報告メッセージに含めること。

### ビルド免除・例外規定 (Exemption Rules):
以下の条件に該当する場合に限り、全モジュールビルド（`build_dist.js` / `build_msix.js`）の実行は**不要（免除）**とします。
1. **`.gitignore` で定義されているフォルダー・ファイル配下のみの修正**:
   - `.gitignore` で除外指定されているパス（例: `assets/store/promotional/`, `assets/store/screenshots/`, `dist/`, `build/`, `docs/`, 一時ファイル等）配下のファイルのみを修正・生成・追加した場合。
   - アプリ本体のソースコード（`src-tauri/`, `frontend/src/` 等）に変更がないため、バイナリ再生成は不要です。
2. **非実行ファイル・設定単体の軽微な修正**:
   - アプリケーションのコンパイル結果に影響を与えない設定ファイル（`.gitignore` 等）やドキュメントのみの変更。

## リリース・ストア提出時の Windows App Certification Kit (WACK) 検証案内ルール
ユーザーから「リリース作業を行いたい」「Store提出準備をしたい」等の申告があった場合、またはバージョンアップ・リリースビルドの完了時には、MSIX パッケージの適合性を確認するため、以下の手順でユーザーに手動での WACK（GUI）実行を案内すること。

### 遵守事項:
1. **自動実行の禁止**:
   - WACK の CLI（`appcert.exe`）は管理者権限（UAC 昇格）やデスクトップ画面制御を伴い、非対話シェルでは入力待ちで停止するため、**ターミナルから直接実行しないこと**。
2. **ユーザーへの案内手順**:
   ユーザーに対して以下の GUI 実行手順を明確に案内すること：
   1. `Win + R` キーを押し、以下を実行して「Windows アプリ認定キット」を起動（UAC は「はい」を選択）：
      ```text
      "C:\Program Files (x86)\Windows Kits\10\App Certification Kit\appcertui.exe"
      ```
   2. 「ストア アプリの検証」（Windows アプリ パッケージ）を選択。
   3. 最新の MSIX ファイル（`dist/LocalBan-v*-x64.msix`）を指定してテストを実行。
   4. テスト完了後、出力されたレポート（XML / HTML）を共有してもらい、AI 側で合否結果を解析・確認する。
3. **判定の解説**:
   - `OVERALL_RESULT="PASS"` であることを確認する。
   - フル信頼アプリ（`Windows.FullTrustApplication`）特有の「ブロック済みの実行可能ファイル（プロセス起動 API 参照等）」は `OPTIONAL="TRUE"` の情報提供項目であり、Store 審査に影響しないことを必要に応じて説明する。

## アプリケーション バージョンアップ手順ルール (Application Version Bump Procedure)
ユーザーから「アプリのバージョンをあげる」「vX.Y.Z に更新して」等の指示があった場合は、以下の標準手順を厳密に実施してください。

### 1. 更新対象ファイル（全13箇所の一括同期）
以下のすべてのファイルにおいてバージョン番号（`vX.Y.Z` または MSIX用の `X.Y.Z.0`）を更新すること：
1. `src-tauri/Cargo.toml`: `version = "X.Y.Z"`
2. `src-tauri/tauri.conf.json`: `"version": "X.Y.Z"`
3. `src-tauri/src/config.rs`: `pub const APP_VERSION: &str = "X.Y.Z";`
4. `src-tauri/src/lib.rs`: `test_system_status` 内の `assert_eq!(status.version, "X.Y.Z");`
5. `src-tauri/msix/AppxManifest.xml`: `Version="X.Y.Z.0"` (4桁表記)
6. `frontend/package.json`: `"version": "X.Y.Z"`
7. `frontend/src/components/Header.tsx`: バッジ表示 `vX.Y.Z`
8. `frontend/src/components/InfoModal.tsx`: モーダル見出し `LocalBan vX.Y.Z — プライバシーポリシー・免責事項`
9. `assets/dist_README.txt`: 見出し `LocalBan (ローカルバン) vX.Y.Z`
10. `scripts/generate_store_assets.py`: モックUI描画のバッジテキスト `vX.Y.Z`（3箇所）
11. `README.md`: タイトル見出し、インストーラーリンク、ZIP名、MSIX名（計4箇所）
12. `docs/README.md`: タイトル見出し、本文内のバージョン表記
13. `docs/architecture/system_overview.md`: タイトル見出し

### 2. 事前検証 (Pre-verification)
ファイル修正後、モジュールビルド前に必ず以下のコマンドを実行しエラーがないことを確認する：
```powershell
# フロントエンド型チェック & ビルド
npm run --prefix frontend build

# Rust コンパイルチェック
cargo check --manifest-path src-tauri/Cargo.toml

# Rust 単体テスト実行 (一時ディレクトリ競合防止のためシングルスレッド)
cargo test --manifest-path src-tauri/Cargo.toml -- --test-threads=1
```

### 3. モジュール作成義務 (Mandatory Build Rule)
事前検証が通った後、順にスクリプトを実行して配布物を生成する：
```powershell
node scripts/build_dist.js
node scripts/build_msix.js
```
`dist/` 配下に以下が出力されていることを確認する：
- `dist/LocalBan.exe`
- `dist/LocalBan-vX.Y.Z-setup.exe`
- `dist/LocalBan-vX.Y.Z-windows.zip`
- `dist/LocalBan-vX.Y.Z-x64.msix`

### 4. Git ブランチ運用・コミット・PR 発行
1. 新規ブランチ `chore/bump-version-X.Y.Z` を作成・チェックアウト。
2. 変更された13ファイルをステージングし、コミット：
   - コミットタイトル: `chore: bump version to vX.Y.Z`
   - コミット本文: 更新コンポーネント、検証パス、成果物生成の概要
3. リモート `LocalBan-github` にプッシュ：
   ```powershell
   git push -u LocalBan-github chore/bump-version-X.Y.Z
   ```
4. GitHub 上で `main` をターゲットにしたプルリクエストを発行する。

### 5. WACK 検証案内
完了報告メッセージに、成果物の出力完了報告とともに「Windows App Certification Kit (WACK)」の GUI 手動実行手順を含めること。
