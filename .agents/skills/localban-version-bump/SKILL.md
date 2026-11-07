---
name: localban-version-bump
description: LocalBan アプリケーションのバージョンアップ（vX.Y.Z更新）、リリース準備、またはWindows App Certification Kit (WACK) 検証案内を実施する際に使用する。「バージョンをあげる」「vX.Y.Zに更新」「リリース準備」「WACK検証」等の指示でトリガーする。
---

# LocalBan アプリケーション バージョンアップ & リリース手順

アプリケーションのバージョン番号更新（`vX.Y.Z`）、事前検証、配布モジュール生成、Git/PR運用、および WACK 手動検証案内の標準手順です。

---

## 1. 更新対象ファイル（全13箇所の一括同期）

以下のすべてのファイルにおいてバージョン番号（`vX.Y.Z` または MSIX用の `X.Y.Z.0`）を更新します：

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

---

## 2. 事前検証 (Pre-verification)

ファイル修正後、モジュールビルド前に必ず以下のコマンドを実行しエラーがないことを確認します：

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

---

## 3. モジュール作成義務 (Mandatory Build Rule)

事前検証が通った後、順にスクリプトを実行して配布物を生成します：

```powershell
node scripts/build_dist.js
node scripts/build_msix.js
```

`dist/` 配下に以下が出力されていることを確認します：
- `dist/LocalBan.exe`
- `dist/LocalBan-vX.Y.Z-setup.exe`
- `dist/LocalBan-vX.Y.Z-windows.zip`
- `dist/LocalBan-vX.Y.Z-x64.msix`

---

## 4. Git ブランチ運用・コミット・PR 発行

1. 新規ブランチ `chore/bump-version-X.Y.Z` を作成・チェックアウト。
2. 変更された13ファイルをステージングし、コミット：
   - コミットタイトル: `chore: bump version to vX.Y.Z`
   - コミット本文: 更新コンポーネント、検証パス、成果物生成の概要
3. リモート `LocalBan-github` にプッシュ（※プッシュ前にユーザー承認を取得）：
   ```powershell
   git push -u LocalBan-github chore/bump-version-X.Y.Z
   ```
4. GitHub 上で `main` をターゲットにしたプルリクエストを発行する。

---

## 5. Windows App Certification Kit (WACK) 検証案内

リリース作業・Store提出準備時、またはバージョンアップ・リリースビルドの完了時には、MSIX パッケージの適合性を確認するため、以下の手順でユーザーに手動での WACK（GUI）実行を案内します。

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
