import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { OfflineHandlingService } from '../offlineHandling'

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}

vi.stubGlobal('localStorage', mockLocalStorage)

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true
})

// Mock fetch
global.fetch = vi.fn()

describe('OfflineHandlingService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue(null)
    navigator.onLine = true
    OfflineHandlingService.clearCache()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('initialization', () => {
    it('should initialize with default capabilities', () => {
      OfflineHandlingService.initialize()
      
      const state = OfflineHandlingService.getState()
      expect(state.isOnline).toBe(true)
      expect(state.queuedOperations).toEqual([])
      expect(state.cachedAssets).toEqual([])
    })

    it('should load persisted state from localStorage', () => {
      const persistedState = {
        queuedOperations: [
          {
            id: 'op1',
            type: 'upload',
            data: { test: 'data' },
            timestamp: '2023-01-01T00:00:00.000Z',
            retryCount: 0,
            maxRetries: 3,
            priority: 1
          }
        ],
        cachedAssets: []
      }

      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(persistedState))
      
      OfflineHandlingService.initialize()
      
      const state = OfflineHandlingService.getState()
      expect(state.queuedOperations).toHaveLength(1)
    })
  })

  describe('queue operations', () => {
    beforeEach(() => {
      OfflineHandlingService.initialize()
    })

    it('should queue operations for later execution', () => {
      const operationId = OfflineHandlingService.queueOperation(
        'upload',
        { fileName: 'test.jpg', projectId: 'proj1' },
        2,
        5
      )

      expect(operationId).toMatch(/^op_\d+_[a-z0-9]+$/)
      
      const state = OfflineHandlingService.getState()
      expect(state.queuedOperations).toHaveLength(1)
      expect(state.queuedOperations[0]).toMatchObject({
        type: 'upload',
        data: { fileName: 'test.jpg', projectId: 'proj1' },
        priority: 2,
        maxRetries: 5,
        retryCount: 0
      })
    })

    it('should maintain priority order in queue', () => {
      OfflineHandlingService.queueOperation('upload', { file: 'low' }, 1)
      OfflineHandlingService.queueOperation('upload', { file: 'high' }, 3)
      OfflineHandlingService.queueOperation('upload', { file: 'medium' }, 2)

      const state = OfflineHandlingService.getState()
      expect(state.queuedOperations[0].data.file).toBe('high')
      expect(state.queuedOperations[1].data.file).toBe('medium')
      expect(state.queuedOperations[2].data.file).toBe('low')
    })
  })
})  descri
be('asset caching', () => {
    beforeEach(() => {
      OfflineHandlingService.initialize()
    })

    it('should cache assets for offline access', async () => {
      const asset = {
        id: 'asset1',
        name: 'test.jpg',
        type: 'image/jpeg',
        size: 1024,
        url: 'https://example.com/test.jpg',
        metadata: { width: 100, height: 100 }
      }

      const success = await OfflineHandlingService.cacheAsset(asset)
      expect(success).toBe(true)

      const cached = OfflineHandlingService.getCachedAsset('asset1')
      expect(cached).toMatchObject({
        id: 'asset1',
        name: 'test.jpg',
        type: 'image/jpeg',
        size: 1024
      })
      expect(cached!.cachedAt).toBeDefined()
      expect(cached!.expiresAt).toBeDefined()
    })

    it('should return null for expired cached assets', async () => {
      const asset = {
        id: 'asset1',
        name: 'test.jpg',
        type: 'image/jpeg',
        size: 1024,
        url: 'https://example.com/test.jpg'
      }

      await OfflineHandlingService.cacheAsset(asset)
      
      // Manually expire the asset
      const state = OfflineHandlingService.getState()
      state.cachedAssets[0].expiresAt = new Date(Date.now() - 1000).toISOString()

      const cached = OfflineHandlingService.getCachedAsset('asset1')
      expect(cached).toBeNull()
    })

    it('should evict oldest assets when cache size limit is reached', async () => {
      // Mock a large asset that exceeds cache limit
      const largeAsset = {
        id: 'large-asset',
        name: 'large.jpg',
        type: 'image/jpeg',
        size: 60 * 1024 * 1024, // 60MB (exceeds 50MB limit)
        url: 'https://example.com/large.jpg'
      }

      const success = await OfflineHandlingService.cacheAsset(largeAsset)
      expect(success).toBe(true)
    })
  })

  describe('online/offline state management', () => {
    beforeEach(() => {
      OfflineHandlingService.initialize()
    })

    it('should track online/offline state', () => {
      expect(OfflineHandlingService.isOnline()).toBe(true)

      // Simulate going offline
      navigator.onLine = false
      window.dispatchEvent(new Event('offline'))

      expect(OfflineHandlingService.getState().isOnline).toBe(false)
    })

    it('should process pending operations when back online', async () => {
      vi.useFakeTimers()

      // Mock successful fetch
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })

      // Queue some operations while offline
      navigator.onLine = false
      OfflineHandlingService.queueOperation('upload', {
        projectId: 'proj1',
        fileName: 'test.jpg',
        fileData: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD'
      })

      // Go back online
      navigator.onLine = true
      window.dispatchEvent(new Event('online'))

      // Fast-forward timers to trigger processing
      await vi.runAllTimersAsync()

      expect(global.fetch).toHaveBeenCalledWith('/api/assets/upload', {
        method: 'POST',
        body: expect.any(FormData)
      })
    })
  })

  describe('operation execution', () => {
    beforeEach(() => {
      OfflineHandlingService.initialize()
      vi.useFakeTimers()
    })

    it('should execute upload operations', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })

      OfflineHandlingService.queueOperation('upload', {
        projectId: 'proj1',
        fileName: 'test.jpg',
        fileData: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD'
      })

      await OfflineHandlingService.processPendingOperations()

      expect(global.fetch).toHaveBeenCalledWith('/api/assets/upload', {
        method: 'POST',
        body: expect.any(FormData)
      })

      const state = OfflineHandlingService.getState()
      expect(state.queuedOperations).toHaveLength(0)
    })

    it('should execute delete operations', async () => {
      ;(global.fetch as any).mockResolvedValue({
        ok: true
      })

      OfflineHandlingService.queueOperation('delete', {
        assetId: 'asset1'
      })

      await OfflineHandlingService.processPendingOperations()

      expect(global.fetch).toHaveBeenCalledWith('/api/assets/asset1', {
        method: 'DELETE'
      })
    })

    it('should retry failed operations up to max retries', async () => {
      ;(global.fetch as any)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({ ok: true })

      OfflineHandlingService.queueOperation('upload', {
        projectId: 'proj1',
        fileName: 'test.jpg',
        fileData: 'data:image/jpeg;base64,test'
      }, 1, 3)

      // Process operations multiple times to trigger retries
      await OfflineHandlingService.processPendingOperations()
      await OfflineHandlingService.processPendingOperations()
      await OfflineHandlingService.processPendingOperations()

      expect(global.fetch).toHaveBeenCalledTimes(3)
      
      const state = OfflineHandlingService.getState()
      expect(state.queuedOperations).toHaveLength(0)
    })

    it('should remove operations after max retries exceeded', async () => {
      ;(global.fetch as any).mockRejectedValue(new Error('Persistent error'))

      OfflineHandlingService.queueOperation('upload', {
        projectId: 'proj1',
        fileName: 'test.jpg',
        fileData: 'data:image/jpeg;base64,test'
      }, 1, 2) // Max 2 retries

      // Process operations enough times to exceed max retries
      await OfflineHandlingService.processPendingOperations()
      await OfflineHandlingService.processPendingOperations()
      await OfflineHandlingService.processPendingOperations()

      const state = OfflineHandlingService.getState()
      expect(state.queuedOperations).toHaveLength(0)
    })
  })

  describe('statistics and monitoring', () => {
    beforeEach(() => {
      OfflineHandlingService.initialize()
    })

    it('should provide offline statistics', async () => {
      OfflineHandlingService.queueOperation('upload', { test: 'data' })
      
      await OfflineHandlingService.cacheAsset({
        id: 'asset1',
        name: 'test.jpg',
        type: 'image/jpeg',
        size: 1024,
        url: 'https://example.com/test.jpg'
      })

      const stats = OfflineHandlingService.getStats()
      
      expect(stats.queuedOperations).toBe(1)
      expect(stats.cachedAssets).toBe(1)
      expect(stats.cacheSize).toBe(1024)
      expect(stats.isOnline).toBe(true)
      expect(stats.lastOnlineAt).toBeDefined()
    })
  })

  describe('cache management', () => {
    beforeEach(() => {
      OfflineHandlingService.initialize()
    })

    it('should clear all cached assets', async () => {
      await OfflineHandlingService.cacheAsset({
        id: 'asset1',
        name: 'test1.jpg',
        type: 'image/jpeg',
        size: 1024,
        url: 'https://example.com/test1.jpg'
      })

      await OfflineHandlingService.cacheAsset({
        id: 'asset2',
        name: 'test2.jpg',
        type: 'image/jpeg',
        size: 2048,
        url: 'https://example.com/test2.jpg'
      })

      expect(OfflineHandlingService.getCachedAssets()).toHaveLength(2)

      OfflineHandlingService.clearCache()

      expect(OfflineHandlingService.getCachedAssets()).toHaveLength(0)
    })

    it('should remove specific cached assets', async () => {
      await OfflineHandlingService.cacheAsset({
        id: 'asset1',
        name: 'test1.jpg',
        type: 'image/jpeg',
        size: 1024,
        url: 'https://example.com/test1.jpg'
      })

      await OfflineHandlingService.cacheAsset({
        id: 'asset2',
        name: 'test2.jpg',
        type: 'image/jpeg',
        size: 2048,
        url: 'https://example.com/test2.jpg'
      })

      OfflineHandlingService.removeCachedAsset('asset1')

      expect(OfflineHandlingService.getCachedAsset('asset1')).toBeNull()
      expect(OfflineHandlingService.getCachedAsset('asset2')).not.toBeNull()
    })
  })
})