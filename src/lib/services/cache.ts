export interface CacheOptions {
  ttl?: number // Time to live in milliseconds
  maxSize?: number // Maximum cache size in MB
  persistent?: boolean // Use localStorage for persistence
}

export interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
  size: number
}

export interface CacheStats {
  size: number
  count: number
  hitRate: number
  missRate: number
}

export class CacheService {
  private static memoryCache = new Map<string, CacheEntry<any>>()
  private static cacheStats = {
    hits: 0,
    misses: 0,
    totalRequests: 0
  }
  
  private static readonly DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes
  private static readonly MAX_MEMORY_SIZE = 50 * 1024 * 1024 // 50MB
  private static readonly STORAGE_PREFIX = 'creativeops_cache_'

  /**
   * Set item in cache
   */
  static set<T>(
    key: string, 
    data: T, 
    options: CacheOptions = {}
  ): void {
    const {
      ttl = this.DEFAULT_TTL,
      persistent = false
    } = options

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl,
      size: this.calculateSize(data)
    }

    // Store in memory cache
    this.memoryCache.set(key, entry)

    // Store in localStorage if persistent
    if (persistent && typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          `${this.STORAGE_PREFIX}${key}`,
          JSON.stringify(entry)
        )
      } catch (error) {
        console.warn('Failed to store in localStorage:', error)
      }
    }

    // Clean up if memory cache is too large
    this.cleanupMemoryCache()
  }

  /**
   * Get item from cache
   */
  static get<T>(key: string): T | null {
    this.cacheStats.totalRequests++

    // Try memory cache first
    const memoryEntry = this.memoryCache.get(key)
    if (memoryEntry && this.isEntryValid(memoryEntry)) {
      this.cacheStats.hits++
      return memoryEntry.data
    }

    // Try localStorage if not in memory
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(`${this.STORAGE_PREFIX}${key}`)
        if (stored) {
          const entry: CacheEntry<T> = JSON.parse(stored)
          if (this.isEntryValid(entry)) {
            // Restore to memory cache
            this.memoryCache.set(key, entry)
            this.cacheStats.hits++
            return entry.data
          } else {
            // Remove expired entry
            localStorage.removeItem(`${this.STORAGE_PREFIX}${key}`)
          }
        }
      } catch (error) {
        console.warn('Failed to read from localStorage:', error)
      }
    }

    this.cacheStats.misses++
    return null
  }

  /**
   * Check if item exists in cache
   */
  static has(key: string): boolean {
    return this.get(key) !== null
  }

  /**
   * Remove item from cache
   */
  static delete(key: string): void {
    this.memoryCache.delete(key)
    
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`${this.STORAGE_PREFIX}${key}`)
    }
  }

  /**
   * Clear all cache
   */
  static clear(): void {
    this.memoryCache.clear()
    
    if (typeof window !== 'undefined') {
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith(this.STORAGE_PREFIX)) {
          localStorage.removeItem(key)
        }
      })
    }
  }

  /**
   * Get cache statistics
   */
  static getStats(): CacheStats {
    const totalSize = Array.from(this.memoryCache.values())
      .reduce((sum, entry) => sum + entry.size, 0)

    return {
      size: totalSize,
      count: this.memoryCache.size,
      hitRate: this.cacheStats.totalRequests > 0 
        ? this.cacheStats.hits / this.cacheStats.totalRequests 
        : 0,
      missRate: this.cacheStats.totalRequests > 0 
        ? this.cacheStats.misses / this.cacheStats.totalRequests 
        : 0
    }
  }

  /**
   * Cache with automatic fetch on miss
   */
  static async getOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const cached = this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    const data = await fetchFn()
    this.set(key, data, options)
    return data
  }

  /**
   * Batch cache operations
   */
  static setBatch<T>(
    entries: Array<{ key: string; data: T; options?: CacheOptions }>,
    defaultOptions: CacheOptions = {}
  ): void {
    entries.forEach(({ key, data, options = {} }) => {
      this.set(key, data, { ...defaultOptions, ...options })
    })
  }

  /**
   * Get multiple items from cache
   */
  static getBatch<T>(keys: string[]): Array<{ key: string; data: T | null }> {
    return keys.map(key => ({
      key,
      data: this.get<T>(key)
    }))
  }

  /**
   * Check if cache entry is still valid
   */
  private static isEntryValid(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp < entry.ttl
  }

  /**
   * Calculate approximate size of data in bytes
   */
  private static calculateSize(data: any): number {
    try {
      return new Blob([JSON.stringify(data)]).size
    } catch {
      // Fallback estimation
      return JSON.stringify(data).length * 2
    }
  }

  /**
   * Clean up memory cache when it gets too large
   */
  private static cleanupMemoryCache(): void {
    const totalSize = Array.from(this.memoryCache.values())
      .reduce((sum, entry) => sum + entry.size, 0)

    if (totalSize > this.MAX_MEMORY_SIZE) {
      // Remove oldest entries first
      const entries = Array.from(this.memoryCache.entries())
        .sort(([, a], [, b]) => a.timestamp - b.timestamp)

      let removedSize = 0
      const targetSize = this.MAX_MEMORY_SIZE * 0.8 // Remove 20% extra

      for (const [key, entry] of entries) {
        this.memoryCache.delete(key)
        removedSize += entry.size
        
        if (totalSize - removedSize <= targetSize) {
          break
        }
      }
    }
  }

  /**
   * Clean up expired entries
   */
  static cleanupExpired(): void {
    const now = Date.now()
    
    // Clean memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (!this.isEntryValid(entry)) {
        this.memoryCache.delete(key)
      }
    }

    // Clean localStorage
    if (typeof window !== 'undefined') {
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith(this.STORAGE_PREFIX)) {
          try {
            const stored = localStorage.getItem(key)
            if (stored) {
              const entry = JSON.parse(stored)
              if (!this.isEntryValid(entry)) {
                localStorage.removeItem(key)
              }
            }
          } catch (error) {
            // Remove corrupted entries
            localStorage.removeItem(key)
          }
        }
      })
    }
  }
}

