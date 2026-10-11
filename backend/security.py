import os
from pathlib import Path
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response, JSONResponse
from backend.config import SESSION_TOKEN, get_attachments_dir

MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50MB

def safe_resolve_attachment_path(stored_filename: str) -> Path:
    """パストラバーサルを遮断し、attachments配下の安全なファイルパスを返す"""
    attachments_dir = get_attachments_dir().resolve()
    # ファイル名のみを取り出し（サブディレクトリ指定を排除）
    base_name = Path(stored_filename).name
    target_path = (attachments_dir / base_name).resolve()
    
    if not target_path.is_relative_to(attachments_dir):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid file path"
        )
    return target_path

class SecurityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # 1. Host ヘッダー検証 (DNS Rebinding 対策)
        host = request.headers.get("host", "")
        hostname = host.split(":")[0].lower()
        if hostname not in ("127.0.0.1", "localhost", "testserver"):
            return JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={"detail": "Forbidden host"}
            )

        # 2. Origin ヘッダー検証 (CSRF 対策)
        origin = request.headers.get("origin")
        if origin:
            try:
                from urllib.parse import urlparse
                parsed_origin = urlparse(origin)
                origin_host = parsed_origin.hostname.lower() if parsed_origin.hostname else ""
                if origin_host not in ("127.0.0.1", "localhost", "testserver"):
                    return JSONResponse(
                        status_code=status.HTTP_403_FORBIDDEN,
                        content={"detail": "Forbidden origin"}
                    )
            except Exception:
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={"detail": "Invalid origin header"}
                )

        # 3. セッショントークン検証 (外部スクリプト遮断)
        if request.url.path.startswith("/api/"):
            req_token = request.headers.get("X-LocalBan-Token") or request.query_params.get("token")
            if req_token != SESSION_TOKEN:
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={"detail": "Invalid or missing session token"}
                )

        # 4. アップロードサイズ事前検証 (Content-Length ヘッダーが存在する場合)
        content_length = request.headers.get("content-length")
        if content_length:
            try:
                if int(content_length) > MAX_UPLOAD_SIZE:
                    return JSONResponse(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        content={"detail": f"File size exceeds limit of {MAX_UPLOAD_SIZE // (1024*1024)}MB"}
                    )
            except ValueError:
                pass

        response: Response = await call_next(request)
        
        # 5. セキュリティヘッダー付与
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        
        return response
