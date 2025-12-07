-- Analytics and Monitoring Schema
-- This migration adds tables for tracking asset usage, performance metrics, and system health

-- Asset usage analytics table
CREATE TABLE IF NOT EXISTS asset_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL, -- 'view', 'download', 'edit', 'share', 'comment'
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    referrer TEXT,
    duration_ms INTEGER, -- Time spent viewing/editing
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Storage usage tracking
CREATE TABLE IF NOT EXISTS storage_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    total_size_bytes BIGINT NOT NULL,
    file_count INTEGER NOT NULL,
    folder_count INTEGER NOT NULL,
    storage_quota_bytes BIGINT,
    usage_percentage DECIMAL(5,2),
    largest_file_size BIGINT,
    most_common_file_type VARCHAR(50),
    snapshot_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, snapshot_date)
);

-- Performance metrics tracking
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    metric_type VARCHAR(50) NOT NULL, -- 'upload_speed', 'search_time', 'page_load', 'api_response'
    metric_value DECIMAL(10,3) NOT NULL,
    unit VARCHAR(20) NOT NULL, -- 'ms', 'mbps', 'seconds'
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
    endpoint VARCHAR(255),
    file_size_bytes BIGINT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User activity analytics
CREATE TABLE IF NOT EXISTS user_activity_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    session_id VARCHAR(255),
    activity_type VARCHAR(50) NOT NULL, -- 'login', 'upload', 'search', 'collaboration'
    activity_count INTEGER DEFAULT 1,
    time_spent_minutes INTEGER,
    features_used TEXT[], -- Array of feature names used in session
    collaboration_score INTEGER, -- 0-100 based on team interactions
    productivity_score INTEGER, -- 0-100 based on actions completed
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System health monitoring
CREATE TABLE IF NOT EXISTS system_health_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(10,3) NOT NULL,
    threshold_warning DECIMAL(10,3),
    threshold_critical DECIMAL(10,3),
    status VARCHAR(20) DEFAULT 'normal', -- 'normal', 'warning', 'critical'
    component VARCHAR(50), -- 'database', 'storage', 'api', 'cdn'
    environment VARCHAR(20) DEFAULT 'production',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Alert configurations
CREATE TABLE IF NOT EXISTS alert_configurations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    alert_name VARCHAR(100) NOT NULL UNIQUE,
    metric_name VARCHAR(100) NOT NULL,
    condition_operator VARCHAR(10) NOT NULL, -- '>', '<', '>=', '<=', '='
    threshold_value DECIMAL(10,3) NOT NULL,
    severity VARCHAR(20) DEFAULT 'warning', -- 'info', 'warning', 'critical'
    notification_channels TEXT[], -- ['email', 'slack', 'webhook']
    is_active BOOLEAN DEFAULT true,
    cooldown_minutes INTEGER DEFAULT 60,
    last_triggered_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_asset_analytics_asset_id ON asset_analytics(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_analytics_user_id ON asset_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_analytics_project_id ON asset_analytics(project_id);
CREATE INDEX IF NOT EXISTS idx_asset_analytics_action_type ON asset_analytics(action_type);
CREATE INDEX IF NOT EXISTS idx_asset_analytics_created_at ON asset_analytics(created_at);

CREATE INDEX IF NOT EXISTS idx_storage_analytics_project_id ON storage_analytics(project_id);
CREATE INDEX IF NOT EXISTS idx_storage_analytics_snapshot_date ON storage_analytics(snapshot_date);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_type ON performance_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_created_at ON performance_metrics(created_at);

CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_project_id ON user_activity_analytics(project_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_date ON user_activity_analytics(date);

CREATE INDEX IF NOT EXISTS idx_system_health_metric_name ON system_health_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_health_status ON system_health_metrics(status);
CREATE INDEX IF NOT EXISTS idx_system_health_created_at ON system_health_metrics(created_at);

-- RLS Policies
ALTER TABLE asset_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_configurations ENABLE ROW LEVEL SECURITY;

-- Asset analytics policies
CREATE POLICY "Users can view analytics for their projects" ON asset_analytics
    FOR SELECT USING (
        project_id IN (
            SELECT p.id FROM projects p
            JOIN project_members pm ON p.id = pm.project_id
            WHERE pm.user_id = auth.uid()
        )
    );

CREATE POLICY "System can insert analytics" ON asset_analytics
    FOR INSERT WITH CHECK (true);

-- Storage analytics policies
CREATE POLICY "Users can view storage analytics for their projects" ON storage_analytics
    FOR SELECT USING (
        project_id IN (
            SELECT p.id FROM projects p
            JOIN project_members pm ON p.id = pm.project_id
            WHERE pm.user_id = auth.uid()
        )
    );

-- Performance metrics policies
CREATE POLICY "Users can view performance metrics" ON performance_metrics
    FOR SELECT USING (
        user_id = auth.uid() OR
        project_id IN (
            SELECT p.id FROM projects p
            JOIN project_members pm ON p.id = pm.project_id
            WHERE pm.user_id = auth.uid()
        )
    );

-- User activity policies
CREATE POLICY "Users can view their own activity" ON user_activity_analytics
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Project members can view project activity" ON user_activity_analytics
    FOR SELECT USING (
        project_id IN (
            SELECT p.id FROM projects p
            JOIN project_members pm ON p.id = pm.project_id
            WHERE pm.user_id = auth.uid()
        )
    );

-- System health policies (admin only)
CREATE POLICY "Admins can view system health" ON system_health_metrics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    );

-- Alert configuration policies (admin only)
CREATE POLICY "Admins can manage alerts" ON alert_configurations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
        )
    );

