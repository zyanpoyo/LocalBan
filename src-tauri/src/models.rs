use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListResponse {
    pub id: String,
    pub title: String,
    pub position: f64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LabelResponse {
    pub id: String,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChecklistItemResponse {
    pub id: String,
    pub checklist_id: String,
    pub content: String,
    pub is_completed: bool,
    pub position: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChecklistResponse {
    pub id: String,
    pub card_id: String,
    pub title: String,
    pub position: f64,
    pub items: Vec<ChecklistItemResponse>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttachmentResponse {
    pub id: String,
    pub card_id: String,
    pub filename: String,
    pub stored_filename: String,
    pub file_size: i64,
    pub mime_type: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CardResponse {
    pub id: String,
    pub list_id: Option<String>,
    pub original_list_title: Option<String>,
    pub title: String,
    pub description: String,
    pub position: f64,
    pub due_date: Option<String>,
    pub is_due_complete: bool,
    pub cover_attachment_id: Option<String>,
    pub is_archived: bool,
    pub created_at: String,
    pub updated_at: String,
    pub labels: Vec<LabelResponse>,
    pub checklists: Vec<ChecklistResponse>,
    pub attachments: Vec<AttachmentResponse>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoardStateResponse {
    pub lists: Vec<ListResponse>,
    pub cards: Vec<CardResponse>,
    pub labels: Vec<LabelResponse>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemStatusResponse {
    pub status: String,
    pub app: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettingsResponse {
    pub close_to_tray: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupFileInfo {
    pub filename: String,
    pub path: String,
    pub created_at: String,
    pub size_bytes: u64,
    pub is_safety_backup: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupManifest {
    pub version: String,
    pub exported_at: String,
    pub lists_count: usize,
    pub cards_count: usize,
    pub attachments_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RestoreResult {
    pub success: bool,
    pub message: String,
    pub lists_count: usize,
    pub cards_count: usize,
    pub attachments_restored: usize,
}
