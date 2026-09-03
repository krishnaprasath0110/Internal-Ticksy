from app.db.models.status import Status
from sqlalchemy.orm import Session
from app.db.session import get_db
from fastapi import Depends

def get_all_statuses(db: Session = Depends(get_db)) -> list[Status]:
    """
    Get all available statuses
    Returns a list of Status objects with id, name, and description
    """
    return db.query(Status).order_by(Status.id).all()
