from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, case, or_, and_, extract
from app.db.models.ticket import Ticket
from app.db.models.status import Status
from app.db.models.department import Department
from app.db.models.category import Category
from app.db.models.user import User
from app.db.models.thread import Thread
from datetime import datetime, timezone
from app.db.models.user_department import UserDepartment
from app.db.models.user_category import UserCategory
from app.db.models.user_batch import UserBatch
from app.db.models.role import Role
from sqlalchemy.orm import joinedload
from app.db.models.user_category import UserCategory
from app.repositories.ticket_repository import (
    normalize_datetime,
    build_ticket_agent_mapping_subquery,
    apply_creator_program_batch_filter,
)
from app.repositories.status_filters import (
    status_is_open,
    status_is_in_progress,
    status_is_closed_only,
    status_is_not_applicable,
    status_is_closed_or_na,
)


def _normalize_department_ids(department_ids: List[int] = None) -> List[int]:
    if not department_ids:
        return []
    return [d for d in department_ids if d is not None]


def _apply_ticket_department_filter(query, department_ids: List[int] = None):
    """Scope metrics to tickets whose category belongs to the given departments."""
    if department_ids is None:
        return query
    ids = _normalize_department_ids(department_ids)
    if not ids:
        return query.filter(Ticket.id.is_(None))
    return query.join(Category, Ticket.category_id == Category.id).filter(
        Category.department_id.in_(ids)
    )


def get_dashboard_ticket_counts(
    db: Session,
    department_ids: List[int] = None,
    agent_id: int = None,
    user_id: int = None,
    program_id: int = None,
    batch_id: int = None,
) -> Dict[str, int]:
    """
    Get ticket counts by status using SQL aggregates.
    Much faster than fetching all tickets and counting in Python.
    
    Args:
        db: Database session
        department_ids: Filter by department IDs (for managers/supervisors)
        agent_id: Filter by agent's visible tickets (for agents)
        user_id: Filter by ticket creator (for candidates)
    """
    # Base query - count tickets with status info
    query = db.query(
        func.count(Ticket.id).label('total'),
        func.sum(case((status_is_open(), 1), else_=0)).label('open_active'),
        func.sum(case((Status.name == 'open', 1), else_=0)).label('open_only'),
        func.sum(case((status_is_in_progress(), 1), else_=0)).label('in_progress'),
        func.sum(case((status_is_closed_only(), 1), else_=0)).label('closed_only'),
        func.sum(case((status_is_not_applicable(), 1), else_=0)).label('not_applicable'),
        func.sum(case((status_is_closed_or_na(), 1), else_=0)).label('closed'),
        func.sum(case((Ticket.is_delayed == True, 1), else_=0)).label('delayed'),
        func.sum(case((and_(Ticket.is_delayed == True, Status.name == 'open'), 1), else_=0)).label('delayed_open'),
        func.sum(case((and_(Ticket.is_delayed == True, status_is_in_progress()), 1), else_=0)).label('delayed_in_progress'),
        func.sum(case((and_(Ticket.is_delayed == True, status_is_closed_or_na()), 1), else_=0)).label('delayed_closed'),
    ).join(Status, Ticket.status_id == Status.id)

    # Apply role-based filters
    query = _apply_ticket_department_filter(query, department_ids)
    query = apply_creator_program_batch_filter(query, program_id, batch_id)

    if user_id:
        query = query.filter(Ticket.created_by == user_id)

    if agent_id:
        # For agents: count tickets they can see (assigned_to them OR in their categories+batches)
        agent = db.query(User).filter(User.id == agent_id).first()
        if agent:
            agent_category_ids = [uc.category_id for uc in agent.user_categories]
            agent_batch_ids = [ub.batch_id for ub in agent.user_batches]

            manually_assigned = Ticket.assigned_to == agent_id

            if agent_batch_ids and agent_category_ids:
                # A ticket is visible to an agent if:
                # - creator has a batch that the agent handles (batch+category match), OR
                # - creator has no batch, OR
                # - creator has a batch but there are no batch+category agents for that ticket/category (fallback to category)
                creator_batch_sq = (
                    db.query(
                        UserBatch.user_id.label("user_id"),
                        func.min(UserBatch.batch_id).label("batch_id"),
                    )
                    .group_by(UserBatch.user_id)
                    .subquery("creator_batch")
                )

                # Exists: any agent handles (ticket.category_id, creator_batch_id)
                agent_cat_batch_exists = (
                    db.query(UserCategory.user_id)
                    .join(UserBatch, UserBatch.user_id == UserCategory.user_id)
                    .join(User, User.id == UserCategory.user_id)
                    .join(Role, User.role_id == Role.id)
                    .filter(
                        UserCategory.category_id == Ticket.category_id,
                        UserBatch.batch_id == creator_batch_sq.c.batch_id,
                        Role.name == "agent",
                        User.is_active == True,
                    )
                    .exists()
                )

                # Visible unassigned tickets for this agent
                batch_assigned = and_(
                    Ticket.assigned_to.is_(None),
                    Ticket.category_id.in_(agent_category_ids),
                    Ticket.created_by.in_(
                        db.query(UserBatch.user_id)
                        .filter(UserBatch.batch_id.in_(agent_batch_ids))
                        .subquery()
                    ),
                )

                creator_has_no_batch = and_(
                    Ticket.assigned_to.is_(None),
                    Ticket.category_id.in_(agent_category_ids),
                    ~Ticket.created_by.in_(db.query(creator_batch_sq.c.user_id)),
                )

                fallback_no_batch_agents = and_(
                    Ticket.assigned_to.is_(None),
                    Ticket.category_id.in_(agent_category_ids),
                    Ticket.created_by.in_(db.query(creator_batch_sq.c.user_id)),
                    ~agent_cat_batch_exists,
                )

                auto_assigned = or_(batch_assigned, creator_has_no_batch, fallback_no_batch_agents)
            elif agent_category_ids:
                auto_assigned = and_(
                    Ticket.assigned_to.is_(None),
                    Ticket.category_id.in_(agent_category_ids)
                )
            else:
                auto_assigned = Ticket.assigned_to == agent_id

            query = query.filter(or_(manually_assigned, auto_assigned))
        else:
            # Agent not found, return zeros
            return {
                'total': 0, 'open': 0, 'in_progress': 0, 'closed': 0,
                'not_applicable': 0, 'delayed': 0, 'delayed_open': 0,
                'delayed_in_progress': 0, 'delayed_closed': 0
            }

    result = query.one()

    return {
        'total': result.total or 0,
        # Top dashboard cards: raw status counts (analysis metrics roll up separately)
        'open': result.open_only or 0,
        'in_progress': result.in_progress or 0,
        'closed': result.closed_only or 0,
        'not_applicable': result.not_applicable or 0,
        'delayed': result.delayed or 0,
        'delayed_open': result.delayed_open or 0,
        'delayed_in_progress': result.delayed_in_progress or 0,
        'delayed_closed': result.delayed_closed or 0,
    }


