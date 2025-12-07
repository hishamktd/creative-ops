import { supabase } from '../supabase/client'
import { EnhancedAsset } from '../../types'

export interface MetadataSearchFilters {
  fileTypes?: string[]
  tags?: string[]
  dateRange?: {
    start: string
    end: string
  }
  sizeRange?: {
    min: number
    max: number
  }
  dimensions?: {
    minWidth?: number
    maxWidth?: number
    minHeight?: number
    maxHeight?: number
  }
  duration?: {
    min: number
    max: number
  }
  cameraInfo?: {
    make?: string
    model?: string
  }
  hasText?: boolean
  resolution?: 'low' | 'medium' | 'high'
  orientation?: 'portrait' | 'landscape' | 'square'
}

export interface SearchOptions {
  query?: string
  filters?: MetadataSearchFilters
  sortBy?: 'relevance' | 'date' | 'name' | 'size' | 'type'
  sortOrder?: 'asc' | 'desc'
  limit?: number
  offset?: number
}

export interface SearchResult {
  assets: EnhancedAsset[]
  total: number
  facets: SearchFacets
  suggestions?: string[]
}

export interface SearchFacets {
  fileTypes: Array<{ type: string; count: number }>
  tags: Array<{ tag: string; count: number }>
  sizes: {
    small: number // < 1MB
    medium: number // 1MB - 10MB
    large: number // > 10MB
  }
  dates: {
    today: number
    thisWeek: number
    thisMonth: number
    older: number
  }
  resolutions: {
    low: number
    medium: number
    high: number
  }
}

export class MetadataSearchService {
  /**
   * Search assets with metadata-based filtering
   */
  static async searchAssets(projectId: string, options: SearchOptions = {}): Promise<SearchResult> {
    try {
      const {
        query = '',
        filters = {},
        sortBy = 'relevance',
        sortOrder = 'desc',
        limit = 50,
        offset = 0
      } = options

      // Build the base query
      let queryBuilder = supabase
        .from('assets')
        .select('*', { count: 'exact' })
        .eq('project_id', projectId)

      // Apply text search if query provided
      if (query.trim()) {
        queryBuilder = this.applyTextSearch(queryBuilder, query)
      }

      // Apply metadata filters
      queryBuilder = this.applyMetadataFilters(queryBuilder, filters)

      // Apply sorting
      queryBuilder = this.applySorting(queryBuilder, sortBy, sortOrder)

      // Apply pagination
      queryBuilder = queryBuilder.range(offset, offset + limit - 1)

      const { data: assets, error, count } = await queryBuilder

      if (error) {
        console.error('Search query failed:', error)
        return { assets: [], total: 0, facets: this.getEmptyFacets() }
      }

      // Get facets for the current search
      const facets = await this.getFacets(projectId, filters, query)

      // Get search suggestions if no results
      const suggestions = assets && assets.length === 0 && query
        ? await this.getSearchSuggestions(projectId, query)
        : undefined

      return {
        assets: assets || [],
        total: count || 0,
        facets,
        suggestions
      }
    } catch (error) {
      console.error('Asset search failed:', error)
      return { assets: [], total: 0, facets: this.getEmptyFacets() }
    }
  }

  /**
   * Apply text search to query builder
   */
  private static applyTextSearch(queryBuilder: any, query: string) {
    const searchTerms = query.trim().split(/\s+/)
    
    // Search in multiple fields
    const searchConditions = searchTerms.map(term => {
      const escapedTerm = term.replace(/[%_]/g, '\\$&')
      return `name.ilike.%${escapedTerm}%,description.ilike.%${escapedTerm}%,metadata->>extracted_text.ilike.%${escapedTerm}%,tags.cs.{${escapedTerm}}`
    })

    // Combine search conditions with OR
    return queryBuilder.or(searchConditions.join(','))
  }

