import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AssetBrowser } from '../AssetBrowser'
import { measurePerformance, expectPerformance, measureMemoryUsage } from '@/test/performance-setup'
import { generateMockAsset } from '@/test/test-utils'

// Mock Supabase with large dataset
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      order: vi.fn(() => ({
        range: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              or: vi.fn(() => ({
                in: vi.fn(() => ({
                  gte: vi.fn(() => ({
                    lte: vi.fn(() => Promise.resolve({ data: [], error: null }))
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

vi.mock('@/lib/supabase/client', () => ({
  supabase: mockSupabase
}))

// Mock useAuth hook
vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user' } })
}))

describe('AssetBrowser - Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Large Dataset Rendering', () => {
    it('should render 1000 assets efficiently', async () => {
      const largeAssetSet = Array.from({ length: 1000 }, (_, i) => 
        generateMockAsset({ 
          id: `asset-${i}`,
          name: `Asset ${i}.jpg`,
          created_at: new Date(Date.now() - i * 1000).toISOString()
        })
      )

      mockSupabase.from().select().order().range().eq().is().or().in().gte().lte
        .mockResolvedValue({ data: largeAssetSet, error: null })

      const memoryBefore = measureMemoryUsage()

      const renderTime = await measurePerformance(async () => {
        render(<AssetBrowser projectId="project-1" />)
        
        // Wait for assets to load
        await waitFor(() => {
          expect(mockSupabase.from).toHaveBeenCalled()
        }, { timeout: 10000 })
      }, 'Render 1000 assets')

      const memoryAfter = measureMemoryUsage()
      const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed

      // Performance expectations
      expectPerformance(renderTime, 2000, 'Large dataset rendering') // Should render in < 2s
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024) // Should use < 50MB additional memory
    })

    it('should handle virtualization for large lists efficiently', async () => {
      const veryLargeAssetSet = Array.from({ length: 10000 }, (_, i) => 
        generateMockAsset({ id: `asset-${i}` })
      )

      mockSupabase.from().select().order().range().eq().is().or().in().gte().lte
        .mockResolvedValue({ data: veryLargeAssetSet.slice(0, 50), error: null })

      const { container } = render(<AssetBrowser projectId="project-1" />)

      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalled()
      })

      // Measure scroll performance
      const scrollTime = await measurePerformance(async () => {
        const scrollContainer = container.querySelector('[data-testid="asset-grid"]')
        
        // Simulate rapid scrolling
        for (let i = 0; i < 100; i++) {
          fireEvent.scroll(scrollContainer!, { target: { scrollTop: i * 100 } })
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      }, 'Virtualized scrolling')

      expectPerformance(scrollTime, 3000, 'Virtualized scrolling performance')
    })

    it('should maintain performance during real-time updates', async () => {
      const initialAssets = Array.from({ length: 100 }, (_, i) => 
        generateMockAsset({ id: `asset-${i}` })
      )

      mockSupabase.from().select().order().range().eq().is().or().in().gte().lte
        .mockResolvedValue({ data: initialAssets, error: null })

      render(<AssetBrowser projectId="project-1" />)

      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalled()
      })

      // Simulate real-time updates
      const updateTime = await measurePerformance(async () => {
        for (let i = 0; i < 50; i++) {
          const newAsset = generateMockAsset({ id: `new-asset-${i}` })
          
          // Simulate real-time update
          const channelCallback = mockSupabase.channel().on.mock.calls[0]?.[1]
          if (channelCallback) {
            channelCallback({
              eventType: 'INSERT',
              new: newAsset,
              old: null,
              schema: 'public',
              table: 'assets'
            })
          }
          
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      }, 'Real-time updates')

      expectPerformance(updateTime, 5000, 'Real-time update handling')
    })
  })

  describe('Search and Filter Performance', () => {
    it('should handle complex search queries efficiently', async () => {
      const searchResults = Array.from({ length: 500 }, (_, i) => 
        generateMockAsset({ 
          id: `search-result-${i}`,
          name: `Search Result ${i}`,
          tags: ['search', 'test', `tag-${i % 10}`]
        })
      )

      mockSupabase.from().select().order().range().eq().is().or().in().gte().lte
        .mockResolvedValue({ data: searchResults, error: null })

      render(<AssetBrowser projectId="project-1" />)

      const searchInput = screen.getByPlaceholderText('Search assets...')

      const searchTime = await measurePerformance(async () => {
        // Simulate typing search query
        fireEvent.change(searchInput, { target: { value: 'complex search query with multiple terms' } })
        
        await waitFor(() => {
          expect(mockSupabase.from).toHaveBeenCalledTimes(2) // Initial load + search
        })
      }, 'Complex search query')

      expectPerformance(searchTime, 1000, 'Search query performance')
    })

    it('should debounce search input efficiently', async () => {
      render(<AssetBrowser projectId="project-1" />)

      const searchInput = screen.getByPlaceholderText('Search assets...')

      const debounceTime = await measurePerformance(async () => {
        // Rapid typing simulation
        const searchTerms = ['a', 'as', 'ass', 'asse', 'asset', 'asset ', 'asset s', 'asset se', 'asset sea', 'asset sear', 'asset searc', 'asset search']
        
        for (const term of searchTerms) {
          fireEvent.change(searchInput, { target: { value: term } })
          await new Promise(resolve => setTimeout(resolve, 50))
        }
        
        // Wait for debounce to complete
        await new Promise(resolve => setTimeout(resolve, 1000))
      }, 'Search debouncing')

      // Should only make one additional API call after debounce
      expect(mockSupabase.from).toHaveBeenCalledTimes(2) // Initial + final search
      expectPerformance(debounceTime, 2000, 'Search debounce handling')
    })

    it('should apply multiple filters without performance degradation', async () => {
      const filteredResults = Array.from({ length: 200 }, (_, i) => 
        generateMockAsset({ id: `filtered-${i}` })
      )

      mockSupabase.from().select().order().range().eq().is().or().in().gte().lte
        .mockResolvedValue({ data: filteredResults, error: null })

      render(<AssetBrowser projectId="project-1" />)

      // Open filters panel
      const filtersButton = screen.getByRole('button', { name: /filters/i })
      fireEvent.click(filtersButton)

      const filterTime = await measurePerformance(async () => {
        // Apply multiple filters rapidly
        const fileTypeFilter = screen.getByRole('checkbox', { name: /images/i })
        fireEvent.click(fileTypeFilter)

        const dateFilter = screen.getByRole('combobox', { name: /date range/i })
        fireEvent.change(dateFilter, { target: { value: 'last-week' } })

        const tagFilter = screen.getByRole('textbox', { name: /tags/i })
        fireEvent.change(tagFilter, { target: { value: 'design,final' } })

        const sizeFilter = screen.getByRole('range', { name: /file size/i })
        fireEvent.change(sizeFilter, { target: { value: '50' } })

        // Apply filters
        const applyButton = screen.getByRole('button', { name: /apply filters/i })
        fireEvent.click(applyButton)

        await waitFor(() => {
          expect(mockSupabase.from).toHaveBeenCalledTimes(2)
        })
      }, 'Multiple filter application')

      expectPerformance(filterTime, 1500, 'Multiple filter performance')
    })
  })

  describe('Memory Management', () => {
    it('should properly cleanup resources on unmount', async () => {
      const assets = Array.from({ length: 100 }, (_, i) => generateMockAsset({ id: `asset-${i}` }))
      
      mockSupabase.from().select().order().range().eq().is().or().in().gte().lte
        .mockResolvedValue({ data: assets, error: null })

      const memoryBefore = measureMemoryUsage()

      const { unmount } = render(<AssetBrowser projectId="project-1" />)

      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalled()
      })

      const memoryAfterMount = measureMemoryUsage()

      unmount()

      // Force garbage collection if available
      if (global.gc) {
        global.gc()
      }

      await new Promise(resolve => setTimeout(resolve, 100))

      const memoryAfterUnmount = measureMemoryUsage()

      // Verify cleanup
      expect(mockSupabase.removeChannel).toHaveBeenCalled()
      
      // Memory should be released (allowing for some variance)
      const memoryLeak = memoryAfterUnmount.heapUsed - memoryBefore.heapUsed
      expect(memoryLeak).toBeLessThan(10 * 1024 * 1024) // Less than 10MB leak
    })

    it('should handle image loading efficiently', async () => {
      const assetsWithImages = Array.from({ length: 50 }, (_, i) => 
        generateMockAsset({ 
          id: `image-asset-${i}`,
          file_type: 'image/jpeg',
          thumbnail_url: `https://example.com/thumb-${i}.jpg`
        })
      )

      mockSupabase.from().select().order().range().eq().is().or().in().gte().lte
        .mockResolvedValue({ data: assetsWithImages, error: null })

      const memoryBefore = measureMemoryUsage()

      const imageLoadTime = await measurePerformance(async () => {
        render(<AssetBrowser projectId="project-1" />)

        await waitFor(() => {
          expect(mockSupabase.from).toHaveBeenCalled()
        })

        // Simulate image loading
        const images = document.querySelectorAll('img')
        images.forEach(img => {
          fireEvent.load(img)
        })

        await new Promise(resolve => setTimeout(resolve, 500))
      }, 'Image loading')

      const memoryAfter = measureMemoryUsage()
      const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed

      expectPerformance(imageLoadTime, 2000, 'Image loading performance')
      expect(memoryIncrease).toBeLessThan(30 * 1024 * 1024) // Should use < 30MB for 50 images
    })
  })

  describe('Interaction Performance', () => {
    it('should handle rapid selection changes efficiently', async () => {
      const assets = Array.from({ length: 100 }, (_, i) => generateMockAsset({ id: `asset-${i}` }))
      
      mockSupabase.from().select().order().range().eq().is().or().in().gte().lte
        .mockResolvedValue({ data: assets, error: null })

      const onSelectionChange = vi.fn()

      render(
        <AssetBrowser 
          projectId="project-1" 
          selectionMode="multiple"
          onSelectionChange={onSelectionChange}
        />
      )

      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalled()
      })

      const selectionTime = await measurePerformance(async () => {
        // Simulate rapid selection changes
        for (let i = 0; i < 50; i++) {
          const checkbox = screen.getAllByRole('checkbox')[i]
          if (checkbox) {
            fireEvent.click(checkbox)
            await new Promise(resolve => setTimeout(resolve, 10))
          }
        }
      }, 'Rapid selection changes')

      expectPerformance(selectionTime, 2000, 'Selection change performance')
      expect(onSelectionChange).toHaveBeenCalledTimes(50)
    })

    it('should handle view mode switching efficiently', async () => {
      const assets = Array.from({ length: 200 }, (_, i) => generateMockAsset({ id: `asset-${i}` }))
      
      mockSupabase.from().select().order().range().eq().is().or().in().gte().lte
        .mockResolvedValue({ data: assets, error: null })

      render(<AssetBrowser projectId="project-1" />)

      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalled()
      })

      const viewSwitchTime = await measurePerformance(async () => {
        const listButton = screen.getByRole('button', { name: /list/i })
        fireEvent.click(listButton)

        await waitFor(() => {
          expect(screen.getByTestId('asset-list')).toBeInTheDocument()
        })

        const timelineButton = screen.getByRole('button', { name: /timeline/i })
        fireEvent.click(timelineButton)

        await waitFor(() => {
          expect(screen.getByTestId('asset-timeline')).toBeInTheDocument()
        })

        const gridButton = screen.getByRole('button', { name: /grid/i })
        fireEvent.click(gridButton)

        await waitFor(() => {
          expect(screen.getByTestId('asset-grid')).toBeInTheDocument()
        })
      }, 'View mode switching')

      expectPerformance(viewSwitchTime, 1500, 'View mode switch performance')
    })
  })

  describe('Network Performance', () => {
    it('should handle slow network conditions gracefully', async () => {
      // Simulate slow network
      mockSupabase.from().select().order().range().eq().is().or().in().gte().lte
        .mockImplementation(() => 
          new Promise(resolve => 
            setTimeout(() => resolve({ data: [], error: null }), 3000)
          )
        )

      const slowNetworkTime = await measurePerformance(async () => {
        render(<AssetBrowser projectId="project-1" />)

        // Should show loading state immediately
        expect(screen.getByRole('status', { name: /loading/i }) || 
               document.querySelector('.animate-spin')).toBeInTheDocument()

        await waitFor(() => {
          expect(mockSupabase.from).toHaveBeenCalled()
        }, { timeout: 5000 })
      }, 'Slow network handling')

      expectPerformance(slowNetworkTime, 5000, 'Slow network tolerance')
    })

    it('should implement efficient pagination', async () => {
      const totalAssets = 1000
      const pageSize = 50

      // Mock paginated responses
      mockSupabase.from().select().order().range().eq().is().or().in().gte().lte
        .mockImplementation((...args) => {
          const rangeCall = args[args.length - 1]
          if (typeof rangeCall === 'function') {
            // This is a range call, return appropriate slice
            const start = 0
            const end = pageSize - 1
            const pageAssets = Array.from({ length: pageSize }, (_, i) => 
              generateMockAsset({ id: `page-asset-${start + i}` })
            )
            return Promise.resolve({ data: pageAssets, error: null })
          }
          return Promise.resolve({ data: [], error: null })
        })

      const paginationTime = await measurePerformance(async () => {
        render(<AssetBrowser projectId="project-1" />)

        await waitFor(() => {
          expect(mockSupabase.from).toHaveBeenCalled()
        })

        // Simulate scrolling to trigger pagination
        const scrollContainer = document.querySelector('[data-testid="asset-grid"]')
        if (scrollContainer) {
          fireEvent.scroll(scrollContainer, { target: { scrollTop: 1000 } })
          
          await waitFor(() => {
            expect(mockSupabase.from).toHaveBeenCalledTimes(2)
          })
        }
      }, 'Pagination performance')

      expectPerformance(paginationTime, 2000, 'Pagination efficiency')
    })
  })
})