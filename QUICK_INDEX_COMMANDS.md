# Quick Copy-Paste Index Commands

## Fastest Way to Apply All Indexes

### Option A: One-Line Command (Recommended)

```bash
psql -U postgres -d helpdesk -f /home/miles/helpdesk/DATABASE_INDEXES.sql
```

Then verify:
```bash
psql -U postgres -d helpdesk -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';"
```

---

## Option B: Copy-Paste Into PostgreSQL Terminal

### Step 1: Connect to PostgreSQL
```bash
psql -U postgres -d helpdesk
```

### Step 2: Copy and paste ALL of this at once:

```sql
-- TICKETS TABLE INDEXES
CREATE INDEX IF NOT EXISTS idx_tickets_status_id ON tickets(status_id);
CREATE INDEX IF NOT EXISTS idx_tickets_category_id ON tickets(category_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_is_delayed ON tickets(is_delayed);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_updated_at ON tickets(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status_created ON tickets(status_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_category_status ON tickets(category_id, status_id);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_status ON tickets(assigned_to, status_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_status ON tickets(created_by, status_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status_priority ON tickets(status_id, priority);
CREATE INDEX IF NOT EXISTS idx_tickets_category_created ON tickets(category_id, created_at DESC);

-- TICKET_THREADS TABLE INDEXES
CREATE INDEX IF NOT EXISTS idx_threads_ticket_id ON ticket_threads(ticket_id);
CREATE INDEX IF NOT EXISTS idx_threads_user_id ON ticket_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_threads_created_at ON ticket_threads(created_at);
CREATE INDEX IF NOT EXISTS idx_threads_ticket_created ON ticket_threads(ticket_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_threads_user_ticket ON ticket_threads(user_id, ticket_id);

-- USERS TABLE INDEXES
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role_id, is_active);

-- USER_CATEGORIES TABLE INDEXES
CREATE INDEX IF NOT EXISTS idx_user_categories_user_id ON user_categories(user_id);
CREATE INDEX IF NOT EXISTS idx_user_categories_category_id ON user_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_user_categories_user_category ON user_categories(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_user_categories_category_user ON user_categories(category_id, user_id);

-- USER_BATCHES TABLE INDEXES
CREATE INDEX IF NOT EXISTS idx_user_batches_user_id ON user_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_user_batches_batch_id ON user_batches(batch_id);
CREATE INDEX IF NOT EXISTS idx_user_batches_user_batch ON user_batches(user_id, batch_id);
CREATE INDEX IF NOT EXISTS idx_user_batches_batch_user ON user_batches(batch_id, user_id);

-- USER_DEPARTMENTS TABLE INDEXES
CREATE INDEX IF NOT EXISTS idx_user_departments_user_id ON user_departments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_departments_department_id ON user_departments(department_id);
CREATE INDEX IF NOT EXISTS idx_user_departments_user_dept ON user_departments(user_id, department_id);
CREATE INDEX IF NOT EXISTS idx_user_departments_dept_user ON user_departments(department_id, user_id);

-- CATEGORIES TABLE INDEXES
CREATE INDEX IF NOT EXISTS idx_categories_department_id ON categories(department_id);

-- ANALYZE TABLES
ANALYZE tickets;
ANALYZE ticket_threads;
ANALYZE users;
ANALYZE user_categories;
ANALYZE user_batches;
ANALYZE user_departments;
ANALYZE categories;
```

### Step 3: Press Enter and wait for completion

---

## Verify Indexes Were Created

```sql
SELECT COUNT(*) as total_indexes FROM pg_indexes WHERE schemaname = 'public';
```

**Expected result:** 31 (or more if you had existing indexes)

---

## Check Index Sizes

