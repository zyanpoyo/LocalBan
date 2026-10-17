use chrono::Utc;
use rusqlite::{params, Connection, Result};
use std::collections::HashSet;
use uuid::Uuid;

use crate::config::{get_attachments_dir, get_db_path, init_dirs};

pub const CURRENT_SCHEMA_VERSION: i32 = 1;

pub fn get_connection() -> Result<Connection> {
    let db_path = get_db_path();
    let conn = Connection::open(&db_path)?;
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA foreign_keys = ON;",
    )?;
    Ok(conn)
}

pub fn init_database() -> Result<()> {
    let _ = init_dirs();
    let mut conn = get_connection()?;

    let tx = conn.transaction()?;

    // 1. テーブル作成
    tx.execute_batch(
        "CREATE TABLE IF NOT EXISTS lists (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            position REAL NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

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

        CREATE TABLE IF NOT EXISTS labels (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            color TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS card_labels (
            card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
            label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
            PRIMARY KEY (card_id, label_id)
        );

        CREATE TABLE IF NOT EXISTS checklists (
            id TEXT PRIMARY KEY,
            card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
            title TEXT NOT NULL DEFAULT 'チェックリスト',
            position REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS checklist_items (
            id TEXT PRIMARY KEY,
            checklist_id TEXT NOT NULL REFERENCES checklists(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            is_completed INTEGER NOT NULL DEFAULT 0,
            position REAL NOT NULL
        );

        CREATE TABLE IF NOT EXISTS attachments (
            id TEXT PRIMARY KEY,
            card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
            filename TEXT NOT NULL,
            stored_filename TEXT NOT NULL UNIQUE,
            file_size INTEGER NOT NULL,
            mime_type TEXT,
            created_at TEXT NOT NULL
        );",
    )?;

    // 2. 初期ラベル投入 (未登録の場合のみ)
    let label_count: i64 = tx.query_row("SELECT COUNT(*) FROM labels;", [], |r| r.get(0))?;
    if label_count == 0 {
        let preset_labels = [
            ("優先度: 高", "red"),
            ("優先度: 中", "yellow"),
            ("優先度: 低", "blue"),
            ("アイデア", "green"),
            ("調査中", "purple"),
            ("対応不要", "orange"),
        ];
        for (name, color) in preset_labels {
            tx.execute(
                "INSERT INTO labels (id, name, color) VALUES (?1, ?2, ?3);",
                params![Uuid::new_v4().to_string(), name, color],
            )?;
        }
    }

    // 3. 新規DBの場合、サンプルカンバンリストを作成（ToDo, 進行中, 完了）および初期カードを投入
    let list_count: i64 = tx.query_row("SELECT COUNT(*) FROM lists;", [], |r| r.get(0))?;
    if list_count == 0 {
        let now = Utc::now().to_rfc3339();
        let todo_list_id = Uuid::new_v4().to_string();
        let doing_list_id = Uuid::new_v4().to_string();
        let done_list_id = Uuid::new_v4().to_string();

        tx.execute(
            "INSERT INTO lists (id, title, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5);",
            params![&todo_list_id, "ToDo", 1000.0, &now, &now],
        )?;
        tx.execute(
            "INSERT INTO lists (id, title, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5);",
            params![&doing_list_id, "進行中", 2000.0, &now, &now],
        )?;
        tx.execute(
            "INSERT INTO lists (id, title, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5);",
            params![&done_list_id, "完了", 3000.0, &now, &now],
        )?;

        // ラベルIDマップ取得
        let mut label_map = std::collections::HashMap::new();
        {
            let mut stmt = tx.prepare("SELECT id, name FROM labels;")?;
            let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(1)?, r.get::<_, String>(0)?)))?;
            for row in rows {
                let (name, id) = row?;
                label_map.insert(name, id);
            }
        }

        // 初期カード投入
        let card_todo_id = Uuid::new_v4().to_string();
        let card_doing_id = Uuid::new_v4().to_string();
        let card_done_id = Uuid::new_v4().to_string();

        let desc_todo = "LocalBan はローカル環境で動作するシンプルなカンバンボードです。\n\n**基本操作:**\n- カードをクリックすると詳細画面が開き、説明の編集やチェックリストの作成ができます\n- カードをドラッグ＆ドロップして、右側の「進行中」や「完了」リストへ移動できます\n- リスト下部の「+ カードを追加」から新しいカードを作成できます";
        let desc_doing = "作業中のタスクは「進行中」リストに配置します。\n\n**操作ヒント:**\n- カードをつかんで上下にドラッグすると、同じリスト内での並び順を変更できます\n- 横にドラッグすると、他のリストへスムーズに移動できます\n- チェックリストのアイテムを完了にすると、進捗状況がカード上に表示されます";
        let desc_done = "終わったタスクは「完了」リストに移動して管理します。\n\n**完了後のアクション:**\n- カードの右上メニューや詳細画面から「アーカイブ」を行うと、ボード上を整理できます\n- アーカイブされたカードはヘッダー右上の「アーカイブ」ボタンからいつでも確認・復元できます";

        tx.execute(
            "INSERT INTO cards (id, list_id, title, description, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7);",
            params![&card_todo_id, &todo_list_id, "LocalBanへようこそ！ 基本操作を試してみましょう", desc_todo, 1000.0, &now, &now],
        )?;
        tx.execute(
            "INSERT INTO cards (id, list_id, title, description, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7);",
            params![&card_doing_id, &doing_list_id, "ドラッグ＆ドロップでカードを動かす", desc_doing, 1000.0, &now, &now],
        )?;
        tx.execute(
            "INSERT INTO cards (id, list_id, title, description, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7);",
            params![&card_done_id, &done_list_id, "完了したタスクを整理する", desc_done, 1000.0, &now, &now],
        )?;

        // チェックリスト投入
        let cl_todo_id = Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO checklists (id, card_id, title, position) VALUES (?1, ?2, ?3, ?4);",
            params![&cl_todo_id, &card_todo_id, "はじめてのステップ", 1000.0],
        )?;
        tx.execute("INSERT INTO checklist_items (id, checklist_id, content, is_completed, position) VALUES (?1, ?2, ?3, ?4, ?5);", params![Uuid::new_v4().to_string(), &cl_todo_id, "このカードをクリックして詳細を開く", 1, 1000.0])?;
        tx.execute("INSERT INTO checklist_items (id, checklist_id, content, is_completed, position) VALUES (?1, ?2, ?3, ?4, ?5);", params![Uuid::new_v4().to_string(), &cl_todo_id, "カードをドラッグして「進行中」へ移動する", 0, 2000.0])?;
        tx.execute("INSERT INTO checklist_items (id, checklist_id, content, is_completed, position) VALUES (?1, ?2, ?3, ?4, ?5);", params![Uuid::new_v4().to_string(), &cl_todo_id, "新しいカードを自分で作成してみる", 0, 3000.0])?;

        let cl_doing_id = Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO checklists (id, card_id, title, position) VALUES (?1, ?2, ?3, ?4);",
            params![&cl_doing_id, &card_doing_id, "作業チェック", 1000.0],
        )?;
        tx.execute("INSERT INTO checklist_items (id, checklist_id, content, is_completed, position) VALUES (?1, ?2, ?3, ?4, ?5);", params![Uuid::new_v4().to_string(), &cl_doing_id, "タスクに着手する", 1, 1000.0])?;
        tx.execute("INSERT INTO checklist_items (id, checklist_id, content, is_completed, position) VALUES (?1, ?2, ?3, ?4, ?5);", params![Uuid::new_v4().to_string(), &cl_doing_id, "完了したら「完了」リストへ移動する", 0, 2000.0])?;

        let cl_done_id = Uuid::new_v4().to_string();
        tx.execute(
            "INSERT INTO checklists (id, card_id, title, position) VALUES (?1, ?2, ?3, ?4);",
            params![&cl_done_id, &card_done_id, "完了確認", 1000.0],
        )?;
        tx.execute("INSERT INTO checklist_items (id, checklist_id, content, is_completed, position) VALUES (?1, ?2, ?3, ?4, ?5);", params![Uuid::new_v4().to_string(), &cl_done_id, "タスクの完了確認", 1, 1000.0])?;
        tx.execute("INSERT INTO checklist_items (id, checklist_id, content, is_completed, position) VALUES (?1, ?2, ?3, ?4, ?5);", params![Uuid::new_v4().to_string(), &cl_done_id, "必要に応じてアーカイブする", 1, 2000.0])?;

        // ラベル紐付け
        if let Some(lid) = label_map.get("アイデア") {
            tx.execute("INSERT INTO card_labels (card_id, label_id) VALUES (?1, ?2);", params![&card_todo_id, lid])?;
        }
        if let Some(lid) = label_map.get("優先度: 中") {
            tx.execute("INSERT INTO card_labels (card_id, label_id) VALUES (?1, ?2);", params![&card_doing_id, lid])?;
        }
        if let Some(lid) = label_map.get("優先度: 低") {
            tx.execute("INSERT INTO card_labels (card_id, label_id) VALUES (?1, ?2);", params![&card_done_id, lid])?;
        }
    }

    // 4. バージョン記録
    tx.execute_batch(&format!("PRAGMA user_version = {};", CURRENT_SCHEMA_VERSION))?;
    tx.commit()?;

    // 起動時の完全バックアップと孤立添付ファイルクリーンアップ
    crate::backup::perform_daily_backup(7);
    cleanup_orphaned_attachments();

    Ok(())
}

