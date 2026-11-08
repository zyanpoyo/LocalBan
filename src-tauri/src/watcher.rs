use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::time::{Duration, SystemTime};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

use crate::commands::helpers::{ensure_unique_attachment_filename, write_attachment_bytes};
use crate::config::{get_attachments_dir, safe_resolve_attachment_path, MAX_UPLOAD_SIZE};
use crate::db::get_connection;
use crate::models::AttachmentResponse;

/// 旧・個別添付ファイル一時ディレクトリのベースパス (%TEMP%\localban\attachments)
pub fn get_temp_attachments_base_dir() -> PathBuf {
    std::env::temp_dir().join("localban").join("attachments")
}

/// カード単位の一時作業ディレクトリのベースパス (%TEMP%\localban\cards)
pub fn get_temp_cards_base_dir() -> PathBuf {
    std::env::temp_dir().join("localban").join("cards")
}

/// 特定カードの一時作業ディレクトリパス (%TEMP%\localban\cards\{card_id})
pub fn get_temp_card_dir(card_id: &str) -> PathBuf {
    get_temp_cards_base_dir().join(card_id)
}

/// アプリ起動時および終了時の一時フォルダ安全クリーンアップ
pub fn cleanup_temp_attachments() {
    let base_att = get_temp_attachments_base_dir();
    if base_att.exists() {
        let _ = fs::remove_dir_all(&base_att);
    }
    let base_cards = get_temp_cards_base_dir();
    if base_cards.exists() {
        let _ = fs::remove_dir_all(&base_cards);
    }
}

/// カード内の全添付ファイルをカード単位の一時フォルダ (%TEMP%\localban\cards\{card_id}) にフラット展開する
pub fn prepare_card_temp_dir(card_id: &str, is_already_watching: bool) -> Result<PathBuf, String> {
    let temp_dir = get_temp_card_dir(card_id);
    fs::create_dir_all(&temp_dir).map_err(|e| e.to_string())?;

    let conn = get_connection().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT filename, stored_filename
             FROM attachments
             WHERE card_id = ?1 AND is_cover = 0
             ORDER BY created_at ASC;",
        )
        .map_err(|e| e.to_string())?;

    let rows: Vec<(String, String)> = stmt
        .query_map(rusqlite::params![card_id], |r| Ok((r.get(0)?, r.get(1)?)))
        .map_err(|e| e.to_string())?
        .flatten()
        .collect();

    for (filename, stored_name) in rows {
        if let Ok(src_path) = safe_resolve_attachment_path(&stored_name) {
            if src_path.exists() {
                let dest_path = temp_dir.join(&filename);
                // まだ監視中でない場合は原本で最新化し、監視中の場合は未存在ファイルのみ展開（編集中ファイルを保護）
                if !is_already_watching || !dest_path.exists() {
                    let _ = fs::copy(&src_path, &dest_path);
                }
            }
        }
    }

    Ok(temp_dir)
}

/// 外部エディタ等でカードフォルダ内に新規作成されたファイルが自動取り込み対象か判定する
pub fn is_allowed_sync_file(filename: &str) -> bool {
    let trimmed = filename.trim();
    if trimmed.is_empty()
        || trimmed.starts_with('.')
        || trimmed.starts_with('~')
        || trimmed.ends_with('~')
    {
        return false;
    }

    let lower = trimmed.to_lowercase();
    if lower.ends_with(".tmp")
        || lower.ends_with(".swp")
        || lower.ends_with(".bak")
        || lower.ends_with(".part")
        || lower.ends_with(".crdownload")
    {
        return false;
    }

    let ext = Path::new(&lower)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("");

    matches!(
        ext,
        "png"
            | "jpg"
            | "jpeg"
            | "gif"
            | "webp"
            | "bmp"
            | "svg"
            | "ico"
            | "avif"
            | "md"
            | "markdown"
            | "txt"
            | "json"
            | "csv"
            | "tsv"
            | "yaml"
            | "yml"
            | "toml"
            | "xml"
            | "html"
            | "htm"
            | "css"
            | "js"
            | "ts"
            | "sql"
            | "log"
            | "ini"
            | "conf"
    )
}

