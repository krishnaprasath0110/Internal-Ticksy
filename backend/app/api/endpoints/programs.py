from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.db.session import get_db
from app.schemas.program_schema import (
    ProgramCreate,
    ProgramUpdate,
    ProgramResponse
)
from app.repositories import program_repository
from app.core.auth import get_current_user
from app.db.models.user import User

router = APIRouter()

@router.post("/", response_model=ProgramResponse)
def create_program(
    program: ProgramCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new program."""
    if not current_user.role.name == 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return program_repository.create_program(db, program)

@router.get("/", response_model=List[ProgramResponse])
def get_programs(db: Session = Depends(get_db)):
    """Get all programs."""
    return program_repository.get_programs(db)

@router.get("/{program_id}", response_model=ProgramResponse)
def get_program(
    program_id: int,
    db: Session = Depends(get_db)
):
    """Get a program by ID."""
    return program_repository.get_program(db, program_id)

@router.put("/{program_id}", response_model=ProgramResponse)
def update_program(
    program_id: int,
    program: ProgramUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a program."""
    if not current_user.role.name == 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return program_repository.update_program(db, program_id, program)

@router.delete("/{program_id}")
def delete_program(
    program_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a program."""
    if not current_user.role.name == 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    program_repository.delete_program(db, program_id)
    return {"message": "Program deleted successfully"}
