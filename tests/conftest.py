import os
import shutil
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from backend.app import create_app
from backend.config import SESSION_TOKEN

@pytest.fixture(autouse=True)
def isolated_data_dir(tmp_path, monkeypatch):
    """
    各テストごとに完全に独立した一時データディレクトリを作成し、
    LOCALBAN_DATA_DIR 環境変数に設定する。
    テスト完了後は teardown で一時ディレクトリ内のデータ（DB・添付ファイル等）を確実に破棄する。
    これにより本番環境（%APPDATA%/LocalBan）へのデータ投入・汚染を100%防止する。
    """
    test_dir = tmp_path / "localban_test_env"
    test_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setenv("LOCALBAN_DATA_DIR", str(test_dir))

    yield test_dir

    # テスト終了時のクリーンアップ
    if test_dir.exists():
        try:
            shutil.rmtree(str(test_dir), ignore_errors=True)
        except Exception:
            pass

@pytest.fixture
def client(isolated_data_dir):
    """
    隔離された一時環境で初期化された FastAPI テストクライアント。
    """
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture
def auth_headers():
    return {"X-LocalBan-Token": SESSION_TOKEN}
