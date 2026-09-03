from pydantic import BaseModel

class UniversityBase(BaseModel):
    name: str
    description: str | None = None

class UniversityCreate(UniversityBase):
    pass

class UniversityUpdate(UniversityBase):
    pass

class UniversityResponse(UniversityBase):
    id: int

    class Config:
        from_attributes = True
