'use client'

import React, { useState } from 'react'
import { AssetApproval, ApprovalStatus } from '@/types'
import { useAssetApprovals } from '@/lib/hooks/useCollaboration'
import { formatTimeAgo } from '@/lib/utils/format'

interface ApprovalWorkflowProps {
  assetId: string
  versionId?: string
  availableApprovers?: Array<{ id: string; name: string; avatar?: string }>
  currentUserId?: string
}

export function ApprovalWorkflow({ 
  assetId, 
  versionId, 
  availableApprovers = [],
  currentUserId 
}: ApprovalWorkflowProps) {
  const { 
    approvals, 
    loading, 
    error, 
    requestApproval, 
    respondToApproval 
  } = useAssetApprovals(assetId, versionId)
  
  const [selectedApprover, setSelectedApprover] = useState('')
  const [requestingApproval, setRequestingApproval] = useState(false)
  const [respondingTo, setRespondingTo] = useState<string | null>(null)
  const [feedback, setFeedback] = useState('')

  const handleRequestApproval = async () => {
    if (!selectedApprover) return

    try {
      setRequestingApproval(true)
      await requestApproval(selectedApprover, versionId)
      setSelectedApprover('')
    } catch (error) {
      console.error('Failed to request approval:', error)
      alert('Failed to request approval. Please try again.')
    } finally {
      setRequestingApproval(false)
    }
  }

  const handleRespondToApproval = async (
    approvalId: string, 
    status: ApprovalStatus
  ) => {
    try {
      await respondToApproval(approvalId, status, feedback)
      setRespondingTo(null)
      setFeedback('')
    } catch (error) {
      console.error('Failed to respond to approval:', error)
      alert('Failed to respond to approval. Please try again.')
    }
  }

  const getStatusColor = (status: ApprovalStatus) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'changes_requested':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusIcon = (status: ApprovalStatus) => {
    switch (status) {
      case 'approved':
        return '✅'
      case 'rejected':
        return '❌'
      case 'changes_requested':
        return '🔄'
      default:
        return '⏳'
    }
  }

  const canRequestApproval = availableApprovers.length > 0
  const pendingApprovals = approvals.filter(a => a.status === 'pending')
  const completedApprovals = approvals.filter(a => a.status !== 'pending')

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
      {/* Request New Approval */}
      {canRequestApproval && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Request Approval
          </h4>
          <div className="flex gap-3">
            <select
              value={selectedApprover}
              onChange={(e) => setSelectedApprover(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select an approver...</option>
              {availableApprovers.map((approver) => (
                <option key={approver.id} value={approver.id}>
                  {approver.name}
                </option>
              ))}
            </select>
            <button
              onClick={handleRequestApproval}
              disabled={!selectedApprover || requestingApproval}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {requestingApproval ? 'Requesting...' : 'Request'}
            </button>
          </div>
        </div>
      )}

      {/* Pending Approvals */}
      {pendingApprovals.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Pending Approvals ({pendingApprovals.length})
          </h4>
          <div className="space-y-3">
            {pendingApprovals.map((approval) => (
              <ApprovalItem
                key={approval.id}
                approval={approval}
                currentUserId={currentUserId}
                isResponding={respondingTo === approval.id}
                feedback={feedback}
                onStartResponding={() => setRespondingTo(approval.id)}
                onCancelResponding={() => {
                  setRespondingTo(null)
                  setFeedback('')
                }}
                onFeedbackChange={setFeedback}
                onRespond={handleRespondToApproval}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed Approvals */}
      {completedApprovals.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Approval History ({completedApprovals.length})
          </h4>
          <div className="space-y-3">
            {completedApprovals.map((approval) => (
              <ApprovalItem
                key={approval.id}
                approval={approval}
                currentUserId={currentUserId}
                isResponding={false}
                feedback=""
                onStartResponding={() => {}}
                onCancelResponding={() => {}}
                onFeedbackChange={() => {}}
                onRespond={() => {}}
              />
            ))}
          </div>
        </div>
      )}

      {approvals.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No approvals requested yet</p>
          {canRequestApproval && (
            <p className="text-sm mt-1">Request approval from team members above</p>
          )}
        </div>
      )}
    </div>
  )
}

interface ApprovalItemProps {
  approval: AssetApproval
  currentUserId?: string
  isResponding: boolean
  feedback: string
  onStartResponding: () => void
  onCancelResponding: () => void
  onFeedbackChange: (feedback: string) => void
  onRespond: (approvalId: string, status: ApprovalStatus) => void
}

function ApprovalItem({
  approval,
  currentUserId,
  isResponding,
  feedback,
  onStartResponding,
  onCancelResponding,
  onFeedbackChange,
  onRespond
}: ApprovalItemProps) {
  const canRespond = currentUserId === approval.approver_id && approval.status === 'pending'
  const statusColor = getStatusColor(approval.status)
  const statusIcon = getStatusIcon(approval.status)

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${statusColor}`}>
              {statusIcon} {approval.status.replace('_', ' ').toUpperCase()}
            </span>
            <span className="text-sm text-gray-600">
              Requested {formatTimeAgo(approval.created_at)}
            </span>
          </div>
          
          <div className="text-sm text-gray-900">
            <span className="font-medium">Requested by:</span> {approval.requester_name}
          </div>
          <div className="text-sm text-gray-900">
            <span className="font-medium">Approver:</span> {approval.approver_name}
          </div>
          
          {approval.approved_at && (
            <div className="text-sm text-gray-600 mt-1">
              Responded {formatTimeAgo(approval.approved_at)}
            </div>
          )}
        </div>
      </div>

      {/* Feedback */}
      {approval.feedback && (
        <div className="mb-3 p-3 bg-gray-50 rounded-md">
          <p className="text-sm font-medium text-gray-700 mb-1">Feedback:</p>
          <p className="text-sm text-gray-900">{approval.feedback}</p>
        </div>
      )}

      {/* Response Actions */}
      {canRespond && !isResponding && (
        <div className="flex gap-2">
          <button
            onClick={onStartResponding}
            className="px-3 py-1 text-sm font-medium text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200"
          >
            Respond
          </button>
        </div>
      )}

      {/* Response Form */}
      {isResponding && (
        <div className="space-y-3 pt-3 border-t border-gray-200">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Feedback (optional)
            </label>
            <textarea
              value={feedback}
              onChange={(e) => onFeedbackChange(e.target.value)}
              placeholder="Add your feedback..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancelResponding}
              className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              onClick={() => onRespond(approval.id, 'changes_requested')}
              className="px-3 py-1 text-sm font-medium text-yellow-700 bg-yellow-100 rounded-md hover:bg-yellow-200"
            >
              Request Changes
            </button>
            <button
              onClick={() => onRespond(approval.id, 'rejected')}
              className="px-3 py-1 text-sm font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200"
            >
              Reject
            </button>
            <button
              onClick={() => onRespond(approval.id, 'approved')}
              className="px-3 py-1 text-sm font-medium text-green-700 bg-green-100 rounded-md hover:bg-green-200"
            >
              Approve
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function getStatusColor(status: ApprovalStatus) {
  switch (status) {
    case 'approved':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'rejected':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'changes_requested':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

function getStatusIcon(status: ApprovalStatus) {
  switch (status) {
    case 'approved':
      return '✅'
    case 'rejected':
      return '❌'
    case 'changes_requested':
      return '🔄'
    default:
      return '⏳'
  }
}