pub mod commands;
pub mod config;
pub mod db;
pub mod models;

use percent_encoding::{utf8_percent_encode, AsciiSet, CONTROLS};
use rusqlite::params;
use std::collections::HashSet;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{http::Response, Manager, WindowEvent};

pub static SHOULD_EXIT: AtomicBool = AtomicBool::new(false);

const FRAGMENT: &AsciiSet = &CONTROLS.add(b' ').add(b'"').add(b'<').add(b'>').add(b'`');

fn get_safe_inline_mime_types() -> HashSet<&'static str> {
    let mut s = HashSet::new();
    s.insert("image/jpeg");
    s.insert("image/png");
    s.insert("image/webp");
    s.insert("image/gif");
    s.insert("image/bmp");
    s.insert("image/avif");
    s.insert("image/apng");
    s.insert("image/x-icon");
    s.insert("application/pdf");
    s.insert("text/plain");
    s
}

pub fn log_to_file(msg: &str) {
    use std::io::Write;
    let path = config::get_app_dir().join("localban.log");
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(f, "[{}] [PID:{}] {}", chrono::Local::now().to_rfc3339(), std::process::id(), msg);
    }
}

pub fn run() {
    log_to_file("run() started");
    let _ = db::init_database();

    let mut builder = tauri::Builder::default();

    // 1. Single Instance Plugin (2重起動防止・既存ウィンドウ前面化)
    builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
        log_to_file(&format!("single_instance callback: args={:?}, cwd={:?}", args, cwd));
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.show();
            let _ = window.unminimize();
            let _ = window.set_focus();
        }
    }));

    // 2. Opener & Dialog Plugins
    builder = builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init());

    // 3. Custom Protocol: localban://attachments/{id}
    builder = builder.register_uri_scheme_protocol("localban", |_app, request| {
        // 例: http://localban.localhost/attachments/{id}?inline=true
        let path = request.uri().path();
        if let Some(id_part) = path.strip_prefix("/attachments/") {
            let id = id_part.trim_matches('/');
            let query = request.uri().query().unwrap_or("");
            let inline = query.contains("inline=true");

            if let Ok(conn) = db::get_connection() {
                let attachment: Result<(String, String, Option<String>), _> = conn.query_row(
                    "SELECT stored_filename, filename, mime_type FROM attachments WHERE id = ?1;",
                    params![id],
                    |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
                );

                if let Ok((stored_name, orig_filename, mime)) = attachment {
                    if let Ok(file_path) = config::safe_resolve_attachment_path(&stored_name) {
                        if file_path.exists() {
                            if let Ok(bytes) = std::fs::read(&file_path) {
                                let mime_type = mime.unwrap_or_else(|| "application/octet-stream".to_string());
                                let safe_types = get_safe_inline_mime_types();
                                let can_inline = inline && safe_types.contains(mime_type.as_str());

                                let disposition_type = if can_inline { "inline" } else { "attachment" };
                                let encoded_filename = utf8_percent_encode(&orig_filename, FRAGMENT).to_string();

                                let response_builder = Response::builder()
                                    .header("Content-Type", if can_inline { mime_type.as_str() } else { "application/octet-stream" })
                                    .header("X-Content-Type-Options", "nosniff")
                                    .header(
                                        "Content-Disposition",
                                        format!("{disposition_type}; filename*=UTF-8''{encoded_filename}"),
                                    );

                                return response_builder.body(bytes).unwrap_or_else(|_| {
                                    Response::builder().status(500).body(Vec::new()).unwrap()
                                });
                            }
                        }
                    }
                }
            }
            return Response::builder().status(404).body(Vec::new()).unwrap();
        }

        Response::builder().status(400).body(Vec::new()).unwrap()
    });

    // 4. Setup Tray & Window Lifecycle
    builder = builder
        .setup(|app| {
            // Tray Menu
            let open_item = MenuItem::with_id(app, "open", "LocalBan を開く", true, None::<&str>)?;
            let exit_item = MenuItem::with_id(app, "exit", "終了", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_item, &exit_item])?;

            let mut tray_builder = TrayIconBuilder::with_id("main-tray")
                .tooltip("LocalBan - オフラインカンバンボード")
                .menu(&menu)
                .show_menu_on_left_click(false);

            if let Some(icon) = app.default_window_icon() {
                tray_builder = tray_builder.icon(icon.clone());
            } else if let Ok(icon) = tauri::image::Image::from_bytes(include_bytes!("../icons/32x32.png")) {
                tray_builder = tray_builder.icon(icon);
            }

            let _tray = tray_builder
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "open" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                    "exit" => {
                        SHOULD_EXIT.store(true, Ordering::SeqCst);
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.unminimize();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            log_to_file("setup completing, showing main window");
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
                log_to_file("main window found and show/focus called");
            } else {
                log_to_file("WARNING: main window not found in setup!");
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            log_to_file(&format!("on_window_event: label={}, event={:?}", window.label(), event));
            // パターン2: ウィンドウの「×」ボタン押下時は非表示（タスクトレイ格納）にする
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
                log_to_file("CloseRequested prevented, window hidden");
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_board_state,
            commands::get_lists,
            commands::create_list,
            commands::update_list,
            commands::delete_list,
            commands::get_cards,
            commands::get_card,
            commands::create_card,
            commands::update_card,
            commands::move_card,
            commands::copy_card,
            commands::archive_card,
            commands::get_archived_cards,
            commands::restore_card,
            commands::permanently_delete_card,
            commands::create_checklist,
            commands::update_checklist,
            commands::delete_checklist,
            commands::create_checklist_item,
            commands::update_checklist_item,
            commands::delete_checklist_item,
            commands::get_labels,
            commands::create_label,
            commands::update_label,
            commands::delete_label,
            commands::upload_attachment,
            commands::delete_attachment,
            commands::save_attachment_as,
            commands::get_system_status,
            commands::shutdown_app,
        ]);

    log_to_file("building app from builder");
    let app = builder
        .build(tauri::generate_context!())
        .expect("error while building LocalBan application");

    log_to_file("app built, starting app.run");
    app.run(|_app_handle, event| {
        log_to_file(&format!("RunEvent: {:?}", event));
        if let tauri::RunEvent::ExitRequested { api, .. } = event {
            let should = SHOULD_EXIT.load(Ordering::SeqCst);
            log_to_file(&format!("ExitRequested, SHOULD_EXIT={}", should));
            if !should {
                api.prevent_exit();
                log_to_file("prevent_exit called");
            }
        }
    });
    log_to_file("app.run exited!");
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    use std::sync::Mutex;
    static TEST_MUTEX: Mutex<()> = Mutex::new(());

    struct TestEnv {
        _dir: tempfile::TempDir,
        _guard: std::sync::MutexGuard<'static, ()>,
    }

    impl TestEnv {
        fn new() -> Self {
            let guard = TEST_MUTEX.lock().unwrap();
            let dir = tempdir().expect("Failed to create tempdir");
            std::env::set_var("LOCALBAN_DATA_DIR", dir.path().to_str().unwrap());
            config::init_dirs().expect("Failed to init dirs");
            db::init_database().expect("Failed to init database");
            TestEnv { _dir: dir, _guard: guard }
        }
    }

    // 1. システムステータス & バージョン検証 (v2.0.0)
    #[test]
    fn test_system_status() {
        let _env = TestEnv::new();
        let status = commands::get_system_status();
        assert_eq!(status.status, "running");
        assert_eq!(status.app, "LocalBan");
        assert_eq!(status.version, "2.0.0");
    }

    // 2. 初期データ投入検証 (シードデータ 3リスト・3カード)
    #[test]
    fn test_initial_data_has_default_cards() {
        let _env = TestEnv::new();
        let board = commands::get_board_state().unwrap();
        assert_eq!(board.lists.len(), 3);
        assert_eq!(board.cards.len(), 3);
        assert_eq!(board.labels.len(), 6);

        let todo_list = board.lists.iter().find(|l| l.title == "ToDo").unwrap();
        let todo_card = board.cards.iter().find(|c| c.list_id.as_deref() == Some(&todo_list.id)).unwrap();
        assert!(todo_card.title.contains("LocalBanへようこそ"));
        assert_eq!(todo_card.checklists.len(), 1);
        assert_eq!(todo_card.checklists[0].items.len(), 3);
    }

    // 3. リストCRUD & リスト削除時自動アーカイブ
    #[test]
    fn test_list_crud_and_auto_archive() {
        let _env = TestEnv::new();
        let created_list = commands::create_list("保護テストリスト".into(), None).unwrap();
        let card = commands::create_card(created_list.id.clone(), "保護カード".into(), None, None).unwrap();

        // リスト削除
        commands::delete_list(created_list.id.clone()).unwrap();

        // リストが消えていること
        let lists = commands::get_lists().unwrap();
        assert!(!lists.iter().any(|l| l.id == created_list.id));

        // カードは消えずアーカイブされていること
        let archived = commands::get_card(card.id).unwrap();
        assert!(archived.is_archived);
        assert!(archived.list_id.is_none());
        assert_eq!(archived.original_list_title.as_deref(), Some("保護テストリスト"));
    }

    // 4. カード複製（チェックリスト・添付実体コピー）
    #[test]
    fn test_card_copy_with_attachment_and_checklist() {
        let _env = TestEnv::new();
        let list = commands::create_list("複製リスト".into(), None).unwrap();
        let card = commands::create_card(list.id.clone(), "元カード".into(), Some("詳細説明".into()), None).unwrap();

        let cl = commands::create_checklist(card.id.clone(), Some("TODO".into())).unwrap();
        commands::create_checklist_item(cl.id, "アイテム1".into()).unwrap();

        // 添付ファイル追加
        let att = commands::upload_attachment(card.id.clone(), "test.png".into(), "image/png".into(), b"fake png data".to_vec()).unwrap();

        // 複製
        let copied = commands::copy_card(card.id.clone(), None).unwrap();
        assert_eq!(copied.title, "元カード のコピー");
        assert_eq!(copied.description, "詳細説明");
        assert_eq!(copied.checklists.len(), 1);
        assert_eq!(copied.checklists[0].items[0].content, "アイテム1");
        assert_eq!(copied.attachments.len(), 1);
        assert_eq!(copied.attachments[0].filename, "test.png");
        assert_ne!(copied.attachments[0].stored_filename, att.stored_filename);
    }

    // 5. 2段階完全削除の整合性
    #[test]
    fn test_permanent_delete_cleans_db_and_disk() {
        let _env = TestEnv::new();
        let list = commands::create_list("削除リスト".into(), None).unwrap();
        let card = commands::create_card(list.id.clone(), "完全削除カード".into(), None, None).unwrap();
        let att = commands::upload_attachment(card.id.clone(), "delete.txt".into(), "text/plain".into(), b"delete me".to_vec()).unwrap();

        let file_path = config::safe_resolve_attachment_path(&att.stored_filename).unwrap();
        assert!(file_path.exists());

        // 未アーカイブカードの完全削除は拒否されること
        assert!(commands::permanently_delete_card(card.id.clone()).is_err());

        // アーカイブ後に完全削除
        commands::archive_card(card.id.clone()).unwrap();
        assert!(commands::permanently_delete_card(card.id.clone()).is_ok());

        // DBおよびディスクから消去されていること
        assert!(commands::get_card(card.id).is_err());
        assert!(!file_path.exists());
    }

    // 6. Fractional Indexing リバランス
    #[test]
    fn test_fractional_indexing_rebalance() {
        let _env = TestEnv::new();
        let list = commands::create_list("リバランスリスト".into(), None).unwrap();
        let _c1 = commands::create_card(list.id.clone(), "C1".into(), None, Some(1000.0)).unwrap();
        let c2 = commands::create_card(list.id.clone(), "C2".into(), None, Some(1000.00001)).unwrap();

        // 差分 < 0.0001 の位置へ移動してリバランスをトリガー
        commands::move_card(c2.id, list.id.clone(), 1000.00002).unwrap();

        let conn = db::get_connection().unwrap();
        let mut stmt = conn.prepare("SELECT position FROM cards WHERE list_id = ?1 ORDER BY position ASC;").unwrap();
        let positions: Vec<f64> = stmt.query_map(params![&list.id], |r| r.get(0)).unwrap().filter_map(|r| r.ok()).collect();

        assert_eq!(positions.len(), 2);
        assert_eq!(positions[0], 1000.0);
        assert_eq!(positions[1], 2000.0);
    }

    // 7. 期限解除 & カバー解除
    #[test]
    fn test_card_due_date_and_cover_clear() {
        let _env = TestEnv::new();
        let list = commands::create_list("期限リスト".into(), None).unwrap();
        let card = commands::create_card(list.id.clone(), "テストカード".into(), None, None).unwrap();

        // 期限設定
        let due_iso = "2026-10-15T18:00:00.000Z".to_string();
        let updated = commands::update_card(card.id.clone(), None, None, Some(Some(due_iso.clone())), Some(true), None, None).unwrap();
        assert_eq!(updated.due_date.as_deref(), Some(due_iso.as_str()));
        assert!(updated.is_due_complete);

        // 期限解除 (Some(None) 送信)
        let cleared = commands::update_card(card.id.clone(), None, None, Some(None), Some(false), None, None).unwrap();
        assert!(cleared.due_date.is_none());
        assert!(!cleared.is_due_complete);

        // カバー添付設定
        let att = commands::upload_attachment(card.id.clone(), "cover.png".into(), "image/png".into(), b"fake png".to_vec()).unwrap();
        let with_cover = commands::update_card(card.id.clone(), None, None, None, None, Some(Some(att.id.clone())), None).unwrap();
        assert_eq!(with_cover.cover_attachment_id.as_deref(), Some(att.id.as_str()));

        // カバー解除
        let without_cover = commands::update_card(card.id.clone(), None, None, None, None, Some(None), None).unwrap();
        assert!(without_cover.cover_attachment_id.is_none());
    }

    // 8. 添付ファイル50MB制限
    #[test]
    fn test_attachment_size_limit() {
        let _env = TestEnv::new();
        let list = commands::create_list("制限リスト".into(), None).unwrap();
        let card = commands::create_card(list.id.clone(), "サイズカード".into(), None, None).unwrap();

        let oversized_data = vec![0u8; config::MAX_UPLOAD_SIZE + 1];
        let res = commands::upload_attachment(card.id, "huge.bin".into(), "application/octet-stream".into(), oversized_data);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("50MB"));
    }
}
