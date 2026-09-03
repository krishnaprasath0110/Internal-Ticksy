from sqlalchemy.orm import Session, joinedload
from fastapi import HTTPException, status
from app.db.models.ticket import Ticket
from app.db.models.user import User
from app.db.models.status import Status
from app.db.models.role import Role
from app.db.models.user_category import UserCategory
from app.db.models.user_department import UserDepartment
from app.db.models.category import Category
from app.db.models.disposition import Disposition
from app.db.models.issue_type import IssueType
from app.db.models.user_batch import UserBatch
from app.db.models.batch import Batch
from app.db.models.program import Program
from app.db.models.university import University
from app.db.models.thread import Thread
from app.schemas.ticket_schema import TicketCreate
from typing import List, Dict
from datetime import datetime, timedelta, timezone
from app.services.email_service import EmailService
from app.core.config import settings
import logging
from sqlalchemy import func, and_, or_, extract, case, exists, select
from app.repositories.status_filters import status_is_open, status_is_in_progress, status_is_closed_or_na, status_is_not_applicable, status_is_closed_only

logger = logging.getLogger(__name__)

AUTO_CLOSE_MESSAGE = "Auto-closed due to no response from the student for 1 minute."
AUTO_CLOSE_MINUTES = 1


def apply_creator_program_batch_filter(query, program_id: int = None, batch_id: int = None):
    """Filter tickets by the creator's program or batch (user_batches)."""
    if not program_id and not batch_id:
        return query
    if batch_id:
        creator_match = exists(
            select(1)
            .select_from(UserBatch)
            .where(
                UserBatch.user_id == Ticket.created_by,
                UserBatch.batch_id == batch_id,
            )
        )
    else:
        creator_match = exists(
            select(1)
            .select_from(UserBatch)
            .join(Batch, UserBatch.batch_id == Batch.id)
            .where(
                UserBatch.user_id == Ticket.created_by,
                Batch.program_id == program_id,
            )
        )
    return query.filter(creator_match)


def apply_creator_program_batch_join_filter(query, program_id: int = None, batch_id: int = None):
    """
    Join-based program/batch filter for ticket row queries.
    Matches ticket list filtering (creator's user_batches).
    """
    if not program_id and not batch_id:
        return query
    query = query.join(UserBatch, Ticket.created_by == UserBatch.user_id)
    if batch_id:
        query = query.filter(UserBatch.batch_id == batch_id)
    if program_id:
        query = query.join(Batch, UserBatch.batch_id == Batch.id)
        query = query.filter(Batch.program_id == program_id)
    return query.distinct()


def _first_agent_response_subquery(db: Session):
    """First agent thread timestamp per ticket (for FRT bucket filtering)."""
    return (
        db.query(
            Thread.ticket_id,
            func.min(Thread.created_at).label('first_response_at'),
        )
        .join(User, Thread.user_id == User.id)
        .join(Role, User.role_id == Role.id)
        .filter(Role.name == 'agent')
        .group_by(Thread.ticket_id)
        .subquery('fr')
    )


def _normalize_frt_bucket(frt_bucket: str) -> str:
    if not frt_bucket:
        return ''
    return frt_bucket.replace('frt_', '').lower()


def _apply_frt_bucket_filter(query, db: Session, frt_bucket: str):
    """Filter active tickets by first-response-time SLA bucket (matches dashboard)."""
    bucket = _normalize_frt_bucket(frt_bucket)
    if bucket not in ('low', 'medium', 'high', 'breached'):
        return query

    first_response_sq = _first_agent_response_subquery(db)
    effective_hours = extract(
        'epoch',
        func.coalesce(first_response_sq.c.first_response_at, func.now()) - Ticket.created_at,
    ) / 3600.0

    query = query.outerjoin(first_response_sq, Ticket.id == first_response_sq.c.ticket_id)
    query = query.filter(Ticket.created_at.isnot(None))

    if bucket == 'low':
        query = query.filter(effective_hours < 12)
    elif bucket == 'medium':
        query = query.filter(and_(effective_hours >= 12, effective_hours < 20))
    elif bucket == 'high':
        query = query.filter(and_(effective_hours >= 20, effective_hours <= 24))
    elif bucket == 'breached':
        query = query.filter(effective_hours > 24)

    return query


def _apply_closure_sla_filter(query, closure_sla: str):
    """
    Filter active tickets by closure SLA bucket (matches dashboard).
    closure_sla format: 'resolution_72h:low' or 'academic_affairs_120h:breached'
    """
    if not closure_sla or ':' not in closure_sla:
        return query

    scheme, bucket = closure_sla.split(':', 1)
    bucket = bucket.lower()
    if bucket not in ('low', 'medium', 'high', 'breached'):
        return query

    from app.db.models.department import Department

    age_hours = extract('epoch', func.now() - Ticket.created_at) / 3600.0
    is_120h_sla = exists(
        select(1)
        .select_from(Category)
        .join(Department, Category.department_id == Department.id)
        .where(
            Category.id == Ticket.category_id,
            Department.name.ilike('%academic affairs%'),
        )
    )

    query = query.filter(Ticket.created_at.isnot(None))

    if scheme == 'resolution_72h':
        query = query.filter(~is_120h_sla)
        if bucket == 'low':
            query = query.filter(age_hours < 36)
        elif bucket == 'medium':
            query = query.filter(and_(age_hours >= 36, age_hours < 60))
        elif bucket == 'high':
            query = query.filter(and_(age_hours >= 60, age_hours <= 72))
        elif bucket == 'breached':
            query = query.filter(age_hours > 72)
    elif scheme == 'academic_affairs_120h':
        query = query.filter(is_120h_sla)
        if bucket == 'low':
            query = query.filter(age_hours < 60)
        elif bucket == 'medium':
            query = query.filter(and_(age_hours >= 60, age_hours < 96))
        elif bucket == 'high':
            query = query.filter(and_(age_hours >= 96, age_hours <= 120))
        elif bucket == 'breached':
            query = query.filter(age_hours > 120)

    return query


def build_ticket_agent_mapping_subquery(db: Session):
    """
    Build a ticket->agent mapping subquery that matches Ticksy's assignment visibility:
    - If Ticket.assigned_to is set: that single agent is mapped.
    - If Ticket.assigned_to is NULL (auto-assigned):
        - Prefer agents who match BOTH (ticket.category_id) AND (creator's batch_id).
        - If creator has no batch OR no batch-matching agents exist for that ticket+category,
          fall back to all agents in the category.
    Result columns: ticket_id, agent_id
    """
    # Creator's (first) batch per user (a user might have multiple; we consistently pick min)
    creator_batch_sq = (
        db.query(
            UserBatch.user_id.label("user_id"),
            func.min(UserBatch.batch_id).label("batch_id"),
        )
        .group_by(UserBatch.user_id)
        .subquery("creator_batch")
    )

    # Active agents for category + batch
    agent_cat_batch_sq = (
        db.query(
            User.id.label("agent_id"),
            UserCategory.category_id.label("category_id"),
            UserBatch.batch_id.label("batch_id"),
        )
        .join(Role, User.role_id == Role.id)
        .join(UserCategory, User.id == UserCategory.user_id)
        .join(UserBatch, User.id == UserBatch.user_id)
        .filter(Role.name == "agent", User.is_active == True)
        .subquery("agent_cat_batch")
    )

    # Active agents for category (category-only fallback)
    agent_cat_sq = (
        db.query(
            User.id.label("agent_id"),
            UserCategory.category_id.label("category_id"),
        )
        .join(Role, User.role_id == Role.id)
        .join(UserCategory, User.id == UserCategory.user_id)
        .filter(Role.name == "agent", User.is_active == True)
        .subquery("agent_cat")
    )

    # 1) Manually assigned tickets
    assigned_q = db.query(
        Ticket.id.label("ticket_id"),
        Ticket.assigned_to.label("agent_id"),
    ).filter(Ticket.assigned_to.isnot(None))

    # 2) Auto-assigned tickets that have at least one batch+category agent match
    unassigned_batch_q = (
        db.query(
            Ticket.id.label("ticket_id"),
            agent_cat_batch_sq.c.agent_id.label("agent_id"),
        )
        .select_from(Ticket)
        .outerjoin(creator_batch_sq, creator_batch_sq.c.user_id == Ticket.created_by)
        .join(
            agent_cat_batch_sq,
            and_(
                agent_cat_batch_sq.c.category_id == Ticket.category_id,
                agent_cat_batch_sq.c.batch_id == creator_batch_sq.c.batch_id,
            ),
        )
        .filter(Ticket.assigned_to.is_(None))
    )

    # Tickets that actually have batch+category agents (used to exclude from fallback)
    has_batch_agents_sq = (
        db.query(Ticket.id.label("ticket_id"))
        .select_from(Ticket)
        .outerjoin(creator_batch_sq, creator_batch_sq.c.user_id == Ticket.created_by)
        .join(
            agent_cat_batch_sq,
            and_(
                agent_cat_batch_sq.c.category_id == Ticket.category_id,
                agent_cat_batch_sq.c.batch_id == creator_batch_sq.c.batch_id,
            ),
        )
        .filter(Ticket.assigned_to.is_(None))
        .distinct()
        .subquery("has_batch_agents")
    )

    # 3) Auto-assigned fallback: creator has no batch OR no batch+category agents exist
    unassigned_fallback_q = (
        db.query(
            Ticket.id.label("ticket_id"),
            agent_cat_sq.c.agent_id.label("agent_id"),
        )
        .select_from(Ticket)
        .outerjoin(creator_batch_sq, creator_batch_sq.c.user_id == Ticket.created_by)
        .join(agent_cat_sq, agent_cat_sq.c.category_id == Ticket.category_id)
        .outerjoin(has_batch_agents_sq, has_batch_agents_sq.c.ticket_id == Ticket.id)
        .filter(Ticket.assigned_to.is_(None))
        .filter(or_(creator_batch_sq.c.batch_id.is_(None), has_batch_agents_sq.c.ticket_id.is_(None)))
    )

    # NOTE: SQLAlchemy unions sometimes expose column keys based on the first selectable,
    # but depending on dialect/version the second column may not be reachable as `.c.agent_id`
    # even if labeled. We normalize by re-selecting the first two columns by position
    # and labeling them explicitly as `ticket_id` and `agent_id`.
    tam_u = assigned_q.union_all(unassigned_batch_q).union_all(unassigned_fallback_q).subquery("tam_u")
    tam_cols = list(tam_u.c)
    tam = (
        db.query(
            tam_cols[0].label("ticket_id"),
            tam_cols[1].label("agent_id"),
        )
        .subquery("tam")
    )
    return tam


