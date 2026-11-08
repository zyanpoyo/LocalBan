use chrono::Utc;
use rusqlite::{params, OptionalExtension};
use uuid::Uuid;

use crate::commands::helpers::{
    build_card_response, check_and_rebalance_cards, cleanup_old_cover_record,
    generate_stored_filename, remove_stored_file_quietly,
};
use crate::config::get_attachments_dir;
use crate::db::get_connection;
use crate::models::CardResponse;

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
    clear_due_date: Option<bool>,
    is_due_complete: Option<bool>,
    cover_attachment_id: Option<Option<String>>,
    clear_cover: Option<bool>,
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
    let new_due = if clear_due_date == Some(true) {
        None
    } else if let Some(due_opt) = due_date {
        match due_opt {
            Some(d) if !d.trim().is_empty() => Some(d),
            _ => None,
        }
    } else {
        existing.2
    };
    let new_comp = is_due_complete.unwrap_or(existing.3);
    let (new_cover, old_cover_to_delete) = if clear_cover == Some(true) {
        (None, existing.4.clone())
    } else if let Some(cover_opt) = cover_attachment_id {
        match cover_opt {
            Some(c) if !c.trim().is_empty() => {
                let trimmed = c.trim().to_string();
                let old_to_del = if existing.4.as_deref() != Some(&trimmed) {
                    existing.4.clone()
                } else {
                    None
                };
                (Some(trimmed), old_to_del)
            }
            _ => (None, existing.4.clone()),
        }
    } else {
        (existing.4.clone(), None)
    };
    let now = Utc::now().to_rfc3339();

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let mut old_stored_file_to_remove: Option<String> = None;
    if let Some(ref old_cid) = old_cover_to_delete {
        old_stored_file_to_remove = cleanup_old_cover_record(&tx, old_cid)?;
    }

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

    if let Some(old_fname) = old_stored_file_to_remove {
        remove_stored_file_quietly(&old_fname);
    }

    build_card_response(&conn, &id)
}

#[tauri::command]
pub fn move_card(id: String, list_id: String, position: f64) -> Result<CardResponse, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

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
            .prepare("SELECT id, filename, stored_filename, file_size, mime_type, is_cover FROM attachments WHERE card_id = ?1;")
            .map_err(|e| e.to_string())?;

        let atts: Vec<(String, String, String, i64, Option<String>, i32)> = att_stmt
            .query_map(params![&id], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        for (old_aid, fname, stored_fname, fsize, mime, is_cover) in atts {
            let new_stored = generate_stored_filename(&stored_fname);
            let src_path = attachments_dir.join(&stored_fname);
            let dst_path = attachments_dir.join(&new_stored);
            if src_path.exists() {
                let _ = std::fs::copy(&src_path, &dst_path);
            }

            let new_aid = Uuid::new_v4().to_string();
            tx.execute(
                "INSERT INTO attachments (id, card_id, filename, stored_filename, file_size, mime_type, is_cover, created_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8);",
                params![new_aid, new_card_id, fname, new_stored, fsize, mime, is_cover, now],
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

    for fname in stored_files {
        remove_stored_file_quietly(&fname);
    }

    let temp_card_dir = crate::watcher::get_temp_card_dir(&id);
    if temp_card_dir.exists() {
        let _ = std::fs::remove_dir_all(&temp_card_dir);
    }

    Ok(id)
}
