import { renderHook, act, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { useAssetUpload } from '../useAssetUpload'
import { createMockFile } from '@/test/test-utils'

// Mock the storage service
const mockStorageService = {
  uploadFile: vi.fn(),
  validateFile: vi.fn(),
}

vi.mock('@/lib/services/storage', () => ({
  StorageService: mockStorageService,
}))

// Mock the asset manager
const mockAssetManager = {
  createAsset: vi.fn(),
  generateThumbnail: vi.fn(),
}

vi.mock('@/lib/services/assetManager', () => ({
  AssetManager: mockAssetManager,
}))

describe('useAssetUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mock responses
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
        fullPath: 'full/test/path',
        publicUrl: 'https://example.com/test.jpg',
      },
    })
    
    mockAssetManager.createAsset.mockResolvedValue({
      id: 'asset-1',
      name: 'test.jpg',
      file_url: 'https://example.com/test.jpg',
    })
  })

  it('initializes with default state', () => {
    const { result } = renderHook(() => useAssetUpload())
    
    expect(result.current.uploads).toEqual([])
    expect(result.current.isUploading).toBe(false)
    expect(result.current.totalProgress).toBe(0)
  })

  it('uploads a single file successfully', async () => {
    const { result } = renderHook(() => useAssetUpload())
    const file = createMockFile('test.jpg', 'test content', 'image/jpeg')
    
    await act(async () => {
      await result.current.uploadFiles([file], {
        projectId: 'project-1',
        folderId: 'folder-1',
      })
    })
    
    expect(mockStorageService.validateFile).toHaveBeenCalledWith(file)
    expect(mockStorageService.uploadFile).toHaveBeenCalled()
    expect(mockAssetManager.createAsset).toHaveBeenCalled()
  })

  it('handles multiple file uploads', async () => {
    const { result } = renderHook(() => useAssetUpload())
    const files = [
      createMockFile('test1.jpg', 'content1', 'image/jpeg'),
      createMockFile('test2.png', 'content2', 'image/png'),
    ]
    
    await act(async () => {
      await result.current.uploadFiles(files, {
        projectId: 'project-1',
      })
    })
    
    expect(mockStorageService.uploadFile).toHaveBeenCalledTimes(2)
    expect(mockAssetManager.createAsset).toHaveBeenCalledTimes(2)
  })

  it('tracks upload progress', async () => {
    const { result } = renderHook(() => useAssetUpload())
    const file = createMockFile('test.jpg')
    
    let progressCallback: ((progress: number) => void) | undefined
    
    mockStorageService.uploadFile.mockImplementation(({ onProgress }) => {
      progressCallback = onProgress
      return new Promise((resolve) => {
        setTimeout(() => {
          if (progressCallback) {
            progressCallback(50)
            setTimeout(() => {
              if (progressCallback) progressCallback(100)
              resolve({
                success: true,
                data: { path: 'test', fullPath: 'test', publicUrl: 'test' },
              })
            }, 100)
          }
        }, 100)
      })
    })
    
    act(() => {
      result.current.uploadFiles([file], { projectId: 'project-1' })
    })
    
    // Check initial state
    expect(result.current.isUploading).toBe(true)
    
    // Wait for progress updates
    await waitFor(() => {
      expect(result.current.uploads[0]?.progress).toBeGreaterThan(0)
    })
    
    await waitFor(() => {
      expect(result.current.uploads[0]?.progress).toBe(100)
      expect(result.current.isUploading).toBe(false)
    })
  })

  it('handles validation errors', async () => {
    const { result } = renderHook(() => useAssetUpload())
    const file = createMockFile('invalid.exe', 'content', 'application/octet-stream')
    
    mockStorageService.validateFile.mockReturnValue({
      isValid: false,
      errors: ['File type not allowed'],
      warnings: [],
      metadata: {},
      securityFlags: [],
    })
    
    await act(async () => {
      await result.current.uploadFiles([file], { projectId: 'project-1' })
    })
    
    expect(result.current.uploads[0]?.status).toBe('error')
    expect(result.current.uploads[0]?.error).toContain('File type not allowed')
  })

  it('handles upload failures', async () => {
    const { result } = renderHook(() => useAssetUpload())
    const file = createMockFile('test.jpg')
    
    mockStorageService.uploadFile.mockResolvedValue({
      success: false,
      error: 'Upload failed',
    })
    
    await act(async () => {
      await result.current.uploadFiles([file], { projectId: 'project-1' })
    })
    
    expect(result.current.uploads[0]?.status).toBe('error')
    expect(result.current.uploads[0]?.error).toBe('Upload failed')
  })

  it('supports retry functionality', async () => {
    const { result } = renderHook(() => useAssetUpload())
    const file = createMockFile('test.jpg')
    
    // First attempt fails
    mockStorageService.uploadFile.mockResolvedValueOnce({
      success: false,
      error: 'Network error',
    })
    
    // Second attempt succeeds
    mockStorageService.uploadFile.mockResolvedValueOnce({
      success: true,
      data: { path: 'test', fullPath: 'test', publicUrl: 'test' },
    })
    
    await act(async () => {
      await result.current.uploadFiles([file], { projectId: 'project-1' })
    })
    
    expect(result.current.uploads[0]?.status).toBe('error')
    
    await act(async () => {
      await result.current.retryUpload(result.current.uploads[0]!.id)
    })
    
    expect(result.current.uploads[0]?.status).toBe('completed')
  })

  it('supports canceling uploads', async () => {
    const { result } = renderHook(() => useAssetUpload())
    const file = createMockFile('test.jpg')
    
    mockStorageService.uploadFile.mockImplementation(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            success: true,
            data: { path: 'test', fullPath: 'test', publicUrl: 'test' },
          })
        }, 1000)
      })
    })
    
    act(() => {
      result.current.uploadFiles([file], { projectId: 'project-1' })
    })
    
    expect(result.current.isUploading).toBe(true)
    
    act(() => {
      result.current.cancelUpload(result.current.uploads[0]!.id)
    })
    
    expect(result.current.uploads[0]?.status).toBe('cancelled')
  })

  it('clears completed uploads', async () => {
    const { result } = renderHook(() => useAssetUpload())
    const file = createMockFile('test.jpg')
    
    await act(async () => {
      await result.current.uploadFiles([file], { projectId: 'project-1' })
    })
    
    expect(result.current.uploads).toHaveLength(1)
    
    act(() => {
      result.current.clearCompleted()
    })
    
    expect(result.current.uploads).toHaveLength(0)
  })

  it('calculates total progress correctly', async () => {
    const { result } = renderHook(() => useAssetUpload())
    const files = [
      createMockFile('test1.jpg'),
      createMockFile('test2.jpg'),
    ]
    
    let progressCallbacks: ((progress: number) => void)[] = []
    
    mockStorageService.uploadFile.mockImplementation(({ onProgress }) => {
      progressCallbacks.push(onProgress!)
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            success: true,
            data: { path: 'test', fullPath: 'test', publicUrl: 'test' },
          })
        }, 1000)
      })
    })
    
    act(() => {
      result.current.uploadFiles(files, { projectId: 'project-1' })
    })
    
    // Simulate progress updates
    act(() => {
      progressCallbacks[0]?.(50) // First file 50%
      progressCallbacks[1]?.(100) // Second file 100%
    })
    
    // Total progress should be (50 + 100) / 2 = 75%
    expect(result.current.totalProgress).toBe(75)
  })

  it('handles duplicate file detection', async () => {
    const { result } = renderHook(() => useAssetUpload({
      detectDuplicates: true,
    }))
    
    const file = createMockFile('test.jpg')
    
    // Mock duplicate detection
    mockAssetManager.createAsset.mockRejectedValueOnce(
      new Error('File with same checksum already exists')
    )
    
    await act(async () => {
      await result.current.uploadFiles([file], { projectId: 'project-1' })
    })
    
    expect(result.current.uploads[0]?.status).toBe('error')
    expect(result.current.uploads[0]?.error).toContain('already exists')
  })

  it('supports custom upload options', async () => {
    const { result } = renderHook(() => useAssetUpload())
    const file = createMockFile('test.jpg')
    
    await act(async () => {
      await result.current.uploadFiles([file], {
        projectId: 'project-1',
        folderId: 'folder-1',
        description: 'Test upload',
        tags: ['test', 'upload'],
        generateThumbnail: true,
      })
    })
    
    expect(mockAssetManager.createAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        project_id: 'project-1',
        folder_id: 'folder-1',
        description: 'Test upload',
        tags: ['test', 'upload'],
      })
    )
  })
})