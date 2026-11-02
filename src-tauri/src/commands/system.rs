use tauri::AppHandle;

use crate::config::{load_settings, save_settings, APP_NAME, APP_VERSION};
use crate::models::{AppSettingsResponse, SystemStatusResponse};

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
        has_seen_coach_mark: settings.has_seen_coach_mark,
    }
}

#[tauri::command]
pub fn update_app_settings(close_to_tray: bool) -> Result<AppSettingsResponse, String> {
    let mut settings = load_settings();
    settings.close_to_tray = close_to_tray;
    save_settings(&settings)?;
    crate::CLOSE_TO_TRAY.store(close_to_tray, std::sync::atomic::Ordering::SeqCst);
    Ok(AppSettingsResponse {
        close_to_tray,
        has_seen_coach_mark: settings.has_seen_coach_mark,
    })
}

#[tauri::command]
pub fn complete_coach_mark() -> Result<AppSettingsResponse, String> {
    let mut settings = load_settings();
    settings.has_seen_coach_mark = true;
    save_settings(&settings)?;
    Ok(AppSettingsResponse {
        close_to_tray: settings.close_to_tray,
        has_seen_coach_mark: true,
    })
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
