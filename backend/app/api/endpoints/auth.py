from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session, joinedload
from app.core.auth import create_access_token, get_current_user
from app.repositories import user_repository
from app.core.security import verify_password, create_password_reset_token, verify_password_reset_token, get_password_hash
from datetime import timedelta
from app.core.config import settings
from app.db.session import get_db
from app.schemas.auth_schema import LoginRequest, Token, PasswordResetRequest, PasswordResetComplete, PasswordResetVerify, PasswordResetResponse
from app.schemas.user_schema import UserResponse
from app.db.models.user import User
from app.services.email_service import email_service
from app.services import email_templates
import logging
from jose import jwt, JWTError
from urllib.parse import urlencode
from fastapi.responses import RedirectResponse

router = APIRouter()

logging.basicConfig(level=logging.INFO)

MOODLE_SECRET_KEY = settings.MOODLE_SECRET_KEY
MOODLE_ISSUER = settings.MOODLE_ISSUER
FRONTEND_URL = settings.FRONTEND_URL

@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user = Depends(get_current_user)):
    """
    Get information about the currently logged in user.
    This endpoint can be used to:
    1. Validate if the current session is still valid
    2. Get fresh user data
    3. Check token expiration
    """
    return current_user

@router.post("/login", response_model=Token)
async def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    """
    Login with JSON body for API clients
    """
    # Authenticate user with department information loaded
    user = db.query(User).filter(User.email == login_data.email).options(
        joinedload(User.role),
        joinedload(User.user_departments).joinedload(User.user_departments.property.mapper.class_.department)
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not verify_password(login_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your account has been deactivated. Please contact an administrator.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role.name},
        expires_delta=access_token_expires
    )
    
    # Format department information
    departments = []
    for user_dept in user.user_departments:
        if user_dept.department:
            departments.append({
                "id": user_dept.department.id,
                "name": user_dept.department.name
            })
    
    # Format category information
    categories = []
    for user_cat in user.user_categories:
        if user_cat.category:
            categories.append({
                "id": user_cat.category.id,
                "name": user_cat.category.name
            })
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role.name,
            "user_departments": departments,
            "user_categories": categories
        }
    }

@router.post("/login/form", response_model=Token)
async def login_form(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """
    Login with form data for Swagger UI
    Use username field for email
    """
    # Authenticate user with department information loaded
    user = db.query(User).filter(User.email == form_data.username).options(
        joinedload(User.role),
        joinedload(User.user_departments).joinedload(User.user_departments.property.mapper.class_.department)
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your account has been deactivated. Please contact an administrator.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role.name},
        expires_delta=access_token_expires
    )
    
    # Format department information
    departments = []
    for user_dept in user.user_departments:
        if user_dept.department:
            departments.append({
                "id": user_dept.department.id,
                "name": user_dept.department.name
            })
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role.name,
            "user_departments": departments
        }
    }

@router.get("/moodle/sso")
async def moodle_sso(
    token: str,
    db: Session = Depends(get_db)
):
    """
    Handle SSO from Moodle. Expects a JWT token containing user information.
    """
    try:
        # Verify and decode the JWT token from Moodle
        payload = jwt.decode(
            token,
            MOODLE_SECRET_KEY,
            algorithms=["HS256"],
            issuer=MOODLE_ISSUER
        )
        
        logging.info("Payload: %s", payload)
        
        # Extract user info from payload
        email = payload.get("email")
        name = payload.get("name")
        
        if not email:
            # Redirect to frontend with error
            params = {
                "error": "Invalid token: missing email",
                "status": "error"
            }
            redirect_url = f"{FRONTEND_URL}/login?{urlencode(params)}"
            return RedirectResponse(url=redirect_url)
            
        # Check if user exists with all related data loaded
        user = db.query(User).filter(User.email == email).options(
            joinedload(User.role),
            joinedload(User.user_departments).joinedload(User.user_departments.property.mapper.class_.department),
            joinedload(User.user_categories).joinedload(User.user_categories.property.mapper.class_.category)
        ).first()
        
        if not user:
            # Redirect to frontend with user not found error
            params = {
                "error": "User not found",
                "status": "error",
                "email": email
            }
            redirect_url = f"{FRONTEND_URL}/login?{urlencode(params)}"
            return RedirectResponse(url=redirect_url)
        
        # Check if user is active
        if not user.is_active:
            # Redirect to frontend with inactive user error
            params = {
                "error": "Account deactivated",
                "status": "error",
                "email": email
            }
            redirect_url = f"{FRONTEND_URL}/login?{urlencode(params)}"
            return RedirectResponse(url=redirect_url)
        
        # Create access token with role information
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.email, "role": user.role.name},
            expires_delta=access_token_expires
        )
        
        # Format department information
        departments = []
        for user_dept in user.user_departments:
            if user_dept.department:
                departments.append({
                    "id": user_dept.department.id,
                    "name": user_dept.department.name
                })
        
        # Format category information
        categories = []
        for user_cat in user.user_categories:
            if user_cat.category:
                categories.append({
                    "id": user_cat.category.id,
                    "name": user_cat.category.name
                })
        
        # Create auth response data
        auth_data = {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "role": {
                    "id": user.role.id,
                    "name": user.role.name,
                    "description": user.role.description
                },
                "departments": departments,
                "categories": categories
            }
        }
        
        # Encode the auth data for URL
        encoded_auth = jwt.encode(auth_data, MOODLE_SECRET_KEY, algorithm="HS256")
        
        # Redirect to frontend with success data
        params = {
            "sso_data": encoded_auth,
            "status": "success",
            "redirect": "/dashboard"
        }
        redirect_url = f"{FRONTEND_URL}?{urlencode(params)}"
        return RedirectResponse(url=redirect_url)
        
    except JWTError:
        # Redirect to frontend with invalid token error
        params = {
            "error": "Invalid authentication token",
            "status": "error"
        }
        redirect_url = f"{FRONTEND_URL}/login?{urlencode(params)}"
        return RedirectResponse(url=redirect_url)

