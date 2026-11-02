use chrono::Utc;
use rusqlite::{params, OptionalExtension};
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;

use crate::commands::helpers::{
    build_card_response, cleanup_old_cover_record, remove_stored_file_quietly,
    write_attachment_bytes,
};
use crate::config::{safe_resolve_attachment_path, MAX_UPLOAD_SIZE};
use crate::db::get_connection;
use crate::models::{AttachmentResponse, CardResponse};

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
    let card_exists: bool = conn
        .query_row(
            "SELECT 1 FROM cards WHERE id = ?1;",
            params![&card_id],
            |_| Ok(true),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .unwrap_or(false);

    if !card_exists {
        return Err("Card not found".to_string());
    }

    let stored_filename = write_attachment_bytes(&filename, &data)?;
    let attach_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let file_size = data.len() as i64;

    conn.execute(
        "INSERT INTO attachments (id, card_id, filename, stored_filename, file_size, mime_type, is_cover, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7);",
        params![attach_id, card_id, filename, stored_filename, file_size, mime_type, now],
    )
    .map_err(|e| e.to_string())?;

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
pub fn upload_card_cover(
    card_id: String,
    filename: String,
    mime_type: String,
    data: Vec<u8>,
) -> Result<CardResponse, String> {
    if data.len() > MAX_UPLOAD_SIZE {
        return Err("File size exceeds 50MB limit".to_string());
    }

    if !mime_type.starts_with("image/") || mime_type == "image/svg+xml" {
        return Err("Only raster image files (JPEG, PNG, WebP, etc.) are allowed for covers".to_string());
    }

    let mut conn = get_connection().map_err(|e| e.to_string())?;

    let card_info: Option<(Option<String>,)> = conn
        .query_row(
            "SELECT cover_attachment_id FROM cards WHERE id = ?1;",
            params![&card_id],
            |r| Ok((r.get(0)?,)),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let existing_cover_id = card_info.ok_or("Card not found")?.0;

    let stored_filename = write_attachment_bytes(&filename, &data)?;
    let attach_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let file_size = data.len() as i64;

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let mut old_stored_file_to_remove: Option<String> = None;
    if let Some(ref old_cover_id) = existing_cover_id {
        old_stored_file_to_remove = cleanup_old_cover_record(&tx, old_cover_id)?;
    }

    tx.execute(
        "INSERT INTO attachments (id, card_id, filename, stored_filename, file_size, mime_type, is_cover, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7);",
        params![attach_id, card_id, filename, stored_filename, file_size, mime_type, now],
    )
    .map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE cards SET cover_attachment_id = ?1, updated_at = ?2 WHERE id = ?3;",
        params![attach_id, now, card_id],
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    if let Some(old_fname) = old_stored_file_to_remove {
        remove_stored_file_quietly(&old_fname);
    }

    build_card_response(&conn, &card_id)
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

    remove_stored_file_quietly(&stored_name);

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
