import os
import sys
import secrets
import json
from pathlib import Path
from typing import Optional

APP_NAME = "LocalBan"
APP_VERSION = "1.0.1"

def get_app_dir() -> Path:
    """データディレクトリを取得し、必要フォルダを生成する。
    環境変数 LOCALBAN_DATA_DIR が設定されていればそれを最優先とする（テスト・環境分離用）。
    """
    custom_dir = os.environ.get("LOCALBAN_DATA_DIR")
    if custom_dir:
        base_dir = Path(custom_dir)
    else:
        app_data = os.environ.get("APPDATA")
        if app_data:
            base_dir = Path(app_data) / APP_NAME
        else:
            base_dir = Path.home() / f".{APP_NAME.lower()}"
    
    # 必須サブディレクトリを生成
    (base_dir / "attachments").mkdir(parents=True, exist_ok=True)
    (base_dir / "logs").mkdir(parents=True, exist_ok=True)
    (base_dir / "backups").mkdir(parents=True, exist_ok=True)
    
    return base_dir


def get_attachments_dir() -> Path:
    return get_app_dir() / "attachments"

def get_logs_dir() -> Path:
    return get_app_dir() / "logs"

def get_backups_dir() -> Path:
    return get_app_dir() / "backups"

def get_db_path() -> Path:
    return get_app_dir() / "localban.db"

def resource_path(relative_path: str) -> Path:
    """PyInstaller の _MEIPASS または通常開発時のルートからのリソース絶対パスを解決"""
    if hasattr(sys, "_MEIPASS"):
        return Path(sys._MEIPASS) / relative_path
    return Path(__file__).resolve().parent.parent / relative_path

def init_logging_redirect() -> None:
    """--noconsole 実行時の sys.stdout/sys.stderr None クラッシュ対策"""
    logs_dir = get_logs_dir()
    log_file = logs_dir / "app.log"
    
    class SafeWriter:
        def __init__(self, filepath: Path):
            self.filepath = filepath

        def write(self, message: str):
            if not message:
                return
            try:
                with open(self.filepath, "a", encoding="utf-8") as f:
                    f.write(message)
            except Exception:
                pass

        def flush(self):
            pass

    if sys.stdout is None or getattr(sys, "frozen", False):
        writer = SafeWriter(log_file)
        sys.stdout = writer
        sys.stderr = writer

# サーバー起動ごとのランダムセッショントークン
SESSION_TOKEN = secrets.token_hex(16)

def get_server_info_file() -> Path:
    return get_app_dir() / "server.json"

def get_lock_file() -> Path:
    return get_app_dir() / "run.lock"

# モジュールレベル互換用定義
SERVER_INFO_FILE = get_server_info_file()
LOCK_FILE = get_lock_file()

def save_server_info(port: int, token: str) -> None:
    target_file = get_server_info_file()
    with open(target_file, "w", encoding="utf-8") as f:
        json.dump({"port": port, "token": token, "pid": os.getpid()}, f, indent=2)

def load_server_info() -> Optional[dict]:
    target_file = get_server_info_file()
    if target_file.exists():
        try:
            with open(target_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None
    return None

def cleanup_server_info() -> None:
    try:
        s_file = get_server_info_file()
        l_file = get_lock_file()
        if s_file.exists():
            s_file.unlink()
        if l_file.exists():
            l_file.unlink()
    except Exception:
        pass
