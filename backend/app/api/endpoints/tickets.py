from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Form, File, UploadFile, Query
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.schemas.ticket_schema import TicketResponse, TicketCreate, TicketCreateResponse, TicketStatusUpdate, TicketPriorityUpdate, TicketIssueClassificationUpdate, PaginatedTicketResponse
from app.repositories import ticket_repository
from app.schemas.user_schema import UserResponse
from app.core.auth import get_current_user
from app.repositories import thread_repository, user_repository
from app.schemas.thread_schema import ThreadResponse, ThreadCreate
from typing import List, Optional
from app.services.email_service import email_service
from app.services.s3_service import s3_service
from app.db.models.ticket import Ticket
from app.db.models.user import User
from app.db.models.category import Category
from app.repositories import category_repository
from typing import Dict
from app.db.models.status import Status
from app.services.auto_response_service import generate_auto_response
import threading
import logging
import asyncio

router = APIRouter()

# CREATE Operations
@router.post('/', response_model=TicketCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    description: str = Form(...),
    category_id: int = Form(...),
    status_id: int = Form(1),
    email_message_id: Optional[str] = Form(None),
    attachments: List[UploadFile] = File(None),  # Expecting files to be uploaded here
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Create ticket in database first (without attachments)
    ticket = TicketCreate(
        title=title,
        description=description,
        category_id=category_id,
        status_id=status_id,
        email_message_id=email_message_id
    )

    db_ticket = ticket_repository.create_ticket(ticket, current_user.id, db)

    # Check if attachments are provided and upload them to S3
    s3_urls = []
    if attachments:
        s3_urls = await s3_service.upload_files(attachments, db_ticket['id'], 'new')  # Upload to S3 and get URLs

        # Update ticket with S3 URLs
        db_ticket = ticket_repository.update_ticket_attachments(db_ticket['id'], s3_urls, db)

    # Function to handle all background processes
    def handle_background_processes(ticket_id, ticket_title, ticket_description, creator_name, creator_email, category_agents=None):
        try:
            # Generate AI auto-response
            generate_auto_response(ticket_id, ticket_title, ticket_description)
            
            # Send email notifications to all agents in the category
            if category_agents and len(category_agents) > 0:
                # Create a new event loop for async operations in this thread
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
                # Send emails to all agents
                for agent in category_agents:
                    loop.run_until_complete(
                        email_service.send_ticket_creation_notification(
                            background_tasks=None,  # No background tasks in this context
                            ticket_id=ticket_id,
                            title=ticket_title,
                            description=ticket_description,
                            creator_name=creator_name,
                            creator_email=creator_email,
                            agent_name=agent['name'],
                            agent_email=agent['email']
                        )
                    )
                loop.close()
        except Exception as e:
            logging.error(f"Error in background processes for ticket {ticket_id}: {str(e)}")
    
    # Start background thread for non-essential operations
    # Get agents based on batch and category (already filtered in format_ticket)
    category_agents = db_ticket.get('category_agents', [])
    
    # Log detailed information about the agents who will receive notifications
    if category_agents:
        agent_info = [f"{agent['name']} <{agent['email']}>" for agent in category_agents]
        logging.info(f"📧 Sending email notifications to {len(agent_info)} agents: {', '.join(agent_info)}")
    else:
        logging.warning("⚠️ No agents found for batch + category. No notifications will be sent.")
    
    # Start the background thread for sending emails
    threading.Thread(
        target=handle_background_processes,
        args=(
            db_ticket['id'],
            db_ticket['title'],
            db_ticket['description'],
            current_user.name,
            current_user.email,
            category_agents  # This now contains only batch-specific agents
        ),
        daemon=True  # Make thread a daemon so it doesn't block application shutdown
    ).start()

    # Return ticket immediately without waiting for background processes
    return db_ticket

# READ Operation
@router.get('/', response_model=List[TicketResponse])
async def get_my_tickets(
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
    department_id: Optional[int] = None,
    category_id: Optional[int] = None,
    agent_id: Optional[int] = None,  # Filter by agent (for agent-wise resolution metrics)
    resolution_time_range: Optional[str] = None,  # "8h", "24h", "48h", "beyond_48h" (for closed tickets)
    ageing: Optional[str] = None,  # "24h", "48h", "beyond_48h" (for open tickets - age since creation)
    priority: Optional[str] = None,  # Filter by priority: "high", "medium", "low"
    status: Optional[str] = None,  # Filter by status: "Open", "In Progress", "Closed", "Not Applicable"
    delayed: Optional[str] = None,  # Filter delayed tickets: "true"
    skip: int = 0,
    limit: int = 3000
):
    
    user_roles = user_repository.get_user_roles(db, current_user.id)
    role_names = [r.name for r in user_roles]
    
    # If agent_id is provided, get tickets visible to that agent
    if agent_id:
        return ticket_repository.get_tickets_by_agent_categories(
            agent_id=agent_id,
            db=db,
            skip=skip,
            limit=limit,
            resolution_time_range=resolution_time_range,
            ageing=ageing,
            priority=priority,
            status=status,
            delayed=delayed
        )

    # Admin can see all tickets
    if "admin" in role_names:
        query = ticket_repository.get_filtered_tickets(
            db=db,
            department_id=department_id,
            category_id=category_id,
            resolution_time_range=resolution_time_range,
            ageing=ageing,
            priority=priority,
            status=status,
            delayed=delayed,
            skip=skip,
            limit=limit
        )
        return query

    # Department Manager
    dept_manager_depts = [
        getattr(role, 'department_id', None) 
        for role in user_roles 
        if role.name == "department-manager" and hasattr(role, 'department_id')
    ]
    if dept_manager_depts:
        if department_id and department_id not in dept_manager_depts:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this department's tickets"
            )
        query = ticket_repository.get_filtered_tickets(
            db=db,
            department_ids=dept_manager_depts if not department_id else [department_id],
            category_id=category_id,
            resolution_time_range=resolution_time_range,
            ageing=ageing,
            priority=priority,
            status=status,
            delayed=delayed,
            skip=skip,
            limit=limit
        )
        return query

    # Department Supervisor - behave exactly like department managers
    dept_supervisor_depts = [
        getattr(role, 'department_id', None) 
        for role in user_roles 
        if role.name == "department-supervisor" and hasattr(role, 'department_id')
    ]
    if dept_supervisor_depts:
        if department_id and department_id not in dept_supervisor_depts:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this department's tickets"
            )
        query = ticket_repository.get_filtered_tickets(
            db=db,
            department_ids=dept_supervisor_depts if not department_id else [department_id],
            category_id=category_id,
            resolution_time_range=resolution_time_range,
            ageing=ageing,
            priority=priority,
            status=status,
            delayed=delayed,
            skip=skip,
            limit=limit
        )
        return query

    # Agent - show tickets from their assigned categories
    if "agent" in role_names:
        return ticket_repository.get_tickets_by_agent_categories(
            agent_id=current_user.id,
            db=db,
            skip=skip,
            limit=limit,
            resolution_time_range=resolution_time_range,
            ageing=ageing,
            priority=priority,
            status=status,
            delayed=delayed
        )

    # Regular user (candidate) - show tickets they created with filter support
    return ticket_repository.get_tickets_by_user(
        current_user.id, 
        db, 
        skip=skip, 
        limit=limit,
        resolution_time_range=resolution_time_range,
        ageing=ageing,
        priority=priority,
        status=status,
        delayed=delayed
    )

