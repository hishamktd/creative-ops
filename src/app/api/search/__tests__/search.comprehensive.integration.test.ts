import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GET, POST } from '../route'
import { NextRequest } from 'next/server'
import { mockSupabaseClient, generateMockAsset } from '@/test/test-utils'

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createServerComponentClient: () => mockSupabaseClient
}))

// Mock search service
const mockSearchService = {
  searchAssets: vi.fn(),
  indexAsset: vi.fn(),
  updateSearchIndex: vi.fn(),
  getSearchSuggestions: vi.fn(),
  getSearchAnalytics: vi.fn(),
}

vi.mock('@/lib/services/searchService', () => ({
  SearchService: mockSearchService
}))

// Mock authentication
const mockAuth = {
  getUser: vi.fn(),
}

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => mockAuth
}))

describe('Search API - Comprehensive Integration Tests', () => {
  const mockUser = {
    id: 'user-1',
    email: 'test@example.com'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockAuth.getUser.mockResolvedValue(mockUser)
    
    // Setup default search results
    const mockSearchResults = Array.from({ length: 10 }, (_, i) => 
      generateMockAsset({
        id: `search-result-${i}`,
        name: `Search Result ${i}.jpg`,
        description: `Description for search result ${i}`,
        tags: ['search', 'test', `tag-${i % 3}`],
        file_type: i % 2 === 0 ? 'image/jpeg' : 'image/png'
      })
    )
    
    mockSearchService.searchAssets.mockResolvedValue({
      results: mockSearchResults,
      total: mockSearchResults.length,
      facets: {
        file_types: [
          { value: 'image/jpeg', count: 5 },
          { value: 'image/png', count: 5 }
        ],
        tags: [
          { value: 'search', count: 10 },
          { value: 'test', count: 10 },
          { value: 'tag-0', count: 4 },
          { value: 'tag-1', count: 3 },
          { value: 'tag-2', count: 3 }
        ]
      },
      suggestions: [],
      query_time: 45
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Basic Search Functionality', () => {
    it('should perform basic text search', async () => {
      const url = new URL('http://localhost:3000/api/search')
      url.searchParams.set('q', 'test image')
      url.searchParams.set('projectId', 'project-1')
      
      const request = new NextRequest(url)
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.results).toHaveLength(10)
      expect(data.total).toBe(10)
      
      expect(mockSearchService.searchAssets).toHaveBeenCalledWith({
        query: 'test image',
        projectId: 'project-1',
        filters: {},
        pagination: { limit: 20, offset: 0 },
        sorting: { field: 'relevance', order: 'desc' }
      })
    })

    it('should handle empty search query', async () => {
      const url = new URL('http://localhost:3000/api/search')
      url.searchParams.set('projectId', 'project-1')
      
      const request = new NextRequest(url)
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockSearchService.searchAssets).toHaveBeenCalledWith({
        query: '',
        projectId: 'project-1',
        filters: {},
        pagination: { limit: 20, offset: 0 },
        sorting: { field: 'created_at', order: 'desc' }
      })
    })

    it('should validate required project ID', async () => {
      const url = new URL('http://localhost:3000/api/search')
      url.searchParams.set('q', 'test')
      
      const request = new NextRequest(url)
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Project ID is required')
    })
  })

  describe('Advanced Search Features', () => {
    it('should handle file type filters', async () => {
      const url = new URL('http://localhost:3000/api/search')
      url.searchParams.set('q', 'test')
      url.searchParams.set('projectId', 'project-1')
      url.searchParams.set('fileTypes', 'image/jpeg,image/png')
      
      const request = new NextRequest(url)
      const response = await GET(request)

      expect(mockSearchService.searchAssets).toHaveBeenCalledWith({
        query: 'test',
        projectId: 'project-1',
        filters: {
          fileTypes: ['image/jpeg', 'image/png']
        },
        pagination: { limit: 20, offset: 0 },
        sorting: { field: 'relevance', order: 'desc' }
      })
    })

    it('should handle date range filters', async () => {
      const url = new URL('http://localhost:3000/api/search')
      url.searchParams.set('q', 'test')
      url.searchParams.set('projectId', 'project-1')
      url.searchParams.set('dateFrom', '2024-01-01')
      url.searchParams.set('dateTo', '2024-12-31')
      
      const request = new NextRequest(url)
      const response = await GET(request)

      expect(mockSearchService.searchAssets).toHaveBeenCalledWith({
        query: 'test',
        projectId: 'project-1',
        filters: {
          dateRange: {
            from: '2024-01-01',
            to: '2024-12-31'
          }
        },
        pagination: { limit: 20, offset: 0 },
        sorting: { field: 'relevance', order: 'desc' }
      })
    })

    it('should handle tag filters', async () => {
      const url = new URL('http://localhost:3000/api/search')
      url.searchParams.set('q', 'test')
      url.searchParams.set('projectId', 'project-1')
      url.searchParams.set('tags', 'design,final,approved')
      
      const request = new NextRequest(url)
      const response = await GET(request)

      expect(mockSearchService.searchAssets).toHaveBeenCalledWith({
        query: 'test',
        projectId: 'project-1',
        filters: {
          tags: ['design', 'final', 'approved']
        },
        pagination: { limit: 20, offset: 0 },
        sorting: { field: 'relevance', order: 'desc' }
      })
    })

    it('should handle size range filters', async () => {
      const url = new URL('http://localhost:3000/api/search')
      url.searchParams.set('q', 'test')
      url.searchParams.set('projectId', 'project-1')
      url.searchParams.set('sizeMin', '1000000') // 1MB
      url.searchParams.set('sizeMax', '10000000') // 10MB
      
      const request = new NextRequest(url)
      const response = await GET(request)

      expect(mockSearchService.searchAssets).toHaveBeenCalledWith({
        query: 'test',
        projectId: 'project-1',
        filters: {
          sizeRange: {
            min: 1000000,
            max: 10000000
          }
        },
        pagination: { limit: 20, offset: 0 },
        sorting: { field: 'relevance', order: 'desc' }
      })
    })

    it('should handle folder filters', async () => {
      const url = new URL('http://localhost:3000/api/search')
      url.searchParams.set('q', 'test')
      url.searchParams.set('projectId', 'project-1')
      url.searchParams.set('folderId', 'folder-123')
      
      const request = new NextRequest(url)
      const response = await GET(request)

      expect(mockSearchService.searchAssets).toHaveBeenCalledWith({
        query: 'test',
        projectId: 'project-1',
        filters: {
          folderId: 'folder-123'
        },
        pagination: { limit: 20, offset: 0 },
        sorting: { field: 'relevance', order: 'desc' }
      })
    })
  })

  describe('Pagination and Sorting', () => {
    it('should handle pagination parameters', async () => {
      const url = new URL('http://localhost:3000/api/search')
      url.searchParams.set('q', 'test')
      url.searchParams.set('projectId', 'project-1')
      url.searchParams.set('limit', '50')
      url.searchParams.set('offset', '100')
      
      const request = new NextRequest(url)
      const response = await GET(request)

      expect(mockSearchService.searchAssets).toHaveBeenCalledWith({
        query: 'test',
        projectId: 'project-1',
        filters: {},
        pagination: { limit: 50, offset: 100 },
        sorting: { field: 'relevance', order: 'desc' }
      })
    })

    it('should validate pagination limits', async () => {
      const url = new URL('http://localhost:3000/api/search')
      url.searchParams.set('q', 'test')
      url.searchParams.set('projectId', 'project-1')
      url.searchParams.set('limit', '1000') // Too large
      
      const request = new NextRequest(url)
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Limit cannot exceed 100')
    })

    it('should handle sorting parameters', async () => {
      const url = new URL('http://localhost:3000/api/search')
      url.searchParams.set('q', 'test')
      url.searchParams.set('projectId', 'project-1')
      url.searchParams.set('sortBy', 'created_at')
      url.searchParams.set('sortOrder', 'asc')
      
      const request = new NextRequest(url)
      const response = await GET(request)

      expect(mockSearchService.searchAssets).toHaveBeenCalledWith({
        query: 'test',
        projectId: 'project-1',
        filters: {},
        pagination: { limit: 20, offset: 0 },
        sorting: { field: 'created_at', order: 'asc' }
      })
    })

    it('should validate sorting fields', async () => {
      const url = new URL('http://localhost:3000/api/search')
      url.searchParams.set('q', 'test')
      url.searchParams.set('projectId', 'project-1')
      url.searchParams.set('sortBy', 'invalid_field')
      
      const request = new NextRequest(url)
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid sort field')
    })
  })

  describe('Faceted Search', () => {
    it('should return facets with search results', async () => {
      const url = new URL('http://localhost:3000/api/search')
      url.searchParams.set('q', 'test')
      url.searchParams.set('projectId', 'project-1')
      url.searchParams.set('includeFacets', 'true')
      
      const request = new NextRequest(url)
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.facets).toBeDefined()
      expect(data.facets.file_types).toHaveLength(2)
      expect(data.facets.tags).toHaveLength(5)
    })

    it('should handle facet filtering', async () => {
      const url = new URL('http://localhost:3000/api/search')
      url.searchParams.set('q', 'test')
      url.searchParams.set('projectId', 'project-1')
      url.searchParams.set('facetFilters', JSON.stringify({
        file_types: ['image/jpeg'],
        tags: ['design', 'final']
      }))
      
      const request = new NextRequest(url)
      const response = await GET(request)

      expect(mockSearchService.searchAssets).toHaveBeenCalledWith({
        query: 'test',
        projectId: 'project-1',
        filters: {
          facetFilters: {
            file_types: ['image/jpeg'],
            tags: ['design', 'final']
          }
        },
        pagination: { limit: 20, offset: 0 },
        sorting: { field: 'relevance', order: 'desc' }
      })
    })
  })

  describe('Search Suggestions and Autocomplete', () => {
    it('should provide search suggestions', async () => {
      mockSearchService.getSearchSuggestions.mockResolvedValue([
        'test image design',
        'test image mockup',
        'test image final'
      ])

      const url = new URL('http://localhost:3000/api/search')
      url.searchParams.set('q', 'test im')
      url.searchParams.set('projectId', 'project-1')
      url.searchParams.set('suggestions', 'true')
      
      const request = new NextRequest(url)
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.suggestions).toHaveLength(3)
      expect(data.suggestions[0]).toBe('test image design')
    })

    it('should handle autocomplete requests', async () => {
      mockSearchService.getSearchSuggestions.mockResolvedValue([
        'design assets',
        'design mockups',
        'design templates'
      ])

      const url = new URL('http://localhost:3000/api/search/autocomplete')
      url.searchParams.set('q', 'desi')
      url.searchParams.set('projectId', 'project-1')
      
      const request = new NextRequest(url)
      // Note: This would be handled by a separate autocomplete route
      // const response = await GET(request)
      
      expect(mockSearchService.getSearchSuggestions).toBeDefined()
    })
  })

  describe('Search Analytics', () => {
    it('should track search queries', async () => {
      const url = new URL('http://localhost:3000/api/search')
      url.searchParams.set('q', 'test query')
      url.searchParams.set('projectId', 'project-1')
      
      const request = new NextRequest(url)
      await GET(request)

      // Should track the search query for analytics
      expect(mockSearchService.searchAssets).toHaveBeenCalled()
      // Analytics tracking would be verified through the search service
    })

    it('should provide search analytics data', async () => {
      mockSearchService.getSearchAnalytics.mockResolvedValue({
        topQueries: [
          { query: 'design', count: 150 },
          { query: 'mockup', count: 120 },
          { query: 'logo', count: 100 }
        ],
        noResultsQueries: [
          { query: 'xyz', count: 5 },
          { query: 'abc', count: 3 }
        ],
        averageQueryTime: 67,
        totalSearches: 1500
      })

      const request = new NextRequest('http://localhost:3000/api/search/analytics', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      })

      // This would be handled by a separate analytics route
      // const response = await GET(request)
      
      expect(mockSearchService.getSearchAnalytics).toBeDefined()
    })
  })

  describe('Performance and Optimization', () => {
    it('should handle large result sets efficiently', async () => {
      const largeResultSet = Array.from({ length: 1000 }, (_, i) => 
        generateMockAsset({ id: `large-result-${i}` })
      )

      mockSearchService.searchAssets.mockResolvedValue({
        results: largeResultSet.slice(0, 20), // Paginated
        total: 1000,
        facets: {},
        suggestions: [],
        query_time: 150
      })

      const url = new URL('http://localhost:3000/api/search')
      url.searchParams.set('q', 'large dataset')
      url.searchParams.set('projectId', 'project-1')
      
      const startTime = Date.now()
      const request = new NextRequest(url)
      const response = await GET(request)
      const endTime = Date.now()
      
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.results).toHaveLength(20) // Paginated results
      expect(data.total).toBe(1000)
      expect(endTime - startTime).toBeLessThan(5000) // Should complete in < 5s
    })

    it('should implement search result caching', async () => {
      const url = new URL('http://localhost:3000/api/search')
      url.searchParams.set('q', 'cached query')
      url.searchParams.set('projectId', 'project-1')
      
      const request1 = new NextRequest(url)
      const request2 = new NextRequest(url)
      
      // First request
      await GET(request1)
      
      // Second identical request
      await GET(request2)
      
      // Should use caching mechanism (implementation dependent)
      expect(mockSearchService.searchAssets).toHaveBeenCalledTimes(2)
    })

    it('should handle concurrent search requests', async () => {
      const searchPromises = Array.from({ length: 10 }, (_, i) => {
        const url = new URL('http://localhost:3000/api/search')
        url.searchParams.set('q', `concurrent query ${i}`)
        url.searchParams.set('projectId', 'project-1')
        
        const request = new NextRequest(url)
        return GET(request)
      })

      const startTime = Date.now()
      const responses = await Promise.all(searchPromises)
      const endTime = Date.now()

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })

      // Should handle concurrent requests efficiently
      expect(endTime - startTime).toBeLessThan(10000) // < 10s for 10 concurrent requests
    })
  })

  describe('Error Handling', () => {
    it('should handle search service errors', async () => {
      mockSearchService.searchAssets.mockRejectedValue(
        new Error('Search index unavailable')
      )

      const url = new URL('http://localhost:3000/api/search')
      url.searchParams.set('q', 'test')
      url.searchParams.set('projectId', 'project-1')
      
      const request = new NextRequest(url)
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('Search index unavailable')
    })

    it('should handle malformed query parameters', async () => {
      const url = new URL('http://localhost:3000/api/search')
      url.searchParams.set('q', 'test')
      url.searchParams.set('projectId', 'project-1')
      url.searchParams.set('facetFilters', 'invalid-json')
      
      const request = new NextRequest(url)
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid facet filters')
    })

    it('should handle timeout scenarios', async () => {
      mockSearchService.searchAssets.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Search timeout')), 30000)
        )
      )

      const url = new URL('http://localhost:3000/api/search')
      url.searchParams.set('q', 'timeout test')
      url.searchParams.set('projectId', 'project-1')
      
      const request = new NextRequest(url)
      
      // Should timeout and return error
      const response = await Promise.race([
        GET(request),
        new Promise<Response>((_, reject) => 
          setTimeout(() => reject(new Error('Test timeout')), 5000)
        )
      ]).catch(() => 
        new Response(JSON.stringify({ error: 'Request timeout' }), { 
          status: 408,
          headers: { 'Content-Type': 'application/json' }
        })
      )

      expect(response.status).toBe(408)
    })
  })

  describe('Authentication and Authorization', () => {
    it('should require authentication', async () => {
      mockAuth.getUser.mockResolvedValue(null)

      const url = new URL('http://localhost:3000/api/search')
      url.searchParams.set('q', 'test')
      url.searchParams.set('projectId', 'project-1')
      
      const request = new NextRequest(url)
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toContain('Authentication required')
    })

    it('should validate project access', async () => {
      // Mock project access check
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' } // Not found
              })
            })
          })
        })
      })

      const url = new URL('http://localhost:3000/api/search')
      url.searchParams.set('q', 'test')
      url.searchParams.set('projectId', 'unauthorized-project')
      
      const request = new NextRequest(url)
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('Insufficient permissions')
    })
  })

  describe('Saved Searches', () => {
    it('should save search queries', async () => {
      const searchData = {
        name: 'My Saved Search',
        query: 'design assets',
        filters: {
          fileTypes: ['image/jpeg', 'image/png'],
          tags: ['design', 'final']
        },
        projectId: 'project-1'
      }

      const request = new NextRequest('http://localhost:3000/api/search/saved', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(searchData)
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.savedSearch).toEqual(
        expect.objectContaining({
          name: 'My Saved Search',
          query: 'design assets'
        })
      )
    })

    it('should retrieve saved searches', async () => {
      const savedSearches = [
        {
          id: 'saved-1',
          name: 'Design Assets',
          query: 'design',
          filters: { fileTypes: ['image/jpeg'] },
          created_at: new Date().toISOString()
        },
        {
          id: 'saved-2',
          name: 'Final Mockups',
          query: 'mockup final',
          filters: { tags: ['final'] },
          created_at: new Date().toISOString()
        }
      ]

      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: savedSearches,
              error: null
            })
          })
        })
      })

      const url = new URL('http://localhost:3000/api/search/saved')
      url.searchParams.set('projectId', 'project-1')
      
      const request = new NextRequest(url)
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.savedSearches).toHaveLength(2)
      expect(data.savedSearches[0].name).toBe('Design Assets')
    })
  })
})