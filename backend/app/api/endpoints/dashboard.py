from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from sqlalchemy.orm import Session
from datetime import datetime

from app.db.session import get_db
from app.schemas.dashboard_schema import (
    TicketMetrics,
    DepartmentMetrics,
    CategoryMetrics,
    AgentMetrics,
    DashboardOverviewResponse,
    DashboardTicketCounts,
    ResolutionTimeMetrics,
    OpenTicketAgeingMetrics,
    PriorityMetrics,
    AgentPriorityMetrics,
    ClosureSlaMetrics,
)
from app.repositories import dashboard_repository, user_repository, ticket_repository
from app.core.auth import get_current_user
from app.schemas.user_schema import UserResponse as UserSchema

router = APIRouter()


def _resolve_department_ids(db: Session, current_user: UserSchema) -> Optional[List[int]]:
    """
    Department scope for managers/supervisors from user_departments (authoritative).
    Admins and other roles see unscoped metrics (None).
    """
    user_roles = user_repository.get_user_roles(db, current_user.id)
    role_names = [r.name for r in user_roles]

    if "admin" in role_names:
        return None

    if "department-manager" in role_names or "department-supervisor" in role_names:
        return [
            ud.department_id
            for ud in (current_user.user_departments or [])
            if ud.department_id is not None
        ]

    return None


def _program_batch_kwargs(program_id: Optional[int], batch_id: Optional[int]) -> dict:
    kw = {}
    if program_id is not None:
        kw["program_id"] = program_id
    if batch_id is not None:
        kw["batch_id"] = batch_id
    return kw


@router.get("/ticket-counts", response_model=DashboardTicketCounts)
def get_dashboard_ticket_counts(
    program_id: Optional[int] = Query(None, description="Filter by ticket creator's program"),
    batch_id: Optional[int] = Query(None, description="Filter by ticket creator's batch"),
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(get_current_user)
):
    """
    Get ticket counts by status using SQL aggregates.
    Much faster than fetching all tickets (~50ms vs ~15s).
    Role-aware: admin sees all, manager/supervisor sees their departments,
    agent sees their categories+batches, candidate sees own tickets.
    """
    user_roles = user_repository.get_user_roles(db, current_user.id)
    role_names = [r.name for r in user_roles]

    pb = _program_batch_kwargs(program_id, batch_id)
    department_ids = _resolve_department_ids(db, current_user)
    if department_ids is not None:
        return dashboard_repository.get_dashboard_ticket_counts(
            db, department_ids=department_ids, **pb
        )

    # Admin sees all
    if "admin" in role_names:
        return dashboard_repository.get_dashboard_ticket_counts(db, **pb)

    # Agent
    if "agent" in role_names:
        return dashboard_repository.get_dashboard_ticket_counts(
            db, agent_id=current_user.id, **pb
        )

    # Candidate / regular user
    return dashboard_repository.get_dashboard_ticket_counts(
        db, user_id=current_user.id, **pb
    )


@router.get("/overview", response_model=DashboardOverviewResponse)
async def get_dashboard_overview(
    db: Session = Depends(get_db),
    # current_user: UserSchema = Depends(get_current_user)
):
    """
    Get dashboard overview with all metrics including resolution time
    """
    # if current_user.role.name.lower() != 'admin':
    #     raise HTTPException(status_code=403, detail="Only admin users can access dashboard data")
    
    return {
        "metrics": await dashboard_repository.get_ticket_metrics(db),
        "departments": await dashboard_repository.get_department_metrics(db),
        "categories": await dashboard_repository.get_category_metrics(db),
        "agents": await dashboard_repository.get_agent_metrics(db),
        "resolution_time": await dashboard_repository.get_resolution_time_metrics(db)
    }

@router.get("/departments", response_model=List[DepartmentMetrics])
async def get_department_metrics(
    db: Session = Depends(get_db),
    # current_user: UserSchema = Depends(get_current_user)
):
    """
    Get ticket metrics grouped by department
    """
    # if current_user.role.name.lower() != 'admin':
    #     raise HTTPException(status_code=403, detail="Only admin users can access dashboard data")
    
    return await dashboard_repository.get_department_metrics(db)

