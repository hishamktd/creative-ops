-- =====================================================
-- ADVANCED FIX: Use session variables instead of querying users table
-- =====================================================

-- This approach sets a session variable with the user's role
-- when they authenticate, avoiding the need to query users table in policies

-- Create a function to get role from session variable
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    current_setting('app.current_user_role', true),
    'client'
  );
$$;

-- Create a function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('app.current_user_role', true) = 'admin';
$$;

-- Create a function to check if current user is team member or admin
CREATE OR REPLACE FUNCTION public.is_team_member_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('app.current_user_role', true) IN ('admin', 'team_member');
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_team_member_or_admin() TO authenticated, anon;

-- NOTE: You'll need to set the session variable in your application code
-- after authentication. Add this to your Supabase client initialization:
--
-- Example in JavaScript/TypeScript:
-- supabase.auth.onAuthStateChange(async (event, session) => {
--   if (session?.user) {
--     const { data: userData } = await supabase
--       .from('users')
--       .select('role')
--       .eq('id', session.user.id)
--       .single();
--
--     if (userData) {
--       await supabase.rpc('set_user_role', { user_role: userData.role });
--     }
--   }
-- });

-- Create an RPC function to set the role
CREATE OR REPLACE FUNCTION public.set_user_role(user_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify the role matches the actual user's role in the database
  IF EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role::text = user_role
  ) THEN
    PERFORM set_config('app.current_user_role', user_role, false);
  ELSE
    RAISE EXCEPTION 'Invalid role for user';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_role(text) TO authenticated;

-- Now update the users table policies to use the session variable
DROP POLICY IF EXISTS "Admins can do anything with users" ON users;
DROP POLICY IF EXISTS "Users can view all active users" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

CREATE POLICY "Users can view all active users" ON users
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id OR public.is_admin());

-- For INSERT/DELETE on users, use service role only
-- or require is_admin() from session variable (no recursion)
CREATE POLICY "Admins can insert users" ON users
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete users" ON users
  FOR DELETE USING (public.is_admin());
