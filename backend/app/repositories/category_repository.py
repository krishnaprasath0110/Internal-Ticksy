from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.db.models.category import Category
from app.db.models.user_category import UserCategory
from app.db.models.user_department import UserDepartment
from app.schemas.category_schema import CategoryCreate, CategoryUpdate
from fastapi import HTTPException, status
from typing import List, Optional
from sqlalchemy.orm import joinedload

def create_category(db: Session, category: CategoryCreate) -> Category:
    """Create a new category."""
    db_category = Category(
        name=category.name,
        description=category.description,
        department_id=category.department_id,
        tat_minutes=category.tat_minutes
    )
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    
    # Assign multiple agents to the category
    for user_id in category.user_ids:
        assign_agent_to_category(db, db_category.id, user_id)
    
    return db_category

def get_category(db: Session, category_id: int) -> Category:
    """Get a category by ID."""
    category = db.query(Category).filter(Category.id == category_id).first()
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Category not found"
        )
    return category

def get_category_by_name(db: Session, name: str) -> Category | None:
    """Get a category by name. Returns None if not found."""
    return db.query(Category).filter(Category.name == name).first()

def get_category_by_id(db: Session, category_id: int) -> Category | None:
    """Get a category by ID. Returns None if not found."""
    from app.db.models.user import User
    category = (db.query(Category)
            .filter(Category.id == category_id)
            .first())
    
    if category:
        # Manually load and sort users
        category.users = sorted(category.users, key=lambda u: u.name)
    
    return category

def get_categories(db: Session, department_id: int | None = None) -> List[Category]:
    """Get all categories, optionally filtered by department."""
    query = db.query(Category).order_by(Category.name.asc())
    if department_id:
        query = query.filter(Category.department_id == department_id)
    
    categories = query.all()
    
    # Sort users within each category by name
    for category in categories:
        category.users = sorted(category.users, key=lambda u: u.name)
    
    return categories

def update_category(db: Session, category_id: int, category: CategoryUpdate) -> Category:
    """Update a category."""
    try:
        db_category = get_category_by_id(db, category_id)
        if not db_category:
            raise HTTPException(status_code=404, detail="Category not found")
        
        # Update basic category fields
        for key, value in category.model_dump(exclude_unset=True).items():
            if key != 'user_ids':  # Handle user_ids separately
                setattr(db_category, key, value)
        
        # Handle multiple user assignments
        if 'user_ids' in category.model_dump(exclude_unset=True):
            # Remove all existing user assignments for this category
            db.query(UserCategory).filter(UserCategory.category_id == category_id).delete()
            
            # Add new user assignments
            if category.user_ids:  # Only create new assignments if user_ids are provided
                for user_id in category.user_ids:
                    assign_agent_to_category(db, category_id, user_id)
        
        db.commit()
        db.refresh(db_category)
        return db_category
        
    except HTTPException as e:
        db.rollback()
        raise e
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

def delete_category(db: Session, category_id: int) -> bool:
    """Delete a category."""
    try:
        db_category = get_category_by_id(db, category_id)
        if not db_category:
            raise HTTPException(status_code=404, detail="Category not found")
        
        db.delete(db_category)
        db.commit()
    except HTTPException as e:
        raise e
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    return True

def assign_agent_to_category(db: Session, category_id: int, user_id: int, user_department_id: int = None) -> UserCategory:
    """Assign an agent to a category. Multiple agents can be assigned to the same category."""
    # Check if this user is already assigned to this category
    existing_assignment = db.query(UserCategory).filter(
        UserCategory.category_id == category_id,
        UserCategory.user_id == user_id
    ).first()
    
    if existing_assignment:
        # Already assigned, just return it
        return existing_assignment
    
    try:
        user_category = UserCategory(
            user_id=user_id,
            category_id=category_id
        )
        db.add(user_category)
        db.commit()
        db.refresh(user_category)
        return user_category
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to assign agent to category"
        )

def remove_agent_from_category(db: Session, category_id: int) -> bool:
    """Remove agent assignment from a category."""
    result = db.query(UserCategory).filter(UserCategory.category_id == category_id).delete()
    db.commit()
    return result > 0

def get_category_agent(db: Session, category_id: int) -> Optional[UserCategory]:
    """Get the agent assigned to a category."""
    return db.query(UserCategory).filter(UserCategory.category_id == category_id).first()

def get_agent_categories(db: Session, user_id: int) -> List[Category]:
    """Get all categories assigned to an agent."""
    return db.query(Category).join(UserCategory).filter(UserCategory.user_id == user_id).all()
