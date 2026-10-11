import pytest
import os
import shutil
from pathlib import Path
from fastapi.testclient import TestClient
from backend.app import create_app
from backend.config import SESSION_TOKEN, get_attachments_dir

@pytest.fixture(scope="module")
def client():
    app = create_app()
    with TestClient(app) as test_client:
        yield test_client

@pytest.fixture
def auth_headers():
    return {"X-LocalBan-Token": SESSION_TOKEN}

# 1. セキュリティテスト
def test_security_token_required(client):
    # トークンなしのリクエストは 403
    res = client.get("/api/lists")
    assert res.status_code == 403
    assert res.json()["detail"] == "Invalid or missing session token"

def test_security_valid_token(client, auth_headers):
    # 正しいトークン付きリクエストは 200
    res = client.get("/api/lists", headers=auth_headers)
    assert res.status_code == 200
    assert isinstance(res.json(), list)

def test_security_host_validation(client, auth_headers):
    # 不正な Host ヘッダーは 403
    res = client.get("/api/lists", headers={**auth_headers, "Host": "evil-website.com"})
    assert res.status_code == 403

def test_security_origin_validation(client, auth_headers):
    # 不正な Origin ヘッダーは 403
    res = client.post("/api/lists", json={"title": "Hack"}, headers={**auth_headers, "Origin": "http://evil-website.com"})
    assert res.status_code == 403

# 2. リストCRUD & リスト削除時自動アーカイブ【対応必須 4】
def test_list_crud_and_auto_archive(client, auth_headers):
    # リスト作成
    res = client.post("/api/lists", json={"title": "テスト用リスト"}, headers=auth_headers)
    assert res.status_code == 201
    list_data = res.json()
    list_id = list_data["id"]

    # カード作成
    res_card = client.post("/api/cards", json={"list_id": list_id, "title": "保護対象カード"}, headers=auth_headers)
    assert res_card.status_code == 201
    card_id = res_card.json()["id"]

    # リストを削除
    res_del = client.delete(f"/api/lists/{list_id}", headers=auth_headers)
    assert res_del.status_code == 200

    # リストが削除されたことを確認
    res_lists = client.get("/api/lists", headers=auth_headers)
    assert not any(l["id"] == list_id for l in res_lists.json())

    # カードは物理削除されず、アーカイブ状態になっていることを確認
    res_card_get = client.get(f"/api/cards/{card_id}", headers=auth_headers)
    assert res_card_get.status_code == 200
    card_detail = res_card_get.json()
    assert card_detail["is_archived"] is True
    assert card_detail["list_id"] is None
    assert card_detail["original_list_title"] == "テスト用リスト"

# 3. カード複製【項目9】
def test_card_copy_with_attachment_and_checklist(client, auth_headers):
    # 復帰用リスト作成
    res_list = client.post("/api/lists", json={"title": "複製テストリスト"}, headers=auth_headers)
    list_id = res_list.json()["id"]

    # カード作成
    res_card = client.post("/api/cards", json={"list_id": list_id, "title": "元カード", "description": "コピー元詳細"}, headers=auth_headers)
    card_id = res_card.json()["id"]

    # チェックリスト追加
    res_cl = client.post(f"/api/cards/{card_id}/checklists", json={"title": "TODO"}, headers=auth_headers)
    cl_id = res_cl.json()["id"]
    client.post(f"/api/cards/checklists/{cl_id}/items", json={"content": "アイテム1"}, headers=auth_headers)

    # 添付ファイル追加 (ダミー画像)
    file_content = b"fake image content"
    files = {"file": ("test.png", file_content, "image/png")}
    res_att = client.post(f"/api/attachments/card/{card_id}", files=files, headers=auth_headers)
    assert res_att.status_code == 201

    # カード複製実行
    res_copy = client.post(f"/api/cards/{card_id}/copy", json={}, headers=auth_headers)
    assert res_copy.status_code == 200
    copied_card = res_copy.json()

    assert copied_card["title"] == "元カード のコピー"
    assert copied_card["description"] == "コピー元詳細"
    assert len(copied_card["checklists"]) == 1
    assert copied_card["checklists"][0]["items"][0]["content"] == "アイテム1"
    assert len(copied_card["attachments"]) == 1
    assert copied_card["attachments"][0]["filename"] == "test.png"
    # 実体ファイルが新UUID名で作成されていること
    assert copied_card["attachments"][0]["stored_filename"] != res_att.json()["stored_filename"]

