import { BoardState, Card, ListModel, Label, Checklist, ChecklistItem, Attachment, SaveStatus } from './types';

// セッショントークンの取得と保持
function getSessionToken(): string {
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('token');
  if (tokenFromUrl) {
    sessionStorage.setItem('localban_token', tokenFromUrl);
    // URLバーからトークンクエリを綺麗に取り除く (履歴は保持)
    const cleanUrl = window.location.pathname + window.location.hash;
    window.history.replaceState({}, document.title, cleanUrl);
    return tokenFromUrl;
  }
  return sessionStorage.getItem('localban_token') || '';
}

let sessionToken = getSessionToken();

export function setSessionToken(token: string) {
  sessionToken = token;
  sessionStorage.setItem('localban_token', token);
}

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

// 複数タブ同期 (BroadcastChannel) 【項目22】
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

// HTTP ヘルパー
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('X-LocalBan-Token') && sessionToken) {
    headers.set('X-LocalBan-Token', sessionToken);
  }
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const isWrite = ['POST', 'PUT', 'DELETE', 'PATCH'].includes((options.method || 'GET').toUpperCase());
  if (isWrite) {
    updateStatus('saving');
  }

  try {
    const res = await fetch(endpoint, { ...options, headers });
    if (!res.ok) {
      if (isWrite) updateStatus('error');
      let errorDetail = `Error ${res.status}`;
      try {
        const errJson = await res.json();
        errorDetail = errJson.detail || errorDetail;
      } catch {
        // ignore
      }
      throw new Error(errorDetail);
    }
    const data = await res.json();
    if (isWrite) {
      updateStatus('saved');
    }
    return data as T;
  } catch (err) {
    if (isWrite) updateStatus('error');
    throw err;
  }
}

// --- API Functions ---

export async function fetchBoardState(): Promise<BoardState> {
  return request<BoardState>('/api/cards/board/state');
}

// Lists
export async function createList(title: string, position?: number): Promise<ListModel> {
  const list = await request<ListModel>('/api/lists', {
    method: 'POST',
    body: JSON.stringify({ title, position }),
  });
  notifySync('CREATE_LIST');
  return list;
}

export async function updateList(id: string, title?: string, position?: number): Promise<ListModel> {
  const list = await request<ListModel>(`/api/lists/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ title, position }),
  });
  notifySync('UPDATE_LIST');
  return list;
}

export async function deleteList(id: string): Promise<void> {
  await request(`/api/lists/${id}`, { method: 'DELETE' });
  notifySync('DELETE_LIST');
}

// Cards
export async function createCard(listId: string, title: string, description?: string, position?: number): Promise<Card> {
  const card = await request<Card>('/api/cards', {
    method: 'POST',
    body: JSON.stringify({ list_id: listId, title, description, position }),
  });
  notifySync('CREATE_CARD');
  return card;
}

export async function fetchCard(id: string): Promise<Card> {
  return request<Card>(`/api/cards/${id}`);
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
  const card = await request<Card>(`/api/cards/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  notifySync('UPDATE_CARD');
  return card;
}

export async function moveCard(id: string, listId: string, position: number): Promise<Card> {
  const card = await request<Card>(`/api/cards/${id}/move`, {
    method: 'POST',
    body: JSON.stringify({ list_id: listId, position }),
  });
  notifySync('MOVE_CARD');
  return card;
}

export async function copyCard(id: string, targetListId?: string): Promise<Card> {
  const card = await request<Card>(`/api/cards/${id}/copy`, {
    method: 'POST',
    body: JSON.stringify({ target_list_id: targetListId }),
  });
  notifySync('COPY_CARD');
  return card;
}

export async function archiveCard(id: string): Promise<void> {
  await request(`/api/cards/${id}/archive`, { method: 'POST' });
  notifySync('ARCHIVE_CARD');
}

// Checklists
export async function createChecklist(cardId: string, title?: string): Promise<Checklist> {
  const cl = await request<Checklist>(`/api/cards/${cardId}/checklists`, {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
  notifySync('CREATE_CHECKLIST');
  return cl;
}

export async function updateChecklist(id: string, title: string): Promise<Checklist> {
  const cl = await request<Checklist>(`/api/cards/checklists/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ title }),
  });
  notifySync('UPDATE_CHECKLIST');
  return cl;
}

export async function deleteChecklist(id: string): Promise<void> {
  await request(`/api/cards/checklists/${id}`, { method: 'DELETE' });
  notifySync('DELETE_CHECKLIST');
}

export async function createChecklistItem(checklistId: string, content: string): Promise<ChecklistItem> {
  const item = await request<ChecklistItem>(`/api/cards/checklists/${checklistId}/items`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
  notifySync('CREATE_CHECKLIST_ITEM');
  return item;
}

export async function updateChecklistItem(
  id: string,
  payload: { content?: string; is_completed?: boolean; position?: number }
): Promise<ChecklistItem> {
  const item = await request<ChecklistItem>(`/api/cards/checklist-items/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  notifySync('UPDATE_CHECKLIST_ITEM');
  return item;
}

export async function deleteChecklistItem(id: string): Promise<void> {
  await request(`/api/cards/checklist-items/${id}`, { method: 'DELETE' });
  notifySync('DELETE_CHECKLIST_ITEM');
}

// Attachments
export async function uploadAttachment(cardId: string, file: File): Promise<Attachment> {
  const formData = new FormData();
  formData.append('file', file);
  const att = await request<Attachment>(`/api/attachments/card/${cardId}`, {
    method: 'POST',
    body: formData,
  });
  notifySync('UPLOAD_ATTACHMENT');
  return att;
}

export function getAttachmentDownloadUrl(id: string, inline = true): string {
  const token = sessionToken;
  return `/api/attachments/${id}/download?inline=${inline}&token=${token}`;
}

export async function deleteAttachment(id: string): Promise<void> {
  await request(`/api/attachments/${id}`, { method: 'DELETE' });
  notifySync('DELETE_ATTACHMENT');
}

// Archive Management
export async function fetchArchivedCards(): Promise<Card[]> {
  return request<Card[]>('/api/cards/archived/list');
}

export async function restoreCard(id: string, targetListId?: string): Promise<Card> {
  const card = await request<Card>(`/api/cards/${id}/restore`, {
    method: 'POST',
    body: JSON.stringify({ target_list_id: targetListId }),
  });
  notifySync('RESTORE_CARD');
  return card;
}

export async function permanentlyDeleteCard(id: string): Promise<void> {
  await request(`/api/cards/${id}/permanent`, { method: 'DELETE' });
  notifySync('PERMANENT_DELETE_CARD');
}

// System
export async function shutdownServer(): Promise<void> {
  await request('/api/system/shutdown', { method: 'POST' });
}
