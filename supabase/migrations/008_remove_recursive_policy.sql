-- =====================================================
-- SIMPLEST FIX: Remove recursive admin policy from users table
-- =====================================================

-- The infinite recursion happens because the policy on users table
-- tries to query the users table. The simplest fix is to remove
-- this specific policy and handle admin access differently.

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can do anything with users" ON users;

-- Keep the safe policies (these don't cause recursion)
DROP POLICY IF EXISTS "Users can view all active users" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

CREATE POLICY "Users can view all active users" ON users
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- For admin operations on users, use the service role key in your application
-- This is actually more secure as it keeps user management operations
-- separated and explicit in your application code.

-- ALTERNATIVE: If you need admins to have full access, use a policy that
-- doesn't query the users table:
-- CREATE POLICY "Service role bypass" ON users
--   FOR ALL TO service_role USING (true);
