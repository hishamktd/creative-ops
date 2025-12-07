-- =====================================================
-- ENHANCE ASSETS SCHEMA FOR ADVANCED ASSET MANAGEMENT
-- Migration 010: Add metadata, tags, search, and access tracking
-- =====================================================

-- Create asset status enum
DO $
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'asset_status') THEN
        CREATE TYPE asset_status AS ENUM ('processing', 'ready', 'error');
        RAISE NOTICE 'Created asset_status enum';
    ELSE
        RAISE NOTICE 'asset_status enum already exists';
    END IF;
END $;

-- =====================================================
-- STEP 1: Enhance existing assets table
-- =====================================================

-- Add new fields to assets table for enhanced functionality
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS status asset_status DEFAULT 'ready',
ADD COLUMN IF NOT EXISTS preview_url TEXT,
ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_accessed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS checksum TEXT;

-- Update the updated_at trigger for assets if it doesn't exist
DROP TRIGGER IF EXISTS update_assets_updated_at ON assets;
CREATE TRIGGER update_assets_updated_at
  BEFORE UPDATE ON assets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- STEP 2: Create asset_metadata table
-- =====================================================

CREATE TABLE IF NOT EXISTS asset_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  width INTEGER,
  height INTEGER,
  duration DECIMAL(10, 2), -- in seconds for video/audio
  pages INTEGER, -- for PDFs
  color_profile TEXT,
  camera_make TEXT,
  camera_model TEXT,
  camera_settings JSONB, -- ISO, aperture, shutter speed, etc.
  extracted_text TEXT, -- OCR or PDF text extraction
  metadata_json JSONB, -- Additional flexible metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asset_id)
);

-- Add trigger for asset_metadata updated_at
CREATE TRIGGER update_asset_metadata_updated_at
  BEFORE UPDATE ON asset_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- STEP 3: Create asset_tags table for flexible tagging
-- =====================================================

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#6B7280', -- Default gray color
  description TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS asset_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  tagged_by UUID REFERENCES users(id),
  tagged_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asset_id, tag_id)
);

-- Add triggers for tags table
CREATE TRIGGER update_tags_updated_at
  BEFORE UPDATE ON tags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- STEP 4: Create asset_search_index table for full-text search
-- =====================================================

CREATE TABLE IF NOT EXISTS asset_search_index (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  searchable_content TEXT NOT NULL,
  search_vector tsvector,
  file_type TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  tags TEXT[], -- Denormalized tags for faster search
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(asset_id)
);

-- Create GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_asset_search_vector ON asset_search_index USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_asset_search_file_type ON asset_search_index(file_type);
CREATE INDEX IF NOT EXISTS idx_asset_search_project_id ON asset_search_index(project_id);
CREATE INDEX IF NOT EXISTS idx_asset_search_tags ON asset_search_index USING GIN(tags);

-- Add trigger for asset_search_index updated_at
CREATE TRIGGER update_asset_search_index_updated_at
  BEFORE UPDATE ON asset_search_index
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- STEP 5: Add performance indexes for new fields
-- =====================================================

