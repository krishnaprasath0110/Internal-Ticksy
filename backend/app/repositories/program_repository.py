from sqlalchemy.orm import Session
from app.db.models.program import Program
from app.schemas.program_schema import ProgramCreate, ProgramUpdate
from fastapi import HTTPException, status
from typing import List

def create_program(db: Session, program: ProgramCreate) -> Program:
    """Create a new program."""
    db_program = Program(**program.model_dump())
    db.add(db_program)
    db.commit()
    db.refresh(db_program)
    return db_program

def get_program(db: Session, program_id: int) -> Program:
    """Get a program by ID."""
    program = db.query(Program).filter(Program.id == program_id).first()
    if not program:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Program not found"
        )
    return program

def get_programs(db: Session) -> List[Program]:
    """Get all programs."""
    return db.query(Program).all()

def update_program(db: Session, program_id: int, program: ProgramUpdate) -> Program:
    """Update a program."""
    db_program = get_program(db, program_id)
    
    for key, value in program.model_dump(exclude_unset=True).items():
        setattr(db_program, key, value)
    
    db.commit()
    db.refresh(db_program)
    return db_program