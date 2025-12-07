import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'
import { AssetEmptyState } from '../AssetEmptyState'

describe('AssetEmptyState', () => {
  const mockOnUploadClick = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with default props', () => {
    render(<AssetEmptyState onUploadClick={mockOnUploadClick} />)
    
    expect(screen.getByText('This folder is looking a bit empty!')).toBeInTheDocument()
    expect(screen.getByText('Drag and drop files here to get started, or use the upload button.')).toBeInTheDocument()
    expect(screen.getByText('Upload Files')).toBeInTheDocument()
  })

  it('renders with custom title and description', () => {
    const customTitle = 'No assets found'
    const customDescription = 'Start by uploading your first file'
    
    render(
      <AssetEmptyState
        onUploadClick={mockOnUploadClick}
        title={customTitle}
        description={customDescription}
      />
    )
    
    expect(screen.getByText(customTitle)).toBeInTheDocument()
    expect(screen.getByText(customDescription)).toBeInTheDocument()
  })

  it('hides upload button when showUploadButton is false', () => {
    render(
      <AssetEmptyState
        onUploadClick={mockOnUploadClick}
        showUploadButton={false}
      />
    )
    
    expect(screen.queryByText('Upload Files')).not.toBeInTheDocument()
  })

  it('calls onUploadClick when upload button is clicked', () => {
    render(<AssetEmptyState onUploadClick={mockOnUploadClick} />)
    
    const uploadButton = screen.getByText('Upload Files')
    fireEvent.click(uploadButton)
    
    expect(mockOnUploadClick).toHaveBeenCalledTimes(1)
  })

  it('applies custom className', () => {
    const customClass = 'custom-empty-state'
    
    render(
      <AssetEmptyState
        onUploadClick={mockOnUploadClick}
        className={customClass}
      />
    )
    
    const container = screen.getByText('This folder is looking a bit empty!').closest('.col-span-full')
    expect(container).toHaveClass(customClass)
  })

  it('displays cloud upload icon', () => {
    render(<AssetEmptyState onUploadClick={mockOnUploadClick} />)
    
    const icon = screen.getByText('cloud_upload')
    expect(icon).toBeInTheDocument()
    expect(icon).toHaveClass('material-symbols-outlined')
  })

  it('displays supported formats information', () => {
    render(<AssetEmptyState onUploadClick={mockOnUploadClick} />)
    
    expect(screen.getByText('Supported formats: Images, Videos, Documents, Audio')).toBeInTheDocument()
    expect(screen.getByText('You can also paste images directly or drag files from your computer')).toBeInTheDocument()
  })

  it('has proper styling classes', () => {
    render(<AssetEmptyState onUploadClick={mockOnUploadClick} />)
    
    const container = screen.getByText('This folder is looking a bit empty!').closest('div')
    expect(container).toHaveClass('text-center', 'border-2', 'border-dashed', 'rounded-xl')
  })

  it('has hover effect on border', () => {
    render(<AssetEmptyState onUploadClick={mockOnUploadClick} />)
    
    const borderContainer = screen.getByText('This folder is looking a bit empty!').closest('div')
    expect(borderContainer).toHaveClass('hover:border-primary/50')
  })
})