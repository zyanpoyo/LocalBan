use chrono::Utc;
use rusqlite::{params, OptionalExtension};
use uuid::Uuid;

use crate::commands::helpers::{build_card_response, row_to_list, LIST_SELECT_FIELDS};
use crate::db::get_connection;
use crate::models::{BoardStateResponse, LabelResponse, ListResponse};

#[tauri::command]
pub fn get_board_state() -> Result<BoardStateResponse, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    let mut list_stmt = conn
        .prepare(&format!(
            "SELECT {LIST_SELECT_FIELDS} FROM lists ORDER BY position ASC, created_at ASC;"
        ))
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

#[tauri::command]
pub fn get_lists() -> Result<Vec<ListResponse>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(&format!(
            "SELECT {LIST_SELECT_FIELDS} FROM lists ORDER BY position ASC, created_at ASC;"
        ))
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
        "INSERT INTO lists (id, title, position, color, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6);",
        params![&id, &title_trimmed, pos, None::<String>, &now, &now],
    )
    .map_err(|e| e.to_string())?;

    conn.query_row(
        &format!("SELECT {LIST_SELECT_FIELDS} FROM lists WHERE id = ?1;"),
        params![&id],
        row_to_list,
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_list_color(id: String, color: Option<String>) -> Result<ListResponse, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let _existing = conn
        .query_row(
            &format!("SELECT {LIST_SELECT_FIELDS} FROM lists WHERE id = ?1;"),
            params![&id],
            row_to_list,
        )
        .map_err(|_| "List not found".to_string())?;

    let now = Utc::now().to_rfc3339();
    let color_trimmed = color.and_then(|c| {
        let t = c.trim().to_string();
        if t.is_empty() || t == "default" {
            None
        } else {
            Some(t)
        }
    });

    conn.execute(
        "UPDATE lists SET color = ?1, updated_at = ?2 WHERE id = ?3;",
        params![color_trimmed, now, id],
    )
    .map_err(|e| e.to_string())?;

    conn.query_row(
        &format!("SELECT {LIST_SELECT_FIELDS} FROM lists WHERE id = ?1;"),
        params![&id],
        row_to_list,
    )
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
        .query_row(
            &format!("SELECT {LIST_SELECT_FIELDS} FROM lists WHERE id = ?1;"),
            params![&id],
            row_to_list,
        )
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

    conn.query_row(
        &format!("SELECT {LIST_SELECT_FIELDS} FROM lists WHERE id = ?1;"),
        params![&id],
        row_to_list,
    )
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
