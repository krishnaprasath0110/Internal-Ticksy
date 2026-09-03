from sqlalchemy.orm import Session
from app.db.models.university import University
from app.schemas.university_schema import UniversityCreate, UniversityUpdate
from fastapi import HTTPException, status
from typing import List

def create_university(db: Session, university: UniversityCreate) -> University:
    """Create a new university."""
    db_university = University(**university.dict())
    db.add(db_university)
    db.commit()
    db.refresh(db_university)
    return db_university

def get_university(db: Session, university_id: int) -> University:
    """Get a university by ID."""
    university = db.query(University).filter(University.id == university_id).first()
    if not university:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="University not found"
        )
    return university

def get_universities(db: Session) -> List[University]:
    """Get all universities."""
    return db.query(University).all()

def update_university(db: Session, university_id: int, university: UniversityUpdate) -> University:
    """Update a university."""
    db_university = get_university(db, university_id)
    
    for key, value in university.dict(exclude_unset=True).items():
        setattr(db_university, key, value)
    
    db.commit()
    db.refresh(db_university)
    return db_university

def delete_university(db: Session, university_id: int) -> bool:
    """Delete a university."""
    university = get_university(db, university_id)
    db.delete(university)
    db.commit()
    return True