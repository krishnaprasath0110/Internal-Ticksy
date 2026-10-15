"""
Create teams and associate internal employees with a team.
"""

import sys
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(backend_dir))

from sqlalchemy import text
from app.db.session import engine


def upgrade():
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS teams (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                description VARCHAR(255) NULL
            )
        """))
        conn.execute(text("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS team_id INTEGER NULL REFERENCES teams(id)
        """))
    print("Created teams and users.team_id")


def downgrade():
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE users DROP COLUMN team_id"))
        conn.execute(text("DROP TABLE teams"))
    print("Removed teams and users.team_id")


if __name__ == "__main__":
    try:
        upgrade()
    except Exception as error:
        print(f"Migration failed: {error}")
        sys.exit(1)
