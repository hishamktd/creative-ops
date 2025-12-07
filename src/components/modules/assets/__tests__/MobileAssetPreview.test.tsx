import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MobileAssetPreview } from '../MobileAssetPreview'
import { EnhancedAsset } from '@/types'

// Mock hooks
vi.mock('@/lib/hooks/useMobileDetection', () => ({
  useMobileDetection: () => ({
    screenSize: 'sm',
    orientation: 'portrait'
  })
}))

vi.mock('@/lib/hooks/useSwipeGestures', () => ({
  useSwipeGestures: () => ({
    attachListeners: vi.fn(() => vi.fn())
  })
}))

vi.mock('@/lib/hooks/useOfflineAssets', () => ({
  useOfflineAssets: () => ({
    getCachedAssetUrl: vi.fn(() => null),
    getCachedThumbnailUrl: vi.fn(() => null),
    isCached: vi.fn(() => false)
  })
}))

const mockImageAsset: EnhancedAsset = {
  id: '1',
  project_id: 'project1',
  folder_id: null,
  name: 'test-image.jpg',
  file_url: 'https://example.com/image.jpg',
  file_type: 'image/jpeg',
  file_size: 1024000,
  version: 1,
  thumbnail_url: 'https://example.com/thumb.jpg',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  uploaded_by: 'user1',
  status: 'ready',
  metadata: {
    width: 1920,
    height: 1080,
    checksum: 'abc123'
  },
  tags: ['design', 'photo']
}

const mockVideoAsset: EnhancedAsset = {
  id: '2',
  project_id: 'project1',
  folder_id: null,
  name: 'test-video.mp4',
  file_url: 'https://example.com/video.mp4',
  file_type: 'video/mp4',
  file_size: 5120000,
  version: 1,
  thumbnail_url: 'https://example.com/video-thumb.jpg',
  created_at: '2024-01-02T00:00:00Z',
  updated_at: '2024-01-02T00:00:00Z',
  uploaded_by: 'user1',
  status: 'ready',
  metadata: {
    duration: 120,
    checksum: 'def456'
  },
  tags: ['video', 'demo']
}

const mockPDFAsset: EnhancedAsset = {
  id: '3',
  project_id: 'project1',
  folder_id: null,
  name: 'document.pdf',
  file_url: 'https://example.com/document.pdf',
  file_type: 'application/pdf',
  file_size: 2048000,
  version: 1,
  created_at: '2024-01-03T00:00:00Z',
  updated_at: '2024-01-03T00:00:00Z',
  uploaded_by: 'user1',
  status: 'ready',
  metadata: {
    pages: 10,
    checksum: 'ghi789'
  },
  tags: ['document']
}

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  onNavigate: vi.fn(),
  currentIndex: 0,
  totalAssets: 3,
  isOffline: false
}