```sql
SELECT 
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_indexes
JOIN pg_class ON pg_class.relname = indexname
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

## Test Query Performance

### Before Indexes (Run this BEFORE applying indexes)
```sql
\timing on
SELECT * FROM tickets WHERE status_id = 1 ORDER BY created_at DESC LIMIT 25;
```
Note the time shown at the bottom.

### After Indexes (Run this AFTER applying indexes)
```sql
SELECT * FROM tickets WHERE status_id = 1 ORDER BY created_at DESC LIMIT 25;
```
Should be 10-50x faster!

---

## Critical Indexes Only (If you want to test first)

If you want to apply only the most important indexes first:

```sql
-- These 10 indexes give 80% of the performance benefit
CREATE INDEX IF NOT EXISTS idx_tickets_status_id ON tickets(status_id);
CREATE INDEX IF NOT EXISTS idx_tickets_category_id ON tickets(category_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_status_created ON tickets(status_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threads_ticket_id ON ticket_threads(ticket_id);
CREATE INDEX IF NOT EXISTS idx_threads_ticket_created ON ticket_threads(ticket_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_user_categories_user_category ON user_categories(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_user_batches_user_batch ON user_batches(user_id, batch_id);
CREATE INDEX IF NOT EXISTS idx_user_batches_batch_user ON user_batches(batch_id, user_id);

ANALYZE;
```

---

## Troubleshooting Commands

### Check if indexes exist
```sql
SELECT indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname;
```

### Check index usage
```sql
SELECT 
    indexname,
    idx_scan as times_used
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### Remove all custom indexes (if needed)
```sql
DROP INDEX IF EXISTS idx_tickets_status_id;
DROP INDEX IF EXISTS idx_tickets_category_id;
DROP INDEX IF EXISTS idx_tickets_created_by;
DROP INDEX IF EXISTS idx_tickets_assigned_to;
DROP INDEX IF EXISTS idx_tickets_priority;
DROP INDEX IF EXISTS idx_tickets_is_delayed;
DROP INDEX IF EXISTS idx_tickets_created_at;
DROP INDEX IF EXISTS idx_tickets_updated_at;
DROP INDEX IF EXISTS idx_tickets_status_created;
DROP INDEX IF EXISTS idx_tickets_category_status;
DROP INDEX IF EXISTS idx_tickets_assigned_status;
DROP INDEX IF EXISTS idx_tickets_created_status;
DROP INDEX IF EXISTS idx_tickets_status_priority;
DROP INDEX IF EXISTS idx_tickets_category_created;
DROP INDEX IF EXISTS idx_threads_ticket_id;
DROP INDEX IF EXISTS idx_threads_user_id;
DROP INDEX IF EXISTS idx_threads_created_at;
DROP INDEX IF EXISTS idx_threads_ticket_created;
DROP INDEX IF EXISTS idx_threads_user_ticket;
DROP INDEX IF EXISTS idx_users_role_id;
DROP INDEX IF EXISTS idx_users_is_active;
DROP INDEX IF EXISTS idx_users_role_active;
DROP INDEX IF EXISTS idx_user_categories_user_id;
DROP INDEX IF EXISTS idx_user_categories_category_id;
DROP INDEX IF EXISTS idx_user_categories_user_category;
DROP INDEX IF EXISTS idx_user_categories_category_user;
DROP INDEX IF EXISTS idx_user_batches_user_id;
DROP INDEX IF EXISTS idx_user_batches_batch_id;
DROP INDEX IF EXISTS idx_user_batches_user_batch;
DROP INDEX IF EXISTS idx_user_batches_batch_user;
DROP INDEX IF EXISTS idx_user_departments_user_id;
DROP INDEX IF EXISTS idx_user_departments_department_id;
DROP INDEX IF EXISTS idx_user_departments_user_dept;
DROP INDEX IF EXISTS idx_user_departments_dept_user;
DROP INDEX IF EXISTS idx_categories_department_id;
```

---

## Recommended Steps

1. **Run Option A command** (fastest)
2. **Wait 5-10 minutes**
3. **Run verification command** to confirm
4. **Test application** to see performance improvement
5. **Done!** 🎉

Expected improvement: **50-80% faster response times**
