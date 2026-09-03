# Simplified Agent-Batch Assignment Implementation

## Overview
This implementation allows agents to be assigned to batches, enabling intelligent ticket assignment based on the student's batch and the ticket's category. **No new tables required** - we use existing `user_batches` and `user_categories` tables.

## How It Works

### Existing Tables Used
1. **`user_batches`** - Maps users (students AND agents) to batches
2. **`user_categories`** - Maps agents to categories they handle

### Ticket Assignment Logic

When a student creates a ticket:
1. Check which batch the student is in (from `user_batches`)
2. Find agents who are:
   - In the same batch (from `user_batches`)
   - Handle the ticket's category (from `user_categories`)
3. Assign ticket to the first matching agent
4. If no batch-specific agent found, fall back to category-based assignment

```python
# Pseudocode
student_batch = user_batches.find(user_id=student.id)
agent = users.find(
    role='agent',
    batch_id=student_batch.id,  # from user_batches
    category_id=ticket.category_id  # from user_categories
)
```

## Backend Changes

### 1. Updated Files

#### `app/repositories/ticket_repository.py`
- **New function**: `get_agent_by_batch_and_category()`
  - Queries agents who are in the specified batch AND handle the specified category
  - Uses JOIN on `user_batches` and `user_categories`
  
- **Updated function**: `create_ticket()`
  - First tries batch-based assignment
  - Falls back to category-based assignment
  - Logs which assignment method was used

#### `app/repositories/user_repository.py`
- **Updated**: `create_user()` - Handle `batch_ids` for agents
- **Updated**: `update_user()` - Handle `batch_ids` for agents
- Agents can now be assigned to multiple batches
- Candidates still use single `batch_id`

#### `app/schemas/user_schema.py`
- **Added**: `batch_ids: Optional[List[int]]` to `UserCreate`
- **Added**: `batch_ids: Optional[List[int]]` to `UserUpdate`

## Frontend Changes

### `components/users/AgentForm.jsx`

**New Features**:
- Batch selection section (similar to categories)
- Multi-select checkboxes for batches
- Shows batch name and description
- Displays count of selected batches

**Form Data Structure**:
```javascript
{
  name: "Agent Name",
  email: "agent@example.com",
  role_id: 2,
  department_ids: [1, 2],
  category_ids: [3, 4],
  batch_ids: [5, 6, 7],  // NEW: Agent can handle multiple batches
  is_active: true
}
```

## API Changes

### POST /api/users/agents
**Request Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "role_id": 2,
  "department_ids": [1, 2],
  "category_ids": [3, 4],
  "batch_ids": [5, 6],
  "is_active": true
}
```

### PUT /api/users/{user_id}
Same structure as POST

## Usage Example

### Scenario
- **Student**: Alice (Batch: "MBA 2024", Category: "Technical Support")
- **Agent 1**: Bob (Batches: ["MBA 2024"], Categories: ["Technical Support", "Academic"])
- **Agent 2**: Carol (Batches: ["MBA 2023"], Categories: ["Technical Support"])

### Result
When Alice creates a technical support ticket:
1. System finds Alice is in "MBA 2024" batch
2. System searches for agents in "MBA 2024" who handle "Technical Support"
3. Finds Bob (matches both criteria)
4. Assigns ticket to Bob ✓

If Bob wasn't available:
- System would fall back to category-based assignment
- Would assign to any agent handling "Technical Support"

## Benefits

1. **No Database Migration Required** ✓
2. **Reuses Existing Tables** ✓
3. **Simple Implementation** ✓
4. **Flexible Assignment**:
   - Agents can handle multiple batches
   - Agents can handle multiple categories
   - Any combination of batch + category works
5. **Backward Compatible**:
   - Existing category-based assignment still works
   - No breaking changes

## Testing Checklist

### Backend
- [ ] Assign agent to batches via API
- [ ] Create ticket as student in batch - verify batch-based assignment
- [ ] Create ticket as student not in batch - verify category-based fallback
- [ ] Update agent's batch assignments
- [ ] Verify logs show which assignment method was used

### Frontend
- [ ] Open agent form
- [ ] Select multiple batches for agent
- [ ] Save agent with batch assignments
- [ ] Edit agent and verify batches load correctly
- [ ] Verify batch selection UI works like category selection

## Implementation Steps

1. ✅ Update `ticket_repository.py` - Add batch-based assignment logic
2. ✅ Update `user_repository.py` - Handle batch_ids for agents
3. ✅ Update `user_schema.py` - Add batch_ids field
4. ✅ Update `AgentForm.jsx` - Add batch selection UI
5. ⏳ Test ticket creation with batch-based assignment
6. ⏳ Verify fallback to category-based assignment works

## Key Differences from Complex Approach

| Aspect | Complex (agent_batch_categories table) | Simple (reuse existing tables) |
|--------|---------------------------------------|-------------------------------|
| New Tables | ✗ Requires new table | ✓ No new tables |
| Migration | ✗ Required | ✓ Not required |
| Assignment | Batch + Category combination | Batch AND Category (intersection) |
| Flexibility | Slightly more control | Same practical result |
| Complexity | Higher | Lower |
| Maintenance | More code to maintain | Less code |

## Notes

- Agents assigned to batches will handle tickets from students in those batches
- Agents must also be assigned to the relevant categories
- The system automatically finds the intersection of batch and category
- If no agent matches both criteria, fallback ensures tickets are still assigned
- Existing functionality remains unchanged
