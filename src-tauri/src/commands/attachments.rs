use chrono::Utc;
use rusqlite::{params, OptionalExtension};
use std::collections::HashSet;
use std::fs;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
use uuid::Uuid;

use crate::commands::helpers::{
    build_card_response, cleanup_old_cover_record, remove_stored_file_quietly,
    write_attachment_bytes,
};
use crate::config::{load_settings, safe_resolve_attachment_path, save_settings, MAX_UPLOAD_SIZE};
use std::path::{Path, PathBuf};
use crate::db::get_connection;
use crate::models::{AttachmentResponse, CardResponse};
use crate::watcher::{get_temp_attachments_base_dir, ActiveWatchers};

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
        "INSERT INTO attachments (id, card_id, filename, stored_filename, file_size, mime_type, is_cover, created_at, backup_stored_filename)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, NULL);",
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
        has_backup: false,
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
        "INSERT INTO attachments (id, card_id, filename, stored_filename, file_size, mime_type, is_cover, created_at, backup_stored_filename)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 1, ?7, NULL);",
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
pub fn create_empty_attachment(
    card_id: String,
    extension: String,
) -> Result<AttachmentResponse, String> {
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

    let ext = if extension.starts_with('.') {
        &extension[1..]
    } else {
        &extension
    };

    let base_name = "無題";
    let existing_names: HashSet<String> = conn
        .prepare("SELECT filename FROM attachments WHERE card_id = ?1 AND is_cover = 0;")
        .map_err(|e| e.to_string())?
        .query_map(params![&card_id], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .flatten()
        .collect();

    let mut candidate = format!("{}.{}", base_name, ext);
    let mut counter = 2;
    while existing_names.contains(&candidate) {
        candidate = format!("{} ({}).{}", base_name, counter, ext);
        counter += 1;
    }

    let empty_bytes = b"";
    let stored_filename = write_attachment_bytes(&candidate, empty_bytes)?;
    let attach_id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let mime_type = if ext.eq_ignore_ascii_case("md") {
        "text/markdown"
    } else {
        "text/plain"
    };

    conn.execute(
        "INSERT INTO attachments (id, card_id, filename, stored_filename, file_size, mime_type, is_cover, created_at, backup_stored_filename)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, NULL);",
        params![attach_id, card_id, candidate, stored_filename, 0, mime_type, now],
    )
    .map_err(|e| e.to_string())?;

    Ok(AttachmentResponse {
        id: attach_id,
        card_id,
        filename: candidate,
        stored_filename,
        file_size: 0,
        mime_type: Some(mime_type.to_string()),
        created_at: now,
        has_backup: false,
    })
}

#[tauri::command]
pub fn rename_attachment(
    id: String,
    new_filename: String,
) -> Result<AttachmentResponse, String> {
    let trimmed = new_filename.trim();
    if trimmed.is_empty() {
        return Err("Filename cannot be empty".to_string());
    }
    if trimmed.contains(['/', '\\', ':', '*', '?', '"', '<', '>', '|']) {
        return Err("Filename contains invalid characters".to_string());
    }

    let conn = get_connection().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE attachments SET filename = ?1 WHERE id = ?2;",
        params![trimmed, &id],
    )
    .map_err(|e| e.to_string())?;

    let res: AttachmentResponse = conn
        .query_row(
            "SELECT id, card_id, filename, stored_filename, file_size, mime_type, created_at, (backup_stored_filename IS NOT NULL)
             FROM attachments WHERE id = ?1;",
            params![&id],
            |r| {
                Ok(AttachmentResponse {
                    id: r.get(0)?,
                    card_id: r.get(1)?,
                    filename: r.get(2)?,
                    stored_filename: r.get(3)?,
                    file_size: r.get(4)?,
                    mime_type: r.get(5)?,
                    created_at: r.get(6)?,
                    has_backup: r.get(7)?,
                })
            },
        )
        .map_err(|_| "Attachment not found".to_string())?;

    Ok(res)
}


