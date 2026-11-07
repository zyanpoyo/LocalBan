---
name: localban-security-audit
description: LocalBan の依存ライブラリ脆弱性点検（npm audit, cargo-deny）およびライセンス整合性確認、依存更新時に使用する。「脆弱性をチェック」「ライブラリ更新」「security audit」「dependabot対応」「ライセンス確認」等の指示でトリガーする。
---

# LocalBan 依存ライブラリ脆弱性・ライセンス監査手順

フロントエンド（`frontend/package.json`）およびバックエンド（`src-tauri/Cargo.toml`）の依存ライブラリに関して、脆弱性検知（GitHub Dependabot 等）や定期点検、ライブラリ追加・更新を行う標準手順です。

---

## 1. 監査・自動更新コマンド

プロジェクトルートの統合スクリプト `scripts/security_audit.js` を使用します：

```powershell
# 監査モード（変更を加えず、npm / Rust 両方の脆弱性・ライセンス規約違反をチェック）
node scripts/security_audit.js

# 修復＆検証モード（互換範囲の自動パッチ更新 + ライセンスチェック + ビルド・単体テストまで一括実行）
node scripts/security_audit.js --fix
```

- **初回セットアップ**: Rust 側の監査には `cargo-deny`（設定ファイル: `src-tauri/deny.toml`）を使用します。未インストールの場合は `cargo install --locked cargo-deny` を実行してください。

---

## 2. 脆弱性発見時の対応フロー

### ステップ 1: 互換パッチの自動適用と検証
`node scripts/security_audit.js --fix` を実行し、`npm audit fix` および `cargo update` によるロックファイル更新と事前検証（フロントエンドビルド・`cargo check`・`cargo test`）を一括実行します。

### ステップ 2: 間接依存（孫パッケージ）の個別強制更新（自動修復で解消しない場合）
- **Frontend (npm)**:
  - 親パッケージが未対応で `npm audit fix` では解消しない場合、`frontend/package.json` の `"overrides"` フィールドに対象パッケージの安全なバージョンを指定して強制固定します。
- **Backend (Rust)**:
  - 特定クレートのみを更新する場合は `cargo update --manifest-path src-tauri/Cargo.toml -p <crate_name>` を実行します。
  - メジャーバージョン跨ぎ等でロックされる場合は `src-tauri/Cargo.toml` の `[patch.crates-io]` を検討します。

### ステップ 3: ライセンス・著作権表示（`NOTICE.md`）の整合性確認
- パッケージの追加・削除・メジャー更新があった場合、または `cargo-deny` で未許可ライセンス警告が出た場合は、ライセンス条項（MIT / Apache-2.0 / BSD 等）を確認します。
- 安全な新規オープンソースライセンスが間接依存に追加された場合は `src-tauri/deny.toml` の `allow` リストおよび `NOTICE.md` を適切に更新します（GPL / AGPL 等の強いコピーレフトライセンスの混入は原則禁止）。

### ステップ 4: パッチリリース判定
配布済みバイナリ（`.exe` / `.msix`）のセキュリティに影響する脆弱性を修正した場合は、`localban-version-bump` スキルに従いパッチバージョン（`vX.Y.Z`）をインクリメントし、全配布モジュールを再生成します。
