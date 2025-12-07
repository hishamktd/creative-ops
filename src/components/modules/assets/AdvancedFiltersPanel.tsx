'use client'

import { useState, useEffect } from 'react'
import { X, Calendar, FileType, Users, Tag, Folder, Save, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { SearchFilters, SearchFacets, SavedSearch } from '@/types/search'

interface AdvancedFiltersPanelProps {
  filters: SearchFilters
  onFiltersChange: (filters: SearchFilters) => void
  facets?: SearchFacets
  onClose: () => void
  onSaveSearch?: (name: string, description?: string, isSmartFolder?: boolean) => void
  savedSearches?: SavedSearch[]
  onLoadSavedSearch?: (search: SavedSearch) => void
  onDeleteSavedSearch?: (searchId: string) => void
}

export function AdvancedFiltersPanel({
  filters,
  onFiltersChange,
  facets,
  onClose,
  onSaveSearch,
  savedSearches = [],
  onLoadSavedSearch,
  onDeleteSavedSearch
}: AdvancedFiltersPanelProps) {
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveDescription, setSaveDescription] = useState('')
  const [saveAsSmartFolder, setSaveAsSmartFolder] = useState(false)

  // File type options
  const fileTypeOptions = [
    { value: 'image/jpeg', label: 'JPEG Images', icon: '🖼️' },
    { value: 'image/png', label: 'PNG Images', icon: '🖼️' },
    { value: 'image/gif', label: 'GIF Images', icon: '🎞️' },
    { value: 'image/svg+xml', label: 'SVG Images', icon: '🎨' },
    { value: 'video/mp4', label: 'MP4 Videos', icon: '🎥' },
    { value: 'video/webm', label: 'WebM Videos', icon: '🎥' },
    { value: 'application/pdf', label: 'PDF Documents', icon: '📄' },
    { value: 'text/plain', label: 'Text Files', icon: '📝' },
    { value: 'application/zip', label: 'ZIP Archives', icon: '📦' }
  ]

  // Status options
  const statusOptions = [
    { value: 'ready', label: 'Ready', color: 'green' },
    { value: 'processing', label: 'Processing', color: 'yellow' },
    { value: 'error', label: 'Error', color: 'red' }
  ]

  // Handle filter changes
  const updateFilter = <K extends keyof SearchFilters>(
    key: K,
    value: SearchFilters[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  // Toggle array filter values
  const toggleArrayFilter = <K extends keyof SearchFilters>(
    key: K,
    value: string,
    currentArray: string[] = []
  ) => {
    const newArray = currentArray.includes(value)
      ? currentArray.filter(item => item !== value)
      : [...currentArray, value]
    
    updateFilter(key, newArray.length > 0 ? newArray : undefined)
  }

  // Clear all filters
  const clearAllFilters = () => {
    onFiltersChange({})
  }

  // Handle save search with smart folder support
  const handleSaveSearch = () => {
    if (onSaveSearch && saveName.trim()) {
      onSaveSearch(saveName.trim(), saveDescription.trim() || undefined, saveAsSmartFolder)
      setSaveName('')
      setSaveDescription('')
      setSaveAsSmartFolder(false)
      setShowSaveDialog(false)
    }
  }

  // Count active filters
  const activeFilterCount = [
    filters.projectIds?.length,
    filters.fileTypes?.length,
    filters.tags?.length,
    filters.status?.length,
    filters.dateRange ? 1 : 0,
    filters.sizeRange ? 1 : 0
  ].filter(Boolean).reduce((a, b) => (a || 0) + (b || 0), 0)

  return (
    <div className="bg-white border-l border-gray-200 w-80 h-full overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Advanced Filters</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {activeFilterCount > 0 && (
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={clearAllFilters}
            >
              Clear All
            </Button>
          </div>
        )}
      </div>

      <div className="p-4 space-y-6">
        {/* Saved Searches and Smart Folders */}
        {savedSearches.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <Save className="w-4 h-4 mr-2" />
              Saved Searches & Smart Folders
            </h4>
            <div className="space-y-2">
              {savedSearches.map((search) => (
                <div
                  key={search.id}
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    search.is_smart_folder 
                      ? 'bg-blue-50 border border-blue-200' 
                      : 'bg-gray-50'
                  }`}
                >
                  <button
                    onClick={() => onLoadSavedSearch?.(search)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center">
                      <div className="text-sm font-medium text-gray-900">
                        {search.name}
                      </div>
                      {search.is_smart_folder && (
                        <span className="ml-2 px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                          Smart
                        </span>
                      )}
                    </div>
                    {search.description && (
                      <div className="text-xs text-gray-500 mt-1">
                        {search.description}
                      </div>
                    )}
                    {search.is_smart_folder && (
                      <div className="text-xs text-blue-600 mt-1">
                        Updates automatically with new matches
                      </div>
                    )}
                  </button>
                  <button
                    onClick={() => onDeleteSavedSearch?.(search.id)}
                    className="text-gray-400 hover:text-red-600 ml-2"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* File Types */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
            <FileType className="w-4 h-4 mr-2" />
            File Types
          </h4>
          <div className="space-y-2">
            {fileTypeOptions.map((option) => (
              <label key={option.value} className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.fileTypes?.includes(option.value) || false}
                  onChange={() => toggleArrayFilter('fileTypes', option.value, filters.fileTypes)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700 flex items-center">
                  <span className="mr-2">{option.icon}</span>
                  {option.label}
                  {facets?.fileTypes.find(f => f.value === option.value) && (
                    <span className="ml-auto text-xs text-gray-500">
                      ({facets.fileTypes.find(f => f.value === option.value)?.count})
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Projects */}
        {facets?.projects && facets.projects.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <Folder className="w-4 h-4 mr-2" />
              Projects
            </h4>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {facets.projects.map((project) => (
                <label key={project.value} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={filters.projectIds?.includes(project.value) || false}
                    onChange={() => toggleArrayFilter('projectIds', project.value, filters.projectIds)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm text-gray-700 flex items-center justify-between w-full">
                    <span>{project.label}</span>
                    <span className="text-xs text-gray-500">({project.count})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Tags with Boolean Logic */}
        {facets?.tags && facets.tags.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <Tag className="w-4 h-4 mr-2" />
              Tags
            </h4>
            
            {/* Boolean Logic Selector */}
            {filters.tags && filters.tags.length > 1 && (
              <div className="mb-3 p-2 bg-gray-50 rounded-lg">
                <span className="text-xs text-gray-600 mb-2 block">Tag matching:</span>
                <div className="flex space-x-2">
                  <button
                    onClick={() => updateFilter('tagLogic', 'AND')}
                    className={`px-2 py-1 text-xs rounded ${
                      (filters as any).tagLogic !== 'OR' 
                        ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                        : 'bg-white text-gray-600 border border-gray-300'
                    }`}
                  >
                    ALL (AND)
                  </button>
                  <button
                    onClick={() => updateFilter('tagLogic', 'OR')}
                    className={`px-2 py-1 text-xs rounded ${
                      (filters as any).tagLogic === 'OR' 
                        ? 'bg-blue-100 text-blue-700 border border-blue-300' 
                        : 'bg-white text-gray-600 border border-gray-300'
                    }`}
                  >
                    ANY (OR)
                  </button>
                </div>
              </div>
            )}
            
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
              {facets.tags.map((tag) => (
                <button
                  key={tag.value}
                  onClick={() => toggleArrayFilter('tags', tag.value, filters.tags)}
                  className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                    filters.tags?.includes(tag.value)
                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                      : 'bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  #{tag.label} ({tag.count})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Status */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">Status</h4>
          <div className="space-y-2">
            {statusOptions.map((option) => (
              <label key={option.value} className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters.status?.includes(option.value as any) || false}
                  onChange={() => toggleArrayFilter('status', option.value, filters.status as string[])}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-700 flex items-center">
                  <span
                    className={`w-2 h-2 rounded-full mr-2 ${
                      option.color === 'green' ? 'bg-green-500' :
                      option.color === 'yellow' ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                  />
                  {option.label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Date Range */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
            <Calendar className="w-4 h-4 mr-2" />
            Date Range
          </h4>
          <div className="space-y-2">
            <input
              type="date"
              value={filters.dateRange?.start || ''}
              onChange={(e) => updateFilter('dateRange', {
                start: e.target.value,
                end: filters.dateRange?.end || ''
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="Start date"
            />
            <input
              type="date"
              value={filters.dateRange?.end || ''}
              onChange={(e) => updateFilter('dateRange', {
                start: filters.dateRange?.start || '',
                end: e.target.value
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              placeholder="End date"
            />
            {filters.dateRange && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => updateFilter('dateRange', undefined)}
              >
                Clear Date Range
              </Button>
            )}
          </div>
        </div>

        {/* File Size Range */}
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">File Size</h4>
          <div className="space-y-2">
            <div className="flex space-x-2">
              <input
                type="number"
                value={filters.sizeRange?.min || ''}
                onChange={(e) => updateFilter('sizeRange', {
                  min: parseInt(e.target.value) || 0,
                  max: filters.sizeRange?.max || 0
                })}
                placeholder="Min (MB)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <input
                type="number"
                value={filters.sizeRange?.max || ''}
                onChange={(e) => updateFilter('sizeRange', {
                  min: filters.sizeRange?.min || 0,
                  max: parseInt(e.target.value) || 0
                })}
                placeholder="Max (MB)"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            {filters.sizeRange && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => updateFilter('sizeRange', undefined)}
              >
                Clear Size Range
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        {onSaveSearch && (
          <Button
            variant="secondary"
            onClick={() => setShowSaveDialog(true)}
            className="w-full mb-2"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Search
          </Button>
        )}
      </div>

      {/* Enhanced Save Search Dialog */}
      {showSaveDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold mb-4">Save Search</h3>
            <div className="space-y-4">
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Search name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              <textarea
                value={saveDescription}
                onChange={(e) => setSaveDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
              
              {/* Smart Folder Option */}
              <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <input
                  type="checkbox"
                  id="smartFolder"
                  checked={saveAsSmartFolder}
                  onChange={(e) => setSaveAsSmartFolder(e.target.checked)}
                  className="mt-0.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div className="flex-1">
                  <label htmlFor="smartFolder" className="text-sm font-medium text-blue-900 cursor-pointer">
                    Create as Smart Folder
                  </label>
                  <p className="text-xs text-blue-700 mt-1">
                    Smart folders automatically update with new assets that match your search criteria
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <Button
                variant="secondary"
                onClick={() => {
                  setShowSaveDialog(false)
                  setSaveAsSmartFolder(false)
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveSearch}
                disabled={!saveName.trim()}
              >
                {saveAsSmartFolder ? 'Create Smart Folder' : 'Save Search'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}