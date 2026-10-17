import { BoardState, Card, ListModel, Label, Checklist, ChecklistItem, Attachment, SaveStatus } from './types';
import { invoke } from '@tauri-apps/api/core';

// 保存状態リスナー
type StatusListener = (status: SaveStatus) => void;
const statusListeners: Set<StatusListener> = new Set();
let saveTimeout: ReturnType<typeof setTimeout> | null = null;

export function onSaveStatusChange(listener: StatusListener) {
  statusListeners.add(listener);
  return () => {
    statusListeners.delete(listener);
  };
}

function updateStatus(status: SaveStatus) {
  if (saveTimeout) clearTimeout(saveTimeout);
  statusListeners.forEach((l) => l(status));
  if (status === 'saved') {
    saveTimeout = setTimeout(() => {
      statusListeners.forEach((l) => l('idle'));
    }, 2500);
  }
}

// 複数ウィンドウ・タブ同期 (BroadcastChannel)
const syncChannel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('localban_sync') : null;

export function notifySync(actionType: string) {
  if (syncChannel) {
    syncChannel.postMessage({ type: 'DATA_CHANGED', action: actionType, timestamp: Date.now() });
  }
}

export function onSyncMessage(callback: () => void) {
  if (!syncChannel) return () => {};
  const handler = (e: MessageEvent) => {
    if (e.data?.type === 'DATA_CHANGED') {
      callback();
    }
  };
  syncChannel.addEventListener('message', handler);
  return () => {
    syncChannel.removeEventListener('message', handler);
  };
}

// Tauri コマンド呼び出しラッパー
async function callCommand<T>(command: string, args: Record<string, any> = {}, isWrite = false): Promise<T> {
  if (isWrite) {
    updateStatus('saving');
  }

  try {
    const result = await invoke<T>(command, args);
    if (isWrite) {
      updateStatus('saved');
    }
    return result;
  } catch (err: any) {
    if (isWrite) {
      updateStatus('error');
    }
    const message = typeof err === 'string' ? err : err?.message || '予期せぬエラーが発生しました';
    throw new Error(message);
  }
}

// --- API Functions ---

export async function fetchBoardState(): Promise<BoardState> {
  return callCommand<BoardState>('get_board_state');
}

// Lists
export async function createList(title: string, position?: number): Promise<ListModel> {
  const list = await callCommand<ListModel>('create_list', { title, position: position ?? null }, true);
  notifySync('CREATE_LIST');
  return list;
}

export async function updateList(id: string, title?: string, position?: number): Promise<ListModel> {
  const list = await callCommand<ListModel>('update_list', { id, title: title ?? null, position: position ?? null }, true);
  notifySync('UPDATE_LIST');
  return list;
}

export async function deleteList(id: string): Promise<void> {
  await callCommand('delete_list', { id }, true);
  notifySync('DELETE_LIST');
}

// Cards
export async function createCard(listId: string, title: string, description?: string, position?: number): Promise<Card> {
  const card = await callCommand<Card>('create_card', {
    listId,
    title,
    description: description ?? '',
    position: position ?? null,
  }, true);
  notifySync('CREATE_CARD');
  return card;
}

export async function fetchCard(id: string): Promise<Card> {
  return callCommand<Card>('get_card', { id });
}

export async function updateCard(
  id: string,
  payload: {
    title?: string;
    description?: string;
    due_date?: string | null;
    is_due_complete?: boolean;
    cover_attachment_id?: string | null;
    label_ids?: string[];
  }
): Promise<Card> {
  const card = await callCommand<Card>('update_card', {
    id,
    title: payload.title !== undefined ? payload.title : null,
    description: payload.description !== undefined ? payload.description : null,
    dueDate: payload.due_date !== undefined ? payload.due_date : null,
    isDueComplete: payload.is_due_complete !== undefined ? payload.is_due_complete : null,
    coverAttachmentId: payload.cover_attachment_id !== undefined ? payload.cover_attachment_id : null,
    labelIds: payload.label_ids !== undefined ? payload.label_ids : null,
  }, true);
  notifySync('UPDATE_CARD');
  return card;
}

export async function moveCard(id: string, listId: string, position: number): Promise<Card> {
  const card = await callCommand<Card>('move_card', { id, listId, position }, true);
  notifySync('MOVE_CARD');
  return card;
}

export async function copyCard(id: string, targetListId?: string): Promise<Card> {
  const card = await callCommand<Card>('copy_card', { id, targetListId: targetListId ?? null }, true);
  notifySync('COPY_CARD');
  return card;
}

export async function archiveCard(id: string): Promise<void> {
  await callCommand('archive_card', { id }, true);
  notifySync('ARCHIVE_CARD');
}

