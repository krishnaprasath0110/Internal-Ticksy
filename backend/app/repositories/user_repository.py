from sqlalchemy import outerjoin
from sqlalchemy.orm import Session, joinedload
import secrets
import string
from app.db.models.user import User
from app.db.models.user_department import UserDepartment
from app.db.models.user_category import UserCategory
from app.db.models.category import Category
from app.db.models.user_batch import UserBatch 
from app.db.models.batch import Batch
from app.db.models.template import Template
from app.db.models.program import Program
from app.db.models.university import University
from app.db.models.role import Role
from app.core.security import get_password_hash
from app.schemas.user_schema import UserCreate, UserUpdate, CandidateCreate, AgentCreate, EmployeeCreate
from typing import List, Union
from fastapi import HTTPException, status
import random
from app.services.email_service import email_service
# from app.core.logger import logger
from fastapi.background import BackgroundTasks
import random
import string
import logging

# Configure logging
# logger = logging.getLogger(__name__)

def generate_password(length=12):
    """Generate a secure random password"""
    characters = string.ascii_letters + string.digits
    return ''.join(secrets.choice(characters) for _ in range(length))

def get_all_users(db: Session, role_name: str = None, category_id: int = None, department_id: int = None):
    """Get all users with optional filtering by role and department."""
    query = (db.query(User)
            .join(Role, User.role_id == Role.id)
            .outerjoin(User.user_departments)
            .outerjoin(UserDepartment.department)
            .outerjoin(User.user_categories)
            .outerjoin(UserCategory.category)
            .outerjoin(User.user_batches)
            .outerjoin(UserBatch.batch)
            .outerjoin(Batch.program)
            .outerjoin(Program.university)
            .options(
                joinedload(User.role),
                joinedload(User.user_departments).joinedload(UserDepartment.department),
                joinedload(User.user_categories).joinedload(UserCategory.category),
                joinedload(User.user_batches)
                    .joinedload(UserBatch.batch)
                    .joinedload(Batch.program)
                    .joinedload(Program.university)
            )
            # .filter(User.is_active == True)
            .order_by(User.id))
    
    if role_name:
        query = query.filter(Role.name == role_name)
    
    if department_id:
        query = query.filter(UserDepartment.department_id == department_id)
    
    if category_id:
        query = query.filter(UserCategory.category_id == category_id)
    
    # Use distinct to prevent duplicate users when they have multiple departments/categories
    return query.distinct().all()

def create_user(user: Union[CandidateCreate, AgentCreate, EmployeeCreate], db: Session, role_id: int | None = None):
    """Create a new user with role-specific fields and relationships"""
    # Check if user already exists
    db_user = get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Generate a random password if not provided
    password = user.password if user.password else generate_password()
    hashed_password = get_password_hash(password)
    
    # Create base user data
    user_data = {
        "name": user.name,
        "email": user.email,
        "password": hashed_password,
        "role_id": role_id if role_id is not None else user.role_id,
        "template_id": getattr(user, "template_id", None),
        "team_id": getattr(user, "team_id", None),
        "is_active": user.is_active
    }
    
    # Create the user
    db_user = User(**user_data)
    db.add(db_user)
    db.flush()  # Flush to get the user ID
    
    # Handle role-specific relationships
    try:
        if isinstance(user, CandidateCreate):
            # Create user batch relationship for candidates
            user_batch = UserBatch(
                user_id=db_user.id,
                batch_id=user.batch_id
            )
            db.add(user_batch)
            
        elif isinstance(user, AgentCreate):
            for dept_id in user.department_ids:
                db.add(UserDepartment(user_id=db_user.id, department_id=dept_id))

            for cat_id in user.category_ids:
                db.add(UserCategory(user_id=db_user.id, category_id=cat_id))

            for batch_id in user.batch_ids:
                db.add(UserBatch(user_id=db_user.id, batch_id=batch_id))
        
        db.commit()
        
        # Refresh the user to load relationships
        db.refresh(db_user)
        
        # Explicitly load the role relationship
        db_user = db.query(User).options(
            joinedload(User.role),
            joinedload(User.template),
            joinedload(User.user_departments).joinedload(UserDepartment.department),
            joinedload(User.user_categories).joinedload(UserCategory.category),
            joinedload(User.user_batches).joinedload(UserBatch.batch)
                .joinedload(Batch.program)
                .joinedload(Program.university)
        ).filter(User.id == db_user.id).first()
        
        # Return the created user and generated password (if auto-generated)
        return {
            "user": db_user,
            "generated_password": password if not user.password else None
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating user: {str(e)}"
        )