@router.get('/paginated', response_model=PaginatedTicketResponse)
async def get_tickets_paginated(
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db),
    department_id: Optional[int] = None,
    category_id: Optional[int] = None,
    agent_id: Optional[int] = None,
    resolution_time_range: Optional[str] = None,
    ageing: Optional[str] = None,
    frt_bucket: Optional[str] = None,
    closure_sla: Optional[str] = None,
    priority: Optional[str] = None,
    status: Optional[str] = None,
    delayed: Optional[str] = None,
    search: Optional[str] = None,
    batch_id: Optional[int] = None,
    program_id: Optional[int] = None,
    university_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = 1,
    page_size: int = 20
):
    """
    Get tickets with server-side pagination.
    Returns {tickets, total, page, page_size, total_pages}
    """
    user_roles = user_repository.get_user_roles(db, current_user.id)
    role_names = [r.name for r in user_roles]

    common_params = dict(
        resolution_time_range=resolution_time_range,
        ageing=ageing,
        frt_bucket=frt_bucket,
        closure_sla=closure_sla,
        priority=priority,
        status=status,
        delayed=delayed,
        search=search,
        page=page,
        page_size=page_size,
    )

    # If agent_id is provided, get tickets visible to that agent
    if agent_id:
        return ticket_repository.get_tickets_by_agent_categories_paginated(
            agent_id=agent_id,
            db=db,
            batch_id=batch_id,
            program_id=program_id,
            university_id=university_id,
            start_date=start_date,
            end_date=end_date,
            **common_params
        )

    # Admin can see all tickets
    if "admin" in role_names:
        return ticket_repository.get_filtered_tickets_paginated(
            db=db,
            department_id=department_id,
            category_id=category_id,
            batch_id=batch_id,
            program_id=program_id,
            university_id=university_id,
            start_date=start_date,
            end_date=end_date,
            **common_params
        )

    # Department Manager
    dept_manager_depts = [
        getattr(role, 'department_id', None)
        for role in user_roles
        if role.name == "department-manager" and hasattr(role, 'department_id')
    ]
    if dept_manager_depts:
        if department_id and department_id not in dept_manager_depts:
            raise HTTPException(
                status_code=403,
                detail="Not authorized to view this department's tickets"
            )
        return ticket_repository.get_filtered_tickets_paginated(
            db=db,
            department_ids=dept_manager_depts if not department_id else [department_id],
            category_id=category_id,
            batch_id=batch_id,
            program_id=program_id,
            university_id=university_id,
            start_date=start_date,
            end_date=end_date,
            **common_params
        )

    # Department Supervisor
    dept_supervisor_depts = [
        getattr(role, 'department_id', None)
        for role in user_roles
        if role.name == "department-supervisor" and hasattr(role, 'department_id')
    ]
    if dept_supervisor_depts:
        if department_id and department_id not in dept_supervisor_depts:
            raise HTTPException(
                status_code=403,
                detail="Not authorized to view this department's tickets"
            )
        return ticket_repository.get_filtered_tickets_paginated(
            db=db,
            department_ids=dept_supervisor_depts if not department_id else [department_id],
            category_id=category_id,
            batch_id=batch_id,
            program_id=program_id,
            university_id=university_id,
            start_date=start_date,
            end_date=end_date,
            **common_params
        )

    # Agent - show tickets from their assigned categories
    if "agent" in role_names:
        return ticket_repository.get_tickets_by_agent_categories_paginated(
            agent_id=current_user.id,
            db=db,
            batch_id=batch_id,
            program_id=program_id,
            university_id=university_id,
            start_date=start_date,
            end_date=end_date,
            **common_params
        )

    # Regular user (candidate) — own tickets only
    return ticket_repository.get_filtered_tickets_paginated(
        db=db,
        created_by=current_user.id,
        category_id=category_id,
        batch_id=batch_id,
        program_id=program_id,
        university_id=university_id,
        start_date=start_date,
        end_date=end_date,
        **common_params
    )


