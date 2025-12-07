import { renderHook, act, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useAssetSearch } from '../useAssetSearch'

// Mock the search service
vi.mock('@/lib/services/searchService', () => ({
  SearchService: {
    search: vi.fn(),
    getAutocompleteSuggestions: vi.fn(),
    saveSearch: vi.fn(),
    getSavedSearches: vi.fn(),
  },
}))

// Mock debounce to make tests synchronous
vi.mock('lodash/debounce', () => ({
  default: (fn: Function) => fn,
}))

describe('useAssetSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Basic Search Functionality', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => useAssetSearch())

      expect(result.current.query).toBe('')
      expect(result.current.results).toEqual([])
      expect(result.current.isLoading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.suggestions).toEqual([])
    })

    it('should update query when setQuery is called', () => {
      const { result } = renderHook(() => useAssetSearch())

      act(() => {
        result.current.setQuery('test query')
      })

      expect(result.current.query).toBe('test query')
    })

    it('should perform search when query changes', async () => {
      const mockResults = [
        { id: 'asset-1', name: 'test-image.jpg' },
        { id: 'asset-2', name: 'test-document.pdf' },
      ]

      const { SearchService } = await import('@/lib/services/searchService')
      vi.mocked(SearchService.search).mockResolvedValue({
        success: true,
        data: mockResults,
      })

      const { result } = renderHook(() => useAssetSearch())

      act(() => {
        result.current.setQuery('test')
      })

      await waitFor(() => {
        expect(result.current.results).toEqual(mockResults)
        expect(result.current.isLoading).toBe(false)
      })

      expect(SearchService.search).toHaveBeenCalledWith({
        query: 'test',
        filters: {},
        sortBy: { field: 'relevance', direction: 'desc' },
        limit: 50,
        offset: 0,
      })
    })

    it('should handle search errors', async () => {
      const { SearchService } = await import('@/lib/services/searchService')
      vi.mocked(SearchService.search).mockResolvedValue({
        success: false,
        error: 'Search failed',
      })

      const { result } = renderHook(() => useAssetSearch())

      act(() => {
        result.current.setQuery('test')
      })

      await waitFor(() => {
        expect(result.current.error).toBe('Search failed')
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('should not search for empty queries', async () => {
      const { SearchService } = await import('@/lib/services/searchService')

      const { result } = renderHook(() => useAssetSearch())

      act(() => {
        result.current.setQuery('')
      })

      await waitFor(() => {
        expect(SearchService.search).not.toHaveBeenCalled()
        expect(result.current.results).toEqual([])
      })
    })
  })

  describe('Filters and Sorting', () => {
    it('should apply filters to search', async () => {
      const { SearchService } = await import('@/lib/services/searchService')
      vi.mocked(SearchService.search).mockResolvedValue({
        success: true,
        data: [],
      })

      const { result } = renderHook(() => useAssetSearch())

      act(() => {
        result.current.setFilters({ fileType: 'image', projectId: 'project-1' })
        result.current.setQuery('test')
      })

      await waitFor(() => {
        expect(SearchService.search).toHaveBeenCalledWith({
          query: 'test',
          filters: { fileType: 'image', projectId: 'project-1' },
          sortBy: { field: 'relevance', direction: 'desc' },
          limit: 50,
          offset: 0,
        })
      })
    })

    it('should apply sorting to search', async () => {
      const { SearchService } = await import('@/lib/services/searchService')
      vi.mocked(SearchService.search).mockResolvedValue({
        success: true,
        data: [],
      })

      const { result } = renderHook(() => useAssetSearch())

      act(() => {
        result.current.setSortBy({ field: 'created_at', direction: 'asc' })
        result.current.setQuery('test')
      })

      await waitFor(() => {
        expect(SearchService.search).toHaveBeenCalledWith({
          query: 'test',
          filters: {},
          sortBy: { field: 'created_at', direction: 'asc' },
          limit: 50,
          offset: 0,
        })
      })
    })

    it('should clear filters', async () => {
      const { result } = renderHook(() => useAssetSearch())

      act(() => {
        result.current.setFilters({ fileType: 'image' })
      })

      expect(result.current.filters).toEqual({ fileType: 'image' })

      act(() => {
        result.current.clearFilters()
      })

      expect(result.current.filters).toEqual({})
    })
  })

  describe('Autocomplete Suggestions', () => {
    it('should fetch suggestions when query changes', async () => {
      const mockSuggestions = ['test image', 'test document', 'test video']

      const { SearchService } = await import('@/lib/services/searchService')
      vi.mocked(SearchService.getAutocompleteSuggestions).mockResolvedValue({
        success: true,
        data: mockSuggestions,
      })

      const { result } = renderHook(() => useAssetSearch({ enableAutocomplete: true }))

      act(() => {
        result.current.setQuery('test')
      })

      await waitFor(() => {
        expect(result.current.suggestions).toEqual(mockSuggestions)
      })

      expect(SearchService.getAutocompleteSuggestions).toHaveBeenCalledWith('test')
    })

    it('should not fetch suggestions when autocomplete is disabled', async () => {
      const { SearchService } = await import('@/lib/services/searchService')

      const { result } = renderHook(() => useAssetSearch({ enableAutocomplete: false }))

      act(() => {
        result.current.setQuery('test')
      })

      await waitFor(() => {
        expect(SearchService.getAutocompleteSuggestions).not.toHaveBeenCalled()
        expect(result.current.suggestions).toEqual([])
      })
    })

    it('should clear suggestions when query is empty', async () => {
      const { result } = renderHook(() => useAssetSearch({ enableAutocomplete: true }))

      // First set a query to get suggestions
      act(() => {
        result.current.setQuery('test')
      })

      // Then clear the query
      act(() => {
        result.current.setQuery('')
      })

      expect(result.current.suggestions).toEqual([])
    })
  })

  describe('Pagination', () => {
    it('should load more results when loadMore is called', async () => {
      const initialResults = [{ id: 'asset-1', name: 'test1.jpg' }]
      const moreResults = [{ id: 'asset-2', name: 'test2.jpg' }]

      const { SearchService } = await import('@/lib/services/searchService')
      vi.mocked(SearchService.search)
        .mockResolvedValueOnce({
          success: true,
          data: initialResults,
        })
        .mockResolvedValueOnce({
          success: true,
          data: moreResults,
        })

      const { result } = renderHook(() => useAssetSearch())

      // Initial search
      act(() => {
        result.current.setQuery('test')
      })

      await waitFor(() => {
        expect(result.current.results).toEqual(initialResults)
      })

      // Load more
      act(() => {
        result.current.loadMore()
      })

      await waitFor(() => {
        expect(result.current.results).toEqual([...initialResults, ...moreResults])
      })

      expect(SearchService.search).toHaveBeenCalledTimes(2)
      expect(SearchService.search).toHaveBeenLastCalledWith({
        query: 'test',
        filters: {},
        sortBy: { field: 'relevance', direction: 'desc' },
        limit: 50,
        offset: 50,
      })
    })

    it('should handle hasMore state correctly', async () => {
      const { SearchService } = await import('@/lib/services/searchService')
      vi.mocked(SearchService.search).mockResolvedValue({
        success: true,
        data: Array(25).fill(null).map((_, i) => ({ id: `asset-${i}`, name: `test${i}.jpg` })),
      })

      const { result } = renderHook(() => useAssetSearch())

      act(() => {
        result.current.setQuery('test')
      })

      await waitFor(() => {
        // Should have more results if we got less than the limit
        expect(result.current.hasMore).toBe(false) // 25 < 50, so no more
      })
    })
  })

  describe('Saved Searches', () => {
    it('should save search when saveCurrentSearch is called', async () => {
      const { SearchService } = await import('@/lib/services/searchService')
      vi.mocked(SearchService.saveSearch).mockResolvedValue({
        success: true,
        data: { id: 'search-1', name: 'My Search' },
      })

      const { result } = renderHook(() => useAssetSearch())

      act(() => {
        result.current.setQuery('test')
        result.current.setFilters({ fileType: 'image' })
      })

      act(() => {
        result.current.saveCurrentSearch('My Search')
      })

      await waitFor(() => {
        expect(SearchService.saveSearch).toHaveBeenCalledWith({
          name: 'My Search',
          query: 'test',
          filters: { fileType: 'image' },
          sortBy: { field: 'relevance', direction: 'desc' },
        })
      })
    })

    it('should load saved searches', async () => {
      const mockSavedSearches = [
        { id: 'search-1', name: 'Images', query: 'image' },
        { id: 'search-2', name: 'Documents', query: 'pdf' },
      ]

      const { SearchService } = await import('@/lib/services/searchService')
      vi.mocked(SearchService.getSavedSearches).mockResolvedValue({
        success: true,
        data: mockSavedSearches,
      })

      const { result } = renderHook(() => useAssetSearch())

      act(() => {
        result.current.loadSavedSearches()
      })

      await waitFor(() => {
        expect(result.current.savedSearches).toEqual(mockSavedSearches)
      })
    })

    it('should apply saved search when applySavedSearch is called', async () => {
      const savedSearch = {
        id: 'search-1',
        name: 'My Search',
        query: 'test query',
        filters: { fileType: 'image' },
        sortBy: { field: 'created_at', direction: 'desc' as const },
      }

      const { SearchService } = await import('@/lib/services/searchService')
      vi.mocked(SearchService.search).mockResolvedValue({
        success: true,
        data: [],
      })

      const { result } = renderHook(() => useAssetSearch())

      act(() => {
        result.current.applySavedSearch(savedSearch)
      })

      expect(result.current.query).toBe('test query')
      expect(result.current.filters).toEqual({ fileType: 'image' })
      expect(result.current.sortBy).toEqual({ field: 'created_at', direction: 'desc' })

      await waitFor(() => {
        expect(SearchService.search).toHaveBeenCalledWith({
          query: 'test query',
          filters: { fileType: 'image' },
          sortBy: { field: 'created_at', direction: 'desc' },
          limit: 50,
          offset: 0,
        })
      })
    })
  })

  describe('Search History', () => {
    it('should track search history', () => {
      const { result } = renderHook(() => useAssetSearch())

      act(() => {
        result.current.setQuery('first search')
      })

      act(() => {
        result.current.setQuery('second search')
      })

      act(() => {
        result.current.setQuery('third search')
      })

      expect(result.current.searchHistory).toEqual([
        'third search',
        'second search',
        'first search',
      ])
    })

    it('should limit search history size', () => {
      const { result } = renderHook(() => useAssetSearch({ maxHistorySize: 2 }))

      act(() => {
        result.current.setQuery('first')
      })

      act(() => {
        result.current.setQuery('second')
      })

      act(() => {
        result.current.setQuery('third')
      })

      expect(result.current.searchHistory).toEqual(['third', 'second'])
    })

    it('should clear search history', () => {
      const { result } = renderHook(() => useAssetSearch())

      act(() => {
        result.current.setQuery('test')
      })

      expect(result.current.searchHistory).toHaveLength(1)

      act(() => {
        result.current.clearHistory()
      })

      expect(result.current.searchHistory).toEqual([])
    })
  })

  describe('Performance', () => {
    it('should debounce search requests', async () => {
      // Re-mock debounce to actually debounce for this test
      const { default: debounce } = await import('lodash/debounce')
      vi.mocked(debounce).mockImplementation((fn, delay) => {
        let timeoutId: NodeJS.Timeout
        return (...args: any[]) => {
          clearTimeout(timeoutId)
          timeoutId = setTimeout(() => fn(...args), delay)
        }
      })

      const { SearchService } = await import('@/lib/services/searchService')
      vi.mocked(SearchService.search).mockResolvedValue({
        success: true,
        data: [],
      })

      const { result } = renderHook(() => useAssetSearch({ debounceMs: 300 }))

      // Rapid query changes
      act(() => {
        result.current.setQuery('t')
      })

      act(() => {
        result.current.setQuery('te')
      })

      act(() => {
        result.current.setQuery('test')
      })

      // Should only call search once after debounce
      await new Promise(resolve => setTimeout(resolve, 350))

      expect(SearchService.search).toHaveBeenCalledTimes(1)
      expect(SearchService.search).toHaveBeenCalledWith({
        query: 'test',
        filters: {},
        sortBy: { field: 'relevance', direction: 'desc' },
        limit: 50,
        offset: 0,
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      const { SearchService } = await import('@/lib/services/searchService')
      vi.mocked(SearchService.search).mockRejectedValue(new Error('Network error'))

      const { result } = renderHook(() => useAssetSearch())

      act(() => {
        result.current.setQuery('test')
      })

      await waitFor(() => {
        expect(result.current.error).toBe('Network error')
        expect(result.current.isLoading).toBe(false)
      })
    })

    it('should retry failed searches', async () => {
      const { SearchService } = await import('@/lib/services/searchService')
      vi.mocked(SearchService.search)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          success: true,
          data: [{ id: 'asset-1', name: 'test.jpg' }],
        })

      const { result } = renderHook(() => useAssetSearch())

      act(() => {
        result.current.setQuery('test')
      })

      await waitFor(() => {
        expect(result.current.error).toBe('Network error')
      })

      act(() => {
        result.current.retry()
      })

      await waitFor(() => {
        expect(result.current.error).toBeNull()
        expect(result.current.results).toHaveLength(1)
      })
    })
  })
})