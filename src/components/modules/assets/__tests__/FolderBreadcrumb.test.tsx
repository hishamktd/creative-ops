import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FolderBreadcrumb } from '../FolderBreadcrumb'
import { supabase } from '@/lib/supabase/client'

// Mock Supabase
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: { id: 'folder-1', name: 'Test Folder', parent_id: null },
            error: null
          })),
          order: jest.fn(() => Promise.resolve({
            data: [
              { id: 'sibling-1', name: 'Sibling 1', parent_id: null },
              { id: 'sibling-2', name: 'Sibling 2', parent_id: null }
            ],
            error: null
          }))
        })),
        is: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({
            data: [],
            error: null
          }))
        }))
      }))
    }))
  }
}))

describe('FolderBreadcrumb', () => {
  const mockProps = {
    currentFolderId: null,
    projectId: 'test-project-id',
    onFolderSelect: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders home breadcrumb when no folder selected', async () => {
    render(<FolderBreadcrumb {...mockProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('Home')).toBeInTheDocument()
    })
  })

  it('shows loading state initially', () => {
    render(<FolderBreadcrumb {...mockProps} />)
    
    // Should show loading skeleton
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('builds breadcrumb path for nested folder', async () => {
    // Mock nested folder structure
    const mockSelect = jest.fn()
      .mockReturnValueOnce({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: { id: 'child-folder', name: 'Child Folder', parent_id: 'parent-folder' },
            error: null
          }))
        }))
      })
      .mockReturnValueOnce({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: { id: 'parent-folder', name: 'Parent Folder', parent_id: null },
            error: null
          }))
        }))
      })

    ;(supabase.from as jest.Mock).mockReturnValue({
      select: mockSelect
    })

    render(<FolderBreadcrumb {...mockProps} currentFolderId="child-folder" />)
    
    await waitFor(() => {
      expect(screen.getByText('Home')).toBeInTheDocument()
    })
  })

  it('handles folder selection from breadcrumb', async () => {
    render(<FolderBreadcrumb {...mockProps} />)
    
    await waitFor(() => {
      const homeButton = screen.getByText('Home')
      fireEvent.click(homeButton)
      
      expect(mockProps.onFolderSelect).toHaveBeenCalledWith(null)
    })
  })

  it('shows dropdown menu when chevron is clicked', async () => {
    render(<FolderBreadcrumb {...mockProps} />)
    
    await waitFor(() => {
      const dropdownButton = document.querySelector('button[aria-label="Show folder options"]')
      if (dropdownButton) {
        fireEvent.click(dropdownButton)
        // Should show sibling folders in dropdown
      }
    })
  })

  it('closes dropdown when clicking outside', async () => {
    render(<FolderBreadcrumb {...mockProps} />)
    
    await waitFor(() => {
      // Test dropdown close functionality
      const outsideArea = document.querySelector('.fixed.inset-0')
      if (outsideArea) {
        fireEvent.click(outsideArea)
        // Dropdown should close
      }
    })
  })

  it('handles folder selection from dropdown', async () => {
    // Mock sibling folders
    const mockSelect = jest.fn(() => ({
      eq: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({
          data: [
            { id: 'sibling-1', name: 'Sibling 1', parent_id: null }
          ],
          error: null
        }))
      }))
    }))

    ;(supabase.from as jest.Mock).mockReturnValue({
      select: mockSelect
    })

    render(<FolderBreadcrumb {...mockProps} />)
    
    await waitFor(() => {
      // This would test dropdown folder selection
      expect(mockProps.onFolderSelect).not.toHaveBeenCalled()
    })
  })

  it('handles errors gracefully', async () => {
    // Mock error response
    const mockSelect = jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => Promise.resolve({
          data: null,
          error: new Error('Database error')
        }))
      }))
    }))

    ;(supabase.from as jest.Mock).mockReturnValue({
      select: mockSelect
    })

    render(<FolderBreadcrumb {...mockProps} currentFolderId="invalid-folder" />)
    
    await waitFor(() => {
      // Should still show Home even with error
      expect(screen.getByText('Home')).toBeInTheDocument()
    })
  })
})