from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.orm import relationship
from app.db.base import Base

class Status(Base):
    __tablename__ = 'ticket_statuses'
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False, unique=True)
    description = Column(String, nullable=True)
    
    # Relationships
    tickets = relationship("Ticket", back_populates="status")
    
    def __repr__(self):
        return f"<Status(id={self.id}, name={self.name})>"
