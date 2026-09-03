"""
Migration script to add priority column to tickets table.
Priority is for internal use only (agents, managers, supervisors).
"""

import sys
import os
from pathlib import Path

# Add the backend directory to the Python path
backend_dir = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import text
from app.db.session import engine


def upgrade():
    """Add priority column to tickets table"""
    with engine.connect() as conn:
        # Add priority column (nullable, default NULL)
        # Values: 'high', 'medium', 'low', or NULL
        conn.execute(text("""
            ALTER TABLE tickets 
            ADD COLUMN priority VARCHAR(10) DEFAULT NULL;
        """))
        
        conn.commit()
        print("✓ Added priority column to tickets table")


def downgrade():
    """Remove priority column from tickets table"""
    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE tickets 
            DROP COLUMN priority;
        """))
        
        conn.commit()
        print("✓ Removed priority column from tickets table")


if __name__ == "__main__":
    print("Running migration: add_priority_to_tickets")
    try:
        upgrade()
        print("Migration completed successfully!")
    except Exception as e:
        print(f"Migration failed: {e}")
        sys.exit(1)
