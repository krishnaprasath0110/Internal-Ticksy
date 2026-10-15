# Ticksy — Backend

FastAPI backend for **Ticksy By Futurense**.

For **full system documentation** (features, architecture, AWS + Firebase hosting, how to run frontend and backend together), see the root guide:

→ **[../README.md](../README.md)**

## Quick start

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Configure backend/.env (DATABASE_URL, SECRET_KEY, CORS, AWS S3, …)
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- Docs: http://localhost:8000/docs  
- API prefix: `/api`

## Production

Hosted on **AWS** (API + RDS PostgreSQL + S3 for attachments). Set production env vars on the host; never commit `.env`.

## Internal teams

Before starting a version that uses employee teams, apply the schema migration once:

```bash
python -m app.db.migrations.add_internal_teams
```

This creates the `teams` table and adds the `users.team_id` association. Assign employees to a team when creating their accounts; each employee has an individual email/password login and can submit internal support tickets. Agents remain a separate role for ticket assignment.

## Outgoing email

Outgoing email uses SendGrid SMTP. Configure `SMTP_HOST=smtp.sendgrid.net`, `SMTP_PORT=587`, `SMTP_TLS=true`, `SMTP_USER=apikey`, `SENDGRID_API_KEY` with a valid SendGrid API key, and `EMAILS_FROM_EMAIL` with a sender verified in SendGrid. Keep the API key private and restart the backend after changing its environment.

Email connection failures are logged with the underlying exception. If delivery still fails, check that the backend host can reach `smtp.sendgrid.net:587`, STARTTLS is allowed by the network, the API key has mail-send permission, and the sender address is verified.

## Structure

| Path | Purpose |
|------|---------|
| `app/main.py` | App entry, CORS, background schedulers |
| `app/api/endpoints/` | REST routers |
| `app/repositories/` | Database / domain queries |
| `app/services/` | Email, S3, AI helpers |
| `app/core/config.py` | Settings from `.env` |
| `requirements.txt` | Python dependencies |
