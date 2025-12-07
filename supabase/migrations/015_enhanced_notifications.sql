-- =====================================================
-- ENHANCED NOTIFICATIONS SYSTEM
-- Migration 015: Real-time notifications, activity feeds, and notification preferences
-- =====================================================

-- Create notification priority enum
DO $
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_priority') THEN
        CREATE TYPE notification_priority AS ENUM ('low', 'medium', 'high', 'urgent');
        RAISE NOTICE 'Created notification_priority enum';
    ELSE
        RAISE NOTICE 'notification_priority enum already exists';
    END IF;
END $;

-- Create notification channel enum
DO $
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_channel') THEN
        CREATE TYPE notification_channel AS ENUM ('in_app', 'email', 'push', 'sms');
        RAISE NOTICE 'Created notification_channel enum';
    ELSE
        RAISE NOTICE 'notification_channel enum already exists';
    END IF;
END $;

-- Create activity event type enum
DO $
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'activity_event_type') THEN
        CREATE TYPE activity_event_type AS ENUM (
            'asset_uploaded', 'asset_updated', 'asset_deleted', 'asset_moved',
            'asset_shared', 'asset_commented', 'asset_approved', 'asset_rejected',
            'folder_created', 'folder_updated', 'folder_deleted', 'folder_shared',
            'version_created', 'version_restored', 'permission_granted', 'permission_revoked',
            'project_created', 'project_updated', 'user_joined', 'user_left'
        );
        RAISE NOTICE 'Created activity_event_type enum';
    ELSE
        RAISE NOTICE 'activity_event_type enum already exists';
    END IF;
END $;

-- =====================================================
-- STEP 1: Enhance existing notifications table
-- =====================================================

-- Add new columns to existing notifications table
DO $
BEGIN
    -- Add priority column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'priority'
    ) THEN
        ALTER TABLE notifications ADD COLUMN priority notification_priority DEFAULT 'medium';
        RAISE NOTICE 'Added priority column to notifications table';
    END IF;

    -- Add channels column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'channels'
    ) THEN
        ALTER TABLE notifications ADD COLUMN channels notification_channel[] DEFAULT ARRAY['in_app'];
        RAISE NOTICE 'Added channels column to notifications table';
    END IF;

    -- Add metadata column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE notifications ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
        RAISE NOTICE 'Added metadata column to notifications table';
    END IF;

    -- Add action_url column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'action_url'
    ) THEN
        ALTER TABLE notifications ADD COLUMN action_url TEXT;
        RAISE NOTICE 'Added action_url column to notifications table';
    END IF;

    -- Add expires_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'expires_at'
    ) THEN
        ALTER TABLE notifications ADD COLUMN expires_at TIMESTAMPTZ;
        RAISE NOTICE 'Added expires_at column to notifications table';
    END IF;

    -- Add read_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'read_at'
    ) THEN
        ALTER TABLE notifications ADD COLUMN read_at TIMESTAMPTZ;
        RAISE NOTICE 'Added read_at column to notifications table';
    END IF;

    -- Add related resource columns if they don't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'asset_id'
    ) THEN
        ALTER TABLE notifications ADD COLUMN asset_id UUID REFERENCES assets(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added asset_id column to notifications table';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'project_id'
    ) THEN
        ALTER TABLE notifications ADD COLUMN project_id UUID REFERENCES projects(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added project_id column to notifications table';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notifications' AND column_name = 'comment_id'
    ) THEN
        ALTER TABLE notifications ADD COLUMN comment_id UUID REFERENCES comments(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added comment_id column to notifications table';
    END IF;
END $;

-- =====================================================
-- STEP 2: Create notification preferences table
-- =====================================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type activity_event_type NOT NULL,
  channels notification_channel[] NOT NULL DEFAULT ARRAY['in_app'],
  enabled BOOLEAN DEFAULT TRUE,
  frequency TEXT DEFAULT 'immediate' CHECK (frequency IN ('immediate', 'hourly', 'daily', 'weekly')),
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, event_type)
);

-- Add indexes for notification_preferences
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_event_type ON notification_preferences(event_type);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_enabled ON notification_preferences(enabled);

-- Add trigger for notification_preferences updated_at
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- STEP 3: Create activity feed table
-- =====================================================

