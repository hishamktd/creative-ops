-- =====================================================
-- ENHANCED SEARCH FUNCTIONS
-- Migration 012: Add advanced search functions for better performance and features
-- =====================================================

-- Enable pg_trgm extension for similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =====================================================
-- ENHANCED SEARCH FUNCTION WITH ADVANCED FILTERING
-- =====================================================

CREATE OR REPLACE FUNCTION enhanced_search_assets(
  search_query TEXT DEFAULT NULL,
  project_ids UUID[] DEFAULT NULL,
  file_types TEXT[] DEFAULT NULL,
  tag_names TEXT[] DEFAULT NULL,
  status_filter TEXT[] DEFAULT NULL,
  uploaded_by_ids UUID[] DEFAULT NULL,
  date_start TEXT DEFAULT NULL,
  date_end TEXT DEFAULT NULL,
  size_min BIGINT DEFAULT NULL,
  size_max BIGINT DEFAULT NULL,
  sort_field TEXT DEFAULT 'relevance',
  sort_direction TEXT DEFAULT 'desc',
  limit_count INTEGER DEFAULT 50,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  asset_id UUID,
  name TEXT,
  file_type TEXT,
  project_id UUID,
  rank REAL,
  highlight TEXT
) AS $
DECLARE
  query_ts tsquery;
  sort_clause TEXT;
