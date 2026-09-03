from datetime import datetime
from pydantic import BaseModel, Field
from app.schemas.user_schema import UserResponse
from typing import List

class ThreadBase(BaseModel):
    message: str
    attachments: List[str] | None = None
    is_system: bool = False
    created_at: datetime = Field(default_factory=datetime.now)

class ThreadCreate(BaseModel):
    """Request body for creating a thread - only needs message"""
    message: str

class ThreadResponse(ThreadBase):
    """Response model includes all fields including ids and user data"""
    id: int
    ticket_id: int
    user: UserResponse  # Changed from user_id to include full user data

    class Config:
        from_attributes = True
