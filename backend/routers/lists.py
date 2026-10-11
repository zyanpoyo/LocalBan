import uuid
import datetime
from fastapi import APIRouter, HTTPException, status
from typing import List
from backend.database import get_db
from backend.models import ListCreate, ListUpdate, ListResponse

router = APIRouter(prefix="/api/lists", tags=["lists"])

def row_to_list(row) -> ListResponse:
    return ListResponse(
        id=row["id"],
        title=row["title"],
        position=float(row["position"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"]
    )

@router.get("", response_model=List[ListResponse])
def get_lists():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM lists ORDER BY position ASC, created_at ASC;")
        return [row_to_list(r) for r in cursor.fetchall()]

@router.post("", response_model=ListResponse, status_code=status.HTTP_201_CREATED)
def create_list(payload: ListCreate):
    with get_db() as conn:
        cursor = conn.cursor()
        
        # position が指定されていない場合は末尾に配置
        if payload.position is None:
            cursor.execute("SELECT MAX(position) as max_pos FROM lists;")
            row = cursor.fetchone()
            pos = (row["max_pos"] or 0.0) + 1000.0
        else:
            pos = payload.position
            
        list_id = str(uuid.uuid4())
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        
        cursor.execute(
            "INSERT INTO lists (id, title, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?);",
            (list_id, payload.title.strip(), pos, now, now)
        )
        
        cursor.execute("SELECT * FROM lists WHERE id = ?;", (list_id,))
        return row_to_list(cursor.fetchone())

@router.put("/{list_id}", response_model=ListResponse)
def update_list(list_id: str, payload: ListUpdate):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM lists WHERE id = ?;", (list_id,))
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="List not found")
            
        new_title = payload.title.strip() if payload.title is not None else existing["title"]
        new_pos = payload.position if payload.position is not None else existing["position"]
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        
        cursor.execute(
            "UPDATE lists SET title = ?, position = ?, updated_at = ? WHERE id = ?;",
            (new_title, new_pos, now, list_id)
        )
        
        cursor.execute("SELECT * FROM lists WHERE id = ?;", (list_id,))
        return row_to_list(cursor.fetchone())

@router.delete("/{list_id}")
def delete_list(list_id: str):
    """
    【対応必須 4】リスト削除時は所属カードを物理削除せず、
    すべて自動的にアーカイブ（is_archived = 1, list_id = NULL, original_list_title 保持）にしてからリストを削除
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM lists WHERE id = ?;", (list_id,))
        target_list = cursor.fetchone()
        if not target_list:
            raise HTTPException(status_code=404, detail="List not found")
            
        list_title = target_list["title"]
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        
        # 所属カードを自動アーカイブ
        cursor.execute(
            """
            UPDATE cards 
            SET is_archived = 1, 
                list_id = NULL, 
                original_list_title = ?, 
                updated_at = ?
            WHERE list_id = ?;
            """,
            (list_title, now, list_id)
        )
        
        # リストを削除
        cursor.execute("DELETE FROM lists WHERE id = ?;", (list_id,))
        
    return {"message": "List deleted successfully and cards archived", "id": list_id}