def update_user(user_id: int, user: UserUpdate, db: Session) -> User:
    """Update user and their relationships."""
    try:
        # Get user with all relationships
        db_user = (db.query(User)
                  .filter(User.id == user_id)
                  .options(
                      joinedload(User.user_departments),
                      joinedload(User.user_categories),
                      joinedload(User.user_batches)
                  )
                  .first())
        
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Update basic user details
        for field, value in user.model_dump(exclude_unset=True).items():
            if hasattr(db_user, field):
                setattr(db_user, field, value)
        
        # Update category assignments FIRST (before departments due to FK constraint)
        if user.category_ids is not None:
            # Remove existing category assignments
            db.query(UserCategory).filter(UserCategory.user_id == user_id).delete()
            
            # Create new category assignments
            for cat_id in user.category_ids:
                user_cat = UserCategory(
                    user_id=user_id,
                    category_id=cat_id
                )
                db.add(user_cat)
        
        # Update department assignments AFTER categories
        if user.department_ids is not None:
            # Remove existing department assignments
            db.query(UserDepartment).filter(UserDepartment.user_id == user_id).delete()
            
            # Create new department assignments
            for dept_id in user.department_ids:
                user_dept = UserDepartment(
                    user_id=user_id,
                    department_id=dept_id
                )
                db.add(user_dept)
        
        # Update batch assignments for agents
        if hasattr(user, 'batch_ids') and user.batch_ids is not None and db_user.role.name == 'agent':
            # Remove existing batch assignments for this agent
            db.query(UserBatch).filter(UserBatch.user_id == user_id).delete()
            
            # Create new batch assignments
            for batch_id in user.batch_ids:
                user_batch = UserBatch(
                    user_id=user_id,
                    batch_id=batch_id
                )
                db.add(user_batch)
        
        # Update candidate batch assignment (single batch)
        if hasattr(user, 'batch_id') and user.batch_id is not None and db_user.role.name == 'candidate':
            # Remove existing batch assignment
            db.query(UserBatch).filter(UserBatch.user_id == user_id).delete()
            
            # Create new batch assignment
            user_batch = UserBatch(
                user_id=user_id,
                batch_id=user.batch_id
            )
            db.add(user_batch)
        
        db.commit()
        db.refresh(db_user)
        
        # Return user with updated relationships
        return get_user_by_id(db, user_id)
        
    except Exception as e:
        db.rollback()
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

def get_user_by_email(db: Session, email: str) -> User | None:
    """Get a user by email with all relationships loaded"""
    return db.query(User).options(
        joinedload(User.role),
        joinedload(User.template),
        joinedload(User.user_departments).joinedload(UserDepartment.department),
        joinedload(User.user_categories).joinedload(UserCategory.category),
        joinedload(User.user_batches).joinedload(UserBatch.batch)
            .joinedload(Batch.program)
            .joinedload(Program.university)
    ).filter(User.email == email).first()


def apply_template_to_user(db: Session, user_id: int, template_id: int):
    template = (db.query(Template)
        .options(
            joinedload(Template.departments),
            joinedload(Template.categories),
            joinedload(Template.batches)
        )
        .filter(Template.id == template_id)
        .first())

    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    db.query(UserDepartment).filter(UserDepartment.user_id == user_id).delete()
    db.query(UserCategory).filter(UserCategory.user_id == user_id).delete()
    db.query(UserBatch).filter(UserBatch.user_id == user_id).delete()

    for dept in template.departments:
        db.add(UserDepartment(user_id=user_id, department_id=dept.id))

    for cat in template.categories:
        db.add(UserCategory(user_id=user_id, category_id=cat.id))

    for batch in template.batches:
        db.add(UserBatch(user_id=user_id, batch_id=batch.id))

