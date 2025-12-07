import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AssetSearchInterface } from '../AssetSearchInterface'
import { measurePerformance, expectPerformance } from '@/test/performance-setup'
import { generateMockAsset } from '@/test/test-utils'

// Mock the search service
vi.mock('@/lib/services/searchService', () => ({
  SearchService: {
    search: vi.fn(),
    getAutocompleteSuggestions: vi.fn(),
    saveSearch: vi.fn(),
  },
}))

describe('AssetSearchInterface - Performance Tests', () => {
  const mockProps = {
    onSearchResults: vi.fn(),
    onFiltersChange: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders search interface within performance budget', async () => {
    const duration = await measurePerformance(async () => {
      render(<AssetSearchInterface {...mockProps} />)
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Search assets...')).toBeInTheDocument()
      })
    }, 'AssetSearchInterface render')

    expectPerformance(duration, 100, 'Initial render should be under 100ms')
  })

  it('handles search input with debouncing efficiently', async () => {
    const { SearchService } = await import('@/lib/services/searchService')
    
    // Mock search results
    const mockResults = Array.from({ length: 100 }, (_, i) => 
      generateMockAsset({ id: `asset-${i}`, name: `Test Asset ${i}` })
    )
    vi.mocked(SearchService.search).mockResolvedValue({
      results: mockResults,
      total: 100,
      facets: {},
    })

    render(<AssetSearchInterface {...mockProps} />)
    const searchInput = screen.getByPlaceholderText('Search assets...')

    const duration = await measurePerformance(async () => {
      // Type search query
      fireEvent.change(searchInput, { target: { value: 'test query' } })
      
      // Wait for debounced search
      await waitFor(() => {
        expect(SearchService.search).toHaveBeenCalledWith('test query', expect.any(Object))
      }, { timeout: 1000 })
    }, 'Debounced search execution')

    expectPerformance(duration, 500, 'Debounced search should complete under 500ms')
  })

  it('autocomplete suggestions load quickly', async () => {
    const { SearchService } = await import('@/lib/services/searchService')
    
    const mockSuggestions = [
      'test image',
      'test document',
      'test video',
      'test audio',
      'test presentation',
    ]
    vi.mocked(SearchService.getAutocompleteSuggestions).mockResolvedValue(mockSuggestions)

    render(<AssetSearchInterface {...mockProps} />)
    const searchInput = screen.getByPlaceholderText('Search assets...')

    const duration = await measurePerformance(async () => {
      fireEvent.focus(searchInput)
      fireEvent.change(searchInput, { target: { value: 'test' } })
      
      await waitFor(() => {
        expect(screen.getByText('test image')).toBeInTheDocument()
      })
    }, 'Autocomplete suggestions')

    expectPerformance(duration, 200, 'Autocomplete should appear under 200ms')
  })

  it('handles large result sets efficiently', async () => {
    const { SearchService } = await import('@/lib/services/searchService')
    
    // Mock large result set
    const mockResults = Array.from({ length: 1000 }, (_, i) => 
      generateMockAsset({ id: `asset-${i}`, name: `Asset ${i}` })
    )
    vi.mocked(SearchService.search).mockResolvedValue({
      results: mockResults,
      total: 1000,
      facets: {
        fileType: { 'image/jpeg': 500, 'image/png': 300, 'video/mp4': 200 },
        tags: { design: 400, photography: 300, video: 200, audio: 100 },
      },
    })

    render(<AssetSearchInterface {...mockProps} />)
    const searchInput = screen.getByPlaceholderText('Search assets...')

    const duration = await measurePerformance(async () => {
      fireEvent.change(searchInput, { target: { value: 'large dataset' } })
      
      await waitFor(() => {
        expect(mockProps.onSearchResults).toHaveBeenCalledWith(
          expect.objectContaining({
            results: expect.arrayContaining([
              expect.objectContaining({ id: expect.stringContaining('asset-') })
            ])
          })
        )
      })
    }, 'Large result set processing')

    expectPerformance(duration, 1000, 'Large result set should process under 1s')
  })

  it('filter application performs well', async () => {
    render(<AssetSearchInterface {...mockProps} />)
    
    const duration = await measurePerformance(async () => {
      // Apply multiple filters
      const fileTypeFilter = screen.getByLabelText('Images')
      fireEvent.click(fileTypeFilter)
      
      const dateFilter = screen.getByLabelText('Last 30 days')
      fireEvent.click(dateFilter)
      
      const sizeFilter = screen.getByLabelText('Large files')
      fireEvent.click(sizeFilter)
      
      await waitFor(() => {
        expect(mockProps.onFiltersChange).toHaveBeenCalled()
      })
    }, 'Filter application')

    expectPerformance(duration, 150, 'Filter application should be under 150ms')
  })

  it('search history and saved searches load quickly', async () => {
    const { SearchService } = await import('@/lib/services/searchService')
    
    const mockSavedSearches = Array.from({ length: 20 }, (_, i) => ({
      id: `search-${i}`,
      query: `Saved search ${i}`,
      filters: {},
      createdAt: new Date().toISOString(),
    }))
    
    vi.mocked(SearchService.saveSearch).mockResolvedValue(mockSavedSearches[0])

    render(<AssetSearchInterface {...mockProps} />)
    
    const duration = await measurePerformance(async () => {
      const savedSearchesButton = screen.getByLabelText('Saved searches')
      fireEvent.click(savedSearchesButton)
      
      await waitFor(() => {
        expect(screen.getByText('Saved search 0')).toBeInTheDocument()
      })
    }, 'Saved searches loading')

    expectPerformance(duration, 300, 'Saved searches should load under 300ms')
  })

  it('complex search queries with multiple facets perform well', async () => {
    const { SearchService } = await import('@/lib/services/searchService')
    
    const complexQuery = {
      text: 'design mockup',
      filters: {
        fileType: ['image/jpeg', 'image/png'],
        tags: ['design', 'ui', 'mockup'],
        dateRange: { start: '2024-01-01', end: '2024-12-31' },
        sizeRange: { min: 1024, max: 10485760 },
        project: 'project-1',
      },
      sort: 'relevance',
      facets: ['fileType', 'tags', 'project'],
    }

    vi.mocked(SearchService.search).mockResolvedValue({
      results: Array.from({ length: 50 }, (_, i) => generateMockAsset({ id: `asset-${i}` })),
      total: 50,
      facets: {
        fileType: { 'image/jpeg': 30, 'image/png': 20 },
        tags: { design: 40, ui: 35, mockup: 25 },
        project: { 'project-1': 50 },
      },
    })

    render(<AssetSearchInterface {...mockProps} />)
    
    const duration = await measurePerformance(async () => {
      // Simulate complex search
      const searchInput = screen.getByPlaceholderText('Search assets...')
      fireEvent.change(searchInput, { target: { value: complexQuery.text } })
      
      // Apply filters
      const imageFilter = screen.getByLabelText('Images')
      fireEvent.click(imageFilter)
      
      const designTag = screen.getByLabelText('design')
      fireEvent.click(designTag)
      
      await waitFor(() => {
        expect(SearchService.search).toHaveBeenCalledWith(
          complexQuery.text,
          expect.objectContaining({
            filters: expect.any(Object)
          })
        )
      })
    }, 'Complex search query')

    expectPerformance(duration, 800, 'Complex search should complete under 800ms')
  })

  it('search result virtualization handles large lists efficiently', async () => {
    const { SearchService } = await import('@/lib/services/searchService')
    
    // Mock very large result set
    const mockResults = Array.from({ length: 10000 }, (_, i) => 
      generateMockAsset({ id: `asset-${i}`, name: `Asset ${i}` })
    )
    vi.mocked(SearchService.search).mockResolvedValue({
      results: mockResults,
      total: 10000,
      facets: {},
    })

    render(<AssetSearchInterface {...mockProps} />)
    
    const duration = await measurePerformance(async () => {
      const searchInput = screen.getByPlaceholderText('Search assets...')
      fireEvent.change(searchInput, { target: { value: 'massive dataset' } })
      
      await waitFor(() => {
        expect(mockProps.onSearchResults).toHaveBeenCalled()
      })
      
      // Simulate scrolling through results
      const resultsContainer = screen.getByTestId('search-results')
      fireEvent.scroll(resultsContainer, { target: { scrollTop: 5000 } })
      
      await waitFor(() => {
        // Should only render visible items, not all 10000
        const renderedItems = screen.getAllByTestId('search-result-item')
        expect(renderedItems.length).toBeLessThan(100)
      })
    }, 'Large result set virtualization')

    expectPerformance(duration, 1500, 'Virtualized large results should render under 1.5s')
  })

  it('memory usage remains stable during extended search sessions', async () => {
    const { SearchService } = await import('@/lib/services/searchService')
    
    vi.mocked(SearchService.search).mockResolvedValue({
      results: Array.from({ length: 100 }, (_, i) => generateMockAsset({ id: `asset-${i}` })),
      total: 100,
      facets: {},
    })

    render(<AssetSearchInterface {...mockProps} />)
    const searchInput = screen.getByPlaceholderText('Search assets...')

    const initialMemory = performance.memory?.usedJSHeapSize || 0
    
    // Perform multiple searches to test memory leaks
    for (let i = 0; i < 10; i++) {
      fireEvent.change(searchInput, { target: { value: `search query ${i}` } })
      await waitFor(() => {
        expect(SearchService.search).toHaveBeenCalledWith(`search query ${i}`, expect.any(Object))
      })
      
      // Clear previous results
      fireEvent.change(searchInput, { target: { value: '' } })
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    const finalMemory = performance.memory?.usedJSHeapSize || 0
    const memoryIncrease = finalMemory - initialMemory

    // Memory increase should be reasonable (less than 10MB)
    expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024)
  })
})