fn launch_vscode(file_path: &Path) -> Result<(), String> {
    // 1. PATH上の code.cmd または code
    if std::process::Command::new("code.cmd")
        .arg(file_path)
        .spawn()
        .is_ok()
    {
        return Ok(());
    }
    if std::process::Command::new("code")
        .arg(file_path)
        .spawn()
        .is_ok()
    {
        return Ok(());
    }

    // 2. %LOCALAPPDATA%\Programs\Microsoft VS Code\Code.exe
    if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
        let code_path = PathBuf::from(local_app_data)
            .join("Programs")
            .join("Microsoft VS Code")
            .join("Code.exe");
        if code_path.exists()
            && std::process::Command::new(code_path)
                .arg(file_path)
                .spawn()
                .is_ok()
        {
            return Ok(());
        }
    }

    // 3. %PROGRAMFILES%\Microsoft VS Code\Code.exe
    if let Ok(prog_files) = std::env::var("ProgramFiles") {
        let code_path = PathBuf::from(prog_files)
            .join("Microsoft VS Code")
            .join("Code.exe");
        if code_path.exists()
            && std::process::Command::new(code_path)
                .arg(file_path)
                .spawn()
                .is_ok()
        {
            return Ok(());
        }
    }

    Err("VSCode executable not found".to_string())
}

#[tauri::command]
pub async fn pick_editor_executable(app: AppHandle) -> Result<Option<String>, String> {
    let file = app
        .dialog()
        .file()
        .add_filter("実行可能ファイル (*.exe)", &["exe"])
        .blocking_pick_file();

    Ok(file.map(|p| p.as_path().unwrap().to_string_lossy().to_string()))
}

