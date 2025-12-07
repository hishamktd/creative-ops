import { createClient } from '@/lib/supabase/client'
import type { 
  SearchFilters, 
  SearchSortOptions, 
  SearchResponse, 
  SearchResult,
  SearchFacets,
  SavedSearch,
  AutocompleteResult,
  SearchAnalytics
} from '@/types/search'

export class SearchService {
  private supabase = createClient()

  /**
   * Perform full-text search on assets with advanced filtering
   */
  async searchAssets(
    filters: SearchFilters,
    sort: SearchSortOptions = { field: 'relevance', direction: 'desc' },
    limit: number = 50,
    offset: number = 0
  ): Promise<SearchResponse> {
    const startTime = Date.now()

    try {
      // Enhanced search with better PostgreSQL capabilities
      const { data: searchResults, error } = await this.supabase
        .rpc('enhanced_search_assets', {
          search_query: filters.query || null,
          project_ids: filters.projectIds || null,
          file_types: filters.fileTypes || null,
          tag_names: filters.tags || null,
          status_filter: filters.status || null,
          uploaded_by_ids: filters.uploadedBy || null,
          date_start: filters.dateRange?.start || null,
          date_end: filters.dateRange?.end || null,
          size_min: filters.sizeRange?.min ? filters.sizeRange.min * 1024 * 1024 : null, // Convert MB to bytes
          size_max: filters.sizeRange?.max ? filters.sizeRange.max * 1024 * 1024 : null,
          sort_field: sort.field,
          sort_direction: sort.direction,
          limit_count: limit,
          offset_count: offset
        })

      if (error) throw error

      // Get total count for pagination
      const { data: totalCount, error: countError } = await this.supabase
        .rpc('count_search_results', {
          search_query: filters.query || null,
          project_ids: filters.projectIds || null,
          file_types: filters.fileTypes || null,
          tag_names: filters.tags || null,
          status_filter: filters.status || null,
          uploaded_by_ids: filters.uploadedBy || null,
          date_start: filters.dateRange?.start || null,
          date_end: filters.dateRange?.end || null,
          size_min: filters.sizeRange?.min ? filters.sizeRange.min * 1024 * 1024 : null,
          size_max: filters.sizeRange?.max ? filters.sizeRange.max * 1024 * 1024 : null
        })

      if (countError) console.warn('Count error:', countError)

      // Get facets for the current search
      const facets = await this.getFacets(filters)

      // Get search suggestions if query is provided
      const suggestions = filters.query ? await this.getSuggestions(filters.query) : undefined

      const took = Date.now() - startTime

      return {
        results: searchResults || [],
        total: totalCount || searchResults?.length || 0,
        facets,
        suggestions,
        took
      }
    } catch (error) {
      console.error('Search error:', error)
      throw new Error('Failed to search assets')
    }
  }

  /**
   * Get search facets for filtering with enhanced capabilities
   */
  private async getFacets(filters: SearchFilters): Promise<SearchFacets> {
    try {
      // Use RPC function to get facets efficiently
      const { data: facetData, error } = await this.supabase
        .rpc('get_search_facets', {
          search_query: filters.query || null,
          project_ids: filters.projectIds || null,
          file_types: filters.fileTypes || null,
          tag_names: filters.tags || null,
          status_filter: filters.status || null,
          uploaded_by_ids: filters.uploadedBy || null,
          date_start: filters.dateRange?.start || null,
          date_end: filters.dateRange?.end || null,
          size_min: filters.sizeRange?.min ? filters.sizeRange.min * 1024 * 1024 : null,
          size_max: filters.sizeRange?.max ? filters.sizeRange.max * 1024 * 1024 : null
        })

      if (error) {
        console.warn('Facets RPC error, falling back to basic facets:', error)
        return await this.getBasicFacets()
      }

      // Process facet data
      const facets: SearchFacets = {
        fileTypes: facetData?.file_types?.map((ft: any) => ({
          value: ft.file_type,
          count: ft.count,
          label: this.getFileTypeLabel(ft.file_type)
        })) || [],
        projects: facetData?.projects?.map((p: any) => ({
          value: p.project_id,
          count: p.count,
          label: p.project_name
        })) || [],
        tags: facetData?.tags?.map((t: any) => ({
          value: t.tag_name,
          count: t.count,
          label: t.tag_name
        })) || [],
        uploadedBy: facetData?.uploaded_by?.map((u: any) => ({
          value: u.user_id,
          count: u.count,
          label: u.user_name || u.user_email || 'Unknown User'
        })) || [],
        dateRanges: this.generateDateRangeFacets(facetData?.date_ranges || [])
      }

      return facets
    } catch (error) {
      console.error('Error getting facets:', error)
      return await this.getBasicFacets()
    }
  }

