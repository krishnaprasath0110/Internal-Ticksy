from sqlalchemy import Column, Integer, ForeignKey
from app.db.base import Base


class TemplateBatch(Base):
    __tablename__ = 'template_batches'

    template_id = Column(Integer, ForeignKey('templates.id'), primary_key=True)
    batch_id = Column(Integer, ForeignKey('batches.id'), primary_key=True)
