use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use std::path::Path;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;

use crate::config::{
    get_attachments_dir, get_backups_dir, get_settings_path, load_settings,
    safe_resolve_attachment_path, save_settings, AppSettings, APP_NAME, APP_VERSION,
    MAX_UPLOAD_SIZE,
};
use crate::db::{
    backup_database_to, create_manual_snapshot, create_safety_backup, get_connection,
    restore_database_from,
};
use crate::models::{
    AppSettingsResponse, AttachmentResponse, BackupFileInfo, BackupManifest,
    BoardStateResponse, CardResponse, ChecklistItemResponse, ChecklistResponse, LabelResponse,
    ListResponse, RestoreResult, SystemStatusResponse,
};

fn row_to_list(row: &rusqlite::Row) -> rusqlite::Result<ListResponse> {
    Ok(ListResponse {
        id: row.get(0)?,
        title: row.get(1)?,
        position: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
    })
}

pub fn build_card_response(conn: &Connection, card_id: &str) -> Result<CardResponse, String> {
    let mut card_stmt = conn
        .prepare(
            "SELECT id, list_id, original_list_title, title, description, position,
                    due_date, is_due_complete, cover_attachment_id, is_archived,
                    created_at, updated_at
             FROM cards WHERE id = ?1;",
        )
        .map_err(|e| e.to_string())?;

    let card = card_stmt
        .query_row(params![card_id], |row| {
            let is_due_complete: i32 = row.get(7)?;
            let is_archived: i32 = row.get(9)?;
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, f64>(5)?,
                row.get::<_, Option<String>>(6)?,
                is_due_complete != 0,
                row.get::<_, Option<String>>(8)?,
                is_archived != 0,
                row.get::<_, String>(10)?,
                row.get::<_, String>(11)?,
            ))
        })
        .map_err(|e| format!("Card not found: {}", e))?;

    // 1. Labels
    let mut labels = Vec::new();
    {
        let mut stmt = conn
            .prepare(
                "SELECT l.id, l.name, l.color
                 FROM labels l
                 JOIN card_labels cl ON l.id = cl.label_id
                 WHERE cl.card_id = ?1
                 ORDER BY l.name ASC;",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(params![card_id], |r| {
                Ok(LabelResponse {
                    id: r.get(0)?,
                    name: r.get(1)?,
                    color: r.get(2)?,
                })
            })
            .map_err(|e| e.to_string())?;

        for r in rows {
            labels.push(r.map_err(|e| e.to_string())?);
        }
    }

    // 2. Checklists & Items
    let mut checklists = Vec::new();
    {
        let mut cl_stmt = conn
            .prepare(
                "SELECT id, card_id, title, position
                 FROM checklists
                 WHERE card_id = ?1
                 ORDER BY position ASC, id ASC;",
            )
            .map_err(|e| e.to_string())?;

        let cl_rows = cl_stmt
            .query_map(params![card_id], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, f64>(3)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        for cl_res in cl_rows {
            let (cid, c_card_id, c_title, c_pos) = cl_res.map_err(|e| e.to_string())?;

            let mut item_stmt = conn
                .prepare(
                    "SELECT id, checklist_id, content, is_completed, position
                     FROM checklist_items
                     WHERE checklist_id = ?1
                     ORDER BY position ASC, id ASC;",
                )
                .map_err(|e| e.to_string())?;

            let item_rows = item_stmt
                .query_map(params![&cid], |ir| {
                    let is_comp: i32 = ir.get(3)?;
                    Ok(ChecklistItemResponse {
                        id: ir.get(0)?,
                        checklist_id: ir.get(1)?,
                        content: ir.get(2)?,
                        is_completed: is_comp != 0,
                        position: ir.get(4)?,
                    })
                })
                .map_err(|e| e.to_string())?;

            let mut items = Vec::new();
            for ir in item_rows {
                items.push(ir.map_err(|e| e.to_string())?);
            }

            checklists.push(ChecklistResponse {
                id: cid,
                card_id: c_card_id,
                title: c_title,
                position: c_pos,
                items,
            });
        }
    }

    // 3. Attachments
    let mut attachments = Vec::new();
    {
        let mut att_stmt = conn
            .prepare(
                "SELECT id, card_id, filename, stored_filename, file_size, mime_type, created_at
                 FROM attachments
                 WHERE card_id = ?1
                 ORDER BY created_at ASC;",
            )
            .map_err(|e| e.to_string())?;

        let att_rows = att_stmt
            .query_map(params![card_id], |r| {
                Ok(AttachmentResponse {
                    id: r.get(0)?,
                    card_id: r.get(1)?,
                    filename: r.get(2)?,
                    stored_filename: r.get(3)?,
                    file_size: r.get(4)?,
                    mime_type: r.get(5)?,
                    created_at: r.get(6)?,
                })
            })
            .map_err(|e| e.to_string())?;

        for ar in att_rows {
            attachments.push(ar.map_err(|e| e.to_string())?);
        }
    }

    Ok(CardResponse {
        id: card.0,
        list_id: card.1,
        original_list_title: card.2,
        title: card.3,
        description: card.4,
        position: card.5,
        due_date: card.6,
        is_due_complete: card.7,
        cover_attachment_id: card.8,
        is_archived: card.9,
        created_at: card.10,
        updated_at: card.11,
        labels,
        checklists,
        attachments,
    })
}

