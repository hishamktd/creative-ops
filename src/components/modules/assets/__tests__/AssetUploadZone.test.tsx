import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { AssetUploadZone } from '../AssetUploadZone'
import { FileValidationService } from '@/lib/services/fileValidation'
import { StorageService } from '@/lib/services/storage'

// Mock dependencies
vi.mock('@/lib/services/fileValidation')
vi.mock('@/lib/services/storage')
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { id: '1', name: 'test.jpg' }, error: null }))
        }))
      }))
    }))
  }
}))
vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } })
}))

// Create mock file
const createMockFile = (name: string, type: string, size: number = 1024) => {
  const file = new File(['test content'], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('AssetUploadZone', () => {
  const mockProps = {
    projectId: 'project-1',
    folderId: 'folder-1',
    onUploadComplete: vi.fn(),
    onUploadProgress: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock FileValidationService
    vi.mocked(FileValidationService.validateFile).mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [],
      metadata: {
        name: 'test.jpg',
        size: 1024,
        type: 'image/jpeg',
        extension: '.jpg',
        lastModified: Date.now(),
        checksum: 'abc123'
      },
      securityFlags: []
    })

    // Mock StorageService
    vi.mocked(StorageService.generateFilePath).mockReturnValue('projects/project-1/folder-1/test.jpg')
    vi.mocked(StorageService.uploadFile).mockResolvedValue({
      success: true,
      data: {
        path: 'projects/project-1/folder-1/test.jpg',
        fullPath: 'projects/project-1/folder-1/test.jpg',
        publicUrl: 'https://example.com/test.jpg'
      }
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders upload zone with correct content', () => {
    render(<AssetUploadZone {...mockProps} />)
    
    expect(screen.getByText('Upload your assets')).toBeInTheDocument()
    expect(screen.getByText('Drag and drop files here, paste images, or click to browse')).toBeInTheDocument()
    expect(screen.getByText('Supported: Images, Videos, Documents, Audio files')).toBeInTheDocument()
  })

  it('handles file selection via input', async () => {
    render(<AssetUploadZone {...mockProps} />)
    
    const file = createMockFile('test.jpg', 'image/jpeg')
    const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement
    
    fireEvent.change(input, { target: { files: [file] } })
    
    await waitFor(() => {
      expect(screen.getByText('test.jpg')).toBeInTheDocument()
      expect(screen.getByText('Upload Queue (1)')).toBeInTheDocument()
    })
  })

  it('handles drag and drop events', async () => {
    render(<AssetUploadZone {...mockProps} />)
    
    const dropZone = screen.getByText('Upload your assets').closest('div')!
    const file = createMockFile('test.jpg', 'image/jpeg')
    
    // Simulate drag enter
    fireEvent.dragEnter(dropZone, {
      dataTransfer: { items: [{ kind: 'file' }] }
    })
    
    expect(screen.getByText('Drop files here!')).toBeInTheDocument()
    
    // Simulate drop
    fireEvent.drop(dropZone, {
      dataTransfer: { files: [file] }
    })
    
    await waitFor(() => {
      expect(screen.getByText('test.jpg')).toBeInTheDocument()
    })
  })

  it('validates files before adding to queue', async () => {
    const invalidValidation = {
      isValid: false,
      errors: ['File too large'],
      warnings: [],
      metadata: {
        name: 'large.jpg',
        size: 1024 * 1024 * 200, // 200MB
        type: 'image/jpeg',
        extension: '.jpg',
        lastModified: Date.now()
      },
      securityFlags: []
    }
    
    vi.mocked(FileValidationService.validateFile).mockResolvedValue(invalidValidation)
    
    render(<AssetUploadZone {...mockProps} />)
    
    const file = createMockFile('large.jpg', 'image/jpeg', 1024 * 1024 * 200)
    const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement
    
    fireEvent.change(input, { target: { files: [file] } })
    
    await waitFor(() => {
      expect(screen.getByText('File too large')).toBeInTheDocument()
    })
  })

  it('handles upload process', async () => {
    render(<AssetUploadZone {...mockProps} />)
    
    const file = createMockFile('test.jpg', 'image/jpeg')
    const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement
    
    fireEvent.change(input, { target: { files: [file] } })
    
    await waitFor(() => {
      expect(screen.getByText('Upload All')).toBeInTheDocument()
    })
    
    fireEvent.click(screen.getByText('Upload All'))
    
    await waitFor(() => {
      expect(StorageService.uploadFile).toHaveBeenCalledWith({
        bucket: 'assets',
        path: 'projects/project-1/folder-1/test.jpg',
        file,
        onProgress: expect.any(Function)
      })
    })
  })

  it('handles upload errors', async () => {
    vi.mocked(StorageService.uploadFile).mockResolvedValue({
      success: false,
      error: 'Upload failed'
    })
    
    render(<AssetUploadZone {...mockProps} />)
    
    const file = createMockFile('test.jpg', 'image/jpeg')
    const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement
    
    fireEvent.change(input, { target: { files: [file] } })
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('Upload All'))
    })
    
    await waitFor(() => {
      expect(screen.getByText('Upload failed')).toBeInTheDocument()
    })
  })

  it('respects max files limit', async () => {
    render(<AssetUploadZone {...mockProps} maxFiles={2} />)
    
    const files = [
      createMockFile('test1.jpg', 'image/jpeg'),
      createMockFile('test2.jpg', 'image/jpeg'),
      createMockFile('test3.jpg', 'image/jpeg')
    ]
    
    // Mock window.alert
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    
    const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(input, { target: { files } })
    
    expect(alertSpy).toHaveBeenCalledWith('Maximum 2 files allowed. Please select fewer files.')
    
    alertSpy.mockRestore()
  })

  it('handles file removal', async () => {
    render(<AssetUploadZone {...mockProps} />)
    
    const file = createMockFile('test.jpg', 'image/jpeg')
    const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement
    
    fireEvent.change(input, { target: { files: [file] } })
    
    await waitFor(() => {
      expect(screen.getByText('test.jpg')).toBeInTheDocument()
    })
    
    const removeButton = screen.getByTitle('Remove file')
    fireEvent.click(removeButton)
    
    await waitFor(() => {
      expect(screen.queryByText('test.jpg')).not.toBeInTheDocument()
    })
  })

  it('handles paste events for images', async () => {
    render(<AssetUploadZone {...mockProps} />)
    
    const file = createMockFile('image.png', 'image/png')
    
    // Mock clipboard event
    const clipboardEvent = new ClipboardEvent('paste', {
      clipboardData: new DataTransfer()
    })
    
    // Mock the clipboard data
    Object.defineProperty(clipboardEvent, 'clipboardData', {
      value: {
        items: [{
          type: 'image/png',
          getAsFile: () => file
        }]
      }
    })
    
    fireEvent(document, clipboardEvent)
    
    await waitFor(() => {
      expect(screen.getByText(/pasted-image-/)).toBeInTheDocument()
    })
  })

  it('disables interactions when disabled prop is true', () => {
    render(<AssetUploadZone {...mockProps} disabled={true} />)
    
    const dropZone = screen.getByText('Upload your assets').closest('div')!
    expect(dropZone).toHaveClass('cursor-not-allowed')
    
    const input = dropZone.querySelector('input[type="file"]') as HTMLInputElement
    expect(input).toBeDisabled()
  })

  it('calls onUploadProgress callback', async () => {
    render(<AssetUploadZone {...mockProps} />)
    
    const file = createMockFile('test.jpg', 'image/jpeg')
    const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement
    
    fireEvent.change(input, { target: { files: [file] } })
    
    await waitFor(() => {
      expect(mockProps.onUploadProgress).toHaveBeenCalled()
    })
  })

  it('calls onUploadComplete callback after successful upload', async () => {
    render(<AssetUploadZone {...mockProps} />)
    
    const file = createMockFile('test.jpg', 'image/jpeg')
    const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement
    
    fireEvent.change(input, { target: { files: [file] } })
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('Upload All'))
    })
    
    await waitFor(() => {
      expect(mockProps.onUploadComplete).toHaveBeenCalledWith([
        expect.objectContaining({ id: '1', name: 'test.jpg' })
      ])
    })
  })
})