import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AnalyticsService } from '../analyticsService'

// Mock Supabase client
const mockSupabase = {
  rpc: vi.fn(),
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        gte: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({
              single: vi.fn()
            }))
          }))
        }))
      }))
    }))
  }))
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase
}))

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService

  beforeEach(() => {
    analyticsService = new AnalyticsService()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('trackAssetUsage', () => {
    it('should track asset usage successfully', async () => {
      const mockUsageId = 'usage-123'
      mockSupabase.rpc.mockResolvedValue({ data: mockUsageId, error: null })

      const params = {
        assetId: 'asset-123',
        userId: 'user-123',
        projectId: 'project-123',
        actionType: 'view' as const,
        sessionId: 'session-123',
        durationSeconds: 30,
        metadata: { source: 'dashboard' }
      }

      const result = await analyticsService.trackAssetUsage(params)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('track_asset_usage', {
        p_asset_id: params.assetId,
        p_user_id: params.userId,
        p_project_id: params.projectId,
        p_action_type: params.actionType,
        p_session_id: params.sessionId,
        p_duration_seconds: params.durationSeconds,
        p_metadata: params.metadata
      })
      expect(result).toBe(mockUsageId)
    })

    it('should handle tracking errors', async () => {
      const error = new Error('Database error')
      mockSupabase.rpc.mockResolvedValue({ data: null, error })

      const params = {
        assetId: 'asset-123',
        userId: 'user-123',
        projectId: 'project-123',
        actionType: 'view' as const
      }

      await expect(analyticsService.trackAssetUsage(params)).rejects.toThrow('Database error')
    })
  })

  describe('getAssetUsageMetrics', () => {
    it('should return asset usage metrics', async () => {
      const mockUsageData = [
        { action_type: 'view', user_id: 'user-1', created_at: '2023-01-01T10:00:00Z', duration_seconds: 30 },
        { action_type: 'view', user_id: 'user-2', created_at: '2023-01-01T11:00:00Z', duration_seconds: 45 },
        { action_type: 'download', user_id: 'user-1', created_at: '2023-01-01T12:00:00Z', duration_seconds: null }
      ]

      const mockPopularAssets = [
        { 
          asset_id: 'asset-1', 
          action_type: 'view', 
          assets: { id: 'asset-1', name: 'Image 1' } 
        }
      ]

      // Mock the chain of method calls
      const mockSelect = vi.fn()
      const mockEq = vi.fn()
      const mockGte = vi.fn()

      mockSelect.mockReturnValue({ eq: mockEq })
      mockEq.mockReturnValue({ gte: mockGte })
      mockGte.mockResolvedValue({ data: mockUsageData })

      mockSupabase.from.mockReturnValue({ select: mockSelect })

      // Mock popular assets query
      mockSupabase.from.mockReturnValueOnce({ select: mockSelect })
      mockGte.mockResolvedValueOnce({ data: mockUsageData })

      // Mock unique users query
      mockSupabase.from.mockReturnValueOnce({ select: mockSelect })
      mockGte.mockResolvedValueOnce({ data: [{ user_id: 'user-1' }, { user_id: 'user-2' }] })

      // Mock session data query
      mockSupabase.from.mockReturnValueOnce({ select: mockSelect })
      const mockNot = vi.fn()
      mockGte.mockReturnValue({ not: mockNot })
      mockNot.mockResolvedValue({ data: [{ duration_seconds: 30 }, { duration_seconds: 45 }] })

      // Mock popular assets query
      mockSupabase.from.mockReturnValueOnce({ select: mockSelect })
      mockGte.mockResolvedValueOnce({ data: mockPopularAssets })

      // Mock access patterns query
      mockSupabase.from.mockReturnValueOnce({ select: mockSelect })
      mockGte.mockResolvedValueOnce({ data: mockUsageData })

      const result = await analyticsService.getAssetUsageMetrics('project-123', '7d')

      expect(result).toEqual({
        totalViews: 2,
        totalDownloads: 1,
        uniqueUsers: 2,
        averageSessionDuration: 37.5,
        popularAssets: [
          {
            id: 'asset-1',
            name: 'Image 1',
            views: 1,
            downloads: 0
          }
        ],
        accessPatterns: expect.arrayContaining([
          expect.objectContaining({ hour: expect.any(Number), count: expect.any(Number) })
        ])
      })
    })

    it('should handle empty data gracefully', async () => {
      const mockSelect = vi.fn()
      const mockEq = vi.fn()
      const mockGte = vi.fn()
      const mockNot = vi.fn()

      mockSelect.mockReturnValue({ eq: mockEq })
      mockEq.mockReturnValue({ gte: mockGte })
      mockGte.mockReturnValue({ not: mockNot })
      mockGte.mockResolvedValue({ data: [] })
      mockNot.mockResolvedValue({ data: [] })

      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await analyticsService.getAssetUsageMetrics('project-123', '7d')

      expect(result.totalViews).toBe(0)
      expect(result.totalDownloads).toBe(0)
      expect(result.uniqueUsers).toBe(0)
      expect(result.averageSessionDuration).toBe(0)
      expect(result.popularAssets).toEqual([])
    })
  })

  describe('recordPerformanceMetric', () => {
    it('should record performance metric successfully', async () => {
      const mockMetricId = 'metric-123'
      mockSupabase.rpc.mockResolvedValue({ data: mockMetricId, error: null })

      const params = {
        metricType: 'upload_speed' as const,
        value: 10.5,
        unit: 'mbps',
        context: { fileSize: 1024000 },
        userId: 'user-123',
        projectId: 'project-123'
      }

      const result = await analyticsService.recordPerformanceMetric(params)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('record_performance_metric', {
        p_metric_type: params.metricType,
        p_metric_value: params.value,
        p_metric_unit: params.unit,
        p_context: params.context,
        p_user_id: params.userId,
        p_project_id: params.projectId
      })
      expect(result).toBe(mockMetricId)
    })
  })

  describe('getPerformanceMetrics', () => {
    it('should return performance metrics', async () => {
      const mockPerformanceData = [
        { metric_type: 'upload_speed', metric_value: 10.5, recorded_at: '2023-01-01T10:00:00Z' },
        { metric_type: 'upload_speed', metric_value: 12.0, recorded_at: '2023-01-01T11:00:00Z' },
        { metric_type: 'search_response', metric_value: 150, recorded_at: '2023-01-01T12:00:00Z' }
      ]

      const mockSelect = vi.fn()
      const mockGte = vi.fn()

      mockSelect.mockReturnValue({ gte: mockGte })
      mockGte.mockResolvedValue({ data: mockPerformanceData })

      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await analyticsService.getPerformanceMetrics('7d')

      expect(result).toEqual({
        averageUploadSpeed: 11.25,
        averageSearchResponseTime: 150,
        averagePageLoadTime: 0,
        systemResponseTime: 0,
        thumbnailGenerationTime: 0,
        performanceTrends: expect.arrayContaining([
          expect.objectContaining({
            date: expect.any(String),
            metric: expect.any(String),
            value: expect.any(Number)
          })
        ])
      })
    })
  })

  describe('trackUserActivity', () => {
    it('should track user activity successfully', async () => {
      const mockActivityData = { id: 'activity-123' }
      
      const mockInsert = vi.fn()
      mockInsert.mockResolvedValue({ data: mockActivityData, error: null })

      mockSupabase.from.mockReturnValue({ insert: mockInsert })

      const params = {
        userId: 'user-123',
        projectId: 'project-123',
        activityType: 'upload' as const,
        activityDetails: { fileName: 'test.jpg' },
        sessionDurationMinutes: 30
      }

      const result = await analyticsService.trackUserActivity(params)

      expect(mockSupabase.from).toHaveBeenCalledWith('user_activity_analytics')
      expect(mockInsert).toHaveBeenCalledWith({
        user_id: params.userId,
        project_id: params.projectId,
        activity_type: params.activityType,
        activity_details: params.activityDetails,
        session_duration_minutes: params.sessionDurationMinutes
      })
      expect(result).toBe(mockActivityData)
    })
  })

  describe('getUserActivityMetrics', () => {
    it('should return user activity metrics', async () => {
      const mockActivityData = [
        { 
          user_id: 'user-1', 
          activity_type: 'login', 
          session_duration_minutes: 30,
          created_at: '2023-01-01T10:00:00Z',
          users: { id: 'user-1', email: 'user1@example.com' }
        },
        { 
          user_id: 'user-2', 
          activity_type: 'upload', 
          session_duration_minutes: null,
          created_at: '2023-01-01T11:00:00Z',
          users: { id: 'user-2', email: 'user2@example.com' }
        },
        { 
          user_id: 'user-1', 
          activity_type: 'collaboration', 
          session_duration_minutes: null,
          created_at: '2023-01-01T12:00:00Z',
          users: { id: 'user-1', email: 'user1@example.com' }
        }
      ]

      const mockSelect = vi.fn()
      const mockEq = vi.fn()
      const mockGte = vi.fn()

      mockSelect.mockReturnValue({ eq: mockEq })
      mockEq.mockReturnValue({ gte: mockGte })
      mockGte.mockResolvedValue({ data: mockActivityData })

      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await analyticsService.getUserActivityMetrics('project-123', '7d')

      expect(result).toEqual({
        activeUsers: 2,
        totalSessions: 1,
        averageSessionDuration: 30,
        collaborationEvents: 1,
        userEngagement: expect.arrayContaining([
          expect.objectContaining({
            userId: expect.any(String),
            userName: expect.any(String),
            activityCount: expect.any(Number),
            lastActive: expect.any(String)
          })
        ]),
        activityByType: {
          login: 1,
          upload: 1,
          collaboration: 1
        }
      })
    })
  })

  describe('getSystemHealthMetrics', () => {
    it('should return system health metrics', async () => {
      const mockHealthData = [
        { 
          id: 'health-1',
          metric_name: 'uptime', 
          metric_value: 99.9, 
          status: 'healthy',
          recorded_at: '2023-01-01T10:00:00Z'
        },
        { 
          id: 'health-2',
          metric_name: 'error_rate', 
          metric_value: 0.1, 
          status: 'warning',
          recorded_at: '2023-01-01T09:00:00Z'
        }
      ]

      const mockSelect = vi.fn()
      const mockOrder = vi.fn()
      const mockLimit = vi.fn()

      mockSelect.mockReturnValue({ order: mockOrder })
      mockOrder.mockReturnValue({ limit: mockLimit })
      mockLimit.mockResolvedValue({ data: mockHealthData })

      mockSupabase.from.mockReturnValue({ select: mockSelect })

      const result = await analyticsService.getSystemHealthMetrics()

      expect(result).toEqual({
        overallStatus: 'warning',
        uptime: 99.9,
        errorRate: 0.1,
        responseTime: 0,
        storageHealth: 'healthy',
        databaseHealth: 'healthy',
        alerts: expect.arrayContaining([
          expect.objectContaining({
            id: expect.any(String),
            severity: expect.any(String),
            message: expect.any(String),
            timestamp: expect.any(String)
          })
        ])
      })
    })
  })

  describe('getDashboardInsights', () => {
    it('should return comprehensive dashboard insights', async () => {
      // Mock all the individual metric methods
      vi.spyOn(analyticsService, 'getAssetUsageMetrics').mockResolvedValue({
        totalViews: 100,
        totalDownloads: 50,
        uniqueUsers: 10,
        averageSessionDuration: 300,
        popularAssets: [],
        accessPatterns: []
      })

      vi.spyOn(analyticsService, 'getStorageUsageMetrics').mockResolvedValue({
        totalStorage: 1024000000,
        fileCount: 500,
        storageByType: { image: 512000000, video: 512000000 },
        quotaUsage: 50,
        quotaLimit: 2048000000,
        growthTrend: []
      })

      vi.spyOn(analyticsService, 'getPerformanceMetrics').mockResolvedValue({
        averageUploadSpeed: 10.5,
        averageSearchResponseTime: 150,
        averagePageLoadTime: 1200,
        systemResponseTime: 200,
        thumbnailGenerationTime: 2.5,
        performanceTrends: []
      })

      vi.spyOn(analyticsService, 'getUserActivityMetrics').mockResolvedValue({
        activeUsers: 10,
        totalSessions: 25,
        averageSessionDuration: 300,
        collaborationEvents: 15,
        userEngagement: [],
        activityByType: {}
      })

      vi.spyOn(analyticsService, 'getSystemHealthMetrics').mockResolvedValue({
        overallStatus: 'healthy',
        uptime: 99.9,
        errorRate: 0.1,
        responseTime: 200,
        storageHealth: 'healthy',
        databaseHealth: 'healthy',
        alerts: []
      })

      const result = await analyticsService.getDashboardInsights('project-123', '7d')

      expect(result).toHaveProperty('assetUsage')
      expect(result).toHaveProperty('storageUsage')
      expect(result).toHaveProperty('performance')
      expect(result).toHaveProperty('userActivity')
      expect(result).toHaveProperty('systemHealth')
      expect(result).toHaveProperty('generatedAt')
      expect(new Date(result.generatedAt)).toBeInstanceOf(Date)
    })
  })

  describe('utility methods', () => {
    it('should calculate time filters correctly', () => {
      const now = new Date('2023-01-08T12:00:00Z')
      vi.setSystemTime(now)

      // Access private method through type assertion
      const service = analyticsService as any

      expect(service.getTimeFilter('24h')).toBe('2023-01-07T12:00:00.000Z')
      expect(service.getTimeFilter('7d')).toBe('2023-01-01T12:00:00.000Z')
      expect(service.getTimeFilter('30d')).toBe('2022-12-09T12:00:00.000Z')
    })

    it('should calculate averages correctly', () => {
      const service = analyticsService as any

      expect(service.calculateAverage([1, 2, 3, 4, 5])).toBe(3)
      expect(service.calculateAverage([10, 20])).toBe(15)
      expect(service.calculateAverage([])).toBe(0)
      expect(service.calculateAverage([42])).toBe(42)
    })
  })
})