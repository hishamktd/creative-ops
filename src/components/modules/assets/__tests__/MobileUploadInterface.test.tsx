import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MobileUploadInterface } from '../MobileUploadInterface'

// Mock hooks and services
vi.mock('@/lib/hooks/useMobileDetection', () => ({
  useMobileDetection: () => ({
    isMobile: true,
    isTouchDevice: true
  })
}))

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user1' }
  })
}))

vi.mock('@/lib/services/fileValidation', () => ({
  FileValidationService: {
    validateFile: vi.fn(() => Promise.resolve({
      isValid: true,
      errors: [],
      warnings: [],
      metadata: { checksum: 'abc123' }
    }))
  }
}))

vi.mock('@/lib/services/storage', () => ({
  StorageService: {
    generateFilePath: vi.fn(() => 'project1/test-file.jpg'),
    uploadFile: vi.fn(() => Promise.resolve({
      success: true,
      data: {
        publicUrl: 'https://example.com/uploaded-file.jpg',
        path: 'project1/test-file.jpg'
      }
    }))
  }
}))

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({
            data: {
              id: 'asset1',
              name: 'test-file.jpg',
              file_url: 'https://example.com/uploaded-file.jpg'
            },
            error: null
          }))
        }))
      }))
    }))
  }
}))

const defaultProps = {
  projectId: 'project1',
  folderId: null,
  isOpen: true,
  onClose: vi.fn(),
  onUploadComplete: vi.fn()
}

// Mock MediaDevices
const mockMediaDevices = {
  getUserMedia: vi.fn(() => Promise.resolve({
    getTracks: () => [{ stop: vi.fn() }]
  }))
}

Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: mockMediaDevices
})

// Mock MediaRecorder
global.MediaRecorder = vi.fn().mockImplementation(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  ondataavailable: null,
  onstop: null
}))

// Mock File and FileReader
global.FileReader = vi.fn().mockImplementation(() => ({
  readAsDataURL: vi.fn(),
  onload: null,
  result: 'data:image/jpeg;base64,mock-data'
}))

