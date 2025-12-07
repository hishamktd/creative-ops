-- =====================================================
-- VERSION CONTROL AND COLLABORATION FEATURES
-- Migration 013: Add version control, comments, approvals, and presence
-- =====================================================

-- Create approval status enum
DO $
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approval_status') THEN
        CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected', 'changes_requested');
        RAISE NOTICE 'Created approval_status enum';
    ELSE
        RAISE NOTICE 'approval_status enum already exists';
    END IF;
END $;

-- Create presence status enum
DO $
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'presence_status') THEN
        CREATE TYPE presence_status AS ENUM ('viewing', 'editing', 'idle');
        RAISE NOTICE 'Created presence_status enum';
    ELSE
        RAISE NOTICE 'presence_status enum already exists';
    END IF;
END $;

-- =====================================================
-- STEP 1: Create asset_versions table for version history
-- =====================================================

CREATE TABLE IF NOT EXISTS asset_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  checksum TEXT NOT NULL,
  changes_description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asset_id, version_number)
);

-- Add indexes for asset_versions
CREATE INDEX IF NOT EXISTS idx_asset_versions_asset_id ON asset_versions(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_versions_version_number ON asset_versions(asset_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_asset_versions_uploaded_by ON asset_versions(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_asset_versions_created_at ON asset_versions(created_at DESC);

-- =====================================================
-- STEP 2: Create asset_comments table for threaded discussions
-- =====================================================

CREATE TABLE IF NOT EXISTS asset_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  version_id UUID REFERENCES asset_versions(id) ON DELETE SET NULL,
  parent_id UUID REFERENCES asset_comments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  pin_x DECIMAL(5,2), -- Percentage position for pinned comments
  pin_y DECIMAL(5,2), -- Percentage position for pinned comments
  pin_timestamp DECIMAL(10,2), -- Timestamp for video comments (seconds)
  resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for asset_comments
CREATE INDEX IF NOT EXISTS idx_asset_comments_asset_id ON asset_comments(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_comments_version_id ON asset_comments(version_id);
CREATE INDEX IF NOT EXISTS idx_asset_comments_parent_id ON asset_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_asset_comments_user_id ON asset_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_comments_created_at ON asset_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_asset_comments_resolved ON asset_comments(resolved);

-- Add trigger for asset_comments updated_at
CREATE TRIGGER update_asset_comments_updated_at
  BEFORE UPDATE ON asset_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- STEP 3: Create asset_approvals table for approval workflows
-- =====================================================

CREATE TABLE IF NOT EXISTS asset_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  version_id UUID REFERENCES asset_versions(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES users(id) ON DELETE CASCADE,
  approver_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status approval_status DEFAULT 'pending',
  feedback TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asset_id, version_id, approver_id)
);

-- Add indexes for asset_approvals
CREATE INDEX IF NOT EXISTS idx_asset_approvals_asset_id ON asset_approvals(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_approvals_version_id ON asset_approvals(version_id);
CREATE INDEX IF NOT EXISTS idx_asset_approvals_requested_by ON asset_approvals(requested_by);
CREATE INDEX IF NOT EXISTS idx_asset_approvals_approver_id ON asset_approvals(approver_id);
CREATE INDEX IF NOT EXISTS idx_asset_approvals_status ON asset_approvals(status);
CREATE INDEX IF NOT EXISTS idx_asset_approvals_created_at ON asset_approvals(created_at DESC);

-- Add trigger for asset_approvals updated_at
CREATE TRIGGER update_asset_approvals_updated_at
  BEFORE UPDATE ON asset_approvals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- STEP 4: Create asset_locks table for editing conflicts prevention
-- =====================================================

CREATE TABLE IF NOT EXISTS asset_locks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  locked_by UUID REFERENCES users(id) ON DELETE CASCADE,
  lock_type TEXT NOT NULL DEFAULT 'edit', -- 'edit', 'delete', 'move'
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asset_id, lock_type)
);

-- Add indexes for asset_locks
CREATE INDEX IF NOT EXISTS idx_asset_locks_asset_id ON asset_locks(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_locks_locked_by ON asset_locks(locked_by);
CREATE INDEX IF NOT EXISTS idx_asset_locks_expires_at ON asset_locks(expires_at);

-- =====================================================
-- STEP 5: Create asset_presence table for real-time collaboration
-- =====================================================

CREATE TABLE IF NOT EXISTS asset_presence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status presence_status DEFAULT 'viewing',
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  cursor_position JSONB, -- For tracking cursor/viewport position
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asset_id, user_id)
);

-- Add indexes for asset_presence
CREATE INDEX IF NOT EXISTS idx_asset_presence_asset_id ON asset_presence(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_presence_user_id ON asset_presence(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_presence_last_seen ON asset_presence(last_seen DESC);
CREATE INDEX IF NOT EXISTS idx_asset_presence_status ON asset_presence(status);

-- =====================================================
-- STEP 6: Create notification_events table for collaboration notifications
-- =====================================================

CREATE TABLE IF NOT EXISTS notification_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'comment', 'approval_request', 'approval_response', 'version_upload', 'mention'
  event_data JSONB DEFAULT '{}'::jsonb,
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for notification_events
CREATE INDEX IF NOT EXISTS idx_notification_events_user_id ON notification_events(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_events_asset_id ON notification_events(asset_id);
CREATE INDEX IF NOT EXISTS idx_notification_events_event_type ON notification_events(event_type);
CREATE INDEX IF NOT EXISTS idx_notification_events_read ON notification_events(read);
CREATE INDEX IF NOT EXISTS idx_notification_events_created_at ON notification_events(created_at DESC);

-- =====================================================
-- STEP 7: Enable RLS on new tables
-- =====================================================

ALTER TABLE asset_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 8: Create RLS policies
-- =====================================================

-- Asset versions policies
CREATE POLICY "Users can view versions for accessible assets" ON asset_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM assets a
      WHERE a.id = asset_versions.asset_id
      AND (
        auth.uid() IN (
          SELECT user_id FROM project_members WHERE project_id = a.project_id
        )
        OR EXISTS (SELECT 1 FROM projects WHERE id = a.project_id AND client_id = auth.uid())
        OR public.is_admin()
      )
    )
  );

CREATE POLICY "Team members can create versions" ON asset_versions
  FOR INSERT WITH CHECK (
    public.is_team_member_or_admin()
    AND EXISTS (
      SELECT 1 FROM assets a
      JOIN project_members pm ON pm.project_id = a.project_id
      WHERE a.id = asset_versions.asset_id AND pm.user_id = auth.uid()
    )
  );

-- Asset comments policies
CREATE POLICY "Users can view comments for accessible assets" ON asset_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM assets a
      WHERE a.id = asset_comments.asset_id
      AND (
        auth.uid() IN (
          SELECT user_id FROM project_members WHERE project_id = a.project_id
        )
        OR EXISTS (SELECT 1 FROM projects WHERE id = a.project_id AND client_id = auth.uid())
        OR public.is_admin()
      )
    )
  );

