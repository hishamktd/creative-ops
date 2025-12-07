'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'
import { FileValidationService, ValidationResult } from '@/lib/services/fileValidation'
import { StorageService } from '@/lib/services/storage'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'

export interface UploadFile {
  id: string
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error' | 'cancelled'
  error?: string
  validation?: ValidationResult
  uploadResult?: any
}

export interface AssetUploadZoneProps {
  projectId: string
  folderId?: string | null
  onUploadComplete?: (assets: any[]) => void
  onUploadProgress?: (files: UploadFile[]) => void
  maxFiles?: number
  className?: string
  disabled?: boolean
}

export function AssetUploadZone({
  projectId,
  folderId,
  onUploadComplete,
  onUploadProgress,
  maxFiles = 10,
  className = '',
  disabled = false
}: AssetUploadZoneProps) {
  const { user } = useAuth()
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

  // Handle drag and drop events
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current++
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragOver(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) {
      setIsDragOver(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    dragCounterRef.current = 0

    if (disabled) return

    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }, [disabled])

  // Handle paste events for images
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (disabled) return
      
      const items = e.clipboardData?.items
      if (!items) return

      const files: File[] = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            // Create a proper filename for pasted images
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
            const extension = file.type.split('/')[1] || 'png'
            const renamedFile = new File([file], `pasted-image-${timestamp}.${extension}`, {
              type: file.type,
              lastModified: file.lastModified
            })
            files.push(renamedFile)
          }
        }
      }

      if (files.length > 0) {
        e.preventDefault()
        handleFiles(files)
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [disabled])

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    handleFiles(files)
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [])

  // Process selected files
  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return

    // Check file limit
    const totalFiles = uploadFiles.length + files.length
    if (totalFiles > maxFiles) {
      alert(`Maximum ${maxFiles} files allowed. Please select fewer files.`)
      return
    }

    // Create upload file objects
    const newUploadFiles: UploadFile[] = files.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      progress: 0,
      status: 'pending'
    }))

    setUploadFiles(prev => [...prev, ...newUploadFiles])

    // Validate files
    for (const uploadFile of newUploadFiles) {
      try {
        const validation = await FileValidationService.validateFile(uploadFile.file)
        
        setUploadFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, validation, status: validation.isValid ? 'pending' : 'error', error: validation.errors.join(', ') }
            : f
        ))
      } catch (error) {
        setUploadFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, status: 'error', error: 'Validation failed' }
            : f
        ))
      }
    }
  }, [uploadFiles.length, maxFiles])

  // Start upload process
  const startUpload = useCallback(async () => {
    const validFiles = uploadFiles.filter(f => f.status === 'pending' && f.validation?.isValid)
    if (validFiles.length === 0) return

    setIsUploading(true)

    try {
      const uploadPromises = validFiles.map(async (uploadFile) => {
        try {
          // Update status to uploading
          setUploadFiles(prev => prev.map(f => 
            f.id === uploadFile.id ? { ...f, status: 'uploading' } : f
          ))

          // Generate file path
          const filePath = StorageService.generateFilePath(projectId, folderId, uploadFile.file.name)

          // Upload file
          const uploadResult = await StorageService.uploadFile({
            bucket: 'assets',
            path: filePath,
            file: uploadFile.file,
            onProgress: (progress) => {
              setUploadFiles(prev => prev.map(f => 
                f.id === uploadFile.id ? { ...f, progress } : f
              ))
            }
          })

          if (!uploadResult.success) {
            throw new Error(uploadResult.error || 'Upload failed')
          }

          // Update status to processing
          setUploadFiles(prev => prev.map(f => 
            f.id === uploadFile.id ? { ...f, status: 'processing', uploadResult } : f
          ))

          // Save to database
          const { data: asset, error: dbError } = await supabase
            .from('assets')
            .insert({
              project_id: projectId,
              folder_id: folderId,
              name: uploadFile.file.name,
              file_url: uploadResult.data!.publicUrl,
              file_path: uploadResult.data!.path,
              file_type: uploadFile.file.type,
              file_size: uploadFile.file.size,
              version: 1,
              uploaded_by: user?.id,
              status: 'ready',
              metadata: {
                original_name: uploadFile.file.name,
                mime_type: uploadFile.file.type,
                checksum: uploadFile.validation?.metadata.checksum || ''
              }
            })
            .select()
            .single()

          if (dbError) {
            throw new Error(dbError.message)
          }

          // Update status to completed
          setUploadFiles(prev => prev.map(f => 
            f.id === uploadFile.id ? { ...f, status: 'completed', progress: 100 } : f
          ))

          return asset

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Upload failed'
          setUploadFiles(prev => prev.map(f => 
            f.id === uploadFile.id ? { ...f, status: 'error', error: errorMessage } : f
          ))
          return null
        }
      })

      const results = await Promise.all(uploadPromises)
      const successfulUploads = results.filter(Boolean)

      if (successfulUploads.length > 0) {
        onUploadComplete?.(successfulUploads)
      }

    } finally {
      setIsUploading(false)
    }
  }, [uploadFiles, projectId, folderId, user?.id, onUploadComplete])

  // Remove file from queue
  const removeFile = useCallback((fileId: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== fileId))
  }, [])

  // Cancel upload
  const cancelUpload = useCallback((fileId: string) => {
    setUploadFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, status: 'cancelled' } : f
    ))
  }, [])

  // Retry upload
  const retryUpload = useCallback((fileId: string) => {
    setUploadFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, status: 'pending', error: undefined, progress: 0 } : f
    ))
  }, [])

  // Clear completed uploads
  const clearCompleted = useCallback(() => {
    setUploadFiles(prev => prev.filter(f => f.status !== 'completed'))
  }, [])

  // Update progress callback
  useEffect(() => {
    onUploadProgress?.(uploadFiles)
  }, [uploadFiles, onUploadProgress])

  const hasValidFiles = uploadFiles.some(f => f.status === 'pending' && f.validation?.isValid)
  const hasCompletedFiles = uploadFiles.some(f => f.status === 'completed')

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Drop Zone */}
      <div
        className={`
          relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200
          ${isDragOver 
            ? 'border-primary bg-primary/5 dark:bg-primary/10' 
            : 'border-gray-300 dark:border-gray-700 hover:border-primary/50'
          }
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileSelect}
          disabled={disabled}
        />
        
        <div className="inline-flex items-center justify-center size-16 bg-primary/10 dark:bg-primary/20 rounded-full mb-4">
          <span className="material-symbols-outlined text-primary text-4xl">cloud_upload</span>
        </div>
        
        <h3 className="text-lg font-bold text-text-light-primary dark:text-dark-primary mb-1">
          {isDragOver ? 'Drop files here!' : 'Upload your assets'}
        </h3>
        
        <p className="text-sm text-text-light-secondary dark:text-dark-secondary mb-4">
          Drag and drop files here, paste images, or click to browse
        </p>
        
        <div className="text-xs text-text-light-secondary dark:text-dark-secondary space-y-1">
          <p>Supported: Images, Videos, Documents, Audio files</p>
          <p>Maximum file size: 100MB • Maximum {maxFiles} files</p>
        </div>
      </div>

      {/* Upload Queue */}
      {uploadFiles.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-text-light-primary dark:text-dark-primary">
              Upload Queue ({uploadFiles.length})
            </h4>
            <div className="flex gap-2">
              {hasValidFiles && (
                <button
                  onClick={startUpload}
                  disabled={isUploading}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-full text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  <span className="material-symbols-outlined text-sm">
                    {isUploading ? 'hourglass_empty' : 'upload'}
                  </span>
                  {isUploading ? 'Uploading...' : 'Upload All'}
                </button>
              )}
              {hasCompletedFiles && (
                <button
                  onClick={clearCompleted}
                  className="flex items-center gap-2 px-4 py-2 bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 text-text-light-secondary dark:text-dark-secondary rounded-full text-sm font-medium hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">clear_all</span>
                  Clear Completed
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {uploadFiles.map((uploadFile) => (
              <FileUploadCard
                key={uploadFile.id}
                uploadFile={uploadFile}
                onRemove={removeFile}
                onCancel={cancelUpload}
                onRetry={retryUpload}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

interface FileUploadCardProps {
  uploadFile: UploadFile
  onRemove: (fileId: string) => void
  onCancel: (fileId: string) => void
  onRetry: (fileId: string) => void
}

function FileUploadCard({ uploadFile, onRemove, onCancel, onRetry }: FileUploadCardProps) {
  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return 'image'
    if (fileType.startsWith('video/')) return 'videocam'
    if (fileType.startsWith('audio/')) return 'music_note'
    if (fileType.includes('pdf')) return 'description'
    return 'insert_drive_file'
  }

  const getStatusColor = (status: UploadFile['status']) => {
    switch (status) {
      case 'completed': return 'text-green-500'
      case 'error': return 'text-red-500'
      case 'uploading': return 'text-primary'
      case 'processing': return 'text-yellow-500'
      case 'cancelled': return 'text-gray-500'
      default: return 'text-text-light-secondary dark:text-dark-secondary'
    }
  }

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'completed': return 'check_circle'
      case 'error': return 'error'
      case 'uploading': return 'hourglass_empty'
      case 'processing': return 'sync'
      case 'cancelled': return 'cancel'
      default: return 'schedule'
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-lg">
      {/* File Icon */}
      <div className="flex-shrink-0">
        <span className={`material-symbols-outlined text-2xl ${getStatusColor(uploadFile.status)}`}>
          {getFileIcon(uploadFile.file.type)}
        </span>
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="font-medium text-sm text-text-light-primary dark:text-dark-primary truncate">
            {uploadFile.file.name}
          </p>
          <span className={`material-symbols-outlined text-sm ${getStatusColor(uploadFile.status)}`}>
            {getStatusIcon(uploadFile.status)}
          </span>
        </div>
        
        <div className="flex items-center gap-4 text-xs text-text-light-secondary dark:text-dark-secondary">
          <span>{formatFileSize(uploadFile.file.size)}</span>
          <span className="capitalize">{uploadFile.status.replace('_', ' ')}</span>
          {uploadFile.progress > 0 && uploadFile.status === 'uploading' && (
            <span>{uploadFile.progress}%</span>
          )}
        </div>

        {/* Progress Bar */}
        {(uploadFile.status === 'uploading' || uploadFile.status === 'processing') && (
          <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
            <div 
              className="bg-primary h-1 rounded-full transition-all duration-300"
              style={{ width: `${uploadFile.progress}%` }}
            />
          </div>
        )}

        {/* Error Message */}
        {uploadFile.error && (
          <p className="mt-1 text-xs text-red-500">{uploadFile.error}</p>
        )}

        {/* Validation Warnings */}
        {uploadFile.validation?.warnings && uploadFile.validation.warnings.length > 0 && (
          <div className="mt-1 text-xs text-yellow-600 dark:text-yellow-400">
            {uploadFile.validation.warnings.map((warning, index) => (
              <p key={index}>⚠ {warning}</p>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        {uploadFile.status === 'error' && (
          <button
            onClick={() => onRetry(uploadFile.id)}
            className="p-1.5 text-text-light-secondary dark:text-dark-secondary hover:text-primary hover:bg-primary/10 rounded-full transition-colors"
            title="Retry upload"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
          </button>
        )}
        
        {uploadFile.status === 'uploading' && (
          <button
            onClick={() => onCancel(uploadFile.id)}
            className="p-1.5 text-text-light-secondary dark:text-dark-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full transition-colors"
            title="Cancel upload"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        )}
        
        {(uploadFile.status === 'pending' || uploadFile.status === 'error' || uploadFile.status === 'completed' || uploadFile.status === 'cancelled') && (
          <button
            onClick={() => onRemove(uploadFile.id)}
            className="p-1.5 text-text-light-secondary dark:text-dark-secondary hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-full transition-colors"
            title="Remove file"
          >
            <span className="material-symbols-outlined text-sm">delete</span>
          </button>
        )}
      </div>
    </div>
  )
}