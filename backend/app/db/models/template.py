from sqlalchemy import Column, Integer, String, DateTime, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class Template(Base):
    __tablename__ = 'templates'

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    departments = relationship(
        'Department',
        secondary='template_departments',
        back_populates='templates',
        cascade='save-update, merge'
    )
    categories = relationship(
        'Category',
        secondary='template_categories',
        back_populates='templates',
        cascade='save-update, merge'
    )
    batches = relationship(
        'Batch',
        secondary='template_batches',
        back_populates='templates',
        cascade='save-update, merge'
    )
    users = relationship('User', back_populates='template')

    def __repr__(self):
        return f"<Template(id={self.id}, name={self.name})>"
