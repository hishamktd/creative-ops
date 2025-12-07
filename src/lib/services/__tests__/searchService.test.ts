import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type { SearchFilters, SearchSortOptions } from '@/types/search'

// Mock the Supabase client module
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        then: vi.fn(),
        ilike: vi.fn(() => ({
          limit: vi.fn(() => ({ data: [] }))
        })),
        eq: vi.fn(() => ({
          order: vi.fn(() => ({ data: [] }))
        })),
        limit: vi.fn(() => ({ data: [] }))
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({ data: null, error: null }))
        }))
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({ error: null }))
      }))
    }))
  }))
}))

import { searchService } from '../searchService'

describe('SearchService', () => {
  let mockSupabase: any

  beforeEach(() => {
    vi.clearAllMocks()
    // Get the mocked supabase instance
    mockSupabase = (searchService as any).supabase
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('searchAssets', () => {
    it('should perform basic text search', async () => {
      const mockResults = [
        {
          asset_id: '1',
          name: 'test-image.jpg',
          file_type: 'image/jpeg',
          project_id: 'project-1',
          rank: 0.8
        }
      ]

      mockSupabase.rpc.mockImplementation((funcName) => {
        // Add a small delay to simulate real database calls and ensure timing > 0
        return new Promise(resolve => {
          setTimeout(() => {
            if (funcName === 'enhanced_search_assets') {
              resolve({ data: mockResults, error: null })
            } else if (funcName === 'count_search_results') {
              resolve({ data: 1, error: null })
            } else if (funcName === 'get_search_facets') {
              resolve({ data: { file_types: [], projects: [], tags: [], uploaded_by: [] }, error: null })
            } else if (funcName === 'get_search_suggestions') {
              resolve({ data: [], error: null })
            } else {
              resolve({ data: [], error: null })
            }
          }, 1) // 1ms delay to ensure timing > 0
        })
      })

      const filters: SearchFilters = {
        query: 'test image'
      }

      const result = await searchService.searchAssets(filters)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('enhanced_search_assets', {
        search_query: 'test image',
        project_ids: null,
        file_types: null,
        tag_names: null,
        status_filter: null,
        uploaded_by_ids: null,
        date_start: null,
        date_end: null,
        size_min: null,
        size_max: null,
        sort_field: 'relevance',
        sort_direction: 'desc',
        limit_count: 50,
        offset_count: 0
      })

      expect(result.results).toEqual(mockResults)
      expect(result.total).toBe(1)
      expect(result.took).toBeGreaterThan(0)
    })

    it('should handle search with multiple filters', async () => {
      const filters: SearchFilters = {
        query: 'design',
        projectIds: ['project-1', 'project-2'],
        fileTypes: ['image/jpeg', 'image/png'],
        tags: ['ui', 'mockup']
      }

      const sort: SearchSortOptions = {
        field: 'created_at',
        direction: 'desc'
      }

      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null
      })

      await searchService.searchAssets(filters, sort, 25, 50)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('enhanced_search_assets', {
        search_query: 'design',
        project_ids: ['project-1', 'project-2'],
        file_types: ['image/jpeg', 'image/png'],
        tag_names: ['ui', 'mockup'],
        status_filter: null,
        uploaded_by_ids: null,
        date_start: null,
        date_end: null,
        size_min: null,
        size_max: null,
        sort_field: 'created_at',
        sort_direction: 'desc',
        limit_count: 25,
        offset_count: 50
      })
    })

    it('should handle search errors gracefully', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: new Error('Database error')
      })

      const filters: SearchFilters = { query: 'test' }

      await expect(searchService.searchAssets(filters)).rejects.toThrow('Failed to search assets')
    })

    it('should return empty results for empty query', async () => {
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: [], error: null }) // enhanced_search_assets
        .mockResolvedValueOnce({ data: 0, error: null })  // count_search_results
        .mockResolvedValueOnce({ data: { file_types: [], projects: [], tags: [], uploaded_by: [] }, error: null }) // get_search_facets

      const filters: SearchFilters = {}
      const result = await searchService.searchAssets(filters)

      expect(result.results).toEqual([])
      expect(result.total).toBe(0)
    })
  })

  describe('getAutocomplete', () => {
    it('should return autocomplete suggestions', async () => {
      const mockSuggestions = ['test-design.jpg', 'test-photo.png']
      const mockTags = [{ name: 'design' }]

      // Mock RPC call for suggestions
      mockSupabase.rpc.mockResolvedValueOnce({ 
        data: mockSuggestions, 
        error: null 
      })

      // Mock search_analytics table for recent searches
      mockSupabase.from.mockImplementation((table) => {
        if (table === 'search_analytics') {
          return {
            select: () => ({
              order: () => ({
                limit: () => ({
                  then: (callback: any) => callback({ data: [] })
                })
              })
            })
          }
        }
        if (table === 'tags') {
          return {
            select: () => ({
              ilike: () => ({
                limit: () => ({ data: mockTags })
              })
            })
          }
        }
        return { select: () => ({ data: [] }) }
      })

      const result = await searchService.getAutocomplete('test')

      expect(result.suggestions.length).toBeGreaterThan(0)
      expect(result.popular_tags).toEqual(['design'])
    })

    it('should handle autocomplete errors', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Network error')
      })

      const result = await searchService.getAutocomplete('test')

      expect(result.suggestions).toEqual([])
      expect(result.recent_searches).toEqual([])
      expect(result.popular_tags).toEqual([])
    })
  })

  describe('saveSearch', () => {
    it('should save a search successfully', async () => {
      const mockSavedSearch = {
        id: 'search-1',
        name: 'My Search',
        filters: { query: 'test' },
        sort: { field: 'relevance', direction: 'desc' },
        user_id: 'user-1',
        is_smart_folder: false,
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z'
      }

      mockSupabase.from.mockReturnValue({
        insert: () => ({
          select: () => ({
            single: () => ({ data: mockSavedSearch, error: null })
          })
        })
      })

      const result = await searchService.saveSearch({
        name: 'My Search',
        filters: { query: 'test' },
        sort: { field: 'relevance', direction: 'desc' },
        user_id: 'user-1',
        is_smart_folder: false
      })

      expect(result).toEqual(mockSavedSearch)
    })

    it('should handle save errors', async () => {
      mockSupabase.from.mockReturnValue({
        insert: () => ({
          select: () => ({
            single: () => ({ data: null, error: new Error('Save failed') })
          })
        })
      })

      await expect(searchService.saveSearch({
        name: 'My Search',
        filters: { query: 'test' },
        sort: { field: 'relevance', direction: 'desc' },
        user_id: 'user-1',
        is_smart_folder: false
      })).rejects.toThrow('Failed to save search')
    })
  })

  describe('Performance Tests', () => {
    it('should complete search within acceptable time limit', async () => {
      // Mock a large dataset
      const largeResults = Array.from({ length: 1000 }, (_, i) => ({
        asset_id: `asset-${i}`,
        name: `file-${i}.jpg`,
        file_type: 'image/jpeg',
        project_id: 'project-1',
        rank: Math.random()
      }))

      mockSupabase.rpc.mockResolvedValue({
        data: largeResults.slice(0, 50), // Simulate pagination
        error: null
      })

      const startTime = Date.now()
      const filters: SearchFilters = { query: 'test' }
      
      const result = await searchService.searchAssets(filters)
      const endTime = Date.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(1000) // Should complete within 1 second
      expect(result.results).toHaveLength(50)
    })

    it('should handle concurrent search requests', async () => {
      // Mock all RPC calls that happen during search with proper responses
      mockSupabase.rpc.mockImplementation((funcName) => {
        // Add a small delay to simulate real database calls
        return new Promise(resolve => {
          setTimeout(() => {
            if (funcName === 'enhanced_search_assets') {
              resolve({ data: [{ asset_id: '1', name: 'test.jpg', file_type: 'image/jpeg', project_id: 'p1', rank: 1 }], error: null })
            } else if (funcName === 'count_search_results') {
              resolve({ data: 1, error: null })
            } else if (funcName === 'get_search_facets') {
              resolve({ data: { file_types: [], projects: [], tags: [], uploaded_by: [] }, error: null })
            } else if (funcName === 'get_search_suggestions') {
              resolve({ data: [], error: null })
            } else {
              resolve({ data: [], error: null })
            }
          }, 10) // 10ms delay
        })
      })

      const filters: SearchFilters = { query: 'concurrent test' }
      
      // Simulate 10 concurrent searches
      const promises = Array.from({ length: 10 }, () => 
        searchService.searchAssets(filters)
      )

      const results = await Promise.all(promises)

      expect(results).toHaveLength(10)
      results.forEach(result => {
        expect(result.results).toHaveLength(1)
        expect(result.took).toBeGreaterThan(0)
      })
    })

    it('should handle search with large filter sets efficiently', async () => {
      const filters: SearchFilters = {
        query: 'performance test',
        projectIds: Array.from({ length: 100 }, (_, i) => `project-${i}`),
        fileTypes: ['image/jpeg', 'image/png', 'image/gif', 'video/mp4', 'application/pdf'],
        tags: Array.from({ length: 50 }, (_, i) => `tag-${i}`)
      }

      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null
      })

      const startTime = Date.now()
      await searchService.searchAssets(filters)
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(2000) // Should handle large filters within 2 seconds
      expect(mockSupabase.rpc).toHaveBeenCalledWith('enhanced_search_assets', {
        search_query: 'performance test',
        project_ids: filters.projectIds,
        file_types: filters.fileTypes,
        tag_names: filters.tags,
        status_filter: null,
        uploaded_by_ids: null,
        date_start: null,
        date_end: null,
        size_min: null,
        size_max: null,
        sort_field: 'relevance',
        sort_direction: 'desc',
        limit_count: 50,
        offset_count: 0
      })
    })

    it('should efficiently handle pagination with large offsets', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null
      })

      const filters: SearchFilters = { query: 'pagination test' }
      
      // Test pagination at page 100 (offset 5000)
      const startTime = Date.now()
      await searchService.searchAssets(filters, { field: 'relevance', direction: 'desc' }, 50, 5000)
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(1500) // Should handle large offsets efficiently
      expect(mockSupabase.rpc).toHaveBeenCalledWith('enhanced_search_assets', {
        search_query: 'pagination test',
        project_ids: null,
        file_types: null,
        tag_names: null,
        status_filter: null,
        uploaded_by_ids: null,
        date_start: null,
        date_end: null,
        size_min: null,
        size_max: null,
        sort_field: 'relevance',
        sort_direction: 'desc',
        limit_count: 50,
        offset_count: 5000
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle special characters in search query', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null
      })

      const specialQueries = [
        'test@#$%^&*()',
        'query with "quotes"',
        "query with 'single quotes'",
        'query with \\ backslash',
        'query with / forward slash'
      ]

      for (const query of specialQueries) {
        const filters: SearchFilters = { query }
        const result = await searchService.searchAssets(filters)
        
        expect(result.results).toEqual([])
        expect(mockSupabase.rpc).toHaveBeenCalledWith('enhanced_search_assets', {
          search_query: query,
          project_ids: null,
          file_types: null,
          tag_names: null,
          status_filter: null,
          uploaded_by_ids: null,
          date_start: null,
          date_end: null,
          size_min: null,
          size_max: null,
          sort_field: 'relevance',
          sort_direction: 'desc',
          limit_count: 50,
          offset_count: 0
        })
      }
    })

    it('should handle empty and null filter values', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null
      })

      const filters: SearchFilters = {
        query: '',
        projectIds: [],
        fileTypes: [],
        tags: []
      }

      await searchService.searchAssets(filters)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('enhanced_search_assets', {
        search_query: null, // Empty string should be converted to null
        project_ids: [],    // Empty arrays are passed as is for enhanced search
        file_types: [],     // Empty arrays are passed as is for enhanced search
        tag_names: [],      // Empty arrays are passed as is for enhanced search
        status_filter: null,
        uploaded_by_ids: null,
        date_start: null,
        date_end: null,
        size_min: null,
        size_max: null,
        sort_field: 'relevance',
        sort_direction: 'desc',
        limit_count: 50,
        offset_count: 0
      })
    })
  })
})