'use client'

import { useState, useEffect } from 'react'
import { X, Users, Shield, Eye, Edit3, Trash2, Crown } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase/client'
import { Folder, AssetPermission, PermissionLevel } from '@/types'

interface FolderPermissionsModalProps {
  isOpen: boolean
  folder: Folder
  onClose: () => void
}

interface UserWithPermission {
  id: string
  full_name: string
  email: string
  avatar_url?: string
  permission_level: PermissionLevel
  granted_by?: string
  granted_by_user?: {
    id: string
    full_name: string
  }
  expires_at?: string
  created_at: string
}

const PERMISSION_LEVELS: { value: PermissionLevel; label: string; icon: any; description: string }[] = [
  { value: 'view', label: 'View Only', icon: Eye, description: 'Can view folder contents' },
  { value: 'comment', label: 'Comment', icon: Edit3, description: 'Can view and comment on assets' },
  { value: 'edit', label: 'Edit', icon: Edit3, description: 'Can upload, edit, and organize assets' },
  { value: 'admin', label: 'Admin', icon: Crown, description: 'Full control including permissions' }
]

export function FolderPermissionsModal({
  isOpen,
  folder,
  onClose
}: FolderPermissionsModalProps) {
  const { user } = useAuth()
  const [permissions, setPermissions] = useState<UserWithPermission[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddUser, setShowAddUser] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [selectedPermissionLevel, setSelectedPermissionLevel] = useState<PermissionLevel>('view')
  const [inheritFromParent, setInheritFromParent] = useState(true)

  useEffect(() => {
    if (isOpen) {
      fetchPermissions()
    }
  }, [isOpen, folder.id])

  const fetchPermissions = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('asset_permissions')
        .select(`
          *,
          user:users!user_id(id, full_name, email, avatar_url),
          granted_by_user:users!granted_by(id, full_name)
        `)
        .eq('folder_id', folder.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const formattedPermissions: UserWithPermission[] = (data || []).map((perm: any) => ({
        id: perm.user.id,
        full_name: perm.user.full_name,
        email: perm.user.email,
        avatar_url: perm.user.avatar_url,
        permission_level: perm.permission_level,
        granted_by: perm.granted_by,
        granted_by_user: perm.granted_by_user,
        expires_at: perm.expires_at,
        created_at: perm.created_at
      }))

      setPermissions(formattedPermissions)
    } catch (error) {
      console.error('Error fetching permissions:', error)
    } finally {
      setLoading(false)
    }
  }

  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, avatar_url')
        .or(`full_name.ilike.%${query}%,email.ilike.%${query}%`)
        .limit(10)

      if (error) throw error

      // Filter out users who already have permissions
      const existingUserIds = permissions.map(p => p.id)
      const filteredResults = (data || []).filter(user => !existingUserIds.includes(user.id))
      
      setSearchResults(filteredResults)
    } catch (error) {
      console.error('Error searching users:', error)
    }
  }

  const addUserPermission = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('asset_permissions')
        .insert({
          folder_id: folder.id,
          user_id: userId,
          permission_level: selectedPermissionLevel,
          granted_by: user?.id
        })

      if (error) throw error

      await fetchPermissions()
      setShowAddUser(false)
      setSearchQuery('')
      setSearchResults([])
    } catch (error) {
      console.error('Error adding user permission:', error)
    }
  }

  const updatePermission = async (userId: string, newLevel: PermissionLevel) => {
    try {
      const { error } = await supabase
        .from('asset_permissions')
        .update({ permission_level: newLevel })
        .eq('folder_id', folder.id)
        .eq('user_id', userId)

      if (error) throw error

      await fetchPermissions()
    } catch (error) {
      console.error('Error updating permission:', error)
    }
  }

  const removePermission = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this user\'s access?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('asset_permissions')
        .delete()
        .eq('folder_id', folder.id)
        .eq('user_id', userId)

      if (error) throw error

      await fetchPermissions()
    } catch (error) {
      console.error('Error removing permission:', error)
    }
  }

  const getPermissionIcon = (level: PermissionLevel) => {
    const permission = PERMISSION_LEVELS.find(p => p.value === level)
    return permission?.icon || Eye
  }

  const getPermissionColor = (level: PermissionLevel) => {
    switch (level) {
      case 'view': return 'text-blue-600'
      case 'comment': return 'text-green-600'
      case 'edit': return 'text-orange-600'
      case 'admin': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose}></div>

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-surface-light dark:bg-surface-dark rounded-xl shadow-xl z-50 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="size-8 bg-primary/20 rounded-lg flex items-center justify-center">
              <Shield size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-text-light-primary dark:text-dark-primary">
                Folder Permissions
              </h2>
              <p className="text-sm text-text-light-secondary dark:text-dark-secondary">
                {folder.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Inheritance Setting */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <input
                type="checkbox"
                id="inheritFromParent"
                checked={inheritFromParent}
                onChange={(e) => setInheritFromParent(e.target.checked)}
                className="rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="inheritFromParent" className="text-sm font-medium text-text-light-primary dark:text-dark-primary">
                Inherit permissions from parent folder
              </label>
            </div>
            <p className="text-xs text-text-light-secondary dark:text-dark-secondary ml-6">
              When enabled, users with access to the parent folder will automatically have access to this folder
            </p>
          </div>

          {/* Add User Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-text-light-primary dark:text-dark-primary">
                User Permissions
              </h3>
              <Button
                onClick={() => setShowAddUser(!showAddUser)}
                size="sm"
                className="bg-primary hover:opacity-90"
              >
                <Users size={16} />
                Add User
              </Button>
            </div>

            {/* Add User Form */}
            {showAddUser && (
              <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-text-light-primary dark:text-dark-primary mb-2">
                      Search Users
                    </label>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value)
                        searchUsers(e.target.value)
                      }}
                      placeholder="Search by name or email..."
                      className="w-full px-4 py-2 bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-light-primary dark:text-dark-primary mb-2">
                      Permission Level
                    </label>
                    <select
                      value={selectedPermissionLevel}
                      onChange={(e) => setSelectedPermissionLevel(e.target.value as PermissionLevel)}
                      className="w-full px-4 py-2 bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    >
                      {PERMISSION_LEVELS.map((level) => (
                        <option key={level.value} value={level.value}>
                          {level.label} - {level.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Search Results */}
                  {searchResults.length > 0 && (
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-text-light-primary dark:text-dark-primary">
                        Select User
                      </label>
                      {searchResults.map((searchUser) => (
                        <button
                          key={searchUser.id}
                          onClick={() => addUserPermission(searchUser.id)}
                          className="w-full flex items-center gap-3 p-3 bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition"
                        >
                          <div className="size-8 bg-primary/20 rounded-full flex items-center justify-center">
                            {searchUser.avatar_url ? (
                              <img
                                src={searchUser.avatar_url}
                                alt={searchUser.full_name}
                                className="size-8 rounded-full object-cover"
                              />
                            ) : (
                              <span className="text-primary font-medium text-sm">
                                {searchUser.full_name.charAt(0).toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 text-left">
                            <p className="font-medium text-text-light-primary dark:text-dark-primary">
                              {searchUser.full_name}
                            </p>
                            <p className="text-sm text-text-light-secondary dark:text-dark-secondary">
                              {searchUser.email}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Current Permissions */}
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-8 text-gray-500">
                Loading permissions...
              </div>
            ) : permissions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No specific permissions set. {inheritFromParent ? 'Using parent folder permissions.' : 'Folder is private.'}
              </div>
            ) : (
              permissions.map((permission) => {
                const PermissionIcon = getPermissionIcon(permission.permission_level)
                return (
                  <div
                    key={permission.id}
                    className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="size-10 bg-primary/20 rounded-full flex items-center justify-center">
                        {permission.avatar_url ? (
                          <img
                            src={permission.avatar_url}
                            alt={permission.full_name}
                            className="size-10 rounded-full object-cover"
                          />
                        ) : (
                          <span className="text-primary font-medium">
                            {permission.full_name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-text-light-primary dark:text-dark-primary">
                          {permission.full_name}
                        </p>
                        <p className="text-sm text-text-light-secondary dark:text-dark-secondary">
                          {permission.email}
                        </p>
                        {permission.granted_by_user && (
                          <p className="text-xs text-text-light-secondary dark:text-dark-secondary">
                            Added by {permission.granted_by_user.full_name}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className={`flex items-center gap-2 ${getPermissionColor(permission.permission_level)}`}>
                        <PermissionIcon size={16} />
                        <span className="text-sm font-medium">
                          {PERMISSION_LEVELS.find(p => p.value === permission.permission_level)?.label}
                        </span>
                      </div>

                      <select
                        value={permission.permission_level}
                        onChange={(e) => updatePermission(permission.id, e.target.value as PermissionLevel)}
                        className="px-3 py-1 text-sm bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                      >
                        {PERMISSION_LEVELS.map((level) => (
                          <option key={level.value} value={level.value}>
                            {level.label}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => removePermission(permission.id)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-800">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </>
  )
}