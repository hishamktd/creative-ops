import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { FileValidationService } from '../fileValidation'

// Mock crypto.subtle for checksum calculation
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      digest: vi.fn().mockResolvedValue(new ArrayBuffer(32))
    }
  }
})

describe('FileValidationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('validateFile', () => {
    it('should validate a valid image file', async () => {
      const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })
      
      const result = await FileValidationService.validateFile(file)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.metadata.name).toBe('test.jpg')
      expect(result.metadata.type).toBe('image/jpeg')
      expect(result.metadata.extension).toBe('.jpg')
    })

    it('should reject file that is too large', async () => {
      const file = new File(['test'], 'large.jpg', { type: 'image/jpeg' })
      Object.defineProperty(file, 'size', { value: 200 * 1024 * 1024 }) // 200MB

      const result = await FileValidationService.validateFile(file)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain(expect.stringContaining('exceeds maximum'))
    })

    it('should reject file with blocked extension', async () => {
      const file = new File(['test'], 'malware.exe', { type: 'application/octet-stream' })
      
      const result = await FileValidationService.validateFile(file)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain(expect.stringContaining('not allowed for security reasons'))
      expect(result.securityFlags).toContainEqual(
        expect.objectContaining({
          type: 'suspicious_extension',
          severity: 'critical'
        })
      )
    })

    it('should reject file with invalid MIME type', async () => {
      const file = new File(['test'], 'test.xyz', { type: 'application/unknown' })
      
      const result = await FileValidationService.validateFile(file)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain(expect.stringContaining('not allowed'))
    })

    it('should reject empty file', async () => {
      const file = new File([], 'empty.txt', { type: 'text/plain' })
      
      const result = await FileValidationService.validateFile(file)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('File is empty')
    })

    it('should reject file with empty name', async () => {
      const file = new File(['test'], '', { type: 'text/plain' })
      
      const result = await FileValidationService.validateFile(file)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('File name is required')
    })

    it('should warn about suspicious characters in filename', async () => {
      const file = new File(['test'], 'test<script>.txt', { type: 'text/plain' })
      
      const result = await FileValidationService.validateFile(file)

      expect(result.warnings).toContain(expect.stringContaining('problematic characters'))
    })

    it('should reject file with excessively long name', async () => {
      const longName = 'a'.repeat(300) + '.txt'
      const file = new File(['test'], longName, { type: 'text/plain' })
      
      const result = await FileValidationService.validateFile(file)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain(expect.stringContaining('too long'))
    })

    it('should warn about reserved system names', async () => {
      const file = new File(['test'], 'CON.txt', { type: 'text/plain' })
      
      const result = await FileValidationService.validateFile(file)

      expect(result.warnings).toContain(expect.stringContaining('reserved system name'))
    })

    it('should detect MIME type and extension mismatch', async () => {
      const file = new File(['test'], 'image.jpg', { type: 'text/plain' })
      
      const result = await FileValidationService.validateFile(file)

      expect(result.securityFlags).toContainEqual(
        expect.objectContaining({
          type: 'suspicious_extension',
          severity: 'medium',
          message: expect.stringContaining("doesn't match MIME type")
        })
      )
    })

    it('should detect double extensions', async () => {
      const file = new File(['test'], 'document.pdf.exe', { type: 'application/octet-stream' })
      
      const result = await FileValidationService.validateFile(file)

      expect(result.securityFlags).toContainEqual(
        expect.objectContaining({
          type: 'suspicious_extension',
          severity: 'medium',
          message: expect.stringContaining('multiple extensions')
        })
      )
    })

    it('should handle files without MIME type', async () => {
      const file = new File(['test'], 'test.txt', { type: '' })
      
      const result = await FileValidationService.validateFile(file)

      expect(result.warnings).toContain('File MIME type could not be determined')
    })
  })

  describe('content validation', () => {
    it('should validate PDF content', async () => {
      const pdfContent = '%PDF-1.4\n%âãÏÓ\ntest content'
      const file = new File([pdfContent], 'test.pdf', { type: 'application/pdf' })
      
      const result = await FileValidationService.validateFile(file, {
        enableContentScanning: true
      })

      // Should not have content-related errors for valid PDF
      expect(result.errors.filter(e => e.includes('Invalid PDF'))).toHaveLength(0)
    })

    it('should reject invalid PDF content', async () => {
      const invalidPdfContent = 'This is not a PDF file'
      const file = new File([invalidPdfContent], 'test.pdf', { type: 'application/pdf' })
      
      const result = await FileValidationService.validateFile(file, {
        enableContentScanning: true
      })

      expect(result.errors).toContain('Invalid PDF file: missing PDF header')
    })

    it('should detect malicious script content in text files', async () => {
      const maliciousContent = '<script>alert("xss")</script>'
      const file = new File([maliciousContent], 'test.html', { type: 'text/html' })
      
      const result = await FileValidationService.validateFile(file, {
        enableContentScanning: true
      })

      expect(result.securityFlags).toContainEqual(
        expect.objectContaining({
          type: 'malicious_content',
          severity: 'high',
          message: expect.stringContaining('malicious script content')
        })
      )
    })

    it('should warn about very long lines in text files', async () => {
      const longLine = 'a'.repeat(15000)
      const file = new File([longLine], 'test.txt', { type: 'text/plain' })
      
      const result = await FileValidationService.validateFile(file, {
        enableContentScanning: true
      })

      expect(result.warnings).toContain(expect.stringContaining('very long lines'))
    })
  })

  describe('security scanning', () => {
    it('should detect executable signatures', async () => {
      // Create a buffer that starts with PE executable signature
      const peSignature = new Uint8Array([0x4d, 0x5a]) // "MZ" - PE executable header
      const file = new File([peSignature], 'test.jpg', { type: 'image/jpeg' })
      
      const result = await FileValidationService.validateFile(file, {
        enableVirusScanning: true
      })

      expect(result.securityFlags).toContainEqual(
        expect.objectContaining({
          type: 'malicious_content',
          severity: 'high',
          message: expect.stringContaining('malicious executable code')
        })
      )
    })

    it('should flag unusually small files', async () => {
      const tinyFile = new File(['x'], 'tiny.txt', { type: 'text/plain' })
      
      const result = await FileValidationService.validateFile(tinyFile, {
        enableVirusScanning: true
      })

      expect(result.securityFlags).toContainEqual(
        expect.objectContaining({
          type: 'size_anomaly',
          severity: 'low',
          message: expect.stringContaining('unusually small')
        })
      )
    })
  })

  describe('custom configuration', () => {
    it('should respect custom file size limits', async () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' })
      Object.defineProperty(file, 'size', { value: 1024 }) // 1KB
      
      const result = await FileValidationService.validateFile(file, {
        maxFileSize: 512 // 512 bytes limit
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain(expect.stringContaining('exceeds maximum'))
    })

    it('should respect custom allowed MIME types', async () => {
      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      
      const result = await FileValidationService.validateFile(file, {
        allowedMimeTypes: ['text/plain'] // Only allow text files
      })

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain(expect.stringContaining('not allowed'))
    })

    it('should respect disabled security scanning', async () => {
      const peSignature = new Uint8Array([0x4d, 0x5a])
      const file = new File([peSignature], 'test.jpg', { type: 'image/jpeg' })
      
      const result = await FileValidationService.validateFile(file, {
        enableVirusScanning: false
      })

      // Should not have virus-related security flags
      const virusFlags = result.securityFlags.filter(flag => flag.type === 'virus')
      expect(virusFlags).toHaveLength(0)
    })
  })
})