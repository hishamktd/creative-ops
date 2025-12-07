'use client'

import { useState, useCallback, useEffect } from 'react'
import type { 
  SearchFilters, 
  SearchSortOptions, 
  SearchResponse, 
  SavedSearch 
} from '@/types/search'

interface UseAssetSearchOptions {
  projectId?: string
  autoSearch?: boolean
  resultsPerPage?: number
}

export function useAssetSearch({
  projectId,
  autoSearch = false,
  resultsPerPage = 20
}: UseAssetSearchOptions = {}) {
  const [filters, setFilters] = useState<SearchFilters>({
    projectIds: projectId ? [projectId] : undefined
  })
  const [sort, setSort] = useState<SearchSortOptions>({
    field: 'relevance',
    direction: 'desc'
  })
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null)
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  // Perform search
  const performSearch = useCallback(async (
    searchFilters: SearchFilters = filters,
    searchSort: SearchSortOptions = sort,
    page: number = 0,
    append: boolean = false
  ) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const offset = page * resultsPerPage
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: searchFilters,
          sort: searchSort,
          limit: resultsPerPage,
          offset
        })
      })

      if (!response.ok) {
        throw new Error('Search failed')
      }

      const data: SearchResponse = await response.json()
      
      if (append && searchResponse) {
        setSearchResponse({
          ...data,
          results: [...searchResponse.results, ...data.results]
        })
      } else {
        setSearchResponse(data)
      }
      
      setHasMore(data.results.length === resultsPerPage)
      setCurrentPage(page)

      // Log analytics if query is provided
      if (searchFilters.query) {
        await logSearchAnalytics({
          query: searchFilters.query,
          results_count: data.total,
          project_id: searchFilters.projectIds?.[0]
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setIsLoading(false)
    }
  }, [filters, sort, searchResponse, resultsPerPage])

  // Search function
  const search = useCallback(() => {
    setCurrentPage(0)
    performSearch(filters, sort, 0, false)
  }, [filters, sort, performSearch])

  // Load more results
  const loadMore = useCallback(() => {
    const nextPage = currentPage + 1
    performSearch(filters, sort, nextPage, true)
  }, [currentPage, filters, sort, performSearch])

  // Update filters
  const updateFilters = useCallback((newFilters: SearchFilters) => {
    setFilters(newFilters)
    if (autoSearch) {
      setCurrentPage(0)
      performSearch(newFilters, sort, 0, false)
    }
  }, [autoSearch, sort, performSearch])

  // Update sort
  const updateSort = useCallback((newSort: SearchSortOptions) => {
    setSort(newSort)
    setCurrentPage(0)
    performSearch(filters, newSort, 0, false)
  }, [filters, performSearch])

  // Clear search
  const clearSearch = useCallback(() => {
    setFilters({ projectIds: projectId ? [projectId] : undefined })
    setSearchResponse(null)
    setCurrentPage(0)
    setHasMore(false)
    setError(null)
  }, [projectId])

  // Load saved searches
  const loadSavedSearches = useCallback(async () => {
    try {
      const response = await fetch('/api/search/saved')
      if (response.ok) {
        const data = await response.json()
        setSavedSearches(data)
      }
    } catch (err) {
      console.error('Error loading saved searches:', err)
    }
  }, [])

  // Save search
  const saveSearch = useCallback(async (
    name: string, 
    description?: string,
    isSmartFolder: boolean = false
  ) => {
    try {
      const response = await fetch('/api/search/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          filters,
          sort,
          is_smart_folder: isSmartFolder
        })
      })

      if (response.ok) {
        await loadSavedSearches()
        return true
      }
      return false
    } catch (err) {
      console.error('Error saving search:', err)
      return false
    }
  }, [filters, sort, loadSavedSearches])

  // Load saved search
  const loadSavedSearch = useCallback((search: SavedSearch) => {
    setFilters(search.filters)
    setSort(search.sort)
    performSearch(search.filters, search.sort, 0, false)
  }, [performSearch])

  // Delete saved search
  const deleteSavedSearch = useCallback(async (searchId: string) => {
    try {
      const response = await fetch(`/api/search/saved?id=${searchId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await loadSavedSearches()
        return true
      }
      return false
    } catch (err) {
      console.error('Error deleting saved search:', err)
      return false
    }
  }, [loadSavedSearches])

  // Log search analytics
  const logSearchAnalytics = useCallback(async (analytics: {
    query: string
    results_count: number
    clicked_result?: string
    project_id?: string
  }) => {
    try {
      await fetch('/api/search/analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analytics)
      })
    } catch (err) {
      // Don't throw error for analytics logging
      console.error('Error logging search analytics:', err)
    }
  }, [])

  // Load saved searches on mount
  useEffect(() => {
    loadSavedSearches()
  }, [loadSavedSearches])

  return {
    // State
    filters,
    sort,
    searchResponse,
    savedSearches,
    isLoading,
    error,
    hasMore,
    currentPage,
    
    // Actions
    search,
    loadMore,
    updateFilters,
    updateSort,
    clearSearch,
    saveSearch,
    loadSavedSearch,
    deleteSavedSearch,
    logSearchAnalytics,
    
    // Computed
    hasResults: searchResponse && searchResponse.results.length > 0,
    totalResults: searchResponse?.total || 0,
    searchTime: searchResponse?.took
  }
}