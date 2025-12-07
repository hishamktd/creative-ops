import { createClient } from '@/lib/supabase/client'
import type { 
  Notification, 
  NotificationPreferences, 
  ActivityFeedItem, 
  NotificationChannel,
  NotificationPriority,
  ActivityEventType 
} from '@/types/notifications'

export class NotificationService {
  private supabase: any

  constructor() {
    this.supabase = createClient()
  }

  // =====================================================
  // NOTIFICATION MANAGEMENT
  // =====================================================

  /**
   * Get notifications for the current user
   */
  async getNotifications(options: {
    limit?: number
    offset?: number
    unreadOnly?: boolean
    priority?: NotificationPriority[]
  } = {}) {
    const { limit = 50, offset = 0, unreadOnly = false, priority } = options

    let query = this.supabase
      .from('notifications')
      .select(`
        *,
        asset:assets(id, name, file_type),
        project:projects(id, name),
        comment:comments(id, content)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (unreadOnly) {
      query = query.eq('read', false)
    }

    if (priority && priority.length > 0) {
      query = query.in('priority', priority)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching notifications:', error)
      throw error
    }

    return data as Notification[]
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(): Promise<number> {
    const { count, error } = await this.supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('read', false)

    if (error) {
      console.error('Error fetching unread count:', error)
      throw error
    }

    return count || 0
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<boolean> {
    const { error } = await this.supabase
      .rpc('mark_notification_read', { p_notification_id: notificationId })

    if (error) {
      console.error('Error marking notification as read:', error)
      throw error
    }

    return true
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<number> {
    const { data, error } = await this.supabase
      .rpc('mark_all_notifications_read')

    if (error) {
      console.error('Error marking all notifications as read:', error)
      throw error
    }

    return data || 0
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId)

    if (error) {
      console.error('Error deleting notification:', error)
      throw error
    }

    return true
  }

  /**
   * Subscribe to real-time notifications
   */
  subscribeToNotifications(
    userId: string,
    callback: (notification: Notification) => void
  ) {
    return this.supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          callback(payload.new as Notification)
        }
      )
      .subscribe()
  }

  // =====================================================
  // ACTIVITY FEED
  // =====================================================

  /**
   * Get activity feed for the current user
   */
  async getActivityFeed(options: {
    limit?: number
    offset?: number
    projectId?: string
    eventTypes?: ActivityEventType[]
  } = {}): Promise<ActivityFeedItem[]> {
    const { limit = 50, offset = 0, projectId, eventTypes } = options

    let query = this.supabase
      .from('activity_feed')
      .select(`
        *,
        actor:users!activity_feed_actor_id_fkey(id, full_name, avatar_url),
        asset:assets(id, name, file_type, thumbnail_url),
        project:projects(id, name),
        folder:folders(id, name),
        comment:comments(id, content)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    if (eventTypes && eventTypes.length > 0) {
      query = query.in('event_type', eventTypes)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching activity feed:', error)
      throw error
    }

    return data as ActivityFeedItem[]
  }

  /**
   * Subscribe to real-time activity feed updates
   */
  subscribeToActivityFeed(
    userId: string,
    callback: (activity: ActivityFeedItem) => void,
    projectId?: string
  ) {
    const channel = this.supabase.channel('activity_feed')

    let filter = `user_id=eq.${userId}`
    if (projectId) {
      filter += `,project_id=eq.${projectId}`
    }

    return channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_feed',
          filter
        },
        (payload) => {
          callback(payload.new as ActivityFeedItem)
        }
      )
      .subscribe()
  }

  // =====================================================
  // NOTIFICATION PREFERENCES
  // =====================================================

  /**
   * Get user's notification preferences
   */
  async getNotificationPreferences(): Promise<NotificationPreferences[]> {
    const { data, error } = await this.supabase
      .from('notification_preferences')
      .select('*')
      .order('event_type')

    if (error) {
      console.error('Error fetching notification preferences:', error)
      throw error
    }

    return data as NotificationPreferences[]
  }

  /**
   * Update notification preferences
   */
  async updateNotificationPreferences(
    eventType: ActivityEventType,
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    const { data, error } = await this.supabase
      .from('notification_preferences')
      .upsert({
        event_type: eventType,
        ...preferences
      })
      .select()
      .single()

    if (error) {
      console.error('Error updating notification preferences:', error)
      throw error
    }

    return data as NotificationPreferences
  }

  /**
   * Bulk update notification preferences
   */
  async bulkUpdatePreferences(
    preferences: Array<{
      eventType: ActivityEventType
      enabled: boolean
      channels: NotificationChannel[]
      frequency?: string
    }>
  ): Promise<NotificationPreferences[]> {
    const updates = preferences.map(pref => ({
      event_type: pref.eventType,
      enabled: pref.enabled,
      channels: pref.channels,
      frequency: pref.frequency || 'immediate'
    }))

    const { data, error } = await this.supabase
      .from('notification_preferences')
      .upsert(updates)
      .select()

    if (error) {
      console.error('Error bulk updating preferences:', error)
      throw error
    }

    return data as NotificationPreferences[]
  }

  // =====================================================
  // PUSH NOTIFICATIONS
  // =====================================================

  /**
   * Register push notification subscription
   */
  async registerPushSubscription(subscription: PushSubscription): Promise<boolean> {
    const subscriptionData = {
      endpoint: subscription.endpoint,
      p256dh_key: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('p256dh')!))),
      auth_key: btoa(String.fromCharCode(...new Uint8Array(subscription.getKey('auth')!))),
      user_agent: navigator.userAgent
    }

    const { error } = await this.supabase
      .from('push_subscriptions')
      .upsert(subscriptionData)

    if (error) {
      console.error('Error registering push subscription:', error)
      throw error
    }

    return true
  }

  /**
   * Unregister push notification subscription
   */
  async unregisterPushSubscription(endpoint: string): Promise<boolean> {
    const { error } = await this.supabase
      .from('push_subscriptions')
      .update({ is_active: false })
      .eq('endpoint', endpoint)

    if (error) {
      console.error('Error unregistering push subscription:', error)
      throw error
    }

    return true
  }

  /**
   * Request notification permission and register service worker
   */
  async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications')
      return false
    }

    if (Notification.permission === 'granted') {
      return true
    }

    if (Notification.permission === 'denied') {
      return false
    }

    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }

  // =====================================================
  // ANALYTICS
  // =====================================================

  /**
   * Get notification analytics
   */
  async getNotificationAnalytics(options: {
    startDate?: string
    endDate?: string
    projectId?: string
  } = {}) {
    const { startDate, endDate, projectId } = options

    let query = this.supabase
      .from('notifications')
      .select(`
        type,
        priority,
        read,
        created_at,
        project_id
      `)

    if (startDate) {
      query = query.gte('created_at', startDate)
    }

    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Error fetching notification analytics:', error)
      throw error
    }

    // Process analytics data
    const analytics = {
      total: data.length,
      unread: data.filter(n => !n.read).length,
      byType: {} as Record<string, number>,
      byPriority: {} as Record<string, number>,
      readRate: 0
    }

    data.forEach(notification => {
      analytics.byType[notification.type] = (analytics.byType[notification.type] || 0) + 1
      analytics.byPriority[notification.priority] = (analytics.byPriority[notification.priority] || 0) + 1
    })

    analytics.readRate = analytics.total > 0 ? 
      ((analytics.total - analytics.unread) / analytics.total) * 100 : 0

    return analytics
  }

  /**
   * Get team collaboration insights
   */
  async getCollaborationInsights(projectId: string, days: number = 30) {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const { data, error } = await this.supabase
      .from('activity_feed')
      .select(`
        event_type,
        actor_id,
        created_at,
        actor:users!activity_feed_actor_id_fkey(full_name)
      `)
      .eq('project_id', projectId)
      .gte('created_at', startDate.toISOString())

    if (error) {
      console.error('Error fetching collaboration insights:', error)
      throw error
    }

    // Process insights
    const insights = {
      totalActivities: data.length,
      activeUsers: new Set(data.map(d => d.actor_id)).size,
      activitiesByType: {} as Record<string, number>,
      activitiesByUser: {} as Record<string, { name: string; count: number }>,
      dailyActivity: {} as Record<string, number>
    }

    data.forEach(activity => {
      // By type
      insights.activitiesByType[activity.event_type] = 
        (insights.activitiesByType[activity.event_type] || 0) + 1

      // By user
      if (activity.actor_id && activity.actor) {
        if (!insights.activitiesByUser[activity.actor_id]) {
          insights.activitiesByUser[activity.actor_id] = {
            name: activity.actor.full_name,
            count: 0
          }
        }
        insights.activitiesByUser[activity.actor_id].count++
      }

      // By day
      const day = activity.created_at.split('T')[0]
      insights.dailyActivity[day] = (insights.dailyActivity[day] || 0) + 1
    })

    return insights
  }
}

// Export singleton instance
export const notificationService = new NotificationService()