from pydantic import BaseModel, Field
from typing import List, Optional

from app.schemas.department_schema import DepartmentResponse
from app.schemas.category_schema import CategoryResponse
from app.schemas.batch_schema import BatchResponse


class TemplateBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class TemplateCreate(TemplateBase):
    department_ids: List[int] = []
    category_ids: List[int] = []
    batch_ids: List[int] = []


class TemplateUpdate(TemplateBase):
    department_ids: Optional[List[int]] = None
    category_ids: Optional[List[int]] = None
    batch_ids: Optional[List[int]] = None


class TemplateResponse(TemplateBase):
    id: int
    departments: List[DepartmentResponse] = []
    categories: List[CategoryResponse] = []
    batches: List[BatchResponse] = []

    class Config:
        from_attributes = True
