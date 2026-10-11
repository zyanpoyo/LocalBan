import uuid
import datetime
import shutil
from pathlib import Path
from fastapi import APIRouter, HTTPException, status
from typing import List, Optional
from backend.database import get_db
from backend.config import get_attachments_dir
from backend.security import safe_resolve_attachment_path
from backend.models import (
    CardCreate, CardUpdate, CardMove, CardCopy, CardResponse,
    LabelResponse, ChecklistResponse, ChecklistItemResponse, AttachmentResponse,
    ChecklistCreate, ChecklistUpdate, ChecklistItemCreate, ChecklistItemUpdate,
    RestoreCardRequest, BoardStateResponse, ListResponse
)

router = APIRouter(prefix="/api/cards", tags=["cards"])

def build_card_response(conn, card_row) -> CardResponse:
    card_id = card_row["id"]
    cursor = conn.cursor()
    
    # 1. Labels
    cursor.execute("""
        SELECT l.id, l.name, l.color 
        FROM labels l
        JOIN card_labels cl ON l.id = cl.label_id
        WHERE cl.card_id = ?
        ORDER BY l.name ASC;
    """, (card_id,))
    labels = [LabelResponse(id=r["id"], name=r["name"], color=r["color"]) for r in cursor.fetchall()]
    
    # 2. Checklists & Items
    cursor.execute("""
        SELECT id, card_id, title, position 
        FROM checklists 
        WHERE card_id = ? 
        ORDER BY position ASC, id ASC;
    """, (card_id,))
    checklist_rows = cursor.fetchall()
    
    checklists = []
    for c_row in checklist_rows:
        cid = c_row["id"]
        cursor.execute("""
            SELECT id, checklist_id, content, is_completed, position 
            FROM checklist_items 
            WHERE checklist_id = ? 
            ORDER BY position ASC, id ASC;
        """, (cid,))
        items = [
            ChecklistItemResponse(
                id=i_row["id"],
                checklist_id=i_row["checklist_id"],
                content=i_row["content"],
                is_completed=bool(i_row["is_completed"]),
                position=float(i_row["position"])
            ) for i_row in cursor.fetchall()
        ]
        checklists.append(
            ChecklistResponse(
                id=c_row["id"],
                card_id=c_row["card_id"],
                title=c_row["title"],
                position=float(c_row["position"]),
                items=items
            )
        )
        
    # 3. Attachments
    cursor.execute("""
        SELECT id, card_id, filename, stored_filename, file_size, mime_type, created_at 
        FROM attachments 
        WHERE card_id = ? 
        ORDER BY created_at ASC;
    """, (card_id,))
    attachments = [
        AttachmentResponse(
            id=a_row["id"],
            card_id=a_row["card_id"],
            filename=a_row["filename"],
            stored_filename=a_row["stored_filename"],
            file_size=int(a_row["file_size"]),
            mime_type=a_row["mime_type"],
            created_at=a_row["created_at"]
        ) for a_row in cursor.fetchall()
    ]
    
    return CardResponse(
        id=card_row["id"],
        list_id=card_row["list_id"],
        original_list_title=card_row["original_list_title"],
        title=card_row["title"],
        description=card_row["description"],
        position=float(card_row["position"]),
        due_date=card_row["due_date"],
        is_due_complete=bool(card_row["is_due_complete"]),
        cover_attachment_id=card_row["cover_attachment_id"],
        is_archived=bool(card_row["is_archived"]),
        created_at=card_row["created_at"],
        updated_at=card_row["updated_at"],
        labels=labels,
        checklists=checklists,
        attachments=attachments
    )

def check_and_rebalance_cards(conn, list_id: str) -> None:
    """【項目11】カード位置の差分が極小（< 1e-4）になった場合、1000刻みで一括再付番"""
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, position FROM cards WHERE list_id = ? AND is_archived = 0 ORDER BY position ASC;",
        (list_id,)
    )
    rows = cursor.fetchall()
    if len(rows) < 2:
        return
        
    needs_rebalance = False
    for i in range(len(rows) - 1):
        diff = rows[i+1]["position"] - rows[i]["position"]
        if diff < 0.0001:
            needs_rebalance = True
            break
            
    if needs_rebalance:
        for idx, row in enumerate(rows):
            new_pos = (idx + 1) * 1000.0
            cursor.execute("UPDATE cards SET position = ? WHERE id = ?;", (new_pos, row["id"]))

