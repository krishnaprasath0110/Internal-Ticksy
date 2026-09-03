"""Email templates for various notifications."""
from app.core.security import create_email_login_token
from app.core.config import settings
from urllib.parse import urljoin

# Base HTML template with Bootstrap CSS
BASE_HTML_TEMPLATE = """
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        /* Bootstrap-like styles */
        .container {{
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            line-height: 1.5;
            color: #333;
        }}
        .card {{
            border: 1px solid #dee2e6;
            border-radius: 8px;
            margin-bottom: 20px;
            background-color: #fff;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .card-header {{
            background-color: #f8f9fa;
            padding: 15px 20px;
            border-bottom: 1px solid #dee2e6;
            border-radius: 8px 8px 0 0;
        }}
        .card-body {{
            padding: 20px;
        }}
        .ticket-number {{
            color: #6c757d;
            font-size: 14px;
            margin-bottom: 5px;
        }}
        .ticket-title {{
            color: #212529;
            font-size: 18px;
            font-weight: 600;
            margin: 0;
        }}
        .message-box {{
            background-color: #f8f9fa;
            border-left: 4px solid #007bff;
            padding: 15px;
            margin-top: 15px;
            border-radius: 4px;
        }}
        .sender-name {{
            color: #007bff;
            font-weight: 600;
            margin-bottom: 10px;
        }}
        .footer {{
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #dee2e6;
            color: #6c757d;
            font-size: 14px;
        }}
        .btn {{
            display: inline-block;
            font-weight: 400;
            text-align: center;
            white-space: nowrap;
            vertical-align: middle;
            user-select: none;
            border: 1px solid transparent;
            padding: 0.75rem 1.5rem;
            font-size: 1rem;
            line-height: 1.5;
            border-radius: 0.25rem;
            text-decoration: none;
            margin-top: 15px;
            margin-bottom: 15px;
        }}
        .btn-primary {{
            color: #fff;
            background-color: #007bff;
            border-color: #007bff;
        }}
        .btn-primary:hover {{
            background-color: #0069d9;
            border-color: #0062cc;
        }}
        .text-center {{
            text-align: center;
        }}
    </style>
</head>
<body>
    <div class="container">
        {content}
    </div>
</body>
</html>
"""

def generate_view_ticket_button(email: str, ticket_id: int) -> str:
    """
    Generate HTML for a 'View Ticket' button with auto-login link
    
    Args:
        email: User's email address
        ticket_id: Ticket ID to view
        
    Returns:
        HTML string with button
    """
    # Create auto-login token
    token = create_email_login_token(email=email, ticket_id=ticket_id)
    
    # Generate the auto-login URL
    # Remove any trailing slashes from API_URL and ensure we don't have double slashes
    base_url = settings.API_URL.rstrip('/')
    auto_login_url = f"{base_url}/auth/email-login?token={token}"
    
    # Return button HTML
    return f"""
    <div class="text-center">
        <a href="{auto_login_url}" class="btn btn-primary" style="color: #fff;">View Ticket</a>
    </div>
    """

def get_ticket_creation_candidate_template(ticket_id: int, title: str, description: str, creator_name: str, creator_email: str) -> str:
    content = f"""
        <div class="card">
            <div class="card-header">
                <div class="ticket-number">Ticket #{ticket_id}</div>
                <h2 class="ticket-title">{title}</h2>
            </div>
            <div class="card-body">
                <p>Dear {creator_name},</p>
                <p>Your support request has been successfully received.</p>
                
                <div class="message-box">
                    <div class="sender-name">Your Request</div>
                    <div class="message-content">{description}</div>
                </div>
                
                <div class="footer">
                    {generate_view_ticket_button(creator_email, ticket_id)}
                    <p>Our support team will review and respond shortly.</p>
                    <p>Best regards,<br>Team Futurense</p>
                </div>
            </div>
        </div>
    """
    return BASE_HTML_TEMPLATE.format(content=content)

def get_ticket_creation_agent_template(ticket_id: int, title: str, description: str, creator_name: str, agent_name: str, agent_email: str) -> str:
    content = f"""
        <div class="card">
            <div class="card-header">
                <div class="ticket-number">Ticket #{ticket_id}</div>
                <h2 class="ticket-title">{title}</h2>
            </div>
            <div class="card-body">
                <p>Dear {agent_name},</p>
                <p>A new support ticket has been assigned to you.</p>
                
                <div class="message-box">
                    <div class="sender-name">{creator_name}</div>
                    <div class="message-content">{description}</div>
                </div>
                
                <div class="footer">
                    {generate_view_ticket_button(agent_email, ticket_id)}
                    <p>Please review and take necessary action.</p>
                    <p>Best regards,<br>Team Futurense</p>
                </div>
            </div>
        </div>
    """
    return BASE_HTML_TEMPLATE.format(content=content)

