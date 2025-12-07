import { describe, it, expect, vi, beforeEach } from 'vitest'
import { collaborationService } from '../collaboration'
import { createClient } from '@/lib/supabase/client'

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn()
}))

const mockSupabase = {
  from: vi.fn(() => ({
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn()
      }))
    })),
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        is: vi.fn(() => ({
          order: vi.fn()
        })),
        single: vi.fn(),
        order: vi.fn(),
        gt: vi.fn()
      }))
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn()
        }))
      }))
    })),
    delete: vi.fn(() => ({
      eq: vi.fn()
    }))
  })),
  rpc: vi.fn(),
  channel: vi.fn(() => ({
    on: vi.fn(() => ({
      subscribe: vi.fn()
    }))
  }))
}

describe('CollaborationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ;(createClient as any).mockReturnValue(mockSupabase)
  })

  describe('Comments', () => {
    describe('createComment', () => {
      it('should create a comment successfully', async () => {
        const mockComment = {
          id: 'comment-123',
          asset_id: 'asset-123',
          content: 'Great work!',
          user: { full_name: 'John Doe', avatar_url: 'avatar.jpg' },
          replies: []
        }

        mockSupabase.from().insert().select().single.mockResolvedValueOnce({
          data: mockComment,
          error: null
        })

        const result = await collaborationService.createComment({
          assetId: 'asset-123',
          content: 'Great work!'
        })

        expect(mockSupabase.from).toHaveBeenCalledWith('asset_comments')
        expect(result).toEqual({
          ...mockComment,
          user_name: 'John Doe',
          user_avatar: 'avatar.jpg',
          replies: []
        })
      })

      it('should handle creation errors', async () => {
        mockSupabase.from().insert().select().single.mockResolvedValueOnce({
          data: null,
          error: { message: 'Creation failed' }
        })

        await expect(collaborationService.createComment({
          assetId: 'asset-123',
          content: 'Great work!'
        })).rejects.toThrow('Failed to create comment: Creation failed')
      })
    })

    describe('getComments', () => {
      it('should fetch comments successfully', async () => {
        const mockComments = [
          {
            id: 'comment-1',
            content: 'First comment',
            user: { full_name: 'John Doe' },
            replies: []
          },
          {
            id: 'comment-2',
            content: 'Second comment',
            user: { full_name: 'Jane Smith' },
            replies: []
          }
        ]

        mockSupabase.from().select().eq().is().order.mockResolvedValueOnce({
          data: mockComments,
          error: null
        })

        const result = await collaborationService.getComments('asset-123')

        expect(result).toHaveLength(2)
        expect(result[0].user_name).toBe('John Doe')
        expect(result[1].user_name).toBe('Jane Smith')
      })
    })

    describe('resolveComment', () => {
      it('should resolve a comment successfully', async () => {
        const mockComment = {
          id: 'comment-123',
          resolved: true,
          resolved_at: '2023-01-01T00:00:00Z',
          user: { full_name: 'John Doe' },
          replies: []
        }

        mockSupabase.from().update().eq().select().single.mockResolvedValueOnce({
          data: mockComment,
          error: null
        })

        const result = await collaborationService.resolveComment('comment-123', true)

        expect(mockSupabase.from().update).toHaveBeenCalledWith({
          resolved: true,
          resolved_at: expect.any(String)
        })
        expect(result.resolved).toBe(true)
      })
    })
  })

  describe('Approvals', () => {
    describe('requestApproval', () => {
      it('should request approval successfully', async () => {
        const mockApproval = {
          id: 'approval-123',
          asset_id: 'asset-123',
          version_id: 'version-123',
          approver_id: 'user-456',
          status: 'pending',
          requester: { full_name: 'John Doe' },
          approver: { full_name: 'Jane Smith' }
        }

        mockSupabase.from().insert().select().single.mockResolvedValueOnce({
          data: mockApproval,
          error: null
        })

        const result = await collaborationService.requestApproval({
          assetId: 'asset-123',
          versionId: 'version-123',
          approverId: 'user-456'
        })

        expect(result.requester_name).toBe('John Doe')
        expect(result.approver_name).toBe('Jane Smith')
      })
    })

    describe('respondToApproval', () => {
      it('should respond to approval successfully', async () => {
        const mockApproval = {
          id: 'approval-123',
          status: 'approved',
          feedback: 'Looks good!',
          approved_at: '2023-01-01T00:00:00Z',
          requester: { full_name: 'John Doe' },
          approver: { full_name: 'Jane Smith' }
        }

        mockSupabase.from().update().eq().select().single.mockResolvedValueOnce({
          data: mockApproval,
          error: null
        })

        const result = await collaborationService.respondToApproval(
          'approval-123',
          'approved',
          'Looks good!'
        )

        expect(result.status).toBe('approved')
        expect(result.feedback).toBe('Looks good!')
      })
    })
  })

  describe('Locks', () => {
    describe('acquireLock', () => {
      it('should acquire lock successfully', async () => {
        mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null })

        const result = await collaborationService.acquireLock('asset-123', 'edit', 30)

        expect(mockSupabase.rpc).toHaveBeenCalledWith('acquire_asset_lock', {
          p_asset_id: 'asset-123',
          p_lock_type: 'edit',
          p_duration_minutes: 30
        })
        expect(result).toBe(true)
      })

      it('should handle lock acquisition failure', async () => {
        mockSupabase.rpc.mockResolvedValueOnce({ data: false, error: null })

        const result = await collaborationService.acquireLock('asset-123')

        expect(result).toBe(false)
      })
    })

    describe('releaseLock', () => {
      it('should release lock successfully', async () => {
        mockSupabase.rpc.mockResolvedValueOnce({ data: true, error: null })

        const result = await collaborationService.releaseLock('asset-123', 'edit')

        expect(mockSupabase.rpc).toHaveBeenCalledWith('release_asset_lock', {
          p_asset_id: 'asset-123',
          p_lock_type: 'edit'
        })
        expect(result).toBe(true)
      })
    })

    describe('getActiveLocks', () => {
      it('should fetch active locks successfully', async () => {
        const mockLocks = [
          {
            id: 'lock-123',
            asset_id: 'asset-123',
            lock_type: 'edit',
            locker: { full_name: 'John Doe' }
          }
        ]

        mockSupabase.from().select().eq().gt.mockResolvedValueOnce({
          data: mockLocks,
          error: null
        })

        const result = await collaborationService.getActiveLocks('asset-123')

        expect(result).toHaveLength(1)
        expect(result[0].locker_name).toBe('John Doe')
      })
    })
  })

  describe('Presence', () => {
    describe('updatePresence', () => {
      it('should update presence successfully', async () => {
        mockSupabase.rpc.mockResolvedValueOnce({ data: null, error: null })

        await collaborationService.updatePresence('asset-123', 'viewing', { x: 50, y: 50 })

        expect(mockSupabase.rpc).toHaveBeenCalledWith('update_asset_presence', {
          p_asset_id: 'asset-123',
          p_status: 'viewing',
          p_cursor_position: { x: 50, y: 50 }
        })
      })
    })

    describe('getActivePresence', () => {
      it('should fetch active presence successfully', async () => {
        const mockPresence = [
          {
            id: 'presence-123',
            asset_id: 'asset-123',
            user_id: 'user-123',
            status: 'viewing',
            user: { full_name: 'John Doe', avatar_url: 'avatar.jpg' }
          }
        ]

        mockSupabase.from().select().eq().gt.mockResolvedValueOnce({
          data: mockPresence,
          error: null
        })

        const result = await collaborationService.getActivePresence('asset-123')

        expect(result).toHaveLength(1)
        expect(result[0].user_name).toBe('John Doe')
        expect(result[0].user_avatar).toBe('avatar.jpg')
      })
    })
  })

  describe('Notifications', () => {
    describe('getNotifications', () => {
      it('should fetch notifications successfully', async () => {
        const mockNotifications = [
          {
            id: 'notif-1',
            event_type: 'comment',
            read: false,
            created_at: '2023-01-01T00:00:00Z'
          },
          {
            id: 'notif-2',
            event_type: 'approval_request',
            read: true,
            created_at: '2023-01-02T00:00:00Z'
          }
        ]

        mockSupabase.from().select().order().range.mockResolvedValueOnce({
          data: mockNotifications,
          error: null
        })

        const result = await collaborationService.getNotifications(50, 0)

        expect(result).toHaveLength(2)
        expect(result[0].event_type).toBe('comment')
      })
    })

    describe('markNotificationsRead', () => {
      it('should mark notifications as read successfully', async () => {
        mockSupabase.from().update().in.mockResolvedValueOnce({
          data: null,
          error: null
        })

        await collaborationService.markNotificationsRead(['notif-1', 'notif-2'])

        expect(mockSupabase.from().update).toHaveBeenCalledWith({ read: true })
      })
    })
  })

  describe('Subscriptions', () => {
    it('should set up comment subscription', () => {
      const mockCallback = vi.fn()
      const mockSubscription = { unsubscribe: vi.fn() }
      
      mockSupabase.channel().on().subscribe.mockReturnValue(mockSubscription)

      const result = collaborationService.subscribeToComments('asset-123', mockCallback)

      expect(mockSupabase.channel).toHaveBeenCalledWith('asset_comments:asset-123')
      expect(result).toBe(mockSubscription)
    })

    it('should set up presence subscription', () => {
      const mockCallback = vi.fn()
      const mockSubscription = { unsubscribe: vi.fn() }
      
      mockSupabase.channel().on().subscribe.mockReturnValue(mockSubscription)

      const result = collaborationService.subscribeToPresence('asset-123', mockCallback)

      expect(mockSupabase.channel).toHaveBeenCalledWith('asset_presence:asset-123')
      expect(result).toBe(mockSubscription)
    })

    it('should set up approval subscription', () => {
      const mockCallback = vi.fn()
      const mockSubscription = { unsubscribe: vi.fn() }
      
      mockSupabase.channel().on().subscribe.mockReturnValue(mockSubscription)

      const result = collaborationService.subscribeToApprovals('asset-123', mockCallback)

      expect(mockSupabase.channel).toHaveBeenCalledWith('asset_approvals:asset-123')
      expect(result).toBe(mockSubscription)
    })
  })
})