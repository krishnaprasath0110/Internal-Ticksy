from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db.session import get_db
from app.repositories import issue_type_repository
from app.schemas.issue_type_schema import (
    DispositionCreate,
    DispositionResponse,
    IssueTypeCreate,
    IssueTypeResponse,
)
from app.schemas.user_schema import UserResponse

router = APIRouter()


def _ensure_internal_user(current_user: UserResponse):
    allowed_roles = {"agent", "department-manager", "department-supervisor", "admin"}
    if current_user.role.name not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only internal users can access issue type metadata",
        )


@router.get("/", response_model=List[IssueTypeResponse])
def list_issue_types(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    _ensure_internal_user(current_user)
    return issue_type_repository.get_issue_types(db)


@router.get("/{issue_type_id}/dispositions", response_model=List[DispositionResponse])
def list_dispositions(
    issue_type_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    _ensure_internal_user(current_user)
    return issue_type_repository.get_dispositions(db, issue_type_id)


@router.post("/", response_model=IssueTypeResponse, status_code=status.HTTP_201_CREATED)
def create_issue_type(
    payload: IssueTypeCreate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    if current_user.role.name != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can create issue types")
    return issue_type_repository.create_issue_type(db, payload)


@router.post("/dispositions", response_model=DispositionResponse, status_code=status.HTTP_201_CREATED)
def create_disposition(
    payload: DispositionCreate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user),
):
    if current_user.role.name != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only admins can create dispositions")
    return issue_type_repository.create_disposition(db, payload)

