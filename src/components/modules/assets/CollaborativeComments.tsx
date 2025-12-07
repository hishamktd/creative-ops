'use client'

import React, { useState, useRef, useEffect } from 'react'
import { AssetComment } from '@/types'
import { useAssetComments } from '@/lib/hooks/useCollaboration'
import { formatTimeAgo } from '@/lib/utils/format'

interface CollaborativeCommentsProps {
  assetId: string
  versionId?: string
  allowPinning?: boolean
  onPinComment?: (x: number, y: number) => void
}

export function CollaborativeComments({ 
  assetId, 
  versionId, 
  allowPinning = false,
  onPinComment 
}: CollaborativeCommentsProps) {
  const { 
    comments, 
    loading, 
    error, 
    createComment, 
    updateComment, 
    resolveComment, 
    deleteComment 
  } = useAssetComments(assetId, versionId)
  
  const [newComment, setNewComment] = useState('')
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [editingComment, setEditingComment] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmitComment = async (parentId?: string) => {
    const content = parentId ? editContent : newComment
    if (!content.trim()) return

    try {
      setSubmitting(true)
      await createComment({
        content: content.trim(),
        parentId
      })
      
      if (parentId) {
        setReplyingTo(null)
        setEditContent('')
      } else {
        setNewComment('')
      }
    } catch (error) {
      console.error('Failed to create comment:', error)
      alert('Failed to create comment. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateComment = async (commentId: string) => {
    if (!editContent.trim()) return

    try {
      setSubmitting(true)
      await updateComment(commentId, editContent.trim())
      setEditingComment(null)
      setEditContent('')
    } catch (error) {
      console.error('Failed to update comment:', error)
      alert('Failed to update comment. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleResolveComment = async (commentId: string, resolved: boolean) => {
    try {
      await resolveComment(commentId, resolved)
    } catch (error) {
      console.error('Failed to resolve comment:', error)
      alert('Failed to resolve comment. Please try again.')
    }
  }

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return

    try {
      await deleteComment(commentId)
    } catch (error) {
      console.error('Failed to delete comment:', error)
      alert('Failed to delete comment. Please try again.')
    }
  }

  const startEditing = (comment: AssetComment) => {
    setEditingComment(comment.id)
    setEditContent(comment.content)
  }

  const cancelEditing = () => {
    setEditingComment(null)
    setEditContent('')
  }

  const startReplying = (commentId: string) => {
    setReplyingTo(commentId)
    setEditContent('')
  }

  const cancelReplying = () => {
    setReplyingTo(null)
    setEditContent('')
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [newComment, editContent])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-800">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* New Comment Form */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Add a comment
        </label>
        <textarea
          ref={textareaRef}
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Share your thoughts..."
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[80px]"
          rows={3}
        />
        <div className="flex justify-end">
          <button
            onClick={() => handleSubmitComment()}
            disabled={!newComment.trim() || submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Posting...' : 'Post Comment'}
          </button>
        </div>
      </div>

      {/* Comments List */}
      <div className="space-y-4">
        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            isEditing={editingComment === comment.id}
            isReplying={replyingTo === comment.id}
            editContent={editContent}
            submitting={submitting}
            onEdit={startEditing}
            onCancelEdit={cancelEditing}
            onUpdateComment={handleUpdateComment}
            onReply={startReplying}
            onCancelReply={cancelReplying}
            onSubmitReply={handleSubmitComment}
            onResolve={handleResolveComment}
            onDelete={handleDeleteComment}
            onEditContentChange={setEditContent}
          />
        ))}
      </div>

      {comments.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No comments yet. Be the first to share your thoughts!</p>
        </div>
      )}
    </div>
  )
}

interface CommentItemProps {
  comment: AssetComment
  isEditing: boolean
  isReplying: boolean
  editContent: string
  submitting: boolean
  onEdit: (comment: AssetComment) => void
  onCancelEdit: () => void
  onUpdateComment: (commentId: string) => void
  onReply: (commentId: string) => void
  onCancelReply: () => void
  onSubmitReply: (parentId: string) => void
  onResolve: (commentId: string, resolved: boolean) => void
  onDelete: (commentId: string) => void
  onEditContentChange: (content: string) => void
}