CREATE POLICY "Users can create comments on accessible assets" ON asset_comments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM assets a
      WHERE a.id = asset_comments.asset_id
      AND (
        auth.uid() IN (
          SELECT user_id FROM project_members WHERE project_id = a.project_id
        )
        OR EXISTS (SELECT 1 FROM projects WHERE id = a.project_id AND client_id = auth.uid())
        OR public.is_admin()
      )
    )
  );

CREATE POLICY "Users can update their own comments" ON asset_comments
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own comments or admins can delete any" ON asset_comments
  FOR DELETE USING (user_id = auth.uid() OR public.is_admin());

-- Asset approvals policies
CREATE POLICY "Users can view approvals for accessible assets" ON asset_approvals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM assets a
      WHERE a.id = asset_approvals.asset_id
      AND (
        auth.uid() IN (
          SELECT user_id FROM project_members WHERE project_id = a.project_id
        )
        OR EXISTS (SELECT 1 FROM projects WHERE id = a.project_id AND client_id = auth.uid())
        OR public.is_admin()
      )
    )
  );

CREATE POLICY "Team members can request approvals" ON asset_approvals
  FOR INSERT WITH CHECK (
    public.is_team_member_or_admin()
    AND EXISTS (
      SELECT 1 FROM assets a
      JOIN project_members pm ON pm.project_id = a.project_id
      WHERE a.id = asset_approvals.asset_id AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Approvers can update their approval status" ON asset_approvals
  FOR UPDATE USING (approver_id = auth.uid());

-- Asset locks policies
CREATE POLICY "Users can view locks for accessible assets" ON asset_locks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM assets a
      WHERE a.id = asset_locks.asset_id
      AND (
        auth.uid() IN (
          SELECT user_id FROM project_members WHERE project_id = a.project_id
        )
        OR EXISTS (SELECT 1 FROM projects WHERE id = a.project_id AND client_id = auth.uid())
        OR public.is_admin()
      )
    )
  );