def normalize_datetime(dt):
    """Ensure datetime objects are timezone-aware for accurate calculations."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt

def get_default_status(db: Session) -> Status:
    """Get the default 'open' status for new tickets"""
    return db.query(Status).filter(Status.name == "open").first()

def get_default_agent(db: Session, category_id: int) -> User:
    """Get the first active agent assigned to the category"""
    agent = (db.query(User)
            .join(User.role)
            .join(User.user_categories)
            .options(
                joinedload(User.role),
                joinedload(User.user_departments).joinedload(UserDepartment.department),
                joinedload(User.user_categories).joinedload(UserCategory.category)
            )
            .filter(
                Role.name == "agent",
                User.is_active == True,
                UserCategory.category_id == category_id
            )
            .first())
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active agent found for category {category_id}"
        )
    return agent

def get_agent_by_batch_and_category(db: Session, batch_id: int, category_id: int) -> User:
    """Get the first active agent assigned to the batch and category"""
    agent = (db.query(User)
            .join(User.role)
            .join(User.user_batches)
            .join(User.user_categories)
            .options(
                joinedload(User.role),
                joinedload(User.user_departments).joinedload(UserDepartment.department),
                joinedload(User.user_categories).joinedload(UserCategory.category)
            )
            .filter(
                Role.name == "agent",
                User.is_active == True,
                UserBatch.batch_id == batch_id,
                UserCategory.category_id == category_id
            )
            .first())
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active agent found for batch {batch_id} and category {category_id}"
        )
    return agent

def get_agents_by_batch_and_category(db: Session, batch_id: int, category_id: int) -> List[User]:
    """Get all active agents assigned to both a specific batch and category"""
    agents = (db.query(User)
            .join(User.role)
            .join(User.user_batches)
            .join(User.user_categories)
            .options(
                joinedload(User.role),
                joinedload(User.user_departments).joinedload(UserDepartment.department),
                joinedload(User.user_categories).joinedload(UserCategory.category)
            )
            .filter(
                Role.name == "agent",
                User.is_active == True,
                UserBatch.batch_id == batch_id,
                UserCategory.category_id == category_id
            )
            .all())
    
    return agents

def create_ticket(ticket: TicketCreate, current_user_id: int, db: Session) -> Dict:
    """Create a new ticket without assigning to specific agent"""
    try:
        # Get the user creating the ticket
        creator = db.query(User).filter(User.id == current_user_id).first()
        if not creator:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        # Create new ticket without assigned_to (will be null)
        db_ticket = Ticket(
            title=ticket.title,
            description=ticket.description,
            category_id=ticket.category_id,
            status_id=ticket.status_id,
            created_by=current_user_id,
            assigned_to=None,  # Keep null - don't assign to specific agent
            priority='low',  # Default priority is low
            attachments=ticket.attachments if hasattr(ticket, 'attachments') else None,
            email_message_id=ticket.email_message_id if hasattr(ticket, 'email_message_id') else None
        )
        
        db.add(db_ticket)
        db.commit()
        db.refresh(db_ticket)
        
        # Reload ticket with relationships
        db_ticket = db.query(Ticket).options(
            joinedload(Ticket.creator),
            joinedload(Ticket.assignee),
            joinedload(Ticket.category),
            joinedload(Ticket.status)
        ).filter(Ticket.id == db_ticket.id).first()
        
        return format_ticket(db_ticket, db)
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

def get_all_tickets(db: Session) -> list[Ticket]:
    return db.query(Ticket).all().order_by(Ticket.id.desc())

def get_ticket_by_id(ticket_id: int, db: Session) -> Ticket:
    """Get a ticket by ID with all relationships loaded"""
    ticket = (db.query(Ticket)
            .options(
                joinedload(Ticket.creator),
                joinedload(Ticket.assignee),
                joinedload(Ticket.category),
                joinedload(Ticket.status)
            )
            .filter(Ticket.id == ticket_id)
            .first())
    
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket {ticket_id} not found"
        )
    
    return format_ticket(ticket, db)

def get_all_tickets_by_user_id(user_id: int, db: Session) -> list[Ticket]:
    return db.query(Ticket).filter(Ticket.created_by == user_id).order_by(Ticket.id.desc()).all()

def get_assigned_tickets(agent_id: int, db: Session) -> List[Dict]:
    """Get tickets directly assigned to an agent."""
    tickets = (
        db.query(Ticket)
        .filter(Ticket.assigned_to == agent_id)
        .all()
    )
    return [format_ticket(ticket, db) for ticket in tickets]

def update_ticket_status(ticket_id: int, status_id: int, db: Session) -> Ticket | None:
    # Get the ticket
    ticket = get_ticket_by_id(ticket_id, db)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket {ticket_id} not found"
        )
    
    # Get the new status
    new_status = db.query(Status).filter(Status.id == status_id).first()
    if not new_status:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Status {status_id} not found"
        )
    
    # Update status
    ticket.status = new_status.description
    db.commit()
    db.refresh(ticket)
    return ticket

def update_ticket_status_by_id(ticket_id: int, status_id: int, closed_by_user_id: int, db: Session) -> Dict:
    """Update ticket status using status_id and track who closed it"""
    from datetime import datetime
    
    # Get the ticket with relationships
    ticket = (db.query(Ticket)
            .options(
                joinedload(Ticket.creator),
                joinedload(Ticket.assignee),
                joinedload(Ticket.category),
                joinedload(Ticket.status)
            )
            .filter(Ticket.id == ticket_id)
            .first())
            
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket {ticket_id} not found"
        )
    
    # Get the new status
    new_status = db.query(Status).filter(Status.id == status_id).first()
    if not new_status:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Status with id {status_id} not found"
        )
    
    # Update status
    ticket.status_id = new_status.id
    
    # If status is "closed", set closed_by and closed_at
    if new_status.name.lower() == 'closed':
        ticket.closed_by = closed_by_user_id
        ticket.closed_at = datetime.utcnow()
    
    db.commit()
    db.refresh(ticket)
    
    # Format and return updated ticket
    return format_ticket(ticket, db)

def reassign_ticket(ticket_id: int, category_id: int, db: Session) -> Dict:
    """Reassign a ticket to a new category and automatically assign to an agent in that category"""
    # Get the ticket with relationships
    ticket = (db.query(Ticket)
            .options(
                joinedload(Ticket.creator),
                joinedload(Ticket.assignee),
                joinedload(Ticket.category),
                joinedload(Ticket.status)
            )
            .filter(Ticket.id == ticket_id)
            .first())
            
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket {ticket_id} not found"
        )
    
    # Get new category and its agents
    new_category = (db.query(Category)
                .filter(Category.id == category_id)
                .first())
                
    if not new_category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Category {category_id} not found"
        )

    # Find available agents in the category
    available_agents = (db.query(User)
                     .join(Role, User.role_id == Role.id)
                     .join(UserCategory, User.id == UserCategory.user_id)
                     .filter(
                         UserCategory.category_id == category_id,
                         Role.name.in_(['agent']),
                         User.is_active == True
                     )
                     .all())

    if not available_agents:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No available agents found in category {category_id}"
        )

    # Simple round-robin assignment - get agent with least number of active tickets
    agent_ticket_counts = []
    for agent in available_agents:
        active_tickets = (db.query(func.count(Ticket.id))
                       .filter(
                           Ticket.assigned_to == agent.id,
                           Ticket.status_id != 4  # Assuming 4 is 'closed' status
                       )
                       .scalar())
        agent_ticket_counts.append((agent, active_tickets))

    # Sort by ticket count and get agent with least tickets
    selected_agent = min(agent_ticket_counts, key=lambda x: x[1])[0]
    
    # Update assignment
    ticket.category_id = category_id
    ticket.assigned_to = selected_agent.id
    db.commit()
    db.refresh(ticket)
    
    # Format and return updated ticket
    return format_ticket(ticket, db)

def assign_ticket_to_agent(ticket_id: int, agent_id: int, db: Session) -> Dict:
    """Manually assign a ticket to a specific agent"""
    try:
        # Get the ticket
        ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if not ticket:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Ticket {ticket_id} not found"
            )
        
        # Update assigned_to field
        ticket.assigned_to = agent_id
        ticket.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(ticket)
        
        # Reload ticket with relationships
        ticket = db.query(Ticket).options(
            joinedload(Ticket.creator),
            joinedload(Ticket.assignee),
            joinedload(Ticket.category),
            joinedload(Ticket.status)
        ).filter(Ticket.id == ticket_id).first()
        
        logger.info(f"✓ Manually assigned ticket {ticket_id} to agent {agent_id}")
        
        return format_ticket(ticket, db)
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error assigning ticket {ticket_id} to agent {agent_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

def get_category_agents(db: Session, category_id: int) -> List[User]:
    """Get all active agents assigned to a category"""
    agents = (db.query(User)
            .join(User.role)
            .join(User.user_categories)
            .options(
                joinedload(User.role),
                joinedload(User.user_departments).joinedload(UserDepartment.department),
                joinedload(User.user_categories).joinedload(UserCategory.category)
            )
            .filter(
                Role.name == "agent",
                User.is_active == True,
                UserCategory.category_id == category_id
            )
            .all())
    
    return agents

def format_ticket(ticket: Ticket, db: Session = None) -> Dict:
    """Format ticket data according to schema requirements"""
    created_by_user = ticket.creator if hasattr(ticket, 'creator') else None
    assigned_to_user = ticket.assignee if hasattr(ticket, 'assignee') else None
    
    # Get creator's batch, program, and university info (single query with eager loading)
    creator_batch_info = None
    user_batch = None
    
    if db and created_by_user:
        user_batch = db.query(UserBatch).options(
            joinedload(UserBatch.batch).joinedload(Batch.program).joinedload(Program.university)
        ).filter(UserBatch.user_id == created_by_user.id).first()
        
        if user_batch and user_batch.batch:
            batch = user_batch.batch
            program = batch.program
            university = program.university
            
            creator_batch_info = {
                "batch_id": batch.id,
                "batch_name": batch.name,
                "program_id": program.id if program else None,
                "program_name": program.name if program else None,
                "university_id": university.id if university else None,
                "university_name": university.name if university else None,
            }
        else:
            logger.warning(f"No batch found for user {created_by_user.id}")
    
    # Get agents for this ticket based on creator's batch and category
    category_agents = []
    if db and ticket.category_id and created_by_user:
        if user_batch:
            # Creator is in a batch - try to get agents for that batch + category
            agents = get_agents_by_batch_and_category(db, user_batch.batch_id, ticket.category_id)
            
            if not agents:
                agents = get_category_agents(db, ticket.category_id)
        else:
            # Creator not in batch - get all agents for category
            agents = get_category_agents(db, ticket.category_id)
        
        category_agents = [
            {
                "id": agent.id,
                "name": agent.name,
                "email": agent.email
            }
            for agent in agents
        ]

    return {
        "id": ticket.id,
        "title": ticket.title,
        "description": ticket.description,
        "category": {
            "id": ticket.category.id,
            "name": ticket.category.name,
            "description": ticket.category.description,
            "department_id": ticket.category.department_id,
            "tat_minutes": ticket.category.tat_minutes
        },
        "status": {
            "id": ticket.status.id,
            "name": ticket.status.name,
            "description": ticket.status.description
        } if ticket.status else None,
        "issue_type": {
            "id": ticket.issue_type.id,
            "name": ticket.issue_type.name,
            "description": ticket.issue_type.description,
            "is_active": ticket.issue_type.is_active,
            "dispositions": []
        } if ticket.issue_type else None,
        "disposition": {
            "id": ticket.disposition.id,
            "issue_type_id": ticket.disposition.issue_type_id,
            "name": ticket.disposition.name,
            "description": ticket.disposition.description,
            "is_active": ticket.disposition.is_active,
        } if ticket.disposition else None,
        "attachments": ticket.attachments,
        "is_delayed": ticket.is_delayed,
        "created_by": {
            "id": created_by_user.id,
            "name": created_by_user.name,
            "email": created_by_user.email,
            "batch_info": creator_batch_info
        } if created_by_user else None,
        "assigned_to": {
            "id": assigned_to_user.id,
            "name": assigned_to_user.name,
            "email": assigned_to_user.email
        } if assigned_to_user else None,
        "category_agents": category_agents,  # All agents in the category
        "priority": ticket.priority,  # Priority: 'high', 'medium', 'low'
        "created_at": ticket.created_at,
        "updated_at": ticket.updated_at
    }

def update_ticket_issue_classification(
    ticket_id: int,
    issue_type_id: int | None,
    disposition_id: int | None,
    db: Session
) -> Dict:
    """Set or clear issue type/disposition on a ticket."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket {ticket_id} not found"
        )

    if disposition_id and not issue_type_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Issue type is required when selecting a disposition"
        )

    if issue_type_id:
        issue_type = db.query(IssueType).filter(
            IssueType.id == issue_type_id,
            IssueType.is_active == True
        ).first()
        if not issue_type:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Issue type not found or inactive"
            )

    if disposition_id:
        disposition = db.query(Disposition).filter(
            Disposition.id == disposition_id,
            Disposition.issue_type_id == issue_type_id,
            Disposition.is_active == True
        ).first()
        if not disposition:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Disposition is invalid for the selected issue type"
            )

    ticket.issue_type_id = issue_type_id
    ticket.disposition_id = disposition_id
    ticket.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ticket)

    ticket = db.query(Ticket).options(
        joinedload(Ticket.creator),
        joinedload(Ticket.assignee),
        joinedload(Ticket.category),
        joinedload(Ticket.status),
        joinedload(Ticket.issue_type),
        joinedload(Ticket.disposition),
    ).filter(Ticket.id == ticket_id).first()
    return format_ticket(ticket, db)

