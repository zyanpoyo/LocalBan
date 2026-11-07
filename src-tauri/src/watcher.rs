use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::time::{Duration, SystemTime};
use tauri::{AppHandle, Emitter};

use crate::config::{get_attachments_dir, safe_resolve_attachment_path};
use crate::db::get_connection;

/// 一時作業ディレクトリのベースパスを取得 (%TEMP%\localban\attachments)
pub fn get_temp_attachments_base_dir() -> PathBuf {
    std::env::temp_dir().join("localban").join("attachments")
}

/// アプリ起動時および終了時の一時フォルダ安全クリーンアップ
pub fn cleanup_temp_attachments() {
    let base = get_temp_attachments_base_dir();
    if base.exists() {
        let _ = fs::remove_dir_all(&base);
    }
}

/// 監視対象のセッション情報
struct WatcherSession {
    stop_signal: Arc<AtomicBool>,
}

/// アプリ全体でアクティブな監視セッションを保持するスレッドセーフなレジストリ
#[derive(Clone, Default)]
pub struct ActiveWatchers {
    sessions: Arc<Mutex<HashMap<String, WatcherSession>>>,
}

impl ActiveWatchers {
    pub fn new() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// 特定添付ファイルの監視を停止
    pub fn stop_watcher(&self, attachment_id: &str) {
        let mut map = self.sessions.lock().unwrap();
        if let Some(session) = map.remove(attachment_id) {
            session.stop_signal.store(true, Ordering::SeqCst);
        }
    }

    /// 添付ファイルの一時ファイル監視を開始 (ポーリング監視)
    pub fn start_watcher(
        &self,
        app: AppHandle,
        attachment_id: String,
        card_id: String,
        temp_file_path: PathBuf,
        stored_filename: String,
    ) {
        // 既存の監視があれば停止
        self.stop_watcher(&attachment_id);

        let stop_signal = Arc::new(AtomicBool::new(false));
        {
            let mut map = self.sessions.lock().unwrap();
            map.insert(
                attachment_id.clone(),
                WatcherSession {
                    stop_signal: Arc::clone(&stop_signal),
                },
            );
        }

        let watcher_att_id = attachment_id.clone();
        let watcher_card_id = card_id.clone();
        let signal = stop_signal;

        std::thread::spawn(move || {
            let mut last_modified = fs::metadata(&temp_file_path)
                .and_then(|m| m.modified())
                .unwrap_or_else(|_| SystemTime::now());

            while !signal.load(Ordering::SeqCst) {
                std::thread::sleep(Duration::from_millis(700));

                if signal.load(Ordering::SeqCst) {
                    break;
                }

                if !temp_file_path.exists() {
                    // 一時ファイル自体が消去された場合は監視終了
                    break;
                }

                if let Ok(metadata) = fs::metadata(&temp_file_path) {
                    if let Ok(modified) = metadata.modified() {
                        if modified > last_modified {
                            last_modified = modified;

                            // ファイル同期処理
                            if let Err(e) = sync_temp_file_to_storage(
                                &app,
                                &watcher_att_id,
                                &watcher_card_id,
                                &temp_file_path,
                                &stored_filename,
                            ) {
                                eprintln!(
                                    "[watcher] Error syncing attachment {}: {}",
                                    watcher_att_id, e
                                );
                            }
                        }
                    }
                }
            }
        });
    }
}

/// 一時作業ファイルを LocalBan の正規ストレージに反映し、DB とフロントエンドを更新
fn sync_temp_file_to_storage(
    app: &AppHandle,
    attachment_id: &str,
    card_id: &str,
    temp_file_path: &Path,
    stored_filename: &str,
) -> Result<(), String> {
    let dest_path = safe_resolve_attachment_path(stored_filename)?;
    if !dest_path.exists() {
        return Err("Target storage file not found".to_string());
    }

    let conn = get_connection().map_err(|e| e.to_string())?;

    // 初回保存時のバックアップ退避 (backup_stored_filename が未設定の場合)
    let existing_backup: Option<String> = conn
        .query_row(
            "SELECT backup_stored_filename FROM attachments WHERE id = ?1;",
            rusqlite::params![attachment_id],
            |r| r.get(0),
        )
        .map_err(|e| e.to_string())?;

    let backup_created = if existing_backup.is_none() {
        let backup_stored = format!("backup_{}_{}", uuid::Uuid::new_v4(), stored_filename);
        let backup_dest = get_attachments_dir().join(&backup_stored);
        fs::copy(&dest_path, &backup_dest).map_err(|e| e.to_string())?;

        conn.execute(
            "UPDATE attachments SET backup_stored_filename = ?1 WHERE id = ?2;",
            rusqlite::params![&backup_stored, attachment_id],
        )
        .map_err(|e| e.to_string())?;
        true
    } else {
        false
    };

    // 一時ファイルの内容を正規ストレージへ上書きコピー
    fs::copy(temp_file_path, &dest_path).map_err(|e| e.to_string())?;

    let new_size = fs::metadata(&dest_path)
        .map_err(|e| e.to_string())?
        .len() as i64;

    conn.execute(
        "UPDATE attachments SET file_size = ?1 WHERE id = ?2;",
        rusqlite::params![new_size, attachment_id],
    )
    .map_err(|e| e.to_string())?;

    // フロントエンドに更新イベントを発行
    let payload = serde_json::json!({
        "attachment_id": attachment_id,
        "card_id": card_id,
        "file_size": new_size,
        "has_backup": existing_backup.is_some() || backup_created,
    });
    let _ = app.emit("attachment-updated", payload);

    Ok(())
}
