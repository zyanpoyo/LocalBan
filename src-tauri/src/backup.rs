use std::fs::File;
use std::io::{copy, Read, Write};
use std::path::{Path, PathBuf};
use chrono::Utc;
use uuid::Uuid;

use crate::config::{get_attachments_dir, get_backups_dir, get_settings_path, APP_VERSION};
use crate::db::{backup_database_to, get_connection, restore_database_from};
use crate::models::{BackupFileInfo, BackupManifest, RestoreResult};

/// 完全バックアップアーカイブ (.localban / ZIP形式) を指定のパスに生成する
pub fn create_full_backup_archive(dest_path: &Path) -> Result<PathBuf, String> {
    if let Some(parent) = dest_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }

    // 1. 一時スナップショットDBの作成 (ロシア人ルーレットにならないようUUID名で作成)
    let backups_dir = get_backups_dir();
    let _ = std::fs::create_dir_all(&backups_dir);
    let temp_db_name = format!("temp_backup_{}.db", Uuid::new_v4());
    let temp_db_path = backups_dir.join(&temp_db_name);
    backup_database_to(&temp_db_path).map_err(|e| format!("Failed to snapshot database: {}", e))?;

    // 2. メタデータ集計
    let (lists_count, cards_count, attachments_count) = {
        let conn = rusqlite::Connection::open(&temp_db_path).map_err(|e| e.to_string())?;
        let l_count: usize = conn
            .query_row("SELECT COUNT(*) FROM lists;", [], |r| r.get(0))
            .unwrap_or(0);
        let c_count: usize = conn
            .query_row("SELECT COUNT(*) FROM cards;", [], |r| r.get(0))
            .unwrap_or(0);
        let a_count: usize = conn
            .query_row("SELECT COUNT(*) FROM attachments;", [], |r| r.get(0))
            .unwrap_or(0);
        (l_count, c_count, a_count)
    };

    let manifest = BackupManifest {
        version: APP_VERSION.to_string(),
        exported_at: Utc::now().to_rfc3339(),
        lists_count,
        cards_count,
        attachments_count,
    };

    // 3. ZIPアーカイブ生成
    let file = File::create(dest_path).map_err(|e| format!("Failed to create output file: {}", e))?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);

    // 3.1. manifest.json
    if let Ok(manifest_json) = serde_json::to_string_pretty(&manifest) {
        let _ = zip.start_file("manifest.json", options);
        let _ = Write::write_all(&mut zip, manifest_json.as_bytes());
    }

    // 3.2. localban.db
    if let Ok(mut db_file) = File::open(&temp_db_path) {
        let _ = zip.start_file("localban.db", options);
        let _ = copy(&mut db_file, &mut zip);
    }
    let _ = std::fs::remove_file(&temp_db_path);

    // 3.3. settings.json (存在する場合)
    let settings_path = get_settings_path();
    if settings_path.exists() {
        if let Ok(mut s_file) = File::open(&settings_path) {
            let _ = zip.start_file("settings.json", options);
            let _ = copy(&mut s_file, &mut zip);
        }
    }

    // 3.4. attachments フォルダの実体ファイル
    let attachments_dir = get_attachments_dir();
    if attachments_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&attachments_dir) {
            for entry in entries.flatten() {
                if let Ok(ft) = entry.file_type() {
                    if ft.is_file() {
                        let path = entry.path();
                        if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                            let zip_entry_name = format!("attachments/{}", file_name);
                            if zip.start_file(&zip_entry_name, options).is_ok() {
                                if let Ok(mut af) = File::open(&path) {
                                    let _ = copy(&mut af, &mut zip);
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    zip.finish().map_err(|e| format!("Failed to finalize zip archive: {}", e))?;

    Ok(dest_path.to_path_buf())
}

/// 復元直前のセーフティバックアップ (.localban 完全アーカイブ) を作成する
pub fn create_safety_backup() -> Result<PathBuf, String> {
    let backups_dir = get_backups_dir();
    let _ = std::fs::create_dir_all(&backups_dir);
    let filename = format!("pre_restore_{}.localban", Utc::now().format("%Y%m%d_%H%M%S"));
    let target = backups_dir.join(&filename);
    create_full_backup_archive(&target)
}

/// 手動スナップショット (.localban 完全アーカイブ) を作成する
pub fn create_manual_snapshot() -> Result<PathBuf, String> {
    let backups_dir = get_backups_dir();
    let _ = std::fs::create_dir_all(&backups_dir);
    let filename = format!("localban_manual_{}.localban", Utc::now().format("%Y%m%d_%H%M%S"));
    let target = backups_dir.join(&filename);
    create_full_backup_archive(&target)
}

/// 起動時の日次完全バックアップ (.localban 完全アーカイブ) を実行し、古い日次バックアップをローテーション削除する
pub fn perform_daily_backup(keep_days: usize) {
    let db_path = crate::config::get_db_path();
    if !db_path.exists() {
        return;
    }

    let backups_dir = get_backups_dir();
    let _ = std::fs::create_dir_all(&backups_dir);

    let today_str = Utc::now().format("%Y%m%d").to_string();
    let today_backup = backups_dir.join(format!("localban_{}.localban", today_str));
    let legacy_today_backup = backups_dir.join(format!("localban_{}.db", today_str));

    // 今日分のバックアップが存在しなければ完全バックアップを作成
    if !today_backup.exists() && !legacy_today_backup.exists() {
        let _ = create_full_backup_archive(&today_backup);
    }

    // 日次バックアップのみを対象として世代ローテーション (localban_manual_ や pre_restore_ は除外)
    if let Ok(entries) = std::fs::read_dir(&backups_dir) {
        let mut backups: Vec<PathBuf> = entries
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| {
                if !p.is_file() {
                    return false;
                }
                if let Some(n) = p.file_name().and_then(|n| n.to_str()) {
                    n.starts_with("localban_")
                        && !n.starts_with("localban_manual_")
                        && (n.ends_with(".localban") || n.ends_with(".db"))
                } else {
                    false
                }
            })
            .collect();

        backups.sort();
        if backups.len() > keep_days {
            let delete_count = backups.len() - keep_days;
            for old_file in backups.into_iter().take(delete_count) {
                let _ = std::fs::remove_file(old_file);
            }
        }
    }
}

/// バックアップファイル (.localban / .zip / .db) からボードデータおよび添付ファイルを復元する
pub fn restore_from_backup_file(src_path: &Path) -> Result<RestoreResult, String> {
    if !src_path.exists() {
        return Err("Selected backup file does not exist".to_string());
    }

    // 復元直前のセーフティバックアップを作成 (完全バックアップ)
    let _ = create_safety_backup().map_err(|e| format!("Failed to create safety backup: {}", e))?;

    // ファイル判定 (ZIPかSQLite DBか)
    let mut header = [0u8; 16];
    {
        let mut f = File::open(src_path).map_err(|e| e.to_string())?;
        let _ = f.read(&mut header);
    }

    let is_sqlite = header.starts_with(b"SQLite format 3\0");
    let is_zip = header.starts_with(&[0x50, 0x4b, 0x03, 0x04])
        || header.starts_with(&[0x50, 0x4b, 0x05, 0x06])
        || header.starts_with(&[0x50, 0x4b, 0x07, 0x08]);

    let mut restored_attachments = 0;

    if is_sqlite {
        // SQLite 単体ファイル復元 (下位互換性)
        restore_database_from(src_path)
            .map_err(|e| format!("Failed to restore SQLite database: {}", e))?;
    } else if is_zip {
        // ZIP / .localban 復元
        let file = File::open(src_path).map_err(|e| format!("Failed to read backup file: {}", e))?;
        let mut archive =
            zip::ZipArchive::new(file).map_err(|e| format!("Invalid zip archive: {}", e))?;

        let backups_dir = get_backups_dir();
        let temp_extracted_db = backups_dir.join(format!("temp_restore_{}.db", Uuid::new_v4()));
        let mut db_found = false;

        let attachments_dir = get_attachments_dir();
        let _ = std::fs::create_dir_all(&attachments_dir);

        for i in 0..archive.len() {
            let mut file = archive
                .by_index(i)
                .map_err(|e| format!("Failed to read archive entry: {}", e))?;
            let enclosed_name = match file.enclosed_name() {
                Some(p) => p.to_owned(),
                None => continue,
            };

            let name_str = enclosed_name.to_string_lossy().to_string();

            if name_str == "localban.db" {
                let mut out = File::create(&temp_extracted_db)
                    .map_err(|e| format!("Failed to extract db: {}", e))?;
                copy(&mut file, &mut out)
                    .map_err(|e| format!("Failed to write extracted db: {}", e))?;
                db_found = true;
            } else if name_str.starts_with("attachments/") || name_str.starts_with("attachments\\") {
                if let Some(file_name) = enclosed_name.file_name() {
                    let dest_file_path = attachments_dir.join(file_name);
                    if let Ok(mut out) = File::create(&dest_file_path) {
                        if copy(&mut file, &mut out).is_ok() {
                            restored_attachments += 1;
                        }
                    }
                }
            } else if name_str == "settings.json" {
                let settings_path = get_settings_path();
                if let Ok(mut out) = File::create(&settings_path) {
                    let _ = copy(&mut file, &mut out);
                }
            }
        }

        if !db_found {
            let _ = std::fs::remove_file(&temp_extracted_db);
            return Err("Invalid LocalBan backup: 'localban.db' not found in archive".to_string());
        }

        let restore_res = restore_database_from(&temp_extracted_db);
        let _ = std::fs::remove_file(&temp_extracted_db);
        restore_res.map_err(|e| format!("Failed to restore database from backup: {}", e))?;
    } else {
        return Err("Unsupported file format. Please select a .localban, .zip, or .db file.".to_string());
    }

    // 復元後データの集計
    let conn = get_connection().map_err(|e| e.to_string())?;
    let lists_count: usize = conn
        .query_row("SELECT COUNT(*) FROM lists;", [], |r| r.get(0))
        .unwrap_or(0);
    let cards_count: usize = conn
        .query_row("SELECT COUNT(*) FROM cards;", [], |r| r.get(0))
        .unwrap_or(0);

    Ok(RestoreResult {
        success: true,
        message: "バックアップからの復元が正常に完了しました".to_string(),
        lists_count,
        cards_count,
        attachments_restored: restored_attachments,
    })
}

/// 内部バックアップフォルダ内のバックアップ一覧 (.localban / .db) を取得する
pub fn list_internal_backups() -> Result<Vec<BackupFileInfo>, String> {
    let backups_dir = get_backups_dir();
    let mut list = Vec::new();

    if let Ok(entries) = std::fs::read_dir(&backups_dir) {
        for entry in entries.flatten() {
            if let Ok(ft) = entry.file_type() {
                if ft.is_file() {
                    let path = entry.path();
                    if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                        let is_backup_ext = name.ends_with(".localban") || name.ends_with(".db");
                        let is_backup_prefix =
                            name.starts_with("localban_") || name.starts_with("pre_restore_");

                        if is_backup_ext && is_backup_prefix {
                            let metadata = entry.metadata().ok();
                            let size_bytes = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
                            let created_at = metadata
                                .and_then(|m| m.modified().ok())
                                .map(|time| chrono::DateTime::<Utc>::from(time).to_rfc3339())
                                .unwrap_or_else(|| Utc::now().to_rfc3339());

                            let is_safety = name.starts_with("pre_restore_");

                            list.push(BackupFileInfo {
                                filename: name.to_string(),
                                path: path.to_string_lossy().to_string(),
                                created_at,
                                size_bytes,
                                is_safety_backup: is_safety,
                            });
                        }
                    }
                }
            }
        }
    }

    // 新しい順にソート
    list.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(list)
}
