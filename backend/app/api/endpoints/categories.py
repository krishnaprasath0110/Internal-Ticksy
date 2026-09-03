from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional

from app.db.session import get_db
from app.schemas.category_schema import (
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse
)
from app.repositories import category_repository
from app.core.auth import get_current_user
from app.db.models.user import User
from app.db.models.role import Role

router = APIRouter()

@router.post("/", response_model=CategoryResponse)
def create_category(
    category: CategoryCreate,
    db: Session = Depends(get_db),
    # current_user: User = Depends(get_current_user)
):
    """Create a new category."""
    # if not current_user.role.name == 'admin':
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Not enough permissions"
    #     )
    db_category = category_repository.get_category_by_name(db, name=category.name)
    if db_category:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Category with this name already exists"
        )
    return category_repository.create_category(db, category)

@router.get("/", response_model=List[CategoryResponse])
def get_categories(
    department_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Get all categories.
    Optionally filter by department_id.
    """
    return category_repository.get_categories(db, department_id)

@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(
    category_id: int,
    db: Session = Depends(get_db)
):
    """Get a category by ID."""
    db_category = category_repository.get_category(db, category_id)
    if db_category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )
    return db_category

@router.put("/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    category: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a category."""
    if not current_user.role.name == 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    db_category = category_repository.get_category(db, category_id)
    if db_category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )
    if category.name:
        existing_category = category_repository.get_category_by_name(db, name=category.name)
        if existing_category and existing_category.id != category_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Category with this name already exists"
            )
    updated_category = category_repository.update_category(db, category_id, category)
    if updated_category is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid update data provided"
        )
    return updated_category

@router.delete("/{category_id}")
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a category."""
    if not current_user.role.name == 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    db_category = category_repository.get_category(db, category_id)
    if db_category is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )
    category_repository.delete_category(db, category_id)
    return {"message": "Category deleted successfully"}

@router.post("/{category_id}/agent/{user_id}", response_model=CategoryResponse)
def assign_agent_to_category(
    category_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Assign an agent to a category."""
    if not current_user.role.name in ['admin']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # Verify user exists and is an agent
    agent = db.query(User).join(Role).filter(User.id == user_id, Role.name == 'agent').first()
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Get agent's department
    user_department = agent.user_departments[0] if agent.user_departments else None
    if not user_department:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Agent has no department assigned"
        )
    
    return category_repository.assign_agent_to_category(
        db, 
        category_id=category_id, 
        user_id=user_id,
        user_department_id=user_department.id
    )

@router.delete("/{category_id}/agent", status_code=status.HTTP_204_NO_CONTENT)
def remove_agent_from_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove agent assignment from a category."""
    if not current_user.role.name in ['admin']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    if not category_repository.remove_agent_from_category(db, category_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No agent assignment found for this category"
        )

@router.get("/{category_id}/agent", response_model=CategoryResponse)
def get_category_agent(
    category_id: int,
    db: Session = Depends(get_db)
):
    """Get the agent assigned to a category."""
    agent_assignment = category_repository.get_category_agent(db, category_id)
    if not agent_assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No agent assigned to this category"
        )
    return agent_assignment

@router.get("/agent/{user_id}", response_model=List[CategoryResponse])
def get_agent_categories(
    user_id: int,
    db: Session = Depends(get_db)
):
    """Get all categories assigned to an agent."""
    return category_repository.get_agent_categories(db, user_id)