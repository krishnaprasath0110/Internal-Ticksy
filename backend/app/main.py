from contextlib import asynccontextmanager
from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from app.api.endpoints.api_router import api_router
from app.core.config import settings
from fastapi import FastAPI
from app.db.session import engine, SessionLocal
from app.db.base import Base
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.executors.pool import ThreadPoolExecutor
from app.services.email_service import email_service
from app.repositories.ticket_repository import check_delayed_tickets, update_ticket_priority_by_frt, auto_close_tickets_without_student_reply
from app.services.auto_response_service import initialize as init_auto_response
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s: %(message)s',
)
logger = logging.getLogger(__name__)

# Reduce logging from other modules
logging.getLogger("apscheduler").setLevel(logging.WARNING)
logging.getLogger("urllib3").setLevel(logging.WARNING)
logging.getLogger("sqlalchemy").setLevel(logging.WARNING)
logging.getLogger("email").setLevel(logging.WARNING)
logging.getLogger("asyncio").setLevel(logging.WARNING)

# Base.metadata.create_all(bind=engine)
# Email processing configuration
EMAIL_PROCESSING = True  # Enabled by default
EMAIL_PROCESSING_INTERVAL = 2  # minutes - optimized for 10+ program emails
EMAIL_CHECK_WINDOW_MINUTES = 5  # Check emails from last 5 minutes instead of 1 hour
TICKET_DELAY_CHECK_INTERVAL = 1 # hours
FRT_PRIORITY_CHECK_INTERVAL = 1 # hours - check and update ticket priorities based on FRT

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Configure scheduler with thread pool executor
    executors = {
        'default': ThreadPoolExecutor(max_workers=2)  # Reduced from 3 since less frequent processing
    }
    
    scheduler = AsyncIOScheduler(executors=executors)
    
    if EMAIL_PROCESSING:
        # Create a wrapper function that properly awaits the coroutine
        def process_emails_wrapper():
            import asyncio
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                background_tasks = BackgroundTasks()
                loop.run_until_complete(email_service.process_email_replies(background_tasks))
            except Exception as e:
                logger.error(f"Error processing emails: {str(e)}")
            finally:
                loop.close()
        # Add email processing job with proper error handling
        scheduler.add_job(
            process_emails_wrapper,  # Use the wrapper function instead of the coroutine
            'interval',
            minutes=EMAIL_PROCESSING_INTERVAL,
            max_instances=1,  # Prevent multiple instances running simultaneously
            misfire_grace_time=300,  # 5 minutes grace time for missed runs
            executor='default'  # Use thread pool executor
        )
        logger.info(f"Email processing scheduler started. Interval: {EMAIL_PROCESSING_INTERVAL} minutes")

    # Add ticket delay check job
    async def check_ticket_delays():
        try:
            db = SessionLocal()
            delayed_tickets = await check_delayed_tickets(db, email_service)
            if delayed_tickets:
                logger.info(f"Found and marked {len(delayed_tickets)} delayed tickets")
        except Exception as e:
            logger.error(f"Error checking delayed tickets: {str(e)}")
        finally:
            db.close()
    
    # Create a wrapper function that properly awaits the coroutine
    def check_ticket_delays_wrapper():
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            loop.run_until_complete(check_ticket_delays())
        except Exception as e:
            logger.error(f"Error in check_ticket_delays_wrapper: {str(e)}")
        finally:
            loop.close()
    
    scheduler.add_job(
        check_ticket_delays_wrapper,  # Use the wrapper function instead of the coroutine
        'interval',
        hours=TICKET_DELAY_CHECK_INTERVAL,
        max_instances=1,
        misfire_grace_time=300,
        executor='default'  # Use thread pool executor
    )
    logger.info(f"Ticket delay check scheduler started. Interval: {TICKET_DELAY_CHECK_INTERVAL} hours")

    def auto_close_tickets_wrapper():
        db = SessionLocal()
        try:
            closed_ids = auto_close_tickets_without_student_reply(db)
            if closed_ids:
                logger.info(f"Auto-closed {len(closed_ids)} ticket(s) after 1 minute without student reply")
        except Exception as e:
            logger.error(f"Error auto-closing inactive tickets: {str(e)}")
        finally:
            db.close()

    scheduler.add_job(
        auto_close_tickets_wrapper,
        'interval',
        minutes=1,
        max_instances=1,
        misfire_grace_time=300,
        executor='default'
    )
    logger.info("Ticket auto-close scheduler started. Inactivity threshold: 1 minute")
    
    # Add FRT-based priority update job
    def update_frt_priorities_wrapper():
        import asyncio
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            db = SessionLocal()
            updated_tickets = update_ticket_priority_by_frt(db)
            if updated_tickets:
                logger.info(f"Updated priority for {len(updated_tickets)} tickets based on FRT")
                for ticket in updated_tickets:
                    logger.info(f"  Ticket #{ticket['ticket_id']}: {ticket['old_priority']} → {ticket['new_priority']} (FRT: {ticket['frt_hours']}h)")
        except Exception as e:
            logger.error(f"Error updating FRT priorities: {str(e)}")
        finally:
            db.close()
    
    scheduler.add_job(
        update_frt_priorities_wrapper,
        'interval',
        hours=FRT_PRIORITY_CHECK_INTERVAL,
        max_instances=1,
        misfire_grace_time=300,
        executor='default'  # Use thread pool executor
    )
    logger.info(f"FRT-based priority check scheduler started. Interval: {FRT_PRIORITY_CHECK_INTERVAL} hours")
    
    scheduler.start()
    yield
    
    scheduler.shutdown()
    logger.info("Schedulers stopped")

app = FastAPI(
    title="OS Ticket API",
    description="API for OS Ticketing System",
    version="1.0.0",
    lifespan=lifespan  # Enable the lifespan function
)

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,  # Allow credentials (cookies, authorization headers)
    allow_methods=["*"],    # Allow all methods
    allow_headers=["*"],    # Allow all headers
    expose_headers=["*"]    # Expose all headers to the frontend
)

app.include_router(api_router)

@app.get('/')
def root():
    return {"message":"Welcome to Ticksy!"}

@app.on_event("startup")
async def startup_event():
    # Initialize auto-response service
    db = SessionLocal()
    try:
        init_auto_response(db)
        logger.info("Auto-response service initialized successfully")
    except Exception as e:
        logger.error(f"Error initializing auto-response service: {str(e)}")
    finally:
        db.close()
