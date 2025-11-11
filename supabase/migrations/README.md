# Database Migrations

Run these migrations **in order** in your Supabase SQL Editor.

## Migration Order

### If You're Getting "type user_role does not exist" Error

**Run ONLY this one:**
- ✅ `004_fix_enums_and_setup.sql` - **FIX MIGRATION** (Fixes ENUM errors + creates users table + trigger)

This migration is **idempotent** (safe to run multiple times) and includes:
- All ENUM types
- Users table
- Signup trigger
- Basic RLS policies
- Verification checks

**After running, try signing up. It should work!**

---

### Fresh Setup (New Supabase Project)

Run in this exact order:

1. ✅ `001_initial_schema.sql` - Creates all tables (projects, tasks, assets, invoices, etc.)
2. ✅ `002_rls_policies.sql` - Row Level Security policies
3. ✅ `003_seed_data.sql` - Badges and helper functions
4. ✅ `004_fix_enums_and_setup.sql` - **OPTIONAL FIX** (Only if you get ENUM errors)

---

### If Migrations Already Partially Run

Just run:
- ✅ `004_fix_enums_and_setup.sql` - It will create missing pieces without breaking existing ones

---

## How to Run Migrations

### Method 1: Supabase Dashboard (Recommended)

1. Go to your project: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new
2. Copy the **entire contents** of a migration file
3. Paste into SQL Editor
4. Click **"Run"**
5. Check for success messages
6. Move to next migration

### Method 2: Supabase CLI (Advanced)

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
supabase db push
```

---

## Verify Migrations Worked

After running migrations, verify in SQL Editor:

```sql
-- Check ENUMs exist
SELECT typname FROM pg_type
WHERE typname IN ('user_role', 'task_status', 'invoice_status', 'project_status', 'activity_type', 'notification_type');
-- Should return 6 rows

-- Check users table exists
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'users';
-- Should return 'users'

-- Check trigger exists
SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';
-- Should return 'on_auth_user_created'

-- Check function exists
SELECT proname FROM pg_proc WHERE proname = 'handle_new_user';
-- Should return 'handle_new_user'

-- Check all tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
-- Should see: assets, badges, comments, folders, invoices, notifications, projects, tasks, users, etc.
```

---

## Common Issues

### Issue: "type user_role does not exist"
**Solution:** Run `000_fix_enums_and_setup.sql`

### Issue: "relation users does not exist"
**Solution:** Run `000_fix_enums_and_setup.sql` first, then `001_initial_schema.sql`

### Issue: "function handle_new_user() does not exist"
**Solution:** Run `000_fix_enums_and_setup.sql`

### Issue: "duplicate key value violates unique constraint"
**Solution:** Tables already exist. Skip to next migration or run verification SQL above.

### Issue: Signup returns 500 error
**Solutions:**
1. Run `000_fix_enums_and_setup.sql`
2. Check Supabase logs: Dashboard → Logs → Look for specific error
3. Disable email confirmation: Auth Settings → Email → Turn OFF "Confirm email"

---

## Migration Contents

### 001_initial_schema.sql (8.7 KB)
- Creates all ENUM types (user_role, task_status, etc.)
- Creates all tables: users, projects, tasks, assets, invoices, etc.
- Creates indexes for performance
- Creates triggers for updated_at timestamps
- **Run first**

### 002_rls_policies.sql (10.7 KB)
- Comprehensive Row Level Security policies
- User role-based permissions
- Protects data access
- **Run second**

### 003_seed_data.sql (3.9 KB)
- Inserts 10 achievement badges
- Creates helper functions (log_activity, award_badge, etc.)
- Creates handle_new_user() signup trigger
- XP and badge award triggers
- Invoice number generator
- **Run third**

### 004_fix_enums_and_setup.sql (7.4 KB) - **EMERGENCY FIX**
- Creates missing ENUM types if they don't exist
- Creates users table if missing
- Recreates handle_new_user() function
- Recreates signup trigger
- Sets up basic RLS policies
- Includes verification checks
- **Safe to run multiple times**
- **Only needed if migrations 001-003 had errors**

---

## After Migrations

1. ✅ All tables created
2. ✅ Signup should work
3. ✅ Create your first admin user
4. ✅ Start using the app!

---

## Need Help?

Check the main DEPLOYMENT.md file for full setup instructions.
