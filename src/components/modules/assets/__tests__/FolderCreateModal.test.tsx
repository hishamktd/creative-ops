import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { FolderCreateModal } from '../FolderCreateModal'
import { supabase } from '@/lib/supabase/client'

// Mock Supabase
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({
            data: [
              { id: 'project-1', name: 'Test Project 1' },
              { id: 'project-2', name: 'Test Project 2' }
            ],
            error: null
          }))
        }))
      })),
      insert: jest.fn(() => Promise.resolve({
        data: null,
        error: null
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

describe('FolderCreateModal', () => {
  const mockProps = {
    isOpen: true,
    projectId: 'test-project-id',
    parentId: null,
    onClose: jest.fn(),
    onSuccess: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders modal when open', () => {
    render(<FolderCreateModal {...mockProps} />)
    
    expect(screen.getByText('Create Folder')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter folder name')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<FolderCreateModal {...mockProps} isOpen={false} />)
    
    expect(screen.queryByText('Create Folder')).not.toBeInTheDocument()
  })

  it('shows project selection when no projectId provided', async () => {
    render(<FolderCreateModal {...mockProps} projectId={undefined} />)
    
    await waitFor(() => {
      expect(screen.getByText('Project *')).toBeInTheDocument()
      expect(screen.getByText('Test Project 1')).toBeInTheDocument()
    })
  })

  it('allows creating single folder', async () => {
    render(<FolderCreateModal {...mockProps} />)
    
    const nameInput = screen.getByPlaceholderText('Enter folder name')
    const submitButton = screen.getByText('Create Folder')
    
    fireEvent.change(nameInput, { target: { value: 'New Folder' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('folders')
    })
  })

  it('allows creating multiple folders', async () => {
    render(<FolderCreateModal {...mockProps} />)
    
    // Enable multiple folder creation
    const multipleCheckbox = screen.getByLabelText('Create multiple folders at once')
    fireEvent.click(multipleCheckbox)
    
    expect(screen.getByText('Folder Names *')).toBeInTheDocument()
    expect(screen.getByText('Add Another Folder')).toBeInTheDocument()
  })

  it('validates required fields', async () => {
    render(<FolderCreateModal {...mockProps} />)
    
    const submitButton = screen.getByText('Create Folder')
    fireEvent.click(submitButton)
    
    // Should not submit without folder name
    expect(mockProps.onSuccess).not.toHaveBeenCalled()
  })

  it('handles form submission with description', async () => {
    render(<FolderCreateModal {...mockProps} />)
    
    const nameInput = screen.getByPlaceholderText('Enter folder name')
    const descriptionInput = screen.getByPlaceholderText('Optional description for the folder(s)')
    const submitButton = screen.getByText('Create Folder')
    
    fireEvent.change(nameInput, { target: { value: 'Test Folder' } })
    fireEvent.change(descriptionInput, { target: { value: 'Test description' } })
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('folders')
    })
  })

  it('closes modal when cancel is clicked', () => {
    render(<FolderCreateModal {...mockProps} />)
    
    const cancelButton = screen.getByText('Cancel')
    fireEvent.click(cancelButton)
    
    expect(mockProps.onClose).toHaveBeenCalled()
  })

  it('closes modal when backdrop is clicked', () => {
    render(<FolderCreateModal {...mockProps} />)
    
    const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50')
    if (backdrop) {
      fireEvent.click(backdrop)
      expect(mockProps.onClose).toHaveBeenCalled()
    }
  })

  it('adds and removes folder names in multiple mode', () => {
    render(<FolderCreateModal {...mockProps} />)
    
    // Enable multiple folder creation
    const multipleCheckbox = screen.getByLabelText('Create multiple folders at once')
    fireEvent.click(multipleCheckbox)
    
    // Add another folder
    const addButton = screen.getByText('Add Another Folder')
    fireEvent.click(addButton)
    
    // Should have multiple folder name inputs
    const folderInputs = screen.getAllByPlaceholderText(/Folder \d+ name/)
    expect(folderInputs).toHaveLength(2)
  })
})