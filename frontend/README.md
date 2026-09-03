# Ticksy By Futurense — Frontend

React SPA for the Ticksy helpdesk. Talks to the FastAPI backend via JWT and is deployed on **Firebase Hosting**.

> **Full system docs** (features, architecture, AWS backend + Firebase frontend, how to run everything):  
> **[../README.md](../README.md)**

---

## Tech stack

React 18 (CRA) · React Router 6 · MUI · Tailwind · Axios · Recharts · Firebase Hosting (`helpdesk-edfa3`)

---

## Local run

```bash
cd frontend
npm install
```

Point the API in [`src/config.js`](src/config.js):

```js
export const API_URL = 'http://localhost:8000/api';
export const APP_NAME = 'Ticksy By Futurense';
```

Start the backend first (see [../README.md](../README.md) §8), then:

```bash
npm start
```

App: [http://localhost:3000](http://localhost:3000)

| Script | Description |
|--------|-------------|
| `npm start` | Dev server |
| `npm run build` | Production build → `build/` |
| `npm test` | Tests |

---

## Firebase deploy

```bash
# Set production API_URL in src/config.js first
npm run build
firebase use helpdesk-edfa3
firebase deploy --only hosting
```

`firebase.json` serves `build/` and rewrites all paths to `index.html` for SPA routing.

---

## Project layout

```
src/
├── App.js              # Routes & auth guards
├── config.js           # API_URL, APP_NAME
├── context/            # Auth, theme
├── pages/              # Screens (dashboard, tickets, admin, …)
├── components/         # UI (metrics, forms, layout)
├── services/           # REST clients
└── utils/roles.js      # Role constants
```

---

## Main routes

| Path | Purpose |
|------|---------|
| `/login` | Sign in |
| `/dashboard` | Metrics (admin / manager / supervisor / agent) |
| `/tickets` | Ticket list |
| `/tickets/new`, `/tickets/:id` | Create / view ticket |
| `/candidates`, `/agents` | Admin user management |
| `/departments`, `/categories`, `/universities`, `/programs`, `/batches` | Org structure |

Candidates land on `/tickets`; other roles on `/dashboard`.
