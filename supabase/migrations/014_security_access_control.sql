-- =====================================================
-- SECURITY AND ACCESS CONTROL ENHANCEMENTS
-- Migration 014: Add granular permissions, secure sharing, audit logging, and encryption
-- =====================================================

-- Create permission level enum
DO $
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'permission_level') THEN
        CREATE TYPE permission_level AS ENUM ('none', 'view', 'comment', 'edit', 'admin');
        RAISE NOTICE 'Created permission_level enum';
    ELSE
        RAISE NOTICE 'permission_level enum already exists';
    END IF;
END $;

-- Create share link type enum
DO $
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'share_link_type') THEN
        CREATE TYPE share_link_type AS ENUM ('view', 'download', 'comment');
        RAISE NOTICE 'Created share_link_type enum';
    ELSE
        RAISE NOTICE 'share_link_type enum already exists';
    END IF;
END $;

-- Create audit action enum
DO $
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audit_action') THEN
        CREATE TYPE audit_action AS ENUM (
            'view', 'download', 'upload', 'edit', 'delete', 'move', 'copy', 
            'share', 'comment', 'approve', 'reject', 'lock', 'unlock',
            'permission_change', 'metadata_edit'
        );
        RAISE NOTICE 'Created audit_action enum';
    ELSE
        RAISE NOTICE 'audit_action enum already exists';
    END IF;
END $;

-- =====================================================
-- STEP 1: Create asset_permissions table for granular access control
-- =====================================================

CREATE TABLE IF NOT EXISTS asset_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  permission_level permission_level NOT NULL DEFAULT 'view',
  granted_by UUID REFERENCES users(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT check_asset_or_folder CHECK (
    (asset_id IS NOT NULL AND folder_id IS NULL) OR 
    (asset_id IS NULL AND folder_id IS NOT NULL)
  ),
  UNIQUE(asset_id, user_id),
  UNIQUE(folder_id, user_id)
);

-- Add indexes for asset_permissions
CREATE INDEX IF NOT EXISTS idx_asset_permissions_asset_id ON asset_permissions(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_permissions_folder_id ON asset_permissions(folder_id);
CREATE INDEX IF NOT EXISTS idx_asset_permissions_user_id ON asset_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_permissions_permission_level ON asset_permissions(permission_level);
CREATE INDEX IF NOT EXISTS idx_asset_permissions_expires_at ON asset_permissions(expires_at);

-- Add trigger for asset_permissions updated_at
CREATE TRIGGER update_asset_permissions_updated_at
  BEFORE UPDATE ON asset_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- STEP 2: Create secure_share_links table for time-limited sharing
-- =====================================================

CREATE TABLE IF NOT EXISTS secure_share_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'base64url'),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,
  link_type share_link_type NOT NULL DEFAULT 'view',
  password_hash TEXT, -- bcrypt hash if password protected
  max_downloads INTEGER,
  download_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  allowed_ips INET[],
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_accessed_at TIMESTAMPTZ,
  CONSTRAINT check_asset_or_folder_share CHECK (
    (asset_id IS NOT NULL AND folder_id IS NULL) OR 
    (asset_id IS NULL AND folder_id IS NOT NULL)
  )
);

-- Add indexes for secure_share_links
CREATE INDEX IF NOT EXISTS idx_secure_share_links_token ON secure_share_links(token);
CREATE INDEX IF NOT EXISTS idx_secure_share_links_asset_id ON secure_share_links(asset_id);
CREATE INDEX IF NOT EXISTS idx_secure_share_links_folder_id ON secure_share_links(folder_id);
CREATE INDEX IF NOT EXISTS idx_secure_share_links_created_by ON secure_share_links(created_by);
CREATE INDEX IF NOT EXISTS idx_secure_share_links_expires_at ON secure_share_links(expires_at);
CREATE INDEX IF NOT EXISTS idx_secure_share_links_is_active ON secure_share_links(is_active);

