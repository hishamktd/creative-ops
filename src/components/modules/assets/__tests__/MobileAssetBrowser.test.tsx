import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MobileAssetBrowser } from '../MobileAssetBrowser'
import { EnhancedAsset } from '@/types'

// Mock hooks
vi.mock('@/lib/hooks/useMobileDetection', () => ({
  useMobileDetection: () => ({
    isMobile: true,
    isTablet: false,
    isDesktop: false,
    isTouchDevice: true,
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
    isOnline: true,
    offlineAssets: [],
    isCached: vi.fn(() => false),
    getCachedThumbnailUrl: vi.fn(() => null)
  })
}))

// Mock components
vi.mock('../MobileAssetPreview', () => ({
  MobileAssetPreview: ({ isOpen, onClose }: any) => 
    isOpen ? <div data-testid="mobile-preview">Preview<button onClick={onClose}>Close</button></div> : null
}))

vi.mock('../MobileUploadInterface', () => ({
  MobileUploadInterface: ({ isOpen, onClose }: any) => 
    isOpen ? <div data-testid="mobile-upload">Upload<button onClick={onClose}>Close</button></div> : null
}))

vi.mock('../MobileSearchInterface', () => ({
  MobileSearchInterface: ({ onClose }: any) => 
    <div data-testid="mobile-search">Search<button onClick={onClose}>Close</button></div>
}))

