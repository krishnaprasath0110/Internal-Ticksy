from pydantic import BaseModel
from app.schemas.university_schema import UniversityResponse

class ProgramBase(BaseModel):
    name: str
    description: str | None = None
    university_id: int
    email: str | None = None  # Email address for the program

class ProgramEmailConfig(BaseModel):
    email_password: str | None = None

class ProgramCreate(ProgramBase, ProgramEmailConfig):
    pass

class ProgramUpdate(ProgramBase, ProgramEmailConfig):
    pass

class ProgramResponse(ProgramBase):
    id: int
    university: UniversityResponse
    email: str | None = None
    # Password is not included in response for security

    class Config:
        from_attributes = True
