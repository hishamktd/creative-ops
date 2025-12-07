export interface LazyLoadOptions {
  rootMargin?: string
  threshold?: number | number[]
  placeholder?: string
  fadeInDuration?: number
  retryAttempts?: number
  retryDelay?: number
}

export interface LazyLoadResult {
  loaded: boolean
  error?: string
  element?: HTMLElement
}

export class LazyLoadingService {
  private static observers = new Map<string, IntersectionObserver>()
  private static loadedImages = new Set<string>()
  private static loadingImages = new Map<string, Promise<LazyLoadResult>>()
  
  private static readonly DEFAULT_OPTIONS: LazyLoadOptions = {
    rootMargin: '50px',
    threshold: 0.1,
    fadeInDuration: 300,
    retryAttempts: 3,
    retryDelay: 1000
  }

  /**
   * Initialize lazy loading for images
   */
  static initializeLazyLoading(
    container?: HTMLElement,
    options: LazyLoadOptions = {}
  ): () => void {
    if (typeof window === 'undefined') {
      return () => {}
    }

    const config = { ...this.DEFAULT_OPTIONS, ...options }
    const observerId = Math.random().toString(36).substring(7)

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement
            this.loadImage(img, config)
            observer.unobserve(img)
          }
        })
      },
      {
        rootMargin: config.rootMargin,
        threshold: config.threshold,
        root: container || null
      }
    )

    this.observers.set(observerId, observer)

    // Observe all images with data-src attribute
    const images = (container || document).querySelectorAll('img[data-src]')
    images.forEach((img) => observer.observe(img))

    // Return cleanup function
    return () => {
      observer.disconnect()
      this.observers.delete(observerId)
    }
  }

  /**
   * Load individual image with progressive enhancement
   */
  static async loadImage(
    img: HTMLImageElement,
    options: LazyLoadOptions = {}
  ): Promise<LazyLoadResult> {
    const config = { ...this.DEFAULT_OPTIONS, ...options }
    const src = img.dataset.src

    if (!src) {
      return { loaded: false, error: 'No data-src attribute found' }
    }

    // Return existing promise if already loading
    if (this.loadingImages.has(src)) {
      return this.loadingImages.get(src)!
    }

    // Return success if already loaded
    if (this.loadedImages.has(src)) {
      return { loaded: true, element: img }
    }

    const loadPromise = this.performImageLoad(img, src, config)
    this.loadingImages.set(src, loadPromise)

    try {
      const result = await loadPromise
      if (result.loaded) {
        this.loadedImages.add(src)
      }
      return result
    } finally {
      this.loadingImages.delete(src)
    }
  }

  /**
   * Perform the actual image loading with retries
   */
  private static async performImageLoad(
    img: HTMLImageElement,
    src: string,
    config: LazyLoadOptions
  ): Promise<LazyLoadResult> {
    let lastError: string | undefined

    for (let attempt = 0; attempt < (config.retryAttempts || 3); attempt++) {
      try {
        await this.loadImageWithTimeout(img, src, 10000) // 10 second timeout
        
        // Apply fade-in effect
        if (config.fadeInDuration && config.fadeInDuration > 0) {
          this.applyFadeInEffect(img, config.fadeInDuration)
        }

        return { loaded: true, element: img }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error'
        
        if (attempt < (config.retryAttempts || 3) - 1) {
          await this.delay(config.retryDelay || 1000)
        }
      }
    }

    // Load placeholder on final failure
    if (config.placeholder) {
      try {
        await this.loadImageWithTimeout(img, config.placeholder, 5000)
      } catch {
        // Ignore placeholder load errors
      }
    }

    return { loaded: false, error: lastError, element: img }
  }

  /**
   * Load image with timeout
   */
  private static loadImageWithTimeout(
    img: HTMLImageElement,
    src: string,
    timeout: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Image load timeout'))
      }, timeout)

      const onLoad = () => {
        clearTimeout(timeoutId)
        img.removeEventListener('load', onLoad)
        img.removeEventListener('error', onError)
        resolve()
      }

      const onError = () => {
        clearTimeout(timeoutId)
        img.removeEventListener('load', onLoad)
        img.removeEventListener('error', onError)
        reject(new Error('Image load failed'))
      }

      img.addEventListener('load', onLoad)
      img.addEventListener('error', onError)
      img.src = src
    })
  }

  /**
   * Apply fade-in effect to loaded image
   */
  private static applyFadeInEffect(img: HTMLImageElement, duration: number): void {
    img.style.opacity = '0'
    img.style.transition = `opacity ${duration}ms ease-in-out`
    
    // Force reflow
    img.offsetHeight
    
    img.style.opacity = '1'
  }

  /**
   * Preload critical images
   */
  static async preloadCriticalImages(urls: string[]): Promise<void> {
    const promises = urls.map(url => this.preloadSingleImage(url))
    await Promise.allSettled(promises)
  }

  /**
   * Preload single image
   */
  private static preloadSingleImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.loadedImages.has(url)) {
        resolve()
        return
      }

      const img = new Image()
      img.onload = () => {
        this.loadedImages.add(url)
        resolve()
      }
      img.onerror = reject
      img.src = url
    })
  }

  /**
   * Generate low-quality image placeholder (LQIP)
   */
  static generateLQIP(
    originalUrl: string,
    width: number = 20,
    quality: number = 10
  ): string {
    // This would typically use a service like Cloudinary or custom implementation
    // For now, return a simple placeholder
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="${width}" height="${Math.round(width * 0.6)}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f0f0f0"/>
        <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#999" font-size="12">Loading...</text>
      </svg>
    `)}`
  }

  /**
   * Create progressive image loading component data
   */
  static createProgressiveImageData(
    originalUrl: string,
    thumbnailUrl?: string,
    blurHash?: string
  ): {
    placeholder: string
    lowQuality: string
    highQuality: string
  } {
    return {
      placeholder: blurHash || this.generateLQIP(originalUrl),
      lowQuality: thumbnailUrl || originalUrl,
      highQuality: originalUrl
    }
  }

  /**
   * Cleanup loaded images cache
   */
  static clearCache(): void {
    this.loadedImages.clear()
    this.loadingImages.clear()
  }

  /**
   * Get loading statistics
   */
  static getStats(): {
    loadedCount: number
    loadingCount: number
    observerCount: number
  } {
    return {
      loadedCount: this.loadedImages.size,
      loadingCount: this.loadingImages.size,
      observerCount: this.observers.size
    }
  }

  /**
   * Utility delay function
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Check if image is in viewport
   */
  static isInViewport(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect()
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    )
  }

  /**
   * Batch load visible images
   */
  static async loadVisibleImages(container?: HTMLElement): Promise<LazyLoadResult[]> {
    const images = (container || document).querySelectorAll('img[data-src]') as NodeListOf<HTMLImageElement>
    const visibleImages = Array.from(images).filter(img => this.isInViewport(img))
    
    const loadPromises = visibleImages.map(img => this.loadImage(img))
    return Promise.all(loadPromises)
  }
}