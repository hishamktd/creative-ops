import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { EnhancedUploadZone } from '../EnhancedUploadZone'
import { ErrorHandlingService } from '@/lib/services/errorHandling'
import { OfflineHandlingService } from '@/lib/services/offlineHandling'

// Mock services
vi.mock('@/lib/services/errorHandling')
vi.mock('@/lib/services/offlineHandling')

// Mock fetch
global.fetch = vi.fn()

// Mock FileReader
global.FileReader = class {
  result: string | null = null
  onload: ((event: any) => void) | null = null
  onerror: ((event: any) => void) | null = null

  readAsDataURL(file: File) {
    setTimeout(() => {
      this.result = `data:${file.type};base64,mock-data`
      this.onload?.({ target: { result: this.result } })
    }, 0)
  }
} as any

describe('EnhancedUploadZone', () => {
  const mockProps = {
    projectId: 'test-project',
    folderId: 'test-folder',
    onUploadComplete: vi.fn(),
    onUploadError: vi.fn(),
    onUploadProgress: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock OfflineHandlingService
    vi.mocked(OfflineHandlingService.isOnline).mockReturnValue(true)
    vi.mocked(OfflineHandlingService.subscribe).mockReturnValue(() => {})
    vi.mocked(OfflineHandlingService.queueOperation).mockReturnValue('mock-operation-id')

    // Mock successful fetch
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        asset: { id: 'asset1', name: 'test.jpg' }
      })
    })
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('rendering', () => {
    it('should render upload zone with default content', () => {
      render(<EnhancedUploadZone {...mockProps} />)

      expect(screen.getByText('Drop files here or click to browse')).toBeInTheDocument()
      expect(screen.getByText('Choose Files')).toBeInTheDocument()
      expect(screen.getByText(/Maximum 10 files/)).toBeInTheDocument()
    })

    it('should show offline status when offline', () => {
      vi.mocked(OfflineHandlingService.isOnline).mockReturnValue(false)

      render(<EnhancedUploadZone {...mockProps} />)

      expect(screen.getByText("You're offline")).toBeInTheDocument()
      expect(screen.getByText('Files will be uploaded when connection is restored')).toBeInTheDocument()
    })

    it('should show offline notification banner when offline', () => {
      vi.mocked(OfflineHandlingService.isOnline).mockReturnValue(false)

      render(<EnhancedUploadZone {...mockProps} />)

      expect(screen.getByText("You're currently offline")).toBeInTheDocument()
    })
  })

  describe('file validation', () => {
    it('should validate file size', async () => {
      const mockError = {
        id: 'error1',
        type: 'validation',
        code: 'FILE_TOO_LARGE',
        userMessage: 'File is too large'
      }

      vi.mocked(ErrorHandlingService.createError).mockReturnValue(mockError as any)

      render(<EnhancedUploadZone {...mockProps} maxFileSize={1024} />)

      const input = screen.getByRole('button', { name: 'Choose Files' }).parentElement?.querySelector('input[type="file"]')
      
      const largeFile = new File(['x'.repeat(2048)], 'large.jpg', { type: 'image/jpeg' })
      
      fireEvent.change(input!, { target: { files: [largeFile] } })

      await waitFor(() => {
        expect(mockProps.onUploadError).toHaveBeenCalledWith(mockError)
      })
    })

    it('should validate file type', async () => {
      const mockError = {
        id: 'error1',
        type: 'validation',
        code: 'INVALID_FILE_TYPE',
        userMessage: 'File type not supported'
      }

      vi.mocked(ErrorHandlingService.createError).mockReturnValue(mockError as any)

      render(<EnhancedUploadZone {...mockProps} acceptedTypes={['image/*']} />)

      const input = screen.getByRole('button', { name: 'Choose Files' }).parentElement?.querySelector('input[type="file"]')
      
      const invalidFile = new File(['content'], 'document.pdf', { type: 'application/pdf' })
      
      fireEvent.change(input!, { target: { files: [invalidFile] } })

      await waitFor(() => {
        expect(mockProps.onUploadError).toHaveBeenCalledWith(mockError)
      })
    })

    it('should validate maximum file count', async () => {
      const mockError = {
        id: 'error1',
        type: 'validation',
        code: 'TOO_MANY_FILES',
        userMessage: 'Too many files selected'
      }

      vi.mocked(ErrorHandlingService.createError).mockReturnValue(mockError as any)

      render(<EnhancedUploadZone {...mockProps} maxFiles={2} />)

      const input = screen.getByRole('button', { name: 'Choose Files' }).parentElement?.querySelector('input[type="file"]')
      
      const files = [
        new File(['1'], 'file1.jpg', { type: 'image/jpeg' }),
        new File(['2'], 'file2.jpg', { type: 'image/jpeg' }),
        new File(['3'], 'file3.jpg', { type: 'image/jpeg' })
      ]
      
      fireEvent.change(input!, { target: { files } })

      await waitFor(() => {
        expect(mockProps.onUploadError).toHaveBeenCalledWith(mockError)
      })
    })

    it('should reject empty files', async () => {
      const mockError = {
        id: 'error1',
        type: 'validation',
        code: 'EMPTY_FILE',
        userMessage: 'File is empty'
      }

      vi.mocked(ErrorHandlingService.createError).mockReturnValue(mockError as any)

      render(<EnhancedUploadZone {...mockProps} />)

      const input = screen.getByRole('button', { name: 'Choose Files' }).parentElement?.querySelector('input[type="file"]')
      
      const emptyFile = new File([''], 'empty.jpg', { type: 'image/jpeg' })
      
      fireEvent.change(input!, { target: { files: [emptyFile] } })

      await waitFor(() => {
        expect(mockProps.onUploadError).toHaveBeenCalledWith(mockError)
      })
    })
  })

  describe('file upload', () => {
    it('should upload valid files successfully', async () => {
      render(<EnhancedUploadZone {...mockProps} />)

      const input = screen.getByRole('button', { name: 'Choose Files' }).parentElement?.querySelector('input[type="file"]')
      
      const validFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
      
      fireEvent.change(input!, { target: { files: [validFile] } })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/assets/upload', {
          method: 'POST',
          body: expect.any(FormData)
        })
      })

      await waitFor(() => {
        expect(mockProps.onUploadComplete).toHaveBeenCalledWith([
          { id: 'asset1', name: 'test.jpg' }
        ])
      })
    })

    it('should show upload progress', async () => {
      render(<EnhancedUploadZone {...mockProps} />)

      const input = screen.getByRole('button', { name: 'Choose Files' }).parentElement?.querySelector('input[type="file"]')
      
      const validFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
      
      fireEvent.change(input!, { target: { files: [validFile] } })

      await waitFor(() => {
        expect(screen.getByText('test.jpg')).toBeInTheDocument()
        expect(screen.getByText('Uploads (0/1)')).toBeInTheDocument()
      })
    })

    it('should handle upload errors', async () => {
      ;(global.fetch as any).mockRejectedValue(new Error('Upload failed'))

      render(<EnhancedUploadZone {...mockProps} />)

      const input = screen.getByRole('button', { name: 'Choose Files' }).parentElement?.querySelector('input[type="file"]')
      
      const validFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
      
      fireEvent.change(input!, { target: { files: [validFile] } })

      await waitFor(() => {
        expect(screen.getByText('✗')).toBeInTheDocument()
      })
    })

    it('should queue uploads when offline', async () => {
      vi.mocked(OfflineHandlingService.isOnline).mockReturnValue(false)
      ;(global.fetch as any).mockRejectedValue(new Error('Network error'))

      render(<EnhancedUploadZone {...mockProps} />)

      const input = screen.getByRole('button', { name: 'Choose Files' }).parentElement?.querySelector('input[type="file"]')
      
      const validFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
      
      fireEvent.change(input!, { target: { files: [validFile] } })

      await waitFor(() => {
        expect(OfflineHandlingService.queueOperation).toHaveBeenCalledWith(
          'upload',
          expect.objectContaining({
            projectId: 'test-project',
            folderId: 'test-folder',
            fileName: 'test.jpg'
          }),
          1,
          3
        )
      })
    })
  })

  describe('drag and drop', () => {
    it('should handle drag over events', () => {
      render(<EnhancedUploadZone {...mockProps} />)

      const dropZone = screen.getByText('Drop files here or click to browse').closest('div')
      
      fireEvent.dragOver(dropZone!, {
        dataTransfer: { files: [] }
      })

      expect(dropZone).toHaveClass('border-blue-500')
    })

    it('should handle file drop', async () => {
      render(<EnhancedUploadZone {...mockProps} />)

      const dropZone = screen.getByText('Drop files here or click to browse').closest('div')
      
      const file = new File(['content'], 'dropped.jpg', { type: 'image/jpeg' })
      
      fireEvent.drop(dropZone!, {
        dataTransfer: { files: [file] }
      })

      await waitFor(() => {
        expect(screen.getByText('dropped.jpg')).toBeInTheDocument()
      })
    })
  })

  describe('upload management', () => {
    it('should allow cancelling uploads', async () => {
      render(<EnhancedUploadZone {...mockProps} />)

      const input = screen.getByRole('button', { name: 'Choose Files' }).parentElement?.querySelector('input[type="file"]')
      
      const validFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
      
      fireEvent.change(input!, { target: { files: [validFile] } })

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Cancel'))

      await waitFor(() => {
        expect(screen.getByText('⊘')).toBeInTheDocument()
      })
    })

    it('should allow retrying failed uploads', async () => {
      ;(global.fetch as any)
        .mockRejectedValueOnce(new Error('Upload failed'))
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            asset: { id: 'asset1', name: 'test.jpg' }
          })
        })

      render(<EnhancedUploadZone {...mockProps} />)

      const input = screen.getByRole('button', { name: 'Choose Files' }).parentElement?.querySelector('input[type="file"]')
      
      const validFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
      
      fireEvent.change(input!, { target: { files: [validFile] } })

      await waitFor(() => {
        expect(screen.getByText('Retry')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Retry'))

      await waitFor(() => {
        expect(screen.getByText('✓')).toBeInTheDocument()
      })
    })

    it('should clear completed uploads', async () => {
      render(<EnhancedUploadZone {...mockProps} />)

      const input = screen.getByRole('button', { name: 'Choose Files' }).parentElement?.querySelector('input[type="file"]')
      
      const validFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' })
      
      fireEvent.change(input!, { target: { files: [validFile] } })

      await waitFor(() => {
        expect(screen.getByText('✓')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Clear Completed'))

      await waitFor(() => {
        expect(screen.queryByText('test.jpg')).not.toBeInTheDocument()
      })
    })
  })

  describe('recovery actions', () => {
    it('should display recovery actions for errors', async () => {
      const mockError = {
        id: 'error1',
        type: 'validation',
        code: 'FILE_TOO_LARGE',
        userMessage: 'File is too large',
        retryable: false,
        recoveryActions: [
          { type: 'manual', label: 'Choose Smaller File', description: 'Select a smaller file', priority: 1 },
          { type: 'manual', label: 'Compress File', description: 'Compress the file', priority: 2 }
        ]
      }

      vi.mocked(ErrorHandlingService.createError).mockReturnValue(mockError as any)
      ;(global.fetch as any).mockRejectedValue(new Error('File too large'))

      render(<EnhancedUploadZone {...mockProps} />)

      const input = screen.getByRole('button', { name: 'Choose Files' }).parentElement?.querySelector('input[type="file"]')
      
      const largeFile = new File(['x'.repeat(200000000)], 'large.jpg', { type: 'image/jpeg' })
      
      fireEvent.change(input!, { target: { files: [largeFile] } })

      await waitFor(() => {
        expect(screen.getByText('Choose Smaller File')).toBeInTheDocument()
        expect(screen.getByText('Compress File')).toBeInTheDocument()
      })
    })
  })
})