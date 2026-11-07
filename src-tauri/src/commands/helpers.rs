use rusqlite::{params, Connection, OptionalExtension};
use std::path::Path;
use uuid::Uuid;

use crate::config::safe_resolve_attachment_path;
use crate::models::{
    AttachmentResponse, CardResponse, ChecklistItemResponse, ChecklistResponse, LabelResponse,
    ListResponse,
};

pub const LIST_SELECT_FIELDS: &str = "id, title, position, color, created_at, updated_at";

pub(crate) fn row_to_list(row: &rusqlite::Row) -> rusqlite::Result<ListResponse> {
    Ok(ListResponse {
        id: row.get(0)?,
        title: row.get(1)?,
        position: row.get(2)?,
        color: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}

fn fetch_card_labels(conn: &Connection, card_id: &str) -> Result<Vec<LabelResponse>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT l.id, l.name, l.color
             FROM labels l
             JOIN card_labels cl ON l.id = cl.label_id
             WHERE cl.card_id = ?1
             ORDER BY l.name ASC;",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![card_id], |r| {
            Ok(LabelResponse {
                id: r.get(0)?,
                name: r.get(1)?,
                color: r.get(2)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut labels = Vec::new();
    for r in rows {
        labels.push(r.map_err(|e| e.to_string())?);
    }
    Ok(labels)
}

fn fetch_card_checklists(conn: &Connection, card_id: &str) -> Result<Vec<ChecklistResponse>, String> {
    let mut cl_stmt = conn
        .prepare(
            "SELECT id, card_id, title, position
             FROM checklists
             WHERE card_id = ?1
             ORDER BY position ASC, id ASC;",
        )
        .map_err(|e| e.to_string())?;

    let cl_rows = cl_stmt
        .query_map(params![card_id], |r| {
            Ok((
                r.get::<_, String>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
                r.get::<_, f64>(3)?,
            ))
        })
        .map_err(|e| e.to_string())?;

    let mut checklists = Vec::new();
    for cl_res in cl_rows {
        let (cid, c_card_id, c_title, c_pos) = cl_res.map_err(|e| e.to_string())?;

        let mut item_stmt = conn
            .prepare(
                "SELECT id, checklist_id, content, is_completed, position
                 FROM checklist_items
                 WHERE checklist_id = ?1
                 ORDER BY position ASC, id ASC;",
            )
            .map_err(|e| e.to_string())?;

        let item_rows = item_stmt
            .query_map(params![&cid], |ir| {
                let is_comp: i32 = ir.get(3)?;
                Ok(ChecklistItemResponse {
                    id: ir.get(0)?,
                    checklist_id: ir.get(1)?,
                    content: ir.get(2)?,
                    is_completed: is_comp != 0,
                    position: ir.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut items = Vec::new();
        for ir in item_rows {
            items.push(ir.map_err(|e| e.to_string())?);
        }

        checklists.push(ChecklistResponse {
            id: cid,
            card_id: c_card_id,
            title: c_title,
            position: c_pos,
            items,
        });
    }
    Ok(checklists)
}

fn fetch_card_attachments(conn: &Connection, card_id: &str) -> Result<Vec<AttachmentResponse>, String> {
    let mut att_stmt = conn
        .prepare(
            "SELECT id, card_id, filename, stored_filename, file_size, mime_type, created_at, (backup_stored_filename IS NOT NULL) AS has_backup
             FROM attachments
             WHERE card_id = ?1 AND is_cover = 0
             ORDER BY created_at ASC;",
        )
        .map_err(|e| e.to_string())?;

    let att_rows = att_stmt
        .query_map(params![card_id], |r| {
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
        })
        .map_err(|e| e.to_string())?;

    let mut attachments = Vec::new();
    for ar in att_rows {
        attachments.push(ar.map_err(|e| e.to_string())?);
    }
    Ok(attachments)
}

pub fn build_card_response(conn: &Connection, card_id: &str) -> Result<CardResponse, String> {
    let mut card_stmt = conn
        .prepare(
            "SELECT id, list_id, original_list_title, title, description, position,
                    due_date, is_due_complete, cover_attachment_id, is_archived,
                    created_at, updated_at
             FROM cards WHERE id = ?1;",
        )
        .map_err(|e| e.to_string())?;

    let card = card_stmt
        .query_row(params![card_id], |row| {
            let is_due_complete: i32 = row.get(7)?;
            let is_archived: i32 = row.get(9)?;
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, Option<String>>(1)?,
                row.get::<_, Option<String>>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, f64>(5)?,
                row.get::<_, Option<String>>(6)?,
                is_due_complete != 0,
                row.get::<_, Option<String>>(8)?,
                is_archived != 0,
                row.get::<_, String>(10)?,
                row.get::<_, String>(11)?,
            ))
        })
        .map_err(|e| format!("Card not found: {}", e))?;

    let labels = fetch_card_labels(conn, card_id)?;
    let checklists = fetch_card_checklists(conn, card_id)?;
    let attachments = fetch_card_attachments(conn, card_id)?;

    Ok(CardResponse {
        id: card.0,
        list_id: card.1,
        original_list_title: card.2,
        title: card.3,
        description: card.4,
        position: card.5,
        due_date: card.6,
        is_due_complete: card.7,
        cover_attachment_id: card.8,
        is_archived: card.9,
        created_at: card.10,
        updated_at: card.11,
        labels,
        checklists,
        attachments,
    })
}

pub fn check_and_rebalance_cards(conn: &Connection, list_id: &str) -> Result<(), String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, position FROM cards WHERE list_id = ?1 AND is_archived = 0 ORDER BY position ASC;",
        )
        .map_err(|e| e.to_string())?;

    let rows: Vec<(String, f64)> = stmt
        .query_map(params![list_id], |r| Ok((r.get(0)?, r.get(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    if rows.len() < 2 {
        return Ok(());
    }

    let mut needs_rebalance = false;
    for i in 0..(rows.len() - 1) {
        let diff = rows[i + 1].1 - rows[i].1;
        if diff < 0.0001 {
            needs_rebalance = true;
            break;
        }
    }

    if needs_rebalance {
        for (idx, (cid, _)) in rows.iter().enumerate() {
            let new_pos = (idx + 1) as f64 * 1000.0;
            conn.execute(
                "UPDATE cards SET position = ?1 WHERE id = ?2;",
                params![new_pos, cid],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

/// 元のファイル名から拡張子を保持したUUIDファイル名を生成する
pub(crate) fn generate_stored_filename(filename: &str) -> String {
    let ext = Path::new(filename)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("");
    if ext.is_empty() {
        Uuid::new_v4().simple().to_string()
    } else {
        format!("{}.{}", Uuid::new_v4().simple(), ext)
    }
}

/// 添付ファイル実体を安全なパスに書き込む
pub(crate) fn write_attachment_bytes(filename: &str, data: &[u8]) -> Result<String, String> {
    let stored_filename = generate_stored_filename(filename);
    let target_path = safe_resolve_attachment_path(&stored_filename)?;
    if let Some(parent) = target_path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    std::fs::write(&target_path, data).map_err(|e| e.to_string())?;
    Ok(stored_filename)
}

/// 旧カバー画像が専用カバー（is_cover = 1）である場合にDBレコードを削除し、削除対象の stored_filename を返す
pub(crate) fn cleanup_old_cover_record(
    tx: &Connection,
    old_cover_id: &str,
) -> Result<Option<String>, String> {
    let old_att_info: Option<(String, i32)> = tx
        .query_row(
            "SELECT stored_filename, is_cover FROM attachments WHERE id = ?1;",
            params![old_cover_id],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    if let Some((old_stored, is_cover)) = old_att_info {
        if is_cover == 1 {
            tx.execute("DELETE FROM attachments WHERE id = ?1;", params![old_cover_id])
                .map_err(|e| e.to_string())?;
            return Ok(Some(old_stored));
        }
    }
    Ok(None)
}

/// stored_filename に対応するディスク上の実体ファイルを安全に削除する
pub(crate) fn remove_stored_file_quietly(stored_filename: &str) {
    if let Ok(path) = safe_resolve_attachment_path(stored_filename) {
        let _ = std::fs::remove_file(path);
    }
}
