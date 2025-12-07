import { useEffect, useCallback, useRef, useState } from 'react'
import { PerformanceMonitoringService } from '../services/performanceMonitoring'
import { LazyLoadingService } from '../services/lazyLoading'
import { CacheService } from '../services/cache'

/**
 * Hook for measuring component render performance
 */
export function useRenderPerformance(componentName: string) {
  const renderStartTime = useRef<number>(0)
  const mountTime = useRef<number>(0)

  useEffect(() => {
    mountTime.current = performance.now()
    
    return () => {
      const unmountTime = performance.now()
      const totalLifetime = unmountTime - mountTime.current
      
      PerformanceMonitoringService.recordMetric(
        `component.${componentName}.lifetime`,
        totalLifetime,
        'ms'
      )
    }
  }, [componentName])

  const startRender = useCallback(() => {
    renderStartTime.current = performance.now()
  }, [])

  const endRender = useCallback(() => {
    if (renderStartTime.current > 0) {
      const renderTime = performance.now() - renderStartTime.current
      PerformanceMonitoringService.recordMetric(
        `component.${componentName}.render`,
        renderTime,
        'ms'
      )
      renderStartTime.current = 0
    }
  }, [componentName])

  return { startRender, endRender }
}

/**
 * Hook for lazy loading images with performance tracking
 */
export function useLazyLoading(containerRef?: React.RefObject<HTMLElement>) {
  const [isInitialized, setIsInitialized] = useState(false)
  const cleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (isInitialized) return

    const cleanup = LazyLoadingService.initializeLazyLoading(
      containerRef?.current || undefined,
      {
        rootMargin: '50px',
        threshold: 0.1,
        fadeInDuration: 300,
        retryAttempts: 3
      }
    )

    cleanupRef.current = cleanup
    setIsInitialized(true)

    return () => {
      cleanup()
      cleanupRef.current = null
      setIsInitialized(false)
    }
  }, [containerRef, isInitialized])

  const loadImage = useCallback(async (img: HTMLImageElement) => {
    const startTime = performance.now()
    
    try {
      const result = await LazyLoadingService.loadImage(img)
      const loadTime = performance.now() - startTime
      
      PerformanceMonitoringService.trackImageLoad(
        img.src,
        loadTime,
        0, // Size would need to be determined separately
        result.loaded
      )
      
      return result
    } catch (error) {
      const loadTime = performance.now() - startTime
      
      PerformanceMonitoringService.trackImageLoad(
        img.src,
        loadTime,
        0,
        false
      )
      
      throw error
    }
  }, [])

  return { loadImage, isInitialized }
}

/**
 * Hook for caching API responses with performance tracking
 */
export function usePerformantCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: {
    ttl?: number
    persistent?: boolean
    enabled?: boolean
  } = {}
) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const {
    ttl = 5 * 60 * 1000, // 5 minutes
    persistent = false,
    enabled = true
  } = options

  const fetchData = useCallback(async () => {
    if (!enabled) return

    setLoading(true)
    setError(null)

    const startTime = performance.now()
    let cacheHit = false

    try {
      const result = await CacheService.getOrFetch(
        key,
        async () => {
          const fetchResult = await fetcher()
          cacheHit = false
          return fetchResult
        },
        { ttl, persistent }
      )

      // Check if it was a cache hit
      cacheHit = CacheService.has(key)

      const duration = performance.now() - startTime

      PerformanceMonitoringService.recordMetric(
        'cache.fetch',
        duration,
        'ms',
        {
          key,
          hit: cacheHit.toString(),
          persistent: persistent.toString()
        }
      )

      setData(result)
    } catch (err) {
      const duration = performance.now() - startTime
      const error = err instanceof Error ? err : new Error('Unknown error')
      
      PerformanceMonitoringService.recordMetric(
        'cache.fetch',
        duration,
        'ms',
        {
          key,
          hit: 'false',
          error: 'true'
        }
      )

      setError(error)
    } finally {
      setLoading(false)
    }
  }, [key, fetcher, ttl, persistent, enabled])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const invalidate = useCallback(() => {
    CacheService.delete(key)
    fetchData()
  }, [key, fetchData])

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    invalidate
  }
}

