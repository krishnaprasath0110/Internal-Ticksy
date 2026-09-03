# Ticksy By Futurense — Application Documentation

**Ticksy** is Futurense’s internal helpdesk platform. Candidates (and other users) create support tickets; agents, supervisors, managers, and admins triage, respond, and resolve them. Dashboards surface open workload, first-response (FRT) health, closure SLA, priority, and agent performance.

| Layer | Stack | Hosting |
|-------|--------|---------|
| **Frontend** | React 18 (CRA), MUI, Tailwind, Axios | **Firebase Hosting** (`helpdesk-edfa3` → e.g. `ticksy.futurense.com`) |
| **Backend** | FastAPI, SQLAlchemy, PostgreSQL, APScheduler | **AWS** (API + RDS PostgreSQL + S3 for attachments) |
| **Auth** | JWT Bearer tokens; optional Moodle SSO | — |

```
┌─────────────────────┐         HTTPS / JWT          ┌──────────────────────────┐
│  React SPA          │ ───────────────────────────► │  FastAPI (AWS)            │
│  Firebase Hosting   │                              │  /api/*                   │
└─────────────────────┘                              └────────────┬─────────────┘
                                                                  │
                                          ┌───────────────────────┼───────────────────────┐
                                          ▼                       ▼                       ▼
                                   PostgreSQL (RDS)         AWS S3 (files)        IMAP/SMTP / Gemini
```

---

## Table of contents