  /**
   * Fallback method for basic facets when RPC fails
   */
  private async getBasicFacets(): Promise<SearchFacets> {
    try {
      // Get file type facets
      const { data: fileTypeFacets } = await this.supabase
        .from('asset_search_index')
        .select('file_type')
        .then(({ data }) => {
          const counts = data?.reduce((acc, item) => {
            acc[item.file_type] = (acc[item.file_type] || 0) + 1
            return acc
          }, {} as Record<string, number>) || {}
          
          return Object.entries(counts).map(([value, count]) => ({
            value,
            count,
            label: this.getFileTypeLabel(value)
          }))
        })

      // Get project facets
      const { data: projectFacets } = await this.supabase
        .from('projects')
        .select('id, name')
        .then(async ({ data: projects }) => {
          const { data: projectCounts } = await this.supabase
            .from('asset_search_index')
            .select('project_id')
          
          const counts = projectCounts?.reduce((acc, item) => {
            acc[item.project_id] = (acc[item.project_id] || 0) + 1
            return acc
          }, {} as Record<string, number>) || {}

          return projects?.map(project => ({
            value: project.id,
            count: counts[project.id] || 0,
            label: project.name
          })).filter(p => p.count > 0) || []
        })

      return {
        fileTypes: fileTypeFacets || [],
        projects: projectFacets || [],
        tags: [],
        uploadedBy: [],
        dateRanges: []
      }
    } catch (error) {
      console.error('Error getting basic facets:', error)
      return {
        fileTypes: [],
        projects: [],
        tags: [],
        uploadedBy: [],
        dateRanges: []
      }
    }
  }