async def get_ticket_metrics(db: Session) -> Dict[str, int]:
    # Get total tickets
    total_tickets = db.query(func.count(Ticket.id)).scalar() or 0
    
    # Get ticket counts by status
    status_counts = db.query(
        Status.name,
        func.count(Ticket.id)
    ).join(
        Ticket, Status.id == Ticket.status_id
    ).group_by(Status.name).all()
    
    # Initialize counts
    metrics = {
        'total': total_tickets,
        'open': 0,
        'closed': 0,
        'not_applicable': 0
    }
    
    # Update counts based on status
    for status_name, count in status_counts:
        status_lower = status_name.lower()
        if 'open' in status_lower:
            metrics['open'] = count
        elif 'close' in status_lower:
            metrics['closed'] = count
        elif 'not applicable' in status_lower or 'na' in status_lower:
            metrics['not_applicable'] = count
            
    return metrics

async def get_department_metrics(db: Session) -> List[Dict[str, Any]]:
    # Get ticket counts by department
    dept_metrics = db.query(
        Department.id.label('department_id'),
        Department.name.label('department_name'),
        func.count(Ticket.id).label('total'),
        func.sum(case((status_is_open(), 1), else_=0)).label('open'),
        func.sum(case((status_is_closed_or_na(), 1), else_=0)).label('closed'),
        func.sum(case((status_is_not_applicable(), 1), else_=0)).label('not_applicable'),
    ).select_from(Ticket)\
     .join(Status, Ticket.status_id == Status.id)\
     .join(Category, Ticket.category_id == Category.id)\
     .join(Department, Category.department_id == Department.id)\
     .group_by(Department.id, Department.name)\
     .all()
     
    return [dict(row) for row in dept_metrics]

