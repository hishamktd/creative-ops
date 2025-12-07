-- Enhanced Analytics and Monitoring Schema
-- This migration adds comprehensive analytics and monitoring tables

-- Asset usage analytics table
CREATE TABLE IF NOT EXISTS asset_usage_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('view', 'download', 'edit', 'share', 'comment', 'version_create')),
    session_id VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    referrer TEXT,
    duration_seconds INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Storage usage monitoring table
CREATE TABLE IF NOT EXISTS storage_usage_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    total_storage_bytes BIGINT NOT NULL DEFAULT 0,
    file_count INTEGER NOT NULL DEFAULT 0,
    storage_by_type JSONB DEFAULT '{}', -- {"image": 1024000, "video": 2048000, ...}
    quota_limit_bytes BIGINT,
    quota_usage_percentage DECIMAL(5,2),
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance monitoring table
CREATE TABLE IF NOT EXISTS performance_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN ('upload_speed', 'search_response', 'page_load', 'api_response', 'thumbnail_generation')),
    metric_value DECIMAL(10,3) NOT NULL,
    metric_unit VARCHAR(20) NOT NULL, -- 'ms', 'mbps', 'seconds', etc.
    context JSONB DEFAULT '{}', -- Additional context like file size, user location, etc.
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User activity analytics table
CREATE TABLE IF NOT EXISTS user_activity_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN ('login', 'logout', 'upload', 'search', 'collaboration', 'folder_create', 'asset_organize')),
    activity_details JSONB DEFAULT '{}',
    session_duration_minutes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System health monitoring table
