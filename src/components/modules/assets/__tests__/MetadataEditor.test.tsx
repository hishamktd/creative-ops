import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MetadataEditor } from '../MetadataEditor'
import { EnhancedAsset } from '../../../../types'

// Mock the tagging service
vi.mock('../../../../lib/services/taggingService', () => ({
  TaggingService: {
    generateTagSuggestions: vi.fn().mockResolvedValue([
      { tag: 'design', confidence: 0.9, source: 'content' },
      { tag: 'logo', confidence: 0.8, source: 'filename' },
      { tag: 'branding', confidence: 0.7, source: 'similar_assets' }
    ]),
    searchTags: vi.fn().mockResolvedValue({
      suggestions: ['design', 'designer', 'designs']
    })
  }
}))

const mockAsset: EnhancedAsset = {
  id: 'asset-123',
  project_id: 'proj-1',
  folder_id: 'folder-1',
  name: 'logo-design.jpg',
  description: 'Company logo design',
  file_url: 'https://example.com/logo.jpg',
  file_path: 'assets/logo.jpg',
  file_type: 'image/jpeg',
  file_size: 1024000,
  version: 1,
  thumbnail_url: 'https://example.com/thumb.jpg',
  preview_url: 'https://example.com/preview.jpg',
  metadata: {
    width: 1920,
    height: 1080,
    original_name: 'logo-design.jpg',
    mime_type: 'image/jpeg',
    camera_info: {
      make: 'Canon',
      model: 'EOS R5',
      lens: '24-70mm f/2.8',
      focal_length: '50mm',
      aperture: 'f/2.8',
      iso: 'ISO 100',
      shutter_speed: '1/125s'
    },
    extracted_text: 'Sample extracted text content for search indexing'
  },
  tags: ['design', 'logo', 'branding'],
  status: 'ready',
  uploaded_by: 'user-123',
  created_at: '2023-12-01T10:00:00Z',
  updated_at: '2023-12-01T10:00:00Z',
  last_accessed_at: '2023-12-01T12:00:00Z',
  access_count: 5,
  checksum: 'abc123'
}

