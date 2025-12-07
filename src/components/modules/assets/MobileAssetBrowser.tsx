'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  Search, 
  Filter, 
  Grid3X3, 
  List, 
  MoreVertical, 
  Download, 
  Share2, 
  Heart, 
  Eye,
  ChevronLeft,
  ChevronRight,
  X,
  Menu,
  SortAsc,
  SortDesc,
  Wifi,
  WifiOff,
  Camera,
  Upload
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useMobileDetection } from '@/lib/hooks/useMobileDetection'
import { useSwipeGestures } from '@/lib/hooks/useSwipeGestures'
import { useOfflineAssets } from '@/lib/hooks/useOfflineAssets'
import { EnhancedAsset } from '@/types'
import { AssetFilters, ViewMode, SortField, SortDirection } from './AssetBrowser'
import { MobileAssetPreview } from './MobileAssetPreview'
import { MobileUploadInterface } from './MobileUploadInterface'
import { MobileSearchInterface } from './MobileSearchInterface'

export interface MobileAssetBrowserProps {
  projectId?: string
  folderId?: string
  assets: EnhancedAsset[]
  loading: boolean
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  filters: AssetFilters
  onFiltersChange: (filters: AssetFilters) => void
  sortBy: SortField
  sortDirection: SortDirection
  onSortChange: (field: SortField, direction: SortDirection) => void
  onAssetClick: (asset: EnhancedAsset) => void
  onLoadMore: () => void
  hasMore: boolean
  className?: string
}

