# LocalBan プロジェクト開発ルール

## ソースコード修正時のモジュール作成義務 (Mandatory Build Rule)
ソースコード（`src-tauri/`, `frontend/src/` 等）の修正を行った作業セッションでは、作業完了報告の前に**必ず**以下のビルドスクリプトを実行して成果物（`dist/` 配下の exe / zip / msix）を生成してください。

```powershell
node scripts/build_dist.js
node scripts/build_msix.js
```
- **詳細手順・検証・免除規定**: [`localban-build`](file:///c:/Users/ymasa/MyProject/LocalBan/.agents/skills/localban-build/SKILL.md) スキルを参照。
  - ※ドキュメントや設定ファイル単体の軽微な修正、`.gitignore` 配下のみの修正時はビルド免除。

## プロジェクト固有スキル (Runbooks & Procedures)
以下の作業を実施する際は、対応するスキルを参照・実行してください：
- **バージョンアップ・リリース・ストア提出 (WACK検証)**: [`localban-version-bump`](file:///c:/Users/ymasa/MyProject/LocalBan/.agents/skills/localban-version-bump/SKILL.md)
- **依存ライブラリの脆弱性・ライセンス監査**: [`localban-security-audit`](file:///c:/Users/ymasa/MyProject/LocalBan/.agents/skills/localban-security-audit/SKILL.md)
- **ビルド・パッケージング詳細**: [`localban-build`](file:///c:/Users/ymasa/MyProject/LocalBan/.agents/skills/localban-build/SKILL.md)
