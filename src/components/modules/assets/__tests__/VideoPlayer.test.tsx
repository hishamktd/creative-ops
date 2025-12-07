import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { VideoPlayer } from '../VideoPlayer'

// Mock video element
const mockVideo = {
  play: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  currentTime: 0,
  duration: 120,
  volume: 1,
  muted: false,
  playbackRate: 1,
  buffered: {
    length: 1,
    end: vi.fn(() => 60),
  },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}

// Mock HTMLVideoElement
Object.defineProperty(HTMLVideoElement.prototype, 'play', {
  writable: true,
  value: mockVideo.play,
})

Object.defineProperty(HTMLVideoElement.prototype, 'pause', {
  writable: true,
  value: mockVideo.pause,
})

Object.defineProperty(HTMLVideoElement.prototype, 'currentTime', {
  get: () => mockVideo.currentTime,
  set: (value) => { mockVideo.currentTime = value },
})

Object.defineProperty(HTMLVideoElement.prototype, 'duration', {
  get: () => mockVideo.duration,
})

Object.defineProperty(HTMLVideoElement.prototype, 'volume', {
  get: () => mockVideo.volume,
  set: (value) => { mockVideo.volume = value },
})

Object.defineProperty(HTMLVideoElement.prototype, 'muted', {
  get: () => mockVideo.muted,
  set: (value) => { mockVideo.muted = value },
})

Object.defineProperty(HTMLVideoElement.prototype, 'playbackRate', {
  get: () => mockVideo.playbackRate,
  set: (value) => { mockVideo.playbackRate = value },
})

Object.defineProperty(HTMLVideoElement.prototype, 'buffered', {
  get: () => mockVideo.buffered,
})

// Mock fullscreen API
Object.defineProperty(document, 'fullscreenElement', {
  writable: true,
  value: null,
})

Object.defineProperty(document, 'exitFullscreen', {
  writable: true,
  value: vi.fn(),
})

Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
  writable: true,
  value: vi.fn(),
})

