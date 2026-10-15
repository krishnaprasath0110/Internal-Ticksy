from pydantic import BaseModel, EmailStr
from typing import Optional, List
from app.schemas.role_schema import Role
from app.schemas.batch_schema import BatchResponse
from app.schemas.program_schema import ProgramResponse
from app.schemas.university_schema import UniversityResponse

class DepartmentInfo(BaseModel):
    id: int
    name: str
    description: str


class TemplateInfo(BaseModel):
    id: int
    name: str

class CategoryInfo(BaseModel):
    id: int
    name: str
    description: str

class TeamInfo(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

class UserBase(BaseModel):
    name: str
    email: EmailStr
    role_id: int
    is_active: bool = True
    team_id: Optional[int] = None


class AgentCreate(UserBase):
    password: Optional[str] = None
    template_id: Optional[int] = None
    department_ids: List[int] = []
    category_ids: List[int] = []
    batch_ids: List[int] = []

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    role_id: int
    is_active: bool = True
    password: Optional[str] = None
    template_id: Optional[int] = None
    batch_id: Optional[int] = None
    department_id: Optional[int] = None
    category_id: Optional[int] = None
    department_ids: Optional[List[int]] = []
    category_ids: Optional[List[int]] = []
    batch_ids: Optional[List[int]] = []  # For agents to be assigned to multiple batches

class CandidateCreate(UserCreate):
    pass

class EmployeeCreate(BaseModel):
    name: str
    email: EmailStr
    password: Optional[str] = None
    template_id: Optional[int] = None
    team_id: int
    is_active: bool = True

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    is_active: Optional[bool] = None
    team_id: Optional[int] = None

class UserUpdate(UserBase):
    password: Optional[str] = None
    template_id: Optional[int] = None
    batch_id: Optional[int] = None
    department_ids: Optional[List[int]] = []
    category_ids: Optional[List[int]] = []
    batch_ids: Optional[List[int]] = []  # For agents to be assigned to multiple batches

class UserDepartment(BaseModel):
    department: DepartmentInfo

    class Config:
        from_attributes = True

class UserCategory(BaseModel):
    category: CategoryInfo

    class Config:
        from_attributes = True

class UserBatch(BaseModel):
    batch: BatchResponse

    class Config:
        from_attributes = True

class UserCreateResponse(BaseModel):
    user: 'UserResponse'
    generated_password: Optional[str] = None

    class Config:
        from_attributes = True

class UserResponse(UserBase):
    id: int
    role: Role
    template_id: Optional[int] = None
    template: Optional[TemplateInfo] = None
    user_departments: List[UserDepartment] = []
    user_categories: List[UserCategory] = []
    user_batches: List[UserBatch] = []
    team: Optional['TeamInfo'] = None

    class Config:
        from_attributes = True

class UsersResponse(BaseModel):
    items: List[UserResponse]
    total: int
    skip: int
    limit: int

    class Config:
        from_attributes = True
