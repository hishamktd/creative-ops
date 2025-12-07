import { createClient } from '@/lib/supabase/client'
import { Database } from '@/types/database'

type SupabaseClient = ReturnType<typeof createClient>

export interface AssetUsageMetrics {
  totalViews: number
  totalDownloads: number
  uniqueUsers: number
  averageSessionDuration: number
  popularAssets: Array<{
    id: string
    name: string
    views: number
    downloads: number
  }>
  accessPatterns: Array<{
    hour: number
    count: number
  }>
}

export interface StorageUsageMetrics {
  totalStorage: number
  fileCount: number
  storageByType: Record<string, number>
  quotaUsage: number
  quotaLimit: number
  growthTrend: Array<{
    date: string
    storage: number
    fileCount: number
  }>
}

export interface PerformanceMetrics {
  averageUploadSpeed: number
  averageSearchResponseTime: number
  averagePageLoadTime: number
  systemResponseTime: number
  thumbnailGenerationTime: number
  performanceTrends: Array<{
    date: string
    metric: string
    value: number
  }>
}

export interface UserActivityMetrics {
  activeUsers: number
  totalSessions: number
  averageSessionDuration: number
  collaborationEvents: number
  userEngagement: Array<{
    userId: string
    userName: string
    activityCount: number
    lastActive: string
  }>
  activityByType: Record<string, number>
}

export interface SystemHealthMetrics {
  overallStatus: 'healthy' | 'warning' | 'critical'
  uptime: number
  errorRate: number
  responseTime: number
  storageHealth: 'healthy' | 'warning' | 'critical'
  databaseHealth: 'healthy' | 'warning' | 'critical'
  alerts: Array<{
    id: string
    severity: 'warning' | 'critical'
    message: string
    timestamp: string
  }>
}

export class AnalyticsService {
  private supabase: SupabaseClient

  constructor() {
    this.supabase = createClient()
  }

  // Asset Usage Analytics
  async trackAssetUsage(params: {
    assetId: string
    userId: string
    projectId: string
    actionType: 'view' | 'download' | 'edit' | 'share' | 'comment' | 'version_create'
    sessionId?: string
    durationSeconds?: number
    metadata?: Record<string, any>
  }) {
    try {
      const { data, error } = await this.supabase.rpc('track_asset_usage', {
        p_asset_id: params.assetId,
        p_user_id: params.userId,
        p_project_id: params.projectId,
        p_action_type: params.actionType,
        p_session_id: params.sessionId,
        p_duration_seconds: params.durationSeconds,
        p_metadata: params.metadata || {}
      })

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error tracking asset usage:', error)
      throw error
    }
  }

