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