describe('MobileUploadInterface', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock canvas methods
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      writable: true,
      value: vi.fn(() => ({
        drawImage: vi.fn()
      }))
    })
    
    Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
      writable: true,
      value: vi.fn((callback) => {
        const mockBlob = new Blob(['mock-image-data'], { type: 'image/jpeg' })
        callback(mockBlob)
      })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not render when closed', () => {
    render(<MobileUploadInterface {...defaultProps} isOpen={false} />)
    
    expect(screen.queryByText('Upload Files')).not.toBeInTheDocument()
  })

  it('renders upload interface with tabs', () => {
    render(<MobileUploadInterface {...defaultProps} />)
    
    expect(screen.getByText('Upload Files')).toBeInTheDocument()
    expect(screen.getByText('Files')).toBeInTheDocument()
    expect(screen.getByText('Camera')).toBeInTheDocument()
    expect(screen.getByText('Queue')).toBeInTheDocument()
  })

  it('handles close action', () => {
    const onClose = vi.fn()
    render(<MobileUploadInterface {...defaultProps} onClose={onClose} />)
    
    const closeButton = document.querySelector('[data-lucide="x"]')?.parentElement
    expect(closeButton).toBeInTheDocument()
    
    fireEvent.click(closeButton!)
    expect(onClose).toHaveBeenCalled()
  })

  it('shows file upload options in files tab', () => {
    render(<MobileUploadInterface {...defaultProps} />)
    
    expect(screen.getByText('Photos')).toBeInTheDocument()
    expect(screen.getByText('Videos')).toBeInTheDocument()
    expect(screen.getByText('Documents')).toBeInTheDocument()
    expect(screen.getByText('Audio')).toBeInTheDocument()
  })

  it('handles file selection', async () => {
    render(<MobileUploadInterface {...defaultProps} />)
    
    // Create a mock file
    const mockFile = new File(['mock-content'], 'test-image.jpg', {
      type: 'image/jpeg'
    })
    
    // Get the hidden file input
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toBeInTheDocument()
    
    // Simulate file selection
    Object.defineProperty(fileInput, 'files', {
      value: [mockFile],
      writable: false
    })
    
    fireEvent.change(fileInput)
    
    // Should switch to queue tab and show the file
    await waitFor(() => {
      expect(screen.getByText('test-image.jpg')).toBeInTheDocument()
    })
  })

  it('switches to camera tab and requests camera access', async () => {
    render(<MobileUploadInterface {...defaultProps} />)
    
    const cameraTab = screen.getByText('Camera')
    fireEvent.click(cameraTab)
    
    await waitFor(() => {
      expect(screen.getByText('Enable Camera')).toBeInTheDocument()
    })
    
    const enableCameraButton = screen.getByText('Enable Camera')
    fireEvent.click(enableCameraButton)
    
    expect(mockMediaDevices.getUserMedia).toHaveBeenCalledWith({
      video: {
        facingMode: 'environment',
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    })
  })

  it('handles camera photo capture', async () => {
    render(<MobileUploadInterface {...defaultProps} />)
    
    // Switch to camera tab
    const cameraTab = screen.getByText('Camera')
    fireEvent.click(cameraTab)
    
    // Enable camera
    const enableCameraButton = screen.getByText('Enable Camera')
    fireEvent.click(enableCameraButton)
    
    await waitFor(() => {
      const captureButton = document.querySelector('[data-lucide="camera"]')?.parentElement
      expect(captureButton).toBeInTheDocument()
      
      fireEvent.click(captureButton!)
    })
    
    // Should add photo to queue
    await waitFor(() => {
      const queueTab = screen.getByText(/Queue/)
      expect(queueTab).toHaveTextContent('1') // Badge showing 1 file
    })
  })

  it('handles camera switching', async () => {
    render(<MobileUploadInterface {...defaultProps} />)
    
    // Switch to camera tab and enable camera
    const cameraTab = screen.getByText('Camera')
    fireEvent.click(cameraTab)
    
    const enableCameraButton = screen.getByText('Enable Camera')
    fireEvent.click(enableCameraButton)
    
    await waitFor(() => {
      const switchCameraButton = document.querySelector('[data-lucide="flip-horizontal"]')?.parentElement
      expect(switchCameraButton).toBeInTheDocument()
      
      fireEvent.click(switchCameraButton!)
    })
    
    // Should call getUserMedia again with different facing mode
    expect(mockMediaDevices.getUserMedia).toHaveBeenCalledTimes(2)
  })

  it('handles video recording', async () => {
    render(<MobileUploadInterface {...defaultProps} />)
    
    // Switch to camera tab and enable camera
    const cameraTab = screen.getByText('Camera')
    fireEvent.click(cameraTab)
    
    const enableCameraButton = screen.getByText('Enable Camera')
    fireEvent.click(enableCameraButton)
    
    await waitFor(() => {
      const recordButton = document.querySelector('[data-lucide="video"]')?.parentElement
      expect(recordButton).toBeInTheDocument()
      
      fireEvent.click(recordButton!)
    })
    
    // Should show recording indicator
    await waitFor(() => {
      expect(screen.getByText('Recording...')).toBeInTheDocument()
    })
    
    // Stop recording
    const stopButton = document.querySelector('.bg-red-500')
    expect(stopButton).toBeInTheDocument()
    fireEvent.click(stopButton!)
  })

  it('shows queue with uploaded files', async () => {
    render(<MobileUploadInterface {...defaultProps} />)
    
    // Add a file first
    const mockFile = new File(['mock-content'], 'test-image.jpg', {
      type: 'image/jpeg'
    })
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(fileInput, 'files', {
      value: [mockFile],
      writable: false
    })
    
    fireEvent.change(fileInput)
    
    // Switch to queue tab
    const queueTab = screen.getByText(/Queue/)
    fireEvent.click(queueTab)
    
    await waitFor(() => {
      expect(screen.getByText('test-image.jpg')).toBeInTheDocument()
      expect(screen.getByText('Upload 1 Files')).toBeInTheDocument()
    })
  })

  it('handles file upload process', async () => {
    const onUploadComplete = vi.fn()
    render(<MobileUploadInterface {...defaultProps} onUploadComplete={onUploadComplete} />)
    
    // Add a file
    const mockFile = new File(['mock-content'], 'test-image.jpg', {
      type: 'image/jpeg'
    })
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(fileInput, 'files', {
      value: [mockFile],
      writable: false
    })
    
    fireEvent.change(fileInput)
    
    // Wait for validation and then upload
    await waitFor(() => {
      const uploadButton = screen.getByText('Upload 1 Files')
      expect(uploadButton).toBeInTheDocument()
      
      fireEvent.click(uploadButton)
    })
    
    // Should call upload services
    await waitFor(() => {
      expect(require('@/lib/services/storage').StorageService.uploadFile).toHaveBeenCalled()
      expect(onUploadComplete).toHaveBeenCalled()
    })
  })

  it('handles file removal from queue', async () => {
    render(<MobileUploadInterface {...defaultProps} />)
    
    // Add a file
    const mockFile = new File(['mock-content'], 'test-image.jpg', {
      type: 'image/jpeg'
    })
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(fileInput, 'files', {
      value: [mockFile],
      writable: false
    })
    
    fireEvent.change(fileInput)
    
    await waitFor(() => {
      const removeButton = document.querySelector('[data-lucide="trash-2"]')?.parentElement
      expect(removeButton).toBeInTheDocument()
      
      fireEvent.click(removeButton!)
    })
    
    // File should be removed from queue
    await waitFor(() => {
      expect(screen.queryByText('test-image.jpg')).not.toBeInTheDocument()
    })
  })

  it('shows empty queue state', () => {
    render(<MobileUploadInterface {...defaultProps} />)
    
    const queueTab = screen.getByText('Queue')
    fireEvent.click(queueTab)
    
    expect(screen.getByText('No files queued')).toBeInTheDocument()
    expect(screen.getByText('Add files to see them here')).toBeInTheDocument()
  })

  it('handles file validation errors', async () => {
    // Mock validation failure
    vi.mocked(require('@/lib/services/fileValidation').FileValidationService.validateFile)
      .mockResolvedValueOnce({
        isValid: false,
        errors: ['File too large'],
        warnings: [],
        metadata: {}
      })
    
    render(<MobileUploadInterface {...defaultProps} />)
    
    const mockFile = new File(['mock-content'], 'large-file.jpg', {
      type: 'image/jpeg'
    })
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(fileInput, 'files', {
      value: [mockFile],
      writable: false
    })
    
    fireEvent.change(fileInput)
    
    await waitFor(() => {
      expect(screen.getByText('File too large')).toBeInTheDocument()
    })
  })

  it('shows upload progress', async () => {
    // Mock upload with progress
    vi.mocked(require('@/lib/services/storage').StorageService.uploadFile)
      .mockImplementation(({ onProgress }) => {
        // Simulate progress updates
        setTimeout(() => onProgress?.(50), 100)
        setTimeout(() => onProgress?.(100), 200)
        
        return Promise.resolve({
          success: true,
          data: {
            publicUrl: 'https://example.com/uploaded-file.jpg',
            path: 'project1/test-file.jpg'
          }
        })
      })
    
    render(<MobileUploadInterface {...defaultProps} />)
    
    // Add and upload a file
    const mockFile = new File(['mock-content'], 'test-image.jpg', {
      type: 'image/jpeg'
    })
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(fileInput, 'files', {
      value: [mockFile],
      writable: false
    })
    
    fireEvent.change(fileInput)
    
    await waitFor(() => {
      const uploadButton = screen.getByText('Upload 1 Files')
      fireEvent.click(uploadButton)
    })
    
    // Should show uploading status
    await waitFor(() => {
      expect(screen.getByText('Uploading')).toBeInTheDocument()
    })
  })

  it('handles upload errors', async () => {
    // Mock upload failure
    vi.mocked(require('@/lib/services/storage').StorageService.uploadFile)
      .mockResolvedValueOnce({
        success: false,
        error: 'Upload failed'
      })
    
    render(<MobileUploadInterface {...defaultProps} />)
    
    const mockFile = new File(['mock-content'], 'test-image.jpg', {
      type: 'image/jpeg'
    })
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(fileInput, 'files', {
      value: [mockFile],
      writable: false
    })
    
    fireEvent.change(fileInput)
    
    await waitFor(() => {
      const uploadButton = screen.getByText('Upload 1 Files')
      fireEvent.click(uploadButton)
    })
    
    await waitFor(() => {
      expect(screen.getByText('Upload failed')).toBeInTheDocument()
    })
  })

  it('formats file sizes correctly', async () => {
    render(<MobileUploadInterface {...defaultProps} />)
    
    const mockFile = new File(['x'.repeat(1024000)], 'test-image.jpg', {
      type: 'image/jpeg'
    })
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(fileInput, 'files', {
      value: [mockFile],
      writable: false
    })
    
    fireEvent.change(fileInput)
    
    await waitFor(() => {
      expect(screen.getByText(/1000KB/)).toBeInTheDocument()
    })
  })

  it('shows file type icons correctly', async () => {
    render(<MobileUploadInterface {...defaultProps} />)
    
    const mockFile = new File(['mock-content'], 'test-video.mp4', {
      type: 'video/mp4'
    })
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    Object.defineProperty(fileInput, 'files', {
      value: [mockFile],
      writable: false
    })
    
    fireEvent.change(fileInput)
    
    await waitFor(() => {
      expect(screen.getByText('test-video.mp4')).toBeInTheDocument()
      // Should show video emoji icon
      const videoIcon = screen.getByText('🎥')
      expect(videoIcon).toBeInTheDocument()
    })
  })

  it('handles different file type selections', () => {
    render(<MobileUploadInterface {...defaultProps} />)
    
    const videosButton = screen.getByText('Videos')
    fireEvent.click(videosButton)
    
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).toHaveAttribute('accept', 'video/*')
    
    const documentsButton = screen.getByText('Documents')
    fireEvent.click(documentsButton)
    
    expect(fileInput).toHaveAttribute('accept', '.pdf,.doc,.docx')
    
    const audioButton = screen.getByText('Audio')
    fireEvent.click(audioButton)
    
    expect(fileInput).toHaveAttribute('accept', 'audio/*')
  })
})