# --- Card Endpoints ---

@router.get("", response_model=List[CardResponse])
def get_cards():
    """ボードに表示する未アーカイブのカード一覧"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM cards WHERE is_archived = 0 ORDER BY position ASC, created_at ASC;")
        return [build_card_response(conn, r) for r in cursor.fetchall()]

@router.post("", response_model=CardResponse, status_code=status.HTTP_201_CREATED)
def create_card(payload: CardCreate):
    with get_db() as conn:
        cursor = conn.cursor()
        # リストの存在確認
        cursor.execute("SELECT id FROM lists WHERE id = ?;", (payload.list_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=400, detail="Target list does not exist")
            
        if payload.position is None:
            cursor.execute("SELECT MAX(position) as max_pos FROM cards WHERE list_id = ? AND is_archived = 0;", (payload.list_id,))
            row = cursor.fetchone()
            pos = (row["max_pos"] or 0.0) + 1000.0
        else:
            pos = payload.position
            
        card_id = str(uuid.uuid4())
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        
        cursor.execute(
            """
            INSERT INTO cards (id, list_id, title, description, position, is_archived, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 0, ?, ?);
            """,
            (card_id, payload.list_id, payload.title.strip(), payload.description or "", pos, now, now)
        )
        
        cursor.execute("SELECT * FROM cards WHERE id = ?;", (card_id,))
        return build_card_response(conn, cursor.fetchone())

@router.get("/{card_id}", response_model=CardResponse)
def get_card(card_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM cards WHERE id = ?;", (card_id,))
        card_row = cursor.fetchone()
        if not card_row:
            raise HTTPException(status_code=404, detail="Card not found")
        return build_card_response(conn, card_row)

@router.put("/{card_id}", response_model=CardResponse)
def update_card(card_id: str, payload: CardUpdate):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM cards WHERE id = ?;", (card_id,))
        card_row = cursor.fetchone()
        if not card_row:
            raise HTTPException(status_code=404, detail="Card not found")
            
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        fields = payload.model_fields_set
        
        new_title = payload.title.strip() if "title" in fields and payload.title is not None else card_row["title"]
        new_desc = payload.description if "description" in fields and payload.description is not None else card_row["description"]
        new_due_date = payload.due_date if "due_date" in fields else card_row["due_date"]
        new_is_due_complete = int(payload.is_due_complete) if "is_due_complete" in fields and payload.is_due_complete is not None else card_row["is_due_complete"]
        new_cover = payload.cover_attachment_id if "cover_attachment_id" in fields else card_row["cover_attachment_id"]
        
        cursor.execute(
            """
            UPDATE cards 
            SET title = ?, description = ?, due_date = ?, is_due_complete = ?, cover_attachment_id = ?, updated_at = ?
            WHERE id = ?;
            """,
            (new_title, new_desc, new_due_date, new_is_due_complete, new_cover, now, card_id)
        )
        
        # ラベルの更新 (渡されている場合)
        if payload.label_ids is not None:
            cursor.execute("DELETE FROM card_labels WHERE card_id = ?;", (card_id,))
            for lid in payload.label_ids:
                cursor.execute("INSERT OR IGNORE INTO card_labels (card_id, label_id) VALUES (?, ?);", (card_id, lid))
                
        cursor.execute("SELECT * FROM cards WHERE id = ?;", (card_id,))
        return build_card_response(conn, cursor.fetchone())

@router.post("/{card_id}/move", response_model=CardResponse)
def move_card(card_id: str, payload: CardMove):
    """カードを別リストや同一リスト内の新positionへ移動"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM cards WHERE id = ?;", (card_id,))
        card_row = cursor.fetchone()
        if not card_row:
            raise HTTPException(status_code=404, detail="Card not found")
            
        # 対象リストの存在確認
        cursor.execute("SELECT id FROM lists WHERE id = ?;", (payload.list_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=400, detail="Target list not found")
            
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        cursor.execute(
            "UPDATE cards SET list_id = ?, position = ?, updated_at = ? WHERE id = ?;",
            (payload.list_id, payload.position, now, card_id)
        )
        
        # リバランス判定
        check_and_rebalance_cards(conn, payload.list_id)
        
        cursor.execute("SELECT * FROM cards WHERE id = ?;", (card_id,))
        return build_card_response(conn, cursor.fetchone())

@router.post("/{card_id}/copy", response_model=CardResponse)
def copy_card(card_id: str, payload: CardCopy):
    """【項目9】カード複製（タイトル「のコピー」、説明・ラベル・チェックリスト・添付実体コピー）"""
    attachments_dir = get_attachments_dir()
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM cards WHERE id = ?;", (card_id,))
        src_card = cursor.fetchone()
        if not src_card:
            raise HTTPException(status_code=404, detail="Source card not found")
            
        target_list_id = payload.target_list_id or src_card["list_id"]
        # 対象リスト確認
        cursor.execute("SELECT id FROM lists WHERE id = ?;", (target_list_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=400, detail="Target list not found")
            
        # 配置位置: 元カード直下 (position + 10.0)
        target_pos = float(src_card["position"]) + 10.0
        new_card_id = str(uuid.uuid4())
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        copy_title = f"{src_card['title']} のコピー"
        
        cursor.execute(
            """
            INSERT INTO cards (id, list_id, title, description, position, due_date, is_due_complete, is_archived, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?);
            """,
            (new_card_id, target_list_id, copy_title, src_card["description"], target_pos, src_card["due_date"], src_card["is_due_complete"], now, now)
        )
        
        # 1. ラベルコピー
        cursor.execute("SELECT label_id FROM card_labels WHERE card_id = ?;", (card_id,))
        for (lid,) in cursor.fetchall():
            cursor.execute("INSERT INTO card_labels (card_id, label_id) VALUES (?, ?);", (new_card_id, lid))
            
        # 2. チェックリストコピー
        cursor.execute("SELECT id, title, position FROM checklists WHERE card_id = ?;", (card_id,))
        for c_row in cursor.fetchall():
            new_c_id = str(uuid.uuid4())
            cursor.execute(
                "INSERT INTO checklists (id, card_id, title, position) VALUES (?, ?, ?, ?);",
                (new_c_id, new_card_id, c_row["title"], c_row["position"])
            )
            cursor.execute("SELECT content, is_completed, position FROM checklist_items WHERE checklist_id = ?;", (c_row["id"],))
            for i_row in cursor.fetchall():
                cursor.execute(
                    "INSERT INTO checklist_items (id, checklist_id, content, is_completed, position) VALUES (?, ?, ?, ?, ?);",
                    (str(uuid.uuid4()), new_c_id, i_row["content"], i_row["is_completed"], i_row["position"])
                )
                
        # 3. 添付ファイルコピー（実体ファイルも複製）
        new_cover_id = None
        cursor.execute("SELECT id, filename, stored_filename, file_size, mime_type, created_at FROM attachments WHERE card_id = ?;", (card_id,))
        for a_row in cursor.fetchall():
            orig_stored = a_row["stored_filename"]
            orig_path = attachments_dir / orig_stored
            
            new_attach_id = str(uuid.uuid4())
            ext = Path(orig_stored).suffix
            new_stored = f"{uuid.uuid4().hex}{ext}"
            new_path = attachments_dir / new_stored
            
            if orig_path.exists():
                shutil.copy2(str(orig_path), str(new_path))
                
            cursor.execute(
                """
                INSERT INTO attachments (id, card_id, filename, stored_filename, file_size, mime_type, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?);
                """,
                (new_attach_id, new_card_id, a_row["filename"], new_stored, a_row["file_size"], a_row["mime_type"], now)
            )
            
            # 元のカバー画像だった場合は新しい添付をカバーに指定
            if src_card["cover_attachment_id"] == a_row["id"]:
                new_cover_id = new_attach_id
                
        if new_cover_id:
            cursor.execute("UPDATE cards SET cover_attachment_id = ? WHERE id = ?;", (new_cover_id, new_card_id))
            
        check_and_rebalance_cards(conn, target_list_id)
        cursor.execute("SELECT * FROM cards WHERE id = ?;", (new_card_id,))
        return build_card_response(conn, cursor.fetchone())

@router.post("/{card_id}/archive")
def archive_card(card_id: str):
    """カードをアーカイブ化（ボードから非表示）"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM cards WHERE id = ?;", (card_id,))
        card_row = cursor.fetchone()
        if not card_row:
            raise HTTPException(status_code=404, detail="Card not found")
            
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        cursor.execute("UPDATE cards SET is_archived = 1, updated_at = ? WHERE id = ?;", (now, card_id))
    return {"message": "Card archived successfully", "id": card_id}

# --- Checklist Endpoints ---

@router.post("/{card_id}/checklists", response_model=ChecklistResponse)
def create_checklist(card_id: str, payload: ChecklistCreate):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM cards WHERE id = ?;", (card_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Card not found")
            
        if payload.position is None:
            cursor.execute("SELECT MAX(position) as max_pos FROM checklists WHERE card_id = ?;", (card_id,))
            pos = (cursor.fetchone()["max_pos"] or 0.0) + 1000.0
        else:
            pos = payload.position
            
        cid = str(uuid.uuid4())
        cursor.execute(
            "INSERT INTO checklists (id, card_id, title, position) VALUES (?, ?, ?, ?);",
            (cid, card_id, payload.title.strip(), pos)
        )
        return ChecklistResponse(id=cid, card_id=card_id, title=payload.title.strip(), position=pos, items=[])

@router.put("/checklists/{checklist_id}", response_model=ChecklistResponse)
def update_checklist(checklist_id: str, payload: ChecklistUpdate):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM checklists WHERE id = ?;", (checklist_id,))
        c_row = cursor.fetchone()
        if not c_row:
            raise HTTPException(status_code=404, detail="Checklist not found")
            
        new_title = payload.title.strip() if payload.title is not None else c_row["title"]
        new_pos = payload.position if payload.position is not None else c_row["position"]
        cursor.execute(
            "UPDATE checklists SET title = ?, position = ? WHERE id = ?;",
            (new_title, new_pos, checklist_id)
        )
        cursor.execute("SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY position ASC;", (checklist_id,))
        items = [
            ChecklistItemResponse(
                id=r["id"], checklist_id=r["checklist_id"], content=r["content"],
                is_completed=bool(r["is_completed"]), position=float(r["position"])
            ) for r in cursor.fetchall()
        ]
        return ChecklistResponse(id=checklist_id, card_id=c_row["card_id"], title=new_title, position=new_pos, items=items)

@router.delete("/checklists/{checklist_id}")
def delete_checklist(checklist_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM checklists WHERE id = ?;", (checklist_id,))
    return {"message": "Checklist deleted", "id": checklist_id}

@router.post("/checklists/{checklist_id}/items", response_model=ChecklistItemResponse)
def create_checklist_item(checklist_id: str, payload: ChecklistItemCreate):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM checklists WHERE id = ?;", (checklist_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Checklist not found")
            
        if payload.position is None:
            cursor.execute("SELECT MAX(position) as max_pos FROM checklist_items WHERE checklist_id = ?;", (checklist_id,))
            pos = (cursor.fetchone()["max_pos"] or 0.0) + 1000.0
        else:
            pos = payload.position
            
        item_id = str(uuid.uuid4())
        cursor.execute(
            "INSERT INTO checklist_items (id, checklist_id, content, is_completed, position) VALUES (?, ?, ?, 0, ?);",
            (item_id, checklist_id, payload.content.strip(), pos)
        )
        return ChecklistItemResponse(
            id=item_id, checklist_id=checklist_id, content=payload.content.strip(),
            is_completed=False, position=pos
        )

@router.put("/checklist-items/{item_id}", response_model=ChecklistItemResponse)
def update_checklist_item(item_id: str, payload: ChecklistItemUpdate):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM checklist_items WHERE id = ?;", (item_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Checklist item not found")
            
        new_content = payload.content.strip() if payload.content is not None else row["content"]
        new_comp = int(payload.is_completed) if payload.is_completed is not None else row["is_completed"]
        new_pos = payload.position if payload.position is not None else row["position"]
        
        cursor.execute(
            "UPDATE checklist_items SET content = ?, is_completed = ?, position = ? WHERE id = ?;",
            (new_content, new_comp, new_pos, item_id)
        )
        return ChecklistItemResponse(
            id=item_id, checklist_id=row["checklist_id"], content=new_content,
            is_completed=bool(new_comp), position=float(new_pos)
        )

@router.delete("/checklist-items/{item_id}")
def delete_checklist_item(item_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM checklist_items WHERE id = ?;", (item_id,))
    return {"message": "Checklist item deleted", "id": item_id}

# --- Archive & Permanent Delete Endpoints ---

@router.get("/archived/list", response_model=List[CardResponse])
def get_archived_cards():
    """アーカイブ済みカード一覧"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM cards WHERE is_archived = 1 ORDER BY updated_at DESC;")
        return [build_card_response(conn, r) for r in cursor.fetchall()]

@router.post("/{card_id}/restore", response_model=CardResponse)
def restore_card(card_id: str, payload: RestoreCardRequest):
    """アーカイブカードの復元（元リストまたは指定リストへ復帰）"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM cards WHERE id = ?;", (card_id,))
        card_row = cursor.fetchone()
        if not card_row:
            raise HTTPException(status_code=404, detail="Card not found")
            
        target_list_id = payload.target_list_id
        if not target_list_id:
            # 元リストが存在するか確認
            if card_row["list_id"]:
                cursor.execute("SELECT id FROM lists WHERE id = ?;", (card_row["list_id"],))
                if cursor.fetchone():
                    target_list_id = card_row["list_id"]
                    
        # それでも無ければ先頭のリスト
        if not target_list_id:
            cursor.execute("SELECT id FROM lists ORDER BY position ASC LIMIT 1;")
            first_list = cursor.fetchone()
            if not first_list:
                raise HTTPException(status_code=400, detail="No list available to restore card")
            target_list_id = first_list["id"]
            
        cursor.execute("SELECT MAX(position) as max_pos FROM cards WHERE list_id = ? AND is_archived = 0;", (target_list_id,))
        pos = (cursor.fetchone()["max_pos"] or 0.0) + 1000.0
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        
        cursor.execute(
            "UPDATE cards SET is_archived = 0, list_id = ?, position = ?, updated_at = ? WHERE id = ?;",
            (target_list_id, pos, now, card_id)
        )
        cursor.execute("SELECT * FROM cards WHERE id = ?;", (card_id,))
        return build_card_response(conn, cursor.fetchone())

@router.delete("/{card_id}/permanent")
def permanently_delete_card(card_id: str):
    """
    【対応必須 7】2段階完全削除
    アーカイブ一覧から明示的に実行された場合のみ、DBコミット後に実体ファイルをディスクから物理削除
    """
    attachments_dir = get_attachments_dir()
    stored_filenames_to_delete = []
    
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, is_archived FROM cards WHERE id = ?;", (card_id,))
        card_row = cursor.fetchone()
        if not card_row:
            raise HTTPException(status_code=404, detail="Card not found")
        if not card_row["is_archived"]:
            raise HTTPException(status_code=400, detail="Cannot permanently delete unarchived card")
            
        # 削除する添付ファイルの実体ファイル名を取得
        cursor.execute("SELECT stored_filename FROM attachments WHERE card_id = ?;", (card_id,))
        stored_filenames_to_delete = [r["stored_filename"] for r in cursor.fetchall()]
        
        # DBからカードを完全削除 (外部キーカスケードにより card_labels, checklists, attachments も自動削除)
        cursor.execute("DELETE FROM cards WHERE id = ?;", (card_id,))
        
    # DBコミット成功後にファイル実体をディスクから安全に削除
    for stored_name in stored_filenames_to_delete:
        try:
            target_path = safe_resolve_attachment_path(stored_name)
            if target_path.exists():
                target_path.unlink()
        except Exception:
            pass
            
    return {"message": "Card permanently deleted", "id": card_id}

# --- Board State Endpoint ---

@router.get("/board/state", response_model=BoardStateResponse)
def get_board_state():
    """初回読み込みやタブ間同期用の全ボード状態一括取得"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM lists ORDER BY position ASC, created_at ASC;")
        lists = [
            ListResponse(
                id=r["id"], title=r["title"], position=float(r["position"]),
                created_at=r["created_at"], updated_at=r["updated_at"]
            ) for r in cursor.fetchall()
        ]
        
        cursor.execute("SELECT * FROM cards WHERE is_archived = 0 ORDER BY position ASC, created_at ASC;")
        cards = [build_card_response(conn, r) for r in cursor.fetchall()]
        
        cursor.execute("SELECT * FROM labels ORDER BY name ASC;")
        labels = [LabelResponse(id=r["id"], name=r["name"], color=r["color"]) for r in cursor.fetchall()]
        
        return BoardStateResponse(lists=lists, cards=cards, labels=labels)