-- =====================================================
-- STEP 3: Create audit_logs table for comprehensive activity tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  folder_id UUID REFERENCES folders(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  action audit_action NOT NULL,
  resource_type TEXT NOT NULL, -- 'asset', 'folder', 'project'
  resource_id UUID NOT NULL,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_asset_id ON audit_logs(asset_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_folder_id ON audit_logs(folder_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_project_id ON audit_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON audit_logs(ip_address);

-- =====================================================
-- STEP 4: Create asset_encryption table for sensitive file encryption
-- =====================================================

CREATE TABLE IF NOT EXISTS asset_encryption (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID UNIQUE REFERENCES assets(id) ON DELETE CASCADE,
  encryption_key_id TEXT NOT NULL, -- Reference to external key management
  algorithm TEXT NOT NULL DEFAULT 'AES-256-GCM',
  iv TEXT NOT NULL, -- Initialization vector
  encrypted_metadata JSONB, -- Encrypted sensitive metadata
  is_encrypted BOOLEAN DEFAULT TRUE,
  encrypted_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for asset_encryption
CREATE INDEX IF NOT EXISTS idx_asset_encryption_asset_id ON asset_encryption(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_encryption_key_id ON asset_encryption(encryption_key_id);
CREATE INDEX IF NOT EXISTS idx_asset_encryption_encrypted_by ON asset_encryption(encrypted_by);

-- Add trigger for asset_encryption updated_at
CREATE TRIGGER update_asset_encryption_updated_at
  BEFORE UPDATE ON asset_encryption
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- STEP 5: Create security_scans table for file security scanning
-- =====================================================

CREATE TABLE IF NOT EXISTS security_scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  scan_type TEXT NOT NULL, -- 'virus', 'malware', 'content_policy'
  scanner_name TEXT NOT NULL, -- 'clamav', 'virustotal', 'custom'
  scan_status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'scanning', 'clean', 'infected', 'error'
  threat_level TEXT, -- 'low', 'medium', 'high', 'critical'
  threats_found TEXT[],
  scan_results JSONB DEFAULT '{}'::jsonb,
  scan_duration_ms INTEGER,
  scanned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for security_scans
CREATE INDEX IF NOT EXISTS idx_security_scans_asset_id ON security_scans(asset_id);
CREATE INDEX IF NOT EXISTS idx_security_scans_scan_status ON security_scans(scan_status);
CREATE INDEX IF NOT EXISTS idx_security_scans_threat_level ON security_scans(threat_level);
CREATE INDEX IF NOT EXISTS idx_security_scans_created_at ON security_scans(created_at DESC);

-- =====================================================
-- STEP 6: Enable RLS on new tables
-- =====================================================

ALTER TABLE asset_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE secure_share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_encryption ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_scans ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 7: Create RLS policies
-- =====================================================

-- Asset permissions policies
CREATE POLICY "Admins can manage all permissions" ON asset_permissions
  FOR ALL USING (public.is_admin());

CREATE POLICY "Users can view permissions for accessible resources" ON asset_permissions
  FOR SELECT USING (
    user_id = auth.uid() OR
    (asset_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM assets a
      WHERE a.id = asset_permissions.asset_id
      AND (
        auth.uid() IN (
          SELECT user_id FROM project_members WHERE project_id = a.project_id
        )
        OR EXISTS (SELECT 1 FROM projects WHERE id = a.project_id AND client_id = auth.uid())
        OR public.is_admin()
      )
    )) OR
    (folder_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = asset_permissions.folder_id
      AND (
        auth.uid() IN (
          SELECT user_id FROM project_members WHERE project_id = f.project_id
        )
        OR public.is_admin()
      )
    ))
  );

CREATE POLICY "Project admins can manage permissions" ON asset_permissions
  FOR INSERT WITH CHECK (
    public.is_admin() OR
    (asset_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM assets a
      JOIN project_members pm ON pm.project_id = a.project_id
      WHERE a.id = asset_permissions.asset_id 
      AND pm.user_id = auth.uid() 
      AND pm.role IN ('owner', 'admin')
    )) OR
    (folder_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM folders f
      JOIN project_members pm ON pm.project_id = f.project_id
      WHERE f.id = asset_permissions.folder_id 
      AND pm.user_id = auth.uid() 
      AND pm.role IN ('owner', 'admin')
    ))
  );

-- Secure share links policies
CREATE POLICY "Users can view their own share links" ON secure_share_links
  FOR SELECT USING (created_by = auth.uid() OR public.is_admin());

CREATE POLICY "Users can create share links for accessible resources" ON secure_share_links
  FOR INSERT WITH CHECK (
    (asset_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM assets a
      WHERE a.id = secure_share_links.asset_id
      AND (
        auth.uid() IN (
          SELECT user_id FROM project_members WHERE project_id = a.project_id
        )
        OR public.is_admin()
      )
    )) OR
    (folder_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM folders f
      WHERE f.id = secure_share_links.folder_id
      AND (
        auth.uid() IN (
          SELECT user_id FROM project_members WHERE project_id = f.project_id
        )
        OR public.is_admin()
      )
    ))
  );

