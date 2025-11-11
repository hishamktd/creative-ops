-- =====================================================
-- FIX: Resolve infinite recursion in users table RLS policies
-- =====================================================

-- Create helper functions with SECURITY DEFINER to bypass RLS
-- This prevents infinite recursion when checking user roles

-- Function to check if current user is admin
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if current user is team member or admin
CREATE OR REPLACE FUNCTION auth.is_team_member_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('admin', 'team_member')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to get current user's role
CREATE OR REPLACE FUNCTION auth.get_user_role()
RETURNS user_role AS $$
BEGIN
  RETURN (
    SELECT role FROM public.users
    WHERE id = auth.uid()
    LIMIT 1
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- =====================================================
-- Drop and recreate users table policies
-- =====================================================

DROP POLICY IF EXISTS "Users can view all active users" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Admins can do anything with users" ON users;

CREATE POLICY "Users can view all active users" ON users
  FOR SELECT USING (is_active = true);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can do anything with users" ON users
  FOR ALL USING (auth.is_admin());

-- =====================================================
-- Update other policies to use helper functions
-- =====================================================

-- Projects policies
DROP POLICY IF EXISTS "Users can view projects they're members of" ON projects;
DROP POLICY IF EXISTS "Team members and admins can create projects" ON projects;
DROP POLICY IF EXISTS "Project owners and admins can update projects" ON projects;
DROP POLICY IF EXISTS "Admins can delete projects" ON projects;

CREATE POLICY "Users can view projects they're members of" ON projects
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM project_members WHERE project_id = projects.id
    )
    OR created_by = auth.uid()
    OR client_id = auth.uid()
    OR auth.is_admin()
  );

CREATE POLICY "Team members and admins can create projects" ON projects
  FOR INSERT WITH CHECK (auth.is_team_member_or_admin());

CREATE POLICY "Project owners and admins can update projects" ON projects
  FOR UPDATE USING (
    created_by = auth.uid()
    OR auth.is_admin()
  );

CREATE POLICY "Admins can delete projects" ON projects
  FOR DELETE USING (auth.is_admin());

-- Project members policies
DROP POLICY IF EXISTS "Users can view project members of their projects" ON project_members;
DROP POLICY IF EXISTS "Project owners can manage members" ON project_members;

CREATE POLICY "Users can view project members of their projects" ON project_members
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM project_members pm WHERE pm.project_id = project_members.project_id
    )
    OR auth.is_admin()
  );

CREATE POLICY "Project owners can manage members" ON project_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE id = project_members.project_id
      AND created_by = auth.uid()
    )
    OR auth.is_admin()
  );

-- Tasks policies
DROP POLICY IF EXISTS "Users can view tasks in their projects" ON tasks;
DROP POLICY IF EXISTS "Team members can create tasks" ON tasks;
DROP POLICY IF EXISTS "Team members can update tasks in their projects" ON tasks;
DROP POLICY IF EXISTS "Team members can delete tasks" ON tasks;

CREATE POLICY "Users can view tasks in their projects" ON tasks
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM project_members WHERE project_id = tasks.project_id
    )
    OR EXISTS (SELECT 1 FROM projects WHERE id = tasks.project_id AND client_id = auth.uid())
    OR auth.is_admin()
  );

CREATE POLICY "Team members can create tasks" ON tasks
  FOR INSERT WITH CHECK (auth.is_team_member_or_admin());

CREATE POLICY "Team members can update tasks in their projects" ON tasks
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM project_members WHERE project_id = tasks.project_id
    )
    OR auth.is_admin()
  );

CREATE POLICY "Team members can delete tasks" ON tasks
  FOR DELETE USING (
    created_by = auth.uid()
    OR auth.is_admin()
  );

-- Subtasks policies
DROP POLICY IF EXISTS "Users can view subtasks if they can view the task" ON subtasks;
DROP POLICY IF EXISTS "Team members can manage subtasks" ON subtasks;

CREATE POLICY "Users can view subtasks if they can view the task" ON subtasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE id = subtasks.task_id
      AND (
        auth.uid() IN (
          SELECT user_id FROM project_members WHERE project_id = tasks.project_id
        )
        OR auth.is_admin()
      )
    )
  );

CREATE POLICY "Team members can manage subtasks" ON subtasks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN project_members pm ON pm.project_id = t.project_id
      WHERE t.id = subtasks.task_id AND pm.user_id = auth.uid()
    )
    OR auth.is_admin()
  );

-- Assets policies
DROP POLICY IF EXISTS "Users can view assets in their projects" ON assets;
DROP POLICY IF EXISTS "Team members can upload assets" ON assets;
DROP POLICY IF EXISTS "Uploaders and admins can update assets" ON assets;
DROP POLICY IF EXISTS "Uploaders and admins can delete assets" ON assets;

