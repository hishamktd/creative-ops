import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { TaggingService } from '../taggingService'

// Mock Supabase
const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  insert: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  delete: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  or: vi.fn(() => mockSupabase),
  ilike: vi.fn(() => mockSupabase),
  not: vi.fn(() => mockSupabase),
  order: vi.fn(() => mockSupabase),
  limit: vi.fn(() => mockSupabase),
  single: vi.fn(() => mockSupabase),
  overlaps: vi.fn(() => mockSupabase),
  rpc: vi.fn(() => mockSupabase),
  auth: {
    getUser: vi.fn()
  }
}

vi.mock('../supabase/client', () => ({
  supabase: mockSupabase
}))

describe('TaggingService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Default auth mock
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-123' } }
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('getProjectTags', () => {
    it('should fetch tags for a project', async () => {
      const mockTags = [
        { id: '1', name: 'design', usage_count: 10, project_id: 'proj-1' },
        { id: '2', name: 'logo', usage_count: 5, project_id: null }
      ]

      mockSupabase.single.mockResolvedValue({ data: mockTags, error: null })

      const result = await TaggingService.getProjectTags('proj-1')

      expect(mockSupabase.from).toHaveBeenCalledWith('asset_tags')
      expect(mockSupabase.or).toHaveBeenCalledWith('project_id.eq.proj-1,project_id.is.null')
      expect(result).toEqual(mockTags)
    })

    it('should handle database errors gracefully', async () => {
      mockSupabase.single.mockResolvedValue({ 
        data: null, 
        error: { message: 'Database error' } 
      })

      const result = await TaggingService.getProjectTags('proj-1')

      expect(result).toEqual([])
    })
  })

  describe('searchTags', () => {
    it('should search tags with query', async () => {
      const mockTags = [
        { id: '1', name: 'design', usage_count: 10 },
        { id: '2', name: 'designer', usage_count: 3 }
      ]

      mockSupabase.single.mockResolvedValue({ data: mockTags, error: null })
      mockSupabase.rpc.mockResolvedValue({ data: null, error: 'Not implemented' })

      const result = await TaggingService.searchTags('design', 'proj-1', 5)

      expect(mockSupabase.ilike).toHaveBeenCalledWith('name', '%design%')
      expect(result.tags).toEqual(mockTags)
      expect(result.suggestions).toContain('design')
      expect(result.suggestions).toContain('designer')
    })

    it('should include fuzzy matching suggestions', async () => {
      mockSupabase.single.mockResolvedValue({ data: [], error: null })
      mockSupabase.rpc.mockResolvedValue({ 
        data: [{ name: 'designer' }], 
        error: null 
      })

      const result = await TaggingService.searchTags('desing', 'proj-1')

      expect(result.suggestions).toContain('designer')
    })

    it('should fallback to basic suggestions when fuzzy matching fails', async () => {
      mockSupabase.single.mockResolvedValue({ data: [], error: null })
      mockSupabase.rpc.mockResolvedValue({ data: null, error: 'RPC failed' })

      const result = await TaggingService.searchTags('design', 'proj-1')

      expect(result.suggestions).toContain('design')
    })
  })

  describe('generateTagSuggestions', () => {
    it('should generate comprehensive tag suggestions', async () => {
      const file = new File([''], 'logo-design-v2.jpg', { type: 'image/jpeg' })
      const metadata = {
        original_name: 'logo-design-v2.jpg',
        mime_type: 'image/jpeg',
        width: 1920,
        height: 1080,
        camera_info: { make: 'Canon' }
      }

      // Mock similar assets query
      mockSupabase.single.mockResolvedValue({ 
        data: [
          { tags: ['branding', 'corporate'] },
          { tags: ['logo', 'identity'] }
        ], 
        error: null 
      })

      const suggestions = await TaggingService.generateTagSuggestions(
        file, 
        metadata, 
        'proj-1'
      )

      expect(suggestions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ tag: 'image', source: 'content' }),
          expect.objectContaining({ tag: 'jpeg', source: 'content' }),
          expect.objectContaining({ tag: 'landscape', source: 'content' }),
          expect.objectContaining({ tag: 'logo', source: 'filename' }),
          expect.objectContaining({ tag: 'v2', source: 'filename' }),
          expect.objectContaining({ tag: 'canon', source: 'metadata' })
        ])
      )
    })

    it('should filter out existing tags', async () => {
      const file = new File([''], 'image.jpg', { type: 'image/jpeg' })
      const metadata = { original_name: 'image.jpg', mime_type: 'image/jpeg' }
      const existingTags = ['image', 'jpeg']

      mockSupabase.single.mockResolvedValue({ data: [], error: null })

      const suggestions = await TaggingService.generateTagSuggestions(
        file, 
        metadata, 
        'proj-1', 
        existingTags
      )

      const tagNames = suggestions.map(s => s.tag)
      expect(tagNames).not.toContain('image')
      expect(tagNames).not.toContain('jpeg')
    })

    it('should limit suggestions to maximum count', async () => {
      const file = new File([''], 'test.jpg', { type: 'image/jpeg' })
      const metadata = { 
        original_name: 'test.jpg', 
        mime_type: 'image/jpeg',
        extracted_text: 'contract agreement terms conditions proposal quote estimate bid manual guide instructions specification'
      }

      mockSupabase.single.mockResolvedValue({ data: [], error: null })

      const suggestions = await TaggingService.generateTagSuggestions(
        file, 
        metadata, 
        'proj-1'
      )

      expect(suggestions.length).toBeLessThanOrEqual(10)
    })
  })

  describe('addTagsToAsset', () => {
    it('should add tags to an asset', async () => {
      const assetId = 'asset-123'
      const newTags = ['design', 'logo']
      
      // Mock asset fetch
      mockSupabase.single.mockResolvedValueOnce({
        data: { 
          tags: ['existing'], 
          project_id: 'proj-1' 
        },
        error: null
      })

      // Mock asset update
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null
      })

      // Mock tag usage update queries
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null
      })

      const result = await TaggingService.addTagsToAsset(assetId, newTags)

      expect(result.success).toBe(true)
      expect(result.tags).toEqual(['existing', 'design', 'logo'])
      expect(mockSupabase.update).toHaveBeenCalledWith({ 
        tags: ['existing', 'design', 'logo'] 
      })
    })

    it('should handle asset not found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Asset not found' }
      })

      const result = await TaggingService.addTagsToAsset('nonexistent', ['tag'])

      expect(result.success).toBe(false)
      expect(result.error).toBe('Asset not found')
    })

    it('should prevent duplicate tags', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { 
          tags: ['existing', 'design'], 
          project_id: 'proj-1' 
        },
        error: null
      })

      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null
      })

      const result = await TaggingService.addTagsToAsset('asset-123', ['design', 'logo'])

      expect(result.tags).toEqual(['existing', 'design', 'logo'])
      // Should not have duplicate 'design'
      expect(result.tags?.filter(tag => tag === 'design')).toHaveLength(1)
    })
  })

  describe('removeTagsFromAsset', () => {
    it('should remove specified tags from an asset', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { tags: ['design', 'logo', 'branding'] },
        error: null
      })

      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null
      })

      const result = await TaggingService.removeTagsFromAsset('asset-123', ['logo'])

      expect(result.success).toBe(true)
      expect(result.tags).toEqual(['design', 'branding'])
    })

    it('should handle removing non-existent tags gracefully', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { tags: ['design', 'logo'] },
        error: null
      })

      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null
      })

      const result = await TaggingService.removeTagsFromAsset('asset-123', ['nonexistent'])

      expect(result.success).toBe(true)
      expect(result.tags).toEqual(['design', 'logo'])
    })
  })

  describe('createTag', () => {
    it('should create a new tag', async () => {
      const newTag = {
        id: 'tag-123',
        name: 'design',
        project_id: 'proj-1',
        color: '#blue',
        description: 'Design related assets',
        usage_count: 0,
        created_by: 'user-123',
        created_at: '2023-01-01'
      }

      mockSupabase.single.mockResolvedValue({
        data: newTag,
        error: null
      })

      const result = await TaggingService.createTag(
        'Design',
        'proj-1',
        '#blue',
        'Design related assets'
      )

      expect(result).toEqual(newTag)
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        name: 'design', // Should be lowercase and trimmed
        project_id: 'proj-1',
        color: '#blue',
        description: 'Design related assets',
        usage_count: 0,
        created_by: 'user-123'
      })
    })

    it('should handle creation errors', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Duplicate tag name' }
      })

      const result = await TaggingService.createTag('design', 'proj-1')

      expect(result).toBeNull()
    })

    it('should handle unauthenticated user', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null }
      })

      const result = await TaggingService.createTag('design', 'proj-1')

      expect(result).toBeNull()
    })
  })

  describe('getTagStatistics', () => {
    it('should return comprehensive tag statistics', async () => {
      const mockTags = [
        { name: 'design', usage_count: 10, created_at: '2023-12-01' },
        { name: 'logo', usage_count: 8, created_at: '2023-12-02' },
        { name: 'branding', usage_count: 5, created_at: '2023-12-03' }
      ]

      mockSupabase.single.mockResolvedValue({
        data: mockTags,
        error: null
      })

      const stats = await TaggingService.getTagStatistics('proj-1')

      expect(stats.totalTags).toBe(3)
      expect(stats.mostUsedTags).toEqual([
        { name: 'design', count: 10 },
        { name: 'logo', count: 8 },
        { name: 'branding', count: 5 }
      ])
      expect(stats.recentTags).toEqual(['branding', 'logo', 'design'])
    })

    it('should handle empty tag data', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: null
      })

      const stats = await TaggingService.getTagStatistics('proj-1')

      expect(stats.totalTags).toBe(0)
      expect(stats.mostUsedTags).toEqual([])
      expect(stats.recentTags).toEqual([])
    })
  })

  describe('content-based tag extraction', () => {
    it('should extract tags from contract text', () => {
      const text = 'This contract agreement contains terms and conditions for the service'
      const tags = TaggingService['extractTagsFromText'](text)

      expect(tags).toContain('contract')
    })

    it('should extract tags from invoice text', () => {
      const text = 'Invoice #123 - Amount due: $500 for services rendered'
      const tags = TaggingService['extractTagsFromText'](text)

      expect(tags).toContain('invoice')
    })

    it('should extract tags from presentation text', () => {
      const text = 'Presentation slide deck for the quarterly review meeting'
      const tags = TaggingService['extractTagsFromText'](text)

      expect(tags).toContain('presentation')
    })

    it('should handle text without recognizable keywords', () => {
      const text = 'Random text without any specific keywords'
      const tags = TaggingService['extractTagsFromText'](text)

      expect(tags).toEqual([])
    })
  })
})