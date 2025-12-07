import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { NotificationService } from '../notificationService'

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn(),
  channel: vi.fn()
}

const mockQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  range: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  upsert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis()
}

// Create a test service class that uses the mock
class TestNotificationService extends NotificationService {
  constructor() {
    super()
    ;(this as any).supabase = mockSupabase
  }
}

describe('NotificationService', () => {
  let service: TestNotificationService

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.from.mockReturnValue(mockQuery)
    service = new TestNotificationService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getNotifications', () => {
    it('should fetch notifications with default options', async () => {
      const mockNotifications = [
        {
          id: '1',
          title: 'Test Notification',
          message: 'Test message',
          type: 'info',
          priority: 'medium',
          read: false,
          created_at: '2023-01-01T00:00:00Z'
        }
      ]

      mockQuery.select.mockResolvedValue({ data: mockNotifications, error: null })

      const result = await service.getNotifications()

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications')
      expect(mockQuery.select).toHaveBeenCalledWith(expect.stringContaining('*'))
      expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false })
      expect(mockQuery.range).toHaveBeenCalledWith(0, 49)
      expect(result).toEqual(mockNotifications)
    })

    it('should filter unread notifications when unreadOnly is true', async () => {
      const mockNotifications = [
        {
          id: '1',
          title: 'Unread Notification',
          read: false
        }
      ]

      mockQuery.select.mockResolvedValue({ data: mockNotifications, error: null })

      await service.getNotifications({ unreadOnly: true })

      expect(mockQuery.eq).toHaveBeenCalledWith('read', false)
    })

    it('should filter by priority when provided', async () => {
      const mockNotifications = []
      mockQuery.select.mockResolvedValue({ data: mockNotifications, error: null })

      await service.getNotifications({ 
        priority: ['high', 'urgent'] 
      })

      expect(mockQuery.in).toHaveBeenCalledWith('priority', ['high', 'urgent'])
    })

    it('should handle errors gracefully', async () => {
      const mockError = new Error('Database error')
      mockQuery.select.mockResolvedValue({ data: null, error: mockError })

      await expect(service.getNotifications()).rejects.toThrow('Database error')
    })
  })

  describe('getUnreadCount', () => {
    it('should return unread notification count', async () => {
      mockQuery.select.mockResolvedValue({ count: 5, error: null })

      const result = await service.getUnreadCount()

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications')
      expect(mockQuery.select).toHaveBeenCalledWith('*', { count: 'exact', head: true })
      expect(mockQuery.eq).toHaveBeenCalledWith('read', false)
      expect(result).toBe(5)
    })

    it('should return 0 when count is null', async () => {
      mockQuery.select.mockResolvedValue({ count: null, error: null })

      const result = await service.getUnreadCount()

      expect(result).toBe(0)
    })
  })

  describe('markAsRead', () => {
    it('should mark notification as read using RPC', async () => {
      mockSupabase.rpc.mockResolvedValue({ error: null })

      const result = await service.markAsRead('notification-id')

      expect(mockSupabase.rpc).toHaveBeenCalledWith('mark_notification_read', {
        p_notification_id: 'notification-id'
      })
      expect(result).toBe(true)
    })

    it('should handle RPC errors', async () => {
      const mockError = new Error('RPC error')
      mockSupabase.rpc.mockResolvedValue({ error: mockError })

      await expect(service.markAsRead('notification-id')).rejects.toThrow('RPC error')
    })
  })

  describe('markAllAsRead', () => {
    it('should mark all notifications as read and return count', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: 3, error: null })

      const result = await service.markAllAsRead()

      expect(mockSupabase.rpc).toHaveBeenCalledWith('mark_all_notifications_read')
      expect(result).toBe(3)
    })

    it('should return 0 when no data returned', async () => {
      mockSupabase.rpc.mockResolvedValue({ data: null, error: null })

      const result = await service.markAllAsRead()

      expect(result).toBe(0)
    })
  })

  describe('deleteNotification', () => {
    it('should delete notification successfully', async () => {
      mockQuery.delete.mockResolvedValue({ error: null })

      const result = await service.deleteNotification('notification-id')

      expect(mockSupabase.from).toHaveBeenCalledWith('notifications')
      expect(mockQuery.delete).toHaveBeenCalled()
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'notification-id')
      expect(result).toBe(true)
    })
  })

  describe('getActivityFeed', () => {
    it('should fetch activity feed with default options', async () => {
      const mockActivities = [
        {
          id: '1',
          event_type: 'asset_uploaded',
          description: 'User uploaded an asset',
          created_at: '2023-01-01T00:00:00Z'
        }
      ]

      mockQuery.select.mockResolvedValue({ data: mockActivities, error: null })

      const result = await service.getActivityFeed()

      expect(mockSupabase.from).toHaveBeenCalledWith('activity_feed')
      expect(mockQuery.select).toHaveBeenCalledWith(expect.stringContaining('*'))
      expect(mockQuery.order).toHaveBeenCalledWith('created_at', { ascending: false })
      expect(result).toEqual(mockActivities)
    })

    it('should filter by project ID when provided', async () => {
      mockQuery.select.mockResolvedValue({ data: [], error: null })

      await service.getActivityFeed({ projectId: 'project-123' })

      expect(mockQuery.eq).toHaveBeenCalledWith('project_id', 'project-123')
    })

    it('should filter by event types when provided', async () => {
      mockQuery.select.mockResolvedValue({ data: [], error: null })

      await service.getActivityFeed({ 
        eventTypes: ['asset_uploaded', 'asset_commented'] 
      })

      expect(mockQuery.in).toHaveBeenCalledWith('event_type', ['asset_uploaded', 'asset_commented'])
    })
  })

  describe('getNotificationPreferences', () => {
    it('should fetch user notification preferences', async () => {
      const mockPreferences = [
        {
          id: '1',
          event_type: 'asset_uploaded',
          channels: ['in_app', 'email'],
          enabled: true,
          frequency: 'immediate'
        }
      ]

      mockQuery.select.mockResolvedValue({ data: mockPreferences, error: null })

      const result = await service.getNotificationPreferences()

      expect(mockSupabase.from).toHaveBeenCalledWith('notification_preferences')
      expect(mockQuery.select).toHaveBeenCalledWith('*')
      expect(mockQuery.order).toHaveBeenCalledWith('event_type')
      expect(result).toEqual(mockPreferences)
    })
  })

  describe('updateNotificationPreferences', () => {
    it('should update notification preferences for event type', async () => {
      const mockPreference = {
        id: '1',
        event_type: 'asset_uploaded',
        channels: ['in_app'],
        enabled: false,
        frequency: 'daily'
      }

      mockQuery.upsert.mockResolvedValue({ data: mockPreference, error: null })

      const result = await service.updateNotificationPreferences(
        'asset_uploaded',
        { enabled: false, frequency: 'daily' }
      )

      expect(mockSupabase.from).toHaveBeenCalledWith('notification_preferences')
      expect(mockQuery.upsert).toHaveBeenCalledWith({
        event_type: 'asset_uploaded',
        enabled: false,
        frequency: 'daily'
      })
      expect(mockQuery.select).toHaveBeenCalled()
      expect(mockQuery.single).toHaveBeenCalled()
      expect(result).toEqual(mockPreference)
    })
  })

  describe('bulkUpdatePreferences', () => {
    it('should bulk update multiple notification preferences', async () => {
      const preferences = [
        {
          eventType: 'asset_uploaded' as const,
          enabled: true,
          channels: ['in_app', 'email'] as const,
          frequency: 'immediate'
        },
        {
          eventType: 'asset_commented' as const,
          enabled: false,
          channels: ['in_app'] as const,
          frequency: 'daily'
        }
      ]

      const mockResult = [
        {
          event_type: 'asset_uploaded',
          enabled: true,
          channels: ['in_app', 'email'],
          frequency: 'immediate'
        },
        {
          event_type: 'asset_commented',
          enabled: false,
          channels: ['in_app'],
          frequency: 'daily'
        }
      ]

      mockQuery.upsert.mockResolvedValue({ data: mockResult, error: null })

      const result = await service.bulkUpdatePreferences(preferences)

      expect(mockQuery.upsert).toHaveBeenCalledWith([
        {
          event_type: 'asset_uploaded',
          enabled: true,
          channels: ['in_app', 'email'],
          frequency: 'immediate'
        },
        {
          event_type: 'asset_commented',
          enabled: false,
          channels: ['in_app'],
          frequency: 'daily'
        }
      ])
      expect(result).toEqual(mockResult)
    })
  })

  describe('registerPushSubscription', () => {
    it('should register push subscription successfully', async () => {
      const mockSubscription = {
        endpoint: 'https://example.com/push',
        getKey: vi.fn()
      }

      // Mock the getKey method to return Uint8Array
      mockSubscription.getKey.mockImplementation((name: string) => {
        if (name === 'p256dh') return new Uint8Array([1, 2, 3])
        if (name === 'auth') return new Uint8Array([4, 5, 6])
        return null
      })

      // Mock btoa function
      global.btoa = vi.fn().mockImplementation((str) => 'mocked-base64')

      mockQuery.upsert.mockResolvedValue({ error: null })

      const result = await service.registerPushSubscription(mockSubscription as any)

      expect(mockSupabase.from).toHaveBeenCalledWith('push_subscriptions')
      expect(mockQuery.upsert).toHaveBeenCalledWith({
        endpoint: 'https://example.com/push',
        p256dh_key: 'mocked-base64',
        auth_key: 'mocked-base64',
        user_agent: navigator.userAgent
      })
      expect(result).toBe(true)
    })
  })

  describe('subscribeToNotifications', () => {
    it('should set up real-time subscription for notifications', () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn()
      }

      mockSupabase.channel.mockReturnValue(mockChannel)

      const callback = vi.fn()
      service.subscribeToNotifications('user-123', callback)

      expect(mockSupabase.channel).toHaveBeenCalledWith('notifications')
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: 'user_id=eq.user-123'
        },
        expect.any(Function)
      )
      expect(mockChannel.subscribe).toHaveBeenCalled()
    })
  })

  describe('subscribeToActivityFeed', () => {
    it('should set up real-time subscription for activity feed', () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn()
      }

      mockSupabase.channel.mockReturnValue(mockChannel)

      const callback = vi.fn()
      service.subscribeToActivityFeed('user-123', callback, 'project-456')

      expect(mockSupabase.channel).toHaveBeenCalledWith('activity_feed')
      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_feed',
          filter: 'user_id=eq.user-123,project_id=eq.project-456'
        },
        expect.any(Function)
      )
      expect(mockChannel.subscribe).toHaveBeenCalled()
    })

    it('should handle subscription without project filter', () => {
      const mockChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn()
      }

      mockSupabase.channel.mockReturnValue(mockChannel)

      const callback = vi.fn()
      service.subscribeToActivityFeed('user-123', callback)

      expect(mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_feed',
          filter: 'user_id=eq.user-123'
        },
        expect.any(Function)
      )
    })
  })

  describe('getNotificationAnalytics', () => {
    it('should return notification analytics', async () => {
      const mockNotifications = [
        { type: 'info', priority: 'medium', read: true, created_at: '2023-01-01', project_id: 'proj-1' },
        { type: 'success', priority: 'high', read: false, created_at: '2023-01-02', project_id: 'proj-1' },
        { type: 'info', priority: 'medium', read: true, created_at: '2023-01-03', project_id: 'proj-1' }
      ]

      mockQuery.select.mockResolvedValue({ data: mockNotifications, error: null })

      const result = await service.getNotificationAnalytics({
        startDate: '2023-01-01',
        endDate: '2023-01-03',
        projectId: 'proj-1'
      })

      expect(mockQuery.gte).toHaveBeenCalledWith('created_at', '2023-01-01')
      expect(mockQuery.lte).toHaveBeenCalledWith('created_at', '2023-01-03')
      expect(mockQuery.eq).toHaveBeenCalledWith('project_id', 'proj-1')

      expect(result.total).toBe(3)
      expect(result.unread).toBe(1)
      expect(result.byType.info).toBe(2)
      expect(result.byType.success).toBe(1)
      expect(result.byPriority.medium).toBe(2)
      expect(result.byPriority.high).toBe(1)
      expect(Math.round(result.readRate)).toBe(67) // (2/3) * 100
    })

    it('should handle empty analytics data', async () => {
      mockQuery.select.mockResolvedValue({ data: [], error: null })

      const result = await service.getNotificationAnalytics()

      expect(result).toEqual({
        total: 0,
        unread: 0,
        byType: {},
        byPriority: {},
        readRate: 0
      })
    })
  })

  describe('getCollaborationInsights', () => {
    it('should return collaboration insights for project', async () => {
      const mockActivities = [
        {
          event_type: 'asset_uploaded',
          actor_id: 'user-1',
          created_at: '2023-01-01T10:00:00Z',
          actor: { full_name: 'John Doe' }
        },
        {
          event_type: 'asset_commented',
          actor_id: 'user-2',
          created_at: '2023-01-01T14:00:00Z',
          actor: { full_name: 'Jane Smith' }
        },
        {
          event_type: 'asset_uploaded',
          actor_id: 'user-1',
          created_at: '2023-01-02T09:00:00Z',
          actor: { full_name: 'John Doe' }
        }
      ]

      mockQuery.select.mockResolvedValue({ data: mockActivities, error: null })

      const result = await service.getCollaborationInsights('project-123', 7)

      expect(mockQuery.eq).toHaveBeenCalledWith('project_id', 'project-123')
      expect(mockQuery.gte).toHaveBeenCalledWith('created_at', expect.any(String))

      expect(result).toEqual({
        totalActivities: 3,
        activeUsers: 2,
        activitiesByType: {
          asset_uploaded: 2,
          asset_commented: 1
        },
        activitiesByUser: {
          'user-1': { name: 'John Doe', count: 2 },
          'user-2': { name: 'Jane Smith', count: 1 }
        },
        dailyActivity: {
          '2023-01-01': 2,
          '2023-01-02': 1
        }
      })
    })
  })
})