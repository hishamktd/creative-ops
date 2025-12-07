import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AssetBrowser } from '../AssetBrowser'
import { EnhancedAsset } from '@/types'

// Mock all dependencies
vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user1' } })
}))

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => ({
          range: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => ({
                or: vi.fn(() => ({
                  in: vi.fn(() => ({
                    gte: vi.fn(() => ({
                      lte: vi.fn(() => Promise.resolve({
                        data: mockAssets,
                        error: null
                      }))
                    }))
                  }))
                }))
              }))
            }))
          }))
        }))
      }))
    })),
    channel: vi.fn(() => ({
      on: vi.fn(() => ({
        subscribe: vi.fn()
      }))
    })),
    removeChannel: vi.fn()
  }
}))

// Mock mobile components
vi.mock('../MobileAssetBrowser', () => ({
  MobileAssetBrowser: (props: any) => (
    <div data-testid="mobile-asset-browser">
      <div>Mobile Asset Browser</div>
      <div>Assets: {props.assets.length}</div>
      <div>View Mode: {props.viewMode}</div>
      <button onClick={() => props.onAssetClick(props.assets[0])}>
        Click First Asset
      </button>
    </div>
  )
}))

// Mock desktop components
vi.mock('../AssetGridView', () => ({
  AssetGridView: (props: any) => (
    <div data-testid="desktop-grid-view">
      Desktop Grid View - {props.assets.length} assets
    </div>
  )
}))

vi.mock('../AssetListView', () => ({
  AssetListView: (props: any) => (
    <div data-testid="desktop-list-view">
      Desktop List View - {props.assets.length} assets
    </div>
  )
}))

vi.mock('../AssetTimelineView', () => ({
  AssetTimelineView: (props: any) => (
    <div data-testid="desktop-timeline-view">
      Desktop Timeline View - {props.assets.length} assets
    </div>
  )
}))