/// ファイル名（拡張子）からMIMEタイプを推定する
pub fn guess_mime_type(filename: &str) -> &'static str {
    let ext = Path::new(filename)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        "svg" => "image/svg+xml",
        "ico" => "image/x-icon",
        "avif" => "image/avif",
        "md" | "markdown" => "text/markdown",
        "txt" | "log" | "ini" | "conf" | "sql" | "yaml" | "yml" | "toml" => "text/plain",
        "json" => "application/json",
        "csv" => "text/csv",
        "tsv" => "text/tab-separated-values",
        "html" | "htm" => "text/html",
        "css" => "text/css",
        "js" | "ts" => "text/javascript",
        "xml" => "application/xml",
        _ => "application/octet-stream",
    }
}

fn is_raster_or_binary_image(filename: &str) -> bool {
    let ext = Path::new(filename)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    matches!(
        ext.as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp" | "ico" | "avif"
    )
}

/// 監視対象のセッション情報
struct WatcherSession {
    stop_signal: Arc<AtomicBool>,
}

/// アプリ全体でアクティブなカードフォルダ監視セッションを保持するスレッドセーフなレジストリ
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

    /// 指定カードが現在監視中かどうかを返す
    pub fn is_watching_card(&self, card_id: &str) -> bool {
        let map = self.sessions.lock().unwrap();
        map.contains_key(card_id)
    }

    /// 特定カードの監視を停止
    pub fn stop_card_watcher(&self, card_id: &str) {
        let mut map = self.sessions.lock().unwrap();
        if let Some(session) = map.remove(card_id) {
            session.stop_signal.store(true, Ordering::SeqCst);
        }
    }

    /// 互換用: キー指定で監視を停止
    pub fn stop_watcher(&self, key: &str) {
        self.stop_card_watcher(key);
    }

    /// カード単位の一時フォルダ監視を開始 (ポーリング監視)
    pub fn start_card_watcher(&self, app: AppHandle, card_id: String) {
        {
            let map = self.sessions.lock().unwrap();
            if map.contains_key(&card_id) {
                // 既にこのカードのフォルダ監視スレッドが稼働中であればそのまま継続
                return;
            }
        }

        let stop_signal = Arc::new(AtomicBool::new(false));
        {
            let mut map = self.sessions.lock().unwrap();
            map.insert(
                card_id.clone(),
                WatcherSession {
                    stop_signal: Arc::clone(&stop_signal),
                },
            );
        }

        let watcher_card_id = card_id.clone();
        let signal = stop_signal;
        let sessions_ref = Arc::clone(&self.sessions);

        std::thread::spawn(move || {
            let temp_card_dir = get_temp_card_dir(&watcher_card_id);
            let mut last_modified_map: HashMap<String, SystemTime> = HashMap::new();

            // 初期状態のスキャン（開始時点の既存ファイルのタイムスタンプを記録）
            let _ = initialize_modified_map(&watcher_card_id, &temp_card_dir, &mut last_modified_map);

            while !signal.load(Ordering::SeqCst) {
                std::thread::sleep(Duration::from_millis(700));

                if signal.load(Ordering::SeqCst) {
                    break;
                }

                if !temp_card_dir.exists() {
                    break;
                }

                if let Err(e) = scan_and_sync_card_dir(
                    Some(&app),
                    &watcher_card_id,
                    &temp_card_dir,
                    &mut last_modified_map,
                ) {
                    eprintln!(
                        "[watcher] Error scanning card folder {}: {}",
                        watcher_card_id, e
                    );
                }
            }

            // 終了時にセッションマップから自身を除去
            if let Ok(mut map) = sessions_ref.lock() {
                if let Some(existing) = map.get(&watcher_card_id) {
                    if existing.stop_signal.load(Ordering::SeqCst) || !temp_card_dir.exists() {
                        map.remove(&watcher_card_id);
                    }
                }
            }
        });
    }
}

