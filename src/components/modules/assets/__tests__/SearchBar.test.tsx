import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { SearchBar } from '../SearchBar'

// Mock debounce to make tests synchronous
vi.mock('lodash.debounce', () => ({
  default: (fn: Function) => fn,
}))

describe('SearchBar', () => {
  const mockOnSearch = vi.fn()
  const mockOnClear = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders search input with placeholder', () => {
    render(<SearchBar onSearch={mockOnSearch} />)
    
    expect(screen.getByPlaceholderText('Search assets...')).toBeInTheDocument()
  })

  it('calls onSearch when typing', async () => {
    const user = userEvent.setup()
    render(<SearchBar onSearch={mockOnSearch} />)
    
    const input = screen.getByPlaceholderText('Search assets...')
    await user.type(input, 'test query')
    
    expect(mockOnSearch).toHaveBeenCalledWith('test query')
  })

  it('shows clear button when there is text', async () => {
    const user = userEvent.setup()
    render(<SearchBar onSearch={mockOnSearch} onClear={mockOnClear} />)
    
    const input = screen.getByPlaceholderText('Search assets...')
    await user.type(input, 'test')
    
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument()
  })

  it('clears search when clear button is clicked', async () => {
    const user = userEvent.setup()
    render(<SearchBar onSearch={mockOnSearch} onClear={mockOnClear} />)
    
    const input = screen.getByPlaceholderText('Search assets...')
    await user.type(input, 'test')
    
    const clearButton = screen.getByRole('button', { name: /clear/i })
    await user.click(clearButton)
    
    expect(input).toHaveValue('')
    expect(mockOnClear).toHaveBeenCalled()
  })

  it('shows search suggestions when enabled', async () => {
    const mockSuggestions = ['image.jpg', 'document.pdf', 'video.mp4']
    const user = userEvent.setup()
    
    render(
      <SearchBar 
        onSearch={mockOnSearch} 
        suggestions={mockSuggestions}
        showSuggestions={true}
      />
    )
    
    const input = screen.getByPlaceholderText('Search assets...')
    await user.type(input, 'im')
    
    await waitFor(() => {
      expect(screen.getByText('image.jpg')).toBeInTheDocument()
    })
  })

  it('handles keyboard navigation in suggestions', async () => {
    const mockSuggestions = ['image.jpg', 'document.pdf']
    const user = userEvent.setup()
    
    render(
      <SearchBar 
        onSearch={mockOnSearch} 
        suggestions={mockSuggestions}
        showSuggestions={true}
      />
    )
    
    const input = screen.getByPlaceholderText('Search assets...')
    await user.type(input, 'i')
    
    // Arrow down to first suggestion
    await user.keyboard('{ArrowDown}')
    
    // Enter to select
    await user.keyboard('{Enter}')
    
    expect(mockOnSearch).toHaveBeenCalledWith('image.jpg')
  })

  it('supports advanced search mode', async () => {
    const user = userEvent.setup()
    render(<SearchBar onSearch={mockOnSearch} advancedMode={true} />)
    
    expect(screen.getByRole('button', { name: /advanced/i })).toBeInTheDocument()
    
    const advancedButton = screen.getByRole('button', { name: /advanced/i })
    await user.click(advancedButton)
    
    expect(screen.getByText('Advanced Search')).toBeInTheDocument()
  })

  it('handles search shortcuts', async () => {
    const user = userEvent.setup()
    render(<SearchBar onSearch={mockOnSearch} />)
    
    // Ctrl+K should focus search
    await user.keyboard('{Control>}k{/Control}')
    
    expect(screen.getByPlaceholderText('Search assets...')).toHaveFocus()
  })

  it('shows recent searches when focused', async () => {
    const mockRecentSearches = ['recent query 1', 'recent query 2']
    const user = userEvent.setup()
    
    render(
      <SearchBar 
        onSearch={mockOnSearch} 
        recentSearches={mockRecentSearches}
      />
    )
    
    const input = screen.getByPlaceholderText('Search assets...')
    await user.click(input)
    
    await waitFor(() => {
      expect(screen.getByText('recent query 1')).toBeInTheDocument()
      expect(screen.getByText('recent query 2')).toBeInTheDocument()
    })
  })

  it('handles search filters integration', async () => {
    const mockOnFilterChange = vi.fn()
    const user = userEvent.setup()
    
    render(
      <SearchBar 
        onSearch={mockOnSearch} 
        onFilterChange={mockOnFilterChange}
        showFilters={true}
      />
    )
    
    const filtersButton = screen.getByRole('button', { name: /filters/i })
    await user.click(filtersButton)
    
    expect(mockOnFilterChange).toHaveBeenCalled()
  })

  it('validates search input', async () => {
    const user = userEvent.setup()
    render(<SearchBar onSearch={mockOnSearch} minLength={3} />)
    
    const input = screen.getByPlaceholderText('Search assets...')
    await user.type(input, 'ab')
    
    // Should not call onSearch for input less than minLength
    expect(mockOnSearch).not.toHaveBeenCalled()
    
    await user.type(input, 'c')
    expect(mockOnSearch).toHaveBeenCalledWith('abc')
  })

  it('handles loading state', () => {
    render(<SearchBar onSearch={mockOnSearch} isLoading={true} />)
    
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('displays search results count', () => {
    render(<SearchBar onSearch={mockOnSearch} resultsCount={42} />)
    
    expect(screen.getByText('42 results')).toBeInTheDocument()
  })

  it('supports voice search when available', async () => {
    // Mock speech recognition
    const mockSpeechRecognition = {
      start: vi.fn(),
      stop: vi.fn(),
      addEventListener: vi.fn(),
    }
    
    Object.defineProperty(window, 'SpeechRecognition', {
      value: vi.fn(() => mockSpeechRecognition),
    })
    
    const user = userEvent.setup()
    render(<SearchBar onSearch={mockOnSearch} enableVoiceSearch={true} />)
    
    const voiceButton = screen.getByRole('button', { name: /voice search/i })
    await user.click(voiceButton)
    
    expect(mockSpeechRecognition.start).toHaveBeenCalled()
  })
})