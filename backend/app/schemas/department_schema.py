from pydantic import BaseModel

class DepartmentBase(BaseModel):
    name: str
    description: str | None = None

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentUpdate(DepartmentBase):
    pass

class DepartmentResponse(DepartmentBase):
    id: int

    class Config:
        from_attributes = True
