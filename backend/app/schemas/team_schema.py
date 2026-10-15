from pydantic import BaseModel
from typing import Optional


class TeamBase(BaseModel):
    name: str
    description: Optional[str] = None


class TeamCreate(TeamBase):
    pass


class TeamUpdate(TeamBase):
    pass


class TeamResponse(TeamBase):
    id: int
    employee_count: int = 0

    class Config:
        from_attributes = True
