import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useCollaboration } from '../useCollaboration'
import { mockSupabaseClient } from '@/test/test-utils'

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  supabase: mockSupabaseClient,
}))

// Mock collaboration service
vi.mock('@/lib/services/collaboration', () => ({
  CollaborationService: {
    joinSession: vi.fn(),
    leaveSession: vi.fn(),
    sendPresenceUpdate: vi.fn(),
    addComment: vi.fn(),
    updateComment: vi.fn(),
    deleteComment: vi.fn(),
    subscribeToComments: vi.fn(),
    subscribeToPresence: vi.fn(),
  },
}))

describe('useCollaboration', () => {
  const mockAssetId = 'asset-123'
  const mockUserId = 'user-456'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('initializes collaboration session', async () => {
    const { CollaborationService } = await import('@/lib/services/collaboration')
    
    vi.mocked(CollaborationService.joinSession).mockResolvedValue({
      sessionId: 'session-123',
      participants: [],
    })

    const { result } = renderHook(() => 
      useCollaboration({ assetId: mockAssetId, userId: mockUserId })
    )

    expect(result.current.isConnected).toBe(false)
    expect(result.current.participants).toEqual([])

    await waitFor(() => {
      expect(CollaborationService.joinSession).toHaveBeenCalledWith(mockAssetId, mockUserId)
    })

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    })
  })

  it('manages presence updates', async () => {
    const { CollaborationService } = await import('@/lib/services/collaboration')
    
    const mockParticipants = [
      {
        userId: 'user-1',
        name: 'John Doe',
        avatar: 'avatar1.jpg',
        cursor: { x: 100, y: 200 },
        lastSeen: new Date().toISOString(),
      },
      {
        userId: 'user-2',
        name: 'Jane Smith',
        avatar: 'avatar2.jpg',
        cursor: { x: 300, y: 400 },
        lastSeen: new Date().toISOString(),
      },
    ]

    vi.mocked(CollaborationService.subscribeToPresence).mockImplementation((assetId, callback) => {
      // Simulate real-time presence updates
      setTimeout(() => {
        callback(mockParticipants)
      }, 100)
      
      return () => {} // Unsubscribe function
    })

    const { result } = renderHook(() => 
      useCollaboration({ assetId: mockAssetId, userId: mockUserId })
    )

    await waitFor(() => {
      expect(result.current.participants).toHaveLength(2)
      expect(result.current.participants[0].name).toBe('John Doe')
    })
  })

  it('handles cursor position updates', async () => {
    const { CollaborationService } = await import('@/lib/services/collaboration')
    
    const { result } = renderHook(() => 
      useCollaboration({ assetId: mockAssetId, userId: mockUserId })
    )

    act(() => {
      result.current.updateCursor({ x: 150, y: 250 })
    })

    await waitFor(() => {
      expect(CollaborationService.sendPresenceUpdate).toHaveBeenCalledWith(
        mockAssetId,
        mockUserId,
        expect.objectContaining({
          cursor: { x: 150, y: 250 },
        })
      )
    })
  })

  it('manages comments lifecycle', async () => {
    const { CollaborationService } = await import('@/lib/services/collaboration')
    
    const mockComments = [
      {
        id: 'comment-1',
        assetId: mockAssetId,
        userId: 'user-1',
        content: 'This looks great!',
        position: { x: 100, y: 200 },
        createdAt: new Date().toISOString(),
        replies: [],
      },
    ]

    vi.mocked(CollaborationService.subscribeToComments).mockImplementation((assetId, callback) => {
      setTimeout(() => {
        callback(mockComments)
      }, 100)
      
      return () => {}
    })

    vi.mocked(CollaborationService.addComment).mockResolvedValue(mockComments[0])

    const { result } = renderHook(() => 
      useCollaboration({ assetId: mockAssetId, userId: mockUserId })
    )

    // Wait for initial comments to load
    await waitFor(() => {
      expect(result.current.comments).toHaveLength(1)
    })

    // Add a new comment
    await act(async () => {
      await result.current.addComment({
        content: 'New comment',
        position: { x: 300, y: 400 },
      })
    })

    expect(CollaborationService.addComment).toHaveBeenCalledWith(
      mockAssetId,
      mockUserId,
      expect.objectContaining({
        content: 'New comment',
        position: { x: 300, y: 400 },
      })
    )
  })

  it('handles comment updates and deletions', async () => {
    const { CollaborationService } = await import('@/lib/services/collaboration')
    
    vi.mocked(CollaborationService.updateComment).mockResolvedValue(true)
    vi.mocked(CollaborationService.deleteComment).mockResolvedValue(true)

    const { result } = renderHook(() => 
      useCollaboration({ assetId: mockAssetId, userId: mockUserId })
    )

    // Update comment
    await act(async () => {
      await result.current.updateComment('comment-1', {
        content: 'Updated comment content',
      })
    })

    expect(CollaborationService.updateComment).toHaveBeenCalledWith(
      'comment-1',
      expect.objectContaining({
        content: 'Updated comment content',
      })
    )

    // Delete comment
    await act(async () => {
      await result.current.deleteComment('comment-1')
    })

    expect(CollaborationService.deleteComment).toHaveBeenCalledWith('comment-1')
  })

  it('manages threaded replies', async () => {
    const { CollaborationService } = await import('@/lib/services/collaboration')
    
    const mockReply = {
      id: 'reply-1',
      parentId: 'comment-1',
      userId: mockUserId,
      content: 'Reply to comment',
      createdAt: new Date().toISOString(),
    }

    vi.mocked(CollaborationService.addComment).mockResolvedValue(mockReply)

    const { result } = renderHook(() => 
      useCollaboration({ assetId: mockAssetId, userId: mockUserId })
    )

    await act(async () => {
      await result.current.addReply('comment-1', {
        content: 'Reply to comment',
      })
    })

    expect(CollaborationService.addComment).toHaveBeenCalledWith(
      mockAssetId,
      mockUserId,
      expect.objectContaining({
        content: 'Reply to comment',
        parentId: 'comment-1',
      })
    )
  })

  it('handles real-time typing indicators', async () => {
    const { CollaborationService } = await import('@/lib/services/collaboration')
    
    const { result } = renderHook(() => 
      useCollaboration({ assetId: mockAssetId, userId: mockUserId })
    )

    // Start typing
    act(() => {
      result.current.setTyping(true)
    })

    await waitFor(() => {
      expect(CollaborationService.sendPresenceUpdate).toHaveBeenCalledWith(
        mockAssetId,
        mockUserId,
        expect.objectContaining({
          isTyping: true,
        })
      )
    })

    // Stop typing
    act(() => {
      result.current.setTyping(false)
    })

    await waitFor(() => {
      expect(CollaborationService.sendPresenceUpdate).toHaveBeenCalledWith(
        mockAssetId,
        mockUserId,
        expect.objectContaining({
          isTyping: false,
        })
      )
    })
  })

  it('handles connection errors gracefully', async () => {
    const { CollaborationService } = await import('@/lib/services/collaboration')
    
    vi.mocked(CollaborationService.joinSession).mockRejectedValue(
      new Error('Connection failed')
    )

    const { result } = renderHook(() => 
      useCollaboration({ assetId: mockAssetId, userId: mockUserId })
    )

    await waitFor(() => {
      expect(result.current.error).toBe('Connection failed')
      expect(result.current.isConnected).toBe(false)
    })
  })

  it('automatically reconnects on connection loss', async () => {
    const { CollaborationService } = await import('@/lib/services/collaboration')
    
    let connectionAttempts = 0
    vi.mocked(CollaborationService.joinSession).mockImplementation(() => {
      connectionAttempts++
      if (connectionAttempts === 1) {
        return Promise.reject(new Error('Network error'))
      }
      return Promise.resolve({
        sessionId: 'session-123',
        participants: [],
      })
    })

    const { result } = renderHook(() => 
      useCollaboration({ 
        assetId: mockAssetId, 
        userId: mockUserId,
        autoReconnect: true,
        reconnectDelay: 100,
      })
    )

    // Should eventually connect after retry
    await waitFor(() => {
      expect(result.current.isConnected).toBe(true)
    }, { timeout: 1000 })

    expect(connectionAttempts).toBe(2)
  })

  it('cleans up on unmount', async () => {
    const { CollaborationService } = await import('@/lib/services/collaboration')
    
    const mockUnsubscribe = vi.fn()
    vi.mocked(CollaborationService.subscribeToPresence).mockReturnValue(mockUnsubscribe)
    vi.mocked(CollaborationService.subscribeToComments).mockReturnValue(mockUnsubscribe)

    const { unmount } = renderHook(() => 
      useCollaboration({ assetId: mockAssetId, userId: mockUserId })
    )

    unmount()

    expect(CollaborationService.leaveSession).toHaveBeenCalledWith(mockAssetId, mockUserId)
    expect(mockUnsubscribe).toHaveBeenCalledTimes(2) // Once for presence, once for comments
  })

  it('handles permission-based features', async () => {
    const { result } = renderHook(() => 
      useCollaboration({ 
        assetId: mockAssetId, 
        userId: mockUserId,
        permissions: {
          canComment: true,
          canEdit: false,
          canDelete: false,
        }
      })
    )

    expect(result.current.canComment).toBe(true)
    expect(result.current.canEdit).toBe(false)
    expect(result.current.canDelete).toBe(false)

    // Should not allow editing operations
    await act(async () => {
      try {
        await result.current.updateComment('comment-1', { content: 'Updated' })
      } catch (error) {
        expect(error.message).toContain('Permission denied')
      }
    })
  })

  it('batches presence updates to avoid spam', async () => {
    const { CollaborationService } = await import('@/lib/services/collaboration')
    
    const { result } = renderHook(() => 
      useCollaboration({ 
        assetId: mockAssetId, 
        userId: mockUserId,
        presenceThrottleMs: 100,
      })
    )

    // Rapid cursor updates
    act(() => {
      result.current.updateCursor({ x: 100, y: 100 })
      result.current.updateCursor({ x: 101, y: 101 })
      result.current.updateCursor({ x: 102, y: 102 })
    })

    // Should only send one update after throttle period
    await waitFor(() => {
      expect(CollaborationService.sendPresenceUpdate).toHaveBeenCalledTimes(1)
    })

    expect(CollaborationService.sendPresenceUpdate).toHaveBeenCalledWith(
      mockAssetId,
      mockUserId,
      expect.objectContaining({
        cursor: { x: 102, y: 102 }, // Latest position
      })
    )
  })
})