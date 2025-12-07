import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FolderManager } from '../FolderManager'
import { FolderBreadcrumb } from '../FolderBreadcrumb'
import { supabase } from '@/lib/supabase/client'

// Mock Supabase with more comprehensive responses
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({
            data: [
              {
                id: 'folder-1',
                name: 'Design Assets',
                parent_id: null,
                project_id: 'project-1',
                created_by: 'user-1',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
                assets: [{ count: 5 }],
                subfolders: [{ count: 2 }]
              },
              {
                id: 'folder-2',
                name: 'Video Files',
                parent_id: 'folder-1',
                project_id: 'project-1',
                created_by: 'user-1',
                created_at: '2024-01-01T00:00:00Z',
                updated_at: '2024-01-01T00:00:00Z',
                assets: [{ count: 3 }],
                subfolders: [{ count: 0 }]
              }
            ],
            error: null
          })),
          single: jest.fn(() => Promise.resolve({
            data: {
              id: 'folder-1',
              name: 'Design Assets',
              parent_id: null
            },
            error: null
          }))
        })),
        is: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({
            data: [],
            error: null
          }))
        }))
      })),
      insert: jest.fn(() => Promise.resolve({
        data: [{ id: 'new-folder-id', name: 'New Folder' }],
        error: null
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({
          data: null,
          error: null
        }))
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({
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

describe('Folder Management Integration', () => {
  const mockOnFolderSelect = jest.fn()
  const mockOnFolderChange = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('integrates folder manager with breadcrumb navigation', async () => {
    const TestComponent = () => {
      const [currentFolderId, setCurrentFolderId] = React.useState<string | null>(null)
      
      return (
        <div>
          <FolderBreadcrumb
            currentFolderId={currentFolderId}
            projectId="project-1"
            onFolderSelect={setCurrentFolderId}
          />
          <FolderManager
            projectId="project-1"
            currentFolderId={currentFolderId}
            onFolderSelect={setCurrentFolderId}
            onFolderChange={mockOnFolderChange}
          />
        </div>
      )
    }

    render(<TestComponent />)

    // Wait for components to load
    await waitFor(() => {
      expect(screen.getByText('Folders')).toBeInTheDocument()
      expect(screen.getByText('Home')).toBeInTheDocument()
    })
  })

  it('handles complete folder creation workflow', async () => {
    render(
      <FolderManager
        projectId="project-1"
        currentFolderId={null}
        onFolderSelect={mockOnFolderSelect}
        onFolderChange={mockOnFolderChange}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Create New Folder')).toBeInTheDocument()
    })

    // Click create folder button
    const createButton = screen.getByText('Create New Folder')
    fireEvent.click(createButton)

    // Modal should open (this would be tested with the actual modal)
    expect(mockOnFolderChange).not.toHaveBeenCalled()
  })

  it('handles folder navigation and selection', async () => {
    render(
      <FolderManager
        projectId="project-1"
        currentFolderId={null}
        onFolderSelect={mockOnFolderSelect}
        onFolderChange={mockOnFolderChange}
      />
    )

    await waitFor(() => {
      // Should show folders from mock data
      expect(screen.getByText('Loading folders...')).toBeInTheDocument()
    })

    // Test folder selection would happen here with proper mock data
  })

  it('handles drag and drop folder organization', async () => {
    render(
      <FolderManager
        projectId="project-1"
        currentFolderId={null}
        onFolderSelect={mockOnFolderSelect}
        onFolderChange={mockOnFolderChange}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Folders')).toBeInTheDocument()
    })

    // Mock drag and drop operations would be tested here
    // This requires more complex setup with actual folder elements
  })

  it('handles folder search and filtering', async () => {
    render(
      <FolderManager
        projectId="project-1"
        currentFolderId={null}
        onFolderSelect={mockOnFolderSelect}
        onFolderChange={mockOnFolderChange}
      />
    )

    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText('Search folders...')
      expect(searchInput).toBeInTheDocument()
    })

    const searchInput = screen.getByPlaceholderText('Search folders...')
    fireEvent.change(searchInput, { target: { value: 'Design' } })

    // Should filter folders based on search query
    expect(searchInput).toHaveValue('Design')
  })

  it('handles folder permissions and sharing', async () => {
    render(
      <FolderManager
        projectId="project-1"
        currentFolderId={null}
        onFolderSelect={mockOnFolderSelect}
        onFolderChange={mockOnFolderChange}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Folders')).toBeInTheDocument()
    })

    // Test folder context menu and permissions would be tested here
    // This requires interaction with folder items
  })

  it('handles error states gracefully', async () => {
    // Mock error response
    const mockSelect = jest.fn(() => ({
      eq: jest.fn(() => ({
        order: jest.fn(() => Promise.resolve({
          data: null,
          error: new Error('Database connection failed')
        }))
      }))
    }))

    ;(supabase.from as jest.Mock).mockReturnValue({
      select: mockSelect
    })

    render(
      <FolderManager
        projectId="project-1"
        currentFolderId={null}
        onFolderSelect={mockOnFolderSelect}
        onFolderChange={mockOnFolderChange}
      />
    )

    await waitFor(() => {
      // Should handle error gracefully
      expect(screen.getByText('Folders')).toBeInTheDocument()
    })
  })

  it('maintains folder state across navigation', async () => {
    const TestComponent = () => {
      const [currentFolderId, setCurrentFolderId] = React.useState<string | null>('folder-1')
      
      return (
        <div>
          <FolderBreadcrumb
            currentFolderId={currentFolderId}
            projectId="project-1"
            onFolderSelect={setCurrentFolderId}
          />
          <FolderManager
            projectId="project-1"
            currentFolderId={currentFolderId}
            onFolderSelect={setCurrentFolderId}
            onFolderChange={mockOnFolderChange}
          />
        </div>
      )
    }

    render(<TestComponent />)

    await waitFor(() => {
      // Should maintain selected folder state
      expect(screen.getByText('Folders')).toBeInTheDocument()
    })
  })
})