-- =====================================================
-- IMPROVED FIX: Ensure helper functions bypass RLS completely
-- =====================================================

-- First, ensure the functions are owned by postgres (superuser)
-- and set search_path for security

-- Drop existing functions
DROP FUNCTION IF EXISTS auth.is_admin();
DROP FUNCTION IF EXISTS auth.is_team_member_or_admin();
DROP FUNCTION IF EXISTS auth.get_user_role();

-- Recreate with proper configuration to bypass RLS
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role user_role;
BEGIN
  -- Query users table directly - SECURITY DEFINER bypasses RLS
  SELECT role INTO user_role
  FROM public.users
  WHERE id = auth.uid();

  RETURN user_role = 'admin';
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION auth.is_team_member_or_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role user_role;
BEGIN
  -- Query users table directly - SECURITY DEFINER bypasses RLS
  SELECT role INTO user_role
  FROM public.users
  WHERE id = auth.uid();

  RETURN user_role IN ('admin', 'team_member');
EXCEPTION
  WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION auth.get_user_role()
RETURNS user_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role user_role;
BEGIN
  -- Query users table directly - SECURITY DEFINER bypasses RLS
  SELECT role INTO user_role
  FROM public.users
  WHERE id = auth.uid();

  RETURN user_role;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.is_team_member_or_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.get_user_role() TO authenticated, anon;

-- Alternative approach: If the above doesn't work, disable RLS check in policies
-- by using a different pattern. Let's also create a simpler admin check.

-- Create a table to cache user roles (optional optimization)
CREATE TABLE IF NOT EXISTS auth.user_role_cache (
  user_id uuid PRIMARY KEY,
  role user_role NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Create trigger to keep cache updated
CREATE OR REPLACE FUNCTION auth.sync_user_role_cache()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO auth.user_role_cache (user_id, role, updated_at)
    VALUES (NEW.id, NEW.role, now())
    ON CONFLICT (user_id)
    DO UPDATE SET role = NEW.role, updated_at = now();
  ELSIF TG_OP = 'DELETE' THEN
    DELETE FROM auth.user_role_cache WHERE user_id = OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS sync_user_role_cache_trigger ON public.users;

-- Create trigger on users table
CREATE TRIGGER sync_user_role_cache_trigger
AFTER INSERT OR UPDATE OF role OR DELETE ON public.users
FOR EACH ROW
EXECUTE FUNCTION auth.sync_user_role_cache();

-- Populate the cache with existing users
INSERT INTO auth.user_role_cache (user_id, role)
SELECT id, role FROM public.users
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, updated_at = now();

-- Now update the helper functions to use the cache (no RLS on auth schema)
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = auth, public
AS $$
BEGIN
  RETURN COALESCE(
    (SELECT role = 'admin' FROM auth.user_role_cache WHERE user_id = auth.uid()),
    FALSE
  );
END;
$$;

CREATE OR REPLACE FUNCTION auth.is_team_member_or_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = auth, public
AS $$
BEGIN
  RETURN COALESCE(
    (SELECT role IN ('admin', 'team_member') FROM auth.user_role_cache WHERE user_id = auth.uid()),
    FALSE
  );
END;
$$;

CREATE OR REPLACE FUNCTION auth.get_user_role()
RETURNS user_role
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = auth, public
AS $$
BEGIN
  RETURN (SELECT role FROM auth.user_role_cache WHERE user_id = auth.uid());
END;
$$;

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION auth.is_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.is_team_member_or_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION auth.get_user_role() TO authenticated, anon;
