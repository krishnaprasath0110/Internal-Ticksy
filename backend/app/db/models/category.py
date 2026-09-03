from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.db.models.user_category import UserCategory

class Category(Base):
    __tablename__ = 'categories'
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    department_id = Column(Integer, ForeignKey('departments.id'), nullable=False)
    tat_minutes = Column(Integer, nullable=False, default=24)  # Default TAT time is 24 hours
    
    # Relationships
    department = relationship("Department", back_populates="categories")
    tickets = relationship("Ticket", back_populates="category")
    user_categories = relationship("UserCategory", back_populates="category", order_by="UserCategory.user_id")
    users = relationship("User", secondary="user_categories", back_populates="categories", overlaps="user,user_categories,category", order_by="User.name")
    templates = relationship("Template", secondary="template_categories", back_populates="categories")
    
    def __repr__(self):
        return f"<Category(id={self.id}, name={self.name})>"