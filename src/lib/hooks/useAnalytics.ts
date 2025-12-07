'use client'

import { useCallback, useEffect, useRef } from 'react'

interface AnalyticsEvent {
  type: 'asset_usage' | 'user_activity' | 'performance'
  data: any
}

interface UseAnalyticsOptions {
  projectId?: string
  userId?: string
  sessionId?: string
  enableAutoTracking?: boolean
}

export function useAnalytics(options: UseAnalyticsOptions = {}) {
  const { projectId, userId, sessionId, enableAutoTracking = true } = options
  const sessionStartTime = useRef<number>(Date.now())
  const pageLoadTime = useRef<number>(Date.now())
  const eventQueue = useRef<AnalyticsEvent[]>([])
  const flushTimeout = useRef<NodeJS.Timeout>()

  // Track performance metrics
  const trackPerformance = useCallback(async (
    metricType: 'upload_speed' | 'search_response' | 'page_load' | 'api_response' | 'thumbnail_generation',
    value: number,
    unit: string,
    context?: Record<string, any>
  ) => {
    try {
      await fetch('/api/analytics/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'performance',
          data: {
            metricType,
            value,
            unit,
            context,
            projectId
          }
        })
      })
    } catch (error) {
      console.error('Failed to track performance metric:', error)
    }
  }, [projectId])

  // Track asset usage
  const trackAssetUsage = useCallback(async (
    assetId: string,
    actionType: 'view' | 'download' | 'edit' | 'share' | 'comment' | 'version_create',
    durationSeconds?: number,
    metadata?: Record<string, any>
  ) => {
    if (!projectId) return

    try {
      await fetch('/api/analytics/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'asset_usage',
          data: {
            assetId,
            projectId,
            actionType,
            sessionId,
            durationSeconds,
            metadata
          }
        })
      })
    } catch (error) {
      console.error('Failed to track asset usage:', error)
    }
  }, [projectId, sessionId])

  // Track user activity
  const trackUserActivity = useCallback(async (
    activityType: 'login' | 'logout' | 'upload' | 'search' | 'collaboration' | 'folder_create' | 'asset_organize',
    activityDetails?: Record<string, any>,
    sessionDurationMinutes?: number
  ) => {
    try {
      await fetch('/api/analytics/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'user_activity',
          data: {
            projectId,
            activityType,
            activityDetails,
            sessionDurationMinutes
          }
        })
      })
    } catch (error) {
      console.error('Failed to track user activity:', error)
    }
  }, [projectId])

  // Track page view with timing
  const trackPageView = useCallback((pageName: string, additionalData?: Record<string, any>) => {
    const loadTime = Date.now() - pageLoadTime.current
    
    trackPerformance('page_load', loadTime, 'ms', {
      pageName,
      ...additionalData
    })

    trackUserActivity('search', { // Using 'search' as a general page view activity
      pageName,
      loadTime,
      ...additionalData
    })
  }, [trackPerformance, trackUserActivity])

  // Track search performance
  const trackSearchPerformance = useCallback((
    query: string,
    resultCount: number,
    responseTime: number,
    filters?: Record<string, any>
  ) => {
    trackPerformance('search_response', responseTime, 'ms', {
      query,
      resultCount,
      filters
    })

    trackUserActivity('search', {
      query,
      resultCount,
      responseTime,
      filters
    })
  }, [trackPerformance, trackUserActivity])

  // Track upload performance
  const trackUploadPerformance = useCallback((
    fileSize: number,
    uploadTime: number,
    fileType: string,
    success: boolean
  ) => {
    const uploadSpeed = (fileSize / 1024 / 1024) / (uploadTime / 1000) // MB/s
    
    trackPerformance('upload_speed', uploadSpeed, 'mbps', {
      fileSize,
      uploadTime,
      fileType,
      success
    })

    trackUserActivity('upload', {
      fileSize,
      uploadTime,
      fileType,
      success,
      uploadSpeed
    })
  }, [trackPerformance, trackUserActivity])

  // Batch event processing
  const queueEvent = useCallback((event: AnalyticsEvent) => {
    eventQueue.current.push(event)
    
    // Clear existing timeout
    if (flushTimeout.current) {
      clearTimeout(flushTimeout.current)
    }
    
    // Set new timeout to flush events
    flushTimeout.current = setTimeout(() => {
      flushEvents()
    }, 1000) // Flush after 1 second of inactivity
  }, [])

  const flushEvents = useCallback(async () => {
    if (eventQueue.current.length === 0) return

    const events = [...eventQueue.current]
    eventQueue.current = []

    try {
      await fetch('/api/analytics/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events })
      })
    } catch (error) {
      console.error('Failed to flush analytics events:', error)
      // Re-queue events on failure
      eventQueue.current.unshift(...events)
    }
  }, [])

  // Auto-track page visibility changes
  useEffect(() => {
    if (!enableAutoTracking) return

    let visibilityStartTime = Date.now()

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Page became hidden, track session duration
        const sessionDuration = Math.round((Date.now() - visibilityStartTime) / 1000 / 60)
        if (sessionDuration > 0) {
          trackUserActivity('logout', {}, sessionDuration)
        }
      } else {
        // Page became visible
        visibilityStartTime = Date.now()
        trackUserActivity('login')
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Track initial page load
    trackUserActivity('login')

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      
      // Track final session duration
      const sessionDuration = Math.round((Date.now() - sessionStartTime.current) / 1000 / 60)
      if (sessionDuration > 0) {
        trackUserActivity('logout', {}, sessionDuration)
      }
      
      // Flush any remaining events
      flushEvents()
    }
  }, [enableAutoTracking, trackUserActivity, flushEvents])

  // Auto-track performance metrics
  useEffect(() => {
    if (!enableAutoTracking) return

    // Track initial page load performance
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'navigation') {
          const navEntry = entry as PerformanceNavigationTiming
          trackPerformance('page_load', navEntry.loadEventEnd - navEntry.loadEventStart, 'ms', {
            domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.domContentLoadedEventStart,
            firstPaint: navEntry.loadEventStart - navEntry.fetchStart
          })
        }
      }
    })

    observer.observe({ entryTypes: ['navigation'] })

    return () => observer.disconnect()
  }, [enableAutoTracking, trackPerformance])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (flushTimeout.current) {
        clearTimeout(flushTimeout.current)
      }
      flushEvents()
    }
  }, [flushEvents])

  return {
    trackAssetUsage,
    trackUserActivity,
    trackPerformance,
    trackPageView,
    trackSearchPerformance,
    trackUploadPerformance,
    queueEvent,
    flushEvents
  }
}