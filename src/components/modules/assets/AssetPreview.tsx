'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Download, 
  Share2, 
  Heart, 
  MessageCircle,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Crop,
  RotateCcw,
  Save,
  Undo,
  Info,
  Tag,
  Clock,
  User,
  FileText,
  Image as ImageIcon,
  Film,
  File,
  PinIcon,
  Eye,
  Calendar,
  Lightbulb,
  CheckSquare,
  Edit3,
  Move
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { EnhancedAsset, Comment, AssetVersion } from '@/types'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { VideoPlayer } from './VideoPlayer'
import { PDFViewer } from './PDFViewer'
import { ImageEditor, EditChanges } from './ImageEditor'

export interface AssetPreviewProps {
  asset: EnhancedAsset
  isOpen: boolean
  onClose: () => void
  showMetadata?: boolean
  allowEditing?: boolean
  onVersionChange?: (version: AssetVersion) => void
  onAssetUpdate?: (asset: EnhancedAsset) => void
  className?: string
}

interface ViewerState {
  zoom: number
  rotation: number
  panX: number
  panY: number
  isFullscreen: boolean
}

interface EditState {
  isEditing: boolean
  cropArea?: {
    x: number
    y: number
    width: number
    height: number
  }
  rotation: number
  hasChanges: boolean
}

interface VideoState {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
}

