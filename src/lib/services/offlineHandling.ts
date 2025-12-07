/**
 * Offline Handling Service
 * Provides graceful degradation and offline capability for asset management
 */

export interface OfflineCapability {
  caching: boolean
  queueing: boolean
  localStorage: boolean
  syncOnReconnect: boolean
}

export interface QueuedOperation {
  id: string
  type: 'upload' | 'delete' | 'update' | 'move'
  data: any
  timestamp: string
  retryCount: number
  maxRetries: number
  priority: number
}

export interface CachedAsset {
  id: string
  name: string
  type: string
  size: number
  url: string
  thumbnail?: string
  metadata: any
  cachedAt: string
  expiresAt: string
}

export interface OfflineState {
  isOnline: boolean
  lastOnlineAt: string
  queuedOperations: QueuedOperation[]
  cachedAssets: CachedAsset[]
  syncInProgress: boolean
}

export class OfflineHandlingService {
  private static readonly STORAGE_KEY = 'creativeops_offline_data'
  private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours
  private static readonly MAX_QUEUE_SIZE = 100
  private static readonly MAX_CACHE_SIZE = 50 * 1024 * 1024 // 50MB

  private static state: OfflineState = {
    isOnline: navigator.onLine,
    lastOnlineAt: new Date().toISOString(),
    queuedOperations: [],
    cachedAssets: [],
    syncInProgress: false
  }

  private static listeners: Array<(state: OfflineState) => void> = []
  private static initialized = false

  /**
   * Initialize offline handling
   */
  static initialize(capabilities: Partial<OfflineCapability> = {}): void {
    if (this.initialized) return

    const defaultCapabilities: OfflineCapability = {
      caching: true,
      queueing: true,
      localStorage: true,
      syncOnReconnect: true
    }

    const finalCapabilities = { ...defaultCapabilities, ...capabilities }

    // Load persisted state
    if (finalCapabilities.localStorage) {
      this.loadPersistedState()
    }

    // Set up online/offline event listeners
    window.addEventListener('online', this.handleOnline.bind(this))
    window.addEventListener('offline', this.handleOffline.bind(this))

    // Set up periodic sync check
    setInterval(() => {
      if (this.state.isOnline && !this.state.syncInProgress) {
        this.processPendingOperations()
      }
    }, 30000) // Check every 30 seconds

    // Set up cache cleanup
    setInterval(() => {
      this.cleanupExpiredCache()
    }, 60000) // Cleanup every minute

    this.initialized = true
    this.notifyListeners()
  }

  /**
   * Subscribe to offline state changes
   */
  static subscribe(listener: (state: OfflineState) => void): () => void {
    this.listeners.push(listener)
    
    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * Get current offline state
   */
  static getState(): OfflineState {
    return { ...this.state }
  }

  /**
   * Check if currently online
   */
  static isOnline(): boolean {
    return this.state.isOnline
  }

  /**
   * Queue operation for later execution
   */
  static queueOperation(
    type: QueuedOperation['type'],
    data: any,
    priority: number = 1,
    maxRetries: number = 3
  ): string {
    const operation: QueuedOperation = {
      id: this.generateOperationId(),
      type,
      data,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      maxRetries,
      priority
    }

    // Add to queue (maintain priority order)
    this.state.queuedOperations.push(operation)
    this.state.queuedOperations.sort((a, b) => b.priority - a.priority)

    // Limit queue size
    if (this.state.queuedOperations.length > this.MAX_QUEUE_SIZE) {
      this.state.queuedOperations = this.state.queuedOperations.slice(0, this.MAX_QUEUE_SIZE)
    }

    this.persistState()
    this.notifyListeners()

    return operation.id
  }

  /**
   * Cache asset for offline access
   */
  static async cacheAsset(asset: {
    id: string
    name: string
    type: string
    size: number
    url: string
    thumbnail?: string
    metadata?: any
  }): Promise<boolean> {
    try {
      // Check cache size limit
      const currentCacheSize = this.getCurrentCacheSize()
      if (currentCacheSize + asset.size > this.MAX_CACHE_SIZE) {
        // Remove oldest cached assets to make room
        await this.evictOldestCachedAssets(asset.size)
      }

      // Cache the asset data
      const cachedAsset: CachedAsset = {
        ...asset,
        cachedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + this.CACHE_DURATION).toISOString()
      }

      // Try to cache the actual file data if it's small enough
      if (asset.size < 5 * 1024 * 1024) { // 5MB limit for file caching
        try {
          const response = await fetch(asset.url)
          const blob = await response.blob()
          const dataUrl = await this.blobToDataUrl(blob)
          cachedAsset.url = dataUrl
        } catch (error) {
          console.warn('Failed to cache asset file data:', error)
          // Keep original URL as fallback
        }
      }

      // Add to cache
      const existingIndex = this.state.cachedAssets.findIndex(cached => cached.id === asset.id)
      if (existingIndex >= 0) {
        this.state.cachedAssets[existingIndex] = cachedAsset
      } else {
        this.state.cachedAssets.push(cachedAsset)
      }

      this.persistState()
      this.notifyListeners()

      return true
    } catch (error) {
      console.error('Failed to cache asset:', error)
      return false
    }
  }

