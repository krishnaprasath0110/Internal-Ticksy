from sqlalchemy.orm import Session
from app.db.models.ticket import Ticket
from app.db.models.thread import Thread
from app.db.models.user import User
from app.db.models.user_batch import UserBatch
from app.services.chromadb_service import find_similar_answer, find_similar_answer_for_batch, has_batch_faq_collection
from app.core.config import settings
from typing import Optional
from sqlalchemy import event
import logging
from sqlalchemy.orm import sessionmaker
from app.db.session import engine, get_db

logger = logging.getLogger(__name__)


def get_user_batch_id(db: Session, user_id: int) -> Optional[int]:
    """Get the batch ID for a user based on their batch assignment"""
    try:
        # Get user's batch
        user_batch = db.query(UserBatch).filter(UserBatch.user_id == user_id).first()
        if not user_batch:
            logger.warning(f"No batch found for user {user_id}")
            return None
        
        return user_batch.batch_id
    except Exception as e:
        logger.error(f"Error getting batch ID for user {user_id}: {str(e)}")
        return None

DEFAULT_RESPONSE = """Thank you for reaching out to Futurense Support.

Your ticket has been received and our team will review it shortly. We strive to provide timely assistance for all inquiries.

If you need further assistance, feel free to reply to this ticket.

Regards,
Futurense Support Team"""

def create_auto_response(ticket: Ticket, connection) -> Optional[int]:
    """
    Create an automated response for a ticket if a similar question is found
    Returns the thread ID if a response was created, None otherwise
    """
    try:
        # Create a session bound to the connection
        Session = sessionmaker(bind=connection)
        db = Session()
        
        try:
            # Combine title and description for better matching
            query_text = f"{ticket.description} - {ticket.title}"
            
            # Find similar answer
            answer = find_similar_answer(query_text)
            
            if answer:
                # Create automated response thread
                thread = Thread(
                    ticket_id=ticket.id,
                    user_id=settings.SYSTEM_USER_ID,
                    message=f"{answer}\n\n" + 
                           "(This is an automated response. " +
                              "Our support team will review and provide additional assistance if needed.)",
                          is_system=True
                )
                
                db.add(thread)
                db.commit()
                logger.info(f"Created AI-generated response for ticket #{ticket.id}")
                return thread.id
            
            return None
            
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error generating response for ticket #{ticket.id}: {str(e)}")
        return None

def generate_auto_response(ticket_id: int, title: str, description: str, user_id: int = None):
    """
    Background task function to generate an AI response for a ticket
    This function is designed to be run in a FastAPI background task
    """
    try:
        # Get a new database session
        db = next(get_db())
        
        try:
            # Get the ticket from the database
            ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
            
            if not ticket:
                logger.error(f"Ticket {ticket_id} not found for auto-response generation")
                return
            
            # Get the batch ID for the ticket creator
            creator_id = user_id or ticket.created_by
            batch_id = get_user_batch_id(db, creator_id)
            
            # Combine title and description for better matching
            query_text = f"{description} {title}"
            
            # Find similar answer using batch-specific FAQ ONLY if available
            answer = None
            if batch_id and has_batch_faq_collection(batch_id):
                answer = find_similar_answer_for_batch(query_text, batch_id)
                logger.info(f"Searching FAQ for batch {batch_id}")
                
                if answer:
                    # Create automated response thread
                    thread = Thread(
                        ticket_id=ticket_id,
                        user_id=settings.SYSTEM_USER_ID,
                        message=f"{answer}\n\n" + 
                               "(This is an automated response. " +
                               "Our support team will review and provide additional assistance if needed.)",
                           is_system=True
                    )
                    
                    db.add(thread)
                    db.commit()
                    logger.info(f"Created AI-generated response for ticket #{ticket_id} using batch {batch_id} FAQ")
                else:
                    logger.info(f"No matching FAQ found for batch {batch_id}, skipping auto-response")
            else:
                logger.info(f"No batch FAQ collection found for batch {batch_id}, skipping auto-response")
                
        finally:
            db.close()
            
    except Exception as e:
        logger.error(f"Error generating response for ticket #{ticket_id}: {str(e)}")

def handle_new_ticket(mapper, connection, target):
    """Event handler for new ticket creation"""
    logger.info(f"New ticket event received for ticket {target.id}")
    thread_id = create_auto_response(target, connection)
    if thread_id:
        logger.info(f"Successfully created auto-response thread {thread_id}")
    else:
        logger.info("No auto-response created")

def initialize(db: Session):
    """Initialize the auto-response service"""
    # Register the event listener for ticket creation
    # We're no longer using this event-based approach
    # event.listen(Ticket, 'after_insert', handle_new_ticket)
    logger.info("Auto-response service initialized")

def get_instance(db: Session):
    """Get the auto-response service instance"""
    initialize(db)
    return handle_new_ticket
