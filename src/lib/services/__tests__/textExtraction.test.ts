import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TextExtractionService } from '../textExtraction'

describe('TextExtractionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('extractText', () => {
    it('should extract text from plain text files', async () => {
      const textContent = 'This is a sample text document with multiple words.'
      const file = new File([textContent], 'document.txt', { type: 'text/plain' })
      
      // Mock file.text() method
      file.text = vi.fn().mockResolvedValue(textContent)
      
      const result = await TextExtractionService.extractText(file)
      
      expect(result.success).toBe(true)
      expect(result.text).toBe(textContent)
      expect(result.metadata?.wordCount).toBe(9)
      expect(result.metadata?.language).toBe('en')
    })

    it('should extract text from JSON files', async () => {
      const jsonContent = '{"name": "test", "description": "sample data"}'
      const file = new File([jsonContent], 'data.json', { type: 'application/json' })
      
      // Mock file.text() method
      file.text = vi.fn().mockResolvedValue(jsonContent)
      
      const result = await TextExtractionService.extractText(file)
      
      expect(result.success).toBe(true)
      expect(result.text).toBe(jsonContent)
    })

    it('should extract basic text from PDF files', async () => {
      const pdfContent = '%PDF-1.4\n(This is extracted text) Tj\n/Type /Page\n/Type /Page\nendobj'
      const file = new File([pdfContent], 'document.pdf', { type: 'application/pdf' })
      
      // Mock arrayBuffer
      file.arrayBuffer = vi.fn().mockResolvedValue(new TextEncoder().encode(pdfContent).buffer)
      
      const result = await TextExtractionService.extractText(file)
      
      expect(result.success).toBe(true)
      expect(result.text).toContain('This is extracted text')
      expect(result.metadata?.pages).toBe(2)
    })

    it('should handle RTF files', async () => {
      const rtfContent = '{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}} \\f0\\fs24 Hello World!}'
      const file = new File([rtfContent], 'document.rtf', { type: 'text/rtf' })
      
      // Mock file.text() method
      file.text = vi.fn().mockResolvedValue(rtfContent)
      
      const result = await TextExtractionService.extractText(file)
      
      expect(result.success).toBe(true)
      expect(result.text).toContain('Hello World!')
    })

    it('should return error for unsupported file types', async () => {
      const file = new File(['binary data'], 'image.jpg', { type: 'image/jpeg' })
      
      const result = await TextExtractionService.extractText(file)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('No text detected in image')
    })

    it('should handle extraction errors gracefully', async () => {
      const file = new File([''], 'document.txt', { type: 'text/plain' })
      
      // Mock text() to throw an error
      file.text = vi.fn().mockRejectedValue(new Error('File read error'))
      
      const result = await TextExtractionService.extractText(file)
      
      expect(result.success).toBe(false)
      expect(result.error).toBe('File read error')
    })
  })

  describe('PDF text extraction', () => {
    it('should extract text from PDF with parentheses format', async () => {
      const pdfContent = '(Hello World) Tj (This is a test) Tj'
      const file = new File([pdfContent], 'test.pdf', { type: 'application/pdf' })
      
      file.arrayBuffer = vi.fn().mockResolvedValue(new TextEncoder().encode(pdfContent).buffer)
      
      const result = await TextExtractionService.extractText(file)
      
      expect(result.success).toBe(true)
      expect(result.text).toContain('Hello World')
      expect(result.text).toContain('This is a test')
    })

    it('should estimate page count correctly', async () => {
      const pdfContent = '(Some text) Tj /Type /Page\n/Type /Page\n/Type /Page'
      const file = new File([pdfContent], 'multi-page.pdf', { type: 'application/pdf' })
      
      file.arrayBuffer = vi.fn().mockResolvedValue(new TextEncoder().encode(pdfContent).buffer)
      
      const result = await TextExtractionService.extractText(file)
      
      expect(result.metadata?.pages).toBe(3)
    })

    it('should handle PDFs without extractable text', async () => {
      const pdfContent = '%PDF-1.4\nBinary image data without text'
      const file = new File([pdfContent], 'image-only.pdf', { type: 'application/pdf' })
      
      file.arrayBuffer = vi.fn().mockResolvedValue(new TextEncoder().encode(pdfContent).buffer)
      
      const result = await TextExtractionService.extractText(file)
      
      expect(result.success).toBe(true) // Should succeed but with empty text
      expect(result.text).toBe('')
    })
  })

  describe('RTF text extraction', () => {
    it('should clean RTF control codes', async () => {
      const rtfContent = '{\\rtf1\\ansi\\deff0 \\f0\\fs24 Clean text without formatting}'
      const file = new File([rtfContent], 'document.rtf', { type: 'application/rtf' })
      
      // Mock file.text() method
      file.text = vi.fn().mockResolvedValue(rtfContent)
      
      const result = await TextExtractionService.extractText(file)
      
      expect(result.success).toBe(true)
      expect(result.text).toBe('Clean text without formatting')
      expect(result.text).not.toContain('\\rtf1')
      expect(result.text).not.toContain('\\f0')
    })

    it('should handle escaped characters in RTF', async () => {
      const rtfContent = "It\\'s a test with escaped quote"
      const file = new File([rtfContent], 'document.rtf', { type: 'text/rtf' })
      
      // Mock file.text() method
      file.text = vi.fn().mockResolvedValue(rtfContent)
      
      const result = await TextExtractionService.extractText(file)
      
      expect(result.success).toBe(true)
      expect(result.text).toContain("It's a test")
    })
  })

  describe('language detection', () => {
    it('should detect English text', () => {
      const text = 'The quick brown fox jumps over the lazy dog and runs to the forest'
      const language = TextExtractionService['detectLanguage'](text)
      
      expect(language).toBe('en')
    })

    it('should detect Spanish text', () => {
      const text = 'El perro y el gato están en la casa con el niño'
      const language = TextExtractionService['detectLanguage'](text)
      
      expect(language).toBe('es')
    })

    it('should detect French text', () => {
      const text = 'Le chat et le chien sont dans la maison avec le garçon'
      const language = TextExtractionService['detectLanguage'](text)
      
      expect(language).toBe('fr')
    })

    it('should return unknown for unrecognized languages', () => {
      const text = 'Random text without clear language patterns xyz abc'
      const language = TextExtractionService['detectLanguage'](text)
      
      expect(language).toBe('unknown')
    })

    it('should handle empty text', () => {
      const language = TextExtractionService['detectLanguage']('')
      
      expect(language).toBe('unknown')
    })
  })

  describe('keyword extraction', () => {
    it('should extract relevant keywords from text', () => {
      const text = 'The design process involves creating beautiful graphics and illustrations for the website project'
      const keywords = TextExtractionService.extractKeywords(text, 10)
      
      expect(keywords).toContain('design')
      expect(keywords).toContain('process')
      expect(keywords).toContain('creating')
      expect(keywords).toContain('beautiful')
      expect(keywords.length).toBeLessThanOrEqual(10)
    })

    it('should filter out stop words', () => {
      const text = 'The and or but in on at to for of with by from up about'
      const keywords = TextExtractionService.extractKeywords(text)
      
      expect(keywords).toEqual([])
    })

    it('should filter out short words', () => {
      const text = 'a an is it we go do be to of in on at by'
      const keywords = TextExtractionService.extractKeywords(text)
      
      expect(keywords).toEqual([])
    })

    it('should rank keywords by frequency', () => {
      const text = 'design design design graphics graphics illustration'
      const keywords = TextExtractionService.extractKeywords(text)
      
      expect(keywords[0]).toBe('design') // Most frequent should be first
      expect(keywords[1]).toBe('graphics')
      expect(keywords[2]).toBe('illustration')
    })

    it('should handle extraction errors gracefully', () => {
      const keywords = TextExtractionService.extractKeywords('')
      
      expect(keywords).toEqual([])
    })
  })

  describe('text summarization', () => {
    it('should return original text if shorter than max length', () => {
      const text = 'Short text'
      const summary = TextExtractionService.summarizeText(text, 100)
      
      expect(summary).toBe(text)
    })

    it('should truncate long text to max length', () => {
      const text = 'A'.repeat(300)
      const summary = TextExtractionService.summarizeText(text, 100)
      
      expect(summary.length).toBeLessThanOrEqual(103) // 100 + '...'
      expect(summary.endsWith('...')).toBe(true)
    })

    it('should create extractive summary from multiple sentences', () => {
      const text = 'This is the first sentence about design. This sentence talks about graphics and design elements. This is about something else entirely. The design process is important for graphics.'
      const summary = TextExtractionService.summarizeText(text, 150)
      
      expect(summary).toContain('first sentence')
      expect(summary).toContain('design')
      expect(summary.length).toBeLessThanOrEqual(153) // 150 + '...'
    })

    it('should handle text with few sentences', () => {
      const text = 'First sentence. Second sentence.'
      const summary = TextExtractionService.summarizeText(text, 100)
      
      expect(summary).toBe(text)
    })

    it('should handle summarization errors gracefully', () => {
      const text = 'A'.repeat(300)
      const summary = TextExtractionService.summarizeText(text, 100)
      
      expect(summary).toBeDefined()
      expect(summary.length).toBeLessThanOrEqual(103)
    })
  })

  describe('word counting', () => {
    it('should count words correctly', () => {
      const text = 'This is a test with five words'
      const count = TextExtractionService['countWords'](text)
      
      expect(count).toBe(7)
    })

    it('should handle multiple spaces', () => {
      const text = 'Word1    word2     word3'
      const count = TextExtractionService['countWords'](text)
      
      expect(count).toBe(3)
    })

    it('should handle empty text', () => {
      const count = TextExtractionService['countWords']('')
      
      expect(count).toBe(0)
    })

    it('should handle text with only spaces', () => {
      const count = TextExtractionService['countWords']('   ')
      
      expect(count).toBe(0)
    })
  })

  describe('stop word detection', () => {
    it('should identify common stop words', () => {
      expect(TextExtractionService['isStopWord']('the')).toBe(true)
      expect(TextExtractionService['isStopWord']('and')).toBe(true)
      expect(TextExtractionService['isStopWord']('or')).toBe(true)
      expect(TextExtractionService['isStopWord']('but')).toBe(true)
    })

    it('should not identify content words as stop words', () => {
      expect(TextExtractionService['isStopWord']('design')).toBe(false)
      expect(TextExtractionService['isStopWord']('graphics')).toBe(false)
      expect(TextExtractionService['isStopWord']('project')).toBe(false)
    })

    it('should be case insensitive', () => {
      expect(TextExtractionService['isStopWord']('THE')).toBe(true)
      expect(TextExtractionService['isStopWord']('And')).toBe(true)
    })
  })
})