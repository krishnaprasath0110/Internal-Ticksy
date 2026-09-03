from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base
from app.db.models.user_department import UserDepartment

class Department(Base):
    __tablename__ = 'departments'
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    
    # Relationships
    user_departments = relationship("UserDepartment", back_populates="department")
    categories = relationship("Category", back_populates="department")
    templates = relationship("Template", secondary="template_departments", back_populates="departments")

    def __repr__(self):
        return f"<Department(id={self.id}, name={self.name}, description={self.description})>"
