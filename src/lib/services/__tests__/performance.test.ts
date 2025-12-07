import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PerformanceMonitoringService } from '../performanceMonitoring'
import { CacheService } from '../cache'
import { LazyLoadingService } from '../lazyLoading'
import { CDNService } from '../cdn'
import { BackgroundJobService } from '../backgroundJobs'

// Mock performance API
const mockPerformance = {
  now: vi.fn(() => Date.now()),
  getEntriesByType: vi.fn(() => []),
  mark: vi.fn(),
  measure: vi.fn()
}

Object.defineProperty(global, 'performance', {
  value: mockPerformance,
  writable: true
})

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn()
mockIntersectionObserver.prototype.observe = vi.fn()
mockIntersectionObserver.prototype.unobserve = vi.fn()
mockIntersectionObserver.prototype.disconnect = vi.fn()
Object.defineProperty(global, 'IntersectionObserver', {
  value: mockIntersectionObserver,
  writable: true
})

// Mock PerformanceObserver
const mockPerformanceObserver = vi.fn()
mockPerformanceObserver.prototype.observe = vi.fn()
mockPerformanceObserver.prototype.disconnect = vi.fn()
Object.defineProperty(global, 'PerformanceObserver', {
  value: mockPerformanceObserver,
  writable: true
})

