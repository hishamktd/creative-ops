import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MetadataExtractionService } from '../metadataExtraction'

// Mock DOM APIs
global.Image = class {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  naturalWidth = 1920
  naturalHeight = 1080
  
  set src(value: string) {
    setTimeout(() => {
      if (this.onload) this.onload()
    }, 0)
  }
} as any

global.URL = {
  createObjectURL: vi.fn(() => 'blob:mock-url'),
  revokeObjectURL: vi.fn()
} as any

// Mock FileReader
global.FileReader = class {
  onload: ((event: any) => void) | null = null
  result: string | ArrayBuffer | null = null
  
  readAsDataURL(file: File) {
    setTimeout(() => {
      this.result = 'data:image/jpeg;base64,mock-data'
      if (this.onload) {
        this.onload({ target: { result: this.result } })
      }
    }, 0)
  }
} as any

describe('MetadataExtractionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('extractMetadata', () => {
    it('should extract basic metadata for any file', async () => {
      const file = new File(['test content'], 'test.txt', { type: 'text/plain' })
      
      const result = await MetadataExtractionService.extractMetadata(file)
      
      expect(result.success).toBe(true)
      expect(result.metadata.original_name).toBe('test.txt')
      expect(result.metadata.mime_type).toBe('text/plain')
    })

    it('should extract image metadata with dimensions', async () => {
      const file = new File(['fake image data'], 'image.jpg', { type: 'image/jpeg' })
      
      const result = await MetadataExtractionService.extractMetadata(file)
      
      expect(result.success).toBe(true)
      expect(result.metadata.width).toBe(1920)
      expect(result.metadata.height).toBe(1080)
      expect(result.metadata.mime_type).toBe('image/jpeg')
    })

    it('should handle video files', async () => {
      // Mock video element
      const mockVideo = {
        onloadedmetadata: null as (() => void) | null,
        onerror: null as (() => void) | null,
        videoWidth: 1280,
        videoHeight: 720,
        duration: 120,
        src: '',
        load: vi.fn()
      }

      global.document = {
        createElement: vi.fn((tag: string) => {
          if (tag === 'video') return mockVideo
          return {}
        })
      } as any

      const file = new File(['fake video data'], 'video.mp4', { type: 'video/mp4' })
      
      // Trigger the video metadata load
      setTimeout(() => {
        if (mockVideo.onloadedmetadata) mockVideo.onloadedmetadata()
      }, 0)
      
      const result = await MetadataExtractionService.extractMetadata(file)
      
      expect(result.success).toBe(true)
      expect(result.metadata.width).toBe(1280)
      expect(result.metadata.height).toBe(720)
      expect(result.metadata.duration).toBe(120)
    })

    it('should extract text content from text files', async () => {
      const textContent = 'This is test content for extraction'
      const file = new File([textContent], 'document.txt', { type: 'text/plain' })
      
      // Mock file.text() method
      file.text = vi.fn().mockResolvedValue(textContent)
      
      const result = await MetadataExtractionService.extractMetadata(file)
      
      expect(result.success).toBe(true)
      expect(result.metadata.extracted_text).toBe(textContent)
    })

    it('should handle PDF files', async () => {
      const pdfContent = '%PDF-1.4\n(This is text content) Tj\n/Type /Page\n/Type /Page\nendobj'
      const file = new File([pdfContent], 'document.pdf', { type: 'application/pdf' })
      
      // Mock arrayBuffer method
      file.arrayBuffer = vi.fn().mockResolvedValue(new TextEncoder().encode(pdfContent).buffer)
      
      const result = await MetadataExtractionService.extractMetadata(file)
      
      expect(result.success).toBe(true)
      expect(result.metadata.pages).toBe(2) // Should detect 2 pages
      expect(result.metadata.extracted_text).toContain('This is text content')
    })

    it('should handle extraction errors gracefully', async () => {
      const file = new File([''], 'test.txt', { type: 'text/plain' })
      
      // Mock file.text() to throw an error
      file.text = vi.fn().mockRejectedValue(new Error('Read error'))
      
      const result = await MetadataExtractionService.extractMetadata(file)
      
      expect(result.success).toBe(true) // Should still succeed with basic metadata
      expect(result.metadata.original_name).toBe('test.txt')
      expect(result.metadata.mime_type).toBe('text/plain')
    })
  })

  describe('generateAutoTags', () => {
    it('should generate tags based on file type', () => {
      const file = new File([''], 'image.jpg', { type: 'image/jpeg' })
      const metadata = { original_name: 'image.jpg', mime_type: 'image/jpeg' }
      
      const tags = MetadataExtractionService.generateAutoTags(file, metadata)
      
      expect(tags).toContain('image')
      expect(tags).toContain('jpeg')
    })

    it('should generate dimension-based tags', () => {
      const file = new File([''], 'photo.jpg', { type: 'image/jpeg' })
      const metadata = {
        original_name: 'photo.jpg',
        mime_type: 'image/jpeg',
        width: 4000,
        height: 2000 // 8 megapixels, aspect ratio 2.0 > 1.5 = landscape
      }
      
      const tags = MetadataExtractionService.generateAutoTags(file, metadata)
      
      expect(tags).toContain('landscape')
      // 8 megapixels is not > 10, so no high-res tag
      expect(tags).not.toContain('high-res')
    })

    it('should generate tags for square images', () => {
      const file = new File([''], 'square.jpg', { type: 'image/jpeg' })
      const metadata = {
        original_name: 'square.jpg',
        mime_type: 'image/jpeg',
        width: 1000,
        height: 1000
      }
      
      const tags = MetadataExtractionService.generateAutoTags(file, metadata)
      
      expect(tags).toContain('square')
    })

    it('should generate tags for portrait images', () => {
      const file = new File([''], 'portrait.jpg', { type: 'image/jpeg' })
      const metadata = {
        original_name: 'portrait.jpg',
        mime_type: 'image/jpeg',
        width: 600,
        height: 1000
      }
      
      const tags = MetadataExtractionService.generateAutoTags(file, metadata)
      
      expect(tags).toContain('portrait')
    })

    it('should generate camera-based tags', () => {
      const file = new File([''], 'photo.jpg', { type: 'image/jpeg' })
      const metadata = {
        original_name: 'photo.jpg',
        mime_type: 'image/jpeg',
        camera_info: {
          make: 'Canon'
        }
      }
      
      const tags = MetadataExtractionService.generateAutoTags(file, metadata)
      
      expect(tags).toContain('canon')
    })

    it('should generate content-based tags from extracted text', () => {
      const file = new File([''], 'document.pdf', { type: 'application/pdf' })
      const metadata = {
        original_name: 'document.pdf',
        mime_type: 'application/pdf',
        extracted_text: 'This is a contract agreement with terms and conditions'
      }
      
      const tags = MetadataExtractionService.generateAutoTags(file, metadata)
      
      expect(tags).toContain('document')
      expect(tags).toContain('pdf')
      expect(tags).toContain('contract')
    })

    it('should remove duplicate tags', () => {
      const file = new File([''], 'image.jpg', { type: 'image/jpeg' })
      const metadata = {
        original_name: 'image.jpg',
        mime_type: 'image/jpeg',
        extracted_text: 'image photo picture'
      }
      
      const tags = MetadataExtractionService.generateAutoTags(file, metadata)
      
      // Should not have duplicate 'image' tags
      const imageTags = tags.filter(tag => tag === 'image')
      expect(imageTags).toHaveLength(1)
    })
  })

  describe('EXIF extraction', () => {
    it('should handle files without EXIF data', async () => {
      const file = new File(['not-a-jpeg'], 'image.png', { type: 'image/png' })
      
      // Mock arrayBuffer to return non-JPEG data
      file.arrayBuffer = vi.fn().mockResolvedValue(new ArrayBuffer(10))
      
      const result = await MetadataExtractionService.extractMetadata(file)
      
      expect(result.success).toBe(true)
      expect(result.metadata.camera_info).toBeUndefined()
    })

    it('should handle JPEG files with basic EXIF structure', async () => {
      // Create a minimal JPEG with EXIF marker
      const jpegHeader = new Uint8Array([
        0xFF, 0xD8, // JPEG SOI
        0xFF, 0xE1, // EXIF marker
        0x00, 0x16, // Length (22 bytes)
        0x45, 0x78, 0x69, 0x66, 0x00, 0x00, // "Exif\0\0"
        0x49, 0x49, // Little endian
        0x2A, 0x00, // TIFF magic
        0x08, 0x00, 0x00, 0x00, // IFD offset
        0x00, 0x00 // No IFD entries
      ])
      
      const file = new File([jpegHeader], 'photo.jpg', { type: 'image/jpeg' })
      file.arrayBuffer = vi.fn().mockResolvedValue(jpegHeader.buffer)
      
      const result = await MetadataExtractionService.extractMetadata(file)
      
      expect(result.success).toBe(true)
      // Should not crash on malformed EXIF
    })
  })
})