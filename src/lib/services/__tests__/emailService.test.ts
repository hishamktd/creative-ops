import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { EmailService } from '../emailService'
import type { Notification } from '@/types/notifications'

// Mock Resend
const mockResend = {
  emails: {
    send: vi.fn()
  }
}

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => mockResend)
}))

describe('EmailService', () => {
  let emailService: EmailService
  
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock environment variables
    process.env.RESEND_API_KEY = 'test-api-key'
    process.env.FROM_EMAIL = 'test@example.com'
    process.env.NEXT_PUBLIC_APP_URL = 'https://test.creativeops.com'
    
    emailService = new EmailService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.RESEND_API_KEY
    delete process.env.FROM_EMAIL
    delete process.env.NEXT_PUBLIC_APP_URL
  })

  describe('constructor', () => {
    it('should initialize with API key', () => {
      expect(emailService).toBeDefined()
    })

    it('should handle missing API key gracefully', () => {
      delete process.env.RESEND_API_KEY
      const service = new EmailService()
      expect(service).toBeDefined()
    })
  })

  describe('sendNotificationEmail', () => {
    const mockNotification: Notification = {
      id: 'notif-123',
      user_id: 'user-123',
      title: 'Test Notification',
      message: 'This is a test notification',
      type: 'info',
      priority: 'medium',
      channels: ['email'],
      read: false,
      action_url: '/assets/123',
      metadata: {
        file_type: 'jpg',
        file_size: 1024000
      },
      created_at: '2023-01-01T00:00:00Z'
    }

    it('should send notification email successfully', async () => {
      mockResend.emails.send.mockResolvedValue({
        data: { id: 'email-123' },
        error: null
      })

      const result = await emailService.sendNotificationEmail(
        'user@example.com',
        mockNotification
      )

      expect(mockResend.emails.send).toHaveBeenCalledWith({
        from: 'test@example.com',
        to: 'user@example.com',
        subject: 'CreativeOps: Test Notification',
        html: expect.stringContaining('Test Notification'),
        text: expect.stringContaining('Test Notification')
      })
      expect(result).toBe(true)
    })

    it('should handle email service errors', async () => {
      mockResend.emails.send.mockResolvedValue({
        data: null,
        error: new Error('Email service error')
      })

      const result = await emailService.sendNotificationEmail(
        'user@example.com',
        mockNotification
      )

      expect(result).toBe(false)
    })

    it('should respect user preferences for quiet hours', async () => {
      const userPreferences = {
        frequency: 'immediate',
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        timezone: 'UTC'
      }

      // Mock current time to be within quiet hours
      const mockDate = new Date('2023-01-01T23:00:00Z')
      vi.setSystemTime(mockDate)

      const result = await emailService.sendNotificationEmail(
        'user@example.com',
        mockNotification,
        userPreferences
      )

      expect(mockResend.emails.send).not.toHaveBeenCalled()
      expect(result).toBe(false)
    })

    it('should send urgent notifications even during quiet hours', async () => {
      const urgentNotification = {
        ...mockNotification,
        priority: 'urgent' as const
      }

      const userPreferences = {
        frequency: 'immediate',
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        timezone: 'UTC'
      }

      // Mock current time to be within quiet hours
      const mockDate = new Date('2023-01-01T23:00:00Z')
      vi.setSystemTime(mockDate)

      mockResend.emails.send.mockResolvedValue({
        data: { id: 'email-123' },
        error: null
      })

      const result = await emailService.sendNotificationEmail(
        'user@example.com',
        urgentNotification,
        userPreferences
      )

      expect(mockResend.emails.send).toHaveBeenCalled()
      expect(result).toBe(true)
    })

    it('should not send email if email channel is not enabled', async () => {
      const notificationWithoutEmail = {
        ...mockNotification,
        channels: ['in_app'] as const
      }

      const result = await emailService.sendNotificationEmail(
        'user@example.com',
        notificationWithoutEmail
      )

      expect(mockResend.emails.send).not.toHaveBeenCalled()
      expect(result).toBe(false)
    })

    it('should not send email if frequency is not immediate', async () => {
      const userPreferences = {
        frequency: 'daily',
        timezone: 'UTC'
      }

      const result = await emailService.sendNotificationEmail(
        'user@example.com',
        mockNotification,
        userPreferences
      )

      expect(mockResend.emails.send).not.toHaveBeenCalled()
      expect(result).toBe(false)
    })
  })

  describe('sendDigestEmail', () => {
    const mockNotifications: Notification[] = [
      {
        id: 'notif-1',
        user_id: 'user-123',
        title: 'Asset Uploaded',
        message: 'New asset uploaded to project',
        type: 'info',
        priority: 'medium',
        channels: ['email'],
        read: false,
        project: { id: 'proj-1', name: 'Test Project' },
        metadata: {},
        created_at: '2023-01-01T00:00:00Z'
      },
      {
        id: 'notif-2',
        user_id: 'user-123',
        title: 'Comment Added',
        message: 'Someone commented on your asset',
        type: 'info',
        priority: 'medium',
        channels: ['email'],
        read: false,
        project: { id: 'proj-1', name: 'Test Project' },
        metadata: {},
        created_at: '2023-01-01T01:00:00Z'
      }
    ]

    it('should send digest email successfully', async () => {
      mockResend.emails.send.mockResolvedValue({
        data: { id: 'email-123' },
        error: null
      })

      const result = await emailService.sendDigestEmail(
        'user@example.com',
        mockNotifications,
        'daily'
      )

      expect(mockResend.emails.send).toHaveBeenCalledWith({
        from: 'test@example.com',
        to: 'user@example.com',
        subject: 'CreativeOps: 2 new notifications (daily digest)',
        html: expect.stringContaining('Daily Digest'),
        text: expect.stringContaining('Daily Digest')
      })
      expect(result).toBe(true)
    })

    it('should not send digest email if no notifications', async () => {
      const result = await emailService.sendDigestEmail(
        'user@example.com',
        [],
        'daily'
      )

      expect(mockResend.emails.send).not.toHaveBeenCalled()
      expect(result).toBe(false)
    })

    it('should group notifications by project in digest', async () => {
      const notificationsFromDifferentProjects = [
        {
          ...mockNotifications[0],
          project: { id: 'proj-1', name: 'Project A' }
        },
        {
          ...mockNotifications[1],
          project: { id: 'proj-2', name: 'Project B' }
        }
      ]

      mockResend.emails.send.mockResolvedValue({
        data: { id: 'email-123' },
        error: null
      })

      await emailService.sendDigestEmail(
        'user@example.com',
        notificationsFromDifferentProjects,
        'weekly'
      )

      const emailCall = mockResend.emails.send.mock.calls[0][0]
      expect(emailCall.html).toContain('Project A')
      expect(emailCall.html).toContain('Project B')
    })
  })

  describe('email content generation', () => {
    it('should generate proper email subject', async () => {
      const notification: Notification = {
        id: 'notif-123',
        user_id: 'user-123',
        title: 'Custom Title',
        message: 'Custom message',
        type: 'success',
        priority: 'high',
        channels: ['email'],
        read: false,
        metadata: {},
        created_at: '2023-01-01T00:00:00Z'
      }

      mockResend.emails.send.mockResolvedValue({
        data: { id: 'email-123' },
        error: null
      })

      await emailService.sendNotificationEmail('user@example.com', notification)

      const emailCall = mockResend.emails.send.mock.calls[0][0]
      expect(emailCall.subject).toBe('CreativeOps: Custom Title')
    })

    it('should include action URL in email content', async () => {
      const notification: Notification = {
        id: 'notif-123',
        user_id: 'user-123',
        title: 'Test Notification',
        message: 'Test message',
        type: 'info',
        priority: 'medium',
        channels: ['email'],
        read: false,
        action_url: '/assets/123',
        metadata: {},
        created_at: '2023-01-01T00:00:00Z'
      }

      mockResend.emails.send.mockResolvedValue({
        data: { id: 'email-123' },
        error: null
      })

      await emailService.sendNotificationEmail('user@example.com', notification)

      const emailCall = mockResend.emails.send.mock.calls[0][0]
      expect(emailCall.html).toContain('https://test.creativeops.com/assets/123')
      expect(emailCall.text).toContain('https://test.creativeops.com/assets/123')
    })

    it('should include metadata in email content', async () => {
      const notification: Notification = {
        id: 'notif-123',
        user_id: 'user-123',
        title: 'Test Notification',
        message: 'Test message',
        type: 'info',
        priority: 'medium',
        channels: ['email'],
        read: false,
        metadata: {
          file_type: 'PDF',
          file_size: 2048000,
          comment_preview: 'This is a test comment that should appear in the email'
        },
        created_at: '2023-01-01T00:00:00Z'
      }

      mockResend.emails.send.mockResolvedValue({
        data: { id: 'email-123' },
        error: null
      })

      await emailService.sendNotificationEmail('user@example.com', notification)

      const emailCall = mockResend.emails.send.mock.calls[0][0]
      expect(emailCall.html).toContain('PDF')
      expect(emailCall.html).toContain('2 MB')
      expect(emailCall.html).toContain('This is a test comment')
    })

    it('should apply priority styling in HTML email', async () => {
      const urgentNotification: Notification = {
        id: 'notif-123',
        user_id: 'user-123',
        title: 'Urgent Notification',
        message: 'This is urgent',
        type: 'error',
        priority: 'urgent',
        channels: ['email'],
        read: false,
        metadata: {},
        created_at: '2023-01-01T00:00:00Z'
      }

      mockResend.emails.send.mockResolvedValue({
        data: { id: 'email-123' },
        error: null
      })

      await emailService.sendNotificationEmail('user@example.com', urgentNotification)

      const emailCall = mockResend.emails.send.mock.calls[0][0]
      expect(emailCall.html).toContain('priority-urgent')
    })
  })

  describe('quiet hours logic', () => {
    it('should handle same-day quiet hours correctly', async () => {
      const notification: Notification = {
        id: 'notif-123',
        user_id: 'user-123',
        title: 'Test',
        message: 'Test',
        type: 'info',
        priority: 'medium',
        channels: ['email'],
        read: false,
        metadata: {},
        created_at: '2023-01-01T00:00:00Z'
      }

      const userPreferences = {
        frequency: 'immediate',
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        timezone: 'UTC'
      }

      // Test time within quiet hours (23:00)
      vi.setSystemTime(new Date('2023-01-01T23:00:00Z'))
      
      let result = await emailService.sendNotificationEmail(
        'user@example.com',
        notification,
        userPreferences
      )
      expect(result).toBe(false)

      // Test time outside quiet hours (10:00)
      vi.setSystemTime(new Date('2023-01-01T10:00:00Z'))
      
      mockResend.emails.send.mockResolvedValue({
        data: { id: 'email-123' },
        error: null
      })

      result = await emailService.sendNotificationEmail(
        'user@example.com',
        notification,
        userPreferences
      )
      expect(result).toBe(true)
    })

    it('should handle overnight quiet hours correctly', async () => {
      const notification: Notification = {
        id: 'notif-123',
        user_id: 'user-123',
        title: 'Test',
        message: 'Test',
        type: 'info',
        priority: 'medium',
        channels: ['email'],
        read: false,
        metadata: {},
        created_at: '2023-01-01T00:00:00Z'
      }

      const userPreferences = {
        frequency: 'immediate',
        quietHoursStart: '20:00',
        quietHoursEnd: '10:00', // Overnight
        timezone: 'UTC'
      }

      // Test time within overnight quiet hours (02:00)
      vi.setSystemTime(new Date('2023-01-01T02:00:00Z'))
      
      const result = await emailService.sendNotificationEmail(
        'user@example.com',
        notification,
        userPreferences
      )
      expect(result).toBe(false)
    })
  })
})