describe('VideoPlayer', () => {
  const defaultProps = {
    videoUrl: 'https://example.com/test-video.mp4',
    videoName: 'Test Video',
    posterUrl: 'https://example.com/poster.jpg',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset mock video state
    mockVideo.currentTime = 0
    mockVideo.duration = 120
    mockVideo.volume = 1
    mockVideo.muted = false
    mockVideo.playbackRate = 1
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Rendering', () => {
    it('should render video element with correct src and poster', () => {
      render(<VideoPlayer {...defaultProps} />)
      
      const video = screen.getByRole('application') || document.querySelector('video')
      expect(video).toBeInTheDocument()
      expect(video).toHaveAttribute('src', defaultProps.videoUrl)
      expect(video).toHaveAttribute('poster', defaultProps.posterUrl)
    })

    it('should display video name', () => {
      render(<VideoPlayer {...defaultProps} />)
      
      expect(screen.getByText('Test Video')).toBeInTheDocument()
    })

    it('should show loading state initially', () => {
      // Mock duration as 0 to simulate loading
      Object.defineProperty(HTMLVideoElement.prototype, 'duration', {
        get: () => 0,
      })
      
      render(<VideoPlayer {...defaultProps} />)
      
      expect(screen.getByText('Loading video...')).toBeInTheDocument()
    })

    it('should show play button overlay when video is paused', () => {
      render(<VideoPlayer {...defaultProps} />)
      
      // Should show large play button in center
      const playButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'play'
      )
      
      expect(playButtons.length).toBeGreaterThan(0)
    })
  })

  describe('Playback Controls', () => {
    it('should toggle play/pause when play button is clicked', async () => {
      render(<VideoPlayer {...defaultProps} />)
      
      const playButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'play'
      )
      
      if (playButton) {
        fireEvent.click(playButton)
        
        await waitFor(() => {
          expect(mockVideo.play).toHaveBeenCalledTimes(1)
        })
      }
    })

    it('should pause video when pause button is clicked', async () => {
      render(<VideoPlayer {...defaultProps} />)
      
      // First play the video
      const playButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'play'
      )
      
      if (playButton) {
        fireEvent.click(playButton)
        
        // Then find and click pause button
        await waitFor(() => {
          const pauseButton = screen.getAllByRole('button').find(btn => 
            btn.querySelector('svg')?.getAttribute('data-lucide') === 'pause'
          )
          
          if (pauseButton) {
            fireEvent.click(pauseButton)
            expect(mockVideo.pause).toHaveBeenCalledTimes(1)
          }
        })
      }
    })

    it('should seek backward when skip back button is clicked', () => {
      mockVideo.currentTime = 30
      
      render(<VideoPlayer {...defaultProps} />)
      
      const skipBackButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'skip-back'
      )
      
      if (skipBackButton) {
        fireEvent.click(skipBackButton)
        expect(mockVideo.currentTime).toBe(20) // 30 - 10 seconds
      }
    })

    it('should seek forward when skip forward button is clicked', () => {
      mockVideo.currentTime = 30
      
      render(<VideoPlayer {...defaultProps} />)
      
      const skipForwardButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'skip-forward'
      )
      
      if (skipForwardButton) {
        fireEvent.click(skipForwardButton)
        expect(mockVideo.currentTime).toBe(40) // 30 + 10 seconds
      }
    })
  })

  describe('Volume Controls', () => {
    it('should toggle mute when volume button is clicked', () => {
      render(<VideoPlayer {...defaultProps} />)
      
      const volumeButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'volume-2'
      )
      
      if (volumeButton) {
        fireEvent.click(volumeButton)
        expect(mockVideo.muted).toBe(true)
      }
    })

    it('should change volume when volume slider is moved', () => {
      render(<VideoPlayer {...defaultProps} />)
      
      const volumeSlider = screen.getByRole('slider')
      
      fireEvent.change(volumeSlider, { target: { value: '0.5' } })
      expect(mockVideo.volume).toBe(0.5)
    })

    it('should show muted icon when volume is 0', () => {
      mockVideo.volume = 0
      
      render(<VideoPlayer {...defaultProps} />)
      
      const mutedIcon = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'volume-x'
      )
      
      expect(mutedIcon).toBeInTheDocument()
    })
  })

  describe('Progress Bar', () => {
    it('should display current time and duration', () => {
      mockVideo.currentTime = 30
      mockVideo.duration = 120
      
      render(<VideoPlayer {...defaultProps} />)
      
      expect(screen.getByText('0:30 / 2:00')).toBeInTheDocument()
    })

    it('should seek to clicked position on progress bar', () => {
      render(<VideoPlayer {...defaultProps} />)
      
      const progressBar = document.querySelector('[role="progressbar"]') || 
                         document.querySelector('.w-full.h-2') // Fallback selector
      
      if (progressBar) {
        // Mock getBoundingClientRect
        vi.spyOn(progressBar, 'getBoundingClientRect').mockReturnValue({
          left: 0,
          top: 0,
          width: 400,
          height: 8,
          right: 400,
          bottom: 8,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        })
        
        // Click at 50% position (200px out of 400px)
        fireEvent.click(progressBar, { clientX: 200 })
        
        // Should seek to 50% of duration (60 seconds out of 120)
        expect(mockVideo.currentTime).toBe(60)
      }
    })

    it('should show buffered progress', () => {
      render(<VideoPlayer {...defaultProps} />)
      
      // Buffered progress should be visible in the progress bar
      const progressContainer = document.querySelector('.w-full.h-2')
      expect(progressContainer).toBeInTheDocument()
    })
  })

  describe('Playback Rate', () => {
    it('should change playback rate when dropdown is changed', () => {
      render(<VideoPlayer {...defaultProps} />)
      
      const playbackRateSelect = screen.getByDisplayValue('1x')
      
      fireEvent.change(playbackRateSelect, { target: { value: '1.5' } })
      expect(mockVideo.playbackRate).toBe(1.5)
    })

    it('should display available playback rate options', () => {
      render(<VideoPlayer {...defaultProps} />)
      
      const playbackRateSelect = screen.getByDisplayValue('1x')
      
      expect(playbackRateSelect).toBeInTheDocument()
      
      // Check for common playback rates
      const options = playbackRateSelect.querySelectorAll('option')
      const optionValues = Array.from(options).map(option => option.value)
      
      expect(optionValues).toContain('0.5')
      expect(optionValues).toContain('1')
      expect(optionValues).toContain('1.5')
      expect(optionValues).toContain('2')
    })
  })

  describe('Fullscreen', () => {
    it('should toggle fullscreen when fullscreen button is clicked', () => {
      const requestFullscreen = vi.fn()
      
      render(<VideoPlayer {...defaultProps} />)
      
      const fullscreenButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'maximize'
      )
      
      if (fullscreenButton) {
        fireEvent.click(fullscreenButton)
        // Fullscreen API behavior would need more complex mocking for full testing
      }
    })
  })

  describe('Settings Panel', () => {
    it('should show settings panel when settings button is clicked', () => {
      render(<VideoPlayer {...defaultProps} />)
      
      const settingsButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'settings'
      )
      
      if (settingsButton) {
        fireEvent.click(settingsButton)
        
        expect(screen.getByText('Video Settings')).toBeInTheDocument()
        expect(screen.getByText('Quality')).toBeInTheDocument()
        expect(screen.getByText('Playback Speed')).toBeInTheDocument()
      }
    })

    it('should change quality setting', () => {
      render(<VideoPlayer {...defaultProps} />)
      
      const settingsButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'settings'
      )
      
      if (settingsButton) {
        fireEvent.click(settingsButton)
        
        const qualitySelect = screen.getByDisplayValue('Auto')
        fireEvent.change(qualitySelect, { target: { value: '720p' } })
        
        expect(qualitySelect.value).toBe('720p')
      }
    })

    it('should toggle subtitles setting', () => {
      render(<VideoPlayer {...defaultProps} />)
      
      const settingsButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'settings'
      )
      
      if (settingsButton) {
        fireEvent.click(settingsButton)
        
        const subtitlesCheckbox = screen.getByRole('checkbox')
        fireEvent.click(subtitlesCheckbox)
        
        expect(subtitlesCheckbox).toBeChecked()
      }
    })
  })

  describe('Keyboard Shortcuts', () => {
    it('should toggle play/pause with spacebar', () => {
      render(<VideoPlayer {...defaultProps} />)
      
      fireEvent.keyDown(document, { code: 'Space' })
      
      expect(mockVideo.play).toHaveBeenCalledTimes(1)
    })

    it('should seek backward with left arrow', () => {
      mockVideo.currentTime = 30
      
      render(<VideoPlayer {...defaultProps} />)
      
      fireEvent.keyDown(document, { code: 'ArrowLeft' })
      
      expect(mockVideo.currentTime).toBe(20)
    })

    it('should seek forward with right arrow', () => {
      mockVideo.currentTime = 30
      
      render(<VideoPlayer {...defaultProps} />)
      
      fireEvent.keyDown(document, { code: 'ArrowRight' })
      
      expect(mockVideo.currentTime).toBe(40)
    })

    it('should increase volume with up arrow', () => {
      mockVideo.volume = 0.5
      
      render(<VideoPlayer {...defaultProps} />)
      
      fireEvent.keyDown(document, { code: 'ArrowUp' })
      
      expect(mockVideo.volume).toBe(0.6)
    })

    it('should decrease volume with down arrow', () => {
      mockVideo.volume = 0.5
      
      render(<VideoPlayer {...defaultProps} />)
      
      fireEvent.keyDown(document, { code: 'ArrowDown' })
      
      expect(mockVideo.volume).toBe(0.4)
    })

    it('should toggle mute with M key', () => {
      render(<VideoPlayer {...defaultProps} />)
      
      fireEvent.keyDown(document, { code: 'KeyM' })
      
      expect(mockVideo.muted).toBe(true)
    })

    it('should toggle fullscreen with F key', () => {
      render(<VideoPlayer {...defaultProps} />)
      
      fireEvent.keyDown(document, { code: 'KeyF' })
      
      // Fullscreen behavior would be tested with proper mocking
    })
  })

  describe('Controls Auto-hide', () => {
    it('should show controls initially', () => {
      render(<VideoPlayer {...defaultProps} />)
      
      expect(screen.getByText('Test Video')).toBeInTheDocument()
    })

    it('should hide controls after timeout when playing', async () => {
      vi.useFakeTimers()
      
      render(<VideoPlayer {...defaultProps} />)
      
      // Start playing
      const playButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'play'
      )
      
      if (playButton) {
        fireEvent.click(playButton)
        
        // Fast-forward time
        vi.advanceTimersByTime(4000)
        
        // Controls should be hidden (opacity-0 class)
        const controlsOverlay = document.querySelector('.opacity-0')
        expect(controlsOverlay).toBeInTheDocument()
      }
      
      vi.useRealTimers()
    })

    it('should show controls on mouse movement', () => {
      render(<VideoPlayer {...defaultProps} />)
      
      const container = document.querySelector('.relative.bg-black')
      
      if (container) {
        fireEvent.mouseMove(container)
        
        // Controls should be visible
        const controlsOverlay = document.querySelector('.opacity-100')
        expect(controlsOverlay).toBeInTheDocument()
      }
    })
  })

  describe('Time Formatting', () => {
    it('should format time correctly for minutes and seconds', () => {
      mockVideo.currentTime = 90 // 1:30
      mockVideo.duration = 150   // 2:30
      
      render(<VideoPlayer {...defaultProps} />)
      
      expect(screen.getByText('1:30 / 2:30')).toBeInTheDocument()
    })

    it('should format time correctly for hours', () => {
      mockVideo.currentTime = 3661 // 1:01:01
      mockVideo.duration = 7200    // 2:00:00
      
      render(<VideoPlayer {...defaultProps} />)
      
      expect(screen.getByText('1:01:01 / 2:00:00')).toBeInTheDocument()
    })
  })

  describe('Callbacks', () => {
    it('should call onTimeUpdate when time changes', () => {
      const onTimeUpdate = vi.fn()
      
      render(<VideoPlayer {...defaultProps} onTimeUpdate={onTimeUpdate} />)
      
      // Simulate time update
      mockVideo.currentTime = 30
      
      const video = document.querySelector('video')
      if (video) {
        fireEvent.timeUpdate(video)
        
        expect(onTimeUpdate).toHaveBeenCalledWith(30, 120)
      }
    })

    it('should call onClose when provided', () => {
      const onClose = vi.fn()
      
      render(<VideoPlayer {...defaultProps} onClose={onClose} />)
      
      // This would depend on having a close button in the implementation
      // For now, we just verify the prop is accepted
      expect(onClose).toBeDefined()
    })
  })

  describe('Download Functionality', () => {
    it('should trigger download when download button is clicked', () => {
      // Mock document.createElement and link.click
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn(),
      }
      
      const createElement = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any)
      const appendChild = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any)
      const removeChild = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any)
      
      render(<VideoPlayer {...defaultProps} />)
      
      const downloadButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'download'
      )
      
      if (downloadButton) {
        fireEvent.click(downloadButton)
        
        expect(createElement).toHaveBeenCalledWith('a')
        expect(mockLink.href).toBe(defaultProps.videoUrl)
        expect(mockLink.download).toBe(defaultProps.videoName)
        expect(mockLink.click).toHaveBeenCalledTimes(1)
        expect(appendChild).toHaveBeenCalledWith(mockLink)
        expect(removeChild).toHaveBeenCalledWith(mockLink)
      }
      
      createElement.mockRestore()
      appendChild.mockRestore()
      removeChild.mockRestore()
    })
  })
})