pub fn check_and_rebalance_cards(conn: &Connection, list_id: &str) -> Result<(), String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, position FROM cards WHERE list_id = ?1 AND is_archived = 0 ORDER BY position ASC;",
        )
        .map_err(|e| e.to_string())?;

    let rows: Vec<(String, f64)> = stmt
        .query_map(params![list_id], |r| Ok((r.get(0)?, r.get(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    if rows.len() < 2 {
        return Ok(());
    }

    let mut needs_rebalance = false;
    for i in 0..(rows.len() - 1) {
        let diff = rows[i + 1].1 - rows[i].1;
        if diff < 0.0001 {
            needs_rebalance = true;
            break;
        }
    }

    if needs_rebalance {
        for (idx, (cid, _)) in rows.iter().enumerate() {
            let new_pos = (idx + 1) as f64 * 1000.0;
            conn.execute(
                "UPDATE cards SET position = ?1 WHERE id = ?2;",
                params![new_pos, cid],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

// ==========================================
// Tauri Commands
// ==========================================

#[tauri::command]
pub fn get_board_state() -> Result<BoardStateResponse, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    let mut list_stmt = conn
        .prepare("SELECT * FROM lists ORDER BY position ASC, created_at ASC;")
        .map_err(|e| e.to_string())?;
    let lists: Vec<ListResponse> = list_stmt
        .query_map([], row_to_list)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut card_id_stmt = conn
        .prepare("SELECT id FROM cards WHERE is_archived = 0 ORDER BY position ASC, created_at ASC;")
        .map_err(|e| e.to_string())?;
    let card_ids: Vec<String> = card_id_stmt
        .query_map([], |r| r.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut cards = Vec::new();
    for cid in card_ids {
        cards.push(build_card_response(&conn, &cid)?);
    }

    let mut label_stmt = conn
        .prepare("SELECT id, name, color FROM labels ORDER BY name ASC;")
        .map_err(|e| e.to_string())?;
    let labels: Vec<LabelResponse> = label_stmt
        .query_map([], |r| {
            Ok(LabelResponse {
                id: r.get(0)?,
                name: r.get(1)?,
                color: r.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(BoardStateResponse {
        lists,
        cards,
        labels,
    })
}

// Lists
#[tauri::command]
pub fn get_lists() -> Result<Vec<ListResponse>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT * FROM lists ORDER BY position ASC, created_at ASC;")
        .map_err(|e| e.to_string())?;
    let lists = stmt
        .query_map([], row_to_list)
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(lists)
}

#[tauri::command]
pub fn create_list(title: String, position: Option<f64>) -> Result<ListResponse, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let title_trimmed = title.trim().to_string();
    if title_trimmed.is_empty() {
        return Err("Title cannot be empty".to_string());
    }

    let pos = match position {
        Some(p) => p,
        None => {
            let max_pos: Option<f64> = conn
                .query_row("SELECT MAX(position) FROM lists;", [], |r| r.get(0))
                .optional()
                .map_err(|e| e.to_string())?
                .flatten();
            max_pos.unwrap_or(0.0) + 1000.0
        }
    };

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "INSERT INTO lists (id, title, position, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5);",
        params![&id, &title_trimmed, pos, &now, &now],
    )
    .map_err(|e| e.to_string())?;

    conn.query_row("SELECT * FROM lists WHERE id = ?1;", params![&id], row_to_list)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_list(
    id: String,
    title: Option<String>,
    position: Option<f64>,
) -> Result<ListResponse, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let existing = conn
        .query_row("SELECT * FROM lists WHERE id = ?1;", params![&id], row_to_list)
        .map_err(|_| "List not found".to_string())?;

    let new_title = match title {
        Some(t) => t.trim().to_string(),
        None => existing.title,
    };
    let new_pos = position.unwrap_or(existing.position);
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE lists SET title = ?1, position = ?2, updated_at = ?3 WHERE id = ?4;",
        params![new_title, new_pos, now, id],
    )
    .map_err(|e| e.to_string())?;

    conn.query_row("SELECT * FROM lists WHERE id = ?1;", params![&id], row_to_list)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_list(id: String) -> Result<String, String> {
    let mut conn = get_connection().map_err(|e| e.to_string())?;
    let target_title: String = conn
        .query_row(
            "SELECT title FROM lists WHERE id = ?1;",
            params![&id],
            |r| r.get(0),
        )
        .map_err(|_| "List not found".to_string())?;

    let now = Utc::now().to_rfc3339();
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // 所属カードを自動アーカイブ
    tx.execute(
        "UPDATE cards SET is_archived = 1, list_id = NULL, original_list_title = ?1, updated_at = ?2 WHERE list_id = ?3;",
        params![target_title, now, id],
    )
    .map_err(|e| e.to_string())?;

    // リスト削除
    tx.execute("DELETE FROM lists WHERE id = ?1;", params![&id])
        .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;
    Ok(id)
}

// Cards
#[tauri::command]
pub fn get_cards() -> Result<Vec<CardResponse>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id FROM cards WHERE is_archived = 0 ORDER BY position ASC, created_at ASC;")
        .map_err(|e| e.to_string())?;

    let ids: Vec<String> = stmt
        .query_map([], |r| r.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut cards = Vec::new();
    for id in ids {
        cards.push(build_card_response(&conn, &id)?);
    }
    Ok(cards)
}

#[tauri::command]
pub fn get_card(id: String) -> Result<CardResponse, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    build_card_response(&conn, &id)
}

#[tauri::command]
pub fn create_card(
    list_id: String,
    title: String,
    description: Option<String>,
    position: Option<f64>,
) -> Result<CardResponse, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    // リスト存在確認
    let list_exists: bool = conn
        .query_row(
            "SELECT 1 FROM lists WHERE id = ?1;",
            params![&list_id],
            |_| Ok(true),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .unwrap_or(false);

    if !list_exists {
        return Err("Target list does not exist".to_string());
    }

    let pos = match position {
        Some(p) => p,
        None => {
            let max_pos: Option<f64> = conn
                .query_row(
                    "SELECT MAX(position) FROM cards WHERE list_id = ?1 AND is_archived = 0;",
                    params![&list_id],
                    |r| r.get(0),
                )
                .optional()
                .map_err(|e| e.to_string())?
                .flatten();
            max_pos.unwrap_or(0.0) + 1000.0
        }
    };

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let desc = description.unwrap_or_default();

    conn.execute(
        "INSERT INTO cards (id, list_id, title, description, position, is_archived, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, 0, ?6, ?7);",
        params![&id, &list_id, title.trim(), desc, pos, &now, &now],
    )
    .map_err(|e| e.to_string())?;

    build_card_response(&conn, &id)
}

#[tauri::command]
pub fn update_card(
    id: String,
    title: Option<String>,
    description: Option<String>,
    due_date: Option<Option<String>>,
    is_due_complete: Option<bool>,
    cover_attachment_id: Option<Option<String>>,
    label_ids: Option<Vec<String>>,
) -> Result<CardResponse, String> {
    let mut conn = get_connection().map_err(|e| e.to_string())?;

    let existing = conn
        .query_row(
            "SELECT title, description, due_date, is_due_complete, cover_attachment_id FROM cards WHERE id = ?1;",
            params![&id],
            |r| {
                let is_comp: i32 = r.get(3)?;
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, Option<String>>(2)?,
                    is_comp != 0,
                    r.get::<_, Option<String>>(4)?,
                ))
            },
        )
        .map_err(|_| "Card not found".to_string())?;

    let new_title = title.map(|t| t.trim().to_string()).unwrap_or(existing.0);
    let new_desc = description.unwrap_or(existing.1);
    let new_due = due_date.unwrap_or(existing.2);
    let new_comp = is_due_complete.unwrap_or(existing.3);
    let new_cover = cover_attachment_id.unwrap_or(existing.4);
    let now = Utc::now().to_rfc3339();

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE cards SET title = ?1, description = ?2, due_date = ?3, is_due_complete = ?4, cover_attachment_id = ?5, updated_at = ?6 WHERE id = ?7;",
        params![new_title, new_desc, new_due, new_comp as i32, new_cover, now, id],
    )
    .map_err(|e| e.to_string())?;

    if let Some(lids) = label_ids {
        tx.execute("DELETE FROM card_labels WHERE card_id = ?1;", params![&id])
            .map_err(|e| e.to_string())?;
        for lid in lids {
            tx.execute(
                "INSERT OR IGNORE INTO card_labels (card_id, label_id) VALUES (?1, ?2);",
                params![&id, lid],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    tx.commit().map_err(|e| e.to_string())?;
    build_card_response(&conn, &id)
}

#[tauri::command]
pub fn move_card(id: String, list_id: String, position: f64) -> Result<CardResponse, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    // リスト確認
    let list_exists: bool = conn
        .query_row(
            "SELECT 1 FROM lists WHERE id = ?1;",
            params![&list_id],
            |_| Ok(true),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .unwrap_or(false);

    if !list_exists {
        return Err("Target list not found".to_string());
    }

    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE cards SET list_id = ?1, position = ?2, updated_at = ?3 WHERE id = ?4;",
        params![&list_id, position, now, id],
    )
    .map_err(|e| e.to_string())?;

    check_and_rebalance_cards(&conn, &list_id)?;
    build_card_response(&conn, &id)
}

#[tauri::command]
pub fn copy_card(id: String, target_list_id: Option<String>) -> Result<CardResponse, String> {
    let mut conn = get_connection().map_err(|e| e.to_string())?;
    let attachments_dir = get_attachments_dir();

    let src = conn
        .query_row(
            "SELECT list_id, title, description, position, due_date, is_due_complete, cover_attachment_id FROM cards WHERE id = ?1;",
            params![&id],
            |r| {
                Ok((
                    r.get::<_, Option<String>>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, f64>(3)?,
                    r.get::<_, Option<String>>(4)?,
                    r.get::<_, i32>(5)?,
                    r.get::<_, Option<String>>(6)?,
                ))
            },
        )
        .map_err(|_| "Source card not found".to_string())?;

    let t_list = target_list_id.or(src.0).ok_or("Target list not specified")?;
    let target_pos = src.3 + 10.0;
    let new_card_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let copy_title = format!("{} のコピー", src.1);

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    tx.execute(
        "INSERT INTO cards (id, list_id, title, description, position, due_date, is_due_complete, is_archived, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, ?8, ?9);",
        params![new_card_id, t_list, copy_title, src.2, target_pos, src.4, src.5, now, now],
    )
    .map_err(|e| e.to_string())?;

    // 1. ラベルコピー
    {
        let mut stmt = tx
            .prepare("SELECT label_id FROM card_labels WHERE card_id = ?1;")
            .map_err(|e| e.to_string())?;
        let lids: Vec<String> = stmt
            .query_map(params![&id], |r| r.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        for lid in lids {
            tx.execute(
                "INSERT INTO card_labels (card_id, label_id) VALUES (?1, ?2);",
                params![&new_card_id, lid],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    // 2. チェックリストコピー
    {
        let mut cl_stmt = tx
            .prepare("SELECT id, title, position FROM checklists WHERE card_id = ?1;")
            .map_err(|e| e.to_string())?;

        let cls: Vec<(String, String, f64)> = cl_stmt
            .query_map(params![&id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        for (old_cid, title, pos) in cls {
            let new_cid = Uuid::new_v4().to_string();
            tx.execute(
                "INSERT INTO checklists (id, card_id, title, position) VALUES (?1, ?2, ?3, ?4);",
                params![new_cid, new_card_id, title, pos],
            )
            .map_err(|e| e.to_string())?;

            let mut item_stmt = tx
                .prepare("SELECT content, is_completed, position FROM checklist_items WHERE checklist_id = ?1;")
                .map_err(|e| e.to_string())?;

            let items: Vec<(String, i32, f64)> = item_stmt
                .query_map(params![old_cid], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))
                .map_err(|e| e.to_string())?
                .filter_map(|r| r.ok())
                .collect();

            for (content, comp, ipos) in items {
                tx.execute(
                    "INSERT INTO checklist_items (id, checklist_id, content, is_completed, position) VALUES (?1, ?2, ?3, ?4, ?5);",
                    params![Uuid::new_v4().to_string(), new_cid, content, comp, ipos],
                )
                .map_err(|e| e.to_string())?;
            }
        }
    }

    // 3. 添付ファイルコピー（実体も複製）
    let mut new_cover_id = None;
    {
        let mut att_stmt = tx
            .prepare("SELECT id, filename, stored_filename, file_size, mime_type FROM attachments WHERE card_id = ?1;")
            .map_err(|e| e.to_string())?;

        let atts: Vec<(String, String, String, i64, Option<String>)> = att_stmt
            .query_map(params![&id], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        for (old_aid, fname, stored_fname, fsize, mime) in atts {
            let ext = Path::new(&stored_fname)
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("");
            let new_stored = if ext.is_empty() {
                Uuid::new_v4().simple().to_string()
            } else {
                format!("{}.{}", Uuid::new_v4().simple(), ext)
            };

            let src_path = attachments_dir.join(&stored_fname);
            let dst_path = attachments_dir.join(&new_stored);
            if src_path.exists() {
                let _ = std::fs::copy(&src_path, &dst_path);
            }

            let new_aid = Uuid::new_v4().to_string();
            tx.execute(
                "INSERT INTO attachments (id, card_id, filename, stored_filename, file_size, mime_type, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7);",
                params![new_aid, new_card_id, fname, new_stored, fsize, mime, now],
            )
            .map_err(|e| e.to_string())?;

            if src.6.as_deref() == Some(&old_aid) {
                new_cover_id = Some(new_aid);
            }
        }
    }

    if let Some(cid) = new_cover_id {
        tx.execute(
            "UPDATE cards SET cover_attachment_id = ?1 WHERE id = ?2;",
            params![cid, new_card_id],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.commit().map_err(|e| e.to_string())?;
    check_and_rebalance_cards(&conn, &t_list)?;
    build_card_response(&conn, &new_card_id)
}

#[tauri::command]
pub fn archive_card(id: String) -> Result<String, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let now = Utc::now().to_rfc3339();
    conn.execute(
        "UPDATE cards SET is_archived = 1, updated_at = ?1 WHERE id = ?2;",
        params![now, id],
    )
    .map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
pub fn get_archived_cards() -> Result<Vec<CardResponse>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id FROM cards WHERE is_archived = 1 ORDER BY updated_at DESC;")
        .map_err(|e| e.to_string())?;

    let ids: Vec<String> = stmt
        .query_map([], |r| r.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut cards = Vec::new();
    for id in ids {
        cards.push(build_card_response(&conn, &id)?);
    }
    Ok(cards)
}

#[tauri::command]
pub fn restore_card(id: String, target_list_id: Option<String>) -> Result<CardResponse, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    let (current_list_id,): (Option<String>,) = conn
        .query_row(
            "SELECT list_id FROM cards WHERE id = ?1;",
            params![&id],
            |r| Ok((r.get(0)?,)),
        )
        .map_err(|_| "Card not found".to_string())?;

    let mut chosen_list = target_list_id;
    if chosen_list.is_none() {
        if let Some(ref lid) = current_list_id {
            let exists: bool = conn
                .query_row(
                    "SELECT 1 FROM lists WHERE id = ?1;",
                    params![lid],
                    |_| Ok(true),
                )
                .optional()
                .map_err(|e| e.to_string())?
                .unwrap_or(false);
            if exists {
                chosen_list = Some(lid.clone());
            }
        }
    }

    if chosen_list.is_none() {
        let first_id: Option<String> = conn
            .query_row(
                "SELECT id FROM lists ORDER BY position ASC LIMIT 1;",
                [],
                |r| r.get(0),
            )
            .optional()
            .map_err(|e| e.to_string())?;
        chosen_list = first_id;
    }

    let final_list_id = chosen_list.ok_or("No list available to restore card")?;
    let max_pos: Option<f64> = conn
        .query_row(
            "SELECT MAX(position) FROM cards WHERE list_id = ?1 AND is_archived = 0;",
            params![&final_list_id],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .flatten();

    let pos = max_pos.unwrap_or(0.0) + 1000.0;
    let now = Utc::now().to_rfc3339();

    conn.execute(
        "UPDATE cards SET is_archived = 0, list_id = ?1, position = ?2, updated_at = ?3 WHERE id = ?4;",
        params![final_list_id, pos, now, id],
    )
    .map_err(|e| e.to_string())?;

    build_card_response(&conn, &id)
}

#[tauri::command]
pub fn permanently_delete_card(id: String) -> Result<String, String> {
    let mut conn = get_connection().map_err(|e| e.to_string())?;
    let is_archived: i32 = conn
        .query_row(
            "SELECT is_archived FROM cards WHERE id = ?1;",
            params![&id],
            |r| r.get(0),
        )
        .map_err(|_| "Card not found".to_string())?;

    if is_archived == 0 {
        return Err("Cannot permanently delete unarchived card".to_string());
    }

    let stored_files: Vec<String> = {
        let mut stmt = conn
            .prepare("SELECT stored_filename FROM attachments WHERE card_id = ?1;")
            .map_err(|e| e.to_string())?;

        let files = stmt
            .query_map(params![&id], |r| r.get(0))
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();
        files
    };

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM cards WHERE id = ?1;", params![&id])
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;

    // 実体ファイル削除
    for fname in stored_files {
        if let Ok(path) = safe_resolve_attachment_path(&fname) {
            let _ = std::fs::remove_file(path);
        }
    }

    Ok(id)
}

// Checklists
#[tauri::command]
pub fn create_checklist(card_id: String, title: Option<String>) -> Result<ChecklistResponse, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let title_str = title.unwrap_or_else(|| "チェックリスト".to_string());

    let max_pos: Option<f64> = conn
        .query_row(
            "SELECT MAX(position) FROM checklists WHERE card_id = ?1;",
            params![&card_id],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .flatten();

    let pos = max_pos.unwrap_or(0.0) + 1000.0;
    let cid = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO checklists (id, card_id, title, position) VALUES (?1, ?2, ?3, ?4);",
        params![&cid, &card_id, title_str.trim(), pos],
    )
    .map_err(|e| e.to_string())?;

    Ok(ChecklistResponse {
        id: cid,
        card_id,
        title: title_str,
        position: pos,
        items: Vec::new(),
    })
}

#[tauri::command]
pub fn update_checklist(id: String, title: String) -> Result<ChecklistResponse, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let title_trimmed = title.trim().to_string();

    conn.execute(
        "UPDATE checklists SET title = ?1 WHERE id = ?2;",
        params![title_trimmed, id],
    )
    .map_err(|e| e.to_string())?;

    let (card_id, position): (String, f64) = conn
        .query_row(
            "SELECT card_id, position FROM checklists WHERE id = ?1;",
            params![&id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|_| "Checklist not found".to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, checklist_id, content, is_completed, position FROM checklist_items WHERE checklist_id = ?1 ORDER BY position ASC;")
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map(params![&id], |r| {
            let is_comp: i32 = r.get(3)?;
            Ok(ChecklistItemResponse {
                id: r.get(0)?,
                checklist_id: r.get(1)?,
                content: r.get(2)?,
                is_completed: is_comp != 0,
                position: r.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(ChecklistResponse {
        id,
        card_id,
        title: title_trimmed,
        position,
        items,
    })
}

#[tauri::command]
pub fn delete_checklist(id: String) -> Result<String, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM checklists WHERE id = ?1;", params![&id])
        .map_err(|e| e.to_string())?;
    Ok(id)
}

#[tauri::command]
pub fn create_checklist_item(
    checklist_id: String,
    content: String,
) -> Result<ChecklistItemResponse, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let content_trimmed = content.trim().to_string();

    let max_pos: Option<f64> = conn
        .query_row(
            "SELECT MAX(position) FROM checklist_items WHERE checklist_id = ?1;",
            params![&checklist_id],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .flatten();

    let pos = max_pos.unwrap_or(0.0) + 1000.0;
    let item_id = Uuid::new_v4().to_string();

    conn.execute(
        "INSERT INTO checklist_items (id, checklist_id, content, is_completed, position) VALUES (?1, ?2, ?3, 0, ?4);",
        params![&item_id, &checklist_id, content_trimmed, pos],
    )
    .map_err(|e| e.to_string())?;

    Ok(ChecklistItemResponse {
        id: item_id,
        checklist_id,
        content: content_trimmed,
        is_completed: false,
        position: pos,
    })
}

#[tauri::command]
pub fn update_checklist_item(
    id: String,
    content: Option<String>,
    is_completed: Option<bool>,
    position: Option<f64>,
) -> Result<ChecklistItemResponse, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    let existing = conn
        .query_row(
            "SELECT checklist_id, content, is_completed, position FROM checklist_items WHERE id = ?1;",
            params![&id],
            |r| {
                let is_comp: i32 = r.get(2)?;
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    is_comp != 0,
                    r.get::<_, f64>(3)?,
                ))
            },
        )
        .map_err(|_| "Checklist item not found".to_string())?;

    let new_content = content.map(|c| c.trim().to_string()).unwrap_or(existing.1);
    let new_comp = is_completed.unwrap_or(existing.2);
    let new_pos = position.unwrap_or(existing.3);

    conn.execute(
        "UPDATE checklist_items SET content = ?1, is_completed = ?2, position = ?3 WHERE id = ?4;",
        params![new_content, new_comp as i32, new_pos, id],
    )
    .map_err(|e| e.to_string())?;

    Ok(ChecklistItemResponse {
        id,
        checklist_id: existing.0,
        content: new_content,
        is_completed: new_comp,
        position: new_pos,
    })
}

#[tauri::command]
pub fn delete_checklist_item(id: String) -> Result<String, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM checklist_items WHERE id = ?1;", params![&id])
        .map_err(|e| e.to_string())?;
    Ok(id)
}

// Labels
#[tauri::command]
pub fn get_labels() -> Result<Vec<LabelResponse>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, color FROM labels ORDER BY name ASC;")
        .map_err(|e| e.to_string())?;
    let labels = stmt
        .query_map([], |r| {
            Ok(LabelResponse {
                id: r.get(0)?,
                name: r.get(1)?,
                color: r.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(labels)
}

#[tauri::command]
pub fn create_label(name: String, color: String) -> Result<LabelResponse, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let id = Uuid::new_v4().to_string();
    let name_trimmed = name.trim().to_string();
    let color_trimmed = color.trim().to_string();

    conn.execute(
        "INSERT INTO labels (id, name, color) VALUES (?1, ?2, ?3);",
        params![&id, &name_trimmed, &color_trimmed],
    )
    .map_err(|e| e.to_string())?;

    Ok(LabelResponse {
        id,
        name: name_trimmed,
        color: color_trimmed,
    })
}

#[tauri::command]
pub fn update_label(
    id: String,
    name: Option<String>,
    color: Option<String>,
) -> Result<LabelResponse, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let existing: (String, String) = conn
        .query_row(
            "SELECT name, color FROM labels WHERE id = ?1;",
            params![&id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .map_err(|_| "Label not found".to_string())?;

    let new_name = name.map(|n| n.trim().to_string()).unwrap_or(existing.0);
    let new_color = color.map(|c| c.trim().to_string()).unwrap_or(existing.1);

    conn.execute(
        "UPDATE labels SET name = ?1, color = ?2 WHERE id = ?3;",
        params![new_name, new_color, id],
    )
    .map_err(|e| e.to_string())?;

    Ok(LabelResponse {
        id,
        name: new_name,
        color: new_color,
    })
}

#[tauri::command]
pub fn delete_label(id: String) -> Result<String, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM labels WHERE id = ?1;", params![&id])
        .map_err(|e| e.to_string())?;
    Ok(id)
}

// Attachments
#[tauri::command]
pub fn upload_attachment(
    card_id: String,
    filename: String,
    mime_type: String,
    data: Vec<u8>,
) -> Result<AttachmentResponse, String> {
    if data.len() > MAX_UPLOAD_SIZE {
        return Err("File size exceeds 50MB limit".to_string());
    }

    let conn = get_connection().map_err(|e| e.to_string())?;
    let card_info: Option<(Option<String>,)> = conn
        .query_row(
            "SELECT cover_attachment_id FROM cards WHERE id = ?1;",
            params![&card_id],
            |r| Ok((r.get(0)?,)),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let cover_id = card_info.ok_or("Card not found")?.0;

    let ext = Path::new(&filename)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("");
    let stored_filename = if ext.is_empty() {
        Uuid::new_v4().simple().to_string()
    } else {
        format!("{}.{}", Uuid::new_v4().simple(), ext)
    };

    let target_path = safe_resolve_attachment_path(&stored_filename)?;
    if let Some(parent) = target_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::write(&target_path, &data).map_err(|e| e.to_string())?;

    let attach_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let file_size = data.len() as i64;

    conn.execute(
        "INSERT INTO attachments (id, card_id, filename, stored_filename, file_size, mime_type, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7);",
        params![attach_id, card_id, filename, stored_filename, file_size, mime_type, now],
    )
    .map_err(|e| e.to_string())?;

    if cover_id.is_none() && mime_type.starts_with("image/") && mime_type != "image/svg+xml" {
        let _ = conn.execute(
            "UPDATE cards SET cover_attachment_id = ?1 WHERE id = ?2;",
            params![attach_id, card_id],
        );
    }

    Ok(AttachmentResponse {
        id: attach_id,
        card_id,
        filename,
        stored_filename,
        file_size,
        mime_type: Some(mime_type),
        created_at: now,
    })
}

#[tauri::command]
pub fn delete_attachment(id: String) -> Result<String, String> {
    let mut conn = get_connection().map_err(|e| e.to_string())?;
    let stored_name: String = conn
        .query_row(
            "SELECT stored_filename FROM attachments WHERE id = ?1;",
            params![&id],
            |r| r.get(0),
        )
        .map_err(|_| "Attachment not found".to_string())?;

    let tx = conn.transaction().map_err(|e| e.to_string())?;
    tx.execute(
        "UPDATE cards SET cover_attachment_id = NULL WHERE cover_attachment_id = ?1;",
        params![&id],
    )
    .map_err(|e| e.to_string())?;
    tx.execute("DELETE FROM attachments WHERE id = ?1;", params![&id])
        .map_err(|e| e.to_string())?;
    tx.commit().map_err(|e| e.to_string())?;

    if let Ok(path) = safe_resolve_attachment_path(&stored_name) {
        let _ = std::fs::remove_file(path);
    }

    Ok(id)
}

#[tauri::command]
pub async fn save_attachment_as(
    app: AppHandle,
    id: String,
    default_filename: String,
) -> Result<(), String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let stored_name: String = conn
        .query_row(
            "SELECT stored_filename FROM attachments WHERE id = ?1;",
            params![&id],
            |r| r.get(0),
        )
        .map_err(|_| "Attachment not found".to_string())?;

    let src_path = safe_resolve_attachment_path(&stored_name)?;
    if !src_path.exists() {
        return Err("File not found on disk".to_string());
    }

    let file_path = app
        .dialog()
        .file()
        .set_file_name(&default_filename)
        .blocking_save_file();

    if let Some(dest) = file_path {
        std::fs::copy(&src_path, dest.as_path().unwrap()).map_err(|e| e.to_string())?;
    }

    Ok(())
}

// System
#[tauri::command]
pub fn get_system_status() -> SystemStatusResponse {
    SystemStatusResponse {
        status: "running".to_string(),
        app: APP_NAME.to_string(),
        version: APP_VERSION.to_string(),
    }
}

#[tauri::command]
pub fn get_app_settings() -> AppSettingsResponse {
    let settings = load_settings();
    crate::CLOSE_TO_TRAY.store(settings.close_to_tray, std::sync::atomic::Ordering::SeqCst);
    AppSettingsResponse {
        close_to_tray: settings.close_to_tray,
    }
}

#[tauri::command]
pub fn update_app_settings(close_to_tray: bool) -> Result<AppSettingsResponse, String> {
    let settings = AppSettings { close_to_tray };
    save_settings(&settings)?;
    crate::CLOSE_TO_TRAY.store(close_to_tray, std::sync::atomic::Ordering::SeqCst);
    Ok(AppSettingsResponse { close_to_tray })
}

#[tauri::command]
pub fn shutdown_app(app: AppHandle) {
    crate::SHOULD_EXIT.store(true, std::sync::atomic::Ordering::SeqCst);
    app.exit(0);
}

pub fn validate_external_url(url: &str) -> Result<(), String> {
    if !url.starts_with("https://") && !url.starts_with("http://") {
        return Err("Only http and https URLs are allowed".to_string());
    }
    Ok(())
}

#[tauri::command]
pub fn open_external_url(app: AppHandle, url: String) -> Result<(), String> {
    validate_external_url(&url)?;
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(&url, None::<&str>)
        .map_err(|e| e.to_string())
}

// ==========================================
// バックアップ & 復元 コマンド群
// ==========================================

#[tauri::command]
pub async fn export_backup(app: AppHandle) -> Result<Option<String>, String> {
    let now_str = Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let default_name = format!("localban_backup_{}.localban", now_str);

    let save_path = app
        .dialog()
        .file()
        .set_file_name(&default_name)
        .add_filter("LocalBan Backup (*.localban)", &["localban"])
        .add_filter("ZIP Archive (*.zip)", &["zip"])
        .blocking_save_file();

    let dest_path = match save_path {
        Some(p) => match p {
            tauri_plugin_dialog::FilePath::Path(path) => path,
            tauri_plugin_dialog::FilePath::Url(url) => {
                url.to_file_path().map_err(|_| "Invalid destination URL".to_string())?
            }
        },
        None => return Ok(None),
    };

    // 1. 一時スナップショットDBの作成
    let backups_dir = get_backups_dir();
    let temp_db_name = format!("temp_export_{}.db", Uuid::new_v4());
    let temp_db_path = backups_dir.join(&temp_db_name);
    backup_database_to(&temp_db_path).map_err(|e| format!("Failed to snapshot database: {}", e))?;

    // 2. メタデータ集計
    let (lists_count, cards_count, attachments_count) = {
        let conn = rusqlite::Connection::open(&temp_db_path).map_err(|e| e.to_string())?;
        let l_count: usize = conn.query_row("SELECT COUNT(*) FROM lists;", [], |r| r.get(0)).unwrap_or(0);
        let c_count: usize = conn.query_row("SELECT COUNT(*) FROM cards;", [], |r| r.get(0)).unwrap_or(0);
        let a_count: usize = conn.query_row("SELECT COUNT(*) FROM attachments;", [], |r| r.get(0)).unwrap_or(0);
        (l_count, c_count, a_count)
    };

    let manifest = BackupManifest {
        version: APP_VERSION.to_string(),
        exported_at: Utc::now().to_rfc3339(),
        lists_count,
        cards_count,
        attachments_count,
    };

    // 3. ZIPアーカイブ生成
    let file = std::fs::File::create(&dest_path).map_err(|e| format!("Failed to create output file: {}", e))?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // 3.1. manifest.json
    if let Ok(manifest_json) = serde_json::to_string_pretty(&manifest) {
        let _ = zip.start_file("manifest.json", options);
        let _ = std::io::Write::write_all(&mut zip, manifest_json.as_bytes());
    }

    // 3.2. localban.db
    if let Ok(mut db_file) = std::fs::File::open(&temp_db_path) {
        let _ = zip.start_file("localban.db", options);
        let _ = std::io::copy(&mut db_file, &mut zip);
    }
    let _ = std::fs::remove_file(&temp_db_path);

    // 3.3. settings.json (存在する場合)
    let settings_path = get_settings_path();
    if settings_path.exists() {
        if let Ok(mut s_file) = std::fs::File::open(&settings_path) {
            let _ = zip.start_file("settings.json", options);
            let _ = std::io::copy(&mut s_file, &mut zip);
        }
    }

    // 3.4. attachments フォルダの実体ファイル
    let attachments_dir = get_attachments_dir();
    if attachments_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&attachments_dir) {
            for entry in entries.flatten() {
                if let Ok(ft) = entry.file_type() {
                    if ft.is_file() {
                        let path = entry.path();
                        if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                            let zip_entry_name = format!("attachments/{}", file_name);
                            if zip.start_file(&zip_entry_name, options).is_ok() {
                                if let Ok(mut af) = std::fs::File::open(&path) {
                                    let _ = std::io::copy(&mut af, &mut zip);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    zip.finish().map_err(|e| format!("Failed to finalize zip archive: {}", e))?;

    Ok(Some(dest_path.to_string_lossy().to_string()))
}

#[tauri::command]
pub async fn import_backup(app: AppHandle) -> Result<Option<RestoreResult>, String> {
    let pick_result = app
        .dialog()
        .file()
        .add_filter("All Supported (*.localban, *.zip, *.db)", &["localban", "zip", "db"])
        .add_filter("LocalBan Backup (*.localban, *.zip)", &["localban", "zip"])
        .add_filter("SQLite Database (*.db)", &["db"])
        .blocking_pick_file();

    let src_path = match pick_result {
        Some(p) => match p {
            tauri_plugin_dialog::FilePath::Path(path) => path,
            tauri_plugin_dialog::FilePath::Url(url) => {
                url.to_file_path().map_err(|_| "Invalid source URL".to_string())?
            }
        },
        None => return Ok(None),
    };

    if !src_path.exists() {
        return Err("Selected file does not exist".to_string());
    }

    // 復元直前のセーフティバックアップを作成
    let _ = create_safety_backup().map_err(|e| format!("Failed to create safety backup: {}", e))?;

    // ファイル判定 (ZIPかSQLite DBか)
    let mut header = [0u8; 16];
    {
        let mut f = std::fs::File::open(&src_path).map_err(|e| e.to_string())?;
        use std::io::Read;
        let _ = f.read(&mut header);
    }

    let is_sqlite = header.starts_with(b"SQLite format 3\0");
    let is_zip = header.starts_with(&[0x50, 0x4b, 0x03, 0x04])
        || header.starts_with(&[0x50, 0x4b, 0x05, 0x06])
        || header.starts_with(&[0x50, 0x4b, 0x07, 0x08]);

    let mut restored_attachments = 0;

    if is_sqlite {
        // SQLite 単体ファイル復元
        restore_database_from(&src_path).map_err(|e| format!("Failed to restore SQLite database: {}", e))?;
    } else if is_zip {
        // ZIP / .localban 復元
        let file = std::fs::File::open(&src_path).map_err(|e| format!("Failed to read backup file: {}", e))?;
        let mut archive = zip::ZipArchive::new(file).map_err(|e| format!("Invalid zip archive: {}", e))?;

        let backups_dir = get_backups_dir();
        let temp_extracted_db = backups_dir.join(format!("temp_restore_{}.db", Uuid::new_v4()));
        let mut db_found = false;

        let attachments_dir = get_attachments_dir();
        let _ = std::fs::create_dir_all(&attachments_dir);

        for i in 0..archive.len() {
            let mut file = archive.by_index(i).map_err(|e| format!("Failed to read archive entry: {}", e))?;
            let enclosed_name = match file.enclosed_name() {
                Some(p) => p.to_owned(),
                None => continue,
            };

            let name_str = enclosed_name.to_string_lossy().to_string();

            if name_str == "localban.db" {
                let mut out = std::fs::File::create(&temp_extracted_db)
                    .map_err(|e| format!("Failed to extract db: {}", e))?;
                std::io::copy(&mut file, &mut out)
                    .map_err(|e| format!("Failed to write extracted db: {}", e))?;
                db_found = true;
            } else if name_str.starts_with("attachments/") || name_str.starts_with("attachments\\") {
                if let Some(file_name) = enclosed_name.file_name() {
                    let dest_file_path = attachments_dir.join(file_name);
                    if let Ok(mut out) = std::fs::File::create(&dest_file_path) {
                        if std::io::copy(&mut file, &mut out).is_ok() {
                            restored_attachments += 1;
                        }
                    }
                }
            } else if name_str == "settings.json" {
                let settings_path = get_settings_path();
                if let Ok(mut out) = std::fs::File::create(&settings_path) {
                    let _ = std::io::copy(&mut file, &mut out);
                }
            }
        }

        if !db_found {
            let _ = std::fs::remove_file(&temp_extracted_db);
            return Err("Invalid LocalBan backup: 'localban.db' not found in archive".to_string());
        }

        let restore_res = restore_database_from(&temp_extracted_db);
        let _ = std::fs::remove_file(&temp_extracted_db);
        restore_res.map_err(|e| format!("Failed to restore database from backup: {}", e))?;
    } else {
        return Err("Unsupported file format. Please select a .localban, .zip, or .db file.".to_string());
    }

    // 復元後データの集計
    let conn = get_connection().map_err(|e| e.to_string())?;
    let lists_count: usize = conn.query_row("SELECT COUNT(*) FROM lists;", [], |r| r.get(0)).unwrap_or(0);
    let cards_count: usize = conn.query_row("SELECT COUNT(*) FROM cards;", [], |r| r.get(0)).unwrap_or(0);

    Ok(Some(RestoreResult {
        success: true,
        message: "バックアップからの復元が正常に完了しました".to_string(),
        lists_count,
        cards_count,
        attachments_restored: restored_attachments,
    }))
}

#[tauri::command]
pub fn list_internal_backups() -> Result<Vec<BackupFileInfo>, String> {
    let backups_dir = get_backups_dir();
    let mut list = Vec::new();

    if let Ok(entries) = std::fs::read_dir(&backups_dir) {
        for entry in entries.flatten() {
            if let Ok(ft) = entry.file_type() {
                if ft.is_file() {
                    let path = entry.path();
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        if name.ends_with(".db") && (name.starts_with("localban_") || name.starts_with("pre_restore_")) {
                            let metadata = entry.metadata().ok();
                            let size_bytes = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
                            let created_at = metadata
                                .and_then(|m| m.modified().ok())
                                .map(|time| chrono::DateTime::<Utc>::from(time).to_rfc3339())
                                .unwrap_or_else(|| Utc::now().to_rfc3339());

                            let is_safety = name.starts_with("pre_restore_");

                            list.push(BackupFileInfo {
                                filename: name.to_string(),
                                path: path.to_string_lossy().to_string(),
                                created_at,
                                size_bytes,
                                is_safety_backup: is_safety,
                            });
                        }
                    }
                }
            }
        }
    }

    // 新しい順にソート
    list.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(list)
}

#[tauri::command]
pub fn create_internal_backup() -> Result<BackupFileInfo, String> {
    let path = create_manual_snapshot().map_err(|e| format!("Failed to create snapshot: {}", e))?;
    let filename = path.file_name().and_then(|n| n.to_str()).unwrap_or("unknown.db").to_string();
    let size_bytes = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);

    Ok(BackupFileInfo {
        filename,
        path: path.to_string_lossy().to_string(),
        created_at: Utc::now().to_rfc3339(),
        size_bytes,
        is_safety_backup: false,
    })
}

#[tauri::command]
pub fn restore_from_internal_backup(filename: String) -> Result<RestoreResult, String> {
    // セキュリティチェック: パストラバーサル対策 (ファイル名にパス区切りが含まれていないこと)
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err("Invalid backup filename".to_string());
    }

    let backups_dir = get_backups_dir();
    let target_path = backups_dir.join(&filename);
    if !target_path.exists() {
        return Err("Specified backup file does not exist".to_string());
    }

    // 復元直前セーフティバックアップを作成
    let _ = create_safety_backup().map_err(|e| format!("Failed to create safety backup: {}", e))?;

    // 復元実行
    restore_database_from(&target_path).map_err(|e| format!("Failed to restore database: {}", e))?;

    // 集計
    let conn = get_connection().map_err(|e| e.to_string())?;
    let lists_count: usize = conn.query_row("SELECT COUNT(*) FROM lists;", [], |r| r.get(0)).unwrap_or(0);
    let cards_count: usize = conn.query_row("SELECT COUNT(*) FROM cards;", [], |r| r.get(0)).unwrap_or(0);

    Ok(RestoreResult {
        success: true,
        message: format!("スナップショット '{}' から復元しました", filename),
        lists_count,
        cards_count,
        attachments_restored: 0,
    })
}

#[tauri::command]
pub fn open_backups_folder(app: AppHandle) -> Result<(), String> {
    let backups_dir = get_backups_dir();
    let _ = std::fs::create_dir_all(&backups_dir);

    use tauri_plugin_opener::OpenerExt;
    let path_str = backups_dir.to_string_lossy().to_string();
    app.opener()
        .reveal_item_in_dir(&path_str)
        .map_err(|e| format!("Failed to open folder: {}", e))
}
