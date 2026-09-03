from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.schemas.university_schema import (
    UniversityCreate,
    UniversityUpdate,
    UniversityResponse
)
from app.repositories import university_repository
from app.core.auth import get_current_user
from app.db.models.user import User
from app.db.models.university import University

router = APIRouter()

@router.post("/", response_model=UniversityResponse)
def create_university(
    university: UniversityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new university."""
    if not current_user.role.name == 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return university_repository.create_university(db, university)

@router.get("/", response_model=List[UniversityResponse])
def get_universities(db: Session = Depends(get_db)):
    """Get all universities."""
    return university_repository.get_universities(db)

@router.get("/{university_id}", response_model=UniversityResponse)
def get_university(
    university_id: int,
    db: Session = Depends(get_db)
):
    """Get a university by ID."""
    return university_repository.get_university(db, university_id)

@router.put("/{university_id}", response_model=UniversityResponse)
def update_university(
    university_id: int,
    university: UniversityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a university."""
    if not current_user.role.name == 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return university_repository.update_university(db, university_id, university)

@router.delete("/{university_id}")
def delete_university(
    university_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a university."""
    if not current_user.role.name == 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    university_repository.delete_university(db, university_id)
    return {"message": "University deleted successfully"}
