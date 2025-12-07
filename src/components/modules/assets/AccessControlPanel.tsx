'use client'

import React, { useState, useEffect } from 'react'
import { SecurityService, type PermissionLevel, type AssetPermission } from '../../../lib/services/security'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'

interface AccessControlPanelProps {
  resourceId: string
  resourceType: 'asset' | 'folder'
  resourceName: string
  onPermissionChange?: () => void
}

interface UserOption {
  id: string
  full_name: string
  email: string
  avatar_url?: string
}

const PERMISSION_LEVELS: { value: PermissionLevel; label: string; description: string }[] = [
  { value: 'view', label: 'View', description: 'Can view and download the asset' },
  { value: 'comment', label: 'Comment', description: 'Can view and add comments' },
  { value: 'edit', label: 'Edit', description: 'Can view, comment, and edit metadata' },
  { value: 'admin', label: 'Admin', description: 'Full access including permission management' }
]

export function AccessControlPanel({ 
  resourceId, 
  resourceType, 
  resourceName,
  onPermissionChange 
}: AccessControlPanelProps) {
  const [permissions, setPermissions] = useState<AssetPermission[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showAddUser, setShowAddUser] = useState(false)
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedPermission, setSelectedPermission] = useState<PermissionLevel>('view')
  const [expiresAt, setExpiresAt] = useState('')

  useEffect(() => {
    loadPermissions()
    loadUsers()
  }, [resourceId])

  const loadPermissions = async () => {
    try {
      const data = await SecurityService.getResourcePermissions(resourceId, resourceType)
      setPermissions(data)
    } catch (error) {
      console.error('Failed to load permissions:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadUsers = async () => {
    try {
      // This would typically come from a user service
      // For now, we'll use a placeholder
      setUsers([])
    } catch (error) {
      console.error('Failed to load users:', error)
    }
  }

  const handleGrantPermission = async () => {
    if (!selectedUser) return

    setSaving(true)
    try {
      const result = await SecurityService.grantPermission(
        resourceId,
        selectedUser,
        selectedPermission,
        resourceType,
        expiresAt || undefined
      )

      if (result.success) {
        await loadPermissions()
        setShowAddUser(false)
        setSelectedUser('')
        setSelectedPermission('view')
        setExpiresAt('')
        onPermissionChange?.()
      } else {
        alert('Failed to grant permission: ' + result.error)
      }
    } catch (error) {
      console.error('Failed to grant permission:', error)
      alert('Failed to grant permission')
    } finally {
      setSaving(false)
    }
  }

  const handleRevokePermission = async (userId: string) => {
    if (!confirm('Are you sure you want to revoke this permission?')) return

    setSaving(true)
    try {
      const result = await SecurityService.revokePermission(resourceId, userId, resourceType)

      if (result.success) {
        await loadPermissions()
        onPermissionChange?.()
      } else {
        alert('Failed to revoke permission: ' + result.error)
      }
    } catch (error) {
      console.error('Failed to revoke permission:', error)
      alert('Failed to revoke permission')
    } finally {
      setSaving(false)
    }
  }

  const getPermissionBadgeColor = (level: PermissionLevel) => {
    switch (level) {
      case 'view': return 'bg-blue-100 text-blue-800'
      case 'comment': return 'bg-green-100 text-green-800'
      case 'edit': return 'bg-yellow-100 text-yellow-800'
      case 'admin': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const isExpired = (expiresAt?: string) => {
    return expiresAt && new Date(expiresAt) < new Date()
  }

  if (loading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-5/6"></div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Access Control</h3>
          <p className="text-sm text-gray-600">
            Manage who can access "{resourceName}"
          </p>
        </div>
        <Button
          onClick={() => setShowAddUser(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          Add User
        </Button>
      </div>

      {/* Add User Form */}
      {showAddUser && (
        <Card className="p-4 mb-6 bg-gray-50">
          <h4 className="font-medium text-gray-900 mb-4">Grant Access</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                User
              </label>
              <select
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a user...</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name} ({user.email})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Permission Level
              </label>
              <select
                value={selectedPermission}
                onChange={(e) => setSelectedPermission(e.target.value as PermissionLevel)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PERMISSION_LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expires At (Optional)
              </label>
              <input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm text-gray-600 mb-3">
              {PERMISSION_LEVELS.find(l => l.value === selectedPermission)?.description}
            </p>
            
            <div className="flex gap-2">
              <Button
                onClick={handleGrantPermission}
                disabled={!selectedUser || saving}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {saving ? 'Granting...' : 'Grant Access'}
              </Button>
              <Button
                onClick={() => setShowAddUser(false)}
                variant="outline"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Permissions List */}
      <div className="space-y-3">
        {permissions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            <p>No specific permissions set</p>
            <p className="text-sm">Project members have default access</p>
          </div>
        ) : (
          permissions.map((permission) => (
            <div
              key={permission.id}
              className={`flex items-center justify-between p-4 border rounded-lg ${
                isExpired(permission.expires_at) ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                  <span className="text-sm font-medium text-gray-700">
                    {permission.user?.full_name?.charAt(0) || '?'}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {permission.user?.full_name || 'Unknown User'}
                  </p>
                  <p className="text-sm text-gray-600">
                    {permission.user?.email}
                  </p>
                  {permission.expires_at && (
                    <p className={`text-xs ${isExpired(permission.expires_at) ? 'text-red-600' : 'text-gray-500'}`}>
                      {isExpired(permission.expires_at) ? 'Expired' : 'Expires'}: {' '}
                      {new Date(permission.expires_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPermissionBadgeColor(permission.permission_level)}`}>
                  {PERMISSION_LEVELS.find(l => l.value === permission.permission_level)?.label || permission.permission_level}
                </span>
                
                <Button
                  onClick={() => handleRevokePermission(permission.user_id)}
                  disabled={saving}
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  Revoke
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}