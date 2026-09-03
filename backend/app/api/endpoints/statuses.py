from fastapi import APIRouter, Depends
from app.db.session import get_db
from app.repositories import status_repository
from app.schemas.status_schema import StatusResponse
from sqlalchemy.orm import Session

router = APIRouter()

@router.get("/", response_model=list[StatusResponse])
def get_all_ticket_statuses(db: Session = Depends(get_db)):
    """
    Get all available ticket statuses.
    This endpoint is public and does not require authentication.
    Returns a list of possible ticket statuses with their descriptions.
    """
    return status_repository.get_all_statuses(db)