describe('Performance Monitoring Service', () => {
  beforeEach(() => {
    PerformanceMonitoringService.clear()
    vi.clearAllMocks()
  })

  afterEach(() => {
    PerformanceMonitoringService.cleanup()
  })

  describe('Metric Recording', () => {
    it('should record performance metrics', () => {
      PerformanceMonitoringService.recordMetric('test.metric', 100, 'ms', { tag: 'value' })
      
      const metrics = PerformanceMonitoringService.getMetrics()
      expect(metrics).toHaveLength(1)
      expect(metrics[0]).toMatchObject({
        name: 'test.metric',
        value: 100,
        unit: 'ms',
        tags: { tag: 'value' }
      })
    })

    it('should limit metrics to prevent memory leaks', () => {
      // Record more than 1000 metrics
      for (let i = 0; i < 1100; i++) {
        PerformanceMonitoringService.recordMetric(`test.metric.${i}`, i, 'ms')
      }
      
      const metrics = PerformanceMonitoringService.getMetrics()
      expect(metrics).toHaveLength(1000)
    })

    it('should filter metrics correctly', () => {
      PerformanceMonitoringService.recordMetric('upload.duration', 100, 'ms', { type: 'image' })
      PerformanceMonitoringService.recordMetric('upload.duration', 200, 'ms', { type: 'video' })
      PerformanceMonitoringService.recordMetric('search.duration', 50, 'ms')
      
      const uploadMetrics = PerformanceMonitoringService.getMetrics({ name: 'upload' })
      expect(uploadMetrics).toHaveLength(2)
      
      const imageMetrics = PerformanceMonitoringService.getMetrics({ 
        tags: { type: 'image' } 
      })
      expect(imageMetrics).toHaveLength(1)
    })
  })

  describe('Benchmarking', () => {
    it('should create and complete benchmarks', () => {
      const benchmarkId = PerformanceMonitoringService.startBenchmark('test.benchmark')
      expect(benchmarkId).toBeDefined()
      
      PerformanceMonitoringService.addBenchmarkMetric(benchmarkId, 'step1', 50, 'ms')
      PerformanceMonitoringService.addBenchmarkMetric(benchmarkId, 'step2', 75, 'ms')
      
      const benchmark = PerformanceMonitoringService.endBenchmark(benchmarkId)
      
      expect(benchmark).toBeDefined()
      expect(benchmark?.status).toBe('completed')
      expect(benchmark?.metrics).toHaveLength(2)
      expect(benchmark?.duration).toBeDefined()
    })

    it('should handle invalid benchmark operations', () => {
      const result = PerformanceMonitoringService.endBenchmark('invalid-id')
      expect(result).toBeNull()
      
      PerformanceMonitoringService.addBenchmarkMetric('invalid-id', 'test', 100, 'ms')
      // Should not throw
    })
  })

  describe('Function Measurement', () => {
    it('should measure async function performance', async () => {
      const testFunction = async () => {
        await new Promise(resolve => setTimeout(resolve, 100))
        return 'result'
      }
      
      const result = await PerformanceMonitoringService.measureAsync(
        'test.function',
        testFunction,
        { category: 'test' }
      )
      
      expect(result).toBe('result')
      
      const metrics = PerformanceMonitoringService.getMetrics({ name: 'function.test.function' })
      expect(metrics).toHaveLength(1)
      expect(metrics[0].tags?.status).toBe('success')
      expect(metrics[0].tags?.category).toBe('test')
    })

    it('should measure sync function performance', () => {
      const testFunction = () => {
        // Simulate some work
        let sum = 0
        for (let i = 0; i < 1000; i++) {
          sum += i
        }
        return sum
      }
      
      const result = PerformanceMonitoringService.measure('test.sync', testFunction)
      
      expect(result).toBe(499500) // Sum of 0 to 999
      
      const metrics = PerformanceMonitoringService.getMetrics({ name: 'function.test.sync' })
      expect(metrics).toHaveLength(1)
      expect(metrics[0].tags?.status).toBe('success')
    })

    it('should handle function errors correctly', async () => {
      const errorFunction = async () => {
        throw new Error('Test error')
      }
      
      await expect(
        PerformanceMonitoringService.measureAsync('test.error', errorFunction)
      ).rejects.toThrow('Test error')
      
      const metrics = PerformanceMonitoringService.getMetrics({ name: 'function.test.error' })
      expect(metrics).toHaveLength(1)
      expect(metrics[0].tags?.status).toBe('error')
    })
  })

  describe('Asset Performance Tracking', () => {
    it('should track upload performance', () => {
      PerformanceMonitoringService.trackAssetUpload(
        1024 * 1024, // 1MB
        'image/jpeg',
        2000, // 2 seconds
        true
      )
      
      const durationMetrics = PerformanceMonitoringService.getMetrics({ 
        name: 'asset.upload.duration' 
      })
      const sizeMetrics = PerformanceMonitoringService.getMetrics({ 
        name: 'asset.upload.size' 
      })
      const throughputMetrics = PerformanceMonitoringService.getMetrics({ 
        name: 'asset.upload.throughput' 
      })
      
      expect(durationMetrics).toHaveLength(1)
      expect(sizeMetrics).toHaveLength(1)
      expect(throughputMetrics).toHaveLength(1)
      
      expect(durationMetrics[0].value).toBe(2000)
      expect(sizeMetrics[0].value).toBe(1024 * 1024)
      expect(throughputMetrics[0].value).toBe(1024 * 1024 / 2) // bytes per second
    })

    it('should track search performance', () => {
      PerformanceMonitoringService.trackSearchPerformance(
        'test query',
        25, // results
        150, // 150ms
        false // not cached
      )
      
      const durationMetrics = PerformanceMonitoringService.getMetrics({ 
        name: 'search.duration' 
      })
      const resultMetrics = PerformanceMonitoringService.getMetrics({ 
        name: 'search.results' 
      })
      
      expect(durationMetrics).toHaveLength(1)
      expect(resultMetrics).toHaveLength(1)
      
      expect(durationMetrics[0].value).toBe(150)
      expect(durationMetrics[0].tags?.cached).toBe('false')
      expect(resultMetrics[0].value).toBe(25)
    })

    it('should track image loading performance', () => {
      PerformanceMonitoringService.trackImageLoad(
        'https://example.com/image.jpg',
        500, // 500ms
        1024 * 500, // 500KB
        true
      )
      
      const loadMetrics = PerformanceMonitoringService.getMetrics({ 
        name: 'image.load.duration' 
      })
      const sizeMetrics = PerformanceMonitoringService.getMetrics({ 
        name: 'image.load.size' 
      })
      const throughputMetrics = PerformanceMonitoringService.getMetrics({ 
        name: 'image.load.throughput' 
      })
      
      expect(loadMetrics).toHaveLength(1)
      expect(sizeMetrics).toHaveLength(1)
      expect(throughputMetrics).toHaveLength(1)
      
      expect(loadMetrics[0].tags?.success).toBe('true')
    })
  })

  describe('Statistics Calculation', () => {
    it('should calculate performance statistics', () => {
      const values = [100, 150, 200, 250, 300, 350, 400, 450, 500, 1000]
      
      values.forEach((value, index) => {
        PerformanceMonitoringService.recordMetric('test.stats', value, 'ms')
      })
      
      const stats = PerformanceMonitoringService.getStats('test.stats')
      
      expect(stats.count).toBe(10)
      expect(stats.min).toBe(100)
      expect(stats.max).toBe(1000)
      expect(stats.avg).toBe(370) // Average of the values
      expect(stats.p50).toBe(300) // 50th percentile
      expect(stats.p95).toBe(500) // 95th percentile
      expect(stats.p99).toBe(1000) // 99th percentile
    })

    it('should handle empty metrics for statistics', () => {
      const stats = PerformanceMonitoringService.getStats('nonexistent.metric')
      
      expect(stats.count).toBe(0)
      expect(stats.min).toBe(0)
      expect(stats.max).toBe(0)
      expect(stats.avg).toBe(0)
      expect(stats.p50).toBe(0)
      expect(stats.p95).toBe(0)
      expect(stats.p99).toBe(0)
    })
  })
})