pub use crate::backup::{create_manual_snapshot, create_safety_backup, perform_daily_backup};

pub fn backup_database_to(dest_path: &std::path::Path) -> Result<()> {
    let db_path = get_db_path();
    if !db_path.exists() {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    if let Some(parent) = dest_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let src = Connection::open(&db_path)?;
    let mut dst = Connection::open(dest_path)?;
    let backup = rusqlite::backup::Backup::new(&src, &mut dst)?;
    backup.run_to_completion(10, std::time::Duration::from_millis(100), None)?;
    Ok(())
}

pub fn restore_database_from(src_path: &std::path::Path) -> Result<()> {
    // 1. ソースDBの整合性検証
    {
        let test_conn = Connection::open(src_path)?;
        let integrity: String = test_conn.query_row("PRAGMA quick_check;", [], |r| r.get(0))?;
        if integrity.to_lowercase() != "ok" {
            return Err(rusqlite::Error::InvalidQuery);
        }
    }

    // 2. ホットバックアップAPIを用いて現行DBに上書き復元
    let db_path = get_db_path();
    let src = Connection::open(src_path)?;
    let mut dst = Connection::open(&db_path)?;
    {
        let backup = rusqlite::backup::Backup::new(&src, &mut dst)?;
        backup.run_to_completion(10, std::time::Duration::from_millis(100), None)?;
    }

    // 3. WALのチェックポイント適用
    let _ = dst.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");

    Ok(())
}

pub fn cleanup_orphaned_attachments() {
    let attachments_dir = get_attachments_dir();
    if !attachments_dir.exists() {
        return;
    }

    if let Ok(conn) = get_connection() {
        let mut registered = HashSet::new();
        if let Ok(mut stmt) = conn.prepare("SELECT stored_filename FROM attachments;") {
            if let Ok(rows) = stmt.query_map([], |r| r.get::<_, String>(0)) {
                for r in rows.flatten() {
                    registered.insert(r);
                }
            }
        }

        if let Ok(entries) = std::fs::read_dir(&attachments_dir) {
            for entry in entries.flatten() {
                if let Ok(file_type) = entry.file_type() {
                    if file_type.is_file() {
                        if let Some(name) = entry.file_name().to_str() {
                            if !registered.contains(name) {
                                let _ = std::fs::remove_file(entry.path());
                            }
                        }
                    }
                }
            }
        }
    }
}
