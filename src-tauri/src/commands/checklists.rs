use rusqlite::{params, OptionalExtension};
use uuid::Uuid;

use crate::db::get_connection;
use crate::models::{ChecklistItemResponse, ChecklistResponse};

#[tauri::command]
pub fn create_checklist(
    card_id: String,
    title: Option<String>,
) -> Result<ChecklistResponse, String> {
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
