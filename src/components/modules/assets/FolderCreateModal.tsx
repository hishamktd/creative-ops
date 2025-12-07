'use client'

import { useState, useEffect } from 'react'
import { X, Folder, FolderPlus } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase/client'

interface FolderCreateModalProps {
  isOpen: boolean
  projectId?: string
  parentId?: string | null
  onClose: () => void
  onSuccess: () => void
}

interface Project {
  id: string
  name: string
}

export function FolderCreateModal({
  isOpen,
  projectId,
  parentId,
  onClose,
  onSuccess
}: FolderCreateModalProps) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [selectedProjectId, setSelectedProjectId] = useState(projectId || '')
  const [description, setDescription] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(false)
  const [createMultiple, setCreateMultiple] = useState(false)
  const [folderNames, setFolderNames] = useState([''])

  useEffect(() => {
    if (isOpen) {
      fetchProjects()
      setName('')
      setDescription('')
      setSelectedProjectId(projectId || '')
      setCreateMultiple(false)
      setFolderNames([''])
    }
  }, [isOpen, projectId])

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('status', 'active')
        .order('name')

      if (error) throw error
      setProjects(data || [])
    } catch (error) {
      console.error('Error fetching projects:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    try {
      if (createMultiple) {
        // Create multiple folders
        const validNames = folderNames.filter(name => name.trim())
        if (validNames.length === 0) {
          throw new Error('Please provide at least one folder name')
        }

        const foldersToCreate = validNames.map(folderName => ({
          name: folderName.trim(),
          description,
          project_id: selectedProjectId,
          parent_id: parentId,
          created_by: user.id
        }))

        const { error } = await supabase
          .from('folders')
          .insert(foldersToCreate)

        if (error) throw error
      } else {
        // Create single folder
        if (!name.trim()) {
          throw new Error('Please provide a folder name')
        }

        const { error } = await supabase
          .from('folders')
          .insert({
            name: name.trim(),
            description,
            project_id: selectedProjectId,
            parent_id: parentId,
            created_by: user.id
          })

        if (error) throw error
      }

      onSuccess()
    } catch (error: any) {
      console.error('Error creating folder(s):', error)
      alert(error.message || 'Failed to create folder(s)')
    } finally {
      setLoading(false)
    }
  }

  const addFolderName = () => {
    setFolderNames([...folderNames, ''])
  }

  const removeFolderName = (index: number) => {
    setFolderNames(folderNames.filter((_, i) => i !== index))
  }

  const updateFolderName = (index: number, value: string) => {
    const updated = [...folderNames]
    updated[index] = value
    setFolderNames(updated)
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose}></div>

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-surface-light dark:bg-surface-dark rounded-xl shadow-xl z-50 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="size-8 bg-primary/20 rounded-lg flex items-center justify-center">
              <Folder size={20} className="text-primary" />
            </div>
            <h2 className="text-xl font-bold text-text-light-primary dark:text-dark-primary">
              Create {createMultiple ? 'Folders' : 'Folder'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project Selection */}
          {!projectId && (
            <div>
              <label className="block text-sm font-medium text-text-light-primary dark:text-dark-primary mb-2">
                Project *
              </label>
              <select
                value={selectedProjectId}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                required
                className="w-full px-4 py-2 bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              >
                <option value="">Select a project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Create Multiple Toggle */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="createMultiple"
              checked={createMultiple}
              onChange={(e) => setCreateMultiple(e.target.checked)}
              className="rounded border-gray-300 text-primary focus:ring-primary"
            />
            <label htmlFor="createMultiple" className="text-sm font-medium text-text-light-primary dark:text-dark-primary">
              Create multiple folders at once
            </label>
          </div>

          {/* Folder Names */}
          {createMultiple ? (
            <div>
              <label className="block text-sm font-medium text-text-light-primary dark:text-dark-primary mb-2">
                Folder Names *
              </label>
              <div className="space-y-2">
                {folderNames.map((folderName, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={folderName}
                      onChange={(e) => updateFolderName(index, e.target.value)}
                      placeholder={`Folder ${index + 1} name`}
                      className="flex-1 px-4 py-2 bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                    {folderNames.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeFolderName(index)}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addFolderName}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition"
                >
                  <FolderPlus size={16} />
                  Add Another Folder
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-text-light-primary dark:text-dark-primary mb-2">
                Folder Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Enter folder name"
                className="w-full px-4 py-2 bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
              />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-text-light-primary dark:text-dark-primary mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description for the folder(s)"
              rows={3}
              className="w-full px-4 py-2 bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 bg-coral hover:opacity-90"
            >
              {loading ? 'Creating...' : `Create ${createMultiple ? 'Folders' : 'Folder'}`}
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}