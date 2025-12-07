'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { CDNService } from '@/lib/services/cdn'
import { LazyLoadingService } from '@/lib/services/lazyLoading'
import { PerformanceMonitoringService } from '@/lib/services/performanceMonitoring'
import { useRenderPerformance, useVisibilityTracking } from '@/lib/hooks/usePerformance'

interface PerformanceOptimizedImageProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  priority?: boolean
  quality?: number
  placeholder?: 'blur' | 'empty'
  blurDataURL?: string
  sizes?: string
  onLoad?: () => void
  onError?: (error: Error) => void
  lazy?: boolean
}

export function PerformanceOptimizedImage({
  src,
  alt,
  width,
  height,
  className = '',
  priority = false,
  quality = 80,
  placeholder = 'empty',
  blurDataURL,
  sizes,
  onLoad,
  onError,
  lazy = true
}: PerformanceOptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [currentSrc, setCurrentSrc] = useState<string>('')
  
  const imgRef = useRef<HTMLImageElement>(null)
  const loadStartTime = useRef<number>(0)
  
  // Performance tracking
  const { startRender, endRender } = useRenderPerformance('PerformanceOptimizedImage')
  const { isVisible } = useVisibilityTracking(imgRef, 'optimized-image')

  // Generate optimized image URLs
  const optimizedSrc = CDNService.getOptimizedImageUrl(src, {
    width,
    height,
    quality,
    format: 'auto'
  })

  const responsiveUrls = CDNService.getResponsiveImageUrls(src)
  const thumbnailUrl = CDNService.getThumbnailUrl(src, 20) // Low quality placeholder

  // Generate srcSet for responsive images
  const srcSet = sizes ? [
    `${responsiveUrls.small} 480w`,
    `${responsiveUrls.medium} 768w`,
    `${responsiveUrls.large} 1200w`,
    `${responsiveUrls.xlarge} 1920w`
  ].join(', ') : undefined

  // Handle image loading
  const handleLoad = useCallback(() => {
    const loadTime = performance.now() - loadStartTime.current
    
    setIsLoaded(true)
    setIsLoading(false)
    
    // Track performance
    PerformanceMonitoringService.trackImageLoad(
      currentSrc,
      loadTime,
      0, // Size would need to be determined from the image
      true
    )
    
    onLoad?.()
  }, [currentSrc, onLoad])

  const handleError = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
    const loadTime = performance.now() - loadStartTime.current
    const errorObj = new Error(`Failed to load image: ${currentSrc}`)
    
    setError(errorObj)
    setIsLoading(false)
    
    // Track error
    PerformanceMonitoringService.trackImageLoad(
      currentSrc,
      loadTime,
      0,
      false
    )
    
    onError?.(errorObj)
  }, [currentSrc, onError])

  // Load image when visible (lazy loading)
  useEffect(() => {
    if (!lazy || priority || isVisible) {
      loadImage()
    }
  }, [lazy, priority, isVisible])

  // Preload critical images
  useEffect(() => {
    if (priority) {
      CDNService.preloadImage(optimizedSrc).catch(console.warn)
    }
  }, [priority, optimizedSrc])

  const loadImage = useCallback(async () => {
    if (isLoading || isLoaded) return

    setIsLoading(true)
    setError(null)
    loadStartTime.current = performance.now()
    setCurrentSrc(optimizedSrc)

    if (imgRef.current) {
      try {
        await LazyLoadingService.loadImage(imgRef.current, {
          fadeInDuration: 300,
          retryAttempts: 3,
          retryDelay: 1000
        })
      } catch (error) {
        console.warn('Lazy loading failed:', error)
      }
    }
  }, [isLoading, isLoaded, optimizedSrc])

  // Progressive loading: start with thumbnail, then load full image
  const progressiveLoad = useCallback(async () => {
    if (placeholder === 'blur' && !isLoaded) {
      // First load low quality placeholder
      setCurrentSrc(blurDataURL || thumbnailUrl)
      
      // Then load full quality image
      setTimeout(() => {
        setCurrentSrc(optimizedSrc)
      }, 100)
    } else {
      setCurrentSrc(optimizedSrc)
    }
  }, [placeholder, isLoaded, blurDataURL, thumbnailUrl, optimizedSrc])

  useEffect(() => {
    progressiveLoad()
  }, [progressiveLoad])

  // Track render performance
  useEffect(() => {
    startRender()
    return () => endRender()
  })

  // Placeholder component
  const renderPlaceholder = () => {
    if (placeholder === 'empty') {
      return (
        <div 
          className={`bg-gray-200 animate-pulse ${className}`}
          style={{ width, height }}
        />
      )
    }

    if (placeholder === 'blur' && blurDataURL) {
      return (
        <img
          src={blurDataURL}
          alt=""
          className={`filter blur-sm transition-all duration-300 ${className}`}
          style={{ width, height }}
        />
      )
    }

    return null
  }

  // Error state
  if (error) {
    return (
      <div 
        className={`bg-gray-100 border border-gray-300 flex items-center justify-center ${className}`}
        style={{ width, height }}
      >
        <div className="text-center text-gray-500 p-4">
          <svg 
            className="w-8 h-8 mx-auto mb-2" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" 
            />
          </svg>
          <p className="text-sm">Failed to load image</p>
        </div>
      </div>
    )
  }

  // Loading state
  if (isLoading && !isLoaded) {
    return renderPlaceholder()
  }

  return (
    <div className="relative">
      {/* Placeholder shown while loading */}
      {!isLoaded && renderPlaceholder()}
      
      {/* Main image */}
      <img
        ref={imgRef}
        src={currentSrc}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        width={width}
        height={height}
        className={`transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        } ${className}`}
        onLoad={handleLoad}
        onError={handleError}
        loading={lazy && !priority ? 'lazy' : 'eager'}
        decoding="async"
        data-src={optimizedSrc} // For lazy loading service
        style={{
          position: isLoaded ? 'relative' : 'absolute',
          top: isLoaded ? 'auto' : 0,
          left: isLoaded ? 'auto' : 0
        }}
      />
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-75">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  )
}

