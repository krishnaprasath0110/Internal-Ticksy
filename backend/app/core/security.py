from datetime import datetime, timedelta, timezone
from typing import Any
from jose import jwt
from passlib.context import CryptContext
from app.core.config import settings
import secrets

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def create_access_token(subject: Any, expires_delta: timedelta | None = None) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        # Convert minutes to seconds for proper expiration
        minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES
        expire = datetime.now(timezone.utc) + timedelta(minutes=minutes)
    
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_email_login_token(email: str, ticket_id: int = None, expires_delta: timedelta | None = None) -> str:
    """
    Create a token for auto-login from email links.
    
    Args:
        email: User's email address
        ticket_id: Optional ticket ID to redirect to
        expires_delta: Optional token expiration time
        
    Returns:
        JWT token string
    """
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        # Default to 7 days for email links
        expire = datetime.now(timezone.utc) + timedelta(days=7)
    
    to_encode = {
        "exp": expire,
        "email": email
    }
    
    # Add ticket_id to payload if provided
    if ticket_id:
        to_encode["ticket_id"] = ticket_id
    
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def create_password_reset_token(email: str) -> str:
    """Create a password reset token that expires in 1 hour"""
    expire = datetime.utcnow() + timedelta(hours=1)
    # Add a random component to prevent token reuse
    random_component = secrets.token_urlsafe(8)
    to_encode = {
        "exp": expire,
        "email": email,
        "sub": "password_reset",
        "jti": random_component
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def verify_password_reset_token(token: str) -> str:
    """
    Verify the password reset token and return the email if valid
    Raises JWTError if token is invalid or expired
    """
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    if payload.get("sub") != "password_reset":
        raise jwt.JWTError("Invalid token type")
    email: str = payload.get("email")
    if email is None:
        raise jwt.JWTError("Email not found in token")
    return email
