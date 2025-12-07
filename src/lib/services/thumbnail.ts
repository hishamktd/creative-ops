import { StorageService } from './storage'

export interface ThumbnailOptions {
  width?: number
  height?: number
  quality?: number
  format?: 'jpeg' | 'png' | 'webp'
}

export interface ThumbnailResult {
  success: boolean
  thumbnailUrl?: string
  error?: string
}

export class ThumbnailService {
  private static readonly DEFAULT_THUMBNAIL_SIZE = 300
  private static readonly DEFAULT_QUALITY = 80
  private static readonly SUPPORTED_IMAGE_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp'
  ]
  private static readonly SUPPORTED_VIDEO_TYPES = [
    'video/mp4', 'video/webm', 'video/mov', 'video/avi'
  ]

  /**
   * Generate thumbnail for uploaded asset
   */
  static async generateThumbnail(
    file: File,
    originalPath: string,
    options: ThumbnailOptions = {}
  ): Promise<ThumbnailResult> {
    try {
      const {
        width = this.DEFAULT_THUMBNAIL_SIZE,
        height = this.DEFAULT_THUMBNAIL_SIZE,
        quality = this.DEFAULT_QUALITY,
        format = 'jpeg'
      } = options

      if (this.SUPPORTED_IMAGE_TYPES.includes(file.type)) {
        return await this.generateImageThumbnail(file, originalPath, { width, height, quality, format })
      }

      if (this.SUPPORTED_VIDEO_TYPES.includes(file.type)) {
        return await this.generateVideoThumbnail(file, originalPath, { width, height, quality, format })
      }

      // For unsupported types, return a default thumbnail or no thumbnail
      return {
        success: false,
        error: `Thumbnail generation not supported for file type: ${file.type}`
      }
    } catch (error) {
      console.error('Thumbnail generation failed:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Thumbnail generation failed'
      }
    }
  }

  /**
   * Generate thumbnail for image files
   */
  private static async generateImageThumbnail(
    file: File,
    originalPath: string,
    options: Required<ThumbnailOptions>
  ): Promise<ThumbnailResult> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      const img = new Image()

      img.onload = async () => {
        try {
          // Calculate dimensions maintaining aspect ratio
          const { width: targetWidth, height: targetHeight } = this.calculateThumbnailDimensions(
            img.width,
            img.height,
            options.width,
            options.height
          )

          canvas.width = targetWidth
          canvas.height = targetHeight

          // Draw and resize image
          ctx?.drawImage(img, 0, 0, targetWidth, targetHeight)

          // Convert to blob
          canvas.toBlob(async (blob) => {
            if (!blob) {
              resolve({
                success: false,
                error: 'Failed to generate thumbnail blob'
              })
              return
            }

            // Create thumbnail file
            const thumbnailFile = new File([blob], `thumb_${file.name}`, {
              type: `image/${options.format}`
            })

            // Generate thumbnail path
            const thumbnailPath = this.generateThumbnailPath(originalPath)

            // Upload thumbnail
            const uploadResult = await StorageService.uploadFile({
              bucket: 'assets',
              path: thumbnailPath,
              file: thumbnailFile
            })

            if (uploadResult.success && uploadResult.data) {
              resolve({
                success: true,
                thumbnailUrl: uploadResult.data.publicUrl
              })
            } else {
              resolve({
                success: false,
                error: uploadResult.error || 'Failed to upload thumbnail'
              })
            }
          }, `image/${options.format}`, options.quality / 100)
        } catch (error) {
          resolve({
            success: false,
            error: error instanceof Error ? error.message : 'Image processing failed'
          })
        }
      }

      img.onerror = () => {
        resolve({
          success: false,
          error: 'Failed to load image for thumbnail generation'
        })
      }

      // Load image from file
      const reader = new FileReader()
      reader.onload = (e) => {
        if (e.target?.result) {
          img.src = e.target.result as string
        }
      }
      reader.readAsDataURL(file)
    })
  }

  /**
   * Generate thumbnail for video files
   */
  private static async generateVideoThumbnail(
    file: File,
    originalPath: string,
    options: Required<ThumbnailOptions>
  ): Promise<ThumbnailResult> {
    return new Promise((resolve) => {
      const video = document.createElement('video')
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      video.onloadedmetadata = () => {
        // Seek to 10% of video duration for thumbnail
        video.currentTime = video.duration * 0.1
      }

      video.onseeked = async () => {
        try {
          // Calculate dimensions maintaining aspect ratio
          const { width: targetWidth, height: targetHeight } = this.calculateThumbnailDimensions(
            video.videoWidth,
            video.videoHeight,
            options.width,
            options.height
          )

          canvas.width = targetWidth
          canvas.height = targetHeight

          // Draw video frame to canvas
          ctx?.drawImage(video, 0, 0, targetWidth, targetHeight)

          // Convert to blob
          canvas.toBlob(async (blob) => {
            if (!blob) {
              resolve({
                success: false,
                error: 'Failed to generate video thumbnail blob'
              })
              return
            }

            // Create thumbnail file
            const thumbnailFile = new File([blob], `thumb_${file.name}.${options.format}`, {
              type: `image/${options.format}`
            })

            // Generate thumbnail path
            const thumbnailPath = this.generateThumbnailPath(originalPath)

            // Upload thumbnail
            const uploadResult = await StorageService.uploadFile({
              bucket: 'assets',
              path: thumbnailPath,
              file: thumbnailFile
            })

            if (uploadResult.success && uploadResult.data) {
              resolve({
                success: true,
                thumbnailUrl: uploadResult.data.publicUrl
              })
            } else {
              resolve({
                success: false,
                error: uploadResult.error || 'Failed to upload video thumbnail'
              })
            }
          }, `image/${options.format}`, options.quality / 100)
        } catch (error) {
          resolve({
            success: false,
            error: error instanceof Error ? error.message : 'Video processing failed'
          })
        }
      }

      video.onerror = () => {
        resolve({
          success: false,
          error: 'Failed to load video for thumbnail generation'
        })
      }

      // Load video from file
      const url = URL.createObjectURL(file)
      video.src = url
      video.load()
    })
  }

  /**
   * Calculate thumbnail dimensions maintaining aspect ratio
   */
  private static calculateThumbnailDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    const aspectRatio = originalWidth / originalHeight

    let width = maxWidth
    let height = maxHeight

    if (aspectRatio > 1) {
      // Landscape
      height = width / aspectRatio
      if (height > maxHeight) {
        height = maxHeight
        width = height * aspectRatio
      }
    } else {
      // Portrait or square
      width = height * aspectRatio
      if (width > maxWidth) {
        width = maxWidth
        height = width / aspectRatio
      }
    }

    return {
      width: Math.round(width),
      height: Math.round(height)
    }
  }

  /**
   * Generate thumbnail file path
   */
  private static generateThumbnailPath(originalPath: string): string {
    const pathParts = originalPath.split('/')
    const fileName = pathParts.pop() || ''
    const directory = pathParts.join('/')
    
    const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.')) || fileName
    return `${directory}/thumbnails/thumb_${nameWithoutExt}.jpeg`
  }

  /**
   * Delete thumbnail when original file is deleted
   */
  static async deleteThumbnail(originalPath: string): Promise<boolean> {
    try {
      const thumbnailPath = this.generateThumbnailPath(originalPath)
      return await StorageService.deleteFile(thumbnailPath)
    } catch (error) {
      console.error('Failed to delete thumbnail:', error)
      return false
    }
  }
}