CREATE TABLE IF NOT EXISTS activity_feed (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type activity_event_type NOT NULL,
  resource_type TEXT NOT NULL, -- 'asset', 'folder', 'project', 'comment'
  resource_id UUID NOT NULL,
  resource_name TEXT,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for activity_feed
CREATE INDEX IF NOT EXISTS idx_activity_feed_user_id ON activity_feed(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_actor_id ON activity_feed(actor_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_event_type ON activity_feed(event_type);
CREATE INDEX IF NOT EXISTS idx_activity_feed_resource_type ON activity_feed(resource_type);
CREATE INDEX IF NOT EXISTS idx_activity_feed_resource_id ON activity_feed(resource_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_project_id ON activity_feed(project_id);
CREATE INDEX IF NOT EXISTS idx_activity_feed_created_at ON activity_feed(created_at DESC);

-- =====================================================
-- STEP 4: Create notification delivery tracking table
-- =====================================================

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE,
  channel notification_channel NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
  external_id TEXT, -- ID from external service (email provider, push service, etc.)
  error_message TEXT,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for notification_deliveries
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_notification_id ON notification_deliveries(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_channel ON notification_deliveries(channel);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status ON notification_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_created_at ON notification_deliveries(created_at DESC);

-- Add trigger for notification_deliveries updated_at
CREATE TRIGGER update_notification_deliveries_updated_at
  BEFORE UPDATE ON notification_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- STEP 5: Create push notification subscriptions table
-- =====================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- Add indexes for push_subscriptions
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_is_active ON push_subscriptions(is_active);

-- Add trigger for push_subscriptions updated_at
CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- STEP 6: Enable RLS on new tables
-- =====================================================

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_feed ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 7: Create RLS policies
-- =====================================================

-- Notification preferences policies
CREATE POLICY "Users can manage their own notification preferences" ON notification_preferences
  FOR ALL USING (user_id = auth.uid());

-- Activity feed policies
CREATE POLICY "Users can view their own activity feed" ON activity_feed
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can create activity feed entries" ON activity_feed
  FOR INSERT WITH CHECK (true);

-- Notification deliveries policies (admin only)
CREATE POLICY "Admins can view notification deliveries" ON notification_deliveries
  FOR SELECT USING (public.is_admin());

CREATE POLICY "System can manage notification deliveries" ON notification_deliveries
  FOR ALL WITH CHECK (true);

-- Push subscriptions policies
CREATE POLICY "Users can manage their own push subscriptions" ON push_subscriptions
  FOR ALL USING (user_id = auth.uid());

-- =====================================================
-- STEP 8: Create notification helper functions
-- =====================================================

-- Function to create notification with activity feed entry
CREATE OR REPLACE FUNCTION create_notification_with_activity(
  p_user_ids UUID[],
  p_title TEXT,
  p_message TEXT,
  p_type notification_type DEFAULT 'info',
  p_priority notification_priority DEFAULT 'medium',
  p_event_type activity_event_type,
  p_resource_type TEXT,
  p_resource_id UUID,
  p_resource_name TEXT DEFAULT NULL,
  p_project_id UUID DEFAULT NULL,
  p_asset_id UUID DEFAULT NULL,
  p_folder_id UUID DEFAULT NULL,
  p_comment_id UUID DEFAULT NULL,
  p_action_url TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID[] AS $
DECLARE
  v_notification_ids UUID[] := '{}';
  v_notification_id UUID;
  v_user_id UUID;
  v_preferences RECORD;
  v_channels notification_channel[];
BEGIN
  -- Loop through each user
  FOREACH v_user_id IN ARRAY p_user_ids
  LOOP
    -- Get user's notification preferences for this event type
    SELECT * INTO v_preferences
    FROM notification_preferences
    WHERE user_id = v_user_id AND event_type = p_event_type;

    -- Use default channels if no preferences found
    IF v_preferences.id IS NULL THEN
      v_channels := ARRAY['in_app'];
    ELSIF NOT v_preferences.enabled THEN
      CONTINUE; -- Skip this user if notifications are disabled
    ELSE
      v_channels := v_preferences.channels;
    END IF;

    -- Create notification
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      priority,
      channels,
      action_url,
      asset_id,
      project_id,
      comment_id,
      metadata
    )
    VALUES (
      v_user_id,
      p_title,
      p_message,
      p_type,
      p_priority,
      v_channels,
      p_action_url,
      p_asset_id,
      p_project_id,
      p_comment_id,
      p_metadata
    )
    RETURNING id INTO v_notification_id;

    v_notification_ids := array_append(v_notification_ids, v_notification_id);

    -- Create activity feed entry
    INSERT INTO activity_feed (
      user_id,
      actor_id,
      event_type,
      resource_type,
      resource_id,
      resource_name,
      project_id,
      asset_id,
      folder_id,
      comment_id,
      description,
      metadata
    )
    VALUES (
      v_user_id,
      auth.uid(),
      p_event_type,
      p_resource_type,
      p_resource_id,
      p_resource_name,
      p_project_id,
      p_asset_id,
      p_folder_id,
      p_comment_id,
      p_message,
      p_metadata
    );

    -- Create delivery records for each channel
    INSERT INTO notification_deliveries (notification_id, channel)
    SELECT v_notification_id, unnest(v_channels);
  END LOOP;

  RETURN v_notification_ids;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get users who should be notified for a resource
CREATE OR REPLACE FUNCTION get_notification_recipients(
  p_resource_type TEXT,
  p_resource_id UUID,
  p_event_type activity_event_type,
  p_exclude_user_id UUID DEFAULT NULL
)
RETURNS UUID[] AS $
DECLARE
  v_user_ids UUID[] := '{}';
  v_project_id UUID;
BEGIN
  -- Get project ID based on resource type
  IF p_resource_type = 'asset' THEN
    SELECT project_id INTO v_project_id FROM assets WHERE id = p_resource_id;
  ELSIF p_resource_type = 'folder' THEN
    SELECT project_id INTO v_project_id FROM folders WHERE id = p_resource_id;
  ELSIF p_resource_type = 'project' THEN
    v_project_id := p_resource_id;
  ELSIF p_resource_type = 'comment' THEN
    SELECT project_id INTO v_project_id FROM comments WHERE id = p_resource_id;
  END IF;

  -- Get project members who should be notified
  SELECT array_agg(DISTINCT pm.user_id)
  INTO v_user_ids
  FROM project_members pm
  JOIN notification_preferences np ON np.user_id = pm.user_id
  WHERE pm.project_id = v_project_id
    AND np.event_type = p_event_type
    AND np.enabled = TRUE
    AND (p_exclude_user_id IS NULL OR pm.user_id != p_exclude_user_id);

  -- If no specific preferences found, include all project members except excluded user
  IF v_user_ids IS NULL OR array_length(v_user_ids, 1) = 0 THEN
    SELECT array_agg(DISTINCT user_id)
    INTO v_user_ids
    FROM project_members
    WHERE project_id = v_project_id
      AND (p_exclude_user_id IS NULL OR user_id != p_exclude_user_id);
  END IF;

  RETURN COALESCE(v_user_ids, '{}');
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN AS $
BEGIN
  UPDATE notifications
  SET read = TRUE, read_at = NOW()
  WHERE id = p_notification_id AND user_id = auth.uid();

  RETURN FOUND;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all notifications as read for a user
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS INTEGER AS $
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE notifications
  SET read = TRUE, read_at = NOW()
  WHERE user_id = auth.uid() AND read = FALSE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old notifications
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS VOID AS $
BEGIN
  -- Delete read notifications older than 30 days
  DELETE FROM notifications
  WHERE read = TRUE AND read_at < NOW() - INTERVAL '30 days';

  -- Delete unread notifications older than 90 days
  DELETE FROM notifications
  WHERE read = FALSE AND created_at < NOW() - INTERVAL '90 days';

  -- Delete old activity feed entries (keep last 90 days)
  DELETE FROM activity_feed
  WHERE created_at < NOW() - INTERVAL '90 days';

  -- Delete old notification deliveries (keep last 30 days)
  DELETE FROM notification_deliveries
  WHERE created_at < NOW() - INTERVAL '30 days';
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_notification_with_activity(UUID[], TEXT, TEXT, notification_type, notification_priority, activity_event_type, TEXT, UUID, TEXT, UUID, UUID, UUID, UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION get_notification_recipients(TEXT, UUID, activity_event_type, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notification_read(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_all_notifications_read() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_notifications() TO authenticated;

-- =====================================================
-- STEP 9: Create triggers for automatic notifications
-- =====================================================

-- Trigger function for asset notifications
CREATE OR REPLACE FUNCTION trigger_asset_notifications()
RETURNS TRIGGER AS $
DECLARE
  v_user_ids UUID[];
  v_event_type activity_event_type;
  v_title TEXT;
  v_message TEXT;
  v_actor_name TEXT;
BEGIN
  -- Get actor name
  SELECT full_name INTO v_actor_name FROM users WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    v_event_type := 'asset_uploaded';
    v_title := 'New Asset Uploaded';
    v_message := v_actor_name || ' uploaded "' || NEW.name || '"';
    
    -- Get recipients (exclude uploader)
    v_user_ids := get_notification_recipients('asset', NEW.id, v_event_type, auth.uid());
    
    -- Create notifications
    PERFORM create_notification_with_activity(
      v_user_ids,
      v_title,
      v_message,
      'info',
      'medium',
      v_event_type,
      'asset',
      NEW.id,
      NEW.name,
      NEW.project_id,
      NEW.id,
      NULL,
      NULL,
      '/assets/' || NEW.id,
      jsonb_build_object('file_type', NEW.file_type, 'file_size', NEW.file_size)
    );

  ELSIF TG_OP = 'UPDATE' THEN
    -- Check if name or important fields changed
    IF OLD.name IS DISTINCT FROM NEW.name OR OLD.folder_id IS DISTINCT FROM NEW.folder_id THEN
      v_event_type := 'asset_updated';
      v_title := 'Asset Updated';
      v_message := v_actor_name || ' updated "' || NEW.name || '"';
      
      v_user_ids := get_notification_recipients('asset', NEW.id, v_event_type, auth.uid());
      
      PERFORM create_notification_with_activity(
        v_user_ids,
        v_title,
        v_message,
        'info',
        'low',
        v_event_type,
        'asset',
        NEW.id,
        NEW.name,
        NEW.project_id,
        NEW.id,
        NULL,
        NULL,
        '/assets/' || NEW.id,
        jsonb_build_object(
          'old_name', OLD.name,
          'new_name', NEW.name,
          'moved', OLD.folder_id IS DISTINCT FROM NEW.folder_id
        )
      );
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    v_event_type := 'asset_deleted';
    v_title := 'Asset Deleted';
    v_message := v_actor_name || ' deleted "' || OLD.name || '"';
    
    v_user_ids := get_notification_recipients('asset', OLD.id, v_event_type, auth.uid());
    
    PERFORM create_notification_with_activity(
      v_user_ids,
      v_title,
      v_message,
      'warning',
      'medium',
      v_event_type,
      'asset',
      OLD.id,
      OLD.name,
      OLD.project_id,
      OLD.id,
      NULL,
      NULL,
      NULL,
      jsonb_build_object('file_type', OLD.file_type)
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$ LANGUAGE plpgsql;

-- Trigger function for comment notifications
CREATE OR REPLACE FUNCTION trigger_comment_notifications()
RETURNS TRIGGER AS $
DECLARE
  v_user_ids UUID[];
  v_event_type activity_event_type;
  v_title TEXT;
  v_message TEXT;
  v_actor_name TEXT;
  v_asset_name TEXT;
  v_project_id UUID;
BEGIN
  -- Get actor name
  SELECT full_name INTO v_actor_name FROM users WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    v_event_type := 'asset_commented';
    v_title := 'New Comment';
    
    -- Get asset name and project ID
    IF NEW.asset_id IS NOT NULL THEN
      SELECT name, project_id INTO v_asset_name, v_project_id FROM assets WHERE id = NEW.asset_id;
      v_message := v_actor_name || ' commented on "' || v_asset_name || '"';
    ELSE
      v_project_id := NEW.project_id;
      v_message := v_actor_name || ' added a comment';
    END IF;
    
    -- Get recipients (exclude commenter)
    v_user_ids := get_notification_recipients('comment', NEW.id, v_event_type, auth.uid());
    
    -- Create notifications
    PERFORM create_notification_with_activity(
      v_user_ids,
      v_title,
      v_message,
      'info',
      'medium',
      v_event_type,
      'comment',
      NEW.id,
      v_asset_name,
      v_project_id,
      NEW.asset_id,
      NULL,
      NEW.id,
      CASE WHEN NEW.asset_id IS NOT NULL THEN '/assets/' || NEW.asset_id ELSE NULL END,
      jsonb_build_object('comment_preview', LEFT(NEW.content, 100))
    );
  END IF;

  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_asset_notifications ON assets;
CREATE TRIGGER trigger_asset_notifications
  AFTER INSERT OR UPDATE OR DELETE ON assets
  FOR EACH ROW
  EXECUTE FUNCTION trigger_asset_notifications();

DROP TRIGGER IF EXISTS trigger_comment_notifications ON comments;
CREATE TRIGGER trigger_comment_notifications
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_comment_notifications();

-- =====================================================
-- STEP 10: Create default notification preferences
-- =====================================================

-- Function to create default notification preferences for new users
CREATE OR REPLACE FUNCTION create_default_notification_preferences(p_user_id UUID)
RETURNS VOID AS $
DECLARE
  v_event_type activity_event_type;
BEGIN
  -- Create default preferences for all event types
  FOR v_event_type IN SELECT unnest(enum_range(NULL::activity_event_type))
  LOOP
    INSERT INTO notification_preferences (user_id, event_type, channels, enabled)
    VALUES (
      p_user_id,
      v_event_type,
      CASE 
        WHEN v_event_type IN ('asset_commented', 'asset_approved', 'asset_rejected') THEN ARRAY['in_app', 'email']
        WHEN v_event_type IN ('asset_uploaded', 'version_created') THEN ARRAY['in_app']
        ELSE ARRAY['in_app']
      END,
      TRUE
    )
    ON CONFLICT (user_id, event_type) DO NOTHING;
  END LOOP;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create default preferences for new users
CREATE OR REPLACE FUNCTION trigger_create_default_preferences()
RETURNS TRIGGER AS $
BEGIN
  PERFORM create_default_notification_preferences(NEW.id);
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_default_preferences ON users;
CREATE TRIGGER trigger_create_default_preferences
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_default_preferences();

-- =====================================================
-- STEP 11: Schedule cleanup job
-- =====================================================

-- Schedule notification cleanup job (to be run daily)
SELECT cron.schedule('cleanup-notifications', '0 3 * * *', 'SELECT cleanup_old_notifications();');

-- =====================================================
-- STEP 12: Verification
-- =====================================================

DO $
DECLARE
  preferences_table BOOLEAN;
  activity_feed_table BOOLEAN;
  deliveries_table BOOLEAN;
  push_subscriptions_table BOOLEAN;
  notification_function BOOLEAN;
  recipients_function BOOLEAN;
  cleanup_function BOOLEAN;
BEGIN
  -- Check if new tables exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notification_preferences'
  ) INTO preferences_table;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'activity_feed'
  ) INTO activity_feed_table;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notification_deliveries'
  ) INTO deliveries_table;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'push_subscriptions'
  ) INTO push_subscriptions_table;

  -- Check if functions exist
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'create_notification_with_activity'
  ) INTO notification_function;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'get_notification_recipients'
  ) INTO recipients_function;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'cleanup_old_notifications'
  ) INTO cleanup_function;

  -- Report results
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ENHANCED NOTIFICATIONS VERIFICATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Notification preferences table: %', preferences_table;
  RAISE NOTICE 'Activity feed table: %', activity_feed_table;
  RAISE NOTICE 'Notification deliveries table: %', deliveries_table;
  RAISE NOTICE 'Push subscriptions table: %', push_subscriptions_table;
  RAISE NOTICE 'Notification function: %', notification_function;
  RAISE NOTICE 'Recipients function: %', recipients_function;
  RAISE NOTICE 'Cleanup function: %', cleanup_function;
  RAISE NOTICE '========================================';

  IF preferences_table AND activity_feed_table AND deliveries_table AND push_subscriptions_table AND notification_function AND recipients_function AND cleanup_function THEN
    RAISE NOTICE 'SUCCESS: Enhanced notifications schema created successfully!';
  ELSE
    RAISE WARNING 'INCOMPLETE: Some components are missing. Please review the output above.';
  END IF;
END $;