/// 監視開始時点でDBに登録済みの添付ファイルの初期タイムスタンプを記録する
fn initialize_modified_map(
    card_id: &str,
    temp_card_dir: &Path,
    last_modified_map: &mut HashMap<String, SystemTime>,
) -> Result<(), String> {
    if !temp_card_dir.exists() {
        return Ok(());
    }
    let conn = get_connection().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT filename FROM attachments WHERE card_id = ?1 AND is_cover = 0;")
        .map_err(|e| e.to_string())?;

    let db_filenames: std::collections::HashSet<String> = stmt
        .query_map(rusqlite::params![card_id], |r| r.get::<_, String>(0))
        .map_err(|e| e.to_string())?
        .flatten()
        .map(|f| f.to_lowercase())
        .collect();

    if let Ok(entries) = fs::read_dir(temp_card_dir) {
        for entry in entries.flatten() {
            let fname = entry.file_name().to_string_lossy().to_string();
            let fname_lower = fname.to_lowercase();
            if db_filenames.contains(&fname_lower) {
                if let Ok(meta) = entry.metadata() {
                    if let Ok(modified) = meta.modified() {
                        last_modified_map.insert(fname_lower, modified);
                    }
                }
            }
        }
    }

    Ok(())
}

/// カード一時フォルダ内をスキャンし、既存添付ファイルの変更同期および新規ファイルの自動取り込みを行う
pub fn scan_and_sync_card_dir(
    app: Option<&AppHandle>,
    card_id: &str,
    temp_card_dir: &Path,
    last_modified_map: &mut HashMap<String, SystemTime>,
) -> Result<(), String> {
    if !temp_card_dir.exists() {
        return Ok(());
    }

    let db_attachments: HashMap<String, (String, String)> = {
        let conn = get_connection().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT id, filename, stored_filename
                 FROM attachments
                 WHERE card_id = ?1 AND is_cover = 0;",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(rusqlite::params![card_id], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        let mut map = HashMap::new();
        for row in rows.flatten() {
            map.insert(row.1.to_lowercase(), (row.0, row.2));
        }
        map
    };

    let entries = fs::read_dir(temp_card_dir).map_err(|e| e.to_string())?;
    for entry in entries.flatten() {
        let file_type = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };
        if !file_type.is_file() {
            continue;
        }

        let fname = entry.file_name().to_string_lossy().to_string();
        let fname_lower = fname.to_lowercase();
        let entry_path = entry.path();

        let metadata = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let modified = match metadata.modified() {
            Ok(m) => m,
            Err(_) => continue,
        };
        let file_len = metadata.len();

        if let Some((att_id, stored_filename)) = db_attachments.get(&fname_lower) {
            // 既存の添付ファイル
            if let Some(&prev_modified) = last_modified_map.get(&fname_lower) {
                if modified > prev_modified {
                    last_modified_map.insert(fname_lower, modified);
                    let _ = sync_temp_file_to_storage(
                        app,
                        att_id,
                        card_id,
                        &entry_path,
                        stored_filename,
                    );
                }
            } else {
                // LocalBan側から新規追加・リネームされたファイル: 初回はタイムスタンプ記録と内容差分がある場合のみ同期
                last_modified_map.insert(fname_lower, modified);
            }
        } else {
            // DBに未登録の新規ファイル（外部エディタでの画像ペーストや新規作成）
            if !is_allowed_sync_file(&fname) {
                continue;
            }
            if file_len as usize > MAX_UPLOAD_SIZE {
                continue;
            }
            // 画像ファイルが書き込み途中で0バイトの場合は次回のポーリングまで待つ
            if is_raster_or_binary_image(&fname) && file_len == 0 {
                continue;
            }

            if let Ok(created_att) =
                sync_new_temp_file_to_storage(app, card_id, &fname, &entry_path)
            {
                last_modified_map.insert(created_att.filename.to_lowercase(), modified);
            }
        }
    }

    Ok(())
}

