import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest'
import { StorageService } from '../storage'

// Mock Supabase
const mockSupabase = {
  storage: {
    from: vi.fn(),
    listBuckets: vi.fn(),
    createBucket: vi.fn()
  }
}

const mockSupabaseAdmin = {
  storage: {
    listBuckets: vi.fn(),
    createBucket: vi.fn()
  }
}

// Mock the supabase clients
vi.mock('../supabase/client', () => ({
  supabase: mockSupabase,
  supabaseAdmin: mockSupabaseAdmin
}))

describe('StorageService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('initializeBuckets', () => {
    it('should create bucket if it does not exist', async () => {
      mockSupabaseAdmin.storage.listBuckets.mockResolvedValue({
        data: [],
        error: null
      })
      
      mockSupabaseAdmin.storage.createBucket.mockResolvedValue({
        data: { name: 'assets' },
        error: null
      })

      await StorageService.initializeBuckets()

      expect(mockSupabaseAdmin.storage.listBuckets).toHaveBeenCalled()
      expect(mockSupabaseAdmin.storage.createBucket).toHaveBeenCalledWith('assets', {
        public: false,
        allowedMimeTypes: expect.any(Array),
        fileSizeLimit: expect.any(Number)
      })
    })

    it('should not create bucket if it already exists', async () => {
      mockSupabaseAdmin.storage.listBuckets.mockResolvedValue({
        data: [{ name: 'assets' }],
        error: null
      })

      await StorageService.initializeBuckets()

      expect(mockSupabaseAdmin.storage.listBuckets).toHaveBeenCalled()
      expect(mockSupabaseAdmin.storage.createBucket).not.toHaveBeenCalled()
    })

    it('should throw error if listing buckets fails', async () => {
      mockSupabaseAdmin.storage.listBuckets.mockResolvedValue({
        data: null,
        error: { message: 'Failed to list buckets' }
      })

      await expect(StorageService.initializeBuckets()).rejects.toThrow('Failed to list buckets')
    })
  })

  describe('validateFile', () => {
    it('should validate a valid file', () => {
      const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })
      const result = StorageService.validateFile(file)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.metadata).toEqual({
        size: file.size,
        type: file.type,
        name: file.name,
        lastModified: file.lastModified
      })
    })

    it('should reject file that is too large', () => {
      // Create a mock file that appears to be larger than the limit
      const file = new File(['test'], 'large.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 200 * 1024 * 1024 }) // 200MB

      const result = StorageService.validateFile(file)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain(expect.stringContaining('exceeds maximum limit'))
    })

    it('should reject file with invalid type', () => {
      const file = new File(['test'], 'test.exe', { type: 'application/x-executable' })
      const result = StorageService.validateFile(file)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain(expect.stringContaining('not allowed'))
    })

    it('should reject file with dangerous extension', () => {
      const file = new File(['test'], 'malware.exe', { type: 'application/octet-stream' })
      const result = StorageService.validateFile(file)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain(expect.stringContaining('not allowed for security reasons'))
    })

    it('should reject file with empty name', () => {
      const file = new File(['test'], '', { type: 'image/jpeg' })
      const result = StorageService.validateFile(file)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('File name is required')
    })
  })

  describe('generateFilePath', () => {
    it('should generate valid file path with folder', () => {
      const path = StorageService.generateFilePath('project123', 'folder456', 'test file.jpg')
      
      expect(path).toMatch(/^projects\/project123\/folder456\/\d+_[a-z0-9]+_test_file\.jpg$/)
    })

    it('should generate valid file path without folder', () => {
      const path = StorageService.generateFilePath('project123', null, 'test.jpg')
      
      expect(path).toMatch(/^projects\/project123\/\d+_[a-z0-9]+_test\.jpg$/)
    })

    it('should sanitize file name', () => {
      const path = StorageService.generateFilePath('project123', null, 'test file@#$.jpg')
      
      expect(path).toMatch(/test_file____\.jpg$/)
    })
  })

  describe('uploadFile', () => {
    const mockBucket = {
      upload: vi.fn(),
      getPublicUrl: vi.fn()
    }

    beforeEach(() => {
      mockSupabase.storage.from.mockReturnValue(mockBucket)
    })

    it('should upload small file successfully', async () => {
      const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })
      const mockProgress = vi.fn()

      mockBucket.upload.mockResolvedValue({
        data: { path: 'test/path', fullPath: 'full/test/path' },
        error: null
      })

      mockBucket.getPublicUrl.mockReturnValue({
        data: { publicUrl: 'https://example.com/test.jpg' }
      })

      const result = await StorageService.uploadFile({
        bucket: 'assets',
        path: 'test/path',
        file,
        onProgress: mockProgress
      })

      expect(result.success).toBe(true)
      expect(result.data).toEqual({
        path: 'test/path',
        fullPath: 'full/test/path',
        publicUrl: 'https://example.com/test.jpg'
      })
      expect(mockProgress).toHaveBeenCalledWith(0)
      expect(mockProgress).toHaveBeenCalledWith(100)
    })

    it('should handle upload failure', async () => {
      const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })

      mockBucket.upload.mockResolvedValue({
        data: null,
        error: { message: 'Upload failed' }
      })

      const result = await StorageService.uploadFile({
        bucket: 'assets',
        path: 'test/path',
        file
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Upload failed')
    })

    it('should reject invalid file', async () => {
      const file = new File(['test'], 'test.exe', { type: 'application/x-executable' })

      const result = await StorageService.uploadFile({
        bucket: 'assets',
        path: 'test/path',
        file
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('not allowed')
    })
  })

  describe('getSignedUrl', () => {
    const mockBucket = {
      createSignedUrl: vi.fn()
    }

    beforeEach(() => {
      mockSupabase.storage.from.mockReturnValue(mockBucket)
    })

    it('should generate signed URL successfully', async () => {
      mockBucket.createSignedUrl.mockResolvedValue({
        data: { signedUrl: 'https://example.com/signed-url' },
        error: null
      })

      const url = await StorageService.getSignedUrl('test/path', 3600)

      expect(url).toBe('https://example.com/signed-url')
      expect(mockBucket.createSignedUrl).toHaveBeenCalledWith('test/path', 3600)
    })

    it('should return null on error', async () => {
      mockBucket.createSignedUrl.mockResolvedValue({
        data: null,
        error: { message: 'Failed to create signed URL' }
      })

      const url = await StorageService.getSignedUrl('test/path')

      expect(url).toBeNull()
    })
  })

  describe('deleteFile', () => {
    const mockBucket = {
      remove: vi.fn()
    }

    beforeEach(() => {
      mockSupabase.storage.from.mockReturnValue(mockBucket)
    })

    it('should delete file successfully', async () => {
      mockBucket.remove.mockResolvedValue({
        data: null,
        error: null
      })

      const result = await StorageService.deleteFile('test/path')

      expect(result).toBe(true)
      expect(mockBucket.remove).toHaveBeenCalledWith(['test/path'])
    })

    it('should return false on error', async () => {
      mockBucket.remove.mockResolvedValue({
        data: null,
        error: { message: 'Delete failed' }
      })

      const result = await StorageService.deleteFile('test/path')

      expect(result).toBe(false)
    })
  })

  describe('listFiles', () => {
    const mockBucket = {
      list: vi.fn()
    }

    beforeEach(() => {
      mockSupabase.storage.from.mockReturnValue(mockBucket)
    })

    it('should list files successfully', async () => {
      const mockFiles = [
        { name: 'file1.jpg', size: 1024 },
        { name: 'file2.png', size: 2048 }
      ]

      mockBucket.list.mockResolvedValue({
        data: mockFiles,
        error: null
      })

      const result = await StorageService.listFiles('test/path')

      expect(result).toEqual(mockFiles)
      expect(mockBucket.list).toHaveBeenCalledWith('test/path')
    })

    it('should return null on error', async () => {
      mockBucket.list.mockResolvedValue({
        data: null,
        error: { message: 'List failed' }
      })

      const result = await StorageService.listFiles('test/path')

      expect(result).toBeNull()
    })
  })
})