CREATE POLICY "Users can view assets in their projects" ON assets
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM project_members WHERE project_id = assets.project_id
    )
    OR EXISTS (SELECT 1 FROM projects WHERE id = assets.project_id AND client_id = auth.uid())
    OR auth.is_admin()
  );

CREATE POLICY "Team members can upload assets" ON assets
  FOR INSERT WITH CHECK (auth.is_team_member_or_admin());

CREATE POLICY "Uploaders and admins can update assets" ON assets
  FOR UPDATE USING (
    uploaded_by = auth.uid()
    OR auth.is_admin()
  );

CREATE POLICY "Uploaders and admins can delete assets" ON assets
  FOR DELETE USING (
    uploaded_by = auth.uid()
    OR auth.is_admin()
  );

-- Comments policies
DROP POLICY IF EXISTS "Users can view comments in their projects" ON comments;
DROP POLICY IF EXISTS "Users can create comments in their projects" ON comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON comments;

CREATE POLICY "Users can view comments in their projects" ON comments
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM project_members WHERE project_id = comments.project_id
    )
    OR EXISTS (SELECT 1 FROM projects WHERE id = comments.project_id AND client_id = auth.uid())
    OR auth.is_admin()
  );

CREATE POLICY "Users can create comments in their projects" ON comments
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM project_members WHERE project_id = comments.project_id
    )
    OR EXISTS (SELECT 1 FROM projects WHERE id = comments.project_id AND client_id = auth.uid())
    OR auth.is_admin()
  );

CREATE POLICY "Users can delete own comments" ON comments
  FOR DELETE USING (
    user_id = auth.uid()
    OR auth.is_admin()
  );

-- Invoices policies
DROP POLICY IF EXISTS "Users can view relevant invoices" ON invoices;
DROP POLICY IF EXISTS "Team members and admins can create invoices" ON invoices;
DROP POLICY IF EXISTS "Creators and admins can update invoices" ON invoices;
DROP POLICY IF EXISTS "Admins can delete invoices" ON invoices;

CREATE POLICY "Users can view relevant invoices" ON invoices
  FOR SELECT USING (
    client_id = auth.uid()
    OR created_by = auth.uid()
    OR auth.is_admin()
  );

CREATE POLICY "Team members and admins can create invoices" ON invoices
  FOR INSERT WITH CHECK (auth.is_team_member_or_admin());

CREATE POLICY "Creators and admins can update invoices" ON invoices
  FOR UPDATE USING (
    created_by = auth.uid()
    OR auth.is_admin()
  );

CREATE POLICY "Admins can delete invoices" ON invoices
  FOR DELETE USING (auth.is_admin());

-- Invoice items policies
DROP POLICY IF EXISTS "Users can view invoice items if they can view the invoice" ON invoice_items;
DROP POLICY IF EXISTS "Invoice creators can manage items" ON invoice_items;

CREATE POLICY "Users can view invoice items if they can view the invoice" ON invoice_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE id = invoice_items.invoice_id
      AND (
        client_id = auth.uid()
        OR created_by = auth.uid()
        OR auth.is_admin()
      )
    )
  );

CREATE POLICY "Invoice creators can manage items" ON invoice_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM invoices
      WHERE id = invoice_items.invoice_id
      AND (
        created_by = auth.uid()
        OR auth.is_admin()
      )
    )
  );

-- Badges policies
DROP POLICY IF EXISTS "Admins can manage badges" ON badges;

CREATE POLICY "Admins can manage badges" ON badges
  FOR ALL USING (auth.is_admin());

-- Folders policies
DROP POLICY IF EXISTS "Users can view folders in their projects" ON folders;
DROP POLICY IF EXISTS "Team members can manage folders" ON folders;

CREATE POLICY "Users can view folders in their projects" ON folders
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM project_members WHERE project_id = folders.project_id
    )
    OR EXISTS (SELECT 1 FROM projects WHERE id = folders.project_id AND client_id = auth.uid())
    OR auth.is_admin()
  );

CREATE POLICY "Team members can manage folders" ON folders
  FOR ALL USING (auth.is_team_member_or_admin());

-- Asset versions policies
DROP POLICY IF EXISTS "Users can view asset versions if they can view the asset" ON asset_versions;
DROP POLICY IF EXISTS "Team members can create asset versions" ON asset_versions;

CREATE POLICY "Users can view asset versions if they can view the asset" ON asset_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM assets a
      JOIN project_members pm ON pm.project_id = a.project_id
      WHERE a.id = asset_versions.asset_id AND pm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM assets a
      JOIN projects p ON p.id = a.project_id
      WHERE a.id = asset_versions.asset_id AND p.client_id = auth.uid()
    )
    OR auth.is_admin()
  );

CREATE POLICY "Team members can create asset versions" ON asset_versions
  FOR INSERT WITH CHECK (auth.is_team_member_or_admin());
