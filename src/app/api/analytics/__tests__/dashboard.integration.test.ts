import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '../dashboard/route'

// Mock Supabase
const mockSupabaseClient = {
  auth: {
    getUser: vi.fn()
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn()
      }))
    }))
  }))
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabaseClient
}))

// Mock analytics service
const mockAnalyticsService = {
  getDashboardInsights: vi.fn(),
  trackAssetUsage: vi.fn(),
  trackUserActivity: vi.fn(),
  recordPerformanceMetric: vi.fn()
}

vi.mock('@/lib/services/analyticsService', () => ({
  analyticsService: mockAnalyticsService
}))

describe('/api/analytics/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET', () => {
    it('should return dashboard insights for authenticated user', async () => {
      // Mock authenticated user
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      // Mock project member check
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: { role: 'member' },
        error: null
      })

      // Mock analytics insights
      const mockInsights = {
        assetUsage: { totalViews: 100, totalDownloads: 50 },
        storageUsage: { totalStorage: 1024000, fileCount: 10 },
        performance: { averageUploadSpeed: 10.5 },
        userActivity: { activeUsers: 5 },
        systemHealth: { overallStatus: 'healthy' },
        generatedAt: '2023-01-01T00:00:00Z'
      }

      mockAnalyticsService.getDashboardInsights.mockResolvedValue(mockInsights)

      const request = new NextRequest('http://localhost/api/analytics/dashboard?projectId=project-123&timeRange=7d')
      const response = await GET(request)

      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data).toEqual(mockInsights)

      expect(mockAnalyticsService.getDashboardInsights).toHaveBeenCalledWith('project-123', '7d')
    })

    it('should return 401 for unauthenticated user', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      })

      const request = new NextRequest('http://localhost/api/analytics/dashboard?projectId=project-123')
      const response = await GET(request)

      expect(response.status).toBe(401)
      
      const data = await response.json()
      expect(data).toEqual({ error: 'Unauthorized' })
    })

    it('should return 400 when projectId is missing', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      const request = new NextRequest('http://localhost/api/analytics/dashboard')
      const response = await GET(request)

      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data).toEqual({ error: 'Project ID is required' })
    })

    it('should return 403 when user has no access to project', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: null
      })

      const request = new NextRequest('http://localhost/api/analytics/dashboard?projectId=project-123')
      const response = await GET(request)

      expect(response.status).toBe(403)
      
      const data = await response.json()
      expect(data).toEqual({ error: 'Access denied' })
    })

    it('should use default timeRange when not provided', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: { role: 'member' },
        error: null
      })

      mockAnalyticsService.getDashboardInsights.mockResolvedValue({})

      const request = new NextRequest('http://localhost/api/analytics/dashboard?projectId=project-123')
      const response = await GET(request)

      expect(response.status).toBe(200)
      expect(mockAnalyticsService.getDashboardInsights).toHaveBeenCalledWith('project-123', '7d')
    })

    it('should handle analytics service errors', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: { role: 'member' },
        error: null
      })

      mockAnalyticsService.getDashboardInsights.mockRejectedValue(new Error('Analytics error'))

      const request = new NextRequest('http://localhost/api/analytics/dashboard?projectId=project-123')
      const response = await GET(request)

      expect(response.status).toBe(500)
      
      const data = await response.json()
      expect(data).toEqual({ error: 'Internal server error' })
    })
  })

  describe('POST', () => {
    it('should track asset usage', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      mockAnalyticsService.trackAssetUsage.mockResolvedValue('usage-123')

      const requestBody = {
        type: 'asset_usage',
        data: {
          assetId: 'asset-123',
          projectId: 'project-123',
          actionType: 'view',
          sessionId: 'session-123',
          durationSeconds: 30,
          metadata: { source: 'dashboard' }
        }
      }

      const request = new NextRequest('http://localhost/api/analytics/dashboard', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data).toEqual({ success: true })

      expect(mockAnalyticsService.trackAssetUsage).toHaveBeenCalledWith({
        assetId: 'asset-123',
        userId: 'user-123',
        projectId: 'project-123',
        actionType: 'view',
        sessionId: 'session-123',
        durationSeconds: 30,
        metadata: { source: 'dashboard' }
      })
    })

    it('should track user activity', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      mockAnalyticsService.trackUserActivity.mockResolvedValue('activity-123')

      const requestBody = {
        type: 'user_activity',
        data: {
          projectId: 'project-123',
          activityType: 'upload',
          activityDetails: { fileName: 'test.jpg' },
          sessionDurationMinutes: 30
        }
      }

      const request = new NextRequest('http://localhost/api/analytics/dashboard', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data).toEqual({ success: true })

      expect(mockAnalyticsService.trackUserActivity).toHaveBeenCalledWith({
        userId: 'user-123',
        projectId: 'project-123',
        activityType: 'upload',
        activityDetails: { fileName: 'test.jpg' },
        sessionDurationMinutes: 30
      })
    })

    it('should track performance metrics', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      mockAnalyticsService.recordPerformanceMetric.mockResolvedValue('metric-123')

      const requestBody = {
        type: 'performance',
        data: {
          metricType: 'upload_speed',
          value: 10.5,
          unit: 'mbps',
          context: { fileSize: 1024000 },
          projectId: 'project-123'
        }
      }

      const request = new NextRequest('http://localhost/api/analytics/dashboard', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)

      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data).toEqual({ success: true })

      expect(mockAnalyticsService.recordPerformanceMetric).toHaveBeenCalledWith({
        metricType: 'upload_speed',
        value: 10.5,
        unit: 'mbps',
        context: { fileSize: 1024000 },
        userId: 'user-123',
        projectId: 'project-123'
      })
    })

    it('should return 401 for unauthenticated user', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      })

      const requestBody = {
        type: 'asset_usage',
        data: { assetId: 'asset-123' }
      }

      const request = new NextRequest('http://localhost/api/analytics/dashboard', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)

      expect(response.status).toBe(401)
      
      const data = await response.json()
      expect(data).toEqual({ error: 'Unauthorized' })
    })

    it('should return 400 for invalid analytics type', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      const requestBody = {
        type: 'invalid_type',
        data: {}
      }

      const request = new NextRequest('http://localhost/api/analytics/dashboard', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)

      expect(response.status).toBe(400)
      
      const data = await response.json()
      expect(data).toEqual({ error: 'Invalid analytics type' })
    })

    it('should handle analytics service errors', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })

      mockAnalyticsService.trackAssetUsage.mockRejectedValue(new Error('Tracking error'))

      const requestBody = {
        type: 'asset_usage',
        data: {
          assetId: 'asset-123',
          projectId: 'project-123',
          actionType: 'view'
        }
      }

      const request = new NextRequest('http://localhost/api/analytics/dashboard', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      const response = await POST(request)

      expect(response.status).toBe(500)
      
      const data = await response.json()
      expect(data).toEqual({ error: 'Internal server error' })
    })
  })
})