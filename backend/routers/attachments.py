import uuid
import datetime
from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File, status
from fastapi.responses import FileResponse
from backend.database import get_db
from backend.config import get_attachments_dir
from backend.security import safe_resolve_attachment_path, MAX_UPLOAD_SIZE
from backend.models import AttachmentResponse

router = APIRouter(prefix="/api/attachments", tags=["attachments"])

SAFE_INLINE_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
    "text/plain",
}

@router.post("/card/{card_id}", response_model=AttachmentResponse, status_code=status.HTTP_201_CREATED)
async def upload_attachment(card_id: str, file: UploadFile = File(...)):
    """【項目2, 14】50MB上限・UUIDファイル名保存・画像自動カバー設定"""
    attachments_dir = get_attachments_dir()
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, cover_attachment_id FROM cards WHERE id = ?;", (card_id,))
        card_row = cursor.fetchone()
        if not card_row:
            raise HTTPException(status_code=404, detail="Card not found")
            
    # 新規UUIDファイル名
    orig_filename = file.filename or "attachment"
    ext = Path(orig_filename).suffix
    stored_filename = f"{uuid.uuid4().hex}{ext}"
    target_path = safe_resolve_attachment_path(stored_filename)
    
    total_bytes = 0
    try:
        with open(target_path, "wb") as f:
            while chunk := await file.read(1024 * 64):  # 64KB chunks
                total_bytes += len(chunk)
                if total_bytes > MAX_UPLOAD_SIZE:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="File exceeds maximum size of 50MB"
                    )
                f.write(chunk)
    except Exception:
        if target_path.exists():
            target_path.unlink()
        raise
        
    attach_id = str(uuid.uuid4())
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    mime_type = file.content_type or "application/octet-stream"
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute(
            """
            INSERT INTO attachments (id, card_id, filename, stored_filename, file_size, mime_type, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?);
            """,
            (attach_id, card_id, orig_filename, stored_filename, total_bytes, mime_type, now)
        )
        
        # もしカードにカバー画像がまだ設定されておらず、かつ画像形式なら自動でカバーに設定
        if not card_row["cover_attachment_id"] and mime_type.startswith("image/") and mime_type != "image/svg+xml":
            cursor.execute("UPDATE cards SET cover_attachment_id = ? WHERE id = ?;", (attach_id, card_id))
            
    return AttachmentResponse(
        id=attach_id,
        card_id=card_id,
        filename=orig_filename,
        stored_filename=stored_filename,
        file_size=total_bytes,
        mime_type=mime_type,
        created_at=now
    )

@router.get("/{attachment_id}/download")
def download_attachment(attachment_id: str, inline: bool = False):
    """【項目2】パストラバーサル防止、SVG/HTML強制DL、nosniff配信"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM attachments WHERE id = ?;", (attachment_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Attachment not found")
            
    stored_filename = row["stored_filename"]
    orig_filename = row["filename"]
    mime_type = row["mime_type"] or "application/octet-stream"
    
    target_path = safe_resolve_attachment_path(stored_filename)
    if not target_path.exists():
        raise HTTPException(status_code=404, detail="File on disk not found")
        
    # セキュリティ: SVG や HTML 等はスクリプト実行リスクがあるためインライン不可（強制DL）
    can_inline = inline and (mime_type.lower() in SAFE_INLINE_MIME_TYPES)
    disposition_type = "inline" if can_inline else "attachment"
    
    # RFC 5987 / URLエンコードファイル名対応ヘッダー
    from urllib.parse import quote
    encoded_name = quote(orig_filename)
    headers = {
        "Content-Disposition": f'{disposition_type}; filename="{orig_filename}"; filename*=UTF-8\'\'{encoded_name}',
        "X-Content-Type-Options": "nosniff"
    }
    
    return FileResponse(
        path=str(target_path),
        media_type=mime_type if can_inline else "application/octet-stream",
        headers=headers
    )

@router.delete("/{attachment_id}")
def delete_attachment(attachment_id: str):
    """添付ファイル削除（DBコミット後に実体削除）"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM attachments WHERE id = ?;", (attachment_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Attachment not found")
            
        stored_filename = row["stored_filename"]
        card_id = row["card_id"]
        
        # カードのカバー画像だった場合はクリア
        cursor.execute("UPDATE cards SET cover_attachment_id = NULL WHERE cover_attachment_id = ?;", (attachment_id,))
        cursor.execute("DELETE FROM attachments WHERE id = ?;", (attachment_id,))
        
    # ディスクから削除
    try:
        target_path = safe_resolve_attachment_path(stored_filename)
        if target_path.exists():
            target_path.unlink()
    except Exception:
        pass
        
    return {"message": "Attachment deleted", "id": attachment_id}
