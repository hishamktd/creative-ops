import { useState, useCallback } from 'react'
import { StorageService } from '@/lib/services/storage'
import { AssetManager } from '@/lib/services/assetManager'

export interface UploadItem {
  id: string
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'completed' | 'error' | 'cancelled'
  error?: string
  result?: any
}

export interface UploadOptions {
  projectId: string
  folderId?: string
  description?: string
  tags?: string[]
  generateThumbnail?: boolean
  detectDuplicates?: boolean
}

export interface UseAssetUploadOptions {
  detectDuplicates?: boolean
  maxConcurrentUploads?: number
}

export function useAssetUpload(options: UseAssetUploadOptions = {}) {
  const [uploads, setUploads] = useState<UploadItem[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const uploadFiles = useCallback(async (files: File[], uploadOptions: UploadOptions) => {
    const newUploads: UploadItem[] = files.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      progress: 0,
      status: 'pending' as const,
    }))

    setUploads(prev => [...prev, ...newUploads])
    setIsUploading(true)

    try {
      await Promise.all(
        newUploads.map(upload => processUpload(upload, uploadOptions))
      )
    } finally {
      setIsUploading(false)
    }
  }, [])

  const processUpload = async (upload: UploadItem, uploadOptions: UploadOptions) => {
    try {
      // Update status to uploading
      setUploads(prev => prev.map(u => 
        u.id === upload.id ? { ...u, status: 'uploading' as const } : u
      ))

      // Validate file
      const validation = StorageService.validateFile(upload.file)
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '))
      }

      // Generate file path
      const filePath = StorageService.generateFilePath(
        uploadOptions.projectId,
        uploadOptions.folderId,
        upload.file.name
      )

      // Upload to storage
      const uploadResult = await StorageService.uploadFile({
        bucket: 'assets',
        path: filePath,
        file: upload.file,
        onProgress: (progress) => {
          setUploads(prev => prev.map(u => 
            u.id === upload.id ? { ...u, progress } : u
          ))
        }
      })

      if (!uploadResult.success) {
        throw new Error(uploadResult.error)
      }

      // Create asset record
      const assetData = {
        project_id: uploadOptions.projectId,
        folder_id: uploadOptions.folderId,
        name: upload.file.name,
        description: uploadOptions.description,
        file_url: uploadResult.data!.publicUrl,
        file_path: uploadResult.data!.path,
        file_type: upload.file.type,
        file_size: upload.file.size,
        tags: uploadOptions.tags || [],
        metadata: {
          original_name: upload.file.name,
          mime_type: upload.file.type,
          ...validation.metadata,
        },
      }

      const asset = await AssetManager.createAsset(assetData)

      // Update upload status
      setUploads(prev => prev.map(u => 
        u.id === upload.id 
          ? { ...u, status: 'completed' as const, progress: 100, result: asset }
          : u
      ))

    } catch (error) {
      setUploads(prev => prev.map(u => 
        u.id === upload.id 
          ? { 
              ...u, 
              status: 'error' as const, 
              error: error instanceof Error ? error.message : 'Upload failed'
            }
          : u
      ))
    }
  }

  const retryUpload = useCallback(async (uploadId: string) => {
    const upload = uploads.find(u => u.id === uploadId)
    if (!upload) return

    // Reset upload status
    setUploads(prev => prev.map(u => 
      u.id === uploadId 
        ? { ...u, status: 'pending' as const, progress: 0, error: undefined }
        : u
    ))

    // Note: This would need the original upload options to retry
    // In a real implementation, you'd store these with the upload item
  }, [uploads])

  const cancelUpload = useCallback((uploadId: string) => {
    setUploads(prev => prev.map(u => 
      u.id === uploadId ? { ...u, status: 'cancelled' as const } : u
    ))
  }, [])

  const clearCompleted = useCallback(() => {
    setUploads(prev => prev.filter(u => u.status !== 'completed'))
  }, [])

  const totalProgress = uploads.length > 0 
    ? uploads.reduce((sum, upload) => sum + upload.progress, 0) / uploads.length
    : 0

  return {
    uploads,
    isUploading,
    totalProgress,
    uploadFiles,
    retryUpload,
    cancelUpload,
    clearCompleted,
  }
}