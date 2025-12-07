import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { AssetGridView } from '../AssetGridView'
import { EnhancedAsset } from '@/lib/services/assetManager'

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
    thumbnail_url: null,
    preview_url: null,
    metadata: {
      width: 1920,
      height: 1080,
      duration: 30,
      original_name: 'test-video.mp4',
      mime_type: 'video/mp4'
    },
    tags: [],
    status: 'processing',
    uploaded_by: 'test-user-id',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    last_accessed_at: '2024-01-02T12:00:00Z',
    access_count: 10,
    checksum: 'def456'
  }
]

const mockGetFileIcon = vi.fn((fileType: string) => <div data-testid={`icon-${fileType}`} />)
const mockFormatFileSize = vi.fn((bytes: number) => `${Math.round(bytes / 1024)} KB`)

describe('AssetGridView', () => {
  const defaultProps = {
    assets: mockAssets,
    selectedAssets: new Set<string>(),
    selectionMode: 'none' as const,
    onAssetSelection: vi.fn(),
    onAssetClick: vi.fn(),
    getFileIcon: mockGetFileIcon,
    formatFileSize: mockFormatFileSize
  }

  it('renders assets in grid layout', () => {
    render(<AssetGridView {...defaultProps} />)
    
    expect(screen.getByText('test-image.jpg')).toBeInTheDocument()
    expect(screen.getByText('test-video.mp4')).toBeInTheDocument()
  })

  it('displays asset thumbnails correctly', () => {
    render(<AssetGridView {...defaultProps} />)
    
    // Image asset should show thumbnail
    const imageElement = screen.getByAltText('test-image.jpg')
    expect(imageElement).toHaveAttribute('src', 'https://example.com/test-image-thumb.jpg')
    
    // Video asset without thumbnail should show icon
    expect(mockGetFileIcon).toHaveBeenCalledWith('video/mp4')
  })

  it('shows version badges for assets with version > 1', () => {
    render(<AssetGridView {...defaultProps} />)
    
    expect(screen.getByText('v2')).toBeInTheDocument()
    expect(screen.queryByText('v1')).not.toBeInTheDocument()
  })

  it('displays file size and creation date', () => {
    render(<AssetGridView {...defaultProps} />)
    
    expect(mockFormatFileSize).toHaveBeenCalledWith(1024000)
    expect(mockFormatFileSize).toHaveBeenCalledWith(5120000)
    
    expect(screen.getByText('1/1/2024')).toBeInTheDocument()
    expect(screen.getByText('1/2/2024')).toBeInTheDocument()
  })

  it('shows tags when available', () => {
    render(<AssetGridView {...defaultProps} />)
    
    expect(screen.getByText('design')).toBeInTheDocument()
    expect(screen.getByText('mockup')).toBeInTheDocument()
  })

  it('shows processing status', () => {
    render(<AssetGridView {...defaultProps} />)
    
    expect(screen.getByText('Processing...')).toBeInTheDocument()
  })

  it('handles asset click in view mode', () => {
    const onAssetClick = vi.fn()
    
    render(
      <AssetGridView 
        {...defaultProps} 
        onAssetClick={onAssetClick}
      />
    )
    
    fireEvent.click(screen.getByText('test-image.jpg').closest('.group')!)
    
    expect(onAssetClick).toHaveBeenCalledWith(mockAssets[0])
  })

  it('handles asset selection in selection mode', () => {
    const onAssetSelection = vi.fn()
    
    render(
      <AssetGridView 
        {...defaultProps} 
        selectionMode="multiple"
        onAssetSelection={onAssetSelection}
      />
    )
    
    // Click on asset card
    fireEvent.click(screen.getByText('test-image.jpg').closest('.group')!)
    
    expect(onAssetSelection).toHaveBeenCalledWith(mockAssets[0], true)
  })

  it('shows selection checkboxes in selection mode', () => {
    render(
      <AssetGridView 
        {...defaultProps} 
        selectionMode="multiple"
      />
    )
    
    const checkboxes = screen.getAllByRole('button')
    const selectionCheckboxes = checkboxes.filter(button => 
      button.querySelector('svg[data-testid="check"]') !== null ||
      button.className.includes('border-2')
    )
    
    expect(selectionCheckboxes.length).toBeGreaterThan(0)
  })

  it('shows selected state for selected assets', () => {
    const selectedAssets = new Set(['1'])
    
    render(
      <AssetGridView 
        {...defaultProps} 
        selectedAssets={selectedAssets}
        selectionMode="multiple"
      />
    )
    
    const selectedCard = screen.getByText('test-image.jpg').closest('.group')
    expect(selectedCard).toHaveClass('ring-2', 'ring-primary-500')
  })

  it('shows hover actions on mouse enter', () => {
    render(<AssetGridView {...defaultProps} />)
    
    const assetCard = screen.getByText('test-image.jpg').closest('.group')!
    
    fireEvent.mouseEnter(assetCard)
    
    // Actions should become visible (opacity-100)
    const actionsContainer = assetCard.querySelector('.absolute.inset-0')
    expect(actionsContainer).toHaveClass('opacity-100')
  })

  it('handles action button clicks', () => {
    const onAssetClick = vi.fn()
    
    render(
      <AssetGridView 
        {...defaultProps} 
        onAssetClick={onAssetClick}
      />
    )
    
    const assetCard = screen.getByText('test-image.jpg').closest('.group')!
    fireEvent.mouseEnter(assetCard)
    
    // Find and click preview button
    const previewButton = assetCard.querySelector('button[title="Preview"]') ||
                         assetCard.querySelector('button:has(svg)')
    
    if (previewButton) {
      fireEvent.click(previewButton)
      expect(onAssetClick).toHaveBeenCalledWith(mockAssets[0])
    }
  })

  it('displays metadata information', () => {
    render(<AssetGridView {...defaultProps} />)
    
    // Should show dimensions for image
    expect(screen.getByText('1920×1080')).toBeInTheDocument()
    
    // Should show duration for video
    expect(screen.getByText('30s')).toBeInTheDocument()
    
    // Should show access count
    expect(screen.getByText('5 views')).toBeInTheDocument()
    expect(screen.getByText('10 views')).toBeInTheDocument()
  })

  it('handles checkbox click separately from card click', () => {
    const onAssetSelection = vi.fn()
    const onAssetClick = vi.fn()
    
    render(
      <AssetGridView 
        {...defaultProps} 
        selectionMode="multiple"
        onAssetSelection={onAssetSelection}
        onAssetClick={onAssetClick}
      />
    )
    
    // Find checkbox button
    const checkboxes = screen.getAllByRole('button')
    const checkbox = checkboxes.find(button => 
      button.className.includes('border-2') && 
      button.className.includes('rounded')
    )
    
    if (checkbox) {
      fireEvent.click(checkbox)
      expect(onAssetSelection).toHaveBeenCalledWith(mockAssets[0], true)
      expect(onAssetClick).not.toHaveBeenCalled()
    }
  })

  it('truncates long tag lists', () => {
    const assetWithManyTags = {
      ...mockAssets[0],
      tags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5']
    }
    
    render(
      <AssetGridView 
        {...defaultProps} 
        assets={[assetWithManyTags]}
      />
    )
    
    expect(screen.getByText('+3')).toBeInTheDocument()
  })
})