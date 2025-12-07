'use client'

import React from 'react'
import { VersionComparison as VersionComparisonType, AssetVersion } from '@/types'
import { formatBytes, formatDate } from '@/lib/utils/format'

interface VersionComparisonProps {
  comparison: VersionComparisonType
  onClose: () => void
}

export function VersionComparison({ comparison, onClose }: VersionComparisonProps) {
  const { oldVersion, newVersion, changes } = comparison

  const formatSizeDiff = (diff: number) => {
    const sign = diff > 0 ? '+' : ''
    return `${sign}${formatBytes(diff)}`
  }

  const getSizeDiffColor = (diff: number) => {
    if (diff > 0) return 'text-red-600'
    if (diff < 0) return 'text-green-600'
    return 'text-gray-600'
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            Version Comparison
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Version Info */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            <VersionCard
              version={oldVersion}
              title="Previous Version"
              color="bg-red-50 border-red-200"
            />
            <VersionCard
              version={newVersion}
              title="Current Version"
              color="bg-green-50 border-green-200"
            />
          </div>

          {/* Changes Summary */}
          <div className="mb-8">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Changes Summary</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-sm font-medium text-gray-600">File Size Change:</span>
                  <span className={`ml-2 text-sm font-medium ${getSizeDiffColor(changes.file_size_diff)}`}>
                    {formatSizeDiff(changes.file_size_diff)}
                  </span>
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-600">Metadata Changes:</span>
                  <span className="ml-2 text-sm font-medium text-gray-900">
                    {Object.keys(changes.metadata_changes).length} fields
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Metadata Changes */}
          {Object.keys(changes.metadata_changes).length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Metadata Changes</h3>
              <div className="space-y-3">
                {Object.entries(changes.metadata_changes).map(([key, change]) => (
                  <MetadataChange key={key} field={key} change={change} />
                ))}
              </div>
            </div>
          )}

          {/* Visual Diff (if available) */}
          {changes.visual_diff && (
            <div className="mb-8">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Visual Differences</h3>
              <div className="border rounded-lg overflow-hidden">
                <img
                  src={changes.visual_diff}
                  alt="Visual differences between versions"
                  className="w-full h-auto"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

interface VersionCardProps {
  version: AssetVersion
  title: string
  color: string
}

function VersionCard({ version, title, color }: VersionCardProps) {
  return (
    <div className={`border rounded-lg p-4 ${color}`}>
      <h4 className="font-medium text-gray-900 mb-3">{title}</h4>
      <div className="space-y-2 text-sm">
        <div>
          <span className="font-medium text-gray-600">Version:</span>
          <span className="ml-2 text-gray-900">{version.version_number}</span>
        </div>
        <div>
          <span className="font-medium text-gray-600">Size:</span>
          <span className="ml-2 text-gray-900">{formatBytes(version.file_size)}</span>
        </div>
        <div>
          <span className="font-medium text-gray-600">Uploaded by:</span>
          <span className="ml-2 text-gray-900">{version.uploader_name || 'Unknown'}</span>
        </div>
        <div>
          <span className="font-medium text-gray-600">Date:</span>
          <span className="ml-2 text-gray-900">{formatDate(version.created_at)}</span>
        </div>
        {version.changes_description && (
          <div>
            <span className="font-medium text-gray-600">Changes:</span>
            <p className="ml-2 text-gray-900 mt-1">{version.changes_description}</p>
          </div>
        )}
      </div>
    </div>
  )
}

interface MetadataChangeProps {
  field: string
  change: {
    old: any
    new: any
  }
}

function MetadataChange({ field, change }: MetadataChangeProps) {
  const formatValue = (value: any) => {
    if (value === null || value === undefined) return 'None'
    if (typeof value === 'object') return JSON.stringify(value, null, 2)
    return String(value)
  }

  const getChangeType = () => {
    if (change.old === null) return 'added'
    if (change.new === null) return 'removed'
    return 'modified'
  }

  const changeType = getChangeType()
  const changeColor = {
    added: 'bg-green-50 border-green-200',
    removed: 'bg-red-50 border-red-200',
    modified: 'bg-yellow-50 border-yellow-200'
  }[changeType]

  const changeIcon = {
    added: '+',
    removed: '-',
    modified: '~'
  }[changeType]

  return (
    <div className={`border rounded-lg p-3 ${changeColor}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-mono font-bold text-gray-600">
          {changeIcon}
        </span>
        <span className="font-medium text-gray-900">{field}</span>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        {change.old !== null && (
          <div>
            <span className="font-medium text-gray-600">Previous:</span>
            <pre className="mt-1 text-xs text-gray-800 bg-white p-2 rounded border overflow-x-auto">
              {formatValue(change.old)}
            </pre>
          </div>
        )}
        
        {change.new !== null && (
          <div>
            <span className="font-medium text-gray-600">Current:</span>
            <pre className="mt-1 text-xs text-gray-800 bg-white p-2 rounded border overflow-x-auto">
              {formatValue(change.new)}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}