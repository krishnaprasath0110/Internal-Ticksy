from pydantic import BaseModel, EmailStr


class AdminBase(BaseModel):
    name: str
    email: EmailStr
    password: str
    role_id: int
    
class AdminCreate(AdminBase):
    pass

class AdminResponse(AdminBase):
    admin_id: int
    
    class Config():
        from_attributes = True