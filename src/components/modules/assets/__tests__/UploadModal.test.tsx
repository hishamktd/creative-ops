import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { UploadModal } from '../UploadModal'

// Mock dependencies
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({
            data: [
              { id: 'project-1', name: 'Project 1' },
              { id: 'project-2', name: 'Project 2' }
            ],
            error: null
          }))
        }))
      }))
    }))
  }
}))

vi.mock('../AssetUploadZone', () => ({
  AssetUploadZone: ({ onUploadComplete }: { onUploadComplete: (assets: any[]) => void }) => (
    <div data-testid="asset-upload-zone">
      <button onClick={() => onUploadComplete([{ id: '1', name: 'test.jpg' }])}>
        Mock Upload Complete
      </button>
    </div>
  )
}))

describe('UploadModal', () => {
  const mockProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    folderId: 'folder-1'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not render when isOpen is false', () => {
    render(<UploadModal {...mockProps} isOpen={false} />)
    
    expect(screen.queryByText('Upload Assets')).not.toBeInTheDocument()
  })

  it('renders modal when isOpen is true', async () => {
    render(<UploadModal {...mockProps} />)
    
    expect(screen.getByText('Upload Assets')).toBeInTheDocument()
    expect(screen.getByText('Add files to your project')).toBeInTheDocument()
  })

  it('shows loading state while fetching projects', () => {
    render(<UploadModal {...mockProps} />)
    
    expect(screen.getByRole('status')).toBeInTheDocument() // Loading spinner
  })

  it('displays project selection when no projectId is provided', async () => {
    render(<UploadModal {...mockProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('Project *')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Select a project')).toBeInTheDocument()
    })
  })

  it('auto-selects first project when available', async () => {
    render(<UploadModal {...mockProps} />)
    
    await waitFor(() => {
      expect(screen.getByTestId('asset-upload-zone')).toBeInTheDocument()
    })
  })

  it('skips project selection when projectId is provided', async () => {
    render(<UploadModal {...mockProps} projectId="project-1" />)
    
    await waitFor(() => {
      expect(screen.queryByText('Project *')).not.toBeInTheDocument()
      expect(screen.getByTestId('asset-upload-zone')).toBeInTheDocument()
    })
  })

  it('shows upload zone after project selection', async () => {
    render(<UploadModal {...mockProps} />)
    
    await waitFor(() => {
      const select = screen.getByDisplayValue('Select a project')
      fireEvent.change(select, { target: { value: 'project-1' } })
    })
    
    expect(screen.getByTestId('asset-upload-zone')).toBeInTheDocument()
  })

  it('shows message when no project is selected', async () => {
    render(<UploadModal {...mockProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('Please select a project to upload files')).toBeInTheDocument()
    })
  })

  it('calls onClose when backdrop is clicked', () => {
    render(<UploadModal {...mockProps} />)
    
    const backdrop = screen.getByRole('dialog').previousElementSibling
    fireEvent.click(backdrop!)
    
    expect(mockProps.onClose).toHaveBeenCalled()
  })

  it('calls onClose when close button is clicked', () => {
    render(<UploadModal {...mockProps} />)
    
    const closeButton = screen.getByRole('button', { name: /close/i })
    fireEvent.click(closeButton)
    
    expect(mockProps.onClose).toHaveBeenCalled()
  })

  it('handles upload completion', async () => {
    render(<UploadModal {...mockProps} />)
    
    await waitFor(() => {
      const uploadButton = screen.getByText('Mock Upload Complete')
      fireEvent.click(uploadButton)
    })
    
    expect(mockProps.onSuccess).toHaveBeenCalledWith([{ id: '1', name: 'test.jpg' }])
    expect(mockProps.onClose).toHaveBeenCalled()
  })

  it('handles project fetch error gracefully', async () => {
    // Mock error response
    vi.mocked(require('@/lib/supabase/client').supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({
            data: null,
            error: { message: 'Failed to fetch projects' }
          }))
        }))
      }))
    })
    
    render(<UploadModal {...mockProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('Please select a project to upload files')).toBeInTheDocument()
    })
  })

  it('passes correct props to AssetUploadZone', async () => {
    const customProps = {
      ...mockProps,
      projectId: 'project-1',
      folderId: 'folder-1'
    }
    
    render(<UploadModal {...customProps} />)
    
    await waitFor(() => {
      expect(screen.getByTestId('asset-upload-zone')).toBeInTheDocument()
    })
  })
})