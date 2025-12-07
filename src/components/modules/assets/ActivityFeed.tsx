'use client'

import React, { useState, useEffect } from 'react'
import { 
  Activity, 
  Upload, 
  Edit, 
  Trash2, 
  Move, 
  Share, 
  MessageCircle, 
  CheckCircle, 
  XCircle,
  Folder,
  FolderPlus,
  Users,
  UserPlus,
  UserMinus,
  Clock,
  Filter,
  TrendingUp
} from 'lucide-react'
import { notificationService } from '@/lib/services/notificationService'
import type { ActivityFeedItem, ActivityEventType } from '@/types/notifications'

interface ActivityFeedProps {
  projectId?: string
  className?: string
  showFilters?: boolean
  limit?: number
}

const EVENT_ICONS: Record<ActivityEventType, React.ComponentType<any>> = {
  asset_uploaded: Upload,
  asset_updated: Edit,
  asset_deleted: Trash2,
  asset_moved: Move,
  asset_shared: Share,
  asset_commented: MessageCircle,
  asset_approved: CheckCircle,
  asset_rejected: XCircle,
  folder_created: FolderPlus,
  folder_updated: Folder,
  folder_deleted: Trash2,
  folder_shared: Share,
  version_created: Upload,
  version_restored: Clock,
  permission_granted: UserPlus,
  permission_revoked: UserMinus,
  project_created: FolderPlus,
  project_updated: Edit,
  user_joined: UserPlus,
  user_left: UserMinus
}

const EVENT_COLORS: Record<ActivityEventType, string> = {
  asset_uploaded: 'text-green-600 bg-green-100',
  asset_updated: 'text-blue-600 bg-blue-100',
  asset_deleted: 'text-red-600 bg-red-100',
  asset_moved: 'text-purple-600 bg-purple-100',
  asset_shared: 'text-indigo-600 bg-indigo-100',
  asset_commented: 'text-yellow-600 bg-yellow-100',
  asset_approved: 'text-green-600 bg-green-100',
  asset_rejected: 'text-red-600 bg-red-100',
  folder_created: 'text-blue-600 bg-blue-100',
  folder_updated: 'text-blue-600 bg-blue-100',
  folder_deleted: 'text-red-600 bg-red-100',
  folder_shared: 'text-indigo-600 bg-indigo-100',
  version_created: 'text-green-600 bg-green-100',
  version_restored: 'text-orange-600 bg-orange-100',
  permission_granted: 'text-green-600 bg-green-100',
  permission_revoked: 'text-red-600 bg-red-100',
  project_created: 'text-blue-600 bg-blue-100',
  project_updated: 'text-blue-600 bg-blue-100',
  user_joined: 'text-green-600 bg-green-100',
  user_left: 'text-gray-600 bg-gray-100'
}

