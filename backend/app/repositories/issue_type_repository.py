from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.db.models.disposition import Disposition
from app.db.models.issue_type import IssueType
from app.schemas.issue_type_schema import DispositionCreate, IssueTypeCreate


def get_issue_types(db: Session, active_only: bool = True) -> List[IssueType]:
    query = db.query(IssueType).options(joinedload(IssueType.dispositions)).order_by(IssueType.name.asc())
    if active_only:
        query = query.filter(IssueType.is_active == True)
    return query.all()


def get_issue_type(db: Session, issue_type_id: int) -> Optional[IssueType]:
    return (
        db.query(IssueType)
        .options(joinedload(IssueType.dispositions))
        .filter(IssueType.id == issue_type_id)
        .first()
    )


def get_dispositions(db: Session, issue_type_id: int, active_only: bool = True) -> List[Disposition]:
    query = (
        db.query(Disposition)
        .filter(Disposition.issue_type_id == issue_type_id)
        .order_by(Disposition.name.asc())
    )
    if active_only:
        query = query.filter(Disposition.is_active == True)
    return query.all()


def create_issue_type(db: Session, payload: IssueTypeCreate) -> IssueType:
    issue_type = IssueType(**payload.model_dump())
    db.add(issue_type)
    db.commit()
    db.refresh(issue_type)
    return issue_type


def create_disposition(db: Session, payload: DispositionCreate) -> Disposition:
    issue_type = get_issue_type(db, payload.issue_type_id)
    if not issue_type:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Issue type not found")

    disposition = Disposition(**payload.model_dump())
    db.add(disposition)
    db.commit()
    db.refresh(disposition)
    return disposition

