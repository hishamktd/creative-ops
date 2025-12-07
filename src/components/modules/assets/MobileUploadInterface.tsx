'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { 
  X, 
  Camera, 
  Upload, 
  Image as ImageIcon, 
  Video, 
  FileText, 
  Music,
  Check,
  AlertCircle,
  Trash2,
  RotateCw,
  FlipHorizontal
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useMobileDetection } from '@/lib/hooks/useMobileDetection'
import { FileValidationService, ValidationResult } from '@/lib/services/fileValidation'
import { StorageService } from '@/lib/services/storage'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'

export interface MobileUploadInterfaceProps {
  projectId?: string
  folderId?: string | null
  isOpen: boolean
  onClose: () => void
  onUploadComplete?: (assets: any[]) => void
  className?: string
}

interface UploadFile {
  id: string
  file: File
  preview?: string
  progress: number
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error'
  error?: string
  validation?: ValidationResult
}

interface CameraState {
  isActive: boolean
  stream: MediaStream | null
  facingMode: 'user' | 'environment'
  isRecording: boolean
  recordedChunks: Blob[]
}

export function MobileUploadInterface({
  projectId,
  folderId,
  isOpen,
  onClose,
  onUploadComplete,
  className = ''
}: MobileUploadInterfaceProps) {
  const { user } = useAuth()
  const { isMobile, isTouchDevice } = useMobileDetection()
  
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [activeTab, setActiveTab] = useState<'files' | 'camera' | 'queue'>('files')
  const [cameraState, setCameraState] = useState<CameraState>({
    isActive: false,
    stream: null,
    facingMode: 'environment',
    isRecording: false,
    recordedChunks: []
  })
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)

  // Initialize camera
  const startCamera = useCallback(async () => {
    try {
      const constraints = {
        video: {
          facingMode: cameraState.facingMode,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      
      setCameraState(prev => ({ ...prev, isActive: true, stream }))
    } catch (error) {
      console.error('Error accessing camera:', error)
      alert('Unable to access camera. Please check permissions.')
    }
  }, [cameraState.facingMode])

  // Stop camera
  const stopCamera = useCallback(() => {
    if (cameraState.stream) {
      cameraState.stream.getTracks().forEach(track => track.stop())
    }
    setCameraState(prev => ({ 
      ...prev, 
      isActive: false, 
      stream: null, 
      isRecording: false,
      recordedChunks: []
    }))
  }, [cameraState.stream])

  // Switch camera
  const switchCamera = useCallback(() => {
    stopCamera()
    setCameraState(prev => ({ 
      ...prev, 
      facingMode: prev.facingMode === 'user' ? 'environment' : 'user' 
    }))
  }, [stopCamera])

  // Take photo
  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context) return

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Convert to blob
    canvas.toBlob((blob) => {
      if (blob) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const file = new File([blob], `photo-${timestamp}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now()
        })

        addFileToQueue(file)
      }
    }, 'image/jpeg', 0.9)
  }, [])

  // Start video recording
  const startVideoRecording = useCallback(() => {
    if (!cameraState.stream) return

    try {
      const mediaRecorder = new MediaRecorder(cameraState.stream, {
        mimeType: 'video/webm;codecs=vp9'
      })

      mediaRecorderRef.current = mediaRecorder
      const chunks: Blob[] = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' })
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
        const file = new File([blob], `video-${timestamp}.webm`, {
          type: 'video/webm',
          lastModified: Date.now()
        })

        addFileToQueue(file)
        setCameraState(prev => ({ ...prev, recordedChunks: [] }))
      }

      mediaRecorder.start()
      setCameraState(prev => ({ ...prev, isRecording: true, recordedChunks: chunks }))
    } catch (error) {
      console.error('Error starting video recording:', error)
      alert('Video recording not supported on this device.')
    }
  }, [cameraState.stream])

  // Stop video recording
  const stopVideoRecording = useCallback(() => {
    if (mediaRecorderRef.current && cameraState.isRecording) {
      mediaRecorderRef.current.stop()
      setCameraState(prev => ({ ...prev, isRecording: false }))
    }
  }, [cameraState.isRecording])

  // Add file to upload queue
  const addFileToQueue = useCallback(async (file: File) => {
    const uploadFile: UploadFile = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      progress: 0,
      status: 'pending'
    }

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setUploadFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, preview: e.target?.result as string }
            : f
        ))
      }
      reader.readAsDataURL(file)
    }

    setUploadFiles(prev => [...prev, uploadFile])

    // Validate file
    try {
      const validation = await FileValidationService.validateFile(file)
      setUploadFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { 
              ...f, 
              validation, 
              status: validation.isValid ? 'pending' : 'error',
              error: validation.isValid ? undefined : validation.errors.join(', ')
            }
          : f
      ))
    } catch (error) {
      setUploadFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'error', error: 'Validation failed' }
          : f
      ))
    }

    // Switch to queue tab
    setActiveTab('queue')
  }, [])

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    files.forEach(addFileToQueue)
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [addFileToQueue])

  // Remove file from queue
  const removeFile = useCallback((fileId: string) => {
    setUploadFiles(prev => prev.filter(f => f.id !== fileId))
  }, [])

  // Start upload process
  const startUpload = useCallback(async () => {
    const validFiles = uploadFiles.filter(f => f.status === 'pending' && f.validation?.isValid)
    if (validFiles.length === 0) return

    setIsUploading(true)

    try {
      const uploadPromises = validFiles.map(async (uploadFile) => {
        try {
          // Update status
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

          // Update status
          setUploadFiles(prev => prev.map(f => 
            f.id === uploadFile.id ? { ...f, status: 'processing' } : f
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

          // Update status
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
        
        // Clear completed uploads after a delay
        setTimeout(() => {
          setUploadFiles(prev => prev.filter(f => f.status !== 'completed'))
        }, 2000)
      }

    } finally {
      setIsUploading(false)
    }
  }, [uploadFiles, projectId, folderId, user?.id, onUploadComplete])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  // Start camera when tab is selected
  useEffect(() => {
    if (activeTab === 'camera' && !cameraState.isActive) {
      startCamera()
    } else if (activeTab !== 'camera' && cameraState.isActive) {
      stopCamera()
    }
  }, [activeTab, cameraState.isActive, startCamera, stopCamera])

  if (!isOpen) return null

  return (
    <div className={`fixed inset-0 z-50 bg-white ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Upload Files</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="p-2"
        >
          <X size={20} />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('files')}
          className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'files'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          <Upload size={16} className="inline mr-2" />
          Files
        </button>
        
        {isTouchDevice && (
          <button
            onClick={() => setActiveTab('camera')}
            className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'camera'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <Camera size={16} className="inline mr-2" />
            Camera
          </button>
        )}
        
        <button
          onClick={() => setActiveTab('queue')}
          className={`flex-1 py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'queue'
              ? 'border-primary text-primary'
              : 'border-transparent text-gray-600 hover:text-gray-900'
          }`}
        >
          Queue
          {uploadFiles.length > 0 && (
            <Badge variant="info" className="ml-2 text-xs">
              {uploadFiles.length}
            </Badge>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Files Tab */}
        {activeTab === 'files' && (
          <div className="p-4 space-y-4">
            {/* File Input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
            />
            
            {/* Upload Options */}
            <div className="grid grid-cols-2 gap-4">
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="h-24 flex-col gap-2"
                variant="outline"
              >
                <ImageIcon size={24} />
                <span className="text-sm">Photos</span>
              </Button>
              
              <Button
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'video/*'
                    fileInputRef.current.click()
                  }
                }}
                className="h-24 flex-col gap-2"
                variant="outline"
              >
                <Video size={24} />
                <span className="text-sm">Videos</span>
              </Button>
              
              <Button
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = '.pdf,.doc,.docx'
                    fileInputRef.current.click()
                  }
                }}
                className="h-24 flex-col gap-2"
                variant="outline"
              >
                <FileText size={24} />
                <span className="text-sm">Documents</span>
              </Button>
              
              <Button
                onClick={() => {
                  if (fileInputRef.current) {
                    fileInputRef.current.accept = 'audio/*'
                    fileInputRef.current.click()
                  }
                }}
                className="h-24 flex-col gap-2"
                variant="outline"
              >
                <Music size={24} />
                <span className="text-sm">Audio</span>
              </Button>
            </div>

            {/* Instructions */}
            <div className="text-center text-gray-600 text-sm">
              <p>Select files from your device to upload</p>
              <p className="mt-1">Supported: Images, Videos, Documents, Audio</p>
            </div>
          </div>
        )}

        {/* Camera Tab */}
        {activeTab === 'camera' && (
          <div className="relative h-full">
            {cameraState.isActive ? (
              <>
                {/* Video Preview */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                
                {/* Hidden canvas for photo capture */}
                <canvas ref={canvasRef} className="hidden" />
                
                {/* Camera Controls */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-6">
                  <div className="flex items-center justify-center gap-6">
                    {/* Switch Camera */}
                    <Button
                      onClick={switchCamera}
                      className="bg-white/20 text-white hover:bg-white/30 p-3 rounded-full"
                    >
                      <FlipHorizontal size={20} />
                    </Button>
                    
                    {/* Capture Photo */}
                    <Button
                      onClick={takePhoto}
                      className="bg-white text-black hover:bg-gray-200 w-16 h-16 rounded-full"
                    >
                      <Camera size={24} />
                    </Button>
                    
                    {/* Record Video */}
                    <Button
                      onClick={cameraState.isRecording ? stopVideoRecording : startVideoRecording}
                      className={`p-3 rounded-full ${
                        cameraState.isRecording
                          ? 'bg-red-500 text-white hover:bg-red-600'
                          : 'bg-white/20 text-white hover:bg-white/30'
                      }`}
                    >
                      {cameraState.isRecording ? (
                        <div className="w-5 h-5 bg-white rounded-sm" />
                      ) : (
                        <Video size={20} />
                      )}
                    </Button>
                  </div>
                  
                  {cameraState.isRecording && (
                    <div className="text-center mt-3">
                      <Badge variant="error" className="text-sm">
                        Recording...
                      </Badge>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Camera size={48} className="mx-auto mb-4 text-gray-400" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Camera Access</h3>
                  <p className="text-gray-600 mb-4">Allow camera access to take photos and videos</p>
                  <Button onClick={startCamera}>
                    Enable Camera
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Queue Tab */}
        {activeTab === 'queue' && (
          <div className="p-4">
            {uploadFiles.length === 0 ? (
              <div className="text-center py-12">
                <Upload size={48} className="mx-auto mb-4 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No files queued</h3>
                <p className="text-gray-600">Add files to see them here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Upload All Button */}
                {uploadFiles.some(f => f.status === 'pending' && f.validation?.isValid) && (
                  <Button
                    onClick={startUpload}
                    disabled={isUploading}
                    className="w-full mb-4"
                  >
                    {isUploading ? 'Uploading...' : `Upload ${uploadFiles.filter(f => f.status === 'pending' && f.validation?.isValid).length} Files`}
                  </Button>
                )}

                {/* File List */}
                {uploadFiles.map((uploadFile) => (
                  <MobileUploadFileCard
                    key={uploadFile.id}
                    uploadFile={uploadFile}
                    onRemove={removeFile}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Mobile Upload File Card Component
interface MobileUploadFileCardProps {
  uploadFile: UploadFile
  onRemove: (fileId: string) => void
}

function MobileUploadFileCard({ uploadFile, onRemove }: MobileUploadFileCardProps) {
  const getStatusIcon = () => {
    switch (uploadFile.status) {
      case 'completed': return <Check size={16} className="text-green-500" />
      case 'error': return <AlertCircle size={16} className="text-red-500" />
      case 'uploading': case 'processing': return (
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      )
      default: return null
    }
  }

  const getStatusColor = () => {
    switch (uploadFile.status) {
      case 'completed': return 'border-green-200 bg-green-50'
      case 'error': return 'border-red-200 bg-red-50'
      case 'uploading': case 'processing': return 'border-blue-200 bg-blue-50'
      default: return 'border-gray-200 bg-white'
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
    <div className={`border rounded-lg p-3 ${getStatusColor()}`}>
      <div className="flex items-center gap-3">
        {/* Preview/Icon */}
        <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
          {uploadFile.preview ? (
            <img
              src={uploadFile.preview}
              alt={uploadFile.file.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-lg">
              {uploadFile.file.type.startsWith('image/') ? '🖼️' :
               uploadFile.file.type.startsWith('video/') ? '🎥' :
               uploadFile.file.type.startsWith('audio/') ? '🎵' :
               uploadFile.file.type.includes('pdf') ? '📄' : '📁'}
            </div>
          )}
        </div>

        {/* File Info */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-gray-900 truncate">
            {uploadFile.file.name}
          </p>
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span>{formatFileSize(uploadFile.file.size)}</span>
            <span>•</span>
            <span className="capitalize">{uploadFile.status}</span>
            {uploadFile.progress > 0 && uploadFile.status === 'uploading' && (
              <>
                <span>•</span>
                <span>{uploadFile.progress}%</span>
              </>
            )}
          </div>

          {/* Progress Bar */}
          {(uploadFile.status === 'uploading' || uploadFile.status === 'processing') && (
            <div className="mt-2 w-full bg-gray-200 rounded-full h-1">
              <div 
                className="bg-primary h-1 rounded-full transition-all duration-300"
                style={{ width: `${uploadFile.progress}%` }}
              />
            </div>
          )}

          {/* Error Message */}
          {uploadFile.error && (
            <p className="mt-1 text-xs text-red-600">{uploadFile.error}</p>
          )}
        </div>

        {/* Status & Actions */}
        <div className="flex items-center gap-2">
          {getStatusIcon()}
          
          {(uploadFile.status === 'pending' || uploadFile.status === 'error' || uploadFile.status === 'completed') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(uploadFile.id)}
              className="p-1 text-gray-400 hover:text-red-500"
            >
              <Trash2 size={14} />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}