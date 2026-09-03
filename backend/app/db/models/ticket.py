from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, DateTime, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.base import Base
from datetime import datetime, timezone
from typing import List

class Ticket(Base):
    __tablename__ = 'tickets'
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    title = Column(String, index=True, nullable=False)
    description = Column(String, nullable=False)
    attachments = Column(JSON, nullable=True)  # Store list of URLs as JSON
    created_by = Column(Integer, ForeignKey('users.id'), nullable=False)
    status_id = Column(Integer, ForeignKey('ticket_statuses.id'), nullable=False)
    category_id = Column(Integer, ForeignKey('categories.id'), nullable=False)
    issue_type_id = Column(Integer, ForeignKey('issue_types.id'), nullable=True)
    disposition_id = Column(Integer, ForeignKey('dispositions.id'), nullable=True)
    assigned_to = Column(Integer, ForeignKey('users.id'), nullable=True)
    is_delayed = Column(Boolean, default=False)
    email_message_id = Column(String, nullable=True)  # Store the original email Message-ID
    closed_by = Column(Integer, ForeignKey('users.id'), nullable=True)  # Track who closed the ticket
    priority = Column(String(10), nullable=True)  # Priority: 'high', 'medium', 'low' (internal use only)

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    closed_at = Column(DateTime(timezone=True), nullable=True)  # Track when ticket was closed
    # Relationships
    status = relationship("Status", back_populates="tickets")
    category = relationship("Category", back_populates="tickets")
    issue_type = relationship("IssueType", back_populates="tickets")
    disposition = relationship("Disposition", back_populates="tickets")
    threads = relationship("Thread", back_populates="ticket", cascade="all, delete-orphan")
    creator = relationship("User", foreign_keys=[created_by], back_populates="created_tickets")
    assignee = relationship("User", foreign_keys=[assigned_to], back_populates="assigned_tickets")
    closer = relationship("User", foreign_keys=[closed_by], back_populates="closed_tickets")
    
    def __repr__(self):
        return f"<Ticket(id={self.id}, title={self.title})>"