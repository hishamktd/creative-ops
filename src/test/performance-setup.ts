import { beforeEach, afterEach } from 'vitest'

// Performance monitoring utilities
global.performance = global.performance || {
  now: () => Date.now(),
  mark: () => {},
  measure: () => {},
  getEntriesByName: () => [],
  getEntriesByType: () => [],
  clearMarks: () => {},
  clearMeasures: () => {},
}

// Mock performance observer for performance tests
global.PerformanceObserver = class PerformanceObserver {
  constructor(callback: PerformanceObserverCallback) {
    this.callback = callback
  }
  
  callback: PerformanceObserverCallback
  
  observe() {}
  disconnect() {}
  takeRecords() { return [] }
}

// Mock intersection observer for lazy loading tests
global.IntersectionObserver = class IntersectionObserver {
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
  }
  
  callback: IntersectionObserverCallback
  
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Mock ResizeObserver for responsive tests
global.ResizeObserver = class ResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }
  
  callback: ResizeObserverCallback
  
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Performance test utilities
export const measurePerformance = async (fn: () => Promise<void> | void, label: string) => {
  const start = performance.now()
  await fn()
  const end = performance.now()
  const duration = end - start
  
  console.log(`Performance: ${label} took ${duration.toFixed(2)}ms`)
  return duration
}

export const expectPerformance = (duration: number, maxDuration: number, label: string) => {
  if (duration > maxDuration) {
    throw new Error(`Performance test failed: ${label} took ${duration.toFixed(2)}ms, expected < ${maxDuration}ms`)
  }
}

// Memory usage tracking
export const measureMemoryUsage = () => {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage()
  }
  return { heapUsed: 0, heapTotal: 0, external: 0, rss: 0 }
}

beforeEach(() => {
  // Clear performance marks before each test
  if (performance.clearMarks) {
    performance.clearMarks()
  }
  if (performance.clearMeasures) {
    performance.clearMeasures()
  }
})

afterEach(() => {
  // Clean up after performance tests
  if (performance.clearMarks) {
    performance.clearMarks()
  }
  if (performance.clearMeasures) {
    performance.clearMeasures()
  }
})