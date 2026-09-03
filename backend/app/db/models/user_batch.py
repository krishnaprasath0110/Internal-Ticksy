from sqlalchemy import Column, Integer, ForeignKey
from app.db.base import Base
from sqlalchemy.orm import relationship

class UserBatch(Base):
    __tablename__ = "user_batches"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="user_batches")
    batch = relationship("Batch", back_populates="user_batches")
    
    def __repr__(self):
        return f"UserBatch(id={self.id}, user_id={self.user_id}, batch_id={self.batch_id})"
