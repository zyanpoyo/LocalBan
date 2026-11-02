import React, { useRef } from 'react';
import { Paperclip, Upload, Download } from 'lucide-react';
import { Attachment } from '../../types';
import { getAttachmentDownloadUrl, downloadAttachmentFile } from '../../api';

interface CardAttachmentSectionProps {
  attachments: Attachment[];
  onFileUpload: (files: FileList | null) => void;
  onDeleteAttachment: (attachmentId: string) => void;
  onPreviewImage: (url: string) => void;
}

export const CardAttachmentSection: React.FC<CardAttachmentSectionProps> = ({
  attachments,
  onFileUpload,
  onDeleteAttachment,
  onPreviewImage,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-700 font-semibold text-sm">
          <Paperclip className="w-4 h-4 text-slate-500" />
          <span>添付ファイル ({attachments.length})</span>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          追加
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(e) => onFileUpload(e.target.files)}
          className="hidden"
        />
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

          return (
            <div
              key={att.id}
              className="border border-slate-200 rounded-xl p-2.5 flex items-center gap-3 bg-white shadow-2xs hover:border-slate-300 transition-all"
            >
              {/* サムネイル */}
              {isImage ? (
                <div
                  onClick={() => onPreviewImage(getAttachmentDownloadUrl(att.id, true))}
                  className="w-14 h-14 rounded-lg bg-slate-100 overflow-hidden shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                >
                  <img
                    src={getAttachmentDownloadUrl(att.id, true)}
                    alt={att.filename}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-slate-400">
                  <Paperclip className="w-6 h-6" />
                </div>
              )}

              {/* ファイル情報 & 操作 */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800 truncate" title={att.filename}>
                  {att.filename}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {(att.file_size / 1024).toFixed(1)} KB
                </p>
                <div className="flex items-center gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => downloadAttachmentFile(att.id, att.filename)}
                    className="text-[11px] text-indigo-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                    title="保存"
                  >
                    <Download className="w-3 h-3" />
                    DL
                  </button>
                  <button
                    onClick={() => onDeleteAttachment(att.id)}
                    className="text-[11px] text-rose-500 hover:text-rose-700 cursor-pointer ml-auto"
                  >
                    削除
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
