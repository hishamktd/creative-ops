import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AssetManager } from '../assetManager'

// Mock dependencies
vi.mock('../storage', () => ({
  StorageService: {
    uploadFile: vi.fn(),
    deleteFile: vi.fn(),
    getSignedUrl: vi.fn(),
    validateFile: vi.fn(),
  },
}))

vi.mock('../metadataExtraction', () => ({
  MetadataExtractionService: {
    extractMetadata: vi.fn(),
  },
}))

vi.mock('../thumbnail', () => ({
  ThumbnailService: {
    generateThumbnail: vi.fn(),
  },
}))

vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
  },
}))

describe('AssetManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('uploadAsset', () => {
    it('should upload asset successfully', async () => {
      const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })
      const mockMetadata = { width: 100, height: 100 }
      const mockThumbnail = new Blob(['thumbnail'], { type: 'image/jpeg' })

      const { StorageService } = await import('../storage')
      const { MetadataExtractionService } = await import('../metadataExtraction')
      const { ThumbnailService } = await import('../thumbnail')
      const { supabase } = await import('@/lib/supabase/client')

      vi.mocked(StorageService.validateFile).mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
        metadata: { name: 'test.jpg', type: 'image/jpeg', size: file.size },
        securityFlags: [],
      })

      vi.mocked(StorageService.uploadFile).mockResolvedValue({
        success: true,
        data: {
          path: 'test/path',
          fullPath: 'full/test/path',
          publicUrl: 'https://example.com/test.jpg',
        },
      })

      vi.mocked(MetadataExtractionService.extractMetadata).mockResolvedValue(mockMetadata)
      vi.mocked(ThumbnailService.generateThumbnail).mockResolvedValue(mockThumbnail)

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'asset-1', name: 'test.jpg' },
              error: null,
            }),
          }),
        }),
      } as any)

      const result = await AssetManager.uploadAsset({
        file,
        projectId: 'project-1',
        folderId: 'folder-1',
        description: 'Test asset',
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual(expect.objectContaining({
        id: 'asset-1',
        name: 'test.jpg',
      }))
      expect(StorageService.uploadFile).toHaveBeenCalled()
      expect(MetadataExtractionService.extractMetadata).toHaveBeenCalledWith(file)
      expect(ThumbnailService.generateThumbnail).toHaveBeenCalledWith(file)
    })

    it('should handle validation errors', async () => {
      const file = new File(['test'], 'test.exe', { type: 'application/octet-stream' })

      const { StorageService } = await import('../storage')
      vi.mocked(StorageService.validateFile).mockReturnValue({
        isValid: false,
        errors: ['File type not allowed'],
        warnings: [],
        metadata: { name: 'test.exe', type: 'application/octet-stream', size: file.size },
        securityFlags: [],
      })

      const result = await AssetManager.uploadAsset({
        file,
        projectId: 'project-1',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('File type not allowed')
    })

    it('should handle upload failures', async () => {
      const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })

      const { StorageService } = await import('../storage')
      vi.mocked(StorageService.validateFile).mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
        metadata: { name: 'test.jpg', type: 'image/jpeg', size: file.size },
        securityFlags: [],
      })

      vi.mocked(StorageService.uploadFile).mockResolvedValue({
        success: false,
        error: 'Upload failed',
      })

      const result = await AssetManager.uploadAsset({
        file,
        projectId: 'project-1',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Upload failed')
    })

    it('should handle database insertion errors', async () => {
      const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })

      const { StorageService } = await import('../storage')
      const { MetadataExtractionService } = await import('../metadataExtraction')
      const { ThumbnailService } = await import('../thumbnail')
      const { supabase } = await import('@/lib/supabase/client')

      vi.mocked(StorageService.validateFile).mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
        metadata: { name: 'test.jpg', type: 'image/jpeg', size: file.size },
        securityFlags: [],
      })

      vi.mocked(StorageService.uploadFile).mockResolvedValue({
        success: true,
        data: {
          path: 'test/path',
          fullPath: 'full/test/path',
          publicUrl: 'https://example.com/test.jpg',
        },
      })

      vi.mocked(MetadataExtractionService.extractMetadata).mockResolvedValue({})
      vi.mocked(ThumbnailService.generateThumbnail).mockResolvedValue(null)

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          }),
        }),
      } as any)

      const result = await AssetManager.uploadAsset({
        file,
        projectId: 'project-1',
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Database error')
    })
  })

  describe('getAssets', () => {
    it('should fetch assets successfully', async () => {
      const mockAssets = [
        { id: 'asset-1', name: 'test1.jpg' },
        { id: 'asset-2', name: 'test2.jpg' },
      ]

      const { supabase } = await import('@/lib/supabase/client')
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockAssets,
              error: null,
            }),
          }),
        }),
      } as any)

      const result = await AssetManager.getAssets('project-1')

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockAssets)
    })

    it('should handle database errors', async () => {
      const { supabase } = await import('@/lib/supabase/client')
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' },
            }),
          }),
        }),
      } as any)

      const result = await AssetManager.getAssets('project-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Database error')
    })
  })

  describe('deleteAsset', () => {
    it('should delete asset successfully', async () => {
      const mockAsset = {
        id: 'asset-1',
        file_path: 'test/path',
        thumbnail_url: 'https://example.com/thumb.jpg',
      }

      const { supabase } = await import('@/lib/supabase/client')
      const { StorageService } = await import('../storage')

      // Mock getting asset details
      vi.mocked(supabase.from).mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: mockAsset,
              error: null,
            }),
          }),
        }),
      } as any)

      // Mock deleting from database
      vi.mocked(supabase.from).mockReturnValueOnce({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: null,
          }),
        }),
      } as any)

      vi.mocked(StorageService.deleteFile).mockResolvedValue(true)

      const result = await AssetManager.deleteAsset('asset-1')

      expect(result.success).toBe(true)
      expect(StorageService.deleteFile).toHaveBeenCalledWith('test/path')
    })

    it('should handle asset not found', async () => {
      const { supabase } = await import('@/lib/supabase/client')

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Asset not found' },
            }),
          }),
        }),
      } as any)

      const result = await AssetManager.deleteAsset('nonexistent')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Asset not found')
    })
  })

  describe('updateAsset', () => {
    it('should update asset successfully', async () => {
      const updates = {
        name: 'updated-name.jpg',
        description: 'Updated description',
        tags: ['updated', 'tags'],
      }

      const { supabase } = await import('@/lib/supabase/client')
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: { id: 'asset-1', ...updates },
            error: null,
          }),
        }),
      } as any)

      const result = await AssetManager.updateAsset('asset-1', updates)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(expect.objectContaining(updates))
    })

    it('should handle update errors', async () => {
      const { supabase } = await import('@/lib/supabase/client')
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Update failed' },
          }),
        }),
      } as any)

      const result = await AssetManager.updateAsset('asset-1', { name: 'new-name' })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Update failed')
    })
  })

  describe('batchUpload', () => {
    it('should upload multiple files successfully', async () => {
      const files = [
        new File(['content1'], 'test1.jpg', { type: 'image/jpeg' }),
        new File(['content2'], 'test2.jpg', { type: 'image/jpeg' }),
      ]

      const { StorageService } = await import('../storage')
      const { MetadataExtractionService } = await import('../metadataExtraction')
      const { ThumbnailService } = await import('../thumbnail')
      const { supabase } = await import('@/lib/supabase/client')

      vi.mocked(StorageService.validateFile).mockReturnValue({
        isValid: true,
        errors: [],
        warnings: [],
        metadata: { name: 'test.jpg', type: 'image/jpeg', size: 1000 },
        securityFlags: [],
      })

      vi.mocked(StorageService.uploadFile).mockResolvedValue({
        success: true,
        data: {
          path: 'test/path',
          fullPath: 'full/test/path',
          publicUrl: 'https://example.com/test.jpg',
        },
      })

      vi.mocked(MetadataExtractionService.extractMetadata).mockResolvedValue({})
      vi.mocked(ThumbnailService.generateThumbnail).mockResolvedValue(null)

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'asset-1', name: 'test.jpg' },
              error: null,
            }),
          }),
        }),
      } as any)

      const result = await AssetManager.batchUpload({
        files,
        projectId: 'project-1',
        onProgress: vi.fn(),
      })

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)
      expect(result.data.every(asset => asset.success)).toBe(true)
    })

    it('should handle partial failures in batch upload', async () => {
      const files = [
        new File(['content1'], 'test1.jpg', { type: 'image/jpeg' }),
        new File(['content2'], 'test2.exe', { type: 'application/octet-stream' }),
      ]

      const { StorageService } = await import('../storage')

      vi.mocked(StorageService.validateFile)
        .mockReturnValueOnce({
          isValid: true,
          errors: [],
          warnings: [],
          metadata: { name: 'test1.jpg', type: 'image/jpeg', size: 1000 },
          securityFlags: [],
        })
        .mockReturnValueOnce({
          isValid: false,
          errors: ['File type not allowed'],
          warnings: [],
          metadata: { name: 'test2.exe', type: 'application/octet-stream', size: 1000 },
          securityFlags: [],
        })

      const result = await AssetManager.batchUpload({
        files,
        projectId: 'project-1',
        onProgress: vi.fn(),
      })

      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(2)
      expect(result.data[0].success).toBe(true)
      expect(result.data[1].success).toBe(false)
      expect(result.data[1].error).toBe('File type not allowed')
    })
  })
})