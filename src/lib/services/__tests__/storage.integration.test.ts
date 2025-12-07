import { describe, it, expect } from 'vitest'
import { StorageService } from '../storage'

describe('StorageService Integration', () => {
  describe('validateFile', () => {
    it('should validate a valid JPEG file', () => {
      const file = new File(['test content'], 'test.jpg', { type: 'image/jpeg' })
      const result = StorageService.validateFile(file)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.metadata.name).toBe('test.jpg')
      expect(result.metadata.type).toBe('image/jpeg')
    })

    it('should reject oversized files', () => {
      const file = new File(['test'], 'large.jpg', { type: 'image/jpeg' })
      // Override the size property
      Object.defineProperty(file, 'size', { value: 200 * 1024 * 1024, writable: false })

      const result = StorageService.validateFile(file)

      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.includes('exceeds maximum limit'))).toBe(true)
    })

    it('should reject dangerous file extensions', () => {
      const file = new File(['test'], 'malware.exe', { type: 'application/octet-stream' })
      const result = StorageService.validateFile(file)

      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.includes('not allowed for security reasons'))).toBe(true)
    })

    it('should reject unsupported MIME types', () => {
      const file = new File(['test'], 'test.xyz', { type: 'application/unknown' })
      const result = StorageService.validateFile(file)

      expect(result.isValid).toBe(false)
      expect(result.errors.some(e => e.includes('not allowed'))).toBe(true)
    })

    it('should reject empty files', () => {
      const file = new File([], 'empty.txt', { type: 'text/plain' })
      const result = StorageService.validateFile(file)

      expect(result.isValid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })

  describe('generateFilePath', () => {
    it('should generate valid file path with folder', () => {
      const path = StorageService.generateFilePath('project123', 'folder456', 'test.jpg')
      
      expect(path).toMatch(/^projects\/project123\/folder456\/\d+_[a-z0-9]+_test\.jpg$/)
    })

    it('should generate valid file path without folder', () => {
      const path = StorageService.generateFilePath('project123', null, 'test.jpg')
      
      expect(path).toMatch(/^projects\/project123\/\d+_[a-z0-9]+_test\.jpg$/)
    })

    it('should sanitize special characters in file names', () => {
      const path = StorageService.generateFilePath('project123', null, 'test file@#$.jpg')
      
      // The sanitization replaces non-alphanumeric characters with underscores
      expect(path).toMatch(/test_file___\.jpg$/)
    })
  })
})