  /**
   * Get cached asset
   */
  static getCachedAsset(assetId: string): CachedAsset | null {
    const cached = this.state.cachedAssets.find(asset => asset.id === assetId)
    
    if (!cached) return null

    // Check if expired
    if (new Date(cached.expiresAt) < new Date()) {
      this.removeCachedAsset(assetId)
      return null
    }

    return cached
  }

  /**
   * Get all cached assets
   */
  static getCachedAssets(): CachedAsset[] {
    // Filter out expired assets
    const now = new Date()
    return this.state.cachedAssets.filter(asset => new Date(asset.expiresAt) > now)
  }

  /**
   * Remove cached asset
   */
  static removeCachedAsset(assetId: string): void {
    this.state.cachedAssets = this.state.cachedAssets.filter(asset => asset.id !== assetId)
    this.persistState()
    this.notifyListeners()
  }

  /**
   * Clear all cached assets
   */
  static clearCache(): void {
    this.state.cachedAssets = []
    this.persistState()
    this.notifyListeners()
  }

  /**
   * Process pending operations when back online
   */
  static async processPendingOperations(): Promise<void> {
    if (!this.state.isOnline || this.state.syncInProgress) return

    this.state.syncInProgress = true
    this.notifyListeners()

    const operations = [...this.state.queuedOperations]
    const processedOperations: string[] = []

    for (const operation of operations) {
      try {
        const success = await this.executeOperation(operation)
        
        if (success) {
          processedOperations.push(operation.id)
        } else {
          // Increment retry count
          operation.retryCount++
          
          // Remove if max retries exceeded
          if (operation.retryCount >= operation.maxRetries) {
            processedOperations.push(operation.id)
            console.warn(`Operation ${operation.id} failed after ${operation.maxRetries} retries`)
          }
        }
      } catch (error) {
        console.error(`Failed to execute operation ${operation.id}:`, error)
        operation.retryCount++
        
        if (operation.retryCount >= operation.maxRetries) {
          processedOperations.push(operation.id)
        }
      }
    }

    // Remove processed operations
    this.state.queuedOperations = this.state.queuedOperations.filter(
      op => !processedOperations.includes(op.id)
    )

    this.state.syncInProgress = false
    this.persistState()
    this.notifyListeners()
  }

  /**
   * Execute a queued operation
   */
  private static async executeOperation(operation: QueuedOperation): Promise<boolean> {
    try {
      switch (operation.type) {
        case 'upload':
          return await this.executeUploadOperation(operation.data)
        case 'delete':
          return await this.executeDeleteOperation(operation.data)
        case 'update':
          return await this.executeUpdateOperation(operation.data)
        case 'move':
          return await this.executeMoveOperation(operation.data)
        default:
          console.warn(`Unknown operation type: ${operation.type}`)
          return false
      }
    } catch (error) {
      console.error(`Failed to execute ${operation.type} operation:`, error)
      return false
    }
  }

  /**
   * Execute upload operation
   */
  private static async executeUploadOperation(data: any): Promise<boolean> {
    try {
      const formData = new FormData()
      
      // Reconstruct file from cached data if available
      if (data.fileData) {
        const blob = this.dataUrlToBlob(data.fileData)
        formData.append('file', blob, data.fileName)
      } else {
        console.warn('No file data available for upload operation')
        return false
      }

      formData.append('projectId', data.projectId)
      if (data.folderId) formData.append('folderId', data.folderId)

      const response = await fetch('/api/assets/upload', {
        method: 'POST',
        body: formData
      })

      return response.ok
    } catch (error) {
      console.error('Upload operation failed:', error)
      return false
    }
  }

