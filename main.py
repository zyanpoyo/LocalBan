import os
import sys
import time
import socket
import threading
import webbrowser
import urllib.request
from pathlib import Path
from PIL import Image

# 1. 最先頭で --noconsole ログリダイレクトを初期化 【対応必須 5】
from backend.config import (
    init_logging_redirect,
    load_server_info,
    save_server_info,
    cleanup_server_info,
    resource_path,
    SESSION_TOKEN,
)
init_logging_redirect()

import uvicorn
import pystray
from backend.app import app
from backend.routers.system import set_shutdown_handler

import urllib.error

def close_splash():
    """PyInstallerの起動スプラッシュ画面を閉じる"""
    try:
        import pyi_splash
        if pyi_splash.is_alive():
            pyi_splash.close()
    except Exception:
        pass

def is_server_alive(port: int, token: str = None) -> bool:
    """既存のLocalBanサーバーが応答するかチェック"""
    url = f"http://127.0.0.1:{port}/api/system/status"
    if token:
        url += f"?token={token}"
    try:
        req = urllib.request.Request(url, headers={"Host": "127.0.0.1"})
        with urllib.request.urlopen(req, timeout=1.0) as res:
            return res.status == 200
    except urllib.error.HTTPError as e:
        # トークン不一致や未指定でも403が返ればサーバー自体は稼働中
        return e.code in (200, 403)
    except Exception:
        return False

def find_available_port(start_port: int = 8000, max_tries: int = 100) -> int:
    """空きポートを探索"""
    for port in range(start_port, start_port + max_tries):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
    return start_port

def get_tray_icon_image() -> Image.Image:
    """トレイ用アイコン画像を取得（無ければ動的生成）"""
    icon_path = resource_path("assets/icon.png")
    if icon_path.exists():
        try:
            return Image.open(str(icon_path))
        except Exception:
            pass
            
    # フォールバック動的生成
    img = Image.new("RGBA", (64, 64), (79, 70, 229, 255))
    return img

def main():
    # 2. 二重起動防止チェック 【対応必須 6】
    existing_info = load_server_info()
    if existing_info:
        port = existing_info.get("port")
        token = existing_info.get("token")
        if port and is_server_alive(port, token):
            # 既存サーバーが稼働中のためブラウザを開いて新プロセスは即座に終了
            webbrowser.open(f"http://127.0.0.1:{port}/?token={token}")
            close_splash()
            sys.exit(0)
        else:
            # 古い情報をクリーンアップ
            cleanup_server_info()

    # 3. ポート決定
    port = find_available_port(8000)
    save_server_info(port, SESSION_TOKEN)

    # 4. Uvicorn サーバー設定
    config = uvicorn.Config(
        app=app,
        host="127.0.0.1",  # 【対応必須 1】127.0.0.1 にのみバインド
        port=port,
        log_config=None,    # 【対応必須 5】--noconsole 時の標準出力エラー回避
        access_log=False,
    )
    server = uvicorn.Server(config)

    # サーバーをバックグラウンドスレッドで起動 【項目15】
    server_thread = threading.Thread(target=server.run, daemon=True)
    server_thread.start()

    # 5. サーバー待機とブラウザ自動起動
    app_url = f"http://127.0.0.1:{port}/?token={SESSION_TOKEN}"
    def wait_and_open_browser():
        start_t = time.time()
        while time.time() - start_t < 5.0:
            if is_server_alive(port, SESSION_TOKEN):
                break
            time.sleep(0.05)
        webbrowser.open(app_url)
        # ブラウザに切り替わるまで表示を残し、スムーズに閉じる
        time.sleep(0.5)
        close_splash()

    threading.Thread(target=wait_and_open_browser, daemon=True).start()

    # 6. トレイ常駐 (pystray) の設定とメインスレッド実行
    tray_icon = None

    def on_open_clicked(icon, item):
        webbrowser.open(app_url)

    def on_exit_clicked(icon=None, item=None):
        cleanup_server_info()
        server.should_exit = True
        if tray_icon:
            tray_icon.stop()

    # Web UI からのシャットダウン呼び出しを連携 【項目15】
    set_shutdown_handler(on_exit_clicked)

    tray_menu = pystray.Menu(
        pystray.MenuItem("LocalBan を開く", on_open_clicked, default=True),
        pystray.MenuItem("終了", on_exit_clicked),
    )

    tray_icon = pystray.Icon(
        "LocalBan",
        get_tray_icon_image(),
        "LocalBan - オフラインカンバンボード",
        tray_menu
    )

    try:
        tray_icon.run()
    except KeyboardInterrupt:
        on_exit_clicked()
    finally:
        close_splash()
        cleanup_server_info()
        sys.exit(0)

if __name__ == "__main__":
    main()
