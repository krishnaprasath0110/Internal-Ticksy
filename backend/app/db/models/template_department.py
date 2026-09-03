from sqlalchemy import Column, Integer, ForeignKey
from app.db.base import Base


class TemplateDepartment(Base):
    __tablename__ = 'template_departments'

    template_id = Column(Integer, ForeignKey('templates.id'), primary_key=True)
    department_id = Column(Integer, ForeignKey('departments.id'), primary_key=True)