# 4. 2段階完全削除の整合性【対応必須 7】
def test_permanent_delete_cleans_db_and_disk(client, auth_headers):
    res_list = client.post("/api/lists", json={"title": "削除テストリスト"}, headers=auth_headers)
    list_id = res_list.json()["id"]

    res_card = client.post("/api/cards", json={"list_id": list_id, "title": "完全削除カード"}, headers=auth_headers)
    card_id = res_card.json()["id"]

    # 添付ファイル追加
    file_content = b"content to delete"
    files = {"file": ("deleteme.txt", file_content, "text/plain")}
    res_att = client.post(f"/api/attachments/card/{card_id}", files=files, headers=auth_headers)
    stored_filename = res_att.json()["stored_filename"]
    file_path = get_attachments_dir() / stored_filename
    assert file_path.exists()

    # 未アーカイブのカードは完全削除できない（400エラー）
    res_bad_del = client.delete(f"/api/cards/{card_id}/permanent", headers=auth_headers)
    assert res_bad_del.status_code == 400

    # まずアーカイブする
    client.post(f"/api/cards/{card_id}/archive", headers=auth_headers)

    # アーカイブ後、完全削除を実行
    res_perm_del = client.delete(f"/api/cards/{card_id}/permanent", headers=auth_headers)
    assert res_perm_del.status_code == 200

    # DBから消去されていること
    assert client.get(f"/api/cards/{card_id}", headers=auth_headers).status_code == 404
    # ディスク上のファイルも消去されていること
    assert not file_path.exists()

# 5. Fractional Indexing リバランス【項目11】
def test_fractional_indexing_rebalance(client, auth_headers):
    res_list = client.post("/api/lists", json={"title": "リバランステスト"}, headers=auth_headers)
    list_id = res_list.json()["id"]

    # カード2枚作成
    c1 = client.post("/api/cards", json={"list_id": list_id, "title": "C1", "position": 1000.0}, headers=auth_headers).json()
    c2 = client.post("/api/cards", json={"list_id": list_id, "title": "C2", "position": 1000.00001}, headers=auth_headers).json()

    # 移動APIを実行してリバランスをトリガー（間隔が 0.00001 < 0.0001）
    res_move = client.post(f"/api/cards/{c2['id']}/move", json={"list_id": list_id, "position": 1000.00002}, headers=auth_headers)
    assert res_move.status_code == 200

    # リバランス後、position が 1000刻み（1000, 2000...）に振り直されていることを確認
    cards = client.get(f"/api/cards", headers=auth_headers).json()
    filtered = sorted([c for c in cards if c["list_id"] == list_id], key=lambda x: x["position"])
    assert len(filtered) == 2
    assert filtered[0]["position"] == 1000.0
    assert filtered[1]["position"] == 2000.0

# 6. カードの期限解除およびカバー解除の検証
def test_card_due_date_and_cover_clear(client, auth_headers):
    res_list = client.post("/api/lists", json={"title": "期限テストリスト"}, headers=auth_headers)
    list_id = res_list.json()["id"]

    res_card = client.post("/api/cards", json={"list_id": list_id, "title": "期限テストカード"}, headers=auth_headers)
    card_id = res_card.json()["id"]

    # 1. 期限を設定
    due_iso = "2026-10-15T18:00:00.000Z"
    res_set_due = client.put(f"/api/cards/{card_id}", json={"due_date": due_iso, "is_due_complete": True}, headers=auth_headers)
    assert res_set_due.status_code == 200
    assert res_set_due.json()["due_date"] == due_iso
    assert res_set_due.json()["is_due_complete"] is True

    # 2. 期限を解除（null送信）
    res_clear_due = client.put(f"/api/cards/{card_id}", json={"due_date": None, "is_due_complete": False}, headers=auth_headers)
    assert res_clear_due.status_code == 200
    assert res_clear_due.json()["due_date"] is None
    assert res_clear_due.json()["is_due_complete"] is False

    # DB再取得でも解除されていることを確認
    res_get = client.get(f"/api/cards/{card_id}", headers=auth_headers)
    assert res_get.json()["due_date"] is None
    assert res_get.json()["is_due_complete"] is False

    # 3. 添付ファイルを追加してカバー設定および解除を検証
    file_content = b"fake image content"
    files = {"file": ("cover_test.png", file_content, "image/png")}
    res_att = client.post(f"/api/attachments/card/{card_id}", files=files, headers=auth_headers)
    att_id = res_att.json()["id"]

    # カバーに設定
    res_set_cover = client.put(f"/api/cards/{card_id}", json={"cover_attachment_id": att_id}, headers=auth_headers)
    assert res_set_cover.json()["cover_attachment_id"] == att_id

    # カバーを解除（null送信）
    res_clear_cover = client.put(f"/api/cards/{card_id}", json={"cover_attachment_id": None}, headers=auth_headers)
    assert res_clear_cover.status_code == 200
    assert res_clear_cover.json()["cover_attachment_id"] is None

    # DB再取得でもカバーがNoneであることを確認
    res_get_cover = client.get(f"/api/cards/{card_id}", headers=auth_headers)
    assert res_get_cover.json()["cover_attachment_id"] is None

