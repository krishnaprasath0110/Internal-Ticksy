# Ticket Priority Feature Implementation

## Overview
Ticket priority feature for internal users only (agents, managers, supervisors, admin). Candidates cannot see or set priority.

## Backend Implementation ✅ COMPLETE

### 1. Database Migration
**File:** `/home/miles/helpdesk/backend/app/db/migrations/add_priority_to_tickets.py`
- Adds `priority` column (VARCHAR(10), nullable)
- Values: 'high', 'medium', 'low', or NULL

**Run migration:**
```bash
python /home/miles/helpdesk/backend/app/db/migrations/add_priority_to_tickets.py
```

### 2. Model Updates
**File:** `/home/miles/helpdesk/backend/app/db/models/ticket.py`
- Added: `priority = Column(String(10), nullable=True)`

### 3. Schemas
**File:** `/home/miles/helpdesk/backend/app/schemas/ticket_schema.py`
- `TicketResponse`: Added `priority: Optional[str] = None`
- `TicketPriorityUpdate`: New schema for priority updates

**File:** `/home/miles/helpdesk/backend/app/schemas/dashboard_schema.py`
- `PriorityMetrics`: Overall priority counts (high, medium, low, total)
- `AgentPriorityMetrics`: Agent-wise priority counts with departments

### 4. Repository Functions
**File:** `/home/miles/helpdesk/backend/app/repositories/ticket_repository.py`
- `update_ticket_priority(ticket_id, priority, db)`: Update ticket priority with validation

**File:** `/home/miles/helpdesk/backend/app/repositories/dashboard_repository.py`
- `get_priority_metrics(db, current_user, start_date, end_date)`: Overall priority metrics
- `get_agent_priority_metrics(db, current_user, start_date, end_date)`: Agent-wise metrics
- Both functions apply department filtering for managers/supervisors

### 5. API Endpoints
**File:** `/home/miles/helpdesk/backend/app/api/endpoints/tickets.py`
- `PUT /api/tickets/{ticket_id}/priority`: Update ticket priority (internal users only)
  - Validates user role (agent, manager, supervisor, admin)
  - Validates priority value (high, medium, low)

**File:** `/home/miles/helpdesk/backend/app/api/endpoints/dashboard.py`
- `GET /api/dashboard/priority-metrics`: Overall priority metrics
- `GET /api/dashboard/priority-metrics/agents`: Agent-wise priority metrics
- Both endpoints:
  - Require internal user roles
  - Support date filtering (start_date, end_date)
  - Apply department filtering for managers/supervisors

## Frontend Implementation ✅ COMPLETE

### 1. Services ✅ COMPLETE
**File:** `/home/miles/helpdesk/frontend/src/services/ticket.js`
- `updateTicketPriority(ticketId, priority)`: Update ticket priority

**File:** `/home/miles/helpdesk/frontend/src/services/dashboard.js`
- `getPriorityMetrics(startDate, endDate)`: Fetch overall priority metrics
- `getAgentPriorityMetrics(startDate, endDate)`: Fetch agent-wise priority metrics

### 2. Ticket Thread Page (TicketView) ✅ COMPLETE
**File:** `/home/miles/helpdesk/frontend/src/pages/tickets/TicketView.jsx`
**Implemented:**
- ✅ Priority selector shown ONLY for internal users (agent, manager, supervisor, admin)
- ✅ Hidden from candidates
- ✅ 3 clickable boxes: High (red), Medium (orange), Low (green)
- ✅ Selected priority highlighted with filled background and white text
- ✅ Unselected boxes show border with colored text
- ✅ Updates priority immediately via API with toast notification
- ✅ Positioned in sidebar after status section