@router.get("/categories", response_model=List[CategoryMetrics])
async def get_category_metrics(
    db: Session = Depends(get_db),
    # current_user: UserSchema = Depends(get_current_user)
):
    """
    Get ticket metrics grouped by category
    """
    # if current_user.role.name.lower() != 'admin':
    #     raise HTTPException(status_code=403, detail="Only admin users can access dashboard data")
    
    return await dashboard_repository.get_category_metrics(db)

@router.get("/agents", response_model=List[AgentMetrics])
async def get_agent_metrics(
    db: Session = Depends(get_db),
    # current_user: UserSchema = Depends(get_current_user)
):
    """
    Get ticket metrics grouped by agent
    """
    # if current_user.role.name.lower() != 'admin':
    #     raise HTTPException(status_code=403, detail="Only admin users can access dashboard data")
    
    return await dashboard_repository.get_agent_metrics(db)

@router.get("/resolution-time", response_model=ResolutionTimeMetrics)
async def get_resolution_time_metrics(
    start_date: Optional[str] = Query(None, description="Start date in YYYY-MM-DD format"),
    end_date: Optional[str] = Query(None, description="End date in YYYY-MM-DD format"),
    program_id: Optional[int] = Query(None, description="Filter by ticket creator's program"),
    batch_id: Optional[int] = Query(None, description="Filter by ticket creator's batch"),
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(get_current_user)
):
    """
    Get ticket resolution time metrics for closed tickets.
    Optionally filter by date range.
    Role-based: Supervisors/Managers see only their department's data, Admins see all
    """
    # Parse dates if provided
    start_dt = None
    end_dt = None
    
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")
    
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")
    
    department_ids = _resolve_department_ids(db, current_user)
    pb = _program_batch_kwargs(program_id, batch_id)
    return await dashboard_repository.get_resolution_time_metrics(
        db, start_dt, end_dt, department_ids=department_ids, **pb
    )

@router.get("/resolution-time/agents")
async def get_agent_resolution_time_metrics(
    start_date: Optional[str] = Query(None, description="Start date in YYYY-MM-DD format"),
    end_date: Optional[str] = Query(None, description="End date in YYYY-MM-DD format"),
    program_id: Optional[int] = Query(None, description="Filter by ticket creator's program"),
    batch_id: Optional[int] = Query(None, description="Filter by ticket creator's batch"),
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(get_current_user)
):
    """
    Get agent-wise resolution time metrics for closed tickets.
    Optionally filter by date range.
    Role-based: Supervisors/Managers see only their department's agents, Admins see all agents
    """
    # Parse dates if provided
    start_dt = None
    end_dt = None
    
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")
    
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")
    
    department_ids = _resolve_department_ids(db, current_user)
    pb = _program_batch_kwargs(program_id, batch_id)
    return await dashboard_repository.get_agent_resolution_time_metrics(
        db, start_dt, end_dt, department_ids=department_ids, **pb
    )

@router.get("/open-ticket-ageing", response_model=OpenTicketAgeingMetrics)
async def get_open_ticket_ageing_metrics(
    start_date: Optional[str] = Query(None, description="Start date in YYYY-MM-DD format"),
    end_date: Optional[str] = Query(None, description="End date in YYYY-MM-DD format"),
    program_id: Optional[int] = Query(None, description="Filter by ticket creator's program"),
    batch_id: Optional[int] = Query(None, description="Filter by ticket creator's batch"),
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(get_current_user)
):
    """
    Get open ticket ageing metrics (0-24h, 24-48h, 48+h).
    Optionally filter by date range.
    Role-based: Supervisors/Managers see only their department's data, Admins see all
    """
    # Parse dates if provided
    start_dt = None
    end_dt = None
    
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")
    
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")
    
    department_ids = _resolve_department_ids(db, current_user)
    pb = _program_batch_kwargs(program_id, batch_id)
    return await dashboard_repository.get_open_ticket_ageing_metrics(
        db, start_dt, end_dt, department_ids=department_ids, **pb
    )

