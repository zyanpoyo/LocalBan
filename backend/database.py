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

        # 3. 新規DBの場合、サンプルカンバンリストを作成（ToDo, 進行中, 完了）
        cursor.execute("SELECT COUNT(*) as cnt FROM lists;")
        if cursor.fetchone()["cnt"] == 0:
            now = datetime.datetime.now(datetime.timezone.utc).isoformat()
            default_lists = [
                (str(uuid.uuid4()), "ToDo", 1000.0, now, now),
                (str(uuid.uuid4()), "進行中", 2000.0, now, now),
                (str(uuid.uuid4()), "完了", 3000.0, now, now),
            ]
            cursor.executemany("INSERT INTO lists (id, title, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?);", default_lists)

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
