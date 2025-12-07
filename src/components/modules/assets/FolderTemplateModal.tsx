'use client'

import { useState } from 'react'
import { X, Folder, FolderPlus, Layers, Briefcase, Palette, Camera, Music } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/hooks/useAuth'
import { supabase } from '@/lib/supabase/client'

interface FolderTemplateModalProps {
  isOpen: boolean
  projectId?: string
  onClose: () => void
  onSuccess: () => void
}

interface FolderTemplate {
  id: string
  name: string
  description: string
  icon: any
  color: string
  folders: string[]
}

const FOLDER_TEMPLATES: FolderTemplate[] = [
  {
    id: 'creative-project',
    name: 'Creative Project',
    description: 'Standard structure for creative projects with assets, drafts, and finals',
    icon: Palette,
    color: 'text-purple-600',
    folders: [
      '01 - Brief & Research',
      '02 - Concepts & Sketches',
      '03 - Work in Progress',
      '04 - Client Feedback',
      '05 - Final Assets',
      '06 - Archive'
    ]
  },
  {
    id: 'photography-shoot',
    name: 'Photography Shoot',
    description: 'Organized structure for photography projects and shoots',
    icon: Camera,
    color: 'text-blue-600',
    folders: [
      'RAW Files',
      'Edited Photos',
      'Client Selects',
      'Final Delivery',
      'Behind the Scenes',
      'Contact Sheets'
    ]
  },
  {
    id: 'video-production',
    name: 'Video Production',
    description: 'Complete workflow for video projects from pre to post production',
    icon: Music,
    color: 'text-red-600',
    folders: [
      'Pre-Production',
      'Raw Footage',
      'Audio Files',
      'Graphics & Assets',
      'Rough Cuts',
      'Final Exports',
      'Archive'
    ]
  },
  {
    id: 'brand-identity',
    name: 'Brand Identity',
    description: 'Comprehensive brand development project structure',
    icon: Briefcase,
    color: 'text-green-600',
    folders: [
      'Research & Strategy',
      'Logo Development',
      'Color & Typography',
      'Brand Guidelines',
      'Applications',
      'Final Brand Package'
    ]
  },
  {
    id: 'web-design',
    name: 'Web Design',
    description: 'Structured approach for web design and development projects',
    icon: Layers,
    color: 'text-indigo-600',
    folders: [
      'Research & Planning',
      'Wireframes',
      'UI Design',
      'Assets & Resources',
      'Prototypes',
      'Final Designs',
      'Development Handoff'
    ]
  }
]

