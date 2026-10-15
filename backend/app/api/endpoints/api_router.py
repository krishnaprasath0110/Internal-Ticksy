from fastapi import APIRouter
from app.api.endpoints import users, tickets, categories, departments, auth, roles, statuses, dashboard, universities, programs, batches, issue_types, templates, teams

api_router = APIRouter(
    prefix="/api",
)

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(teams.router, prefix="/teams", tags=["teams"])
api_router.include_router(tickets.router, prefix="/tickets", tags=["tickets"])
api_router.include_router(statuses.router, prefix="/statuses", tags=["statuses"])
api_router.include_router(roles.router, prefix="/roles", tags=["roles"])
api_router.include_router(categories.router, prefix="/categories", tags=["categories"])
api_router.include_router(departments.router, prefix="/departments", tags=["departments"])
api_router.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(universities.router, prefix="/universities", tags=["universities"])
api_router.include_router(programs.router, prefix="/programs", tags=["programs"])
api_router.include_router(batches.router, prefix="/batches", tags=["batches"])
api_router.include_router(issue_types.router, prefix="/issue-types", tags=["issue-types"])
api_router.include_router(templates.router, prefix="/templates", tags=["templates"])