/**
 * Hook for debounced search with performance tracking
 */
export function usePerformantSearch<T>(
  searchFn: (query: string) => Promise<T>,
  debounceMs: number = 300
) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  const debounceRef = useRef<NodeJS.Timeout>()
  const abortControllerRef = useRef<AbortController>()

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults(null)
      return
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    abortControllerRef.current = new AbortController()
    setLoading(true)
    setError(null)

    const startTime = performance.now()

    try {
      const result = await searchFn(searchQuery)
      const duration = performance.now() - startTime
      
      PerformanceMonitoringService.trackSearchPerformance(
        searchQuery,
        Array.isArray(result) ? result.length : 1,
        duration,
        false // Assuming not cached for now
      )

      setResults(result)
    } catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        const duration = performance.now() - startTime
        
        PerformanceMonitoringService.recordMetric(
          'search.error',
          duration,
          'ms',
          { query: searchQuery }
        )

        setError(err)
      }
    } finally {
      setLoading(false)
    }
  }, [searchFn])

  const debouncedSearch = useCallback((searchQuery: string) => {
    setQuery(searchQuery)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      search(searchQuery)
    }, debounceMs)
  }, [search, debounceMs])

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  return {
    query,
    results,
    loading,
    error,
    search: debouncedSearch,
    clearResults: () => setResults(null)
  }
}

/**
 * Hook for tracking user interactions and performance
 */
export function useInteractionTracking(elementName: string) {
  const interactionStartTime = useRef<number>(0)

  const trackClick = useCallback((event: React.MouseEvent) => {
    PerformanceMonitoringService.recordMetric(
      `interaction.${elementName}.click`,
      1,
      'count',
      {
        target: (event.target as HTMLElement).tagName.toLowerCase()
      }
    )
  }, [elementName])

  const trackHover = useCallback(() => {
    PerformanceMonitoringService.recordMetric(
      `interaction.${elementName}.hover`,
      1,
      'count'
    )
  }, [elementName])

  const startInteraction = useCallback(() => {
    interactionStartTime.current = performance.now()
  }, [])

  const endInteraction = useCallback((interactionType: string) => {
    if (interactionStartTime.current > 0) {
      const duration = performance.now() - interactionStartTime.current
      
      PerformanceMonitoringService.recordMetric(
        `interaction.${elementName}.${interactionType}.duration`,
        duration,
        'ms'
      )
      
      interactionStartTime.current = 0
    }
  }, [elementName])

  return {
    trackClick,
    trackHover,
    startInteraction,
    endInteraction
  }
}

/**
 * Hook for monitoring component visibility and performance
 */
export function useVisibilityTracking(
  ref: React.RefObject<HTMLElement>,
  componentName: string
) {
  const [isVisible, setIsVisible] = useState(false)
  const visibilityStartTime = useRef<number>(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const wasVisible = isVisible
        const nowVisible = entry.isIntersecting

        setIsVisible(nowVisible)

        if (!wasVisible && nowVisible) {
          // Element became visible
          visibilityStartTime.current = performance.now()
          
          PerformanceMonitoringService.recordMetric(
            `visibility.${componentName}.enter`,
            1,
            'count'
          )
        } else if (wasVisible && !nowVisible) {
          // Element became hidden
          if (visibilityStartTime.current > 0) {
            const visibilityDuration = performance.now() - visibilityStartTime.current
            
            PerformanceMonitoringService.recordMetric(
              `visibility.${componentName}.duration`,
              visibilityDuration,
              'ms'
            )
          }

          PerformanceMonitoringService.recordMetric(
            `visibility.${componentName}.exit`,
            1,
            'count'
          )
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(element)

    return () => {
      observer.disconnect()
    }
  }, [ref, componentName, isVisible])

  return { isVisible }
}