export function AssetPreview({
  asset,
  isOpen,
  onClose,
  showMetadata = true,
  allowEditing = true,
  onVersionChange,
  onAssetUpdate,
  className = ''
}: AssetPreviewProps) {
  const { user } = useAuth()
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // State management
  const [viewerState, setViewerState] = useState<ViewerState>({
    zoom: 1,
    rotation: 0,
    panX: 0,
    panY: 0,
    isFullscreen: false
  })

  const [editState, setEditState] = useState<EditState>({
    isEditing: false,
    rotation: 0,
    hasChanges: false
  })

  const [videoState, setVideoState] = useState<VideoState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: false
  })

  const [comments, setComments] = useState<Comment[]>([])
  const [versions, setVersions] = useState<AssetVersion[]>([])
  const [currentVersion, setCurrentVersion] = useState<AssetVersion | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'general' | 'pinned' | 'tasks'>('pinned')
  const [newComment, setNewComment] = useState('')
  const [pinnedComments, setPinnedComments] = useState<Comment[]>([])
  const [showImageEditor, setShowImageEditor] = useState(false)
  const [addingPinnedComment, setAddingPinnedComment] = useState(false)
  const [pinnedCommentPosition, setPinnedCommentPosition] = useState<{ x: number; y: number } | null>(null)
  const [tempPinnedComment, setTempPinnedComment] = useState('')

  // File type detection
  const isImage = asset.file_type.startsWith('image/')
  const isVideo = asset.file_type.startsWith('video/')
  const isPDF = asset.file_type === 'application/pdf'
  const isAudio = asset.file_type.startsWith('audio/')

  // Fetch asset data
  useEffect(() => {
    if (isOpen && asset.id) {
      fetchComments()
      fetchVersions()
      fetchPinnedComments()
    }
  }, [isOpen, asset.id])

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          users:user_id (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('asset_id', asset.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      setComments(data || [])
    } catch (error) {
      console.error('Error fetching comments:', error)
    }
  }

  const fetchVersions = async () => {
    try {
      const { data, error } = await supabase
        .from('asset_versions')
        .select(`
          *,
          users:uploaded_by (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('asset_id', asset.id)
        .order('version', { ascending: false })

      if (error) throw error
      setVersions(data || [])
      if (data && data.length > 0) {
        setCurrentVersion(data[0])
      }
    } catch (error) {
      console.error('Error fetching versions:', error)
    }
  }

  const fetchPinnedComments = async () => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          users:user_id (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('asset_id', asset.id)
        .not('pin_x', 'is', null)
        .not('pin_y', 'is', null)

      if (error) throw error
      setPinnedComments(data || [])
    } catch (error) {
      console.error('Error fetching pinned comments:', error)
    }
  }

  // Viewer controls
  const handleZoomIn = () => {
    setViewerState(prev => ({ ...prev, zoom: Math.min(prev.zoom * 1.5, 5) }))
  }

  const handleZoomOut = () => {
    setViewerState(prev => ({ ...prev, zoom: Math.max(prev.zoom / 1.5, 0.1) }))
  }

  const handleRotate = (direction: 'cw' | 'ccw') => {
    const increment = direction === 'cw' ? 90 : -90
    setViewerState(prev => ({ ...prev, rotation: (prev.rotation + increment) % 360 }))
  }

  const handleResetView = () => {
    setViewerState(prev => ({ ...prev, zoom: 1, rotation: 0, panX: 0, panY: 0 }))
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setViewerState(prev => ({ ...prev, isFullscreen: true }))
    } else {
      document.exitFullscreen()
      setViewerState(prev => ({ ...prev, isFullscreen: false }))
    }
  }

  // Video controls
  const togglePlayPause = () => {
    if (videoRef.current) {
      if (videoState.isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setVideoState(prev => ({ ...prev, isPlaying: !prev.isPlaying }))
    }
  }

  const handleVolumeChange = (volume: number) => {
    if (videoRef.current) {
      videoRef.current.volume = volume
      setVideoState(prev => ({ ...prev, volume, isMuted: volume === 0 }))
    }
  }

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !videoState.isMuted
      videoRef.current.muted = newMuted
      setVideoState(prev => ({ ...prev, isMuted: newMuted }))
    }
  }

  // Image editing
  const startEditing = () => {
    setShowImageEditor(true)
  }

  const handleImageSave = async (editedImageBlob: Blob, changes: EditChanges) => {
    setLoading(true)
    try {
      // Upload the edited image as a new version
      const fileName = `${asset.name}_v${asset.version + 1}.png`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('assets')
        .upload(`${asset.project_id}/${fileName}`, editedImageBlob)

      if (uploadError) throw uploadError

      // Create new asset version record
      const { data: versionData, error: versionError } = await supabase
        .from('asset_versions')
        .insert({
          asset_id: asset.id,
          version: asset.version + 1,
          file_url: supabase.storage.from('assets').getPublicUrl(uploadData.path).data.publicUrl,
          uploaded_by: user?.id,
          changes_description: changes.description
        })
        .select()
        .single()

      if (versionError) throw versionError

      // Update asset version
      const { error: updateError } = await supabase
        .from('assets')
        .update({ version: asset.version + 1 })
        .eq('id', asset.id)

      if (updateError) throw updateError

      // Refresh data
      await fetchVersions()
      setShowImageEditor(false)
      
      // Notify parent component
      if (onAssetUpdate) {
        onAssetUpdate({ ...asset, version: asset.version + 1 })
      }
    } catch (error) {
      console.error('Error saving edited image:', error)
    } finally {
      setLoading(false)
    }
  }

  const cancelImageEditing = () => {
    setShowImageEditor(false)
  }

  // Comment handling
  const addComment = async () => {
    if (!newComment.trim() || !user) return

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          asset_id: asset.id,
          project_id: asset.project_id,
          user_id: user.id,
          content: newComment.trim()
        })
        .select(`
          *,
          users:user_id (
            id,
            full_name,
            avatar_url
          )
        `)
        .single()

      if (error) throw error

      setComments(prev => [...prev, data])
      setNewComment('')
    } catch (error) {
      console.error('Error adding comment:', error)
    }
  }

  const addPinnedComment = async (x: number, y: number, content: string) => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('comments')
        .insert({
          asset_id: asset.id,
          project_id: asset.project_id,
          user_id: user.id,
          content,
          pin_x: x,
          pin_y: y
        })
        .select(`
          *,
          users:user_id (
            id,
            full_name,
            avatar_url
          )
        `)
        .single()

      if (error) throw error

      setPinnedComments(prev => [...prev, data])
    } catch (error) {
      console.error('Error adding pinned comment:', error)
    }
  }

  // Handle clicking on the asset to add pinned comments
  const handleAssetClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isImage || !addingPinnedComment) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    setPinnedCommentPosition({ x, y })
  }

  const savePinnedComment = async () => {
    if (!pinnedCommentPosition || !tempPinnedComment.trim()) return

    await addPinnedComment(pinnedCommentPosition.x, pinnedCommentPosition.y, tempPinnedComment)
    
    // Reset state
    setPinnedCommentPosition(null)
    setTempPinnedComment('')
    setAddingPinnedComment(false)
  }

  const cancelPinnedComment = () => {
    setPinnedCommentPosition(null)
    setTempPinnedComment('')
    setAddingPinnedComment(false)
  }

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!isOpen) return null

  return (
    <div className={`fixed inset-0 z-50 bg-background-dark ${className}`}>
      <div ref={containerRef} className="flex h-full">
        {/* Main Viewer Area */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="flex items-center justify-between p-4 border-b border-[#493622]">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="text-white hover:bg-[#493622]"
              >
                <X size={20} />
              </Button>
              
              <div className="flex items-center gap-3">
                <div className="text-primary">
                  {isImage && <ImageIcon size={24} />}
                  {isVideo && <Film size={24} />}
                  {isPDF && <FileText size={24} />}
                  {!isImage && !isVideo && !isPDF && <File size={24} />}
                </div>
                <div>
                  <h2 className="text-white text-lg font-bold font-display">{asset.name}</h2>
                  <div className="flex items-center gap-2 text-sm text-[#cbad90]">
                    <span>Version {asset.version}</span>
                    <Badge variant="info" className="text-xs">
                      {asset.file_type}
                    </Badge>
                    <span>{formatFileSize(asset.file_size)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Viewer Controls */}
              {isImage && !showImageEditor && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleZoomOut}
                    className="text-white hover:bg-[#493622]"
                  >
                    <ZoomOut size={18} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleZoomIn}
                    className="text-white hover:bg-[#493622]"
                  >
                    <ZoomIn size={18} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRotate('ccw')}
                    className="text-white hover:bg-[#493622]"
                  >
                    <RotateCcw size={18} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRotate('cw')}
                    className="text-white hover:bg-[#493622]"
                  >
                    <RotateCw size={18} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleResetView}
                    className="text-white hover:bg-[#493622]"
                    title="Reset view"
                  >
                    <Move size={18} />
                  </Button>
                  {allowEditing && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={startEditing}
                      className="text-white hover:bg-[#493622]"
                      title="Edit image"
                    >
                      <Edit3 size={18} />
                    </Button>
                  )}
                </>
              )}

              {(isVideo || isPDF) && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleFullscreen}
                    className="text-white hover:bg-[#493622]"
                  >
                    {viewerState.isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
                  </Button>
                </>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(asset.file_url, '_blank')}
                className="text-white hover:bg-[#493622]"
                title="Download"
              >
                <Download size={18} />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="text-white hover:bg-[#493622]"
                title="Share"
              >
                <Share2 size={18} />
              </Button>
            </div>
          </header>

          {/* Viewer Content */}
          <div className="flex-1 bg-[#1d150c] relative overflow-hidden flex items-center justify-center">
            {isImage && !showImageEditor && (
              <div 
                className="relative w-full h-full bg-center bg-no-repeat bg-contain cursor-pointer"
                style={{
                  backgroundImage: `url("${asset.file_url}")`,
                  transform: `scale(${viewerState.zoom}) rotate(${viewerState.rotation}deg) translate(${viewerState.panX}px, ${viewerState.panY}px)`
                }}
                onClick={handleAssetClick}
              >
                {/* Pinned Comments */}
                {pinnedComments.map((comment) => (
                  <div
                    key={comment.id}
                    className="absolute flex items-center justify-center size-8 bg-pink-400 rounded-full shadow-lg cursor-pointer transform hover:scale-110 transition-transform"
                    style={{
                      left: `${comment.pin_x}%`,
                      top: `${comment.pin_y}%`
                    }}
                    title={comment.content}
                  >
                    <Heart size={16} className="text-white" />
                  </div>
                ))}

                {/* Temporary pinned comment position */}
                {pinnedCommentPosition && (
                  <div
                    className="absolute flex items-center justify-center size-8 bg-yellow-400 rounded-full shadow-lg animate-pulse"
                    style={{
                      left: `${pinnedCommentPosition.x}%`,
                      top: `${pinnedCommentPosition.y}%`
                    }}
                  >
                    <Lightbulb size={16} className="text-black" />
                  </div>
                )}
              </div>
            )}

            {isVideo && (
              <VideoPlayer
                videoUrl={asset.file_url}
                videoName={asset.name}
                posterUrl={asset.thumbnail_url}
                className="w-full h-full"
              />
            )}

            {isPDF && (
              <PDFViewer
                fileUrl={asset.file_url}
                fileName={asset.name}
                className="w-full h-full"
              />
            )}

            {isAudio && (
              <div className="flex items-center justify-center w-full h-full">
                <div className="text-center">
                  <div className="w-32 h-32 bg-primary/20 rounded-full flex items-center justify-center mb-6 mx-auto">
                    <Volume2 size={48} className="text-primary" />
                  </div>
                  <h3 className="text-white text-xl font-bold mb-4">{asset.name}</h3>
                  <audio
                    controls
                    src={asset.file_url}
                    className="w-full max-w-md"
                  />
                </div>
              </div>
            )}

            {!isImage && !isVideo && !isPDF && !isAudio && (
              <div className="flex items-center justify-center w-full h-full">
                <div className="text-center">
                  <File size={48} className="text-[#cbad90] mx-auto mb-4" />
                  <h3 className="text-white text-lg font-bold mb-2">{asset.name}</h3>
                  <p className="text-[#cbad90] mb-4">Preview not available for this file type</p>
                  <Button
                    variant="primary"
                    onClick={() => window.open(asset.file_url, '_blank')}
                  >
                    <Download size={16} />
                    Download File
                  </Button>
                </div>
              </div>
            )}

            {/* Add Pin Comment Mode Overlay */}
            {addingPinnedComment && isImage && (
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
                <div className="bg-[#1d150c]/90 backdrop-blur-sm rounded-lg p-4 border border-primary pointer-events-auto">
                  <p className="text-white text-center mb-2">Click on the image to add a pinned comment</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddingPinnedComment(false)}
                    className="w-full"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Pinned Comment Input Modal */}
            {pinnedCommentPosition && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="bg-[#1d150c] rounded-lg p-6 max-w-md w-full mx-4 border border-[#493622]">
                  <h3 className="text-white font-bold mb-4">Add Pinned Comment</h3>
                  
                  <textarea
                    value={tempPinnedComment}
                    onChange={(e) => setTempPinnedComment(e.target.value)}
                    placeholder="What would you like to highlight here?"
                    className="w-full p-3 bg-[#493622] text-white rounded-lg border-0 resize-none focus:ring-2 focus:ring-primary"
                    rows={3}
                    autoFocus
                  />

                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="primary"
                      onClick={savePinnedComment}
                      disabled={!tempPinnedComment.trim()}
                      className="flex-1"
                    >
                      Add Comment
                    </Button>
                    <Button
                      variant="outline"
                      onClick={cancelPinnedComment}
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Image Editor Modal */}
          {showImageEditor && isImage && (
            <ImageEditor
              imageUrl={asset.file_url}
              onSave={handleImageSave}
              onCancel={cancelImageEditing}
            />
          )}
        </div>

        {/* Sidebar */}
        {showMetadata && (
          <div className="w-80 bg-[#1d150c] border-l border-[#493622] flex flex-col">
            {/* Tabs */}
            <div className="pb-3 border-b border-[#684d31] px-4">
              <div className="flex justify-around gap-4">
                <button
                  onClick={() => setActiveTab('general')}
                  className={`flex flex-col items-center justify-center border-b-[3px] gap-1 pb-[7px] pt-2.5 transition-colors ${
                    activeTab === 'general'
                      ? 'border-b-primary text-white'
                      : 'border-b-transparent text-[#cbad90] hover:text-white'
                  }`}
                >
                  <Lightbulb size={20} />
                  <p className="text-sm font-bold leading-normal tracking-[0.015em] font-display">General</p>
                </button>
                
                <button
                  onClick={() => setActiveTab('pinned')}
                  className={`flex flex-col items-center justify-center border-b-[3px] gap-1 pb-[7px] pt-2.5 transition-colors ${
                    activeTab === 'pinned'
                      ? 'border-b-primary text-white'
                      : 'border-b-transparent text-[#cbad90] hover:text-white'
                  }`}
                >
                  <PinIcon size={20} style={{ fontVariationSettings: activeTab === 'pinned' ? "'FILL' 1" : "'FILL' 0" }} />
                  <p className="text-sm font-bold leading-normal tracking-[0.015em] font-display">On Asset</p>
                </button>
                
                <button
                  onClick={() => setActiveTab('tasks')}
                  className={`flex flex-col items-center justify-center border-b-[3px] gap-1 pb-[7px] pt-2.5 transition-colors ${
                    activeTab === 'tasks'
                      ? 'border-b-primary text-white'
                      : 'border-b-transparent text-[#cbad90] hover:text-white'
                  }`}
                >
                  <CheckSquare size={20} />
                  <p className="text-sm font-bold leading-normal tracking-[0.015em] font-display">Tasks</p>
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 flex flex-col overflow-y-auto p-4 gap-4">
              {activeTab === 'general' && (
                <div className="space-y-4">
                  {/* Add Comment */}
                  <div className="space-y-2">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Add a general comment..."
                      className="w-full p-3 bg-[#493622] text-white rounded-lg border-0 resize-none focus:ring-2 focus:ring-primary"
                      rows={3}
                    />
                    <Button
                      onClick={addComment}
                      disabled={!newComment.trim()}
                      size="sm"
                      className="w-full"
                    >
                      Add Comment
                    </Button>
                  </div>

                  {/* General Comments List */}
                  <div className="space-y-4">
                    {comments.filter(comment => !comment.pin_x && !comment.pin_y).map((comment) => (
                      <div key={comment.id} className="flex items-start gap-3">
                        <div 
                          className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-8" 
                          style={{
                            backgroundImage: comment.users?.avatar_url 
                              ? `url("${comment.users.avatar_url}")` 
                              : 'linear-gradient(135deg, #f48c25 0%, #e67e22 100%)'
                          }}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-white font-bold text-sm font-display">
                              {comment.users?.full_name || 'Unknown User'}
                            </p>
                            <p className="text-[#cbad90] text-xs font-display">
                              {new Date(comment.created_at).toLocaleString()}
                            </p>
                          </div>
                          <p className="text-[#e2d5c8] text-sm mt-1 font-display">{comment.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* File Information */}
                  <div className="mt-8">
                    <h3 className="text-white font-bold mb-3 font-display">File Information</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-[#cbad90] font-display">Size:</span>
                        <span className="text-white font-display">{formatFileSize(asset.file_size)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#cbad90] font-display">Type:</span>
                        <span className="text-white font-display">{asset.file_type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#cbad90] font-display">Version:</span>
                        <span className="text-white font-display">{asset.version}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#cbad90] font-display">Uploaded:</span>
                        <span className="text-white font-display">
                          {new Date(asset.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {asset.metadata.width && asset.metadata.height && (
                        <div className="flex justify-between">
                          <span className="text-[#cbad90] font-display">Dimensions:</span>
                          <span className="text-white font-display">
                            {asset.metadata.width} × {asset.metadata.height}
                          </span>
                        </div>
                      )}
                      {asset.metadata.duration && (
                        <div className="flex justify-between">
                          <span className="text-[#cbad90] font-display">Duration:</span>
                          <span className="text-white font-display">
                            {formatDuration(asset.metadata.duration)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tags */}
                  {asset.tags.length > 0 && (
                    <div>
                      <h3 className="text-white font-bold mb-3 font-display">Tags</h3>
                      <div className="flex flex-wrap gap-2">
                        {asset.tags.map((tag, index) => (
                          <Badge key={index} variant="info" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'pinned' && (
                <div className="space-y-4">
                  {/* Add Pinned Comment Button */}
                  {isImage && (
                    <Button
                      onClick={() => setAddingPinnedComment(true)}
                      variant="outline"
                      size="sm"
                      className="w-full flex items-center gap-2"
                      disabled={addingPinnedComment}
                    >
                      <PinIcon size={16} />
                      Add Pinned Comment
                    </Button>
                  )}

                  {/* Pinned Comments */}
                  {pinnedComments.length > 0 ? (
                    <div className="space-y-4">
                      {/* Featured/Pinned Comment */}
                      {pinnedComments.slice(0, 1).map((comment) => (
                        <div key={comment.id} className="bg-primary/10 border-l-2 border-primary p-3 rounded-r-lg">
                          <div className="flex items-start gap-3">
                            <div 
                              className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-8" 
                              style={{
                                backgroundImage: comment.users?.avatar_url 
                                  ? `url("${comment.users.avatar_url}")` 
                                  : 'linear-gradient(135deg, #f48c25 0%, #e67e22 100%)'
                              }}
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-white font-bold text-sm font-display">
                                  {comment.users?.full_name || 'Unknown User'}
                                </p>
                                <p className="text-[#cbad90] text-xs font-display">
                                  {new Date(comment.created_at).toLocaleString()}
                                </p>
                                <PinIcon size={12} className="text-primary ml-auto" style={{ fontVariationSettings: "'FILL' 1" }} />
                              </div>
                              <p className="text-[#e2d5c8] text-sm mt-1 font-display">{comment.content}</p>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Other Pinned Comments */}
                      {pinnedComments.slice(1).map((comment) => (
                        <div key={comment.id} className="flex items-start gap-3">
                          <div 
                            className="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-8" 
                            style={{
                              backgroundImage: comment.users?.avatar_url 
                                ? `url("${comment.users.avatar_url}")` 
                                : 'linear-gradient(135deg, #f48c25 0%, #e67e22 100%)'
                            }}
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-white font-bold text-sm font-display">
                                {comment.users?.full_name || 'Unknown User'}
                              </p>
                              <p className="text-[#cbad90] text-xs font-display">
                                {new Date(comment.created_at).toLocaleString()}
                              </p>
                            </div>
                            <p className="text-[#e2d5c8] text-sm mt-1 font-display">
                              {comment.content} Corresponds to the{' '}
                              <span className="inline-flex items-center justify-center size-4 bg-pink-400 rounded-full">
                                <Heart size={10} className="text-white" />
                              </span>{' '}
                              pin.
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <PinIcon size={48} className="text-[#493622] mx-auto mb-4" />
                      <p className="text-[#cbad90] font-display">No pinned comments yet</p>
                      {isImage && (
                        <p className="text-[#cbad90] text-sm mt-2 font-display">
                          Click "Add Pinned Comment" to highlight specific areas
                        </p>
                      )}
                    </div>
                  )}

                  {/* Version History */}
                  {versions.length > 0 && (
                    <div className="mt-8">
                      <h3 className="text-white font-bold mb-3 font-display">Recent Versions</h3>
                      <div className="space-y-3">
                        {versions.slice(0, 3).map((version) => (
                          <div
                            key={version.id}
                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                              currentVersion?.id === version.id
                                ? 'border-primary bg-primary/10'
                                : 'border-[#493622] hover:border-[#684d31]'
                            }`}
                            onClick={() => {
                              setCurrentVersion(version)
                              onVersionChange?.(version)
                            }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <Badge variant="info" className="text-xs">
                                v{version.version}
                              </Badge>
                              <span className="text-[#cbad90] text-xs font-display">
                                {new Date(version.created_at).toLocaleDateString()}
                              </span>
                            </div>
                            <p className="text-white text-sm font-medium font-display">
                              {version.users?.full_name || 'Unknown User'}
                            </p>
                            {version.changes_description && (
                              <p className="text-[#cbad90] text-xs mt-1 font-display">
                                {version.changes_description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'tasks' && (
                <div className="space-y-4">
                  <div className="text-center py-8">
                    <CheckSquare size={48} className="text-[#493622] mx-auto mb-4" />
                    <p className="text-[#cbad90] font-display">No tasks assigned to this asset</p>
                    <p className="text-[#cbad90] text-sm mt-2 font-display">
                      Tasks related to this asset will appear here
                    </p>
                  </div>
                </div>
              )}

              {/* AI Feature Teaser - matches the original design */}
              <div className="bg-gradient-to-br from-[#493622] to-[#2d2113] p-4 rounded-lg mt-auto mx-2 mb-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-white font-bold font-display">Supercharge Your Feedback!</h3>
                  <span className="text-xs font-bold bg-primary text-background-dark px-2 py-0.5 rounded-full font-display">COMING SOON</span>
                </div>
                <p className="text-[#cbad90] text-sm mt-2 font-display">Soon, our friendly AI will help summarize long conversations for you!</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}