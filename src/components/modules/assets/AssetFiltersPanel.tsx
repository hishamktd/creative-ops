'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  X,
  Calendar,
  FileType,
  Tag,
  HardDrive,
  Bookmark,
  BookmarkCheck,
  Plus,
  Trash2
} from 'lucide-react'
import { AssetFilters, SavedFilter } from './AssetBrowser'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'

interface AssetFiltersPanelProps {
  filters: AssetFilters
  onFiltersChange: (filters: AssetFilters) => void
  savedFilters: SavedFilter[]
  onSavedFiltersChange: (savedFilters: SavedFilter[]) => void
}

export function AssetFiltersPanel({
  filters,
  onFiltersChange,
  savedFilters,
  onSavedFiltersChange
}: AssetFiltersPanelProps) {
  const { user } = useAuth()
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [filterName, setFilterName] = useState('')
  const [availableTags, setAvailableTags] = useState<string[]>([])

  // File type groups for easier filtering
  const FILE_TYPE_GROUPS = {
    images: {
      label: 'Images',
      types: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
    },
    videos: {
      label: 'Videos',
      types: ['video/mp4', 'video/webm', 'video/mov', 'video/avi']
    },
    documents: {
      label: 'Documents',
      types: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    },
    audio: {
      label: 'Audio',
      types: ['audio/mpeg', 'audio/wav', 'audio/ogg']
    }
  }

  // Load available tags
  useEffect(() => {
    loadAvailableTags()
  }, [])

  const loadAvailableTags = async () => {
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('tags')
        .not('tags', 'is', null)

      if (error) throw error

      const allTags = new Set<string>()
      data?.forEach(asset => {
        if (asset.tags && Array.isArray(asset.tags)) {
          asset.tags.forEach(tag => allTags.add(tag))
        }
      })

      setAvailableTags(Array.from(allTags).sort())
    } catch (error) {
      console.error('Error loading tags:', error)
    }
  }

  // Load saved filters
  useEffect(() => {
    loadSavedFilters()
  }, [])

  const loadSavedFilters = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('saved_filters')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      onSavedFiltersChange(data || [])
    } catch (error) {
      console.error('Error loading saved filters:', error)
    }
  }

  const updateFilter = (key: keyof AssetFilters, value: any) => {
    onFiltersChange({
      ...filters,
      [key]: value
    })
  }

  const clearFilters = () => {
    onFiltersChange({})
  }

  const toggleFileType = (fileType: string) => {
    const currentTypes = filters.fileTypes || []
    const newTypes = currentTypes.includes(fileType)
      ? currentTypes.filter(type => type !== fileType)
      : [...currentTypes, fileType]
    
    updateFilter('fileTypes', newTypes.length > 0 ? newTypes : undefined)
  }

  const toggleFileTypeGroup = (groupTypes: string[]) => {
    const currentTypes = filters.fileTypes || []
    const hasAllTypes = groupTypes.every(type => currentTypes.includes(type))
    
    if (hasAllTypes) {
      // Remove all types from this group
      const newTypes = currentTypes.filter(type => !groupTypes.includes(type))
      updateFilter('fileTypes', newTypes.length > 0 ? newTypes : undefined)
    } else {
      // Add all types from this group
      const newTypes = [...new Set([...currentTypes, ...groupTypes])]
      updateFilter('fileTypes', newTypes)
    }
  }

  const toggleTag = (tag: string) => {
    const currentTags = filters.tags || []
    const newTags = currentTags.includes(tag)
      ? currentTags.filter(t => t !== tag)
      : [...currentTags, tag]
    
    updateFilter('tags', newTags.length > 0 ? newTags : undefined)
  }

  const saveCurrentFilter = async () => {
    if (!user || !filterName.trim()) return

    try {
      const savedFilter = {
        name: filterName.trim(),
        user_id: user.id,
        filters,
        created_at: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('saved_filters')
        .insert(savedFilter)
        .select()
        .single()

      if (error) throw error

      onSavedFiltersChange([data, ...savedFilters])
      setFilterName('')
      setShowSaveDialog(false)
    } catch (error) {
      console.error('Error saving filter:', error)
    }
  }

  const applySavedFilter = (savedFilter: SavedFilter) => {
    onFiltersChange(savedFilter.filters)
  }

  const deleteSavedFilter = async (filterId: string) => {
    try {
      const { error } = await supabase
        .from('saved_filters')
        .delete()
        .eq('id', filterId)

      if (error) throw error

      onSavedFiltersChange(savedFilters.filter(f => f.id !== filterId))
    } catch (error) {
      console.error('Error deleting saved filter:', error)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const hasActiveFilters = Object.keys(filters).length > 0

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
          <Filter size={18} />
          Advanced Filters
        </h3>
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear All
            </Button>
          )}
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={() => setShowSaveDialog(true)}>
              <Bookmark size={16} />
              Save Filter
            </Button>
          )}
        </div>
      </div>

      {/* Saved Filters */}
      {savedFilters.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Saved Filters</h4>
          <div className="flex flex-wrap gap-2">
            {savedFilters.map((savedFilter) => (
              <div key={savedFilter.id} className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
                <button
                  onClick={() => applySavedFilter(savedFilter)}
                  className="text-sm text-gray-700 hover:text-primary-600 transition-colors"
                >
                  {savedFilter.name}
                </button>
                <button
                  onClick={() => deleteSavedFilter(savedFilter.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* File Types */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <FileType size={16} />
            File Types
          </h4>
          <div className="space-y-2">
            {Object.entries(FILE_TYPE_GROUPS).map(([key, group]) => {
              const hasAllTypes = group.types.every(type => filters.fileTypes?.includes(type))
              const hasSomeTypes = group.types.some(type => filters.fileTypes?.includes(type))
              
              return (
                <div key={key}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hasAllTypes}
                      ref={(input) => {
                        if (input) input.indeterminate = hasSomeTypes && !hasAllTypes
                      }}
                      onChange={() => toggleFileTypeGroup(group.types)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">{group.label}</span>
                  </label>
                </div>
              )
            })}
          </div>
        </div>

        {/* Date Range */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Calendar size={16} />
            Date Range
          </h4>
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-gray-600 mb-1">From</label>
              <input
                type="date"
                value={filters.dateRange?.start || ''}
                onChange={(e) => updateFilter('dateRange', {
                  ...filters.dateRange,
                  start: e.target.value
                })}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">To</label>
              <input
                type="date"
                value={filters.dateRange?.end || ''}
                onChange={(e) => updateFilter('dateRange', {
                  ...filters.dateRange,
                  end: e.target.value
                })}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
        </div>

        {/* File Size */}
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <HardDrive size={16} />
            File Size
          </h4>
          <div className="space-y-2">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Min Size (MB)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={filters.minSize ? filters.minSize / (1024 * 1024) : ''}
                onChange={(e) => updateFilter('minSize', 
                  e.target.value ? parseFloat(e.target.value) * 1024 * 1024 : undefined
                )}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">Max Size (MB)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={filters.maxSize ? filters.maxSize / (1024 * 1024) : ''}
                onChange={(e) => updateFilter('maxSize', 
                  e.target.value ? parseFloat(e.target.value) * 1024 * 1024 : undefined
                )}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                placeholder="100"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Tags */}
      {availableTags.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Tag size={16} />
            Tags
          </h4>
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => {
              const isSelected = filters.tags?.includes(tag)
              return (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                    isSelected
                      ? 'bg-primary-100 border-primary-300 text-primary-700'
                      : 'bg-white border-gray-300 text-gray-700 hover:border-primary-300'
                  }`}
                >
                  {tag}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Active Filters Summary */}
      {hasActiveFilters && (
        <div className="pt-2 border-t border-gray-200">
          <div className="flex flex-wrap gap-2">
            {filters.fileTypes && filters.fileTypes.length > 0 && (
              <Badge variant="info" className="text-xs">
                {filters.fileTypes.length} file type{filters.fileTypes.length > 1 ? 's' : ''}
              </Badge>
            )}
            {filters.dateRange && (filters.dateRange.start || filters.dateRange.end) && (
              <Badge variant="info" className="text-xs">
                Date range
              </Badge>
            )}
            {(filters.minSize || filters.maxSize) && (
              <Badge variant="info" className="text-xs">
                Size range
              </Badge>
            )}
            {filters.tags && filters.tags.length > 0 && (
              <Badge variant="info" className="text-xs">
                {filters.tags.length} tag{filters.tags.length > 1 ? 's' : ''}
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Save Filter Dialog */}
      {showSaveDialog && (
        <>
          <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setShowSaveDialog(false)}></div>
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-xl shadow-xl z-50 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Save Filter</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filter Name
                </label>
                <input
                  type="text"
                  value={filterName}
                  onChange={(e) => setFilterName(e.target.value)}
                  placeholder="Enter filter name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="ghost"
                  onClick={() => setShowSaveDialog(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={saveCurrentFilter}
                  disabled={!filterName.trim()}
                  className="flex-1"
                >
                  Save Filter
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}