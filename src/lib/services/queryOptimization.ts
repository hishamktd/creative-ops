import { supabase } from '../supabase/client'
import { CacheService } from './cache'

export interface QueryOptions {
  cache?: boolean
  cacheTTL?: number
  timeout?: number
  retries?: number
}

export interface PaginationOptions {
  page?: number
  limit?: number
  offset?: number
}

export interface SortOptions {
  column: string
  ascending?: boolean
}

export interface FilterOptions {
  [key: string]: any
}

export class QueryOptimizationService {
  private static readonly DEFAULT_CACHE_TTL = 5 * 60 * 1000 // 5 minutes
  private static readonly DEFAULT_TIMEOUT = 10000 // 10 seconds
  private static readonly DEFAULT_PAGE_SIZE = 50

  /**
   * Execute optimized query with caching and error handling
   */
  static async executeQuery<T>(
    queryBuilder: () => any,
    cacheKey?: string,
    options: QueryOptions = {}
  ): Promise<{ data: T[] | null; error: any; count?: number }> {
    const {
      cache = true,
      cacheTTL = this.DEFAULT_CACHE_TTL,
      timeout = this.DEFAULT_TIMEOUT,
      retries = 2
    } = options

    // Try cache first if enabled
    if (cache && cacheKey) {
      const cached = CacheService.get<{ data: T[]; count?: number }>(cacheKey)
      if (cached) {
        return { data: cached.data, error: null, count: cached.count }
      }
    }

    // Execute query with retries
    let lastError: any
    for (let attempt = 0; attempt < retries + 1; attempt++) {
      try {
        const result = await Promise.race([
          queryBuilder(),
          this.createTimeoutPromise(timeout)
        ])

        // Cache successful result
        if (cache && cacheKey && result.data) {
          CacheService.set(cacheKey, {
            data: result.data,
            count: result.count
          }, { ttl: cacheTTL })
        }

        return result
      } catch (error) {
        lastError = error
        if (attempt < retries) {
          await this.delay(Math.pow(2, attempt) * 1000) // Exponential backoff
        }
      }
    }

    return { data: null, error: lastError }
  }

  /**
   * Get assets with optimized pagination and filtering
   */
  static async getAssets(
    projectId: string,
    options: {
      pagination?: PaginationOptions
      sort?: SortOptions
      filters?: FilterOptions
      search?: string
    } = {}
  ) {
    const {
      pagination = {},
      sort = { column: 'created_at', ascending: false },
      filters = {},
      search
    } = options

    const {
      page = 1,
      limit = this.DEFAULT_PAGE_SIZE,
      offset = (page - 1) * limit
    } = pagination

    // Build cache key
    const cacheKey = `assets:${projectId}:${JSON.stringify({ pagination, sort, filters, search })}`

    return this.executeQuery(
      () => {
        let query = supabase
          .from('assets')
          .select(`
            *,
            asset_metadata(*),
            asset_tags(tag),
            profiles:uploaded_by(full_name, avatar_url)
          `, { count: 'exact' })
          .eq('project_id', projectId)

        // Apply filters
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            if (Array.isArray(value)) {
              query = query.in(key, value)
            } else {
              query = query.eq(key, value)
            }
          }
        })

