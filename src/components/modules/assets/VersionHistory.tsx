'use client'

import React, { useState } from 'react'
import { AssetVersion } from '@/types'
import { useVersionHistory, useVersionComparison } from '@/lib/hooks/useVersionControl'
import { VersionComparison } from './VersionComparison'
import { formatBytes, formatDate, formatTimeAgo } from '@/lib/utils/format'

interface VersionHistoryProps {
  assetId: string
  currentVersion?: number
  onVersionSelect?: (version: AssetVersion) => void
  onRevert?: (version: AssetVersion) => void
}

export function VersionHistory({ 
  assetId, 
  currentVersion, 
  onVersionSelect,
  onRevert 
}: VersionHistoryProps) {
  const { versions, loading, error, revertToVersion } = useVersionHistory(assetId)
  const { comparison, compareVersions, clearComparison } = useVersionComparison()
  const [selectedVersions, setSelectedVersions] = useState<string[]>([])
  const [revertingVersion, setRevertingVersion] = useState<string | null>(null)

  const handleVersionSelect = (versionId: string) => {
    if (selectedVersions.includes(versionId)) {
      setSelectedVersions(prev => prev.filter(id => id !== versionId))
    } else if (selectedVersions.length < 2) {
      setSelectedVersions(prev => [...prev, versionId])
    } else {
      setSelectedVersions([versionId])
    }
  }

  const handleCompareVersions = async () => {
    if (selectedVersions.length === 2) {
      try {
        await compareVersions(selectedVersions[1], selectedVersions[0]) // older, newer
      } catch (error) {
        console.error('Failed to compare versions:', error)
      }
    }
  }

  const handleRevertVersion = async (version: AssetVersion) => {
    if (!confirm(`Are you sure you want to revert to version ${version.version_number}? This will create a new version.`)) {
      return
    }

    try {
      setRevertingVersion(version.id)
      const newVersion = await revertToVersion(version.id, `Reverted to version ${version.version_number}`)
      onRevert?.(newVersion)
    } catch (error) {
      console.error('Failed to revert version:', error)
      alert('Failed to revert version. Please try again.')
    } finally {
      setRevertingVersion(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Version History</h3>
        {selectedVersions.length === 2 && (
          <button
            onClick={handleCompareVersions}
            className="px-3 py-1 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
          >
            Compare Selected
          </button>
        )}
      </div>

      {/* Selection Info */}
      {selectedVersions.length > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            {selectedVersions.length === 1 
              ? 'Select another version to compare'
              : `${selectedVersions.length} versions selected for comparison`
            }
          </p>
        </div>
      )}

      {/* Version List */}
      <div className="space-y-3">
        {versions.map((version, index) => (
          <VersionItem
            key={version.id}
            version={version}
            isLatest={index === 0}
            isCurrent={version.version_number === currentVersion}
            isSelected={selectedVersions.includes(version.id)}
            isReverting={revertingVersion === version.id}
            onSelect={() => handleVersionSelect(version.id)}
            onView={() => onVersionSelect?.(version)}
            onRevert={() => handleRevertVersion(version)}
          />
        ))}
      </div>

      {versions.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No version history available</p>
        </div>
      )}

      {/* Version Comparison Modal */}
      {comparison && (
        <VersionComparison
          comparison={comparison}
          onClose={clearComparison}
        />
      )}
    </div>
  )
}

interface VersionItemProps {
  version: AssetVersion
  isLatest: boolean
  isCurrent: boolean
  isSelected: boolean
  isReverting: boolean
  onSelect: () => void
  onView: () => void
  onRevert: () => void
}

function VersionItem({
  version,
  isLatest,
  isCurrent,
  isSelected,
  isReverting,
  onSelect,
  onView,
  onRevert
}: VersionItemProps) {
  return (
    <div className={`
      border rounded-lg p-4 transition-all cursor-pointer
      ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
      ${isCurrent ? 'ring-2 ring-green-500 ring-opacity-50' : ''}
    `}>
      <div className="flex items-start justify-between">
        <div className="flex-1" onClick={onSelect}>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium text-gray-900">
              Version {version.version_number}
            </span>
            
            {isLatest && (
              <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
                Latest
              </span>
            )}
            
            {isCurrent && (
              <span className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
                Current
              </span>
            )}
            
            {isSelected && (
              <span className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-200 rounded-full">
                Selected
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
            <div>
              <span className="font-medium">Size:</span>
              <span className="ml-1">{formatBytes(version.file_size)}</span>
            </div>
            <div>
              <span className="font-medium">Uploaded:</span>
              <span className="ml-1">{formatTimeAgo(version.created_at)}</span>
            </div>
            <div className="col-span-2">
              <span className="font-medium">By:</span>
              <span className="ml-1">{version.uploader_name || 'Unknown'}</span>
            </div>
          </div>

          {version.changes_description && (
            <div className="text-sm text-gray-700 mb-3">
              <span className="font-medium">Changes:</span>
              <p className="mt-1">{version.changes_description}</p>
            </div>
          )}

          <div className="text-xs text-gray-500">
            {formatDate(version.created_at)}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onView()
            }}
            className="px-3 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            View
          </button>
          
          {!isCurrent && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRevert()
              }}
              disabled={isReverting}
              className="px-3 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isReverting ? (
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  Reverting...
                </div>
              ) : (
                'Revert'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}