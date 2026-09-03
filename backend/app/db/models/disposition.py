from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.base import Base


class Disposition(Base):
    __tablename__ = "dispositions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    issue_type_id = Column(Integer, ForeignKey("issue_types.id"), nullable=False, index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    issue_type = relationship("IssueType", back_populates="dispositions")
    tickets = relationship("Ticket", back_populates="disposition")

