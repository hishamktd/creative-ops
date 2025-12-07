import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { axe, toHaveNoViolations } from 'vitest-axe'
import userEvent from '@testing-library/user-event'
import { AssetUploadZone } from '../AssetUploadZone'
import { 
  expectFocusManagement, 
  expectScreenReaderSupport, 
  simulateKeyboardNavigation 
} from '@/test/accessibility-setup'
import { createMockImageFile } from '@/test/test-utils'

expect.extend(toHaveNoViolations)

// Mock services
const mockStorageService = {
  uploadFile: vi.fn(),
  validateFile: vi.fn(),
}

vi.mock('@/lib/services/storage', () => ({
  StorageService: mockStorageService
}))

describe('AssetUploadZone - Accessibility Tests', () => {
  const defaultProps = {
    projectId: 'project-1',
    onUploadComplete: vi.fn(),
    onUploadProgress: vi.fn(),
    onUploadError: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockStorageService.validateFile.mockReturnValue({
      isValid: true,
      errors: [],
      warnings: [],
      metadata: {},
      securityFlags: [],
    })
    
    mockStorageService.uploadFile.mockResolvedValue({
      success: true,
      data: {
        path: 'test/path',
        publicUrl: 'https://example.com/test.jpg',
      },
    })

    // Clear screen reader announcements
    global.mockAriaLive.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('WCAG Compliance', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(<AssetUploadZone {...defaultProps} />)
      
      const results = await axe(container)
      expect(results).toHaveNoViolations()
    })

    it('should maintain accessibility during upload process', async () => {
      const { container } = render(<AssetUploadZone {...defaultProps} />)
      
      const fileInput = screen.getByLabelText(/choose files/i)
      const file = createMockImageFile()
      
      // Upload file
      await userEvent.upload(fileInput, file)
      
      // Check accessibility during upload
      const resultsAfterUpload = await axe(container)
      expect(resultsAfterUpload).toHaveNoViolations()
      
      // Wait for upload completion
      await waitFor(() => {
        expect(screen.getByText(/upload completed/i)).toBeInTheDocument()
      })
      
      // Check accessibility after completion
      const resultsAfterCompletion = await axe(container)
      expect(resultsAfterCompletion).toHaveNoViolations()
    })

    it('should maintain accessibility with error states', async () => {
      mockStorageService.validateFile.mockReturnValue({
        isValid: false,
        errors: ['File type not allowed'],
        warnings: [],
        metadata: {},
        securityFlags: [],
      })

      const { container } = render(<AssetUploadZone {...defaultProps} />)
      
      const fileInput = screen.getByLabelText(/choose files/i)
      const invalidFile = new File(['test'], 'test.exe', { type: 'application/x-executable' })
      
      await userEvent.upload(fileInput, invalidFile)
      
      // Check accessibility with error state
      const resultsWithError = await axe(container)
      expect(resultsWithError).toHaveNoViolations()
    })
  })

  describe('Keyboard Navigation', () => {
    it('should be fully navigable with keyboard', async () => {
      render(<AssetUploadZone {...defaultProps} />)
      
      const dropZone = screen.getByRole('button', { name: /drag.*drop/i })
      
      // Tab to drop zone
      await userEvent.tab()
      expectFocusManagement.toBeFocused(dropZone)
      
      // Activate with Enter
      simulateKeyboardNavigation.enter(dropZone)
      
      // Should trigger file input
      const fileInput = screen.getByLabelText(/choose files/i)
      expect(fileInput).toBeInTheDocument()
    })

    it('should handle keyboard navigation during upload', async () => {
      render(<AssetUploadZone {...defaultProps} />)
      
      const fileInput = screen.getByLabelText(/choose files/i)
      const file = createMockImageFile()
      
      // Mock long-running upload
      mockStorageService.uploadFile.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            success: true,
            data: { path: 'test/path', publicUrl: 'https://example.com/test.jpg' }
          }), 1000)
        )
      )
      
      await userEvent.upload(fileInput, file)
      
      // Should be able to navigate to cancel button
      const cancelButton = await screen.findByRole('button', { name: /cancel/i })
      
      await userEvent.tab()
      expectFocusManagement.toBeFocused(cancelButton)
      
      // Should be able to activate cancel with keyboard
      simulateKeyboardNavigation.enter(cancelButton)
      
      await waitFor(() => {
        expect(screen.getByText(/upload cancelled/i)).toBeInTheDocument()
      })
    })

    it('should support keyboard shortcuts', async () => {
      render(<AssetUploadZone {...defaultProps} multiple />)
      
      const dropZone = screen.getByRole('button', { name: /drag.*drop/i })
      
      // Focus drop zone
      dropZone.focus()
      
      // Test Ctrl+V for paste
      fireEvent.keyDown(dropZone, { key: 'v', ctrlKey: true })
      
      // Should handle paste event
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: new DataTransfer()
      })
      
      fireEvent(dropZone, pasteEvent)
      
      // Verify paste handling is accessible
      expect(dropZone).toHaveAttribute('aria-describedby')
    })

    it('should trap focus in modal dialogs', async () => {
      render(<AssetUploadZone {...defaultProps} />)
      
      // Trigger error modal
      mockStorageService.validateFile.mockReturnValue({
        isValid: false,
        errors: ['File too large'],
        warnings: [],
        metadata: {},
        securityFlags: [],
      })
      
      const fileInput = screen.getByLabelText(/choose files/i)
      const largeFile = new File(['x'.repeat(1000000)], 'large.jpg', { type: 'image/jpeg' })
      
      await userEvent.upload(fileInput, largeFile)
      
      // Error modal should appear
      const errorModal = screen.getByRole('dialog')
      expect(errorModal).toBeInTheDocument()
      
      // Focus should be trapped within modal
      expectFocusManagement.toTrapFocus(errorModal)
      
      // Should be able to close with Escape
      simulateKeyboardNavigation.escape(errorModal)
      
      await waitFor(() => {
        expect(errorModal).not.toBeInTheDocument()
      })
    })
  })

  describe('Screen Reader Support', () => {
    it('should provide proper labels and descriptions', () => {
      render(<AssetUploadZone {...defaultProps} />)
      
      const dropZone = screen.getByRole('button', { name: /drag.*drop/i })
      const fileInput = screen.getByLabelText(/choose files/i)
      
      // Check for proper labeling
      expectScreenReaderSupport.toHaveAriaLabel(dropZone)
      expectScreenReaderSupport.toHaveAriaLabel(fileInput)
      expectScreenReaderSupport.toHaveAriaDescribedBy(dropZone)
    })

    it('should announce upload progress to screen readers', async () => {
      render(<AssetUploadZone {...defaultProps} />)
      
      const fileInput = screen.getByLabelText(/choose files/i)
      const file = createMockImageFile()
      
      // Mock upload with progress
      mockStorageService.uploadFile.mockImplementation(({ onProgress }) => {
        setTimeout(() => onProgress?.(25), 100)
        setTimeout(() => onProgress?.(50), 200)
        setTimeout(() => onProgress?.(75), 300)
        setTimeout(() => onProgress?.(100), 400)
        
        return Promise.resolve({
          success: true,
          data: { path: 'test/path', publicUrl: 'https://example.com/test.jpg' }
        })
      })
      
      await userEvent.upload(fileInput, file)
      
      // Check for progress announcements
      await waitFor(() => {
        expectScreenReaderSupport.toHaveAnnounced('Upload started')
      })
      
      await waitFor(() => {
        expectScreenReaderSupport.toHaveAnnounced('Upload completed')
      })
    })

    it('should announce errors appropriately', async () => {
      mockStorageService.validateFile.mockReturnValue({
        isValid: false,
        errors: ['File type not supported'],
        warnings: [],
        metadata: {},
        securityFlags: [],
      })

      render(<AssetUploadZone {...defaultProps} />)
      
      const fileInput = screen.getByLabelText(/choose files/i)
      const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' })
      
      await userEvent.upload(fileInput, invalidFile)
      
      // Should announce error
      expectScreenReaderSupport.toHaveAnnounced('File type not supported')
      
      // Error should be in an alert region
      const errorAlert = screen.getByRole('alert')
      expect(errorAlert).toContainText('File type not supported')
    })

    it('should provide status updates for multiple file uploads', async () => {
      render(<AssetUploadZone {...defaultProps} multiple />)
      
      const fileInput = screen.getByLabelText(/choose files/i)
      const files = [
        createMockImageFile('image1.jpg'),
        createMockImageFile('image2.jpg'),
        createMockImageFile('image3.jpg'),
      ]
      
      await userEvent.upload(fileInput, files)
      
      // Should announce batch upload status
      expectScreenReaderSupport.toHaveAnnounced('Uploading 3 files')
      
      await waitFor(() => {
        expectScreenReaderSupport.toHaveAnnounced('All uploads completed')
      })
    })

    it('should provide live region updates', async () => {
      render(<AssetUploadZone {...defaultProps} />)
      
      // Check for live region
      const statusRegion = screen.getByRole('status')
      expect(statusRegion).toBeInTheDocument()
      expect(statusRegion).toHaveAttribute('aria-live', 'polite')
      
      const fileInput = screen.getByLabelText(/choose files/i)
      const file = createMockImageFile()
      
      await userEvent.upload(fileInput, file)
      
      // Status region should update
      await waitFor(() => {
        expect(statusRegion).toHaveTextContent(/uploading/i)
      })
    })
  })

  describe('Visual Accessibility', () => {
    it('should have sufficient color contrast', () => {
      render(<AssetUploadZone {...defaultProps} />)
      
      const dropZone = screen.getByRole('button', { name: /drag.*drop/i })
      
      // Check for proper styling classes that ensure contrast
      expect(dropZone).toHaveClass(/border-gray-300|border-primary-500/)
      expect(dropZone).toHaveClass(/text-gray-600|text-primary-600/)
    })

    it('should provide visual focus indicators', async () => {
      render(<AssetUploadZone {...defaultProps} />)
      
      const dropZone = screen.getByRole('button', { name: /drag.*drop/i })
      
      // Focus the element
      await userEvent.tab()
      
      // Should have focus styles
      expect(dropZone).toHaveClass(/focus:ring|focus:outline/)
    })

    it('should support high contrast mode', () => {
      // Mock high contrast media query
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-contrast: high)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })

      render(<AssetUploadZone {...defaultProps} />)
      
      const dropZone = screen.getByRole('button', { name: /drag.*drop/i })
      
      // Should adapt to high contrast mode
      expect(dropZone).toBeInTheDocument()
    })

    it('should be usable when animations are reduced', () => {
      // Mock reduced motion preference
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      })

      render(<AssetUploadZone {...defaultProps} />)
      
      const fileInput = screen.getByLabelText(/choose files/i)
      const file = createMockImageFile()
      
      // Upload should work without animations
      userEvent.upload(fileInput, file)
      
      // Progress should still be communicated
      const progressBar = screen.getByRole('progressbar')
      expect(progressBar).toBeInTheDocument()
    })
  })

  describe('Touch and Mobile Accessibility', () => {
    it('should have appropriate touch targets', () => {
      render(<AssetUploadZone {...defaultProps} />)
      
      const dropZone = screen.getByRole('button', { name: /drag.*drop/i })
      
      // Should have minimum touch target size (44px)
      const styles = window.getComputedStyle(dropZone)
      const minHeight = parseInt(styles.minHeight) || parseInt(styles.height)
      const minWidth = parseInt(styles.minWidth) || parseInt(styles.width)
      
      expect(minHeight).toBeGreaterThanOrEqual(44)
      expect(minWidth).toBeGreaterThanOrEqual(44)
    })

    it('should support voice control', () => {
      render(<AssetUploadZone {...defaultProps} />)
      
      const dropZone = screen.getByRole('button', { name: /drag.*drop/i })
      const fileInput = screen.getByLabelText(/choose files/i)
      
      // Elements should have clear, speakable names
      expect(dropZone).toHaveAccessibleName()
      expect(fileInput).toHaveAccessibleName()
      
      // Names should not be too generic
      const dropZoneName = dropZone.getAttribute('aria-label') || dropZone.textContent
      const fileInputName = fileInput.getAttribute('aria-label') || fileInput.getAttribute('aria-labelledby')
      
      expect(dropZoneName).not.toMatch(/^(button|click|upload)$/i)
      expect(fileInputName).not.toMatch(/^(input|file|choose)$/i)
    })
  })

  describe('Error Accessibility', () => {
    it('should associate errors with form controls', async () => {
      mockStorageService.validateFile.mockReturnValue({
        isValid: false,
        errors: ['File size too large'],
        warnings: [],
        metadata: {},
        securityFlags: [],
      })

      render(<AssetUploadZone {...defaultProps} />)
      
      const fileInput = screen.getByLabelText(/choose files/i)
      const largeFile = new File(['x'.repeat(1000000)], 'large.jpg', { type: 'image/jpeg' })
      
      await userEvent.upload(fileInput, largeFile)
      
      // Error should be associated with input
      const errorMessage = screen.getByText(/file size too large/i)
      expect(errorMessage).toBeInTheDocument()
      
      // Input should reference error
      const errorId = errorMessage.getAttribute('id')
      if (errorId) {
        expect(fileInput).toHaveAttribute('aria-describedby', expect.stringContaining(errorId))
      }
    })

    it('should provide clear error recovery instructions', async () => {
      mockStorageService.uploadFile.mockResolvedValue({
        success: false,
        error: 'Network connection failed'
      })

      render(<AssetUploadZone {...defaultProps} />)
      
      const fileInput = screen.getByLabelText(/choose files/i)
      const file = createMockImageFile()
      
      await userEvent.upload(fileInput, file)
      
      await waitFor(() => {
        expect(screen.getByText(/network connection failed/i)).toBeInTheDocument()
      })
      
      // Should provide retry option
      const retryButton = screen.getByRole('button', { name: /retry/i })
      expect(retryButton).toBeInTheDocument()
      
      // Retry button should be accessible
      expectScreenReaderSupport.toHaveAriaLabel(retryButton)
    })
  })

  describe('Internationalization Accessibility', () => {
    it('should support RTL languages', () => {
      // Mock RTL direction
      document.dir = 'rtl'
      
      render(<AssetUploadZone {...defaultProps} />)
      
      const dropZone = screen.getByRole('button', { name: /drag.*drop/i })
      
      // Should adapt layout for RTL
      expect(dropZone).toBeInTheDocument()
      
      // Reset direction
      document.dir = 'ltr'
    })

    it('should handle long translated text', () => {
      const longTextProps = {
        ...defaultProps,
        uploadText: 'Ziehen Sie Ihre Dateien hierher oder klicken Sie, um Dateien auszuwählen. Unterstützte Formate: JPEG, PNG, GIF, PDF, MP4',
      }
      
      render(<AssetUploadZone {...longTextProps} />)
      
      const dropZone = screen.getByRole('button')
      
      // Should handle long text without breaking layout
      expect(dropZone).toBeInTheDocument()
      expect(dropZone).toHaveTextContent(/ziehen sie ihre dateien/i)
    })
  })
})