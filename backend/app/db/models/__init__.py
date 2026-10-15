"""
Import all models here to ensure proper loading order and avoid circular dependencies.
"""
# Import base first
from app.db.base import Base

# First, import models with minimal dependencies
# from app.db.models.role import Role
# from app.db.models.status import Status

# Then import models with dependencies on the above
# from app.db.models.user import User
# from app.db.models.department import Department
# from app.db.models.category import Category

# # Then import models with dependencies on users, departments, and categories
# from app.db.models.user_department import UserDepartment
# from app.db.models.user_category import UserCategory

# Finally import models with dependencies on all above
from app.db.models.issue_type import IssueType
from app.db.models.disposition import Disposition
from app.db.models.ticket import Ticket
from app.db.models.team import Team
from app.db.models.template import Template
from app.db.models.template_department import TemplateDepartment
from app.db.models.template_category import TemplateCategory
from app.db.models.template_batch import TemplateBatch
# from app.db.models.thread import Thread

# This ensures all models are loaded before relationships are established
