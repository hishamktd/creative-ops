'use client'

import { useState, useEffect } from 'react'
import { Search, FileText, Image, Video, File, Clock, User, Tag, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { SearchResult, SearchResponse, SearchFilters, SearchSortOptions } from '@/types/search'
import type { EnhancedAsset } from '@/types'

interface EnhancedSearchResultsProps {
  searchResponse: SearchResponse | null
  isLoading: boolean
  onAssetSelect: (assetId: string) => void
  onLoadMore?: () => void
  hasMore?: boolean
  query?: string
  onAnalyticsClick?: (assetId: string) => void
}

export function EnhancedSearchResults({
  searchResponse,
  isLoading,
  onAssetSelect,
  onLoadMore,
  hasMore = false,
  query,
  onAnalyticsClick
}: EnhancedSearchResultsProps) {
  const [assets, setAssets] = useState<EnhancedAsset[]>([])

  // Fetch full asset details for search results
  useEffect(() => {
    if (searchResponse?.results) {
      fetchAssetDetails(searchResponse.results)
    }
  }, [searchResponse])

  const fetchAssetDetails = async (results: SearchResult[]) => {
    try {
      const assetIds = results.map(r => r.asset_id)
      const response = await fetch('/api/assets/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetIds })
      })
      
      if (response.ok) {
        const assetData = await response.json()
        setAssets(assetData)
      }
    } catch (error) {
      console.error('Error fetching asset details:', error)
    }
  }

  // Enhanced highlighting with multiple terms and better regex
  const highlightText = (text: string, searchQuery?: string) => {
    if (!searchQuery || !text) return text

    // Split search query into individual terms
    const terms = searchQuery.trim().split(/\s+/).filter(term => term.length > 1)
    if (terms.length === 0) return text

    // Create regex pattern for all terms
    const escapedTerms = terms.map(term => 
      term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    )
    const pattern = `(${escapedTerms.join('|')})`
    const regex = new RegExp(pattern, 'gi')
    
    const parts = text.split(regex)

    return parts.map((part, index) => {
      const isMatch = terms.some(term => 
        part.toLowerCase() === term.toLowerCase()
      )
      
      return isMatch ? (
        <mark key={index} className="bg-yellow-200 text-yellow-900 px-1 rounded font-medium">
          {part}
        </mark>
      ) : (
        part
      )
    })
  }

  // Get file type icon with enhanced styling
  const getFileTypeIcon = (fileType: string) => {
    const iconClass = "w-4 h-4"
    if (fileType.startsWith('image/')) return <Image className={`${iconClass} text-blue-500`} />
    if (fileType.startsWith('video/')) return <Video className={`${iconClass} text-purple-500`} />
    if (fileType === 'application/pdf') return <FileText className={`${iconClass} text-red-500`} />
    return <File className={`${iconClass} text-gray-500`} />
  }

  // Format file size
  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
  }

  // Format date with relative time
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 1) return 'Today'
    if (diffDays === 2) return 'Yesterday'
    if (diffDays <= 7) return `${diffDays} days ago`
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Get relevance score color
  const getRelevanceColor = (rank: number) => {
    if (rank >= 0.8) return 'text-green-600 bg-green-100'
    if (rank >= 0.6) return 'text-yellow-600 bg-yellow-100'
    return 'text-gray-600 bg-gray-100'
  }

  // Handle asset click with analytics
  const handleAssetClick = (assetId: string) => {
    onAssetSelect(assetId)
    if (onAnalyticsClick) {
      onAnalyticsClick(assetId)
    }
  }

  if (isLoading && !searchResponse) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Searching assets...</p>
        </div>
      </div>
    )
  }

  if (!searchResponse) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Search for assets</h3>
          <p className="text-gray-500">Enter a search term or use filters to find assets</p>
        </div>
      </div>
    )
  }

  if (searchResponse.results.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No assets found</h3>
          <p className="text-gray-500">
            Try adjusting your search terms or filters
          </p>
          {searchResponse.suggestions && searchResponse.suggestions.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">Did you mean:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {searchResponse.suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Enhanced Search Stats */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center space-x-4 text-gray-600">
          <span>
            Found <span className="font-medium text-gray-900">{searchResponse.total}</span> result{searchResponse.total !== 1 ? 's' : ''}
          </span>
          {searchResponse.took && (
            <span className="flex items-center">
              <Clock className="w-3 h-3 mr-1" />
              {searchResponse.took}ms
            </span>
          )}
        </div>
        
        {query && (
          <div className="text-xs text-gray-500">
            Searching for: <span className="font-medium">"{query}"</span>
          </div>
        )}
      </div>

      {/* Enhanced Results List */}
      <div className="space-y-3">
        {assets.map((asset, index) => {
          const result = searchResponse.results.find(r => r.asset_id === asset.id)
          
          return (
            <div
              key={asset.id}
              onClick={() => handleAssetClick(asset.id)}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
            >
              <div className="flex items-start space-x-4">
                {/* Enhanced Thumbnail */}
                <div className="flex-shrink-0 relative">
                  {asset.thumbnail_url ? (
                    <img
                      src={asset.thumbnail_url}
                      alt={asset.name}
                      className="w-16 h-16 object-cover rounded-lg group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-gray-200 transition-colors">
                      {getFileTypeIcon(asset.file_type)}
                    </div>
                  )}
                  
                  {/* Relevance Score Badge */}
                  {result?.rank && result.rank > 0.5 && (
                    <div className={`absolute -top-1 -right-1 px-1.5 py-0.5 text-xs font-medium rounded-full ${getRelevanceColor(result.rank)}`}>
                      {Math.round(result.rank * 100)}%
                    </div>
                  )}
                </div>

                {/* Enhanced Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                        {highlightText(asset.name, query)}
                      </h3>
                      {asset.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {highlightText(asset.description, query)}
                        </p>
                      )}
                    </div>
                    
                    {/* Enhanced Status Indicators */}
                    <div className="ml-4 flex items-center space-x-2">
                      {asset.status === 'processing' && (
                        <div className="flex items-center text-yellow-600">
                          <div className="animate-spin w-3 h-3 border border-yellow-600 border-t-transparent rounded-full mr-1"></div>
                          <span className="text-xs">Processing</span>
                        </div>
                      )}
                      {asset.status === 'error' && (
                        <div className="text-red-600 text-xs">Error</div>
                      )}
                      {asset.access_count > 10 && (
                        <div className="flex items-center text-green-600">
                          <TrendingUp className="w-3 h-3 mr-1" />
                          <span className="text-xs">Popular</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Enhanced Metadata */}
                  <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
                    <span className="flex items-center">
                      {getFileTypeIcon(asset.file_type)}
                      <span className="ml-1 capitalize">{asset.file_type.split('/')[0]}</span>
                    </span>
                    
                    <span>{formatFileSize(asset.file_size)}</span>
                    
                    <span className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatDate(asset.created_at)}
                    </span>
                    
                    {asset.access_count > 0 && (
                      <span className="flex items-center">
                        <User className="w-3 h-3 mr-1" />
                        {asset.access_count} view{asset.access_count !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Enhanced Tags */}
                  {asset.tags && asset.tags.length > 0 && (
                    <div className="flex items-center space-x-2 mt-2">
                      <Tag className="w-3 h-3 text-gray-400" />
                      <div className="flex flex-wrap gap-1">
                        {asset.tags.slice(0, 4).map((tag, tagIndex) => (
                          <span
                            key={tagIndex}
                            className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-full hover:bg-blue-100 transition-colors"
                          >
                            #{highlightText(tag, query)}
                          </span>
                        ))}
                        {asset.tags.length > 4 && (
                          <span className="text-xs text-gray-500">
                            +{asset.tags.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Enhanced Extracted Text Preview with Highlighting */}
                  {result?.highlight && (
                    <div className="mt-2 p-2 bg-blue-50 rounded text-xs text-gray-700 border-l-2 border-blue-200">
                      <span className="font-medium text-blue-800">Match: </span>
                      <span dangerouslySetInnerHTML={{ __html: result.highlight }} />
                    </div>
                  )}
                  
                  {asset.metadata.extracted_text && query && !result?.highlight && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                      <span className="font-medium">Content: </span>
                      {highlightText(
                        asset.metadata.extracted_text.substring(0, 150) + 
                        (asset.metadata.extracted_text.length > 150 ? '...' : ''),
                        query
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Enhanced Load More */}
      {hasMore && (
        <div className="text-center py-6">
          <Button
            onClick={onLoadMore}
            variant="secondary"
            disabled={isLoading}
            className="px-8"
          >
            {isLoading ? (
              <div className="flex items-center">
                <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full mr-2"></div>
                Loading...
              </div>
            ) : (
              'Load More Results'
            )}
          </Button>
        </div>
      )}

      {/* Enhanced Search Suggestions */}
      {searchResponse.suggestions && searchResponse.suggestions.length > 0 && (
        <div className="mt-8 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
          <h4 className="text-sm font-medium text-blue-900 mb-3 flex items-center">
            <Search className="w-4 h-4 mr-2" />
            Related searches:
          </h4>
          <div className="flex flex-wrap gap-2">
            {searchResponse.suggestions.map((suggestion, index) => (
              <button
                key={index}
                className="px-3 py-1.5 text-sm bg-white text-blue-700 rounded-full hover:bg-blue-100 transition-colors border border-blue-200 shadow-sm"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}