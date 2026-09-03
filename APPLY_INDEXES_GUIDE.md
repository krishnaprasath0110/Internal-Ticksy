# How to Apply Database Indexes

## Quick Start

### Option 1: Apply All Indexes at Once (Recommended)

1. **Connect to PostgreSQL:**
   ```bash
   psql -U postgres -d helpdesk
   ```

2. **Copy and paste the entire content of `DATABASE_INDEXES.sql` into the PostgreSQL terminal**

3. **Press Enter and wait for completion** (5-10 minutes depending on data size)

4. **Verify indexes were created:**
   ```sql
   SELECT indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname;
   ```

---

### Option 2: Apply Indexes from File

1. **Run the SQL file directly:**
   ```bash
   psql -U postgres -d helpdesk -f /home/miles/helpdesk/DATABASE_INDEXES.sql
   ```

2. **Wait for completion**

3. **Verify success:**
   ```bash
   psql -U postgres -d helpdesk -c "SELECT COUNT(*) as total_indexes FROM pg_indexes WHERE schemaname = 'public';"
   ```

---

### Option 3: Apply Indexes Selectively (If you want to test first)

#### Step 1: Apply Critical Indexes Only (Fastest Impact)

```bash
psql -U postgres -d helpdesk << EOF
-- Critical indexes for tickets table
CREATE INDEX IF NOT EXISTS idx_tickets_status_id ON tickets(status_id);
CREATE INDEX IF NOT EXISTS idx_tickets_category_id ON tickets(category_id);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON tickets(created_by);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tickets_status_created ON tickets(status_id, created_at DESC);

-- Critical indexes for threads table
CREATE INDEX IF NOT EXISTS idx_threads_ticket_id ON ticket_threads(ticket_id);
CREATE INDEX IF NOT EXISTS idx_threads_ticket_created ON ticket_threads(ticket_id, created_at ASC);

-- Critical indexes for user relationships
CREATE INDEX IF NOT EXISTS idx_user_categories_user_category ON user_categories(user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_user_categories_category_user ON user_categories(category_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_batches_user_batch ON user_batches(user_id, batch_id);
CREATE INDEX IF NOT EXISTS idx_user_batches_batch_user ON user_batches(batch_id, user_id);

ANALYZE tickets;
ANALYZE ticket_threads;
ANALYZE user_categories;
ANALYZE user_batches;
EOF
```

#### Step 2: Test Performance

After applying critical indexes, test the application:
- Load ticket list page
- Check response time
- Compare with baseline

#### Step 3: Apply Remaining Indexes

Once you confirm improvement, apply the rest:
```bash
psql -U postgres -d helpdesk -f /home/miles/helpdesk/DATABASE_INDEXES.sql
```

---

## Verification Steps

### 1. Check if Indexes Were Created

```sql
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as times_used
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

**Expected output:** Should show 31 indexes (or more if you had existing ones)

### 2. Check Index Sizes

```sql
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_indexes
JOIN pg_class ON pg_class.relname = indexname
WHERE schemaname = 'public'
ORDER BY pg_relation_size(indexrelid) DESC;
```

**Expected:** Total index size should be 10-50 MB depending on data

### 3. Check Index Usage

```sql
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as times_used,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

**Expected:** Most-used indexes should have high `idx_scan` values

### 4. Verify Query Performance

Before and after comparison:

```sql
-- Example: Check status filtering performance
EXPLAIN ANALYZE
SELECT * FROM tickets WHERE status_id = 1 LIMIT 25;
```

**Before indexes:** Should show "Seq Scan" (slow)
**After indexes:** Should show "Index Scan" (fast)

---

## Troubleshooting

### Issue: "Index already exists"

**Solution:** The `IF NOT EXISTS` clause prevents errors. Just run again.

### Issue: "Permission denied"

**Solution:** Make sure you're connected as a user with CREATE INDEX permissions:
```bash
psql -U postgres -d helpdesk
```

### Issue: Indexes not being used

**Solution:** Run ANALYZE to update table statistics:
```sql
ANALYZE;
```

### Issue: Slow index creation

**Solution:** This is normal for large tables. Be patient and don't interrupt.

---

## Performance Testing

### Before Applying Indexes

1. **Open a terminal and connect to PostgreSQL:**
   ```bash
   psql -U postgres -d helpdesk
   ```

2. **Run a test query and note the time:**
   ```sql
   \timing on
   SELECT * FROM tickets WHERE status_id = 1 ORDER BY created_at DESC LIMIT 25;
   ```

3. **Note the execution time (e.g., "Time: 2500.123 ms")**

### After Applying Indexes

1. **Run the same query:**
   ```sql
   SELECT * FROM tickets WHERE status_id = 1 ORDER BY created_at DESC LIMIT 25;
   ```

2. **Compare the time (should be 10-50x faster)**

### Expected Results

| Query Type | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Status filtering | 2000-3000 ms | 50-200 ms | **10-50x** |
| Category filtering | 1500-2500 ms | 100-300 ms | **5-20x** |
| Agent tickets | 1000-2000 ms | 100-300 ms | **5-15x** |
| First response | 3000-5000 ms | 500-1000 ms | **3-10x** |

---

## Maintenance

### Regular Maintenance (Monthly)

```sql
-- Reindex to defragment indexes
REINDEX INDEX idx_tickets_status_id;
REINDEX INDEX idx_tickets_category_id;
-- ... (repeat for all indexes)

-- Or reindex entire database
REINDEX DATABASE helpdesk;
```

### Monitor Index Health (Weekly)

```sql
-- Find unused indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0
ORDER BY tablename;
```

### Update Statistics (Weekly)

```sql
ANALYZE;
```

---

## Rollback (If Needed)

If you need to remove indexes:

```sql
DROP INDEX IF EXISTS idx_tickets_status_id;
DROP INDEX IF EXISTS idx_tickets_category_id;
-- ... (repeat for all indexes)
```

Or remove all custom indexes at once:

```sql
SELECT 'DROP INDEX IF EXISTS ' || indexname || ';'
FROM pg_indexes
WHERE schemaname = 'public' 
  AND indexname LIKE 'idx_%'
ORDER BY indexname;
```

---

## Summary

- **Total indexes to create:** 31
- **Estimated creation time:** 5-10 minutes
- **Expected performance improvement:** 50-80% faster
- **Disk space used:** 10-50 MB
- **Maintenance overhead:** Minimal (automatic)

**Recommendation:** Apply all indexes at once using Option 1 or 2 for maximum benefit.
