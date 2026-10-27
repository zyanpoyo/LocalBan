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
# 脆弱性・ライセンス監査 (npm audit + cargo-deny)
node scripts/security_audit.js

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

## 依存ライブラリの脆弱性・ライセンス監査および更新ルール (Security & License Audit Procedure)
フロントエンド（`frontend/package.json`）およびバックエンド（`src-tauri/Cargo.toml`）の依存ライブラリに関して、脆弱性検知（GitHub Dependabot 等）や定期点検、ライブラリ追加・更新を行う際は、以下の標準手順に従って監査・バージョンアップを実施してください。

### 1. 監査・自動更新コマンド
プロジェクトルートの統合スクリプト `scripts/security_audit.js` を使用する：
```powershell
# 監査モード（変更を加えず、npm / Rust 両方の脆弱性・ライセンス規約違反をチェック）
node scripts/security_audit.js

# 修復＆検証モード（互換範囲の自動パッチ更新 + ライセンスチェック + ビルド・単体テストまで一括実行）
node scripts/security_audit.js --fix
```
- **初回セットアップ**: Rust 側の監査には `cargo-deny`（設定ファイル: `src-tauri/deny.toml`）を使用する。未インストールの場合は `cargo install --locked cargo-deny` を実行すること。

### 2. 脆弱性発見時の対応フロー
1. **互換パッチの自動適用と検証**:
   - `node scripts/security_audit.js --fix` を実行し、`npm audit fix` および `cargo update` によるロックファイル更新と事前検証（フロントエンドビルド・`cargo check`・`cargo test`）を一括実行する。
2. **間接依存（孫パッケージ）の個別強制更新（自動修復で解消しない場合）**:
   - **Frontend (npm)**: 親パッケージが未対応で `npm audit fix` では解消しない場合、`frontend/package.json` の `"overrides"` フィールドに対象パッケージの安全なバージョンを指定して強制固定する。
   - **Backend (Rust)**: 特定クレートのみを更新する場合は `cargo update --manifest-path src-tauri/Cargo.toml -p <crate_name>` を実行する。メジャーバージョン跨ぎ等でロックされる場合は `src-tauri/Cargo.toml` の `[patch.crates-io]` を検討する。
3. **ライセンス・著作権表示（`NOTICE.md`）の整合性確認**:
   - パッケージの追加・削除・メジャー更新があった場合、または `cargo-deny` で未許可ライセンス警告が出た場合は、ライセンス条項（MIT / Apache-2.0 / BSD 等）を確認する。
   - 安全な新規オープンソースライセンスが間接依存に追加された場合は `src-tauri/deny.toml` の `allow` リストおよび `NOTICE.md` を適切に更新する（GPL / AGPL 等の強いコピーレフトライセンスの混入は原則禁止）。
4. **パッチリリース判定**:
   - 配布済みバイナリ（`.exe` / `.msix`）のセキュリティに影響する脆弱性を修正した場合は、上記の「アプリケーション バージョンアップ手順ルール」に従いパッチバージョン（`vX.Y.Z`）をインクリメントし、全配布モジュールを再生成すること。

