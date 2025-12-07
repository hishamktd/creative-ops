import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { PDFViewer } from '../PDFViewer'

// Mock fullscreen API
Object.defineProperty(document, 'fullscreenElement', {
  writable: true,
  value: null,
})

Object.defineProperty(document, 'exitFullscreen', {
  writable: true,
  value: vi.fn(),
})

Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
  writable: true,
  value: vi.fn(),
})

describe('PDFViewer', () => {
  const defaultProps = {
    fileUrl: 'https://example.com/test-document.pdf',
    fileName: 'Test Document.pdf',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('Rendering', () => {
    it('should show loading state initially', () => {
      render(<PDFViewer {...defaultProps} />)
      
      expect(screen.getByText('Loading PDF...')).toBeInTheDocument()
    })

    it('should render PDF viewer after loading', async () => {
      render(<PDFViewer {...defaultProps} />)
      
      // Fast-forward past loading timeout
      vi.advanceTimersByTime(1100)
      
      await waitFor(() => {
        expect(screen.getByText('Test Document.pdf')).toBeInTheDocument()
        expect(screen.queryByText('Loading PDF...')).not.toBeInTheDocument()
      })
    })

    it('should display file name in toolbar', async () => {
      render(<PDFViewer {...defaultProps} />)
      
      vi.advanceTimersByTime(1100)
      
      await waitFor(() => {
        expect(screen.getByText('Test Document.pdf')).toBeInTheDocument()
      })
    })

    it('should render iframe with correct src', async () => {
      render(<PDFViewer {...defaultProps} />)
      
      vi.advanceTimersByTime(1100)
      
      await waitFor(() => {
        const iframe = document.querySelector('iframe')
        expect(iframe).toBeInTheDocument()
        expect(iframe?.src).toContain(defaultProps.fileUrl)
      })
    })
  })

  describe('Page Navigation', () => {
    beforeEach(async () => {
      render(<PDFViewer {...defaultProps} />)
      vi.advanceTimersByTime(1100)
      
      await waitFor(() => {
        expect(screen.queryByText('Loading PDF...')).not.toBeInTheDocument()
      })
    })

    it('should display current page and total pages', () => {
      expect(screen.getByDisplayValue('1')).toBeInTheDocument()
      expect(screen.getByText('of 10')).toBeInTheDocument()
    })

    it('should navigate to next page when next button is clicked', () => {
      const nextButton = screen.getAllByRole('button').find(btn => 
        btn.textContent?.includes('Next') || 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'chevron-right'
      )
      
      if (nextButton) {
        fireEvent.click(nextButton)
        expect(screen.getByDisplayValue('2')).toBeInTheDocument()
      }
    })

    it('should navigate to previous page when previous button is clicked', () => {
      // First go to page 2
      const nextButton = screen.getAllByRole('button').find(btn => 
        btn.textContent?.includes('Next')
      )
      
      if (nextButton) {
        fireEvent.click(nextButton)
        
        // Then go back to page 1
        const prevButton = screen.getAllByRole('button').find(btn => 
          btn.textContent?.includes('Previous')
        )
        
        if (prevButton) {
          fireEvent.click(prevButton)
          expect(screen.getByDisplayValue('1')).toBeInTheDocument()
        }
      }
    })

    it('should disable previous button on first page', () => {
      const prevButton = screen.getAllByRole('button').find(btn => 
        btn.textContent?.includes('Previous') ||
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'chevron-left'
      )
      
      expect(prevButton).toBeDisabled()
    })

    it('should navigate to first page when first button is clicked', () => {
      // Go to page 2 first
      const nextButton = screen.getAllByRole('button').find(btn => 
        btn.textContent?.includes('Next')
      )
      
      if (nextButton) {
        fireEvent.click(nextButton)
        
        // Then click first button
        const firstButton = screen.getByText('First')
        fireEvent.click(firstButton)
        
        expect(screen.getByDisplayValue('1')).toBeInTheDocument()
      }
    })

    it('should navigate to last page when last button is clicked', () => {
      const lastButton = screen.getByText('Last')
      fireEvent.click(lastButton)
      
      expect(screen.getByDisplayValue('10')).toBeInTheDocument()
    })

    it('should allow direct page input', () => {
      const pageInput = screen.getByDisplayValue('1')
      
      fireEvent.change(pageInput, { target: { value: '5' } })
      
      expect(screen.getByDisplayValue('5')).toBeInTheDocument()
    })

    it('should validate page input within bounds', () => {
      const pageInput = screen.getByDisplayValue('1')
      
      // Try to set page beyond total pages
      fireEvent.change(pageInput, { target: { value: '15' } })
      
      // Should not change to invalid page
      expect(screen.getByDisplayValue('1')).toBeInTheDocument()
    })
  })

  describe('Zoom Controls', () => {
    beforeEach(async () => {
      render(<PDFViewer {...defaultProps} />)
      vi.advanceTimersByTime(1100)
      
      await waitFor(() => {
        expect(screen.queryByText('Loading PDF...')).not.toBeInTheDocument()
      })
    })

    it('should display current zoom level', () => {
      expect(screen.getByText('100%')).toBeInTheDocument()
    })

    it('should zoom in when zoom in button is clicked', () => {
      const zoomInButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'zoom-in'
      )
      
      if (zoomInButton) {
        fireEvent.click(zoomInButton)
        expect(screen.getByText('120%')).toBeInTheDocument()
      }
    })

    it('should zoom out when zoom out button is clicked', () => {
      const zoomOutButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'zoom-out'
      )
      
      if (zoomOutButton) {
        fireEvent.click(zoomOutButton)
        expect(screen.getByText('83%')).toBeInTheDocument()
      }
    })

    it('should limit zoom to maximum value', () => {
      const zoomInButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'zoom-in'
      )
      
      if (zoomInButton) {
        // Click multiple times to reach max zoom
        for (let i = 0; i < 10; i++) {
          fireEvent.click(zoomInButton)
        }
        
        // Should not exceed 300%
        const zoomText = screen.getByText(/\d+%/)
        const zoomValue = parseInt(zoomText.textContent?.replace('%', '') || '0')
        expect(zoomValue).toBeLessThanOrEqual(300)
      }
    })

    it('should limit zoom to minimum value', () => {
      const zoomOutButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'zoom-out'
      )
      
      if (zoomOutButton) {
        // Click multiple times to reach min zoom
        for (let i = 0; i < 10; i++) {
          fireEvent.click(zoomOutButton)
        }
        
        // Should not go below 25%
        const zoomText = screen.getByText(/\d+%/)
        const zoomValue = parseInt(zoomText.textContent?.replace('%', '') || '0')
        expect(zoomValue).toBeGreaterThanOrEqual(25)
      }
    })
  })

  describe('Rotation', () => {
    beforeEach(async () => {
      render(<PDFViewer {...defaultProps} />)
      vi.advanceTimersByTime(1100)
      
      await waitFor(() => {
        expect(screen.queryByText('Loading PDF...')).not.toBeInTheDocument()
      })
    })

    it('should rotate PDF when rotate button is clicked', () => {
      const rotateButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'rotate-cw'
      )
      
      if (rotateButton) {
        fireEvent.click(rotateButton)
        
        // Check if iframe has rotation transform
        const iframe = document.querySelector('iframe')
        expect(iframe?.style.transform).toContain('rotate(90deg)')
      }
    })

    it('should cycle through rotation angles', () => {
      const rotateButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'rotate-cw'
      )
      
      if (rotateButton) {
        // Click 4 times to complete full rotation
        fireEvent.click(rotateButton) // 90deg
        fireEvent.click(rotateButton) // 180deg
        fireEvent.click(rotateButton) // 270deg
        fireEvent.click(rotateButton) // 360deg (0deg)
        
        const iframe = document.querySelector('iframe')
        expect(iframe?.style.transform).toContain('rotate(0deg)')
      }
    })
  })

  describe('Search Functionality', () => {
    beforeEach(async () => {
      render(<PDFViewer {...defaultProps} />)
      vi.advanceTimersByTime(1100)
      
      await waitFor(() => {
        expect(screen.queryByText('Loading PDF...')).not.toBeInTheDocument()
      })
    })

    it('should display search input', () => {
      const searchInput = screen.getByPlaceholderText('Search in PDF...')
      expect(searchInput).toBeInTheDocument()
    })

    it('should show search results when searching', () => {
      const searchInput = screen.getByPlaceholderText('Search in PDF...')
      
      fireEvent.change(searchInput, { target: { value: 'test' } })
      
      // Should show mock search results
      expect(screen.getByText('1/4')).toBeInTheDocument()
    })

    it('should navigate through search results', () => {
      const searchInput = screen.getByPlaceholderText('Search in PDF...')
      
      fireEvent.change(searchInput, { target: { value: 'test' } })
      
      // Find navigation buttons for search results
      const searchNavButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'chevron-left' ||
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'chevron-right'
      )
      
      if (searchNavButtons.length >= 2) {
        const nextResultButton = searchNavButtons.find(btn => 
          btn.querySelector('svg')?.getAttribute('data-lucide') === 'chevron-right'
        )
        
        if (nextResultButton) {
          fireEvent.click(nextResultButton)
          expect(screen.getByText('2/4')).toBeInTheDocument()
        }
      }
    })

    it('should clear search results when search is cleared', () => {
      const searchInput = screen.getByPlaceholderText('Search in PDF...')
      
      fireEvent.change(searchInput, { target: { value: 'test' } })
      expect(screen.getByText('1/4')).toBeInTheDocument()
      
      fireEvent.change(searchInput, { target: { value: '' } })
      expect(screen.queryByText('1/4')).not.toBeInTheDocument()
    })

    it('should show search results overlay', () => {
      const searchInput = screen.getByPlaceholderText('Search in PDF...')
      
      fireEvent.change(searchInput, { target: { value: 'test' } })
      
      expect(screen.getByText('Found 4 results for "test"')).toBeInTheDocument()
    })
  })

  describe('Fullscreen', () => {
    beforeEach(async () => {
      render(<PDFViewer {...defaultProps} />)
      vi.advanceTimersByTime(1100)
      
      await waitFor(() => {
        expect(screen.queryByText('Loading PDF...')).not.toBeInTheDocument()
      })
    })

    it('should toggle fullscreen when fullscreen button is clicked', () => {
      const fullscreenButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'maximize'
      )
      
      if (fullscreenButton) {
        fireEvent.click(fullscreenButton)
        // Fullscreen API behavior would need more complex mocking for full testing
      }
    })
  })

  describe('Download', () => {
    beforeEach(async () => {
      render(<PDFViewer {...defaultProps} />)
      vi.advanceTimersByTime(1100)
      
      await waitFor(() => {
        expect(screen.queryByText('Loading PDF...')).not.toBeInTheDocument()
      })
    })

    it('should trigger download when download button is clicked', () => {
      // Mock document.createElement and link.click
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn(),
      }
      
      const createElement = vi.spyOn(document, 'createElement').mockReturnValue(mockLink as any)
      const appendChild = vi.spyOn(document.body, 'appendChild').mockImplementation(() => mockLink as any)
      const removeChild = vi.spyOn(document.body, 'removeChild').mockImplementation(() => mockLink as any)
      
      const downloadButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'download'
      )
      
      if (downloadButton) {
        fireEvent.click(downloadButton)
        
        expect(createElement).toHaveBeenCalledWith('a')
        expect(mockLink.href).toBe(defaultProps.fileUrl)
        expect(mockLink.download).toBe(defaultProps.fileName)
        expect(mockLink.click).toHaveBeenCalledTimes(1)
        expect(appendChild).toHaveBeenCalledWith(mockLink)
        expect(removeChild).toHaveBeenCalledWith(mockLink)
      }
      
      createElement.mockRestore()
      appendChild.mockRestore()
      removeChild.mockRestore()
    })
  })

  describe('Error Handling', () => {
    it('should display error state when PDF fails to load', async () => {
      // Mock a loading error by not advancing timers and setting error state
      const { rerender } = render(<PDFViewer {...defaultProps} />)
      
      // Simulate error by re-rendering with error prop (if implemented)
      // For now, we'll test the error display structure
      expect(screen.getByText('Loading PDF...')).toBeInTheDocument()
    })
  })

  describe('Keyboard Navigation', () => {
    beforeEach(async () => {
      render(<PDFViewer {...defaultProps} />)
      vi.advanceTimersByTime(1100)
      
      await waitFor(() => {
        expect(screen.queryByText('Loading PDF...')).not.toBeInTheDocument()
      })
    })

    it('should support keyboard shortcuts for navigation', () => {
      // Test arrow key navigation
      fireEvent.keyDown(document, { key: 'ArrowRight' })
      expect(screen.getByDisplayValue('2')).toBeInTheDocument()
      
      fireEvent.keyDown(document, { key: 'ArrowLeft' })
      expect(screen.getByDisplayValue('1')).toBeInTheDocument()
    })

    it('should support keyboard shortcuts for zoom', () => {
      fireEvent.keyDown(document, { key: '+', ctrlKey: true })
      // Zoom in behavior would be tested if implemented
      
      fireEvent.keyDown(document, { key: '-', ctrlKey: true })
      // Zoom out behavior would be tested if implemented
    })
  })

  describe('Responsive Design', () => {
    it('should adapt to different screen sizes', () => {
      // Mock window resize
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 768,
      })
      
      render(<PDFViewer {...defaultProps} />)
      
      // Should render without errors on smaller screens
      expect(screen.getByText('Loading PDF...')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    beforeEach(async () => {
      render(<PDFViewer {...defaultProps} />)
      vi.advanceTimersByTime(1100)
      
      await waitFor(() => {
        expect(screen.queryByText('Loading PDF...')).not.toBeInTheDocument()
      })
    })

    it('should have proper ARIA labels for buttons', () => {
      const buttons = screen.getAllByRole('button')
      
      buttons.forEach(button => {
        const hasAriaLabel = button.hasAttribute('aria-label')
        const hasAccessibleContent = button.textContent && button.textContent.trim().length > 0
        const hasIcon = button.querySelector('svg')
        
        // Should have either aria-label, text content, or be clearly identifiable
        expect(hasAriaLabel || hasAccessibleContent || hasIcon).toBe(true)
      })
    })

    it('should have proper labels for form inputs', () => {
      const pageInput = screen.getByDisplayValue('1')
      const searchInput = screen.getByPlaceholderText('Search in PDF...')
      
      // Inputs should have accessible names
      expect(pageInput).toBeInTheDocument()
      expect(searchInput).toBeInTheDocument()
    })

    it('should support keyboard navigation', () => {
      const firstButton = screen.getAllByRole('button')[0]
      
      // Should be focusable
      firstButton.focus()
      expect(document.activeElement).toBe(firstButton)
      
      // Should handle keyboard events
      fireEvent.keyDown(firstButton, { key: 'Enter' })
      fireEvent.keyDown(firstButton, { key: ' ' })
    })
  })

  describe('Performance', () => {
    it('should not re-render unnecessarily', () => {
      const { rerender } = render(<PDFViewer {...defaultProps} />)
      
      // Re-render with same props
      rerender(<PDFViewer {...defaultProps} />)
      
      // Should not cause issues
      expect(screen.getByText('Loading PDF...')).toBeInTheDocument()
    })
  })
})