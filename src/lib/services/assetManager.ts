import { StorageService, UploadResult } from './storage'
import { ThumbnailService, ThumbnailResult } from './thumbnail'
import { FileValidationService, ValidationResult } from './fileValidation'
import { MetadataExtractionService } from './metadataExtraction'
import { TaggingService } from './taggingService'
import { TextExtractionService } from './textExtraction'
import { ErrorHandlingService, ErrorType, ErrorSeverity } from './errorHandling'
import { supabase } from '../supabase/client'

export interface AssetUploadOptions {
  projectId: string
  folderId?: string
  file: File
  onProgress?: (progress: number) => void
  onValidation?: (result: ValidationResult) => void
  generateThumbnail?: boolean
  resumeFrom?: number
}

export interface AssetUploadResult {
  success: boolean
  asset?: EnhancedAsset
  validation?: ValidationResult
  error?: string
}

export interface EnhancedAsset {
  id: string
  project_id: string
  folder_id?: string
  name: string
  description?: string
  file_url: string
  file_path: string
  file_type: string
  file_size: number
  version: number
  thumbnail_url?: string
  preview_url?: string
  metadata: AssetMetadata
  tags: string[]
  status: 'processing' | 'ready' | 'error'
  uploaded_by: string
  created_at: string
  updated_at: string
  last_accessed_at?: string
  access_count: number
  checksum: string
}

export interface AssetMetadata {
  width?: number
  height?: number
  duration?: number
  pages?: number
  color_profile?: string
  camera_info?: CameraInfo
  extracted_text?: string
  original_name: string
  mime_type: string
}

export interface CameraInfo {
  make?: string
  model?: string
  lens?: string
  focal_length?: string
  aperture?: string
  iso?: string
  shutter_speed?: string
  flash?: string
  gps?: {
    latitude?: number
    longitude?: number
  }
}

export class AssetManagerService {
  /**
   * Upload and process a new asset with comprehensive error handling
   */
  static async uploadAsset(options: AssetUploadOptions): Promise<AssetUploadResult> {
    const { projectId, folderId, file, onProgress, onValidation, generateThumbnail = true, resumeFrom } = options

    const context = {
      operation: 'asset_upload',
      projectId,
      folderId,
      fileName: file.name,
      fileSize: file.size
    }

    return await ErrorHandlingService.handleError(
      async () => {
        // Step 1: Validate file with enhanced security checks
        onProgress?.(5)
        const validation = await FileValidationService.validateAndScanAsset(file, '', {
          enableRealTimeScanning: true,
          quarantineThreats: true
        })
        onValidation?.(validation)

        if (!validation.isValid) {
          throw ErrorHandlingService.createError(
            ErrorType.VALIDATION,
            'FILE_VALIDATION_FAILED',
            validation.errors.join(', '),
            context,
            ErrorSeverity.MEDIUM
          )
        }

        // Check for security threats
        if (validation.securityFlags.some(flag => flag.severity === 'critical')) {
          throw ErrorHandlingService.createError(
            ErrorType.SECURITY,
            'SECURITY_THREAT_DETECTED',
            'File contains security threats and cannot be uploaded',
            context,
            ErrorSeverity.CRITICAL
          )
        }

        // Step 2: Generate file path
        onProgress?.(10)
        const filePath = StorageService.generateFilePath(projectId, folderId, file.name)

        // Step 3: Upload file to storage with recovery support
        onProgress?.(15)
        const uploadResult = await ErrorHandlingService.handleUploadWithRecovery(
          async (resumeFromByte = resumeFrom) => {
            return await StorageService.uploadFile({
              bucket: 'assets',
              path: filePath,
              file,
              onProgress: (uploadProgress) => {
                // Map upload progress to 15-70% of total progress
                const totalProgress = 15 + (uploadProgress * 0.55)
                onProgress?.(totalProgress)
              }
            })
          },
          { ...context, fileSize: file.size },
          onProgress
        )

        if (!uploadResult.success || !uploadResult.data?.data) {
          throw ErrorHandlingService.createError(
            ErrorType.STORAGE,
            'UPLOAD_FAILED',
            uploadResult.error?.userMessage || 'File upload failed',
            context,
            ErrorSeverity.HIGH
          )
        }

        // Step 4: Generate thumbnail with error handling
        onProgress?.(70)
        let thumbnailUrl: string | undefined
        if (generateThumbnail) {
          try {
            const thumbnailResult = await ThumbnailService.generateThumbnail(file, filePath)
            if (thumbnailResult.success) {
              thumbnailUrl = thumbnailResult.thumbnailUrl
            }
          } catch (error) {
            // Thumbnail generation failure is not critical - log and continue
            console.warn('Thumbnail generation failed:', error)
          }
        }

        // Step 5: Extract comprehensive metadata with error handling
        onProgress?.(80)
        let metadata: AssetMetadata
        try {
          const metadataResult = await MetadataExtractionService.extractMetadata(file)
          metadata = metadataResult.metadata
        } catch (error) {
          // Use basic metadata if extraction fails
          metadata = {
            original_name: file.name,
            mime_type: file.type
          }
          console.warn('Metadata extraction failed, using basic metadata:', error)
        }

        // Step 5.1: Extract text content for search indexing
        try {
          const textResult = await TextExtractionService.extractText(file)
          if (textResult.success && textResult.text) {
            metadata.extracted_text = textResult.text
          }
        } catch (error) {
          console.warn('Text extraction failed:', error)
        }

        // Step 5.2: Generate automatic tags
        let autoTags: string[] = []
        try {
          autoTags = TaggingService.generateAutoTags ? 
            TaggingService.generateAutoTags(file, metadata) : []
        } catch (error) {
          console.warn('Auto-tagging failed:', error)
        }

        // Step 6: Create asset record in database with transaction
        onProgress?.(90)
        const asset = await this.createAssetRecordWithRetry({
          projectId,
          folderId,
          file,
          filePath,
          fileUrl: uploadResult.data.data.publicUrl,
          thumbnailUrl,
          metadata,
          autoTags,
          checksum: validation.metadata.checksum || ''
        })

        if (!asset) {
          // Clean up uploaded files if database creation fails
          await this.cleanupFailedUpload(filePath, thumbnailUrl)
          
          throw ErrorHandlingService.createError(
            ErrorType.STORAGE,
            'DATABASE_CREATION_FAILED',
            'Failed to create asset record in database',
            context,
            ErrorSeverity.HIGH
          )
        }

        onProgress?.(100)

        return {
          success: true,
          asset,
          validation
        }
      },
      context
    ).then(result => {
      if (result.success) {
        return result.data!
      } else {
        return {
          success: false,
          error: result.error!.userMessage
        }
      }
    })
  }