-- Indexes for assets table new fields
CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status);
CREATE INDEX IF NOT EXISTS idx_assets_access_count ON assets(access_count DESC);
CREATE INDEX IF NOT EXISTS idx_assets_last_accessed_at ON assets(last_accessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_checksum ON assets(checksum);

-- Indexes for asset_metadata table
CREATE INDEX IF NOT EXISTS idx_asset_metadata_asset_id ON asset_metadata(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_metadata_dimensions ON asset_metadata(width, height);
CREATE INDEX IF NOT EXISTS idx_asset_metadata_duration ON asset_metadata(duration);

-- Indexes for tags and asset_tags
CREATE INDEX IF NOT EXISTS idx_tags_name ON tags(name);
CREATE INDEX IF NOT EXISTS idx_asset_tags_asset_id ON asset_tags(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_tags_tag_id ON asset_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_asset_tags_tagged_by ON asset_tags(tagged_by);

-- =====================================================
-- STEP 6: Create functions for search and metadata management
-- =====================================================

-- Function to update search index when asset changes
CREATE OR REPLACE FUNCTION update_asset_search_index()
RETURNS TRIGGER AS $
DECLARE
  search_content TEXT;
  tag_names TEXT[];
BEGIN
  -- Build searchable content from asset name, description, and metadata
  search_content := COALESCE(NEW.name, '') || ' ' || 
                   COALESCE(NEW.description, '') || ' ' ||
                   COALESCE((SELECT extracted_text FROM asset_metadata WHERE asset_id = NEW.id), '');

  -- Get tag names for this asset
  SELECT ARRAY_AGG(t.name) INTO tag_names
  FROM asset_tags at
  JOIN tags t ON t.id = at.tag_id
  WHERE at.asset_id = NEW.id;

  -- Add tags to searchable content
  IF tag_names IS NOT NULL THEN
    search_content := search_content || ' ' || array_to_string(tag_names, ' ');
  END IF;

  -- Insert or update search index
  INSERT INTO asset_search_index (
    asset_id, 
    searchable_content, 
    search_vector, 
    file_type, 
    project_id, 
    tags
  )
  VALUES (
    NEW.id,
    search_content,
    to_tsvector('english', search_content),
    NEW.file_type,
    NEW.project_id,
    COALESCE(tag_names, ARRAY[]::TEXT[])
  )
  ON CONFLICT (asset_id) DO UPDATE SET
    searchable_content = EXCLUDED.searchable_content,
    search_vector = EXCLUDED.search_vector,
    file_type = EXCLUDED.file_type,
    project_id = EXCLUDED.project_id,
    tags = EXCLUDED.tags,
    updated_at = NOW();

  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Trigger to update search index when assets change
DROP TRIGGER IF EXISTS trigger_update_asset_search_index ON assets;
CREATE TRIGGER trigger_update_asset_search_index
  AFTER INSERT OR UPDATE ON assets
  FOR EACH ROW
  EXECUTE FUNCTION update_asset_search_index();

-- Function to update search index when metadata changes
CREATE OR REPLACE FUNCTION update_search_index_on_metadata_change()
RETURNS TRIGGER AS $
BEGIN
  -- Trigger the asset search index update
  UPDATE assets SET updated_at = NOW() WHERE id = NEW.asset_id;
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- Trigger for metadata changes
DROP TRIGGER IF EXISTS trigger_metadata_search_update ON asset_metadata;
CREATE TRIGGER trigger_metadata_search_update
  AFTER INSERT OR UPDATE ON asset_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_search_index_on_metadata_change();

-- Function to update search index when tags change
CREATE OR REPLACE FUNCTION update_search_index_on_tag_change()
RETURNS TRIGGER AS $
BEGIN
  -- Update the asset to trigger search index rebuild
  IF TG_OP = 'DELETE' THEN
    UPDATE assets SET updated_at = NOW() WHERE id = OLD.asset_id;
    RETURN OLD;
  ELSE
    UPDATE assets SET updated_at = NOW() WHERE id = NEW.asset_id;
    RETURN NEW;
  END IF;
END;
$ LANGUAGE plpgsql;

-- Trigger for tag changes
DROP TRIGGER IF EXISTS trigger_tag_search_update ON asset_tags;
CREATE TRIGGER trigger_tag_search_update
  AFTER INSERT OR UPDATE OR DELETE ON asset_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_search_index_on_tag_change();

-- Function to increment access count
CREATE OR REPLACE FUNCTION increment_asset_access()
RETURNS TRIGGER AS $
BEGIN
  UPDATE assets 
  SET access_count = access_count + 1,
      last_accessed_at = NOW()
  WHERE id = NEW.asset_id;
  RETURN NEW;
END;
$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 7: Create RLS policies for new tables
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE asset_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_search_index ENABLE ROW LEVEL SECURITY;

-- Asset metadata policies
CREATE POLICY "Users can view metadata for assets they can access" ON asset_metadata
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM assets a
      WHERE a.id = asset_metadata.asset_id
      AND (
        auth.uid() IN (
          SELECT user_id FROM project_members WHERE project_id = a.project_id
        )
        OR EXISTS (SELECT 1 FROM projects WHERE id = a.project_id AND client_id = auth.uid())
        OR public.is_admin()
      )
    )
  );

CREATE POLICY "Team members can manage asset metadata" ON asset_metadata
  FOR ALL USING (
    public.is_team_member_or_admin()
    AND EXISTS (
      SELECT 1 FROM assets a
      JOIN project_members pm ON pm.project_id = a.project_id
      WHERE a.id = asset_metadata.asset_id AND pm.user_id = auth.uid()
    )
  );

-- Tags policies
CREATE POLICY "Everyone can view tags" ON tags
  FOR SELECT USING (true);

CREATE POLICY "Team members can create tags" ON tags
  FOR INSERT WITH CHECK (public.is_team_member_or_admin());

CREATE POLICY "Tag creators and admins can update tags" ON tags
  FOR UPDATE USING (
    created_by = auth.uid() OR public.is_admin()
  );

CREATE POLICY "Tag creators and admins can delete tags" ON tags
  FOR DELETE USING (
    created_by = auth.uid() OR public.is_admin()
  );

-- Asset tags policies
CREATE POLICY "Users can view asset tags for accessible assets" ON asset_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM assets a
      WHERE a.id = asset_tags.asset_id
      AND (
        auth.uid() IN (
          SELECT user_id FROM project_members WHERE project_id = a.project_id
        )
        OR EXISTS (SELECT 1 FROM projects WHERE id = a.project_id AND client_id = auth.uid())
        OR public.is_admin()
      )
    )
  );

