# FRT-Based Automatic Priority Assignment Setup

## Overview
Implemented automatic priority assignment for open and in-progress tickets based on **First Response Time (FRT)**.

## Configuration

### FRT Priority Rules
- **≥ 20 hours** without response → **HIGH** priority
- **≥ 12 hours** without response → **MEDIUM** priority
- **< 12 hours** without response → **LOW** priority

### Scheduler Configuration
- **Check Interval**: 1 hour (configurable via `FRT_PRIORITY_CHECK_INTERVAL` in `main.py`)
- **Automatic Updates**: Runs every hour to check and update ticket priorities
- **Logging**: Detailed logs for each updated ticket

## Implementation Details

### 1. Backend Changes

#### File: `/home/miles/helpdesk/backend/app/repositories/ticket_repository.py`

**New Function: `update_ticket_priority_by_frt(db: Session)`**
- Queries all open and in-progress tickets
- For each ticket:
  - Checks if an agent has responded (first agent response in threads)
  - **If agent responded**: Calculates FRT as time from ticket creation to first agent response
  - **If no response**: Calculates FRT as time from ticket creation to current time (ticket age)
- Determines priority level based on FRT hours
- Updates ticket priority only if it changed
- Returns list of updated tickets with details
- Includes comprehensive error handling and logging

**Key Logic:**
```python
if first_agent_response:
    # Agent has responded - calculate time to first response
    frt_hours = (first_response_time - ticket_created).total_seconds() / 3600
else:
    # No agent response yet - calculate ticket age
    frt_hours = (current_time - ticket_created).total_seconds() / 3600
```

#### File: `/home/miles/helpdesk/backend/app/main.py`

**Added Configuration:**
```python
FRT_PRIORITY_CHECK_INTERVAL = 1  # hours
```

**Added Scheduler Job:**
- Wrapper function: `update_frt_priorities_wrapper()`
- Runs every 1 hour (configurable)
- Logs all priority updates with details:
  - Ticket ID
  - Old priority → New priority
  - FRT hours
  - Whether agent has responded

### 2. Database Fields Used
- `tickets.priority` - Stores priority level ('high', 'medium', 'low')
- `tickets.created_at` - Ticket creation timestamp
- `tickets.status_id` - Current ticket status
- `ticket_threads.created_at` - Thread creation timestamp (for first response)
- `ticket_threads.user_id` - Thread creator (to identify agent responses)

## How It Works

### Execution Flow
1. **Scheduler Trigger**: Every 1 hour, the FRT priority check job runs
2. **Fetch Tickets**: Retrieves all open and in-progress tickets
3. **Calculate FRT**: For each ticket:
   - Finds first agent response (if any)
   - Calculates time difference
4. **Determine Priority**: Maps FRT hours to priority level
5. **Update Database**: Only updates if priority changed
6. **Log Results**: Logs all changes with details

### Example Scenarios

**Scenario 1: Ticket with Agent Response**
```
Ticket #123 created at: 2024-03-23 10:00 AM
First agent response at: 2024-03-23 02:00 PM (4 hours later)
FRT: 4 hours
Priority: LOW (< 12 hours)
```

**Scenario 2: Ticket Without Response (Aging)**
```
Ticket #456 created at: 2024-03-22 10:00 AM
Current time: 2024-03-23 10:00 AM (24 hours later)
No agent response yet
FRT: 24 hours (ticket age)
Priority: HIGH (≥ 20 hours)
```

**Scenario 3: Ticket Escalating Over Time**
```
Ticket #789 created at: 2024-03-23 10:00 AM
At 10:00 AM: No response, FRT = 0h, Priority = LOW
At 1:00 PM: No response, FRT = 3h, Priority = LOW
At 10:00 PM: No response, FRT = 12h, Priority = MEDIUM
At 6:00 AM (next day): No response, FRT = 20h, Priority = HIGH
```

## Monitoring & Logging

### Log Output Examples
```
INFO: FRT-based priority check scheduler started. Interval: 1 hours
INFO: Updated priority for 3 tickets based on FRT
INFO:   Ticket #123: low → medium (FRT: 12.5h)
INFO:   Ticket #456: medium → high (FRT: 20.2h)
INFO:   Ticket #789: low → low (FRT: 5.3h)
```

### Error Handling
- Graceful error handling with try-catch blocks
- Logs errors without stopping the scheduler
- Returns empty list if no tickets updated or on error
- Validates status existence before processing

## Configuration Options

### Adjust Check Interval
Edit `/home/miles/helpdesk/backend/app/main.py`:
```python
FRT_PRIORITY_CHECK_INTERVAL = 1  # Change to desired hours
```

### Adjust FRT Thresholds
Edit `/home/miles/helpdesk/backend/app/repositories/ticket_repository.py` in `update_ticket_priority_by_frt()`:
```python
if frt_hours >= 20:      # Change 20 to desired hours
    new_priority = "high"
elif frt_hours >= 12:    # Change 12 to desired hours
    new_priority = "medium"
else:
    new_priority = "low"
```

## Testing

### Manual Testing
You can test the function manually:
```python
from app.db.session import SessionLocal
from app.repositories.ticket_repository import update_ticket_priority_by_frt

db = SessionLocal()
updated = update_ticket_priority_by_frt(db)
print(f"Updated {len(updated)} tickets")
for ticket in updated:
    print(f"  Ticket #{ticket['ticket_id']}: {ticket['old_priority']} → {ticket['new_priority']}")
db.close()
```

### Verification Checklist
- [ ] Backend service starts without errors
- [ ] Scheduler job appears in logs on startup
- [ ] Check logs after 1 hour for priority updates
- [ ] Verify ticket priorities updated in database
- [ ] Test with tickets of different ages
- [ ] Verify agent response detection works correctly

## Integration Points

### Frontend Display
The frontend can display ticket priorities using the `priority` field:
- Show priority badges/labels on ticket lists
- Color-code: Red (high), Yellow (medium), Green (low)
- Sort tickets by priority in ticket list view

### API Endpoints
The priority field is already part of the ticket response schema and can be used in:
- `GET /tickets/` - List tickets with priorities
- `GET /tickets/{ticket_id}` - Get ticket details with priority
- Filtering/sorting by priority (if implemented)

## Notes

- **Automatic Only**: Priority is set automatically by the scheduler, not manually
- **No Manual Override**: Current implementation doesn't prevent manual priority changes
- **Status-Based**: Only processes open and in-progress tickets
- **Agent Detection**: Uses role-based detection to identify agent responses
- **Timezone-Aware**: All calculations use UTC timezone for consistency
- **Efficient**: Only updates tickets where priority actually changed

## Future Enhancements

1. Add manual priority override capability
2. Add priority-based email notifications
3. Add priority field to ticket creation form
4. Add priority filtering to ticket list API
5. Add priority metrics to dashboard
6. Implement priority-based SLA tracking
7. Add priority change audit trail
