import { SecurityService } from './security'

export interface FileValidationConfig {
  maxFileSize: number
  allowedMimeTypes: string[]
  allowedExtensions: string[]
  blockedExtensions: string[]
  enableVirusScanning: boolean
  enableContentScanning: boolean
  enableRealTimeScanning: boolean
  quarantineThreats: boolean
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  metadata: FileMetadata
  securityFlags: SecurityFlag[]
  securityScan?: {
    scanId: string
    status: 'pending' | 'scanning' | 'clean' | 'infected' | 'error'
    threatLevel?: 'low' | 'medium' | 'high' | 'critical'
  }
}

export interface FileMetadata {
  name: string
  size: number
  type: string
  extension: string
  lastModified: number
  checksum?: string
}

export interface SecurityFlag {
  type: 'virus' | 'malicious_content' | 'suspicious_extension' | 'size_anomaly'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
}

export class FileValidationService {
  private static readonly DEFAULT_CONFIG: FileValidationConfig = {
    maxFileSize: 100 * 1024 * 1024, // 100MB
    allowedMimeTypes: [
      // Images
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp', 'image/tiff',
      // Videos
      'video/mp4', 'video/webm', 'video/mov', 'video/avi', 'video/mkv', 'video/wmv',
      // Audio
      'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac',
      // Documents
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // Text files
      'text/plain', 'text/csv', 'text/html', 'text/css', 'text/javascript', 'text/typescript',
      'application/json', 'application/xml', 'text/xml',
      // Archives
      'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed', 'application/x-tar'
    ],
    allowedExtensions: [
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.tiff',
      '.mp4', '.webm', '.mov', '.avi', '.mkv', '.wmv',
      '.mp3', '.wav', '.ogg', '.aac', '.flac',
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
      '.txt', '.csv', '.html', '.css', '.js', '.ts', '.json', '.xml',
      '.zip', '.rar', '.7z', '.tar'
    ],
    blockedExtensions: [
      '.exe', '.bat', '.cmd', '.scr', '.pif', '.com', '.msi', '.dll', '.sys',
      '.vbs', '.js', '.jar', '.app', '.deb', '.rpm', '.dmg', '.pkg',
      '.sh', '.bash', '.ps1', '.psm1'
    ],
    enableVirusScanning: true,
    enableContentScanning: true,
    enableRealTimeScanning: true,
    quarantineThreats: true
  }

