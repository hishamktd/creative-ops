'use client'

import React, { useState, useCallback, useRef } from 'react'
import { ErrorHandlingService, AppError, ErrorType } from '@/lib/services/errorHandling'
import { OfflineHandlingService } from '@/lib/services/offlineHandling'

interface UploadProgress {
  id: string
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error' | 'paused' | 'cancelled'
  error?: AppError
  retryCount: number
  resumeFrom?: number
}

interface EnhancedUploadZoneProps {
  projectId: string
  folderId?: string
  onUploadComplete?: (assets: any[]) => void
  onUploadError?: (error: AppError) => void
  onUploadProgress?: (progress: UploadProgress[]) => void
  maxFiles?: number
  maxFileSize?: number
  acceptedTypes?: string[]
  className?: string
}

export function EnhancedUploadZone({
  projectId,
  folderId,
  onUploadComplete,
  onUploadError,
  onUploadProgress,
  maxFiles = 10,
  maxFileSize = 100 * 1024 * 1024, // 100MB
  acceptedTypes = ['image/*', 'video/*', 'application/pdf', 'text/*'],
  className = ''
}: EnhancedUploadZoneProps) {
  const [uploads, setUploads] = useState<UploadProgress[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isOffline, setIsOffline] = useState(!OfflineHandlingService.isOnline())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortControllers = useRef<Map<string, AbortController>>(new Map())

  // Subscribe to offline state changes
  React.useEffect(() => {
    const unsubscribe = OfflineHandlingService.subscribe((state) => {
      setIsOffline(!state.isOnline)
      
      // If back online, retry failed uploads
      if (state.isOnline) {
        retryFailedUploads()
      }
    })

    return unsubscribe
  }, [])

  // Notify parent of progress changes
  React.useEffect(() => {
    onUploadProgress?.(uploads)
  }, [uploads, onUploadProgress])

  const generateUploadId = () => `upload_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`

  const validateFiles = (files: File[]): { valid: File[]; errors: AppError[] } => {
    const valid: File[] = []
    const errors: AppError[] = []

    // Check total file count
    if (uploads.length + files.length > maxFiles) {
      errors.push(ErrorHandlingService.createError(
        ErrorType.VALIDATION,
        'TOO_MANY_FILES',
        `Cannot upload more than ${maxFiles} files at once`,
        { operation: 'file_validation' }
      ))
      return { valid, errors }
    }

    for (const file of files) {
      // Check file size
      if (file.size > maxFileSize) {
        errors.push(ErrorHandlingService.createError(
          ErrorType.VALIDATION,
          'FILE_TOO_LARGE',
          `File "${file.name}" is too large`,
          { operation: 'file_validation', fileName: file.name, fileSize: file.size }
        ))
        continue
      }

      // Check file type
      const isValidType = acceptedTypes.some(type => {
        if (type.endsWith('/*')) {
          return file.type.startsWith(type.slice(0, -1))
        }
        return file.type === type
      })

      if (!isValidType) {
        errors.push(ErrorHandlingService.createError(
          ErrorType.VALIDATION,
          'INVALID_FILE_TYPE',
          `File type "${file.type}" is not supported`,
          { operation: 'file_validation', fileName: file.name }
        ))
        continue
      }

      // Check for empty files
      if (file.size === 0) {
        errors.push(ErrorHandlingService.createError(
          ErrorType.VALIDATION,
          'EMPTY_FILE',
          `File "${file.name}" is empty`,
          { operation: 'file_validation', fileName: file.name }
        ))
        continue
      }

      valid.push(file)
    }

    return { valid, errors }
  }

  const uploadFile = async (uploadProgress: UploadProgress): Promise<void> => {
    const { id, file } = uploadProgress
    const abortController = new AbortController()
    abortControllers.current.set(id, abortController)

    try {
      // Update status to uploading
      setUploads(prev => prev.map(u => 
        u.id === id ? { ...u, status: 'uploading' as const } : u
      ))

      const formData = new FormData()
      formData.append('file', file)
      formData.append('projectId', projectId)
      if (folderId) formData.append('folderId', folderId)
      if (uploadProgress.resumeFrom) {
        formData.append('resumeFrom', uploadProgress.resumeFrom.toString())
      }

      const response = await fetch('/api/assets/upload', {
        method: 'POST',
        body: formData,
        signal: abortController.signal
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error?.message || 'Upload failed')
      }

      const result = await response.json()

      // Update status to completed
      setUploads(prev => prev.map(u => 
        u.id === id ? { ...u, status: 'completed' as const, progress: 100 } : u
      ))

      // Notify completion
      onUploadComplete?.([result.asset])

    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Upload was cancelled
        setUploads(prev => prev.map(u => 
          u.id === id ? { ...u, status: 'cancelled' as const } : u
        ))
        return
      }

      const appError = ErrorHandlingService.createError(
        ErrorType.STORAGE,
        'UPLOAD_FAILED',
        error instanceof Error ? error.message : 'Upload failed',
        { 
          operation: 'file_upload',
          fileName: file.name,
          fileSize: file.size,
          projectId,
          folderId
        }
      )

      // Update upload with error
      setUploads(prev => prev.map(u => 
        u.id === id ? { 
          ...u, 
          status: 'error' as const, 
          error: appError,
          retryCount: u.retryCount + 1
        } : u
      ))

      onUploadError?.(appError)

      // If offline, queue the operation
      if (!OfflineHandlingService.isOnline()) {
        try {
          // Convert file to data URL for offline storage
          const reader = new FileReader()
          const fileData = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(file)
          })

          OfflineHandlingService.queueOperation('upload', {
            projectId,
            folderId,
            fileName: file.name,
            fileData
          }, 1, 3)

          // Update status to show it's queued
          setUploads(prev => prev.map(u => 
            u.id === id ? { ...u, status: 'pending' as const } : u
          ))
        } catch (queueError) {
          console.error('Failed to queue upload for offline:', queueError)
        }
      }
    } finally {
      abortControllers.current.delete(id)
    }
  }

  const handleFiles = useCallback(async (files: File[]) => {
    const { valid, errors } = validateFiles(files)

    // Show validation errors
    errors.forEach(error => onUploadError?.(error))

    if (valid.length === 0) return

    // Create upload progress entries
    const newUploads: UploadProgress[] = valid.map(file => ({
      id: generateUploadId(),
      file,
      progress: 0,
      status: 'pending' as const,
      retryCount: 0
    }))

    setUploads(prev => [...prev, ...newUploads])

    // Start uploads
    for (const upload of newUploads) {
      uploadFile(upload)
    }
  }, [projectId, folderId, maxFiles, maxFileSize, acceptedTypes])

  const retryUpload = useCallback((uploadId: string) => {
    const upload = uploads.find(u => u.id === uploadId)
    if (!upload || upload.status !== 'error') return

    // Reset error state and retry
    setUploads(prev => prev.map(u => 
      u.id === uploadId ? { 
        ...u, 
        status: 'pending' as const, 
        error: undefined,
        progress: 0
      } : u
    ))

    uploadFile(upload)
  }, [uploads])

  const retryFailedUploads = useCallback(() => {
    const failedUploads = uploads.filter(u => u.status === 'error')
    failedUploads.forEach(upload => retryUpload(upload.id))
  }, [uploads, retryUpload])

  const cancelUpload = useCallback((uploadId: string) => {
    const abortController = abortControllers.current.get(uploadId)
    if (abortController) {
      abortController.abort()
    }

    setUploads(prev => prev.map(u => 
      u.id === uploadId ? { ...u, status: 'cancelled' as const } : u
    ))
  }, [])

  const removeUpload = useCallback((uploadId: string) => {
    cancelUpload(uploadId)
    setUploads(prev => prev.filter(u => u.id !== uploadId))
  }, [cancelUpload])

  const clearCompleted = useCallback(() => {
    setUploads(prev => prev.filter(u => u.status !== 'completed'))
  }, [])

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }, [handleFiles])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    handleFiles(files)
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [handleFiles])

  const getStatusColor = (status: UploadProgress['status']) => {
    switch (status) {
      case 'completed': return 'text-green-600'
      case 'error': return 'text-red-600'
      case 'uploading': return 'text-blue-600'
      case 'processing': return 'text-yellow-600'
      case 'cancelled': return 'text-gray-500'
      default: return 'text-gray-600'
    }
  }

  const getStatusIcon = (status: UploadProgress['status']) => {
    switch (status) {
      case 'completed': return '✓'
      case 'error': return '✗'
      case 'uploading': return '↑'
      case 'processing': return '⚙'
      case 'cancelled': return '⊘'
      case 'pending': return '⏳'
      default: return '○'
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Zone */}
      <div
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}
          ${isOffline ? 'border-yellow-500 bg-yellow-50' : ''}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="space-y-4">
          <div className="text-4xl">📁</div>
          
          {isOffline ? (
            <div className="text-yellow-700">
              <p className="font-medium">You're offline</p>
              <p className="text-sm">Files will be uploaded when connection is restored</p>
            </div>
          ) : (
            <div>
              <p className="text-lg font-medium text-gray-700">
                Drop files here or click to browse
              </p>
              <p className="text-sm text-gray-500">
                Maximum {maxFiles} files, up to {Math.round(maxFileSize / (1024 * 1024))}MB each
              </p>
            </div>
          )}
          
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Choose Files
          </button>
        </div>
      </div>

      {/* Upload Progress */}
      {uploads.length > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="font-medium text-gray-700">
              Uploads ({uploads.filter(u => u.status === 'completed').length}/{uploads.length})
            </h3>
            <div className="space-x-2">
              <button
                onClick={retryFailedUploads}
                className="text-sm text-blue-600 hover:text-blue-700"
                disabled={!uploads.some(u => u.status === 'error')}
              >
                Retry Failed
              </button>
              <button
                onClick={clearCompleted}
                className="text-sm text-gray-600 hover:text-gray-700"
                disabled={!uploads.some(u => u.status === 'completed')}
              >
                Clear Completed
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-64 overflow-y-auto">
            {uploads.map(upload => (
              <div key={upload.id} className="border rounded-lg p-3 bg-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    <span className={`text-lg ${getStatusColor(upload.status)}`}>
                      {getStatusIcon(upload.status)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-700 truncate">
                        {upload.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(upload.file.size / (1024 * 1024)).toFixed(1)} MB
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {upload.status === 'uploading' && (
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${upload.progress}%` }}
                        />
                      </div>
                    )}

                    {upload.status === 'error' && upload.error && (
                      <div className="text-xs text-red-600 max-w-xs">
                        {upload.error.userMessage}
                        {upload.error.retryable && (
                          <button
                            onClick={() => retryUpload(upload.id)}
                            className="ml-2 text-blue-600 hover:text-blue-700"
                          >
                            Retry
                          </button>
                        )}
                      </div>
                    )}

                    {(upload.status === 'uploading' || upload.status === 'pending') && (
                      <button
                        onClick={() => cancelUpload(upload.id)}
                        className="text-xs text-red-600 hover:text-red-700"
                      >
                        Cancel
                      </button>
                    )}

                    <button
                      onClick={() => removeUpload(upload.id)}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {upload.error && upload.error.recoveryActions.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-600 mb-1">Suggested actions:</p>
                    <div className="flex flex-wrap gap-1">
                      {upload.error.recoveryActions.slice(0, 2).map((action, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            if (action.type === 'retry') {
                              retryUpload(upload.id)
                            }
                          }}
                          className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          {action.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Offline Status */}
      {isOffline && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-center space-x-2">
            <span className="text-yellow-600">⚠️</span>
            <div>
              <p className="text-sm font-medium text-yellow-800">
                You're currently offline
              </p>
              <p className="text-xs text-yellow-700">
                Files will be queued and uploaded automatically when connection is restored
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}