function CommentItem({
  comment,
  isEditing,
  isReplying,
  editContent,
  submitting,
  onEdit,
  onCancelEdit,
  onUpdateComment,
  onReply,
  onCancelReply,
  onSubmitReply,
  onResolve,
  onDelete,
  onEditContentChange
}: CommentItemProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px'
    }
  }, [editContent])

  return (
    <div className={`
      border rounded-lg p-4 transition-all
      ${comment.resolved ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}
    `}>
      {/* Comment Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          {comment.user_avatar ? (
            <img
              src={comment.user_avatar}
              alt={comment.user_name || 'User'}
              className="w-8 h-8 rounded-full"
            />
          ) : (
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
              <span className="text-sm font-medium text-gray-600">
                {(comment.user_name || 'U')[0].toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-900">
              {comment.user_name || 'Unknown User'}
            </p>
            <p className="text-xs text-gray-500">
              {formatTimeAgo(comment.created_at)}
              {comment.updated_at !== comment.created_at && ' (edited)'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {comment.resolved && (
            <span className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 rounded-full">
              Resolved
            </span>
          )}
          
          {/* Pin indicator */}
          {(comment.pin_x !== null || comment.pin_timestamp !== null) && (
            <span className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
              📍 Pinned
            </span>
          )}
        </div>
      </div>

      {/* Comment Content */}
      {isEditing ? (
        <div className="space-y-3">
          <textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => onEditContentChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[60px]"
            rows={2}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancelEdit}
              className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={() => onUpdateComment(comment.id)}
              disabled={!editContent.trim() || submitting}
              className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mb-3">
          <p className="text-gray-900 whitespace-pre-wrap">{comment.content}</p>
        </div>
      )}

      {/* Comment Actions */}
      {!isEditing && (
        <div className="flex items-center gap-4 text-sm">
          <button
            onClick={() => onReply(comment.id)}
            className="text-gray-600 hover:text-gray-900 font-medium"
          >
            Reply
          </button>
          
          <button
            onClick={() => onEdit(comment)}
            className="text-gray-600 hover:text-gray-900 font-medium"
          >
            Edit
          </button>
          
          <button
            onClick={() => onResolve(comment.id, !comment.resolved)}
            className={`font-medium ${
              comment.resolved 
                ? 'text-yellow-600 hover:text-yellow-700' 
                : 'text-green-600 hover:text-green-700'
            }`}
          >
            {comment.resolved ? 'Unresolve' : 'Resolve'}
          </button>
          
          <button
            onClick={() => onDelete(comment.id)}
            className="text-red-600 hover:text-red-700 font-medium"
          >
            Delete
          </button>
        </div>
      )}

      {/* Reply Form */}
      {isReplying && (
        <div className="mt-4 pl-8 space-y-3">
          <textarea
            value={editContent}
            onChange={(e) => onEditContentChange(e.target.value)}
            placeholder="Write a reply..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none min-h-[60px]"
            rows={2}
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancelReply}
              className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={() => onSubmitReply(comment.id)}
              disabled={!editContent.trim() || submitting}
              className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Posting...' : 'Reply'}
            </button>
          </div>
        </div>
      )}

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-4 pl-8 space-y-3 border-l-2 border-gray-200">
          {comment.replies.map((reply) => (
            <div key={reply.id} className="bg-gray-50 rounded-lg p-3">
              <div className="flex items-start gap-3 mb-2">
                {reply.user_avatar ? (
                  <img
                    src={reply.user_avatar}
                    alt={reply.user_name || 'User'}
                    className="w-6 h-6 rounded-full"
                  />
                ) : (
                  <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-gray-600">
                      {(reply.user_name || 'U')[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-medium text-gray-900">
                      {reply.user_name || 'Unknown User'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatTimeAgo(reply.created_at)}
                    </p>
                  </div>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{reply.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}