@router.get('/{ticket_id}', response_model=TicketResponse)
async def get_ticket_by_id(
    ticket_id: int,
    # current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get a ticket by ID.
    - Admins can view any ticket
    - Agents can view tickets assigned to them
    - Users can view tickets they created
    """
    # Get ticket first
    ticket = ticket_repository.get_ticket_by_id(ticket_id, db)
    
    # Check permissions
    # user_roles = user_repository.get_user_roles(db, current_user.id)
    # role_names = [r.name for r in user_roles]
    
    # is_admin = "admin" in role_names
    # is_assigned_agent = ticket['assigned_to']['id'] == current_user.id if ticket.get('assigned_to') else False
    # is_ticket_creator = ticket['created_by']['id'] == current_user.id
    
    # if not (is_admin or is_assigned_agent or is_ticket_creator):
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Not authorized to view this ticket"
    #     )
    
    return ticket

# Thread Operations
@router.post("/{ticket_id}/threads", response_model=ThreadResponse)
async def create_thread(
    background_tasks: BackgroundTasks,
    ticket_id: int,
    message: str = Form(...),
    attachments: List[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    """Create a new thread for a ticket with optional attachments"""
    # Get ticket to access creator and assigned agent
    ticket = ticket_repository.get_ticket_by_id(ticket_id, db)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket {ticket_id} not found"
        )

    # Create thread data from form field
    thread = ThreadCreate(message=message)
    
    # Create thread in database
    db_thread = thread_repository.create_thread(db, thread, ticket_id, current_user.id)
    
    # Upload attachments to S3 if provided
    if attachments and any(attachment.filename for attachment in attachments):
        try:
            s3_urls = await s3_service.upload_files(attachments, ticket_id, 'thread')
            if s3_urls:  # Only update if we have valid URLs
                db_thread = thread_repository.update_thread_attachments(db_thread.id, s3_urls, db)
        except Exception as e:
            print(f"Error uploading attachments: {str(e)}")
            # You might want to add proper error logging here

    # Send thread notification
    requester_email = ticket['created_by']['email']
    
    # Send notification to requester if they're not the sender
    if requester_email and requester_email != current_user.email:
        await email_service.send_thread_notification(
            background_tasks=background_tasks,
            ticket_id=ticket_id,
            title=ticket['title'],
            sender_name=current_user.name,
            message=message,
            recipient_name=ticket['created_by']['name'],
            recipient_email=requester_email,
            is_agent_recipient=False
        )
    
    # Send notification to agents
    # If assigned_to is NOT NULL, send only to that agent
    # If assigned_to IS NULL, send to all agents based on category + batch
    if ticket.get('assigned_to'):
        # Ticket is manually assigned - send only to assigned agent
        agent_email = ticket['assigned_to']['email']
        if agent_email and agent_email != current_user.email:
            await email_service.send_thread_notification(
                background_tasks=background_tasks,
                ticket_id=ticket_id,
                title=ticket['title'],
                sender_name=current_user.name,
                message=message,
                recipient_name=ticket['assigned_to']['name'],
                recipient_email=agent_email,
                is_agent_recipient=True
            )
    else:
        # Ticket is auto-assigned (assigned_to is NULL) - send to all category+batch agents
        from app.db.models.ticket import Ticket
        from app.db.models.user_category import UserCategory
        from app.db.models.user_batch import UserBatch
        from app.db.models.role import Role
        
        db_ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        if db_ticket:
            # Get agents in the ticket's category
            agents_query = db.query(User).join(User.role).filter(
                Role.name == 'agent',
                User.is_active == True
            ).join(UserCategory, User.id == UserCategory.user_id).filter(
                UserCategory.category_id == db_ticket.category_id
            )
            
            # Get ticket creator's batches
            creator = db.query(User).filter(User.id == db_ticket.created_by).first()
            creator_batch_ids = [ub.batch_id for ub in creator.user_batches] if creator else []
            
            # If creator has batches, filter agents to those handling the same batches
            if creator_batch_ids:
                # Get agents who handle creator's batches
                batch_agents = agents_query.join(UserBatch, User.id == UserBatch.user_id).filter(
                    UserBatch.batch_id.in_(creator_batch_ids)
                ).distinct().all()
                
                # If no batch-specific agents, fall back to all category agents
                agents = batch_agents if batch_agents else agents_query.distinct().all()
            else:
                # Creator has no batch, send to all category agents
                agents = agents_query.distinct().all()
            
            # Send notification to all relevant agents (except the sender)
            for agent in agents:
                if agent.email and agent.email != current_user.email:
                    await email_service.send_thread_notification(
                        background_tasks=background_tasks,
                        ticket_id=ticket_id,
                        title=ticket['title'],
                        sender_name=current_user.name,
                        message=message,
                        recipient_name=agent.name,
                        recipient_email=agent.email,
                        is_agent_recipient=True
                    )
    
    return db_thread

@router.get("/{ticket_id}/threads", response_model=List[ThreadResponse])
def get_ticket_threads(
    ticket_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    return thread_repository.get_threads_by_ticket(ticket_id, db)

@router.get("/{ticket_id}/threads/{thread_id}", response_model=ThreadResponse)
def get_ticket_thread(
    ticket_id: int,
    thread_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    thread = thread_repository.get_thread_by_id(thread_id, db)
    if not thread or thread.ticket_id != ticket_id:
        raise HTTPException(status_code=404, detail="Thread not found")
    return thread

# UPDATE Operations
@router.put('/{ticket_id}/assign-agent/{agent_id}', response_model=TicketResponse)
async def assign_ticket_to_agent(
    ticket_id: int,
    agent_id: int,
    background_tasks: BackgroundTasks,
    current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually assign a ticket to a specific agent"""
    # Get ticket
    ticket = ticket_repository.get_ticket_by_id(ticket_id, db)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket {ticket_id} not found"
        )
    
    # Verify agent exists and is active
    agent = user_repository.get_user_by_id(db, agent_id)
    if not agent or not agent.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Agent {agent_id} not found or inactive"
        )
    
    # Verify agent has the role "agent"
    if agent.role.name != "agent":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User {agent_id} is not an agent"
        )
    
    # Manually assign ticket to the agent
    updated_ticket = ticket_repository.assign_ticket_to_agent(ticket_id, agent_id, db)
    
    # Send email notification to the assigned agent
    def send_assignment_email(ticket_id, title, agent_email, agent_name):
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            loop.run_until_complete(
                email_service.send_reassign_notification(
                    background_tasks=None,
                    ticket_id=ticket_id,
                    title=title,
                    recipients=[agent_email]
                )
            )
            logging.info(f"✓ Sent manual assignment notification for ticket {ticket_id} to {agent_name} <{agent_email}>")
            
            loop.close()
        except Exception as e:
            logging.error(f"Error sending assignment notification for ticket {ticket_id}: {str(e)}")
    
    # Start background thread for email notification
    threading.Thread(
        target=send_assignment_email,
        args=(ticket_id, ticket['title'], agent.email, agent.name),
        daemon=True
    ).start()
    
    return updated_ticket

