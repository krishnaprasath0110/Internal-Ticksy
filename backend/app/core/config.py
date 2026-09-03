import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field
from typing import List

SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY")

class Settings(BaseSettings):
    DATABASE_URL: str
    API_V1_STR: str = "/api"
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: float
    BACKEND_CORS_ORIGINS: List[str] = Field(default=[])
    
    # AWS S3 Configuration
    AWS_ACCESS_KEY_ID: str
    AWS_SECRET_ACCESS_KEY: str
    AWS_REGION: str
    AWS_S3_BUCKET: str

    # Email Settings
    SMTP_TLS: bool = True
    SMTP_PORT: int = 587
    SMTP_HOST: str = "smtp.sendgrid.net"
    SMTP_USER: str = "apikey"
    SENDGRID_API_KEY: str = Field(default=SENDGRID_API_KEY, validation_alias="SENDGRID_API_KEY")
    EMAILS_FROM_EMAIL: str = "tech@futurense.com"
    EMAILS_FROM_NAME: str = "Futurense Technologies"

    # Incoming Email Settings
    IMAP_HOST: str = "imap.gmail.com"
    IMAP_PORT: int = 993
    IMAP_USER: str = SMTP_USER
    IMAP_PASSWORD: str = Field(default=SENDGRID_API_KEY, validation_alias="IMAP_PASSWORD")
    
    # FAQ Excel Path
    FAQ_EXCEL_PATH: str = os.path.abspath(os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),  # Go up to backend/app
        "utils",
        "Common Queries Data BSc.xlsx"
    ))
    SYSTEM_USER_ID: int = 1

    # Moodle SSO Settings
    MOODLE_SECRET_KEY: str
    MOODLE_ISSUER: str
    FRONTEND_URL: str
    
    # API URL for internal service calls
    API_URL: str

    # Gemini API settings
    GEMINI_API_KEY: str = Field(..., env='GEMINI_API_KEY')

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), ".env"),
        case_sensitive=True
    )

settings = Settings()
