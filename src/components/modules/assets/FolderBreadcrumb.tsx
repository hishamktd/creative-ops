'use client'

import { useState, useEffect } from 'react'
import { ChevronRight, Home, Folder, ChevronDown } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { Folder as FolderType } from '@/types'

interface FolderBreadcrumbProps {
  currentFolderId?: string | null
  projectId?: string
  onFolderSelect: (folderId: string | null) => void
  className?: string
}

interface BreadcrumbItem {
  id: string | null
  name: string
  isRoot?: boolean
}

export function FolderBreadcrumb({
  currentFolderId,
  projectId,
  onFolderSelect,
  className = ''
}: FolderBreadcrumbProps) {
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState<string | null>(null)
  const [siblingFolders, setSiblingFolders] = useState<FolderType[]>([])

  useEffect(() => {
    buildBreadcrumbs()
  }, [currentFolderId, projectId])

  const buildBreadcrumbs = async () => {
    if (!projectId) return

    setLoading(true)
    try {
      const breadcrumbPath: BreadcrumbItem[] = [
        { id: null, name: 'Home', isRoot: true }
      ]

      if (currentFolderId) {
        // Fetch the current folder and build path to root
        const path = await getFolderPath(currentFolderId)
        breadcrumbPath.push(...path)
      }

      setBreadcrumbs(breadcrumbPath)
    } catch (error) {
      console.error('Error building breadcrumbs:', error)
    } finally {
      setLoading(false)
    }
  }

  const getFolderPath = async (folderId: string): Promise<BreadcrumbItem[]> => {
    const path: BreadcrumbItem[] = []
    let currentId: string | null = folderId

    while (currentId) {
      const { data: folder, error } = await supabase
        .from('folders')
        .select('id, name, parent_id')
        .eq('id', currentId)
        .single()

      if (error || !folder) break

      path.unshift({
        id: folder.id,
        name: folder.name
      })

      currentId = folder.parent_id
    }

    return path
  }

  const fetchSiblingFolders = async (parentId: string | null) => {
    if (!projectId) return

    try {
      let query = supabase
        .from('folders')
        .select('id, name, parent_id')
        .eq('project_id', projectId)
        .order('name')

      if (parentId) {
        query = query.eq('parent_id', parentId)
      } else {
        query = query.is('parent_id', null)
      }

      const { data, error } = await query

      if (error) throw error
      setSiblingFolders(data || [])
    } catch (error) {
      console.error('Error fetching sibling folders:', error)
    }
  }

  const handleDropdownToggle = async (itemId: string | null) => {
    if (showDropdown === itemId) {
      setShowDropdown(null)
      setSiblingFolders([])
    } else {
      setShowDropdown(itemId)
      await fetchSiblingFolders(itemId)
    }
  }

  const handleFolderSelect = (folderId: string | null) => {
    onFolderSelect(folderId)
    setShowDropdown(null)
    setSiblingFolders([])
  }

  if (loading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="animate-pulse flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-300 rounded"></div>
          <div className="w-16 h-4 bg-gray-300 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <nav className={`flex items-center gap-1 ${className}`} aria-label="Breadcrumb">
      <ol className="flex items-center gap-1">
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1
          const isRoot = item.isRoot
          const hasDropdown = !isLast || (isLast && siblingFolders.length > 0)

          return (
            <li key={item.id || 'root'} className="flex items-center gap-1">
              {/* Separator */}
              {index > 0 && (
                <ChevronRight size={16} className="text-gray-400 mx-1" />
              )}

              {/* Breadcrumb Item */}
              <div className="relative">
                <div className="flex items-center">
                  <button
                    onClick={() => handleFolderSelect(item.id)}
                    className={`
                      flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                      ${isLast
                        ? 'text-text-light-primary dark:text-dark-primary bg-primary/10'
                        : 'text-text-light-secondary dark:text-dark-secondary hover:text-primary hover:bg-primary/5'
                      }
                    `}
                  >
                    {isRoot ? (
                      <Home size={16} />
                    ) : (
                      <Folder size={16} />
                    )}
                    <span className="truncate max-w-32">{item.name}</span>
                  </button>

                  {/* Dropdown Toggle */}
                  {hasDropdown && (
                    <button
                      onClick={() => handleDropdownToggle(item.id)}
                      className="p-1 ml-1 text-gray-400 hover:text-primary rounded transition-colors"
                    >
                      <ChevronDown size={14} />
                    </button>
                  )}
                </div>

                {/* Dropdown Menu */}
                {showDropdown === item.id && siblingFolders.length > 0 && (
                  <div className="absolute top-full left-0 mt-1 bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-lg shadow-lg py-2 min-w-48 z-10">
                    {siblingFolders.map((folder) => (
                      <button
                        key={folder.id}
                        onClick={() => handleFolderSelect(folder.id)}
                        className={`
                          w-full flex items-center gap-2 px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-white/5 transition-colors
                          ${folder.id === currentFolderId
                            ? 'text-primary bg-primary/10'
                            : 'text-text-light-primary dark:text-dark-primary'
                          }
                        `}
                      >
                        <Folder size={16} />
                        <span className="truncate">{folder.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {/* Click outside to close dropdown */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-5"
          onClick={() => {
            setShowDropdown(null)
            setSiblingFolders([])
          }}
        />
      )}
    </nav>
  )
}