@router.put('/{ticket_id}/reassign/{category_id}', response_model=TicketResponse)
async def reassign_ticket(
    ticket_id: int,
    category_id: int,
    background_tasks: BackgroundTasks,
    # current_user: UserResponse = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reassign a ticket to a new category and automatically to an agent in that category"""
    # Get ticket
    ticket = ticket_repository.get_ticket_by_id(ticket_id, db)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticket {ticket_id} not found"
        )
    
    # Check permissions
    # user_roles = user_repository.get_user_roles(db, current_user.id)
    # role_names = [r.name for r in user_roles]
    
    # is_admin = "admin" in role_names
    # is_assigned_agent = "agent" in role_names or "department-manager" in role_names or "department-supervisor" in role_names
    
    # if not (is_admin or is_assigned_agent):
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Not authorized to reassign tickets"
    #     )
    
    # Reassign ticket to new category and get assigned agent
    updated_ticket = ticket_repository.reassign_ticket(ticket_id, category_id, db)
    
    # Get all agents in the new category for notifications
    category_agents = updated_ticket.get('category_agents', [])
    
    # Handle email notifications to all agents in the category
    if category_agents and len(category_agents) > 0:
        # Function to handle email notifications in background
        def send_reassign_email_notifications(ticket_id, title, agents):
            try:
                # Create a new event loop for async operations in this thread
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
                
                # Send email notification to each agent
                for agent in agents:
                    loop.run_until_complete(
                        email_service.send_reassign_notification(
                            background_tasks=None,  # No background tasks in this context
                            ticket_id=ticket_id,
                            title=title,
                            recipients=[agent['email']]
                        )
                    )
                    logging.info(f"Successfully sent reassignment notification for ticket {ticket_id} to {agent['email']}")
                
                loop.close()
            except Exception as e:
                # Log the error but don't affect the main service
                logging.error(f"Error sending reassignment notifications for ticket {ticket_id}: {str(e)}")
        
        # Start background thread for email notifications
        threading.Thread(
            target=send_reassign_email_notifications,
            args=(ticket_id, ticket['title'], category_agents),
            daemon=True  # Make thread a daemon so it doesn't block application shutdown
        ).start()
    
    # Send notification to ticket creator
    # creator = user_repository.get_user_by_id(db, updated_ticket['creator']['id'])
    # if creator:
    #     notification_data = {
    #         "title": f"Ticket #{ticket_id} reassigned",
    #         "message": f"Your ticket has been reassigned to category {category.description}",
    #         "ticket_id": ticket_id
    #     }
    #     background_tasks.add_task(
    #         # notification_repository.create_notification,
    #         creator.id,
    #         notification_data,
    #         db
    #     )
    
    return updated_ticket