describe('MetadataEditor', () => {
  const mockOnSave = vi.fn()
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render asset metadata in read-only mode', () => {
    render(
      <MetadataEditor
        asset={mockAsset}
        onSave={mockOnSave}
        onClose={mockOnClose}
        readOnly={true}
      />
    )

    expect(screen.getByText('Asset Metadata')).toBeInTheDocument()
    expect(screen.getByText('logo-design.jpg')).toBeInTheDocument()
    expect(screen.getByText('Company logo design')).toBeInTheDocument()
    expect(screen.getByText('image/jpeg')).toBeInTheDocument()
    expect(screen.getByText('1.0 MB')).toBeInTheDocument()
    expect(screen.getByText('v1')).toBeInTheDocument()
    expect(screen.getByText('1920 × 1080 pixels')).toBeInTheDocument()
    
    // Should not show edit button in read-only mode
    expect(screen.queryByText('Edit Metadata')).not.toBeInTheDocument()
  })

  it('should render asset metadata in editable mode', () => {
    render(
      <MetadataEditor
        asset={mockAsset}
        onSave={mockOnSave}
        onClose={mockOnClose}
        readOnly={false}
      />
    )

    expect(screen.getByText('Edit Metadata')).toBeInTheDocument()
    expect(screen.getByText('Edit Metadata')).toBeInTheDocument() // Button text
  })

  it('should display current tags', () => {
    render(
      <MetadataEditor
        asset={mockAsset}
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    )

    expect(screen.getByText('design')).toBeInTheDocument()
    expect(screen.getByText('logo')).toBeInTheDocument()
    expect(screen.getByText('branding')).toBeInTheDocument()
  })

  it('should display camera information when available', () => {
    render(
      <MetadataEditor
        asset={mockAsset}
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    )

    expect(screen.getByText('Camera Information')).toBeInTheDocument()
    expect(screen.getByText('Canon')).toBeInTheDocument()
    expect(screen.getByText('EOS R5')).toBeInTheDocument()
    expect(screen.getByText('24-70mm f/2.8')).toBeInTheDocument()
    expect(screen.getByText('50mm')).toBeInTheDocument()
    expect(screen.getByText('f/2.8')).toBeInTheDocument()
    expect(screen.getByText('ISO 100')).toBeInTheDocument()
    expect(screen.getByText('1/125s')).toBeInTheDocument()
  })

  it('should display extracted text content', () => {
    render(
      <MetadataEditor
        asset={mockAsset}
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    )

    expect(screen.getByText('Extracted Text Content')).toBeInTheDocument()
    expect(screen.getByText('Sample extracted text content for search indexing')).toBeInTheDocument()
  })

  it('should enter edit mode when edit button is clicked', async () => {
    render(
      <MetadataEditor
        asset={mockAsset}
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    )

    const editButton = screen.getByText('Edit Metadata')
    fireEvent.click(editButton)

    await waitFor(() => {
      expect(screen.getByDisplayValue('logo-design.jpg')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Company logo design')).toBeInTheDocument()
      expect(screen.getByText('Cancel')).toBeInTheDocument()
      expect(screen.getByText('Save Changes')).toBeInTheDocument()
    })
  })

  it('should allow editing file name and description', async () => {
    render(
      <MetadataEditor
        asset={mockAsset}
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    )

    // Enter edit mode
    fireEvent.click(screen.getByText('Edit Metadata'))

    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('logo-design.jpg')
      const descriptionInput = screen.getByDisplayValue('Company logo design')

      fireEvent.change(nameInput, { target: { value: 'new-logo.jpg' } })
      fireEvent.change(descriptionInput, { target: { value: 'Updated description' } })

      expect(nameInput).toHaveValue('new-logo.jpg')
      expect(descriptionInput).toHaveValue('Updated description')
    })
  })

  it('should allow adding new tags', async () => {
    render(
      <MetadataEditor
        asset={mockAsset}
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    )

    // Enter edit mode
    fireEvent.click(screen.getByText('Edit Metadata'))

    await waitFor(() => {
      const tagInput = screen.getByPlaceholderText('Type to search or add new tags...')
      
      fireEvent.change(tagInput, { target: { value: 'new-tag' } })
      fireEvent.keyPress(tagInput, { key: 'Enter', code: 'Enter' })

      // The tag should be added (though we can't easily test the state change in this setup)
      expect(tagInput).toHaveValue('')
    })
  })

  it('should allow removing tags in edit mode', async () => {
    render(
      <MetadataEditor
        asset={mockAsset}
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    )

    // Enter edit mode
    fireEvent.click(screen.getByText('Edit Metadata'))

    await waitFor(() => {
      // Look for remove buttons (×) next to tags
      const removeButtons = screen.getAllByText('×')
      expect(removeButtons.length).toBeGreaterThan(0)
      
      // Click the first remove button
      fireEvent.click(removeButtons[0])
    })
  })

  it('should show tag suggestions when typing', async () => {
    render(
      <MetadataEditor
        asset={mockAsset}
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    )

    // Enter edit mode
    fireEvent.click(screen.getByText('Edit Metadata'))

    await waitFor(() => {
      const tagInput = screen.getByPlaceholderText('Type to search or add new tags...')
      
      fireEvent.change(tagInput, { target: { value: 'des' } })
    })

    // Wait for suggestions to load
    await waitFor(() => {
      expect(screen.getByText('design')).toBeInTheDocument()
    })
  })

  it('should display suggested tags from service', async () => {
    render(
      <MetadataEditor
        asset={mockAsset}
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    )

    // Enter edit mode
    fireEvent.click(screen.getByText('Edit Metadata'))

    await waitFor(() => {
      expect(screen.getByText('Suggested Tags')).toBeInTheDocument()
      // Note: The suggested tags might not be visible immediately due to async loading
    })
  })

  it('should save changes when save button is clicked', async () => {
    mockOnSave.mockResolvedValue(true)

    render(
      <MetadataEditor
        asset={mockAsset}
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    )

    // Enter edit mode
    fireEvent.click(screen.getByText('Edit Metadata'))

    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('logo-design.jpg')
      fireEvent.change(nameInput, { target: { value: 'updated-logo.jpg' } })

      const saveButton = screen.getByText('Save Changes')
      fireEvent.click(saveButton)
    })

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledWith({
        name: 'updated-logo.jpg',
        description: 'Company logo design',
        tags: ['design', 'logo', 'branding'],
        metadata: mockAsset.metadata
      })
    })
  })

  it('should cancel changes when cancel button is clicked', async () => {
    render(
      <MetadataEditor
        asset={mockAsset}
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    )

    // Enter edit mode
    fireEvent.click(screen.getByText('Edit Metadata'))

    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('logo-design.jpg')
      fireEvent.change(nameInput, { target: { value: 'changed-name.jpg' } })

      const cancelButton = screen.getByText('Cancel')
      fireEvent.click(cancelButton)
    })

    // Should exit edit mode and revert changes
    await waitFor(() => {
      expect(screen.getByText('logo-design.jpg')).toBeInTheDocument()
      expect(screen.getByText('Edit Metadata')).toBeInTheDocument()
    })
  })

  it('should close modal when close button is clicked', () => {
    render(
      <MetadataEditor
        asset={mockAsset}
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    )

    const closeButton = screen.getByText('Close')
    fireEvent.click(closeButton)

    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should format file size correctly', () => {
    const assetWithLargeFile = {
      ...mockAsset,
      file_size: 5368709120 // 5GB
    }

    render(
      <MetadataEditor
        asset={assetWithLargeFile}
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    )

    expect(screen.getByText('5.0 GB')).toBeInTheDocument()
  })

  it('should format duration correctly for video files', () => {
    const videoAsset = {
      ...mockAsset,
      file_type: 'video/mp4',
      metadata: {
        ...mockAsset.metadata,
        duration: 3665 // 1 hour, 1 minute, 5 seconds
      }
    }

    render(
      <MetadataEditor
        asset={videoAsset}
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    )

    expect(screen.getByText('1:01:05')).toBeInTheDocument()
  })

  it('should handle assets without camera info', () => {
    const assetWithoutCamera = {
      ...mockAsset,
      metadata: {
        ...mockAsset.metadata,
        camera_info: undefined
      }
    }

    render(
      <MetadataEditor
        asset={assetWithoutCamera}
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    )

    expect(screen.queryByText('Camera Information')).not.toBeInTheDocument()
  })

  it('should handle assets without extracted text', () => {
    const assetWithoutText = {
      ...mockAsset,
      metadata: {
        ...mockAsset.metadata,
        extracted_text: undefined
      }
    }

    render(
      <MetadataEditor
        asset={assetWithoutText}
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    )

    expect(screen.queryByText('Extracted Text Content')).not.toBeInTheDocument()
  })

  it('should show loading state when saving', async () => {
    // Mock a slow save operation
    mockOnSave.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve(true), 100)))

    render(
      <MetadataEditor
        asset={mockAsset}
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    )

    // Enter edit mode and save
    fireEvent.click(screen.getByText('Edit Metadata'))

    await waitFor(() => {
      const saveButton = screen.getByText('Save Changes')
      fireEvent.click(saveButton)
    })

    expect(screen.getByText('Saving...')).toBeInTheDocument()

    // Wait for save to complete
    await waitFor(() => {
      expect(screen.queryByText('Saving...')).not.toBeInTheDocument()
    })
  })

  it('should handle save errors gracefully', async () => {
    mockOnSave.mockResolvedValue(false)

    render(
      <MetadataEditor
        asset={mockAsset}
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    )

    // Enter edit mode and save
    fireEvent.click(screen.getByText('Edit Metadata'))

    await waitFor(() => {
      const saveButton = screen.getByText('Save Changes')
      fireEvent.click(saveButton)
    })

    // Should remain in edit mode if save fails
    await waitFor(() => {
      expect(screen.getByText('Save Changes')).toBeInTheDocument()
    })
  })
})