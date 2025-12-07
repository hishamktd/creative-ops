'use client'

import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  Eye,
  Download,
  MoreVertical,
  Check,
  Calendar,
  Clock
} from 'lucide-react'
import { EnhancedAsset } from '@/lib/services/assetManager'

interface AssetTimelineViewProps {
  assets: EnhancedAsset[]
  selectedAssets: Set<string>
  selectionMode: 'single' | 'multiple' | 'none'
  onAssetSelection: (asset: EnhancedAsset, isSelected: boolean) => void
  onAssetClick?: (asset: EnhancedAsset) => void
  getFileIcon: (fileType: string) => JSX.Element
  formatFileSize: (bytes: number) => string
  formatDate: (dateString: string) => string
}

interface TimelineGroup {
  date: string
  displayDate: string
  assets: EnhancedAsset[]
}

export function AssetTimelineView({
  assets,
  selectedAssets,
  selectionMode,
  onAssetSelection,
  onAssetClick,
  getFileIcon,
  formatFileSize,
  formatDate
}: AssetTimelineViewProps) {
  const [hoveredAsset, setHoveredAsset] = useState<string | null>(null)

  // Group assets by date
  const timelineGroups = useMemo(() => {
    const groups: { [key: string]: EnhancedAsset[] } = {}
    
    assets.forEach(asset => {
      const date = new Date(asset.created_at).toDateString()
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(asset)
    })

    return Object.entries(groups)
      .map(([date, groupAssets]) => ({
        date,
        displayDate: formatTimelineDate(date),
        assets: groupAssets.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [assets])

  function formatTimelineDate(dateString: string): string {
    const date = new Date(dateString)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'Today'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday'
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    }
  }

  function formatTime(dateString: string): string {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

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
    <div className="space-y-8">
      {timelineGroups.map((group) => (
        <div key={group.date} className="relative">
          {/* Date Header */}
          <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-sm border-b border-gray-200 pb-2 mb-4">
            <div className="flex items-center gap-3">
              <Calendar size={20} className="text-primary-600" />
              <h3 className="text-lg font-semibold text-gray-900">{group.displayDate}</h3>
              <Badge variant="default" className="text-xs">
                {group.assets.length} asset{group.assets.length > 1 ? 's' : ''}
              </Badge>
            </div>
          </div>

          {/* Timeline Line */}
          <div className="absolute left-6 top-12 bottom-0 w-0.5 bg-gray-200"></div>

          {/* Assets */}
          <div className="space-y-4 pl-16">
            {group.assets.map((asset, index) => {
              const isSelected = selectedAssets.has(asset.id)
              const isHovered = hoveredAsset === asset.id
              
              return (
                <div key={asset.id} className="relative">
                  {/* Timeline Dot */}
                  <div className="absolute -left-16 top-4 w-3 h-3 bg-primary-500 rounded-full border-2 border-white shadow-sm"></div>
                  
                  {/* Asset Card */}
                  <div
                    className={`bg-white rounded-lg border border-gray-200 p-4 cursor-pointer transition-all ${
                      isSelected 
                        ? 'ring-2 ring-primary-500 shadow-lg border-primary-200' 
                        : 'hover:shadow-md hover:border-gray-300'
                    }`}
                    onClick={(e) => handleAssetClick(asset, e)}
                    onMouseEnter={() => setHoveredAsset(asset.id)}
                    onMouseLeave={() => setHoveredAsset(null)}
                  >
                    <div className="flex items-start gap-4">
                      {/* Selection Checkbox */}
                      {selectionMode !== 'none' && (
                        <div className="flex-shrink-0 pt-1">
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

                      {/* Asset Thumbnail */}
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
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

                      {/* Asset Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-gray-900 truncate" title={asset.name}>
                                {asset.name}
                              </h4>
                              {asset.version > 1 && (
                                <Badge variant="info" className="text-xs">
                                  v{asset.version}
                                </Badge>
                              )}
                              {asset.status === 'processing' && (
                                <div className="w-3 h-3 animate-spin rounded-full border border-primary-500 border-t-transparent"></div>
                              )}
                              {asset.status === 'error' && (
                                <Badge variant="danger" className="text-xs">Error</Badge>
                              )}
                            </div>

                            {asset.description && (
                              <p className="text-sm text-gray-600 mb-2" title={asset.description}>
                                {asset.description}
                              </p>
                            )}

                            <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                              <div className="flex items-center gap-1">
                                <Clock size={12} />
                                {formatTime(asset.created_at)}
                              </div>
                              <span>{formatFileSize(asset.file_size)}</span>
                              <span className="capitalize">{asset.file_type.split('/')[0]}</span>
                              {asset.metadata.width && asset.metadata.height && (
                                <span>{asset.metadata.width}×{asset.metadata.height}</span>
                              )}
                              {asset.metadata.duration && (
                                <span>{Math.round(asset.metadata.duration)}s</span>
                              )}
                              {asset.access_count > 0 && (
                                <span>{asset.access_count} views</span>
                              )}
                            </div>

                            {/* Tags */}
                            {asset.tags && asset.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {asset.tags.slice(0, 4).map((tag, tagIndex) => (
                                  <Badge key={tagIndex} variant="default" className="text-xs px-1.5 py-0.5">
                                    {tag}
                                  </Badge>
                                ))}
                                {asset.tags.length > 4 && (
                                  <Badge variant="default" className="text-xs px-1.5 py-0.5">
                                    +{asset.tags.length - 4}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          <div className={`flex items-center gap-1 ml-4 transition-opacity ${
                            isHovered || isSelected ? 'opacity-100' : 'opacity-0'
                          }`}>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="p-2 h-auto"
                              onClick={(e) => handleActionClick(e, 'preview', asset)}
                              title="Preview"
                            >
                              <Eye size={16} />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="p-2 h-auto"
                              onClick={(e) => handleActionClick(e, 'download', asset)}
                              title="Download"
                            >
                              <Download size={16} />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="p-2 h-auto"
                              onClick={(e) => handleActionClick(e, 'more', asset)}
                              title="More actions"
                            >
                              <MoreVertical size={16} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Empty State */}
      {timelineGroups.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Calendar size={48} className="mx-auto mb-4 text-gray-300" />
          <p>No assets to display in timeline</p>
        </div>
      )}
    </div>
  )
}