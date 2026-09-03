from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.base import Base

class UserCategory(Base):
    __tablename__ = 'user_categories'
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    category_id = Column(Integer, ForeignKey('categories.id'), nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="user_categories")
    category = relationship("Category", back_populates="user_categories")
    
    # Ensure a user can't be assigned to the same category twice
    __table_args__ = (
        UniqueConstraint('user_id', 'category_id', name='uq_user_category'),
    )
    
    def __repr__(self):
        return f"<UserCategory(id={self.id}, user_id={self.user_id}, category_id={self.category_id})>"