CREATE POLICY "Team members can create locks" ON asset_locks
  FOR INSERT WITH CHECK (
    public.is_team_member_or_admin()
    AND EXISTS (
      SELECT 1 FROM assets a
      JOIN project_members pm ON pm.project_id = a.project_id
      WHERE a.id = asset_locks.asset_id AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Lock owners can update/delete their locks" ON asset_locks
  FOR ALL USING (locked_by = auth.uid());

-- Asset presence policies
CREATE POLICY "Users can view presence for accessible assets" ON asset_presence
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM assets a
      WHERE a.id = asset_presence.asset_id
      AND (
        auth.uid() IN (
          SELECT user_id FROM project_members WHERE project_id = a.project_id
        )
        OR EXISTS (SELECT 1 FROM projects WHERE id = a.project_id AND client_id = auth.uid())
        OR public.is_admin()
      )
    )
  );

CREATE POLICY "Users can manage their own presence" ON asset_presence
  FOR ALL USING (user_id = auth.uid());

-- Notification events policies
CREATE POLICY "Users can view their own notifications" ON notification_events
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" ON notification_events
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own notifications" ON notification_events
  FOR UPDATE USING (user_id = auth.uid());

-- =====================================================
-- STEP 9: Create helper functions
-- =====================================================

-- Function to create a new asset version
CREATE OR REPLACE FUNCTION create_asset_version(
  p_asset_id UUID,
  p_file_url TEXT,
  p_file_path TEXT,
  p_file_size BIGINT,
  p_checksum TEXT,
  p_changes_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $
DECLARE
  v_version_number INTEGER;
  v_version_id UUID;
BEGIN
  -- Get the next version number
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO v_version_number
  FROM asset_versions
  WHERE asset_id = p_asset_id;

  -- Create the version record
  INSERT INTO asset_versions (
    asset_id,
    version_number,
    file_url,
    file_path,
    file_size,
    checksum,
    changes_description,
    metadata,
    uploaded_by
  )
  VALUES (
    p_asset_id,
    v_version_number,
    p_file_url,
    p_file_path,
    p_file_size,
    p_checksum,
    p_changes_description,
    p_metadata,
    auth.uid()
  )
  RETURNING id INTO v_version_id;

  -- Update the main asset record
  UPDATE assets
  SET 
    version = v_version_number,
    file_url = p_file_url,
    file_size = p_file_size,
    checksum = p_checksum,
    updated_at = NOW()
  WHERE id = p_asset_id;

  RETURN v_version_id;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to acquire asset lock
CREATE OR REPLACE FUNCTION acquire_asset_lock(
  p_asset_id UUID,
  p_lock_type TEXT DEFAULT 'edit',
  p_duration_minutes INTEGER DEFAULT 30
)
RETURNS BOOLEAN AS $
DECLARE
  v_expires_at TIMESTAMPTZ;
  v_existing_lock RECORD;
BEGIN
  v_expires_at := NOW() + (p_duration_minutes || ' minutes')::INTERVAL;

  -- Check for existing non-expired locks
  SELECT * INTO v_existing_lock
  FROM asset_locks
  WHERE asset_id = p_asset_id
    AND lock_type = p_lock_type
    AND expires_at > NOW();

  -- If lock exists and is owned by someone else, return false
  IF v_existing_lock.id IS NOT NULL AND v_existing_lock.locked_by != auth.uid() THEN
    RETURN FALSE;
  END IF;

  -- Insert or update the lock
  INSERT INTO asset_locks (asset_id, locked_by, lock_type, expires_at)
  VALUES (p_asset_id, auth.uid(), p_lock_type, v_expires_at)
  ON CONFLICT (asset_id, lock_type)
  DO UPDATE SET
    locked_by = auth.uid(),
    expires_at = v_expires_at,
    created_at = NOW();

  RETURN TRUE;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to release asset lock
CREATE OR REPLACE FUNCTION release_asset_lock(
  p_asset_id UUID,
  p_lock_type TEXT DEFAULT 'edit'
)
RETURNS BOOLEAN AS $
BEGIN
  DELETE FROM asset_locks
  WHERE asset_id = p_asset_id
    AND lock_type = p_lock_type
    AND locked_by = auth.uid();

  RETURN FOUND;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user presence
CREATE OR REPLACE FUNCTION update_asset_presence(
  p_asset_id UUID,
  p_status presence_status DEFAULT 'viewing',
  p_cursor_position JSONB DEFAULT NULL
)
RETURNS VOID AS $
BEGIN
  INSERT INTO asset_presence (asset_id, user_id, status, cursor_position, last_seen)
  VALUES (p_asset_id, auth.uid(), p_status, p_cursor_position, NOW())
  ON CONFLICT (asset_id, user_id)
  DO UPDATE SET
    status = p_status,
    cursor_position = COALESCE(p_cursor_position, asset_presence.cursor_position),
    last_seen = NOW();
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired locks and stale presence
CREATE OR REPLACE FUNCTION cleanup_collaboration_data()
RETURNS VOID AS $
BEGIN
  -- Remove expired locks
  DELETE FROM asset_locks WHERE expires_at < NOW();

  -- Remove stale presence (older than 5 minutes)
  DELETE FROM asset_presence WHERE last_seen < NOW() - INTERVAL '5 minutes';
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_asset_id UUID,
  p_event_type TEXT,
  p_event_data JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO notification_events (user_id, asset_id, event_type, event_data)
  VALUES (p_user_id, p_asset_id, p_event_type, p_event_data)
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get asset version history
CREATE OR REPLACE FUNCTION get_asset_version_history(p_asset_id UUID)
RETURNS TABLE (
  id UUID,
  version_number INTEGER,
  file_url TEXT,
  file_size BIGINT,
  changes_description TEXT,
  uploaded_by UUID,
  uploader_name TEXT,
  created_at TIMESTAMPTZ
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    av.id,
    av.version_number,
    av.file_url,
    av.file_size,
    av.changes_description,
    av.uploaded_by,
    u.full_name as uploader_name,
    av.created_at
  FROM asset_versions av
  JOIN users u ON u.id = av.uploaded_by
  WHERE av.asset_id = p_asset_id
  ORDER BY av.version_number DESC;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_asset_version(UUID, TEXT, TEXT, BIGINT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION acquire_asset_lock(UUID, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION release_asset_lock(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_asset_presence(UUID, presence_status, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_collaboration_data() TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification(UUID, UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION get_asset_version_history(UUID) TO authenticated;

-- =====================================================
-- STEP 10: Create triggers for automatic notifications
-- =====================================================

-- Trigger function for comment notifications
CREATE OR REPLACE FUNCTION notify_comment_created()
RETURNS TRIGGER AS $
DECLARE
  v_asset_project_id UUID;
  v_commenter_name TEXT;
  v_asset_name TEXT;
  v_member RECORD;
BEGIN
  -- Get asset details
  SELECT a.project_id, a.name, u.full_name
  INTO v_asset_project_id, v_asset_name, v_commenter_name
  FROM assets a
  JOIN users u ON u.id = NEW.user_id
  WHERE a.id = NEW.asset_id;

  -- Notify all project members except the commenter
  FOR v_member IN
    SELECT pm.user_id
    FROM project_members pm
    WHERE pm.project_id = v_asset_project_id
      AND pm.user_id != NEW.user_id
  LOOP
    PERFORM create_notification(
      v_member.user_id,
      NEW.asset_id,
      'comment',
      jsonb_build_object(
        'comment_id', NEW.id,
        'commenter_name', v_commenter_name,
        'asset_name', v_asset_name,
        'content_preview', LEFT(NEW.content, 100)
      )
    );
  END LOOP;

  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Trigger for comment notifications
DROP TRIGGER IF EXISTS trigger_comment_notification ON asset_comments;
CREATE TRIGGER trigger_comment_notification
  AFTER INSERT ON asset_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_comment_created();

-- Trigger function for approval request notifications
CREATE OR REPLACE FUNCTION notify_approval_requested()
RETURNS TRIGGER AS $
DECLARE
  v_requester_name TEXT;
  v_asset_name TEXT;
BEGIN
  -- Get requester and asset details
  SELECT u.full_name, a.name
  INTO v_requester_name, v_asset_name
  FROM users u, assets a
  WHERE u.id = NEW.requested_by AND a.id = NEW.asset_id;

  -- Notify the approver
  PERFORM create_notification(
    NEW.approver_id,
    NEW.asset_id,
    'approval_request',
    jsonb_build_object(
      'approval_id', NEW.id,
      'requester_name', v_requester_name,
      'asset_name', v_asset_name,
      'version_id', NEW.version_id
    )
  );

  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Trigger for approval request notifications
DROP TRIGGER IF EXISTS trigger_approval_request_notification ON asset_approvals;
CREATE TRIGGER trigger_approval_request_notification
  AFTER INSERT ON asset_approvals
  FOR EACH ROW
  EXECUTE FUNCTION notify_approval_requested();

-- Trigger function for approval response notifications
CREATE OR REPLACE FUNCTION notify_approval_responded()
RETURNS TRIGGER AS $
DECLARE
  v_approver_name TEXT;
  v_asset_name TEXT;
BEGIN
  -- Only notify on status changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Get approver and asset details
  SELECT u.full_name, a.name
  INTO v_approver_name, v_asset_name
  FROM users u, assets a
  WHERE u.id = NEW.approver_id AND a.id = NEW.asset_id;

  -- Notify the requester
  PERFORM create_notification(
    NEW.requested_by,
    NEW.asset_id,
    'approval_response',
    jsonb_build_object(
      'approval_id', NEW.id,
      'approver_name', v_approver_name,
      'asset_name', v_asset_name,
      'status', NEW.status,
      'feedback', NEW.feedback
    )
  );

  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Trigger for approval response notifications
DROP TRIGGER IF EXISTS trigger_approval_response_notification ON asset_approvals;
CREATE TRIGGER trigger_approval_response_notification
  AFTER UPDATE ON asset_approvals
  FOR EACH ROW
  EXECUTE FUNCTION notify_approval_responded();

-- =====================================================
-- STEP 11: Create cleanup job (to be run periodically)
-- =====================================================

-- This should be called periodically by a cron job or similar
SELECT cron.schedule('cleanup-collaboration-data', '*/5 * * * *', 'SELECT cleanup_collaboration_data();');

-- =====================================================
-- STEP 12: Verification
-- =====================================================

DO $
DECLARE
  versions_table BOOLEAN;
  comments_table BOOLEAN;
  approvals_table BOOLEAN;
  locks_table BOOLEAN;
  presence_table BOOLEAN;
  notifications_table BOOLEAN;
  version_function BOOLEAN;
  lock_function BOOLEAN;
  presence_function BOOLEAN;
BEGIN
  -- Check if new tables exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'asset_versions'
  ) INTO versions_table;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'asset_comments'
  ) INTO comments_table;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'asset_approvals'
  ) INTO approvals_table;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'asset_locks'
  ) INTO locks_table;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'asset_presence'
  ) INTO presence_table;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notification_events'
  ) INTO notifications_table;

  -- Check if functions exist
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'create_asset_version'
  ) INTO version_function;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'acquire_asset_lock'
  ) INTO lock_function;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'update_asset_presence'
  ) INTO presence_function;

  -- Report results
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERSION CONTROL & COLLABORATION VERIFICATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Asset versions table: %', versions_table;
  RAISE NOTICE 'Asset comments table: %', comments_table;
  RAISE NOTICE 'Asset approvals table: %', approvals_table;
  RAISE NOTICE 'Asset locks table: %', locks_table;
  RAISE NOTICE 'Asset presence table: %', presence_table;
  RAISE NOTICE 'Notification events table: %', notifications_table;
  RAISE NOTICE 'Version function: %', version_function;
  RAISE NOTICE 'Lock function: %', lock_function;
  RAISE NOTICE 'Presence function: %', presence_function;
  RAISE NOTICE '========================================';

  IF versions_table AND comments_table AND approvals_table AND locks_table AND presence_table AND notifications_table AND version_function AND lock_function AND presence_function THEN
    RAISE NOTICE 'SUCCESS: Version control and collaboration schema created successfully!';
  ELSE
    RAISE WARNING 'INCOMPLETE: Some components are missing. Please review the output above.';
  END IF;
END $;