import { describe, it, expect, vi, beforeEach } from 'vitest'
import { CDNService } from '../cdn'

// Mock fetch
global.fetch = vi.fn()

describe('CDNService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fetch).mockClear()
  })

  describe('uploadToCDN', () => {
    it('uploads file to CDN successfully', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({
          url: 'https://cdn.example.com/file.jpg',
          etag: 'abc123',
        }),
      }
      vi.mocked(fetch).mockResolvedValue(mockResponse as any)

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const result = await CDNService.uploadToCDN(file, 'images/')

      expect(result.success).toBe(true)
      expect(result.url).toBe('https://cdn.example.com/file.jpg')
      expect(result.etag).toBe('abc123')
    })

    it('handles upload failures', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      }
      vi.mocked(fetch).mockResolvedValue(mockResponse as any)

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const result = await CDNService.uploadToCDN(file, 'images/')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Upload failed')
    })

    it('validates file size before upload', async () => {
      const largeFile = new File(['x'.repeat(100 * 1024 * 1024)], 'large.jpg', { type: 'image/jpeg' })
      
      const result = await CDNService.uploadToCDN(largeFile, 'images/')

      expect(result.success).toBe(false)
      expect(result.error).toContain('File size exceeds limit')
    })
  })

  describe('generateOptimizedUrl', () => {
    it('generates optimized image URL with transformations', () => {
      const baseUrl = 'https://cdn.example.com/image.jpg'
      const transformations = {
        width: 800,
        height: 600,
        quality: 80,
        format: 'webp' as const,
      }

      const optimizedUrl = CDNService.generateOptimizedUrl(baseUrl, transformations)

      expect(optimizedUrl).toContain('w_800')
      expect(optimizedUrl).toContain('h_600')
      expect(optimizedUrl).toContain('q_80')
      expect(optimizedUrl).toContain('f_webp')
    })

    it('handles missing transformations gracefully', () => {
      const baseUrl = 'https://cdn.example.com/image.jpg'
      
      const optimizedUrl = CDNService.generateOptimizedUrl(baseUrl, {})

      expect(optimizedUrl).toBe(baseUrl)
    })
  })

  describe('invalidateCache', () => {
    it('invalidates CDN cache for specific URLs', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ invalidated: true }),
      }
      vi.mocked(fetch).mockResolvedValue(mockResponse as any)

      const urls = ['https://cdn.example.com/file1.jpg', 'https://cdn.example.com/file2.jpg']
      const result = await CDNService.invalidateCache(urls)

      expect(result.success).toBe(true)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/invalidate'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ urls }),
        })
      )
    })

    it('handles cache invalidation failures', async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      }
      vi.mocked(fetch).mockResolvedValue(mockResponse as any)

      const urls = ['https://cdn.example.com/file1.jpg']
      const result = await CDNService.invalidateCache(urls)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Cache invalidation failed')
    })
  })

  describe('getDeliveryStats', () => {
    it('retrieves CDN delivery statistics', async () => {
      const mockStats = {
        totalRequests: 1000,
        totalBandwidth: 5000000,
        cacheHitRatio: 0.85,
        topFiles: [
          { url: 'https://cdn.example.com/popular.jpg', requests: 100 },
        ],
      }

      const mockResponse = {
        ok: true,
        json: () => Promise.resolve(mockStats),
      }
      vi.mocked(fetch).mockResolvedValue(mockResponse as any)

      const stats = await CDNService.getDeliveryStats('2024-01-01', '2024-01-31')

      expect(stats.totalRequests).toBe(1000)
      expect(stats.cacheHitRatio).toBe(0.85)
      expect(stats.topFiles).toHaveLength(1)
    })
  })

  describe('preloadAssets', () => {
    it('preloads assets to CDN edge locations', async () => {
      const mockResponse = {
        ok: true,
        json: () => Promise.resolve({ preloaded: true }),
      }
      vi.mocked(fetch).mockResolvedValue(mockResponse as any)

      const urls = ['https://cdn.example.com/critical.jpg']
      const result = await CDNService.preloadAssets(urls, ['us-east-1', 'eu-west-1'])

      expect(result.success).toBe(true)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/preload'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            urls,
            regions: ['us-east-1', 'eu-west-1'],
          }),
        })
      )
    })
  })

  describe('performance optimization', () => {
    it('automatically selects best format based on browser support', () => {
      // Mock user agent for WebP support
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Chrome/90.0) AppleWebKit/537.36',
        configurable: true,
      })

      const baseUrl = 'https://cdn.example.com/image.jpg'
      const optimizedUrl = CDNService.generateOptimizedUrl(baseUrl, { autoFormat: true })

      expect(optimizedUrl).toContain('f_auto')
    })

    it('implements progressive JPEG for large images', () => {
      const baseUrl = 'https://cdn.example.com/large-image.jpg'
      const transformations = {
        width: 2000,
        progressive: true,
      }

      const optimizedUrl = CDNService.generateOptimizedUrl(baseUrl, transformations)

      expect(optimizedUrl).toContain('fl_progressive')
    })
  })

  describe('error handling and retry logic', () => {
    it('retries failed uploads with exponential backoff', async () => {
      // First two calls fail, third succeeds
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ url: 'https://cdn.example.com/file.jpg' }),
        } as any)

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const result = await CDNService.uploadToCDN(file, 'images/', { retries: 3 })

      expect(result.success).toBe(true)
      expect(fetch).toHaveBeenCalledTimes(3)
    })

    it('gives up after max retries', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Persistent network error'))

      const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' })
      const result = await CDNService.uploadToCDN(file, 'images/', { retries: 2 })

      expect(result.success).toBe(false)
      expect(result.error).toContain('Upload failed after 2 retries')
    })
  })
})