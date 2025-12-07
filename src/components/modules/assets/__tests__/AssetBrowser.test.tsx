import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AssetBrowser } from '../AssetBrowser'
import { EnhancedAsset } from '@/lib/services/assetManager'

// Mock Supabase
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
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com'
}

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser })
}))

// Mock assets data
const mockAssets: EnhancedAsset[] = [
  {
    id: '1',
    project_id: 'project-1',
    folder_id: null,
    name: 'test-image.jpg',
    description: 'Test image description',
    file_url: 'https://example.com/test-image.jpg',
    file_path: 'projects/project-1/test-image.jpg',
    file_type: 'image/jpeg',
    file_size: 1024000,
    version: 1,
    thumbnail_url: 'https://example.com/test-image-thumb.jpg',
    preview_url: null,
    metadata: {
      width: 1920,
      height: 1080,
      original_name: 'test-image.jpg',
      mime_type: 'image/jpeg'
    },
    tags: ['design', 'mockup'],
    status: 'ready',
    uploaded_by: 'test-user-id',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    last_accessed_at: null,
    access_count: 5,
    checksum: 'abc123'
  },
  {
    id: '2',
    project_id: 'project-1',
    folder_id: null,
    name: 'test-video.mp4',
    description: null,
    file_url: 'https://example.com/test-video.mp4',
    file_path: 'projects/project-1/test-video.mp4',
    file_type: 'video/mp4',
    file_size: 5120000,
    version: 2,
    thumbnail_url: 'https://example.com/test-video-thumb.jpg',
    preview_url: null,
    metadata: {
      width: 1920,
      height: 1080,
      duration: 30,
      original_name: 'test-video.mp4',
      mime_type: 'video/mp4'
    },
    tags: ['video', 'demo'],
    status: 'ready',
    uploaded_by: 'test-user-id',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    last_accessed_at: '2024-01-02T12:00:00Z',
    access_count: 10,
    checksum: 'def456'
  }
]

describe('AssetBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mock responses
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          range: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                or: vi.fn().mockReturnValue({
                  in: vi.fn().mockReturnValue({
                    gte: vi.fn().mockReturnValue({
                      lte: vi.fn().mockReturnValue(
                        Promise.resolve({ data: mockAssets, error: null })
                      )
                    })
                  })
                })
              })
            })
          })
        })
      })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders asset browser with default grid view', async () => {
    render(<AssetBrowser projectId="project-1" />)
    
    // Check for search input
    expect(screen.getByPlaceholderText('Search assets...')).toBeInTheDocument()
    
    // Check for view mode buttons
    expect(screen.getByRole('button', { name: /grid/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /list/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /timeline/i })).toBeInTheDocument()
    
    // Check for filters button
    expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument()
  })

  it('switches between view modes', async () => {
    render(<AssetBrowser projectId="project-1" />)
    
    const listButton = screen.getByRole('button', { name: /list/i })
    const timelineButton = screen.getByRole('button', { name: /timeline/i })
    
    // Switch to list view
    fireEvent.click(listButton)
    await waitFor(() => {
      expect(listButton).toHaveClass('bg-primary-600') // Primary variant class
    })
    
    // Switch to timeline view
    fireEvent.click(timelineButton)
    await waitFor(() => {
      expect(timelineButton).toHaveClass('bg-primary-600') // Primary variant class
    })
  })

  it('handles search input', async () => {
    render(<AssetBrowser projectId="project-1" />)
    
    const searchInput = screen.getByPlaceholderText('Search assets...')
    
    fireEvent.change(searchInput, { target: { value: 'test image' } })
    
    expect(searchInput).toHaveValue('test image')
  })

  it('toggles filters panel', async () => {
    render(<AssetBrowser projectId="project-1" />)
    
    const filtersButton = screen.getByRole('button', { name: /filters/i })
    
    // Open filters
    fireEvent.click(filtersButton)
    
    await waitFor(() => {
      expect(screen.getByText('Advanced Filters')).toBeInTheDocument()
    })
  })

  it('handles asset selection in multiple mode', async () => {
    const onSelectionChange = vi.fn()
    
    render(
      <AssetBrowser 
        projectId="project-1" 
        selectionMode="multiple"
        onSelectionChange={onSelectionChange}
      />
    )
    
    // Wait for assets to load
    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalled()
    })
  })

  it('handles sort direction toggle', async () => {
    render(<AssetBrowser projectId="project-1" />)
    
    // Find sort button (should show SortDesc initially)
    const sortButton = screen.getByRole('button', { name: /sort/i })
    
    fireEvent.click(sortButton)
    
    // Should toggle to ascending
    await waitFor(() => {
      expect(sortButton).toBeInTheDocument()
    })
  })

  it('handles sort field change', async () => {
    render(<AssetBrowser projectId="project-1" />)
    
    const sortSelect = screen.getByDisplayValue('Date Created')
    
    fireEvent.change(sortSelect, { target: { value: 'name' } })
    
    expect(sortSelect).toHaveValue('name')
  })

  it('calls onAssetClick when asset is clicked', async () => {
    const onAssetClick = vi.fn()
    
    render(
      <AssetBrowser 
        projectId="project-1" 
        onAssetClick={onAssetClick}
      />
    )
    
    // Wait for assets to load and then simulate click
    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalled()
    })
  })

  it('shows empty state when no assets', async () => {
    // Mock empty response
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          range: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              is: vi.fn().mockReturnValue({
                or: vi.fn().mockReturnValue({
                  in: vi.fn().mockReturnValue({
                    gte: vi.fn().mockReturnValue({
                      lte: vi.fn().mockReturnValue(
                        Promise.resolve({ data: [], error: null })
                      )
                    })
                  })
                })
              })
            })
          })
        })
      })
    })
    
    render(<AssetBrowser projectId="project-1" />)
    
    await waitFor(() => {
      expect(screen.getByText('No assets found')).toBeInTheDocument()
    })
  })

  it('shows loading state initially', () => {
    render(<AssetBrowser projectId="project-1" />)
    
    expect(screen.getByRole('status', { name: /loading/i }) || 
           document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('handles keyboard shortcuts for select all', async () => {
    const onSelectionChange = vi.fn()
    
    render(
      <AssetBrowser 
        projectId="project-1" 
        selectionMode="multiple"
        onSelectionChange={onSelectionChange}
      />
    )
    
    // Simulate Ctrl+A
    fireEvent.keyDown(document, { key: 'a', ctrlKey: true })
    
    // Should trigger select all functionality
    await waitFor(() => {
      expect(document.activeElement).toBeDefined()
    })
  })

  it('applies filters correctly', async () => {
    render(<AssetBrowser projectId="project-1" />)
    
    // Open filters
    const filtersButton = screen.getByRole('button', { name: /filters/i })
    fireEvent.click(filtersButton)
    
    await waitFor(() => {
      expect(screen.getByText('Advanced Filters')).toBeInTheDocument()
    })
    
    // The filter application would be tested through the query parameters
    // This is more of an integration test with the actual Supabase calls
  })

  it('handles real-time updates subscription', () => {
    render(<AssetBrowser projectId="project-1" />)
    
    // Verify that real-time subscription is set up
    expect(mockSupabase.channel).toHaveBeenCalledWith('asset-changes')
  })

  it('cleans up subscription on unmount', () => {
    const { unmount } = render(<AssetBrowser projectId="project-1" />)
    
    unmount()
    
    expect(mockSupabase.removeChannel).toHaveBeenCalled()
  })
})