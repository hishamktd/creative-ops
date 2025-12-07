export interface TextExtractionResult {
  success: boolean
  text: string
  metadata?: {
    pages?: number
    wordCount?: number
    language?: string
  }
  error?: string
}

export interface OCRResult {
  success: boolean
  text: string
  confidence?: number
  error?: string
}

export class TextExtractionService {
  /**
   * Extract text from various file types
   */
  static async extractText(file: File): Promise<TextExtractionResult> {
    try {
      if (file.type === 'application/pdf') {
        return await this.extractFromPDF(file)
      } else if (file.type.startsWith('text/') || TextExtractionService.isTextFile(file.type)) {
        return await this.extractFromTextFile(file)
      } else if (this.isDocumentType(file.type)) {
        return await this.extractFromDocument(file)
      } else if (file.type.startsWith('image/')) {
        return await this.extractFromImage(file)
      } else {
        return {
          success: false,
          text: '',
          error: 'Unsupported file type for text extraction'
        }
      }
    } catch (error) {
      console.error('Text extraction failed:', error)
      return {
        success: false,
        text: '',
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Extract text from PDF files
   */
  private static async extractFromPDF(file: File): Promise<TextExtractionResult> {
    try {
      const arrayBuffer = await file.arrayBuffer()
      
      // Basic PDF text extraction without external libraries
      // In production, use pdf-js or similar library for better results
      const text = await this.basicPDFTextExtraction(arrayBuffer)
      
      if (!text) {
        return {
          success: false,
          text: '',
          error: 'No text found in PDF'
        }
      }

      // Count pages (basic estimation)
      const pageCount = this.estimatePDFPages(arrayBuffer)
      const wordCount = this.countWords(text)

      return {
        success: true,
        text,
        metadata: {
          pages: pageCount,
          wordCount,
          language: this.detectLanguage(text)
        }
      }
    } catch (error) {
      console.error('PDF text extraction failed:', error)
      return {
        success: false,
        text: '',
        error: error instanceof Error ? error.message : 'PDF extraction failed'
      }
    }
  }

  /**
   * Basic PDF text extraction (simplified implementation)
   */
  private static async basicPDFTextExtraction(arrayBuffer: ArrayBuffer): Promise<string> {
    try {
      // Convert to string for basic text pattern matching
      const uint8Array = new Uint8Array(arrayBuffer)
      const binaryString = Array.from(uint8Array)
        .map(byte => String.fromCharCode(byte))
        .join('')

      // Extract text between parentheses (common PDF text encoding)
      const textMatches = binaryString.match(/\(([^)]+)\)/g)
      if (textMatches) {
        const extractedText = textMatches
          .map(match => match.slice(1, -1))
          .join(' ')
          .replace(/\\[nrt]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()

        if (extractedText.length > 10) {
          return extractedText
        }
      }

      // Try to extract readable ASCII text
      const readableText = binaryString.match(/[A-Za-z0-9\s.,!?;:'"()-]{20,}/g)
      if (readableText) {
        return readableText
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 10000)
      }

      return ''
    } catch (error) {
      console.warn('Basic PDF extraction failed:', error)
      return ''
    }
  }

  /**
   * Estimate PDF page count
   */
  private static estimatePDFPages(arrayBuffer: ArrayBuffer): number {
    try {
      const uint8Array = new Uint8Array(arrayBuffer)
      const binaryString = Array.from(uint8Array)
        .map(byte => String.fromCharCode(byte))
        .join('')

      // Count page objects
      const pageMatches = binaryString.match(/\/Type\s*\/Page\b/g)
      return pageMatches ? pageMatches.length : 1
    } catch {
      return 1
    }
  }

  /**
   * Extract text from plain text files
   */
  private static async extractFromTextFile(file: File): Promise<TextExtractionResult> {
    try {
      const text = await file.text()
      const wordCount = this.countWords(text)

      return {
        success: true,
        text: text.substring(0, 50000), // Limit to 50KB
        metadata: {
          wordCount,
          language: this.detectLanguage(text)
        }
      }
    } catch (error) {
      return {
        success: false,
        text: '',
        error: error instanceof Error ? error.message : 'Text file reading failed'
      }
    }
  }

  /**
   * Extract text from document files (basic implementation)
   */
  private static async extractFromDocument(file: File): Promise<TextExtractionResult> {
    try {
      // For document types like .docx, .rtf, etc.
      // This is a basic implementation - in production, use specialized libraries
      
      if (file.type.includes('rtf')) {
        return await this.extractFromRTF(file)
      }
      
      // For other document types, try to read as text
      const text = await file.text()
      
      // Clean up common document formatting
      const cleanText = text
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ') // Remove non-printable characters
        .replace(/\s+/g, ' ')
        .trim()

      if (cleanText.length < 10) {
        return {
          success: false,
          text: '',
          error: 'No readable text found in document'
        }
      }

      return {
        success: true,
        text: cleanText.substring(0, 50000),
        metadata: {
          wordCount: this.countWords(cleanText),
          language: this.detectLanguage(cleanText)
        }
      }
    } catch (error) {
      return {
        success: false,
        text: '',
        error: error instanceof Error ? error.message : 'Document extraction failed'
      }
    }
  }

  /**
   * Extract text from RTF files
   */
  private static async extractFromRTF(file: File): Promise<TextExtractionResult> {
    try {
      const text = await file.text()
      
      // Basic RTF text extraction - remove RTF control codes
      const cleanText = text
        .replace(/\\[a-z]+\d*\s?/g, '') // Remove RTF control words
        .replace(/[{}]/g, '') // Remove braces
        .replace(/\\\\/g, '\\') // Unescape backslashes
        .replace(/\\'/g, "'") // Unescape quotes
        .replace(/\s+/g, ' ')
        .trim()

      return {
        success: true,
        text: cleanText.substring(0, 50000),
        metadata: {
          wordCount: this.countWords(cleanText),
          language: this.detectLanguage(cleanText)
        }
      }
    } catch (error) {
      return {
        success: false,
        text: '',
        error: error instanceof Error ? error.message : 'RTF extraction failed'
      }
    }
  }

  /**
   * Extract text from images using basic OCR
   */
  private static async extractFromImage(file: File): Promise<TextExtractionResult> {
    try {
      // Basic image text detection - in production, use Tesseract.js or cloud OCR
      const ocrResult = await this.performBasicOCR(file)
      
      if (!ocrResult.success || !ocrResult.text) {
        return {
          success: false,
          text: '',
          error: 'No text detected in image'
        }
      }

      return {
        success: true,
        text: ocrResult.text,
        metadata: {
          wordCount: this.countWords(ocrResult.text),
          language: this.detectLanguage(ocrResult.text)
        }
      }
    } catch (error) {
      return {
        success: false,
        text: '',
        error: error instanceof Error ? error.message : 'Image OCR failed'
      }
    }
  }

  /**
   * Perform basic OCR on image (placeholder implementation)
   */
  private static async performBasicOCR(file: File): Promise<OCRResult> {
    // This is a placeholder for OCR functionality
    // In production, integrate with Tesseract.js, Google Vision API, or similar
    
    try {
      // For now, return empty result
      // Real implementation would process the image and extract text
      return {
        success: false,
        text: '',
        error: 'OCR not implemented - use Tesseract.js or cloud OCR service'
      }
    } catch (error) {
      return {
        success: false,
        text: '',
        error: error instanceof Error ? error.message : 'OCR failed'
      }
    }
  }

  /**
   * Check if file type is a document type
   */
  private static isDocumentType(mimeType: string): boolean {
    const documentTypes = [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/rtf',
      'application/vnd.oasis.opendocument.text',
      'text/rtf'
    ]
    
    return documentTypes.includes(mimeType)
  }

  /**
   * Count words in text
   */
  private static countWords(text: string): number {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length
  }

  /**
   * Basic language detection
   */
  private static detectLanguage(text: string): string {
    // Very basic language detection based on common words
    const sample = text.toLowerCase().substring(0, 1000)
    
    const patterns = {
      'en': /\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/g,
      'es': /\b(el|la|y|o|pero|en|con|de|para|por)\b/g,
      'fr': /\b(le|la|et|ou|mais|dans|sur|avec|de|pour)\b/g,
      'de': /\b(der|die|das|und|oder|aber|in|auf|mit|von)\b/g,
      'it': /\b(il|la|e|o|ma|in|su|con|di|per)\b/g
    }
    
    let maxMatches = 0
    let detectedLanguage = 'unknown'
    
    for (const [lang, pattern] of Object.entries(patterns)) {
      const matches = (sample.match(pattern) || []).length
      if (matches > maxMatches) {
        maxMatches = matches
        detectedLanguage = lang
      }
    }
    
    return maxMatches > 3 ? detectedLanguage : 'unknown'
  }

  /**
   * Extract keywords from text
   */
  static extractKeywords(text: string, maxKeywords: number = 10): string[] {
    try {
      // Simple keyword extraction based on word frequency
      const words = text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3)
        .filter(word => !this.isStopWord(word))

      // Count word frequencies
      const wordCount: Record<string, number> = {}
      words.forEach(word => {
        wordCount[word] = (wordCount[word] || 0) + 1
      })

      // Sort by frequency and return top keywords
      return Object.entries(wordCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, maxKeywords)
        .map(([word]) => word)
    } catch (error) {
      console.warn('Keyword extraction failed:', error)
      return []
    }
  }

  /**
   * Check if word is a stop word
   */
  private static isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above',
      'below', 'between', 'among', 'this', 'that', 'these', 'those', 'i', 'me', 'my',
      'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself',
      'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
      'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what',
      'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are',
      'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do',
      'does', 'did', 'doing', 'a', 'an', 'as', 'able', 'about', 'across', 'after',
      'all', 'almost', 'also', 'although', 'always', 'among', 'any', 'anybody',
      'anyone', 'anything', 'anywhere', 'are', 'area', 'areas', 'around', 'became',
      'because', 'become', 'becomes', 'becoming', 'been', 'before', 'began', 'behind',
      'being', 'believe', 'below', 'best', 'better', 'between', 'both', 'bring',
      'brought', 'came', 'can', 'cannot', 'case', 'cases', 'certain', 'certainly',
      'clear', 'clearly', 'come', 'could', 'did', 'differ', 'different', 'differently',
      'does', 'done', 'during', 'each', 'early', 'either', 'end', 'enough', 'even',
      'ever', 'every', 'everybody', 'everyone', 'everything', 'everywhere', 'fact',
      'facts', 'far', 'felt', 'few', 'find', 'finds', 'first', 'full', 'fully',
      'further', 'furthered', 'furthering', 'furthers', 'gave', 'general', 'generally',
      'get', 'gets', 'give', 'given', 'gives', 'going', 'good', 'goods', 'got',
      'great', 'greater', 'greatest', 'group', 'grouped', 'grouping', 'groups',
      'had', 'has', 'have', 'having', 'high', 'higher', 'highest', 'how', 'however',
      'important', 'interest', 'interested', 'interesting', 'interests', 'into',
      'just', 'keep', 'keeps', 'kind', 'knew', 'know', 'known', 'knows', 'large',
      'largely', 'last', 'later', 'latest', 'least', 'less', 'let', 'lets', 'like',
      'likely', 'long', 'longer', 'longest', 'made', 'make', 'making', 'man', 'many',
      'may', 'member', 'members', 'men', 'might', 'more', 'most', 'mostly', 'much',
      'must', 'necessary', 'need', 'needed', 'needing', 'needs', 'never', 'new',
      'newer', 'newest', 'next', 'non', 'not', 'nothing', 'now', 'nowhere', 'number',
      'numbers', 'off', 'often', 'old', 'older', 'oldest', 'once', 'one', 'only',
      'open', 'opened', 'opening', 'opens', 'order', 'ordered', 'ordering', 'orders',
      'other', 'others', 'over', 'part', 'parted', 'parting', 'parts', 'per',
      'perhaps', 'place', 'places', 'point', 'pointed', 'pointing', 'points',
      'possible', 'present', 'presented', 'presenting', 'presents', 'problem',
      'problems', 'put', 'puts', 'quite', 'rather', 'really', 'right', 'room',
      'rooms', 'said', 'same', 'saw', 'say', 'says', 'second', 'seconds', 'see',
      'seem', 'seemed', 'seeming', 'seems', 'sees', 'several', 'shall', 'she',
      'should', 'show', 'showed', 'showing', 'shows', 'side', 'sides', 'since',
      'small', 'smaller', 'smallest', 'some', 'somebody', 'someone', 'something',
      'somewhere', 'state', 'states', 'still', 'such', 'sure', 'take', 'taken',
      'than', 'then', 'there', 'therefore', 'these', 'they', 'thing', 'things',
      'think', 'thinks', 'thought', 'thoughts', 'three', 'through', 'thus', 'today',
      'together', 'too', 'took', 'toward', 'turn', 'turned', 'turning', 'turns',
      'two', 'under', 'until', 'use', 'used', 'uses', 'using', 'very', 'want',
      'wanted', 'wanting', 'wants', 'way', 'ways', 'well', 'wells', 'went', 'were',
      'what', 'when', 'where', 'whether', 'which', 'while', 'who', 'whole', 'whose',
      'why', 'will', 'with', 'within', 'without', 'work', 'worked', 'working',
      'works', 'would', 'year', 'years', 'yet', 'you', 'young', 'younger', 'youngest',
      'your', 'yours'
    ])
    
    return stopWords.has(word.toLowerCase())
  }

  /**
   * Summarize text content
   */
  static summarizeText(text: string, maxLength: number = 200): string {
    try {
      if (text.length <= maxLength) {
        return text
      }

      // Simple extractive summarization - take first and key sentences
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10)
      
      if (sentences.length <= 2) {
        return text.substring(0, maxLength) + '...'
      }

      // Take first sentence and find important sentences
      let summary = sentences[0].trim()
      
      // Look for sentences with keywords
      const keywords = this.extractKeywords(text, 5)
      const importantSentences = sentences.slice(1).filter(sentence => {
        const lowerSentence = sentence.toLowerCase()
        return keywords.some(keyword => lowerSentence.includes(keyword))
      })

      // Add important sentences until we reach max length
      for (const sentence of importantSentences) {
        const newSummary = summary + '. ' + sentence.trim()
        if (newSummary.length > maxLength) {
          break
        }
        summary = newSummary
      }

      return summary + (summary.length < text.length ? '...' : '')
    } catch (error) {
      console.warn('Text summarization failed:', error)
      return text.substring(0, maxLength) + '...'
    }
  }
}