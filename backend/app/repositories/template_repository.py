from typing import List

from fastapi import HTTPException, status
from sqlalchemy.orm import Session, joinedload

from app.db.models.department import Department
from app.db.models.category import Category
from app.db.models.batch import Batch
from app.db.models.template import Template


def get_template(db: Session, template_id: int) -> Template:
    template = (
        db.query(Template)
        .options(
            joinedload(Template.departments),
            joinedload(Template.categories),
            joinedload(Template.batches),
        )
        .filter(Template.id == template_id)
        .first()
    )
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return template


def get_templates(db: Session) -> List[Template]:
    return (
        db.query(Template)
        .options(
            joinedload(Template.departments),
            joinedload(Template.categories),
            joinedload(Template.batches),
        )
        .order_by(Template.id)
        .all()
    )


def create_template(db: Session, template_data) -> Template:
    if db.query(Template).filter(Template.name == template_data.name).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Template name already exists")

    template = Template(name=template_data.name)

    if template_data.department_ids:
        departments = db.query(Department).filter(Department.id.in_(template_data.department_ids)).all()
        if len(departments) != len(set(template_data.department_ids)):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more departments not found")
        template.departments = departments

    if template_data.category_ids:
        categories = db.query(Category).filter(Category.id.in_(template_data.category_ids)).all()
        if len(categories) != len(set(template_data.category_ids)):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more categories not found")
        template.categories = categories

    if template_data.batch_ids:
        batches = db.query(Batch).filter(Batch.id.in_(template_data.batch_ids)).all()
        if len(batches) != len(set(template_data.batch_ids)):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more batches not found")
        template.batches = batches

    db.add(template)
    db.commit()
    db.refresh(template)
    return get_template(db, template.id)


def update_template(db: Session, template_id: int, template_data) -> Template:
    template = get_template(db, template_id)

    if template_data.name is not None and template_data.name != template.name:
        existing = db.query(Template).filter(Template.name == template_data.name, Template.id != template_id).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Template name already exists")
        template.name = template_data.name

    if template_data.department_ids is not None:
        departments = db.query(Department).filter(Department.id.in_(template_data.department_ids)).all()
        if len(departments) != len(set(template_data.department_ids)):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more departments not found")
        template.departments = departments

    if template_data.category_ids is not None:
        categories = db.query(Category).filter(Category.id.in_(template_data.category_ids)).all()
        if len(categories) != len(set(template_data.category_ids)):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more categories not found")
        template.categories = categories

    if template_data.batch_ids is not None:
        batches = db.query(Batch).filter(Batch.id.in_(template_data.batch_ids)).all()
        if len(batches) != len(set(template_data.batch_ids)):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="One or more batches not found")
        template.batches = batches

    db.commit()
    db.refresh(template)
    return get_template(db, template.id)


def delete_template(db: Session, template_id: int) -> None:
    template = get_template(db, template_id)
    db.delete(template)
    db.commit()