// Checklists
export async function createChecklist(cardId: string, title?: string): Promise<Checklist> {
  const cl = await callCommand<Checklist>('create_checklist', { cardId, title: title ?? null }, true);
  notifySync('CREATE_CHECKLIST');
  return cl;
}

export async function updateChecklist(id: string, title: string): Promise<Checklist> {
  const cl = await callCommand<Checklist>('update_checklist', { id, title }, true);
  notifySync('UPDATE_CHECKLIST');
  return cl;
}

export async function deleteChecklist(id: string): Promise<void> {
  await callCommand('delete_checklist', { id }, true);
  notifySync('DELETE_CHECKLIST');
}

export async function createChecklistItem(checklistId: string, content: string): Promise<ChecklistItem> {
  const item = await callCommand<ChecklistItem>('create_checklist_item', { checklistId, content }, true);
  notifySync('CREATE_CHECKLIST_ITEM');
  return item;
}

export async function updateChecklistItem(
  id: string,
  payload: { content?: string; is_completed?: boolean; position?: number }
): Promise<ChecklistItem> {
  const item = await callCommand<ChecklistItem>('update_checklist_item', {
    id,
    content: payload.content ?? null,
    isCompleted: payload.is_completed ?? null,
    position: payload.position ?? null,
  }, true);
  notifySync('UPDATE_CHECKLIST_ITEM');
  return item;
}

export async function deleteChecklistItem(id: string): Promise<void> {
  await callCommand('delete_checklist_item', { id }, true);
  notifySync('DELETE_CHECKLIST_ITEM');
}

// Labels
export async function getLabels(): Promise<Label[]> {
  return callCommand<Label[]>('get_labels');
}

export async function createLabel(name: string, color: string): Promise<Label> {
  return callCommand<Label>('create_label', { name, color }, true);
}

export async function updateLabel(id: string, name?: string, color?: string): Promise<Label> {
  return callCommand<Label>('update_label', { id, name: name ?? null, color: color ?? null }, true);
}

export async function deleteLabel(id: string): Promise<void> {
  return callCommand('delete_label', { id }, true);
}

// Attachments
export async function uploadAttachment(cardId: string, file: File): Promise<Attachment> {
  updateStatus('saving');
  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = Array.from(new Uint8Array(arrayBuffer));
    const att = await invoke<Attachment>('upload_attachment', {
      cardId,
      filename: file.name,
      mimeType: file.type || 'application/octet-stream',
      data: bytes,
    });
    updateStatus('saved');
    notifySync('UPLOAD_ATTACHMENT');
    return att;
  } catch (err: any) {
    updateStatus('error');
    const message = typeof err === 'string' ? err : err?.message || 'アップロードに失敗しました';
    throw new Error(message);
  }
}

export function getAttachmentDownloadUrl(id: string, inline = true): string {
  // Tauri カスタムプロトコル localban://attachments/{id}
  return `http://localban.localhost/attachments/${id}?inline=${inline}`;
}

export async function downloadAttachmentFile(id: string, defaultFilename: string): Promise<void> {
  try {
    await invoke('save_attachment_as', { id, defaultFilename });
  } catch (err: any) {
    const msg = typeof err === 'string' ? err : err?.message || '保存に失敗しました';
    if (!msg.includes('cancelled')) {
      alert(`保存エラー: ${msg}`);
    }
  }
}

export async function deleteAttachment(id: string): Promise<void> {
  await callCommand('delete_attachment', { id }, true);
  notifySync('DELETE_ATTACHMENT');
}

// Archive Management
export async function fetchArchivedCards(): Promise<Card[]> {
  return callCommand<Card[]>('get_archived_cards');
}

export async function restoreCard(id: string, targetListId?: string): Promise<Card> {
  const card = await callCommand<Card>('restore_card', { id, targetListId: targetListId ?? null }, true);
  notifySync('RESTORE_CARD');
  return card;
}

export async function permanentlyDeleteCard(id: string): Promise<void> {
  await callCommand('permanently_delete_card', { id }, true);
  notifySync('PERMANENT_DELETE_CARD');
}

// System & Settings
export async function fetchAppSettings(): Promise<{ close_to_tray: boolean }> {
  return callCommand<{ close_to_tray: boolean }>('get_app_settings');
}

export async function updateAppSettings(closeToTray: boolean): Promise<{ close_to_tray: boolean }> {
  return callCommand<{ close_to_tray: boolean }>('update_app_settings', { closeToTray }, true);
}

export async function shutdownServer(): Promise<void> {
  try {
    await invoke('shutdown_app');
  } catch {
    // 終了時は通信切断エラーが起きる場合があるが正常
  }
}