vi.mock('../AssetFiltersPanel', () => ({
  AssetFiltersPanel: () => (
    <div data-testid="desktop-filters-panel">
      Desktop Filters Panel
    </div>
  )
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
  projectId: 'project1',
  onAssetClick: vi.fn()
}

// Mock mobile detection hook
const mockMobileDetection = {
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  isTouchDevice: false,
  screenSize: 'lg' as const,
  orientation: 'landscape' as const
}

vi.mock('@/lib/hooks/useMobileDetection', () => ({
  useMobileDetection: () => mockMobileDetection
}))

describe('Cross-Device Compatibility Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset mobile detection to desktop by default
    Object.assign(mockMobileDetection, {
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isTouchDevice: false,
      screenSize: 'lg',
      orientation: 'landscape'
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Desktop Experience', () => {
    it('renders desktop interface on desktop devices', async () => {
      render(<AssetBrowser {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.queryByTestId('mobile-asset-browser')).not.toBeInTheDocument()
        expect(screen.getByTestId('desktop-grid-view')).toBeInTheDocument()
      })
    })

    it('shows desktop toolbar and controls', async () => {
      render(<AssetBrowser {...defaultProps} />)
      
      await waitFor(() => {
        // Desktop should show full toolbar
        expect(screen.getByPlaceholderText('Search assets...')).toBeInTheDocument()
        expect(screen.getByText('Filters')).toBeInTheDocument()
        
        // View mode controls
        const gridButton = document.querySelector('[data-lucide="grid-3-x-3"]')?.parentElement
        const listButton = document.querySelector('[data-lucide="list"]')?.parentElement
        const timelineButton = document.querySelector('[data-lucide="timeline"]')?.parentElement
        
        expect(gridButton).toBeInTheDocument()
        expect(listButton).toBeInTheDocument()
        expect(timelineButton).toBeInTheDocument()
      })
    })

    it('handles desktop view mode switching', async () => {
      render(<AssetBrowser {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('desktop-grid-view')).toBeInTheDocument()
      })
      
      // Switch to list view
      const listButton = document.querySelector('[data-lucide="list"]')?.parentElement
      fireEvent.click(listButton!)
      
      await waitFor(() => {
        expect(screen.getByTestId('desktop-list-view')).toBeInTheDocument()
        expect(screen.queryByTestId('desktop-grid-view')).not.toBeInTheDocument()
      })
      
      // Switch to timeline view
      const timelineButton = document.querySelector('[data-lucide="timeline"]')?.parentElement
      fireEvent.click(timelineButton!)
      
      await waitFor(() => {
        expect(screen.getByTestId('desktop-timeline-view')).toBeInTheDocument()
        expect(screen.queryByTestId('desktop-list-view')).not.toBeInTheDocument()
      })
    })

    it('shows desktop filters panel', async () => {
      render(<AssetBrowser {...defaultProps} />)
      
      const filtersButton = screen.getByText('Filters')
      fireEvent.click(filtersButton)
      
      await waitFor(() => {
        expect(screen.getByTestId('desktop-filters-panel')).toBeInTheDocument()
      })
    })
  })

  describe('Mobile Experience', () => {
    beforeEach(() => {
      // Set mobile detection
      Object.assign(mockMobileDetection, {
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        isTouchDevice: true,
        screenSize: 'sm',
        orientation: 'portrait'
      })
    })

    it('renders mobile interface on mobile devices', async () => {
      render(<AssetBrowser {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('mobile-asset-browser')).toBeInTheDocument()
        expect(screen.queryByTestId('desktop-grid-view')).not.toBeInTheDocument()
      })
    })

    it('shows mobile-optimized interface', async () => {
      render(<AssetBrowser {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByText('Mobile Asset Browser')).toBeInTheDocument()
        expect(screen.getByText('Assets: 2')).toBeInTheDocument()
        expect(screen.getByText('View Mode: grid')).toBeInTheDocument()
      })
    })

    it('handles mobile asset interactions', async () => {
      const onAssetClick = vi.fn()
      render(<AssetBrowser {...defaultProps} onAssetClick={onAssetClick} />)
      
      await waitFor(() => {
        const assetButton = screen.getByText('Click First Asset')
        fireEvent.click(assetButton)
        
        expect(onAssetClick).toHaveBeenCalledWith(mockAssets[0])
      })
    })
  })

  describe('Tablet Experience', () => {
    beforeEach(() => {
      // Set tablet detection
      Object.assign(mockMobileDetection, {
        isMobile: false,
        isTablet: true,
        isDesktop: false,
        isTouchDevice: true,
        screenSize: 'md',
        orientation: 'landscape'
      })
    })

    it('renders desktop interface on tablets', async () => {
      render(<AssetBrowser {...defaultProps} />)
      
      await waitFor(() => {
        // Tablets should use desktop interface but with touch optimizations
        expect(screen.queryByTestId('mobile-asset-browser')).not.toBeInTheDocument()
        expect(screen.getByTestId('desktop-grid-view')).toBeInTheDocument()
      })
    })
  })

  describe('Responsive Breakpoints', () => {
    const testBreakpoints = [
      { width: 320, screenSize: 'sm', expectMobile: true },
      { width: 640, screenSize: 'md', expectMobile: false },
      { width: 768, screenSize: 'md', expectMobile: false },
      { width: 1024, screenSize: 'lg', expectMobile: false },
      { width: 1280, screenSize: 'xl', expectMobile: false }
    ]

    testBreakpoints.forEach(({ width, screenSize, expectMobile }) => {
      it(`handles ${width}px screen width correctly`, async () => {
        // Set screen size
        Object.assign(mockMobileDetection, {
          isMobile: expectMobile,
          isTablet: false,
          isDesktop: !expectMobile,
          isTouchDevice: expectMobile,
          screenSize,
          orientation: width < 768 ? 'portrait' : 'landscape'
        })

        render(<AssetBrowser {...defaultProps} />)
        
        await waitFor(() => {
          if (expectMobile) {
            expect(screen.getByTestId('mobile-asset-browser')).toBeInTheDocument()
            expect(screen.queryByTestId('desktop-grid-view')).not.toBeInTheDocument()
          } else {
            expect(screen.queryByTestId('mobile-asset-browser')).not.toBeInTheDocument()
            expect(screen.getByTestId('desktop-grid-view')).toBeInTheDocument()
          }
        })
      })
    })
  })

  describe('Touch Device Detection', () => {
    it('handles touch-enabled desktop devices', async () => {
      // Large screen with touch (like Surface Pro)
      Object.assign(mockMobileDetection, {
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        isTouchDevice: true,
        screenSize: 'xl',
        orientation: 'landscape'
      })

      render(<AssetBrowser {...defaultProps} />)
      
      await waitFor(() => {
        // Should still use desktop interface
        expect(screen.queryByTestId('mobile-asset-browser')).not.toBeInTheDocument()
        expect(screen.getByTestId('desktop-grid-view')).toBeInTheDocument()
      })
    })

    it('handles non-touch mobile-sized screens', async () => {
      // Small screen without touch (rare but possible)
      Object.assign(mockMobileDetection, {
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        isTouchDevice: false,
        screenSize: 'sm',
        orientation: 'portrait'
      })

      render(<AssetBrowser {...defaultProps} />)
      
      await waitFor(() => {
        // Should use mobile interface based on screen size
        expect(screen.getByTestId('mobile-asset-browser')).toBeInTheDocument()
        expect(screen.queryByTestId('desktop-grid-view')).not.toBeInTheDocument()
      })
    })
  })

  describe('Orientation Changes', () => {
    it('handles portrait orientation', async () => {
      Object.assign(mockMobileDetection, {
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        isTouchDevice: true,
        screenSize: 'sm',
        orientation: 'portrait'
      })

      render(<AssetBrowser {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('mobile-asset-browser')).toBeInTheDocument()
      })
    })

    it('handles landscape orientation', async () => {
      Object.assign(mockMobileDetection, {
        isMobile: true,
        isTablet: false,
        isDesktop: false,
        isTouchDevice: true,
        screenSize: 'sm',
        orientation: 'landscape'
      })

      render(<AssetBrowser {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('mobile-asset-browser')).toBeInTheDocument()
      })
    })
  })

  describe('Feature Parity', () => {
    it('maintains core functionality across devices', async () => {
      const onAssetClick = vi.fn()
      
      // Test desktop
      Object.assign(mockMobileDetection, {
        isMobile: false,
        isDesktop: true
      })
      
      const { rerender } = render(<AssetBrowser {...defaultProps} onAssetClick={onAssetClick} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('desktop-grid-view')).toBeInTheDocument()
      })
      
      // Test mobile
      Object.assign(mockMobileDetection, {
        isMobile: true,
        isDesktop: false
      })
      
      rerender(<AssetBrowser {...defaultProps} onAssetClick={onAssetClick} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('mobile-asset-browser')).toBeInTheDocument()
        
        // Test asset interaction works on mobile
        const assetButton = screen.getByText('Click First Asset')
        fireEvent.click(assetButton)
        
        expect(onAssetClick).toHaveBeenCalledWith(mockAssets[0])
      })
    })

    it('passes through all props correctly to mobile version', async () => {
      Object.assign(mockMobileDetection, {
        isMobile: true,
        isDesktop: false
      })

      const props = {
        ...defaultProps,
        viewMode: 'list' as const,
        filters: { search: 'test' },
        sortBy: 'name' as const,
        sortDirection: 'asc' as const
      }

      render(<AssetBrowser {...props} />)
      
      await waitFor(() => {
        expect(screen.getByText('View Mode: list')).toBeInTheDocument()
      })
    })
  })

  describe('Performance Considerations', () => {
    it('does not render both interfaces simultaneously', async () => {
      render(<AssetBrowser {...defaultProps} />)
      
      await waitFor(() => {
        const mobileInterface = screen.queryByTestId('mobile-asset-browser')
        const desktopInterface = screen.queryByTestId('desktop-grid-view')
        
        // Only one should be rendered
        expect(mobileInterface || desktopInterface).toBeTruthy()
        expect(mobileInterface && desktopInterface).toBeFalsy()
      })
    })

    it('switches interfaces efficiently on device type change', async () => {
      const { rerender } = render(<AssetBrowser {...defaultProps} />)
      
      // Start with desktop
      await waitFor(() => {
        expect(screen.getByTestId('desktop-grid-view')).toBeInTheDocument()
      })
      
      // Switch to mobile
      Object.assign(mockMobileDetection, {
        isMobile: true,
        isDesktop: false
      })
      
      rerender(<AssetBrowser {...defaultProps} />)
      
      await waitFor(() => {
        expect(screen.getByTestId('mobile-asset-browser')).toBeInTheDocument()
        expect(screen.queryByTestId('desktop-grid-view')).not.toBeInTheDocument()
      })
    })
  })
})