  /**
   * Create asset record in database with retry logic
   */
  private static async createAssetRecordWithRetry(params: {
    projectId: string
    folderId?: string
    file: File
    filePath: string
    fileUrl: string
    thumbnailUrl?: string
    metadata: AssetMetadata
    autoTags: string[]
    checksum: string
  }): Promise<EnhancedAsset | null> {
    const context = {
      operation: 'create_asset_record',
      projectId: params.projectId,
      fileName: params.file.name
    }

    const result = await ErrorHandlingService.handleError(
      async () => {
        const { data: user } = await supabase.auth.getUser()
        if (!user.user) {
          throw ErrorHandlingService.createError(
            ErrorType.AUTHENTICATION,
            'USER_NOT_AUTHENTICATED',
            'User not authenticated',
            context,
            ErrorSeverity.HIGH
          )
        }

        const assetData = {
          project_id: params.projectId,
          folder_id: params.folderId || null,
          name: params.file.name,
          file_url: params.fileUrl,
          file_path: params.filePath,
          file_type: params.file.type,
          file_size: params.file.size,
          version: 1,
          thumbnail_url: params.thumbnailUrl || null,
          metadata: params.metadata,
          tags: params.autoTags,
          status: 'ready' as const,
          uploaded_by: user.user.id,
          access_count: 0,
          checksum: params.checksum
        }

        const { data, error } = await supabase
          .from('assets')
          .insert(assetData)
          .select()
          .single()

        if (error) {
          throw ErrorHandlingService.createError(
            ErrorType.STORAGE,
            'DATABASE_INSERT_FAILED',
            error.message,
            context,
            ErrorSeverity.HIGH,
            JSON.stringify(error)
          )
        }

        return data as EnhancedAsset
      },
      context,
      {
        maxAttempts: 3,
        baseDelay: 1000,
        retryableErrors: [ErrorType.NETWORK, ErrorType.STORAGE]
      }
    )

    return result.success ? result.data! : null
  }

  /**
   * Clean up files after failed upload
   */
  private static async cleanupFailedUpload(filePath: string, thumbnailUrl?: string): Promise<void> {
    try {
      // Delete main file
      await StorageService.deleteFile(filePath)
      
      // Delete thumbnail if exists
      if (thumbnailUrl) {
        await ThumbnailService.deleteThumbnail(filePath)
      }
    } catch (error) {
      console.warn('Failed to cleanup files after failed upload:', error)
    }
  }



  /**
   * Get asset by ID with access tracking
   */
  static async getAsset(assetId: string): Promise<EnhancedAsset | null> {
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('id', assetId)
        .single()

      if (error || !data) {
        return null
      }

      // Update access tracking
      await this.trackAssetAccess(assetId)

      return data as EnhancedAsset
    } catch (error) {
      console.error('Failed to get asset:', error)
      return null
    }
  }

  /**
   * Track asset access for analytics
   */
  private static async trackAssetAccess(assetId: string): Promise<void> {
    try {
      await supabase
        .from('assets')
        .update({
          last_accessed_at: new Date().toISOString(),
          access_count: supabase.sql`access_count + 1`
        })
        .eq('id', assetId)
    } catch (error) {
      console.warn('Failed to track asset access:', error)
    }
  }

  /**
   * Delete asset and associated files
   */
  static async deleteAsset(assetId: string): Promise<boolean> {
    try {
      const asset = await this.getAsset(assetId)
      if (!asset) {
        return false
      }

      // Delete from storage
      await StorageService.deleteFile(asset.file_path)
      
      // Delete thumbnail if exists
      if (asset.thumbnail_url) {
        await ThumbnailService.deleteThumbnail(asset.file_path)
      }

      // Delete from database
      const { error } = await supabase
        .from('assets')
        .delete()
        .eq('id', assetId)

      return !error
    } catch (error) {
      console.error('Failed to delete asset:', error)
      return false
    }
  }

  /**
   * Generate secure download URL
   */
  static async getDownloadUrl(assetId: string, expiresIn: number = 3600): Promise<string | null> {
    try {
      const asset = await this.getAsset(assetId)
      if (!asset) {
        return null
      }

      return await StorageService.getSignedUrl(asset.file_path, expiresIn)
    } catch (error) {
      console.error('Failed to generate download URL:', error)
      return null
    }
  }

  /**
   * Update asset metadata
   */
  static async updateAssetMetadata(
    assetId: string, 
    updates: Partial<Pick<EnhancedAsset, 'name' | 'description' | 'tags' | 'metadata'>>
  ): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('assets')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', assetId)

      return !error
    } catch (error) {
      console.error('Failed to update asset metadata:', error)
      return false
    }
  }
}