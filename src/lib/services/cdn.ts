import { supabase } from '../supabase/client'

export interface CDNOptions {
  width?: number
  height?: number
  quality?: number
  format?: 'auto' | 'webp' | 'jpeg' | 'png'
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
  blur?: number
  sharpen?: boolean
}

export interface OptimizedImageResult {
  url: string
  width?: number
  height?: number
  format?: string
  size?: number
}

export class CDNService {
  private static readonly CDN_BASE_URL = process.env.NEXT_PUBLIC_CDN_URL || ''
  private static readonly SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  
  /**
   * Generate optimized image URL with CDN transformations
   */
  static getOptimizedImageUrl(
    originalUrl: string, 
    options: CDNOptions = {}
  ): string {
    const {
      width,
      height,
      quality = 80,
      format = 'auto',
      fit = 'cover',
      blur,
      sharpen = false
    } = options

    // If CDN is configured, use it for transformations
    if (this.CDN_BASE_URL) {
      return this.buildCDNUrl(originalUrl, options)
    }

    // Fallback to Supabase transformations if available
    if (originalUrl.includes(this.SUPABASE_URL)) {
      return this.buildSupabaseTransformUrl(originalUrl, options)
    }

    // Return original URL if no optimization available
    return originalUrl
  }

  /**
   * Build CDN URL with transformations (for services like Cloudinary, ImageKit, etc.)
   */
  private static buildCDNUrl(originalUrl: string, options: CDNOptions): string {
    const params = new URLSearchParams()
    
    if (options.width) params.set('w', options.width.toString())
    if (options.height) params.set('h', options.height.toString())
    if (options.quality) params.set('q', options.quality.toString())
    if (options.format && options.format !== 'auto') params.set('f', options.format)
    if (options.fit) params.set('fit', options.fit)
    if (options.blur) params.set('blur', options.blur.toString())
    if (options.sharpen) params.set('sharpen', 'true')

    const transformParams = params.toString()
    return transformParams ? `${this.CDN_BASE_URL}/${transformParams}/${encodeURIComponent(originalUrl)}` : originalUrl
  }

  /**
   * Build Supabase transform URL (limited transformations)
   */
  private static buildSupabaseTransformUrl(originalUrl: string, options: CDNOptions): string {
    const url = new URL(originalUrl)
    const params = new URLSearchParams()

    if (options.width) params.set('width', options.width.toString())
    if (options.height) params.set('height', options.height.toString())
    if (options.quality) params.set('quality', options.quality.toString())

    const transformParams = params.toString()
    if (transformParams) {
      url.search = transformParams
    }

    return url.toString()
  }

  /**
   * Generate responsive image URLs for different screen sizes
   */
  static getResponsiveImageUrls(originalUrl: string): {
    small: string
    medium: string
    large: string
    xlarge: string
  } {
    return {
      small: this.getOptimizedImageUrl(originalUrl, { width: 480, quality: 75 }),
      medium: this.getOptimizedImageUrl(originalUrl, { width: 768, quality: 80 }),
      large: this.getOptimizedImageUrl(originalUrl, { width: 1200, quality: 85 }),
      xlarge: this.getOptimizedImageUrl(originalUrl, { width: 1920, quality: 90 })
    }
  }

  /**
   * Generate thumbnail URL with optimal settings
   */
  static getThumbnailUrl(originalUrl: string, size: number = 300): string {
    return this.getOptimizedImageUrl(originalUrl, {
      width: size,
      height: size,
      quality: 75,
      format: 'webp',
      fit: 'cover'
    })
  }

  /**
   * Preload critical images for better performance
   */
  static preloadImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve()
      img.onerror = reject
      img.src = url
    })
  }

  /**
   * Preload multiple images with priority
   */
  static async preloadImages(urls: string[], maxConcurrent: number = 3): Promise<void> {
    const chunks = []
    for (let i = 0; i < urls.length; i += maxConcurrent) {
      chunks.push(urls.slice(i, i + maxConcurrent))
    }

    for (const chunk of chunks) {
      await Promise.allSettled(chunk.map(url => this.preloadImage(url)))
    }
  }

  /**
   * Get optimal image format based on browser support
   */
  static getOptimalFormat(): 'webp' | 'jpeg' {
    if (typeof window === 'undefined') return 'jpeg'
    
    // Check WebP support
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    
    return canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0 ? 'webp' : 'jpeg'
  }

  /**
   * Calculate image dimensions for lazy loading placeholder
   */
  static calculatePlaceholderDimensions(
    originalWidth: number, 
    originalHeight: number, 
    maxWidth: number = 20
  ): { width: number; height: number } {
    const aspectRatio = originalWidth / originalHeight
    const width = Math.min(maxWidth, originalWidth)
    const height = Math.round(width / aspectRatio)
    
    return { width, height }
  }
}