export function FolderTemplateModal({
  isOpen,
  projectId,
  onClose,
  onSuccess
}: FolderTemplateModalProps) {
  const { user } = useAuth()
  const [selectedTemplate, setSelectedTemplate] = useState<FolderTemplate | null>(null)
  const [customFolders, setCustomFolders] = useState<string[]>([''])
  const [templateName, setTemplateName] = useState('')
  const [loading, setLoading] = useState(false)
  const [showCustomTemplate, setShowCustomTemplate] = useState(false)

  const handleCreateFromTemplate = async (template: FolderTemplate) => {
    if (!user || !projectId) return

    setLoading(true)
    try {
      // Create parent folder with template name
      const { data: parentFolder, error: parentError } = await supabase
        .from('folders')
        .insert({
          name: template.name,
          project_id: projectId,
          created_by: user.id
        })
        .select()
        .single()

      if (parentError) throw parentError

      // Create subfolders
      const subfoldersToCreate = template.folders.map(folderName => ({
        name: folderName,
        project_id: projectId,
        parent_id: parentFolder.id,
        created_by: user.id
      }))

      const { error: subfoldersError } = await supabase
        .from('folders')
        .insert(subfoldersToCreate)

      if (subfoldersError) throw subfoldersError

      onSuccess()
    } catch (error: any) {
      console.error('Error creating template:', error)
      alert(error.message || 'Failed to create folder template')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateCustomTemplate = async () => {
    if (!user || !projectId || !templateName.trim()) return

    const validFolders = customFolders.filter(name => name.trim())
    if (validFolders.length === 0) {
      alert('Please add at least one folder name')
      return
    }

    setLoading(true)
    try {
      // Create parent folder
      const { data: parentFolder, error: parentError } = await supabase
        .from('folders')
        .insert({
          name: templateName.trim(),
          project_id: projectId,
          created_by: user.id
        })
        .select()
        .single()

      if (parentError) throw parentError

      // Create subfolders
      const subfoldersToCreate = validFolders.map(folderName => ({
        name: folderName.trim(),
        project_id: projectId,
        parent_id: parentFolder.id,
        created_by: user.id
      }))

      const { error: subfoldersError } = await supabase
        .from('folders')
        .insert(subfoldersToCreate)

      if (subfoldersError) throw subfoldersError

      onSuccess()
    } catch (error: any) {
      console.error('Error creating custom template:', error)
      alert(error.message || 'Failed to create custom template')
    } finally {
      setLoading(false)
    }
  }

  const addCustomFolder = () => {
    setCustomFolders([...customFolders, ''])
  }

  const removeCustomFolder = (index: number) => {
    setCustomFolders(customFolders.filter((_, i) => i !== index))
  }

  const updateCustomFolder = (index: number, value: string) => {
    const updated = [...customFolders]
    updated[index] = value
    setCustomFolders(updated)
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose}></div>

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl bg-surface-light dark:bg-surface-dark rounded-xl shadow-xl z-50 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="size-8 bg-primary/20 rounded-lg flex items-center justify-center">
              <Layers size={20} className="text-primary" />
            </div>
            <h2 className="text-xl font-bold text-text-light-primary dark:text-dark-primary">
              Folder Templates
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {/* Template Selection Tabs */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setShowCustomTemplate(false)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                !showCustomTemplate
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-text-light-secondary dark:text-dark-secondary hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              Pre-built Templates
            </button>
            <button
              onClick={() => setShowCustomTemplate(true)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                showCustomTemplate
                  ? 'bg-primary text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-text-light-secondary dark:text-dark-secondary hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              Custom Template
            </button>
          </div>

          {!showCustomTemplate ? (
            /* Pre-built Templates */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {FOLDER_TEMPLATES.map((template) => {
                const Icon = template.icon
                return (
                  <div
                    key={template.id}
                    className={`
                      border-2 rounded-lg p-6 cursor-pointer transition-all
                      ${selectedTemplate?.id === template.id
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 dark:border-gray-800 hover:border-primary/50 hover:bg-primary/5'
                      }
                    `}
                    onClick={() => setSelectedTemplate(template)}
                  >
                    <div className="flex items-center gap-3 mb-4">
                      <div className="size-10 bg-primary/20 rounded-lg flex items-center justify-center">
                        <Icon size={24} className={template.color} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-text-light-primary dark:text-dark-primary">
                          {template.name}
                        </h3>
                        <p className="text-sm text-text-light-secondary dark:text-dark-secondary">
                          {template.description}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium text-text-light-primary dark:text-dark-primary">
                        Includes {template.folders.length} folders:
                      </p>
                      <div className="space-y-1">
                        {template.folders.slice(0, 4).map((folder, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm text-text-light-secondary dark:text-dark-secondary">
                            <Folder size={14} />
                            <span>{folder}</span>
                          </div>
                        ))}
                        {template.folders.length > 4 && (
                          <p className="text-xs text-text-light-secondary dark:text-dark-secondary ml-5">
                            +{template.folders.length - 4} more folders
                          </p>
                        )}
                      </div>
                    </div>

                    {selectedTemplate?.id === template.id && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800">
                        <Button
                          onClick={() => handleCreateFromTemplate(template)}
                          disabled={loading}
                          className="w-full bg-primary hover:opacity-90"
                        >
                          {loading ? 'Creating...' : `Create ${template.name} Structure`}
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            /* Custom Template */
            <div className="max-w-2xl mx-auto">
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-text-light-primary dark:text-dark-primary mb-2">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Enter template name"
                    className="w-full px-4 py-2 bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-light-primary dark:text-dark-primary mb-2">
                    Folder Structure *
                  </label>
                  <div className="space-y-2">
                    {customFolders.map((folderName, index) => (
                      <div key={index} className="flex gap-2">
                        <div className="flex items-center gap-2 flex-1">
                          <Folder size={16} className="text-gray-400" />
                          <input
                            type="text"
                            value={folderName}
                            onChange={(e) => updateCustomFolder(index, e.target.value)}
                            placeholder={`Folder ${index + 1} name`}
                            className="flex-1 px-3 py-2 bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                          />
                        </div>
                        {customFolders.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeCustomFolder(index)}
                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addCustomFolder}
                      className="flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg transition"
                    >
                      <FolderPlus size={16} />
                      Add Another Folder
                    </button>
                  </div>
                </div>

                <div className="pt-4">
                  <Button
                    onClick={handleCreateCustomTemplate}
                    disabled={loading || !templateName.trim()}
                    className="w-full bg-primary hover:opacity-90"
                  >
                    {loading ? 'Creating...' : 'Create Custom Structure'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-800">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </>
  )
}