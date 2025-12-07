'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  Grid3X3,
  List,
  Timeline,
  Filter,
  Search,
  SortAsc,
  SortDesc,
  Eye,
  Download,
  MoreVertical,
  Image,
  Film,
  FileText,
  File,
  Calendar,
  Tag,
  FolderOpen,
  Check,
  X,
  ChevronDown,
  Bookmark,
  BookmarkCheck
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { EnhancedAsset } from '@/lib/services/assetManager'
import { Folder } from '@/types'
import { AssetGridView } from './AssetGridView'
import { AssetListView } from './AssetListView'
import { AssetTimelineView } from './AssetTimelineView'
import { AssetFiltersPanel } from './AssetFiltersPanel'
import { MobileAssetBrowser } from './MobileAssetBrowser'
import { useMobileDetection } from '@/lib/hooks/useMobileDetection'

export type ViewMode = 'grid' | 'list' | 'timeline'
export type SortField = 'name' | 'created_at' | 'updated_at' | 'file_size' | 'file_type'
export type SortDirection = 'asc' | 'desc'

export interface AssetFilters {
  search?: string
  fileTypes?: string[]
  dateRange?: {
    start: string
    end: string
  }
  tags?: string[]
  projectIds?: string[]
  minSize?: number
  maxSize?: number
}

export interface AssetBrowserProps {
  projectId?: string
  folderId?: string
  viewMode?: ViewMode
  selectionMode?: 'single' | 'multiple' | 'none'
  onSelectionChange?: (assets: EnhancedAsset[]) => void
  onAssetClick?: (asset: EnhancedAsset) => void
  filters?: AssetFilters
  sortBy?: SortField
  sortDirection?: SortDirection
  className?: string
}

export interface SavedFilter {
  id: string
  name: string
  filters: AssetFilters
  sortBy: SortField
  sortDirection: SortDirection
  created_at: string
}

