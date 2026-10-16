use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use std::path::Path;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;

use crate::config::{
    get_attachments_dir, safe_resolve_attachment_path, APP_NAME, APP_VERSION, MAX_UPLOAD_SIZE,
};
use crate::db::get_connection;
use crate::models::{
    AttachmentResponse, BoardStateResponse, CardResponse, ChecklistItemResponse,
    ChecklistResponse, LabelResponse, ListResponse, SystemStatusResponse,
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
pub fn shutdown_app(app: AppHandle) {
    crate::SHOULD_EXIT.store(true, std::sync::atomic::Ordering::SeqCst);
    app.exit(0);
}