  async getAssetUsageMetrics(projectId: string, timeRange: '24h' | '7d' | '30d' = '7d'): Promise<AssetUsageMetrics> {
    try {
      const timeFilter = this.getTimeFilter(timeRange)
      
      // Get total views and downloads
      const { data: totals } = await this.supabase
        .from('asset_usage_analytics')
        .select('action_type')
        .eq('project_id', projectId)
        .gte('created_at', timeFilter)

      const totalViews = totals?.filter(t => t.action_type === 'view').length || 0
      const totalDownloads = totals?.filter(t => t.action_type === 'download').length || 0

      // Get unique users
      const { data: uniqueUsersData } = await this.supabase
        .from('asset_usage_analytics')
        .select('user_id')
        .eq('project_id', projectId)
        .gte('created_at', timeFilter)

      const uniqueUsers = new Set(uniqueUsersData?.map(u => u.user_id)).size

      // Get average session duration
      const { data: sessionData } = await this.supabase
        .from('asset_usage_analytics')
        .select('duration_seconds')
        .eq('project_id', projectId)
        .gte('created_at', timeFilter)
        .not('duration_seconds', 'is', null)

      const averageSessionDuration = sessionData?.length 
        ? sessionData.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / sessionData.length
        : 0

      // Get popular assets
      const { data: popularAssetsData } = await this.supabase
        .from('asset_usage_analytics')
        .select(`
          asset_id,
          action_type,
          assets!inner(id, name)
        `)
        .eq('project_id', projectId)
        .gte('created_at', timeFilter)

      const assetStats = popularAssetsData?.reduce((acc, item) => {
        const assetId = item.asset_id
        if (!acc[assetId]) {
          acc[assetId] = {
            id: assetId,
            name: (item.assets as any).name,
            views: 0,
            downloads: 0
          }
        }
        if (item.action_type === 'view') acc[assetId].views++
        if (item.action_type === 'download') acc[assetId].downloads++
        return acc
      }, {} as Record<string, any>) || {}

      const popularAssets = Object.values(assetStats)
        .sort((a: any, b: any) => (b.views + b.downloads) - (a.views + a.downloads))
        .slice(0, 10)

      // Get access patterns by hour
      const { data: accessPatternsData } = await this.supabase
        .from('asset_usage_analytics')
        .select('created_at')
        .eq('project_id', projectId)
        .gte('created_at', timeFilter)

      const accessPatterns = Array.from({ length: 24 }, (_, hour) => ({
        hour,
        count: accessPatternsData?.filter(item => 
          new Date(item.created_at).getHours() === hour
        ).length || 0
      }))

      return {
        totalViews,
        totalDownloads,
        uniqueUsers,
        averageSessionDuration,
        popularAssets: popularAssets as any,
        accessPatterns
      }
    } catch (error) {
      console.error('Error getting asset usage metrics:', error)
      throw error
    }
  }

  // Storage Usage Analytics
  async getStorageUsageMetrics(projectId: string): Promise<StorageUsageMetrics> {
    try {
      // Get latest storage usage
      const { data: latestUsage } = await this.supabase
        .from('storage_usage_analytics')
        .select('*')
        .eq('project_id', projectId)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single()

      // Get growth trend (last 30 days)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const { data: growthData } = await this.supabase
        .from('storage_usage_analytics')
        .select('recorded_at, total_storage_bytes, file_count')
        .eq('project_id', projectId)
        .gte('recorded_at', thirtyDaysAgo.toISOString())
        .order('recorded_at', { ascending: true })

      const growthTrend = growthData?.map(item => ({
        date: item.recorded_at.split('T')[0],
        storage: item.total_storage_bytes,
        fileCount: item.file_count
      })) || []

      return {
        totalStorage: latestUsage?.total_storage_bytes || 0,
        fileCount: latestUsage?.file_count || 0,
        storageByType: latestUsage?.storage_by_type || {},
        quotaUsage: latestUsage?.quota_usage_percentage || 0,
        quotaLimit: latestUsage?.quota_limit_bytes || 0,
        growthTrend
      }
    } catch (error) {
      console.error('Error getting storage usage metrics:', error)
      throw error
    }
  }

  // Performance Analytics
  async recordPerformanceMetric(params: {
    metricType: 'upload_speed' | 'search_response' | 'page_load' | 'api_response' | 'thumbnail_generation'
    value: number
    unit: string
    context?: Record<string, any>
    userId?: string
    projectId?: string
  }) {
    try {
      const { data, error } = await this.supabase.rpc('record_performance_metric', {
        p_metric_type: params.metricType,
        p_metric_value: params.value,
        p_metric_unit: params.unit,
        p_context: params.context || {},
        p_user_id: params.userId,
        p_project_id: params.projectId
      })

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error recording performance metric:', error)
      throw error
    }
  }

