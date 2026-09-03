from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.base import Base

class UserDepartment(Base):
    __tablename__ = 'user_departments'
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    department_id = Column(Integer, ForeignKey('departments.id'), nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="user_departments")
    department = relationship("Department", back_populates="user_departments")
    
    # Ensure a user can't be assigned to the same department twice
    __table_args__ = (
        UniqueConstraint('user_id', 'department_id', name='uq_user_department'),
    )
    
    def __repr__(self):
        return f"<UserDepartment(id={self.id}, user_id={self.user_id}, department_id={self.department_id})>"