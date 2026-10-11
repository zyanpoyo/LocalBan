from pydantic import BaseModel, Field
from typing import List, Optional

# --- List Models ---
class ListCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=100)
    position: Optional[float] = None

class ListUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=100)
    position: Optional[float] = None

class ListResponse(BaseModel):
    id: str
    title: str
    position: float
    created_at: str
    updated_at: str

# --- Label Models ---
class LabelCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    color: str = Field(..., min_length=1, max_length=30)

class LabelUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    color: Optional[str] = Field(None, min_length=1, max_length=30)

class LabelResponse(BaseModel):
    id: str
    name: str
    color: str

# --- Checklist Models ---
class ChecklistItemCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=500)
    position: Optional[float] = None

class ChecklistItemUpdate(BaseModel):
    content: Optional[str] = Field(None, min_length=1, max_length=500)
    is_completed: Optional[bool] = None
    position: Optional[float] = None

class ChecklistItemResponse(BaseModel):
    id: str
    checklist_id: str
    content: str
    is_completed: bool
    position: float

class ChecklistCreate(BaseModel):
    title: str = Field(default="チェックリスト", min_length=1, max_length=100)
    position: Optional[float] = None

class ChecklistUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=100)
    position: Optional[float] = None

class ChecklistResponse(BaseModel):
    id: str
    card_id: str
    title: str
    position: float
    items: List[ChecklistItemResponse] = []

# --- Attachment Models ---
class AttachmentResponse(BaseModel):
    id: str
    card_id: str
    filename: str
    stored_filename: str
    file_size: int
    mime_type: Optional[str] = None
    created_at: str

# --- Card Models ---
class CardCreate(BaseModel):
    list_id: str
    title: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = ""
    position: Optional[float] = None

class CardUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    due_date: Optional[str] = None
    is_due_complete: Optional[bool] = None
    cover_attachment_id: Optional[str] = None
    label_ids: Optional[List[str]] = None

class CardMove(BaseModel):
    list_id: str
    position: float

class CardCopy(BaseModel):
    target_list_id: Optional[str] = None

class CardResponse(BaseModel):
    id: str
    list_id: Optional[str] = None
    original_list_title: Optional[str] = None
    title: str
    description: str
    position: float
    due_date: Optional[str] = None
    is_due_complete: bool
    cover_attachment_id: Optional[str] = None
    is_archived: bool
    created_at: str
    updated_at: str
    labels: List[LabelResponse] = []
    checklists: List[ChecklistResponse] = []
    attachments: List[AttachmentResponse] = []

# --- Archive Models ---
class RestoreCardRequest(BaseModel):
    target_list_id: Optional[str] = None

# --- Board State ---
class BoardStateResponse(BaseModel):
    lists: List[ListResponse]
    cards: List[CardResponse]
    labels: List[LabelResponse]