CREATE POLICY "Users can update their own share links" ON secure_share_links
  FOR UPDATE USING (created_by = auth.uid() OR public.is_admin());

CREATE POLICY "Users can delete their own share links" ON secure_share_links
  FOR DELETE USING (created_by = auth.uid() OR public.is_admin());

-- Audit logs policies (read-only for most users)
CREATE POLICY "Admins can view all audit logs" ON audit_logs
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Users can view audit logs for their resources" ON audit_logs
  FOR SELECT USING (
    user_id = auth.uid() OR
    (asset_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM assets a
      WHERE a.id = audit_logs.asset_id
      AND auth.uid() IN (
        SELECT user_id FROM project_members WHERE project_id = a.project_id
      )
    )) OR
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM project_members pm
      WHERE pm.project_id = audit_logs.project_id AND pm.user_id = auth.uid()
    ))
  );

CREATE POLICY "System can create audit logs" ON audit_logs
  FOR INSERT WITH CHECK (true);

-- Asset encryption policies
CREATE POLICY "Users can view encryption info for accessible assets" ON asset_encryption
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM assets a
      WHERE a.id = asset_encryption.asset_id
      AND (
        auth.uid() IN (
          SELECT user_id FROM project_members WHERE project_id = a.project_id
        )
        OR EXISTS (SELECT 1 FROM projects WHERE id = a.project_id AND client_id = auth.uid())
        OR public.is_admin()
      )
    )
  );

CREATE POLICY "Admins can manage encryption" ON asset_encryption
  FOR ALL USING (public.is_admin());

-- Security scans policies
CREATE POLICY "Users can view scan results for accessible assets" ON security_scans
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM assets a
      WHERE a.id = security_scans.asset_id
      AND (
        auth.uid() IN (
          SELECT user_id FROM project_members WHERE project_id = a.project_id
        )
        OR EXISTS (SELECT 1 FROM projects WHERE id = a.project_id AND client_id = auth.uid())
        OR public.is_admin()
      )
    )
  );

CREATE POLICY "System can create security scans" ON security_scans
  FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update security scans" ON security_scans
  FOR UPDATE USING (true);

-- =====================================================
-- STEP 8: Create security helper functions
-- =====================================================

-- Function to check user permission for asset
CREATE OR REPLACE FUNCTION check_asset_permission(
  p_asset_id UUID,
  p_user_id UUID DEFAULT auth.uid(),
  p_required_permission permission_level DEFAULT 'view'
)
RETURNS BOOLEAN AS $
DECLARE
  v_project_permission BOOLEAN := FALSE;
  v_explicit_permission permission_level;
  v_folder_permission permission_level;
BEGIN
  -- Check if user is admin
  IF public.is_admin() THEN
    RETURN TRUE;
  END IF;

  -- Check project-level access
  SELECT EXISTS (
    SELECT 1 FROM assets a
    JOIN project_members pm ON pm.project_id = a.project_id
    WHERE a.id = p_asset_id AND pm.user_id = p_user_id
  ) INTO v_project_permission;

  -- Check explicit asset permission
  SELECT permission_level INTO v_explicit_permission
  FROM asset_permissions
  WHERE asset_id = p_asset_id 
    AND user_id = p_user_id
    AND (expires_at IS NULL OR expires_at > NOW());

  -- Check folder permission (inherited)
  SELECT ap.permission_level INTO v_folder_permission
  FROM assets a
  JOIN asset_permissions ap ON ap.folder_id = a.folder_id
  WHERE a.id = p_asset_id 
    AND ap.user_id = p_user_id
    AND (ap.expires_at IS NULL OR ap.expires_at > NOW());

  -- Determine effective permission (explicit > folder > project)
  DECLARE
    v_effective_permission permission_level;
  BEGIN
    IF v_explicit_permission IS NOT NULL THEN
      v_effective_permission := v_explicit_permission;
    ELSIF v_folder_permission IS NOT NULL THEN
      v_effective_permission := v_folder_permission;
    ELSIF v_project_permission THEN
      v_effective_permission := 'edit'; -- Default project member permission
    ELSE
      v_effective_permission := 'none';
    END IF;

    -- Check if effective permission meets requirement
    RETURN CASE 
      WHEN p_required_permission = 'none' THEN TRUE
      WHEN p_required_permission = 'view' THEN v_effective_permission IN ('view', 'comment', 'edit', 'admin')
      WHEN p_required_permission = 'comment' THEN v_effective_permission IN ('comment', 'edit', 'admin')
      WHEN p_required_permission = 'edit' THEN v_effective_permission IN ('edit', 'admin')
      WHEN p_required_permission = 'admin' THEN v_effective_permission = 'admin'
      ELSE FALSE
    END;
  END;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create audit log entry