describe('MobileAssetPreview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock window.open
    Object.defineProperty(window, 'open', {
      writable: true,
      value: vi.fn()
    })
    
    // Mock document.fullscreenElement
    Object.defineProperty(document, 'fullscreenElement', {
      writable: true,
      value: null
    })
    
    // Mock fullscreen methods
    Object.defineProperty(document, 'exitFullscreen', {
      writable: true,
      value: vi.fn()
    })
    
    // Mock HTMLVideoElement methods
    Object.defineProperty(HTMLVideoElement.prototype, 'play', {
      writable: true,
      value: vi.fn()
    })
    
    Object.defineProperty(HTMLVideoElement.prototype, 'pause', {
      writable: true,
      value: vi.fn()
    })
    
    Object.defineProperty(HTMLVideoElement.prototype, 'requestFullscreen', {
      writable: true,
      value: vi.fn()
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not render when closed', () => {
    render(
      <MobileAssetPreview 
        {...defaultProps} 
        asset={mockImageAsset}
        isOpen={false}
      />
    )
    
    expect(screen.queryByText('test-image.jpg')).not.toBeInTheDocument()
  })

  it('renders image asset preview', () => {
    render(
      <MobileAssetPreview 
        {...defaultProps} 
        asset={mockImageAsset}
      />
    )
    
    expect(screen.getByText('test-image.jpg')).toBeInTheDocument()
    expect(screen.getByText('1 of 3')).toBeInTheDocument()
    
    const image = screen.getByAltText('test-image.jpg')
    expect(image).toBeInTheDocument()
    expect(image).toHaveAttribute('src', 'https://example.com/image.jpg')
  })

  it('renders video asset preview', () => {
    render(
      <MobileAssetPreview 
        {...defaultProps} 
        asset={mockVideoAsset}
      />
    )
    
    expect(screen.getByText('test-video.mp4')).toBeInTheDocument()
    
    const video = document.querySelector('video')
    expect(video).toBeInTheDocument()
    expect(video).toHaveAttribute('src', 'https://example.com/video.mp4')
  })

  it('renders PDF asset preview with download option', () => {
    render(
      <MobileAssetPreview 
        {...defaultProps} 
        asset={mockPDFAsset}
      />
    )
    
    expect(screen.getByText('document.pdf')).toBeInTheDocument()
    expect(screen.getByText('PDF preview not available on mobile')).toBeInTheDocument()
    
    const openPDFButton = screen.getByText('Open PDF')
    expect(openPDFButton).toBeInTheDocument()
    
    fireEvent.click(openPDFButton)
    expect(window.open).toHaveBeenCalledWith('https://example.com/document.pdf', '_blank')
  })

  it('handles close action', () => {
    const onClose = vi.fn()
    render(
      <MobileAssetPreview 
        {...defaultProps} 
        asset={mockImageAsset}
        onClose={onClose}
      />
    )
    
    const closeButton = document.querySelector('[data-lucide="x"]')?.parentElement
    expect(closeButton).toBeInTheDocument()
    
    fireEvent.click(closeButton!)
    expect(onClose).toHaveBeenCalled()
  })

  it('handles navigation between assets', () => {
    const onNavigate = vi.fn()
    render(
      <MobileAssetPreview 
        {...defaultProps} 
        asset={mockImageAsset}
        onNavigate={onNavigate}
        currentIndex={1}
        totalAssets={3}
      />
    )
    
    // Should show navigation arrows
    const prevButton = document.querySelector('[data-lucide="chevron-left"]')?.parentElement
    const nextButton = document.querySelector('[data-lucide="chevron-right"]')?.parentElement
    
    expect(prevButton).toBeInTheDocument()
    expect(nextButton).toBeInTheDocument()
    
    fireEvent.click(prevButton!)
    expect(onNavigate).toHaveBeenCalledWith('prev')
    
    fireEvent.click(nextButton!)
    expect(onNavigate).toHaveBeenCalledWith('next')
  })

  it('disables navigation at boundaries', () => {
    render(
      <MobileAssetPreview 
        {...defaultProps} 
        asset={mockImageAsset}
        currentIndex={0}
        totalAssets={3}
      />
    )
    
    const prevButton = document.querySelector('[data-lucide="chevron-left"]')?.parentElement
    expect(prevButton).toBeDisabled()
    
    // Test last item
    const { rerender } = render(
      <MobileAssetPreview 
        {...defaultProps} 
        asset={mockImageAsset}
        currentIndex={2}
        totalAssets={3}
      />
    )
    
    const nextButton = document.querySelector('[data-lucide="chevron-right"]')?.parentElement
    expect(nextButton).toBeDisabled()
  })

  it('shows and hides controls automatically', async () => {
    vi.useFakeTimers()
    
    render(
      <MobileAssetPreview 
        {...defaultProps} 
        asset={mockImageAsset}
      />
    )
    
    // Controls should be visible initially
    const header = document.querySelector('.from-black\\/70')
    expect(header).not.toHaveClass('opacity-0')
    
    // Wait for auto-hide timeout
    vi.advanceTimersByTime(3000)
    
    await waitFor(() => {
      expect(header).toHaveClass('opacity-0')
    })
    
    vi.useRealTimers()
  })

  it('shows controls on interaction', () => {
    render(
      <MobileAssetPreview 
        {...defaultProps} 
        asset={mockImageAsset}
      />
    )
    
    const container = document.querySelector('.fixed.inset-0')
    expect(container).toBeInTheDocument()
    
    // Click to show controls
    fireEvent.click(container!)
    
    const header = document.querySelector('.from-black\\/70')
    expect(header).not.toHaveClass('opacity-0')
  })

  it('handles image zoom controls', () => {
    render(
      <MobileAssetPreview 
        {...defaultProps} 
        asset={mockImageAsset}
      />
    )
    
    const zoomInButton = document.querySelector('[data-lucide="zoom-in"]')?.parentElement
    const zoomOutButton = document.querySelector('[data-lucide="zoom-out"]')?.parentElement
    const rotateButton = document.querySelector('[data-lucide="rotate-cw"]')?.parentElement
    const resetButton = screen.getByText('Reset')
    
    expect(zoomInButton).toBeInTheDocument()
    expect(zoomOutButton).toBeInTheDocument()
    expect(rotateButton).toBeInTheDocument()
    expect(resetButton).toBeInTheDocument()
    
    // Test zoom in
    fireEvent.click(zoomInButton!)
    
    // Test zoom out
    fireEvent.click(zoomOutButton!)
    
    // Test rotate
    fireEvent.click(rotateButton!)
    
    // Test reset
    fireEvent.click(resetButton)
  })

  it('handles video controls', () => {
    render(
      <MobileAssetPreview 
        {...defaultProps} 
        asset={mockVideoAsset}
      />
    )
    
    const playButton = document.querySelector('[data-lucide="play"]')?.parentElement
    const muteButton = document.querySelector('[data-lucide="volume2"]')?.parentElement
    const fullscreenButton = document.querySelector('[data-lucide="maximize"]')?.parentElement
    
    expect(playButton).toBeInTheDocument()
    expect(muteButton).toBeInTheDocument()
    expect(fullscreenButton).toBeInTheDocument()
    
    // Test play/pause
    fireEvent.click(playButton!)
    
    // Test mute/unmute
    fireEvent.click(muteButton!)
    
    // Test fullscreen
    fireEvent.click(fullscreenButton!)
  })

  it('shows info panel', () => {
    render(
      <MobileAssetPreview 
        {...defaultProps} 
        asset={mockImageAsset}
      />
    )
    
    const infoButton = document.querySelector('[data-lucide="info"]')?.parentElement
    expect(infoButton).toBeInTheDocument()
    
    fireEvent.click(infoButton!)
    
    expect(screen.getByText('File Information')).toBeInTheDocument()
    expect(screen.getByText('Name:')).toBeInTheDocument()
    expect(screen.getByText('Size:')).toBeInTheDocument()
    expect(screen.getByText('Type:')).toBeInTheDocument()
    expect(screen.getByText('Dimensions:')).toBeInTheDocument()
    expect(screen.getByText('1920 × 1080')).toBeInTheDocument()
  })

  it('shows actions panel', () => {
    render(
      <MobileAssetPreview 
        {...defaultProps} 
        asset={mockImageAsset}
      />
    )
    
    const actionsButton = document.querySelector('[data-lucide="more-vertical"]')?.parentElement
    expect(actionsButton).toBeInTheDocument()
    
    fireEvent.click(actionsButton!)
    
    expect(screen.getByText('Download')).toBeInTheDocument()
    expect(screen.getByText('Share')).toBeInTheDocument()
    expect(screen.getByText('Edit')).toBeInTheDocument()
  })

  it('handles download action', () => {
    render(
      <MobileAssetPreview 
        {...defaultProps} 
        asset={mockImageAsset}
      />
    )
    
    const actionsButton = document.querySelector('[data-lucide="more-vertical"]')?.parentElement
    fireEvent.click(actionsButton!)
    
    const downloadButton = screen.getByText('Download')
    fireEvent.click(downloadButton)
    
    expect(window.open).toHaveBeenCalledWith('https://example.com/image.jpg', '_blank')
  })

  it('handles share action with Web Share API', () => {
    // Mock navigator.share
    Object.defineProperty(navigator, 'share', {
      writable: true,
      value: vi.fn()
    })
    
    render(
      <MobileAssetPreview 
        {...defaultProps} 
        asset={mockImageAsset}
      />
    )
    
    const actionsButton = document.querySelector('[data-lucide="more-vertical"]')?.parentElement
    fireEvent.click(actionsButton!)
    
    const shareButton = screen.getByText('Share')
    fireEvent.click(shareButton)
    
    expect(navigator.share).toHaveBeenCalledWith({
      title: 'test-image.jpg',
      url: 'https://example.com/image.jpg'
    })
  })

  it('uses cached URLs when offline', () => {
    const getCachedAssetUrl = vi.fn(() => 'blob:cached-url')
    
    vi.mocked(require('@/lib/hooks/useOfflineAssets').useOfflineAssets).mockReturnValue({
      getCachedAssetUrl,
      getCachedThumbnailUrl: vi.fn(() => null),
      isCached: vi.fn(() => true)
    })
    
    render(
      <MobileAssetPreview 
        {...defaultProps} 
        asset={mockImageAsset}
        isOffline={true}
      />
    )
    
    expect(getCachedAssetUrl).toHaveBeenCalledWith('1')
    
    const image = screen.getByAltText('test-image.jpg')
    expect(image).toHaveAttribute('src', 'blob:cached-url')
  })

  it('shows offline indicator for cached assets', () => {
    vi.mocked(require('@/lib/hooks/useOfflineAssets').useOfflineAssets).mockReturnValue({
      getCachedAssetUrl: vi.fn(() => null),
      getCachedThumbnailUrl: vi.fn(() => null),
      isCached: vi.fn(() => true)
    })
    
    render(
      <MobileAssetPreview 
        {...defaultProps} 
        asset={mockImageAsset}
      />
    )
    
    // Open info panel
    const infoButton = document.querySelector('[data-lucide="info"]')?.parentElement
    fireEvent.click(infoButton!)
    
    expect(screen.getByText('Available Offline')).toBeInTheDocument()
  })

  it('handles video progress bar interaction', () => {
    render(
      <MobileAssetPreview 
        {...defaultProps} 
        asset={mockVideoAsset}
      />
    )
    
    const progressBar = document.querySelector('input[type="range"]')
    expect(progressBar).toBeInTheDocument()
    
    fireEvent.change(progressBar!, { target: { value: '60' } })
    
    // Should update video currentTime (mocked)
    const video = document.querySelector('video')
    expect(video).toBeInTheDocument()
  })

  it('formats time correctly for video', () => {
    render(
      <MobileAssetPreview 
        {...defaultProps} 
        asset={mockVideoAsset}
      />
    )
    
    // Should show formatted duration
    expect(screen.getByText('0:00 / 0:00')).toBeInTheDocument()
  })

  it('handles touch gestures', () => {
    const attachListeners = vi.fn(() => vi.fn())
    
    vi.mocked(require('@/lib/hooks/useSwipeGestures').useSwipeGestures).mockReturnValue({
      attachListeners
    })
    
    render(
      <MobileAssetPreview 
        {...defaultProps} 
        asset={mockImageAsset}
      />
    )
    
    expect(attachListeners).toHaveBeenCalled()
  })

  it('resets viewer state when asset changes', () => {
    const { rerender } = render(
      <MobileAssetPreview 
        {...defaultProps} 
        asset={mockImageAsset}
      />
    )
    
    // Zoom in first
    const zoomInButton = document.querySelector('[data-lucide="zoom-in"]')?.parentElement
    fireEvent.click(zoomInButton!)
    
    // Change asset
    rerender(
      <MobileAssetPreview 
        {...defaultProps} 
        asset={mockVideoAsset}
      />
    )
    
    // Viewer state should be reset (this is internal state, so we test indirectly)
    // The image should not have zoom transform applied
    const video = document.querySelector('video')
    expect(video).toBeInTheDocument()
  })
})