export function MobileAssetBrowser({
  projectId,
  folderId,
  assets,
  loading,
  viewMode,
  onViewModeChange,
  filters,
  onFiltersChange,
  sortBy,
  sortDirection,
  onSortChange,
  onAssetClick,
  onLoadMore,
  hasMore,
  className = ''
}: MobileAssetBrowserProps) {
  const { isMobile, isTablet, screenSize, orientation } = useMobileDetection()
  const { isOnline, offlineAssets, isCached, getCachedThumbnailUrl } = useOfflineAssets()
  
  const [selectedAsset, setSelectedAsset] = useState<EnhancedAsset | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [showSort, setShowSort] = useState(false)
  const [currentAssetIndex, setCurrentAssetIndex] = useState(0)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Swipe gestures for asset navigation
  const { attachListeners } = useSwipeGestures({
    onSwipeLeft: () => navigateAsset('next'),
    onSwipeRight: () => navigateAsset('prev'),
    onSwipeUp: () => setShowFilters(true),
    onSwipeDown: () => setShowFilters(false),
    threshold: 50
  })

  // Attach swipe listeners to container
  useEffect(() => {
    if (containerRef.current && isMobile) {
      return attachListeners(containerRef.current)
    }
  }, [attachListeners, isMobile])

  // Navigate between assets
  const navigateAsset = useCallback((direction: 'prev' | 'next') => {
    if (!selectedAsset) return

    const currentIndex = assets.findIndex(asset => asset.id === selectedAsset.id)
    let newIndex = currentIndex

    if (direction === 'next' && currentIndex < assets.length - 1) {
      newIndex = currentIndex + 1
    } else if (direction === 'prev' && currentIndex > 0) {
      newIndex = currentIndex - 1
    }

    if (newIndex !== currentIndex) {
      setSelectedAsset(assets[newIndex])
      setCurrentAssetIndex(newIndex)
    }
  }, [selectedAsset, assets])

  // Handle asset selection
  const handleAssetClick = useCallback((asset: EnhancedAsset) => {
    const index = assets.findIndex(a => a.id === asset.id)
    setCurrentAssetIndex(index)
    setSelectedAsset(asset)
    onAssetClick(asset)
  }, [assets, onAssetClick])

  // Close preview
  const closePreview = useCallback(() => {
    setSelectedAsset(null)
  }, [])

  // Infinite scroll for mobile
  const handleScroll = useCallback(() => {
    if (!scrollRef.current || loading || !hasMore) return

    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      onLoadMore()
    }
  }, [loading, hasMore, onLoadMore])

  useEffect(() => {
    const scrollElement = scrollRef.current
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll)
      return () => scrollElement.removeEventListener('scroll', handleScroll)
    }
  }, [handleScroll])

  // Get grid columns based on screen size
  const getGridColumns = () => {
    if (screenSize === 'sm') return 2
    if (screenSize === 'md') return 3
    return 4
  }

  // Format file size for mobile
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 10) / 10 + sizes[i]
  }

  // Get file type icon
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return '🖼️'
    if (fileType.startsWith('video/')) return '🎥'
    if (fileType.startsWith('audio/')) return '🎵'
    if (fileType.includes('pdf')) return '📄'
    return '📁'
  }

  return (
    <div ref={containerRef} className={`h-full flex flex-col ${className}`}>
      {/* Mobile Header */}
      <div className="flex-shrink-0 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left side */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSearch(!showSearch)}
              className="p-2"
            >
              <Search size={20} />
            </Button>
            
            {/* Online/Offline indicator */}
            <div className="flex items-center gap-1">
              {isOnline ? (
                <Wifi size={16} className="text-green-500" />
              ) : (
                <WifiOff size={16} className="text-red-500" />
              )}
              {!isOnline && (
                <Badge variant="warning" className="text-xs">
                  Offline ({offlineAssets.length} cached)
                </Badge>
              )}
            </div>
          </div>

          {/* Center - Title */}
          <h1 className="font-semibold text-gray-900 truncate">
            Assets {assets.length > 0 && `(${assets.length})`}
          </h1>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowUpload(true)}
              className="p-2"
            >
              <Upload size={20} />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSort(!showSort)}
              className="p-2"
            >
              <Menu size={20} />
            </Button>
          </div>
        </div>

        {/* Search Interface */}
        {showSearch && (
          <div className="mt-3">
            <MobileSearchInterface
              filters={filters}
              onFiltersChange={onFiltersChange}
              onClose={() => setShowSearch(false)}
            />
          </div>
        )}

        {/* Sort & View Controls */}
        {showSort && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">View & Sort</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSort(false)}
              >
                <X size={16} />
              </Button>
            </div>
            
            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-gray-600">View:</span>
              <div className="flex border border-gray-300 rounded-lg overflow-hidden">
                <Button
                  variant={viewMode === 'grid' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => onViewModeChange('grid')}
                  className="rounded-none border-0"
                >
                  <Grid3X3 size={16} />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => onViewModeChange('list')}
                  className="rounded-none border-0 border-l border-gray-300"
                >
                  <List size={16} />
                </Button>
              </div>
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => onSortChange(e.target.value as SortField, sortDirection)}
                className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded"
              >
                <option value="created_at">Date Created</option>
                <option value="updated_at">Date Modified</option>
                <option value="name">Name</option>
                <option value="file_size">Size</option>
                <option value="file_type">Type</option>
              </select>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSortChange(sortBy, sortDirection === 'asc' ? 'desc' : 'asc')}
                className="p-1"
              >
                {sortDirection === 'asc' ? <SortAsc size={16} /> : <SortDesc size={16} />}
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Assets Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {loading && assets.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
          </div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 px-4 text-center">
            <div className="text-4xl mb-4">📁</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No assets found</h3>
            <p className="text-gray-600 mb-4">
              {Object.keys(filters).length > 1 
                ? 'Try adjusting your search or filters'
                : 'Upload some files to get started'
              }
            </p>
            <Button onClick={() => setShowUpload(true)}>
              <Upload size={16} className="mr-2" />
              Upload Files
            </Button>
          </div>
        ) : (
          <div className="p-4">
            {viewMode === 'grid' ? (
              <div 
                className="grid gap-3"
                style={{ 
                  gridTemplateColumns: `repeat(${getGridColumns()}, 1fr)` 
                }}
              >
                {assets.map((asset) => (
                  <MobileAssetCard
                    key={asset.id}
                    asset={asset}
                    onClick={() => handleAssetClick(asset)}
                    isCached={isCached(asset.id)}
                    cachedThumbnailUrl={getCachedThumbnailUrl(asset.id)}
                    isOffline={!isOnline}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {assets.map((asset) => (
                  <MobileAssetListItem
                    key={asset.id}
                    asset={asset}
                    onClick={() => handleAssetClick(asset)}
                    isCached={isCached(asset.id)}
                    cachedThumbnailUrl={getCachedThumbnailUrl(asset.id)}
                    isOffline={!isOnline}
                    formatFileSize={formatFileSize}
                    getFileIcon={getFileIcon}
                  />
                ))}
              </div>
            )}

            {/* Load More */}
            {hasMore && (
              <div className="text-center py-6">
                {loading ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent mx-auto"></div>
                ) : (
                  <Button onClick={onLoadMore} variant="outline">
                    Load More
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Asset Preview */}
      {selectedAsset && (
        <MobileAssetPreview
          asset={selectedAsset}
          isOpen={!!selectedAsset}
          onClose={closePreview}
          onNavigate={navigateAsset}
          currentIndex={currentAssetIndex}
          totalAssets={assets.length}
          isOffline={!isOnline}
        />
      )}

      {/* Mobile Upload Interface */}
      {showUpload && (
        <MobileUploadInterface
          projectId={projectId}
          folderId={folderId}
          isOpen={showUpload}
          onClose={() => setShowUpload(false)}
          onUploadComplete={() => {
            setShowUpload(false)
            // Refresh assets list
          }}
        />
      )}
    </div>
  )
}

// Mobile Asset Card Component
interface MobileAssetCardProps {
  asset: EnhancedAsset
  onClick: () => void
  isCached: boolean
  cachedThumbnailUrl: string | null
  isOffline: boolean
}

function MobileAssetCard({ 
  asset, 
  onClick, 
  isCached, 
  cachedThumbnailUrl, 
  isOffline 
}: MobileAssetCardProps) {
  const thumbnailUrl = isOffline && cachedThumbnailUrl 
    ? cachedThumbnailUrl 
    : asset.thumbnail_url || asset.file_url

  const isImage = asset.file_type.startsWith('image/')

  return (
    <button
      onClick={onClick}
      className="relative bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm active:scale-95 transition-transform"
    >
      {/* Thumbnail */}
      <div className="aspect-square bg-gray-100 relative overflow-hidden">
        {isImage && thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={asset.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-2xl">
            {asset.file_type.startsWith('video/') ? '🎥' :
             asset.file_type.startsWith('audio/') ? '🎵' :
             asset.file_type.includes('pdf') ? '📄' : '📁'}
          </div>
        )}
        
        {/* Offline indicator */}
        {isCached && (
          <div className="absolute top-2 right-2">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          </div>
        )}

        {/* File type badge */}
        <div className="absolute bottom-2 left-2">
          <Badge variant="info" className="text-xs px-1 py-0.5">
            {asset.file_type.split('/')[1]?.toUpperCase() || 'FILE'}
          </Badge>
        </div>
      </div>

      {/* File name */}
      <div className="p-2">
        <p className="text-xs font-medium text-gray-900 truncate">
          {asset.name}
        </p>
      </div>
    </button>
  )
}

// Mobile Asset List Item Component
interface MobileAssetListItemProps {
  asset: EnhancedAsset
  onClick: () => void
  isCached: boolean
  cachedThumbnailUrl: string | null
  isOffline: boolean
  formatFileSize: (bytes: number) => string
  getFileIcon: (fileType: string) => string
}

function MobileAssetListItem({ 
  asset, 
  onClick, 
  isCached, 
  cachedThumbnailUrl, 
  isOffline,
  formatFileSize,
  getFileIcon
}: MobileAssetListItemProps) {
  const thumbnailUrl = isOffline && cachedThumbnailUrl 
    ? cachedThumbnailUrl 
    : asset.thumbnail_url || asset.file_url

  const isImage = asset.file_type.startsWith('image/')

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg active:bg-gray-50 transition-colors"
    >
      {/* Thumbnail */}
      <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0 relative">
        {isImage && thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={asset.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-lg">
            {getFileIcon(asset.file_type)}
          </div>
        )}
        
        {isCached && (
          <div className="absolute top-1 right-1">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
          </div>
        )}
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0 text-left">
        <p className="font-medium text-gray-900 truncate text-sm">
          {asset.name}
        </p>
        <div className="flex items-center gap-2 text-xs text-gray-600">
          <span>{formatFileSize(asset.file_size)}</span>
          <span>•</span>
          <span>{new Date(asset.created_at).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0">
        <MoreVertical size={16} className="text-gray-400" />
      </div>
    </button>
  )
}