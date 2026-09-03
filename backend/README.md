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

## Structure

| Path | Purpose |
|------|---------|
| `app/main.py` | App entry, CORS, background schedulers |
| `app/api/endpoints/` | REST routers |
| `app/repositories/` | Database / domain queries |
| `app/services/` | Email, S3, AI helpers |
| `app/core/config.py` | Settings from `.env` |
| `requirements.txt` | Python dependencies |
