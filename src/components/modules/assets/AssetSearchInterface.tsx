'use client'

import { useState, useEffect, useCallback } from 'react'
import { SearchBar } from './SearchBar'
import { AdvancedFiltersPanel } from './AdvancedFiltersPanel'
import { EnhancedSearchResults } from './EnhancedSearchResults'
import type { 
  SearchFilters, 
  SearchSortOptions, 
  SearchResponse, 
  SearchFacets,
  SavedSearch 
} from '@/types/search'

interface AssetSearchInterfaceProps {
  projectId?: string
  onAssetSelect: (assetId: string) => void
  className?: string
}

export function AssetSearchInterface({
  projectId,
  onAssetSelect,
  className = ''
}: AssetSearchInterfaceProps) {
  const [filters, setFilters] = useState<SearchFilters>({
    projectIds: projectId ? [projectId] : undefined
  })
  const [sort, setSort] = useState<SearchSortOptions>({
    field: 'relevance',
    direction: 'desc'
  })
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null)
  const [facets, setFacets] = useState<SearchFacets | undefined>()
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [currentPage, setCurrentPage] = useState(0)
  const [hasMore, setHasMore] = useState(false)

  const RESULTS_PER_PAGE = 20

  // Load saved searches on mount
  useEffect(() => {
    loadSavedSearches()
  }, [])

  // Perform search
  const performSearch = useCallback(async (
    searchFilters: SearchFilters = filters,
    searchSort: SearchSortOptions = sort,
    page: number = 0,
    append: boolean = false
  ) => {
    setIsLoading(true)
    
    try {
      const offset = page * RESULTS_PER_PAGE
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filters: searchFilters,
          sort: searchSort,
          limit: RESULTS_PER_PAGE,
          offset
        })
      })

      if (response.ok) {
        const data: SearchResponse = await response.json()
        
        if (append && searchResponse) {
          setSearchResponse({
            ...data,
            results: [...searchResponse.results, ...data.results]
          })
        } else {
          setSearchResponse(data)
          setFacets(data.facets)
        }
        
        setHasMore(data.results.length === RESULTS_PER_PAGE)
        setCurrentPage(page)
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setIsLoading(false)
    }
  }, [filters, sort, searchResponse])

  // Handle search trigger
  const handleSearch = useCallback(() => {
    setCurrentPage(0)
    performSearch(filters, sort, 0, false)
  }, [filters, sort, performSearch])

  // Handle load more
  const handleLoadMore = useCallback(() => {
    const nextPage = currentPage + 1
    performSearch(filters, sort, nextPage, true)
  }, [currentPage, filters, sort, performSearch])

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: SearchFilters) => {
    setFilters(newFilters)
  }, [])

  // Handle sort changes
  const handleSortChange = useCallback((newSort: SearchSortOptions) => {
    setSort(newSort)
    setCurrentPage(0)
    performSearch(filters, newSort, 0, false)
  }, [filters, performSearch])

  // Load saved searches
  const loadSavedSearches = async () => {
    try {
      const response = await fetch('/api/search/saved')
      if (response.ok) {
        const data = await response.json()
        setSavedSearches(data)
      }
    } catch (error) {
      console.error('Error loading saved searches:', error)
    }
  }

  // Save search with smart folder support
  const handleSaveSearch = async (name: string, description?: string, isSmartFolder: boolean = false) => {
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
      }
    } catch (error) {
      console.error('Error saving search:', error)
    }
  }

  // Load saved search
  const handleLoadSavedSearch = (search: SavedSearch) => {
    setFilters(search.filters)
    setSort(search.sort)
    performSearch(search.filters, search.sort, 0, false)
  }

  // Delete saved search
  const handleDeleteSavedSearch = async (searchId: string) => {
    try {
      const response = await fetch(`/api/search/saved?id=${searchId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        await loadSavedSearches()
      }
    } catch (error) {
      console.error('Error deleting saved search:', error)
    }
  }

  return (
    <div className={`flex h-full ${className}`}>
      {/* Main Search Area */}
      <div className="flex-1 flex flex-col">
        {/* Search Header */}
        <div className="p-4 border-b border-gray-200 bg-white">
          <SearchBar
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onSearch={handleSearch}
            showAdvancedFilters={showAdvancedFilters}
            onToggleAdvancedFilters={() => setShowAdvancedFilters(!showAdvancedFilters)}
          />
          
          {/* Sort Options */}
          {searchResponse && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                {searchResponse.total} result{searchResponse.total !== 1 ? 's' : ''}
                {searchResponse.took && ` (${searchResponse.took}ms)`}
              </div>
              
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-600">Sort by:</label>
                <select
                  value={`${sort.field}-${sort.direction}`}
                  onChange={(e) => {
                    const [field, direction] = e.target.value.split('-')
                    handleSortChange({
                      field: field as any,
                      direction: direction as 'asc' | 'desc'
                    })
                  }}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value="relevance-desc">Relevance</option>
                  <option value="created_at-desc">Newest First</option>
                  <option value="created_at-asc">Oldest First</option>
                  <option value="name-asc">Name A-Z</option>
                  <option value="name-desc">Name Z-A</option>
                  <option value="file_size-desc">Largest First</option>
                  <option value="file_size-asc">Smallest First</option>
                  <option value="access_count-desc">Most Popular</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Search Results */}
        <div className="flex-1 overflow-y-auto p-4">
          <EnhancedSearchResults
            searchResponse={searchResponse}
            isLoading={isLoading}
            onAssetSelect={onAssetSelect}
            onLoadMore={handleLoadMore}
            hasMore={hasMore}
            query={filters.query}
            onAnalyticsClick={async (assetId: string) => {
              // Log click analytics
              if (filters.query) {
                try {
                  await fetch('/api/search/analytics', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      query: filters.query,
                      results_count: searchResponse?.total || 0,
                      clicked_result: assetId,
                      project_id: projectId
                    })
                  })
                } catch (error) {
                  console.error('Error logging click analytics:', error)
                }
              }
            }}
          />
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showAdvancedFilters && (
        <AdvancedFiltersPanel
          filters={filters}
          onFiltersChange={handleFiltersChange}
          facets={facets}
          onClose={() => setShowAdvancedFilters(false)}
          onSaveSearch={handleSaveSearch}
          savedSearches={savedSearches}
          onLoadSavedSearch={handleLoadSavedSearch}
          onDeleteSavedSearch={handleDeleteSavedSearch}
        />
      )}
    </div>
  )
}