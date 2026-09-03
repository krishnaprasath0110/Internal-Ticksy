from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, UploadFile, File, Form
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.user_schema import UserResponse, CandidateCreate, AgentCreate, UserCreateResponse, UserUpdate
from app.repositories import user_repository
from app.core.auth import get_current_user
from app.services.email_service import email_service
from app.services import email_templates
from app.core.config import settings
from typing import List, Optional
import pandas as pd
import io

router = APIRouter()

# CREATE Operations
@router.post('/agent', response_model=UserCreateResponse, status_code=status.HTTP_201_CREATED)
def create_agent(
    user: AgentCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    # check if user exists
    existing_user = user_repository.get_user_by_email(email=user.email, db=db)
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")
    
    # Create the user and get the raw result
    result = user_repository.create_user(user, db=db)
    
    # Get the full user with all relationships
    db_user = user_repository.get_user_by_id(db, result["user"].id)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )
    
    # Send welcome email with credentials
    subject = "Welcome to Ticksy - Your Account Credentials"
    body = email_templates.get_new_user_credentials_template(
        user_name=db_user.name,
        email=db_user.email,
        password=result["generated_password"],
        website_url=settings.FRONTEND_URL,
        reset_url=f"{settings.FRONTEND_URL}/forgot-password"
    )
    
    background_tasks.add_task(
        email_service.send_email,
        recipients=[db_user.email],
        subject=subject,
        body=body
    )
    
    # Convert to response model
    user_dict = {
        "id": db_user.id,
        "name": db_user.name,
        "email": db_user.email,
        "role_id": db_user.role_id,
        "template_id": db_user.template_id,
        "template": {"id": db_user.template.id, "name": db_user.template.name} if db_user.template else None,
        "is_active": db_user.is_active,
        "role": db_user.role,
        "user_departments": [
            {"department": {"id": ud.department.id, "name": ud.department.name, "description": ud.department.description}}
            for ud in db_user.user_departments
        ],
        "user_categories": [
            {"category": {"id": uc.category.id, "name": uc.category.name, "description": uc.category.description}}
            for uc in db_user.user_categories
        ],
        "user_batches": [
            {
                "batch": {
                    "id": ub.batch.id,
                    "name": ub.batch.name,
                    "description": ub.batch.description,
                    "program_id": ub.batch.program_id,
                    "program": {
                        "id": ub.batch.program.id,
                        "name": ub.batch.program.name,
                        "description": ub.batch.program.description,
                        "university_id": ub.batch.program.university_id,
                        "university": {
                            "id": ub.batch.program.university.id,
                            "name": ub.batch.program.university.name,
                            "description": ub.batch.program.university.description
                        }
                    }
                }
            }
            for ub in db_user.user_batches
        ]
    }
    
    user_response = UserResponse.model_validate(user_dict)
    
    return {
        "user": user_response,
        "generated_password": result["generated_password"]
    }

@router.post('/candidate', response_model=UserCreateResponse, status_code=status.HTTP_201_CREATED)
def create_candidate(
    user: CandidateCreate,
    db: Session = Depends(get_db)
):
    # check if user exists
    existing_user = user_repository.get_user_by_email(email=user.email, db=db)
    if existing_user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")
    
    # Create the user and get the raw result
    result = user_repository.create_user(user, db=db)
    
    # Get the full user with all relationships
    db_user = user_repository.get_user_by_id(db, result["user"].id)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create user"
        )
    
    # Convert to response model
    user_response = UserResponse.model_validate(db_user.__dict__, from_attributes=True)
    
    return {
        "user": user_response,
        "generated_password": result["generated_password"]
    }

@router.post("/bulk-import-candidates")
async def import_candidates(
    file: UploadFile = File(...),
    university_id: int = Form(...),
    program_id: int = Form(...),
    batch_id: int = Form(...),
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Bulk import candidates from CSV file
    File should have columns: email, firstname, lastname
    """
    if not file.filename.endswith('.csv'):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are allowed"
        )
    
    try:
        # Read CSV file
        contents = await file.read()
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        
        # Validate required columns
        required_columns = ['email', 'firstname', 'lastname']
        if not all(col in df.columns for col in required_columns):
            raise HTTPException(
                status_code=400,
                detail=f"CSV must contain columns: {', '.join(required_columns)}"
            )
        
        # Clean up data
        df = df[required_columns]  # Only keep required columns
        # Only drop rows where email or firstname is missing (lastname is optional)
        df = df.dropna(subset=['email', 'firstname'])
        # Fill empty lastname with empty string
        df['lastname'] = df['lastname'].fillna('')
        
        # Convert to list of dicts
        candidates = df.to_dict('records')
        
        # Import candidates
        result = await user_repository.bulk_import_candidates(
            db=db,
            candidates=candidates,
            university_id=university_id,
            program_id=program_id,
            batch_id=batch_id
        )
        
        return {
            "message": "Import completed",
            "imported": result["imported"],
            "skipped": result["skipped"],
            "errors": result["errors"]
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error importing candidates: {str(e)}"
        )

# READ Operation
@router.get('/', response_model=List[UserResponse])
def get_all_users(
    role: Optional[str] = None,
    department_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Get all users with optional filtering by role and department.
    Examples:
    - Get all users: GET /users
    - Get all agents: GET /users?role=agent
    - Get all agents in department 1: GET /users?role=agent&department_id=1
    """
    return user_repository.get_all_users(db, role_name=role, department_id=department_id)

# UPDATE Operation
@router.put('/{user_id}', response_model=UserResponse)
def update_user(
    user_id: int,
    user: UserUpdate,
    db: Session = Depends(get_db),
    # current_user: UserResponse = Depends(get_current_user)
):
    try:
        return user_repository.update_user(user_id, user, db=db)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.put('/agent/{user_id}', response_model=UserResponse)
def update_agent(
    user_id: int,
    user: AgentCreate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    try:
        # Ensure role is agent
        user.role_id = 2  # Agent role
        return user_repository.update_user(user_id, user, db=db)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.put('/candidate/{user_id}', response_model=UserResponse)
def update_candidate(
    user_id: int,
    user: CandidateCreate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    try:
        # Ensure role is candidate
        user.role_id = 5  # Candidate role
        return user_repository.update_user(user_id, user, db=db)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

# DELETE Operation
@router.delete('/{user_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    try:
        # Get the user
        db_user = user_repository.get_user_by_id(db, user_id)
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Soft delete by setting is_active to False
        db_user.is_active = False
        db.commit()
        
        return None
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