CREATE TABLE IF NOT EXISTS system_health_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,6) NOT NULL,
    metric_unit VARCHAR(20),
    status VARCHAR(20) CHECK (status IN ('healthy', 'warning', 'critical')),
    threshold_warning DECIMAL(15,6),
    threshold_critical DECIMAL(15,6),
    metadata JSONB DEFAULT '{}',
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Analytics aggregations table for pre-computed insights
CREATE TABLE IF NOT EXISTS analytics_aggregations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregation_type VARCHAR(50) NOT NULL, -- 'daily_usage', 'popular_assets', 'user_engagement', etc.
    time_period VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly'
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(aggregation_type, time_period, period_start, project_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_asset_usage_analytics_asset_id ON asset_usage_analytics(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_usage_analytics_user_id ON asset_usage_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_asset_usage_analytics_project_id ON asset_usage_analytics(project_id);
CREATE INDEX IF NOT EXISTS idx_asset_usage_analytics_created_at ON asset_usage_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_asset_usage_analytics_action_type ON asset_usage_analytics(action_type);

CREATE INDEX IF NOT EXISTS idx_storage_usage_analytics_project_id ON storage_usage_analytics(project_id);
CREATE INDEX IF NOT EXISTS idx_storage_usage_analytics_recorded_at ON storage_usage_analytics(recorded_at);

CREATE INDEX IF NOT EXISTS idx_performance_analytics_metric_type ON performance_analytics(metric_type);
CREATE INDEX IF NOT EXISTS idx_performance_analytics_recorded_at ON performance_analytics(recorded_at);

CREATE INDEX IF NOT EXISTS idx_user_activity_analytics_user_id ON user_activity_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_analytics_project_id ON user_activity_analytics(project_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_analytics_created_at ON user_activity_analytics(created_at);

CREATE INDEX IF NOT EXISTS idx_system_health_metrics_metric_name ON system_health_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_system_health_metrics_recorded_at ON system_health_metrics(recorded_at);
CREATE INDEX IF NOT EXISTS idx_system_health_metrics_status ON system_health_metrics(status);

CREATE INDEX IF NOT EXISTS idx_analytics_aggregations_type_period ON analytics_aggregations(aggregation_type, time_period);
CREATE INDEX IF NOT EXISTS idx_analytics_aggregations_project_id ON analytics_aggregations(project_id);
CREATE INDEX IF NOT EXISTS idx_analytics_aggregations_period_start ON analytics_aggregations(period_start);

-- RLS Policies
ALTER TABLE asset_usage_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE storage_usage_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_activity_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_aggregations ENABLE ROW LEVEL SECURITY;

-- Asset usage analytics policies
CREATE POLICY "Users can view analytics for their projects" ON asset_usage_analytics
    FOR SELECT USING (
        project_id IN (
            SELECT project_id FROM project_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "System can insert usage analytics" ON asset_usage_analytics
    FOR INSERT WITH CHECK (true);

-- Storage usage analytics policies
CREATE POLICY "Users can view storage analytics for their projects" ON storage_usage_analytics
    FOR SELECT USING (
        project_id IN (
            SELECT project_id FROM project_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "System can manage storage analytics" ON storage_usage_analytics
    FOR ALL USING (true);

-- Performance analytics policies (admin only for detailed metrics)
CREATE POLICY "Admins can view performance analytics" ON performance_analytics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members pm
            JOIN projects p ON p.id = pm.project_id
            WHERE pm.user_id = auth.uid() AND pm.role = 'admin'
        )
    );

CREATE POLICY "System can insert performance analytics" ON performance_analytics
    FOR INSERT WITH CHECK (true);

-- User activity analytics policies
CREATE POLICY "Users can view their own activity analytics" ON user_activity_analytics
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Project members can view project activity analytics" ON user_activity_analytics
    FOR SELECT USING (
        project_id IN (
            SELECT project_id FROM project_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "System can insert activity analytics" ON user_activity_analytics
    FOR INSERT WITH CHECK (true);

-- System health metrics policies (admin only)
CREATE POLICY "Admins can view system health metrics" ON system_health_metrics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM project_members pm
            JOIN projects p ON p.id = pm.project_id
            WHERE pm.user_id = auth.uid() AND pm.role = 'admin'
        )
    );

CREATE POLICY "System can manage health metrics" ON system_health_metrics
    FOR ALL USING (true);

-- Analytics aggregations policies
CREATE POLICY "Users can view aggregations for their projects" ON analytics_aggregations
    FOR SELECT USING (
        project_id IN (
            SELECT project_id FROM project_members 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "System can manage aggregations" ON analytics_aggregations
    FOR ALL USING (true);

-- Functions for analytics data collection
CREATE OR REPLACE FUNCTION track_asset_usage(
    p_asset_id UUID,
    p_user_id UUID,
    p_project_id UUID,
    p_action_type VARCHAR,
    p_session_id VARCHAR DEFAULT NULL,
    p_duration_seconds INTEGER DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    usage_id UUID;
BEGIN
    INSERT INTO asset_usage_analytics (
        asset_id, user_id, project_id, action_type, 
        session_id, duration_seconds, metadata
    ) VALUES (
        p_asset_id, p_user_id, p_project_id, p_action_type,
        p_session_id, p_duration_seconds, p_metadata
    ) RETURNING id INTO usage_id;
    
    RETURN usage_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update storage usage analytics
CREATE OR REPLACE FUNCTION update_storage_usage_analytics(p_project_id UUID)
RETURNS VOID AS $$
DECLARE
    total_bytes BIGINT;
    file_count INTEGER;
    storage_by_type JSONB;
BEGIN
    -- Calculate total storage and file count
    SELECT 
        COALESCE(SUM(file_size), 0),
        COUNT(*)
    INTO total_bytes, file_count
    FROM assets 
    WHERE project_id = p_project_id AND deleted_at IS NULL;
    
    -- Calculate storage by file type
    SELECT COALESCE(
        jsonb_object_agg(
            file_type, 
            total_size
        ), 
        '{}'::jsonb
    ) INTO storage_by_type
    FROM (
        SELECT 
            file_type,
            SUM(file_size) as total_size
        FROM assets 
        WHERE project_id = p_project_id AND deleted_at IS NULL
        GROUP BY file_type
    ) type_usage;
    
    -- Insert or update storage analytics
    INSERT INTO storage_usage_analytics (
        project_id, total_storage_bytes, file_count, storage_by_type
    ) VALUES (
        p_project_id, total_bytes, file_count, storage_by_type
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record performance metrics
CREATE OR REPLACE FUNCTION record_performance_metric(
    p_metric_type VARCHAR,
    p_metric_value DECIMAL,
    p_metric_unit VARCHAR,
    p_context JSONB DEFAULT '{}',
    p_user_id UUID DEFAULT NULL,
    p_project_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    metric_id UUID;
BEGIN
    INSERT INTO performance_analytics (
        metric_type, metric_value, metric_unit, context, user_id, project_id
    ) VALUES (
        p_metric_type, p_metric_value, p_metric_unit, p_context, p_user_id, p_project_id
    ) RETURNING id INTO metric_id;
    
    RETURN metric_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically update storage analytics when assets change
CREATE OR REPLACE FUNCTION trigger_update_storage_analytics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update storage analytics for the affected project
    IF TG_OP = 'INSERT' THEN
        PERFORM update_storage_usage_analytics(NEW.project_id);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        PERFORM update_storage_usage_analytics(NEW.project_id);
        IF OLD.project_id != NEW.project_id THEN
            PERFORM update_storage_usage_analytics(OLD.project_id);
        END IF;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        PERFORM update_storage_usage_analytics(OLD.project_id);
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic storage analytics updates
DROP TRIGGER IF EXISTS trigger_asset_storage_analytics ON assets;
CREATE TRIGGER trigger_asset_storage_analytics
    AFTER INSERT OR UPDATE OR DELETE ON assets
    FOR EACH ROW EXECUTE FUNCTION trigger_update_storage_analytics();