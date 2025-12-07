'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  Maximize, 
  Minimize,
  SkipBack,
  SkipForward,
  RotateCcw,
  Settings,
  Download,
  Share2,
  Bookmark,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export interface VideoPlayerProps {
  videoUrl: string
  videoName: string
  posterUrl?: string
  onTimeUpdate?: (currentTime: number, duration: number) => void
  onClose?: () => void
  className?: string
}

interface VideoState {
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  isFullscreen: boolean
  playbackRate: number
  buffered: number
  seeking: boolean
}

interface VideoSettings {
  quality: string
  playbackRate: number
  subtitles: boolean
}

export function VideoPlayer({
  videoUrl,
  videoName,
  posterUrl,
  onTimeUpdate,
  onClose,
  className = ''
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)
  
  const [videoState, setVideoState] = useState<VideoState>({
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 1,
    isMuted: false,
    isFullscreen: false,
    playbackRate: 1,
    buffered: 0,
    seeking: false
  })
  
  const [videoSettings, setVideoSettings] = useState<VideoSettings>({
    quality: 'auto',
    playbackRate: 1,
    subtitles: false
  })
  
  const [showControls, setShowControls] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(null)

  // Auto-hide controls
  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeout) {
      clearTimeout(controlsTimeout)
    }
    
    setShowControls(true)
    
    if (videoState.isPlaying) {
      const timeout = setTimeout(() => {
        setShowControls(false)
      }, 3000)
      setControlsTimeout(timeout)
    }
  }, [controlsTimeout, videoState.isPlaying])

  // Video event handlers
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const handleLoadedMetadata = () => {
      setVideoState(prev => ({ ...prev, duration: video.duration }))
    }

    const handleTimeUpdate = () => {
      if (!videoState.seeking) {
        setVideoState(prev => ({ ...prev, currentTime: video.currentTime }))
        onTimeUpdate?.(video.currentTime, video.duration)
      }
    }

    const handleProgress = () => {
      if (video.buffered.length > 0) {
        const buffered = video.buffered.end(video.buffered.length - 1)
        setVideoState(prev => ({ ...prev, buffered }))
      }
    }

    const handlePlay = () => {
      setVideoState(prev => ({ ...prev, isPlaying: true }))
      resetControlsTimeout()
    }

    const handlePause = () => {
      setVideoState(prev => ({ ...prev, isPlaying: false }))
      setShowControls(true)
      if (controlsTimeout) {
        clearTimeout(controlsTimeout)
      }
    }

    const handleVolumeChange = () => {
      setVideoState(prev => ({ 
        ...prev, 
        volume: video.volume,
        isMuted: video.muted
      }))
    }

    const handleRateChange = () => {
      setVideoState(prev => ({ ...prev, playbackRate: video.playbackRate }))
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('progress', handleProgress)
    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('volumechange', handleVolumeChange)
    video.addEventListener('ratechange', handleRateChange)

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('progress', handleProgress)
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('volumechange', handleVolumeChange)
      video.removeEventListener('ratechange', handleRateChange)
    }
  }, [videoState.seeking, onTimeUpdate, resetControlsTimeout, controlsTimeout])

  // Mouse movement handler
  useEffect(() => {
    const handleMouseMove = () => {
      resetControlsTimeout()
    }

    const container = containerRef.current
    if (container) {
      container.addEventListener('mousemove', handleMouseMove)
      return () => container.removeEventListener('mousemove', handleMouseMove)
    }
  }, [resetControlsTimeout])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!videoRef.current) return

      switch (e.code) {
        case 'Space':
          e.preventDefault()
          togglePlayPause()
          break
        case 'ArrowLeft':
          e.preventDefault()
          seek(videoState.currentTime - 10)
          break
        case 'ArrowRight':
          e.preventDefault()
          seek(videoState.currentTime + 10)
          break
        case 'ArrowUp':
          e.preventDefault()
          setVolume(Math.min(videoState.volume + 0.1, 1))
          break
        case 'ArrowDown':
          e.preventDefault()
          setVolume(Math.max(videoState.volume - 0.1, 0))
          break
        case 'KeyM':
          e.preventDefault()
          toggleMute()
          break
        case 'KeyF':
          e.preventDefault()
          toggleFullscreen()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [videoState.currentTime, videoState.volume])

  // Control functions
  const togglePlayPause = () => {
    const video = videoRef.current
    if (!video) return

    if (videoState.isPlaying) {
      video.pause()
    } else {
      video.play()
    }
  }

  const seek = (time: number) => {
    const video = videoRef.current
    if (!video) return

    const clampedTime = Math.max(0, Math.min(time, videoState.duration))
    video.currentTime = clampedTime
    setVideoState(prev => ({ ...prev, currentTime: clampedTime }))
  }

  const setVolume = (volume: number) => {
    const video = videoRef.current
    if (!video) return

    video.volume = volume
    video.muted = volume === 0
  }

  const toggleMute = () => {
    const video = videoRef.current
    if (!video) return

    video.muted = !video.muted
  }

  const setPlaybackRate = (rate: number) => {
    const video = videoRef.current
    if (!video) return

    video.playbackRate = rate
    setVideoSettings(prev => ({ ...prev, playbackRate: rate }))
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setVideoState(prev => ({ ...prev, isFullscreen: true }))
    } else {
      document.exitFullscreen()
      setVideoState(prev => ({ ...prev, isFullscreen: false }))
    }
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const progressBar = progressRef.current
    if (!progressBar) return

    const rect = progressBar.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = clickX / rect.width
    const newTime = percentage * videoState.duration

    seek(newTime)
  }

  const handleProgressDrag = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return // Only handle left mouse button
    handleProgressClick(e)
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    const hours = Math.floor(mins / 60)
    
    if (hours > 0) {
      return `${hours}:${(mins % 60).toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const handleDownload = () => {
    const link = document.createElement('a')
    link.href = videoUrl
    link.download = videoName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div 
      ref={containerRef}
      className={`relative bg-black overflow-hidden ${className}`}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        src={videoUrl}
        poster={posterUrl}
        className="w-full h-full object-contain"
        onClick={togglePlayPause}
      />

      {/* Loading Overlay */}
      {videoState.duration === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent mx-auto mb-4"></div>
            <p className="text-white">Loading video...</p>
          </div>
        </div>
      )}

      {/* Play Button Overlay */}
      {!videoState.isPlaying && videoState.duration > 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Button
            variant="primary"
            size="lg"
            onClick={togglePlayPause}
            className="w-20 h-20 rounded-full bg-primary/80 hover:bg-primary backdrop-blur-sm"
          >
            <Play size={32} className="ml-1" />
          </Button>
        </div>
      )}

      {/* Controls Overlay */}
      <div 
        className={`absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Top Controls */}
        <div className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="text-white font-medium">{videoName}</h3>
            <Badge variant="info" className="text-xs">
              {formatTime(videoState.duration)}
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="text-white hover:bg-white/20"
            >
              <Settings size={18} />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              className="text-white hover:bg-white/20"
            >
              <Download size={18} />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="text-white hover:bg-white/20"
            >
              <Share2 size={18} />
            </Button>
          </div>
        </div>

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          {/* Progress Bar */}
          <div 
            ref={progressRef}
            className="w-full h-2 bg-white/20 rounded-full cursor-pointer mb-4 group"
            onClick={handleProgressClick}
            onMouseMove={handleProgressDrag}
          >
            {/* Buffered Progress */}
            <div 
              className="absolute h-full bg-white/40 rounded-full"
              style={{ width: `${(videoState.buffered / videoState.duration) * 100}%` }}
            />
            
            {/* Current Progress */}
            <div 
              className="relative h-full bg-primary rounded-full transition-all duration-150"
              style={{ width: `${(videoState.currentTime / videoState.duration) * 100}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Play/Pause */}
              <Button
                variant="ghost"
                size="sm"
                onClick={togglePlayPause}
                className="text-white hover:bg-white/20 p-2"
              >
                {videoState.isPlaying ? <Pause size={20} /> : <Play size={20} />}
              </Button>

              {/* Skip Controls */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => seek(videoState.currentTime - 10)}
                className="text-white hover:bg-white/20 p-2"
              >
                <SkipBack size={18} />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => seek(videoState.currentTime + 10)}
                className="text-white hover:bg-white/20 p-2"
              >
                <SkipForward size={18} />
              </Button>

              {/* Volume */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleMute}
                  className="text-white hover:bg-white/20 p-2"
                >
                  {videoState.isMuted || videoState.volume === 0 ? 
                    <VolumeX size={18} /> : <Volume2 size={18} />
                  }
                </Button>
                
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={videoState.isMuted ? 0 : videoState.volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  className="w-20 accent-primary"
                />
              </div>

              {/* Time Display */}
              <div className="text-white text-sm font-mono">
                {formatTime(videoState.currentTime)} / {formatTime(videoState.duration)}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Playback Rate */}
              <select
                value={videoState.playbackRate}
                onChange={(e) => setPlaybackRate(Number(e.target.value))}
                className="bg-white/20 text-white border-0 rounded px-2 py-1 text-sm focus:ring-2 focus:ring-primary outline-none"
              >
                <option value={0.25}>0.25x</option>
                <option value={0.5}>0.5x</option>
                <option value={0.75}>0.75x</option>
                <option value={1}>1x</option>
                <option value={1.25}>1.25x</option>
                <option value={1.5}>1.5x</option>
                <option value={2}>2x</option>
              </select>

              {/* Fullscreen */}
              <Button
                variant="ghost"
                size="sm"
                onClick={toggleFullscreen}
                className="text-white hover:bg-white/20 p-2"
              >
                {videoState.isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
              </Button>
            </div>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="absolute top-16 right-4 bg-[#1d150c]/95 backdrop-blur-sm rounded-lg border border-[#493622] p-4 min-w-[200px]">
            <h4 className="text-white font-medium mb-3">Video Settings</h4>
            
            <div className="space-y-3">
              <div>
                <label className="text-[#cbad90] text-sm block mb-1">Quality</label>
                <select
                  value={videoSettings.quality}
                  onChange={(e) => setVideoSettings(prev => ({ ...prev, quality: e.target.value }))}
                  className="w-full bg-[#493622] text-white border border-[#684d31] rounded px-2 py-1 text-sm"
                >
                  <option value="auto">Auto</option>
                  <option value="1080p">1080p</option>
                  <option value="720p">720p</option>
                  <option value="480p">480p</option>
                  <option value="360p">360p</option>
                </select>
              </div>
              
              <div>
                <label className="text-[#cbad90] text-sm block mb-1">Playback Speed</label>
                <select
                  value={videoSettings.playbackRate}
                  onChange={(e) => setPlaybackRate(Number(e.target.value))}
                  className="w-full bg-[#493622] text-white border border-[#684d31] rounded px-2 py-1 text-sm"
                >
                  <option value={0.25}>0.25x</option>
                  <option value={0.5}>0.5x</option>
                  <option value={0.75}>0.75x</option>
                  <option value={1}>Normal</option>
                  <option value={1.25}>1.25x</option>
                  <option value={1.5}>1.5x</option>
                  <option value={2}>2x</option>
                </select>
              </div>
              
              <div className="flex items-center justify-between">
                <label className="text-[#cbad90] text-sm">Subtitles</label>
                <input
                  type="checkbox"
                  checked={videoSettings.subtitles}
                  onChange={(e) => setVideoSettings(prev => ({ ...prev, subtitles: e.target.checked }))}
                  className="accent-primary"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}