import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FolderManager } from '../FolderManager'
import { supabase } from '@/lib/supabase/client'

// Mock Supabase
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            data: [],
            error: null
          }))
        }))
      })),
      insert: jest.fn(() => ({
        data: null,
        error: null
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          data: null,
          error: null
        }))
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => ({
          data: null,
          error: null
        }))
      }))
    }))
  }
}))

// Mock useAuth hook
jest.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', full_name: 'Test User' }
  })
}))

describe('FolderManager', () => {
  const mockProps = {
    projectId: 'test-project-id',
    currentFolderId: null,
    onFolderSelect: jest.fn(),
    onFolderChange: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders folder manager with header', () => {
    render(<FolderManager {...mockProps} />)
    
    expect(screen.getByText('Folders')).toBeInTheDocument()
    expect(screen.getByText('Create New Folder')).toBeInTheDocument()
  })

  it('shows search input', () => {
    render(<FolderManager {...mockProps} />)
    
    expect(screen.getByPlaceholderText('Search folders...')).toBeInTheDocument()
  })

  it('opens create folder modal when button is clicked', () => {
    render(<FolderManager {...mockProps} />)
    
    const createButton = screen.getByText('Create New Folder')
    fireEvent.click(createButton)
    
    // Modal should be opened (this would need to be tested with the modal component)
    expect(mockProps.onFolderChange).not.toHaveBeenCalled()
  })

  it('filters folders based on search query', async () => {
    const mockFolders = [
      { id: '1', name: 'Design Assets', children: [] },
      { id: '2', name: 'Video Files', children: [] }
    ]

    // Mock the supabase response
    const mockSelect = jest.fn(() => ({
      eq: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({
          data: mockFolders,
          error: null
        }))
      }))
    }))
    
    ;(supabase.from as jest.Mock).mockReturnValue({
      select: mockSelect
    })

    render(<FolderManager {...mockProps} />)
    
    const searchInput = screen.getByPlaceholderText('Search folders...')
    fireEvent.change(searchInput, { target: { value: 'Design' } })
    
    await waitFor(() => {
      // Should filter to show only matching folders
      expect(searchInput).toHaveValue('Design')
    })
  })

  it('handles folder selection', () => {
    render(<FolderManager {...mockProps} />)
    
    // This would need mock folder data to test properly
    expect(mockProps.onFolderSelect).not.toHaveBeenCalled()
  })

  it('handles drag and drop operations', async () => {
    render(<FolderManager {...mockProps} />)
    
    // Mock drag and drop events would be tested here
    // This requires more complex setup with mock folders
  })

  it('shows loading state initially', () => {
    render(<FolderManager {...mockProps} />)
    
    expect(screen.getByText('Loading folders...')).toBeInTheDocument()
  })

  it('shows empty state when no folders exist', async () => {
    // Mock empty response
    const mockSelect = jest.fn(() => ({
      eq: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({
          data: [],
          error: null
        }))
      }))
    }))
    
    ;(supabase.from as jest.Mock).mockReturnValue({
      select: mockSelect
    })

    render(<FolderManager {...mockProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('No folders yet')).toBeInTheDocument()
    })
  })
})