  /**
   * Apply metadata filters to query builder
   */
  private static applyMetadataFilters(queryBuilder: any, filters: MetadataSearchFilters) {
    // File type filter
    if (filters.fileTypes && filters.fileTypes.length > 0) {
      queryBuilder = queryBuilder.in('file_type', filters.fileTypes)
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      queryBuilder = queryBuilder.overlaps('tags', filters.tags)
    }

    // Date range filter
    if (filters.dateRange) {
      queryBuilder = queryBuilder
        .gte('created_at', filters.dateRange.start)
        .lte('created_at', filters.dateRange.end)
    }

    // File size filter
    if (filters.sizeRange) {
      if (filters.sizeRange.min) {
        queryBuilder = queryBuilder.gte('file_size', filters.sizeRange.min)
      }
      if (filters.sizeRange.max) {
        queryBuilder = queryBuilder.lte('file_size', filters.sizeRange.max)
      }
    }

    // Dimensions filter
    if (filters.dimensions) {
      if (filters.dimensions.minWidth) {
        queryBuilder = queryBuilder.gte('metadata->>width', filters.dimensions.minWidth)
      }
      if (filters.dimensions.maxWidth) {
        queryBuilder = queryBuilder.lte('metadata->>width', filters.dimensions.maxWidth)
      }
      if (filters.dimensions.minHeight) {
        queryBuilder = queryBuilder.gte('metadata->>height', filters.dimensions.minHeight)
      }
      if (filters.dimensions.maxHeight) {
        queryBuilder = queryBuilder.lte('metadata->>height', filters.dimensions.maxHeight)
      }
    }

    // Duration filter
    if (filters.duration) {
      if (filters.duration.min) {
        queryBuilder = queryBuilder.gte('metadata->>duration', filters.duration.min)
      }
      if (filters.duration.max) {
        queryBuilder = queryBuilder.lte('metadata->>duration', filters.duration.max)
      }
    }

    // Camera info filter
    if (filters.cameraInfo) {
      if (filters.cameraInfo.make) {
        queryBuilder = queryBuilder.ilike('metadata->camera_info->>make', `%${filters.cameraInfo.make}%`)
      }
      if (filters.cameraInfo.model) {
        queryBuilder = queryBuilder.ilike('metadata->camera_info->>model', `%${filters.cameraInfo.model}%`)
      }
    }

    // Has text filter
    if (filters.hasText !== undefined) {
      if (filters.hasText) {
        queryBuilder = queryBuilder.not('metadata->>extracted_text', 'is', null)
      } else {
        queryBuilder = queryBuilder.is('metadata->>extracted_text', null)
      }
    }

    // Resolution filter
    if (filters.resolution) {
      switch (filters.resolution) {
        case 'low':
          queryBuilder = queryBuilder.or('metadata->>width.lt.1920,metadata->>height.lt.1080')
          break
        case 'medium':
          queryBuilder = queryBuilder
            .gte('metadata->>width', 1920)
            .gte('metadata->>height', 1080)
            .lt('metadata->>width', 3840)
            .lt('metadata->>height', 2160)
          break
        case 'high':
          queryBuilder = queryBuilder.or('metadata->>width.gte.3840,metadata->>height.gte.2160')
          break
      }
    }

    // Orientation filter
    if (filters.orientation) {
      switch (filters.orientation) {
        case 'portrait':
          queryBuilder = queryBuilder.filter('metadata->>width', 'lt', 'metadata->>height')
          break
        case 'landscape':
          queryBuilder = queryBuilder.filter('metadata->>width', 'gt', 'metadata->>height')
          break
        case 'square':
          queryBuilder = queryBuilder.filter('metadata->>width', 'eq', 'metadata->>height')
          break
      }
    }

    return queryBuilder
  }

  /**
   * Apply sorting to query builder
   */
  private static applySorting(queryBuilder: any, sortBy: string, sortOrder: string) {
    const ascending = sortOrder === 'asc'

    switch (sortBy) {
      case 'date':
        return queryBuilder.order('created_at', { ascending })
      case 'name':
        return queryBuilder.order('name', { ascending })
      case 'size':
        return queryBuilder.order('file_size', { ascending })
      case 'type':
        return queryBuilder.order('file_type', { ascending })
      case 'relevance':
      default:
        // For relevance, sort by access count and recency
        return queryBuilder
          .order('access_count', { ascending: false })
          .order('created_at', { ascending: false })
    }
  }

