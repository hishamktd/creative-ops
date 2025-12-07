import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAnalytics } from '../useAnalytics'

// Mock fetch
global.fetch = vi.fn()

// Mock performance observer
global.PerformanceObserver = vi.fn().mockImplementation((callback) => ({
  observe: vi.fn(),
  disconnect: vi.fn()
}))

// Mock document
Object.defineProperty(document, 'hidden', {
  writable: true,
  value: false
})

Object.defineProperty(document, 'addEventListener', {
  value: vi.fn()
})

Object.defineProperty(document, 'removeEventListener', {
  value: vi.fn()
})

describe('useAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('trackAssetUsage', () => {
    it('should track asset usage', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ success: true })))

      const { result } = renderHook(() => useAnalytics({
        projectId: 'project-123',
        sessionId: 'session-123'
      }))

      await act(async () => {
        await result.current.trackAssetUsage('asset-123', 'view', 30, { source: 'dashboard' })
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/analytics/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'asset_usage',
          data: {
            assetId: 'asset-123',
            projectId: 'project-123',
            actionType: 'view',
            sessionId: 'session-123',
            durationSeconds: 30,
            metadata: { source: 'dashboard' }
          }
        })
      })
    })

    it('should handle tracking errors gracefully', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockRejectedValue(new Error('Network error'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const { result } = renderHook(() => useAnalytics({
        projectId: 'project-123'
      }))

      await act(async () => {
        await result.current.trackAssetUsage('asset-123', 'view')
      })

      expect(consoleSpy).toHaveBeenCalledWith('Failed to track asset usage:', expect.any(Error))
    })

    it('should not track when projectId is missing', async () => {
      const mockFetch = vi.mocked(fetch)

      const { result } = renderHook(() => useAnalytics({}))

      await act(async () => {
        await result.current.trackAssetUsage('asset-123', 'view')
      })

      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('trackUserActivity', () => {
    it('should track user activity', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ success: true })))

      const { result } = renderHook(() => useAnalytics({
        projectId: 'project-123'
      }))

      await act(async () => {
        await result.current.trackUserActivity('upload', { fileName: 'test.jpg' }, 30)
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/analytics/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'user_activity',
          data: {
            projectId: 'project-123',
            activityType: 'upload',
            activityDetails: { fileName: 'test.jpg' },
            sessionDurationMinutes: 30
          }
        })
      })
    })
  })

  describe('trackPerformance', () => {
    it('should track performance metrics', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ success: true })))

      const { result } = renderHook(() => useAnalytics({
        projectId: 'project-123'
      }))

      await act(async () => {
        await result.current.trackPerformance('upload_speed', 10.5, 'mbps', { fileSize: 1024000 })
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/analytics/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'performance',
          data: {
            metricType: 'upload_speed',
            value: 10.5,
            unit: 'mbps',
            context: { fileSize: 1024000 },
            projectId: 'project-123'
          }
        })
      })
    })
  })

  describe('trackPageView', () => {
    it('should track page view with timing', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ success: true })))

      const { result } = renderHook(() => useAnalytics({
        projectId: 'project-123'
      }))

      await act(async () => {
        await result.current.trackPageView('dashboard', { section: 'assets' })
      })

      expect(mockFetch).toHaveBeenCalledTimes(2) // One for performance, one for activity
      
      // Check performance tracking call
      expect(mockFetch).toHaveBeenCalledWith('/api/analytics/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"metricType":"page_load"')
      })

      // Check activity tracking call
      expect(mockFetch).toHaveBeenCalledWith('/api/analytics/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"activityType":"search"')
      })
    })
  })

  describe('trackSearchPerformance', () => {
    it('should track search performance and activity', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ success: true })))

      const { result } = renderHook(() => useAnalytics({
        projectId: 'project-123'
      }))

      await act(async () => {
        await result.current.trackSearchPerformance('test query', 25, 150, { type: 'image' })
      })

      expect(mockFetch).toHaveBeenCalledTimes(2)
      
      // Check performance tracking
      expect(mockFetch).toHaveBeenCalledWith('/api/analytics/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'performance',
          data: {
            metricType: 'search_response',
            value: 150,
            unit: 'ms',
            context: {
              query: 'test query',
              resultCount: 25,
              filters: { type: 'image' }
            },
            projectId: 'project-123'
          }
        })
      })

      // Check activity tracking
      expect(mockFetch).toHaveBeenCalledWith('/api/analytics/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'user_activity',
          data: {
            projectId: 'project-123',
            activityType: 'search',
            activityDetails: {
              query: 'test query',
              resultCount: 25,
              responseTime: 150,
              filters: { type: 'image' }
            }
          }
        })
      })
    })
  })

  describe('trackUploadPerformance', () => {
    it('should track upload performance and calculate speed', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ success: true })))

      const { result } = renderHook(() => useAnalytics({
        projectId: 'project-123'
      }))

      const fileSize = 1024 * 1024 * 10 // 10MB
      const uploadTime = 5000 // 5 seconds

      await act(async () => {
        await result.current.trackUploadPerformance(fileSize, uploadTime, 'image/jpeg', true)
      })

      expect(mockFetch).toHaveBeenCalledTimes(2)

      // Calculate expected upload speed: (10MB) / (5s) = 2 MB/s
      const expectedSpeed = 2

      // Check performance tracking
      expect(mockFetch).toHaveBeenCalledWith('/api/analytics/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'performance',
          data: {
            metricType: 'upload_speed',
            value: expectedSpeed,
            unit: 'mbps',
            context: {
              fileSize,
              uploadTime,
              fileType: 'image/jpeg',
              success: true
            },
            projectId: 'project-123'
          }
        })
      })
    })
  })

  describe('auto-tracking', () => {
    it('should track login on mount when auto-tracking is enabled', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ success: true })))

      renderHook(() => useAnalytics({
        projectId: 'project-123',
        enableAutoTracking: true
      }))

      expect(mockFetch).toHaveBeenCalledWith('/api/analytics/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'user_activity',
          data: {
            projectId: 'project-123',
            activityType: 'login',
            activityDetails: undefined,
            sessionDurationMinutes: undefined
          }
        })
      })
    })

    it('should not auto-track when disabled', async () => {
      const mockFetch = vi.mocked(fetch)

      renderHook(() => useAnalytics({
        projectId: 'project-123',
        enableAutoTracking: false
      }))

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should track logout on unmount', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ success: true })))

      const { unmount } = renderHook(() => useAnalytics({
        projectId: 'project-123',
        enableAutoTracking: true
      }))

      // Clear the login call
      mockFetch.mockClear()

      // Advance time to simulate session duration
      act(() => {
        vi.advanceTimersByTime(60000) // 1 minute
      })

      unmount()

      expect(mockFetch).toHaveBeenCalledWith('/api/analytics/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('"activityType":"logout"')
      })
    })
  })

  describe('event batching', () => {
    it('should queue and flush events', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ success: true })))

      const { result } = renderHook(() => useAnalytics({
        projectId: 'project-123',
        enableAutoTracking: false
      }))

      // Queue multiple events
      act(() => {
        result.current.queueEvent({
          type: 'performance',
          data: { metricType: 'upload_speed', value: 10 }
        })
        result.current.queueEvent({
          type: 'user_activity',
          data: { activityType: 'upload' }
        })
      })

      // Advance timers to trigger flush
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/analytics/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: [
            { type: 'performance', data: { metricType: 'upload_speed', value: 10 } },
            { type: 'user_activity', data: { activityType: 'upload' } }
          ]
        })
      })
    })

    it('should manually flush events', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue(new Response(JSON.stringify({ success: true })))

      const { result } = renderHook(() => useAnalytics({
        projectId: 'project-123',
        enableAutoTracking: false
      }))

      // Queue an event
      act(() => {
        result.current.queueEvent({
          type: 'performance',
          data: { metricType: 'upload_speed', value: 10 }
        })
      })

      // Manually flush
      await act(async () => {
        await result.current.flushEvents()
      })

      expect(mockFetch).toHaveBeenCalledWith('/api/analytics/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          events: [
            { type: 'performance', data: { metricType: 'upload_speed', value: 10 } }
          ]
        })
      })
    })
  })
})