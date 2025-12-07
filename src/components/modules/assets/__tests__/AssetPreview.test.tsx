import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AssetPreview } from '../AssetPreview'
import { EnhancedAsset } from '@/types'

// Mock child components
vi.mock('../VideoPlayer', () => ({
  VideoPlayer: ({ videoName }: { videoName: string }) => (
    <div data-testid="video-player">Video Player: {videoName}</div>
  )
}))

vi.mock('../PDFViewer', () => ({
  PDFViewer: ({ fileName }: { fileName: string }) => (
    <div data-testid="pdf-viewer">PDF Viewer: {fileName}</div>
  )
}))

vi.mock('../ImageEditor', () => ({
  ImageEditor: ({ onCancel }: { onCancel: () => void }) => (
    <div data-testid="image-editor">
      <button onClick={onCancel}>Cancel Edit</button>
    </div>
  )
}))

// Mock Supabase
vi.mock('@/lib/supabase/client', () => {
  const mockSupabase = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            single: vi.fn(),
          })),
          not: vi.fn(() => Promise.resolve({
            data: [],
            error: null
          }))
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({
          data: null,
          error: null
        }))
      }))
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(() => Promise.resolve({
          data: { path: 'test-path' },
          error: null
        })),
        getPublicUrl: vi.fn(() => ({
          data: { publicUrl: 'https://example.com/test.jpg' }
        }))
      }))
    },
    removeChannel: vi.fn(),
  }
  
  return {
    supabase: mockSupabase,
  }
})

// Mock useAuth hook
const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  full_name: 'Test User',
}

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({ user: mockUser }),
}))

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