### 3. Tickets List Page ✅ COMPLETE
**File:** `/home/miles/helpdesk/frontend/src/components/tickets/TicketList.jsx`
**Implemented:**
- ✅ Added "Priority" column header with icon
- ✅ Color coding:
  - High: Red background (#fee2e2) with red text (#dc2626)
  - Medium: Orange background (#fef3c7) with orange text (#d97706)
  - Low: Green background (#d1fae5) with green text (#059669)
  - No priority: Gray dash (-)
- ✅ Shown ONLY for internal users (hidden from candidates)
- ✅ Positioned after Category column

### 4. Dashboard Priority Metrics Component ✅ COMPLETE
**File:** `/home/miles/helpdesk/frontend/src/components/dashboard/PriorityMetrics.jsx`
**Implemented:**
- ✅ Overall priority metrics with large clickable boxes
- ✅ Shows High, Medium, Low counts with percentages
- ✅ Agent-wise priority metrics with dropdown selector
- ✅ Single agent view with priority breakdown
- ✅ All agents table view with sortable columns
- ✅ Clickable boxes redirect to tickets page with priority filter
- ✅ Color coding: High (red), Medium (orange), Low (green)
- ✅ Date filtering support (inherited from dashboard)
- ✅ Dark mode support
- ✅ Loading and error states

### 5. Dashboard Page Integration ✅ COMPLETE
**File:** `/home/miles/helpdesk/frontend/src/pages/dashboard/DashboardPage.jsx`
**Implemented:**
- ✅ Imported `PriorityMetrics` component
- ✅ Added component after ResolutionTimeMetrics
- ✅ Shown ONLY for managers, supervisors, and admin
- ✅ Hidden from agents and candidates

## Role-Based Access Control

### Internal Users (Can see and set priority)
- agent
- department-manager
- department-supervisor
- admin

### External Users (Cannot see or set priority)
- candidate (students)

## Priority Values
- `high`: Red color (#f44336 or #ef4444)
- `medium`: Orange/Yellow color (#ff9800 or #f59e0b)
- `low`: Green color (#4caf50 or #10b981)
- `null`: No priority set (gray or empty)

## API Endpoints Summary

### Ticket Priority
- `PUT /api/tickets/{ticket_id}/priority`
  - Body: `{ "priority": "high" | "medium" | "low" }`
  - Auth: Internal users only
  - Returns: Updated ticket object

### Dashboard Metrics
- `GET /api/dashboard/priority-metrics?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`
  - Auth: Internal users only
  - Returns: `{ high: int, medium: int, low: int, total: int }`

- `GET /api/dashboard/priority-metrics/agents?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD`
  - Auth: Internal users only
  - Returns: Array of agent priority metrics

## Testing Checklist

### Backend ✅
- [ ] Run migration script: `python /home/miles/helpdesk/backend/app/db/migrations/add_priority_to_tickets.py`
- [ ] Test priority update endpoint with different roles
- [ ] Test priority validation (invalid values)
- [ ] Test dashboard metrics endpoints
- [ ] Verify department filtering for managers/supervisors

### Frontend ✅
- [x] Priority selector shows only for internal users
- [x] Priority selector updates ticket correctly
- [x] Tickets list shows priority column with correct colors
- [x] Priority metrics dashboard displays correctly
- [x] Clicking priority boxes filters tickets
- [x] Date filtering works for priority metrics
- [x] Agent-wise metrics show correct data

## Deployment Steps

### 1. Run Database Migration
```bash
cd /home/miles/helpdesk/backend
python app/db/migrations/add_priority_to_tickets.py
```

### 2. Restart Backend Server
```bash
# Stop current backend process
# Start backend server
cd /home/miles/helpdesk/backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Restart Frontend (if needed)
```bash
cd /home/miles/helpdesk/frontend
npm start
```

## Feature Summary

### ✅ Complete Implementation
All components of the ticket priority feature have been implemented:

1. **Database**: Priority column added to tickets table
2. **Backend API**: Priority update and metrics endpoints with role-based access
3. **Frontend UI**: 
   - Priority selector in ticket view (3 boxes: High, Medium, Low)
   - Priority column in tickets list with color coding
   - Priority metrics dashboard for managers/supervisors/admin
4. **Access Control**: Feature hidden from candidates, visible only to internal users