describe('Cache Service Performance', () => {
  beforeEach(() => {
    CacheService.clear()
  })

  describe('Memory Cache Performance', () => {
    it('should handle large number of cache operations efficiently', () => {
      const startTime = performance.now()
      
      // Set 1000 items
      for (let i = 0; i < 1000; i++) {
        CacheService.set(`key-${i}`, { data: `value-${i}`, index: i })
      }
      
      // Get 1000 items
      for (let i = 0; i < 1000; i++) {
        CacheService.get(`key-${i}`)
      }
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Should complete in reasonable time (less than 100ms)
      expect(duration).toBeLessThan(100)
    })

    it('should maintain good hit rates', () => {
      // Set up cache with some data
      for (let i = 0; i < 100; i++) {
        CacheService.set(`item-${i}`, { value: i }, { ttl: 10000 })
      }
      
      // Access items multiple times
      let hits = 0
      let total = 0
      
      for (let i = 0; i < 100; i++) {
        total++
        if (CacheService.get(`item-${i}`) !== null) {
          hits++
        }
      }
      
      const hitRate = hits / total
      expect(hitRate).toBeGreaterThan(0.9) // 90% hit rate
    })

    it('should handle cache cleanup efficiently', () => {
      // Fill cache with expired items
      for (let i = 0; i < 100; i++) {
        CacheService.set(`expired-${i}`, { value: i }, { ttl: 1 }) // 1ms TTL
      }
      
      // Wait for expiration
      setTimeout(() => {
        const startTime = performance.now()
        CacheService.cleanupExpired()
        const endTime = performance.now()
        
        expect(endTime - startTime).toBeLessThan(50) // Should be fast
      }, 10)
    })
  })

  describe('Batch Operations Performance', () => {
    it('should handle batch operations efficiently', () => {
      const entries = Array.from({ length: 100 }, (_, i) => ({
        key: `batch-${i}`,
        data: { value: i, timestamp: Date.now() }
      }))
      
      const startTime = performance.now()
      CacheService.setBatch(entries)
      const endTime = performance.now()
      
      expect(endTime - startTime).toBeLessThan(50)
      
      // Verify all items were set
      const keys = entries.map(e => e.key)
      const results = CacheService.getBatch(keys)
      
      expect(results.filter(r => r.data !== null)).toHaveLength(100)
    })
  })
})

describe('CDN Service Performance', () => {
  describe('URL Generation Performance', () => {
    it('should generate optimized URLs quickly', () => {
      const urls = Array.from({ length: 1000 }, (_, i) => 
        `https://example.com/image-${i}.jpg`
      )
      
      const startTime = performance.now()
      
      urls.forEach(url => {
        CDNService.getOptimizedImageUrl(url, {
          width: 300,
          height: 300,
          quality: 80,
          format: 'webp'
        })
      })
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      expect(duration).toBeLessThan(100) // Should be very fast
    })

    it('should generate responsive URLs efficiently', () => {
      const startTime = performance.now()
      
      for (let i = 0; i < 100; i++) {
        CDNService.getResponsiveImageUrls(`https://example.com/image-${i}.jpg`)
      }
      
      const endTime = performance.now()
      expect(endTime - startTime).toBeLessThan(50)
    })
  })
})

