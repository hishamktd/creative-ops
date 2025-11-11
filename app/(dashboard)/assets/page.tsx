'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  Upload,
  FolderOpen,
  FileText,
  Image,
  Film,
  File,
  Download,
  Eye,
  MoreVertical,
  Folder,
  Plus,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { Asset, Folder as FolderType } from '@/types'

export default function AssetsPage() {
  const { user } = useAuth()
  const [assets, setAssets] = useState<Asset[]>([])
  const [folders, setFolders] = useState<FolderType[]>([])
  const [loading, setLoading] = useState(true)
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showCreateFolder, setShowCreateFolder] = useState(false)

  useEffect(() => {
    fetchAssets()
    fetchFolders()
  }, [currentFolder])

  const fetchAssets = async () => {
    try {
      let query = supabase
        .from('assets')
        .select('*, projects(name)')
        .order('created_at', { ascending: false })

      if (currentFolder) {
        query = query.eq('folder_id', currentFolder)
      } else {
        query = query.is('folder_id', null)
      }

      const { data, error } = await query

      if (error) throw error
      setAssets(data || [])
    } catch (error) {
      console.error('Error fetching assets:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchFolders = async () => {
    try {
      let query = supabase
        .from('folders')
        .select('*')
        .order('name', { ascending: true })

      if (currentFolder) {
        query = query.eq('parent_id', currentFolder)
      } else {
        query = query.is('parent_id', null)
      }

      const { data, error } = await query

      if (error) throw error
      setFolders(data || [])
    } catch (error) {
      console.error('Error fetching folders:', error)
    }
  }

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <Image size={20} className="text-blue-500" />
    if (fileType.startsWith('video/')) return <Film size={20} className="text-purple-500" />
    if (fileType.includes('pdf')) return <FileText size={20} className="text-red-500" />
    return <File size={20} className="text-gray-500" />
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Assets</h1>
          <p className="text-gray-600 mt-1">Manage your project files and assets</p>
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

      {/* Breadcrumb */}
      {currentFolder && (
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setCurrentFolder(null)}
            className="text-primary-600 hover:text-primary-700"
          >
            Home
          </button>
          <span className="text-gray-400">/</span>
          <span className="text-gray-900">Current Folder</span>
        </div>
      )}

      {/* Folders Grid */}
      {folders.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {folders.map((folder) => (
            <button
              key={folder.id}
              onClick={() => setCurrentFolder(folder.id)}
              className="flex flex-col items-center p-4 rounded-lg border-2 border-gray-200 hover:border-primary-500 hover:bg-primary-50 transition"
            >
              <FolderOpen size={48} className="text-primary-600 mb-2" />
              <span className="text-sm font-medium text-gray-900 truncate w-full text-center">
                {folder.name}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Assets Grid */}
      {assets.length === 0 && folders.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Upload size={64} className="mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No assets yet</h3>
            <p className="text-gray-500 mb-4">Upload your first asset to get started</p>
            <Button onClick={() => setShowUploadModal(true)}>
              <Upload size={18} />
              Upload Files
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {assets.map((asset) => (
            <Card key={asset.id} className="group">
              <CardContent className="p-0">
                <div className="aspect-video bg-gray-100 relative overflow-hidden rounded-t-xl">
                  {asset.thumbnail_url || asset.file_type.startsWith('image/') ? (
                    <img
                      src={asset.thumbnail_url || asset.file_url}
                      alt={asset.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      {getFileIcon(asset.file_type)}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                    <button className="p-2 bg-white rounded-lg hover:bg-gray-100 transition">
                      <Eye size={16} />
                    </button>
                    <button className="p-2 bg-white rounded-lg hover:bg-gray-100 transition">
                      <Download size={16} />
                    </button>
                  </div>
                </div>
                <div className="p-3">
                  <h4 className="font-medium text-sm text-gray-900 truncate">{asset.name}</h4>
                  <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                    <span>{formatFileSize(asset.file_size)}</span>
                    <Badge variant="default" className="text-xs">
                      v{asset.version}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <UploadModal
          folderId={currentFolder}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false)
            fetchAssets()
          }}
        />
      )}

      {/* Create Folder Modal */}
      {showCreateFolder && (
        <CreateFolderModal
          parentId={currentFolder}
          onClose={() => setShowCreateFolder(false)}
          onSuccess={() => {
            setShowCreateFolder(false)
            fetchFolders()
          }}
        />
      )}
    </div>
  )
}

function UploadModal({
  folderId,
  onClose,
  onSuccess,
}: {
  folderId: string | null
  onClose: () => void
  onSuccess: () => void
}) {
  const { user } = useAuth()
  const [files, setFiles] = useState<File[]>([])
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

    // Note: In production, you'd upload to Supabase Storage
    // For this prototype, we'll simulate the upload
    try {
      for (const file of files) {
        await supabase.from('assets').insert({
          project_id: projectId,
          folder_id: folderId,
          name: file.name,
          file_url: `https://example.com/${file.name}`, // Placeholder
          file_type: file.type,
          file_size: file.size,
          uploaded_by: user?.id,
        })
      }

      onSuccess()
    } catch (error) {
      console.error('Error uploading files:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose}></div>
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-xl shadow-xl z-50 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Upload Files</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Files *
            </label>
            <input
              type="file"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
            {files.length > 0 && (
              <p className="text-sm text-gray-500 mt-2">{files.length} file(s) selected</p>
            )}
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </form>
      </div>
    </>
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
