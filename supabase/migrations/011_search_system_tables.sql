-- =====================================================
-- SEARCH SYSTEM TABLES
-- Migration 011: Add saved searches and search analytics tables
-- =====================================================

-- Create saved_searches table
CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  filters JSONB NOT NULL,
  sort JSONB NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  is_smart_folder BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create search_analytics table
CREATE TABLE IF NOT EXISTS search_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query TEXT NOT NULL,
  results_count INTEGER NOT NULL,
  clicked_result UUID REFERENCES assets(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_saved_searches_user_id ON saved_searches(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_searches_created_at ON saved_searches(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_analytics_user_id ON search_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_search_analytics_timestamp ON search_analytics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_search_analytics_query ON search_analytics(query);

-- Add triggers for updated_at
CREATE TRIGGER update_saved_searches_updated_at
  BEFORE UPDATE ON saved_searches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_analytics ENABLE ROW LEVEL SECURITY;

-- RLS policies for saved_searches
CREATE POLICY "Users can manage their own saved searches" ON saved_searches
  FOR ALL USING (user_id = auth.uid());

-- RLS policies for search_analytics
CREATE POLICY "Users can view their own search analytics" ON search_analytics
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own search analytics" ON search_analytics
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Admins can view all analytics
CREATE POLICY "Admins can view all search analytics" ON search_analytics
  FOR SELECT USING (public.is_admin());

-- Grant permissions
GRANT ALL ON saved_searches TO authenticated;
GRANT ALL ON search_analytics TO authenticated;