  /**
   * Execute delete operation
   */
  private static async executeDeleteOperation(data: any): Promise<boolean> {
    try {
      const response = await fetch(`/api/assets/${data.assetId}`, {
        method: 'DELETE'
      })
      return response.ok
    } catch (error) {
      console.error('Delete operation failed:', error)
      return false
    }
  }

  /**
   * Execute update operation
   */
  private static async executeUpdateOperation(data: any): Promise<boolean> {
    try {
      const response = await fetch(`/api/assets/${data.assetId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data.updates)
      })
      return response.ok
    } catch (error) {
      console.error('Update operation failed:', error)
      return false
    }
  }

  /**
   * Execute move operation
   */
  private static async executeMoveOperation(data: any): Promise<boolean> {
    try {
      const response = await fetch(`/api/assets/${data.assetId}/move`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          folderId: data.newFolderId
        })
      })
      return response.ok
    } catch (error) {
      console.error('Move operation failed:', error)
      return false
    }
  }

  /**
   * Handle online event
   */
  private static handleOnline(): void {
    this.state.isOnline = true
    this.state.lastOnlineAt = new Date().toISOString()
    this.notifyListeners()

    // Start processing pending operations
    setTimeout(() => {
      this.processPendingOperations()
    }, 1000) // Wait 1 second to ensure connection is stable
  }

  /**
   * Handle offline event
   */
  private static handleOffline(): void {
    this.state.isOnline = false
    this.notifyListeners()
  }

  /**
   * Clean up expired cached assets
   */
  private static cleanupExpiredCache(): void {
    const now = new Date()
    const initialCount = this.state.cachedAssets.length
    
    this.state.cachedAssets = this.state.cachedAssets.filter(
      asset => new Date(asset.expiresAt) > now
    )

    if (this.state.cachedAssets.length !== initialCount) {
      this.persistState()
      this.notifyListeners()
    }
  }

  /**
   * Get current cache size in bytes
   */
  private static getCurrentCacheSize(): number {
    return this.state.cachedAssets.reduce((total, asset) => total + asset.size, 0)
  }

  /**
   * Evict oldest cached assets to make room
   */
  private static async evictOldestCachedAssets(requiredSpace: number): Promise<void> {
    // Sort by cached date (oldest first)
    this.state.cachedAssets.sort((a, b) => 
      new Date(a.cachedAt).getTime() - new Date(b.cachedAt).getTime()
    )

    let freedSpace = 0
    const toRemove: string[] = []

    for (const asset of this.state.cachedAssets) {
      toRemove.push(asset.id)
      freedSpace += asset.size

      if (freedSpace >= requiredSpace) break
    }

    // Remove the assets
    this.state.cachedAssets = this.state.cachedAssets.filter(
      asset => !toRemove.includes(asset.id)
    )
  }

  /**
   * Convert blob to data URL
   */
  private static blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  /**
   * Convert data URL to blob
   */
  private static dataUrlToBlob(dataUrl: string): Blob {
    const arr = dataUrl.split(',')
    const mime = arr[0].match(/:(.*?);/)![1]
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)
    
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }
    
    return new Blob([u8arr], { type: mime })
  }

  /**
   * Generate unique operation ID
   */
  private static generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  }

  /**
   * Persist state to localStorage
   */
  private static persistState(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state))
    } catch (error) {
      console.warn('Failed to persist offline state:', error)
    }
  }

  /**
   * Load persisted state from localStorage
   */
  private static loadPersistedState(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      if (stored) {
        const parsedState = JSON.parse(stored)
        this.state = {
          ...this.state,
          ...parsedState,
          isOnline: navigator.onLine, // Always use current online status
          syncInProgress: false // Reset sync status on load
        }
      }
    } catch (error) {
      console.warn('Failed to load persisted offline state:', error)
    }
  }

  /**
   * Notify all listeners of state changes
   */
  private static notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.getState())
      } catch (error) {
        console.error('Error in offline state listener:', error)
      }
    }
  }

  /**
   * Get offline statistics
   */
  static getStats(): {
    queuedOperations: number
    cachedAssets: number
    cacheSize: number
    isOnline: boolean
    lastOnlineAt: string
  } {
    return {
      queuedOperations: this.state.queuedOperations.length,
      cachedAssets: this.state.cachedAssets.length,
      cacheSize: this.getCurrentCacheSize(),
      isOnline: this.state.isOnline,
      lastOnlineAt: this.state.lastOnlineAt
    }
  }
}