"""Create template management tables and link users to templates."""

from sqlalchemy import text

from app.db.session import engine


def upgrade():
    statements = [
        """
        CREATE TABLE IF NOT EXISTS templates (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100) NOT NULL UNIQUE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        )
        """,
        """
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES templates(id)
        """,
        """
        CREATE TABLE IF NOT EXISTS template_departments (
            template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
            department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
            PRIMARY KEY (template_id, department_id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS template_categories (
            template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
            category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
            PRIMARY KEY (template_id, category_id)
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS template_batches (
            template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
            batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
            PRIMARY KEY (template_id, batch_id)
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_templates_id ON templates(id)",
        "CREATE INDEX IF NOT EXISTS ix_templates_name ON templates(name)",
        "CREATE INDEX IF NOT EXISTS ix_users_template_id ON users(template_id)",
    ]

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))

    print("Template database migration completed successfully")


def downgrade():
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE users DROP COLUMN IF EXISTS template_id"))
        connection.execute(text("DROP TABLE IF EXISTS template_batches"))
        connection.execute(text("DROP TABLE IF EXISTS template_categories"))
        connection.execute(text("DROP TABLE IF EXISTS template_departments"))
        connection.execute(text("DROP TABLE IF EXISTS templates"))

    print("Template database migration reverted successfully")


if __name__ == "__main__":
    upgrade()