// Higher-order component for performance optimization
export function withPerformanceOptimization<P extends object>(
  Component: React.ComponentType<P>
) {
  return React.memo((props: P) => {
    const { startRender, endRender } = useRenderPerformance(Component.displayName || 'Component')
    
    useEffect(() => {
      startRender()
      return () => endRender()
    })

    return <Component {...props} />
  })
}

// Optimized image gallery component
interface ImageGalleryProps {
  images: Array<{
    id: string
    src: string
    alt: string
    width?: number
    height?: number
  }>
  columns?: number
  gap?: number
  lazy?: boolean
}

export const PerformanceOptimizedImageGallery = React.memo(function ImageGallery({
  images,
  columns = 3,
  gap = 16,
  lazy = true
}: ImageGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [visibleImages, setVisibleImages] = useState<Set<string>>(new Set())
  
  // Track performance
  const { startRender, endRender } = useRenderPerformance('ImageGallery')
  
  useEffect(() => {
    startRender()
    return () => endRender()
  })

  // Intersection observer for progressive loading
  useEffect(() => {
    if (!lazy) {
      setVisibleImages(new Set(images.map(img => img.id)))
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const imageId = entry.target.getAttribute('data-image-id')
            if (imageId) {
              setVisibleImages(prev => new Set([...prev, imageId]))
            }
          }
        })
      },
      { rootMargin: '100px' }
    )

    const imageElements = containerRef.current?.querySelectorAll('[data-image-id]')
    imageElements?.forEach(el => observer.observe(el))

    return () => observer.disconnect()
  }, [images, lazy])

  // Preload first few images
  useEffect(() => {
    const firstImages = images.slice(0, Math.min(6, images.length))
    CDNService.preloadImages(
      firstImages.map(img => CDNService.getOptimizedImageUrl(img.src, { width: 300 })),
      3
    )
  }, [images])

  return (
    <div
      ref={containerRef}
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: `${gap}px`
      }}
    >
      {images.map((image) => (
        <div
          key={image.id}
          data-image-id={image.id}
          className="aspect-square"
        >
          {visibleImages.has(image.id) ? (
            <PerformanceOptimizedImage
              src={image.src}
              alt={image.alt}
              width={image.width || 300}
              height={image.height || 300}
              className="w-full h-full object-cover rounded-lg"
              lazy={lazy}
              quality={75}
              placeholder="blur"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="w-full h-full bg-gray-200 animate-pulse rounded-lg" />
          )}
        </div>
      ))}
    </div>
  )
})