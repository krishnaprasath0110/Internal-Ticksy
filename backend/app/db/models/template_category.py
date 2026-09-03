from sqlalchemy import Column, Integer, ForeignKey
from app.db.base import Base


class TemplateCategory(Base):
    __tablename__ = 'template_categories'

    template_id = Column(Integer, ForeignKey('templates.id'), primary_key=True)
    category_id = Column(Integer, ForeignKey('categories.id'), primary_key=True)
