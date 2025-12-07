export interface PerformanceMetric {
  name: string
  value: number
  unit: 'ms' | 'bytes' | 'count' | 'percentage'
  timestamp: number
  tags?: Record<string, string>
}

export interface PerformanceBenchmark {
  id: string
  name: string
  description: string
  startTime: number
  endTime?: number
  duration?: number
  metrics: PerformanceMetric[]
  status: 'running' | 'completed' | 'failed'
  error?: string
}

export interface WebVitalsMetrics {
  FCP?: number // First Contentful Paint
  LCP?: number // Largest Contentful Paint
  FID?: number // First Input Delay
  CLS?: number // Cumulative Layout Shift
  TTFB?: number // Time to First Byte
}

export class PerformanceMonitoringService {
  private static metrics: PerformanceMetric[] = []
  private static benchmarks = new Map<string, PerformanceBenchmark>()
  private static observers: PerformanceObserver[] = []
  private static isInitialized = false

  /**
   * Initialize performance monitoring
   */
  static initialize(): void {
    if (this.isInitialized || typeof window === 'undefined') return

    this.setupPerformanceObservers()
    this.setupWebVitalsTracking()
    this.setupResourceTimingTracking()
    this.isInitialized = true
  }

  /**
   * Record a performance metric
   */
  static recordMetric(
    name: string,
    value: number,
    unit: PerformanceMetric['unit'] = 'ms',
    tags?: Record<string, string>
  ): void {
    const metric: PerformanceMetric = {
      name,
      value,
      unit,
      timestamp: Date.now(),
      tags
    }

    this.metrics.push(metric)

    // Keep only last 1000 metrics to prevent memory leaks
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }

