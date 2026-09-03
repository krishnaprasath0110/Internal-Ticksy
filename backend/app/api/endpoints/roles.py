from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.role_schema import Role, RoleCreate
from app.repositories import role_repository
from app.core.auth import get_current_user

router = APIRouter()

# READ Operations
@router.get('/', response_model=list[Role])
def get_roles(db: Session = Depends(get_db)):
    return role_repository.get_all_roles(db)

@router.get('/{role_id}', response_model=Role)
def get_role_by_id(role_id: int, db: Session = Depends(get_db)):
    return role_repository.get_role_by_id(role_id, db)
