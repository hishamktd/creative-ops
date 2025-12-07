'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  FolderOpen, 
  FolderPlus, 
  MoreHorizontal, 
  Edit3, 
  Trash2, 
  Share2, 
  Users, 
  BarChart3,
  Search,
  ChevronRight,
  ChevronDown,
  Folder
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/hooks/useAuth'
import { Folder as FolderType } from '@/types'
import { supabase } from '@/lib/supabase/client'
import { FolderCreateModal } from './FolderCreateModal'
import { FolderPermissionsModal } from './FolderPermissionsModal'
import { FolderStatsModal } from './FolderStatsModal'
import { FolderTemplateModal } from './FolderTemplateModal'

interface FolderManagerProps {
  projectId?: string
  currentFolderId?: string | null
  onFolderSelect: (folderId: string | null) => void
  onFolderChange?: () => void
  className?: string
}

interface FolderWithStats extends FolderType {
  asset_count: number
  subfolder_count: number
  total_size: number
  last_activity: string
  children?: FolderWithStats[]
  expanded?: boolean
}

export function FolderManager({
  projectId,
  currentFolderId,
  onFolderSelect,
  onFolderChange,
  className = ''
}: FolderManagerProps) {
  const { user } = useAuth()
  const [folders, setFolders] = useState<FolderWithStats[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [selectedFolder, setSelectedFolder] = useState<FolderWithStats | null>(null)
  const [showPermissionsModal, setShowPermissionsModal] = useState(false)
  const [showStatsModal, setShowStatsModal] = useState(false)
  const [draggedFolder, setDraggedFolder] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<string | null>(null)

  // Fetch folders with statistics
  const fetchFolders = useCallback(async () => {
    if (!projectId) return

    setLoading(true)
    try {
      // Fetch folders with asset counts and statistics
      const { data: foldersData, error } = await supabase
        .from('folders')
        .select(`
          *,
          assets!folder_id(count),
          subfolders:folders!parent_id(count)
        `)
        .eq('project_id', projectId)
        .order('name')

      if (error) throw error

      // Build hierarchical structure
      const folderMap = new Map<string, FolderWithStats>()
      const rootFolders: FolderWithStats[] = []

      // First pass: create folder objects
      foldersData?.forEach((folder: any) => {
        const folderWithStats: FolderWithStats = {
          ...folder,
          asset_count: folder.assets?.[0]?.count || 0,
          subfolder_count: folder.subfolders?.[0]?.count || 0,
          total_size: 0, // Will be calculated separately
          last_activity: folder.updated_at,
          children: [],
          expanded: false
        }
        folderMap.set(folder.id, folderWithStats)
      })

      // Second pass: build hierarchy
      folderMap.forEach((folder) => {
        if (folder.parent_id) {
          const parent = folderMap.get(folder.parent_id)
          if (parent) {
            parent.children = parent.children || []
            parent.children.push(folder)
          }
        } else {
          rootFolders.push(folder)
        }
      })

      setFolders(rootFolders)
    } catch (error) {
      console.error('Error fetching folders:', error)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    fetchFolders()
  }, [fetchFolders])

  // Filter folders based on search query
  const filteredFolders = folders.filter(folder =>
    searchQuery === '' || 
    folder.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (folder.children && folder.children.some(child => 
      child.name.toLowerCase().includes(searchQuery.toLowerCase())
    ))
  )

  // Toggle folder expansion
  const toggleFolder = (folderId: string) => {
    const updateFolderExpansion = (folders: FolderWithStats[]): FolderWithStats[] => {
      return folders.map(folder => {
        if (folder.id === folderId) {
          return { ...folder, expanded: !folder.expanded }
        }
        if (folder.children) {
          return { ...folder, children: updateFolderExpansion(folder.children) }
        }
        return folder
      })
    }
    setFolders(updateFolderExpansion(folders))
  }

  // Handle folder drag and drop
  const handleDragStart = (e: React.DragEvent, folderId: string) => {
    setDraggedFolder(folderId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent, folderId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget(folderId)
  }

  const handleDragLeave = () => {
    setDropTarget(null)
  }

  const handleDrop = async (e: React.DragEvent, targetFolderId: string) => {
    e.preventDefault()
    setDropTarget(null)

    if (!draggedFolder || draggedFolder === targetFolderId) {
      setDraggedFolder(null)
      return
    }

    try {
      const { error } = await supabase
        .from('folders')
        .update({ parent_id: targetFolderId })
        .eq('id', draggedFolder)

      if (error) throw error

      await fetchFolders()
      onFolderChange?.()
    } catch (error) {
      console.error('Error moving folder:', error)
    } finally {
      setDraggedFolder(null)
    }
  }

  // Handle folder deletion
  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Are you sure you want to delete this folder? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('folders')
        .delete()
        .eq('id', folderId)

      if (error) throw error

      await fetchFolders()
      onFolderChange?.()
      
      if (currentFolderId === folderId) {
        onFolderSelect(null)
      }
    } catch (error) {
      console.error('Error deleting folder:', error)
    }
  }

  // Render folder tree recursively
  const renderFolder = (folder: FolderWithStats, level: number = 0) => {
    const isSelected = currentFolderId === folder.id
    const hasChildren = folder.children && folder.children.length > 0
    const isDragTarget = dropTarget === folder.id
    const isDragging = draggedFolder === folder.id

    return (
      <div key={folder.id} className={`${level > 0 ? 'ml-4' : ''}`}>
        <div
          className={`
            group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all
            ${isSelected 
              ? 'bg-primary/20 text-primary dark:bg-primary/30' 
              : 'hover:bg-gray-100 dark:hover:bg-white/5 text-text-light-secondary dark:text-dark-secondary'
            }
            ${isDragTarget ? 'bg-primary/10 border-2 border-primary border-dashed' : ''}
            ${isDragging ? 'opacity-50' : ''}
          `}
          draggable
          onDragStart={(e) => handleDragStart(e, folder.id)}
          onDragOver={(e) => handleDragOver(e, folder.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, folder.id)}
          onClick={() => onFolderSelect(folder.id)}
        >
          {/* Expand/Collapse Button */}
          {hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleFolder(folder.id)
              }}
              className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded"
            >
              {folder.expanded ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </button>
          )}

          {/* Folder Icon */}
          <span className="material-symbols-outlined text-coral">
            {hasChildren ? 'folder' : 'folder_open'}
          </span>

          {/* Folder Name */}
          <span className="flex-1 text-sm font-medium truncate">
            {folder.name}
          </span>

          {/* Asset Count Badge */}
          {folder.asset_count > 0 && (
            <span className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded-full">
              {folder.asset_count}
            </span>
          )}

          {/* Actions Menu */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation()
                setSelectedFolder(folder)
              }}
              className="p-1 hover:bg-gray-200 dark:hover:bg-white/10 rounded"
            >
              <MoreHorizontal size={16} />
            </button>
          </div>
        </div>

        {/* Render children if expanded */}
        {hasChildren && folder.expanded && (
          <div className="ml-4">
            {folder.children?.map(child => renderFolder(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="px-4 text-xs font-bold uppercase text-text-light-secondary dark:text-dark-secondary tracking-wider">
          Folders
        </h3>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTemplateModal(true)}
            className="p-2"
          >
            <BarChart3 size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="p-2"
          >
            <FolderPlus size={16} />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          />
        </div>
      </div>

      {/* Folder Tree */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="px-4 py-8 text-center text-gray-500">
            Loading folders...
          </div>
        ) : filteredFolders.length === 0 ? (
          <div className="px-4 py-8 text-center text-gray-500">
            {searchQuery ? 'No folders found' : 'No folders yet'}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredFolders.map(folder => renderFolder(folder))}
          </div>
        )}
      </div>

      {/* Create New Folder Button */}
      <div className="px-4">
        <Button
          onClick={() => setShowCreateModal(true)}
          className="w-full flex items-center justify-center gap-2 bg-coral hover:opacity-90"
        >
          <span className="material-symbols-outlined">add_circle</span>
          <span className="truncate">Create New Folder</span>
        </Button>
      </div>

      {/* Modals */}
      <FolderCreateModal
        isOpen={showCreateModal}
        projectId={projectId}
        parentId={currentFolderId}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false)
          fetchFolders()
          onFolderChange?.()
        }}
      />

      <FolderTemplateModal
        isOpen={showTemplateModal}
        projectId={projectId}
        onClose={() => setShowTemplateModal(false)}
        onSuccess={() => {
          setShowTemplateModal(false)
          fetchFolders()
          onFolderChange?.()
        }}
      />

      {selectedFolder && (
        <>
          <FolderPermissionsModal
            isOpen={showPermissionsModal}
            folder={selectedFolder}
            onClose={() => {
              setShowPermissionsModal(false)
              setSelectedFolder(null)
            }}
          />

          <FolderStatsModal
            isOpen={showStatsModal}
            folder={selectedFolder}
            onClose={() => {
              setShowStatsModal(false)
              setSelectedFolder(null)
            }}
          />

          {/* Context Menu */}
          <div className="fixed inset-0 z-50" onClick={() => setSelectedFolder(null)}>
            <div className="absolute bg-white dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg py-2 min-w-48">
              <button
                onClick={() => {
                  setShowPermissionsModal(true)
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-white/5 flex items-center gap-2"
              >
                <Users size={16} />
                Manage Permissions
              </button>
              <button
                onClick={() => {
                  setShowStatsModal(true)
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-white/5 flex items-center gap-2"
              >
                <BarChart3 size={16} />
                View Statistics
              </button>
              <button
                onClick={() => {
                  // Handle folder sharing
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-white/5 flex items-center gap-2"
              >
                <Share2 size={16} />
                Share Folder
              </button>
              <hr className="my-2 border-gray-200 dark:border-gray-700" />
              <button
                onClick={() => {
                  // Handle folder rename
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-white/5 flex items-center gap-2"
              >
                <Edit3 size={16} />
                Rename
              </button>
              <button
                onClick={() => {
                  handleDeleteFolder(selectedFolder.id)
                  setSelectedFolder(null)
                }}
                className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 flex items-center gap-2"
              >
                <Trash2 size={16} />
                Delete
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}