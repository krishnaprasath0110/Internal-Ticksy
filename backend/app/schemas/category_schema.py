from pydantic import BaseModel, Field
from typing import Optional, List
from app.schemas.user_schema import UserResponse

class CategoryBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = Field(None, max_length=500)
    department_id: int
    tat_minutes: int = Field(default=24, ge=1, description="TAT time in minutes")

class CategoryCreate(CategoryBase):
    user_ids: List[int] = []

class CategoryUpdate(CategoryBase):
    user_ids: Optional[List[int]] = None

class CategoryInDB(CategoryBase):
    id: int
    users: List[UserResponse] = []
    
    class Config:
        from_attributes = True

class CategoryResponse(CategoryInDB):
    pass
