import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MetadataSearchService } from '../metadataSearch'

// Mock Supabase
const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  or: vi.fn(() => mockSupabase),
  in: vi.fn(() => mockSupabase),
  overlaps: vi.fn(() => mockSupabase),
  gte: vi.fn(() => mockSupabase),
  lte: vi.fn(() => mockSupabase),
  lt: vi.fn(() => mockSupabase),
  gt: vi.fn(() => mockSupabase),
  ilike: vi.fn(() => mockSupabase),
  not: vi.fn(() => mockSupabase),
  is: vi.fn(() => mockSupabase),
  filter: vi.fn(() => mockSupabase),
  order: vi.fn(() => mockSupabase),
  range: vi.fn(() => mockSupabase),
  limit: vi.fn(() => mockSupabase)
}

vi.mock('../supabase/client', () => ({
  supabase: mockSupabase
}))

describe('MetadataSearchService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('searchAssets', () => {
    it('should search assets with basic query', async () => {
      const mockAssets = [
        {
          id: '1',
          name: 'design.jpg',
          file_type: 'image/jpeg',
          tags: ['design', 'logo'],
          created_at: '2023-12-01',
          file_size: 1024000
        }
      ]

      mockSupabase.range.mockResolvedValue({
        data: mockAssets,
        error: null,
        count: 1
      })

      const result = await MetadataSearchService.searchAssets('proj-1', {
        query: 'design',
        limit: 10
      })

      expect(mockSupabase.from).toHaveBeenCalledWith('assets')
      expect(mockSupabase.eq).toHaveBeenCalledWith('project_id', 'proj-1')
      expect(result.assets).toEqual(mockAssets)
      expect(result.total).toBe(1)
    })

    it('should apply file type filters', async () => {
      mockSupabase.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      await MetadataSearchService.searchAssets('proj-1', {
        filters: {
          fileTypes: ['image/jpeg', 'image/png']
        }
      })

      expect(mockSupabase.in).toHaveBeenCalledWith('file_type', ['image/jpeg', 'image/png'])
    })

    it('should apply tag filters', async () => {
      mockSupabase.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      await MetadataSearchService.searchAssets('proj-1', {
        filters: {
          tags: ['design', 'logo']
        }
      })

      expect(mockSupabase.overlaps).toHaveBeenCalledWith('tags', ['design', 'logo'])
    })

    it('should apply date range filters', async () => {
      mockSupabase.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      await MetadataSearchService.searchAssets('proj-1', {
        filters: {
          dateRange: {
            start: '2023-01-01',
            end: '2023-12-31'
          }
        }
      })

      expect(mockSupabase.gte).toHaveBeenCalledWith('created_at', '2023-01-01')
      expect(mockSupabase.lte).toHaveBeenCalledWith('created_at', '2023-12-31')
    })

    it('should apply size range filters', async () => {
      mockSupabase.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      await MetadataSearchService.searchAssets('proj-1', {
        filters: {
          sizeRange: {
            min: 1000,
            max: 10000000
          }
        }
      })

      expect(mockSupabase.gte).toHaveBeenCalledWith('file_size', 1000)
      expect(mockSupabase.lte).toHaveBeenCalledWith('file_size', 10000000)
    })

    it('should apply dimension filters', async () => {
      mockSupabase.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      await MetadataSearchService.searchAssets('proj-1', {
        filters: {
          dimensions: {
            minWidth: 1920,
            maxWidth: 3840,
            minHeight: 1080,
            maxHeight: 2160
          }
        }
      })

      expect(mockSupabase.gte).toHaveBeenCalledWith('metadata->>width', 1920)
      expect(mockSupabase.lte).toHaveBeenCalledWith('metadata->>width', 3840)
      expect(mockSupabase.gte).toHaveBeenCalledWith('metadata->>height', 1080)
      expect(mockSupabase.lte).toHaveBeenCalledWith('metadata->>height', 2160)
    })

    it('should apply camera info filters', async () => {
      mockSupabase.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      await MetadataSearchService.searchAssets('proj-1', {
        filters: {
          cameraInfo: {
            make: 'Canon',
            model: 'EOS R5'
          }
        }
      })

      expect(mockSupabase.ilike).toHaveBeenCalledWith('metadata->camera_info->>make', '%Canon%')
      expect(mockSupabase.ilike).toHaveBeenCalledWith('metadata->camera_info->>model', '%EOS R5%')
    })

    it('should apply text content filter', async () => {
      mockSupabase.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      await MetadataSearchService.searchAssets('proj-1', {
        filters: {
          hasText: true
        }
      })

      expect(mockSupabase.not).toHaveBeenCalledWith('metadata->>extracted_text', 'is', null)
    })

    it('should apply resolution filters', async () => {
      mockSupabase.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      // Test high resolution filter
      await MetadataSearchService.searchAssets('proj-1', {
        filters: {
          resolution: 'high'
        }
      })

      expect(mockSupabase.or).toHaveBeenCalledWith('metadata->>width.gte.3840,metadata->>height.gte.2160')
    })

    it('should apply orientation filters', async () => {
      mockSupabase.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      // Test landscape orientation
      await MetadataSearchService.searchAssets('proj-1', {
        filters: {
          orientation: 'landscape'
        }
      })

      expect(mockSupabase.filter).toHaveBeenCalledWith('metadata->>width', 'gt', 'metadata->>height')
    })

    it('should apply sorting', async () => {
      mockSupabase.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      await MetadataSearchService.searchAssets('proj-1', {
        sortBy: 'name',
        sortOrder: 'asc'
      })

      expect(mockSupabase.order).toHaveBeenCalledWith('name', { ascending: true })
    })

    it('should apply pagination', async () => {
      mockSupabase.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      await MetadataSearchService.searchAssets('proj-1', {
        limit: 20,
        offset: 40
      })

      expect(mockSupabase.range).toHaveBeenCalledWith(40, 59) // offset to offset + limit - 1
    })

    it('should handle search errors gracefully', async () => {
      mockSupabase.range.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
        count: null
      })

      const result = await MetadataSearchService.searchAssets('proj-1')

      expect(result.assets).toEqual([])
      expect(result.total).toBe(0)
      expect(result.facets).toBeDefined()
    })

    it('should apply text search with multiple terms', async () => {
      mockSupabase.range.mockResolvedValue({
        data: [],
        error: null,
        count: 0
      })

      await MetadataSearchService.searchAssets('proj-1', {
        query: 'design logo'
      })

      // Should search in multiple fields for each term
      expect(mockSupabase.or).toHaveBeenCalled()
    })
  })

  describe('getFacets', () => {
    it('should calculate file type facets correctly', () => {
      const mockData = [
        { file_type: 'image/jpeg', file_size: 1000, tags: ['design'], created_at: '2023-12-01', metadata: {} },
        { file_type: 'image/jpeg', file_size: 2000, tags: ['logo'], created_at: '2023-12-02', metadata: {} },
        { file_type: 'image/png', file_size: 1500, tags: ['icon'], created_at: '2023-12-03', metadata: {} }
      ]

      const facets = MetadataSearchService['calculateFileTypeFacets'](mockData)

      expect(facets).toEqual([
        { type: 'image/jpeg', count: 2 },
        { type: 'image/png', count: 1 }
      ])
    })

    it('should calculate tag facets correctly', () => {
      const mockData = [
        { tags: ['design', 'logo'] },
        { tags: ['design', 'icon'] },
        { tags: ['logo'] },
        { tags: null }
      ]

      const facets = MetadataSearchService['calculateTagFacets'](mockData)

      expect(facets).toEqual([
        { tag: 'design', count: 2 },
        { tag: 'logo', count: 2 },
        { tag: 'icon', count: 1 }
      ])
    })

    it('should calculate size facets correctly', () => {
      const mockData = [
        { file_size: 500000 }, // small (< 1MB)
        { file_size: 5000000 }, // medium (1-10MB)
        { file_size: 15000000 }, // large (> 10MB)
        { file_size: 800000 } // small
      ]

      const facets = MetadataSearchService['calculateSizeFacets'](mockData)

      expect(facets).toEqual({
        small: 2,
        medium: 1,
        large: 1
      })
    })

    it('should calculate date facets correctly', () => {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
      const lastWeek = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000)
      const lastMonth = new Date(today.getTime() - 20 * 24 * 60 * 60 * 1000)
      const older = new Date(today.getTime() - 40 * 24 * 60 * 60 * 1000)

      const mockData = [
        { created_at: today.toISOString() },
        { created_at: yesterday.toISOString() },
        { created_at: lastWeek.toISOString() },
        { created_at: lastMonth.toISOString() },
        { created_at: older.toISOString() }
      ]

      const facets = MetadataSearchService['calculateDateFacets'](mockData)

      expect(facets.today).toBe(1)
      expect(facets.thisWeek).toBe(2) // yesterday + lastWeek
      expect(facets.thisMonth).toBe(1) // lastMonth
      expect(facets.older).toBe(1) // older
    })

    it('should calculate resolution facets correctly', () => {
      const mockData = [
        { metadata: { width: 800, height: 600 } }, // low
        { metadata: { width: 1920, height: 1080 } }, // medium
        { metadata: { width: 3840, height: 2160 } }, // high
        { metadata: { width: 1280, height: 720 } }, // low
        { metadata: {} } // no dimensions
      ]

      const facets = MetadataSearchService['calculateResolutionFacets'](mockData)

      expect(facets).toEqual({
        low: 2,
        medium: 1,
        high: 1
      })
    })
  })

  describe('getMetadataStatistics', () => {
    it('should calculate comprehensive statistics', async () => {
      const mockData = [
        {
          file_type: 'image/jpeg',
          file_size: 1000000,
          tags: ['design', 'logo'],
          created_at: '2023-12-01'
        },
        {
          file_type: 'image/png',
          file_size: 2000000,
          tags: ['design', 'icon'],
          created_at: '2023-12-02'
        },
        {
          file_type: 'image/jpeg',
          file_size: 1500000,
          tags: ['logo'],
          created_at: '2023-12-03'
        }
      ]

      mockSupabase.eq.mockResolvedValue({
        data: mockData,
        error: null
      })

      const stats = await MetadataSearchService.getMetadataStatistics('proj-1')

      expect(stats.totalAssets).toBe(3)
      expect(stats.totalSize).toBe(4500000)
      expect(stats.averageFileSize).toBe(1500000)
      expect(stats.fileTypeDistribution).toEqual({
        'image/jpeg': 2,
        'image/png': 1
      })
      expect(stats.mostUsedTags).toEqual([
        { tag: 'design', count: 2 },
        { tag: 'logo', count: 2 },
        { tag: 'icon', count: 1 }
      ])
    })

    it('should handle empty data', async () => {
      mockSupabase.eq.mockResolvedValue({
        data: null,
        error: null
      })

      const stats = await MetadataSearchService.getMetadataStatistics('proj-1')

      expect(stats.totalAssets).toBe(0)
      expect(stats.totalSize).toBe(0)
      expect(stats.averageFileSize).toBe(0)
      expect(stats.fileTypeDistribution).toEqual({})
      expect(stats.mostUsedTags).toEqual([])
    })

    it('should calculate upload trends', () => {
      const now = new Date('2023-12-05')
      vi.setSystemTime(now)

      const mockData = [
        { created_at: '2023-12-05T10:00:00Z' }, // today
        { created_at: '2023-12-05T15:00:00Z' }, // today
        { created_at: '2023-12-04T10:00:00Z' }, // yesterday
        { created_at: '2023-11-20T10:00:00Z' }  // outside range
      ]

      const trends = MetadataSearchService['calculateUploadTrends'](mockData)

      expect(trends).toHaveLength(30) // 30 days
      expect(trends.find(t => t.date === '2023-12-05')?.count).toBe(2)
      expect(trends.find(t => t.date === '2023-12-04')?.count).toBe(1)
      expect(trends.find(t => t.date === '2023-12-03')?.count).toBe(0)

      vi.useRealTimers()
    })
  })

  describe('string similarity', () => {
    it('should calculate similarity correctly', () => {
      const similarity1 = MetadataSearchService['calculateSimilarity']('design', 'designer')
      const similarity2 = MetadataSearchService['calculateSimilarity']('cat', 'dog')
      const similarity3 = MetadataSearchService['calculateSimilarity']('test', 'test')

      expect(similarity1).toBeGreaterThan(0.5) // Similar words
      expect(similarity2).toBeLessThan(0.5) // Different words
      expect(similarity3).toBe(1.0) // Identical words
    })

    it('should handle empty strings', () => {
      const similarity = MetadataSearchService['calculateSimilarity']('', '')
      expect(similarity).toBe(1.0)
    })
  })

  describe('Levenshtein distance', () => {
    it('should calculate edit distance correctly', () => {
      const distance1 = MetadataSearchService['levenshteinDistance']('kitten', 'sitting')
      const distance2 = MetadataSearchService['levenshteinDistance']('test', 'test')
      const distance3 = MetadataSearchService['levenshteinDistance']('abc', 'def')

      expect(distance1).toBe(3) // kitten -> sitting requires 3 edits
      expect(distance2).toBe(0) // identical strings
      expect(distance3).toBe(3) // completely different 3-char strings
    })
  })
})