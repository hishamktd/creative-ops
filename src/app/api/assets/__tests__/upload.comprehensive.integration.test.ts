import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { POST } from '../upload/route'
import { NextRequest } from 'next/server'
import { createMockFile, createMockImageFile, createMockVideoFile, mockSupabaseClient } from '@/test/test-utils'

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createServerComponentClient: () => mockSupabaseClient
}))

// Mock storage service
const mockStorageService = {
  uploadFile: vi.fn(),
  validateFile: vi.fn(),
  generateThumbnail: vi.fn(),
}

vi.mock('@/lib/services/storage', () => ({
  StorageService: mockStorageService
}))

// Mock metadata extraction
const mockMetadataService = {
  extractMetadata: vi.fn(),
  extractText: vi.fn(),
}

vi.mock('@/lib/services/metadataExtraction', () => ({
  MetadataExtractionService: mockMetadataService
}))

// Mock authentication
const mockAuth = {
  getUser: vi.fn(),
}

vi.mock('@/lib/hooks/useAuth', () => ({
  useAuth: () => mockAuth
}))

describe('Asset Upload API - Integration Tests', () => {
  const mockUser = {
    id: 'user-1',
    email: 'test@example.com'
  }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mocks
    mockAuth.getUser.mockResolvedValue(mockUser)
    
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
        path: 'projects/project-1/test.jpg',
        publicUrl: 'https://example.com/test.jpg'
      }
    })
    
    mockMetadataService.extractMetadata.mockResolvedValue({
      width: 1920,
      height: 1080,
      fileSize: 1024000,
      mimeType: 'image/jpeg'
    })
    
    mockSupabaseClient.from.mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'asset-1',
              name: 'test.jpg',
              file_url: 'https://example.com/test.jpg'
            },
            error: null
          })
        })
      })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Single File Upload', () => {
    it('should upload image file successfully', async () => {
      const formData = new FormData()
      formData.append('file', createMockImageFile('test.jpg'))
      formData.append('projectId', 'project-1')
      formData.append('name', 'Test Image')
      formData.append('description', 'Test description')
      
      const request = new NextRequest('http://localhost:3000/api/assets/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.asset).toEqual(
        expect.objectContaining({
          id: 'asset-1',
          name: 'test.jpg',
          file_url: 'https://example.com/test.jpg'
        })
      )
    })

    it('should upload video file with metadata extraction', async () => {
      const videoFile = createMockVideoFile('test.mp4')
      
      mockMetadataService.extractMetadata.mockResolvedValue({
        width: 1920,
        height: 1080,
        duration: 120,
        fileSize: 50000000,
        mimeType: 'video/mp4'
      })
      
      const formData = new FormData()
      formData.append('file', videoFile)
      formData.append('projectId', 'project-1')
      
      const request = new NextRequest('http://localhost:3000/api/assets/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(mockMetadataService.extractMetadata).toHaveBeenCalledWith(videoFile)
      expect(data.asset.metadata).toEqual(
        expect.objectContaining({
          duration: 120
        })
      )
    })

    it('should handle file validation errors', async () => {
      mockStorageService.validateFile.mockReturnValue({
        isValid: false,
        errors: ['File type not allowed'],
        warnings: [],
        metadata: {},
        securityFlags: [],
      })
      
      const formData = new FormData()
      formData.append('file', createMockFile('malware.exe', 'content', 'application/x-executable'))
      formData.append('projectId', 'project-1')
      
      const request = new NextRequest('http://localhost:3000/api/assets/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('File type not allowed')
    })

    it('should handle storage upload failures', async () => {
      mockStorageService.uploadFile.mockResolvedValue({
        success: false,
        error: 'Storage quota exceeded'
      })
      
      const formData = new FormData()
      formData.append('file', createMockImageFile())
      formData.append('projectId', 'project-1')
      
      const request = new NextRequest('http://localhost:3000/api/assets/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Storage quota exceeded')
    })

    it('should handle database insertion failures', async () => {
      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: null,
        error: { message: 'Database constraint violation' }
      })
      
      const formData = new FormData()
      formData.append('file', createMockImageFile())
      formData.append('projectId', 'project-1')
      
      const request = new NextRequest('http://localhost:3000/api/assets/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Database constraint violation')
    })
  })

  describe('Multiple File Upload', () => {
    it('should upload multiple files successfully', async () => {
      const files = [
        createMockImageFile('image1.jpg'),
        createMockImageFile('image2.png'),
        createMockVideoFile('video1.mp4')
      ]
      
      const formData = new FormData()
      files.forEach(file => formData.append('files', file))
      formData.append('projectId', 'project-1')
      
      // Mock multiple successful responses
      mockSupabaseClient.from().insert().select().single
        .mockResolvedValueOnce({ data: { id: 'asset-1' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'asset-2' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'asset-3' }, error: null })
      
      const request = new NextRequest('http://localhost:3000/api/assets/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.assets).toHaveLength(3)
      expect(mockStorageService.uploadFile).toHaveBeenCalledTimes(3)
    })

    it('should handle partial failures in batch upload', async () => {
      const files = [
        createMockImageFile('valid.jpg'),
        createMockFile('invalid.exe', 'content', 'application/x-executable')
      ]
      
      mockStorageService.validateFile
        .mockReturnValueOnce({
          isValid: true,
          errors: [],
          warnings: [],
          metadata: {},
          securityFlags: [],
        })
        .mockReturnValueOnce({
          isValid: false,
          errors: ['File type not allowed'],
          warnings: [],
          metadata: {},
          securityFlags: [],
        })
      
      const formData = new FormData()
      files.forEach(file => formData.append('files', file))
      formData.append('projectId', 'project-1')
      
      const request = new NextRequest('http://localhost:3000/api/assets/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(207) // Multi-status
      expect(data.results).toHaveLength(2)
      expect(data.results[0].success).toBe(true)
      expect(data.results[1].success).toBe(false)
    })
  })

  describe('Folder Integration', () => {
    it('should upload file to specific folder', async () => {
      const formData = new FormData()
      formData.append('file', createMockImageFile())
      formData.append('projectId', 'project-1')
      formData.append('folderId', 'folder-1')
      
      const request = new NextRequest('http://localhost:3000/api/assets/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          folder_id: 'folder-1'
        })
      )
    })

    it('should validate folder permissions', async () => {
      // Mock folder permission check
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' } // Not found
            })
          })
        })
      })
      
      const formData = new FormData()
      formData.append('file', createMockImageFile())
      formData.append('projectId', 'project-1')
      formData.append('folderId', 'non-existent-folder')
      
      const request = new NextRequest('http://localhost:3000/api/assets/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('Invalid folder or insufficient permissions')
    })
  })

  describe('Authentication and Authorization', () => {
    it('should reject unauthenticated requests', async () => {
      mockAuth.getUser.mockResolvedValue(null)
      
      const formData = new FormData()
      formData.append('file', createMockImageFile())
      formData.append('projectId', 'project-1')
      
      const request = new NextRequest('http://localhost:3000/api/assets/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toContain('Authentication required')
    })

    it('should validate project access permissions', async () => {
      // Mock project permission check
      mockSupabaseClient.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' }
              })
            })
          })
        })
      })
      
      const formData = new FormData()
      formData.append('file', createMockImageFile())
      formData.append('projectId', 'unauthorized-project')
      
      const request = new NextRequest('http://localhost:3000/api/assets/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toContain('Insufficient permissions')
    })
  })

  describe('Request Validation', () => {
    it('should validate required fields', async () => {
      const formData = new FormData()
      formData.append('file', createMockImageFile())
      // Missing projectId
      
      const request = new NextRequest('http://localhost:3000/api/assets/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Project ID is required')
    })

    it('should validate file presence', async () => {
      const formData = new FormData()
      formData.append('projectId', 'project-1')
      // Missing file
      
      const request = new NextRequest('http://localhost:3000/api/assets/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('No files provided')
    })

    it('should validate file size limits', async () => {
      const largeFile = createMockImageFile('large.jpg')
      Object.defineProperty(largeFile, 'size', { value: 200 * 1024 * 1024 }) // 200MB
      
      mockStorageService.validateFile.mockReturnValue({
        isValid: false,
        errors: ['File size exceeds maximum limit of 100MB'],
        warnings: [],
        metadata: {},
        securityFlags: [],
      })
      
      const formData = new FormData()
      formData.append('file', largeFile)
      formData.append('projectId', 'project-1')
      
      const request = new NextRequest('http://localhost:3000/api/assets/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('File size exceeds maximum limit')
    })
  })

  describe('Metadata Processing', () => {
    it('should extract and store image metadata', async () => {
      const imageFile = createMockImageFile('photo.jpg')
      
      mockMetadataService.extractMetadata.mockResolvedValue({
        width: 4032,
        height: 3024,
        fileSize: 2500000,
        mimeType: 'image/jpeg',
        exif: {
          camera: 'iPhone 12 Pro',
          lens: '26mm f/1.6',
          iso: 100,
          shutterSpeed: '1/120',
          aperture: 'f/1.6'
        }
      })
      
      const formData = new FormData()
      formData.append('file', imageFile)
      formData.append('projectId', 'project-1')
      
      const request = new NextRequest('http://localhost:3000/api/assets/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            width: 4032,
            height: 3024,
            exif: expect.objectContaining({
              camera: 'iPhone 12 Pro'
            })
          })
        })
      )
    })

    it('should handle metadata extraction failures gracefully', async () => {
      mockMetadataService.extractMetadata.mockRejectedValue(
        new Error('Corrupted file')
      )
      
      const formData = new FormData()
      formData.append('file', createMockImageFile())
      formData.append('projectId', 'project-1')
      
      const request = new NextRequest('http://localhost:3000/api/assets/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      // Should still succeed but with limited metadata
      expect(response.status).toBe(200)
      expect(data.asset.metadata).toEqual(
        expect.objectContaining({
          extraction_error: 'Corrupted file'
        })
      )
    })
  })

  describe('Thumbnail Generation', () => {
    it('should generate thumbnails for images', async () => {
      mockStorageService.generateThumbnail.mockResolvedValue({
        success: true,
        data: {
          thumbnailUrl: 'https://example.com/thumb.jpg',
          previewUrl: 'https://example.com/preview.jpg'
        }
      })
      
      const formData = new FormData()
      formData.append('file', createMockImageFile())
      formData.append('projectId', 'project-1')
      
      const request = new NextRequest('http://localhost:3000/api/assets/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      
      expect(mockStorageService.generateThumbnail).toHaveBeenCalled()
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          thumbnail_url: 'https://example.com/thumb.jpg',
          preview_url: 'https://example.com/preview.jpg'
        })
      )
    })

    it('should handle thumbnail generation failures', async () => {
      mockStorageService.generateThumbnail.mockResolvedValue({
        success: false,
        error: 'Thumbnail generation failed'
      })
      
      const formData = new FormData()
      formData.append('file', createMockImageFile())
      formData.append('projectId', 'project-1')
      
      const request = new NextRequest('http://localhost:3000/api/assets/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()

      // Should still succeed without thumbnails
      expect(response.status).toBe(200)
      expect(data.asset.thumbnail_url).toBeNull()
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle concurrent uploads efficiently', async () => {
      const uploadPromises = Array.from({ length: 10 }, (_, i) => {
        const formData = new FormData()
        formData.append('file', createMockImageFile(`image-${i}.jpg`))
        formData.append('projectId', 'project-1')
        
        const request = new NextRequest('http://localhost:3000/api/assets/upload', {
          method: 'POST',
          body: formData
        })

        return POST(request)
      })
      
      const startTime = performance.now()
      const responses = await Promise.all(uploadPromises)
      const endTime = performance.now()
      
      // All uploads should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
      
      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(5000)
    })

    it('should implement rate limiting', async () => {
      // Simulate rapid requests from same user
      const rapidRequests = Array.from({ length: 100 }, () => {
        const formData = new FormData()
        formData.append('file', createMockImageFile())
        formData.append('projectId', 'project-1')
        
        const request = new NextRequest('http://localhost:3000/api/assets/upload', {
          method: 'POST',
          body: formData,
          headers: {
            'x-forwarded-for': '192.168.1.1'
          }
        })

        return POST(request)
      })
      
      const responses = await Promise.all(rapidRequests)
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(r => r.status === 429)
      expect(rateLimitedResponses.length).toBeGreaterThan(0)
    })
  })

  describe('Error Recovery', () => {
    it('should cleanup storage on database failure', async () => {
      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      })
      
      const mockDeleteFile = vi.fn().mockResolvedValue(true)
      mockStorageService.deleteFile = mockDeleteFile
      
      const formData = new FormData()
      formData.append('file', createMockImageFile())
      formData.append('projectId', 'project-1')
      
      const request = new NextRequest('http://localhost:3000/api/assets/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      
      expect(response.status).toBe(500)
      expect(mockDeleteFile).toHaveBeenCalled() // Cleanup uploaded file
    })

    it('should handle partial cleanup failures gracefully', async () => {
      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      })
      
      mockStorageService.deleteFile = vi.fn().mockResolvedValue(false)
      
      const formData = new FormData()
      formData.append('file', createMockImageFile())
      formData.append('projectId', 'project-1')
      
      const request = new NextRequest('http://localhost:3000/api/assets/upload', {
        method: 'POST',
        body: formData
      })

      const response = await POST(request)
      const data = await response.json()
      
      expect(response.status).toBe(500)
      expect(data.error).toContain('Database error')
      // Should log cleanup failure but not fail the response
    })
  })
})