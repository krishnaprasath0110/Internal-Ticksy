"""
Migration: Add closed_by and closed_at fields to tickets table
This migration adds tracking for who closed the ticket and when it was closed.
For existing tickets, closed_at will default to updated_at if status is closed.
"""

from sqlalchemy import create_engine, text
from app.core.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_migration():
    """Add closed_by and closed_at columns to tickets table"""
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as conn:
        try:
            # Start transaction
            trans = conn.begin()
            
            # Check if columns already exist
            check_closed_by = text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='tickets' AND column_name='closed_by'
            """)
            
            check_closed_at = text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='tickets' AND column_name='closed_at'
            """)
            
            closed_by_exists = conn.execute(check_closed_by).fetchone()
            closed_at_exists = conn.execute(check_closed_at).fetchone()
            
            # Add closed_by column if it doesn't exist
            if not closed_by_exists:
                logger.info("Adding closed_by column to tickets table...")
                conn.execute(text("""
                    ALTER TABLE tickets 
                    ADD COLUMN closed_by INTEGER REFERENCES users(id)
                """))
                logger.info("✓ closed_by column added")
            else:
                logger.info("closed_by column already exists, skipping...")
            
            # Add closed_at column if it doesn't exist
            if not closed_at_exists:
                logger.info("Adding closed_at column to tickets table...")
                conn.execute(text("""
                    ALTER TABLE tickets 
                    ADD COLUMN closed_at TIMESTAMP
                """))
                logger.info("✓ closed_at column added")
                
                # Set closed_at = updated_at for existing closed tickets
                logger.info("Setting closed_at = updated_at for existing closed tickets...")
                conn.execute(text("""
                    UPDATE tickets 
                    SET closed_at = updated_at 
                    WHERE status_id IN (
                        SELECT id FROM ticket_statuses WHERE name ILIKE '%close%'
                    ) AND closed_at IS NULL
                """))
                logger.info("✓ closed_at populated for existing closed tickets")
            else:
                logger.info("closed_at column already exists, skipping...")
            
            # Commit transaction
            trans.commit()
            logger.info("Migration completed successfully!")
            
        except Exception as e:
            trans.rollback()
            logger.error(f"Migration failed: {str(e)}")
            raise

if __name__ == "__main__":
    run_migration()