async def get_category_metrics(db: Session) -> List[Dict[str, Any]]:
    # Get ticket counts by category
    cat_metrics = db.query(
        Category.id.label('category_id'),
        Category.name.label('category_name'),
        Department.name.label('department_name'),
        func.count(Ticket.id).label('total'),
        func.sum(case((status_is_open(), 1), else_=0)).label('open'),
        func.sum(case((status_is_closed_or_na(), 1), else_=0)).label('closed'),
        func.sum(case((status_is_not_applicable(), 1), else_=0)).label('not_applicable'),
    ).select_from(Ticket)\
     .join(Status, Ticket.status_id == Status.id)\
     .join(Category, Ticket.category_id == Category.id)\
     .join(Department, Category.department_id == Department.id)\
     .group_by(Category.id, Category.name, Department.name)\
     .all()
     
    return [dict(row) for row in cat_metrics]

async def get_agent_metrics(db: Session) -> List[Dict[str, Any]]:
    """
    Agent-wise ticket counts.
    IMPORTANT: Must follow Ticksy assignment visibility for auto-assigned tickets:
    category+batch preferred, else category fallback. Multiple agents can map to one ticket.
    """
    tam = build_ticket_agent_mapping_subquery(db)

    agent_metrics = (
        db.query(
            tam.c.agent_id.label("agent_id"),
            User.name.label("agent_name"),
            func.count(func.distinct(tam.c.ticket_id)).label("total"),
            func.sum(case((status_is_open(), 1), else_=0)).label("open"),
            func.sum(case((status_is_closed_or_na(), 1), else_=0)).label("closed"),
            func.sum(case((status_is_not_applicable(), 1), else_=0)).label("not_applicable"),
            func.sum(case((status_is_in_progress(), 1), else_=0)).label("in_progress"),
        )
        .select_from(tam)
        .join(User, User.id == tam.c.agent_id)
        .join(Ticket, Ticket.id == tam.c.ticket_id)
        .join(Status, Ticket.status_id == Status.id)
        .join(Category, Ticket.category_id == Category.id)
        .join(Department, Category.department_id == Department.id)
        .join(Role, User.role_id == Role.id)
        .filter(Role.name == "agent", User.is_active == True)
        .group_by(tam.c.agent_id, User.name)
        .all()
    )

    return [dict(row) for row in agent_metrics]

async def get_resolution_time_metrics(
    db: Session,
    start_date=None,
    end_date=None,
    department_ids=None,
    program_id: int = None,
    batch_id: int = None,
) -> Dict[str, Any]:
    """
    Calculate resolution time metrics for closed tickets using SQL aggregates.
    Resolution time = time between ticket creation and closure
    """
    # resolution_hours as a SQL expression
    resolution_hours = extract('epoch', Ticket.updated_at - Ticket.created_at) / 3600.0

    query = db.query(
        func.count(Ticket.id).label('total_closed'),
        func.sum(case((resolution_hours <= 8, 1), else_=0)).label('within_8_hours'),
        func.sum(case((and_(resolution_hours > 8, resolution_hours <= 24), 1), else_=0)).label('within_24_hours'),
        func.sum(case((and_(resolution_hours > 24, resolution_hours <= 48), 1), else_=0)).label('within_48_hours'),
        func.sum(case((resolution_hours > 48, 1), else_=0)).label('beyond_48_hours'),
        func.avg(resolution_hours).label('avg_hours'),
    ).join(Status, Ticket.status_id == Status.id)\
     .filter(status_is_closed_or_na())\
     .filter(Ticket.created_at.isnot(None), Ticket.updated_at.isnot(None))

    if start_date:
        query = query.filter(Ticket.updated_at >= start_date)
    if end_date:
        query = query.filter(Ticket.updated_at <= end_date)
    query = _apply_ticket_department_filter(query, department_ids)
    query = apply_creator_program_batch_filter(query, program_id, batch_id)

    row = query.one()

    return {
        'within_8_hours': row.within_8_hours or 0,
        'within_24_hours': row.within_24_hours or 0,
        'within_48_hours': row.within_48_hours or 0,
        'beyond_48_hours': row.beyond_48_hours or 0,
        'total_closed': row.total_closed or 0,
        'average_resolution_hours': round(float(row.avg_hours or 0), 2)
    }

