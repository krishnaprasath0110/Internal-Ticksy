from sqlalchemy import Column, Integer, String, ForeignKey
from app.db.base import Base
from sqlalchemy.orm import relationship

class Program(Base):
    __tablename__ = "programs"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    name = Column(String, index=True)
    description = Column(String, index=True)
    university_id = Column(Integer, ForeignKey("universities.id"))
    
    # Email configuration
    email = Column(String, nullable=True, index=True)  # Email address for the program
    # email_host = Column(String, nullable=True)  # IMAP host (e.g., imap.gmail.com)
    # email_port = Column(Integer, nullable=True, default=993)  # IMAP port
    # email_username = Column(String, nullable=True)  # Email username/login
    email_password = Column(String, nullable=True)  # Email password (should be encrypted in production)
    
    university = relationship("University", back_populates="programs")
    batches = relationship("Batch", back_populates="program", cascade="all, delete-orphan")