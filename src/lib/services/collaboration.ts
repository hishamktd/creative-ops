import { createClient } from '@/lib/supabase/client'
import { AssetComment, AssetApproval, AssetLock, AssetPresence, NotificationEvent, ApprovalStatus, PresenceStatus } from '@/types'

export class CollaborationService {
  private supabase: any

  constructor(supabaseClient?: any) {
    this.supabase = supabaseClient || createClient()
  }

  // =====================================================
  // COMMENTS
  // =====================================================

  /**
   * Create a new comment on an asset
   */
  async createComment(params: {
    assetId: string
    versionId?: string
    parentId?: string
    content: string
    pinX?: number
    pinY?: number
    pinTimestamp?: number
  }): Promise<AssetComment> {
    const { data, error } = await this.supabase
      .from('asset_comments')
      .insert({
        asset_id: params.assetId,
        version_id: params.versionId,
        parent_id: params.parentId,
        content: params.content,
        pin_x: params.pinX,
        pin_y: params.pinY,
        pin_timestamp: params.pinTimestamp
      })
      .select(`
        *,
        user:users!user_id(full_name, avatar_url),
        replies:asset_comments!parent_id(
          *,
          user:users!user_id(full_name, avatar_url)
        )
      `)
      .single()

    if (error) {
      throw new Error(`Failed to create comment: ${error.message}`)
    }

    return this.formatComment(data)
  }

