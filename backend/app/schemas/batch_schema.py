from pydantic import BaseModel
from app.schemas.program_schema import ProgramResponse

class BatchBase(BaseModel):
    name: str
    description: str | None = None
    program_id: int

class BatchCreate(BatchBase):
    pass

class BatchUpdate(BatchBase):
    pass

class BatchResponse(BatchBase):
    id: int
    program: ProgramResponse

    class Config:
        from_attributes = True


class FaqUploadResponse(BaseModel):
    success: bool
    total_rows: int
    processed_rows: int
    message: str
    batch_id: int
    batch_name: str
