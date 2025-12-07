'use client'

import React, { useState, useEffect } from 'react'
import { EnhancedAsset, AssetMetadata, CameraInfo } from '../../../types'
import { TaggingService, TagSuggestion } from '../../../lib/services/taggingService'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Badge } from '../../ui/Badge'

interface MetadataEditorProps {
  asset: EnhancedAsset
  onSave: (updates: Partial<EnhancedAsset>) => Promise<boolean>
  onClose: () => void
  readOnly?: boolean
}

interface TagInputState {
  value: string
  suggestions: string[]
  showSuggestions: boolean
}

export function MetadataEditor({ asset, onSave, onClose, readOnly = false }: MetadataEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: asset.name,
    description: asset.description || '',
    tags: asset.tags || []
  })
  const [metadata, setMetadata] = useState<AssetMetadata>(asset.metadata)
  const [tagInput, setTagInput] = useState<TagInputState>({
    value: '',
    suggestions: [],
    showSuggestions: false
  })
  const [tagSuggestions, setTagSuggestions] = useState<TagSuggestion[]>([])

  useEffect(() => {
    if (!readOnly) {
      loadTagSuggestions()
    }
  }, [asset.id, readOnly])

  const loadTagSuggestions = async () => {
    try {
      // Create a mock file object for suggestion generation
      const mockFile = new File([''], asset.name, { type: asset.file_type })
      const suggestions = await TaggingService.generateTagSuggestions(
        mockFile,
        asset.metadata,
        asset.project_id,
        asset.tags
      )
      setTagSuggestions(suggestions)
    } catch (error) {
      console.error('Failed to load tag suggestions:', error)
    }
  }

  const handleTagInputChange = async (value: string) => {
    setTagInput(prev => ({ ...prev, value }))

    if (value.length > 0) {
      try {
        const searchResult = await TaggingService.searchTags(value, asset.project_id, 5)
        setTagInput(prev => ({
          ...prev,
          suggestions: searchResult.suggestions,
          showSuggestions: true
        }))
      } catch (error) {
        console.error('Tag search failed:', error)
      }
    } else {
      setTagInput(prev => ({ ...prev, suggestions: [], showSuggestions: false }))
    }
  }

  const handleAddTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase()
    if (trimmedTag && !formData.tags.includes(trimmedTag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, trimmedTag]
      }))
    }
    setTagInput({ value: '', suggestions: [], showSuggestions: false })
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (tagInput.value.trim()) {
        handleAddTag(tagInput.value)
      }
    } else if (e.key === 'Escape') {
      setTagInput(prev => ({ ...prev, showSuggestions: false }))
    }
  }

  const handleMetadataChange = (field: keyof AssetMetadata, value: any) => {
    setMetadata(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleCameraInfoChange = (field: keyof CameraInfo, value: string) => {
    setMetadata(prev => ({
      ...prev,
      camera_info: {
        ...prev.camera_info,
        [field]: value
      }
    }))
  }

  const handleSave = async () => {
    if (readOnly) return

    setIsSaving(true)
    try {
      const updates = {
        name: formData.name,
        description: formData.description,
        tags: formData.tags,
        metadata: metadata
      }

      const success = await onSave(updates)
      if (success) {
        setIsEditing(false)
      }
    } catch (error) {
      console.error('Failed to save metadata:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      name: asset.name,
      description: asset.description || '',
      tags: asset.tags || []
    })
    setMetadata(asset.metadata)
    setIsEditing(false)
  }

  const formatFileSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB']
    let size = bytes
    let unitIndex = 0
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024
      unitIndex++
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`
  }

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {readOnly ? 'Asset Metadata' : 'Edit Metadata'}
          </h2>
          <div className="flex items-center gap-2">
            {!readOnly && (
              <>
                {isEditing ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleCancel}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={isSaving}
                    >
                      {isSaving ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setIsEditing(true)}>
                    Edit Metadata
                  </Button>
                )}
              </>
            )}
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Basic Information */}
            <Card className="p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    File Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <p className="text-gray-900">{asset.name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  {isEditing ? (
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Add a description..."
                    />
                  ) : (
                    <p className="text-gray-900">{asset.description || 'No description'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    File Type
                  </label>
                  <p className="text-gray-900">{asset.file_type}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    File Size
                  </label>
                  <p className="text-gray-900">{formatFileSize(asset.file_size)}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Version
                  </label>
                  <p className="text-gray-900">v{asset.version}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Uploaded
                  </label>
                  <p className="text-gray-900">
                    {new Date(asset.created_at).toLocaleDateString()} at{' '}
                    {new Date(asset.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </Card>

            {/* Tags */}
            <Card className="p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Tags</h3>
              
              <div className="space-y-4">
                {/* Current Tags */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Tags
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {formData.tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        {tag}
                        {isEditing && (
                          <button
                            onClick={() => handleRemoveTag(tag)}
                            className="ml-1 text-gray-500 hover:text-gray-700"
                          >
                            ×
                          </button>
                        )}
                      </Badge>
                    ))}
                    {formData.tags.length === 0 && (
                      <p className="text-gray-500 text-sm">No tags added</p>
                    )}
                  </div>
                </div>

                {/* Add Tags */}
                {isEditing && (
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Add Tags
                    </label>
                    <input
                      type="text"
                      value={tagInput.value}
                      onChange={(e) => handleTagInputChange(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type to search or add new tags..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    
                    {/* Tag Suggestions Dropdown */}
                    {tagInput.showSuggestions && tagInput.suggestions.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg">
                        {tagInput.suggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => handleAddTag(suggestion)}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Suggested Tags */}
                {isEditing && tagSuggestions.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Suggested Tags
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {tagSuggestions.slice(0, 8).map((suggestion) => (
                        <button
                          key={suggestion.tag}
                          onClick={() => handleAddTag(suggestion.tag)}
                          className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          title={`Confidence: ${Math.round(suggestion.confidence * 100)}% (${suggestion.source})`}
                        >
                          {suggestion.tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Technical Metadata */}
            <Card className="p-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Technical Details</h3>
              
              <div className="space-y-3">
                {metadata.width && metadata.height && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Dimensions</label>
                    <p className="text-gray-900">{metadata.width} × {metadata.height} pixels</p>
                  </div>
                )}

                {metadata.duration && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Duration</label>
                    <p className="text-gray-900">{formatDuration(metadata.duration)}</p>
                  </div>
                )}

                {metadata.pages && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Pages</label>
                    <p className="text-gray-900">{metadata.pages}</p>
                  </div>
                )}

                {metadata.color_profile && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Color Profile</label>
                    <p className="text-gray-900">{metadata.color_profile}</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700">MIME Type</label>
                  <p className="text-gray-900">{metadata.mime_type}</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">Original Name</label>
                  <p className="text-gray-900">{metadata.original_name}</p>
                </div>
              </div>
            </Card>

            {/* Camera Information */}
            {metadata.camera_info && Object.keys(metadata.camera_info).length > 0 && (
              <Card className="p-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Camera Information</h3>
                
                <div className="space-y-3">
                  {metadata.camera_info.make && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Camera Make</label>
                      <p className="text-gray-900">{metadata.camera_info.make}</p>
                    </div>
                  )}

                  {metadata.camera_info.model && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Camera Model</label>
                      <p className="text-gray-900">{metadata.camera_info.model}</p>
                    </div>
                  )}

                  {metadata.camera_info.lens && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Lens</label>
                      <p className="text-gray-900">{metadata.camera_info.lens}</p>
                    </div>
                  )}

                  {metadata.camera_info.focal_length && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Focal Length</label>
                      <p className="text-gray-900">{metadata.camera_info.focal_length}</p>
                    </div>
                  )}

                  {metadata.camera_info.aperture && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Aperture</label>
                      <p className="text-gray-900">{metadata.camera_info.aperture}</p>
                    </div>
                  )}

                  {metadata.camera_info.iso && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">ISO</label>
                      <p className="text-gray-900">{metadata.camera_info.iso}</p>
                    </div>
                  )}

                  {metadata.camera_info.shutter_speed && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Shutter Speed</label>
                      <p className="text-gray-900">{metadata.camera_info.shutter_speed}</p>
                    </div>
                  )}

                  {metadata.camera_info.gps && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">GPS Location</label>
                      <p className="text-gray-900">
                        {metadata.camera_info.gps.latitude?.toFixed(6)}, {metadata.camera_info.gps.longitude?.toFixed(6)}
                      </p>
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Extracted Text */}
            {metadata.extracted_text && (
              <Card className="p-4 lg:col-span-2">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Extracted Text Content</h3>
                <div className="bg-gray-50 p-3 rounded-md max-h-40 overflow-y-auto">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {metadata.extracted_text}
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}