def get_thread_reply_candidate_template(ticket_id: int, title: str, sender_name: str, recipient_name: str, recipient_email: str, message: str) -> str:
    content = f"""
        <div class="card">
            <div class="card-header">
                <div class="ticket-number">Ticket #{ticket_id}</div>
                <h2 class="ticket-title">{title}</h2>
            </div>
            <div class="card-body">
                <p>Dear {recipient_name},</p>
                <p>Our team has responded to your support request.</p>
                
                <div class="message-box">
                    <div class="sender-name">{sender_name}</div>
                    <div class="message-content">{message}</div>
                </div>
                
                <div class="footer">
                    {generate_view_ticket_button(recipient_email, ticket_id)}
                    <p>If you have any further questions or require any clarification, please feel free to respond to this ticket by clicking the View Ticket button.</p>
                    <p>Best regards,<br>Team Futurense</p>
                </div>
            </div>
        </div>
    """
    return BASE_HTML_TEMPLATE.format(content=content)

def get_thread_reply_agent_template(ticket_id: int, title: str, sender_name: str, recipient_name: str, recipient_email: str, message: str) -> str:
    content = f"""
        <div class="card">
            <div class="card-header">
                <div class="ticket-number">Ticket #{ticket_id}</div>
                <h2 class="ticket-title">{title}</h2>
            </div>
            <div class="card-body">
                <p>Dear {recipient_name},</p>
                
                <div class="message-box">
                    <div class="sender-name">{sender_name}</div>
                    <div class="message-content">{message}</div>
                </div>
                
                <div class="footer">
                    {generate_view_ticket_button(recipient_email, ticket_id)}
                    <p>Please review and take necessary action.</p>
                    <p>Best regards,<br>Team Futurense</p>
                </div>
            </div>
        </div>
    """
    return BASE_HTML_TEMPLATE.format(content=content)

def get_reassign_template(ticket_id: int, title: str, recipient_email: str) -> str:
    content = f"""
        <div class="card">
            <div class="card-header">
                <div class="ticket-number">Ticket #{ticket_id}</div>
                <h2 class="ticket-title">{title}</h2>
            </div>
            <div class="card-body">
                <p>Dear Agent,</p>
                <p>Ticket #{ticket_id} - "{title}", has been reassigned to you.</p>
                
                <div class="footer">
                    {generate_view_ticket_button(recipient_email, ticket_id)}
                    <p>Best regards,<br>Team Futurense</p>
                </div>
            </div>
        </div>
    """
    return BASE_HTML_TEMPLATE.format(content=content)

def get_tat_exceeded_template(ticket_id: int, title: str, created_at: str, tat_hours: int, recipient_email: str) -> str:
    content = f"""
        <div class="card">
            <div class="card-header">
                <div class="ticket-number">Ticket #{ticket_id}</div>
                <h2 class="ticket-title">{title}</h2>
            </div>
            <div class="card-body">
                <p>Dear Agent,</p>
                <p>This is to inform you that the Turn Around Time (TAT) for the following ticket has been exceeded:</p>
                
                <p><strong>Ticket:</strong> #{ticket_id} - {title}<br>
                <strong>Created At:</strong> {created_at}<br>
                <strong>TAT:</strong> {tat_hours} hours</p>
                
                <div class="footer">
                    {generate_view_ticket_button(recipient_email, ticket_id)}
                    <p>Please prioritize this ticket and take necessary action immediately.</p>
                </div>
                
                <div class="footer">
                    <p>Best regards,<br>Team Futurense</p>
                </div>
            </div>
        </div>
    """
    return BASE_HTML_TEMPLATE.format(content=content)

