export type NotificationType = 'info' | 'success' | 'warning' | 'error'
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent'
export type NotificationChannel = 'in_app' | 'email' | 'push' | 'sms'

export type ActivityEventType = 
  | 'asset_uploaded' | 'asset_updated' | 'asset_deleted' | 'asset_moved'
  | 'asset_shared' | 'asset_commented' | 'asset_approved' | 'asset_rejected'
  | 'folder_created' | 'folder_updated' | 'folder_deleted' | 'folder_shared'
  | 'version_created' | 'version_restored' | 'permission_granted' | 'permission_revoked'
  | 'project_created' | 'project_updated' | 'user_joined' | 'user_left'

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: NotificationType
  priority: NotificationPriority
  channels: NotificationChannel[]
  read: boolean
  read_at?: string
  action_url?: string
  asset_id?: string
  project_id?: string
  comment_id?: string
  metadata: Record<string, any>
  expires_at?: string
  created_at: string
  
  // Relations
  asset?: {
    id: string
    name: string
    file_type: string
  }
  project?: {
    id: string
    name: string
  }
  comment?: {
    id: string
    content: string
  }
}

export interface NotificationPreferences {
  id: string
  user_id: string
  event_type: ActivityEventType
  channels: NotificationChannel[]
  enabled: boolean
  frequency: 'immediate' | 'hourly' | 'daily' | 'weekly'
  quiet_hours_start?: string
  quiet_hours_end?: string
  timezone: string
  created_at: string
  updated_at: string
}

export interface ActivityFeedItem {
  id: string
  user_id: string
  actor_id?: string
  event_type: ActivityEventType
  resource_type: string
  resource_id: string
  resource_name?: string
  project_id?: string
  asset_id?: string
  folder_id?: string
  comment_id?: string
  description: string
  metadata: Record<string, any>
  created_at: string
  
  // Relations
  actor?: {
    id: string
    full_name: string
    avatar_url?: string
  }
  asset?: {
    id: string
    name: string
    file_type: string
    thumbnail_url?: string
  }
  project?: {
    id: string
    name: string
  }
  folder?: {
    id: string
    name: string
  }
  comment?: {
    id: string
    content: string
  }
}

export interface NotificationDelivery {
  id: string
  notification_id: string
  channel: NotificationChannel
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced'
  external_id?: string
  error_message?: string
  delivered_at?: string
  created_at: string
  updated_at: string
}

export interface PushSubscriptionData {
  id: string
  user_id: string
  endpoint: string
  p256dh_key: string
  auth_key: string
  user_agent?: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface NotificationAnalytics {
  total: number
  unread: number
  byType: Record<string, number>
  byPriority: Record<string, number>
  readRate: number
}

export interface CollaborationInsights {
  totalActivities: number
  activeUsers: number
  activitiesByType: Record<string, number>
  activitiesByUser: Record<string, { name: string; count: number }>
  dailyActivity: Record<string, number>
}