  /**
   * Generate date range facets from date data
   */
  private generateDateRangeFacets(dateRanges: any[]): FacetCount[] {
    const ranges = [
      { value: 'today', label: 'Today', days: 1 },
      { value: 'week', label: 'This Week', days: 7 },
      { value: 'month', label: 'This Month', days: 30 },
      { value: 'quarter', label: 'This Quarter', days: 90 },
      { value: 'year', label: 'This Year', days: 365 }
    ]

    return ranges.map(range => {
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - range.days)
      
      const count = dateRanges.filter(dr => 
        new Date(dr.created_at) >= startDate
      ).length

      return {
        value: range.value,
        count,
        label: range.label
      }
    }).filter(r => r.count > 0)
  }

  /**
   * Get enhanced search suggestions based on query and analytics
   */
  private async getSuggestions(query: string): Promise<string[]> {
    try {
      // Use RPC function for intelligent suggestions
      const { data: suggestions, error } = await this.supabase
        .rpc('get_search_suggestions', {
          search_query: query,
          limit_count: 8
        })

      if (error) {
        console.warn('Suggestions RPC error, falling back to basic suggestions:', error)
        return await this.getBasicSuggestions(query)
      }

      return suggestions || []
    } catch (error) {
      console.error('Error getting suggestions:', error)
      return await this.getBasicSuggestions(query)
    }
  }

  /**
   * Fallback method for basic suggestions
   */
  private async getBasicSuggestions(query: string): Promise<string[]> {
    try {
      // Get similar asset names using trigram similarity
      const { data: assetSuggestions } = await this.supabase
        .from('assets')
        .select('name')
        .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(5)

      // Get similar tags
      const { data: tagSuggestions } = await this.supabase
        .from('tags')
        .select('name')
        .ilike('name', `%${query}%`)
        .limit(5)

      // Get popular searches from analytics
      const { data: popularSearches } = await this.supabase
        .from('search_analytics')
        .select('query')
        .ilike('query', `%${query}%`)
        .order('timestamp', { ascending: false })
        .limit(3)

      const suggestions = [
        ...(assetSuggestions?.map(a => a.name) || []),
        ...(tagSuggestions?.map(t => t.name) || []),
        ...(popularSearches?.map(s => s.query) || [])
      ]

      return [...new Set(suggestions)].slice(0, 8)
    } catch (error) {
      console.error('Error getting basic suggestions:', error)
      return []
    }
  }

  /**
   * Get enhanced autocomplete results for search input
   */
  async getAutocomplete(query: string): Promise<AutocompleteResult> {
    try {
      // Get intelligent suggestions
      const suggestions = await this.getSuggestions(query)
      
      // Get recent searches from analytics for current user
      const { data: recentSearches } = await this.supabase
        .from('search_analytics')
        .select('query')
        .order('timestamp', { ascending: false })
        .limit(5)
        .then(({ data }) => ({
          data: [...new Set(data?.map(s => s.query) || [])].slice(0, 5)
        }))
      
      // Get popular tags with search relevance
      const { data: popularTags } = await this.supabase
        .from('tags')
        .select('name')
        .ilike('name', `%${query}%`)
        .limit(10)

      // Get file type suggestions
      const fileTypeSuggestions = this.getFileTypeSuggestions(query)

      // Categorize suggestions by type
      const categorizedSuggestions = [
        ...suggestions.map(text => ({ 
          text, 
          type: 'query' as const,
          count: undefined 
        })),
        ...fileTypeSuggestions.map(text => ({ 
          text, 
          type: 'filetype' as const,
          count: undefined 
        })),
        ...(popularTags?.map(t => ({ 
          text: t.name, 
          type: 'tag' as const,
          count: undefined 
        })) || [])
      ]

      return {
        suggestions: categorizedSuggestions.slice(0, 10),
        recent_searches: recentSearches?.data || [],
        popular_tags: popularTags?.map(t => t.name) || []
      }
    } catch (error) {
      console.error('Error getting autocomplete:', error)
      return {
        suggestions: [],
        recent_searches: [],
        popular_tags: []
      }
    }
  }

  /**
   * Get file type suggestions based on query
   */
  private getFileTypeSuggestions(query: string): string[] {
    const fileTypeMap: Record<string, string[]> = {
      'image': ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml'],
      'video': ['video/mp4', 'video/webm', 'video/mov'],
      'document': ['application/pdf', 'text/plain'],
      'pdf': ['application/pdf'],
      'jpeg': ['image/jpeg'],
      'png': ['image/png'],
      'gif': ['image/gif'],
      'svg': ['image/svg+xml'],
      'mp4': ['video/mp4'],
      'webm': ['video/webm']
    }

    const lowerQuery = query.toLowerCase()
    const suggestions: string[] = []

    for (const [keyword, types] of Object.entries(fileTypeMap)) {
      if (keyword.includes(lowerQuery) || lowerQuery.includes(keyword)) {
        suggestions.push(...types.map(type => this.getFileTypeLabel(type)))
      }
    }

    return [...new Set(suggestions)]
  }

  /**
   * Save a search for later use
   */
  async saveSearch(search: Omit<SavedSearch, 'id' | 'created_at' | 'updated_at'>): Promise<SavedSearch> {
    try {
      const { data, error } = await this.supabase
        .from('saved_searches')
        .insert(search)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error saving search:', error)
      throw new Error('Failed to save search')
    }
  }

  /**
   * Get saved searches for a user
   */
  async getSavedSearches(userId: string): Promise<SavedSearch[]> {
    try {
      const { data, error } = await this.supabase
        .from('saved_searches')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error getting saved searches:', error)
      return []
    }
  }

  /**
   * Delete a saved search
   */
  async deleteSavedSearch(searchId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('saved_searches')
        .delete()
        .eq('id', searchId)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting saved search:', error)
      throw new Error('Failed to delete saved search')
    }
  }

  /**
   * Execute smart folder search (dynamic saved search)
   */
  async executeSmartFolder(smartFolderId: string): Promise<SearchResponse> {
    try {
      const { data: smartFolder, error } = await this.supabase
        .from('saved_searches')
        .select('*')
        .eq('id', smartFolderId)
        .eq('is_smart_folder', true)
        .single()

      if (error || !smartFolder) {
        throw new Error('Smart folder not found')
      }

      // Execute the search with the smart folder's filters
      return await this.searchAssets(
        smartFolder.filters as SearchFilters,
        smartFolder.sort as SearchSortOptions,
        50,
        0
      )
    } catch (error) {
      console.error('Error executing smart folder:', error)
      throw new Error('Failed to execute smart folder')
    }
  }

  /**
   * Get search analytics for insights
   */
  async getSearchAnalytics(userId?: string, projectId?: string): Promise<{
    popularQueries: Array<{ query: string; count: number }>
    searchTrends: Array<{ date: string; count: number }>
    topClickedAssets: Array<{ asset_id: string; clicks: number }>
  }> {
    try {
      const { data: analytics, error } = await this.supabase
        .rpc('get_search_analytics', {
          user_id_filter: userId || null,
          project_id_filter: projectId || null,
          days_back: 30
        })

      if (error) throw error

      return {
        popularQueries: analytics?.popular_queries || [],
        searchTrends: analytics?.search_trends || [],
        topClickedAssets: analytics?.top_clicked_assets || []
      }
    } catch (error) {
      console.error('Error getting search analytics:', error)
      return {
        popularQueries: [],
        searchTrends: [],
        topClickedAssets: []
      }
    }
  }

  /**
   * Log search analytics with enhanced tracking
   */
  async logSearchAnalytics(analytics: Omit<SearchAnalytics, 'timestamp'>): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('search_analytics')
        .insert({
          ...analytics,
          timestamp: new Date().toISOString()
        })

      if (error) throw error

      // Update search suggestions cache if needed
      if (analytics.query && analytics.results_count > 0) {
        await this.updateSearchSuggestionsCache(analytics.query)
      }
    } catch (error) {
      console.error('Error logging search analytics:', error)
      // Don't throw error for analytics logging
    }
  }

  /**
   * Update search suggestions cache for better performance
   */
  private async updateSearchSuggestionsCache(query: string): Promise<void> {
    try {
      // This could be implemented with Redis or similar caching system
      // For now, we'll just log the successful search for future suggestions
      console.debug('Updating search suggestions cache for:', query)
    } catch (error) {
      console.error('Error updating search suggestions cache:', error)
    }
  }

  /**
   * Get file type label for display
   */
  private getFileTypeLabel(fileType: string): string {
    const labels: Record<string, string> = {
      'image/jpeg': 'JPEG Images',
      'image/png': 'PNG Images',
      'image/gif': 'GIF Images',
      'image/svg+xml': 'SVG Images',
      'video/mp4': 'MP4 Videos',
      'video/webm': 'WebM Videos',
      'application/pdf': 'PDF Documents',
      'text/plain': 'Text Files',
      'application/zip': 'ZIP Archives'
    }
    return labels[fileType] || fileType
  }
}

export const searchService = new SearchService()