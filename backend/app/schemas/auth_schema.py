from pydantic import BaseModel, EmailStr

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict
    
class PasswordResetRequest(BaseModel):
    email_address: EmailStr

class PasswordResetVerify(BaseModel):
    token: str

class PasswordResetComplete(BaseModel):
    token: str
    new_password: str

class PasswordResetResponse(BaseModel):
    message: str

class TokenData(BaseModel):
    email: str | None = None
    role: str | None = None
