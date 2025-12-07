'use client'

import React, { useState, useEffect } from 'react'
import { ErrorHandlingService, AppError, ErrorType, ErrorSeverity } from '@/lib/services/errorHandling'
import { OfflineHandlingService } from '@/lib/services/offlineHandling'

interface ErrorStats {
  total: number
  byType: Record<ErrorType, number>
  bySeverity: Record<ErrorSeverity, number>
  recent: AppError[]
}

interface OfflineStats {
  queuedOperations: number
  cachedAssets: number
  cacheSize: number
  isOnline: boolean
  lastOnlineAt: string
}

export function ErrorMonitoringDashboard() {
  const [errorStats, setErrorStats] = useState<ErrorStats | null>(null)
  const [offlineStats, setOfflineStats] = useState<OfflineStats | null>(null)
  const [selectedError, setSelectedError] = useState<AppError | null>(null)
  const [filterType, setFilterType] = useState<ErrorType | 'all'>('all')
  const [filterSeverity, setFilterSeverity] = useState<ErrorSeverity | 'all'>('all')
  const [isExpanded, setIsExpanded] = useState(false)

  useEffect(() => {
    const updateStats = () => {
      setErrorStats(ErrorHandlingService.getErrorStats())
      setOfflineStats(OfflineHandlingService.getStats())
    }

    // Initial load
    updateStats()

    // Update every 5 seconds
    const interval = setInterval(updateStats, 5000)

    // Subscribe to offline state changes
    const unsubscribe = OfflineHandlingService.subscribe(() => {
      setOfflineStats(OfflineHandlingService.getStats())
    })

    return () => {
      clearInterval(interval)
      unsubscribe()
    }
  }, [])

  const getFilteredErrors = (): AppError[] => {
    if (!errorStats) return []

    const criteria: any = {}
    if (filterType !== 'all') criteria.type = filterType
    if (filterSeverity !== 'all') criteria.severity = filterSeverity

    return ErrorHandlingService.getErrors(criteria)
  }

  const getSeverityColor = (severity: ErrorSeverity): string => {
    switch (severity) {
      case ErrorSeverity.LOW: return 'text-green-600 bg-green-100'
      case ErrorSeverity.MEDIUM: return 'text-yellow-600 bg-yellow-100'
      case ErrorSeverity.HIGH: return 'text-orange-600 bg-orange-100'
      case ErrorSeverity.CRITICAL: return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getTypeColor = (type: ErrorType): string => {
    switch (type) {
      case ErrorType.NETWORK: return 'text-blue-600 bg-blue-100'
      case ErrorType.VALIDATION: return 'text-purple-600 bg-purple-100'
      case ErrorType.AUTHENTICATION: return 'text-red-600 bg-red-100'
      case ErrorType.AUTHORIZATION: return 'text-orange-600 bg-orange-100'
      case ErrorType.STORAGE: return 'text-indigo-600 bg-indigo-100'
      case ErrorType.PROCESSING: return 'text-yellow-600 bg-yellow-100'
      case ErrorType.QUOTA: return 'text-pink-600 bg-pink-100'
      case ErrorType.SECURITY: return 'text-red-700 bg-red-200'
      case ErrorType.SYSTEM: return 'text-gray-600 bg-gray-100'
      default: return 'text-gray-500 bg-gray-50'
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString()
  }

  if (!errorStats || !offlineStats) {
    return (
      <div className="p-4 bg-white rounded-lg shadow">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Errors */}
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Errors</p>
              <p className="text-2xl font-bold text-gray-900">{errorStats.total}</p>
            </div>
            <div className="p-2 bg-red-100 rounded-lg">
              <span className="text-red-600 text-xl">⚠️</span>
            </div>
          </div>
        </div>

        {/* Critical Errors */}
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Critical Errors</p>
              <p className="text-2xl font-bold text-red-600">
                {errorStats.bySeverity[ErrorSeverity.CRITICAL] || 0}
              </p>
            </div>
            <div className="p-2 bg-red-100 rounded-lg">
              <span className="text-red-600 text-xl">🚨</span>
            </div>
          </div>
        </div>

        {/* Queued Operations */}
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Queued Operations</p>
              <p className="text-2xl font-bold text-blue-600">{offlineStats.queuedOperations}</p>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <span className="text-blue-600 text-xl">⏳</span>
            </div>
          </div>
        </div>

        {/* Online Status */}
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Connection</p>
              <p className={`text-2xl font-bold ${offlineStats.isOnline ? 'text-green-600' : 'text-red-600'}`}>
                {offlineStats.isOnline ? 'Online' : 'Offline'}
              </p>
            </div>
            <div className={`p-2 rounded-lg ${offlineStats.isOnline ? 'bg-green-100' : 'bg-red-100'}`}>
              <span className={`text-xl ${offlineStats.isOnline ? 'text-green-600' : 'text-red-600'}`}>
                {offlineStats.isOnline ? '🟢' : '🔴'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Expandable Detailed View */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b border-gray-200">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center justify-between w-full text-left"
          >
            <h3 className="text-lg font-medium text-gray-900">Error Details</h3>
            <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
              ▼
            </span>
          </button>
        </div>

        {isExpanded && (
          <div className="p-4 space-y-4">
            {/* Error Type Distribution */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Errors by Type</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(errorStats.byType).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between p-2 rounded border">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(type as ErrorType)}`}>
                      {type}
                    </span>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Severity Distribution */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Errors by Severity</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(errorStats.bySeverity).map(([severity, count]) => (
                  <div key={severity} className="flex items-center justify-between p-2 rounded border">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(severity as ErrorSeverity)}`}>
                      {severity}
                    </span>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Offline Statistics */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Offline Statistics</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-xs text-gray-600">Cached Assets</p>
                  <p className="text-lg font-semibold">{offlineStats.cachedAssets}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-xs text-gray-600">Cache Size</p>
                  <p className="text-lg font-semibold">{formatFileSize(offlineStats.cacheSize)}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-xs text-gray-600">Last Online</p>
                  <p className="text-sm font-semibold">{formatTimestamp(offlineStats.lastOnlineAt)}</p>
                </div>
              </div>
            </div>

            {/* Error Filters */}
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Filter by Type</label>
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as ErrorType | 'all')}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value="all">All Types</option>
                  {Object.values(ErrorType).map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Filter by Severity</label>
                <select
                  value={filterSeverity}
                  onChange={(e) => setFilterSeverity(e.target.value as ErrorSeverity | 'all')}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value="all">All Severities</option>
                  {Object.values(ErrorSeverity).map(severity => (
                    <option key={severity} value={severity}>{severity}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={() => ErrorHandlingService.clearErrorLog()}
                  className="text-sm px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Clear Errors
                </button>
              </div>
            </div>

            {/* Recent Errors List */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Recent Errors</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {getFilteredErrors().slice(-10).reverse().map((error) => (
                  <div
                    key={error.id}
                    className="p-3 border rounded cursor-pointer hover:bg-gray-50"
                    onClick={() => setSelectedError(error)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getTypeColor(error.type)}`}>
                            {error.type}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(error.severity)}`}>
                            {error.severity}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-900 truncate">{error.userMessage}</p>
                        <p className="text-xs text-gray-500">{formatTimestamp(error.timestamp)}</p>
                      </div>
                      <span className="text-gray-400">→</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Detail Modal */}
      {selectedError && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">Error Details</h3>
                <button
                  onClick={() => setSelectedError(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700">Error ID</label>
                  <p className="text-sm font-mono bg-gray-100 p-1 rounded">{selectedError.id}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Timestamp</label>
                  <p className="text-sm">{formatTimestamp(selectedError.timestamp)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700">Type</label>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getTypeColor(selectedError.type)}`}>
                    {selectedError.type}
                  </span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Severity</label>
                  <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${getSeverityColor(selectedError.severity)}`}>
                    {selectedError.severity}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">User Message</label>
                <p className="text-sm bg-gray-50 p-2 rounded">{selectedError.userMessage}</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">Technical Message</label>
                <p className="text-sm bg-gray-50 p-2 rounded font-mono">{selectedError.message}</p>
              </div>

              {selectedError.technicalDetails && (
                <div>
                  <label className="block text-xs font-medium text-gray-700">Technical Details</label>
                  <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">{selectedError.technicalDetails}</pre>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-700">Context</label>
                <pre className="text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                  {JSON.stringify(selectedError.context, null, 2)}
                </pre>
              </div>

              {selectedError.recoveryActions.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">Recovery Actions</label>
                  <div className="space-y-2">
                    {selectedError.recoveryActions.map((action, index) => (
                      <div key={index} className="p-2 border rounded">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{action.label}</span>
                          <span className="text-xs text-gray-500">{action.type}</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">{action.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}