  /**
   * Validate file with comprehensive security checks
   */
  static async validateFile(file: File, config: Partial<FileValidationConfig> = {}): Promise<ValidationResult> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config }
    const errors: string[] = []
    const warnings: string[] = []
    const securityFlags: SecurityFlag[] = []

    // Extract file metadata
    const metadata = await this.extractFileMetadata(file)

    // Basic validation checks
    this.validateFileSize(file, finalConfig, errors)
    this.validateMimeType(file, finalConfig, errors, warnings)
    this.validateFileExtension(metadata.extension, finalConfig, errors, securityFlags)
    this.validateFileName(file.name, errors, warnings)

    // Security checks
    await this.performSecurityScanning(file, finalConfig, securityFlags)
    this.checkForSuspiciousPatterns(file, metadata, securityFlags)

    // Content validation
    if (finalConfig.enableContentScanning) {
      await this.validateFileContent(file, metadata, errors, warnings, securityFlags)
    }

    return {
      isValid: errors.length === 0 && !securityFlags.some(flag => flag.severity === 'critical'),
      errors,
      warnings,
      metadata,
      securityFlags
    }
  }

  /**
   * Validate file and initiate security scan for uploaded asset
   */
  static async validateAndScanAsset(
    file: File, 
    assetId: string, 
    config: Partial<FileValidationConfig> = {}
  ): Promise<ValidationResult> {
    const finalConfig = { ...this.DEFAULT_CONFIG, ...config }
    
    // First perform standard validation
    const validationResult = await this.validateFile(file, config)

    // If real-time scanning is enabled and file passes basic validation
    if (finalConfig.enableRealTimeScanning && validationResult.isValid) {
      try {
        // Initiate security scan
        const scanResult = await SecurityService.initiateScan(assetId, 'virus', 'clamav')
        
        if (scanResult.success && scanResult.scanId) {
          validationResult.securityScan = {
            scanId: scanResult.scanId,
            status: 'pending'
          }
        }
      } catch (error) {
        console.warn('Failed to initiate security scan:', error)
        validationResult.warnings.push('Security scan could not be initiated')
      }
    }

    // If threats detected and quarantine is enabled
    if (finalConfig.quarantineThreats && validationResult.securityFlags.some(flag => 
      flag.severity === 'critical' || flag.type === 'virus' || flag.type === 'malicious_content'
    )) {
      validationResult.errors.push('File has been quarantined due to security threats')
      validationResult.isValid = false
    }

    return validationResult
  }

  /**
   * Extract comprehensive file metadata
   */
  private static async extractFileMetadata(file: File): Promise<FileMetadata> {
    const extension = this.getFileExtension(file.name)
    
    return {
      name: file.name,
      size: file.size,
      type: file.type,
      extension,
      lastModified: file.lastModified,
      checksum: await this.calculateChecksum(file)
    }
  }

  /**
   * Calculate file checksum for integrity verification
   */
  private static async calculateChecksum(file: File): Promise<string> {
    try {
      const buffer = await file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    } catch (error) {
      console.warn('Failed to calculate file checksum:', error)
      return ''
    }
  }

  /**
   * Validate file size
   */
  private static validateFileSize(file: File, config: FileValidationConfig, errors: string[]): void {
    if (file.size === 0) {
      errors.push('File is empty')
      return
    }

    if (file.size > config.maxFileSize) {
      const maxSizeMB = Math.round(config.maxFileSize / (1024 * 1024))
      const fileSizeMB = Math.round(file.size / (1024 * 1024))
      errors.push(`File size (${fileSizeMB}MB) exceeds maximum allowed size (${maxSizeMB}MB)`)
    }
  }

  /**
   * Validate MIME type
   */
  private static validateMimeType(
    file: File, 
    config: FileValidationConfig, 
    errors: string[], 
    warnings: string[]
  ): void {
    if (!file.type) {
      warnings.push('File MIME type could not be determined')
      return
    }

    if (!config.allowedMimeTypes.includes(file.type)) {
      errors.push(`File type '${file.type}' is not allowed`)
    }
  }

  /**
   * Validate file extension
   */
  private static validateFileExtension(
    extension: string,
    config: FileValidationConfig,
    errors: string[],
    securityFlags: SecurityFlag[]
  ): void {
    if (!extension) {
      errors.push('File must have a valid extension')
      return
    }

    // Check blocked extensions
    if (config.blockedExtensions.includes(extension.toLowerCase())) {
      securityFlags.push({
        type: 'suspicious_extension',
        severity: 'critical',
        message: `File extension '${extension}' is blocked for security reasons`
      })
      errors.push(`File extension '${extension}' is not allowed for security reasons`)
      return
    }

    // Check allowed extensions
    if (!config.allowedExtensions.includes(extension.toLowerCase())) {
      errors.push(`File extension '${extension}' is not allowed`)
    }
  }

  /**
   * Validate file name
   */
  private static validateFileName(fileName: string, errors: string[], warnings: string[]): void {
    if (!fileName || fileName.trim() === '') {
      errors.push('File name is required')
      return
    }

    // Check for suspicious characters
    const suspiciousChars = /[<>:"|?*\x00-\x1f]/
    if (suspiciousChars.test(fileName)) {
      warnings.push('File name contains potentially problematic characters')
    }

    // Check for excessively long names
    if (fileName.length > 255) {
      errors.push('File name is too long (maximum 255 characters)')
    }

    // Check for reserved names (Windows)
    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9']
    const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName
    if (reservedNames.includes(nameWithoutExt.toUpperCase())) {
      warnings.push(`File name '${nameWithoutExt}' is a reserved system name`)
    }
  }

  /**
   * Perform security scanning
   */
  private static async performSecurityScanning(
    file: File,
    config: FileValidationConfig,
    securityFlags: SecurityFlag[]
  ): Promise<void> {
    if (!config.enableVirusScanning) return

    try {
      // Basic malware signature detection (simplified)
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      
      // Check for common malware signatures in first 1KB
      const headerBytes = bytes.slice(0, 1024)
      const headerString = Array.from(headerBytes).map(b => b.toString(16).padStart(2, '0')).join('')
      
      // Common malware signatures (simplified examples)
      const malwareSignatures = [
        '4d5a', // PE executable header
        '7f454c46', // ELF executable header
        'cafebabe', // Java class file
        'feedface', // Mach-O executable
      ]

      for (const signature of malwareSignatures) {
        if (headerString.includes(signature)) {
          securityFlags.push({
            type: 'malicious_content',
            severity: 'high',
            message: 'File contains potentially malicious executable code'
          })
          break
        }
      }

      // Check for suspicious file size patterns
      if (file.size > 0 && file.size < 100) {
        securityFlags.push({
          type: 'size_anomaly',
          severity: 'low',
          message: 'File is unusually small, may be a test or malicious file'
        })
      }

    } catch (error) {
      console.warn('Security scanning failed:', error)
      securityFlags.push({
        type: 'virus',
        severity: 'medium',
        message: 'Unable to complete security scan'
      })
    }
  }

  /**
   * Check for suspicious patterns
   */
  private static checkForSuspiciousPatterns(
    file: File,
    metadata: FileMetadata,
    securityFlags: SecurityFlag[]
  ): void {
    // Check for MIME type and extension mismatch
    const expectedMimeTypes = this.getExpectedMimeTypes(metadata.extension)
    if (expectedMimeTypes.length > 0 && !expectedMimeTypes.includes(file.type)) {
      securityFlags.push({
        type: 'suspicious_extension',
        severity: 'medium',
        message: `File extension '${metadata.extension}' doesn't match MIME type '${file.type}'`
      })
    }

    // Check for double extensions
    const doubleExtensionPattern = /\.[a-zA-Z0-9]{1,4}\.[a-zA-Z0-9]{1,4}$/
    if (doubleExtensionPattern.test(file.name)) {
      securityFlags.push({
        type: 'suspicious_extension',
        severity: 'medium',
        message: 'File has multiple extensions, which may be used to disguise file type'
      })
    }
  }

  /**
   * Validate file content based on type
   */
  private static async validateFileContent(
    file: File,
    metadata: FileMetadata,
    errors: string[],
    warnings: string[],
    securityFlags: SecurityFlag[]
  ): Promise<void> {
    try {
      // Image validation
      if (metadata.type.startsWith('image/')) {
        await this.validateImageContent(file, errors, warnings)
      }

      // PDF validation
      if (metadata.type === 'application/pdf') {
        await this.validatePDFContent(file, errors, warnings)
      }

      // Text file validation
      if (metadata.type.startsWith('text/')) {
        await this.validateTextContent(file, errors, warnings, securityFlags)
      }

    } catch (error) {
      warnings.push('Content validation failed: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }

  /**
   * Validate image content
   */
  private static async validateImageContent(file: File, errors: string[], warnings: string[]): Promise<void> {
    return new Promise((resolve) => {
      const img = new Image()
      
      img.onload = () => {
        if (img.width === 0 || img.height === 0) {
          errors.push('Invalid image: zero dimensions')
        }
        if (img.width > 10000 || img.height > 10000) {
          warnings.push('Image dimensions are very large, may cause performance issues')
        }
        resolve()
      }

      img.onerror = () => {
        errors.push('Invalid or corrupted image file')
        resolve()
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        if (e.target?.result) {
          img.src = e.target.result as string
        }
      }
      reader.onerror = () => {
        errors.push('Unable to read image file')
        resolve()
      }
      reader.readAsDataURL(file)
    })
  }

  /**
   * Validate PDF content
   */
  private static async validatePDFContent(file: File, errors: string[], warnings: string[]): Promise<void> {
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    
    // Check PDF header
    const pdfHeader = '%PDF-'
    const headerBytes = bytes.slice(0, 5)
    const headerString = String.fromCharCode(...headerBytes)
    
    if (!headerString.startsWith(pdfHeader)) {
      errors.push('Invalid PDF file: missing PDF header')
    }
  }

  /**
   * Validate text content
   */
  private static async validateTextContent(
    file: File,
    errors: string[],
    warnings: string[],
    securityFlags: SecurityFlag[]
  ): Promise<void> {
    const text = await file.text()
    
    // Check for suspicious script content
    const scriptPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /vbscript:/gi,
      /on\w+\s*=/gi
    ]

    for (const pattern of scriptPatterns) {
      if (pattern.test(text)) {
        securityFlags.push({
          type: 'malicious_content',
          severity: 'high',
          message: 'Text file contains potentially malicious script content'
        })
        break
      }
    }

    // Check for excessively long lines (potential DoS)
    const lines = text.split('\n')
    const maxLineLength = lines.reduce((max, line) => Math.max(max, line.length), 0)
    if (maxLineLength > 10000) {
      warnings.push('Text file contains very long lines, may cause performance issues')
    }
  }

  /**
   * Get file extension from filename
   */
  private static getFileExtension(fileName: string): string {
    const lastDotIndex = fileName.lastIndexOf('.')
    return lastDotIndex === -1 ? '' : fileName.substring(lastDotIndex).toLowerCase()
  }

  /**
   * Get expected MIME types for file extension
   */
  private static getExpectedMimeTypes(extension: string): string[] {
    const mimeTypeMap: Record<string, string[]> = {
      '.jpg': ['image/jpeg'],
      '.jpeg': ['image/jpeg'],
      '.png': ['image/png'],
      '.gif': ['image/gif'],
      '.webp': ['image/webp'],
      '.svg': ['image/svg+xml'],
      '.pdf': ['application/pdf'],
      '.txt': ['text/plain'],
      '.html': ['text/html'],
      '.css': ['text/css'],
      '.js': ['text/javascript', 'application/javascript'],
      '.json': ['application/json'],
      '.xml': ['application/xml', 'text/xml'],
      '.mp4': ['video/mp4'],
      '.webm': ['video/webm'],
      '.mp3': ['audio/mpeg'],
      '.wav': ['audio/wav'],
      '.zip': ['application/zip']
    }

    return mimeTypeMap[extension.toLowerCase()] || []
  }
}