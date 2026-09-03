from sqlalchemy.orm import Session
from app.db.models.department import Department
from app.schemas.department_schema import DepartmentCreate, DepartmentUpdate
from fastapi import HTTPException, status
from typing import List

def create_department(db: Session, department: DepartmentCreate) -> Department:
    """Create a new department."""
    db_department = Department(**department.dict())
    db.add(db_department)
    db.commit()
    db.refresh(db_department)
    return db_department

def get_department(db: Session, department_id: int) -> Department:
    """Get a department by ID."""
    department = db.query(Department).filter(Department.id == department_id).first()
    if not department:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Department not found"
        )
    return department

def get_departments(db: Session) -> List[Department]:
    """Get all departments."""
    return db.query(Department).all()

def update_department(db: Session, department_id: int, department: DepartmentUpdate) -> Department:
    """Update a department."""
    db_department = get_department(db, department_id)
    
    for key, value in department.dict(exclude_unset=True).items():
        setattr(db_department, key, value)
    
    db.commit()
    db.refresh(db_department)
    return db_department

def delete_department(db: Session, department_id: int) -> bool:
    """Delete a department."""
    department = get_department(db, department_id)
    db.delete(department)
    db.commit()
    return True