export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface ChecklistItem {
  id: string;
  checklist_id: string;
  content: string;
  is_completed: boolean;
  position: number;
}

export interface Checklist {
  id: string;
  card_id: string;
  title: string;
  position: number;
  items: ChecklistItem[];
}

export interface Attachment {
  id: string;
  card_id: string;
  filename: string;
  stored_filename: string;
  file_size: number;
  mime_type: string | null;
  created_at: string;
}

export interface Card {
  id: string;
  list_id: string | null;
  original_list_title: string | null;
  title: string;
  description: string;
  position: number;
  due_date: string | null;
  is_due_complete: boolean;
  cover_attachment_id: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  labels: Label[];
  checklists: Checklist[];
  attachments: Attachment[];
}

export interface ListModel {
  id: string;
  title: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface BoardState {
  lists: ListModel[];
  cards: Card[];
  labels: Label[];
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface AppSettings {
  close_to_tray: boolean;
}
