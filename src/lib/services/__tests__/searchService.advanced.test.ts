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

describe('Advanced SearchService Tests', () => {
  let mockSupabase: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = (searchService as any).supabase
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Boolean Logic for Tags', () => {
    it('should handle AND logic for tags', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            asset_id: '1',
            name: 'design-ui.jpg',
            file_type: 'image/jpeg',
            project_id: 'project-1',
            rank: 0.9
          }
        ],
        error: null
      })

      const filters: SearchFilters = {
        tags: ['design', 'ui'],
        tagLogic: 'AND'
      }

      await searchService.searchAssets(filters)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('enhanced_search_assets', {
        search_query: null,
        project_ids: null,
        file_types: null,
        tag_names: ['design', 'ui'],
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

    it('should handle OR logic for tags', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [],
        error: null
      })

      const filters: SearchFilters = {
        tags: ['design', 'marketing'],
        tagLogic: 'OR'
      }

      await searchService.searchAssets(filters)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('enhanced_search_assets', {
        search_query: null,
        project_ids: null,
        file_types: null,
        tag_names: ['design', 'marketing'],
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

  describe('Smart Folders', () => {
    it('should execute smart folder search', async () => {
      const mockSmartFolder = {
        id: 'smart-1',
        name: 'Recent Images',
        filters: {
          fileTypes: ['image/jpeg', 'image/png'],
          dateRange: {
            start: '2024-01-01',
            end: '2024-12-31'
          }
        },
        sort: { field: 'created_at', direction: 'desc' },
        is_smart_folder: true
      }

      mockSupabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => ({ data: mockSmartFolder, error: null })
            })
          })
        })
      })

      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            asset_id: '1',
            name: 'recent-image.jpg',
            file_type: 'image/jpeg',
            project_id: 'project-1',
            rank: 1.0
          }
        ],
        error: null
      })

      const result = await searchService.executeSmartFolder('smart-1')

      expect(result.results).toHaveLength(1)
      expect(result.results[0].name).toBe('recent-image.jpg')
    })

    it('should handle smart folder not found', async () => {
      mockSupabase.from.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => ({ data: null, error: new Error('Not found') })
            })
          })
        })
      })

      await expect(searchService.executeSmartFolder('non-existent')).rejects.toThrow('Smart folder not found')
    })
  })

  describe('Advanced Facets', () => {
    it('should get comprehensive facets with counts', async () => {
      const mockFacetData = {
        file_types: [
          { file_type: 'image/jpeg', count: 15 },
          { file_type: 'image/png', count: 8 },
          { file_type: 'video/mp4', count: 3 }
        ],
        projects: [
          { project_id: 'p1', project_name: 'Project Alpha', count: 12 },
          { project_id: 'p2', project_name: 'Project Beta', count: 8 }
        ],
        tags: [
          { tag_name: 'design', count: 20 },
          { tag_name: 'marketing', count: 15 },
          { tag_name: 'development', count: 10 }
        ],
        uploaded_by: [
          { user_id: 'u1', user_name: 'John Doe', count: 25 },
          { user_id: 'u2', user_name: 'Jane Smith', count: 18 }
        ]
      }

      mockSupabase.rpc
        .mockResolvedValueOnce({ data: [], error: null }) // enhanced_search_assets
        .mockResolvedValueOnce({ data: 0, error: null })  // count_search_results
        .mockResolvedValueOnce({ data: mockFacetData, error: null }) // get_search_facets

      const result = await searchService.searchAssets({ query: 'test' })

      expect(result.facets.fileTypes).toHaveLength(3)
      expect(result.facets.fileTypes[0]).toEqual({
        value: 'image/jpeg',
        count: 15,
        label: 'JPEG Images'
      })
      expect(result.facets.projects).toHaveLength(2)
      expect(result.facets.tags).toHaveLength(3)
      expect(result.facets.uploadedBy).toHaveLength(2)
    })

    it('should fallback to basic facets when RPC fails', async () => {
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: [], error: null }) // enhanced_search_assets
        .mockResolvedValueOnce({ data: 0, error: null })  // count_search_results
        .mockResolvedValueOnce({ data: null, error: new Error('RPC failed') }) // get_search_facets fails

      // Mock basic facets fallback - need to return proper structure
      const mockAssetSearchData = [
        { file_type: 'image/jpeg' },
        { file_type: 'image/jpeg' },
        { file_type: 'image/png' }
      ]
      
      const mockProjectsData = [{ id: 'p1', name: 'Test Project' }]
      const mockProjectCountsData = [{ project_id: 'p1' }]

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'asset_search_index') {
          return {
            select: () => ({
              then: (callback: any) => {
                // Simulate the reduce operation in getBasicFacets
                const counts = mockAssetSearchData.reduce((acc, item) => {
                  acc[item.file_type] = (acc[item.file_type] || 0) + 1
                  return acc
                }, {} as Record<string, number>)
                
                const result = Object.entries(counts).map(([value, count]) => ({
                  value,
                  count,
                  label: value === 'image/jpeg' ? 'JPEG Images' : 'PNG Images'
                }))
                
                return callback({ data: result })
              }
            })
          }
        }
        if (table === 'projects') {
          return {
            select: () => ({
              then: async (callback: any) => {
                // First call returns projects
                const projectsResult = await callback({ data: mockProjectsData })
                
                // Mock the subsequent asset count query
                mockSupabase.from.mockReturnValueOnce({
                  select: () => ({ data: mockProjectCountsData })
                })
                
                return projectsResult
              }
            })
          }
        }
        return { select: () => ({ data: [] }) }
      })

      const result = await searchService.searchAssets({ query: 'test' })

      expect(result.facets.fileTypes.length).toBeGreaterThan(0)
    })
  })

  describe('Search Analytics', () => {
    it('should get search analytics with trends', async () => {
      const mockAnalytics = {
        popular_queries: [
          { query: 'design', count: 50 },
          { query: 'logo', count: 30 },
          { query: 'marketing', count: 25 }
        ],
        search_trends: [
          { date: '2024-01-01', count: 15 },
          { date: '2024-01-02', count: 22 },
          { date: '2024-01-03', count: 18 }
        ],
        top_clicked_assets: [
          { asset_id: 'a1', clicks: 45 },
          { asset_id: 'a2', clicks: 32 },
          { asset_id: 'a3', clicks: 28 }
        ]
      }

      mockSupabase.rpc.mockResolvedValue({
        data: mockAnalytics,
        error: null
      })

      const result = await searchService.getSearchAnalytics('user-1', 'project-1')

      expect(result.popularQueries).toHaveLength(3)
      expect(result.searchTrends).toHaveLength(3)
      expect(result.topClickedAssets).toHaveLength(3)
      expect(result.popularQueries[0].query).toBe('design')
      expect(result.popularQueries[0].count).toBe(50)
    })

    it('should handle analytics errors gracefully', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: new Error('Analytics failed')
      })

      const result = await searchService.getSearchAnalytics()

      expect(result.popularQueries).toEqual([])
      expect(result.searchTrends).toEqual([])
      expect(result.topClickedAssets).toEqual([])
    })

    it('should log search analytics without throwing errors', async () => {
      mockSupabase.from.mockImplementation(() => ({
        insert: () => ({ error: null })
      }))

      // Should not throw even if analytics logging fails
      await expect(searchService.logSearchAnalytics({
        query: 'test query',
        results_count: 5,
        user_id: 'user-1'
      })).resolves.toBeUndefined()
    })
  })

  describe('Enhanced Suggestions', () => {
    it('should provide intelligent suggestions with categories', async () => {
      const mockSuggestions = ['design mockup', 'design system', 'ui design']
      const mockTags = [{ name: 'design' }, { name: 'ui' }]
      const mockRecentSearches = []

      mockSupabase.rpc.mockResolvedValue({
        data: mockSuggestions,
        error: null
      })

      mockSupabase.from.mockImplementation((table) => {
        if (table === 'search_analytics') {
          return {
            select: () => ({
              order: () => ({
                limit: () => ({
                  then: (callback: any) => callback({ data: mockRecentSearches })
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

      const result = await searchService.getAutocomplete('design')

      expect(result.suggestions.length).toBeGreaterThan(0)
      expect(result.suggestions.some(s => s.type === 'query')).toBe(true)
      expect(result.suggestions.some(s => s.type === 'tag')).toBe(true)
      expect(result.popular_tags).toEqual(['design', 'ui'])
    })

    it('should handle file type suggestions', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: [], error: null })
      mockSupabase.from.mockImplementation(() => ({
        select: () => ({
          order: () => ({
            limit: () => ({
              then: (callback: any) => callback({ data: [] })
            })
          }),
          ilike: () => ({
            limit: () => ({ data: [] })
          })
        })
      }))

      const result = await searchService.getAutocomplete('image')

      expect(result.suggestions.some(s => s.type === 'filetype')).toBe(true)
    })
  })

  describe('Complex Search Scenarios', () => {
    it('should handle search with all filter types', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [
          {
            asset_id: '1',
            name: 'complex-search-result.jpg',
            file_type: 'image/jpeg',
            project_id: 'project-1',
            rank: 0.95
          }
        ],
        error: null
      })

      const filters: SearchFilters = {
        query: 'design mockup',
        projectIds: ['project-1', 'project-2'],
        fileTypes: ['image/jpeg', 'image/png'],
        tags: ['ui', 'design'],
        tagLogic: 'AND',
        status: ['ready'],
        uploadedBy: ['user-1'],
        dateRange: {
          start: '2024-01-01',
          end: '2024-12-31'
        },
        sizeRange: {
          min: 1,
          max: 10
        }
      }

      const sort: SearchSortOptions = {
        field: 'created_at',
        direction: 'desc'
      }

      const result = await searchService.searchAssets(filters, sort, 25, 50)

      expect(mockSupabase.rpc).toHaveBeenCalledWith('enhanced_search_assets', {
        search_query: 'design mockup',
        project_ids: ['project-1', 'project-2'],
        file_types: ['image/jpeg', 'image/png'],
        tag_names: ['ui', 'design'],
        status_filter: ['ready'],
        uploaded_by_ids: ['user-1'],
        date_start: '2024-01-01',
        date_end: '2024-12-31',
        size_min: 1048576, // 1MB in bytes
        size_max: 10485760, // 10MB in bytes
        sort_field: 'created_at',
        sort_direction: 'desc',
        limit_count: 25,
        offset_count: 50
      })

      expect(result.results).toHaveLength(1)
      expect(result.results[0].name).toBe('complex-search-result.jpg')
    })

    it('should handle empty search with facets only', async () => {
      mockSupabase.rpc
        .mockResolvedValueOnce({ data: [], error: null }) // enhanced_search_assets
        .mockResolvedValueOnce({ data: 0, error: null })  // count_search_results
        .mockResolvedValueOnce({ 
          data: { 
            file_types: [{ file_type: 'image/jpeg', count: 5 }],
            projects: [],
            tags: [],
            uploaded_by: []
          }, 
          error: null 
        }) // get_search_facets

      const result = await searchService.searchAssets({})

      expect(result.results).toEqual([])
      expect(result.facets.fileTypes).toHaveLength(1)
    })
  })

  describe('Error Recovery', () => {
    it('should recover from partial RPC failures', async () => {
      // Main search succeeds, but count fails
      mockSupabase.rpc
        .mockResolvedValueOnce({ 
          data: [{ asset_id: '1', name: 'test.jpg', file_type: 'image/jpeg', project_id: 'p1', rank: 1 }], 
          error: null 
        }) // enhanced_search_assets succeeds
        .mockResolvedValueOnce({ data: null, error: new Error('Count failed') }) // count_search_results fails
        .mockResolvedValueOnce({ 
          data: { file_types: [], projects: [], tags: [], uploaded_by: [] }, 
          error: null 
        }) // get_search_facets succeeds

      const result = await searchService.searchAssets({ query: 'test' })

      expect(result.results).toHaveLength(1)
      expect(result.total).toBe(1) // Should fallback to results length
    })

    it('should handle complete search failure gracefully', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: new Error('Complete failure')
      })

      await expect(searchService.searchAssets({ query: 'test' })).rejects.toThrow('Failed to search assets')
    })
  })
})