export function AssetBrowser({
  projectId,
  folderId,
  viewMode: initialViewMode = 'grid',
  selectionMode = 'none',
  onSelectionChange,
  onAssetClick,
  filters: initialFilters = {},
  sortBy: initialSortBy = 'created_at',
  sortDirection: initialSortDirection = 'desc',
  className = ''
}: AssetBrowserProps) {
  const { user } = useAuth()
  const { isMobile } = useMobileDetection()
  
  // State management
  const [assets, setAssets] = useState<EnhancedAsset[]>([])
  const [folders, setFolders] = useState<Folder[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode)
  const [selectedAssets, setSelectedAssets] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<AssetFilters>(initialFilters)
  const [sortBy, setSortBy] = useState<SortField>(initialSortBy)
  const [sortDirection, setSortDirection] = useState<SortDirection>(initialSortDirection)
  const [showFilters, setShowFilters] = useState(false)
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  
  // Constants
  const ITEMS_PER_PAGE = 50
  const FILE_TYPE_GROUPS = {
    images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    videos: ['video/mp4', 'video/webm', 'video/mov', 'video/avi'],
    documents: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    audio: ['audio/mpeg', 'audio/wav', 'audio/ogg']
  }

  // Fetch assets with filters and pagination
  const fetchAssets = useCallback(async (page = 1, append = false) => {
    try {
      setLoading(true)
      
      let query = supabase
        .from('assets')
        .select('*, projects(name)')
        .order(sortBy, { ascending: sortDirection === 'asc' })
        .range((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE - 1)

      // Apply filters
      if (projectId) {
        query = query.eq('project_id', projectId)
      }
      
      if (folderId) {
        query = query.eq('folder_id', folderId)
      } else if (folderId === null) {
        query = query.is('folder_id', null)
      }

      if (filters.search) {
        query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
      }

      if (filters.fileTypes && filters.fileTypes.length > 0) {
        query = query.in('file_type', filters.fileTypes)
      }

      if (filters.dateRange) {
        query = query
          .gte('created_at', filters.dateRange.start)
          .lte('created_at', filters.dateRange.end)
      }

      if (filters.minSize) {
        query = query.gte('file_size', filters.minSize)
      }

      if (filters.maxSize) {
        query = query.lte('file_size', filters.maxSize)
      }

      const { data, error } = await query

      if (error) throw error

      const newAssets = (data || []) as EnhancedAsset[]
      
      if (append) {
        setAssets(prev => [...prev, ...newAssets])
      } else {
        setAssets(newAssets)
      }
      
      setHasMore(newAssets.length === ITEMS_PER_PAGE)
      setCurrentPage(page)
      
    } catch (error) {
      console.error('Error fetching assets:', error)
    } finally {
      setLoading(false)
    }
  }, [projectId, folderId, filters, sortBy, sortDirection])

  // Fetch folders
  const fetchFolders = useCallback(async () => {
    if (!projectId) return
    
    try {
      let query = supabase
        .from('folders')
        .select('*')
        .eq('project_id', projectId)
        .order('name', { ascending: true })

      if (folderId) {
        query = query.eq('parent_id', folderId)
      } else {
        query = query.is('parent_id', null)
      }

      const { data, error } = await query

      if (error) throw error
      setFolders(data || [])
    } catch (error) {
      console.error('Error fetching folders:', error)
    }
  }, [projectId, folderId])

  // Load more assets (infinite scroll)
  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchAssets(currentPage + 1, true)
    }
  }, [loading, hasMore, currentPage, fetchAssets])

  // Real-time subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('asset-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'assets',
          filter: projectId ? `project_id=eq.${projectId}` : undefined
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newAsset = payload.new as EnhancedAsset
            setAssets(prev => [newAsset, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            const updatedAsset = payload.new as EnhancedAsset
            setAssets(prev => prev.map(asset => 
              asset.id === updatedAsset.id ? updatedAsset : asset
            ))
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id
            setAssets(prev => prev.filter(asset => asset.id !== deletedId))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [projectId])

  // Initial data fetch
  useEffect(() => {
    fetchAssets(1, false)
    fetchFolders()
  }, [fetchAssets, fetchFolders])

  // Selection handling
  const handleAssetSelection = useCallback((asset: EnhancedAsset, isSelected: boolean) => {
    if (selectionMode === 'none') return

    const newSelection = new Set(selectedAssets)
    
    if (selectionMode === 'single') {
      newSelection.clear()
      if (isSelected) {
        newSelection.add(asset.id)
      }
    } else {
      if (isSelected) {
        newSelection.add(asset.id)
      } else {
        newSelection.delete(asset.id)
      }
    }
    
    setSelectedAssets(newSelection)
    
    const selectedAssetsList = assets.filter(a => newSelection.has(a.id))
    onSelectionChange?.(selectedAssetsList)
  }, [assets, selectedAssets, selectionMode, onSelectionChange])

  // Bulk selection
  const handleSelectAll = useCallback(() => {
    if (selectionMode === 'none') return
    
    const allSelected = assets.every(asset => selectedAssets.has(asset.id))
    const newSelection = new Set<string>()
    
    if (!allSelected) {
      assets.forEach(asset => newSelection.add(asset.id))
    }
    
    setSelectedAssets(newSelection)
    
    const selectedAssetsList = assets.filter(a => newSelection.has(a.id))
    onSelectionChange?.(selectedAssetsList)
  }, [assets, selectedAssets, selectionMode, onSelectionChange])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'a') {
          e.preventDefault()
          handleSelectAll()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleSelectAll])

  // File type icon helper
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image size={20} className="text-blue-500" />
    if (fileType.startsWith('video/')) return <Film size={20} className="text-purple-500" />
    if (fileType.includes('pdf')) return <FileText size={20} className="text-red-500" />
    return <File size={20} className="text-gray-500" />
  }

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  // Use mobile version on mobile devices
  if (isMobile) {
    return (
      <MobileAssetBrowser
        projectId={projectId}
        folderId={folderId}
        assets={assets}
        loading={loading}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        filters={filters}
        onFiltersChange={setFilters}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSortChange={(field, direction) => {
          setSortBy(field)
          setSortDirection(direction)
        }}
        onAssetClick={onAssetClick || (() => {})}
        onLoadMore={loadMore}
        hasMore={hasMore}
        className={className}
      />
    )
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Search and Filters */}
        <div className="flex flex-1 gap-2 items-center">
          <div className="relative flex-1 max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search assets..."
              value={filters.search || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter size={18} />
            Filters
            {Object.keys(filters).length > 1 && (
              <Badge variant="info" className="ml-1">
                {Object.keys(filters).length - 1}
              </Badge>
            )}
          </Button>
        </div>

        {/* View Controls */}
        <div className="flex items-center gap-2">
          {/* Sort Controls */}
          <div className="flex items-center gap-1 border border-gray-300 rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')}
              className="p-1"
            >
              {sortDirection === 'asc' ? <SortAsc size={16} /> : <SortDesc size={16} />}
            </Button>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortField)}
              className="border-0 bg-transparent text-sm focus:ring-0 outline-none"
            >
              <option value="created_at">Date Created</option>
              <option value="updated_at">Date Modified</option>
              <option value="name">Name</option>
              <option value="file_size">Size</option>
              <option value="file_type">Type</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center border border-gray-300 rounded-lg p-1">
            <Button
              variant={viewMode === 'grid' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
              className="p-2"
            >
              <Grid3X3 size={16} />
            </Button>
            <Button
              variant={viewMode === 'list' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="p-2"
            >
              <List size={16} />
            </Button>
            <Button
              variant={viewMode === 'timeline' ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('timeline')}
              className="p-2"
            >
              <Timeline size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <AssetFiltersPanel
          filters={filters}
          onFiltersChange={setFilters}
          savedFilters={savedFilters}
          onSavedFiltersChange={setSavedFilters}
        />
      )}

      {/* Selection Summary */}
      {selectionMode !== 'none' && selectedAssets.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-primary-50 border border-primary-200 rounded-lg">
          <span className="text-sm font-medium text-primary-700">
            {selectedAssets.size} asset{selectedAssets.size > 1 ? 's' : ''} selected
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline">
              <Download size={16} />
              Download
            </Button>
            <Button size="sm" variant="outline">
              <Tag size={16} />
              Add Tags
            </Button>
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => setSelectedAssets(new Set())}
            >
              <X size={16} />
              Clear
            </Button>
          </div>
        </div>
      )}

      {/* Folders */}
      {folders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => onFolderClick?.(folder)}
              className="group flex flex-col items-center p-4 rounded-lg border-2 border-gray-200 dark:border-gray-800 hover:border-primary hover:bg-primary/5 transition-all"
            >
              <span className="material-symbols-outlined text-coral text-5xl mb-2 group-hover:scale-110 transition-transform">
                folder
              </span>
              <span className="text-sm font-medium text-text-light-primary dark:text-dark-primary truncate w-full text-center">
                {folder.name}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Assets Display */}
      {viewMode === 'grid' && (
        <AssetGridView
          assets={assets}
          selectedAssets={selectedAssets}
          selectionMode={selectionMode}
          onAssetSelection={handleAssetSelection}
          onAssetClick={onAssetClick}
          getFileIcon={getFileIcon}
          formatFileSize={formatFileSize}
        />
      )}

      {viewMode === 'list' && (
        <AssetListView
          assets={assets}
          selectedAssets={selectedAssets}
          selectionMode={selectionMode}
          onAssetSelection={handleAssetSelection}
          onAssetClick={onAssetClick}
          getFileIcon={getFileIcon}
          formatFileSize={formatFileSize}
          formatDate={formatDate}
        />
      )}

      {viewMode === 'timeline' && (
        <AssetTimelineView
          assets={assets}
          selectedAssets={selectedAssets}
          selectionMode={selectionMode}
          onAssetSelection={handleAssetSelection}
          onAssetClick={onAssetClick}
          getFileIcon={getFileIcon}
          formatFileSize={formatFileSize}
          formatDate={formatDate}
        />
      )}

      {/* Loading State */}
      {loading && assets.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
        </div>
      )}

      {/* Empty State */}
      {!loading && assets.length === 0 && folders.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <Image size={64} className="mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No assets found</h3>
          <p className="text-gray-600">
            {Object.keys(filters).length > 1 
              ? 'Try adjusting your filters or search terms'
              : 'Upload some files to get started'
            }
          </p>
        </div>
      )}

      {/* Load More */}
      {hasMore && !loading && assets.length > 0 && (
        <div className="text-center py-4">
          <Button onClick={loadMore} variant="outline">
            Load More Assets
          </Button>
        </div>
      )}
    </div>
  )
}