# Email auto-login endpoint
@router.get("/email-login")
async def email_auto_login(
    token: str,
    db: Session = Depends(get_db)
):
    """
    Handle auto-login from email links. Expects a JWT token containing user information.
    """
    try:
        # Verify and decode the JWT token
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        
        # Extract user info from payload
        email = payload.get("email")
        ticket_id = payload.get("ticket_id")
        
        print("Email:", email)
        print("Ticket ID:", ticket_id)
        
        if not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token data"
            )
        
        # Get user from database
        user = db.query(User).filter(User.email == email).options(
            joinedload(User.role),
            joinedload(User.user_departments).joinedload(User.user_departments.property.mapper.class_.department),
            joinedload(User.user_categories).joinedload(User.user_categories.property.mapper.class_.category)
        ).first()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found"
            )
        
        # Check if user is active
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Your account has been deactivated. Please contact an administrator.",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Create access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.email, "role": user.role.name},
            expires_delta=access_token_expires
        )
        
        # Format department information
        departments = []
        for user_dept in user.user_departments:
            if user_dept.department:
                departments.append({
                    "id": user_dept.department.id,
                    "name": user_dept.department.name
                })
        
        # Format category information
        categories = []
        for user_cat in user.user_categories:
            if user_cat.category:
                categories.append({
                    "id": user_cat.category.id,
                    "name": user_cat.category.name
                })
        
        # Create auth data for frontend
        auth_data = {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "role": {
                    "id": user.role.id,
                    "name": user.role.name,
                    "description": user.role.description
                },
                "departments": departments,
                "categories": categories
            },
            # Include ticket_id in the auth data if available
            "ticket_id": ticket_id
        }
        
        # Encode the auth data for URL
        encoded_auth = jwt.encode(auth_data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        
        # Redirect to frontend with encoded auth data and ticket ID if available
        params = {
            "sso_data": encoded_auth
        }
        
        # Add ticket ID to redirect to specific ticket if provided
        if ticket_id:
            # Use a more explicit redirect parameter that the frontend can easily detect
            params["ticket_redirect"] = str(ticket_id)
            # Also include the full path for compatibility
            params["redirect"] = f"/tickets/{ticket_id}"
            print(f"Redirecting to ticket ID: {ticket_id}")
        else:
            # Default to dashboard if no ticket ID
            params["redirect"] = "/dashboard"
        
        redirect_url = f"{settings.FRONTEND_URL}?{urlencode(params)}"
        print(f"Full redirect URL: {redirect_url}")
        return RedirectResponse(url=redirect_url)
        
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token"
        )

@router.post("/password-reset/request", response_model=PasswordResetResponse)
async def request_password_reset(
    request_data: PasswordResetRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """
    Request a password reset. Sends an email with a reset link if the email exists.
    Always returns success to prevent email enumeration.
    """
    user = user_repository.get_user_by_email(db, request_data.email_address)
    if user:
        # Generate reset token
        token = create_password_reset_token(user.email)
        
        # Create reset URL
        reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        
        # Send email
        subject = "Password Reset Request"
        body = email_templates.get_password_reset_template(user.name, reset_url)
        
        background_tasks.add_task(
            email_service.send_email,
            recipients=[user.email],
            subject=subject,
            body=body
        )
    
    return {"message": "If the email exists in our system, you will receive a password reset link"}

@router.post("/password-reset/verify", response_model=PasswordResetResponse)
async def verify_reset_token(token_data: PasswordResetVerify):
    """
    Verify if a password reset token is valid without consuming it
    """
    try:
        email = verify_password_reset_token(token_data.token)
        return {"message": "Token is valid"}
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )

@router.post("/password-reset/complete", response_model=PasswordResetResponse)
async def complete_password_reset(
    reset_data: PasswordResetComplete,
    db: Session = Depends(get_db)
):
    """
    Complete the password reset process by setting a new password
    """
    try:
        email = verify_password_reset_token(reset_data.token)
        user = user_repository.get_user_by_email(db, email)
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Update password
        user.password = get_password_hash(reset_data.new_password)
        db.commit()
        
        return {"message": "Password has been reset successfully"}
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )