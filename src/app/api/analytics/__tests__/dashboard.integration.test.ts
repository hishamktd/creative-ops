import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '../dashboard/route'
import { createServerClient } from '@/lib/supabase/server'
import analyticsService from '@/lib/services/analyticsService'

// Mock Supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn()
}))

// Mock analytics service
vi.mock('@/lib/services/analyticsService', () => ({
  default: {
    getDashboardData: vi.fn(),
    trackAssetEvent: vi.fn(),
    trackPerformanceMetric: vi.fn(),
    trackUserActivity: vi.fn(),
    trackSystemHealth: vi.fn()
  }
}))

const mockSupabase = {
  auth: {
    getUser: vi.fn()
  },
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn()
        })
      })
    })
  })
}

const mockUser = {
  id: 'user-123',
  email: 'test@example.com'
}

const mockDashboardData = {
  assetPopularity: [
    {
      asset_id: 'asset-1',
      asset_name: 'test.jpg',
      view_count: 10,
      download_count: 2,
      total_interactions: 12,
      unique_users: 3,
      avg_duration_minutes: 1.5
    }
  ],
  storageUsage: [
    {
      snapshot_date: '2024-01-01',
      total_size_gb: 10,
      file_count: 100,
      growth_rate_percent: 5
    }
  ],
  performanceMetrics: {
    avgUploadSpeed: 5,
    avgSearchTime: 200,
    avgPageLoad: 1000,
    apiResponseTime: 150
  },
  userActivity: {
    activeUsers: 10,
    totalSessions: 25,
    avgSessionDuration: 30,
    collaborationScore: 75
  },
  systemHealth: {
    status: 'healthy',
    alerts: []
  }
}

describe('/api/analytics/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(createServerClient as any).mockReturnValue(mockSupabase)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET', () => {
    it('should return dashboard data for authenticated user', async () => {
      // Arrange
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })
      analyticsService.getDashboardData.mockResolvedValue(mockDashboardData)

      const request = new NextRequest('http://localhost:3000/api/analytics/dashboard')

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data).toEqual(mockDashboardData)
      expect(analyticsService.getDashboardData).toHaveBeenCalledWith(undefined)
    })

    it('should return dashboard data for specific project', async () => {
      // Arrange
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })
      mockSupabase.from().select().eq().eq().single.mockResolvedValue({
        data: { id: 'member-123' },
        error: null
      })
      analyticsService.getDashboardData.mockResolvedValue(mockDashboardData)

      const request = new NextRequest('http://localhost:3000/api/analytics/dashboard?projectId=project-123')

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data).toEqual(mockDashboardData)
      expect(analyticsService.getDashboardData).toHaveBeenCalledWith('project-123')
    })

    it('should return 401 for unauthenticated user', async () => {
      // Arrange
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      })

      const request = new NextRequest('http://localhost:3000/api/analytics/dashboard')

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 403 for project access denied', async () => {
      // Arrange
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })
      mockSupabase.from().select().eq().eq().single.mockResolvedValue({
        data: null,
        error: null
      })

      const request = new NextRequest('http://localhost:3000/api/analytics/dashboard?projectId=project-123')

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(403)
      expect(data.error).toBe('Project access denied')
    })

    it('should return 500 on service error', async () => {
      // Arrange
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })
      analyticsService.getDashboardData.mockRejectedValue(new Error('Service error'))

      const request = new NextRequest('http://localhost:3000/api/analytics/dashboard')

      // Act
      const response = await GET(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch analytics data')
    })
  })

  describe('POST', () => {
    it('should track asset event successfully', async () => {
      // Arrange
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })
      analyticsService.trackAssetEvent.mockResolvedValue(undefined)

      const requestBody = {
        type: 'asset_event',
        data: {
          asset_id: 'asset-123',
          action_type: 'view',
          session_id: 'session-123'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/analytics/dashboard', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(analyticsService.trackAssetEvent).toHaveBeenCalledWith(requestBody.data)
    })

    it('should track performance metric successfully', async () => {
      // Arrange
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })
      analyticsService.trackPerformanceMetric.mockResolvedValue(undefined)

      const requestBody = {
        type: 'performance_metric',
        data: {
          metric_type: 'upload_speed',
          metric_value: 10.5,
          unit: 'mbps'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/analytics/dashboard', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(analyticsService.trackPerformanceMetric).toHaveBeenCalledWith(requestBody.data)
    })

    it('should track user activity successfully', async () => {
      // Arrange
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })
      analyticsService.trackUserActivity.mockResolvedValue(undefined)

      const requestBody = {
        type: 'user_activity',
        data: {
          activity_type: 'upload',
          project_id: 'project-123',
          session_id: 'session-123'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/analytics/dashboard', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(analyticsService.trackUserActivity).toHaveBeenCalledWith(requestBody.data)
    })

    it('should track system health successfully', async () => {
      // Arrange
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })
      analyticsService.trackSystemHealth.mockResolvedValue(undefined)

      const requestBody = {
        type: 'system_health',
        data: {
          metric_name: 'cpu_usage',
          metric_value: 75,
          component: 'api'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/analytics/dashboard', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(analyticsService.trackSystemHealth).toHaveBeenCalledWith(requestBody.data)
    })

    it('should return 400 for invalid event type', async () => {
      // Arrange
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })

      const requestBody = {
        type: 'invalid_type',
        data: {}
      }

      const request = new NextRequest('http://localhost:3000/api/analytics/dashboard', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid event type')
    })

    it('should return 401 for unauthenticated user', async () => {
      // Arrange
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Not authenticated')
      })

      const requestBody = {
        type: 'asset_event',
        data: {}
      }

      const request = new NextRequest('http://localhost:3000/api/analytics/dashboard', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 500 on tracking error', async () => {
      // Arrange
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null
      })
      analyticsService.trackAssetEvent.mockRejectedValue(new Error('Tracking error'))

      const requestBody = {
        type: 'asset_event',
        data: {
          asset_id: 'asset-123',
          action_type: 'view'
        }
      }

      const request = new NextRequest('http://localhost:3000/api/analytics/dashboard', {
        method: 'POST',
        body: JSON.stringify(requestBody)
      })

      // Act
      const response = await POST(request)
      const data = await response.json()

      // Assert
      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to track analytics event')
    })
  })
})