  /**
   * Get comments for an asset
   */
  async getComments(assetId: string, versionId?: string): Promise<AssetComment[]> {
    let query = this.supabase
      .from('asset_comments')
      .select(`
        *,
        user:users!user_id(full_name, avatar_url),
        replies:asset_comments!parent_id(
          *,
          user:users!user_id(full_name, avatar_url)
        )
      `)
      .eq('asset_id', assetId)
      .is('parent_id', null)
      .order('created_at', { ascending: true })

    if (versionId) {
      query = query.eq('version_id', versionId)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch comments: ${error.message}`)
    }

    return (data || []).map(comment => this.formatComment(comment))
  }

  /**
   * Update a comment
   */
  async updateComment(commentId: string, content: string): Promise<AssetComment> {
    const { data, error } = await this.supabase
      .from('asset_comments')
      .update({ content })
      .eq('id', commentId)
      .select(`
        *,
        user:users!user_id(full_name, avatar_url),
        replies:asset_comments!parent_id(
          *,
          user:users!user_id(full_name, avatar_url)
        )
      `)
      .single()

    if (error) {
      throw new Error(`Failed to update comment: ${error.message}`)
    }

    return this.formatComment(data)
  }

  /**
   * Resolve/unresolve a comment
   */
  async resolveComment(commentId: string, resolved: boolean): Promise<AssetComment> {
    const { data, error } = await this.supabase
      .from('asset_comments')
      .update({ 
        resolved,
        resolved_at: resolved ? new Date().toISOString() : null
      })
      .eq('id', commentId)
      .select(`
        *,
        user:users!user_id(full_name, avatar_url),
        replies:asset_comments!parent_id(
          *,
          user:users!user_id(full_name, avatar_url)
        )
      `)
      .single()

    if (error) {
      throw new Error(`Failed to resolve comment: ${error.message}`)
    }

    return this.formatComment(data)
  }

  /**
   * Delete a comment
   */
  async deleteComment(commentId: string): Promise<void> {
    const { error } = await this.supabase
      .from('asset_comments')
      .delete()
      .eq('id', commentId)

    if (error) {
      throw new Error(`Failed to delete comment: ${error.message}`)
    }
  }

  // =====================================================
  // APPROVALS
  // =====================================================

  /**
   * Request approval for an asset version
   */
  async requestApproval(params: {
    assetId: string
    versionId: string
    approverId: string
  }): Promise<AssetApproval> {
    const { data, error } = await this.supabase
      .from('asset_approvals')
      .insert({
        asset_id: params.assetId,
        version_id: params.versionId,
        approver_id: params.approverId
      })
      .select(`
        *,
        requester:users!requested_by(full_name),
        approver:users!approver_id(full_name)
      `)
      .single()

    if (error) {
      throw new Error(`Failed to request approval: ${error.message}`)
    }

    return this.formatApproval(data)
  }

  /**
   * Respond to an approval request
   */
  async respondToApproval(
    approvalId: string,
    status: ApprovalStatus,
    feedback?: string
  ): Promise<AssetApproval> {
    const updateData: any = { 
      status,
      feedback
    }

    if (status === 'approved') {
      updateData.approved_at = new Date().toISOString()
    }

    const { data, error } = await this.supabase
      .from('asset_approvals')
      .update(updateData)
      .eq('id', approvalId)
      .select(`
        *,
        requester:users!requested_by(full_name),
        approver:users!approver_id(full_name)
      `)
      .single()

    if (error) {
      throw new Error(`Failed to respond to approval: ${error.message}`)
    }

    return this.formatApproval(data)
  }

  /**
   * Get approvals for an asset
   */
  async getApprovals(assetId: string, versionId?: string): Promise<AssetApproval[]> {
    let query = this.supabase
      .from('asset_approvals')
      .select(`
        *,
        requester:users!requested_by(full_name),
        approver:users!approver_id(full_name)
      `)
      .eq('asset_id', assetId)
      .order('created_at', { ascending: false })

    if (versionId) {
      query = query.eq('version_id', versionId)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(`Failed to fetch approvals: ${error.message}`)
    }

    return (data || []).map(approval => this.formatApproval(approval))
  }

  // =====================================================
  // LOCKS
  // =====================================================

  /**
   * Acquire a lock on an asset
   */
  async acquireLock(
    assetId: string,
    lockType: string = 'edit',
    durationMinutes: number = 30
  ): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('acquire_asset_lock', {
      p_asset_id: assetId,
      p_lock_type: lockType,
      p_duration_minutes: durationMinutes
    })

    if (error) {
      throw new Error(`Failed to acquire lock: ${error.message}`)
    }

    return data
  }

  /**
   * Release a lock on an asset
   */
  async releaseLock(assetId: string, lockType: string = 'edit'): Promise<boolean> {
    const { data, error } = await this.supabase.rpc('release_asset_lock', {
      p_asset_id: assetId,
      p_lock_type: lockType
    })

    if (error) {
      throw new Error(`Failed to release lock: ${error.message}`)
    }

    return data
  }

  /**
   * Get active locks for an asset
   */
  async getActiveLocks(assetId: string): Promise<AssetLock[]> {
    const { data, error } = await this.supabase
      .from('asset_locks')
      .select(`
        *,
        locker:users!locked_by(full_name)
      `)
      .eq('asset_id', assetId)
      .gt('expires_at', new Date().toISOString())

    if (error) {
      throw new Error(`Failed to fetch locks: ${error.message}`)
    }

    return (data || []).map(lock => ({
      ...lock,
      locker_name: lock.locker?.full_name
    }))
  }

  // =====================================================
  // PRESENCE
  // =====================================================

  /**
   * Update user presence for an asset
   */
  async updatePresence(
    assetId: string,
    status: PresenceStatus = 'viewing',
    cursorPosition?: { x?: number; y?: number; viewport?: { x: number; y: number; zoom: number } }
  ): Promise<void> {
    const { error } = await this.supabase.rpc('update_asset_presence', {
      p_asset_id: assetId,
      p_status: status,
      p_cursor_position: cursorPosition
    })

    if (error) {
      throw new Error(`Failed to update presence: ${error.message}`)
    }
  }

  /**
   * Get active presence for an asset
   */
  async getActivePresence(assetId: string): Promise<AssetPresence[]> {
    const { data, error } = await this.supabase
      .from('asset_presence')
      .select(`
        *,
        user:users!user_id(full_name, avatar_url)
      `)
      .eq('asset_id', assetId)
      .gt('last_seen', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // Last 5 minutes

    if (error) {
      throw new Error(`Failed to fetch presence: ${error.message}`)
    }

    return (data || []).map(presence => ({
      ...presence,
      user_name: presence.user?.full_name,
      user_avatar: presence.user?.avatar_url
    }))
  }

  // =====================================================
  // NOTIFICATIONS
  // =====================================================

  /**
   * Get notifications for the current user
   */
  async getNotifications(limit: number = 50, offset: number = 0): Promise<NotificationEvent[]> {
    const { data, error } = await this.supabase
      .from('notification_events')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      throw new Error(`Failed to fetch notifications: ${error.message}`)
    }

    return data || []
  }

  /**
   * Mark notifications as read
   */
  async markNotificationsRead(notificationIds: string[]): Promise<void> {
    const { error } = await this.supabase
      .from('notification_events')
      .update({ read: true })
      .in('id', notificationIds)

    if (error) {
      throw new Error(`Failed to mark notifications as read: ${error.message}`)
    }
  }

  // =====================================================
  // SUBSCRIPTIONS
  // =====================================================

  /**
   * Subscribe to comments for an asset
   */
  subscribeToComments(assetId: string, callback: (comment: AssetComment) => void) {
    return this.supabase
      .channel(`asset_comments:${assetId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'asset_comments',
          filter: `asset_id=eq.${assetId}`
        },
        async (payload) => {
          try {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const { data } = await this.supabase
                .from('asset_comments')
                .select(`
                  *,
                  user:users!user_id(full_name, avatar_url),
                  replies:asset_comments!parent_id(
                    *,
                    user:users!user_id(full_name, avatar_url)
                  )
                `)
                .eq('id', payload.new.id)
                .single()

              if (data) {
                callback(this.formatComment(data))
              }
            }
          } catch (error) {
            console.error('Error in comment subscription:', error)
          }
        }
      )
      .subscribe()
  }

  /**
   * Subscribe to presence updates for an asset
   */
  subscribeToPresence(assetId: string, callback: (presence: AssetPresence[]) => void) {
    return this.supabase
      .channel(`asset_presence:${assetId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'asset_presence',
          filter: `asset_id=eq.${assetId}`
        },
        async () => {
          try {
            const presence = await this.getActivePresence(assetId)
            callback(presence)
          } catch (error) {
            console.error('Error in presence subscription:', error)
          }
        }
      )
      .subscribe()
  }

  /**
   * Subscribe to approval updates for an asset
   */
  subscribeToApprovals(assetId: string, callback: (approval: AssetApproval) => void) {
    return this.supabase
      .channel(`asset_approvals:${assetId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'asset_approvals',
          filter: `asset_id=eq.${assetId}`
        },
        async (payload) => {
          try {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const { data } = await this.supabase
                .from('asset_approvals')
                .select(`
                  *,
                  requester:users!requested_by(full_name),
                  approver:users!approver_id(full_name)
                `)
                .eq('id', payload.new.id)
                .single()

              if (data) {
                callback(this.formatApproval(data))
              }
            }
          } catch (error) {
            console.error('Error in approval subscription:', error)
          }
        }
      )
      .subscribe()
  }

  // =====================================================
  // HELPER METHODS
  // =====================================================

  private formatComment(data: any): AssetComment {
    return {
      ...data,
      user_name: data.user?.full_name,
      user_avatar: data.user?.avatar_url,
      replies: data.replies?.map((reply: any) => ({
        ...reply,
        user_name: reply.user?.full_name,
        user_avatar: reply.user?.avatar_url
      })) || []
    }
  }

  private formatApproval(data: any): AssetApproval {
    return {
      ...data,
      requester_name: data.requester?.full_name,
      approver_name: data.approver?.full_name
    }
  }
}

export const collaborationService = new CollaborationService()