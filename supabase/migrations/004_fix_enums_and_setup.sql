-- =====================================================
-- FIX MIGRATION: Create ENUMs and Setup
-- Run this FIRST if you're having enum errors
-- This is idempotent - safe to run multiple times
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- STEP 1: Create all ENUM types
-- =====================================================

DO $$
BEGIN
    -- Create user_role enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'team_member', 'client');
        RAISE NOTICE 'Created user_role enum';
    ELSE
        RAISE NOTICE 'user_role enum already exists';
    END IF;

    -- Create task_status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
        CREATE TYPE task_status AS ENUM ('todo', 'in_progress', 'review', 'done');
        RAISE NOTICE 'Created task_status enum';
    ELSE
        RAISE NOTICE 'task_status enum already exists';
    END IF;

    -- Create invoice_status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
        CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue');
        RAISE NOTICE 'Created invoice_status enum';
    ELSE
        RAISE NOTICE 'invoice_status enum already exists';
    END IF;

    -- Create project_status enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
        CREATE TYPE project_status AS ENUM ('active', 'archived', 'completed');
        RAISE NOTICE 'Created project_status enum';
    ELSE
        RAISE NOTICE 'project_status enum already exists';
    END IF;

    -- Create activity_type enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_type') THEN
        CREATE TYPE activity_type AS ENUM ('task_update', 'comment', 'upload', 'login', 'logout');
        RAISE NOTICE 'Created activity_type enum';
    ELSE
        RAISE NOTICE 'activity_type enum already exists';
    END IF;

    -- Create notification_type enum
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type') THEN
        CREATE TYPE notification_type AS ENUM ('info', 'success', 'warning', 'error');
        RAISE NOTICE 'Created notification_type enum';
    ELSE
        RAISE NOTICE 'notification_type enum already exists';
    END IF;
END $$;

-- =====================================================
-- STEP 2: Create users table if not exists
-- =====================================================

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role user_role DEFAULT 'team_member',
  avatar_url TEXT,
  xp_points INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- STEP 3: Create trigger function to auto-create user profiles
-- =====================================================

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Create function to handle new user signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'team_member'::user_role)
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail signup
    RAISE WARNING 'Error creating user profile for %: %', NEW.email, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- STEP 4: Create trigger on auth.users
-- =====================================================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- STEP 5: Enable Row Level Security
-- =====================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies for users table
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can view all active users" ON users;
    DROP POLICY IF EXISTS "Users can update own profile" ON users;
    DROP POLICY IF EXISTS "Admins can do anything with users" ON users;

    -- Create policies
    CREATE POLICY "Users can view all active users" ON users
      FOR SELECT USING (is_active = true);

    CREATE POLICY "Users can update own profile" ON users
      FOR UPDATE USING (auth.uid() = id);

    CREATE POLICY "Admins can do anything with users" ON users
      FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
      );
END $$;

-- =====================================================
-- STEP 6: Create updated_at trigger
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- STEP 7: Verify setup
-- =====================================================

DO $$
DECLARE
    enum_count INTEGER;
    table_exists BOOLEAN;
    trigger_exists BOOLEAN;
    function_exists BOOLEAN;
BEGIN
    -- Check ENUMs
    SELECT COUNT(*) INTO enum_count
    FROM pg_type
    WHERE typname IN ('user_role', 'task_status', 'invoice_status', 'project_status', 'activity_type', 'notification_type');

    -- Check table
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'users'
    ) INTO table_exists;

    -- Check trigger
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
    ) INTO trigger_exists;

    -- Check function
    SELECT EXISTS (
        SELECT 1 FROM pg_proc WHERE proname = 'handle_new_user'
    ) INTO function_exists;

    -- Report results
    RAISE NOTICE '========================================';
    RAISE NOTICE 'SETUP VERIFICATION';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ENUMs created: % out of 6', enum_count;
    RAISE NOTICE 'Users table exists: %', table_exists;
    RAISE NOTICE 'Trigger exists: %', trigger_exists;
    RAISE NOTICE 'Function exists: %', function_exists;
    RAISE NOTICE '========================================';

    IF enum_count = 6 AND table_exists AND trigger_exists AND function_exists THEN
        RAISE NOTICE 'SUCCESS: All components created successfully!';
        RAISE NOTICE 'You can now sign up users.';
    ELSE
        RAISE WARNING 'INCOMPLETE: Some components are missing. Please review the output above.';
    END IF;
END $$;
