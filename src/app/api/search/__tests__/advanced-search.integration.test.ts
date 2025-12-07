import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createMocks } from 'node-mocks-http'
import { POST } from '../route'
import { mockSupabaseClient } from '@/test/test-utils'

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createServerComponentClient: () => mockSupabaseClient,
}))

// Mock search service
vi.mock('@/lib/services/searchService', () => ({
  SearchService: {
    search: vi.fn(),
    buildSearchQuery: vi.fn(),
    executeFullTextSearch: vi.fn(),
    applyFilters: vi.fn(),
  },
}))

describe('/api/search - Advanced Search Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('handles complex search queries with multiple filters', async () => {
    const { SearchService } = await import('@/lib/services/searchService')
    
    const mockResults = {
      results: [
        {
          id: 'asset-1',
          name: 'design-mockup.jpg',
          file_type: 'image/jpeg',
          tags: ['design', 'ui', 'mockup'],
          created_at: '2024-01-15T10:00:00Z',
          relevance_score: 0.95,
        },
        {
          id: 'asset-2',
          name: 'ui-components.fig',
          file_type: 'application/figma',
          tags: ['design', 'ui', 'components'],
          created_at: '2024-01-10T14:30:00Z',
          relevance_score: 0.87,
        },
      ],
      total: 2,
      facets: {
        file_type: {
          'image/jpeg': 1,
          'application/figma': 1,
        },
        tags: {
          design: 2,
          ui: 2,
          mockup: 1,
          components: 1,
        },
        date_ranges: {
          'last_week': 2,
          'last_month': 2,
        },
      },
      suggestions: ['design system', 'ui kit'],
    }

    vi.mocked(SearchService.search).mockResolvedValue(mockResults)

    const searchQuery = {
      query: 'design ui',
      filters: {
        file_types: ['image/jpeg', 'application/figma'],
        tags: ['design', 'ui'],
        date_range: {
          start: '2024-01-01',
          end: '2024-01-31',
        },
        size_range: {
          min: 1024,
          max: 10485760,
        },
        projects: ['project-1', 'project-2'],
      },
      sort: {
        field: 'relevance',
        direction: 'desc',
      },
      pagination: {
        page: 1,
        limit: 20,
      },
      facets: ['file_type', 'tags', 'date_ranges'],
    }

    const { req } = createMocks({
      method: 'POST',
      body: searchQuery,
    })

    const response = await POST(req as any)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.results).toHaveLength(2)
    expect(result.data.total).toBe(2)
    expect(result.data.facets).toBeDefined()
    expect(result.data.suggestions).toHaveLength(2)

    expect(SearchService.search).toHaveBeenCalledWith(
      searchQuery.query,
      expect.objectContaining({
        filters: searchQuery.filters,
        sort: searchQuery.sort,
        pagination: searchQuery.pagination,
        facets: searchQuery.facets,
      })
    )
  })

  it('performs full-text search with content extraction', async () => {
    const { SearchService } = await import('@/lib/services/searchService')
    
    const mockResults = {
      results: [
        {
          id: 'asset-1',
          name: 'project-brief.pdf',
          file_type: 'application/pdf',
          extracted_text: 'This project aims to create a modern user interface...',
          text_matches: [
            {
              field: 'extracted_text',
              snippet: 'modern <mark>user interface</mark> design',
              score: 0.92,
            },
          ],
        },
      ],
      total: 1,
      facets: {},
    }

    vi.mocked(SearchService.executeFullTextSearch).mockResolvedValue(mockResults)

    const searchQuery = {
      query: 'user interface design',
      search_type: 'full_text',
      include_content: true,
      highlight: true,
    }

    const { req } = createMocks({
      method: 'POST',
      body: searchQuery,
    })

    const response = await POST(req as any)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.data.results[0].text_matches).toBeDefined()
    expect(result.data.results[0].text_matches[0].snippet).toContain('<mark>')
  })

  it('handles semantic search with vector similarity', async () => {
    const { SearchService } = await import('@/lib/services/searchService')
    
    const mockResults = {
      results: [
        {
          id: 'asset-1',
          name: 'logo-design.svg',
          similarity_score: 0.89,
          semantic_tags: ['branding', 'identity', 'visual'],
        },
        {
          id: 'asset-2',
          name: 'brand-guidelines.pdf',
          similarity_score: 0.76,
          semantic_tags: ['branding', 'guidelines', 'standards'],
        },
      ],
      total: 2,
      facets: {},
    }

    vi.mocked(SearchService.search).mockResolvedValue(mockResults)

    const searchQuery = {
      query: 'company branding materials',
      search_type: 'semantic',
      similarity_threshold: 0.7,
    }

    const { req } = createMocks({
      method: 'POST',
      body: searchQuery,
    })

    const response = await POST(req as any)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.data.results).toHaveLength(2)
    expect(result.data.results[0].similarity_score).toBeGreaterThan(0.7)
  })

  it('supports fuzzy search with typo tolerance', async () => {
    const { SearchService } = await import('@/lib/services/searchService')
    
    const mockResults = {
      results: [
        {
          id: 'asset-1',
          name: 'presentation-slides.pptx',
          fuzzy_matches: [
            {
              field: 'name',
              original: 'presentaton',
              corrected: 'presentation',
              distance: 1,
            },
          ],
        },
      ],
      total: 1,
      facets: {},
      corrections: {
        'presentaton': 'presentation',
      },
    }

    vi.mocked(SearchService.search).mockResolvedValue(mockResults)

    const searchQuery = {
      query: 'presentaton slides',
      fuzzy: true,
      max_edit_distance: 2,
    }

    const { req } = createMocks({
      method: 'POST',
      body: searchQuery,
    })

    const response = await POST(req as any)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.data.corrections).toBeDefined()
    expect(result.data.corrections['presentaton']).toBe('presentation')
  })

  it('handles geo-spatial search for location-tagged assets', async () => {
    const { SearchService } = await import('@/lib/services/searchService')
    
    const mockResults = {
      results: [
        {
          id: 'asset-1',
          name: 'office-photo.jpg',
          location: {
            latitude: 40.7128,
            longitude: -74.0060,
            address: 'New York, NY',
          },
          distance_km: 2.5,
        },
      ],
      total: 1,
      facets: {},
    }

    vi.mocked(SearchService.search).mockResolvedValue(mockResults)

    const searchQuery = {
      query: 'office photos',
      geo_filter: {
        center: {
          latitude: 40.7589,
          longitude: -73.9851,
        },
        radius_km: 10,
      },
    }

    const { req } = createMocks({
      method: 'POST',
      body: searchQuery,
    })

    const response = await POST(req as any)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.data.results[0].location).toBeDefined()
    expect(result.data.results[0].distance_km).toBeLessThan(10)
  })

  it('performs aggregated search across multiple projects', async () => {
    const { SearchService } = await import('@/lib/services/searchService')
    
    const mockResults = {
      results: [
        {
          id: 'asset-1',
          project_id: 'project-1',
          project_name: 'Website Redesign',
          name: 'homepage-mockup.jpg',
        },
        {
          id: 'asset-2',
          project_id: 'project-2',
          project_name: 'Mobile App',
          name: 'app-screens.fig',
        },
      ],
      total: 2,
      facets: {
        projects: {
          'project-1': 1,
          'project-2': 1,
        },
      },
      project_stats: {
        'project-1': { total_assets: 45, matching: 1 },
        'project-2': { total_assets: 32, matching: 1 },
      },
    }

    vi.mocked(SearchService.search).mockResolvedValue(mockResults)

    const searchQuery = {
      query: 'mockup screens',
      scope: 'all_projects',
      group_by_project: true,
    }

    const { req } = createMocks({
      method: 'POST',
      body: searchQuery,
    })

    const response = await POST(req as any)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.data.project_stats).toBeDefined()
    expect(Object.keys(result.data.project_stats)).toHaveLength(2)
  })

  it('handles search with custom metadata fields', async () => {
    const { SearchService } = await import('@/lib/services/searchService')
    
    const mockResults = {
      results: [
        {
          id: 'asset-1',
          name: 'product-photo.jpg',
          custom_metadata: {
            camera_model: 'Canon EOS R5',
            lens: '24-70mm f/2.8',
            iso: 400,
            aperture: 'f/5.6',
            shoot_date: '2024-01-15',
          },
        },
      ],
      total: 1,
      facets: {
        camera_model: {
          'Canon EOS R5': 1,
        },
      },
    }

    vi.mocked(SearchService.search).mockResolvedValue(mockResults)

    const searchQuery = {
      query: 'product photography',
      metadata_filters: {
        camera_model: 'Canon EOS R5',
        iso: { min: 100, max: 800 },
      },
    }

    const { req } = createMocks({
      method: 'POST',
      body: searchQuery,
    })

    const response = await POST(req as any)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.data.results[0].custom_metadata).toBeDefined()
    expect(result.data.results[0].custom_metadata.camera_model).toBe('Canon EOS R5')
  })

  it('supports search result ranking and personalization', async () => {
    const { SearchService } = await import('@/lib/services/searchService')
    
    const mockResults = {
      results: [
        {
          id: 'asset-1',
          name: 'design-system.fig',
          relevance_score: 0.95,
          personalization_score: 0.8,
          final_score: 0.875,
          ranking_factors: {
            text_match: 0.9,
            recency: 0.7,
            popularity: 0.8,
            user_preference: 0.9,
          },
        },
      ],
      total: 1,
      facets: {},
    }

    vi.mocked(SearchService.search).mockResolvedValue(mockResults)

    const searchQuery = {
      query: 'design system',
      personalize: true,
      user_id: 'user-123',
      ranking_weights: {
        text_match: 0.4,
        recency: 0.2,
        popularity: 0.2,
        user_preference: 0.2,
      },
    }

    const { req } = createMocks({
      method: 'POST',
      body: searchQuery,
    })

    const response = await POST(req as any)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.data.results[0].ranking_factors).toBeDefined()
    expect(result.data.results[0].final_score).toBeGreaterThan(0)
  })

  it('handles search performance monitoring and analytics', async () => {
    const { SearchService } = await import('@/lib/services/searchService')
    
    const mockResults = {
      results: [],
      total: 0,
      facets: {},
      performance: {
        query_time_ms: 45,
        index_time_ms: 12,
        total_time_ms: 57,
        cache_hit: false,
      },
    }

    vi.mocked(SearchService.search).mockResolvedValue(mockResults)

    const searchQuery = {
      query: 'performance test query',
      include_performance: true,
    }

    const { req } = createMocks({
      method: 'POST',
      body: searchQuery,
    })

    const response = await POST(req as any)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.data.performance).toBeDefined()
    expect(result.data.performance.total_time_ms).toBeGreaterThan(0)
    
    // Should log search analytics
    expect(SearchService.search).toHaveBeenCalledWith(
      searchQuery.query,
      expect.objectContaining({
        include_performance: true,
      })
    )
  })

  it('handles search rate limiting and throttling', async () => {
    // Simulate multiple rapid requests
    const requests = Array.from({ length: 10 }, () => 
      createMocks({
        method: 'POST',
        body: { query: 'test query' },
        headers: { 'x-forwarded-for': '192.168.1.1' },
      })
    )

    const responses = await Promise.all(
      requests.map(({ req }) => POST(req as any))
    )

    // Some requests should be rate limited
    const rateLimitedResponses = responses.filter(r => r.status === 429)
    expect(rateLimitedResponses.length).toBeGreaterThan(0)
  })
})