@router.put('/{ticket_id}/status', response_model=TicketResponse)
async def update_ticket_status(
    ticket_id: int,
    status_update: TicketStatusUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Update ticket status
    """
    # Check if the ticket exists
    ticket = ticket_repository.get_ticket_by_id(ticket_id, db)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    # Check if the user has permission to update the ticket
    # if not current_user.is_superuser and ticket.assigned_to != current_user.id and ticket.created_by != current_user.id:
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Not authorized to update this ticket"
    #     )
    
    # Check if the status exists
    status_obj = db.query(Status).filter(Status.id == status_update.status_id).first()
    if not status_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Status not found"
        )
    
    # If the status is "closed", require a closing reason
    if status_obj.name.lower() == "closed":
        if current_user.role.name != "candidate" and (not ticket.get('issue_type') or not ticket.get('disposition')):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please select issue type and disposition before closing ticket"
            )

        if not status_update.closing_reason:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A closing reason is required when closing a ticket"
            )
        
        # Create a thread post with the closing reason
        thread = ThreadCreate(message=f"Ticket closed: {status_update.closing_reason}")
        thread_repository.create_thread(db, thread, ticket_id, current_user.id)
        
        # Get the ticket details for email notification
        # ticket_with_details = ticket_repository.get(ticket_id, db)
        
        creator = ticket['created_by']
        assigned_agent = ticket['assigned_to']
        
        if creator and assigned_agent:
            # Send email notifications
            await email_service.send_ticket_closed_notification(
                background_tasks=background_tasks,
                ticket_id=ticket_id,
                title=ticket['title'],
                closing_reason=status_update.closing_reason,
                requester_name=creator['name'],
                requester_email=creator['email'],
                agent_name=assigned_agent['name'],
                agent_email=assigned_agent['email']
            )
    
    # Update the ticket status (pass current_user.id to track who closed it)
    updated_ticket = ticket_repository.update_ticket_status_by_id(ticket_id, status_update.status_id, current_user.id, db)
    return updated_ticket

@router.put('/{ticket_id}/priority', response_model=TicketResponse)
async def update_ticket_priority(
    ticket_id: int,
    priority_update: TicketPriorityUpdate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Update ticket priority (internal use only - agents, managers, supervisors)
    Candidates cannot set or see priority
    """
    # Check if user is internal (agent, manager, supervisor, admin)
    allowed_roles = ['agent', 'department-manager', 'department-supervisor', 'admin']
    if current_user.role.name not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only internal users can set ticket priority"
        )
    
    # Check if the ticket exists
    ticket = ticket_repository.get_ticket_by_id(ticket_id, db)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found"
        )
    
    # Update the ticket priority
    updated_ticket = ticket_repository.update_ticket_priority(ticket_id, priority_update.priority, db)
    return updated_ticket

