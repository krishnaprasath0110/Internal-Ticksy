from pydantic import BaseModel
from typing import List
from app.db.models.status import Status

class StatusResponse(BaseModel):
    id: int
    name: str
    description: str
    
class StatusListResponse(BaseModel):
    statuses: List[StatusResponse]