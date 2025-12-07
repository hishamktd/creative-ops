import { supabase, supabaseAdmin } from '../supabase/client'
import { createServerSupabaseClient } from '../supabase/server'

export interface UploadOptions {
  bucket: string
  path: string
  file: File
  onProgress?: (progress: number) => void
  chunkSize?: number
}

export interface UploadResult {
  success: boolean
  data?: {
    path: string
    fullPath: string
    publicUrl: string
  }
  error?: string
}

export interface FileValidationResult {
  isValid: boolean
  errors: string[]
  metadata?: {
    size: number
    type: string
    name: string
    lastModified: number
  }
}

export class StorageService {
  private static readonly BUCKET_NAME = 'assets'
  private static readonly MAX_FILE_SIZE = 100 * 1024 * 1024 // 100MB
  private static readonly CHUNK_SIZE = 1024 * 1024 // 1MB chunks
  private static readonly ALLOWED_TYPES = [
    // Images
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    // Videos
    'video/mp4', 'video/webm', 'video/mov', 'video/avi',
    // Documents
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    // Audio
    'audio/mpeg', 'audio/wav', 'audio/ogg',
    // Code files
    'text/javascript', 'text/typescript', 'text/css', 'text/html', 'application/json',
    // Archives
    'application/zip', 'application/x-rar-compressed'
  ]

  /**
   * Configure Supabase Storage buckets with proper security policies
   */
  static async initializeBuckets(): Promise<void> {
    try {
      // Check if bucket exists
      const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets()
      
      if (listError) {
        throw new Error(`Failed to list buckets: ${listError.message}`)
      }

      const bucketExists = buckets?.some(bucket => bucket.name === this.BUCKET_NAME)

      if (!bucketExists) {
        // Create the assets bucket
        const { error: createError } = await supabaseAdmin.storage.createBucket(this.BUCKET_NAME, {
          public: false, // Files are private by default
          allowedMimeTypes: this.ALLOWED_TYPES,
          fileSizeLimit: this.MAX_FILE_SIZE
        })

        if (createError) {
          throw new Error(`Failed to create bucket: ${createError.message}`)
        }
      }

      console.log(`Storage bucket '${this.BUCKET_NAME}' initialized successfully`)
    } catch (error) {
      console.error('Failed to initialize storage buckets:', error)
      throw error
    }
  }

  /**
   * Validate file before upload
   */
  static validateFile(file: File): FileValidationResult {
    const errors: string[] = []

    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      errors.push(`File size exceeds maximum limit of ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`)
    }

    // Check file type
    if (!this.ALLOWED_TYPES.includes(file.type)) {
      errors.push(`File type '${file.type}' is not allowed`)
    }

    // Check file name
    if (!file.name || file.name.trim() === '') {
      errors.push('File name is required')
    }

    // Check for potentially dangerous file extensions
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com']
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'))
    if (dangerousExtensions.includes(fileExtension)) {
      errors.push(`File extension '${fileExtension}' is not allowed for security reasons`)
    }

    return {
      isValid: errors.length === 0,
      errors,
      metadata: {
        size: file.size,
        type: file.type,
        name: file.name,
        lastModified: file.lastModified
      }
    }
  }

  /**
   * Generate secure file path
   */
  static generateFilePath(projectId: string, folderId: string | null, fileName: string): string {
    const timestamp = Date.now()
    const randomId = Math.random().toString(36).substring(2, 15)
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    
    const folderPath = folderId ? `${folderId}/` : ''
    return `projects/${projectId}/${folderPath}${timestamp}_${randomId}_${sanitizedFileName}`
  }

  /**
   * Upload file with chunked upload support for large files
   */
  static async uploadFile(options: UploadOptions): Promise<UploadResult> {
    try {
      const { file, bucket, path, onProgress, chunkSize = this.CHUNK_SIZE } = options

      // Validate file first
      const validation = this.validateFile(file)
      if (!validation.isValid) {
        return {
          success: false,
          error: validation.errors.join(', ')
        }
      }

      // For small files, use regular upload
      if (file.size <= chunkSize) {
        return await this.uploadSmallFile(bucket, path, file, onProgress)
      }

      // For large files, use chunked upload
      return await this.uploadLargeFile(bucket, path, file, chunkSize, onProgress)
    } catch (error) {
      console.error('Upload failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      }
    }
  }

  /**
   * Upload small files directly
   */
  private static async uploadSmallFile(
    bucket: string, 
    path: string, 
    file: File, 
    onProgress?: (progress: number) => void
  ): Promise<UploadResult> {
    onProgress?.(0)

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: false
      })

    onProgress?.(100)

    if (error) {
      return {
        success: false,
        error: error.message
      }
    }

    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(path)

    return {
      success: true,
      data: {
        path: data.path,
        fullPath: data.fullPath,
        publicUrl: urlData.publicUrl
      }
    }
  }

  /**
   * Upload large files with chunking
   */
  private static async uploadLargeFile(
    bucket: string,
    path: string,
    file: File,
    chunkSize: number,
    onProgress?: (progress: number) => void
  ): Promise<UploadResult> {
    const totalChunks = Math.ceil(file.size / chunkSize)
    let uploadedBytes = 0

    try {
      // For now, we'll use the regular upload as Supabase doesn't have native chunked upload
      // In a production environment, you might want to implement this with a custom solution
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(path, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (error) {
        return {
          success: false,
          error: error.message
        }
      }

      onProgress?.(100)

      const { data: urlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(path)

      return {
        success: true,
        data: {
          path: data.path,
          fullPath: data.fullPath,
          publicUrl: urlData.publicUrl
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Chunked upload failed'
      }
    }
  }

  /**
   * Generate secure, time-limited access URL
   */
  static async getSignedUrl(path: string, expiresIn: number = 3600): Promise<string | null> {
    try {
      const { data, error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .createSignedUrl(path, expiresIn)

      if (error) {
        console.error('Failed to generate signed URL:', error)
        return null
      }

      return data.signedUrl
    } catch (error) {
      console.error('Failed to generate signed URL:', error)
      return null
    }
  }

  /**
   * Delete file from storage
   */
  static async deleteFile(path: string): Promise<boolean> {
    try {
      const { error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .remove([path])

      if (error) {
        console.error('Failed to delete file:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('Failed to delete file:', error)
      return false
    }
  }

  /**
   * List files in a directory
   */
  static async listFiles(path: string = '') {
    try {
      const { data, error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .list(path)

      if (error) {
        console.error('Failed to list files:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Failed to list files:', error)
      return null
    }
  }

  /**
   * Get file metadata
   */
  static async getFileMetadata(path: string) {
    try {
      const { data, error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .list('', {
          search: path
        })

      if (error) {
        console.error('Failed to get file metadata:', error)
        return null
      }

      return data?.[0] || null
    } catch (error) {
      console.error('Failed to get file metadata:', error)
      return null
    }
  }
}