import React, { useRef, useState, useEffect } from 'react';
import {
  Paperclip,
  Upload,
  Download,
  Plus,
  FileText,
  FileCode,
  File,
  Pencil,
  Undo2,
  ExternalLink,
  Trash2,
  ChevronDown,
  MoreVertical,
  Check,
  FolderOpen,
} from 'lucide-react';
import { Attachment } from '../../types';
import {
  getAttachmentDownloadUrl,
  downloadAttachmentFile,
  fetchAppSettings,
  pickEditorExecutable,
  onSyncMessage,
} from '../../api';

interface CardAttachmentSectionProps {
  attachments: Attachment[];
  onFileUpload: (files: FileList | null) => void;
  onCreateFile: (extension: 'md' | 'txt') => Promise<void>;
  onRenameAttachment: (id: string, newFilename: string) => Promise<void>;
  onOpenAttachment: (id: string, editor?: string) => Promise<void>;
  onRestoreBackup: (id: string) => Promise<void>;
  onDeleteAttachment: (attachmentId: string) => void;
  onPreviewImage: (url: string) => void;
}

interface ContextMenuState {
  x: number;
  y: number;
  att: Attachment;
}

export const CardAttachmentSection: React.FC<CardAttachmentSectionProps> = ({
  attachments,
  onFileUpload,
  onCreateFile,
  onRenameAttachment,
  onOpenAttachment,
  onRestoreBackup,
  onDeleteAttachment,
  onPreviewImage,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFilename, setEditFilename] = useState('');
  const [preferredEditor, setPreferredEditor] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [showOpenWithSubmenu, setShowOpenWithSubmenu] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // 記憶されたエディタ設定の取得
  const loadEditorSetting = () => {
    fetchAppSettings()
      .then((s) => setPreferredEditor(s.preferred_editor ?? null))
      .catch(() => {});
  };

  useEffect(() => {
    loadEditorSetting();
    const unsubscribe = onSyncMessage(() => {
      loadEditorSetting();
    });
    return unsubscribe;
  }, []);

  // 外側クリックでメニューを閉じる
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowCreateMenu(false);
      }
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
        setShowOpenWithSubmenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const handleStartRename = (att: Attachment) => {
    setEditingId(att.id);
    setEditFilename(att.filename);
    setContextMenu(null);
  };

  const handleCommitRename = async (attId: string) => {
    if (!editingId) return;
    const trimmed = editFilename.trim();
    setEditingId(null);
    if (trimmed && trimmed !== attachments.find((a) => a.id === attId)?.filename) {
      await onRenameAttachment(attId, trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, attId: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      void handleCommitRename(attId);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  const getFileIcon = (filename: string, isImage: boolean) => {
    if (isImage) return null;
    const lower = filename.toLowerCase();
    if (lower.endsWith('.md')) {
      return <FileCode className="w-5 h-5 text-indigo-500" />;
    }
    if (lower.endsWith('.txt')) {
      return <FileText className="w-5 h-5 text-sky-500" />;
    }
    return <File className="w-5 h-5 text-slate-400" />;
  };

  const handleContextMenu = (e: React.MouseEvent, att: Attachment) => {
    e.preventDefault();
    e.stopPropagation();
    // 画面外にはみ出さないよう座標調整
    const x = Math.min(e.clientX, window.innerWidth - 220);
    const y = Math.min(e.clientY, window.innerHeight - 260);
    setContextMenu({ x, y, att });
    setShowOpenWithSubmenu(false);
  };

  const handleOpenWith = async (att: Attachment, editorKey: string) => {
    setContextMenu(null);
    setShowOpenWithSubmenu(false);
    await onOpenAttachment(att.id, editorKey);
    setPreferredEditor(editorKey === 'default' ? null : editorKey);
  };

  const handlePickCustomExe = async (att: Attachment) => {
    setContextMenu(null);
    setShowOpenWithSubmenu(false);
    try {
      const exePath = await pickEditorExecutable();
      if (exePath) {
        await onOpenAttachment(att.id, exePath);
        setPreferredEditor(exePath);
      }
    } catch {
      alert('エディタの指定に失敗しました');
    }
  };

  const getCustomExeBasename = (path: string) => {
    const parts = path.split(/[/\\]/);
    return parts[parts.length - 1] || path;
  };

  const isCustomEditor =
    preferredEditor && preferredEditor !== 'notepad' && preferredEditor !== 'vscode';

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
          <Paperclip className="w-4 h-4 text-slate-500" />
          <span>添付ファイル ({attachments.length})</span>
        </div>

        <div className="flex items-center gap-2">
          {/* 新規作成ドロップダウン */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setShowCreateMenu(!showCreateMenu)}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
              title="新規ファイル作成"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>作成</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </button>

            {showCreateMenu && (
              <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateMenu(false);
                    void onCreateFile('md');
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <FileCode className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Markdown (.md)</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateMenu(false);
                    void onCreateFile('txt');
                  }}
                  className="w-full text-left px-3 py-2 text-xs text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-sky-500" />
                  <span>テキスト (.txt)</span>
                </button>
              </div>
            )}
          </div>

          {/* アップロードボタン */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>追加</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => onFileUpload(e.target.files)}
            className="hidden"
          />
        </div>
      </div>

      {/* ドラッグ＆ドロップまたはペースト案内 */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          onFileUpload(e.dataTransfer.files);
        }}
        className="p-3 border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-xl text-center text-xs text-slate-500 bg-slate-50/50 transition-colors"
      >
        ファイルをドラッグ＆ドロップ、またはクリップボードから画像をペースト (Ctrl+V)
      </div>

      {/* 添付一覧 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {attachments.map((att) => {
          const isImage =
            att.mime_type?.startsWith('image/') && att.mime_type !== 'image/svg+xml';
          const isEditing = editingId === att.id;
          const lower = att.filename.toLowerCase();
          const isEditable = lower.endsWith('.md') || lower.endsWith('.txt');

          return (
            <div
              key={att.id}
              onContextMenu={(e) => handleContextMenu(e, att)}
              className="group border border-slate-200 rounded-xl p-2.5 flex items-center gap-3 bg-white shadow-2xs hover:border-indigo-200 hover:shadow-xs transition-all relative"
            >
              {/* サムネイル / アイコン */}
              {isImage ? (
                <div
                  onClick={() => onPreviewImage(getAttachmentDownloadUrl(att.id, true))}
                  className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                  title="画像を拡大プレビュー"
                >
                  <img
                    src={getAttachmentDownloadUrl(att.id, true)}
                    alt={att.filename}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div
                  onClick={() => void onOpenAttachment(att.id)}
                  className="w-12 h-12 rounded-lg bg-slate-50 group-hover:bg-indigo-50/60 border border-slate-100 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
                  title={isEditable ? '外部エディタで開いて編集 (右クリックでアプリ変更)' : '既定のアプリで開く'}
                >
                  {getFileIcon(att.filename, false)}
                </div>
              )}

              {/* ファイル情報 & 操作 */}
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <input
                    type="text"
                    value={editFilename}
                    autoFocus
                    onChange={(e) => setEditFilename(e.target.value)}
                    onBlur={() => void handleCommitRename(att.id)}
                    onKeyDown={(e) => handleKeyDown(e, att.id)}
                    className="w-full text-xs font-semibold text-slate-900 border border-indigo-500 rounded px-1.5 py-0.5 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                  />
                ) : (
                  <div className="flex items-center gap-1 group/title">
                    <p
                      onClick={() => void onOpenAttachment(att.id)}
                      onDoubleClick={() => handleStartRename(att)}
                      className="text-xs font-semibold text-slate-800 hover:text-indigo-600 truncate cursor-pointer transition-colors"
                      title={`${att.filename} (クリックで開く / 右クリックでアプリ選択 / ダブルクリックで名前変更)`}
                    >
                      {att.filename}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleStartRename(att)}
                      className="opacity-0 group-hover/title:opacity-100 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer transition-opacity"
                      title="名前を変更"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-slate-400">
                    {(att.file_size / 1024).toFixed(1)} KB
                  </span>
                  {att.has_backup && (
                    <span className="text-[9px] font-medium text-amber-600 bg-amber-50 px-1 py-0.2 rounded border border-amber-200/60">
                      バックアップあり
                    </span>
                  )}
                </div>

                {/* アクションボタン群 */}
                <div className="flex items-center gap-1.5 mt-1.5">
                  <button
                    type="button"
                    onClick={() => void onOpenAttachment(att.id)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer font-medium"
                    title={isEditable ? '外部エディタで編集' : '既定アプリで開く'}
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>{isEditable ? '編集' : '開く'}</span>
                  </button>

                  {att.has_backup && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm('直前の編集前の状態に戻しますか？')) {
                          void onRestoreBackup(att.id);
                        }
                      }}
                      className="text-[11px] text-amber-600 hover:text-amber-800 flex items-center gap-0.5 cursor-pointer font-medium ml-1"
                      title="直前の状態に戻す"
                    >
                      <Undo2 className="w-3 h-3" />
                      <span>復元</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => downloadAttachmentFile(att.id, att.filename)}
                    className="text-[11px] text-slate-500 hover:text-slate-700 flex items-center gap-0.5 cursor-pointer ml-1"
                    title="PCに保存"
                  >
                    <Download className="w-3 h-3" />
                  </button>

                  {/* その他メニューボタン（三点リーダー） */}
                  <button
                    type="button"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = Math.min(rect.left, window.innerWidth - 220);
                      const y = Math.min(rect.bottom + 4, window.innerHeight - 260);
                      setContextMenu({ x, y, att });
                      setShowOpenWithSubmenu(false);
                    }}
                    className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer ml-auto"
                    title="その他の操作 (アプリを指定して開く等)"
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onDeleteAttachment(att.id)}
                    className="text-[11px] text-rose-500 hover:text-rose-700 p-0.5 rounded cursor-pointer"
                    title="削除"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 右クリック / 三点リーダー コンテキストメニュー */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 w-52 bg-white border border-slate-200 rounded-xl shadow-xl py-1 text-xs text-slate-700 animate-in fade-in zoom-in-95 duration-100"
        >
          {/* 開く */}
          <button
            type="button"
            onClick={() => {
              const att = contextMenu.att;
              setContextMenu(null);
              void onOpenAttachment(att.id);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2 cursor-pointer font-medium text-slate-800"
          >
            <ExternalLink className="w-3.5 h-3.5 text-indigo-500" />
            <span>開く (編集)</span>
          </button>

          {/* アプリを指定して開く (サブメニュー展開) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowOpenWithSubmenu(!showOpenWithSubmenu)}
              className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FolderOpen className="w-3.5 h-3.5 text-slate-500" />
                <span>アプリを指定して開く</span>
              </div>
              <ChevronDown
                className={`w-3 h-3 text-slate-400 transition-transform ${showOpenWithSubmenu ? 'rotate-180' : ''}`}
              />
            </button>

            {showOpenWithSubmenu && (
              <div className="bg-slate-50/80 border-y border-slate-100 py-1 pl-4 pr-2 space-y-0.5">
                {/* OS既定 */}
                <button
                  type="button"
                  onClick={() => void handleOpenWith(contextMenu.att, 'default')}
                  className="w-full text-left px-2 py-1 rounded hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-between cursor-pointer"
                >
                  <span>OSの既定アプリ</span>
                  {!preferredEditor && <Check className="w-3 h-3 text-indigo-600" />}
                </button>

                {/* メモ帳 */}
                <button
                  type="button"
                  onClick={() => void handleOpenWith(contextMenu.att, 'notepad')}
                  className="w-full text-left px-2 py-1 rounded hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-between cursor-pointer"
                >
                  <span>メモ帳 (Notepad)</span>
                  {preferredEditor === 'notepad' && <Check className="w-3 h-3 text-indigo-600" />}
                </button>

                {/* VSCode */}
                <button
                  type="button"
                  onClick={() => void handleOpenWith(contextMenu.att, 'vscode')}
                  className="w-full text-left px-2 py-1 rounded hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-between cursor-pointer"
                >
                  <span>VSCode</span>
                  {preferredEditor === 'vscode' && <Check className="w-3 h-3 text-indigo-600" />}
                </button>

                {/* 現在設定されているカスタムEXE */}
                {isCustomEditor && (
                  <button
                    type="button"
                    onClick={() => void handleOpenWith(contextMenu.att, preferredEditor!)}
                    className="w-full text-left px-2 py-1 rounded hover:bg-indigo-50 hover:text-indigo-600 flex items-center justify-between cursor-pointer truncate"
                    title={preferredEditor!}
                  >
                    <span className="truncate">{getCustomExeBasename(preferredEditor!)}</span>
                    <Check className="w-3 h-3 text-indigo-600 shrink-0" />
                  </button>
                )}

                {/* 別のアプリを選択 (.exe) */}
                <button
                  type="button"
                  onClick={() => void handlePickCustomExe(contextMenu.att)}
                  className="w-full text-left px-2 py-1 rounded hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-1 cursor-pointer text-indigo-600 font-medium"
                >
                  <span>別のアプリを選択 (.exe)...</span>
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 my-1" />

          {/* 名前の変更 */}
          <button
            type="button"
            onClick={() => handleStartRename(contextMenu.att)}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
          >
            <Pencil className="w-3.5 h-3.5 text-slate-500" />
            <span>名前を変更</span>
          </button>

          {/* PCに保存 */}
          <button
            type="button"
            onClick={() => {
              const att = contextMenu.att;
              setContextMenu(null);
              void downloadAttachmentFile(att.id, att.filename);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>PCに保存</span>
          </button>

          {/* 削除 */}
          <button
            type="button"
            onClick={() => {
              const att = contextMenu.att;
              setContextMenu(null);
              onDeleteAttachment(att.id);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-rose-50 text-rose-600 flex items-center gap-2 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-500" />
            <span>削除</span>
          </button>
        </div>
      )}
    </div>
  );
};
