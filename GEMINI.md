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
