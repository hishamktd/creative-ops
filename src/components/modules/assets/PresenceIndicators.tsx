'use client'

import React, { useEffect } from 'react'
import { AssetPresence, PresenceStatus } from '@/types'
import { useAssetPresence } from '@/lib/hooks/useCollaboration'
import { formatTimeAgo } from '@/lib/utils/format'

interface PresenceIndicatorsProps {
  assetId: string
  currentUserId?: string
  onPresenceUpdate?: (status: PresenceStatus, position?: any) => void
}

export function PresenceIndicators({ 
  assetId, 
  currentUserId,
  onPresenceUpdate 
}: PresenceIndicatorsProps) {
  const { presence, updatePresence } = useAssetPresence(assetId)

  // Filter out current user from presence list
  const otherUsers = presence.filter(p => p.user_id !== currentUserId)

  // Update presence when component mounts
  useEffect(() => {
    updatePresence('viewing')
    
    // Update presence when user becomes active/inactive
    const handleVisibilityChange = () => {
      if (document.hidden) {
        updatePresence('idle')
      } else {
        updatePresence('viewing')
      }
    }

    const handleBeforeUnload = () => {
      updatePresence('idle')
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      updatePresence('idle')
    }
  }, [assetId, updatePresence])

  // Notify parent component of presence updates
  useEffect(() => {
    if (onPresenceUpdate) {
      onPresenceUpdate('viewing')
    }
  }, [onPresenceUpdate])

  if (otherUsers.length === 0) {
    return null
  }

  return (
    <div className="flex items-center gap-2">
      {/* Presence Avatars */}
      <div className="flex -space-x-2">
        {otherUsers.slice(0, 5).map((user) => (
          <PresenceAvatar key={user.user_id} presence={user} />
        ))}
      </div>

      {/* Overflow Count */}
      {otherUsers.length > 5 && (
        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center border-2 border-white">
          <span className="text-xs font-medium text-gray-600">
            +{otherUsers.length - 5}
          </span>
        </div>
      )}

      {/* Presence Summary */}
      <div className="text-sm text-gray-600">
        {otherUsers.length === 1 ? (
          <span>{otherUsers[0].user_name} is {getStatusText(otherUsers[0].status)}</span>
        ) : (
          <span>{otherUsers.length} people viewing</span>
        )}
      </div>
    </div>
  )
}

interface PresenceAvatarProps {
  presence: AssetPresence
}

function PresenceAvatar({ presence }: PresenceAvatarProps) {
  const statusColor = getStatusColor(presence.status)
  const isRecent = new Date(presence.last_seen).getTime() > Date.now() - 60000 // Last minute

  return (
    <div className="relative group">
      {presence.user_avatar ? (
        <img
          src={presence.user_avatar}
          alt={presence.user_name || 'User'}
          className="w-8 h-8 rounded-full border-2 border-white shadow-sm"
        />
      ) : (
        <div className="w-8 h-8 bg-gray-300 rounded-full border-2 border-white shadow-sm flex items-center justify-center">
          <span className="text-xs font-medium text-gray-600">
            {(presence.user_name || 'U')[0].toUpperCase()}
          </span>
        </div>
      )}
      
      {/* Status Indicator */}
      <div className={`
        absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white
        ${statusColor}
        ${isRecent ? 'animate-pulse' : ''}
      `} />

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
        <div className="font-medium">{presence.user_name || 'Unknown User'}</div>
        <div className="text-gray-300">
          {getStatusText(presence.status)} • {formatTimeAgo(presence.last_seen)}
        </div>
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </div>
    </div>
  )
}

interface PresenceCursorsProps {
  assetId: string
  containerRef: React.RefObject<HTMLElement>
  currentUserId?: string
}

export function PresenceCursors({ 
  assetId, 
  containerRef, 
  currentUserId 
}: PresenceCursorsProps) {
  const { presence, updatePresence } = useAssetPresence(assetId)

  // Filter out current user and users without cursor positions
  const cursors = presence.filter(p => 
    p.user_id !== currentUserId && 
    p.cursor_position?.x !== undefined && 
    p.cursor_position?.y !== undefined
  )

  // Update cursor position on mouse move
  useEffect(() => {
    if (!containerRef.current) return

    const handleMouseMove = (e: MouseEvent) => {
      const rect = containerRef.current!.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100

      updatePresence('viewing', { x, y })
    }

    const container = containerRef.current
    container.addEventListener('mousemove', handleMouseMove)

    return () => {
      container.removeEventListener('mousemove', handleMouseMove)
    }
  }, [containerRef, updatePresence])

  if (cursors.length === 0) {
    return null
  }

  return (
    <>
      {cursors.map((user) => (
        <PresenceCursor key={user.user_id} presence={user} />
      ))}
    </>
  )
}

interface PresenceCursorProps {
  presence: AssetPresence
}

function PresenceCursor({ presence }: PresenceCursorProps) {
  if (!presence.cursor_position?.x || !presence.cursor_position?.y) {
    return null
  }

  const { x, y } = presence.cursor_position
  const isRecent = new Date(presence.last_seen).getTime() > Date.now() - 10000 // Last 10 seconds

  if (!isRecent) {
    return null
  }

  return (
    <div
      className="absolute pointer-events-none z-50 transition-all duration-100"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        transform: 'translate(-50%, -50%)'
      }}
    >
      {/* Cursor */}
      <div className="relative">
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          className="drop-shadow-lg"
        >
          <path
            d="M2 2L18 8L8 12L2 18L2 2Z"
            fill="#3B82F6"
            stroke="white"
            strokeWidth="1"
          />
        </svg>
        
        {/* User Label */}
        <div className="absolute top-5 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded whitespace-nowrap shadow-lg">
          {presence.user_name || 'Unknown User'}
        </div>
      </div>
    </div>
  )
}

function getStatusColor(status: PresenceStatus) {
  switch (status) {
    case 'viewing':
      return 'bg-green-400'
    case 'editing':
      return 'bg-blue-400'
    case 'idle':
      return 'bg-yellow-400'
    default:
      return 'bg-gray-400'
  }
}

function getStatusText(status: PresenceStatus) {
  switch (status) {
    case 'viewing':
      return 'viewing'
    case 'editing':
      return 'editing'
    case 'idle':
      return 'idle'
    default:
      return 'unknown'
  }
}