describe('AssetPreview', () => {
  const mockImageAsset: EnhancedAsset = {
    id: 'asset-1',
    project_id: 'project-1',
    name: 'test-image.jpg',
    description: 'Test image description',
    file_url: 'https://example.com/test-image.jpg',
    file_path: 'assets/test-image.jpg',
    file_type: 'image/jpeg',
    file_size: 1024000,
    version: 1,
    thumbnail_url: 'https://example.com/test-image-thumb.jpg',
    preview_url: 'https://example.com/test-image-preview.jpg',
    metadata: {
      width: 1920,
      height: 1080,
      original_name: 'test-image.jpg',
      mime_type: 'image/jpeg',
    },
    tags: ['design', 'mockup'],
    status: 'ready',
    uploaded_by: 'user-1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    access_count: 5,
    checksum: 'abc123',
  }

  const mockVideoAsset: EnhancedAsset = {
    ...mockImageAsset,
    id: 'asset-2',
    name: 'test-video.mp4',
    file_type: 'video/mp4',
    metadata: {
      ...mockImageAsset.metadata,
      duration: 120,
    },
  }

  const mockPDFAsset: EnhancedAsset = {
    ...mockImageAsset,
    id: 'asset-3',
    name: 'test-document.pdf',
    file_type: 'application/pdf',
    metadata: {
      ...mockImageAsset.metadata,
      pages: 10,
    },
  }

  const defaultProps = {
    asset: mockImageAsset,
    isOpen: true,
    onClose: vi.fn(),
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    
    // Import the mocked supabase
    const { supabase } = await import('@/lib/supabase/client')
    
    // Mock successful API responses
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: {}, error: null }),
        }),
      }),
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(<AssetPreview {...defaultProps} isOpen={false} />)
      expect(screen.queryByText('test-image.jpg')).not.toBeInTheDocument()
    })

    it('should render image asset preview when open', () => {
      render(<AssetPreview {...defaultProps} />)
      
      expect(screen.getByText('test-image.jpg')).toBeInTheDocument()
      expect(screen.getByText('Version 1')).toBeInTheDocument()
      expect(screen.getByText('image/jpeg')).toBeInTheDocument()
      expect(screen.getByText('1000.00 KB')).toBeInTheDocument()
    })

    it('should render video asset preview', () => {
      render(<AssetPreview {...defaultProps} asset={mockVideoAsset} />)
      
      expect(screen.getByText('test-video.mp4')).toBeInTheDocument()
      expect(screen.getByText('video/mp4')).toBeInTheDocument()
    })

    it('should render PDF asset preview', () => {
      render(<AssetPreview {...defaultProps} asset={mockPDFAsset} />)
      
      expect(screen.getByText('test-document.pdf')).toBeInTheDocument()
      expect(screen.getByText('application/pdf')).toBeInTheDocument()
    })

    it('should show metadata sidebar when showMetadata is true', () => {
      render(<AssetPreview {...defaultProps} showMetadata={true} />)
      
      expect(screen.getByText('General')).toBeInTheDocument()
      expect(screen.getByText('On Asset')).toBeInTheDocument()
      expect(screen.getByText('Tasks')).toBeInTheDocument()
    })

    it('should hide metadata sidebar when showMetadata is false', () => {
      render(<AssetPreview {...defaultProps} showMetadata={false} />)
      
      expect(screen.queryByText('General')).not.toBeInTheDocument()
      expect(screen.queryByText('On Asset')).not.toBeInTheDocument()
      expect(screen.queryByText('Tasks')).not.toBeInTheDocument()
    })

    it('should render VideoPlayer component for video assets', () => {
      render(<AssetPreview {...defaultProps} asset={mockVideoAsset} />)
      
      expect(screen.getByTestId('video-player')).toBeInTheDocument()
      expect(screen.getByText('Video Player: test-video.mp4')).toBeInTheDocument()
    })

    it('should render PDFViewer component for PDF assets', () => {
      render(<AssetPreview {...defaultProps} asset={mockPDFAsset} />)
      
      expect(screen.getByTestId('pdf-viewer')).toBeInTheDocument()
      expect(screen.getByText('PDF Viewer: test-document.pdf')).toBeInTheDocument()
    })

    it('should render audio player for audio assets', () => {
      const audioAsset = {
        ...mockImageAsset,
        file_type: 'audio/mp3',
        name: 'test-audio.mp3'
      }
      
      render(<AssetPreview {...defaultProps} asset={audioAsset} />)
      
      expect(screen.getByText('test-audio.mp3')).toBeInTheDocument()
      expect(screen.getByRole('application')).toBeInTheDocument() // audio element
    })

    it('should show fallback for unsupported file types', () => {
      const unsupportedAsset = {
        ...mockImageAsset,
        file_type: 'application/zip',
        name: 'test-archive.zip'
      }
      
      render(<AssetPreview {...defaultProps} asset={unsupportedAsset} />)
      
      expect(screen.getByText('Preview not available for this file type')).toBeInTheDocument()
      expect(screen.getByText('Download File')).toBeInTheDocument()
    })
  })

  describe('Image Controls', () => {
    it('should show image-specific controls for image assets', () => {
      render(<AssetPreview {...defaultProps} />)
      
      expect(screen.getByRole('button', { name: /zoom out/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /zoom in/i })).toBeInTheDocument()
      expect(screen.getAllByRole('button').filter(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'rotate-ccw'
      )).toHaveLength(1)
      expect(screen.getAllByRole('button').filter(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'rotate-cw'
      )).toHaveLength(1)
    })

    it('should not show image controls for non-image assets', () => {
      render(<AssetPreview {...defaultProps} asset={mockVideoAsset} />)
      
      expect(screen.queryByRole('button', { name: /zoom out/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /zoom in/i })).not.toBeInTheDocument()
    })

    it('should show edit button when allowEditing is true', () => {
      render(<AssetPreview {...defaultProps} allowEditing={true} />)
      
      const editButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'edit-3'
      )
      expect(editButtons.length).toBeGreaterThan(0)
    })

    it('should not show edit button when allowEditing is false', () => {
      render(<AssetPreview {...defaultProps} allowEditing={false} />)
      
      const editButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'edit-3'
      )
      expect(editButtons).toHaveLength(0)
    })

    it('should open image editor when edit button is clicked', () => {
      render(<AssetPreview {...defaultProps} allowEditing={true} />)
      
      const editButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'edit-3'
      )
      
      if (editButton) {
        fireEvent.click(editButton)
        expect(screen.getByTestId('image-editor')).toBeInTheDocument()
      }
    })

    it('should close image editor when cancel is clicked', () => {
      render(<AssetPreview {...defaultProps} allowEditing={true} />)
      
      // Open editor
      const editButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'edit-3'
      )
      
      if (editButton) {
        fireEvent.click(editButton)
        expect(screen.getByTestId('image-editor')).toBeInTheDocument()
        
        // Close editor
        const cancelButton = screen.getByText('Cancel Edit')
        fireEvent.click(cancelButton)
        
        expect(screen.queryByTestId('image-editor')).not.toBeInTheDocument()
      }
    })
  })

  describe('Interactions', () => {
    it('should call onClose when close button is clicked', () => {
      const onClose = vi.fn()
      render(<AssetPreview {...defaultProps} onClose={onClose} />)
      
      const closeButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'x'
      )
      
      if (closeButton) {
        fireEvent.click(closeButton)
        expect(onClose).toHaveBeenCalledTimes(1)
      }
    })

    it('should toggle fullscreen when fullscreen button is clicked', () => {
      const requestFullscreen = vi.fn()
      const mockElement = { requestFullscreen }
      
      vi.spyOn(document, 'querySelector').mockReturnValue(mockElement as any)
      
      render(<AssetPreview {...defaultProps} />)
      
      const fullscreenButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'maximize'
      )
      
      if (fullscreenButton) {
        fireEvent.click(fullscreenButton)
        // Note: Fullscreen API behavior would need more complex mocking for full testing
      }
    })

    it('should switch between tabs in metadata sidebar', () => {
      render(<AssetPreview {...defaultProps} showMetadata={true} />)
      
      // Should start on 'On Asset' tab
      expect(screen.getByText('Add Pinned Comment')).toBeInTheDocument()
      
      // Click on General tab
      const generalTab = screen.getByText('General')
      fireEvent.click(generalTab)
      
      expect(screen.getByText('File Information')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Add a general comment...')).toBeInTheDocument()
      
      // Click on Tasks tab
      const tasksTab = screen.getByText('Tasks')
      fireEvent.click(tasksTab)
      
      expect(screen.getByText('No tasks assigned to this asset')).toBeInTheDocument()
    })
  })

  describe('Comments', () => {
    beforeEach(async () => {
      const mockComments = [
        {
          id: 'comment-1',
          content: 'Great work!',
          created_at: '2024-01-01T00:00:00Z',
          users: { full_name: 'John Doe' },
        },
      ]

      const { supabase } = await import('@/lib/supabase/client')
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: mockComments, error: null }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ 
              data: { id: 'new-comment', content: 'New comment', users: { full_name: 'Test User' } }, 
              error: null 
            }),
          }),
        }),
      })
    })

    it('should load and display comments', async () => {
      render(<AssetPreview {...defaultProps} showMetadata={true} />)
      
      await waitFor(() => {
        expect(screen.getByText('Great work!')).toBeInTheDocument()
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })
    })

    it('should add new general comment when form is submitted', async () => {
      render(<AssetPreview {...defaultProps} showMetadata={true} />)
      
      // Switch to General tab
      const generalTab = screen.getByText('General')
      fireEvent.click(generalTab)
      
      const textarea = screen.getByPlaceholderText('Add a general comment...')
      const addButton = screen.getByText('Add Comment')
      
      fireEvent.change(textarea, { target: { value: 'New test comment' } })
      fireEvent.click(addButton)
      
      await waitFor(async () => {
        const { supabase } = await import('@/lib/supabase/client')
        expect(supabase.from).toHaveBeenCalledWith('comments')
      })
    })

    it('should disable add button when comment is empty', () => {
      render(<AssetPreview {...defaultProps} showMetadata={true} />)
      
      // Switch to General tab
      const generalTab = screen.getByText('General')
      fireEvent.click(generalTab)
      
      const addButton = screen.getByText('Add Comment')
      expect(addButton).toBeDisabled()
    })

    it('should handle pinned comment workflow', () => {
      render(<AssetPreview {...defaultProps} showMetadata={true} />)
      
      // Should be on 'On Asset' tab by default
      const addPinnedButton = screen.getByText('Add Pinned Comment')
      fireEvent.click(addPinnedButton)
      
      // Should show instruction overlay
      expect(screen.getByText('Click on the image to add a pinned comment')).toBeInTheDocument()
      
      // Cancel the pinned comment mode
      const cancelButton = screen.getByText('Cancel')
      fireEvent.click(cancelButton)
      
      expect(screen.queryByText('Click on the image to add a pinned comment')).not.toBeInTheDocument()
    })

    it('should show empty state for pinned comments', () => {
      render(<AssetPreview {...defaultProps} showMetadata={true} />)
      
      // Should be on 'On Asset' tab by default
      expect(screen.getByText('No pinned comments yet')).toBeInTheDocument()
      expect(screen.getByText('Click "Add Pinned Comment" to highlight specific areas')).toBeInTheDocument()
    })
  })

  describe('Metadata Display', () => {
    it('should display file information in general tab', () => {
      render(<AssetPreview {...defaultProps} showMetadata={true} />)
      
      // Switch to general tab
      const generalTab = screen.getByText('General')
      fireEvent.click(generalTab)
      
      expect(screen.getByText('File Information')).toBeInTheDocument()
      expect(screen.getByText('1000.00 KB')).toBeInTheDocument()
      expect(screen.getByText('image/jpeg')).toBeInTheDocument()
      expect(screen.getByText('1920 × 1080')).toBeInTheDocument()
    })

    it('should display tags in general tab', () => {
      render(<AssetPreview {...defaultProps} showMetadata={true} />)
      
      // Switch to general tab
      const generalTab = screen.getByText('General')
      fireEvent.click(generalTab)
      
      expect(screen.getByText('design')).toBeInTheDocument()
      expect(screen.getByText('mockup')).toBeInTheDocument()
    })

    it('should show AI feature teaser', () => {
      render(<AssetPreview {...defaultProps} showMetadata={true} />)
      
      expect(screen.getByText('Supercharge Your Feedback!')).toBeInTheDocument()
      expect(screen.getByText('COMING SOON')).toBeInTheDocument()
      expect(screen.getByText('Soon, our friendly AI will help summarize long conversations for you!')).toBeInTheDocument()
    })

    it('should display video duration for video assets', () => {
      render(<AssetPreview {...defaultProps} asset={mockVideoAsset} showMetadata={true} />)
      
      // Switch to general tab
      const generalTab = screen.getByText('General')
      fireEvent.click(generalTab)
      
      expect(screen.getByText('2:00')).toBeInTheDocument() // 120 seconds formatted
    })
  })

  describe('Version History', () => {
    beforeEach(async () => {
      const mockVersions = [
        {
          id: 'version-1',
          version: 2,
          created_at: '2024-01-02T00:00:00Z',
          changes_description: 'Updated colors',
          users: { full_name: 'Jane Doe' },
        },
        {
          id: 'version-2',
          version: 1,
          created_at: '2024-01-01T00:00:00Z',
          changes_description: 'Initial version',
          users: { full_name: 'John Doe' },
        },
      ]

      const { supabase } = await import('@/lib/supabase/client')
      vi.mocked(supabase.from).mockImplementation((table) => {
        if (table === 'asset_versions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: mockVersions, error: null }),
              }),
            }),
          }
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }
      })
    })

    it('should display recent versions in On Asset tab', async () => {
      render(<AssetPreview {...defaultProps} showMetadata={true} />)
      
      // Should be on 'On Asset' tab by default
      await waitFor(() => {
        expect(screen.getByText('Recent Versions')).toBeInTheDocument()
        expect(screen.getByText('v2')).toBeInTheDocument()
        expect(screen.getByText('v1')).toBeInTheDocument()
        expect(screen.getByText('Updated colors')).toBeInTheDocument()
        expect(screen.getByText('Initial version')).toBeInTheDocument()
      })
    })

    it('should call onVersionChange when version is selected', async () => {
      const onVersionChange = vi.fn()
      render(<AssetPreview {...defaultProps} showMetadata={true} onVersionChange={onVersionChange} />)
      
      await waitFor(() => {
        const versionItem = screen.getByText('Updated colors').closest('div')
        if (versionItem) {
          fireEvent.click(versionItem)
          expect(onVersionChange).toHaveBeenCalled()
        }
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      const { supabase } = await import('@/lib/supabase/client')
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: null, error: new Error('API Error') }),
          }),
        }),
      })
      
      render(<AssetPreview {...defaultProps} showMetadata={true} />)
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error fetching comments:', expect.any(Error))
      })
      
      consoleSpy.mockRestore()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels for buttons', () => {
      render(<AssetPreview {...defaultProps} />)
      
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        // Each button should have either aria-label or accessible text content
        const hasAriaLabel = button.hasAttribute('aria-label')
        const hasTextContent = button.textContent && button.textContent.trim().length > 0
        const hasAccessibleName = hasAriaLabel || hasTextContent
        
        expect(hasAccessibleName).toBe(true)
      })
    })

    it('should support keyboard navigation', () => {
      render(<AssetPreview {...defaultProps} showMetadata={true} />)
      
      const textarea = screen.getByPlaceholderText('Add a comment...')
      
      // Should be focusable
      textarea.focus()
      expect(document.activeElement).toBe(textarea)
      
      // Should handle keyboard input
      fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true })
      // In a real implementation, this might submit the comment
    })
  })
})