def get_filtered_tickets(
    db: Session,
    department_ids: List[int] = None,
    category_ids: List[int] = None,
    department_id: int = None,
    category_id: int = None,
    assigned_to: int = None,
    created_by: int = None,
    resolution_time_range: str = None,
    ageing: str = None,
    priority: str = None,
    status: str = None,
    delayed: str = None,
    skip: int = 0,
    limit: int = 3000
):
    """
    Get tickets with flexible filtering options
    resolution_time_range: "8h", "24h", "48h", "beyond_48h" (for closed tickets)
    ageing: "24h", "48h", "beyond_48h" (for open tickets - age since creation)
    priority: "high", "medium", "low"
    """
    query = db.query(Ticket)\
        .options(
            joinedload(Ticket.category),
            joinedload(Ticket.status),
            joinedload(Ticket.creator),
            joinedload(Ticket.assignee),
        )
    
    # Join with Category table when filtering by department
    if department_ids or department_id:
        query = query.join(Ticket.category)
    
    if department_ids:
        query = query.filter(Category.department_id.in_(department_ids))
    if category_ids:
        query = query.filter(Ticket.category_id.in_(category_ids))
    if department_id:
        query = query.filter(Category.department_id == department_id)
    if category_id:
        query = query.filter(Ticket.category_id == category_id)
    if assigned_to:
        query = query.filter(Ticket.assigned_to == assigned_to)
    if created_by:
        query = query.filter(Ticket.created_by == created_by)
    if priority:
        query = query.filter(Ticket.priority == priority.lower())
    
    # Filter by status
    if status:
        # Handle multiple statuses separated by comma
        status_list = [s.strip() for s in status.split(',') if s.strip()]
        query = query.join(Status, Ticket.status_id == Status.id)
        query = query.filter(Status.name.in_(status_list))
    
    # Filter by delayed tickets
    if delayed and delayed.lower() == 'true':
        query = query.filter(Ticket.is_delayed == True)
    
    # Filter by resolution time range (only for closed tickets)
    if resolution_time_range:
        # If status filter not already applied, join and filter by closed status
        if not status:
            query = query.join(Status, Ticket.status_id == Status.id)
            query = query.filter(status_is_closed_or_na())
        
        tickets = query.order_by(Ticket.id.desc()).all()
        
        # Filter by resolution time in Python
        filtered_tickets = []
        for ticket in tickets:
            if ticket.created_at and ticket.updated_at:
                resolution_hours = (ticket.updated_at - ticket.created_at).total_seconds() / 3600
                
                if resolution_time_range == "8h" and resolution_hours <= 8:
                    filtered_tickets.append(ticket)
                elif resolution_time_range == "24h" and 8 < resolution_hours <= 24:
                    filtered_tickets.append(ticket)
                elif resolution_time_range == "48h" and 24 < resolution_hours <= 48:
                    filtered_tickets.append(ticket)
                elif resolution_time_range == "beyond_48h" and resolution_hours > 48:
                    filtered_tickets.append(ticket)
        
        # Apply pagination
        paginated_tickets = filtered_tickets[skip:skip + limit]
        return [format_ticket(ticket, db) for ticket in paginated_tickets]
    
    # Filter by ageing (only for open + in-progress tickets)
    if ageing:
        # If status filter not already applied, join and filter by active open statuses
        if not status:
            query = query.join(Status, Ticket.status_id == Status.id)
            query = query.filter(status_is_open())
        
        tickets = query.order_by(Ticket.id.desc()).all()
        
        # Filter by ageing in Python (age since creation)
        from datetime import datetime, timezone
        filtered_tickets = []
        now = datetime.now(timezone.utc)
        
        for ticket in tickets:
            if ticket.created_at:
                # Make created_at timezone-aware if it isn't
                created_at = ticket.created_at
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                
                ageing_hours = (now - created_at).total_seconds() / 3600
                
                if ageing == "24h" and ageing_hours <= 24:
                    filtered_tickets.append(ticket)
                elif ageing == "48h" and 24 < ageing_hours <= 48:
                    filtered_tickets.append(ticket)
                elif ageing == "beyond_48h" and ageing_hours > 48:
                    filtered_tickets.append(ticket)
        
        # Apply pagination
        paginated_tickets = filtered_tickets[skip:skip + limit]
        return [format_ticket(ticket, db) for ticket in paginated_tickets]
    
    tickets = query.order_by(Ticket.id.desc()).offset(skip).limit(limit).all()
    return [format_ticket(ticket, db) for ticket in tickets]


