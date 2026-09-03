from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from fastapi import BackgroundTasks
from email.parser import Parser
from email.header import decode_header
import imaplib
import email
import re
import logging
import smtplib
from typing import Optional, List
from sqlalchemy import and_
from app.core.config import settings
from app.db.session import SessionLocal
from app.db.models.ticket import Ticket
from app.db.models.thread import Thread
from app.db.models.user import User
from app.db.models.category import Category
from app.db.models.department import Department
from app.db.models.user_department import UserDepartment
from app.db.models.program import Program
from datetime import datetime, timedelta, timezone
from . import email_templates
import hashlib
import requests
import random
import string
import time
from app.core.security import create_access_token
from app.services.auto_response_service import generate_auto_response

logger = logging.getLogger(__name__)

smtplib.SMTP.debuglevel = 1

class EmailService:
    def __init__(self):
        self.config = {
            'MAIL_USERNAME': settings.SMTP_USER,
            'MAIL_PASSWORD': settings.SENDGRID_API_KEY,
            'MAIL_FROM': settings.EMAILS_FROM_EMAIL,
            'MAIL_PORT': settings.SMTP_PORT,
            'MAIL_SERVER': settings.SMTP_HOST,
            'MAIL_FROM_NAME': settings.EMAILS_FROM_NAME,
            'MAIL_STARTTLS': settings.SMTP_TLS,
            'MAIL_SSL_TLS': False,
            'USE_CREDENTIALS': True,
            'VALIDATE_CERTS': False
        }
        self.connection_config = ConnectionConfig(**self.config)
        self.fastmail = FastMail(self.connection_config)

    async def send_email(
        self, 
        subject: str, 
        recipients: List[str], 
        body: str, 
        references: Optional[List[str]] = None,
        in_reply_to: Optional[str] = None,
        html: bool = True
    ):
        """Generic method to send emails with threading support"""
        try:
            # Only set References and In-Reply-To headers if provided
            headers = {}
            if references:
                headers["References"] = " ".join(references)
            if in_reply_to:
                headers["In-Reply-To"] = in_reply_to
            
            message = MessageSchema(
                subject=subject,
                recipients=recipients,
                body=body,
                subtype="html" if html else "plain",
                headers=headers
            )
            
            await self.fastmail.send_message(message)
            logger.info(f"Email sent to {recipients} with subject: {subject}")
            return True
        except Exception as e:
            logger.error(f"Failed to send email: {str(e)}")
            return False
    
    async def send_ticket_creation_notification(
        self,
        background_tasks: BackgroundTasks,
        ticket_id: int,
        title: str,
        description: str,
        creator_name: str,
        creator_email: str,
        agent_name: str,
        agent_email: str
    ):
        """Send ticket creation notifications to both candidate and agent"""
        # Prepare email content
        candidate_subject = f"[Ticket #{ticket_id}] Your ticket has been created"
        candidate_body = email_templates.get_ticket_creation_candidate_template(
            ticket_id=ticket_id,
            title=title,
            description=description,
            creator_name=creator_name,
            creator_email=creator_email
        )
        
        agent_subject = f"[Ticket #{ticket_id}] New ticket assigned to you"
        agent_body = email_templates.get_ticket_creation_agent_template(
            ticket_id=ticket_id,
            title=title,
            description=description,
            creator_name=creator_name,
            agent_name=agent_name,
            agent_email=agent_email
        )
        
        # Send emails
        await self.send_email(
            candidate_subject,
            [creator_email],
            candidate_body
        )
        
        await self.send_email(
            agent_subject,
            [agent_email],
            agent_body
        )

    async def send_thread_notification(
        self,
        background_tasks: BackgroundTasks,
        ticket_id: int,
        title: str,
        sender_name: str,
        message: str,
        recipient_name: str,
        recipient_email: str,
        is_agent_recipient: bool
    ):
        """Send thread reply notification with separate templates for agents and requesters"""
        # Create descriptive subject line while maintaining thread
        subject = f"""Re: [Ticket #{ticket_id}] {title} - New Reply from {sender_name}"""
        
        # Use different templates based on recipient type
        body = (
            email_templates.get_thread_reply_agent_template(
                ticket_id=ticket_id,
                title=title,
                sender_name=sender_name,
                recipient_name=recipient_name,
                recipient_email=recipient_email,
                message=message
            ) if is_agent_recipient else
            email_templates.get_thread_reply_candidate_template(
                ticket_id=ticket_id,
                title=title,
                sender_name=sender_name,
                recipient_name=recipient_name,
                recipient_email=recipient_email,
                message=message
            )
        )
        
        # Send email with threading headers
        await self.send_email(
            subject,
            [recipient_email],
            body
        )

    async def send_reassign_notification(
        self,
        background_tasks: BackgroundTasks,
        ticket_id: int,
        title: str,
        recipients: List[str]
    ):
        """Send notification to agent when a ticket is reassigned to them"""
        # Create subject line
        subject = f"""[Ticket #{ticket_id}] {title} - Reassigned to You"""
        
        # Use reassign template
        body = email_templates.get_reassign_template(
            ticket_id=ticket_id,
            title=title,
            recipient_email=recipients[0]
        )
            
        # Send email
        await self.send_email(
            subject,
            recipients,
            body
        )

    async def send_ticket_closed_notification(
        self,
        background_tasks: BackgroundTasks,
        ticket_id: int,
        title: str,
        closing_reason: str,
        requester_name: str,
        requester_email: str,
        agent_name: str,
        agent_email: str
    ):
        """Send notifications when a ticket is closed to both requester and agent"""
        # Create subject line for requester
        requester_subject = f"""[Ticket #{ticket_id}] {title} - Ticket Closed"""
        
        # Use ticket closed template for requester
        requester_body = email_templates.get_ticket_closed_requester_template(
            ticket_id=ticket_id,
            title=title,
            closing_reason=closing_reason,
            requester_name=requester_name,
            requester_email=requester_email
        )
        
        # Send email to requester
        await self.send_email(
            requester_subject,
            [requester_email],
            requester_body
        )
            
        # Create subject line for agent
        agent_subject = f"""[Ticket #{ticket_id}] {title} - Ticket Closed"""
        
        # Use ticket closed template for agent
        agent_body = email_templates.get_ticket_closed_agent_template(
            ticket_id=ticket_id,
            title=title,
            closing_reason=closing_reason,
            agent_name=agent_name,
            agent_email=agent_email
        )
        
        # Send email to agent
        await self.send_email(
            agent_subject,
            [agent_email],
            agent_body
        )

    async def send_tat_exceeded_notification(
        self,
        background_tasks: BackgroundTasks,
        ticket_id: int,
        title: str,
        created_at: datetime,
        tat_hours: int,
        recipients: List[str]
    ):
        """Send TAT exceeded notification"""
        subject = f"Ticket #{ticket_id} - \"{title}\" Has Exceeded Resolution Time"
        body = email_templates.get_tat_exceeded_template(
            ticket_id=ticket_id,
            title=title,
            created_at=created_at.strftime("%Y-%m-%d %H:%M:%S"),
            tat_hours=tat_hours,
            # agent_name=recipients[0]
        )
        await self.send_email(
            subject,
            recipients,
            body
        )
        
        
    def _clean_reply(self, content: str) -> str:
        """Clean up email reply by removing quoted text and signatures"""
        # Remove quoted text (lines starting with >)
        # Remove quoted text (lines starting with >)
        lines = content.split('\n')
        clean_lines = [line for line in lines if not line.strip().startswith('>')]
        
        # Join lines back together
        content = '\n'.join(clean_lines)
        
        # Handle Gmail's "On [date], [sender] wrote:" pattern specifically
        # This pattern often appears with the format:
        # 
        # User's new message
        # 
        # On Tue, Aug 12, 2025 at 4:54 PM Sender <sender@example.com> wrote:
        # > Original message
        
        gmail_pattern = r'\s*\n\s*On\s+[A-Za-z]{3},\s+[A-Za-z]{3}\s+\d{1,2},\s+\d{4}\s+at\s+\d{1,2}:\d{2}\s+[APM]{2}\s+.+?wrote:.*$'
        content = re.sub(gmail_pattern, '', content, flags=re.DOTALL | re.IGNORECASE)
        
        # Remove common email client reply headers
        reply_headers = [
            "On .* wrote:",  # Other email clients
            "-+Original Message-+",
            "From: .*\nSent: .*\nTo: .*\nSubject: .*",
            "From: .*\nDate: .*\nSubject: .*\nTo: .*",
            "-----Original Appointment-----"
        ]
        
        for header in reply_headers:
            content = re.split(header, content, flags=re.IGNORECASE | re.DOTALL)[0]
        
        # Remove everything after common email signature markers
        signature_markers = [
            '--\n', 
            '___',
            'Best regards',
            'Kind regards', 
            'Regards',
            'Thanks & Regards',
            'Thank you',
            'Sincerely',
            'Cheers',
            '\nOn ',  # Common reply indicator
            '\n\nSent from',  # Mobile signatures
            '\n\nGet Outlook',  # Outlook signatures
            '\n\nFrom:',  # Another reply format
        ]
        
        for marker in signature_markers:
            if marker in content:
                content = content.split(marker)[0]
        
        # Advanced signature detection using regex patterns
        # Match common patterns like phone numbers, social media links, etc.
        signature_patterns = [
            # Phone numbers
            r'\+\d{1,3}[-\s]?\d{3,}[-\s]?\d{3,}',
            # Social media links
            r'https?://(?:www\.)?(?:facebook|linkedin|twitter|instagram|youtube)\.com/\S+',
            # Email addresses at the end of a line
            r'\n[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\s*$',
            # Common signature dividers
            r'\n-{3,}',
            r'\n_{3,}',
            r'\n\*{3,}',
            # Job titles and company names pattern (typical in signatures)
            r'\n[A-Z][a-z]+ (?:[A-Z][a-z]+ )*(?:Engineer|Manager|Director|CEO|CTO|Officer|Developer|Designer|Analyst|Consultant)\s*\n',
            # Location and address patterns
            r'\n[A-Z][a-z]+,\s+[A-Z][a-z]+\s*$',  # City, State pattern
        ]
        
        # Find the earliest signature pattern match
        earliest_pos = len(content)
        for pattern in signature_patterns:
            matches = list(re.finditer(pattern, content, re.MULTILINE))
            if matches:
                # Find the position of the first line containing the signature pattern
                for match in matches:
                    # Get the position of the beginning of the line containing the match
                    line_start = content.rfind('\n', 0, match.start()) + 1
                    if line_start > 0 and line_start < earliest_pos:
                        # Found an earlier signature marker
                        earliest_pos = line_start
        
        # Trim content at the earliest signature position if found
        if earliest_pos < len(content):
            content = content[:earliest_pos]
        
        # Remove consecutive blank lines (more than 2)
        content = re.sub(r'\n{3,}', '\n\n', content)
        
        # Final cleanup - remove any trailing "Thanks," or similar
        thanks_patterns = [
            r'\s*Thanks,\s*$',
            r'\s*Thank you,\s*$',
            r'\s*Regards,\s*$',
            r'\s*Best,\s*$',
            r'\s*Cheers,\s*$',
        ]
        
        for pattern in thanks_patterns:
            content = re.sub(pattern, '', content, flags=re.IGNORECASE)
            
        return content.strip()

    async def process_email_replies(self, background_tasks: BackgroundTasks):
        """Process incoming email replies and create ticket threads"""
        with SessionLocal() as db:
            # Get programs with email configuration
            programs = db.query(Program).filter(
                Program.email.isnot(None),
                Program.email_password.isnot(None)
            ).all()
            
            if not programs:
                return
            
            logger.info(f"Processing emails for {len(programs)} programs")
                
            for program in programs:
                try:
                    host = settings.IMAP_HOST
                    port = settings.IMAP_PORT
                    username = program.email
                    password = program.email_password
                    
                    if username and password:
                        await self._process_email_account(
                            background_tasks,
                            host,
                            port,
                            username,
                            password,
                            program_id=program.id
                        )
                except Exception as e:
                    logger.error(f"Error processing program email {program.email}: {str(e)}")
        
        logger.info("Email processing completed")
    
    async def _process_email_account(
        self, 
        background_tasks: BackgroundTasks, 
        host: str, 
        port: int, 
        username: str, 
        password: str,
        program_id: int = None
    ):
        """Process emails from a specific email account"""
        # Runs on a scheduler; keep as DEBUG to avoid log noise.
        logger.debug(f"Connecting to email server {host}:{port} with username {username}")
        mail = None
        inbox_selected = False
        try:
            # Create a new IMAP connection
            try:
                mail = imaplib.IMAP4_SSL(host, port)
            except Exception as e:
                logger.warning(f"Failed to establish IMAP connection for {username}: {e}")
                return
            
            try:
                mail.login(username, password)
            except Exception as e:
                logger.warning(f"IMAP login failed for {username}: {e}")
                return
            
            try:
                status, mailbox_data = mail.select('INBOX')
                if status != 'OK':
                    logger.warning(f"Failed to select INBOX for {username}: {status}")
                    return
                inbox_selected = True
            except Exception as e:
                logger.warning(f"Error selecting INBOX for {username}: {e}")
                return

            # Get date for last 5 minutes in IMAP date format
            # Import the configuration from main.py
            from app.main import EMAIL_CHECK_WINDOW_MINUTES
            check_window_minutes = EMAIL_CHECK_WINDOW_MINUTES if 'EMAIL_CHECK_WINDOW_MINUTES' in dir() else 5
            
            last_check_time = (datetime.now(timezone.utc) - timedelta(minutes=check_window_minutes)).strftime("%d-%b-%Y")
            
            # Search for unread emails from the last N minutes
            search_criteria = f'(UNSEEN SINCE {last_check_time})'
            # Too noisy at INFO (runs on a scheduler); keep as DEBUG.
            logger.debug(f"Searching for emails from last {check_window_minutes} minutes with criteria: {search_criteria}")
            status, message_numbers = mail.search(None, search_criteria)
            
            if status != 'OK':
                logger.error(f"Failed to search emails: {status}")
                return
            
            if not message_numbers[0]:
                logger.debug("No unread emails found")
                return
                
            email_count = len(message_numbers[0].split())
            logger.info(f"Found {email_count} unread emails")
            
            for num in message_numbers[0].split():
                try:
                    status, msg_data = mail.fetch(num, '(RFC822)')
                    
                    if status != 'OK':
                        logger.error(f"Failed to fetch email {num}: {status}")
                        continue
                        
                    if not msg_data or not msg_data[0]:
                        logger.error(f"No data returned for email {num}")
                        continue
                    
                    # Handle different response formats
                    email_body = None
                    if isinstance(msg_data[0], tuple) and len(msg_data[0]) > 1:
                        email_body = msg_data[0][1]
                    else:
                        # Try to find the email body in the response
                        for part in msg_data:
                            if isinstance(part, tuple) and len(part) > 1:
                                email_body = part[1]
                                break
                    
                    if not email_body:
                        logger.error(f"Could not extract email body from response for email {num}")
                        continue
                      
                    # Parse the email
                    parser = Parser()
                    msg = parser.parsestr(email_body.decode())
                    
                    # Extract and decode subject early
                    raw_subject = msg.get('subject', '') or ""
                    # Decode MIME encoded-word format (RFC 2047)
                    decoded_parts = decode_header(raw_subject)
                    subject_parts = []
                    for content, encoding in decoded_parts:
                        if isinstance(content, bytes):
                            # Decode bytes using the specified encoding or utf-8 as fallback
                            subject_parts.append(content.decode(encoding or 'utf-8', errors='ignore'))
                        else:
                            subject_parts.append(content)
                    subject = ''.join(subject_parts)
                    
                    # Extract sender email early and verify user exists in database
                    sender_email = email.utils.parseaddr(msg['from'])[1]
                    with SessionLocal() as db:
                        user = db.query(User).filter(User.email == sender_email).first()
                        if not user:
                            logger.warning(f"⚠ Email from {sender_email} rejected - user not found in database. Email kept unread.")
                            # DO NOT MARK EMAIL AS READ
                            continue  # Skip to next email without marking as read
                        
                        # Check if user is a student (role_id == 5)
                        if user.role_id != 5:
                            logger.warning(f"⚠ Email from {sender_email} ({user.name}) rejected - sender is not a student (role_id: {user.role_id}). Email kept unread.")
                            # DO NOT MARK EMAIL AS READ
                            continue  # Skip to next email without marking as read
                        
                        logger.info(f"✓ Processing email from student {user.name} ({sender_email}): {subject[:50]}...")
                    
                    # Extract message headers
                    message_id = msg.get('Message-ID', '')
                    clean_message_id = message_id[1:-1] if message_id.startswith('<') and message_id.endswith('>') else message_id
                    references = msg.get('References', '')
                    in_reply_to = msg.get('In-Reply-To', '')
                    
                    # Check if this is a reply to an existing ticket
                    is_reply = False
                    ticket_id = None
                    
                    # First check if subject contains ticket number in format [Ticket #123]
                    ticket_id_match = re.search(r'\[Ticket #(\d+)\]', subject)
                    if ticket_id_match:
                        ticket_id = int(ticket_id_match.group(1))
                        logger.info(f"Found ticket ID in subject: {ticket_id}")
                        is_reply = True
                    
                    # Then check if it has References or In-Reply-To headers
                    elif references or in_reply_to:
                        logger.info("Email has References or In-Reply-To headers, likely a reply")
                        is_reply = True
                    
                    # If this is a reply, try to find the existing ticket
                    if is_reply:
                        logger.info("Processing as a reply to an existing ticket")
                        
                        # Try to find ticket by ID first if we have it from subject
                        if ticket_id:
                            with SessionLocal() as db:
                                ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
                                if ticket:
                                    logger.info(f"Found ticket with ID {ticket_id} from subject line")
                                else:
                                    logger.warning(f"Ticket ID {ticket_id} from subject not found in database")
                                    ticket_id = None
                        
                        # If no ticket ID from subject or not found in DB, try message ID references
                        if not ticket_id:
                            # Try to find by message ID references
                            ref_ids = []
                            
                            # Extract message IDs from References and In-Reply-To
                            if references:
                                ref_ids.extend([ref.strip() for ref in references.split() if ref.strip()])
                            
                            if in_reply_to:
                                in_reply_id = in_reply_to.strip()
                                if in_reply_id and in_reply_id not in ref_ids:
                                    ref_ids.append(in_reply_id)
                            
                            # Clean up message IDs (remove angle brackets)
                            clean_ref_ids = []
                            for ref_id in ref_ids:
                                if ref_id.startswith('<') and ref_id.endswith('>'):
                                    clean_ref_ids.append(ref_id[1:-1])
                                else:
                                    clean_ref_ids.append(ref_id)
                            
                            logger.info(f"Looking for tickets with message IDs: {clean_ref_ids}")
                            
                            # Try to find ticket by message ID
                            if clean_ref_ids:
                                for ref_id in clean_ref_ids:
                                    with SessionLocal() as db:
                                        # Try exact match first
                                        ticket = db.query(Ticket).filter(Ticket.email_message_id == ref_id).first()
                                        if ticket:
                                            ticket_id = ticket.id
                                            break
                                        
                                        # Try with angle brackets if not found (in case stored with brackets)
                                        if not ticket and not (ref_id.startswith('<') and ref_id.endswith('>')):
                                            bracketed_ref_id = f"<{ref_id}>"
                                            ticket = db.query(Ticket).filter(Ticket.email_message_id == bracketed_ref_id).first()
                                            if ticket:
                                                ticket_id = ticket.id
                                                break
                                        
                                        # Try without angle brackets if not found (in case stored without brackets)
                                        if not ticket and ref_id.startswith('<') and ref_id.endswith('>'):
                                            unbracketed_ref_id = ref_id[1:-1]
                                            ticket = db.query(Ticket).filter(Ticket.email_message_id == unbracketed_ref_id).first()
                                            if ticket:
                                                ticket_id = ticket.id
                                                logger.info(f"Found ticket with ID {ticket_id} matching unbracketed reference {unbracketed_ref_id}")
                                                break
                        
                        # If we still haven't found a ticket, this might be a reply to an email that wasn't properly tracked
                        # In this case, we'll treat it as a new ticket
                        if not ticket_id:
                            logger.info("Could not find existing ticket for this reply, treating as new ticket")
                            is_reply = False
                    
                    # If this is a reply, create a thread
                    if is_reply:
                        # Get the email content
                        if msg.is_multipart():
                            content = ''
                            for part in msg.walk():
                                if part.get_content_type() == "text/plain":
                                    content = part.get_payload(decode=True).decode()
                                    break
                        else:
                            content = msg.get_payload(decode=True).decode()
                        
                        # Clean up quoted text and signatures
                        content = self._clean_reply(content)
                        
                        with SessionLocal() as db:
                            # First check if the user exists in our database
                            # user = db.query(User).filter(User.email == email.utils.parseaddr(msg['from'])[1]).first()
                            # if not user:
                            #     logger.info(f"Skipping email from {email.utils.parseaddr(msg['from'])[1]} - user not found in database")
                            #     # Mark email as read and continue
                            #     mail.store(num, '+FLAGS', '\\Seen')
                            #     continue
                            
                            # Process as reply - use the thread creation endpoint
                            ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
                            if not ticket:
                                continue
                            
                            # Get user for API authentication
                            email_user = db.query(User).filter(User.id == user.id).first()
                            if not email_user:
                                logger.error(f"Email user with ID {user.id} not found")
                                continue
                            
                            # Create access token for email user
                            access_token = create_access_token(subject=email_user.email)
                            
                            # Set up headers for API requests
                            headers = {
                                "Authorization": f"Bearer {access_token}",
                                "Content-Type": "application/json"
                            }
                            
                            # Create thread via API endpoint
                            try:
                                # Call the thread creation endpoint
                                api_url = f"{settings.API_URL}/tickets/{ticket_id}/threads"
                                logger.info(f"Calling thread creation API")
                                
                                # Use form data instead of JSON for the message parameter
                                form_data = {"message": content}
                                
                                # Make API request
                                try:
                                    response = requests.post(
                                        api_url,
                                        data=form_data,  # Use form data instead of JSON
                                        headers={
                                            "Authorization": f"Bearer {access_token}"
                                            # Don't set Content-Type for form data, requests will set it automatically
                                        }
                                    )
                                    
                                    logger.info(f"API response status: {response.status_code}")
                                    if response.status_code == 200 or response.status_code == 201:
                                        logger.info(f"Thread created for ticket #{ticket_id} via API")
                                        try:
                                            response_data = response.json()
                                            logger.info(f"API response data: {response_data}")
                                        except Exception as json_error:
                                            logger.warning(f"Could not parse API response as JSON: {str(json_error)}")
                                            logger.warning(f"Raw response content: {response.text[:500]}")
                                    else:
                                        logger.warning(f"API thread creation failed with status {response.status_code}")
                                        logger.warning(f"Response content: {response.text[:500]}")
                                        # Fallback to direct DB creation if API fails
                                        logger.warning(f"API thread creation failed, using direct DB creation")
                                        raise Exception("API thread creation failed")
                                        
                                except Exception as request_error:
                                    logger.error(f"Error making API request: {str(request_error)}", exc_info=True)
                                    # This will be caught by the outer except block which will handle the fallback
                                    raise
                            except Exception as e:
                                logger.error(f"Error creating thread: {str(e)}")
                                # Fallback to direct DB creation
                                thread = Thread(
                                    ticket_id=ticket_id,
                                    user_id=user.id,
                                    message=content
                                )
                                db.add(thread)
                                db.commit()

                            # Notify assigned agent
                            agent = db.query(User).filter(User.id == ticket.assigned_to).first()
                            if agent:
                                await self.send_thread_notification(
                                    background_tasks=background_tasks,
                                    ticket_id=ticket_id,
                                    title=ticket.title,
                                    sender_name=user.name,
                                    message=content,
                                    recipient_name=agent.name,
                                    recipient_email=agent.email,
                                    is_agent_recipient=True
                                )
                    
                    else:
                        # This is a new ticket creation email
                        logger.info("Processing as new ticket creation")
                        
                        # Get a database session
                        with SessionLocal() as db:
                            # Check if a ticket with this message ID already exists
                            existing_ticket = db.query(Ticket).filter(Ticket.email_message_id == clean_message_id).first()
                            if existing_ticket:
                                logger.warning(f"Ticket already exists for message ID {clean_message_id}, skipping creation")
                                continue
                            
                            # Get General department
                            department = db.query(Department).filter(Department.name == "General").first()
                            if not department:
                                logger.error("General department not found")
                                continue
                            
                            # Get General category
                            category = db.query(Category).filter(Category.name == "General").first()
                            if not category:
                                # Fallback to category ID 3
                                category = db.query(Category).filter(Category.id == 3).first()
                                if not category:
                                    logger.error("General category not found")
                                    continue
                            
                            # Find an agent from General department
                            dept_agent = db.query(User)\
                                .join(UserDepartment)\
                                .filter(UserDepartment.department_id == department.id)\
                                .filter(User.role_id == 2)\
                                .first()
                            
                            if not dept_agent:
                                # Fallback to any agent
                                dept_agent = db.query(User).filter(User.role_id == 2).first()
                                if not dept_agent:
                                    logger.error("No agent found")
                                    continue
                            
                            # Get the email content
                            if msg.is_multipart():
                                content = ''
                                for part in msg.walk():
                                    if part.get_content_type() == "text/plain":
                                        content = part.get_payload(decode=True).decode()
                                        break
                            else:
                                content = msg.get_payload(decode=True).decode()
                            
                            # Clean up quoted text and signatures
                            content = self._clean_reply(content)
                            
                            # Create new ticket via API endpoint
                            try:
                                # Get user for API authentication
                                email_user = db.query(User).filter(User.id == user.id).first()
                                if not email_user:
                                    logger.error(f"Email user with ID {user.id} not found")
                                    continue
                                
                                # Create access token for email user
                                access_token = create_access_token(subject=email_user.email)
                                
                                # Set up headers for API requests
                                headers = {
                                    "Authorization": f"Bearer {access_token}"
                                }
                                
                                # Prepare ticket data - Always store message ID for incoming emails
                                ticket_data = {
                                    "title": subject or "Email Ticket",
                                    "description": content,
                                    "created_by": user.id,
                                    "assigned_to": dept_agent.id,
                                    "category_id": category.id,
                                    "status_id": 1,  # New status
                                    "email_message_id": clean_message_id
                                }
                                
                                # Add program_id if available
                                if program_id:
                                    ticket_data["program_id"] = program_id
                                    logger.info(f"Adding program_id {program_id} to ticket")
                                
                                # Call the ticket creation endpoint
                                api_url = f"{settings.API_URL}/tickets/"
                                logger.info(f"Calling ticket creation API: {api_url}")
                                logger.info(f"Ticket data: {ticket_data}")
                                
                                try:
                                    # Use form data instead of JSON
                                    response = requests.post(
                                        api_url,
                                        data=ticket_data,
                                        headers=headers
                                    )
                                    
                                    logger.info(f"API response status: {response.status_code}")
                                    if response.status_code == 200 or response.status_code == 201:
                                        logger.info(f"Ticket created via API for email from {email.utils.parseaddr(msg['from'])[1]}")
                                        try:
                                            response_data = response.json()
                                            logger.info(f"API response data: {response_data}")
                                            
                                            # Generate AI auto-response for the new ticket
                                            if 'id' in response_data:
                                                ticket_id = response_data['id']
                                                logger.info(f"Triggering AI auto-response for ticket {ticket_id}")
                                                # Add a small delay to ensure the ticket is committed to the database
                                                time.sleep(1)
                                                # generate_auto_response(
                                                #     ticket_id=ticket_id,
                                                #     title=subject or "Email Ticket",
                                                #     description=content
                                                # )
                                        except Exception as json_error:
                                            logger.warning(f"Could not parse API response as JSON: {str(json_error)}")
                                            logger.warning(f"Raw response content: {response.text[:500]}")
                                    else:
                                        logger.warning(f"API ticket creation failed with status {response.status_code}")
                                        logger.warning(f"Response content: {response.text[:500]}")
                                        # Fallback to direct DB creation if API fails
                                        logger.warning(f"API ticket creation failed, using direct DB creation")
                                        raise Exception("API ticket creation failed")
                                        
                                except Exception as request_error:
                                    logger.error(f"Error making API request: {str(request_error)}", exc_info=True)
                                    # This will be caught by the outer except block which will handle the fallback
                                    raise
                            except Exception as e:
                                logger.error(f"Error creating ticket: {str(e)}")
                                # Fallback to direct DB creation
                                ticket_data = {
                                    "title": subject or "Email Ticket",
                                    "description": content,
                                    "created_by": user.id,
                                    "assigned_to": dept_agent.id,
                                    "category_id": category.id,
                                    "status_id": 1,
                                    "email_message_id": clean_message_id
                                }
                                
                                # Add program_id if available
                                if program_id:
                                    ticket_data["program_id"] = program_id
                                    
                                ticket = Ticket(**ticket_data)
                                db.add(ticket)
                                db.commit()
                                
                                # Generate AI auto-response for the new ticket
                                try:
                                    logger.info(f"Triggering AI auto-response for ticket {ticket.id}")
                                    # generate_auto_response(
                                    #     ticket_id=ticket.id,
                                    #     title=ticket.title,
                                    #     description=ticket.description
                                    # )
                                except Exception as auto_response_error:
                                    logger.error(f"Failed to generate AI auto-response: {str(auto_response_error)}", exc_info=True)
                                
                                # Notify assigned agent
                                agent = db.query(User).filter(User.id == dept_agent.id).first()
                                if agent:
                                    await self.send_ticket_creation_notification(
                                        background_tasks=background_tasks,
                                        ticket_id=ticket.id,
                                        title=ticket.title,
                                        description=ticket.description,
                                        creator_name=user.name,
                                        agent_name=agent.name,
                                        creator_email=user.email,
                                        agent_email=agent.email
                                    )
                    
                    # Mark email as read
                    mail.store(num, '+FLAGS', '\\Seen')
                    
                except Exception as e:
                    logger.error(f"Error processing email: {str(e)}", exc_info=True)
                    continue
            
        except Exception as e:
            logger.warning(f"Error in email processing for {username}: {e}")
        finally:
            if mail:
                if inbox_selected:
                    try:
                        mail.close()
                    except Exception as e:
                        logger.warning(f"Error closing IMAP mailbox for {username}: {e}")
                try:
                    if getattr(mail, 'state', None) in ('AUTH', 'SELECTED'):
                        mail.logout()
                except Exception as e:
                    logger.warning(f"Error logging out IMAP connection for {username}: {e}")


    async def notify_ticket_participants(self, db, ticket_id, message, sender_email):
        # Get ticket participants
        participants = db.query(User).join(Thread).filter(Thread.ticket_id == ticket_id).all()
        
        # Get sender's user ID
        sender = db.query(User).filter(User.email == sender_email).first()
        
        # Remove sender from participants
        participants = [p for p in participants if p.id != sender.id]
        
        # Send notification to participants
        for participant in participants:
            background_tasks = BackgroundTasks()
            await self.send_thread_notification(
                background_tasks=background_tasks,
                ticket_id=ticket_id,
                title="Ticket Reply",
                sender_name=sender.name,
                message=message,
                recipient_email=participant.email,
                is_agent_recipient=participant.role_id == 2
            )
            await background_tasks()
    
    async def send_delayed_ticket_notification(
        self,
        email: str,
        ticket_id: int,
        ticket_title: str,
        role: str,
        created_at: datetime,
        tat_hours: float,
        periods_delayed: int
    ):
        """Send notification when a ticket has exceeded its TAT"""
        try:
            subject = f"[DELAYED] Ticket #{ticket_id} - {ticket_title}"
            
            # Format the created_at time for the template
            created_at_str = created_at.strftime("%Y-%m-%d %H:%M:%S")
            
            body = email_templates.get_tat_exceeded_template(
                ticket_id=ticket_id,
                title=ticket_title,
                created_at=created_at_str,
                tat_hours=tat_hours,
                recipient_email=email
            )
            
            await self.send_email(
                subject=subject,
                recipients=[email],
                body=body
            )
            logger.info(f"Sent delayed ticket notification for ticket {ticket_id} to {email}")
        except Exception as e:
            logger.error(f"Failed to send email notification for ticket {ticket_id}: {str(e)}")
            raise

# Create a singleton instance of the email service
email_service = EmailService()
