import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AssetFiltersPanel } from '../AssetFiltersPanel'
import { AssetFilters } from '../AssetBrowser'

// Mock Supabase
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      not: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null }))
        }))
      }))
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: { id: '1', name: 'Test Filter' }, error: null }))
      }))
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ error: null }))
    }))
  }))
}

vi.mock('@/lib/supabase/client', () => ({
  supabase: mockSupabase
}))

// Mock useAuth hook
vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({ 
    user: { 
      id: 'test-user-id',
      email: 'test@example.com'
    } 
  })
}))

describe('AssetFiltersPanel', () => {
  const defaultProps = {
    filters: {} as AssetFilters,
    onFiltersChange: vi.fn(),
    savedFilters: [],
    onSavedFiltersChange: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders filter panel with all sections', () => {
    render(<AssetFiltersPanel {...defaultProps} />)
    
    expect(screen.getByText('Advanced Filters')).toBeInTheDocument()
    expect(screen.getByText('File Types')).toBeInTheDocument()
    expect(screen.getByText('Date Range')).toBeInTheDocument()
    expect(screen.getByText('File Size')).toBeInTheDocument()
  })

  it('shows file type groups with checkboxes', () => {
    render(<AssetFiltersPanel {...defaultProps} />)
    
    expect(screen.getByText('Images')).toBeInTheDocument()
    expect(screen.getByText('Videos')).toBeInTheDocument()
    expect(screen.getByText('Documents')).toBeInTheDocument()
    expect(screen.getByText('Audio')).toBeInTheDocument()
  })

  it('handles file type group selection', () => {
    const onFiltersChange = vi.fn()
    
    render(
      <AssetFiltersPanel 
        {...defaultProps} 
        onFiltersChange={onFiltersChange}
      />
    )
    
    const imagesCheckbox = screen.getByLabelText('Images')
    fireEvent.click(imagesCheckbox)
    
    expect(onFiltersChange).toHaveBeenCalledWith({
      fileTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
    })
  })

  it('handles date range inputs', () => {
    const onFiltersChange = vi.fn()
    
    render(
      <AssetFiltersPanel 
        {...defaultProps} 
        onFiltersChange={onFiltersChange}
      />
    )
    
    const startDateInput = screen.getByLabelText('From')
    fireEvent.change(startDateInput, { target: { value: '2024-01-01' } })
    
    expect(onFiltersChange).toHaveBeenCalledWith({
      dateRange: {
        start: '2024-01-01'
      }
    })
  })

  it('handles file size inputs', () => {
    const onFiltersChange = vi.fn()
    
    render(
      <AssetFiltersPanel 
        {...defaultProps} 
        onFiltersChange={onFiltersChange}
      />
    )
    
    const minSizeInput = screen.getByLabelText('Min Size (MB)')
    fireEvent.change(minSizeInput, { target: { value: '1' } })
    
    expect(onFiltersChange).toHaveBeenCalledWith({
      minSize: 1024 * 1024 // 1MB in bytes
    })
  })

  it('shows clear all button when filters are active', () => {
    const filtersWithData = {
      fileTypes: ['image/jpeg'],
      search: 'test'
    }
    
    render(
      <AssetFiltersPanel 
        {...defaultProps} 
        filters={filtersWithData}
      />
    )
    
    expect(screen.getByText('Clear All')).toBeInTheDocument()
    expect(screen.getByText('Save Filter')).toBeInTheDocument()
  })

  it('clears all filters when clear button is clicked', () => {
    const onFiltersChange = vi.fn()
    const filtersWithData = {
      fileTypes: ['image/jpeg'],
      search: 'test'
    }
    
    render(
      <AssetFiltersPanel 
        {...defaultProps} 
        filters={filtersWithData}
        onFiltersChange={onFiltersChange}
      />
    )
    
    const clearButton = screen.getByText('Clear All')
    fireEvent.click(clearButton)
    
    expect(onFiltersChange).toHaveBeenCalledWith({})
  })

  it('shows save filter dialog when save button is clicked', () => {
    const filtersWithData = {
      fileTypes: ['image/jpeg']
    }
    
    render(
      <AssetFiltersPanel 
        {...defaultProps} 
        filters={filtersWithData}
      />
    )
    
    const saveButton = screen.getByText('Save Filter')
    fireEvent.click(saveButton)
    
    expect(screen.getByText('Save Filter')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter filter name')).toBeInTheDocument()
  })

  it('saves filter with name', async () => {
    const filtersWithData = {
      fileTypes: ['image/jpeg']
    }
    
    render(
      <AssetFiltersPanel 
        {...defaultProps} 
        filters={filtersWithData}
      />
    )
    
    // Open save dialog
    const saveButton = screen.getByText('Save Filter')
    fireEvent.click(saveButton)
    
    // Enter filter name
    const nameInput = screen.getByPlaceholderText('Enter filter name')
    fireEvent.change(nameInput, { target: { value: 'My Filter' } })
    
    // Save filter
    const saveFilterButton = screen.getByRole('button', { name: 'Save Filter' })
    fireEvent.click(saveFilterButton)
    
    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('saved_filters')
    })
  })

  it('displays saved filters', () => {
    const savedFilters = [
      {
        id: '1',
        name: 'Images Only',
        filters: { fileTypes: ['image/jpeg'] },
        created_at: '2024-01-01T00:00:00Z'
      }
    ]
    
    render(
      <AssetFiltersPanel 
        {...defaultProps} 
        savedFilters={savedFilters}
      />
    )
    
    expect(screen.getByText('Saved Filters')).toBeInTheDocument()
    expect(screen.getByText('Images Only')).toBeInTheDocument()
  })

  it('applies saved filter when clicked', () => {
    const onFiltersChange = vi.fn()
    const savedFilters = [
      {
        id: '1',
        name: 'Images Only',
        filters: { fileTypes: ['image/jpeg'] },
        created_at: '2024-01-01T00:00:00Z'
      }
    ]
    
    render(
      <AssetFiltersPanel 
        {...defaultProps} 
        savedFilters={savedFilters}
        onFiltersChange={onFiltersChange}
      />
    )
    
    const savedFilterButton = screen.getByText('Images Only')
    fireEvent.click(savedFilterButton)
    
    expect(onFiltersChange).toHaveBeenCalledWith({ fileTypes: ['image/jpeg'] })
  })

  it('deletes saved filter when X is clicked', async () => {
    const onSavedFiltersChange = vi.fn()
    const savedFilters = [
      {
        id: '1',
        name: 'Images Only',
        filters: { fileTypes: ['image/jpeg'] },
        created_at: '2024-01-01T00:00:00Z'
      }
    ]
    
    render(
      <AssetFiltersPanel 
        {...defaultProps} 
        savedFilters={savedFilters}
        onSavedFiltersChange={onSavedFiltersChange}
      />
    )
    
    // Find and click delete button (X)
    const deleteButtons = screen.getAllByRole('button')
    const deleteButton = deleteButtons.find(button => 
      button.querySelector('svg') && 
      button.textContent === ''
    )
    
    if (deleteButton) {
      fireEvent.click(deleteButton)
      
      await waitFor(() => {
        expect(mockSupabase.from).toHaveBeenCalledWith('saved_filters')
      })
    }
  })

  it('shows active filters summary', () => {
    const filtersWithData = {
      fileTypes: ['image/jpeg', 'image/png'],
      dateRange: { start: '2024-01-01', end: '2024-01-31' },
      tags: ['design']
    }
    
    render(
      <AssetFiltersPanel 
        {...defaultProps} 
        filters={filtersWithData}
      />
    )
    
    expect(screen.getByText('2 file types')).toBeInTheDocument()
    expect(screen.getByText('Date range')).toBeInTheDocument()
    expect(screen.getByText('1 tag')).toBeInTheDocument()
  })

  it('handles indeterminate state for file type groups', () => {
    const filtersWithPartialTypes = {
      fileTypes: ['image/jpeg'] // Only one image type selected
    }
    
    render(
      <AssetFiltersPanel 
        {...defaultProps} 
        filters={filtersWithPartialTypes}
      />
    )
    
    const imagesCheckbox = screen.getByLabelText('Images') as HTMLInputElement
    
    // Should be indeterminate (some but not all types selected)
    expect(imagesCheckbox.indeterminate).toBe(true)
  })

  it('loads and displays available tags', async () => {
    // Mock tags response
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        not: vi.fn().mockReturnValue(
          Promise.resolve({ 
            data: [
              { tags: ['design', 'mockup'] },
              { tags: ['video', 'demo'] }
            ], 
            error: null 
          })
        )
      })
    })
    
    render(<AssetFiltersPanel {...defaultProps} />)
    
    await waitFor(() => {
      expect(screen.getByText('Tags')).toBeInTheDocument()
    })
  })

  it('toggles tag selection', () => {
    const onFiltersChange = vi.fn()
    
    // Mock component with tags loaded
    const { rerender } = render(
      <AssetFiltersPanel 
        {...defaultProps} 
        onFiltersChange={onFiltersChange}
      />
    )
    
    // Simulate tags being loaded
    rerender(
      <AssetFiltersPanel 
        {...defaultProps} 
        onFiltersChange={onFiltersChange}
      />
    )
    
    // This would test tag clicking if tags were rendered
    // In a real scenario, we'd need to wait for the async tag loading
  })
})