export function ActivityFeed({ 
  projectId, 
  className = '', 
  showFilters = true, 
  limit = 50 
}: ActivityFeedProps) {
  const [activities, setActivities] = useState<ActivityFeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<{
    eventTypes: ActivityEventType[]
    timeRange: 'today' | 'week' | 'month' | 'all'
  }>({
    eventTypes: [],
    timeRange: 'week'
  })

  useEffect(() => {
    loadActivityFeed()
    
    // Subscribe to real-time activity updates
    const subscription = notificationService.subscribeToActivityFeed(
      'current-user-id', // This should come from auth context
      (newActivity) => {
        setActivities(prev => [newActivity, ...prev].slice(0, limit))
      },
      projectId
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [projectId, filter, limit])

  const loadActivityFeed = async () => {
    try {
      setLoading(true)
      const data = await notificationService.getActivityFeed({
        limit,
        projectId,
        eventTypes: filter.eventTypes.length > 0 ? filter.eventTypes : undefined
      })
      
      // Filter by time range
      const filteredData = filterByTimeRange(data, filter.timeRange)
      setActivities(filteredData)
    } catch (error) {
      console.error('Error loading activity feed:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterByTimeRange = (data: ActivityFeedItem[], timeRange: string): ActivityFeedItem[] => {
    if (timeRange === 'all') return data

    const now = new Date()
    const cutoff = new Date()

    switch (timeRange) {
      case 'today':
        cutoff.setHours(0, 0, 0, 0)
        break
      case 'week':
        cutoff.setDate(now.getDate() - 7)
        break
      case 'month':
        cutoff.setMonth(now.getMonth() - 1)
        break
    }

    return data.filter(activity => new Date(activity.created_at) >= cutoff)
  }

  const handleEventTypeToggle = (eventType: ActivityEventType) => {
    setFilter(prev => ({
      ...prev,
      eventTypes: prev.eventTypes.includes(eventType)
        ? prev.eventTypes.filter(t => t !== eventType)
        : [...prev.eventTypes, eventType]
    }))
  }

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)
    
    if (diffInSeconds < 60) return 'Just now'
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`
    
    return date.toLocaleDateString()
  }

  const getActivityIcon = (eventType: ActivityEventType) => {
    const Icon = EVENT_ICONS[eventType] || Activity
    const colorClass = EVENT_COLORS[eventType] || 'text-gray-600 bg-gray-100'
    
    return (
      <div className={`p-2 rounded-full ${colorClass}`}>
        <Icon className="w-4 h-4" />
      </div>
    )
  }

  const renderActivityContent = (activity: ActivityFeedItem) => {
    return (
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2 mb-1">
          <span className="font-medium text-gray-900">
            {activity.actor?.full_name || 'Unknown User'}
          </span>
          <span className="text-gray-500 text-sm">
            {activity.description}
          </span>
        </div>
        
        {/* Resource details */}
        {activity.asset && (
          <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
            <span className="bg-gray-100 px-2 py-1 rounded text-xs">
              {activity.asset.file_type?.toUpperCase()}
            </span>
            <span>{activity.asset.name}</span>
          </div>
        )}
        
        {activity.folder && (
          <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
            <Folder className="w-4 h-4" />
            <span>{activity.folder.name}</span>
          </div>
        )}
        
        {activity.project && (
          <div className="text-sm text-gray-500">
            in <span className="font-medium">{activity.project.name}</span>
          </div>
        )}
        
        {/* Metadata */}
        {activity.metadata && Object.keys(activity.metadata).length > 0 && (
          <div className="mt-2 text-xs text-gray-500">
            {activity.metadata.comment_preview && (
              <div className="bg-gray-50 p-2 rounded border-l-2 border-gray-200">
                "{activity.metadata.comment_preview}"
              </div>
            )}
            {activity.metadata.file_size && (
              <span>Size: {formatFileSize(activity.metadata.file_size)}</span>
            )}
          </div>
        )}
        
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-500">
            {formatTimeAgo(activity.created_at)}
          </span>
          
          {/* Action buttons */}
          <div className="flex items-center space-x-2">
            {activity.asset_id && (
              <a
                href={`/assets/${activity.asset_id}`}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                View Asset
              </a>
            )}
            {activity.project_id && (
              <a
                href={`/projects/${activity.project_id}`}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                View Project
              </a>
            )}
          </div>
        </div>
      </div>
    )
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const eventTypeOptions = Object.keys(EVENT_ICONS) as ActivityEventType[]

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Activity className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Activity Feed
            </h3>
          </div>
          
          {showFilters && (
            <div className="flex items-center space-x-2">
              <select
                value={filter.timeRange}
                onChange={(e) => setFilter(prev => ({ 
                  ...prev, 
                  timeRange: e.target.value as any 
                }))}
                className="text-sm border border-gray-300 rounded px-2 py-1"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="all">All Time</option>
              </select>
              
              <button className="p-1 text-gray-600 hover:text-gray-900 rounded">
                <Filter className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
        
        {/* Event Type Filters */}
        {showFilters && (
          <div className="mt-3 flex flex-wrap gap-2">
            {eventTypeOptions.slice(0, 8).map((eventType) => (
              <button
                key={eventType}
                onClick={() => handleEventTypeToggle(eventType)}
                className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                  filter.eventTypes.includes(eventType)
                    ? 'bg-blue-100 border-blue-300 text-blue-700'
                    : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {eventType.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Activity List */}
      <div className="max-h-96 overflow-y-auto">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading activity feed...</p>
          </div>
        ) : activities.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium">No recent activity</p>
            <p className="text-sm">Activity will appear here as team members work on the project</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {activities.map((activity) => (
              <div key={activity.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    {activity.actor?.avatar_url ? (
                      <img
                        src={activity.actor.avatar_url}
                        alt={activity.actor.full_name}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-600">
                          {activity.actor?.full_name?.charAt(0) || '?'}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start space-x-2">
                      {getActivityIcon(activity.event_type)}
                      {renderActivityContent(activity)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {activities.length > 0 && (
        <div className="p-3 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Showing {activities.length} activities</span>
            <a
              href="/activity"
              className="text-blue-600 hover:text-blue-800 flex items-center"
            >
              <TrendingUp className="w-4 h-4 mr-1" />
              View Analytics
            </a>
          </div>
        </div>
      )}
    </div>
  )
}