  /**
   * Get search facets for filtering
   */
  private static async getFacets(
    projectId: string,
    currentFilters: MetadataSearchFilters,
    query?: string
  ): Promise<SearchFacets> {
    try {
      // Build base query for facets (without current filters to show all options)
      let facetQuery = supabase
        .from('assets')
        .select('file_type, file_size, tags, created_at, metadata')
        .eq('project_id', projectId)

      // Apply text search if provided
      if (query?.trim()) {
        facetQuery = this.applyTextSearch(facetQuery, query)
      }

      const { data: facetData } = await facetQuery

      if (!facetData) {
        return this.getEmptyFacets()
      }

      // Calculate facets
      const fileTypes = this.calculateFileTypeFacets(facetData)
      const tags = this.calculateTagFacets(facetData)
      const sizes = this.calculateSizeFacets(facetData)
      const dates = this.calculateDateFacets(facetData)
      const resolutions = this.calculateResolutionFacets(facetData)

      return { fileTypes, tags, sizes, dates, resolutions }
    } catch (error) {
      console.error('Facet calculation failed:', error)
      return this.getEmptyFacets()
    }
  }

  /**
   * Calculate file type facets
   */
  private static calculateFileTypeFacets(data: any[]): Array<{ type: string; count: number }> {
    const typeCounts: Record<string, number> = {}
    
    data.forEach(asset => {
      const type = asset.file_type
      typeCounts[type] = (typeCounts[type] || 0) + 1
    })

    return Object.entries(typeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count)
  }

  /**
   * Calculate tag facets
   */
  private static calculateTagFacets(data: any[]): Array<{ tag: string; count: number }> {
    const tagCounts: Record<string, number> = {}
    
    data.forEach(asset => {
      if (asset.tags && Array.isArray(asset.tags)) {
        asset.tags.forEach((tag: string) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1
        })
      }
    })