async def get_open_ticket_ageing_metrics(
    db: Session,
    start_date=None,
    end_date=None,
    department_ids=None,
    program_id: int = None,
    batch_id: int = None,
) -> Dict[str, Any]:
    """
    Calculate SLA metrics for open tickets based on first agent response time.
    Optimized: uses a subquery for first agent response instead of N+1 queries.
    """
    from app.db.models.thread import Thread
    from sqlalchemy import literal_column
    from sqlalchemy.sql import functions as sqlfunc

    # Subquery: first agent response time per ticket
    first_response_sq = (
        db.query(
            Thread.ticket_id,
            func.min(Thread.created_at).label('first_response_at')
        )
        .join(User, Thread.user_id == User.id)
        .join(Role, User.role_id == Role.id)
        .filter(Role.name == 'agent')
        .group_by(Thread.ticket_id)
        .subquery('fr')
    )

    # effective_hours: if agent responded use (response - created), else use (now - created)
    now_expr = func.now()
    effective_hours = extract('epoch',
        func.coalesce(first_response_sq.c.first_response_at, now_expr) - Ticket.created_at
    ) / 3600.0

    query = db.query(
        func.sum(case((Status.name == 'open', 1), else_=0)).label('open'),
        func.sum(case((status_is_in_progress(), 1), else_=0)).label('in_progress'),
        func.count(Ticket.id).label('total_active'),
        func.sum(case((effective_hours < 12, 1), else_=0)).label('frt_low'),
        func.sum(case((and_(effective_hours >= 12, effective_hours < 20), 1), else_=0)).label('frt_medium'),
        func.sum(case((and_(effective_hours >= 20, effective_hours <= 24), 1), else_=0)).label('frt_high'),
        func.sum(case((effective_hours > 24, 1), else_=0)).label('frt_breached'),
        func.avg(effective_hours).label('avg_hours'),
    ).join(Status, Ticket.status_id == Status.id)\
     .outerjoin(first_response_sq, Ticket.id == first_response_sq.c.ticket_id)\
     .filter(status_is_open())\
     .filter(Ticket.created_at.isnot(None))

    if start_date:
        query = query.filter(Ticket.created_at >= start_date)
    if end_date:
        query = query.filter(Ticket.created_at <= end_date)
    query = _apply_ticket_department_filter(query, department_ids)
    query = apply_creator_program_batch_filter(query, program_id, batch_id)

    row = query.one()

    return {
        'open': int(row.open or 0),
        'in_progress': int(row.in_progress or 0),
        'total_active': int(row.total_active or 0),
        'frt_low': int(row.frt_low or 0),
        'frt_medium': int(row.frt_medium or 0),
        'frt_high': int(row.frt_high or 0),
        'frt_breached': int(row.frt_breached or 0),
        'average_response_hours': round(float(row.avg_hours or 0), 2)
    }

async def get_agent_resolution_time_metrics(
    db: Session,
    start_date=None,
    end_date=None,
    department_ids=None,
    program_id: int = None,
    batch_id: int = None,
) -> List[Dict[str, Any]]:
    """
    Calculate resolution time metrics for each agent using SQL aggregates.
    Includes both explicitly assigned tickets AND category-matched unassigned tickets.
    """
    from app.db.models.user_department import UserDepartment

    # Correct mapping: assigned + (batch+category preferred) + category fallback
    tam = build_ticket_agent_mapping_subquery(db)

    resolution_hours = extract('epoch', Ticket.updated_at - Ticket.created_at) / 3600.0

    query = db.query(
        tam.c.agent_id,
        User.name.label('agent_name'),
        User.email.label('agent_email'),
        func.count(tam.c.ticket_id).label('total_closed'),
        func.sum(case((resolution_hours <= 8, 1), else_=0)).label('within_8_hours'),
        func.sum(case((and_(resolution_hours > 8, resolution_hours <= 24), 1), else_=0)).label('within_24_hours'),
        func.sum(case((and_(resolution_hours > 24, resolution_hours <= 48), 1), else_=0)).label('within_48_hours'),
        func.sum(case((resolution_hours > 48, 1), else_=0)).label('beyond_48_hours'),
        func.avg(resolution_hours).label('avg_hours'),
    ).select_from(tam)\
     .join(Ticket, Ticket.id == tam.c.ticket_id)\
     .join(User, User.id == tam.c.agent_id)\
     .join(Status, Ticket.status_id == Status.id)\
     .join(Role, User.role_id == Role.id)\
     .filter(Role.name == 'agent', User.is_active == True)\
     .filter(status_is_closed_or_na())\
     .filter(Ticket.created_at.isnot(None), Ticket.updated_at.isnot(None))

    if start_date:
        query = query.filter(Ticket.updated_at >= start_date)
    if end_date:
        query = query.filter(Ticket.updated_at <= end_date)
    query = _apply_ticket_department_filter(query, department_ids)
    query = apply_creator_program_batch_filter(query, program_id, batch_id)

    query = query.group_by(tam.c.agent_id, User.name, User.email)
    rows = query.all()

    # Bulk-fetch department names for these agents
    agent_ids = [r.agent_id for r in rows]
    dept_map = {}
    if agent_ids:
        dept_rows = db.query(
            UserDepartment.user_id,
            Department.name
        ).join(Department, UserDepartment.department_id == Department.id)\
         .filter(UserDepartment.user_id.in_(agent_ids)).all()
        for uid, dname in dept_rows:
            dept_map.setdefault(uid, set()).add(dname)

    agent_metrics = []
    for row in rows:
        agent_metrics.append({
            'agent_id': row.agent_id,
            'agent_name': row.agent_name,
            'agent_email': row.agent_email,
            'departments': list(dept_map.get(row.agent_id, [])),
            'within_8_hours': row.within_8_hours or 0,
            'within_24_hours': row.within_24_hours or 0,
            'within_48_hours': row.within_48_hours or 0,
            'beyond_48_hours': row.beyond_48_hours or 0,
            'total_closed': row.total_closed or 0,
            'average_resolution_hours': round(float(row.avg_hours or 0), 2)
        })

    agent_metrics.sort(key=lambda x: x['total_closed'], reverse=True)
    return agent_metrics

