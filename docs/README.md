# LocalBan 設計ドキュメント (Technical Documentation) - v2.0.0

個人用オフラインカンバンボード「LocalBan v2.0.0」の技術設計ドキュメントです。  
Tauri v2 (Full Rust) による高速・軽量な独立デスクトップクライアントアプリの設計・仕様をまとめています。

---

## 📚 ドキュメント構成

### 1. [システム全体概要 (architecture/system_overview.md)](architecture/system_overview.md)
- **システムアーキテクチャ図**: Windows 11、Tauri v2、Rust コアバックエンド、WebView2 フロントエンド、ネイティブ IPC
- **コア設計原則**: 完全オフライン、ゼロ設定、安全な2段階削除、常駐型ライフサイクル
- **セキュリティ設計**: Tauri IPC 境界、パストラバーサル防止、MIME検証、nosniff配信、単一インスタンス制御
- **プロセス＆ライフサイクル制御**: 起動フロー、×ボタンでのタスクトレイ格納、トレイ常駐、完全終了連携
- **フロントエンド連携**: ネイティブ IPC (`invoke`)、カスタムプロトコル `localban://` による画像配信、保存ダイアログ

### 2. [データスキーマ設計 (database/schema_design.md)](database/schema_design.md)
- **接続設定**: SQLite WALモード、外部キー制約強制（`PRAGMA foreign_keys=ON`）、Rust (`rusqlite`) による管理
- **ER図 (Entity-Relationship Diagram)**: 全7テーブルのリレーション図
- **テーブル定義詳細**:
  - `lists`: カンバンリスト
  - `cards`: カード詳細、カバー画像、期限
  - `labels` / `card_labels`: タグ・ラベル（多対多）
  - `checklists` / `checklist_items`: チェックリスト
  - `attachments`: 添付ファイルメタデータ（実体UUID管理）
- **特殊データ整合性ロジック**:
  - リスト削除時のカード自動アーカイブ退避
  - 2段階完全削除と孤立ファイル掃除
  - Fractional Indexing 自動リバランス
  - 日次自動オンラインバックアップ（最新7世代保持）

### 3. [キーボードショートカット操作ガイド (keyboard_shortcuts.md)](keyboard_shortcuts.md)
- **カード作成・保存フロー**: <kbd>c</kbd> / <kbd>n</kbd> / <kbd>1〜9</kbd> での作成開始、<kbd>Enter</kbd>（連続作成）、<kbd>Ctrl+Enter</kbd>（保存終了）、<kbd>Shift+Enter</kbd>（保存＋詳細展開）、IME変換保護
- **ボードナビゲーション**: 矢印キー（<kbd>←</kbd><kbd>→</kbd> カラム切替、<kbd>↑</kbd><kbd>↓</kbd> カード選択・自動スクロール）、<kbd>Enter</kbd>/<kbd>Space</kbd> 詳細展開
- **詳細モーダル内操作**: <kbd>Ctrl+Shift+P</kbd>（編集/プレビュー切替）、<kbd>Ctrl+Enter</kbd>（保存）、<kbd>e</kbd> / <kbd>d</kbd> / <kbd>t</kbd> / <kbd>c</kbd> / <kbd>a</kbd> クイック操作、段階的 <kbd>Escape</kbd> 処理
- **ヘルプ表示**: <kbd>?</kbd> キーによるショートカット一覧モーダル

### 4. [Markdown記法・ショートカットキー対応表 (markdown_shortcuts.md)](markdown_shortcuts.md)
- **テキスト装飾・リンク・コードのショートカットキー対応表**: 太字、斜体、取り消し線、インラインコード、コードブロック、リンク挿入、プレビュー切替（`Ctrl+Shift+P`）、保存（`Ctrl+Enter`）
- **Qiita互換 ノート記法（`:::note info` / `warn` / `alert`）**: 3種類のコールアウト表示と専用ショートカットキー（`Ctrl+Shift+1`〜`3`）
- **フォーマットツールバー & ヘルプポップオーバー**: ワンクリック装飾挿入とショートカット一覧表示