@router.put('/{ticket_id}/issue-classification', response_model=TicketResponse)
async def update_ticket_issue_classification(
    ticket_id: int,
    payload: TicketIssueClassificationUpdate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    """
    Update issue type and disposition for a ticket (internal users only).
    Candidates/students cannot mark tickets.
    """
    allowed_roles = ['agent', 'department-manager', 'department-supervisor', 'admin']
    if current_user.role.name not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only internal users can set issue type/disposition"
        )

    return ticket_repository.update_ticket_issue_classification(
        ticket_id,
        payload.issue_type_id,
        payload.disposition_id,
        db
    )

@router.get("/agent/{agent_id}/dashboard", response_model=Dict)
def get_agent_ticket_dashboard(
    agent_id: int,
    skip: int = 0,
    limit: int = 3000,
    program_id: Optional[int] = Query(None, description="Filter by ticket creator's program"),
    batch_id: Optional[int] = Query(None, description="Filter by ticket creator's batch"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a comprehensive view of tickets for an agent, including:
    1. Tickets from all categories they are assigned to
    2. Category-wise ticket breakdown with metrics
    """
    # Check if the user is requesting their own dashboard or has admin/supervisor rights
    if current_user.id != agent_id and current_user.role.name not in ['admin', 'department-manager', 'department-supervisor']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    return ticket_repository.get_agent_ticket_dashboard(
        agent_id, db, skip, limit, program_id=program_id, batch_id=batch_id
    )


# READ Operation
@router.get('/category/{category_id}/agents')
async def get_agents_by_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(get_current_user)
):
    """Get all active agents assigned to a specific category for reassignment"""
    agents = ticket_repository.get_category_agents(db, category_id)
    
    return [
        {
            "id": agent.id,
            "name": agent.name,
            "email": agent.email,
            "batches": [
                {
                    "id": ub.batch.id,
                    "name": ub.batch.name
                }
                for ub in agent.user_batches
            ]
        }
        for agent in agents
    ]

@router.get('/frt/overall', response_model=Dict)
def get_overall_frt(
    program_id: Optional[int] = Query(None, description="Filter by ticket creator's program"),
    batch_id: Optional[int] = Query(None, description="Filter by ticket creator's batch"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get overall First Response Time (FRT) metrics.
    Managers and supervisors see metrics for their departments only.
    Admins see all metrics.
    """
    return ticket_repository.get_overall_frt_metrics(
        db, current_user, program_id=program_id, batch_id=batch_id
    )

@router.get('/frt/agents', response_model=List[Dict])
def get_agent_frt(
    program_id: Optional[int] = Query(None, description="Filter by ticket creator's program"),
    batch_id: Optional[int] = Query(None, description="Filter by ticket creator's batch"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get First Response Time (FRT) metrics for all agents.
    Managers and supervisors see metrics for agents in their departments only.
    Admins see all agent metrics.
    """
    return ticket_repository.get_agent_frt_metrics(
        db, current_user, program_id=program_id, batch_id=batch_id
    )