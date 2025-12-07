'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Download, 
  Share2, 
  Heart, 
  MessageCircle,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Info,
  Edit3,
  MoreVertical
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EnhancedAsset } from '@/types'
import { useSwipeGestures } from '@/lib/hooks/useSwipeGestures'
import { useOfflineAssets } from '@/lib/hooks/useOfflineAssets'
import { useMobileDetection } from '@/lib/hooks/useMobileDetection'

export interface MobileAssetPreviewProps {
  asset: EnhancedAsset
  isOpen: boolean
  onClose: () => void
  onNavigate: (direction: 'prev' | 'next') => void
  currentIndex: number
  totalAssets: number
  isOffline: boolean
  className?: string
}

interface ViewerState {
  zoom: number
  rotation: number
  panX: number
  panY: number
}

interface VideoState {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
}

export function MobileAssetPreview({
  asset,
  isOpen,
  onClose,
  onNavigate,
  currentIndex,
  totalAssets,
  isOffline,
  className = ''
}: MobileAssetPreviewProps) {
  const { screenSize, orientation } = useMobileDetection()
  const { getCachedAssetUrl, getCachedThumbnailUrl, isCached } = useOfflineAssets()
  
  const [viewerState, setViewerState] = useState<ViewerState>({
    zoom: 1,
    rotation: 0,
    panX: 0,
    panY: 0
  })
  
  const [videoState, setVideoState] = useState<VideoState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: false
  })
  
  const [showControls, setShowControls] = useState(true)
  const [showInfo, setShowInfo] = useState(false)
  const [showActions, setShowActions] = useState(false)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const controlsTimeoutRef = useRef<NodeJS.Timeout>()

  // File type detection
  const isImage = asset.file_type.startsWith('image/')
  const isVideo = asset.file_type.startsWith('video/')
  const isPDF = asset.file_type === 'application/pdf'
  const isAudio = asset.file_type.startsWith('audio/')

  // Get asset URL (cached or online)
  const assetUrl = isOffline && isCached(asset.id) 
    ? getCachedAssetUrl(asset.id) || asset.file_url
    : asset.file_url

  // Swipe gestures for navigation and zoom
  const { attachListeners } = useSwipeGestures({
    onSwipeLeft: () => onNavigate('next'),
    onSwipeRight: () => onNavigate('prev'),
    onSwipeUp: () => setShowInfo(true),
    onSwipeDown: () => onClose(),
    threshold: 50
  })

  // Attach swipe listeners
  useEffect(() => {
    if (containerRef.current && isOpen) {
      return attachListeners(containerRef.current)
    }
  }, [attachListeners, isOpen])

  // Auto-hide controls
  useEffect(() => {
    if (showControls) {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }
    
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [showControls])

  // Show controls on interaction
  const showControlsTemporarily = useCallback(() => {
    setShowControls(true)
  }, [])

  // Reset viewer state when asset changes
  useEffect(() => {
    setViewerState({
      zoom: 1,
      rotation: 0,
      panX: 0,
      panY: 0
    })
    setVideoState({
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: 1,
      isMuted: false
    })
  }, [asset.id])

  // Viewer controls
  const handleZoomIn = () => {
    setViewerState(prev => ({ ...prev, zoom: Math.min(prev.zoom * 1.5, 5) }))
    showControlsTemporarily()
  }

  const handleZoomOut = () => {
    setViewerState(prev => ({ ...prev, zoom: Math.max(prev.zoom / 1.5, 0.5) }))
    showControlsTemporarily()
  }

  const handleRotate = () => {
    setViewerState(prev => ({ ...prev, rotation: (prev.rotation + 90) % 360 }))
    showControlsTemporarily()
  }

  const handleResetView = () => {
    setViewerState({ zoom: 1, rotation: 0, panX: 0, panY: 0 })
    showControlsTemporarily()
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
    showControlsTemporarily()
  }

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuted = !videoState.isMuted
      videoRef.current.muted = newMuted
      setVideoState(prev => ({ ...prev, isMuted: newMuted }))
    }
    showControlsTemporarily()
  }

  // Handle video events
  const handleVideoLoadedMetadata = () => {
    if (videoRef.current) {
      setVideoState(prev => ({ ...prev, duration: videoRef.current!.duration }))
    }
  }

  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      setVideoState(prev => ({ ...prev, currentTime: videoRef.current!.currentTime }))
    }
  }

  // Format time for video
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  if (!isOpen) return null

  return (
    <div 
      ref={containerRef}
      className={`fixed inset-0 z-50 bg-black ${className}`}
      onClick={showControlsTemporarily}
    >
      {/* Header Controls */}
      <div 
        className={`absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-4 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between">
          {/* Left side */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-white hover:bg-white/20 p-2"
            >
              <X size={20} />
            </Button>
            
            <div className="text-white">
              <p className="font-medium text-sm truncate max-w-[200px]">{asset.name}</p>
              <p className="text-xs text-white/70">
                {currentIndex + 1} of {totalAssets}
              </p>
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowInfo(!showInfo)}
              className="text-white hover:bg-white/20 p-2"
            >
              <Info size={18} />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowActions(!showActions)}
              className="text-white hover:bg-white/20 p-2"
            >
              <MoreVertical size={18} />
            </Button>
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      {totalAssets > 1 && (
        <>
          <button
            onClick={() => onNavigate('prev')}
            className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-black/50 text-white rounded-full p-3 transition-opacity duration-300 ${
              showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            disabled={currentIndex === 0}
          >
            <ChevronLeft size={24} />
          </button>
          
          <button
            onClick={() => onNavigate('next')}
            className={`absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-black/50 text-white rounded-full p-3 transition-opacity duration-300 ${
              showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            disabled={currentIndex === totalAssets - 1}
          >
            <ChevronRight size={24} />
          </button>
        </>
      )}

      {/* Main Content */}
      <div className="w-full h-full flex items-center justify-center">
        {isImage && (
          <div className="relative w-full h-full flex items-center justify-center">
            <img
              ref={imageRef}
              src={assetUrl}
              alt={asset.name}
              className="max-w-full max-h-full object-contain"
              style={{
                transform: `scale(${viewerState.zoom}) rotate(${viewerState.rotation}deg) translate(${viewerState.panX}px, ${viewerState.panY}px)`
              }}
              onLoad={() => showControlsTemporarily()}
            />
          </div>
        )}

        {isVideo && (
          <div className="relative w-full h-full">
            <video
              ref={videoRef}
              src={assetUrl}
              className="w-full h-full object-contain"
              onLoadedMetadata={handleVideoLoadedMetadata}
              onTimeUpdate={handleVideoTimeUpdate}
              onPlay={() => setVideoState(prev => ({ ...prev, isPlaying: true }))}
              onPause={() => setVideoState(prev => ({ ...prev, isPlaying: false }))}
              playsInline
              controls={false}
            />
          </div>
        )}

        {isPDF && (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center text-white">
              <div className="text-6xl mb-4">📄</div>
              <h3 className="text-xl font-bold mb-2">{asset.name}</h3>
              <p className="text-white/70 mb-4">PDF preview not available on mobile</p>
              <Button
                onClick={() => window.open(assetUrl, '_blank')}
                className="bg-white text-black hover:bg-gray-200"
              >
                <Download size={16} className="mr-2" />
                Open PDF
              </Button>
            </div>
          </div>
        )}

        {isAudio && (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center text-white max-w-sm mx-4">
              <div className="w-32 h-32 bg-white/20 rounded-full flex items-center justify-center mb-6 mx-auto">
                <Volume2 size={48} className="text-white" />
              </div>
              <h3 className="text-xl font-bold mb-4">{asset.name}</h3>
              <audio
                controls
                src={assetUrl}
                className="w-full"
              />
            </div>
          </div>
        )}

        {!isImage && !isVideo && !isPDF && !isAudio && (
          <div className="text-center text-white">
            <div className="text-6xl mb-4">📁</div>
            <h3 className="text-xl font-bold mb-2">{asset.name}</h3>
            <p className="text-white/70 mb-4">Preview not available for this file type</p>
            <Button
              onClick={() => window.open(assetUrl, '_blank')}
              className="bg-white text-black hover:bg-gray-200"
            >
              <Download size={16} className="mr-2" />
              Download File
            </Button>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div 
        className={`absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/70 to-transparent p-4 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Image Controls */}
        {isImage && (
          <div className="flex items-center justify-center gap-4 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomOut}
              className="text-white hover:bg-white/20 p-2"
            >
              <ZoomOut size={18} />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomIn}
              className="text-white hover:bg-white/20 p-2"
            >
              <ZoomIn size={18} />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRotate}
              className="text-white hover:bg-white/20 p-2"
            >
              <RotateCw size={18} />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetView}
              className="text-white hover:bg-white/20 px-3 py-2 text-sm"
            >
              Reset
            </Button>
          </div>
        )}

        {/* Video Controls */}
        {isVideo && (
          <div className="space-y-3">
            {/* Progress Bar */}
            <div className="w-full">
              <input
                type="range"
                min="0"
                max={videoState.duration || 0}
                value={videoState.currentTime}
                onChange={(e) => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = parseFloat(e.target.value)
                  }
                }}
                className="w-full h-1 bg-white/30 rounded-lg appearance-none slider"
              />
            </div>
            
            {/* Control Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={togglePlayPause}
                  className="text-white hover:bg-white/20 p-2"
                >
                  {videoState.isPlaying ? <Pause size={20} /> : <Play size={20} />}
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleMute}
                  className="text-white hover:bg-white/20 p-2"
                >
                  {videoState.isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </Button>
                
                <span className="text-white text-sm">
                  {formatTime(videoState.currentTime)} / {formatTime(videoState.duration)}
                </span>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (videoRef.current) {
                    if (document.fullscreenElement) {
                      document.exitFullscreen()
                    } else {
                      videoRef.current.requestFullscreen()
                    }
                  }
                }}
                className="text-white hover:bg-white/20 p-2"
              >
                <Maximize size={18} />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Info Panel */}
      {showInfo && (
        <div className="absolute top-0 right-0 w-80 h-full bg-black/90 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-bold">File Information</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowInfo(false)}
              className="text-white hover:bg-white/20 p-1"
            >
              <X size={16} />
            </Button>
          </div>
          
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-white/70">Name:</span>
              <p className="text-white font-medium">{asset.name}</p>
            </div>
            
            <div>
              <span className="text-white/70">Size:</span>
              <p className="text-white">{formatFileSize(asset.file_size)}</p>
            </div>
            
            <div>
              <span className="text-white/70">Type:</span>
              <p className="text-white">{asset.file_type}</p>
            </div>
            
            <div>
              <span className="text-white/70">Created:</span>
              <p className="text-white">{new Date(asset.created_at).toLocaleDateString()}</p>
            </div>
            
            {asset.metadata.width && asset.metadata.height && (
              <div>
                <span className="text-white/70">Dimensions:</span>
                <p className="text-white">{asset.metadata.width} × {asset.metadata.height}</p>
              </div>
            )}
            
            {asset.metadata.duration && (
              <div>
                <span className="text-white/70">Duration:</span>
                <p className="text-white">{formatTime(asset.metadata.duration)}</p>
              </div>
            )}
            
            {isCached(asset.id) && (
              <div>
                <Badge variant="success" className="text-xs">
                  Available Offline
                </Badge>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions Panel */}
      {showActions && (
        <div className="absolute bottom-20 right-4 bg-black/90 backdrop-blur-sm rounded-lg p-2 min-w-[150px]">
          <div className="space-y-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(assetUrl, '_blank')}
              className="w-full justify-start text-white hover:bg-white/20"
            >
              <Download size={16} className="mr-2" />
              Download
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: asset.name,
                    url: assetUrl
                  })
                }
              }}
              className="w-full justify-start text-white hover:bg-white/20"
            >
              <Share2 size={16} className="mr-2" />
              Share
            </Button>
            
            {isImage && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-white hover:bg-white/20"
              >
                <Edit3 size={16} className="mr-2" />
                Edit
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}