def get_user_by_id(db: Session, user_id: int) -> User | None:
    """Get a user by ID with all relationships loaded"""
    return db.query(User).options(
        joinedload(User.role),
        joinedload(User.user_departments).joinedload(UserDepartment.department),
        joinedload(User.user_categories).joinedload(UserCategory.category),
        joinedload(User.user_batches).joinedload(UserBatch.batch)
            .joinedload(Batch.program)
            .joinedload(Program.university)
    ).filter(User.id == user_id).first()

def get_user_roles(db: Session, user_id: int) -> List[Role]:
    """Get all roles for a user including department and category assignments"""
    user = db.query(User).options(
        joinedload(User.role),
        joinedload(User.user_departments),
        joinedload(User.user_categories)
    ).filter(User.id == user_id).first()
    
    if not user or not user.role:
        return []
    
    roles = []
    base_role = type('Role', (), {
        'name': user.role.name,
        'id': user.role.id,
        'description': user.role.description
    })
    roles.append(base_role)
    
    if user.role.name == 'department-manager':
        # Add department-specific roles
        roles.extend([
            type('Role', (), {
                'name': 'department-manager',
                'department_id': dept.department_id
            })
            for dept in user.user_departments
        ])
    
    elif user.role.name == 'department-supervisor':
        # Department supervisors behave exactly like department managers
        # They have department-level access
        roles.extend([
            type('Role', (), {
                'name': 'department-supervisor',
                'department_id': dept.department_id
            })
            for dept in user.user_departments
        ])
    
    return roles

def get_all_agents(db: Session, department_id: int = None):
    """Get all active agents, optionally filtered by department"""
    query = (db.query(User)
            .join(User.role)
            .join(User.user_departments)
            .join(UserDepartment.department)
            .options(
                joinedload(User.role),
                joinedload(User.user_departments).joinedload(UserDepartment.department)
            )
            .filter(Role.name == "agent")
            )
    
    if department_id:
        query = query.filter(UserDepartment.department_id == department_id)
    
    return query.all()

async def bulk_import_candidates(
    db: Session,
    candidates: List[dict],
    university_id: int,
    program_id: int,
    batch_id: int
) -> dict:
    """
    Bulk import candidates from a list of dictionaries
    Each dict should have: email, firstname, and optionally lastname
    """
    # Get role ID for candidate
    candidate_role = db.query(Role).filter(Role.name == "candidate").first()
    if not candidate_role:
        raise HTTPException(
            status_code=404,
            detail="Candidate role not found"
        )
    
    # Validate university, program, and batch
    university = db.query(University).filter(University.id == university_id).first()
    if not university:
        raise HTTPException(
            status_code=404,
            detail=f"University with ID {university_id} not found"
        )
    
    program = db.query(Program).filter(
        Program.id == program_id,
        Program.university_id == university_id
    ).first()
    if not program:
        raise HTTPException(
            status_code=404,
            detail=f"Program with ID {program_id} not found in university {university_id}"
        )
    
    batch = db.query(Batch).filter(
        Batch.id == batch_id,
        Batch.program_id == program_id
    ).first()
    if not batch:
        raise HTTPException(
            status_code=404,
            detail=f"Batch with ID {batch_id} not found in program {program_id}"
        )
    
    result = {
        "imported": 0,
        "skipped": 0,
        "errors": []
    }
    
    for candidate in candidates:
        try:
            # Check if user already exists
            existing_user = db.query(User).filter(User.email == candidate["email"]).first()
            if existing_user:
                result["skipped"] += 1
                continue
            
            # Create new user
            # Handle optional lastname
            firstname = candidate.get('firstname', '').strip()
            lastname = candidate.get('lastname', '').strip()
            
            # Build full name
            if lastname:
                full_name = f"{firstname} {lastname}"
            else:
                full_name = firstname
            
            new_user = User(
                email=candidate["email"],
                name=full_name,
                role_id=candidate_role.id,
                is_active=True
            )
            
            # Generate random password
            password = generate_password()
            new_user.password = get_password_hash(password)
            
            db.add(new_user)
            db.flush()  # Get ID without committing
            
            # Create user batch association
            user_batch = UserBatch(
                user_id=new_user.id,
                batch_id=batch_id
            )
            db.add(user_batch)
            
            result["imported"] += 1
            
        except Exception as e:
            result["errors"].append({
                "email": candidate["email"],
                "error": str(e)
            })
    
    db.commit()
    return result
