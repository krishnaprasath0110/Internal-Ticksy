# from sqlalchemy.orm import Session
# from app.db.models.admin import Admin
# from app.schemas.admin_schema import AdminCreate

# def get_admin_by_email(db: Session, email: str) -> Admin | None:
#     return db.query(Admin).filter(Admin.email == email).first()

# def get_admin_by_id(db: Session, admin_id: int) -> Admin | None:
#     return db.query(Admin).filter(Admin.admin_id == admin_id).first()

# def get_all_admins(db: Session) -> list[Admin]:
#     return db.query(Admin).all()

# def create_admin(admin: AdminCreate, db: Session) -> Admin:
#     db_admin = Admin(
#         name=admin.name,
#         email=admin.email,
#         password=admin.password,
#         role_id=admin.role_id
#     )
#     db.add(db_admin)
#     db.commit()
#     db.refresh(db_admin)
#     return db_admin