"""Add the marker used for automated ticket posts."""

from sqlalchemy import text

from app.db.session import engine


def upgrade():
    with engine.begin() as connection:
        connection.execute(text(
            "ALTER TABLE ticket_threads "
            "ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE"
        ))


def downgrade():
    with engine.begin() as connection:
        connection.execute(text(
            "ALTER TABLE ticket_threads DROP COLUMN IF EXISTS is_system"
        ))


if __name__ == "__main__":
    upgrade()
    print("System thread marker migration completed successfully")