async def get_agent_open_ticket_ageing_metrics(
    db: Session,
    start_date=None,
    end_date=None,
    department_ids=None,
    program_id: int = None,
    batch_id: int = None,
) -> List[Dict[str, Any]]:
    """
    Calculate open ticket SLA metrics per agent using SQL aggregates.
    Includes both explicitly assigned tickets AND category-matched unassigned tickets.
    """
    from app.db.models.thread import Thread
    from app.db.models.user_department import UserDepartment

    # Correct mapping: assigned + (batch+category preferred) + category fallback
    tam = build_ticket_agent_mapping_subquery(db)

    # Subquery: first agent response time per ticket
    first_response_sq = (
        db.query(
            Thread.ticket_id,
            func.min(Thread.created_at).label('first_response_at')
        )
        .join(User, Thread.user_id == User.id)
        .join(Role, User.role_id == Role.id)
        .filter(Role.name == 'agent')
        .group_by(Thread.ticket_id)
        .subquery('fr')
    )

    now_expr = func.now()
    effective_hours = extract('epoch',
        func.coalesce(first_response_sq.c.first_response_at, now_expr) - Ticket.created_at
    ) / 3600.0

    query = db.query(
        tam.c.agent_id,
        User.name.label('agent_name'),
        User.email.label('agent_email'),
        func.sum(case((Status.name == 'open', 1), else_=0)).label('open'),
        func.sum(case((status_is_in_progress(), 1), else_=0)).label('in_progress'),
        func.count(tam.c.ticket_id).label('total_active'),
        func.sum(case((effective_hours <= 24, 1), else_=0)).label('within_24_hours'),
        func.sum(case((and_(effective_hours > 24, effective_hours <= 48), 1), else_=0)).label('within_48_hours'),
        func.sum(case((effective_hours > 48, 1), else_=0)).label('beyond_48_hours'),
        func.avg(effective_hours).label('avg_hours'),
    ).select_from(tam)\
     .join(Ticket, Ticket.id == tam.c.ticket_id)\
     .join(User, User.id == tam.c.agent_id)\
     .join(Status, Ticket.status_id == Status.id)\
     .join(Role, User.role_id == Role.id)\
     .outerjoin(first_response_sq, Ticket.id == first_response_sq.c.ticket_id)\
     .filter(Role.name == 'agent', User.is_active == True)\
     .filter(status_is_open())\
     .filter(Ticket.created_at.isnot(None))

    if start_date:
        query = query.filter(Ticket.created_at >= start_date)
    if end_date:
        query = query.filter(Ticket.created_at <= end_date)
    query = _apply_ticket_department_filter(query, department_ids)
    query = apply_creator_program_batch_filter(query, program_id, batch_id)

    query = query.group_by(tam.c.agent_id, User.name, User.email)
    rows = query.all()

    # Bulk-fetch department names
    agent_ids = [r.agent_id for r in rows]
    dept_map = {}
    if agent_ids:
        dept_rows = db.query(
            UserDepartment.user_id,
            Department.name
        ).join(Department, UserDepartment.department_id == Department.id)\
         .filter(UserDepartment.user_id.in_(agent_ids)).all()
        for uid, dname in dept_rows:
            dept_map.setdefault(uid, set()).add(dname)

    agent_metrics = []
    for row in rows:
        agent_metrics.append({
            'agent_id': row.agent_id,
            'agent_name': row.agent_name,
            'agent_email': row.agent_email,
            'departments': list(dept_map.get(row.agent_id, [])),
            'open': int(row.open or 0),
            'in_progress': int(row.in_progress or 0),
            'total_active': int(row.total_active or 0),
            'within_24_hours': row.within_24_hours or 0,
            'within_48_hours': row.within_48_hours or 0,
            'beyond_48_hours': row.beyond_48_hours or 0,
            'average_response_hours': round(float(row.avg_hours or 0), 2)
        })

    agent_metrics.sort(key=lambda x: x['total_active'], reverse=True)
    return agent_metrics