/// 一時作業ファイルの変更を LocalBan の正規ストレージに反映し、DB とフロントエンドを更新
fn sync_temp_file_to_storage(
    app: Option<&AppHandle>,
    attachment_id: &str,
    card_id: &str,
    temp_file_path: &Path,
    stored_filename: &str,
) -> Result<(), String> {
    let dest_path = safe_resolve_attachment_path(stored_filename)?;
    if !dest_path.exists() {
        return Err("Target storage file not found".to_string());
    }

    let temp_bytes = fs::read(temp_file_path).map_err(|e| e.to_string())?;
    if temp_bytes.len() > MAX_UPLOAD_SIZE {
        return Err("File size exceeds 50MB limit".to_string());
    }

    // 内容が同一であれば不要なバックアップ生成・同期をスキップ
    if let Ok(dest_bytes) = fs::read(&dest_path) {
        if temp_bytes == dest_bytes {
            return Ok(());
        }
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
        let backup_stored = format!("backup_{}_{}", Uuid::new_v4(), stored_filename);
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

    // 一時ファイルの内容を正規ストレージへ上書き書き込み
    fs::write(&dest_path, &temp_bytes).map_err(|e| e.to_string())?;

    let new_size = temp_bytes.len() as i64;

    conn.execute(
        "UPDATE attachments SET file_size = ?1 WHERE id = ?2;",
        rusqlite::params![new_size, attachment_id],
    )
    .map_err(|e| e.to_string())?;

    if let Some(app_handle) = app {
        let payload = serde_json::json!({
            "attachment_id": attachment_id,
            "card_id": card_id,
            "file_size": new_size,
            "has_backup": existing_backup.is_some() || backup_created,
        });
        let _ = app_handle.emit("attachment-updated", payload);
    }

    Ok(())
}

/// カード一時フォルダ内に新規追加されたファイルを LocalBan の添付ファイルとして自動登録する
fn sync_new_temp_file_to_storage(
    app: Option<&AppHandle>,
    card_id: &str,
    filename: &str,
    temp_file_path: &Path,
) -> Result<AttachmentResponse, String> {
    let data = fs::read(temp_file_path).map_err(|e| e.to_string())?;
    if data.len() > MAX_UPLOAD_SIZE {
        return Err("File size exceeds 50MB limit".to_string());
    }

    let conn = get_connection().map_err(|e| e.to_string())?;
    let card_exists: bool = conn
        .query_row(
            "SELECT 1 FROM cards WHERE id = ?1;",
            rusqlite::params![card_id],
            |_| Ok(true),
        )
        .unwrap_or(false);

    if !card_exists {
        return Err("Card not found".to_string());
    }

    let unique_filename = ensure_unique_attachment_filename(&conn, card_id, filename, None)?;
    let stored_filename = write_attachment_bytes(&unique_filename, &data)?;
    let attach_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let file_size = data.len() as i64;
    let mime_type = guess_mime_type(&unique_filename).to_string();

    conn.execute(
        "INSERT INTO attachments (id, card_id, filename, stored_filename, file_size, mime_type, is_cover, created_at, backup_stored_filename)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7, NULL);",
        rusqlite::params![
            attach_id,
            card_id,
            unique_filename,
            stored_filename,
            file_size,
            mime_type,
            now
        ],
    )
    .map_err(|e| e.to_string())?;

    let created = AttachmentResponse {
        id: attach_id.clone(),
        card_id: card_id.to_string(),
        filename: unique_filename,
        stored_filename,
        file_size,
        mime_type: Some(mime_type),
        created_at: now,
        has_backup: false,
    };

    if let Some(app_handle) = app {
        let payload = serde_json::json!({
            "attachment_id": attach_id,
            "card_id": card_id,
            "file_size": file_size,
            "has_backup": false,
            "created_attachment": &created,
        });
        let _ = app_handle.emit("attachment-updated", payload);
    }

    Ok(created)
}
