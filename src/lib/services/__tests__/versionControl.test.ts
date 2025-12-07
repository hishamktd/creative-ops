import { describe, it, expect, vi, beforeEach } from 'vitest'

// Create a simple mock for testing
const createMockSupabase = () => ({
  rpc: vi.fn(),
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(),
        order: vi.fn(() => ({
          range: vi.fn()
        }))
      })),
      order: vi.fn(() => ({
        range: vi.fn()
      }))
    })),
    delete: vi.fn(() => ({
      eq: vi.fn()
    }))
  })),
  channel: vi.fn(() => ({
    on: vi.fn(() => ({
      subscribe: vi.fn()
    }))
  }))
})

describe('VersionControlService', () => {
  let service: any
  let mockSupabase: any

  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase = createMockSupabase()
    const { VersionControlService } = require('../versionControl')
    service = new VersionControlService(mockSupabase)
  })

  describe('createVersion', () => {
    it('should create a new version successfully', async () => {
      const mockVersionId = 'version-123'
      const mockVersion = {
        id: mockVersionId,
        asset_id: 'asset-123',
        version_number: 2,
        file_url: 'https://example.com/file.jpg',
        file_path: 'assets/file.jpg',
        file_size: 1024,
        checksum: 'abc123',
        changes_description: 'Updated image',
        metadata: {},
        uploaded_by: 'user-123',
        created_at: '2023-01-01T00:00:00Z'
      }

      mockSupabase.rpc.mockResolvedValueOnce({ data: mockVersionId, error: null })
      mockSupabase.from().select().eq().single.mockResolvedValueOnce({ 
        data: { ...mockVersion, uploader: { full_name: 'John Doe' } }, 
        error: null 
      })

      const result = await service.createVersion({
        assetId: 'asset-123',
        fileUrl: 'https://example.com/file.jpg',
        filePath: 'assets/file.jpg',
        fileSize: 1024,
        checksum: 'abc123',
        changesDescription: 'Updated image',
        metadata: {}
      })

      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_asset_version', {
        p_asset_id: 'asset-123',
        p_file_url: 'https://example.com/file.jpg',
        p_file_path: 'assets/file.jpg',
        p_file_size: 1024,
        p_checksum: 'abc123',
        p_changes_description: 'Updated image',
        p_metadata: {}
      })

      expect(result).toEqual({
        ...mockVersion,
        uploader_name: 'John Doe'
      })
    })

    it('should handle creation errors', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ 
        data: null, 
        error: { message: 'Creation failed' } 
      })

      await expect(service.createVersion({
        assetId: 'asset-123',
        fileUrl: 'https://example.com/file.jpg',
        filePath: 'assets/file.jpg',
        fileSize: 1024,
        checksum: 'abc123'
      })).rejects.toThrow('Failed to create asset version: Creation failed')
    })
  })

  describe('getVersionHistory', () => {
    it('should fetch version history successfully', async () => {
      const mockVersions = [
        {
          id: 'version-2',
          version_number: 2,
          uploader_name: 'John Doe',
          created_at: '2023-01-02T00:00:00Z'
        },
        {
          id: 'version-1',
          version_number: 1,
          uploader_name: 'Jane Smith',
          created_at: '2023-01-01T00:00:00Z'
        }
      ]

      mockSupabase.rpc.mockResolvedValueOnce({ data: mockVersions, error: null })

      const result = await service.getVersionHistory('asset-123')

      expect(mockSupabase.rpc).toHaveBeenCalledWith('get_asset_version_history', {
        p_asset_id: 'asset-123'
      })
      expect(result).toEqual(mockVersions)
    })

    it('should handle fetch errors', async () => {
      mockSupabase.rpc.mockResolvedValueOnce({ 
        data: null, 
        error: { message: 'Fetch failed' } 
      })

      await expect(service.getVersionHistory('asset-123'))
        .rejects.toThrow('Failed to fetch version history: Fetch failed')
    })
  })

  describe('compareVersions', () => {
    it('should compare two versions successfully', async () => {
      const oldVersion = {
        id: 'version-1',
        version_number: 1,
        file_size: 1000,
        metadata: { width: 100, height: 100 },
        uploader: { full_name: 'John Doe' }
      }

      const newVersion = {
        id: 'version-2',
        version_number: 2,
        file_size: 1200,
        metadata: { width: 120, height: 100 },
        uploader: { full_name: 'Jane Smith' }
      }

      mockSupabase.from().select().eq().single
        .mockResolvedValueOnce({ data: oldVersion, error: null })
        .mockResolvedValueOnce({ data: newVersion, error: null })

      const result = await service.compareVersions('version-1', 'version-2')

      expect(result.changes.file_size_diff).toBe(200)
      expect(result.changes.metadata_changes).toEqual({
        width: { old: 100, new: 120 }
      })
    })
  })

  describe('revertToVersion', () => {
    it('should revert to a previous version successfully', async () => {
      const targetVersion = {
        id: 'version-1',
        version_number: 1,
        file_url: 'https://example.com/old-file.jpg',
        file_path: 'assets/old-file.jpg',
        file_size: 1000,
        checksum: 'old123',
        metadata: {},
        uploader: { full_name: 'John Doe' }
      }

      const newVersionId = 'version-3'
      const newVersion = {
        id: newVersionId,
        version_number: 3,
        changes_description: 'Reverted to version 1',
        uploader: { full_name: 'Current User' }
      }

      mockSupabase.from().select().eq().single
        .mockResolvedValueOnce({ data: targetVersion, error: null })
        .mockResolvedValueOnce({ data: newVersion, error: null })
      
      mockSupabase.rpc.mockResolvedValueOnce({ data: newVersionId, error: null })

      const result = await service.revertToVersion('asset-123', 'version-1')

      expect(mockSupabase.rpc).toHaveBeenCalledWith('create_asset_version', {
        p_asset_id: 'asset-123',
        p_file_url: 'https://example.com/old-file.jpg',
        p_file_path: 'assets/old-file.jpg',
        p_file_size: 1000,
        p_checksum: 'old123',
        p_changes_description: 'Reverted to version 1',
        p_metadata: {}
      })
    })
  })

  describe('getVersionStats', () => {
    it('should calculate version statistics correctly', async () => {
      const mockVersions = [
        { file_size: 1000, created_at: '2023-01-01T00:00:00Z' },
        { file_size: 1200, created_at: '2023-01-02T00:00:00Z' },
        { file_size: 800, created_at: '2023-01-03T00:00:00Z' }
      ]

      mockSupabase.from().select().eq().order.mockResolvedValueOnce({ 
        data: mockVersions, 
        error: null 
      })

      const result = await service.getVersionStats('asset-123')

      expect(result).toEqual({
        totalVersions: 3,
        totalSizeBytes: 3000,
        averageSizeBytes: 1000,
        oldestVersion: '2023-01-01T00:00:00Z',
        newestVersion: '2023-01-03T00:00:00Z'
      })
    })

    it('should handle empty version history', async () => {
      mockSupabase.from().select().eq().order.mockResolvedValueOnce({ 
        data: [], 
        error: null 
      })

      const result = await service.getVersionStats('asset-123')

      expect(result).toEqual({
        totalVersions: 0,
        totalSizeBytes: 0,
        averageSizeBytes: 0,
        oldestVersion: '',
        newestVersion: ''
      })
    })
  })

  describe('subscribeToVersions', () => {
    it('should set up real-time subscription', () => {
      const mockCallback = vi.fn()
      const mockSubscription = { unsubscribe: vi.fn() }
      
      mockSupabase.channel().on().subscribe.mockReturnValue(mockSubscription)

      const result = service.subscribeToVersions('asset-123', mockCallback)

      expect(mockSupabase.channel).toHaveBeenCalledWith('asset_versions:asset-123')
      expect(result).toBe(mockSubscription)
    })
  })
})