def get_priority_metrics(
    db: Session,
    start_date: str = None,
    end_date: str = None,
    department_ids: List[int] = None,
    program_id: int = None,
    batch_id: int = None,
) -> Dict[str, int]:
    """
    Get overall priority metrics using SQL aggregates.
    Scoped by ticket category department when department_ids is provided.
    """
    from datetime import datetime as dt

    query = db.query(
        func.count(Ticket.id).label('total'),
        func.sum(case((Ticket.priority == 'high', 1), else_=0)).label('high'),
        func.sum(case((Ticket.priority == 'medium', 1), else_=0)).label('medium'),
        func.sum(case((Ticket.priority == 'low', 1), else_=0)).label('low'),
    )

    query = _apply_ticket_department_filter(query, department_ids)
    query = apply_creator_program_batch_filter(query, program_id, batch_id)

    if start_date:
        query = query.filter(Ticket.created_at >= dt.strptime(start_date, '%Y-%m-%d'))
    if end_date:
        query = query.filter(Ticket.created_at <= dt.strptime(end_date, '%Y-%m-%d'))

    row = query.one()

    return {
        'high': row.high or 0,
        'medium': row.medium or 0,
        'low': row.low or 0,
        'total': row.total or 0
    }

def get_agent_priority_metrics(
    db: Session,
    start_date: str = None,
    end_date: str = None,
    department_ids: List[int] = None,
    program_id: int = None,
    batch_id: int = None,
) -> List[Dict[str, Any]]:
    """
    Get agent-wise priority metrics using SQL aggregates.
    Counts only active tickets (open + in-progress).
    Includes both explicitly assigned tickets AND category-matched unassigned tickets.
    Scoped by ticket category department when department_ids is provided.
    """
    from datetime import datetime as dt
    from app.db.models.user_department import UserDepartment

    # Correct mapping: assigned + (batch+category preferred) + category fallback
    tam = build_ticket_agent_mapping_subquery(db)

    query = db.query(
        tam.c.agent_id,
        User.name.label('agent_name'),
        User.email.label('agent_email'),
        func.count(tam.c.ticket_id).label('total'),
        func.sum(case((Ticket.priority == 'high', 1), else_=0)).label('high'),
        func.sum(case((Ticket.priority == 'medium', 1), else_=0)).label('medium'),
        func.sum(case((Ticket.priority == 'low', 1), else_=0)).label('low'),
    ).select_from(tam)\
     .join(Ticket, Ticket.id == tam.c.ticket_id)\
     .join(Status, Ticket.status_id == Status.id)\
     .join(User, User.id == tam.c.agent_id)\
     .join(Role, User.role_id == Role.id)\
     .filter(Role.name == 'agent', User.is_active == True, status_is_open())

    query = _apply_ticket_department_filter(query, department_ids)
    query = apply_creator_program_batch_filter(query, program_id, batch_id)

    if start_date:
        query = query.filter(Ticket.created_at >= dt.strptime(start_date, '%Y-%m-%d'))
    if end_date:
        query = query.filter(Ticket.created_at <= dt.strptime(end_date, '%Y-%m-%d'))

    query = query.group_by(tam.c.agent_id, User.name, User.email)
    rows = query.all()

    # Bulk-fetch department names
    agent_ids = [r.agent_id for r in rows]
    dept_map = {}
    if agent_ids:
        dept_rows = db.query(
            UserDepartment.user_id,
            Department.name
        ).join(Department, UserDepartment.department_id == Department.id)\
         .filter(UserDepartment.user_id.in_(agent_ids)).all()
        for uid, dname in dept_rows:
            dept_map.setdefault(uid, set()).add(dname)

    agent_metrics = []
    for row in rows:
        agent_metrics.append({
            'agent_id': row.agent_id,
            'agent_name': row.agent_name,
            'agent_email': row.agent_email,
            'departments': list(dept_map.get(row.agent_id, [])),
            'high': row.high or 0,
            'medium': row.medium or 0,
            'low': row.low or 0,
            'total': row.total or 0
        })

    agent_metrics.sort(key=lambda x: x['total'], reverse=True)
    return agent_metrics


