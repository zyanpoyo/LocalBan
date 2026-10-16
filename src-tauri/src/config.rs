use std::path::{Path, PathBuf};

pub const APP_NAME: &str = "LocalBan";
pub const APP_VERSION: &str = "2.0.0";
pub const MAX_UPLOAD_SIZE: usize = 50 * 1024 * 1024; // 50MB

pub fn get_app_dir() -> PathBuf {
    if let Ok(custom_dir) = std::env::var("LOCALBAN_DATA_DIR") {
        if !custom_dir.is_empty() {
            return PathBuf::from(custom_dir);
        }
    }

    if let Ok(app_data) = std::env::var("APPDATA") {
        PathBuf::from(app_data).join(APP_NAME)
    } else if let Some(home) = dirs_home() {
        home.join(format!(".{}", APP_NAME.to_lowercase()))
    } else {
        PathBuf::from(".").join(APP_NAME)
    }
}

fn dirs_home() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        std::env::var_os("USERPROFILE").map(PathBuf::from)
    }
    #[cfg(not(windows))]
    {
        std::env::var_os("HOME").map(PathBuf::from)
    }
}

pub fn get_attachments_dir() -> PathBuf {
    get_app_dir().join("attachments")
}

pub fn get_logs_dir() -> PathBuf {
    get_app_dir().join("logs")
}

pub fn get_backups_dir() -> PathBuf {
    get_app_dir().join("backups")
}

pub fn get_db_path() -> PathBuf {
    get_app_dir().join("localban.db")
}

pub fn init_dirs() -> std::io::Result<()> {
    let base = get_app_dir();
    std::fs::create_dir_all(base.join("attachments"))?;
    std::fs::create_dir_all(base.join("logs"))?;
    std::fs::create_dir_all(base.join("backups"))?;
    Ok(())
}

pub fn safe_resolve_attachment_path(stored_filename: &str) -> Result<PathBuf, String> {
    let attachments_dir = get_attachments_dir();
    let file_name = Path::new(stored_filename)
        .file_name()
        .ok_or_else(|| "Invalid file path".to_string())?;

    let target_path = attachments_dir.join(file_name);
    Ok(target_path)
}
