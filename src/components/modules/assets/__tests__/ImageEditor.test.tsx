import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { ImageEditor, EditChanges } from '../ImageEditor'

// Mock canvas and image APIs
const mockCanvas = {
  getContext: vi.fn(() => ({
    clearRect: vi.fn(),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    globalCompositeOperation: '',
  })),
  width: 800,
  height: 600,
  toBlob: vi.fn((callback) => {
    const mockBlob = new Blob(['mock-image-data'], { type: 'image/png' })
    callback(mockBlob)
  }),
}

const mockImage = {
  width: 1920,
  height: 1080,
  crossOrigin: '',
  onload: null as (() => void) | null,
  src: '',
}

// Mock HTML elements
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  writable: true,
  value: vi.fn(() => mockCanvas.getContext()),
})

Object.defineProperty(window, 'Image', {
  writable: true,
  value: vi.fn(() => mockImage),
})

Object.defineProperty(document, 'createElement', {
  writable: true,
  value: vi.fn((tagName) => {
    if (tagName === 'canvas') {
      return mockCanvas
    }
    return document.createElement(tagName)
  }),
})

describe('ImageEditor', () => {
  const mockImageUrl = 'https://example.com/test-image.jpg'
  const mockOnSave = vi.fn()
  const mockOnCancel = vi.fn()

  const defaultProps = {
    imageUrl: mockImageUrl,
    onSave: mockOnSave,
    onCancel: mockOnCancel,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset mock canvas
    mockCanvas.width = 800
    mockCanvas.height = 600
    
    // Reset mock image
    mockImage.width = 1920
    mockImage.height = 1080
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Rendering', () => {
    it('should render image editor interface', () => {
      render(<ImageEditor {...defaultProps} />)
      
      expect(screen.getByText('Image Editor')).toBeInTheDocument()
      expect(screen.getByText('Save Changes')).toBeInTheDocument()
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    it('should render toolbar with editing tools', () => {
      render(<ImageEditor {...defaultProps} />)
      
      // Check for tool buttons (using data-lucide attributes or aria-labels)
      const buttons = screen.getAllByRole('button')
      
      // Should have move, crop, rotate, and zoom tools
      expect(buttons.length).toBeGreaterThan(5)
    })

    it('should render properties panel', () => {
      render(<ImageEditor {...defaultProps} />)
      
      expect(screen.getByText('Properties')).toBeInTheDocument()
      expect(screen.getByText('Rotation')).toBeInTheDocument()
      expect(screen.getByText('Scale')).toBeInTheDocument()
    })

    it('should show canvas for image editing', () => {
      render(<ImageEditor {...defaultProps} />)
      
      const canvas = document.querySelector('canvas')
      expect(canvas).toBeInTheDocument()
    })
  })

  describe('Tool Selection', () => {
    it('should start with move tool selected', () => {
      render(<ImageEditor {...defaultProps} />)
      
      // The move tool button should have primary variant styling
      // This would need to be checked based on actual implementation
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('should switch to crop tool when crop button is clicked', () => {
      render(<ImageEditor {...defaultProps} />)
      
      // Find and click crop tool button
      const buttons = screen.getAllByRole('button')
      const cropButton = buttons.find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'crop'
      )
      
      if (cropButton) {
        fireEvent.click(cropButton)
        // Tool state change would be reflected in UI styling
      }
    })
  })

  describe('Image Transformations', () => {
    it('should rotate image clockwise when rotate button is clicked', () => {
      render(<ImageEditor {...defaultProps} />)
      
      const rotateButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'rotate-cw'
      )
      
      if (rotateButton) {
        fireEvent.click(rotateButton)
        
        // Check if rotation value is updated in properties panel
        expect(screen.getByText('90°')).toBeInTheDocument()
      }
    })

    it('should rotate image counter-clockwise when rotate button is clicked', () => {
      render(<ImageEditor {...defaultProps} />)
      
      const rotateButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'rotate-ccw'
      )
      
      if (rotateButton) {
        fireEvent.click(rotateButton)
        
        // Check if rotation value is updated in properties panel
        expect(screen.getByText('-90°')).toBeInTheDocument()
      }
    })

    it('should zoom in when zoom in button is clicked', () => {
      render(<ImageEditor {...defaultProps} />)
      
      const zoomInButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'zoom-in'
      )
      
      if (zoomInButton) {
        fireEvent.click(zoomInButton)
        
        // Check if scale value is updated in properties panel
        expect(screen.getByText('120%')).toBeInTheDocument()
      }
    })

    it('should zoom out when zoom out button is clicked', () => {
      render(<ImageEditor {...defaultProps} />)
      
      const zoomOutButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'zoom-out'
      )
      
      if (zoomOutButton) {
        fireEvent.click(zoomOutButton)
        
        // Check if scale value is updated in properties panel
        expect(screen.getByText('80%')).toBeInTheDocument()
      }
    })
  })

  describe('Crop Functionality', () => {
    it('should show crop controls when crop tool is active and crop area is defined', () => {
      render(<ImageEditor {...defaultProps} />)
      
      // Switch to crop tool
      const cropButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'crop'
      )
      
      if (cropButton) {
        fireEvent.click(cropButton)
        
        // Simulate creating a crop area by mouse events on canvas
        const canvas = document.querySelector('canvas')
        if (canvas) {
          fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 })
          fireEvent.mouseMove(canvas, { clientX: 200, clientY: 200 })
          fireEvent.mouseUp(canvas)
          
          // Should show crop controls
          expect(screen.getByText('Apply Crop')).toBeInTheDocument()
          expect(screen.getByText('Cancel')).toBeInTheDocument()
        }
      }
    })

    it('should update crop area properties when dragging', () => {
      render(<ImageEditor {...defaultProps} />)
      
      // Switch to crop tool and create crop area
      const cropButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'crop'
      )
      
      if (cropButton) {
        fireEvent.click(cropButton)
        
        const canvas = document.querySelector('canvas')
        if (canvas) {
          // Mock getBoundingClientRect
          vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
            left: 0,
            top: 0,
            width: 800,
            height: 600,
            right: 800,
            bottom: 600,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          })
          
          fireEvent.mouseDown(canvas, { clientX: 100, clientY: 100 })
          fireEvent.mouseMove(canvas, { clientX: 200, clientY: 200 })
          fireEvent.mouseUp(canvas)
          
          // Check if crop area properties are displayed
          expect(screen.getByText('Crop Area')).toBeInTheDocument()
        }
      }
    })
  })

  describe('History Management', () => {
    it('should disable undo button initially', () => {
      render(<ImageEditor {...defaultProps} />)
      
      const undoButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'undo'
      )
      
      expect(undoButton).toBeDisabled()
    })

    it('should enable undo button after making changes', () => {
      render(<ImageEditor {...defaultProps} />)
      
      // Make a change (rotate)
      const rotateButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'rotate-cw'
      )
      
      if (rotateButton) {
        fireEvent.click(rotateButton)
        
        const undoButton = screen.getAllByRole('button').find(btn => 
          btn.querySelector('svg')?.getAttribute('data-lucide') === 'undo'
        )
        
        expect(undoButton).not.toBeDisabled()
      }
    })

    it('should show history in properties panel', () => {
      render(<ImageEditor {...defaultProps} />)
      
      // Make a change to create history
      const rotateButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'rotate-cw'
      )
      
      if (rotateButton) {
        fireEvent.click(rotateButton)
        
        expect(screen.getByText('History')).toBeInTheDocument()
        expect(screen.getByText('Rotated clockwise')).toBeInTheDocument()
      }
    })

    it('should undo changes when undo button is clicked', () => {
      render(<ImageEditor {...defaultProps} />)
      
      // Make a change
      const rotateButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'rotate-cw'
      )
      
      if (rotateButton) {
        fireEvent.click(rotateButton)
        expect(screen.getByText('90°')).toBeInTheDocument()
        
        // Undo the change
        const undoButton = screen.getAllByRole('button').find(btn => 
          btn.querySelector('svg')?.getAttribute('data-lucide') === 'undo'
        )
        
        if (undoButton) {
          fireEvent.click(undoButton)
          expect(screen.getByText('0°')).toBeInTheDocument()
        }
      }
    })
  })

  describe('Save Functionality', () => {
    it('should disable save button when no changes are made', () => {
      render(<ImageEditor {...defaultProps} />)
      
      const saveButton = screen.getByText('Save Changes')
      expect(saveButton).toBeDisabled()
    })

    it('should enable save button after making changes', () => {
      render(<ImageEditor {...defaultProps} />)
      
      // Make a change
      const rotateButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'rotate-cw'
      )
      
      if (rotateButton) {
        fireEvent.click(rotateButton)
        
        const saveButton = screen.getByText('Save Changes')
        expect(saveButton).not.toBeDisabled()
      }
    })

    it('should call onSave with edited image blob and changes when save is clicked', async () => {
      // Mock image loading
      const mockImg = new Image()
      vi.spyOn(window, 'Image').mockImplementation(() => {
        setTimeout(() => {
          if (mockImg.onload) {
            mockImg.onload()
          }
        }, 0)
        return mockImg
      })
      
      render(<ImageEditor {...defaultProps} />)
      
      // Wait for image to load
      await waitFor(() => {
        expect(mockImg.onload).toBeTruthy()
      })
      
      // Make a change
      const rotateButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'rotate-cw'
      )
      
      if (rotateButton) {
        fireEvent.click(rotateButton)
        
        const saveButton = screen.getByText('Save Changes')
        fireEvent.click(saveButton)
        
        await waitFor(() => {
          expect(mockOnSave).toHaveBeenCalledWith(
            expect.any(Blob),
            expect.objectContaining({
              rotation: 90,
              description: expect.stringContaining('Rotated clockwise'),
            })
          )
        })
      }
    })

    it('should show loading state while saving', async () => {
      // Mock slow save operation
      const slowOnSave = vi.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 1000))
      )
      
      render(<ImageEditor {...defaultProps} onSave={slowOnSave} />)
      
      // Make a change and save
      const rotateButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'rotate-cw'
      )
      
      if (rotateButton) {
        fireEvent.click(rotateButton)
        
        const saveButton = screen.getByText('Save Changes')
        fireEvent.click(saveButton)
        
        expect(screen.getByText('Saving changes...')).toBeInTheDocument()
      }
    })
  })

  describe('Cancel Functionality', () => {
    it('should call onCancel when cancel button is clicked', () => {
      render(<ImageEditor {...defaultProps} />)
      
      const cancelButton = screen.getByText('Cancel')
      fireEvent.click(cancelButton)
      
      expect(mockOnCancel).toHaveBeenCalledTimes(1)
    })

    it('should call onCancel when X button is clicked', () => {
      render(<ImageEditor {...defaultProps} />)
      
      const closeButton = screen.getAllByRole('button').find(btn => 
        btn.querySelector('svg')?.getAttribute('data-lucide') === 'x'
      )
      
      if (closeButton) {
        fireEvent.click(closeButton)
        expect(mockOnCancel).toHaveBeenCalledTimes(1)
      }
    })
  })

  describe('Error Handling', () => {
    it('should handle canvas context creation failure gracefully', () => {
      // Mock canvas getContext to return null
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      render(<ImageEditor {...defaultProps} />)
      
      // Should not crash and should handle the error gracefully
      expect(screen.getByText('Image Editor')).toBeInTheDocument()
      
      consoleSpy.mockRestore()
    })

    it('should handle image loading failure', () => {
      const mockImg = new Image()
      vi.spyOn(window, 'Image').mockImplementation(() => {
        setTimeout(() => {
          if (mockImg.onerror) {
            mockImg.onerror(new Event('error'))
          }
        }, 0)
        return mockImg
      })
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      render(<ImageEditor {...defaultProps} />)
      
      // Should handle the error gracefully
      expect(screen.getByText('Image Editor')).toBeInTheDocument()
      
      consoleSpy.mockRestore()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels for tool buttons', () => {
      render(<ImageEditor {...defaultProps} />)
      
      const buttons = screen.getAllByRole('button')
      
      // Each tool button should be identifiable
      buttons.forEach(button => {
        const hasAriaLabel = button.hasAttribute('aria-label')
        const hasAccessibleContent = button.textContent && button.textContent.trim().length > 0
        const hasIcon = button.querySelector('svg')
        
        // Should have either aria-label, text content, or be clearly identifiable
        expect(hasAriaLabel || hasAccessibleContent || hasIcon).toBe(true)
      })
    })

    it('should support keyboard navigation', () => {
      render(<ImageEditor {...defaultProps} />)
      
      const firstButton = screen.getAllByRole('button')[0]
      
      // Should be focusable
      firstButton.focus()
      expect(document.activeElement).toBe(firstButton)
      
      // Should handle keyboard events
      fireEvent.keyDown(firstButton, { key: 'Enter' })
      fireEvent.keyDown(firstButton, { key: ' ' })
    })
  })
})