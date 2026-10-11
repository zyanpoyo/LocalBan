import os
import sys
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from backend.config import resource_path, SESSION_TOKEN, APP_VERSION
from backend.security import SecurityMiddleware
from backend.database import init_database
from backend.routers import lists, cards, attachments, labels, system

def create_app() -> FastAPI:
    # データベース初期化
    init_database()
    
    is_frozen = getattr(sys, "frozen", False)
    # 本番バイナリ実行時は OpenAPI ドキュメントを非公開化【項目14】
    docs_url = None if is_frozen else "/docs"
    redoc_url = None if is_frozen else "/redoc"
    openapi_url = None if is_frozen else "/openapi.json"
    
    app = FastAPI(
        title="LocalBan API",
        version=APP_VERSION,
        docs_url=docs_url,
        redoc_url=redoc_url,
        openapi_url=openapi_url
    )
    
    # セキュリティミドルウェア
    app.add_middleware(SecurityMiddleware)
    
    # ルーター登録
    app.include_router(lists.router)
    app.include_router(cards.router)
    app.include_router(attachments.router)
    app.include_router(labels.router)
    app.include_router(system.router)
    
    # フロントエンド静的配信 (distが存在する場合)
    dist_dir = resource_path("frontend/dist")
    if dist_dir.exists() and dist_dir.is_dir():
        # 静的アセット (assets/)
        assets_dir = dist_dir / "assets"
        if assets_dir.exists():
            app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")
            
        @app.get("/{full_path:path}")
        async def serve_spa(request: Request, full_path: str):
            # APIルート以外はSPAのindex.htmlを返す
            if full_path.startswith("api/"):
                return None
            target_file = dist_dir / full_path
            if target_file.is_file():
                return FileResponse(str(target_file))
            return FileResponse(str(dist_dir / "index.html"))
    else:
        @app.get("/")
        async def dev_root():
            return HTMLResponse(
                f"""
                <html>
                <head><title>LocalBan Backend</title></head>
                <body style="font-family: sans-serif; padding: 2rem;">
                    <h2>LocalBan Backend is Running</h2>
                    <p>API endpoints are active.</p>
                    <p>Session Token: <code>{SESSION_TOKEN}</code></p>
                </body>
                </html>
                """
            )

    return app

app = create_app()
