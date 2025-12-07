'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, Filter, Save, Clock, Tag } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { SearchFilters, AutocompleteResult, SearchSuggestion } from '@/types/search'

interface SearchBarProps {
  filters: SearchFilters
  onFiltersChange: (filters: SearchFilters) => void
  onSearch: () => void
  placeholder?: string
  showAdvancedFilters?: boolean
  onToggleAdvancedFilters?: () => void
}

export function SearchBar({
  filters,
  onFiltersChange,
  onSearch,
  placeholder = "Search assets...",
  showAdvancedFilters = false,
  onToggleAdvancedFilters
}: SearchBarProps) {
  const [query, setQuery] = useState(filters.query || '')
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [autocompleteResults, setAutocompleteResults] = useState<AutocompleteResult>({
    suggestions: [],
    recent_searches: [],
    popular_tags: []
  })
  const [isLoading, setIsLoading] = useState(false)
  
  const searchInputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()

  // Debounced autocomplete fetch
  const fetchAutocomplete = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setAutocompleteResults({ suggestions: [], recent_searches: [], popular_tags: [] })
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/search/autocomplete?q=${encodeURIComponent(searchQuery)}`)
      if (response.ok) {
        const results = await response.json()
        setAutocompleteResults(results)
      }
    } catch (error) {
      console.error('Autocomplete error:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Handle input change with debouncing and instant search
  const handleInputChange = (value: string) => {
    setQuery(value)
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    
    // Instant search for queries longer than 2 characters
    if (value.length >= 3) {
      debounceRef.current = setTimeout(() => {
        // Trigger instant search
        onFiltersChange({ ...filters, query: value.trim() || undefined })
        onSearch()
        fetchAutocomplete(value)
      }, 150) // Faster debounce for instant search
    } else if (value.length >= 2) {
      debounceRef.current = setTimeout(() => {
        fetchAutocomplete(value)
      }, 300)
    } else {
      setAutocompleteResults({ suggestions: [], recent_searches: [], popular_tags: [] })
    }
  }

  // Handle search submission
  const handleSearch = () => {
    onFiltersChange({ ...filters, query: query.trim() || undefined })
    onSearch()
    setShowAutocomplete(false)
  }

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.text)
    onFiltersChange({ ...filters, query: suggestion.text })
    onSearch()
    setShowAutocomplete(false)
  }

  // Handle tag selection
  const handleTagSelect = (tag: string) => {
    const currentTags = filters.tags || []
    const newTags = currentTags.includes(tag) 
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag]
    
    onFiltersChange({ ...filters, tags: newTags })
    onSearch()
    setShowAutocomplete(false)
  }

  // Handle key events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSearch()
    } else if (e.key === 'Escape') {
      setShowAutocomplete(false)
    }
  }

  // Clear search
  const clearSearch = () => {
    setQuery('')
    onFiltersChange({ ...filters, query: undefined })
    onSearch()
    searchInputRef.current?.focus()
  }

  // Click outside to close autocomplete
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        autocompleteRef.current &&
        !autocompleteRef.current.contains(event.target as Node) &&
        !searchInputRef.current?.contains(event.target as Node)
      ) {
        setShowAutocomplete(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Update query when filters change externally
  useEffect(() => {
    setQuery(filters.query || '')
  }, [filters.query])

  const hasActiveFilters = Boolean(
    filters.projectIds?.length ||
    filters.fileTypes?.length ||
    filters.tags?.length ||
    filters.status?.length ||
    filters.dateRange ||
    filters.sizeRange
  )

  return (
    <div className="relative">
      <div className="relative flex items-center">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setShowAutocomplete(true)}
            placeholder={placeholder}
            className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {query && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Toggle Button */}
        <Button
          variant={hasActiveFilters ? "primary" : "secondary"}
          size="sm"
          onClick={onToggleAdvancedFilters}
          className="ml-2"
        >
          <Filter className="w-4 h-4 mr-1" />
          Filters
          {hasActiveFilters && (
            <span className="ml-1 bg-white text-blue-600 rounded-full px-1.5 py-0.5 text-xs font-medium">
              {[
                filters.projectIds?.length,
                filters.fileTypes?.length,
                filters.tags?.length,
                filters.status?.length,
                filters.dateRange ? 1 : 0,
                filters.sizeRange ? 1 : 0
              ].filter(Boolean).reduce((a, b) => (a || 0) + (b || 0), 0)}
            </span>
          )}
        </Button>

        {/* Search Button */}
        <Button
          onClick={handleSearch}
          className="ml-2"
        >
          Search
        </Button>
      </div>

      {/* Autocomplete Dropdown */}
      {showAutocomplete && (
        <div
          ref={autocompleteRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto"
        >
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
              <span className="ml-2">Loading suggestions...</span>
            </div>
          ) : (
            <>
              {/* Search Suggestions */}
              {autocompleteResults.suggestions.length > 0 && (
                <div className="p-2">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide px-2 py-1">
                    Suggestions
                  </div>
                  {autocompleteResults.suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionSelect(suggestion)}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded flex items-center"
                    >
                      <Search className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm">{suggestion.text}</span>
                      {suggestion.type === 'tag' && (
                        <Tag className="w-3 h-3 text-gray-400 ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {/* Recent Searches */}
              {autocompleteResults.recent_searches.length > 0 && (
                <div className="p-2 border-t border-gray-100">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide px-2 py-1">
                    Recent Searches
                  </div>
                  {autocompleteResults.recent_searches.map((search, index) => (
                    <button
                      key={index}
                      onClick={() => handleSuggestionSelect({ text: search, type: 'query' })}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded flex items-center"
                    >
                      <Clock className="w-4 h-4 text-gray-400 mr-2" />
                      <span className="text-sm">{search}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Popular Tags */}
              {autocompleteResults.popular_tags.length > 0 && (
                <div className="p-2 border-t border-gray-100">
                  <div className="text-xs font-medium text-gray-500 uppercase tracking-wide px-2 py-1">
                    Popular Tags
                  </div>
                  <div className="flex flex-wrap gap-1 px-2">
                    {autocompleteResults.popular_tags.map((tag, index) => (
                      <button
                        key={index}
                        onClick={() => handleTagSelect(tag)}
                        className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                          filters.tags?.includes(tag)
                            ? 'bg-blue-100 border-blue-300 text-blue-700'
                            : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* No Results */}
              {autocompleteResults.suggestions.length === 0 &&
               autocompleteResults.recent_searches.length === 0 &&
               autocompleteResults.popular_tags.length === 0 &&
               !isLoading && (
                <div className="p-4 text-center text-gray-500 text-sm">
                  No suggestions found
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}