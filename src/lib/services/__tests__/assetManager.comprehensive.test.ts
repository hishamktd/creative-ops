import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AssetManager, EnhancedAsset } from '../assetManager'
import { mockSupabaseClient, generateMockAsset, generateMockUser } from '@/test/test-utils'

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  supabase: mockSupabaseClient
}))

// Mock storage service
const mockStorageService = {
  uploadFile: vi.fn(),
  deleteFile: vi.fn(),
  getSignedUrl: vi.fn(),
  generateThumbnail: vi.fn(),
}

vi.mock('./storage', () => ({
  StorageService: mockStorageService
}))

// Mock metadata extraction service
const mockMetadataService = {
  extractMetadata: vi.fn(),
  extractText: vi.fn(),
  generateThumbnail: vi.fn(),
}

vi.mock('./metadataExtraction', () => ({
  MetadataExtractionService: mockMetadataService
}))

describe('AssetManager - Comprehensive Tests', () => {
  const mockUser = generateMockUser()
  const mockAsset = generateMockAsset()

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mock responses
    mockSupabaseClient.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockAsset, error: null }),
          order: vi.fn().mockReturnValue({
            range: vi.fn().mockResolvedValue({ data: [mockAsset], error: null })
          })
        }),
        order: vi.fn().mockReturnValue({
          range: vi.fn().mockResolvedValue({ data: [mockAsset], error: null })
        })
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: mockAsset, error: null })
        })
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: mockAsset, error: null })
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: null, error: null })
      })
    })

    mockStorageService.uploadFile.mockResolvedValue({
      success: true,
      data: {
        path: 'test/path',
        publicUrl: 'https://example.com/test.jpg'
      }
    })

    mockMetadataService.extractMetadata.mockResolvedValue({
      width: 1920,
      height: 1080,
      fileSize: 1024000,
      mimeType: 'image/jpeg'
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Asset Creation', () => {
    it('should create asset with complete metadata extraction', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      
      const result = await AssetManager.createAsset({
        projectId: 'project-1',
        folderId: 'folder-1',
        file,
        name: 'Test Image',
        description: 'Test description',
        tags: ['test', 'image'],
        userId: mockUser.id
      })

      expect(mockMetadataService.extractMetadata).toHaveBeenCalledWith(file)
      expect(mockStorageService.uploadFile).toHaveBeenCalled()
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('assets')
      expect(result).toEqual(mockAsset)
    })

    it('should handle asset creation with automatic thumbnail generation', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      
      mockStorageService.generateThumbnail.mockResolvedValue({
        success: true,
        data: {
          thumbnailUrl: 'https://example.com/thumb.jpg',
          previewUrl: 'https://example.com/preview.jpg'
        }
      })

      await AssetManager.createAsset({
        projectId: 'project-1',
        file,
        userId: mockUser.id
      })

      expect(mockStorageService.generateThumbnail).toHaveBeenCalledWith(file)
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          thumbnail_url: 'https://example.com/thumb.jpg',
          preview_url: 'https://example.com/preview.jpg'
        })
      )
    })

    it('should handle asset creation failures gracefully', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      
      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      })

      await expect(AssetManager.createAsset({
        projectId: 'project-1',
        file,
        userId: mockUser.id
      })).rejects.toThrow('Database error')
    })

    it('should validate required fields', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })

      await expect(AssetManager.createAsset({
        projectId: '',
        file,
        userId: mockUser.id
      })).rejects.toThrow('Project ID is required')

      await expect(AssetManager.createAsset({
        projectId: 'project-1',
        file: null as any,
        userId: mockUser.id
      })).rejects.toThrow('File is required')
    })
  })

  describe('Asset Retrieval', () => {
    it('should get asset by ID with complete data', async () => {
      const result = await AssetManager.getAsset('asset-1')

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('assets')
      expect(result).toEqual(mockAsset)
    })

    it('should return null for non-existent asset', async () => {
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' } // Not found error
      })

      const result = await AssetManager.getAsset('non-existent')
      expect(result).toBeNull()
    })

    it('should get assets by project with filtering and pagination', async () => {
      const mockAssets = [mockAsset, { ...mockAsset, id: 'asset-2' }]
      
      mockSupabaseClient.from().select().order().range.mockResolvedValue({
        data: mockAssets,
        error: null
      })

      const result = await AssetManager.getAssetsByProject('project-1', {
        folderId: 'folder-1',
        fileTypes: ['image/jpeg'],
        tags: ['test'],
        limit: 10,
        offset: 0,
        sortBy: 'created_at',
        sortOrder: 'desc'
      })

      expect(result).toEqual(mockAssets)
      expect(mockSupabaseClient.from().select().order().range).toHaveBeenCalledWith(0, 9)
    })

    it('should search assets with full-text search', async () => {
      const searchResults = [mockAsset]
      
      mockSupabaseClient.from().select().order().range.mockResolvedValue({
        data: searchResults,
        error: null
      })

      const result = await AssetManager.searchAssets('project-1', {
        query: 'test image',
        fileTypes: ['image/*'],
        dateRange: {
          start: '2024-01-01',
          end: '2024-12-31'
        }
      })

      expect(result).toEqual(searchResults)
    })
  })

  describe('Asset Updates', () => {
    it('should update asset metadata', async () => {
      const updates = {
        name: 'Updated Name',
        description: 'Updated description',
        tags: ['updated', 'test']
      }

      const result = await AssetManager.updateAsset('asset-1', updates)

      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith(
        expect.objectContaining(updates)
      )
      expect(result).toEqual(mockAsset)
    })

    it('should increment access count when asset is accessed', async () => {
      await AssetManager.recordAssetAccess('asset-1', mockUser.id)

      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith({
        access_count: expect.any(Number),
        last_accessed_at: expect.any(String)
      })
    })

    it('should handle concurrent access count updates', async () => {
      // Simulate multiple concurrent access recordings
      const promises = Array.from({ length: 5 }, () => 
        AssetManager.recordAssetAccess('asset-1', mockUser.id)
      )

      await Promise.all(promises)

      // Should handle race conditions gracefully
      expect(mockSupabaseClient.from().update).toHaveBeenCalledTimes(5)
    })
  })

  describe('Asset Deletion', () => {
    it('should delete asset and associated files', async () => {
      mockStorageService.deleteFile.mockResolvedValue(true)

      const result = await AssetManager.deleteAsset('asset-1')

      expect(mockStorageService.deleteFile).toHaveBeenCalledWith(mockAsset.file_path)
      expect(mockSupabaseClient.from().delete).toHaveBeenCalled()
      expect(result).toBe(true)
    })

    it('should handle storage deletion failures gracefully', async () => {
      mockStorageService.deleteFile.mockResolvedValue(false)

      // Should still delete database record even if storage fails
      const result = await AssetManager.deleteAsset('asset-1')

      expect(mockSupabaseClient.from().delete).toHaveBeenCalled()
      expect(result).toBe(true) // Database deletion succeeded
    })

    it('should delete multiple assets in batch', async () => {
      const assetIds = ['asset-1', 'asset-2', 'asset-3']
      
      mockSupabaseClient.from().delete().eq.mockResolvedValue({
        data: null,
        error: null
      })

      const result = await AssetManager.deleteAssets(assetIds)

      expect(mockSupabaseClient.from().delete().eq).toHaveBeenCalledWith(
        'id',
        assetIds
      )
      expect(result).toBe(true)
    })
  })

  describe('Version Control', () => {
    it('should create new version of existing asset', async () => {
      const file = new File(['updated content'], 'test-v2.jpg', { type: 'image/jpeg' })
      const newVersion = { ...mockAsset, version: 2, id: 'asset-1-v2' }
      
      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: newVersion,
        error: null
      })

      const result = await AssetManager.createAssetVersion('asset-1', {
        file,
        changeDescription: 'Updated design',
        userId: mockUser.id
      })

      expect(result.version).toBe(2)
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 2,
          change_description: 'Updated design'
        })
      )
    })

    it('should get version history for asset', async () => {
      const versions = [
        { ...mockAsset, version: 1 },
        { ...mockAsset, version: 2, id: 'asset-1-v2' }
      ]
      
      mockSupabaseClient.from().select().eq().order.mockResolvedValue({
        data: versions,
        error: null
      })

      const result = await AssetManager.getAssetVersions('asset-1')

      expect(result).toEqual(versions)
      expect(mockSupabaseClient.from().select().eq().order).toHaveBeenCalledWith(
        'version',
        { ascending: false }
      )
    })

    it('should restore previous version', async () => {
      const previousVersion = { ...mockAsset, version: 1 }
      const restoredVersion = { ...mockAsset, version: 3, id: 'asset-1-v3' }
      
      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({ data: previousVersion, error: null })
      
      mockSupabaseClient.from().insert().select().single
        .mockResolvedValueOnce({ data: restoredVersion, error: null })

      const result = await AssetManager.restoreAssetVersion('asset-1', 1, mockUser.id)

      expect(result.version).toBe(3)
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 3,
          change_description: 'Restored from version 1'
        })
      )
    })
  })

  describe('Collaboration Features', () => {
    it('should add comment to asset', async () => {
      const comment = {
        id: 'comment-1',
        asset_id: 'asset-1',
        user_id: mockUser.id,
        content: 'Great work!',
        created_at: new Date().toISOString()
      }
      
      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: comment,
        error: null
      })

      const result = await AssetManager.addComment('asset-1', {
        content: 'Great work!',
        userId: mockUser.id
      })

      expect(result).toEqual(comment)
    })

    it('should get comments for asset with user details', async () => {
      const comments = [{
        id: 'comment-1',
        content: 'Great work!',
        user: mockUser,
        created_at: new Date().toISOString()
      }]
      
      mockSupabaseClient.from().select.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: comments, error: null })
        })
      })

      const result = await AssetManager.getAssetComments('asset-1')

      expect(result).toEqual(comments)
    })

    it('should set asset approval status', async () => {
      await AssetManager.setAssetApproval('asset-1', {
        status: 'approved',
        approverId: mockUser.id,
        comments: 'Looks good!'
      })

      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith({
        approval_status: 'approved',
        approved_by: mockUser.id,
        approved_at: expect.any(String),
        approval_comments: 'Looks good!'
      })
    })
  })

  describe('Folder Management', () => {
    it('should move asset to different folder', async () => {
      const result = await AssetManager.moveAsset('asset-1', 'new-folder-id')

      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith({
        folder_id: 'new-folder-id',
        updated_at: expect.any(String)
      })
      expect(result).toEqual(mockAsset)
    })

    it('should move multiple assets to folder', async () => {
      const assetIds = ['asset-1', 'asset-2', 'asset-3']
      
      const result = await AssetManager.moveAssets(assetIds, 'new-folder-id')

      expect(mockSupabaseClient.from().update().eq).toHaveBeenCalledWith(
        'id',
        assetIds
      )
      expect(result).toBe(true)
    })

    it('should get assets in folder with nested structure', async () => {
      const folderAssets = [mockAsset]
      
      mockSupabaseClient.from().select().eq().order.mockResolvedValue({
        data: folderAssets,
        error: null
      })

      const result = await AssetManager.getAssetsInFolder('folder-1')

      expect(result).toEqual(folderAssets)
      expect(mockSupabaseClient.from().select().eq).toHaveBeenCalledWith(
        'folder_id',
        'folder-1'
      )
    })
  })

  describe('Tagging System', () => {
    it('should add tags to asset', async () => {
      const newTags = ['design', 'mockup', 'final']
      
      await AssetManager.addTags('asset-1', newTags)

      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith({
        tags: expect.arrayContaining(newTags),
        updated_at: expect.any(String)
      })
    })

    it('should remove tags from asset', async () => {
      const tagsToRemove = ['draft']
      
      await AssetManager.removeTags('asset-1', tagsToRemove)

      expect(mockSupabaseClient.from().update).toHaveBeenCalled()
    })

    it('should get popular tags for project', async () => {
      const popularTags = [
        { tag: 'design', count: 15 },
        { tag: 'mockup', count: 10 },
        { tag: 'final', count: 8 }
      ]
      
      // Mock raw SQL query for tag aggregation
      mockSupabaseClient.rpc = vi.fn().mockResolvedValue({
        data: popularTags,
        error: null
      })

      const result = await AssetManager.getPopularTags('project-1', 10)

      expect(result).toEqual(popularTags)
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        'get_popular_tags',
        { project_id: 'project-1', limit_count: 10 }
      )
    })
  })

  describe('Performance Optimization', () => {
    it('should handle large batch operations efficiently', async () => {
      const assetIds = Array.from({ length: 1000 }, (_, i) => `asset-${i}`)
      
      const startTime = performance.now()
      await AssetManager.deleteAssets(assetIds)
      const endTime = performance.now()
      
      // Should complete batch operation in reasonable time
      expect(endTime - startTime).toBeLessThan(1000)
    })

    it('should implement proper caching for frequently accessed assets', async () => {
      // First call
      await AssetManager.getAsset('asset-1')
      
      // Second call should use cache
      await AssetManager.getAsset('asset-1')
      
      // Should only make one database call due to caching
      expect(mockSupabaseClient.from().select().eq().single).toHaveBeenCalledTimes(1)
    })

    it('should paginate large result sets', async () => {
      const largeResultSet = Array.from({ length: 100 }, (_, i) => ({
        ...mockAsset,
        id: `asset-${i}`
      }))
      
      mockSupabaseClient.from().select().order().range.mockResolvedValue({
        data: largeResultSet.slice(0, 20),
        error: null
      })

      const result = await AssetManager.getAssetsByProject('project-1', {
        limit: 20,
        offset: 0
      })

      expect(result).toHaveLength(20)
      expect(mockSupabaseClient.from().select().order().range).toHaveBeenCalledWith(0, 19)
    })
  })

  describe('Error Handling and Resilience', () => {
    it('should handle database connection failures', async () => {
      mockSupabaseClient.from().select().eq().single.mockRejectedValue(
        new Error('Connection timeout')
      )

      await expect(AssetManager.getAsset('asset-1')).rejects.toThrow('Connection timeout')
    })

    it('should retry failed operations with exponential backoff', async () => {
      let callCount = 0
      mockSupabaseClient.from().insert().select().single.mockImplementation(() => {
        callCount++
        if (callCount < 3) {
          return Promise.reject(new Error('Temporary failure'))
        }
        return Promise.resolve({ data: mockAsset, error: null })
      })

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      
      const result = await AssetManager.createAsset({
        projectId: 'project-1',
        file,
        userId: mockUser.id
      })

      expect(callCount).toBe(3) // Should retry twice before succeeding
      expect(result).toEqual(mockAsset)
    })

    it('should validate data integrity', async () => {
      const invalidAssetData = {
        ...mockAsset,
        file_size: -1, // Invalid file size
        created_at: 'invalid-date'
      }
      
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: invalidAssetData,
        error: null
      })

      await expect(AssetManager.getAsset('asset-1')).rejects.toThrow('Invalid asset data')
    })
  })
})