from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base

class Thread(Base):
    __tablename__ = "ticket_threads"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(String, nullable=False)
    attachments = Column(JSON, nullable=True, default=list)
    is_system = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime, server_default=func.now())
    
    # Relationships
    ticket = relationship("Ticket", back_populates="threads")
    user = relationship("User", back_populates="threads")
    
    def __repr__(self):
        return f"<Thread(id={self.id}, ticket_id={self.ticket_id}, user_id={self.user_id})>"
