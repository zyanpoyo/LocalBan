use rusqlite::params;
use uuid::Uuid;

use crate::db::get_connection;
use crate::models::LabelResponse;

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
