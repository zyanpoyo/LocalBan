use chrono::Utc;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

use crate::config::get_backups_dir;
use crate::models::{BackupFileInfo, RestoreResult};

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

    crate::backup::create_full_backup_archive(&dest_path)?;
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

    let result = crate::backup::restore_from_backup_file(&src_path)?;
    Ok(Some(result))
}

#[tauri::command]
pub fn list_internal_backups() -> Result<Vec<BackupFileInfo>, String> {
    crate::backup::list_internal_backups()
}

#[tauri::command]
pub fn create_internal_backup() -> Result<BackupFileInfo, String> {
    let path = crate::backup::create_manual_snapshot()
        .map_err(|e| format!("Failed to create snapshot: {}", e))?;
    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown.localban")
        .to_string();
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
    if filename.contains('/') || filename.contains('\\') || filename.contains("..") {
        return Err("Invalid backup filename".to_string());
    }

    let backups_dir = get_backups_dir();
    let target_path = backups_dir.join(&filename);
    if !target_path.exists() {
        return Err("Specified backup file does not exist".to_string());
    }

    let mut res = crate::backup::restore_from_backup_file(&target_path)?;
    res.message = format!("スナップショット '{}' から復元しました", filename);
    Ok(res)
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
