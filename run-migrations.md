# Quick Migration Guide

## 🚀 Quick Fix for "user_role does not exist" Error

### Step 1: Open Supabase SQL Editor
Go to: https://supabase.com/dashboard/project/mhkgfbplbilalcxzzzed/sql/new

### Step 2: Run This Single Migration
Copy the **entire contents** of this file:
```
supabase/migrations/004_fix_enums_and_setup.sql
```

### Step 3: Paste and Run
- Paste into SQL Editor
- Click "Run"
- Wait for success message

### Step 4: Verify
You should see messages like:
```
NOTICE: Created user_role enum
NOTICE: Created task_status enum
...
NOTICE: SUCCESS: All components created successfully!
```

### Step 5: Try Signup Again
Go to: https://creative-ops.vercel.app/signup

The error should be gone! ✅

---

## 📋 Full Fresh Setup (New Database)

If starting completely fresh, run these **in order**:

### 1. Create All Tables & ENUMs
File: `001_initial_schema.sql`
- Creates ENUMs
- Creates all tables (users, projects, tasks, assets, invoices, etc.)
- Creates indexes and triggers

### 2. Setup Security
File: `002_rls_policies.sql`
- Row Level Security policies

### 3. Add Sample Data & Functions
File: `003_seed_data.sql`
- Badges and helper functions
- Creates signup trigger

### 4. Emergency Fix (Only if Needed)
File: `004_fix_enums_and_setup.sql`
- **Only run if you get ENUM errors**
- Fixes missing ENUMs and triggers

---

## ✅ Verification

After running migrations, test in SQL Editor:

```sql
-- Should return 6 rows
SELECT typname FROM pg_type
WHERE typname IN ('user_role', 'task_status', 'invoice_status', 'project_status', 'activity_type', 'notification_type');

-- Should return 'users'
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'users';

-- Should return the trigger name
SELECT tgname FROM pg_trigger WHERE tgname = 'on_auth_user_created';
```

All queries should return results. If yes, **you're ready to go!** 🎉

---

## 🔧 Troubleshooting

### Still Getting 500 Error?

1. **Check Supabase Logs**
   - Go to: Logs → Look for recent errors
   - Share the error message

2. **Disable Email Confirmation** (for testing)
   - Go to: Auth → Providers → Email
   - Turn OFF "Confirm email"
   - Save

3. **Check Site URL**
   - Go to: Auth → URL Configuration
   - Site URL: `https://creative-ops.vercel.app`
   - Add redirect URLs:
     - `https://creative-ops.vercel.app/**`
     - `http://localhost:3000/**`

---

## 📁 Migration Files Location

All migrations are in:
```
supabase/migrations/
├── README.md                     ← Detailed documentation
├── 001_initial_schema.sql        ← Run FIRST (tables & ENUMs)
├── 002_rls_policies.sql          ← Run SECOND (security)
├── 003_seed_data.sql             ← Run THIRD (badges & functions)
└── 004_fix_enums_and_setup.sql  ← Run LAST (only if you get errors)
```

---

## 🎯 Your Current Issue

Based on the error log showing "type user_role does not exist":

**Run this ONE file:**
✅ `supabase/migrations/004_fix_enums_and_setup.sql`

This will fix everything and you'll be able to sign up!
