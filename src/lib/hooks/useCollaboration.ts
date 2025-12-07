import { useState, useEffect, useCallback, useRef } from 'react'
import { AssetComment, AssetApproval, AssetLock, AssetPresence, ApprovalStatus, PresenceStatus } from '@/types'
import { collaborationService } from '@/lib/services/collaboration'

export function useAssetComments(assetId: string, versionId?: string) {
  const [comments, setComments] = useState<AssetComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchComments = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await collaborationService.getComments(assetId, versionId)
      setComments(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch comments')
    } finally {
      setLoading(false)
    }
  }, [assetId, versionId])

  useEffect(() => {
    if (assetId) {
      fetchComments()
    }
  }, [assetId, versionId, fetchComments])

  const createComment = useCallback(async (params: {
    content: string
    parentId?: string
    pinX?: number
    pinY?: number
    pinTimestamp?: number
  }) => {
    try {
      const newComment = await collaborationService.createComment({
        assetId,
        versionId,
        ...params
      })
      
      if (params.parentId) {
        // Add reply to existing comment
        setComments(prev => prev.map(comment => 
          comment.id === params.parentId 
            ? { ...comment, replies: [...(comment.replies || []), newComment] }
            : comment
        ))
      } else {
        // Add new top-level comment
        setComments(prev => [...prev, newComment])
      }
      
      return newComment
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create comment')
    }
  }, [assetId, versionId])

  const updateComment = useCallback(async (commentId: string, content: string) => {
    try {
      const updatedComment = await collaborationService.updateComment(commentId, content)
      setComments(prev => prev.map(comment => 
        comment.id === commentId ? updatedComment : comment
      ))
      return updatedComment
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update comment')
    }
  }, [])

  const resolveComment = useCallback(async (commentId: string, resolved: boolean) => {
    try {
      const updatedComment = await collaborationService.resolveComment(commentId, resolved)
      setComments(prev => prev.map(comment => 
        comment.id === commentId ? updatedComment : comment
      ))
      return updatedComment
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to resolve comment')
    }
  }, [])

  const deleteComment = useCallback(async (commentId: string) => {
    try {
      await collaborationService.deleteComment(commentId)
      setComments(prev => prev.filter(comment => comment.id !== commentId))
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to delete comment')
    }
  }, [])

  // Subscribe to real-time comment updates
  useEffect(() => {
    if (!assetId) return

    const subscription = collaborationService.subscribeToComments(assetId, (comment) => {
      setComments(prev => {
        const exists = prev.find(c => c.id === comment.id)
        if (exists) {
          return prev.map(c => c.id === comment.id ? comment : c)
        }
        return [...prev, comment]
      })
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [assetId])

  return {
    comments,
    loading,
    error,
    refetch: fetchComments,
    createComment,
    updateComment,
    resolveComment,
    deleteComment
  }
}

export function useAssetApprovals(assetId: string, versionId?: string) {
  const [approvals, setApprovals] = useState<AssetApproval[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchApprovals = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await collaborationService.getApprovals(assetId, versionId)
      setApprovals(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch approvals')
    } finally {
      setLoading(false)
    }
  }, [assetId, versionId])

  useEffect(() => {
    if (assetId) {
      fetchApprovals()
    }
  }, [assetId, versionId, fetchApprovals])

  const requestApproval = useCallback(async (approverId: string, versionIdParam?: string) => {
    try {
      const approval = await collaborationService.requestApproval({
        assetId,
        versionId: versionIdParam || versionId || '',
        approverId
      })
      setApprovals(prev => [...prev, approval])
      return approval
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to request approval')
    }
  }, [assetId, versionId])

  const respondToApproval = useCallback(async (
    approvalId: string,
    status: ApprovalStatus,
    feedback?: string
  ) => {
    try {
      const approval = await collaborationService.respondToApproval(approvalId, status, feedback)
      setApprovals(prev => prev.map(a => a.id === approvalId ? approval : a))
      return approval
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to respond to approval')
    }
  }, [])

  // Subscribe to real-time approval updates
  useEffect(() => {
    if (!assetId) return

    const subscription = collaborationService.subscribeToApprovals(assetId, (approval) => {
      setApprovals(prev => {
        const exists = prev.find(a => a.id === approval.id)
        if (exists) {
          return prev.map(a => a.id === approval.id ? approval : a)
        }
        return [...prev, approval]
      })
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [assetId])

  return {
    approvals,
    loading,
    error,
    refetch: fetchApprovals,
    requestApproval,
    respondToApproval
  }
}

export function useAssetLocks(assetId: string) {
  const [locks, setLocks] = useState<AssetLock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLocks = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await collaborationService.getActiveLocks(assetId)
      setLocks(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch locks')
    } finally {
      setLoading(false)
    }
  }, [assetId])

  useEffect(() => {
    if (assetId) {
      fetchLocks()
    }
  }, [assetId, fetchLocks])

  const acquireLock = useCallback(async (lockType: string = 'edit', durationMinutes: number = 30) => {
    try {
      const success = await collaborationService.acquireLock(assetId, lockType, durationMinutes)
      if (success) {
        await fetchLocks() // Refresh locks
      }
      return success
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to acquire lock')
    }
  }, [assetId, fetchLocks])

  const releaseLock = useCallback(async (lockType: string = 'edit') => {
    try {
      const success = await collaborationService.releaseLock(assetId, lockType)
      if (success) {
        await fetchLocks() // Refresh locks
      }
      return success
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to release lock')
    }
  }, [assetId, fetchLocks])

  return {
    locks,
    loading,
    error,
    refetch: fetchLocks,
    acquireLock,
    releaseLock
  }
}

export function useAssetPresence(assetId: string) {
  const [presence, setPresence] = useState<AssetPresence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const presenceUpdateRef = useRef<NodeJS.Timeout>()

  const fetchPresence = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await collaborationService.getActivePresence(assetId)
      setPresence(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch presence')
    } finally {
      setLoading(false)
    }
  }, [assetId])

  useEffect(() => {
    if (assetId) {
      fetchPresence()
    }
  }, [assetId, fetchPresence])

  const updatePresence = useCallback(async (
    status: PresenceStatus = 'viewing',
    cursorPosition?: { x?: number; y?: number; viewport?: { x: number; y: number; zoom: number } }
  ) => {
    try {
      await collaborationService.updatePresence(assetId, status, cursorPosition)
    } catch (err) {
      console.error('Failed to update presence:', err)
    }
  }, [assetId])

  // Auto-update presence every 30 seconds
  useEffect(() => {
    if (!assetId) return

    const updateInterval = setInterval(() => {
      updatePresence('viewing')
    }, 30000)

    return () => {
      clearInterval(updateInterval)
    }
  }, [assetId, updatePresence])

  // Subscribe to real-time presence updates
  useEffect(() => {
    if (!assetId) return

    const subscription = collaborationService.subscribeToPresence(assetId, (presenceData) => {
      setPresence(presenceData)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [assetId])

  // Update presence when component mounts/unmounts
  useEffect(() => {
    if (assetId) {
      updatePresence('viewing')
    }

    return () => {
      if (assetId) {
        updatePresence('idle')
      }
    }
  }, [assetId, updatePresence])

  return {
    presence,
    loading,
    error,
    refetch: fetchPresence,
    updatePresence
  }
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  const fetchNotifications = useCallback(async (limit: number = 50, offset: number = 0) => {
    try {
      setLoading(true)
      setError(null)
      const data = await collaborationService.getNotifications(limit, offset)
      setNotifications(data)
      setUnreadCount(data.filter(n => !n.read).length)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  const markAsRead = useCallback(async (notificationIds: string[]) => {
    try {
      await collaborationService.markNotificationsRead(notificationIds)
      setNotifications(prev => prev.map(n => 
        notificationIds.includes(n.id) ? { ...n, read: true } : n
      ))
      setUnreadCount(prev => Math.max(0, prev - notificationIds.length))
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to mark notifications as read')
    }
  }, [])

  return {
    notifications,
    loading,
    error,
    unreadCount,
    refetch: fetchNotifications,
    markAsRead
  }
}