from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, List, Dict
from fastapi import UploadFile
from app.schemas.category_schema import CategoryResponse
from app.schemas.status_schema import StatusResponse
from app.schemas.issue_type_schema import DispositionResponse, IssueTypeResponse

class UserBasicInfo(BaseModel):
    id: int
    name: str
    email: str
    batch_info: Optional[Dict] = None  # Includes batch_id, batch_name, program_id, program_name, university_id, university_name

    class Config:
        from_attributes = True

class TicketBase(BaseModel):
    title: str
    description: str
    attachments: Optional[List[str]] = None  # List of S3 URLs

class TicketCreate(TicketBase):
    category_id: int
    status_id: int = Field(default=1)
    email_message_id: Optional[str] = None  # Add field for email message ID
    
    class Config:
        from_attributes = True

class TicketResponse(TicketBase):
    id: int
    created_by: UserBasicInfo
    assigned_to: Optional[UserBasicInfo] = None
    category_agents: Optional[List[UserBasicInfo]] = []  # All agents assigned to the category
    created_at: datetime
    updated_at: datetime
    category: CategoryResponse
    status: Optional[StatusResponse] = None
    issue_type: Optional[IssueTypeResponse] = None
    disposition: Optional[DispositionResponse] = None
    is_delayed: bool
    priority: Optional[str] = None  # Priority: 'high', 'medium', 'low' (internal use only)
    
    class Config:
        from_attributes = True
        
class TicketCreateResponse(BaseModel):
    id: int
    
    class Config:
        from_attributes = True

class TicketStatusUpdate(BaseModel):
    status_id: int
    closing_reason: Optional[str] = None
    
    class Config:
        from_attributes = True

class TicketPriorityUpdate(BaseModel):
    priority: str  # 'high', 'medium', or 'low'
    
    class Config:
        from_attributes = True

class TicketIssueClassificationUpdate(BaseModel):
    issue_type_id: Optional[int] = None
    disposition_id: Optional[int] = None

    class Config:
        from_attributes = True

class PaginatedTicketResponse(BaseModel):
    tickets: List[TicketResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

    class Config:
        from_attributes = True