def _closure_sla_bucket_row(row, prefix: str) -> Dict[str, int]:
    low = int(getattr(row, f'{prefix}_low') or 0)
    medium = int(getattr(row, f'{prefix}_medium') or 0)
    high = int(getattr(row, f'{prefix}_high') or 0)
    breached = int(getattr(row, f'{prefix}_breached') or 0)
    return {
        'low': low,
        'medium': medium,
        'high': high,
        'breached': breached,
        'total': low + medium + high + breached,
    }


async def get_closure_sla_metrics(
    db: Session,
    start_date=None,
    end_date=None,
    department_ids=None,
    program_id: int = None,
    batch_id: int = None,
) -> Dict[str, Any]:
    """
    Closure / resolution SLA health for active (open + in-progress) tickets.
    Age = hours since ticket creation.

  72h scheme — all categories except Academic Affairs (category TAT breach < 120h):
      Low <36h | Medium 36–60h | High 60–72h | Breached >72h

  120h scheme — Academic Affairs department (category TAT breach limit 120h):
      Low <60h | Medium 60–96h | High 96–120h | Breached >120h
    """
    from sqlalchemy import not_

    age_hours = extract('epoch', func.now() - Ticket.created_at) / 3600.0

    # Academic Affairs department uses 120h closure SLA buckets; all others use 72h
    is_120h_sla = Department.name.ilike('%academic affairs%')

    query = db.query(
        func.sum(case((and_(not_(is_120h_sla), age_hours < 36), 1), else_=0)).label('sla72_low'),
        func.sum(case((and_(not_(is_120h_sla), age_hours >= 36, age_hours < 60), 1), else_=0)).label('sla72_medium'),
        func.sum(case((and_(not_(is_120h_sla), age_hours >= 60, age_hours <= 72), 1), else_=0)).label('sla72_high'),
        func.sum(case((and_(not_(is_120h_sla), age_hours > 72), 1), else_=0)).label('sla72_breached'),
        func.sum(case((and_(is_120h_sla, age_hours < 60), 1), else_=0)).label('sla120_low'),
        func.sum(case((and_(is_120h_sla, age_hours >= 60, age_hours < 96), 1), else_=0)).label('sla120_medium'),
        func.sum(case((and_(is_120h_sla, age_hours >= 96, age_hours <= 120), 1), else_=0)).label('sla120_high'),
        func.sum(case((and_(is_120h_sla, age_hours > 120), 1), else_=0)).label('sla120_breached'),
    ).select_from(Ticket)\
     .join(Status, Ticket.status_id == Status.id)\
     .join(Category, Ticket.category_id == Category.id)\
     .join(Department, Category.department_id == Department.id)\
     .filter(status_is_open())\
     .filter(Ticket.created_at.isnot(None))

    if start_date:
        query = query.filter(Ticket.created_at >= start_date)
    if end_date:
        query = query.filter(Ticket.created_at <= end_date)

    if department_ids is not None:
        ids = _normalize_department_ids(department_ids)
        if not ids:
            query = query.filter(Ticket.id.is_(None))
        else:
            query = query.filter(Category.department_id.in_(ids))

    query = apply_creator_program_batch_filter(query, program_id, batch_id)

    row = query.one()

    return {
        'resolution_72h': _closure_sla_bucket_row(row, 'sla72'),
        'academic_affairs_120h': _closure_sla_bucket_row(row, 'sla120'),
    }