#[tauri::command]
pub fn open_attachment(
    app: AppHandle,
    watchers: State<'_, ActiveWatchers>,
    id: String,
    editor: Option<String>,
) -> Result<String, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let (card_id, filename, stored_name): (String, String, String) = conn
        .query_row(
            "SELECT card_id, filename, stored_filename FROM attachments WHERE id = ?1;",
            params![&id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .map_err(|_| "Attachment not found".to_string())?;

    let src_path = safe_resolve_attachment_path(&stored_name)?;
    if !src_path.exists() {
        return Err("File not found on disk".to_string());
    }

    let temp_dir = get_temp_attachments_base_dir().join(&id);
    fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;
    let temp_file_path = temp_dir.join(&filename);

    fs::copy(&src_path, &temp_file_path).map_err(|e| e.to_string())?;

    let path_str = temp_file_path
        .to_str()
        .ok_or_else(|| "Invalid temp path string".to_string())?;

    // editorが明示指定された場合は記憶を更新
    if let Some(ref e) = editor {
        let trimmed = e.trim();
        let mut settings = load_settings();
        settings.preferred_editor = if trimmed.is_empty() || trimmed == "default" {
            None
        } else {
            Some(trimmed.to_string())
        };
        let _ = save_settings(&settings);
    }

    let target_editor = editor.or_else(|| load_settings().preferred_editor);

    let lower = filename.to_lowercase();
    let is_editable = lower.ends_with(".md") || lower.ends_with(".txt");

    if is_editable {
        if let Some(ref ed) = target_editor {
            match ed.as_str() {
                "notepad" => {
                    let _ = std::process::Command::new("notepad.exe")
                        .arg(&temp_file_path)
                        .spawn();
                }
                "vscode" => {
                    if launch_vscode(&temp_file_path).is_err() {
                        let _ = app.opener().open_path(path_str, None::<&str>);
                    }
                }
                custom_exe => {
                    if std::process::Command::new(custom_exe)
                        .arg(&temp_file_path)
                        .spawn()
                        .is_err()
                    {
                        let _ = app.opener().open_path(path_str, None::<&str>);
                    }
                }
            }
        } else {
            app.opener()
                .open_path(path_str, None::<&str>)
                .map_err(|e| e.to_string())?;
        }
        watchers.start_watcher(app, id, card_id, temp_file_path, stored_name);
    } else {
        app.opener()
            .open_path(path_str, None::<&str>)
            .map_err(|e| e.to_string())?;
    }

    Ok("opened".to_string())
}

#[tauri::command]
pub fn restore_attachment_backup(
    app: AppHandle,
    id: String,
) -> Result<AttachmentResponse, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;
    let (card_id, filename, stored_name, backup_stored): (String, String, String, Option<String>) =
        conn.query_row(
            "SELECT card_id, filename, stored_filename, backup_stored_filename FROM attachments WHERE id = ?1;",
            params![&id],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?)),
        )
        .map_err(|_| "Attachment not found".to_string())?;

    let backup_name = backup_stored.ok_or("No backup available to restore")?;
    let backup_path = safe_resolve_attachment_path(&backup_name)?;
    let stored_path = safe_resolve_attachment_path(&stored_name)?;

    if !backup_path.exists() {
        return Err("Backup file not found on disk".to_string());
    }

    // バックアップから原本へ復元コピー
    fs::copy(&backup_path, &stored_path).map_err(|e| e.to_string())?;
    let restored_size = fs::metadata(&stored_path)
        .map_err(|e| e.to_string())?
        .len() as i64;

    // バックアップファイルの削除
    remove_stored_file_quietly(&backup_name);

    // DBレコードの更新
    conn.execute(
        "UPDATE attachments SET backup_stored_filename = NULL, file_size = ?1 WHERE id = ?2;",
        params![restored_size, &id],
    )
    .map_err(|e| e.to_string())?;

    // 開かれている一時ファイルがあればそちらも復元
    let temp_file_path = get_temp_attachments_base_dir().join(&id).join(&filename);
    if temp_file_path.exists() {
        let _ = fs::copy(&stored_path, &temp_file_path);
    }

    // フロントエンドに更新通知
    use tauri::Emitter;
    let _ = app.emit(
        "attachment-updated",
        serde_json::json!({
            "attachment_id": id,
            "card_id": card_id,
            "file_size": restored_size,
            "has_backup": false,
        }),
    );

    let res: AttachmentResponse = conn
        .query_row(
            "SELECT id, card_id, filename, stored_filename, file_size, mime_type, created_at, 0
             FROM attachments WHERE id = ?1;",
            params![&id],
            |r| {
                Ok(AttachmentResponse {
                    id: r.get(0)?,
                    card_id: r.get(1)?,
                    filename: r.get(2)?,
                    stored_filename: r.get(3)?,
                    file_size: r.get(4)?,
                    mime_type: r.get(5)?,
                    created_at: r.get(6)?,
                    has_backup: false,
                })
            },
        )
        .map_err(|_| "Failed to fetch restored attachment".to_string())?;

    Ok(res)
}

#[tauri::command]
pub fn delete_attachment(
    watchers: State<'_, ActiveWatchers>,
    id: String,
) -> Result<String, String> {
    delete_attachment_internal(Some(&watchers), id)
}

pub fn delete_attachment_internal(
    watchers: Option<&ActiveWatchers>,
    id: String,
) -> Result<String, String> {
    if let Some(w) = watchers {
        w.stop_watcher(&id);
    }

    let mut conn = get_connection().map_err(|e| e.to_string())?;
    let (stored_name, backup_stored): (String, Option<String>) = conn
        .query_row(
            "SELECT stored_filename, backup_stored_filename FROM attachments WHERE id = ?1;",
            params![&id],
            |r| Ok((r.get(0)?, r.get(1)?)),
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
    if let Some(ref b) = backup_stored {
        remove_stored_file_quietly(b);
    }

    // 一時フォルダも削除
    let temp_dir = get_temp_attachments_base_dir().join(&id);
    if temp_dir.exists() {
        let _ = fs::remove_dir_all(&temp_dir);
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
