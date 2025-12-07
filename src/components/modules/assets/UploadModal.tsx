'use client'

import React, { useState, useEffect } from 'react'
import { AssetUploadZone } from './AssetUploadZone'
import { supabase } from '@/lib/supabase/client'

export interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (assets: any[]) => void
  folderId?: string | null
  projectId?: string
}

export function UploadModal({ isOpen, onClose, onSuccess, folderId, projectId: initialProjectId }: UploadModalProps) {
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId || '')
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen) {
      fetchProjects()
    }
  }, [isOpen])

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name')
        .eq('status', 'active')
        .order('name')

      if (error) throw error
      setProjects(data || [])
      
      // Auto-select first project if none selected
      if (!selectedProjectId && data && data.length > 0) {
        setSelectedProjectId(data[0].id)
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUploadComplete = (assets: any[]) => {
    onSuccess(assets)
    onClose()
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl max-h-[90vh] bg-surface-light dark:bg-surface-dark rounded-xl shadow-xl z-50 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h2 className="text-xl font-bold text-text-light-primary dark:text-dark-primary">
              Upload Assets
            </h2>
            <p className="text-sm text-text-light-secondary dark:text-dark-secondary mt-1">
              Add files to your project
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-light-secondary dark:text-dark-secondary hover:text-text-light-primary dark:hover:text-dark-primary hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[calc(90vh-120px)] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Project Selection */}
              {!initialProjectId && (
                <div>
                  <label className="block text-sm font-semibold text-text-light-primary dark:text-dark-primary mb-2">
                    Project *
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-text-light-primary dark:text-dark-primary"
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

              {/* Upload Zone */}
              {selectedProjectId && (
                <AssetUploadZone
                  projectId={selectedProjectId}
                  folderId={folderId}
                  onUploadComplete={handleUploadComplete}
                  maxFiles={20}
                />
              )}

              {!selectedProjectId && !initialProjectId && (
                <div className="text-center py-12">
                  <span className="material-symbols-outlined text-4xl text-text-light-secondary dark:text-dark-secondary mb-4 block">
                    folder_open
                  </span>
                  <p className="text-text-light-secondary dark:text-dark-secondary">
                    Please select a project to upload files
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}