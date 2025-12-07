'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  Search, 
  X, 
  Filter, 
  Calendar, 
  FileType, 
  Tag, 
  HardDrive,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronUp
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { AssetFilters } from './AssetBrowser'
import { useMobileDetection } from '@/lib/hooks/useMobileDetection'

export interface MobileSearchInterfaceProps {
  filters: AssetFilters
  onFiltersChange: (filters: AssetFilters) => void
  onClose: () => void
  className?: string
}

interface SearchSuggestion {
  text: string
  type: 'query' | 'tag' | 'file_type'
  count?: number
}

export function MobileSearchInterface({
  filters,
  onFiltersChange,
  onClose,
  className = ''
}: MobileSearchInterfaceProps) {
  const { screenSize } = useMobileDetection()
  
  const [query, setQuery] = useState(filters.search || '')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [popularTags, setPopularTags] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  
  const searchInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()

  // File type groups
  const FILE_TYPE_GROUPS = {
    images: {
      label: 'Images',
      icon: '🖼️',
      types: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
    },
    videos: {
      label: 'Videos', 
      icon: '🎥',
      types: ['video/mp4', 'video/webm', 'video/mov', 'video/avi']
    },
    documents: {
      label: 'Documents',
      icon: '📄',
      types: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    },
    audio: {
      label: 'Audio',
      icon: '🎵',
      types: ['audio/mpeg', 'audio/wav', 'audio/ogg']
    }
  }

  // Load initial data
  useEffect(() => {
    loadRecentSearches()
    loadPopularTags()
    searchInputRef.current?.focus()
  }, [])

  const loadRecentSearches = () => {
    const stored = localStorage.getItem('recent_searches')
    if (stored) {
      setRecentSearches(JSON.parse(stored).slice(0, 5))
    }
  }

  const loadPopularTags = async () => {
    // In a real app, this would fetch from API
    setPopularTags(['design', 'logo', 'photo', 'video', 'draft', 'final'])
  }

  // Debounced search suggestions
  const fetchSuggestions = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setSuggestions([])
      return
    }

    setIsLoading(true)
    try {
      // Simulate API call - in real app, this would be an actual API call
      await new Promise(resolve => setTimeout(resolve, 200))
      
      const mockSuggestions: SearchSuggestion[] = [
        { text: `${searchQuery} logo`, type: 'query', count: 12 },
        { text: `${searchQuery} design`, type: 'query', count: 8 },
        { text: searchQuery, type: 'tag', count: 15 }
      ]
      
      setSuggestions(mockSuggestions)
    } catch (error) {
      console.error('Error fetching suggestions:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Handle input change
  const handleInputChange = (value: string) => {
    setQuery(value)
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    
    debounceRef.current = setTimeout(() => {
      fetchSuggestions(value)
    }, 300)
  }

  // Handle search
  const handleSearch = (searchQuery?: string) => {
    const finalQuery = searchQuery || query
    
    if (finalQuery.trim()) {
      // Save to recent searches
      const recent = [finalQuery, ...recentSearches.filter(s => s !== finalQuery)].slice(0, 5)
      setRecentSearches(recent)
      localStorage.setItem('recent_searches', JSON.stringify(recent))
    }
    
    onFiltersChange({
      ...filters,
      search: finalQuery.trim() || undefined
    })
    
    onClose()
  }

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: SearchSuggestion) => {
    if (suggestion.type === 'tag') {
      const currentTags = filters.tags || []
      const newTags = currentTags.includes(suggestion.text)
        ? currentTags.filter(t => t !== suggestion.text)
        : [...currentTags, suggestion.text]
      
      onFiltersChange({
        ...filters,
        tags: newTags.length > 0 ? newTags : undefined
      })
    } else {
      handleSearch(suggestion.text)
    }
  }

  // Toggle file type group
  const toggleFileTypeGroup = (groupTypes: string[]) => {
    const currentTypes = filters.fileTypes || []
    const hasAllTypes = groupTypes.every(type => currentTypes.includes(type))
    
    if (hasAllTypes) {
      const newTypes = currentTypes.filter(type => !groupTypes.includes(type))
      onFiltersChange({
        ...filters,
        fileTypes: newTypes.length > 0 ? newTypes : undefined
      })
    } else {
      const newTypes = [...new Set([...currentTypes, ...groupTypes])]
      onFiltersChange({
        ...filters,
        fileTypes: newTypes
      })
    }
  }

  // Toggle tag
  const toggleTag = (tag: string) => {
    const currentTags = filters.tags || []
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag]
    
    onFiltersChange({
      ...filters,
      tags: newTags.length > 0 ? newTags : undefined
    })
  }

  // Clear all filters
  const clearAllFilters = () => {
    setQuery('')
    onFiltersChange({})
  }

  const hasActiveFilters = Boolean(
    filters.fileTypes?.length ||
    filters.tags?.length ||
    filters.dateRange ||
    filters.minSize ||
    filters.maxSize
  )

  return (
    <div className={`bg-white ${className}`}>
      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            ref={searchInputRef}
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleSearch()
              }
            }}
            placeholder="Search assets..."
            className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent text-base"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('')
                setSuggestions([])
              }}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Search Suggestions */}
        {(suggestions.length > 0 || recentSearches.length > 0 || popularTags.length > 0) && query.length >= 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
            {isLoading ? (
              <div className="p-4 text-center text-gray-500">
                <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2"></div>
                <span className="text-sm">Loading suggestions...</span>
              </div>
            ) : (
              <>
                {/* Search Suggestions */}
                {suggestions.length > 0 && (
                  <div className="p-2">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide px-2 py-1">
                      Suggestions
                    </div>
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionSelect(suggestion)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded flex items-center justify-between"
                      >
                        <div className="flex items-center">
                          <Search className="w-4 h-4 text-gray-400 mr-2" />
                          <span className="text-sm">{suggestion.text}</span>
                          {suggestion.type === 'tag' && (
                            <Tag className="w-3 h-3 text-gray-400 ml-2" />
                          )}
                        </div>
                        {suggestion.count && (
                          <span className="text-xs text-gray-400">{suggestion.count}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Recent Searches */}
                {recentSearches.length > 0 && query.length === 0 && (
                  <div className="p-2 border-t border-gray-100">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide px-2 py-1">
                      Recent Searches
                    </div>
                    {recentSearches.map((search, index) => (
                      <button
                        key={index}
                        onClick={() => handleSearch(search)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 rounded flex items-center"
                      >
                        <Clock className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm">{search}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Popular Tags */}
                {popularTags.length > 0 && query.length === 0 && (
                  <div className="p-2 border-t border-gray-100">
                    <div className="text-xs font-medium text-gray-500 uppercase tracking-wide px-2 py-1">
                      Popular Tags
                    </div>
                    <div className="flex flex-wrap gap-1 px-2">
                      {popularTags.map((tag, index) => (
                        <button
                          key={index}
                          onClick={() => toggleTag(tag)}
                          className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                            filters.tags?.includes(tag)
                              ? 'bg-primary text-white border-primary'
                              : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2 mt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className="flex items-center gap-2"
        >
          <Filter size={16} />
          Filters
          {hasActiveFilters && (
            <Badge variant="info" className="text-xs">
              {[
                filters.fileTypes?.length,
                filters.tags?.length,
                filters.dateRange ? 1 : 0,
                (filters.minSize || filters.maxSize) ? 1 : 0
              ].filter(Boolean).reduce((a, b) => (a || 0) + (b || 0), 0)}
            </Badge>
          )}
          {showAdvancedFilters ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </Button>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAllFilters}
            className="text-red-600 hover:text-red-700"
          >
            Clear All
          </Button>
        )}

        <Button
          onClick={() => handleSearch()}
          size="sm"
          className="ml-auto"
        >
          Search
        </Button>
      </div>

      {/* Advanced Filters */}
      {showAdvancedFilters && (
        <div className="mt-4 space-y-4 p-4 bg-gray-50 rounded-lg">
          {/* File Types */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <FileType size={16} />
              File Types
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(FILE_TYPE_GROUPS).map(([key, group]) => {
                const hasAllTypes = group.types.every(type => filters.fileTypes?.includes(type))
                const hasSomeTypes = group.types.some(type => filters.fileTypes?.includes(type))
                
                return (
                  <button
                    key={key}
                    onClick={() => toggleFileTypeGroup(group.types)}
                    className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                      hasAllTypes
                        ? 'bg-primary text-white border-primary'
                        : hasSomeTypes
                        ? 'bg-primary/10 border-primary text-primary'
                        : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-lg">{group.icon}</span>
                    <span className="text-sm font-medium">{group.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Date Range */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Calendar size={16} />
              Date Range
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-600 mb-1">From</label>
                <input
                  type="date"
                  value={filters.dateRange?.start || ''}
                  onChange={(e) => onFiltersChange({
                    ...filters,
                    dateRange: {
                      ...filters.dateRange,
                      start: e.target.value
                    }
                  })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">To</label>
                <input
                  type="date"
                  value={filters.dateRange?.end || ''}
                  onChange={(e) => onFiltersChange({
                    ...filters,
                    dateRange: {
                      ...filters.dateRange,
                      end: e.target.value
                    }
                  })}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* File Size */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <HardDrive size={16} />
              File Size (MB)
            </h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Min Size</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={filters.minSize ? filters.minSize / (1024 * 1024) : ''}
                  onChange={(e) => onFiltersChange({
                    ...filters,
                    minSize: e.target.value ? parseFloat(e.target.value) * 1024 * 1024 : undefined
                  })}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">Max Size</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={filters.maxSize ? filters.maxSize / (1024 * 1024) : ''}
                  onChange={(e) => onFiltersChange({
                    ...filters,
                    maxSize: e.target.value ? parseFloat(e.target.value) * 1024 * 1024 : undefined
                  })}
                  placeholder="100"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Selected Tags */}
          {filters.tags && filters.tags.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Tag size={16} />
                Selected Tags
              </h4>
              <div className="flex flex-wrap gap-2">
                {filters.tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className="flex items-center gap-1 px-2 py-1 bg-primary text-white rounded-full text-xs"
                  >
                    #{tag}
                    <X size={12} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}