@router.get("/open-ticket-ageing/agents")
async def get_agent_open_ticket_ageing_metrics(
    start_date: Optional[str] = Query(None, description="Start date in YYYY-MM-DD format"),
    end_date: Optional[str] = Query(None, description="End date in YYYY-MM-DD format"),
    program_id: Optional[int] = Query(None, description="Filter by ticket creator's program"),
    batch_id: Optional[int] = Query(None, description="Filter by ticket creator's batch"),
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(get_current_user)
):
    """
    Get agent-wise open ticket ageing metrics.
    Optionally filter by date range.
    Role-based: Supervisors/Managers see only their department's agents, Admins see all agents
    """
    # Parse dates if provided
    start_dt = None
    end_dt = None
    
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")
    
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")
    
    department_ids = _resolve_department_ids(db, current_user)
    pb = _program_batch_kwargs(program_id, batch_id)
    return await dashboard_repository.get_agent_open_ticket_ageing_metrics(
        db, start_dt, end_dt, department_ids=department_ids, **pb
    )

@router.get("/priority-metrics", response_model=PriorityMetrics)
def get_priority_metrics(
    start_date: Optional[str] = Query(None, description="Start date in YYYY-MM-DD format"),
    end_date: Optional[str] = Query(None, description="End date in YYYY-MM-DD format"),
    program_id: Optional[int] = Query(None, description="Filter by ticket creator's program"),
    batch_id: Optional[int] = Query(None, description="Filter by ticket creator's batch"),
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(get_current_user)
):
    """
    Get overall priority metrics for tickets
    Only for internal users (agents, managers, supervisors, admin)
    Filtered by department for managers/supervisors
    """
    # Check if user is internal
    allowed_roles = ['agent', 'department-manager', 'department-supervisor', 'admin']
    if current_user.role.name not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail="Only internal users can view priority metrics"
        )
    
    # Validate date formats
    if start_date:
        try:
            datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")
    
    if end_date:
        try:
            datetime.strptime(end_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")
    
    department_ids = _resolve_department_ids(db, current_user)
    pb = _program_batch_kwargs(program_id, batch_id)
    return dashboard_repository.get_priority_metrics(
        db, start_date, end_date, department_ids=department_ids, **pb
    )

@router.get("/priority-metrics/agents", response_model=List[AgentPriorityMetrics])
def get_agent_priority_metrics(
    start_date: Optional[str] = Query(None, description="Start date in YYYY-MM-DD format"),
    end_date: Optional[str] = Query(None, description="End date in YYYY-MM-DD format"),
    program_id: Optional[int] = Query(None, description="Filter by ticket creator's program"),
    batch_id: Optional[int] = Query(None, description="Filter by ticket creator's batch"),
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(get_current_user)
):
    """
    Get agent-wise priority metrics
    Only for internal users (agents, managers, supervisors, admin)
    Filtered by department for managers/supervisors
    """
    # Check if user is internal
    allowed_roles = ['agent', 'department-manager', 'department-supervisor', 'admin']
    if current_user.role.name not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail="Only internal users can view priority metrics"
        )
    
    # Validate date formats
    if start_date:
        try:
            datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format. Use YYYY-MM-DD")
    
    if end_date:
        try:
            datetime.strptime(end_date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format. Use YYYY-MM-DD")
    
    department_ids = _resolve_department_ids(db, current_user)
    pb = _program_batch_kwargs(program_id, batch_id)
    return dashboard_repository.get_agent_priority_metrics(
        db, start_date, end_date, department_ids=department_ids, **pb
    )


@router.get("/closure-sla", response_model=ClosureSlaMetrics)
async def get_closure_sla_metrics(
    program_id: Optional[int] = Query(None, description="Filter by ticket creator's program"),
    batch_id: Optional[int] = Query(None, description="Filter by ticket creator's batch"),
    db: Session = Depends(get_db),
    current_user: UserSchema = Depends(get_current_user),
):
    """
    Closure / resolution SLA health for active tickets (open + in-progress).
    72h scheme for standard categories; 120h scheme for Academic Affairs (TAT >= 120h).
    """
    allowed_roles = ['department-manager', 'department-supervisor', 'admin']
    if current_user.role.name not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail="Only managers, supervisors, and admins can view closure SLA metrics",
        )

    department_ids = _resolve_department_ids(db, current_user)
    pb = _program_batch_kwargs(program_id, batch_id)
    return await dashboard_repository.get_closure_sla_metrics(
        db, department_ids=department_ids, **pb
    )