-- Functions for analytics aggregation
CREATE OR REPLACE FUNCTION get_asset_popularity_stats(
    p_project_id UUID DEFAULT NULL,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    asset_id UUID,
    asset_name TEXT,
    view_count BIGINT,
    download_count BIGINT,
    total_interactions BIGINT,
    unique_users BIGINT,
    avg_duration_minutes DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id as asset_id,
        a.name as asset_name,
        COUNT(CASE WHEN aa.action_type = 'view' THEN 1 END) as view_count,
        COUNT(CASE WHEN aa.action_type = 'download' THEN 1 END) as download_count,
        COUNT(*) as total_interactions,
        COUNT(DISTINCT aa.user_id) as unique_users,
        ROUND(AVG(aa.duration_ms::DECIMAL / 60000), 2) as avg_duration_minutes
    FROM assets a
    LEFT JOIN asset_analytics aa ON a.id = aa.asset_id
    WHERE 
        (p_project_id IS NULL OR a.project_id = p_project_id)
        AND aa.created_at >= NOW() - INTERVAL '1 day' * p_days
    GROUP BY a.id, a.name
    ORDER BY total_interactions DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION get_storage_usage_trends(
    p_project_id UUID DEFAULT NULL,
    p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
    snapshot_date DATE,
    total_size_gb DECIMAL,
    file_count INTEGER,
    growth_rate_percent DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH daily_stats AS (
        SELECT 
            sa.snapshot_date,
            sa.total_size_bytes::DECIMAL / (1024^3) as size_gb,
            sa.file_count,
            LAG(sa.total_size_bytes) OVER (ORDER BY sa.snapshot_date) as prev_size
        FROM storage_analytics sa
        WHERE 
            (p_project_id IS NULL OR sa.project_id = p_project_id)
            AND sa.snapshot_date >= CURRENT_DATE - INTERVAL '1 day' * p_days
        ORDER BY sa.snapshot_date
    )
    SELECT 
        ds.snapshot_date,
        ROUND(ds.size_gb, 2) as total_size_gb,
        ds.file_count,
        CASE 
            WHEN ds.prev_size IS NOT NULL AND ds.prev_size > 0 
            THEN ROUND(((ds.size_gb * (1024^3) - ds.prev_size) / ds.prev_size * 100), 2)
            ELSE 0
        END as growth_rate_percent
    FROM daily_stats ds;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update storage analytics daily
CREATE OR REPLACE FUNCTION update_storage_analytics()
RETURNS void AS $$
DECLARE
    project_record RECORD;
BEGIN
    FOR project_record IN SELECT id FROM projects LOOP
        INSERT INTO storage_analytics (
            project_id,
            total_size_bytes,
            file_count,
            folder_count,
            largest_file_size,
            most_common_file_type
        )
        SELECT 
            project_record.id,
            COALESCE(SUM(a.file_size), 0) as total_size,
            COUNT(a.id) as file_count,
            COUNT(DISTINCT f.id) as folder_count,
            COALESCE(MAX(a.file_size), 0) as largest_file,
            MODE() WITHIN GROUP (ORDER BY a.file_type) as common_type
        FROM assets a
        LEFT JOIN folders f ON a.folder_id = f.id
        WHERE a.project_id = project_record.id
        ON CONFLICT (project_id, snapshot_date) 
        DO UPDATE SET
            total_size_bytes = EXCLUDED.total_size_bytes,
            file_count = EXCLUDED.file_count,
            folder_count = EXCLUDED.folder_count,
            largest_file_size = EXCLUDED.largest_file_size,
            most_common_file_type = EXCLUDED.most_common_file_type,
            updated_at = NOW();
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;