// Asset-specific cache utilities
export class AssetCacheService {
  private static readonly ASSET_CACHE_TTL = 10 * 60 * 1000 // 10 minutes
  private static readonly THUMBNAIL_CACHE_TTL = 60 * 60 * 1000 // 1 hour
  private static readonly METADATA_CACHE_TTL = 30 * 60 * 1000 // 30 minutes

  /**
   * Cache asset data
   */
  static cacheAsset(assetId: string, asset: any): void {
    CacheService.set(`asset:${assetId}`, asset, {
      ttl: this.ASSET_CACHE_TTL,
      persistent: true
    })
  }

  /**
   * Get cached asset
   */
  static getCachedAsset(assetId: string): any | null {
    return CacheService.get(`asset:${assetId}`)
  }

  /**
   * Cache thumbnail URL
   */
  static cacheThumbnail(assetId: string, thumbnailUrl: string): void {
    CacheService.set(`thumbnail:${assetId}`, thumbnailUrl, {
      ttl: this.THUMBNAIL_CACHE_TTL,
      persistent: true
    })
  }

  /**
   * Get cached thumbnail URL
   */
  static getCachedThumbnail(assetId: string): string | null {
    return CacheService.get(`thumbnail:${assetId}`)
  }

  /**
   * Cache asset metadata
   */
  static cacheMetadata(assetId: string, metadata: any): void {
    CacheService.set(`metadata:${assetId}`, metadata, {
      ttl: this.METADATA_CACHE_TTL,
      persistent: false
    })
  }

  /**
   * Get cached metadata
   */
  static getCachedMetadata(assetId: string): any | null {
    return CacheService.get(`metadata:${assetId}`)
  }

  /**
   * Cache search results
   */
  static cacheSearchResults(query: string, results: any): void {
    const cacheKey = `search:${btoa(query)}`
    CacheService.set(cacheKey, results, {
      ttl: 5 * 60 * 1000, // 5 minutes for search results
      persistent: false
    })
  }

  /**
   * Get cached search results
   */
  static getCachedSearchResults(query: string): any | null {
    const cacheKey = `search:${btoa(query)}`
    return CacheService.get(cacheKey)
  }

  /**
   * Invalidate asset-related cache
   */
  static invalidateAsset(assetId: string): void {
    CacheService.delete(`asset:${assetId}`)
    CacheService.delete(`thumbnail:${assetId}`)
    CacheService.delete(`metadata:${assetId}`)
  }
}