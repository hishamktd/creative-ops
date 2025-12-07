import { AssetMetadata, CameraInfo } from '../../types'

export interface MetadataExtractionResult {
  success: boolean
  metadata: AssetMetadata
  error?: string
}

export interface ExifData {
  make?: string
  model?: string
  lens?: string
  focalLength?: string
  aperture?: string
  iso?: string
  shutterSpeed?: string
  flash?: string
  dateTime?: string
  gps?: {
    latitude?: number
    longitude?: number
    altitude?: number
  }
  orientation?: number
  colorSpace?: string
  whiteBalance?: string
  exposureMode?: string
  meteringMode?: string
}

export class MetadataExtractionService {
  /**
   * Extract comprehensive metadata from any file type
   */
  static async extractMetadata(file: File): Promise<MetadataExtractionResult> {
    try {
      const baseMetadata: AssetMetadata = {
        original_name: file.name,
        mime_type: file.type
      }

      // Extract type-specific metadata
      if (file.type.startsWith('image/')) {
        const imageMetadata = await this.extractImageMetadata(file)
        Object.assign(baseMetadata, imageMetadata)
      } else if (file.type.startsWith('video/')) {
        const videoMetadata = await this.extractVideoMetadata(file)
        Object.assign(baseMetadata, videoMetadata)
      } else if (file.type.startsWith('audio/')) {
        const audioMetadata = await this.extractAudioMetadata(file)
        Object.assign(baseMetadata, audioMetadata)
      } else if (file.type === 'application/pdf') {
        const pdfMetadata = await this.extractPDFMetadata(file)
        Object.assign(baseMetadata, pdfMetadata)
      } else if (this.isTextFile(file.type)) {
        const textMetadata = await this.extractTextMetadata(file)
        Object.assign(baseMetadata, textMetadata)
      }

      return {
        success: true,
        metadata: baseMetadata
      }
    } catch (error) {
      console.error('Metadata extraction failed:', error)
      return {
        success: false,
        metadata: {
          original_name: file.name,
          mime_type: file.type
        },
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Extract image metadata including EXIF data
   */
  private static async extractImageMetadata(file: File): Promise<Partial<AssetMetadata>> {
    const metadata: Partial<AssetMetadata> = {}

    // Get basic image dimensions
    const dimensions = await this.getImageDimensions(file)
    if (dimensions) {
      metadata.width = dimensions.width
      metadata.height = dimensions.height
    }

    // Extract EXIF data
    const exifData = await this.extractExifData(file)
    if (exifData) {
      metadata.camera_info = this.convertExifToCameraInfo(exifData)
      
      // Add color profile information
      if (exifData.colorSpace) {
        metadata.color_profile = exifData.colorSpace
      }
    }

    return metadata
  }

  /**
   * Get image dimensions
   */
  private static async getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
    return new Promise((resolve) => {
      const img = new Image()
      
      img.onload = () => {
        resolve({
          width: img.naturalWidth,
          height: img.naturalHeight
        })
        URL.revokeObjectURL(img.src)
      }

      img.onerror = () => {
        resolve(null)
      }

      img.src = URL.createObjectURL(file)
    })
  }

  /**
   * Extract EXIF data from image
   */
  private static async extractExifData(file: File): Promise<ExifData | null> {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const dataView = new DataView(arrayBuffer)

      // Check for JPEG EXIF marker
      if (dataView.getUint16(0) !== 0xFFD8) {
        return null // Not a JPEG
      }

      let offset = 2
      let marker: number

      // Find EXIF marker (0xFFE1)
      while (offset < dataView.byteLength) {
        marker = dataView.getUint16(offset)
        
        if (marker === 0xFFE1) {
          // Found EXIF marker
          const exifLength = dataView.getUint16(offset + 2)
          const exifData = new DataView(arrayBuffer, offset + 4, exifLength - 2)
          
          return this.parseExifData(exifData)
        }
        
        if (marker === 0xFFDA) {
          break // Start of scan, no more metadata
        }
        
        const segmentLength = dataView.getUint16(offset + 2)
        offset += 2 + segmentLength
      }

      return null
    } catch (error) {
      console.warn('EXIF extraction failed:', error)
      return null
    }
  }

  /**
   * Parse EXIF data from DataView
   */
  private static parseExifData(dataView: DataView): ExifData | null {
    try {
      // Check for EXIF header
      const exifHeader = new Uint8Array(dataView.buffer, dataView.byteOffset, 6)
      const exifString = String.fromCharCode(...exifHeader)
      
      if (!exifString.startsWith('Exif\0\0')) {
        return null
      }

      // This is a simplified EXIF parser
      // In production, use a library like 'exif-js' or 'piexifjs'
      const exifData: ExifData = {}

      // Parse TIFF header and IFD entries
      const tiffOffset = 6
      const tiffData = new DataView(dataView.buffer, dataView.byteOffset + tiffOffset)
      
      // Check byte order
      const byteOrder = tiffData.getUint16(0)
      const littleEndian = byteOrder === 0x4949

      // Get first IFD offset
      const ifdOffset = tiffData.getUint32(4, littleEndian)
      
      // Parse IFD entries (simplified)
      this.parseIFDEntries(tiffData, ifdOffset, littleEndian, exifData)

      return exifData
    } catch (error) {
      console.warn('EXIF parsing failed:', error)
      return null
    }
  }

  /**
   * Parse IFD entries (simplified implementation)
   */
  private static parseIFDEntries(dataView: DataView, offset: number, littleEndian: boolean, exifData: ExifData): void {
    try {
      const entryCount = dataView.getUint16(offset, littleEndian)
      
      for (let i = 0; i < entryCount; i++) {
        const entryOffset = offset + 2 + (i * 12)
        const tag = dataView.getUint16(entryOffset, littleEndian)
        const type = dataView.getUint16(entryOffset + 2, littleEndian)
        const count = dataView.getUint32(entryOffset + 4, littleEndian)
        const valueOffset = dataView.getUint32(entryOffset + 8, littleEndian)

        // Parse common EXIF tags
        switch (tag) {
          case 0x010F: // Make
            exifData.make = this.readString(dataView, valueOffset, count, littleEndian)
            break
          case 0x0110: // Model
            exifData.model = this.readString(dataView, valueOffset, count, littleEndian)
            break
          case 0x829A: // Exposure time
            exifData.shutterSpeed = this.readRational(dataView, valueOffset, littleEndian)
            break
          case 0x829D: // F-number
            exifData.aperture = this.readRational(dataView, valueOffset, littleEndian)
            break
          case 0x8827: // ISO
            exifData.iso = dataView.getUint16(valueOffset, littleEndian).toString()
            break
          case 0x920A: // Focal length
            exifData.focalLength = this.readRational(dataView, valueOffset, littleEndian)
            break
        }
      }
    } catch (error) {
      console.warn('IFD parsing failed:', error)
    }
  }

  /**
   * Read string from EXIF data
   */
  private static readString(dataView: DataView, offset: number, length: number, littleEndian: boolean): string {
    try {
      const bytes = new Uint8Array(dataView.buffer, dataView.byteOffset + offset, length)
      return String.fromCharCode(...bytes).replace(/\0/g, '')
    } catch {
      return ''
    }
  }

  /**
   * Read rational number from EXIF data
   */
  private static readRational(dataView: DataView, offset: number, littleEndian: boolean): string {
    try {
      const numerator = dataView.getUint32(offset, littleEndian)
      const denominator = dataView.getUint32(offset + 4, littleEndian)
      return denominator !== 0 ? (numerator / denominator).toString() : '0'
    } catch {
      return '0'
    }
  }

  /**
   * Convert EXIF data to CameraInfo format
   */
  private static convertExifToCameraInfo(exifData: ExifData): CameraInfo {
    const cameraInfo: CameraInfo = {}

    if (exifData.make) cameraInfo.make = exifData.make
    if (exifData.model) cameraInfo.model = exifData.model
    if (exifData.lens) cameraInfo.lens = exifData.lens
    if (exifData.focalLength) cameraInfo.focal_length = exifData.focalLength + 'mm'
    if (exifData.aperture) cameraInfo.aperture = 'f/' + exifData.aperture
    if (exifData.iso) cameraInfo.iso = 'ISO ' + exifData.iso
    if (exifData.shutterSpeed) cameraInfo.shutter_speed = exifData.shutterSpeed + 's'
    if (exifData.flash) cameraInfo.flash = exifData.flash
    if (exifData.gps) cameraInfo.gps = exifData.gps

    return cameraInfo
  }

  /**
   * Extract video metadata
   */
  private static async extractVideoMetadata(file: File): Promise<Partial<AssetMetadata>> {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      
      video.onloadedmetadata = () => {
        const metadata: Partial<AssetMetadata> = {
          width: video.videoWidth,
          height: video.videoHeight,
          duration: Math.round(video.duration)
        }
        
        URL.revokeObjectURL(video.src)
        resolve(metadata)
      }

      video.onerror = () => {
        URL.revokeObjectURL(video.src)
        resolve({})
      }

      video.src = URL.createObjectURL(file)
      video.load()
    })
  }

  /**
   * Extract audio metadata
   */
  private static async extractAudioMetadata(file: File): Promise<Partial<AssetMetadata>> {
    return new Promise((resolve) => {
      const audio = document.createElement('audio')
      
      audio.onloadedmetadata = () => {
        const metadata: Partial<AssetMetadata> = {
          duration: Math.round(audio.duration)
        }
        
        URL.revokeObjectURL(audio.src)
        resolve(metadata)
      }

      audio.onerror = () => {
        URL.revokeObjectURL(audio.src)
        resolve({})
      }

      audio.src = URL.createObjectURL(file)
      audio.load()
    })
  }

  /**
   * Extract PDF metadata and text content
   */
  private static async extractPDFMetadata(file: File): Promise<Partial<AssetMetadata>> {
    try {
      const arrayBuffer = await file.arrayBuffer()
      const text = new TextDecoder('latin1').decode(arrayBuffer)
      
      const metadata: Partial<AssetMetadata> = {}

      // Extract page count
      const pageMatches = text.match(/\/Type\s*\/Page\b/g)
      if (pageMatches) {
        metadata.pages = pageMatches.length
      }

      // Extract text content for search indexing
      const extractedText = this.extractTextFromPDF(text)
      if (extractedText) {
        metadata.extracted_text = extractedText.substring(0, 10000) // Limit to 10KB
      }

      return metadata
    } catch (error) {
      console.warn('PDF metadata extraction failed:', error)
      return {}
    }
  }

  /**
   * Extract text from PDF (basic implementation)
   */
  private static extractTextFromPDF(pdfContent: string): string {
    try {
      // Extract text between parentheses (basic PDF text extraction)
      const textMatches = pdfContent.match(/\(([^)]+)\)/g)
      if (textMatches) {
        return textMatches
          .map(match => match.slice(1, -1))
          .join(' ')
          .replace(/\\[nrt]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      }

      // Fallback: extract readable text patterns
      const readableText = pdfContent.match(/[A-Za-z0-9\s.,!?;:'"()-]{10,}/g)
      if (readableText) {
        return readableText.join(' ').substring(0, 5000)
      }

      return ''
    } catch (error) {
      console.warn('PDF text extraction failed:', error)
      return ''
    }
  }

  /**
   * Extract text file metadata
   */
  private static async extractTextMetadata(file: File): Promise<Partial<AssetMetadata>> {
    try {
      const text = await file.text()
      
      return {
        extracted_text: text.substring(0, 10000) // Limit to 10KB for indexing
      }
    } catch (error) {
      console.warn('Text extraction failed:', error)
      return {}
    }
  }

  /**
   * Check if file type is text-based
   */
  private static isTextFile(mimeType: string): boolean {
    const textTypes = [
      'text/',
      'application/json',
      'application/xml',
      'application/javascript',
      'application/typescript'
    ]
    
    return textTypes.some(type => mimeType.startsWith(type))
  }

  /**
   * Generate automatic tags based on file content and metadata
   */
  static generateAutoTags(file: File, metadata: AssetMetadata): string[] {
    const tags: string[] = []

    // Add file type tags
    if (file.type.startsWith('image/')) {
      tags.push('image')
      if (file.type.includes('jpeg') || file.type.includes('jpg')) tags.push('jpeg')
      if (file.type.includes('png')) tags.push('png')
      if (file.type.includes('svg')) tags.push('vector')
    } else if (file.type.startsWith('video/')) {
      tags.push('video')
      if (file.type.includes('mp4')) tags.push('mp4')
    } else if (file.type.startsWith('audio/')) {
      tags.push('audio')
    } else if (file.type === 'application/pdf') {
      tags.push('document', 'pdf')
    }

    // Add dimension-based tags
    if (metadata.width && metadata.height) {
      const aspectRatio = metadata.width / metadata.height
      if (Math.abs(aspectRatio - 1) < 0.1) {
        tags.push('square')
      } else if (aspectRatio > 1.5) {
        tags.push('landscape')
      } else if (aspectRatio < 0.7) {
        tags.push('portrait')
      }

      // Add resolution tags
      const megapixels = (metadata.width * metadata.height) / 1000000
      if (megapixels > 10) tags.push('high-res')
      if (megapixels < 1) tags.push('low-res')
    }

    // Add camera-based tags
    if (metadata.camera_info?.make) {
      tags.push(metadata.camera_info.make.toLowerCase())
    }

    // Add content-based tags from extracted text
    if (metadata.extracted_text) {
      const contentTags = this.extractContentTags(metadata.extracted_text)
      tags.push(...contentTags)
    }

    return [...new Set(tags)] // Remove duplicates
  }

  /**
   * Extract content-based tags from text
   */
  private static extractContentTags(text: string): string[] {
    const tags: string[] = []
    const lowerText = text.toLowerCase()

    // Common content keywords
    const keywords = {
      'logo': ['logo', 'brand', 'identity'],
      'screenshot': ['screenshot', 'screen capture', 'ui'],
      'mockup': ['mockup', 'wireframe', 'prototype'],
      'photo': ['photo', 'photograph', 'picture'],
      'design': ['design', 'creative', 'artwork'],
      'presentation': ['presentation', 'slide', 'deck'],
      'report': ['report', 'analysis', 'summary'],
      'contract': ['contract', 'agreement', 'terms']
    }

    for (const [tag, words] of Object.entries(keywords)) {
      if (words.some(word => lowerText.includes(word))) {
        tags.push(tag)
      }
    }

    return tags
  }
}