  async getPerformanceMetrics(timeRange: '24h' | '7d' | '30d' = '7d'): Promise<PerformanceMetrics> {
    try {
      const timeFilter = this.getTimeFilter(timeRange)

      // Get average metrics
      const { data: metricsData } = await this.supabase
        .from('performance_analytics')
        .select('metric_type, metric_value, recorded_at')
        .gte('recorded_at', timeFilter)

      const metricsByType = metricsData?.reduce((acc, item) => {
        if (!acc[item.metric_type]) acc[item.metric_type] = []
        acc[item.metric_type].push(item.metric_value)
        return acc
      }, {} as Record<string, number[]>) || {}

      const averageUploadSpeed = this.calculateAverage(metricsByType['upload_speed'] || [])
      const averageSearchResponseTime = this.calculateAverage(metricsByType['search_response'] || [])
      const averagePageLoadTime = this.calculateAverage(metricsByType['page_load'] || [])
      const systemResponseTime = this.calculateAverage(metricsByType['api_response'] || [])
      const thumbnailGenerationTime = this.calculateAverage(metricsByType['thumbnail_generation'] || [])

      // Get performance trends
      const performanceTrends = metricsData?.map(item => ({
        date: item.recorded_at.split('T')[0],
        metric: item.metric_type,
        value: item.metric_value
      })) || []

      return {
        averageUploadSpeed,
        averageSearchResponseTime,
        averagePageLoadTime,
        systemResponseTime,
        thumbnailGenerationTime,
        performanceTrends
      }
    } catch (error) {
      console.error('Error getting performance metrics:', error)
      throw error
    }
  }

  // User Activity Analytics
  async trackUserActivity(params: {
    userId: string
    projectId?: string
    activityType: 'login' | 'logout' | 'upload' | 'search' | 'collaboration' | 'folder_create' | 'asset_organize'
    activityDetails?: Record<string, any>
    sessionDurationMinutes?: number
  }) {
    try {
      const { data, error } = await this.supabase
        .from('user_activity_analytics')
        .insert({
          user_id: params.userId,
          project_id: params.projectId,
          activity_type: params.activityType,
          activity_details: params.activityDetails || {},
          session_duration_minutes: params.sessionDurationMinutes
        })

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error tracking user activity:', error)
      throw error
    }
  }

  async getUserActivityMetrics(projectId: string, timeRange: '24h' | '7d' | '30d' = '7d'): Promise<UserActivityMetrics> {
    try {
      const timeFilter = this.getTimeFilter(timeRange)

      // Get activity data
      const { data: activityData } = await this.supabase
        .from('user_activity_analytics')
        .select(`
          user_id,
          activity_type,
          session_duration_minutes,
          created_at,
          auth.users!inner(id, email)
        `)
        .eq('project_id', projectId)
        .gte('created_at', timeFilter)

      const activeUsers = new Set(activityData?.map(a => a.user_id)).size
      const totalSessions = activityData?.filter(a => a.activity_type === 'login').length || 0
      
      const sessionDurations = activityData?.filter(a => a.session_duration_minutes)
        .map(a => a.session_duration_minutes) || []
      const averageSessionDuration = this.calculateAverage(sessionDurations)

      const collaborationEvents = activityData?.filter(a => a.activity_type === 'collaboration').length || 0

      // User engagement
      const userEngagement = Object.values(
        activityData?.reduce((acc, item) => {
          const userId = item.user_id
          if (!acc[userId]) {
            acc[userId] = {
              userId,
              userName: (item as any).users?.email || 'Unknown',
              activityCount: 0,
              lastActive: item.created_at
            }
          }
          acc[userId].activityCount++
          if (new Date(item.created_at) > new Date(acc[userId].lastActive)) {
            acc[userId].lastActive = item.created_at
          }
          return acc
        }, {} as Record<string, any>) || {}
      ).sort((a: any, b: any) => b.activityCount - a.activityCount)

      // Activity by type
      const activityByType = activityData?.reduce((acc, item) => {
        acc[item.activity_type] = (acc[item.activity_type] || 0) + 1
        return acc
      }, {} as Record<string, number>) || {}

      return {
        activeUsers,
        totalSessions,
        averageSessionDuration,
        collaborationEvents,
        userEngagement: userEngagement as any,
        activityByType
      }
    } catch (error) {
      console.error('Error getting user activity metrics:', error)
      throw error
    }
  }