CREATE POLICY "Team members can manage asset tags" ON asset_tags
  FOR ALL USING (
    public.is_team_member_or_admin()
    AND EXISTS (
      SELECT 1 FROM assets a
      JOIN project_members pm ON pm.project_id = a.project_id
      WHERE a.id = asset_tags.asset_id AND pm.user_id = auth.uid()
    )
  );

-- Asset search index policies
CREATE POLICY "Users can search assets they can access" ON asset_search_index
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM project_members WHERE project_id = asset_search_index.project_id
    )
    OR EXISTS (SELECT 1 FROM projects WHERE id = asset_search_index.project_id AND client_id = auth.uid())
    OR public.is_admin()
  );

-- =====================================================
-- STEP 8: Create helper functions for asset management
-- =====================================================

-- Function to search assets with full-text search
CREATE OR REPLACE FUNCTION search_assets(
  search_query TEXT,
  project_ids UUID[] DEFAULT NULL,
  file_types TEXT[] DEFAULT NULL,
  tag_names TEXT[] DEFAULT NULL,
  limit_count INTEGER DEFAULT 50,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  asset_id UUID,
  name TEXT,
  file_type TEXT,
  project_id UUID,
  rank REAL
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    asi.asset_id,
    a.name,
    a.file_type,
    a.project_id,
    ts_rank(asi.search_vector, plainto_tsquery('english', search_query)) as rank
  FROM asset_search_index asi
  JOIN assets a ON a.id = asi.asset_id
  WHERE 
    (search_query IS NULL OR asi.search_vector @@ plainto_tsquery('english', search_query))
    AND (project_ids IS NULL OR asi.project_id = ANY(project_ids))
    AND (file_types IS NULL OR asi.file_type = ANY(file_types))
    AND (tag_names IS NULL OR asi.tags && tag_names)
    AND (
      auth.uid() IN (
        SELECT user_id FROM project_members WHERE project_id = asi.project_id
      )
      OR EXISTS (SELECT 1 FROM projects WHERE id = asi.project_id AND client_id = auth.uid())
      OR public.is_admin()
    )
  ORDER BY rank DESC, a.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get asset with full metadata
CREATE OR REPLACE FUNCTION get_asset_with_metadata(asset_uuid UUID)
RETURNS TABLE (
  id UUID,
  project_id UUID,
  folder_id UUID,
  name TEXT,
  description TEXT,
  file_url TEXT,
  file_type TEXT,
  file_size BIGINT,
  version INTEGER,
  thumbnail_url TEXT,
  preview_url TEXT,
  status asset_status,
  access_count INTEGER,
  last_accessed_at TIMESTAMPTZ,
  checksum TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  metadata JSONB,
  tags JSONB
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.project_id,
    a.folder_id,
    a.name,
    a.description,
    a.file_url,
    a.file_type,
    a.file_size,
    a.version,
    a.thumbnail_url,
    a.preview_url,
    a.status,
    a.access_count,
    a.last_accessed_at,
    a.checksum,
    a.uploaded_by,
    a.created_at,
    a.updated_at,
    COALESCE(
      jsonb_build_object(
        'width', am.width,
        'height', am.height,
        'duration', am.duration,
        'pages', am.pages,
        'color_profile', am.color_profile,
        'camera_make', am.camera_make,
        'camera_model', am.camera_model,
        'camera_settings', am.camera_settings,
        'extracted_text', am.extracted_text,
        'metadata_json', am.metadata_json
      ),
      '{}'::jsonb
    ) as metadata,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', t.id,
            'name', t.name,
            'color', t.color,
            'description', t.description
          )
        )
        FROM asset_tags at
        JOIN tags t ON t.id = at.tag_id
        WHERE at.asset_id = a.id
      ),
      '[]'::jsonb
    ) as tags
  FROM assets a
  LEFT JOIN asset_metadata am ON am.asset_id = a.id
  WHERE a.id = asset_uuid
    AND (
      auth.uid() IN (
        SELECT user_id FROM project_members WHERE project_id = a.project_id
      )
      OR EXISTS (SELECT 1 FROM projects WHERE id = a.project_id AND client_id = auth.uid())
      OR public.is_admin()
    );
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get multiple assets with metadata
CREATE OR REPLACE FUNCTION get_assets_with_metadata(asset_ids UUID[])
RETURNS TABLE (
  id UUID,
  project_id UUID,
  folder_id UUID,
  name TEXT,
  description TEXT,
  file_url TEXT,
  file_type TEXT,
  file_size BIGINT,
  version INTEGER,
  thumbnail_url TEXT,
  preview_url TEXT,
  status asset_status,
  access_count INTEGER,
  last_accessed_at TIMESTAMPTZ,
  checksum TEXT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  metadata JSONB,
  tags JSONB
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.project_id,
    a.folder_id,
    a.name,
    a.description,
    a.file_url,
    a.file_type,
    a.file_size,
    a.version,
    a.thumbnail_url,
    a.preview_url,
    a.status,
    a.access_count,
    a.last_accessed_at,
    a.checksum,
    a.uploaded_by,
    a.created_at,
    a.updated_at,
    COALESCE(
      jsonb_build_object(
        'width', am.width,
        'height', am.height,
        'duration', am.duration,
        'pages', am.pages,
        'color_profile', am.color_profile,
        'camera_make', am.camera_make,
        'camera_model', am.camera_model,
        'camera_settings', am.camera_settings,
        'extracted_text', am.extracted_text,
        'metadata_json', am.metadata_json
      ),
      '{}'::jsonb
    ) as metadata,
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'id', t.id,
            'name', t.name,
            'color', t.color,
            'description', t.description
          )
        )
        FROM asset_tags at
        JOIN tags t ON t.id = at.tag_id
        WHERE at.asset_id = a.id
      ),
      '[]'::jsonb
    ) as tags
  FROM assets a
  LEFT JOIN asset_metadata am ON am.asset_id = a.id
  WHERE a.id = ANY(asset_ids)
    AND (
      auth.uid() IN (
        SELECT user_id FROM project_members WHERE project_id = a.project_id
      )
      OR EXISTS (SELECT 1 FROM projects WHERE id = a.project_id AND client_id = auth.uid())
      OR public.is_admin()
    );
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION search_assets(TEXT, UUID[], TEXT[], TEXT[], INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_asset_with_metadata(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_assets_with_metadata(UUID[]) TO authenticated;

-- =====================================================
-- STEP 9: Migrate existing data
-- =====================================================

-- Create search index entries for existing assets
INSERT INTO asset_search_index (asset_id, searchable_content, search_vector, file_type, project_id, tags)
SELECT 
  a.id,
  COALESCE(a.name, ''),
  to_tsvector('english', COALESCE(a.name, '')),
  a.file_type,
  a.project_id,
  ARRAY[]::TEXT[]
FROM assets a
WHERE NOT EXISTS (
  SELECT 1 FROM asset_search_index WHERE asset_id = a.id
);

-- =====================================================
-- STEP 10: Verification
-- =====================================================

DO $
DECLARE
  assets_enhanced BOOLEAN;
  metadata_table BOOLEAN;
  tags_table BOOLEAN;
  asset_tags_table BOOLEAN;
  search_index_table BOOLEAN;
  search_function BOOLEAN;
  metadata_function BOOLEAN;
BEGIN
  -- Check if assets table has new columns
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'status'
  ) INTO assets_enhanced;

  -- Check if new tables exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'asset_metadata'
  ) INTO metadata_table;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tags'
  ) INTO tags_table;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'asset_tags'
  ) INTO asset_tags_table;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'asset_search_index'
  ) INTO search_index_table;

  -- Check if functions exist
  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'search_assets'
  ) INTO search_function;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'get_asset_with_metadata'
  ) INTO metadata_function;

  -- Report results
  RAISE NOTICE '========================================';
  RAISE NOTICE 'ENHANCED ASSETS SCHEMA VERIFICATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Assets table enhanced: %', assets_enhanced;
  RAISE NOTICE 'Asset metadata table: %', metadata_table;
  RAISE NOTICE 'Tags table: %', tags_table;
  RAISE NOTICE 'Asset tags table: %', asset_tags_table;
  RAISE NOTICE 'Search index table: %', search_index_table;
  RAISE NOTICE 'Search function: %', search_function;
  RAISE NOTICE 'Metadata function: %', metadata_function;
  RAISE NOTICE '========================================';

  IF assets_enhanced AND metadata_table AND tags_table AND asset_tags_table AND search_index_table AND search_function AND metadata_function THEN
    RAISE NOTICE 'SUCCESS: Enhanced assets schema created successfully!';
  ELSE
    RAISE WARNING 'INCOMPLETE: Some components are missing. Please review the output above.';
  END IF;
END $;