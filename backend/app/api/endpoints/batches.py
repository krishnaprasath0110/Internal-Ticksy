from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.db.models.user import User
from app.core.auth import get_current_user
from app.schemas.batch_schema import BatchCreate, BatchUpdate, BatchResponse, FaqUploadResponse
from app.repositories import batch_repository
from app.services.chromadb_service import (
    load_faq_data_from_file,
    get_all_batch_faqs,
    get_batch_faq_count,
    has_batch_faq_collection,
    delete_batch_collection
)
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.post("/", response_model=BatchResponse)
def create_batch(
    batch: BatchCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new batch."""
    if not current_user.role.name == 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return batch_repository.create_batch(db, batch)

@router.get("/", response_model=List[BatchResponse])
def get_batches(db: Session = Depends(get_db)):
    """Get all batches."""
    return batch_repository.get_batches(db)

@router.get("/{batch_id}", response_model=BatchResponse)
def get_batch(
    batch_id: int,
    db: Session = Depends(get_db)
):
    """Get a batch by ID."""
    return batch_repository.get_batch(db, batch_id)

@router.put("/{batch_id}", response_model=BatchResponse)
def update_batch(
    batch_id: int,
    batch: BatchUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a batch."""
    if not current_user.role.name == 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return batch_repository.update_batch(db, batch_id, batch)

@router.delete("/{batch_id}")
def delete_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a batch."""
    if not current_user.role.name == 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    # Also delete the FAQ collection for this batch
    delete_batch_collection(batch_id)
    batch_repository.delete_batch(db, batch_id)
    return {"message": "Batch deleted successfully"}


# ============== FAQ Management Endpoints ==============

def process_faq_upload_task(batch_id: int, content: bytes, filename: str):
    """Background task to process FAQ upload."""
    try:
        logger.info(f"Starting background FAQ upload for batch {batch_id}")
        result = load_faq_data_from_file(batch_id, content, filename)
        logger.info(f"Completed FAQ upload for batch {batch_id}: {result['message']}")
    except Exception as e:
        logger.error(f"Error processing FAQ upload for batch {batch_id}: {str(e)}")


@router.post("/{batch_id}/faq/upload", response_model=FaqUploadResponse)
async def upload_faq_file(
    batch_id: int,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Upload FAQ file (CSV or Excel) for a specific batch. Processing happens in background."""
    if not current_user.role.name == 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # Verify batch exists
    batch = batch_repository.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Batch not found"
        )
    
    # Validate file type
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be CSV or Excel format (.csv, .xlsx, .xls)"
        )
    
    try:
        # Read file content
        content = await file.read()
        
        # Add background task to process the FAQ upload
        background_tasks.add_task(process_faq_upload_task, batch_id, content, file.filename)
        
        # Return immediate response
        return FaqUploadResponse(
            success=True,
            total_rows=0,  # Will be processed in background
            processed_rows=0,  # Will be processed in background
            message=f"FAQ upload started for batch '{batch.name}'. Processing in background...",
            batch_id=batch_id,
            batch_name=batch.name
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/{batch_id}/faq")
def get_batch_faqs(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all FAQs for a specific batch."""
    # Verify batch exists
    batch = batch_repository.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Batch not found"
        )
    
    faqs = get_all_batch_faqs(batch_id)
    return {
        "batch_id": batch_id,
        "batch_name": batch.name,
        "faq_count": len(faqs),
        "faqs": faqs
    }


@router.get("/{batch_id}/faq/status")
def get_batch_faq_status(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get FAQ status for a specific batch."""
    # Verify batch exists
    batch = batch_repository.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Batch not found"
        )
    
    has_collection = has_batch_faq_collection(batch_id)
    faq_count = get_batch_faq_count(batch_id) if has_collection else 0
    
    return {
        "batch_id": batch_id,
        "batch_name": batch.name,
        "has_faq_collection": has_collection,
        "faq_count": faq_count
    }


@router.delete("/{batch_id}/faq")
def delete_batch_faqs(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete all FAQs for a specific batch."""
    if not current_user.role.name == 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    # Verify batch exists
    batch = batch_repository.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Batch not found"
        )
    
    deleted = delete_batch_collection(batch_id)
    
    if deleted:
        return {"message": f"FAQ collection deleted for batch {batch.name}"}
    else:
        return {"message": f"No FAQ collection found for batch {batch.name}"}
