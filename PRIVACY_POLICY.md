# プライバシーポリシー / Privacy Policy

**最終更新日 / Last Updated**: 2026年10月17日 (October 17, 2026)  
**対象アプリケーション / Target Application**: LocalBan  
**提供者・開発者 / Publisher & Developer**: LocalBan Project

---

## 🇯🇵 日本語 (Japanese)

### 1. 基本方針
**LocalBan**（以下「本アプリ」）は、ユーザーのプライバシーとデータの自己主権（ローカルファースト）を最優先に設計された、完全オフライン動作の個人用カンバンボードアプリケーションです。

### 2. 個人情報の収集・外部送信について（ゼロ・データコレクション）
本アプリは、ユーザーの個人情報、利用履歴、タスク内容、添付ファイル、クラッシュレポート、テレメトリデータ、またはデバイス識別情報を **一切収集・記録・外部送信しません**。

- **外部ネットワーク通信なし**: 本アプリには外部サーバーへの通信機能、アナリティクス SDK、広告モジュール、トラッキング機能は一切組み込まれていません。
- **アカウント登録不要**: ユーザー認証やアカウント作成を行うことなく、すべての機能をローカル環境のみでご利用いただけます。

### 3. データの保存場所と管理
本アプリで作成・編集されたすべてのデータ（ボード、リスト、カード、ラベル、チェックリスト、添付画像、日次バックアップ、アプリ設定、動作ログ）は、お使いの Windows デバイス内のローカルストレージにのみ保存されます。

- **exe 直接実行方式（ポータブル版 / Setup版）**: `%APPDATA%\LocalBan\`（`C:\Users\<ユーザー名>\AppData\Roaming\LocalBan\`）配下に保存されます。
- **Microsoft Store 版（MSIX パッケージ）**: Windows OS のファイルシステム仮想化（VFS）により、パッケージ専用領域（`%LOCALAPPDATA%\Packages\zyanpoyo.LocalBan_jcb2ksg0pnr1p\LocalCache\Roaming\LocalBan\`）配下に安全に隔離保存されます。
- 保存されたデータに対するアクセス権限は、お使いの PC のローカルユーザーアカウントに限定されます。
- 開発者や第三者がこれらのローカルデータにアクセスすることは技術的に不可能です。

### 4. データの削除方法
ユーザーがご自身のデータを削除したい場合は、以下の方法でいつでも完全に消去できます：
- **アプリ内からの削除**: 「アーカイブ一覧」モーダルから対象カードの完全削除を実行できます。
- **直接実行版（ポータブル版 / Setup版）の全データ削除**: 同梱の `uninstall.bat` を実行するか、エクスプローラーから `%APPDATA%\LocalBan\` フォルダを削除します。
- **Microsoft Store 版の全データ削除**: Windows の「設定」→「アプリ」→「インストールされているアプリ」から LocalBan を「アンインストール」すると、OS の標準仕様によりパッケージ専用データ領域も自動的に一括消去されます。

### 5. お問い合わせ・サポート窓口
本プライバシーポリシーや本アプリに関するご質問・不具合報告は、以下の公式 GitHub リポジトリの Issue 窓口までご連絡ください。

- **サポート窓口 (GitHub Issues)**: https://github.com/zyanpoyo/LocalBan/issues
- **プライバシーポリシー公開 URL**: https://github.com/zyanpoyo/LocalBan/blob/main/PRIVACY_POLICY.md

---

## 🇺🇸 English

### 1. Overview
**LocalBan** ("the Application") is a completely offline, local-first personal Kanban board application for Windows, designed with user privacy and data sovereignty as its highest priorities.

### 2. Zero Data Collection & No Telemetry
The Application **does not collect, store, transmit, or share** any personal information, usage analytics, task contents, attachments, crash reports, telemetry, or device identifiers.

- **No External Network Communication**: The Application contains no external server communication code, analytics SDKs, advertising modules, or tracking mechanisms.
- **No Account Required**: All features operate strictly offline on your local device without requiring user registration or authentication.

### 3. Local Data Storage
All data created or managed within the Application (boards, lists, cards, labels, checklists, image attachments, automatic daily backups, application settings, and logs) is stored exclusively on your local Windows device:
- **Direct Executable (Portable / Setup version)**: Stored under `%APPDATA%\LocalBan\` (`C:\Users\<Username>\AppData\Roaming\LocalBan\`).
- **Microsoft Store version (MSIX package)**: Safely isolated under the Windows package local cache directory (`%LOCALAPPDATA%\Packages\zyanpoyo.LocalBan_jcb2ksg0pnr1p\LocalCache\Roaming\LocalBan\`) via Windows Virtual File System (VFS).
- Neither the developer nor any third party has access to your local data.

### 4. Data Deletion
You retain full control over your data at all times:
- **Within Application**: Permanently delete archived cards via the Archive modal.
- **Direct Executable version**: Run `uninstall.bat` or delete the `%APPDATA%\LocalBan\` folder in File Explorer.
- **Microsoft Store version**: Uninstalling the app via Windows Settings ("Installed apps") automatically removes the entire sandboxed package data area.

### 5. Contact & Support
If you have any questions regarding this Privacy Policy or the Application, please contact the developer via GitHub Issues:

- **Support URL (GitHub Issues)**: https://github.com/zyanpoyo/LocalBan/issues
- **Privacy Policy URL**: https://github.com/zyanpoyo/LocalBan/blob/main/PRIVACY_POLICY.md
