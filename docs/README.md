# LocalBan 設計ドキュメント (Technical Documentation)

個人用オフラインカンバンボード「LocalBan」の技術設計ドキュメントです。

---

## 📚 ドキュメント構成

### 1. [システム全体概要 (architecture/system_overview.md)](architecture/system_overview.md)
- **システムアーキテクチャ図**: Windows 11、プロセス空間、スレッドモデル、ブラウザ連携
- **コア設計原則**: 完全オフライン、ゼロ設定、安全な2段階削除、使いやすい終了フロー
- **セキュリティ設計**: CSRF / DNS Rebinding対策、トークン認証、XSS防止、パストラバーサル防止、50MB制限
- **プロセス＆ライフサイクル制御**: 起動フロー、多重起動防止、シャットダウン連携
- **フロントエンド同期機能**: Web標準 `BroadcastChannel` による複数タブ同期、リアルタイム保存状態インジケーター

### 2. [データスキーマ設計 (database/schema_design.md)](database/schema_design.md)
- **接続設定**: SQLite WALモード、外部キー制約強制（`PRAGMA foreign_keys=ON`）
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
  - 日次自動バックアップ（最新7世代保持）
