'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import {
  Upload,
  Folder,
} from 'lucide-react'
import { useAuth } from '@/lib/hooks/useAuth'
import { EnhancedAsset } from '@/lib/services/assetManager'
import { UploadModal } from '@/components/modules/assets/UploadModal'
import { AssetBrowser } from '@/components/modules/assets/AssetBrowser'
import { NotificationManager, useNotifications } from '@/components/modules/assets/UploadNotification'
import { FolderBreadcrumb } from '@/components/modules/assets/FolderBreadcrumb'

export default function AssetsPage() {
  const { user } = useAuth()
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showCreateFolder, setShowCreateFolder] = useState(false)
  const [selectedAssets, setSelectedAssets] = useState<EnhancedAsset[]>([])
  const { notifications, addNotification, removeNotification } = useNotifications()

  const handleAssetClick = (asset: EnhancedAsset) => {
    // Handle asset preview/view
    console.log('Asset clicked:', asset)
  }

  const handleSelectionChange = (assets: EnhancedAsset[]) => {
    setSelectedAssets(assets)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Assets</h1>
          <p className="text-gray-600 mt-1">Manage your project files and assets with advanced browsing capabilities</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowCreateFolder(true)}>
            <Folder size={18} />
            New Folder
          </Button>
          <Button onClick={() => setShowUploadModal(true)}>
            <Upload size={18} />
            Upload Files
          </Button>
        </div>
      </div>

      {/* Breadcrumb Navigation */}
      <FolderBreadcrumb
        currentFolderId={currentFolder}
        projectId="default" // You might want to make this dynamic based on selected project
        onFolderSelect={setCurrentFolder}
        className="mb-4"
      />

      {/* Enhanced Asset Browser */}
      <AssetBrowser
        folderId={currentFolder}
        selectionMode="multiple"
        onSelectionChange={handleSelectionChange}
        onAssetClick={handleAssetClick}
        viewMode="grid"
        sortBy="created_at"
        sortDirection="desc"
      />

      {/* Upload Modal */}
      <UploadModal
        isOpen={showUploadModal}
        folderId={currentFolder}
        onClose={() => setShowUploadModal(false)}
        onSuccess={(assets) => {
          addNotification({
            type: 'success',
            title: 'Upload Complete',
            message: `Successfully uploaded ${assets.length} file${assets.length > 1 ? 's' : ''}`
          })
        }}
      />

      {/* Create Folder Modal */}
      {showCreateFolder && (
        <CreateFolderModal
          parentId={currentFolder}
          onClose={() => setShowCreateFolder(false)}
          onSuccess={() => {
            setShowCreateFolder(false)
            addNotification({
              type: 'success',
              title: 'Folder Created',
              message: 'New folder created successfully'
            })
          }}
        />
      )}

      {/* Notifications */}
      <NotificationManager
        notifications={notifications}
        onRemove={removeNotification}
      />
    </div>
  )
}



function CreateFolderModal({
  parentId,
  onClose,
  onSuccess,
}: {
  parentId: string | null
  onClose: () => void
  onSuccess: () => void
}) {
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [projectId, setProjectId] = useState('')
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('id, name')
      .eq('status', 'active')
      .order('name')

    setProjects(data || [])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.from('folders').insert({
        name,
        project_id: projectId,
        parent_id: parentId,
        created_by: user?.id,
      })

      if (error) throw error
      onSuccess()
    } catch (error) {
      console.error('Error creating folder:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose}></div>
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-xl shadow-xl z-50 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Create Folder</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Folder Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="Enter folder name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Project *
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            >
              <option value="">Select a project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Creating...' : 'Create Folder'}
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}
