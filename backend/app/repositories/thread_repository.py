from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.db.models.thread import Thread
from app.db.models.user import User
from app.schemas.thread_schema import ThreadCreate, ThreadResponse

def create_thread(db: Session, thread_data: ThreadCreate, ticket_id: int, user_id: int) -> Thread:
    """
    Create a new thread for a ticket
    
    Args:
        db: Database session
        thread_data: Thread data from request (message)
        ticket_id: ID of the ticket this thread belongs to
        user_id: ID of the user creating the thread
    """
    db_thread = Thread(
        ticket_id=ticket_id,
        user_id=user_id,
        message=thread_data.message,
        attachments=[],  # Initialize with empty JSON array
        is_system=False,
        created_at=func.now()
    )
    db.add(db_thread)
    db.commit()
    db.refresh(db_thread)
    return db_thread

def get_threads_by_ticket(ticket_id: int, db: Session) -> list[Thread]:
    """Get all threads for a ticket with user information"""
    return (
        db.query(Thread)
        .join(Thread.user)
        .options(joinedload(Thread.user))
        .filter(Thread.ticket_id == ticket_id)
        .order_by(Thread.id.asc())
        .all()
    )

def get_thread_by_id(thread_id: int, db: Session) -> Thread | None:
    """Get a specific thread with user information"""
    return (
        db.query(Thread)
        .join(Thread.user)
        .options(joinedload(Thread.user))
        .filter(Thread.id == thread_id)
        .first()
    )

def update_thread_attachments(thread_id: int, attachments: list[str], db: Session) -> Thread:
    """Update thread attachments with S3 URLs"""
    db_thread = db.query(Thread).filter(Thread.id == thread_id).first()
    if db_thread:
        # Ensure we have a valid list of URLs
        clean_attachments = [url for url in attachments if isinstance(url, str) and url.strip()]
        # Store as JSON array
        db_thread.attachments = clean_attachments if clean_attachments else []
        db.commit()
        db.refresh(db_thread)
    return db_thread