const mockAssets: EnhancedAsset[] = [
  {
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
  },
  {
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
]

const defaultProps = {
  assets: mockAssets,
  loading: false,
  viewMode: 'grid' as const,
  onViewModeChange: vi.fn(),
  filters: {},
  onFiltersChange: vi.fn(),
  sortBy: 'created_at' as const,
  sortDirection: 'desc' as const,
  onSortChange: vi.fn(),
  onAssetClick: vi.fn(),
  onLoadMore: vi.fn(),
  hasMore: false
}

describe('MobileAssetBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders mobile asset browser with assets', () => {
    render(<MobileAssetBrowser {...defaultProps} />)
    
    expect(screen.getByText('Assets (2)')).toBeInTheDocument()
    expect(screen.getByText('test-image.jpg')).toBeInTheDocument()
    expect(screen.getByText('test-video.mp4')).toBeInTheDocument()
  })

  it('shows online indicator when connected', () => {
    render(<MobileAssetBrowser {...defaultProps} />)
    
    // Should show wifi icon (online indicator)
    const wifiIcon = document.querySelector('[data-lucide="wifi"]')
    expect(wifiIcon).toBeInTheDocument()
  })

  it('toggles search interface', () => {
    render(<MobileAssetBrowser {...defaultProps} />)
    
    const searchButton = screen.getByRole('button', { name: /search/i })
    fireEvent.click(searchButton)
    
    expect(screen.getByTestId('mobile-search')).toBeInTheDocument()
    
    const closeSearchButton = screen.getByText('Close')
    fireEvent.click(closeSearchButton)
    
    expect(screen.queryByTestId('mobile-search')).not.toBeInTheDocument()
  })

  it('toggles upload interface', () => {
    render(<MobileAssetBrowser {...defaultProps} />)
    
    const uploadButton = document.querySelector('[data-lucide="upload"]')?.parentElement
    expect(uploadButton).toBeInTheDocument()
    
    fireEvent.click(uploadButton!)
    
    expect(screen.getByTestId('mobile-upload')).toBeInTheDocument()
    
    const closeUploadButton = screen.getByText('Close')
    fireEvent.click(closeUploadButton)
    
    expect(screen.queryByTestId('mobile-upload')).not.toBeInTheDocument()
  })

  it('toggles sort and view controls', () => {
    render(<MobileAssetBrowser {...defaultProps} />)
    
    const menuButton = document.querySelector('[data-lucide="menu"]')?.parentElement
    expect(menuButton).toBeInTheDocument()
    
    fireEvent.click(menuButton!)
    
    expect(screen.getByText('View & Sort')).toBeInTheDocument()
    expect(screen.getByText('View:')).toBeInTheDocument()
    expect(screen.getByText('Sort:')).toBeInTheDocument()
  })

  it('switches between grid and list view modes', () => {
    const onViewModeChange = vi.fn()
    render(<MobileAssetBrowser {...defaultProps} onViewModeChange={onViewModeChange} />)
    
    // Open sort menu
    const menuButton = document.querySelector('[data-lucide="menu"]')?.parentElement
    fireEvent.click(menuButton!)
    
    // Click list view button
    const listButton = document.querySelector('[data-lucide="list"]')?.parentElement
    fireEvent.click(listButton!)
    
    expect(onViewModeChange).toHaveBeenCalledWith('list')
  })

  it('handles asset click and opens preview', () => {
    const onAssetClick = vi.fn()
    render(<MobileAssetBrowser {...defaultProps} onAssetClick={onAssetClick} />)
    
    const assetCard = screen.getByText('test-image.jpg').closest('button')
    expect(assetCard).toBeInTheDocument()
    
    fireEvent.click(assetCard!)
    
    expect(onAssetClick).toHaveBeenCalledWith(mockAssets[0])
    expect(screen.getByTestId('mobile-preview')).toBeInTheDocument()
  })

  it('shows empty state when no assets', () => {
    render(<MobileAssetBrowser {...defaultProps} assets={[]} />)
    
    expect(screen.getByText('No assets found')).toBeInTheDocument()
    expect(screen.getByText('Upload some files to get started')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    render(<MobileAssetBrowser {...defaultProps} assets={[]} loading={true} />)
    
    const spinner = document.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('handles load more functionality', () => {
    const onLoadMore = vi.fn()
    render(<MobileAssetBrowser {...defaultProps} hasMore={true} onLoadMore={onLoadMore} />)
    
    const loadMoreButton = screen.getByText('Load More')
    fireEvent.click(loadMoreButton)
    
    expect(onLoadMore).toHaveBeenCalled()
  })

  it('displays file type badges correctly', () => {
    render(<MobileAssetBrowser {...defaultProps} />)
    
    expect(screen.getByText('JPEG')).toBeInTheDocument()
    expect(screen.getByText('MP4')).toBeInTheDocument()
  })

  it('formats file sizes correctly in list view', () => {
    render(<MobileAssetBrowser {...defaultProps} viewMode="list" />)
    
    expect(screen.getByText('1000KB')).toBeInTheDocument() // 1024000 bytes ≈ 1000KB
    expect(screen.getByText('5000KB')).toBeInTheDocument() // 5120000 bytes ≈ 5000KB
  })

  it('handles sort changes', () => {
    const onSortChange = vi.fn()
    render(<MobileAssetBrowser {...defaultProps} onSortChange={onSortChange} />)
    
    // Open sort menu
    const menuButton = document.querySelector('[data-lucide="menu"]')?.parentElement
    fireEvent.click(menuButton!)
    
    // Change sort field
    const sortSelect = screen.getByDisplayValue('Date Created')
    fireEvent.change(sortSelect, { target: { value: 'name' } })
    
    expect(onSortChange).toHaveBeenCalledWith('name', 'desc')
    
    // Change sort direction
    const sortDirectionButton = document.querySelector('[data-lucide="sort-desc"]')?.parentElement
    fireEvent.click(sortDirectionButton!)
    
    expect(onSortChange).toHaveBeenCalledWith('created_at', 'asc')
  })

  it('handles filters correctly', () => {
    const onFiltersChange = vi.fn()
    const filters = { search: 'test', tags: ['design'] }
    
    render(
      <MobileAssetBrowser 
        {...defaultProps} 
        filters={filters}
        onFiltersChange={onFiltersChange}
      />
    )
    
    // Search should be active
    const searchButton = screen.getByRole('button', { name: /search/i })
    fireEvent.click(searchButton)
    
    expect(screen.getByTestId('mobile-search')).toBeInTheDocument()
  })

  it('shows offline indicator when offline', () => {
    // Mock offline state
    vi.mocked(require('@/lib/hooks/useOfflineAssets').useOfflineAssets).mockReturnValue({
      isOnline: false,
      offlineAssets: [mockAssets[0]],
      isCached: vi.fn(() => true),
      getCachedThumbnailUrl: vi.fn(() => null)
    })
    
    render(<MobileAssetBrowser {...defaultProps} />)
    
    const wifiOffIcon = document.querySelector('[data-lucide="wifi-off"]')
    expect(wifiOffIcon).toBeInTheDocument()
    
    expect(screen.getByText('Offline (1 cached)')).toBeInTheDocument()
  })

  it('handles touch interactions properly', () => {
    render(<MobileAssetBrowser {...defaultProps} />)
    
    const container = document.querySelector('[data-testid="mobile-asset-browser"]') || 
                    document.querySelector('.h-full.flex.flex-col')
    
    expect(container).toBeInTheDocument()
    
    // Simulate touch events
    if (container) {
      fireEvent.touchStart(container, {
        touches: [{ clientX: 100, clientY: 100 }]
      })
      
      fireEvent.touchEnd(container, {
        changedTouches: [{ clientX: 200, clientY: 100 }]
      })
    }
  })

  it('adapts grid columns based on screen size', () => {
    // Test with different screen sizes
    const { rerender } = render(<MobileAssetBrowser {...defaultProps} />)
    
    // Should show 2 columns on small screens (default mock)
    const gridContainer = document.querySelector('.grid')
    expect(gridContainer).toHaveStyle('grid-template-columns: repeat(2, 1fr)')
    
    // Mock medium screen size
    vi.mocked(require('@/lib/hooks/useMobileDetection').useMobileDetection).mockReturnValue({
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      isTouchDevice: true,
      screenSize: 'md',
      orientation: 'portrait'
    })
    
    rerender(<MobileAssetBrowser {...defaultProps} />)
    
    // Should show 3 columns on medium screens
    expect(gridContainer).toHaveStyle('grid-template-columns: repeat(3, 1fr)')
  })

  it('shows cached indicators for offline assets', () => {
    vi.mocked(require('@/lib/hooks/useOfflineAssets').useOfflineAssets).mockReturnValue({
      isOnline: true,
      offlineAssets: [],
      isCached: vi.fn((id) => id === '1'),
      getCachedThumbnailUrl: vi.fn(() => null)
    })
    
    render(<MobileAssetBrowser {...defaultProps} />)
    
    // First asset should show cached indicator
    const firstAssetCard = screen.getByText('test-image.jpg').closest('button')
    const cachedIndicator = firstAssetCard?.querySelector('.bg-green-500')
    expect(cachedIndicator).toBeInTheDocument()
  })
})