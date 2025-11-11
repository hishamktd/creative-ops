-- Check if helper functions exist
SELECT
  routine_schema,
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_name IN ('is_admin', 'is_team_member_or_admin', 'get_user_role')
  AND routine_schema = 'auth';

-- Check current policies on users table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;
