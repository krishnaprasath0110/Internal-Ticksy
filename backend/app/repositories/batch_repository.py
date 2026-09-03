from sqlalchemy.orm import Session, joinedload
from app.db.models.batch import Batch
from app.db.models.program import Program
from app.schemas.batch_schema import BatchCreate, BatchUpdate
from fastapi import HTTPException, status
from typing import List

def create_batch(db: Session, batch: BatchCreate) -> Batch:
    """Create a new batch."""
    db_batch = Batch(**batch.model_dump())
    db.add(db_batch)
    db.commit()
    db.refresh(db_batch)
    return get_batch(db, db_batch.id)  # Return with relationships loaded

def get_batch(db: Session, batch_id: int) -> Batch:
    """Get a batch by ID."""
    batch = (db.query(Batch)
            .options(
                joinedload(Batch.program).joinedload(Program.university)
            )
            .filter(Batch.id == batch_id)
            .first())
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Batch not found"
        )
    return batch

def get_batches(db: Session) -> List[Batch]:
    """Get all batches."""
    return (db.query(Batch)
            .options(
                joinedload(Batch.program).joinedload(Program.university)
            )
            .all())

def update_batch(db: Session, batch_id: int, batch: BatchUpdate) -> Batch:
    """Update a batch."""
    db_batch = get_batch(db, batch_id)
    
    for key, value in batch.model_dump(exclude_unset=True).items():
        setattr(db_batch, key, value)
    
    db.commit()
    db.refresh(db_batch)
    return get_batch(db, batch_id)  # Return with relationships loaded