1. [Features](#1-features)
2. [Architecture](#2-architecture)
3. [Repository layout](#3-repository-layout)
4. [Roles & access](#4-roles--access)
5. [How key metrics work](#5-how-key-metrics-work)
6. [Prerequisites](#6-prerequisites)
7. [Environment configuration](#7-environment-configuration)
8. [Run the full application locally](#8-run-the-full-application-locally)
9. [Backend details](#9-backend-details)
10. [Frontend details](#10-frontend-details)
11. [Production deployment](#11-production-deployment)
12. [Background jobs](#12-background-jobs)
13. [API overview](#13-api-overview)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Features

### Ticketing

- Create, list, filter, and view tickets (paginated)
- Statuses: open, in-progress, closed, not-applicable
- Threaded conversation on each ticket
- Attachments via **AWS S3**
- Priority: `low` / `medium` / `high` (auto-updated; see [§5](#5-how-key-metrics-work))
- Delayed-ticket flag when TAT is exceeded
- Issue type + disposition (internal users)
- Filters: status, priority, agent, delayed, category, program/batch/university, date range, FRT/SLA drill-downs from the dashboard

### Email channel

- Inbound IMAP polling creates/updates tickets from email
- Outbound notifications (ticket created, replies, delayed TAT, etc.)

### Organization & users

- Departments → Categories (with TAT)
- Universities → Programs → Batches
- Roles: admin, department-manager, department-supervisor, agent, candidate
- Agent assignment by category (and batch where applicable)
- Candidate / agent management (admin)
- Bulk candidate import

### Dashboard (managers / supervisors / admin)

- Top counts: Total Active, Open, In Progress, Closed, Delayed (open / in-progress breakdown)
- Program & batch filters
- **Open Ticket Analysis** — FRT buckets (Low / Medium / High / Breached) with click-through to tickets
- **SLA Health** — closure age buckets for 72h (default) and 120h (Academic Affairs)
- **Agent-wise active tickets** and **priority metrics** (active tickets only)
- FRT analysis and agent performance panels

### Auth & profile

- Login / logout, forgot & reset password
- Moodle SSO callback support
- User profile page

---

## 2. Architecture

| Component | Responsibility |
|-----------|----------------|
| **Frontend** | SPA UI, role-based navigation, calls REST API with JWT |
| **Backend** | Business logic, auth, tickets, dashboard aggregates, email, schedulers |
| **PostgreSQL** | Persistent data (users, tickets, threads, org structure) |
| **AWS S3** | Ticket attachment storage |
| **Firebase Hosting** | Serves the built React `build/` folder (SPA rewrite to `index.html`) |
| **AWS (API)** | Runs the FastAPI service (e.g. behind `helpdesk-backend.futurense.com`) |
| **AWS RDS** | Managed PostgreSQL in production |
| **Gemini / Chroma** | Optional AI / FAQ / auto-response helpers on the backend |

---

## 3. Repository layout

```
helpdesk/
├── backend/                 # FastAPI application
│   ├── app/
│   │   ├── api/endpoints/   # REST routers (auth, tickets, dashboard, …)
│   │   ├── core/            # Settings, security, auth deps
│   │   ├── db/              # Models, session, migrations helpers
│   │   ├── repositories/    # DB / query layer
│   │   ├── schemas/         # Pydantic request/response models
│   │   ├── services/        # Email, S3, AI helpers
│   │   └── main.py          # App entry + schedulers
│   ├── requirements.txt
│   └── .env                 # Local secrets (not committed)
├── frontend/                # React SPA
│   ├── src/
│   │   ├── pages/           # Route screens
│   │   ├── components/      # UI building blocks
│   │   ├── services/        # API clients
│   │   ├── context/         # Auth, theme
│   │   └── config.js        # API_URL, APP_NAME
│   ├── firebase.json        # Hosting config
│   ├── .firebaserc          # Project: helpdesk-edfa3
│   └── README.md            # Frontend-focused notes
└── README.md                # This document (full system)
```

---

## 4. Roles & access

| Role | Tickets | Dashboard | Admin / org setup |
|------|---------|-----------|-------------------|
| **candidate** | Own tickets only; lands on `/tickets` | Limited | No |
| **agent** | Category/batch-visible + assigned | Own performance | No |
| **department-supervisor** | Department-scoped | Metrics + filters | Limited |
| **department-manager** | Department-scoped | Full ops metrics | Limited |
| **admin** | All tickets | Full | Users, departments, categories, universities, programs, batches |

---

## 5. How key metrics work

### First Response Time (FRT)

Time from ticket creation to **first agent reply** (or ticket age if no agent has replied yet).

| Bucket (Open Ticket Analysis) | Hours without first response |
|-------------------------------|------------------------------|
| Low | &lt; 12 |
| Medium | 12–20 |
| High | 20–24 |
| Breached | &gt; 24 |

### Closure / resolution SLA (SLA Health)

Age = hours since **ticket creation** (active tickets only).

| Scheme | Who | Low | Medium | High (approaching) | Breached |
|--------|-----|-----|--------|--------------------|----------|
| **72h** | All categories except Academic Affairs | &lt;36h | 36–60h | 60–72h | &gt;72h |
| **120h** | Academic Affairs department | &lt;60h | 60–96h | 96–120h | &gt;120h |

### Automatic priority

Hourly job updates `ticket.priority` using **both** FRT and closure SLA, then takes the **worse** of the two (`high` &gt; `medium` &gt; `low`).

- **FRT side:** &lt;12 → low · 12–20 → medium · ≥20 → high  
- **SLA side:** maps Low/Medium/High+Breached buckets to low / medium / high (72h or 120h scheme by department)

So a ticket can be SLA-breached and still show High priority even if FRT was fast.

---

## 6. Prerequisites

- **Git**, **Node.js 18+** / npm  
- **Python 3.11+** (3.12 works)  
- **PostgreSQL** 14+ (local) or access to AWS RDS  
- Backend: create a venv and install `backend/requirements.txt`  
- Frontend: `npm install` in `frontend/`  
- Deploy: **Firebase CLI** (frontend), AWS access for backend/RDS/S3  

---

## 7. Environment configuration

### Backend — `backend/.env`

Create `backend/.env` (do **not** commit real secrets). Example shape:

```env
# Database
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DATABASE

# Auth
SECRET_KEY=change-me
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# CORS (include local + Firebase + custom domain)
BACKEND_CORS_ORIGINS=["http://localhost:3000","https://helpdesk-edfa3.web.app","https://ticksy.futurense.com"]

# Public API URL (used by some internal calls)
API_URL=http://localhost:8000/api
# API_URL=https://helpdesk-backend.futurense.com/api

FRONTEND_URL=http://localhost:3000
# FRONTEND_URL=https://ticksy.futurense.com

# AWS S3 (attachments)
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=ap-south-1
AWS_S3_BUCKET=fut-helpdesk

# Optional / integrations
GEMINI_API_KEY=...
MOODLE_SECRET_KEY=...
MOODLE_ISSUER=moodle
```

SMTP/IMAP defaults live in `backend/app/core/config.py` and can be overridden via environment if you extend settings.

### Frontend — `frontend/src/config.js`

```js
// Local
export const API_URL = 'http://localhost:8000/api';

// Production
// export const API_URL = 'https://helpdesk-backend.futurense.com/api';

export const APP_NAME = 'Ticksy By Futurense';
```

Keep **one** active `API_URL` for the environment you are building.

---

## 8. Run the full application locally

### Step A — Database

1. Install PostgreSQL and create a database (e.g. `fut_helpdesk`).
2. Set `DATABASE_URL` in `backend/.env` to that database.
3. Ensure schema/tables exist (project uses SQLAlchemy models; apply any SQL/migrations under `backend/app/db/migrations/` if your environment is empty).

### Step B — Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- API root: [http://localhost:8000](http://localhost:8000)  
- Interactive docs: [http://localhost:8000/docs](http://localhost:8000/docs)  
- Routes are under `/api/...`

Schedulers (email poll, delayed tickets, FRT/SLA priority) start with the app lifespan.

### Step C — Frontend

```bash
cd frontend
npm install

# Ensure src/config.js points to http://localhost:8000/api
npm start
```

- UI: [http://localhost:3000](http://localhost:3000)

### Step D — Smoke test

1. Open the UI and log in with a known user.  
2. Confirm tickets load (candidate: own tickets; admin: all).  
3. Open `/docs` and call a simple authenticated endpoint if needed.  
4. Check browser Network tab: requests go to `localhost:8000/api` with `Authorization: Bearer …`.

---

## 9. Backend details

### Stack

- **FastAPI** + **Uvicorn**  
- **SQLAlchemy** + **psycopg2** → PostgreSQL  
- **APScheduler** → background jobs  
- **boto3** → S3  
- **python-jose / passlib** → JWT & passwords  
- Optional: Gemini, ChromaDB for AI/FAQ helpers  

### Main modules

| Path | Role |
|------|------|
| `app/main.py` | App factory, CORS, schedulers |
| `app/api/endpoints/*` | HTTP routes |
| `app/repositories/*` | Queries & business data access |
| `app/services/email_service.py` | IMAP/SMTP, ticket-from-email |
| `app/services/s3_service.py` | Attachments |
| `app/core/config.py` | Settings from `.env` |

### Running in production (AWS)

Typical pattern:

1. Deploy API process (EC2 / ECS / Elastic Beanstalk / similar) with `uvicorn` or a process manager.  
2. Point `DATABASE_URL` at **RDS**.  
3. Configure S3 bucket + IAM keys/region.  
4. Set `BACKEND_CORS_ORIGINS` to Firebase / custom frontend domains.  
5. Set `API_URL` / `FRONTEND_URL` to production HTTPS URLs.  
6. Put TLS termination (ALB / CloudFront / nginx) in front of the API.

Exact instance/ASG setup is environment-specific; use your team’s AWS runbook for the current `helpdesk-backend.futurense.com` host.

---

## 10. Frontend details

See also [`frontend/README.md`](frontend/README.md).

### Stack

- React 18, React Router 6, MUI, Tailwind, Axios, Recharts  

### Key paths

| Path | Purpose |
|------|---------|
| `/login` | Authentication |
| `/dashboard` | Metrics (non-candidate default) |
| `/tickets`, `/tickets/new`, `/tickets/:id` | Ticket workflows |
| `/candidates`, `/agents` | Admin user management |
| `/departments`, `/categories`, `/universities`, `/programs`, `/batches` | Org structure |

### Local commands

```bash
npm start          # development
npm run build      # production bundle → build/
npm test           # tests
```

---

## 11. Production deployment

### Frontend → Firebase Hosting

Project id (`.firebaserc`): **`helpdesk-edfa3`**.

`firebase.json` serves `build/` and rewrites all routes to `index.html` (SPA).

```bash
cd frontend

# 1. Set production API_URL in src/config.js
# 2. Build
npm run build

# 3. Deploy
firebase login
firebase use helpdesk-edfa3
firebase deploy --only hosting
```

Custom domain (e.g. `ticksy.futurense.com`) is configured in the Firebase console / DNS.

### Backend → AWS

1. Build/deploy the FastAPI app to your AWS compute target.  
2. Use RDS `DATABASE_URL` and production secrets (prefer Secrets Manager / env on the host — never commit `.env`).  
3. Confirm S3 bucket `AWS_S3_BUCKET` and region.  
4. Verify CORS includes the Firebase and custom frontend origins.  
5. Health-check: `GET https://<api-host>/` and OpenAPI at `/docs` if exposed.

### End-to-end production checklist

- [ ] Frontend `API_URL` = production API  
- [ ] Backend `FRONTEND_URL` = production UI  
- [ ] CORS origins match live frontend URLs  
- [ ] RDS reachable from API host  
- [ ] S3 upload/download works for attachments  
- [ ] Schedulers running (email, delayed, priority)  
- [ ] HTTPS on both UI and API  

---

## 12. Background jobs

Configured in `backend/app/main.py`:

| Job | Interval (default) | Purpose |
|-----|--------------------|---------|
| Email processing | Every **2** minutes | Poll IMAP; create/update tickets from mail |
| Delayed ticket check | Every **1** hour | Mark tickets past TAT; notify |
| FRT / SLA priority update | Every **1** hour | Recalculate `priority` from FRT + closure SLA |

Email window looks back a short period (`EMAIL_CHECK_WINDOW_MINUTES`, default 5).

---

## 13. API overview

Base path: **`/api`**. Interactive docs: `/docs`.

| Prefix | Domain |
|--------|--------|
| `/api/auth` | Login, tokens, password reset, SSO-related |
| `/api/users` | Users, agents, candidates |
| `/api/tickets` | CRUD-ish ticket ops, paginated list, FRT metrics, attachments |
| `/api/dashboard` | Counts, FRT/ageing, priority, SLA health, agent breakdowns |
| `/api/departments`, `/categories` | Org taxonomy |
| `/api/universities`, `/programs`, `/batches` | Academic structure |
| `/api/statuses`, `/roles` | Reference data |
| `/api/issue-types` | Issue types & dispositions |

All authenticated routes expect:

```http
Authorization: Bearer <access_token>
```

---

## 14. Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Frontend loads but empty tickets / network errors | Wrong `API_URL`; backend down; CORS |
| CORS errors in browser | Add frontend origin to `BACKEND_CORS_ORIGINS` and restart API |
| 401 → kicked to login | Expired JWT; clock skew; bad `SECRET_KEY` across restarts |
| Candidate sees no tickets | Must hit paginated list as creator; ensure backend running latest ticket endpoints |
| Attachments fail | S3 credentials, bucket, region, or CORS on bucket |
| Priority not updating | Scheduler not running; check API process logs hourly |
| Firebase deep link 404 | Hosting rewrite to `index.html` missing / not deployed |
| Email tickets not created | IMAP credentials / `EMAIL_PROCESSING`; check warning logs |

---

## Related documents

| File | Topic |
|------|--------|
| [`frontend/README.md`](frontend/README.md) | Frontend-only run & Firebase notes |
| `FRT_PRIORITY_SETUP.md` | Historical FRT priority setup notes |
| `PRIORITY_FEATURE_IMPLEMENTATION.md` | Priority feature overview |
| `PERFORMANCE_OPTIMIZATION_RECOMMENDATIONS.md` | DB / query performance |
| `DATABASE_INDEXES.sql` / `APPLY_INDEXES_GUIDE.md` | Index recommendations |

---

## Support & ownership

Internal Futurense product. For production access (AWS, Firebase, RDS, S3), contact the platform owners. Do not commit secrets (`.env`, API keys, AWS keys) to Git.
