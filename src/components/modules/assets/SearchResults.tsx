'use client'

import { useState, useEffect } from 'react'
import { Search, FileText, Image, Video, File, Clock, User, Tag } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { SearchResult, SearchResponse, SearchFilters, SearchSortOptions } from '@/types/search'
import type { EnhancedAsset } from '@/types'

interface SearchResultsProps {
  searchResponse: SearchResponse | null
  isLoading: boolean
  onAssetSelect: (assetId: string) => void
  onLoadMore?: () => void
  hasMore?: boolean
  query?: string
}

export function SearchResults({
  searchResponse,
  isLoading,
  onAssetSelect,
  onLoadMore,
  hasMore = false,
  query
}: SearchResultsProps) {
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

  // Get file type icon
  const getFileTypeIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image className="w-4 h-4" />
    if (fileType.startsWith('video/')) return <Video className="w-4 h-4" />
    if (fileType === 'application/pdf') return <FileText className="w-4 h-4" />
    return <File className="w-4 h-4" />
  }

  // Highlight search terms in text
  const highlightText = (text: string, searchQuery?: string) => {
    if (!searchQuery || !text) return text

    const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-yellow-200 px-1 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  // Format file size
  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`
  }

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
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
                    className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200"
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
      {/* Search Stats */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          Found {searchResponse.total} result{searchResponse.total !== 1 ? 's' : ''}
          {searchResponse.took && ` in ${searchResponse.took}ms`}
        </span>
      </div>

      {/* Results List */}
      <div className="space-y-3">
        {assets.map((asset, index) => {
          const result = searchResponse.results.find(r => r.asset_id === asset.id)
          
          return (
            <div
              key={asset.id}
              onClick={() => onAssetSelect(asset.id)}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start space-x-4">
                {/* Thumbnail */}
                <div className="flex-shrink-0">
                  {asset.thumbnail_url ? (
                    <img
                      src={asset.thumbnail_url}
                      alt={asset.name}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center">
                      {getFileTypeIcon(asset.file_type)}
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900 truncate">
                        {highlightText(asset.name, query)}
                      </h3>
                      {asset.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                          {highlightText(asset.description, query)}
                        </p>
                      )}
                    </div>
                    
                    {/* Relevance Score */}
                    {result?.rank && (
                      <div className="ml-4 text-xs text-gray-500">
                        Score: {(result.rank * 100).toFixed(1)}%
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center space-x-4 mt-3 text-sm text-gray-500">
                    <span className="flex items-center">
                      {getFileTypeIcon(asset.file_type)}
                      <span className="ml-1">{asset.file_type}</span>
                    </span>
                    
                    <span>{formatFileSize(asset.file_size)}</span>
                    
                    <span className="flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatDate(asset.created_at)}
                    </span>
                    
                    {asset.access_count > 0 && (
                      <span>{asset.access_count} views</span>
                    )}
                  </div>

                  {/* Tags */}
                  {asset.tags && asset.tags.length > 0 && (
                    <div className="flex items-center space-x-2 mt-2">
                      <Tag className="w-3 h-3 text-gray-400" />
                      <div className="flex flex-wrap gap-1">
                        {asset.tags.slice(0, 3).map((tag, tagIndex) => (
                          <span
                            key={tagIndex}
                            className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full"
                          >
                            #{tag}
                          </span>
                        ))}
                        {asset.tags.length > 3 && (
                          <span className="text-xs text-gray-500">
                            +{asset.tags.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Extracted Text Preview */}
                  {asset.metadata.extracted_text && query && (
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

      {/* Load More */}
      {hasMore && (
        <div className="text-center py-4">
          <Button
            onClick={onLoadMore}
            variant="secondary"
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Load More Results'}
          </Button>
        </div>
      )}

      {/* Search Suggestions */}
      {searchResponse.suggestions && searchResponse.suggestions.length > 0 && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            Related searches:
          </h4>
          <div className="flex flex-wrap gap-2">
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
  )
}