  // System Health Monitoring
  async recordSystemHealthMetric(params: {
    metricName: string
    value: number
    unit?: string
    status: 'healthy' | 'warning' | 'critical'
    thresholdWarning?: number
    thresholdCritical?: number
    metadata?: Record<string, any>
  }) {
    try {
      const { data, error } = await this.supabase
        .from('system_health_metrics')
        .insert({
          metric_name: params.metricName,
          metric_value: params.value,
          metric_unit: params.unit,
          status: params.status,
          threshold_warning: params.thresholdWarning,
          threshold_critical: params.thresholdCritical,
          metadata: params.metadata || {}
        })

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error recording system health metric:', error)
      throw error
    }
  }

  async getSystemHealthMetrics(): Promise<SystemHealthMetrics> {
    try {
      // Get latest health metrics
      const { data: healthData } = await this.supabase
        .from('system_health_metrics')
        .select('*')
        .order('recorded_at', { ascending: false })
        .limit(100)

      // Calculate overall status
      const criticalCount = healthData?.filter(h => h.status === 'critical').length || 0
      const warningCount = healthData?.filter(h => h.status === 'warning').length || 0
      
      let overallStatus: 'healthy' | 'warning' | 'critical' = 'healthy'
      if (criticalCount > 0) overallStatus = 'critical'
      else if (warningCount > 0) overallStatus = 'warning'

      // Get specific health metrics
      const uptimeMetric = healthData?.find(h => h.metric_name === 'uptime')
      const errorRateMetric = healthData?.find(h => h.metric_name === 'error_rate')
      const responseTimeMetric = healthData?.find(h => h.metric_name === 'response_time')
      const storageHealthMetric = healthData?.find(h => h.metric_name === 'storage_health')
      const databaseHealthMetric = healthData?.find(h => h.metric_name === 'database_health')

      // Get alerts (critical and warning status items from last 24 hours)
      const twentyFourHoursAgo = new Date()
      twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

      const alerts = healthData?.filter(h => 
        (h.status === 'warning' || h.status === 'critical') &&
        new Date(h.recorded_at) > twentyFourHoursAgo
      ).map(h => ({
        id: h.id,
        severity: h.status as 'warning' | 'critical',
        message: `${h.metric_name}: ${h.metric_value} ${h.metric_unit || ''}`,
        timestamp: h.recorded_at
      })) || []

      return {
        overallStatus,
        uptime: uptimeMetric?.metric_value || 0,
        errorRate: errorRateMetric?.metric_value || 0,
        responseTime: responseTimeMetric?.metric_value || 0,
        storageHealth: (storageHealthMetric?.status as any) || 'healthy',
        databaseHealth: (databaseHealthMetric?.status as any) || 'healthy',
        alerts
      }
    } catch (error) {
      console.error('Error getting system health metrics:', error)
      throw error
    }
  }

  // Business Intelligence Dashboard Data
  async getDashboardInsights(projectId: string, timeRange: '24h' | '7d' | '30d' = '7d') {
    try {
      const [
        assetUsage,
        storageUsage,
        performance,
        userActivity,
        systemHealth
      ] = await Promise.all([
        this.getAssetUsageMetrics(projectId, timeRange),
        this.getStorageUsageMetrics(projectId),
        this.getPerformanceMetrics(timeRange),
        this.getUserActivityMetrics(projectId, timeRange),
        this.getSystemHealthMetrics()
      ])

      return {
        assetUsage,
        storageUsage,
        performance,
        userActivity,
        systemHealth,
        generatedAt: new Date().toISOString()
      }
    } catch (error) {
      console.error('Error getting dashboard insights:', error)
      throw error
    }
  }

  // Utility methods
  private getTimeFilter(timeRange: '24h' | '7d' | '30d'): string {
    const now = new Date()
    switch (timeRange) {
      case '24h':
        now.setHours(now.getHours() - 24)
        break
      case '7d':
        now.setDate(now.getDate() - 7)
        break
      case '30d':
        now.setDate(now.getDate() - 30)
        break
    }
    return now.toISOString()
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }
}

export const analyticsService = new AnalyticsService()