BEGIN
  -- Build tsquery for full-text search
  IF search_query IS NOT NULL AND search_query != '' THEN
    query_ts := plainto_tsquery('english', search_query);
  END IF;

  -- Build sort clause
  CASE sort_field
    WHEN 'name' THEN sort_clause := 'a.name ' || sort_direction;
    WHEN 'created_at' THEN sort_clause := 'a.created_at ' || sort_direction;
    WHEN 'updated_at' THEN sort_clause := 'a.updated_at ' || sort_direction;
    WHEN 'file_size' THEN sort_clause := 'a.file_size ' || sort_direction;
    WHEN 'access_count' THEN sort_clause := 'a.access_count ' || sort_direction;
    ELSE sort_clause := 'rank DESC, a.created_at DESC';
  END CASE;

  RETURN QUERY EXECUTE format('
    SELECT 
      asi.asset_id,
      a.name,
      a.file_type,
      a.project_id,
      CASE 
        WHEN $1 IS NOT NULL THEN ts_rank(asi.search_vector, $1)
        ELSE 1.0
      END as rank,
      CASE 
        WHEN $1 IS NOT NULL THEN ts_headline(''english'', asi.searchable_content, $1, ''MaxWords=10, MinWords=5'')
        ELSE NULL
      END as highlight
    FROM asset_search_index asi
    JOIN assets a ON a.id = asi.asset_id
    WHERE 
      ($1 IS NULL OR asi.search_vector @@ $1)
      AND ($2 IS NULL OR asi.project_id = ANY($2))
      AND ($3 IS NULL OR asi.file_type = ANY($3))
      AND ($4 IS NULL OR asi.tags && $4)
      AND ($5 IS NULL OR a.status::text = ANY($5))
      AND ($6 IS NULL OR a.uploaded_by = ANY($6))
      AND ($7 IS NULL OR a.created_at >= $7::timestamptz)
      AND ($8 IS NULL OR a.created_at <= $8::timestamptz)
      AND ($9 IS NULL OR a.file_size >= $9)
      AND ($10 IS NULL OR a.file_size <= $10)
      AND (
        auth.uid() IN (
          SELECT user_id FROM project_members WHERE project_id = asi.project_id
        )
        OR EXISTS (SELECT 1 FROM projects WHERE id = asi.project_id AND client_id = auth.uid())
        OR public.is_admin()
      )
    ORDER BY %s
    LIMIT $11
    OFFSET $12
  ', sort_clause)
  USING query_ts, project_ids, file_types, tag_names, status_filter, uploaded_by_ids, 
        date_start, date_end, size_min, size_max, limit_count, offset_count;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COUNT SEARCH RESULTS FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION count_search_results(
  search_query TEXT DEFAULT NULL,
  project_ids UUID[] DEFAULT NULL,
  file_types TEXT[] DEFAULT NULL,
  tag_names TEXT[] DEFAULT NULL,
  status_filter TEXT[] DEFAULT NULL,
  uploaded_by_ids UUID[] DEFAULT NULL,
  date_start TEXT DEFAULT NULL,
  date_end TEXT DEFAULT NULL,
  size_min BIGINT DEFAULT NULL,
  size_max BIGINT DEFAULT NULL
)
RETURNS INTEGER AS $
DECLARE
  query_ts tsquery;
  result_count INTEGER;
BEGIN
  -- Build tsquery for full-text search
  IF search_query IS NOT NULL AND search_query != '' THEN
    query_ts := plainto_tsquery('english', search_query);
  END IF;

  SELECT COUNT(*)::INTEGER INTO result_count
  FROM asset_search_index asi
  JOIN assets a ON a.id = asi.asset_id
  WHERE 
    (query_ts IS NULL OR asi.search_vector @@ query_ts)
    AND (project_ids IS NULL OR asi.project_id = ANY(project_ids))
    AND (file_types IS NULL OR asi.file_type = ANY(file_types))
    AND (tag_names IS NULL OR asi.tags && tag_names)
    AND (status_filter IS NULL OR a.status::text = ANY(status_filter))
    AND (uploaded_by_ids IS NULL OR a.uploaded_by = ANY(uploaded_by_ids))
    AND (date_start IS NULL OR a.created_at >= date_start::timestamptz)
    AND (date_end IS NULL OR a.created_at <= date_end::timestamptz)
    AND (size_min IS NULL OR a.file_size >= size_min)
    AND (size_max IS NULL OR a.file_size <= size_max)
    AND (
      auth.uid() IN (
        SELECT user_id FROM project_members WHERE project_id = asi.project_id
      )
      OR EXISTS (SELECT 1 FROM projects WHERE id = asi.project_id AND client_id = auth.uid())
      OR public.is_admin()
    );

  RETURN result_count;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GET SEARCH FACETS FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION get_search_facets(
  search_query TEXT DEFAULT NULL,
  project_ids UUID[] DEFAULT NULL,
  file_types TEXT[] DEFAULT NULL,
  tag_names TEXT[] DEFAULT NULL,
  status_filter TEXT[] DEFAULT NULL,
  uploaded_by_ids UUID[] DEFAULT NULL,
  date_start TEXT DEFAULT NULL,
  date_end TEXT DEFAULT NULL,
  size_min BIGINT DEFAULT NULL,
  size_max BIGINT DEFAULT NULL
)
RETURNS JSONB AS $
DECLARE
  query_ts tsquery;
  facets JSONB;
  file_type_facets JSONB;
  project_facets JSONB;
  tag_facets JSONB;
  user_facets JSONB;
  date_facets JSONB;
BEGIN
  -- Build tsquery for full-text search
  IF search_query IS NOT NULL AND search_query != '' THEN
    query_ts := plainto_tsquery('english', search_query);
  END IF;

  -- Get file type facets
  WITH file_type_counts AS (
    SELECT 
      asi.file_type,
      COUNT(*) as count
    FROM asset_search_index asi
    JOIN assets a ON a.id = asi.asset_id
    WHERE 
      (query_ts IS NULL OR asi.search_vector @@ query_ts)
      AND (project_ids IS NULL OR asi.project_id = ANY(project_ids))
      AND (tag_names IS NULL OR asi.tags && tag_names)
      AND (status_filter IS NULL OR a.status::text = ANY(status_filter))
      AND (uploaded_by_ids IS NULL OR a.uploaded_by = ANY(uploaded_by_ids))
      AND (date_start IS NULL OR a.created_at >= date_start::timestamptz)
      AND (date_end IS NULL OR a.created_at <= date_end::timestamptz)
      AND (size_min IS NULL OR a.file_size >= size_min)
      AND (size_max IS NULL OR a.file_size <= size_max)
      AND (
        auth.uid() IN (
          SELECT user_id FROM project_members WHERE project_id = asi.project_id
        )
        OR EXISTS (SELECT 1 FROM projects WHERE id = asi.project_id AND client_id = auth.uid())
        OR public.is_admin()
      )
    GROUP BY asi.file_type
    ORDER BY count DESC
  )
  SELECT jsonb_agg(jsonb_build_object('file_type', file_type, 'count', count))
  INTO file_type_facets
  FROM file_type_counts;

  -- Get project facets
  WITH project_counts AS (
    SELECT 
      p.id as project_id,
      p.name as project_name,
      COUNT(asi.asset_id) as count
    FROM projects p
    JOIN asset_search_index asi ON asi.project_id = p.id
    JOIN assets a ON a.id = asi.asset_id
    WHERE 
      (query_ts IS NULL OR asi.search_vector @@ query_ts)
      AND (file_types IS NULL OR asi.file_type = ANY(file_types))
      AND (tag_names IS NULL OR asi.tags && tag_names)
      AND (status_filter IS NULL OR a.status::text = ANY(status_filter))
      AND (uploaded_by_ids IS NULL OR a.uploaded_by = ANY(uploaded_by_ids))
      AND (date_start IS NULL OR a.created_at >= date_start::timestamptz)
      AND (date_end IS NULL OR a.created_at <= date_end::timestamptz)
      AND (size_min IS NULL OR a.file_size >= size_min)
      AND (size_max IS NULL OR a.file_size <= size_max)
      AND (
        auth.uid() IN (
          SELECT user_id FROM project_members WHERE project_id = asi.project_id
        )
        OR EXISTS (SELECT 1 FROM projects WHERE id = asi.project_id AND client_id = auth.uid())
        OR public.is_admin()
      )
    GROUP BY p.id, p.name
    HAVING COUNT(asi.asset_id) > 0
    ORDER BY count DESC
  )
  SELECT jsonb_agg(jsonb_build_object('project_id', project_id, 'project_name', project_name, 'count', count))
  INTO project_facets
  FROM project_counts;

  -- Get tag facets
  WITH tag_counts AS (
    SELECT 
      unnest(asi.tags) as tag_name,
      COUNT(*) as count
    FROM asset_search_index asi
    JOIN assets a ON a.id = asi.asset_id
    WHERE 
      (query_ts IS NULL OR asi.search_vector @@ query_ts)
      AND (project_ids IS NULL OR asi.project_id = ANY(project_ids))
      AND (file_types IS NULL OR asi.file_type = ANY(file_types))
      AND (status_filter IS NULL OR a.status::text = ANY(status_filter))
      AND (uploaded_by_ids IS NULL OR a.uploaded_by = ANY(uploaded_by_ids))
      AND (date_start IS NULL OR a.created_at >= date_start::timestamptz)
      AND (date_end IS NULL OR a.created_at <= date_end::timestamptz)
      AND (size_min IS NULL OR a.file_size >= size_min)
      AND (size_max IS NULL OR a.file_size <= size_max)
      AND (
        auth.uid() IN (
          SELECT user_id FROM project_members WHERE project_id = asi.project_id
        )
        OR EXISTS (SELECT 1 FROM projects WHERE id = asi.project_id AND client_id = auth.uid())
        OR public.is_admin()
      )
    GROUP BY tag_name
    ORDER BY count DESC
    LIMIT 20
  )
  SELECT jsonb_agg(jsonb_build_object('tag_name', tag_name, 'count', count))
  INTO tag_facets
  FROM tag_counts
  WHERE tag_name IS NOT NULL AND tag_name != '';

  -- Get user facets (uploaded by)
  WITH user_counts AS (
    SELECT 
      u.id as user_id,
      COALESCE(u.full_name, u.email) as user_name,
      COUNT(a.id) as count
    FROM users u
    JOIN assets a ON a.uploaded_by = u.id
    JOIN asset_search_index asi ON asi.asset_id = a.id
    WHERE 
      (query_ts IS NULL OR asi.search_vector @@ query_ts)
      AND (project_ids IS NULL OR asi.project_id = ANY(project_ids))
      AND (file_types IS NULL OR asi.file_type = ANY(file_types))
      AND (tag_names IS NULL OR asi.tags && tag_names)
      AND (status_filter IS NULL OR a.status::text = ANY(status_filter))
      AND (date_start IS NULL OR a.created_at >= date_start::timestamptz)
      AND (date_end IS NULL OR a.created_at <= date_end::timestamptz)
      AND (size_min IS NULL OR a.file_size >= size_min)
      AND (size_max IS NULL OR a.file_size <= size_max)
      AND (
        auth.uid() IN (
          SELECT user_id FROM project_members WHERE project_id = asi.project_id
        )
        OR EXISTS (SELECT 1 FROM projects WHERE id = asi.project_id AND client_id = auth.uid())
        OR public.is_admin()
      )
    GROUP BY u.id, u.full_name, u.email
    ORDER BY count DESC
    LIMIT 10
  )
  SELECT jsonb_agg(jsonb_build_object('user_id', user_id, 'user_name', user_name, 'count', count))
  INTO user_facets
  FROM user_counts;

  -- Build final facets object
  facets := jsonb_build_object(
    'file_types', COALESCE(file_type_facets, '[]'::jsonb),
    'projects', COALESCE(project_facets, '[]'::jsonb),
    'tags', COALESCE(tag_facets, '[]'::jsonb),
    'uploaded_by', COALESCE(user_facets, '[]'::jsonb),
    'date_ranges', '[]'::jsonb
  );

  RETURN facets;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GET SEARCH SUGGESTIONS FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION get_search_suggestions(
  search_query TEXT,
  limit_count INTEGER DEFAULT 8
)
RETURNS TEXT[] AS $
DECLARE
  suggestions TEXT[];
  asset_suggestions TEXT[];
  tag_suggestions TEXT[];
  popular_suggestions TEXT[];
BEGIN
  -- Get asset name suggestions using trigram similarity
  SELECT ARRAY_AGG(DISTINCT name ORDER BY similarity(name, search_query) DESC)
  INTO asset_suggestions
  FROM (
    SELECT name, similarity(name, search_query) as sim
    FROM assets
    WHERE similarity(name, search_query) > 0.3
       OR name ILIKE '%' || search_query || '%'
    ORDER BY sim DESC, length(name)
    LIMIT 5
  ) asset_matches;

  -- Get tag suggestions
  SELECT ARRAY_AGG(DISTINCT name ORDER BY similarity(name, search_query) DESC)
  INTO tag_suggestions
  FROM (
    SELECT name, similarity(name, search_query) as sim
    FROM tags
    WHERE similarity(name, search_query) > 0.3
       OR name ILIKE '%' || search_query || '%'
    ORDER BY sim DESC, length(name)
    LIMIT 3
  ) tag_matches;

  -- Get popular search suggestions from analytics
  SELECT ARRAY_AGG(DISTINCT query ORDER BY count DESC)
  INTO popular_suggestions
  FROM (
    SELECT query, COUNT(*) as count
    FROM search_analytics
    WHERE similarity(query, search_query) > 0.4
       OR query ILIKE '%' || search_query || '%'
    GROUP BY query
    ORDER BY count DESC, similarity(query, search_query) DESC
    LIMIT 3
  ) popular_matches;

  -- Combine all suggestions
  suggestions := ARRAY[]::TEXT[];
  
  IF asset_suggestions IS NOT NULL THEN
    suggestions := suggestions || asset_suggestions;
  END IF;
  
  IF tag_suggestions IS NOT NULL THEN
    suggestions := suggestions || tag_suggestions;
  END IF;
  
  IF popular_suggestions IS NOT NULL THEN
    suggestions := suggestions || popular_suggestions;
  END IF;

  -- Remove duplicates and limit
  SELECT ARRAY_AGG(DISTINCT suggestion)
  INTO suggestions
  FROM (
    SELECT unnest(suggestions) as suggestion
    LIMIT limit_count
  ) unique_suggestions;

  RETURN COALESCE(suggestions, ARRAY[]::TEXT[]);
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GET SEARCH ANALYTICS FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION get_search_analytics(
  user_id_filter UUID DEFAULT NULL,
  project_id_filter UUID DEFAULT NULL,
  days_back INTEGER DEFAULT 30
)
RETURNS JSONB AS $
DECLARE
  analytics JSONB;
  popular_queries JSONB;
  search_trends JSONB;
  top_clicked_assets JSONB;
BEGIN
  -- Get popular queries
  WITH query_counts AS (
    SELECT 
      query,
      COUNT(*) as count
    FROM search_analytics
    WHERE 
      timestamp >= NOW() - INTERVAL '1 day' * days_back
      AND (user_id_filter IS NULL OR user_id = user_id_filter)
      AND (project_id_filter IS NULL OR project_id = project_id_filter)
    GROUP BY query
    ORDER BY count DESC
    LIMIT 10
  )
  SELECT jsonb_agg(jsonb_build_object('query', query, 'count', count))
  INTO popular_queries
  FROM query_counts;

  -- Get search trends (daily counts)
  WITH daily_counts AS (
    SELECT 
      DATE(timestamp) as date,
      COUNT(*) as count
    FROM search_analytics
    WHERE 
      timestamp >= NOW() - INTERVAL '1 day' * days_back
      AND (user_id_filter IS NULL OR user_id = user_id_filter)
      AND (project_id_filter IS NULL OR project_id = project_id_filter)
    GROUP BY DATE(timestamp)
    ORDER BY date
  )
  SELECT jsonb_agg(jsonb_build_object('date', date, 'count', count))
  INTO search_trends
  FROM daily_counts;

  -- Get top clicked assets
  WITH asset_clicks AS (
    SELECT 
      clicked_result as asset_id,
      COUNT(*) as clicks
    FROM search_analytics
    WHERE 
      clicked_result IS NOT NULL
      AND timestamp >= NOW() - INTERVAL '1 day' * days_back
      AND (user_id_filter IS NULL OR user_id = user_id_filter)
      AND (project_id_filter IS NULL OR project_id = project_id_filter)
    GROUP BY clicked_result
    ORDER BY clicks DESC
    LIMIT 10
  )
  SELECT jsonb_agg(jsonb_build_object('asset_id', asset_id, 'clicks', clicks))
  INTO top_clicked_assets
  FROM asset_clicks;

  -- Build analytics object
  analytics := jsonb_build_object(
    'popular_queries', COALESCE(popular_queries, '[]'::jsonb),
    'search_trends', COALESCE(search_trends, '[]'::jsonb),
    'top_clicked_assets', COALESCE(top_clicked_assets, '[]'::jsonb)
  );

  RETURN analytics;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

GRANT EXECUTE ON FUNCTION enhanced_search_assets(TEXT, UUID[], TEXT[], TEXT[], TEXT[], UUID[], TEXT, TEXT, BIGINT, BIGINT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION count_search_results(TEXT, UUID[], TEXT[], TEXT[], TEXT[], UUID[], TEXT, TEXT, BIGINT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_search_facets(TEXT, UUID[], TEXT[], TEXT[], TEXT[], UUID[], TEXT, TEXT, BIGINT, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_search_suggestions(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_search_analytics(UUID, UUID, INTEGER) TO authenticated;

-- =====================================================
-- CREATE INDEXES FOR BETTER PERFORMANCE
-- =====================================================

-- Trigram indexes for similarity search
CREATE INDEX IF NOT EXISTS idx_assets_name_trgm ON assets USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_tags_name_trgm ON tags USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_search_analytics_query_trgm ON search_analytics USING gin (query gin_trgm_ops);

-- Additional performance indexes
CREATE INDEX IF NOT EXISTS idx_assets_status_created_at ON assets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_file_size_created_at ON assets(file_size, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_analytics_timestamp_user ON search_analytics(timestamp DESC, user_id);
CREATE INDEX IF NOT EXISTS idx_search_analytics_clicked_result ON search_analytics(clicked_result) WHERE clicked_result IS NOT NULL;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $
DECLARE
  enhanced_search_fn BOOLEAN;
  count_results_fn BOOLEAN;
  facets_fn BOOLEAN;
  suggestions_fn BOOLEAN;
  analytics_fn BOOLEAN;
BEGIN
  -- Check if functions exist
  SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'enhanced_search_assets') INTO enhanced_search_fn;
  SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'count_search_results') INTO count_results_fn;
  SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_search_facets') INTO facets_fn;
  SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_search_suggestions') INTO suggestions_fn;
  SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_search_analytics') INTO analytics_fn;

  RAISE NOTICE '========================================';
  RAISE NOTICE 'ENHANCED SEARCH FUNCTIONS VERIFICATION';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Enhanced search function: %', enhanced_search_fn;
  RAISE NOTICE 'Count results function: %', count_results_fn;
  RAISE NOTICE 'Facets function: %', facets_fn;
  RAISE NOTICE 'Suggestions function: %', suggestions_fn;
  RAISE NOTICE 'Analytics function: %', analytics_fn;
  RAISE NOTICE '========================================';

  IF enhanced_search_fn AND count_results_fn AND facets_fn AND suggestions_fn AND analytics_fn THEN
    RAISE NOTICE 'SUCCESS: All enhanced search functions created successfully!';
  ELSE
    RAISE WARNING 'INCOMPLETE: Some functions are missing. Please review the output above.';
  END IF;
END $;