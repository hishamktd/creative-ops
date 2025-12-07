import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { NotificationCenter } from '../NotificationCenter'
import { notificationService } from '@/lib/services/notificationService'
import type { Notification } from '@/types/notifications'

// Mock the notification service
vi.mock('@/lib/services/notificationService', () => ({
  notificationService: {
    getNotifications: vi.fn(),
    getUnreadCount: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    deleteNotification: vi.fn(),
    subscribeToNotifications: vi.fn()
  }
}))

// Mock Notification API
Object.defineProperty(window, 'Notification', {
  writable: true,
  value: vi.fn().mockImplementation((title, options) => ({
    title,
    ...options,
    close: vi.fn()
  }))
})

Object.defineProperty(Notification, 'permission', {
  writable: true,
  value: 'default'
})

describe('NotificationCenter', () => {
  const mockNotifications: Notification[] = [
    {
      id: '1',
      user_id: 'user-123',
      title: 'Asset Uploaded',
      message: 'New asset has been uploaded to your project',
      type: 'info',
      priority: 'medium',
      channels: ['in_app'],
      read: false,
      action_url: '/assets/123',
      asset: {
        id: '123',
        name: 'test-image.jpg',
        file_type: 'jpg'
      },
      metadata: {},
      created_at: '2023-01-01T10:00:00Z'
    },
    {
      id: '2',
      user_id: 'user-123',
      title: 'Comment Added',
      message: 'Someone commented on your asset',
      type: 'success',
      priority: 'high',
      channels: ['in_app', 'email'],
      read: true,
      read_at: '2023-01-01T11:00:00Z',
      metadata: {},
      created_at: '2023-01-01T09:00:00Z'
    }
  ]

  const mockSubscription = {
    unsubscribe: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(notificationService.getNotifications as any).mockResolvedValue(mockNotifications)
    ;(notificationService.getUnreadCount as any).mockResolvedValue(1)
    ;(notificationService.subscribeToNotifications as any).mockReturnValue(mockSubscription)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    it('should render notification bell with unread count', async () => {
      render(<NotificationCenter />)

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument()
      })

      // Should show unread count badge
      expect(screen.getByText('1')).toBeInTheDocument()
    })

    it('should not show badge when no unread notifications', async () => {
      ;(notificationService.getUnreadCount as any).mockResolvedValue(0)

      render(<NotificationCenter />)

      await waitFor(() => {
        expect(screen.getByRole('button')).toBeInTheDocument()
      })

      expect(screen.queryByText('1')).not.toBeInTheDocument()
    })

    it('should show 99+ for counts over 99', async () => {
      ;(notificationService.getUnreadCount as any).mockResolvedValue(150)

      render(<NotificationCenter />)

      await waitFor(() => {
        expect(screen.getByText('99+')).toBeInTheDocument()
      })
    })
  })

  describe('notification panel', () => {
    it('should open panel when bell is clicked', async () => {
      render(<NotificationCenter />)

      const bellButton = screen.getByRole('button')
      fireEvent.click(bellButton)

      await waitFor(() => {
        expect(screen.getByText('Notifications')).toBeInTheDocument()
      })

      expect(screen.getByText('Asset Uploaded')).toBeInTheDocument()
      expect(screen.getByText('Comment Added')).toBeInTheDocument()
    })

    it('should close panel when backdrop is clicked', async () => {
      render(<NotificationCenter />)

      // Open panel
      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText('Notifications')).toBeInTheDocument()
      })

      // Click backdrop (the fixed overlay)
      const backdrop = document.querySelector('.fixed.inset-0')
      expect(backdrop).toBeInTheDocument()
      fireEvent.click(backdrop!)

      await waitFor(() => {
        expect(screen.queryByText('Notifications')).not.toBeInTheDocument()
      })
    })

    it('should show loading state initially', () => {
      ;(notificationService.getNotifications as any).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      render(<NotificationCenter />)
      fireEvent.click(screen.getByRole('button'))

      expect(screen.getByText('Loading notifications...')).toBeInTheDocument()
    })

    it('should show empty state when no notifications', async () => {
      ;(notificationService.getNotifications as any).mockResolvedValue([])

      render(<NotificationCenter />)
      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText('No notifications')).toBeInTheDocument()
        expect(screen.getByText("You're all caught up!")).toBeInTheDocument()
      })
    })
  })

  describe('notification interactions', () => {
    it('should mark notification as read when check button is clicked', async () => {
      ;(notificationService.markAsRead as any).mockResolvedValue(true)

      render(<NotificationCenter />)
      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText('Asset Uploaded')).toBeInTheDocument()
      })

      // Find and click the mark as read button for unread notification
      const markReadButtons = screen.getAllByTitle('Mark as read')
      fireEvent.click(markReadButtons[0])

      await waitFor(() => {
        expect(notificationService.markAsRead).toHaveBeenCalledWith('1')
      })
    })

    it('should delete notification when X button is clicked', async () => {
      ;(notificationService.deleteNotification as any).mockResolvedValue(true)

      render(<NotificationCenter />)
      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText('Asset Uploaded')).toBeInTheDocument()
      })

      // Find and click delete button
      const deleteButtons = screen.getAllByTitle('Delete notification')
      fireEvent.click(deleteButtons[0])

      await waitFor(() => {
        expect(notificationService.deleteNotification).toHaveBeenCalledWith('1')
      })
    })

    it('should mark all notifications as read', async () => {
      ;(notificationService.markAllAsRead as any).mockResolvedValue(2)

      render(<NotificationCenter />)
      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText('Mark all read')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Mark all read'))

      await waitFor(() => {
        expect(notificationService.markAllAsRead).toHaveBeenCalled()
      })
    })

    it('should toggle between all and unread filters', async () => {
      render(<NotificationCenter />)
      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText('Show unread')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Show unread'))

      expect(screen.getByText('Show all')).toBeInTheDocument()
    })
  })

  describe('notification display', () => {
    it('should display notification with correct styling for unread', async () => {
      render(<NotificationCenter />)
      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        const unreadNotification = screen.getByText('Asset Uploaded').closest('.p-4')
        expect(unreadNotification).toHaveClass('bg-blue-50', 'border-l-4', 'border-l-blue-500')
      })
    })

    it('should display asset metadata when available', async () => {
      render(<NotificationCenter />)
      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText('JPG')).toBeInTheDocument()
        expect(screen.getByText('test-image.jpg')).toBeInTheDocument()
      })
    })

    it('should show priority badges for high priority notifications', async () => {
      render(<NotificationCenter />)
      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText('High')).toBeInTheDocument()
      })
    })

    it('should show urgent priority badge', async () => {
      const urgentNotification = {
        ...mockNotifications[0],
        priority: 'urgent' as const
      }
      ;(notificationService.getNotifications as any).mockResolvedValue([urgentNotification])

      render(<NotificationCenter />)
      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText('Urgent')).toBeInTheDocument()
      })
    })

    it('should format time ago correctly', async () => {
      // Mock current time to be 1 hour after the notification
      const mockDate = new Date('2023-01-01T11:00:00Z')
      vi.setSystemTime(mockDate)

      render(<NotificationCenter />)
      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText('1h ago')).toBeInTheDocument()
      })
    })

    it('should show action links when action_url is provided', async () => {
      render(<NotificationCenter />)
      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        const actionLink = screen.getByText('View Details →')
        expect(actionLink).toBeInTheDocument()
        expect(actionLink.closest('a')).toHaveAttribute('href', '/assets/123')
      })
    })
  })

  describe('real-time updates', () => {
    it('should subscribe to real-time notifications on mount', () => {
      render(<NotificationCenter />)

      expect(notificationService.subscribeToNotifications).toHaveBeenCalledWith(
        'current-user-id',
        expect.any(Function)
      )
    })

    it('should unsubscribe on unmount', () => {
      const { unmount } = render(<NotificationCenter />)

      unmount()

      expect(mockSubscription.unsubscribe).toHaveBeenCalled()
    })

    it('should handle new notification from subscription', async () => {
      let subscriptionCallback: (notification: Notification) => void

      ;(notificationService.subscribeToNotifications as any).mockImplementation(
        (userId: string, callback: (notification: Notification) => void) => {
          subscriptionCallback = callback
          return mockSubscription
        }
      )

      render(<NotificationCenter />)

      // Simulate new notification
      const newNotification: Notification = {
        id: '3',
        user_id: 'user-123',
        title: 'New Notification',
        message: 'This is a new notification',
        type: 'info',
        priority: 'medium',
        channels: ['in_app'],
        read: false,
        metadata: {},
        created_at: new Date().toISOString()
      }

      subscriptionCallback!(newNotification)

      // Open panel to see the new notification
      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText('New Notification')).toBeInTheDocument()
      })
    })

    it('should show browser notification when permission is granted', async () => {
      Object.defineProperty(Notification, 'permission', {
        value: 'granted'
      })

      let subscriptionCallback: (notification: Notification) => void

      ;(notificationService.subscribeToNotifications as any).mockImplementation(
        (userId: string, callback: (notification: Notification) => void) => {
          subscriptionCallback = callback
          return mockSubscription
        }
      )

      render(<NotificationCenter />)

      const newNotification: Notification = {
        id: '3',
        user_id: 'user-123',
        title: 'Browser Notification',
        message: 'This should show as browser notification',
        type: 'info',
        priority: 'medium',
        channels: ['in_app'],
        read: false,
        metadata: {},
        created_at: new Date().toISOString()
      }

      subscriptionCallback!(newNotification)

      expect(window.Notification).toHaveBeenCalledWith('Browser Notification', {
        body: 'This should show as browser notification',
        icon: '/favicon.ico',
        tag: '3'
      })
    })
  })

  describe('error handling', () => {
    it('should handle notification loading errors gracefully', async () => {
      ;(notificationService.getNotifications as any).mockRejectedValue(
        new Error('Network error')
      )

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(<NotificationCenter />)
      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Error loading notifications:',
          expect.any(Error)
        )
      })

      consoleSpy.mockRestore()
    })

    it('should handle mark as read errors gracefully', async () => {
      ;(notificationService.markAsRead as any).mockRejectedValue(
        new Error('Network error')
      )

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(<NotificationCenter />)
      fireEvent.click(screen.getByRole('button'))

      await waitFor(() => {
        expect(screen.getByText('Asset Uploaded')).toBeInTheDocument()
      })

      const markReadButtons = screen.getAllByTitle('Mark as read')
      fireEvent.click(markReadButtons[0])

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Error marking notification as read:',
          expect.any(Error)
        )
      })

      consoleSpy.mockRestore()
    })
  })
})