CREATE OR REPLACE FUNCTION create_audit_log(
  p_action audit_action,
  p_resource_type TEXT,
  p_resource_id UUID,
  p_old_values JSONB DEFAULT NULL,
  p_new_values JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID AS $
DECLARE
  v_audit_id UUID;
  v_project_id UUID;
  v_asset_id UUID;
  v_folder_id UUID;
BEGIN
  -- Determine related IDs based on resource type
  IF p_resource_type = 'asset' THEN
    v_asset_id := p_resource_id;
    SELECT project_id INTO v_project_id FROM assets WHERE id = p_resource_id;
  ELSIF p_resource_type = 'folder' THEN
    v_folder_id := p_resource_id;
    SELECT project_id INTO v_project_id FROM folders WHERE id = p_resource_id;
  ELSIF p_resource_type = 'project' THEN
    v_project_id := p_resource_id;
  END IF;

  INSERT INTO audit_logs (
    user_id,
    asset_id,
    folder_id,
    project_id,
    action,
    resource_type,
    resource_id,
    old_values,
    new_values,
    metadata,
    ip_address,
    user_agent
  )
  VALUES (
    auth.uid(),
    v_asset_id,
    v_folder_id,
    v_project_id,
    p_action,
    p_resource_type,
    p_resource_id,
    p_old_values,
    p_new_values,
    p_metadata,
    inet_client_addr(),
    current_setting('request.headers', true)::json->>'user-agent'
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create secure share link
CREATE OR REPLACE FUNCTION create_secure_share_link(
  p_asset_id UUID DEFAULT NULL,
  p_folder_id UUID DEFAULT NULL,
  p_link_type share_link_type DEFAULT 'view',
  p_expires_in_hours INTEGER DEFAULT 24,
  p_password TEXT DEFAULT NULL,
  p_max_downloads INTEGER DEFAULT NULL
)
RETURNS TEXT AS $
DECLARE
  v_token TEXT;
  v_password_hash TEXT;
BEGIN
  -- Generate secure token
  v_token := encode(gen_random_bytes(32), 'base64url');

  -- Hash password if provided
  IF p_password IS NOT NULL THEN
    v_password_hash := crypt(p_password, gen_salt('bf', 12));
  END IF;

  INSERT INTO secure_share_links (
    token,
    asset_id,
    folder_id,
    created_by,
    link_type,
    password_hash,
    max_downloads,
    expires_at
  )
  VALUES (
    v_token,
    p_asset_id,
    p_folder_id,
    auth.uid(),
    p_link_type,
    v_password_hash,
    p_max_downloads,
    NOW() + (p_expires_in_hours || ' hours')::INTERVAL
  );

  -- Log the share creation
  PERFORM create_audit_log(
    'share',
    CASE WHEN p_asset_id IS NOT NULL THEN 'asset' ELSE 'folder' END,
    COALESCE(p_asset_id, p_folder_id),
    NULL,
    jsonb_build_object(
      'link_type', p_link_type,
      'expires_in_hours', p_expires_in_hours,
      'has_password', p_password IS NOT NULL,
      'max_downloads', p_max_downloads
    )
  );

  RETURN v_token;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate share link access
CREATE OR REPLACE FUNCTION validate_share_link(
  p_token TEXT,
  p_password TEXT DEFAULT NULL,
  p_ip_address INET DEFAULT NULL
)
RETURNS JSONB AS $
DECLARE
  v_link RECORD;
  v_result JSONB;
BEGIN
  -- Get share link details
  SELECT * INTO v_link
  FROM secure_share_links
  WHERE token = p_token
    AND is_active = TRUE
    AND expires_at > NOW();

  IF v_link.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Link not found or expired');
  END IF;

  -- Check password if required
  IF v_link.password_hash IS NOT NULL THEN
    IF p_password IS NULL OR NOT (v_link.password_hash = crypt(p_password, v_link.password_hash)) THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Invalid password');
    END IF;
  END IF;

  -- Check IP restrictions
  IF v_link.allowed_ips IS NOT NULL AND array_length(v_link.allowed_ips, 1) > 0 THEN
    IF p_ip_address IS NULL OR NOT (p_ip_address = ANY(v_link.allowed_ips)) THEN
      RETURN jsonb_build_object('valid', false, 'error', 'IP address not allowed');
    END IF;
  END IF;

  -- Check download limit
  IF v_link.max_downloads IS NOT NULL AND v_link.download_count >= v_link.max_downloads THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Download limit exceeded');
  END IF;

  -- Update last accessed and download count if applicable
  UPDATE secure_share_links
  SET 
    last_accessed_at = NOW(),
    download_count = CASE WHEN v_link.link_type = 'download' THEN download_count + 1 ELSE download_count END
  WHERE id = v_link.id;

  -- Return success with link details
  RETURN jsonb_build_object(
    'valid', true,
    'asset_id', v_link.asset_id,
    'folder_id', v_link.folder_id,
    'link_type', v_link.link_type,
    'created_by', v_link.created_by
  );
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to initiate security scan
CREATE OR REPLACE FUNCTION initiate_security_scan(
  p_asset_id UUID,
  p_scan_type TEXT DEFAULT 'virus',
  p_scanner_name TEXT DEFAULT 'clamav'
)
RETURNS UUID AS $
DECLARE
  v_scan_id UUID;
BEGIN
  INSERT INTO security_scans (
    asset_id,
    scan_type,
    scanner_name,
    scan_status
  )
  VALUES (
    p_asset_id,
    p_scan_type,
    p_scanner_name,
    'pending'
  )
  RETURNING id INTO v_scan_id;

  -- Log the scan initiation
  PERFORM create_audit_log(
    'upload', -- Security scans are typically triggered by uploads
    'asset',
    p_asset_id,
    NULL,
    jsonb_build_object(
      'scan_id', v_scan_id,
      'scan_type', p_scan_type,
      'scanner_name', p_scanner_name
    )
  );

  RETURN v_scan_id;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up expired security data
CREATE OR REPLACE FUNCTION cleanup_security_data()
RETURNS VOID AS $
BEGIN
  -- Remove expired share links
  DELETE FROM secure_share_links WHERE expires_at < NOW();

  -- Remove expired permissions
  DELETE FROM asset_permissions WHERE expires_at IS NOT NULL AND expires_at < NOW();

  -- Archive old audit logs (keep last 90 days)
  -- In production, you might want to move these to an archive table instead
  DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';

  -- Remove old security scans (keep last 30 days)
  DELETE FROM security_scans WHERE created_at < NOW() - INTERVAL '30 days';
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION check_asset_permission(UUID, UUID, permission_level) TO authenticated;
GRANT EXECUTE ON FUNCTION create_audit_log(audit_action, TEXT, UUID, JSONB, JSONB, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION create_secure_share_link(UUID, UUID, share_link_type, INTEGER, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_share_link(TEXT, TEXT, INET) TO authenticated;
GRANT EXECUTE ON FUNCTION initiate_security_scan(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_security_data() TO authenticated;

-- =====================================================
-- STEP 9: Create triggers for automatic audit logging
-- =====================================================

-- Trigger function for asset access logging
CREATE OR REPLACE FUNCTION log_asset_access()
RETURNS TRIGGER AS $
BEGIN
  -- Log asset views (when last_accessed_at is updated)
  IF TG_OP = 'UPDATE' AND OLD.last_accessed_at IS DISTINCT FROM NEW.last_accessed_at THEN
    PERFORM create_audit_log(
      'view',
      'asset',
      NEW.id,
      NULL,
      jsonb_build_object('access_count', NEW.access_count)
    );
  END IF;

  -- Log asset modifications
  IF TG_OP = 'UPDATE' AND (
    OLD.name IS DISTINCT FROM NEW.name OR
    OLD.description IS DISTINCT FROM NEW.description OR
    OLD.tags IS DISTINCT FROM NEW.tags
  ) THEN
    PERFORM create_audit_log(
      'edit',
      'asset',
      NEW.id,
      jsonb_build_object(
        'name', OLD.name,
        'description', OLD.description,
        'tags', OLD.tags
      ),
      jsonb_build_object(
        'name', NEW.name,
        'description', NEW.description,
        'tags', NEW.tags
      )
    );
  END IF;

  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Trigger for asset audit logging
DROP TRIGGER IF EXISTS trigger_asset_audit_log ON assets;
CREATE TRIGGER trigger_asset_audit_log
  AFTER UPDATE ON assets
  FOR EACH ROW
  EXECUTE FUNCTION log_asset_access();

-- Trigger function for permission changes
CREATE OR REPLACE FUNCTION log_permission_changes()
RETURNS TRIGGER AS $
DECLARE
  v_resource_type TEXT;
  v_resource_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_resource_type := CASE WHEN NEW.asset_id IS NOT NULL THEN 'asset' ELSE 'folder' END;
    v_resource_id := COALESCE(NEW.asset_id, NEW.folder_id);
    
    PERFORM create_audit_log(
      'permission_change',
      v_resource_type,
      v_resource_id,
      NULL,
      jsonb_build_object(
        'user_id', NEW.user_id,
        'permission_level', NEW.permission_level,
        'granted_by', NEW.granted_by
      )
    );
  ELSIF TG_OP = 'UPDATE' THEN
    v_resource_type := CASE WHEN NEW.asset_id IS NOT NULL THEN 'asset' ELSE 'folder' END;
    v_resource_id := COALESCE(NEW.asset_id, NEW.folder_id);
    
    PERFORM create_audit_log(
      'permission_change',
      v_resource_type,
      v_resource_id,
      jsonb_build_object(
        'permission_level', OLD.permission_level
      ),
      jsonb_build_object(
        'permission_level', NEW.permission_level
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_resource_type := CASE WHEN OLD.asset_id IS NOT NULL THEN 'asset' ELSE 'folder' END;
    v_resource_id := COALESCE(OLD.asset_id, OLD.folder_id);
    
    PERFORM create_audit_log(
      'permission_change',
      v_resource_type,
      v_resource_id,
      jsonb_build_object(
        'user_id', OLD.user_id,
        'permission_level', OLD.permission_level
      ),
      NULL
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$ LANGUAGE plpgsql;

-- Trigger for permission audit logging
DROP TRIGGER IF EXISTS trigger_permission_audit_log ON asset_permissions;
CREATE TRIGGER trigger_permission_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON asset_permissions
  FOR EACH ROW
  EXECUTE FUNCTION log_permission_changes();

-- =====================================================
-- STEP 10: Create security cleanup job
-- =====================================================

-- Schedule cleanup job (to be run daily)
SELECT cron.schedule('cleanup-security-data', '0 2 * * *', 'SELECT cleanup_security_data();');

-- =====================================================
-- STEP 11: Verification
-- =====================================================

DO $
DECLARE
  permissions_table BOOLEAN;
  share_links_table BOOLEAN;
  audit_logs_table BOOLEAN;
  encryption_table BOOLEAN;
  scans_table BOOLEAN;
  permission_function BOOLEAN;
  audit_function BOOLEAN;
  share_function BOOLEAN;
BEGIN
  -- Check if new tables exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'asset_permissions'
  ) INTO permissions_table;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'secure_share_links'
  ) INTO share_links_table;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'audit_logs'
  ) INTO audit_logs_table;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'asset_encryption'
  ) INTO encryption_table;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'security_scans'
  ) INTO scans_table;

  -- Check if functions exist
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'check_asset_permission'
  ) INTO permission_function;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'create_audit_log'
  ) INTO audit_function;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'create_secure_share_link'
  ) INTO share_function;

  -- Report results
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SECURITY & ACCESS CONTROL VERIFICATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Asset permissions table: %', permissions_table;
  RAISE NOTICE 'Secure share links table: %', share_links_table;
  RAISE NOTICE 'Audit logs table: %', audit_logs_table;
  RAISE NOTICE 'Asset encryption table: %', encryption_table;
  RAISE NOTICE 'Security scans table: %', scans_table;
  RAISE NOTICE 'Permission function: %', permission_function;
  RAISE NOTICE 'Audit function: %', audit_function;
  RAISE NOTICE 'Share function: %', share_function;
  RAISE NOTICE '========================================';

  IF permissions_table AND share_links_table AND audit_logs_table AND encryption_table AND scans_table AND permission_function AND audit_function AND share_function THEN
    RAISE NOTICE 'SUCCESS: Security and access control schema created successfully!';
  ELSE
    RAISE WARNING 'INCOMPLETE: Some components are missing. Please review the output above.';
  END IF;
END $;