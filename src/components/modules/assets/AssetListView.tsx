'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  Eye,
  Download,
  MoreVertical,
  Check,
  Tag,
  Calendar,
  User,
  ChevronRight
} from 'lucide-react'
import { EnhancedAsset } from '@/lib/services/assetManager'

interface AssetListViewProps {
  assets: EnhancedAsset[]
  selectedAssets: Set<string>
  selectionMode: 'single' | 'multiple' | 'none'
  onAssetSelection: (asset: EnhancedAsset, isSelected: boolean) => void
  onAssetClick?: (asset: EnhancedAsset) => void
  getFileIcon: (fileType: string) => JSX.Element
  formatFileSize: (bytes: number) => string
  formatDate: (dateString: string) => string
}

export function AssetListView({
  assets,
  selectedAssets,
  selectionMode,
  onAssetSelection,
  onAssetClick,
  getFileIcon,
  formatFileSize,
  formatDate
}: AssetListViewProps) {
  const [hoveredAsset, setHoveredAsset] = useState<string | null>(null)

  const handleAssetClick = (asset: EnhancedAsset, e: React.MouseEvent) => {
    if (selectionMode !== 'none') {
      const isSelected = selectedAssets.has(asset.id)
      onAssetSelection(asset, !isSelected)
    } else {
      onAssetClick?.(asset)
    }
  }

  const handleCheckboxClick = (asset: EnhancedAsset, e: React.MouseEvent) => {
    e.stopPropagation()
    const isSelected = selectedAssets.has(asset.id)
    onAssetSelection(asset, !isSelected)
  }

  const handleActionClick = (e: React.MouseEvent, action: string, asset: EnhancedAsset) => {
    e.stopPropagation()
    
    switch (action) {
      case 'preview':
        onAssetClick?.(asset)
        break
      case 'download':
        window.open(asset.file_url, '_blank')
        break
      case 'more':
        // Handle more actions menu
        break
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-700">
        {selectionMode !== 'none' && (
          <div className="col-span-1 flex items-center">
            <input
              type="checkbox"
              checked={assets.length > 0 && assets.every(asset => selectedAssets.has(asset.id))}
              onChange={(e) => {
                assets.forEach(asset => {
                  onAssetSelection(asset, e.target.checked)
                })
              }}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
          </div>
        )}
        <div className={selectionMode !== 'none' ? 'col-span-4' : 'col-span-5'}>Name</div>
        <div className="col-span-2">Type</div>
        <div className="col-span-1">Size</div>
        <div className="col-span-2">Modified</div>
        <div className="col-span-1">Version</div>
        <div className="col-span-1">Actions</div>
      </div>

      {/* Asset Rows */}
      <div className="divide-y divide-gray-100">
        {assets.map((asset) => {
          const isSelected = selectedAssets.has(asset.id)
          const isHovered = hoveredAsset === asset.id
          
          return (
            <div
              key={asset.id}
              className={`grid grid-cols-12 gap-4 px-4 py-3 cursor-pointer transition-colors ${
                isSelected 
                  ? 'bg-primary-50 border-l-4 border-l-primary-500' 
                  : 'hover:bg-gray-50'
              }`}
              onClick={(e) => handleAssetClick(asset, e)}
              onMouseEnter={() => setHoveredAsset(asset.id)}
              onMouseLeave={() => setHoveredAsset(null)}
            >
              {/* Selection Checkbox */}
              {selectionMode !== 'none' && (
                <div className="col-span-1 flex items-center">
                  <button
                    onClick={(e) => handleCheckboxClick(asset, e)}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                      isSelected
                        ? 'bg-primary-500 border-primary-500 text-white'
                        : 'bg-white border-gray-300 hover:border-primary-500'
                    }`}
                  >
                    {isSelected && <Check size={12} />}
                  </button>
                </div>
              )}

              {/* Asset Info */}
              <div className={`flex items-center gap-3 ${selectionMode !== 'none' ? 'col-span-4' : 'col-span-5'}`}>
                {/* Thumbnail */}
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                  {asset.thumbnail_url || asset.file_type.startsWith('image/') ? (
                    <img
                      src={asset.thumbnail_url || asset.file_url}
                      alt={asset.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      {getFileIcon(asset.file_type)}
                    </div>
                  )}
                </div>

                {/* Name and Description */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-sm text-gray-900 truncate" title={asset.name}>
                      {asset.name}
                    </h4>
                    {asset.status === 'processing' && (
                      <div className="w-3 h-3 animate-spin rounded-full border border-primary-500 border-t-transparent"></div>
                    )}
                    {asset.status === 'error' && (
                      <Badge variant="danger" className="text-xs">Error</Badge>
                    )}
                  </div>
                  {asset.description && (
                    <p className="text-xs text-gray-500 truncate mt-0.5" title={asset.description}>
                      {asset.description}
                    </p>
                  )}
                  {/* Tags */}
                  {asset.tags && asset.tags.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {asset.tags.slice(0, 3).map((tag, index) => (
                        <Badge key={index} variant="default" className="text-xs px-1.5 py-0.5">
                          {tag}
                        </Badge>
                      ))}
                      {asset.tags.length > 3 && (
                        <span className="text-xs text-gray-400">+{asset.tags.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* File Type */}
              <div className="col-span-2 flex items-center">
                <div className="flex items-center gap-2">
                  {getFileIcon(asset.file_type)}
                  <span className="text-sm text-gray-600 capitalize">
                    {asset.file_type.split('/')[0]}
                  </span>
                </div>
              </div>

              {/* File Size */}
              <div className="col-span-1 flex items-center">
                <span className="text-sm text-gray-600">
                  {formatFileSize(asset.file_size)}
                </span>
              </div>

              {/* Modified Date */}
              <div className="col-span-2 flex items-center">
                <div className="text-sm text-gray-600">
                  <div>{formatDate(asset.updated_at)}</div>
                  <div className="text-xs text-gray-400">
                    by {asset.uploaded_by}
                  </div>
                </div>
              </div>

              {/* Version */}
              <div className="col-span-1 flex items-center">
                <Badge variant={asset.version > 1 ? 'info' : 'default'} className="text-xs">
                  v{asset.version}
                </Badge>
              </div>

              {/* Actions */}
              <div className="col-span-1 flex items-center justify-end">
                <div className={`flex items-center gap-1 transition-opacity ${
                  isHovered || isSelected ? 'opacity-100' : 'opacity-0'
                }`}>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="p-1.5 h-auto"
                    onClick={(e) => handleActionClick(e, 'preview', asset)}
                    title="Preview"
                  >
                    <Eye size={14} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="p-1.5 h-auto"
                    onClick={(e) => handleActionClick(e, 'download', asset)}
                    title="Download"
                  >
                    <Download size={14} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="p-1.5 h-auto"
                    onClick={(e) => handleActionClick(e, 'more', asset)}
                    title="More actions"
                  >
                    <MoreVertical size={14} />
                  </Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Empty State */}
      {assets.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No assets to display</p>
        </div>
      )}
    </div>
  )
}