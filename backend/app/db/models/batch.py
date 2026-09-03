from sqlalchemy import Column, Integer, String, ForeignKey
from app.db.base import Base
from sqlalchemy.orm import relationship

class Batch(Base):
    __tablename__ = "batches"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, index=True)
    description = Column(String, index=True)
    program_id = Column(Integer, ForeignKey("programs.id"))
    
    program = relationship("Program", back_populates="batches")
    user_batches = relationship("UserBatch", back_populates="batch",cascade="all, delete-orphan")
    templates = relationship("Template", secondary="template_batches", back_populates="batches")