def get_ticket_closed_agent_template(ticket_id: int, title: str, closing_reason: str, agent_name: str, agent_email: str) -> str:
    content = f"""
        <div class="card">
            <div class="card-header">
                <div class="ticket-number">Ticket #{ticket_id}</div>
                <h2 class="ticket-title">{title}</h2>
            </div>
            <div class="card-body">
                <p>Dear {agent_name},</p>
                <p>The ticket #{ticket_id} - "{title}" has been closed.</p>
                
                <div class="message-box">
                    <div class="sender-name">Closing Reason</div>
                    <div class="message-content">{closing_reason}</div>
                </div>
                
                <div class="footer">
                    {generate_view_ticket_button(agent_email, ticket_id)}
                    <p>Thank you for your support.</p>
                    <p>Best regards,<br>Team Futurense</p>
                </div>
            </div>
        </div>
    """
    return BASE_HTML_TEMPLATE.format(content=content)

def get_ticket_closed_requester_template(ticket_id: int, title: str, closing_reason: str, requester_name: str, requester_email: str) -> str:
    content = f"""
        <div class="card">
            <div class="card-header">
                <div class="ticket-number">Ticket #{ticket_id}</div>
                <h2 class="ticket-title">{title}</h2>
            </div>
            <div class="card-body">
                <p>Dear {requester_name},</p>
                <p>Your ticket #{ticket_id} - "{title}" has been closed.</p>
                
                <div class="message-box">
                    <div class="sender-name">Closing Reason</div>
                    <div class="message-content">{closing_reason}</div>
                </div>
                
                <div class="footer">
                    {generate_view_ticket_button(requester_email, ticket_id)}
                    <p>If you need further assistance, please feel free to create a new ticket.</p>
                    <p>Best regards,<br>Team Futurense</p>
                </div>
            </div>
        </div>
    """
    return BASE_HTML_TEMPLATE.format(content=content)

def get_password_reset_template(user_name: str, reset_url: str) -> str:
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2196f3;">Password Reset Request</h2>
        <p>Hello {user_name},</p>
        <p>We received a request to reset your password. If you didn't make this request, you can safely ignore this email.</p>
        <p>To reset your password, click the button below. This link will expire in 1 hour.</p>
        <div style="text-align: center; margin: 30px 0;">
            <a href="{reset_url}" 
               style="background-color: #2196f3; 
                      color: white; 
                      padding: 12px 24px; 
                      text-decoration: none; 
                      border-radius: 4px;
                      display: inline-block;">
                Reset Password
            </a>
        </div>
        <p style="color: #666; font-size: 0.9em;">
            If the button doesn't work, you can copy and paste this link into your browser:<br>
            <span style="color: #2196f3;">{reset_url}</span>
        </p>
        <p style="color: #666; font-size: 0.9em; margin-top: 30px;">
            This is an automated message, please do not reply to this email.
        </p>
    </div>
    """

def get_new_user_credentials_template(user_name: str, email: str, password: str, website_url: str, reset_url: str) -> str:
    return f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h1 style="color: #2196f3; margin: 0 0 10px 0; font-size: 24px;">Welcome to Ticksy</h1>
            <p style="color: #666; margin: 0;">Your account has been created successfully</p>
        </div>

        <p style="color: #444; font-size: 16px;">Hello {user_name},</p>
        
        <p style="color: #444; line-height: 1.5;">Your Ticksy account has been created. Here are your login credentials:</p>
        
        <div style="background-color: #f8f9fa; border-left: 4px solid #2196f3; padding: 15px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Website URL:</strong> <a href="https://ticksy.futurense.com" style="color: #2196f3; text-decoration: none;">https://ticksy.futurense.com</a></p>
            <p style="margin: 5px 0;"><strong>Email:</strong> {email}</p>
            <p style="margin: 5px 0;"><strong>Password:</strong> {password}</p>
        </div>
        
        <p style="color: #444; line-height: 1.5;">
            To change your password, please click the button below:
        </p>
        
        <div style="margin: 30px 0; text-align: center;">
            <a href="{reset_url}" 
               style="display: inline-block; background-color: #2196f3; color: white; 
                      text-decoration: none; padding: 12px 24px; border-radius: 4px; 
                      font-weight: bold;">
                Reset Your Password
            </a>
        </div>
        
        <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
            <p style="color: #856404; margin: 0;">
                If you're unable to use the button, you can change your password by clicking the "Forgot Password" link on the login page. Simply enter your email, and you will receive a password reset link.
            </p>
        </div>
        
        <p style="color: #666; font-size: 0.9em; margin-top: 30px;">
            If the button doesn't work, you can copy and paste this link into your browser:<br>
            <span style="color: #2196f3;">{reset_url}</span>
        </p>
        
        <p style="color: #666; font-size: 0.9em; margin-top: 30px;">
            This is an automated message, please do not reply to this email.
        </p>
    </div>
    """