    // Send to analytics if configured
    this.sendToAnalytics(metric)
  }

  /**
   * Start a performance benchmark
   */
  static startBenchmark(name: string, description: string = ''): string {
    const id = `benchmark_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
    
    const benchmark: PerformanceBenchmark = {
      id,
      name,
      description,
      startTime: performance.now(),
      metrics: [],
      status: 'running'
    }

    this.benchmarks.set(id, benchmark)
    return id
  }

  /**
   * End a performance benchmark
   */
  static endBenchmark(id: string): PerformanceBenchmark | null {
    const benchmark = this.benchmarks.get(id)
    if (!benchmark || benchmark.status !== 'running') {
      return null
    }

    benchmark.endTime = performance.now()
    benchmark.duration = benchmark.endTime - benchmark.startTime
    benchmark.status = 'completed'

    this.recordMetric(
      `benchmark.${benchmark.name}`,
      benchmark.duration,
      'ms',
      { benchmarkId: id }
    )

    return benchmark
  }

  /**
   * Add metric to running benchmark
   */
  static addBenchmarkMetric(
    benchmarkId: string,
    name: string,
    value: number,
    unit: PerformanceMetric['unit'] = 'ms'
  ): void {
    const benchmark = this.benchmarks.get(benchmarkId)
    if (!benchmark || benchmark.status !== 'running') {
      return
    }

    benchmark.metrics.push({
      name,
      value,
      unit,
      timestamp: Date.now()
    })
  }

  /**
   * Measure function execution time
   */
  static async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    const startTime = performance.now()
    
    try {
      const result = await fn()
      const duration = performance.now() - startTime
      
      this.recordMetric(`function.${name}`, duration, 'ms', {
        ...tags,
        status: 'success'
      })
      
      return result
    } catch (error) {
      const duration = performance.now() - startTime
      
      this.recordMetric(`function.${name}`, duration, 'ms', {
        ...tags,
        status: 'error'
      })
      
      throw error
    }
  }

  /**
   * Measure synchronous function execution time
   */
  static measure<T>(
    name: string,
    fn: () => T,
    tags?: Record<string, string>
  ): T {
    const startTime = performance.now()
    
    try {
      const result = fn()
      const duration = performance.now() - startTime
      
      this.recordMetric(`function.${name}`, duration, 'ms', {
        ...tags,
        status: 'success'
      })
      
      return result
    } catch (error) {
      const duration = performance.now() - startTime
      
      this.recordMetric(`function.${name}`, duration, 'ms', {
        ...tags,
        status: 'error'
      })
      
      throw error
    }
  }

  /**
   * Track asset upload performance
   */
  static trackAssetUpload(
    fileSize: number,
    fileType: string,
    uploadDuration: number,
    success: boolean
  ): void {
    this.recordMetric('asset.upload.duration', uploadDuration, 'ms', {
      fileType,
      success: success.toString()
    })

    this.recordMetric('asset.upload.size', fileSize, 'bytes', {
      fileType,
      success: success.toString()
    })

    if (success && uploadDuration > 0) {
      const throughput = fileSize / (uploadDuration / 1000) // bytes per second
      this.recordMetric('asset.upload.throughput', throughput, 'bytes', {
        fileType
      })
    }
  }

  /**
   * Track search performance
   */
  static trackSearchPerformance(
    query: string,
    resultCount: number,
    duration: number,
    cached: boolean
  ): void {
    this.recordMetric('search.duration', duration, 'ms', {
      cached: cached.toString(),
      hasResults: (resultCount > 0).toString()
    })

    this.recordMetric('search.results', resultCount, 'count', {
      cached: cached.toString()
    })

    if (query.length > 0) {
      this.recordMetric('search.query_length', query.length, 'count')
    }
  }

  /**
   * Track image loading performance
   */
  static trackImageLoad(
    imageUrl: string,
    loadTime: number,
    imageSize: number,
    success: boolean
  ): void {
    this.recordMetric('image.load.duration', loadTime, 'ms', {
      success: success.toString()
    })

    if (success && imageSize > 0) {
      this.recordMetric('image.load.size', imageSize, 'bytes')
      
      const throughput = imageSize / (loadTime / 1000)
      this.recordMetric('image.load.throughput', throughput, 'bytes')
    }
  }

  /**
   * Get performance metrics with filtering
   */
  static getMetrics(filter?: {
    name?: string
    since?: number
    tags?: Record<string, string>
  }): PerformanceMetric[] {
    let filtered = this.metrics

    if (filter?.name) {
      filtered = filtered.filter(m => m.name.includes(filter.name!))
    }

    if (filter?.since) {
      filtered = filtered.filter(m => m.timestamp >= filter.since!)
    }

    if (filter?.tags) {
      filtered = filtered.filter(m => {
        if (!m.tags) return false
        return Object.entries(filter.tags!).every(([key, value]) => 
          m.tags![key] === value
        )
      })
    }

    return filtered
  }

  /**
   * Get performance statistics
   */
  static getStats(metricName: string, since?: number): {
    count: number
    min: number
    max: number
    avg: number
    p50: number
    p95: number
    p99: number
  } {
    const metrics = this.getMetrics({ name: metricName, since })
    
    if (metrics.length === 0) {
      return {
        count: 0,
        min: 0,
        max: 0,
        avg: 0,
        p50: 0,
        p95: 0,
        p99: 0
      }
    }

    const values = metrics.map(m => m.value).sort((a, b) => a - b)
    const count = values.length
    const sum = values.reduce((a, b) => a + b, 0)

    return {
      count,
      min: values[0],
      max: values[count - 1],
      avg: sum / count,
      p50: values[Math.floor(count * 0.5)],
      p95: values[Math.floor(count * 0.95)],
      p99: values[Math.floor(count * 0.99)]
    }
  }

  /**
   * Get Web Vitals metrics
   */
  static getWebVitals(): WebVitalsMetrics {
    if (typeof window === 'undefined') return {}

    const vitals: WebVitalsMetrics = {}

    // Get paint metrics
    const paintEntries = performance.getEntriesByType('paint')
    const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint')
    if (fcpEntry) {
      vitals.FCP = fcpEntry.startTime
    }

    // Get navigation timing
    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
    if (navEntries.length > 0) {
      const navEntry = navEntries[0]
      vitals.TTFB = navEntry.responseStart - navEntry.requestStart
    }

    // LCP, FID, and CLS would typically be measured using the web-vitals library
    // For now, we'll check if they're available in our metrics
    const lcpMetric = this.metrics.find(m => m.name === 'web-vitals.LCP')
    const fidMetric = this.metrics.find(m => m.name === 'web-vitals.FID')
    const clsMetric = this.metrics.find(m => m.name === 'web-vitals.CLS')

    if (lcpMetric) vitals.LCP = lcpMetric.value
    if (fidMetric) vitals.FID = fidMetric.value
    if (clsMetric) vitals.CLS = clsMetric.value

    return vitals
  }

  /**
   * Setup performance observers
   */
  private static setupPerformanceObservers(): void {
    if (!('PerformanceObserver' in window)) return

    // Observe long tasks
    try {
      const longTaskObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.recordMetric('long-task.duration', entry.duration, 'ms')
        }
      })
      longTaskObserver.observe({ entryTypes: ['longtask'] })
      this.observers.push(longTaskObserver)
    } catch (e) {
      // Long task API not supported
    }

    // Observe layout shifts
    try {
      const layoutShiftObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
            this.recordMetric('layout-shift.value', (entry as any).value, 'count')
          }
        }
      })
      layoutShiftObserver.observe({ entryTypes: ['layout-shift'] })
      this.observers.push(layoutShiftObserver)
    } catch (e) {
      // Layout shift API not supported
    }
  }

  /**
   * Setup Web Vitals tracking
   */
  private static setupWebVitalsTracking(): void {
    // This would typically use the web-vitals library
    // For now, we'll set up basic tracking

    // Track FCP
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          this.recordMetric('web-vitals.FCP', entry.startTime, 'ms')
        }
      }
    })

    try {
      observer.observe({ entryTypes: ['paint'] })
      this.observers.push(observer)
    } catch (e) {
      // Paint API not supported
    }
  }

  /**
   * Setup resource timing tracking
   */
  private static setupResourceTimingTracking(): void {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const resourceEntry = entry as PerformanceResourceTiming
        
        this.recordMetric('resource.duration', resourceEntry.duration, 'ms', {
          type: this.getResourceType(resourceEntry.name),
          cached: (resourceEntry.transferSize === 0).toString()
        })

        if (resourceEntry.transferSize > 0) {
          this.recordMetric('resource.size', resourceEntry.transferSize, 'bytes', {
            type: this.getResourceType(resourceEntry.name)
          })
        }
      }
    })

    try {
      observer.observe({ entryTypes: ['resource'] })
      this.observers.push(observer)
    } catch (e) {
      // Resource timing API not supported
    }
  }

  /**
   * Get resource type from URL
   */
  private static getResourceType(url: string): string {
    if (url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) return 'image'
    if (url.match(/\.(js)$/i)) return 'script'
    if (url.match(/\.(css)$/i)) return 'stylesheet'
    if (url.match(/\.(woff|woff2|ttf|otf)$/i)) return 'font'
    if (url.match(/\.(mp4|webm|mov|avi)$/i)) return 'video'
    if (url.match(/\.(mp3|wav|ogg)$/i)) return 'audio'
    return 'other'
  }

  /**
   * Send metrics to analytics service
   */
  private static sendToAnalytics(metric: PerformanceMetric): void {
    // This would send to your analytics service
    // For now, we'll just log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.debug('Performance Metric:', metric)
    }
  }

  /**
   * Cleanup observers
   */
  static cleanup(): void {
    this.observers.forEach(observer => observer.disconnect())
    this.observers = []
    this.isInitialized = false
  }

  /**
   * Export metrics for analysis
   */
  static exportMetrics(): {
    metrics: PerformanceMetric[]
    benchmarks: PerformanceBenchmark[]
    webVitals: WebVitalsMetrics
    timestamp: number
  } {
    return {
      metrics: [...this.metrics],
      benchmarks: Array.from(this.benchmarks.values()),
      webVitals: this.getWebVitals(),
      timestamp: Date.now()
    }
  }

  /**
   * Clear all metrics and benchmarks
   */
  static clear(): void {
    this.metrics = []
    this.benchmarks.clear()
  }
}

// Auto-initialize when in browser
if (typeof window !== 'undefined') {
  PerformanceMonitoringService.initialize()
}