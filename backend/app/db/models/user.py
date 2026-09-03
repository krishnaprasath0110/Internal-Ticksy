from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
from app.db.base import Base
from sqlalchemy.orm import relationship
from app.db.models.user_department import UserDepartment
from app.db.models.user_category import UserCategory
from app.db.models.user_batch import UserBatch
from app.db.models.ticket import Ticket

class User(Base):
    __tablename__ = 'users'
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    role_id = Column(Integer, ForeignKey('roles.id'), nullable=False)
    template_id = Column(Integer, ForeignKey('templates.id'), nullable=True)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    role = relationship("Role", back_populates="users")
    user_departments = relationship("UserDepartment", back_populates="user", cascade="all, delete-orphan")
    user_categories = relationship("UserCategory", back_populates="user",cascade="all, delete-orphan")
    user_batches = relationship("UserBatch", back_populates="user",cascade="all, delete-orphan")
    categories = relationship("Category", secondary="user_categories", back_populates="users", overlaps="user_categories,category,user")
    template = relationship("Template", back_populates="users")
    
    # Ticket relationships
    created_tickets = relationship("Ticket", back_populates="creator", foreign_keys=[Ticket.created_by])
    assigned_tickets = relationship("Ticket", back_populates="assignee", foreign_keys=[Ticket.assigned_to])
    closed_tickets = relationship("Ticket", back_populates="closer", foreign_keys=[Ticket.closed_by])
    
    # Thread relationship
    threads = relationship("Thread", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User(id={self.id}, name={self.name}, email={self.email})>"