def get_filtered_tickets_paginated(
    db: Session,
    department_ids: List[int] = None,
    category_ids: List[int] = None,
    department_id: int = None,
    category_id: int = None,
    assigned_to: int = None,
    created_by: int = None,
    resolution_time_range: str = None,
    ageing: str = None,
    frt_bucket: str = None,
    closure_sla: str = None,
    priority: str = None,
    status: str = None,
    delayed: str = None,
    search: str = None,
    batch_id: int = None,
    program_id: int = None,
    university_id: int = None,
    start_date: str = None,
    end_date: str = None,
    page: int = 1,
    page_size: int = 20
) -> Dict:
    """
    Get tickets with server-side pagination and filtering.
    Returns {tickets, total, page, page_size, total_pages}
    """
    query = db.query(Ticket)\
        .options(
            joinedload(Ticket.category),
            joinedload(Ticket.status),
            joinedload(Ticket.creator),
            joinedload(Ticket.assignee),
        )

    # Join with Category table when filtering by department
    if department_ids or department_id:
        query = query.join(Ticket.category)

    if department_ids:
        query = query.filter(Category.department_id.in_(department_ids))
    if category_ids:
        query = query.filter(Ticket.category_id.in_(category_ids))
    if department_id:
        query = query.filter(Category.department_id == department_id)
    if category_id:
        query = query.filter(Ticket.category_id == category_id)
    if assigned_to:
        query = query.filter(Ticket.assigned_to == assigned_to)
    if created_by:
        query = query.filter(Ticket.created_by == created_by)
    if priority:
        query = query.filter(Ticket.priority == priority.lower())

    # Filter by status
    status_joined = False
    if status:
        status_list = [s.strip() for s in status.split(',') if s.strip()]
        if status_list:
            query = query.join(Status, Ticket.status_id == Status.id)
            status_joined = True
            query = query.filter(Status.name.in_(status_list))

    # Filter by delayed tickets
    if delayed and delayed.lower() == 'true':
        query = query.filter(Ticket.is_delayed == True)

    # Search filter - search across ticket title, description, id, creator name/email
    if search:
        search_term = f"%{search}%"
        from sqlalchemy import cast, String as SAString
        query = query.join(User, Ticket.created_by == User.id)
        query = query.filter(
            or_(
                Ticket.title.ilike(search_term),
                Ticket.description.ilike(search_term),
                cast(Ticket.id, SAString).ilike(search_term),
                User.name.ilike(search_term),
                User.email.ilike(search_term),
            )
        )

    # Filter by batch/program/university (creator's batch info)
    needs_user_batch_join = batch_id or program_id or university_id
    if needs_user_batch_join:
        query = query.join(UserBatch, Ticket.created_by == UserBatch.user_id)
        if batch_id:
            query = query.filter(UserBatch.batch_id == batch_id)
        if program_id or university_id:
            query = query.join(Batch, UserBatch.batch_id == Batch.id)
            if program_id:
                query = query.filter(Batch.program_id == program_id)
            if university_id:
                query = query.join(Program, Batch.program_id == Program.id)
                query = query.filter(Program.university_id == university_id)

    # Filter by date range
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            query = query.filter(Ticket.created_at >= start_dt)
        except ValueError:
            pass
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
            query = query.filter(Ticket.created_at <= end_dt)
        except ValueError:
            pass

    # FRT bucket (active tickets, time to first agent response)
    if frt_bucket:
        if not status_joined:
            query = query.join(Status, Ticket.status_id == Status.id).filter(status_is_open())
            status_joined = True
        query = _apply_frt_bucket_filter(query, db, frt_bucket)

    # Closure SLA bucket (active tickets, age since creation by category scheme)
    if closure_sla:
        if not status_joined:
            query = query.join(Status, Ticket.status_id == Status.id).filter(status_is_open())
            status_joined = True
        query = _apply_closure_sla_filter(query, closure_sla)

    # Handle resolution_time_range / ageing (requires Python-side filtering)
    if resolution_time_range:
        if not status:
            query = query.join(Status, Ticket.status_id == Status.id)
            query = query.filter(status_is_closed_or_na())

        tickets = query.order_by(Ticket.id.desc()).all()

        filtered_tickets = []
        for ticket in tickets:
            if ticket.created_at and ticket.updated_at:
                resolution_hours = (ticket.updated_at - ticket.created_at).total_seconds() / 3600
                if resolution_time_range == "8h" and resolution_hours <= 8:
                    filtered_tickets.append(ticket)
                elif resolution_time_range == "24h" and 8 < resolution_hours <= 24:
                    filtered_tickets.append(ticket)
                elif resolution_time_range == "48h" and 24 < resolution_hours <= 48:
                    filtered_tickets.append(ticket)
                elif resolution_time_range == "beyond_48h" and resolution_hours > 48:
                    filtered_tickets.append(ticket)

        total = len(filtered_tickets)
        skip = (page - 1) * page_size
        paginated = filtered_tickets[skip:skip + page_size]
        total_pages = max(1, (total + page_size - 1) // page_size)
        return {
            "tickets": [format_ticket(t, db) for t in paginated],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages
        }

    if ageing:
        if not status:
            query = query.join(Status, Ticket.status_id == Status.id)
            query = query.filter(status_is_open())

        tickets = query.order_by(Ticket.id.desc()).all()
        now = datetime.now(timezone.utc)

        filtered_tickets = []
        for ticket in tickets:
            if ticket.created_at:
                created_at = ticket.created_at
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                ageing_hours = (now - created_at).total_seconds() / 3600
                if ageing == "24h" and ageing_hours <= 24:
                    filtered_tickets.append(ticket)
                elif ageing == "48h" and 24 < ageing_hours <= 48:
                    filtered_tickets.append(ticket)
                elif ageing == "beyond_48h" and ageing_hours > 48:
                    filtered_tickets.append(ticket)

        total = len(filtered_tickets)
        skip = (page - 1) * page_size
        paginated = filtered_tickets[skip:skip + page_size]
        total_pages = max(1, (total + page_size - 1) // page_size)
        return {
            "tickets": [format_ticket(t, db) for t in paginated],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": total_pages
        }

    # Normal case - efficient SQL COUNT + OFFSET/LIMIT
    total = query.count()
    skip = (page - 1) * page_size
    tickets = query.order_by(Ticket.id.desc()).offset(skip).limit(page_size).all()
    total_pages = max(1, (total + page_size - 1) // page_size)

    return {
        "tickets": [format_ticket(ticket, db) for ticket in tickets],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }


def get_tickets_by_agent_categories_paginated(
    agent_id: int,
    db: Session,
    resolution_time_range: str = None,
    ageing: str = None,
    frt_bucket: str = None,
    closure_sla: str = None,
    priority: str = None,
    status: str = None,
    delayed: str = None,
    search: str = None,
    batch_id: int = None,
    program_id: int = None,
    university_id: int = None,
    start_date: str = None,
    end_date: str = None,
    page: int = 1,
    page_size: int = 20
) -> Dict:
    """
    Get paginated tickets visible to an agent.
    Server-side SQL pagination for agent-visible tickets.
    This avoids fetching thousands of tickets and filtering in Python.
    """
    from datetime import datetime as dt
    from sqlalchemy import cast, String as SAString

    tam = build_ticket_agent_mapping_subquery(db)

    query = (
        db.query(Ticket)
        .join(tam, tam.c.ticket_id == Ticket.id)
        .filter(tam.c.agent_id == agent_id)
        .options(
            joinedload(Ticket.category).joinedload(Category.department),
            joinedload(Ticket.status),
            joinedload(Ticket.creator),
            joinedload(Ticket.assignee),
        )
    )

    # Filters
    if priority:
        query = query.filter(Ticket.priority == priority.lower())

    if delayed and delayed.lower() == "true":
        query = query.filter(Ticket.is_delayed == True)

    if status:
        status_list = [s.strip() for s in status.split(",") if s.strip()]
        if status_list:
            query = query.join(Status, Ticket.status_id == Status.id)
            query = query.filter(Status.name.in_(status_list))

    status_joined = bool(status)

    if search:
        search_term = f"%{search}%"
        query = query.join(User, Ticket.created_by == User.id)
        query = query.filter(
            or_(
                Ticket.title.ilike(search_term),
                Ticket.description.ilike(search_term),
                cast(Ticket.id, SAString).ilike(search_term),
                User.name.ilike(search_term),
                User.email.ilike(search_term),
            )
        )

    # Batch/program/university filters (creator's batch)
    if batch_id or program_id or university_id:
        query = query.join(UserBatch, Ticket.created_by == UserBatch.user_id)
        if batch_id:
            query = query.filter(UserBatch.batch_id == batch_id)
        if program_id or university_id:
            query = query.join(Batch, UserBatch.batch_id == Batch.id)
            if program_id:
                query = query.filter(Batch.program_id == program_id)
            if university_id:
                query = query.join(Program, Batch.program_id == Program.id)
                query = query.filter(Program.university_id == university_id)

    # Date range
    if start_date:
        try:
            start_dt = dt.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            query = query.filter(Ticket.created_at >= start_dt)
        except ValueError:
            pass
    if end_date:
        try:
            end_dt = dt.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
            query = query.filter(Ticket.created_at <= end_dt)
        except ValueError:
            pass

    if frt_bucket:
        if not status_joined:
            query = query.join(Status, Ticket.status_id == Status.id).filter(status_is_open())
            status_joined = True
        query = _apply_frt_bucket_filter(query, db, frt_bucket)

    if closure_sla:
        if not status_joined:
            query = query.join(Status, Ticket.status_id == Status.id).filter(status_is_open())
            status_joined = True
        query = _apply_closure_sla_filter(query, closure_sla)

    # Resolution time range (closed tickets)
    if resolution_time_range:
        resolution_hours = extract("epoch", Ticket.updated_at - Ticket.created_at) / 3600.0
        query = query.join(Status, Ticket.status_id == Status.id).filter(status_is_closed_or_na())
        if resolution_time_range == "8h":
            query = query.filter(resolution_hours <= 8)
        elif resolution_time_range == "24h":
            query = query.filter(and_(resolution_hours > 8, resolution_hours <= 24))
        elif resolution_time_range == "48h":
            query = query.filter(and_(resolution_hours > 24, resolution_hours <= 48))
        elif resolution_time_range in ("beyond_48h", "beyond_48"):
            query = query.filter(resolution_hours > 48)

    # Ageing (open tickets age since creation)
    if ageing:
        age_hours = extract("epoch", func.now() - Ticket.created_at) / 3600.0
        query = query.join(Status, Ticket.status_id == Status.id).filter(status_is_open())
        if ageing == "24h":
            query = query.filter(age_hours <= 24)
        elif ageing == "48h":
            query = query.filter(and_(age_hours > 24, age_hours <= 48))
        elif ageing in ("beyond_48h", "beyond_48"):
            query = query.filter(age_hours > 48)

    # Count + page
    total = query.count()
    skip = (page - 1) * page_size
    rows = query.order_by(Ticket.id.desc()).offset(skip).limit(page_size).all()
    total_pages = max(1, (total + page_size - 1) // page_size)

    return {
        "tickets": [format_ticket(ticket, db) for ticket in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
    }


def get_tickets_by_user_paginated(
    user_id: int,
    db: Session,
    resolution_time_range: str = None,
    ageing: str = None,
    priority: str = None,
    status: str = None,
    delayed: str = None,
    search: str = None,
    page: int = 1,
    page_size: int = 20
) -> Dict:
    """
    Get paginated tickets created by a specific user.
    Wraps get_tickets_by_user with pagination metadata.
    """
    all_tickets = get_tickets_by_user(
        user_id=user_id,
        db=db,
        skip=0,
        limit=10000,
        resolution_time_range=resolution_time_range,
        ageing=ageing,
        priority=priority,
        status=status,
        delayed=delayed
    )

    filtered = all_tickets
    if search:
        search_lower = search.lower()
        filtered = [t for t in filtered if (
            search_lower in (t.get('title') or '').lower() or
            search_lower in (t.get('description') or '').lower() or
            search_lower in str(t.get('id', ''))
        )]

    total = len(filtered)
    skip = (page - 1) * page_size
    paginated = filtered[skip:skip + page_size]
    total_pages = max(1, (total + page_size - 1) // page_size)

    return {
        "tickets": paginated,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages
    }


def get_tickets_by_department(department_id: int, db: Session, skip: int = 0, limit: int = 3000) -> List[Dict]:
    """Get all tickets for a specific department"""
    tickets = db.query(Ticket)\
        .options(
            joinedload(Ticket.category),
            joinedload(Ticket.status)
        )\
        .filter(UserDepartment.department_id == department_id)\
        .order_by(Ticket.id.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()
    return [format_ticket(ticket, db) for ticket in tickets]

def get_tickets_by_category(category_id: int, db: Session, skip: int = 0, limit: int = 3000) -> List[Dict]:
    """Get all tickets for a specific category"""
    tickets = db.query(Ticket)\
        .options(
            joinedload(Ticket.category),
            joinedload(Ticket.status)
        )\
        .filter(Ticket.category_id == category_id)\
        .order_by(Ticket.id.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()
    return [format_ticket(ticket, db) for ticket in tickets]

def get_tickets_by_agent(agent_id: int, db: Session, skip: int = 0, limit: int = 3000) -> List[Dict]:
    """Get all tickets assigned to a specific agent"""
    tickets = db.query(Ticket)\
        .options(
            joinedload(Ticket.category),
            joinedload(Ticket.status)
        )\
        .filter(Ticket.assigned_to == agent_id)\
        .order_by(Ticket.id.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()
    return [format_ticket(ticket, db) for ticket in tickets]

def get_tickets_by_user(
    user_id: int, 
    db: Session, 
    skip: int = 0, 
    limit: int = 3000,
    resolution_time_range: str = None,
    ageing: str = None,
    priority: str = None,
    status: str = None,
    delayed: str = None
) -> List[Dict]:
    """Get all tickets created by a specific user with optional filtering"""
    query = db.query(Ticket)\
        .options(
            joinedload(Ticket.category),
            joinedload(Ticket.status)
        )\
        .filter(Ticket.created_by == user_id)
    
    # Filter by status
    if status:
        status_list = [s.strip() for s in status.split(',')]
        query = query.join(Status, Ticket.status_id == Status.id)
        query = query.filter(Status.name.in_(status_list))
    
    # Filter by delayed tickets
    if delayed and delayed.lower() == 'true':
        query = query.filter(Ticket.is_delayed == True)
    
    # Filter by priority
    if priority:
        query = query.filter(Ticket.priority == priority.lower())
    
    # Filter by resolution time range (only for closed tickets)
    if resolution_time_range:
        if not status:
            query = query.join(Status, Ticket.status_id == Status.id)
            query = query.filter(status_is_closed_or_na())
        
        tickets = query.order_by(Ticket.id.desc()).all()
        
        # Filter by resolution time in Python
        filtered_tickets = []
        for ticket in tickets:
            if ticket.created_at and ticket.updated_at:
                resolution_hours = (ticket.updated_at - ticket.created_at).total_seconds() / 3600
                
                if resolution_time_range == "8h" and resolution_hours <= 8:
                    filtered_tickets.append(ticket)
                elif resolution_time_range == "24h" and 8 < resolution_hours <= 24:
                    filtered_tickets.append(ticket)
                elif resolution_time_range == "48h" and 24 < resolution_hours <= 48:
                    filtered_tickets.append(ticket)
                elif resolution_time_range == "beyond_48h" and resolution_hours > 48:
                    filtered_tickets.append(ticket)
        
        # Apply pagination
        paginated_tickets = filtered_tickets[skip:skip + limit]
        return [format_ticket(ticket, db) for ticket in paginated_tickets]
    
    # Filter by ageing (only for open tickets)
    if ageing:
        if not status:
            query = query.join(Status, Ticket.status_id == Status.id)
            query = query.filter(status_is_open())
        
        tickets = query.order_by(Ticket.id.desc()).all()
        
        # Filter by ageing in Python (age since creation)
        from datetime import datetime, timezone
        filtered_tickets = []
        now = datetime.now(timezone.utc)
        
        for ticket in tickets:
            if ticket.created_at:
                # Make created_at timezone-aware if it isn't
                created_at = ticket.created_at
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                
                ageing_hours = (now - created_at).total_seconds() / 3600
                
                if ageing == "24h" and ageing_hours <= 24:
                    filtered_tickets.append(ticket)
                elif ageing == "48h" and 24 < ageing_hours <= 48:
                    filtered_tickets.append(ticket)
                elif ageing == "beyond_48h" and ageing_hours > 48:
                    filtered_tickets.append(ticket)
        
        # Apply pagination
        paginated_tickets = filtered_tickets[skip:skip + limit]
        return [format_ticket(ticket, db) for ticket in paginated_tickets]
    
    tickets = query.order_by(Ticket.id.desc()).offset(skip).limit(limit).all()
    return [format_ticket(ticket, db) for ticket in tickets]


def update_ticket_attachments(ticket_id: int, attachments: List[str], db: Session) -> Dict:
    """Update ticket attachments"""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    
    print("ticket id: ", ticket.id)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket {ticket_id} not found"
        )
    
    # Update attachments
    ticket.attachments = attachments
    print("attachments: ", ticket.attachments)
    db.commit()
    db.refresh(ticket)
    
    # Return formatted ticket
    return format_ticket(ticket, db)

def update_ticket_priority(ticket_id: int, priority: str, db: Session) -> Dict:
    """Update ticket priority (internal use only - agents, managers, supervisors)"""
    # Validate priority value
    valid_priorities = ['high', 'medium', 'low']
    if priority.lower() not in valid_priorities:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid priority. Must be one of: {', '.join(valid_priorities)}"
        )
    
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket {ticket_id} not found"
        )
    
    # Update priority
    ticket.priority = priority.lower()
    db.commit()
    db.refresh(ticket)
    
    # Return formatted ticket
    return format_ticket(ticket, db)

async def check_delayed_tickets(db: Session, email_service: EmailService) -> List[Ticket]:
    """
    Check and update tickets that have exceeded their category-specific TAT time
    """
    # Get all open tickets that aren't marked as delayed
    tickets = (
        db.query(Ticket)
        .join(Status)
        .join(Category)
        .filter(
            Status.name.in_(["open", "in-progress"]),
            Ticket.is_delayed == False
        )
        .all()
    )
    
    delayed_tickets = []
    current_time = datetime.now()
    
    for ticket in tickets:
        # Calculate threshold based on category's TAT time (now in hours)
        threshold_time = ticket.created_at + timedelta(hours=ticket.category.tat_minutes)  # tat_minutes is actually hours
        
        if current_time > threshold_time:
            ticket.is_delayed = True
            db.add(ticket)
            delayed_tickets.append(ticket)
            
            # Send email notifications
            try:
                # If ticket is manually assigned, send to that agent only
                if ticket.assigned_to:
                    agent = db.query(User).filter(User.id == ticket.assigned_to).first()
                    if agent and agent.email:
                        await email_service.send_delayed_ticket_notification(
                            email=agent.email,
                            ticket_id=ticket.id,
                            ticket_title=ticket.title,
                            role="agent",
                            created_at=ticket.created_at,
                            tat_hours=ticket.category.tat_minutes,  # tat_minutes is actually hours
                            periods_delayed=(current_time - threshold_time).days
                        )
                else:
                    # If not manually assigned, send to all agents in the category (batch-based or category-only)
                    # Get the ticket creator to determine their batch
                    creator = db.query(User).filter(User.id == ticket.created_by).first()
                    
                    if creator:
                        # Get creator's batch
                        creator_batches = [ub.batch_id for ub in creator.user_batches]
                        
                        # Get agents in the ticket's category
                        category_agents_query = (
                            db.query(User)
                            .join(User.role)
                            .join(User.user_categories)
                            .filter(
                                Role.name == "agent",
                                UserCategory.category_id == ticket.category_id
                            )
                        )
                        
                        # If creator has batches, try to find agents in the same batch first
                        batch_agents = []
                        if creator_batches:
                            batch_agents = (
                                category_agents_query
                                .join(User.user_batches)
                                .filter(UserBatch.batch_id.in_(creator_batches))
                                .all()
                            )
                        
                        # If no batch agents found, fall back to all category agents
                        agents_to_notify = batch_agents if batch_agents else category_agents_query.all()
                        
                        # Send delay notification to all relevant agents
                        for agent in agents_to_notify:
                            if agent.email:
                                await email_service.send_delayed_ticket_notification(
                                    email=agent.email,
                                    ticket_id=ticket.id,
                                    ticket_title=ticket.title,
                                    role="agent",
                                    created_at=ticket.created_at,
                                    tat_hours=ticket.category.tat_minutes,  # tat_minutes is actually hours
                                    periods_delayed=(current_time - threshold_time).days
                                )
                
                # Always send to department supervisors
                category = db.query(Category).filter(Category.id == ticket.category_id).first()
                if category and category.department_id:
                    supervisors = (
                        db.query(User)
                        .join(User.role)
                        .join(User.user_departments)
                        .filter(
                            Role.name == "department-supervisor",
                            UserDepartment.department_id == category.department_id
                        )
                        .all()
                    )
                    
                    for supervisor in supervisors:
                        if supervisor.email:
                            await email_service.send_delayed_ticket_notification(
                                email=supervisor.email,
                                ticket_id=ticket.id,
                                ticket_title=ticket.title,
                                role="supervisor",
                                created_at=ticket.created_at,
                                tat_hours=ticket.category.tat_minutes,  # tat_minutes is actually hours
                                periods_delayed=(current_time - threshold_time).days
                            )
            
            except Exception as e:
                logger.error(f"Error sending delayed ticket notifications: {str(e)}")
    
    if delayed_tickets:
        db.commit()
    
    return delayed_tickets


def auto_close_tickets_without_student_reply(db: Session) -> List[int]:
    """Close open tickets 1 minute after a support reply without a student reply."""
    current_time = datetime.now(timezone.utc)
    open_tickets = (
        db.query(Ticket)
        .join(Status)
        .filter(status_is_open())
        .with_for_update()
        .all()
    )
    closed_status = db.query(Status).filter(Status.name.ilike("closed")).first()
    if not closed_status:
        logger.error("Cannot auto-close tickets because the closed status does not exist")
        return []

    closed_ticket_ids = []
    for ticket in open_tickets:
        latest_thread = (db.query(Thread)
            .filter(Thread.ticket_id == ticket.id, Thread.is_system == False)
            .order_by(Thread.created_at.desc(), Thread.id.desc())
            .first())
        if not latest_thread or latest_thread.user_id == ticket.created_by:
            continue

        latest_reply_time = latest_thread.created_at
        if latest_reply_time is None:
            continue
        if latest_reply_time.tzinfo is None:
            latest_reply_time = latest_reply_time.replace(tzinfo=timezone.utc)
        if current_time - latest_reply_time < timedelta(minutes=AUTO_CLOSE_MINUTES):
            continue

        duplicate = (db.query(Thread.id)
            .filter(
                Thread.ticket_id == ticket.id,
                Thread.is_system == True,
                Thread.message == AUTO_CLOSE_MESSAGE,
            )
            .first())
        if duplicate:
            continue

        db.add(Thread(
            ticket_id=ticket.id,
            user_id=settings.SYSTEM_USER_ID,
            message=AUTO_CLOSE_MESSAGE,
            is_system=True,
            attachments=[]
        ))
        ticket.status_id = closed_status.id
        ticket.closed_by = settings.SYSTEM_USER_ID
        ticket.closed_at = current_time
        closed_ticket_ids.append(ticket.id)

    if closed_ticket_ids:
        db.commit()
    return closed_ticket_ids

def get_tickets_by_agent_categories(agent_id: int, db: Session, skip: int = 0, limit: int = 1000, resolution_time_range: str = None, ageing: str = None, priority: str = None, status: str = None, delayed: str = None) -> List[Dict]:
    """
     Get all tickets visible to an agent:
    1. Tickets manually assigned to this agent (assigned_to = agent_id)
    2. Tickets auto-assigned (assigned_to IS NULL) where agent is in category+batch
    3. Tickets with category-level fallback (no batch agents found for that ticket)
    
    Optional: Filter by resolution_time_range for closed tickets or ageing for open tickets
    """
    # Validate agent exists
    agent = db.query(User).filter(User.id == agent_id).first()
    if not agent:
        return []

    # Build base ticket query with eager loads
    query = db.query(Ticket).options(
        joinedload(Ticket.status),
        joinedload(Ticket.category),
        joinedload(Ticket.creator),
        joinedload(Ticket.assignee)
    )
    
    # If resolution_time_range is provided, filter for closed tickets only
    if resolution_time_range:
        query = query.join(Status, Ticket.status_id == Status.id)\
            .filter(status_is_closed_or_na())
    
    # If ageing is provided, filter for open tickets only
    if ageing:
        query = query.join(Status, Ticket.status_id == Status.id)\
            .filter(status_is_open())
    
    # Visibility: use the canonical mapping (batch+category preferred; fallback only if no batch-agents exist)
    tam = build_ticket_agent_mapping_subquery(db)
    query = query.join(tam, tam.c.ticket_id == Ticket.id).filter(tam.c.agent_id == agent_id)

    tickets = query.order_by(Ticket.id.desc()).all()
    
    # Filter by status if provided
    if status:
        status_list = [s.strip() for s in status.split(',')]
        tickets = [ticket for ticket in tickets if ticket.status and ticket.status.name in status_list]
    
    # Filter by delayed tickets if provided
    if delayed and delayed.lower() == 'true':
        tickets = [ticket for ticket in tickets if ticket.is_delayed]
    
    # If resolution_time_range is provided, filter by resolution time
    if resolution_time_range:
        filtered_tickets = []
        for ticket in tickets:
            if ticket.created_at and ticket.updated_at:
                resolution_hours = (ticket.updated_at - ticket.created_at).total_seconds() / 3600
                
                if resolution_time_range == '8h' and resolution_hours <= 8:
                    filtered_tickets.append(ticket)
                elif resolution_time_range == '24h' and 8 < resolution_hours <= 24:
                    filtered_tickets.append(ticket)
                elif resolution_time_range == '48h' and 24 < resolution_hours <= 48:
                    filtered_tickets.append(ticket)
                elif resolution_time_range == 'beyond_48h' and resolution_hours > 48:
                    filtered_tickets.append(ticket)
        
        tickets = filtered_tickets[skip:skip+limit]
    # If ageing is provided, filter by ticket age (for open tickets)
    elif ageing:
        from datetime import datetime, timezone
        filtered_tickets = []
        now = datetime.now(timezone.utc)
        
        for ticket in tickets:
            if ticket.created_at:
                # Make created_at timezone-aware if it isn't
                created_at = ticket.created_at
                if created_at.tzinfo is None:
                    created_at = created_at.replace(tzinfo=timezone.utc)
                
                ageing_hours = (now - created_at).total_seconds() / 3600
                
                if ageing == '24h' and ageing_hours <= 24:
                    filtered_tickets.append(ticket)
                elif ageing == '48h' and 24 < ageing_hours <= 48:
                    filtered_tickets.append(ticket)
                elif ageing == 'beyond_48h' and ageing_hours > 48:
                    filtered_tickets.append(ticket)
        
        tickets = filtered_tickets[skip:skip+limit]
    else:
        tickets = tickets[skip:skip+limit]
    
    return [format_ticket(ticket, db) for ticket in tickets]

def get_agent_ticket_dashboard(
    agent_id: int,
    db: Session,
    skip: int = 0,
    limit: int = 3000,
    program_id: int = None,
    batch_id: int = None,
) -> Dict:
    """
    Get a comprehensive view of tickets for an agent, including:
    1. Tickets from all categories they are assigned to
    2. Category-wise ticket breakdown
    """
    # Optimized: use canonical visibility mapping + SQL aggregates (avoid N+1 work in format_ticket)
    tam = build_ticket_agent_mapping_subquery(db)

    # Validate agent exists early
    agent = db.query(User.id).filter(User.id == agent_id).first()
    if not agent:
        return {"tickets": [], "category_breakdown": []}

    # ---- Tickets (light payload) ----
    # Apply program/batch filter before offset/limit (join after limit raises InvalidRequestError)
    tickets_q = (
        db.query(Ticket)
        .join(tam, tam.c.ticket_id == Ticket.id)
        .filter(tam.c.agent_id == agent_id)
    )
    tickets_q = apply_creator_program_batch_filter(tickets_q, program_id, batch_id)
    tickets_q = (
        tickets_q
        .options(
            joinedload(Ticket.status),
            joinedload(Ticket.category).joinedload(Category.department),
            joinedload(Ticket.creator),
            joinedload(Ticket.assignee),
        )
        .order_by(Ticket.id.desc())
        .offset(skip)
        .limit(limit)
    )
    tickets = tickets_q.all()

    def _format_ticket_light(t: Ticket) -> Dict:
        creator = t.creator
        assignee = t.assignee
        cat = t.category
        st = t.status
        return {
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "category": {
                "id": cat.id,
                "name": cat.name,
                "description": cat.description,
                "department_id": cat.department_id,
                "tat_minutes": cat.tat_minutes,
            } if cat else None,
            "status": {
                "id": st.id,
                "name": st.name,
                "description": st.description,
            } if st else None,
            "attachments": t.attachments,
            "is_delayed": t.is_delayed,
            "created_by": {
                "id": creator.id,
                "name": creator.name,
                "email": creator.email,
                "batch_info": None,
            } if creator else None,
            "assigned_to": {
                "id": assignee.id,
                "name": assignee.name,
                "email": assignee.email,
                "batch_info": None,
            } if assignee else None,
            # category_agents omitted intentionally for dashboard performance
            "category_agents": [],
            "priority": t.priority,
            "created_at": t.created_at,
            "updated_at": t.updated_at,
        }

    ticket_dicts = [_format_ticket_light(t) for t in tickets]

    # ---- Category breakdown (SQL aggregates) ----
    from app.db.models.department import Department

    breakdown_query = (
        db.query(
            Category.id.label("id"),
            Category.name.label("name"),
            Department.name.label("department_name"),
            func.count(func.distinct(Ticket.id)).label("total"),
            func.sum(case((Status.name == "open", 1), else_=0)).label("open"),
            func.sum(case((status_is_in_progress(), 1), else_=0)).label("in_progress"),
            func.sum(case((status_is_closed_or_na(), 1), else_=0)).label("closed"),
            func.sum(case((status_is_not_applicable(), 1), else_=0)).label("not_applicable"),
            func.sum(case((Ticket.is_delayed == True, 1), else_=0)).label("delayed"),
        )
        .select_from(Ticket)
        .join(tam, tam.c.ticket_id == Ticket.id)
        .join(Status, Ticket.status_id == Status.id)
        .join(Category, Ticket.category_id == Category.id)
        .join(Department, Category.department_id == Department.id)
        .filter(tam.c.agent_id == agent_id)
    )
    breakdown_query = apply_creator_program_batch_filter(
        breakdown_query, program_id, batch_id
    )
    breakdown_rows = breakdown_query.group_by(
        Category.id, Category.name, Department.name
    ).all()

    breakdown = [
        {
            "id": r.id,
            "name": r.name,
            "department_name": r.department_name,
            "total": int(r.total or 0),
            "open": int(r.open or 0),
            "in_progress": int(r.in_progress or 0),
            "closed": int(r.closed or 0),
            "not_applicable": int(r.not_applicable or 0),
            "delayed": int(r.delayed or 0),
        }
        for r in breakdown_rows
    ]

    return {"tickets": ticket_dicts, "category_breakdown": breakdown}

def get_first_agent_response(db: Session, ticket_id: int):
    """
    Get the first response from an actual agent (not admin, not ticket creator).
    Returns the Thread object of the first agent response, or None if no agent has responded.
    """
    from app.db.models.thread import Thread
    
    # Get first response from an agent (not admin, not ticket creator)
    first_response = (db.query(Thread)
                     .join(User, Thread.user_id == User.id)
                     .join(Role, User.role_id == Role.id)
                     .filter(
                         Thread.ticket_id == ticket_id,
                         Thread.user_id != db.query(Ticket).filter(Ticket.id == ticket_id).first().created_by,
                         Role.name == 'agent'  # Only count agent responses, not admin
                     )
                     .order_by(Thread.created_at.asc())
                     .first())
    
    return first_response

def calculate_first_response_time(db: Session, ticket_id: int) -> float:
    """
    Calculate first response time for a ticket in hours.
    Returns the time difference between ticket creation and first agent response.
    If no response exists, returns time from creation to now.
    Excludes admin responses (only counts agent responses).
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        return 0
    
    first_response = get_first_agent_response(db, ticket_id)
    
    ticket_created = normalize_datetime(ticket.created_at)
    if first_response:
        first_created = normalize_datetime(first_response.created_at)
        # Calculate time difference in hours
        time_diff = first_created - ticket_created
        return time_diff.total_seconds() / 3600  # Convert to hours
    else:
        # No agent response yet, calculate from creation to now
        current_time = datetime.now(timezone.utc)
        time_diff = current_time - ticket_created
        return time_diff.total_seconds() / 3600

def get_overall_frt_metrics(
    db: Session,
    user: User = None,
    program_id: int = None,
    batch_id: int = None,
) -> Dict:
    """
    Calculate overall FRT metrics using SQL aggregates.
    Uses a subquery for first agent response per ticket.
    Only responded tickets count toward the average.
    """
    from app.db.models.thread import Thread

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

    # FRT in hours (only for responded tickets)
    frt_hours = extract('epoch',
        first_response_sq.c.first_response_at - Ticket.created_at
    ) / 3600.0

    query = db.query(
        func.count(Ticket.id).label('total_tickets'),
        func.count(first_response_sq.c.first_response_at).label('responded_tickets'),
        func.avg(frt_hours).label('avg_frt'),
    ).outerjoin(first_response_sq, Ticket.id == first_response_sq.c.ticket_id)\
     .filter(Ticket.created_at.isnot(None))

    # Filter by department if user is manager/supervisor
    if user and hasattr(user, 'role') and user.role:
        if user.role.name in ['department-manager', 'department-supervisor']:
            if user.user_departments:
                dept_ids = [ud.department_id for ud in user.user_departments]
                query = query.join(Category, Ticket.category_id == Category.id)\
                    .filter(Category.department_id.in_(dept_ids))

    query = apply_creator_program_batch_filter(query, program_id, batch_id)

    row = query.one()
    total = row.total_tickets or 0
    responded = row.responded_tickets or 0

    return {
        'average_frt_hours': round(float(row.avg_frt or 0), 2),
        'total_tickets': total,
        'responded_tickets': responded,
        'pending_tickets': total - responded
    }

def get_agent_frt_metrics(
    db: Session,
    user: User = None,
    program_id: int = None,
    batch_id: int = None,
) -> List[Dict]:
    """
    Calculate FRT metrics per agent using SQL aggregates.
    FRT = time from ticket creation to the *first agent* response.
    - Excludes admin/non-agent responses by design (Role.name == 'agent')
    - IMPORTANT: tickets with no agent response are NOT counted yet
    """
    from app.db.models.thread import Thread
    from app.db.models.user_department import UserDepartment

    # Department filter for managers/supervisors
    dept_ids = None
    if user and hasattr(user, 'role') and user.role:
        if user.role.name in ['department-manager', 'department-supervisor']:
            if user.user_departments:
                dept_ids = [ud.department_id for ud in user.user_departments]

    # ---- Responded tickets only (first responder = the agent) ----
    first_response_sq = (
        db.query(
            Thread.ticket_id,
            func.min(Thread.created_at).label('first_response_at')
        )
        .join(User, Thread.user_id == User.id)
        .join(Role, User.role_id == Role.id)
        .filter(Role.name == 'agent', User.is_active == True)
        .group_by(Thread.ticket_id)
        .subquery('fr')
    )

    # Join back to Thread to get the user_id of the first responder
    FirstThread = db.query(
        Thread.ticket_id,
        Thread.user_id.label('responder_id'),
        Thread.created_at.label('response_at')
    ).join(
        first_response_sq,
        and_(
            Thread.ticket_id == first_response_sq.c.ticket_id,
            Thread.created_at == first_response_sq.c.first_response_at
        )
    ).join(User, Thread.user_id == User.id)\
     .join(Role, User.role_id == Role.id)\
     .filter(Role.name == 'agent', User.is_active == True)\
     .subquery('ft')

    # FRT for responded tickets
    responded_frt = extract('epoch', FirstThread.c.response_at - Ticket.created_at) / 3600.0

    responded_query = db.query(
        FirstThread.c.responder_id.label('agent_id'),
        func.count(Ticket.id).label('responded'),
        func.sum(responded_frt).label('total_frt'),
    ).join(Ticket, Ticket.id == FirstThread.c.ticket_id)\
     .filter(Ticket.created_at.isnot(None))

    if dept_ids:
        responded_query = responded_query.join(Category, Ticket.category_id == Category.id)\
            .filter(Category.department_id.in_(dept_ids))

    responded_query = apply_creator_program_batch_filter(
        responded_query, program_id, batch_id
    )

    responded_query = responded_query.group_by(FirstThread.c.responder_id)
    responded_rows = {
        r.agent_id: {"responded": r.responded, "total_frt": float(r.total_frt or 0)}
        for r in responded_query.all()
    }

    # ---- Combine: get all active agents ----
    agents_query = db.query(User.id, User.name, User.email)\
        .join(Role, User.role_id == Role.id)\
        .filter(Role.name == 'agent', User.is_active == True)

    if dept_ids:
        agents_query = agents_query.join(UserCategory, User.id == UserCategory.user_id)\
            .join(Category, UserCategory.category_id == Category.id)\
            .filter(Category.department_id.in_(dept_ids)).distinct()

    agents = agents_query.all()

    agent_metrics = []
    for agent in agents:
        resp = responded_rows.get(agent.id, {"responded": 0, "total_frt": 0})
        responded_count = resp["responded"]
        total_frt = resp["total_frt"]

        # Only responded tickets are counted
        total_tickets = responded_count
        pending_count = 0
        avg_frt = total_frt / responded_count if responded_count > 0 else 0

        agent_metrics.append({
            'agent_id': agent.id,
            'agent_name': agent.name,
            'agent_email': agent.email,
            'average_frt_hours': round(avg_frt, 2),
            'total_tickets': total_tickets,
            'responded_tickets': responded_count,
            'pending_tickets': pending_count
        })

    agent_metrics.sort(key=lambda x: x['average_frt_hours'])
    return agent_metrics


_PRIORITY_RANK = {"low": 1, "medium": 2, "high": 3}


def _priority_from_frt_hours(frt_hours: float) -> str:
    """FRT-based priority: <12h low, 12–20h medium, ≥20h high."""
    if frt_hours >= 20:
        return "high"
    if frt_hours >= 12:
        return "medium"
    return "low"


def _priority_from_closure_sla_hours(age_hours: float, is_academic_affairs: bool) -> str:
    """
    Closure-SLA-based priority (matches SLA Health buckets).
    Approaching (High bucket) and Breached both map to high priority.
    """
    if is_academic_affairs:
        # 120h scheme: Low <60 | Medium 60–96 | High 96–120 | Breached >120
        if age_hours > 96:
            return "high"
        if age_hours >= 60:
            return "medium"
        return "low"

    # 72h scheme: Low <36 | Medium 36–60 | High 60–72 | Breached >72
    if age_hours > 60:
        return "high"
    if age_hours >= 36:
        return "medium"
    return "low"


def _worse_priority(a: str, b: str) -> str:
    """Return the higher urgency of two priorities."""
    return a if _PRIORITY_RANK.get(a, 0) >= _PRIORITY_RANK.get(b, 0) else b


def update_ticket_priority_by_frt(db: Session) -> List[Dict]:
    """
    Update priority of open/in-progress tickets using both:
      1) FRT (first agent response time)
      2) Closure SLA age (same thresholds as SLA Health)

    Final priority = worse of the two (max urgency).
    So a ticket with fast FRT but breached closure SLA becomes High.
    """
    try:
        open_status = db.query(Status).filter(Status.name == "open").first()
        in_progress_status = db.query(Status).filter(Status.name == "in-progress").first()

        if not open_status or not in_progress_status:
            logger.warning("Could not find 'open' or 'in-progress' status")
            return []

        tickets = (
            db.query(Ticket)
            .options(joinedload(Ticket.category).joinedload(Category.department))
            .filter(Ticket.status_id.in_([open_status.id, in_progress_status.id]))
            .all()
        )

        updated_tickets = []
        current_time = datetime.now(timezone.utc)

        for ticket in tickets:
            if not ticket.created_at:
                continue

            first_agent_response = (
                db.query(Thread)
                .filter(
                    Thread.ticket_id == ticket.id,
                    Thread.user_id != ticket.created_by,
                )
                .join(User)
                .filter(User.role.has(Role.name == "agent"))
                .order_by(Thread.created_at.asc())
                .first()
            )

            ticket_created = normalize_datetime(ticket.created_at)

            if first_agent_response:
                first_response_time = normalize_datetime(first_agent_response.created_at)
                frt_hours = (first_response_time - ticket_created).total_seconds() / 3600
            else:
                frt_hours = (current_time - ticket_created).total_seconds() / 3600

            age_hours = (current_time - ticket_created).total_seconds() / 3600
            dept_name = (
                ticket.category.department.name
                if ticket.category and ticket.category.department
                else ""
            ) or ""
            is_academic_affairs = "academic affairs" in dept_name.lower()

            frt_priority = _priority_from_frt_hours(frt_hours)
            sla_priority = _priority_from_closure_sla_hours(age_hours, is_academic_affairs)
            new_priority = _worse_priority(frt_priority, sla_priority)

            if ticket.priority != new_priority:
                old_priority = ticket.priority
                ticket.priority = new_priority
                ticket.updated_at = current_time
                db.commit()

                updated_tickets.append({
                    "ticket_id": ticket.id,
                    "title": ticket.title,
                    "old_priority": old_priority,
                    "new_priority": new_priority,
                    "frt_hours": round(frt_hours, 2),
                    "age_hours": round(age_hours, 2),
                    "frt_priority": frt_priority,
                    "sla_priority": sla_priority,
                    "has_response": first_agent_response is not None,
                })

                logger.info(
                    f"Updated ticket #{ticket.id} priority {old_priority} → {new_priority} "
                    f"(FRT={frt_priority}/{frt_hours:.1f}h, SLA={sla_priority}/{age_hours:.1f}h)"
                )

        return updated_tickets

    except Exception as e:
        logger.error(f"Error updating ticket priorities by FRT/SLA: {str(e)}")
        return []
