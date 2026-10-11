import os
import signal
import threading
import time
from fastapi import APIRouter
from backend.config import SESSION_TOKEN

router = APIRouter(prefix="/api/system", tags=["system"])

# Uvicorn 停止用コールバック
shutdown_handler = None

def set_shutdown_handler(handler):
    global shutdown_handler
    shutdown_handler = handler

@router.get("/status")
def get_system_status():
    return {
        "status": "running",
        "app": "LocalBan",
        "version": "0.1.0"
    }

@router.get("/token")
def get_token_info():
    """フロントエンド初期化時にトークン検証・確認用"""
    return {"token": SESSION_TOKEN}

@router.post("/shutdown")
def shutdown():
    """【項目15】Web画面の電源ボタンから安全にシャットダウン"""
    def do_shutdown():
        time.sleep(0.5)
        if shutdown_handler:
            shutdown_handler()
        else:
            os.kill(os.getpid(), signal.SIGTERM)

    threading.Thread(target=do_shutdown, daemon=True).start()
    return {"message": "Server shutting down"}
