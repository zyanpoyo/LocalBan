import uuid
from fastapi import APIRouter, HTTPException, status
from typing import List
from backend.database import get_db
from backend.models import LabelCreate, LabelUpdate, LabelResponse

router = APIRouter(prefix="/api/labels", tags=["labels"])

@router.get("", response_model=List[LabelResponse])
def get_labels():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM labels ORDER BY name ASC;")
        return [LabelResponse(id=r["id"], name=r["name"], color=r["color"]) for r in cursor.fetchall()]

@router.post("", response_model=LabelResponse, status_code=status.HTTP_201_CREATED)
def create_label(payload: LabelCreate):
    with get_db() as conn:
        cursor = conn.cursor()
        label_id = str(uuid.uuid4())
        cursor.execute(
            "INSERT INTO labels (id, name, color) VALUES (?, ?, ?);",
            (label_id, payload.name.strip(), payload.color.strip())
        )
        return LabelResponse(id=label_id, name=payload.name.strip(), color=payload.color.strip())

@router.put("/{label_id}", response_model=LabelResponse)
def update_label(label_id: str, payload: LabelUpdate):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM labels WHERE id = ?;", (label_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Label not found")
            
        new_name = payload.name.strip() if payload.name is not None else row["name"]
        new_color = payload.color.strip() if payload.color is not None else row["color"]
        cursor.execute(
            "UPDATE labels SET name = ?, color = ? WHERE id = ?;",
            (new_name, new_color, label_id)
        )
        return LabelResponse(id=label_id, name=new_name, color=new_color)

@router.delete("/{label_id}")
def delete_label(label_id: str):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM labels WHERE id = ?;", (label_id,))
    return {"message": "Label deleted", "id": label_id}
