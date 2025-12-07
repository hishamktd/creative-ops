import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createMocks } from 'node-mocks-http'
import { POST } from '../batch/route'
import { createMockFile, mockSupabaseClient } from '@/test/test-utils'

// Mock Supabase client
vi.mock('@/lib/supabase/server', () => ({
  createServerComponentClient: () => mockSupabaseClient,
}))

// Mock storage service
vi.mock('@/lib/services/storage', () => ({
  StorageService: {
    uploadFile: vi.fn(),
    validateFile: vi.fn(),
    generateThumbnail: vi.fn(),
  },
}))

describe('/api/assets/batch - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('handles batch upload of multiple files', async () => {
    const { StorageService } = await import('@/lib/services/storage')
    
    // Mock successful uploads
    vi.mocked(StorageService.uploadFile).mockResolvedValue({
      success: true,
      data: {
        path: 'test/file.jpg',
        fullPath: 'project-1/test/file.jpg',
        publicUrl: 'https://example.com/file.jpg',
      },
    })

    vi.mocked(StorageService.validateFile).mockReturnValue({
      isValid: true,
      errors: [],
      warnings: [],
      metadata: { width: 100, height: 100 },
      securityFlags: [],
    })

    vi.mocked(StorageService.generateThumbnail).mockResolvedValue({
      success: true,
      thumbnailUrl: 'https://example.com/thumb.jpg',
    })

    // Mock database insertions
    mockSupabaseClient.from.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'asset-1',
              name: 'test.jpg',
              file_url: 'https://example.com/file.jpg',
            },
            error: null,
          }),
        }),
      }),
    })

    const formData = new FormData()
    formData.append('files', createMockFile('test1.jpg', 'image content', 'image/jpeg'))
    formData.append('files', createMockFile('test2.jpg', 'image content', 'image/jpeg'))
    formData.append('projectId', 'project-1')
    formData.append('folderId', 'folder-1')

    const { req } = createMocks({
      method: 'POST',
      body: formData,
    })

    const response = await POST(req as any)
    const result = await response.json()

    expect(response.status).toBe(200)
    expect(result.success).toBe(true)
    expect(result.data.assets).toHaveLength(2)
    expect(result.data.successful).toBe(2)
    expect(result.data.failed).toBe(0)
  })

  it('handles partial failures in batch upload', async () => {
    const { StorageService } = await import('@/lib/services/storage')
    
    // First file succeeds, second fails
    vi.mocked(StorageService.uploadFile)
      .mockResolvedValueOnce({
        success: true,
        data: {
          path: 'test/file1.jpg',
          fullPath: 'project-1/test/file1.jpg',
          publicUrl: 'https://example.com/file1.jpg',
        },
      })
      .mockResolvedValueOnce({
        success: false,
        error: 'File too large',
      })

    vi.mocked(StorageService.validateFile)
      .mockReturnValueOnce({
        isValid: true,
        errors: [],
        warnings: [],
        metadata: {},
        securityFlags: [],
      })
      .mockReturnValueOnce({
        isValid: false,
        errors: ['File size exceeds limit'],
        warnings: [],
        metadata: {},
        securityFlags: [],
      })

    const formData = new FormData()
    formData.append('files', createMockFile('test1.jpg', 'small content', 'image/jpeg'))
    formData.append('files', createMockFile('test2.jpg', 'x'.repeat(50 * 1024 * 1024), 'image/jpeg'))
    formData.append('projectId', 'project-1')

    const { req } = createMocks({
      method: 'POST',
      body: formData,
    })

    const response = await POST(req as any)
    const result = await response.json()

    expect(response.status).toBe(207) // Multi-status
    expect(result.success).toBe(true)
    expect(result.data.successful).toBe(1)
    expect(result.data.failed).toBe(1)
    expect(result.data.errors).toHaveLength(1)
  })

  it('validates file types and sizes', async () => {
    const { StorageService } = await import('@/lib/services/storage')
    
    vi.mocked(StorageService.validateFile).mockReturnValue({
      isValid: false,
      errors: ['Invalid file type'],
      warnings: [],
      metadata: {},
      securityFlags: ['suspicious_extension'],
    })

    const formData = new FormData()
    formData.append('files', createMockFile('malicious.exe', 'executable content', 'application/octet-stream'))
    formData.append('projectId', 'project-1')

    const { req } = createMocks({
      method: 'POST',
      body: formData,
    })

    const response = await POST(req as any)
    const result = await response.json()

    expect(response.status).toBe(207)
    expect(result.data.failed).toBe(1)
    expect(result.data.errors[0]).toContain('Invalid file type')
  })

  it('handles database transaction failures', async () => {
    const { StorageService } = await import('@/lib/services/storage')
    
    vi.mocked(StorageService.uploadFile).mockResolvedValue({
      success: true,
      data: {
        path: 'test/file.jpg',
        fullPath: 'project-1/test/file.jpg',
        publicUrl: 'https://example.com/file.jpg',
      },
    })

    vi.mocked(StorageService.validateFile).mockReturnValue({
      isValid: true,
      errors: [],
      warnings: [],
      metadata: {},
      securityFlags: [],
    })

    // Mock database failure
    mockSupabaseClient.from.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database constraint violation' },
          }),
        }),
      }),
    })

    const formData = new FormData()
    formData.append('files', createMockFile('test.jpg', 'image content', 'image/jpeg'))
    formData.append('projectId', 'project-1')

    const { req } = createMocks({
      method: 'POST',
      body: formData,
    })

    const response = await POST(req as any)
    const result = await response.json()

    expect(response.status).toBe(207)
    expect(result.data.failed).toBe(1)
    expect(result.data.errors[0]).toContain('Database constraint violation')
  })

  it('enforces rate limiting for batch uploads', async () => {
    // Simulate too many files
    const formData = new FormData()
    for (let i = 0; i < 101; i++) {
      formData.append('files', createMockFile(`test${i}.jpg`, 'content', 'image/jpeg'))
    }
    formData.append('projectId', 'project-1')

    const { req } = createMocks({
      method: 'POST',
      body: formData,
    })

    const response = await POST(req as any)
    const result = await response.json()

    expect(response.status).toBe(400)
    expect(result.error).toContain('Too many files')
  })

  it('handles concurrent batch uploads', async () => {
    const { StorageService } = await import('@/lib/services/storage')
    
    vi.mocked(StorageService.uploadFile).mockImplementation(async () => {
      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 100))
      return {
        success: true,
        data: {
          path: 'test/file.jpg',
          fullPath: 'project-1/test/file.jpg',
          publicUrl: 'https://example.com/file.jpg',
        },
      }
    })

    vi.mocked(StorageService.validateFile).mockReturnValue({
      isValid: true,
      errors: [],
      warnings: [],
      metadata: {},
      securityFlags: [],
    })

    mockSupabaseClient.from.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'asset-1' },
            error: null,
          }),
        }),
      }),
    })

    const formData = new FormData()
    for (let i = 0; i < 5; i++) {
      formData.append('files', createMockFile(`test${i}.jpg`, 'content', 'image/jpeg'))
    }
    formData.append('projectId', 'project-1')

    const { req } = createMocks({
      method: 'POST',
      body: formData,
    })

    const startTime = Date.now()
    const response = await POST(req as any)
    const endTime = Date.now()
    const result = await response.json()

    // Should process files concurrently, not sequentially
    expect(endTime - startTime).toBeLessThan(500) // Less than 5 * 100ms
    expect(response.status).toBe(200)
    expect(result.data.successful).toBe(5)
  })

  it('provides progress updates for large batch uploads', async () => {
    // This would typically involve WebSocket or Server-Sent Events
    // For now, we'll test that the response includes progress information
    
    const formData = new FormData()
    for (let i = 0; i < 10; i++) {
      formData.append('files', createMockFile(`test${i}.jpg`, 'content', 'image/jpeg'))
    }
    formData.append('projectId', 'project-1')
    formData.append('includeProgress', 'true')

    const { req } = createMocks({
      method: 'POST',
      body: formData,
    })

    const response = await POST(req as any)
    const result = await response.json()

    expect(result.data).toHaveProperty('progress')
    expect(result.data.progress).toHaveProperty('total')
    expect(result.data.progress).toHaveProperty('completed')
  })
})