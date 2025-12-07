'use client'

import React, { useState, useEffect } from 'react'
import { SecurityService, type AuditLog, type AuditAction } from '../../../lib/services/security'
import { Card } from '../../ui/Card'
import { Button } from '../../ui/Button'

interface AuditLogViewerProps {
  resourceId?: string
  resourceType?: string
  userId?: string
  limit?: number
}

const ACTION_LABELS: Record<AuditAction, string> = {
  view: 'Viewed',
  download: 'Downloaded',
  upload: 'Uploaded',
  edit: 'Edited',
  delete: 'Deleted',
  move: 'Moved',
  copy: 'Copied',
  share: 'Shared',
  comment: 'Commented',
  approve: 'Approved',
  reject: 'Rejected',
  lock: 'Locked',
  unlock: 'Unlocked',
  permission_change: 'Changed Permissions',
  metadata_edit: 'Edited Metadata'
}

const ACTION_COLORS: Record<AuditAction, string> = {
  view: 'bg-blue-100 text-blue-800',
  download: 'bg-green-100 text-green-800',
  upload: 'bg-purple-100 text-purple-800',
  edit: 'bg-yellow-100 text-yellow-800',
  delete: 'bg-red-100 text-red-800',
  move: 'bg-indigo-100 text-indigo-800',
  copy: 'bg-cyan-100 text-cyan-800',
  share: 'bg-pink-100 text-pink-800',
  comment: 'bg-emerald-100 text-emerald-800',
  approve: 'bg-green-100 text-green-800',
  reject: 'bg-red-100 text-red-800',
  lock: 'bg-orange-100 text-orange-800',
  unlock: 'bg-lime-100 text-lime-800',
  permission_change: 'bg-violet-100 text-violet-800',
  metadata_edit: 'bg-amber-100 text-amber-800'
}

const ACTION_ICONS: Record<AuditAction, string> = {
  view: '👁️',
  download: '⬇️',
  upload: '⬆️',
  edit: '✏️',
  delete: '🗑️',
  move: '📁',
  copy: '📋',
  share: '🔗',
  comment: '💬',
  approve: '✅',
  reject: '❌',
  lock: '🔒',
  unlock: '🔓',
  permission_change: '🔐',
  metadata_edit: '📝'
}

export function AuditLogViewer({ 
  resourceId, 
  resourceType, 
  userId, 
  limit = 50 
}: AuditLogViewerProps) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<AuditAction | 'all'>('all')
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'all'>('all')

  useEffect(() => {
    loadAuditLogs()
  }, [resourceId, resourceType, userId, limit])

  const loadAuditLogs = async () => {
    setLoading(true)
    try {
      const data = await SecurityService.getAuditLogs(resourceId, resourceType, userId, limit)
      setLogs(data)
    } catch (error) {
      console.error('Failed to load audit logs:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredLogs = logs.filter(log => {
    // Filter by action
    if (filter !== 'all' && log.action !== filter) {
      return false
    }

    // Filter by date range
    if (dateRange !== 'all') {
      const logDate = new Date(log.created_at)
      const now = new Date()
      const daysDiff = Math.floor((now.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24))

      switch (dateRange) {
        case 'today':
          if (daysDiff > 0) return false
          break
        case 'week':
          if (daysDiff > 7) return false
          break
        case 'month':
          if (daysDiff > 30) return false
          break
      }
    }

    return true
  })

  const formatLogMessage = (log: AuditLog) => {
    const userName = log.user?.full_name || 'Unknown User'
    const action = ACTION_LABELS[log.action] || log.action
    
    let message = `${userName} ${action.toLowerCase()}`

    // Add specific details based on action and metadata
    switch (log.action) {
      case 'permission_change':
        if (log.new_values?.permission_level) {
          message += ` (granted ${log.new_values.permission_level} access)`
        } else if (log.old_values?.permission_level) {
          message += ` (revoked ${log.old_values.permission_level} access)`
        }
        break
      case 'share':
        if (log.new_values?.link_type) {
          message += ` (${log.new_values.link_type} link)`
        }
        break
      case 'edit':
        if (log.old_values && log.new_values) {
          const changes = Object.keys(log.new_values).filter(key => 
            log.old_values![key] !== log.new_values![key]
          )
          if (changes.length > 0) {
            message += ` (${changes.join(', ')})`
          }
        }
        break
    }

    return message
  }

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-1"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Activity Log</h3>
        <Button onClick={loadAuditLogs} variant="outline">
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Action
          </label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as AuditAction | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Actions</option>
            {Object.entries(ACTION_LABELS).map(([action, label]) => (
              <option key={action} value={action}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Time Range
          </label>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
          </select>
        </div>
      </div>

      {/* Audit Log Entries */}
      <div className="space-y-3">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>No activity logs found</p>
            <p className="text-sm">Activity will appear here as users interact with the resource</p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div key={log.id} className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
              <div className="flex-shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${ACTION_COLORS[log.action]}`}>
                  {ACTION_ICONS[log.action]}
                </div>
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">
                  {formatLogMessage(log)}
                </p>
                
                <div className="flex items-center space-x-4 mt-1">
                  <span className="text-xs text-gray-500">
                    {getRelativeTime(log.created_at)}
                  </span>
                  
                  {log.ip_address && (
                    <span className="text-xs text-gray-500">
                      IP: {log.ip_address}
                    </span>
                  )}
                  
                  <span className={`px-2 py-1 text-xs font-medium rounded ${ACTION_COLORS[log.action]}`}>
                    {ACTION_LABELS[log.action]}
                  </span>
                </div>

                {/* Additional metadata */}
                {(log.old_values || log.new_values || log.metadata) && (
                  <details className="mt-2">
                    <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">
                      View Details
                    </summary>
                    <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                      {log.old_values && (
                        <div className="mb-2">
                          <strong>Previous:</strong>
                          <pre className="mt-1 text-gray-600">{JSON.stringify(log.old_values, null, 2)}</pre>
                        </div>
                      )}
                      {log.new_values && (
                        <div className="mb-2">
                          <strong>New:</strong>
                          <pre className="mt-1 text-gray-600">{JSON.stringify(log.new_values, null, 2)}</pre>
                        </div>
                      )}
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div>
                          <strong>Metadata:</strong>
                          <pre className="mt-1 text-gray-600">{JSON.stringify(log.metadata, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {filteredLogs.length >= limit && (
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            Showing {filteredLogs.length} of {logs.length} entries
          </p>
          <Button
            onClick={() => loadAuditLogs()}
            variant="outline"
            className="mt-2"
          >
            Load More
          </Button>
        </div>
      )}
    </Card>
  )
}