describe('Background Jobs Performance', () => {
  let jobService: BackgroundJobService

  beforeEach(() => {
    jobService = BackgroundJobService.getInstance()
  })

  describe('Job Processing Performance', () => {
    it('should process jobs efficiently', async () => {
      // Register a simple processor
      jobService.registerProcessor('test-job', {
        process: async (data: { value: number }) => {
          await new Promise(resolve => setTimeout(resolve, 10)) // 10ms work
          return data.value * 2
        }
      })

      const startTime = performance.now()
      
      // Add multiple jobs
      const jobIds = []
      for (let i = 0; i < 10; i++) {
        const jobId = jobService.addJob('test-job', { value: i })
        jobIds.push(jobId)
      }
      
      // Wait for all jobs to complete
      await new Promise(resolve => {
        const checkCompletion = () => {
          const completedJobs = jobIds.filter(id => {
            const job = jobService.getJob(id)
            return job?.status === 'completed'
          })
          
          if (completedJobs.length === jobIds.length) {
            resolve(undefined)
          } else {
            setTimeout(checkCompletion, 10)
          }
        }
        checkCompletion()
      })
      
      const endTime = performance.now()
      const duration = endTime - startTime
      
      // Should complete reasonably quickly (accounting for 10ms per job + overhead)
      expect(duration).toBeLessThan(500)
      
      // Verify all jobs completed successfully
      jobIds.forEach(id => {
        const job = jobService.getJob(id)
        expect(job?.status).toBe('completed')
      })
    })

    it('should handle job queue efficiently', () => {
      const startTime = performance.now()
      
      // Add many jobs quickly
      for (let i = 0; i < 1000; i++) {
        jobService.addJob('test-job', { value: i }, { priority: 'normal' })
      }
      
      const endTime = performance.now()
      expect(endTime - startTime).toBeLessThan(100)
      
      const stats = jobService.getStats()
      expect(stats.pending).toBe(1000)
    })
  })
})

describe('Integration Performance Tests', () => {
  it('should handle complex asset workflow efficiently', async () => {
    const startTime = performance.now()
    
    // Simulate complex asset processing workflow
    const benchmarkId = PerformanceMonitoringService.startBenchmark('asset.workflow')
    
    // Step 1: Cache check
    PerformanceMonitoringService.addBenchmarkMetric(benchmarkId, 'cache.check', 5, 'ms')
    
    // Step 2: Upload simulation
    PerformanceMonitoringService.addBenchmarkMetric(benchmarkId, 'upload', 1500, 'ms')
    
    // Step 3: Thumbnail generation
    PerformanceMonitoringService.addBenchmarkMetric(benchmarkId, 'thumbnail', 300, 'ms')
    
    // Step 4: Metadata extraction
    PerformanceMonitoringService.addBenchmarkMetric(benchmarkId, 'metadata', 200, 'ms')
    
    // Step 5: Database save
    PerformanceMonitoringService.addBenchmarkMetric(benchmarkId, 'database', 100, 'ms')
    
    const benchmark = PerformanceMonitoringService.endBenchmark(benchmarkId)
    
    const endTime = performance.now()
    const totalDuration = endTime - startTime
    
    expect(benchmark).toBeDefined()
    expect(benchmark?.metrics).toHaveLength(5)
    expect(totalDuration).toBeLessThan(100) // Benchmark overhead should be minimal
    
    // Verify workflow metrics were recorded
    const workflowMetrics = PerformanceMonitoringService.getMetrics({ 
      name: 'benchmark.asset.workflow' 
    })
    expect(workflowMetrics).toHaveLength(1)
  })

  it('should maintain performance under concurrent load', async () => {
    const concurrentOperations = 50
    const operations = []
    
    const startTime = performance.now()
    
    // Simulate concurrent cache operations
    for (let i = 0; i < concurrentOperations; i++) {
      operations.push(
        CacheService.getOrFetch(
          `concurrent-${i}`,
          async () => {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 10))
            return { data: `result-${i}` }
          }
        )
      )
    }
    
    const results = await Promise.all(operations)
    const endTime = performance.now()
    
    expect(results).toHaveLength(concurrentOperations)
    expect(endTime - startTime).toBeLessThan(200) // Should handle concurrency well
    
    // Verify all operations completed successfully
    results.forEach((result, index) => {
      expect(result).toEqual({ data: `result-${index}` })
    })
  })
})