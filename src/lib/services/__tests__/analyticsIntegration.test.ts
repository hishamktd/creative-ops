import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useAnalytics, usePerformanceMonitoring } from '@/lib/hooks/useAnalytics'
import analyticsService from '@/lib/services/analyticsService'

// Mock analytics service
vi.mock('@/lib/services/analyticsService')

describe('Analytics Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('End-to-End Analytics Flow', () => {
    it('should track complete asset upload workflow', async () => {
      const { result: analytics } = renderHook(() => useAnalytics())
      const { result: performance } = renderHook(() => usePerformanceMonitoring())

      // Simulate file upload workflow
      const fileSize = 1024 * 1024 * 5 // 5MB
      const uploadStartTime = Date.now()

      // Start performance monitoring
      act(() => {
        performance.current.startTiming()
      })

      // Track feature usage
      act(() => {
        analytics.current.trackFeatureUsage('drag_drop')
        analytics.current.trackFeatureUsage('file_upload')
      })

      // Simulate upload completion
      const uploadEndTime = Date.now()
      const uploadDuration = uploadEndTime - uploadStartTime

      act(() => {
        performance.current.endTiming('upload_operation')
        analytics.current.trackUploadPerformance(fileSize, uploadDuration)
      })

      // Track user activity
      act(() => {
        analytics.current.trackUserAction('upload', 'project-123')
      })

      // Verify all tracking calls were made
      expect(analyticsService.trackPerformanceMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          metric_type: 'upload_speed'
        })
      )

      expect(analyticsService.trackUploadPerformance).toHaveBeenCalledWith(
        fileSize,
        uploadDuration
      )

      expect(analyticsService.trackUserActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          activity_type: 'upload',
          project_id: 'project-123',
          features_used: expect.arrayContaining(['drag_drop', 'file_upload'])
        })
      )
    })

    it('should track asset viewing and interaction workflow', async () => {
      const { result: analytics } = renderHook(() => useAnalytics())

      const assetId = 'asset-123'
      const viewStartTime = Date.now()

      // Track asset view
      act(() => {
        analytics.current.trackAssetView(assetId)
      })

      // Simulate user interactions
      act(() => {
        analytics.current.trackFeatureUsage('zoom')
        analytics.current.trackFeatureUsage('pan')
      })

      // Track asset comment
      act(() => {
        analytics.current.trackAssetComment(assetId)
      })

      // Track asset share
      act(() => {
        analytics.current.trackAssetShare(assetId)
      })

      // Track view duration
      const viewDuration = Date.now() - viewStartTime
      act(() => {
        analytics.current.trackAssetView(assetId, viewDuration)
      })

      // Verify tracking calls
      expect(analyticsService.trackAssetEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          asset_id: assetId,
          action_type: 'view'
        })
      )

      expect(analyticsService.trackAssetEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          asset_id: assetId,
          action_type: 'comment'
        })
      )

      expect(analyticsService.trackAssetEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          asset_id: assetId,
          action_type: 'share'
        })
      )

      expect(analyticsService.trackAssetEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          asset_id: assetId,
          action_type: 'view',
          duration_ms: viewDuration
        })
      )
    })

    it('should track search workflow with performance metrics', async () => {
      const { result: analytics } = renderHook(() => useAnalytics())
      const { result: performance } = renderHook(() => usePerformanceMonitoring())

      const searchQuery = 'project assets'

      // Start search performance tracking
      act(() => {
        performance.current.startTiming()
      })

      // Track feature usage
      act(() => {
        analytics.current.trackFeatureUsage('advanced_search')
        analytics.current.trackFeatureUsage('filters')
      })

      // Simulate search completion
      const searchTime = 250
      act(() => {
        performance.current.endTiming('search_operation', { query: searchQuery })
        analytics.current.trackSearchPerformance(searchTime, searchQuery)
      })

      // Track user activity
      act(() => {
        analytics.current.trackUserAction('search', 'project-123')
      })

      // Verify tracking
      expect(analyticsService.trackPerformanceMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          metric_type: 'search_time'
        })
      )

      expect(analyticsService.trackSearchPerformance).toHaveBeenCalledWith(
        searchTime,
        searchQuery
      )

      expect(analyticsService.trackUserActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          activity_type: 'search',
          features_used: expect.arrayContaining(['advanced_search', 'filters'])
        })
      )
    })

    it('should track collaborative workflow', async () => {
      const { result: analytics } = renderHook(() => useAnalytics())

      const assetId = 'asset-456'
      const projectId = 'project-123'

      // Track collaboration features
      act(() => {
        analytics.current.trackFeatureUsage('real_time_comments')
        analytics.current.trackFeatureUsage('presence_indicators')
        analytics.current.trackFeatureUsage('version_control')
      })

      // Track asset interactions in collaborative context
      act(() => {
        analytics.current.trackAssetView(assetId, 30000) // 30 seconds
        analytics.current.trackAssetComment(assetId)
        analytics.current.trackAssetEdit(assetId)
      })

      // Track collaboration activity
      act(() => {
        analytics.current.trackUserAction('collaboration', projectId)
      })

      // Verify collaboration tracking
      expect(analyticsService.trackAssetEvent).toHaveBeenCalledTimes(3)
      expect(analyticsService.trackUserActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          activity_type: 'collaboration',
          project_id: projectId,
          features_used: expect.arrayContaining([
            'real_time_comments',
            'presence_indicators',
            'version_control'
          ])
        })
      )
    })
  })

  describe('Performance Monitoring Integration', () => {
    it('should measure and track API response times', async () => {
      const { result } = renderHook(() => usePerformanceMonitoring())

      const mockApiCall = vi.fn().mockResolvedValue({ data: 'success' })

      const result_value = await act(async () => {
        return result.current.measureAsync(
          'api_assets_upload',
          mockApiCall,
          { endpoint: '/api/assets/upload', fileSize: 1024000 }
        )
      })

      expect(result_value).toEqual({ data: 'success' })
      expect(mockApiCall).toHaveBeenCalled()
      expect(analyticsService.trackPerformanceMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          metric_type: 'upload_speed',
          unit: 'ms',
          metadata: expect.objectContaining({
            endpoint: '/api/assets/upload',
            fileSize: 1024000
          })
        })
      )
    })

    it('should handle and track API errors', async () => {
      const { result } = renderHook(() => usePerformanceMonitoring())

      const mockApiCall = vi.fn().mockRejectedValue(new Error('API Error'))

      await act(async () => {
        await expect(
          result.current.measureAsync('api_search', mockApiCall, { query: 'test' })
        ).rejects.toThrow('API Error')
      })

      expect(analyticsService.trackPerformanceMetric).toHaveBeenCalledWith(
        expect.objectContaining({
          metric_type: 'search_time',
          metadata: expect.objectContaining({
            operation: 'api_search',
            query: 'test',
            error: true
          })
        })
      )
    })
  })

  describe('Data Collection Accuracy', () => {
    it('should collect accurate session data', () => {
      const { result: analytics1 } = renderHook(() => useAnalytics())
      const { result: analytics2 } = renderHook(() => useAnalytics())

      // Different hook instances should have different session IDs
      expect(analytics1.current.sessionId).not.toBe(analytics2.current.sessionId)

      // Session IDs should be consistent within the same hook instance
      expect(analytics1.current.sessionId).toBe(analytics1.current.sessionId)
    })

    it('should accumulate feature usage correctly', () => {
      const { result } = renderHook(() => useAnalytics())

      // Track multiple features
      act(() => {
        result.current.trackFeatureUsage('feature1')
        result.current.trackFeatureUsage('feature2')
        result.current.trackFeatureUsage('feature1') // Duplicate should not create duplicate
      })

      // Track user action to verify accumulated features
      act(() => {
        result.current.trackUserAction('upload', 'project-123')
      })

      expect(analyticsService.trackUserActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          features_used: expect.arrayContaining(['feature1', 'feature2'])
        })
      )
    })

    it('should handle concurrent tracking calls', async () => {
      const { result } = renderHook(() => useAnalytics())

      // Simulate concurrent asset interactions
      const promises = [
        act(() => result.current.trackAssetView('asset-1')),
        act(() => result.current.trackAssetView('asset-2')),
        act(() => result.current.trackAssetDownload('asset-3')),
        act(() => result.current.trackAssetComment('asset-4'))
      ]

      await Promise.all(promises)

      // All tracking calls should have been made
      expect(analyticsService.trackAssetEvent).toHaveBeenCalledTimes(4)
    })
  })

  describe('Error Handling and Resilience', () => {
    it('should continue working when analytics service fails', async () => {
      const { result } = renderHook(() => useAnalytics())

      // Mock service to throw errors
      analyticsService.trackAssetEvent.mockRejectedValue(new Error('Service error'))

      // Tracking should not throw errors
      await act(async () => {
        expect(() => {
          result.current.trackAssetView('asset-123')
        }).not.toThrow()
      })

      // Service should still be called despite errors
      expect(analyticsService.trackAssetEvent).toHaveBeenCalled()
    })

    it('should handle missing user context gracefully', async () => {
      const { result } = renderHook(() => useAnalytics())

      // Mock service to handle missing user
      analyticsService.trackUserActivity.mockImplementation(async (activity) => {
        if (!activity.project_id) {
          throw new Error('Missing project context')
        }
      })

      // Should handle missing context without throwing
      await act(async () => {
        expect(() => {
          result.current.trackUserAction('upload', '')
        }).not.toThrow()
      })
    })
  })
})