    return Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20) // Limit to top 20 tags
  }

  /**
   * Calculate size facets
   */
  private static calculateSizeFacets(data: any[]): { small: number; medium: number; large: number } {
    const sizes = { small: 0, medium: 0, large: 0 }
    
    data.forEach(asset => {
      const size = asset.file_size
      if (size < 1024 * 1024) { // < 1MB
        sizes.small++
      } else if (size < 10 * 1024 * 1024) { // < 10MB
        sizes.medium++
      } else {
        sizes.large++
      }
    })

    return sizes
  }

  /**
   * Calculate date facets
   */
  private static calculateDateFacets(data: any[]): { today: number; thisWeek: number; thisMonth: number; older: number } {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const dates = { today: 0, thisWeek: 0, thisMonth: 0, older: 0 }
    
    data.forEach(asset => {
      const createdAt = new Date(asset.created_at)
      
      if (createdAt >= today) {
        dates.today++
      } else if (createdAt >= thisWeek) {
        dates.thisWeek++
      } else if (createdAt >= thisMonth) {
        dates.thisMonth++
      } else {
        dates.older++
      }
    })

    return dates
  }

  /**
   * Calculate resolution facets
   */
  private static calculateResolutionFacets(data: any[]): { low: number; medium: number; high: number } {
    const resolutions = { low: 0, medium: 0, high: 0 }
    
    data.forEach(asset => {
      const metadata = asset.metadata
      if (metadata?.width && metadata?.height) {
        const width = parseInt(metadata.width)
        const height = parseInt(metadata.height)
        
        if (width < 1920 || height < 1080) {
          resolutions.low++
        } else if (width < 3840 || height < 2160) {
          resolutions.medium++
        } else {
          resolutions.high++
        }
      }
    })

    return resolutions
  }

  /**
   * Get empty facets structure
   */
  private static getEmptyFacets(): SearchFacets {
    return {
      fileTypes: [],
      tags: [],
      sizes: { small: 0, medium: 0, large: 0 },
      dates: { today: 0, thisWeek: 0, thisMonth: 0, older: 0 },
      resolutions: { low: 0, medium: 0, high: 0 }
    }
  }

  /**
   * Get search suggestions for empty results
   */
  private static async getSearchSuggestions(projectId: string, query: string): Promise<string[]> {
    try {
      // Get common tags and file names for suggestions
      const { data } = await supabase
        .from('assets')
        .select('name, tags')
        .eq('project_id', projectId)
        .limit(100)

      if (!data) return []

      const suggestions = new Set<string>()
      const lowerQuery = query.toLowerCase()

      // Add similar file names
      data.forEach(asset => {
        const name = asset.name.toLowerCase()
        if (name.includes(lowerQuery) || this.calculateSimilarity(name, lowerQuery) > 0.5) {
          suggestions.add(asset.name)
        }
      })

      // Add similar tags
      data.forEach(asset => {
        if (asset.tags && Array.isArray(asset.tags)) {
          asset.tags.forEach((tag: string) => {
            const lowerTag = tag.toLowerCase()
            if (lowerTag.includes(lowerQuery) || this.calculateSimilarity(lowerTag, lowerQuery) > 0.5) {
              suggestions.add(tag)
            }
          })
        }
      })

      return Array.from(suggestions).slice(0, 5)
    } catch (error) {
      console.error('Failed to get search suggestions:', error)
      return []
    }
  }

  /**
   * Calculate string similarity (simple Levenshtein-based)
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    
    if (longer.length === 0) return 1.0
    
    const distance = this.levenshteinDistance(longer, shorter)
    return (longer.length - distance) / longer.length
  }

  /**
   * Calculate Levenshtein distance
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = []
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }
    
    return matrix[str2.length][str1.length]
  }

  /**
   * Get metadata statistics for a project
   */
  static async getMetadataStatistics(projectId: string): Promise<{
    totalAssets: number
    totalSize: number
    fileTypeDistribution: Record<string, number>
    averageFileSize: number
    mostUsedTags: Array<{ tag: string; count: number }>
    uploadTrends: Array<{ date: string; count: number }>
  }> {
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('file_type, file_size, tags, created_at')
        .eq('project_id', projectId)

      if (error || !data) {
        return {
          totalAssets: 0,
          totalSize: 0,
          fileTypeDistribution: {},
          averageFileSize: 0,
          mostUsedTags: [],
          uploadTrends: []
        }
      }

      const totalAssets = data.length
      const totalSize = data.reduce((sum, asset) => sum + asset.file_size, 0)
      const averageFileSize = totalAssets > 0 ? totalSize / totalAssets : 0

      // File type distribution
      const fileTypeDistribution: Record<string, number> = {}
      data.forEach(asset => {
        fileTypeDistribution[asset.file_type] = (fileTypeDistribution[asset.file_type] || 0) + 1
      })

      // Most used tags
      const tagCounts: Record<string, number> = {}
      data.forEach(asset => {
        if (asset.tags && Array.isArray(asset.tags)) {
          asset.tags.forEach((tag: string) => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1
          })
        }
      })

      const mostUsedTags = Object.entries(tagCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      // Upload trends (last 30 days)
      const uploadTrends = this.calculateUploadTrends(data)

      return {
        totalAssets,
        totalSize,
        fileTypeDistribution,
        averageFileSize,
        mostUsedTags,
        uploadTrends
      }
    } catch (error) {
      console.error('Failed to get metadata statistics:', error)
      return {
        totalAssets: 0,
        totalSize: 0,
        fileTypeDistribution: {},
        averageFileSize: 0,
        mostUsedTags: [],
        uploadTrends: []
      }
    }
  }

  /**
   * Calculate upload trends for the last 30 days
   */
  private static calculateUploadTrends(data: any[]): Array<{ date: string; count: number }> {
    const trends: Record<string, number> = {}
    const now = new Date()
    
    // Initialize last 30 days
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const dateStr = date.toISOString().split('T')[0]
      trends[dateStr] = 0
    }

    // Count uploads per day
    data.forEach(asset => {
      const date = new Date(asset.created_at).toISOString().split('T')[0]
      if (trends.hasOwnProperty(date)) {
        trends[date]++
      }
    })

    return Object.entries(trends)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }
}