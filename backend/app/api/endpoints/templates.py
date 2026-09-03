from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.models.user import User
from app.db.session import get_db
from app.repositories import template_repository
from app.schemas.template_schema import TemplateCreate, TemplateResponse, TemplateUpdate

router = APIRouter()


@router.post("/", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
def create_template(
    template: TemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role.name != 'admin':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    return template_repository.create_template(db, template)


@router.get("/", response_model=List[TemplateResponse])
def get_templates(db: Session = Depends(get_db)):
    return template_repository.get_templates(db)


@router.get("/{template_id}", response_model=TemplateResponse)
def get_template(template_id: int, db: Session = Depends(get_db)):
    return template_repository.get_template(db, template_id)


@router.put("/{template_id}", response_model=TemplateResponse)
def update_template(
    template_id: int,
    template: TemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role.name != 'admin':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    return template_repository.update_template(db, template_id, template)


@router.delete("/{template_id}")
def delete_template(
    template_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role.name != 'admin':
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")
    template_repository.delete_template(db, template_id)
    return {"message": "Template deleted successfully"}