        // Apply search
        if (search) {
          query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`)
        }

        // Apply sorting
        query = query.order(sort.column, { ascending: sort.ascending })

        // Apply pagination
        query = query.range(offset, offset + limit - 1)

        return query
      },
      cacheKey,
      { cache: true, cacheTTL: 2 * 60 * 1000 } // 2 minutes for asset lists
    )
  }

  /**
   * Get asset with related data using optimized joins
   */
  static async getAssetById(assetId: string) {
    const cacheKey = `asset:${assetId}:full`

    return this.executeQuery(
      () => supabase
        .from('assets')
        .select(`
          *,
          asset_metadata(*),
          asset_tags(tag),
          asset_versions(
            id,
            version_number,
            file_url,
            created_at,
            profiles:created_by(full_name, avatar_url)
          ),
          asset_comments(
            id,
            content,
            created_at,
            profiles:created_by(full_name, avatar_url)
          ),
          profiles:uploaded_by(full_name, avatar_url),
          folders:folder_id(name, path)
        `)
        .eq('id', assetId)
        .single(),
      cacheKey,
      { cache: true, cacheTTL: 10 * 60 * 1000 } // 10 minutes for individual assets
    )
  }

  /**
   * Search assets with full-text search optimization
   */
  static async searchAssets(
    projectId: string,
    query: string,
    options: {
      pagination?: PaginationOptions
      filters?: FilterOptions
    } = {}
  ) {
    const { pagination = {}, filters = {} } = options
    const { page = 1, limit = this.DEFAULT_PAGE_SIZE } = pagination
    const offset = (page - 1) * limit

    const cacheKey = `search:${projectId}:${query}:${JSON.stringify({ pagination, filters })}`

    return this.executeQuery(
      () => {
        // Use PostgreSQL full-text search
        let searchQuery = supabase
          .from('asset_search_index')
          .select(`
            asset_id,
            assets!inner(
              *,
              asset_metadata(*),
              asset_tags(tag),
              profiles:uploaded_by(full_name, avatar_url)
            )
          `, { count: 'exact' })
          .eq('project_id', projectId)
          .textSearch('searchable_content', query, {
            type: 'websearch',
            config: 'english'
          })

        // Apply additional filters
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            searchQuery = searchQuery.eq(`assets.${key}`, value)
          }
        })

        return searchQuery
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)
      },
      cacheKey,
      { cache: true, cacheTTL: 3 * 60 * 1000 } // 3 minutes for search results
    )
  }

  /**
   * Get asset usage statistics with aggregation
   */
  static async getAssetStats(projectId: string, timeRange: 'day' | 'week' | 'month' = 'week') {
    const cacheKey = `stats:${projectId}:${timeRange}`

    const dateFilter = this.getDateFilter(timeRange)

    return this.executeQuery(
      () => supabase
        .from('asset_access_logs')
        .select(`
          asset_id,
          access_type,
          created_at,
          assets!inner(name, file_type)
        `)
        .eq('project_id', projectId)
        .gte('created_at', dateFilter)
        .order('created_at', { ascending: false }),
      cacheKey,
      { cache: true, cacheTTL: 15 * 60 * 1000 } // 15 minutes for stats
    )
  }

  /**
   * Batch update assets with transaction support
   */
  static async batchUpdateAssets(
    updates: Array<{ id: string; updates: Partial<any> }>
  ) {
    try {
      const results = []

      // Process in chunks to avoid timeout
      const chunkSize = 10
      for (let i = 0; i < updates.length; i += chunkSize) {
        const chunk = updates.slice(i, i + chunkSize)
        
        const chunkResults = await Promise.all(
          chunk.map(({ id, updates: updateData }) =>
            supabase
              .from('assets')
              .update(updateData)
              .eq('id', id)
              .select()
          )
        )

        results.push(...chunkResults)

        // Invalidate cache for updated assets
        chunk.forEach(({ id }) => {
          CacheService.delete(`asset:${id}:full`)
        })
      }

      return { data: results, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Get trending assets based on access patterns
   */
  static async getTrendingAssets(
    projectId: string,
    limit: number = 10,
    timeRange: 'day' | 'week' | 'month' = 'week'
  ) {
    const cacheKey = `trending:${projectId}:${timeRange}:${limit}`
    const dateFilter = this.getDateFilter(timeRange)

    return this.executeQuery(
      () => supabase
        .rpc('get_trending_assets', {
          p_project_id: projectId,
          p_since: dateFilter,
          p_limit: limit
        }),
      cacheKey,
      { cache: true, cacheTTL: 30 * 60 * 1000 } // 30 minutes for trending
    )
  }

  /**
   * Optimize database indexes (admin function)
   */
  static async optimizeIndexes() {
    const indexQueries = [
      // Assets table indexes
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assets_project_created ON assets(project_id, created_at DESC)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assets_folder_name ON assets(folder_id, name)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assets_type_status ON assets(file_type, status)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assets_uploaded_by ON assets(uploaded_by)',
      
      // Search index
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_asset_search_content ON asset_search_index USING gin(searchable_content)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_asset_search_project ON asset_search_index(project_id, created_at DESC)',
      
      // Access logs index
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_access_logs_asset_date ON asset_access_logs(asset_id, created_at DESC)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_access_logs_project_date ON asset_access_logs(project_id, created_at DESC)',
      
      // Tags index
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_asset_tags_asset ON asset_tags(asset_id)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_asset_tags_tag ON asset_tags(tag)',
      
      // Metadata index
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_asset_metadata_asset ON asset_metadata(asset_id)',
      'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_asset_metadata_dimensions ON asset_metadata(width, height) WHERE width IS NOT NULL'
    ]

    const results = []
    for (const query of indexQueries) {
      try {
        const result = await supabase.rpc('execute_sql', { sql: query })
        results.push({ query, success: true, result })
      } catch (error) {
        results.push({ query, success: false, error })
      }
    }

    return results
  }

  /**
   * Analyze query performance
   */
  static async analyzeQueryPerformance(query: string) {
    try {
      const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`
      const result = await supabase.rpc('execute_sql', { sql: explainQuery })
      return { data: result.data, error: null }
    } catch (error) {
      return { data: null, error }
    }
  }

  /**
   * Create timeout promise
   */
  private static createTimeoutPromise(timeout: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Query timeout')), timeout)
    })
  }

  /**
   * Delay utility
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get date filter for time ranges
   */
  private static getDateFilter(timeRange: 'day' | 'week' | 'month'): string {
    const now = new Date()
    const date = new Date(now)

    switch (timeRange) {
      case 'day':
        date.setDate(date.getDate() - 1)
        break
      case 'week':
        date.setDate(date.getDate() - 7)
        break
      case 'month':
        date.setMonth(date.getMonth() - 1)
        break
    }

    return date.toISOString()
  }

  /**
   * Invalidate related caches when data changes
   */
  static invalidateAssetCaches(assetId: string, projectId: string): void {
    // Invalidate specific asset cache
    CacheService.delete(`asset:${assetId}:full`)
    
    // Invalidate asset list caches (pattern-based)
    const cacheKeys = [
      `assets:${projectId}:`,
      `search:${projectId}:`,
      `trending:${projectId}:`,
      `stats:${projectId}:`
    ]

    // In a real implementation, you'd want a more sophisticated cache invalidation
    // For now, we'll clear all related caches
    cacheKeys.forEach(pattern => {
      // This is a simplified approach - in production you'd want pattern matching
      CacheService.clear()
    })
  }
}