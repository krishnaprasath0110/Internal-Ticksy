from sqlalchemy import Column, Integer, String, ForeignKey, Boolean
from app.db.base import Base
from sqlalchemy.orm import relationship

class University(Base):
    __tablename__ = "universities"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, index=True)
    description = Column(String, index=True)
    
    programs = relationship("Program", back_populates="university")