from typing import List, Optional

from pydantic import BaseModel


class DispositionBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True


class DispositionCreate(DispositionBase):
    issue_type_id: int


class DispositionResponse(DispositionBase):
    id: int
    issue_type_id: int

    class Config:
        from_attributes = True


class IssueTypeBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_active: bool = True


class IssueTypeCreate(IssueTypeBase):
    pass


class IssueTypeResponse(IssueTypeBase):
    id: int
    dispositions: Optional[List[DispositionResponse]] = []

    class Config:
        from_attributes = True

