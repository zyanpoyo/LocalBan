import sqlite3
import shutil
import datetime
import uuid
from pathlib import Path
from contextlib import contextmanager
from typing import Generator
from backend.config import get_db_path, get_backups_dir, get_attachments_dir

CURRENT_SCHEMA_VERSION = 1

def get_connection() -> sqlite3.Connection:
    db_path = get_db_path()
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    # WAL モードと外部キー制約の有効化
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_database() -> None:
    """スキーマ作成、初期ラベル・初期リスト投入、マイグレーション管理"""
    db_path = get_db_path()
    is_new_db = not db_path.exists()
    
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 1. テーブル作成
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS lists (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            position REAL NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS cards (
            id TEXT PRIMARY KEY,
            list_id TEXT REFERENCES lists(id) ON DELETE SET NULL,
            original_list_title TEXT,
            title TEXT NOT NULL,
            description TEXT NOT NULL DEFAULT '',
            position REAL NOT NULL,
            due_date TEXT,
            is_due_complete INTEGER NOT NULL DEFAULT 0,
            cover_attachment_id TEXT,
            is_archived INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS labels (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            color TEXT NOT NULL
        );
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS card_labels (
            card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
            label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
            PRIMARY KEY (card_id, label_id)
        );
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS checklists (
            id TEXT PRIMARY KEY,
            card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
            title TEXT NOT NULL DEFAULT 'チェックリスト',
            position REAL NOT NULL
        );
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS checklist_items (
            id TEXT PRIMARY KEY,
            checklist_id TEXT NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            is_completed INTEGER NOT NULL DEFAULT 0,
            position REAL NOT NULL
        );
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS attachments (
            id TEXT PRIMARY KEY,
            card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
            filename TEXT NOT NULL,
            stored_filename TEXT NOT NULL UNIQUE,
            file_size INTEGER NOT NULL,
            mime_type TEXT,
            created_at TEXT NOT NULL
        );
        """)

        # 2. 初期ラベル投入 (未登録の場合のみ)
        cursor.execute("SELECT COUNT(*) as cnt FROM labels;")
        if cursor.fetchone()["cnt"] == 0:
            preset_labels = [
                (str(uuid.uuid4()), "優先度: 高", "red"),
                (str(uuid.uuid4()), "優先度: 中", "yellow"),
                (str(uuid.uuid4()), "優先度: 低", "blue"),
                (str(uuid.uuid4()), "アイデア", "green"),
                (str(uuid.uuid4()), "調査中", "purple"),
                (str(uuid.uuid4()), "対応不要", "orange"),
            ]
            cursor.executemany("INSERT INTO labels (id, name, color) VALUES (?, ?, ?);", preset_labels)

        # 3. 新規DBの場合、サンプルカンバンリストを作成（ToDo, 進行中, 完了）および初期カードを投入
        cursor.execute("SELECT COUNT(*) as cnt FROM lists;")
        if cursor.fetchone()["cnt"] == 0:
            now = datetime.datetime.now(datetime.timezone.utc).isoformat()
            todo_list_id = str(uuid.uuid4())
            doing_list_id = str(uuid.uuid4())
            done_list_id = str(uuid.uuid4())
            default_lists = [
                (todo_list_id, "ToDo", 1000.0, now, now),
                (doing_list_id, "進行中", 2000.0, now, now),
                (done_list_id, "完了", 3000.0, now, now),
            ]
            cursor.executemany("INSERT INTO lists (id, title, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?);", default_lists)

            # ラベルIDマップ取得
            cursor.execute("SELECT id, name FROM labels;")
            label_map = {row["name"]: row["id"] for row in cursor.fetchall()}

            # 各リストに対応する初期カード投入（各1枚）
            card_todo_id = str(uuid.uuid4())
            card_doing_id = str(uuid.uuid4())
            card_done_id = str(uuid.uuid4())

            default_cards = [
                (
                    card_todo_id,
                    todo_list_id,
                    "LocalBanへようこそ！ 基本操作を試してみましょう",
                    "LocalBan はローカル環境で動作するシンプルなカンバンボードです。\n\n"
                    "**基本操作:**\n"
                    "- カードをクリックすると詳細画面が開き、説明の編集やチェックリストの作成ができます\n"
                    "- カードをドラッグ＆ドロップして、右側の「進行中」や「完了」リストへ移動できます\n"
                    "- リスト下部の「+ カードを追加」から新しいカードを作成できます",
                    1000.0,
                    now,
                    now
                ),
                (
                    card_doing_id,
                    doing_list_id,
                    "ドラッグ＆ドロップでカードを動かす",
                    "作業中のタスクは「進行中」リストに配置します。\n\n"
                    "**操作ヒント:**\n"
                    "- カードをつかんで上下にドラッグすると、同じリスト内での並び順を変更できます\n"
                    "- 横にドラッグすると、他のリストへスムーズに移動できます\n"
                    "- チェックリストのアイテムを完了にすると、進捗状況がカード上に表示されます",
                    1000.0,
                    now,
                    now
                ),
                (
                    card_done_id,
                    done_list_id,
                    "完了したタスクを整理する",
                    "終わったタスクは「完了」リストに移動して管理します。\n\n"
                    "**完了後のアクション:**\n"
                    "- カードの右上メニューや詳細画面から「アーカイブ」を行うと、ボード上を整理できます\n"
                    "- アーカイブされたカードはヘッダー右上の「アーカイブ」ボタンからいつでも確認・復元できます",
                    1000.0,
                    now,
                    now
                )
            ]
            cursor.executemany(
                "INSERT INTO cards (id, list_id, title, description, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?);",
                default_cards
            )

            # チェックリストおよびアイテム投入
            # 1. ToDo カード用チェックリスト
            cl_todo_id = str(uuid.uuid4())
            cursor.execute("INSERT INTO checklists (id, card_id, title, position) VALUES (?, ?, ?, ?);", (cl_todo_id, card_todo_id, "はじめてのステップ", 1000.0))
            cursor.executemany(
                "INSERT INTO checklist_items (id, checklist_id, content, is_completed, position) VALUES (?, ?, ?, ?, ?);",
                [
                    (str(uuid.uuid4()), cl_todo_id, "このカードをクリックして詳細を開く", 1, 1000.0),
                    (str(uuid.uuid4()), cl_todo_id, "カードをドラッグして「進行中」へ移動する", 0, 2000.0),
                    (str(uuid.uuid4()), cl_todo_id, "新しいカードを自分で作成してみる", 0, 3000.0),
                ]
            )

            # 2. 進行中 カード用チェックリスト
            cl_doing_id = str(uuid.uuid4())
            cursor.execute("INSERT INTO checklists (id, card_id, title, position) VALUES (?, ?, ?, ?);", (cl_doing_id, card_doing_id, "作業チェック", 1000.0))
            cursor.executemany(
                "INSERT INTO checklist_items (id, checklist_id, content, is_completed, position) VALUES (?, ?, ?, ?, ?);",
                [
                    (str(uuid.uuid4()), cl_doing_id, "タスクに着手する", 1, 1000.0),
                    (str(uuid.uuid4()), cl_doing_id, "完了したら「完了」リストへ移動する", 0, 2000.0),
                ]
            )

            # 3. 完了 カード用チェックリスト
            cl_done_id = str(uuid.uuid4())
            cursor.execute("INSERT INTO checklists (id, card_id, title, position) VALUES (?, ?, ?, ?);", (cl_done_id, card_done_id, "完了確認", 1000.0))
            cursor.executemany(
                "INSERT INTO checklist_items (id, checklist_id, content, is_completed, position) VALUES (?, ?, ?, ?, ?);",
                [
                    (str(uuid.uuid4()), cl_done_id, "タスクの完了確認", 1, 1000.0),
                    (str(uuid.uuid4()), cl_done_id, "必要に応じてアーカイブする", 1, 2000.0),
                ]
            )

            # ラベル紐付け
            card_labels = []
            if "アイデア" in label_map:
                card_labels.append((card_todo_id, label_map["アイデア"]))
            if "優先度: 中" in label_map:
                card_labels.append((card_doing_id, label_map["優先度: 中"]))
            if "優先度: 低" in label_map:
                card_labels.append((card_done_id, label_map["優先度: 低"]))

            if card_labels:
                cursor.executemany("INSERT INTO card_labels (card_id, label_id) VALUES (?, ?);", card_labels)

        # 4. バージョン記録
        cursor.execute(f"PRAGMA user_version = {CURRENT_SCHEMA_VERSION};")

    # 起動時の安全処理
    perform_daily_backup()
    cleanup_orphaned_attachments()

def perform_daily_backup(keep_days: int = 7) -> None:
    """起動時に直近DBを日次バックアップフォルダへコピー（直近7世代保持）"""
    db_path = get_db_path()
    if not db_path.exists():
        return
    
    backups_dir = get_backups_dir()
    today_str = datetime.date.today().strftime("%Y%m%d")
    today_backup = backups_dir / f"localban_{today_str}.db"
    
    try:
        # 当日のバックアップがなければ作成
        if not today_backup.exists():
            # SQLite のオンラインバックアップ API を安全に使用
            src_conn = sqlite3.connect(str(db_path))
            dst_conn = sqlite3.connect(str(today_backup))
            with dst_conn:
                src_conn.backup(dst_conn)
            dst_conn.close()
            src_conn.close()

        # 7世代ローテーション（古いバックアップの削除）
        existing_backups = sorted(backups_dir.glob("localban_*.db"))
        if len(existing_backups) > keep_days:
            for old_file in existing_backups[:-keep_days]:
                try:
                    old_file.unlink()
                except Exception:
                    pass
    except Exception as e:
        # バックアップの失敗でアプリ起動を止めない
        pass

def cleanup_orphaned_attachments() -> None:
    """DB に存在しない孤立添付ファイルのクリーンアップ"""
    attachments_dir = get_attachments_dir()
    if not attachments_dir.exists():
        return
    
    try:
        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT stored_filename FROM attachments;")
            registered_files = {row["stored_filename"] for row in cursor.fetchall()}
            
        for file_path in attachments_dir.iterdir():
            if file_path.is_file() and file_path.name not in registered_files:
                try:
                    file_path.unlink()
                except Exception:
                    pass
    except Exception:
        pass
