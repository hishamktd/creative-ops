'use client'

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  Eye,
  Download,
  MoreVertical,
  Check,
  Tag,
  Calendar,
  User
} from 'lucide-react'
import { EnhancedAsset } from '@/lib/services/assetManager'

interface AssetGridViewProps {
  assets: EnhancedAsset[]
  selectedAssets: Set<string>
  selectionMode: 'single' | 'multiple' | 'none'
  onAssetSelection: (asset: EnhancedAsset, isSelected: boolean) => void
  onAssetClick?: (asset: EnhancedAsset) => void
  getFileIcon: (fileType: string) => JSX.Element
  formatFileSize: (bytes: number) => string
}

export function AssetGridView({
  assets,
  selectedAssets,
  selectionMode,
  onAssetSelection,
  onAssetClick,
  getFileIcon,
  formatFileSize
}: AssetGridViewProps) {
  const [hoveredAsset, setHoveredAsset] = useState<string | null>(null)

  const handleAssetClick = (asset: EnhancedAsset, e: React.MouseEvent) => {
    // Handle selection if in selection mode
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
        // Handle download
        window.open(asset.file_url, '_blank')
        break
      case 'more':
        // Handle more actions menu
        break
    }
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      {assets.map((asset) => {
        const isSelected = selectedAssets.has(asset.id)
        const isHovered = hoveredAsset === asset.id
        
        return (
          <Card
            key={asset.id}
            className={`group cursor-pointer transition-all duration-200 ${
              isSelected 
                ? 'ring-2 ring-primary-500 shadow-lg' 
                : 'hover:shadow-md hover:scale-[1.02]'
            }`}
            onClick={(e) => handleAssetClick(asset, e)}
            onMouseEnter={() => setHoveredAsset(asset.id)}
            onMouseLeave={() => setHoveredAsset(null)}
          >
            <CardContent className="p-0">
              {/* Asset Preview */}
              <div className="aspect-square bg-gray-100 relative overflow-hidden rounded-t-xl">
                {/* Selection Checkbox */}
                {selectionMode !== 'none' && (
                  <div className="absolute top-2 left-2 z-10">
                    <button
                      onClick={(e) => handleCheckboxClick(asset, e)}
                      className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
                        isSelected
                          ? 'bg-primary-500 border-primary-500 text-white'
                          : 'bg-white border-gray-300 hover:border-primary-500'
                      }`}
                    >
                      {isSelected && <Check size={14} />}
                    </button>
                  </div>
                )}

                {/* Version Badge */}
                {asset.version > 1 && (
                  <div className="absolute top-2 right-2 z-10">
                    <Badge variant="info" className="text-xs">
                      v{asset.version}
                    </Badge>
                  </div>
                )}

                {/* Asset Image/Icon */}
                {asset.thumbnail_url || asset.file_type.startsWith('image/') ? (
                  <img
                    src={asset.thumbnail_url || asset.file_url}
                    alt={asset.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full bg-gray-50">
                    <div className="text-center">
                      {getFileIcon(asset.file_type)}
                      <p className="text-xs text-gray-500 mt-2 px-2 truncate">
                        {asset.file_type.split('/')[1]?.toUpperCase()}
                      </p>
                    </div>
                  </div>
                )}

                {/* Hover Actions */}
                <div className={`absolute inset-0 bg-black/50 flex items-center justify-center gap-2 transition-opacity ${
                  isHovered || isSelected ? 'opacity-100' : 'opacity-0'
                }`}>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="bg-white/90 hover:bg-white text-gray-900 p-2"
                    onClick={(e) => handleActionClick(e, 'preview', asset)}
                  >
                    <Eye size={16} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="bg-white/90 hover:bg-white text-gray-900 p-2"
                    onClick={(e) => handleActionClick(e, 'download', asset)}
                  >
                    <Download size={16} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="bg-white/90 hover:bg-white text-gray-900 p-2"
                    onClick={(e) => handleActionClick(e, 'more', asset)}
                  >
                    <MoreVertical size={16} />
                  </Button>
                </div>

                {/* Status Indicator */}
                {asset.status === 'processing' && (
                  <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent mx-auto mb-2"></div>
                      <p className="text-xs text-gray-600">Processing...</p>
                    </div>
                  </div>
                )}

                {asset.status === 'error' && (
                  <div className="absolute inset-0 bg-red-50 flex items-center justify-center">
                    <div className="text-center text-red-600">
                      <p className="text-xs">Error</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Asset Info */}
              <div className="p-3">
                <h4 className="font-medium text-sm text-gray-900 truncate mb-1" title={asset.name}>
                  {asset.name}
                </h4>
                
                <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                  <span>{formatFileSize(asset.file_size)}</span>
                  <span>{new Date(asset.created_at).toLocaleDateString()}</span>
                </div>

                {/* Tags */}
                {asset.tags && asset.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {asset.tags.slice(0, 2).map((tag, index) => (
                      <Badge key={index} variant="default" className="text-xs px-1.5 py-0.5">
                        {tag}
                      </Badge>
                    ))}
                    {asset.tags.length > 2 && (
                      <Badge variant="default" className="text-xs px-1.5 py-0.5">
                        +{asset.tags.length - 2}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Metadata */}
                <div className="flex items-center justify-between text-xs text-gray-400">
                  {asset.metadata.width && asset.metadata.height && (
                    <span>{asset.metadata.width}×{asset.metadata.height}</span>
                  )}
                  {asset.metadata.duration && (
                    <span>{Math.round(asset.metadata.duration)}s</span>
                  )}
                  {asset.metadata.pages && (
                    <span>{asset.metadata.pages} pages</span>
                  )}
                  <span className="ml-auto">
                    {asset.access_count > 0 && `${asset.access_count} views`}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}