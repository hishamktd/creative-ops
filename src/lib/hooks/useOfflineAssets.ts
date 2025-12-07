'use client'

import { useState, useEffect, useCallback } from 'react'
import { EnhancedAsset } from '@/types'

interface OfflineAsset extends EnhancedAsset {
  cachedAt: string
  cachedBlob?: Blob
  thumbnailBlob?: Blob
}

interface OfflineStorage {
  assets: OfflineAsset[]
  lastSync: string
  maxCacheSize: number // in MB
  currentCacheSize: number // in MB
}

const CACHE_KEY = 'offline_assets'
const MAX_CACHE_SIZE = 100 // 100MB default
const MAX_ASSETS = 50 // Maximum number of assets to cache

export function useOfflineAssets() {
  const [offlineAssets, setOfflineAssets] = useState<OfflineAsset[]>([])
  const [isOnline, setIsOnline] = useState(true)
  const [cacheSize, setCacheSize] = useState(0)

  // Initialize offline storage
  useEffect(() => {
    loadOfflineAssets()
    
    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    
    setIsOnline(navigator.onLine)
    
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const loadOfflineAssets = useCallback(async () => {
    try {
      const stored = localStorage.getItem(CACHE_KEY)
      if (stored) {
        const offlineStorage: OfflineStorage = JSON.parse(stored)
        setOfflineAssets(offlineStorage.assets)
        setCacheSize(offlineStorage.currentCacheSize)
      }
    } catch (error) {
      console.error('Error loading offline assets:', error)
    }
  }, [])

  const saveOfflineAssets = useCallback(async (assets: OfflineAsset[]) => {
    try {
      const totalSize = assets.reduce((size, asset) => {
        const blobSize = asset.cachedBlob ? asset.cachedBlob.size : 0
        const thumbnailSize = asset.thumbnailBlob ? asset.thumbnailBlob.size : 0
        return size + blobSize + thumbnailSize
      }, 0)

      const offlineStorage: OfflineStorage = {
        assets,
        lastSync: new Date().toISOString(),
        maxCacheSize: MAX_CACHE_SIZE,
        currentCacheSize: totalSize / (1024 * 1024) // Convert to MB
      }

      localStorage.setItem(CACHE_KEY, JSON.stringify(offlineStorage))
      setOfflineAssets(assets)
      setCacheSize(offlineStorage.currentCacheSize)
    } catch (error) {
      console.error('Error saving offline assets:', error)
    }
  }, [])

  const cacheAsset = useCallback(async (asset: EnhancedAsset): Promise<boolean> => {
    try {
      // Check if already cached
      const existingIndex = offlineAssets.findIndex(a => a.id === asset.id)
      if (existingIndex !== -1) {
        return true
      }

      // Check cache limits
      if (offlineAssets.length >= MAX_ASSETS) {
        // Remove oldest asset
        const sortedAssets = [...offlineAssets].sort((a, b) => 
          new Date(a.cachedAt).getTime() - new Date(b.cachedAt).getTime()
        )
        await removeFromCache(sortedAssets[0].id)
      }

      // Download asset file
      let cachedBlob: Blob | undefined
      let thumbnailBlob: Blob | undefined

      try {
        const response = await fetch(asset.file_url)
        if (response.ok) {
          cachedBlob = await response.blob()
        }
      } catch (error) {
        console.warn('Failed to cache asset file:', error)
      }

      // Download thumbnail if available
      if (asset.thumbnail_url) {
        try {
          const thumbnailResponse = await fetch(asset.thumbnail_url)
          if (thumbnailResponse.ok) {
            thumbnailBlob = await thumbnailResponse.blob()
          }
        } catch (error) {
          console.warn('Failed to cache thumbnail:', error)
        }
      }

      // Check if adding this asset would exceed cache size
      const blobSize = cachedBlob ? cachedBlob.size : 0
      const thumbSize = thumbnailBlob ? thumbnailBlob.size : 0
      const newSize = (blobSize + thumbSize) / (1024 * 1024) // Convert to MB

      if (cacheSize + newSize > MAX_CACHE_SIZE) {
        // Remove assets until we have enough space
        let currentAssets = [...offlineAssets]
        let currentSize = cacheSize

        while (currentSize + newSize > MAX_CACHE_SIZE && currentAssets.length > 0) {
          const oldestAsset = currentAssets.sort((a, b) => 
            new Date(a.cachedAt).getTime() - new Date(b.cachedAt).getTime()
          )[0]

          const oldBlobSize = oldestAsset.cachedBlob ? oldestAsset.cachedBlob.size : 0
          const oldThumbSize = oldestAsset.thumbnailBlob ? oldestAsset.thumbnailBlob.size : 0
          currentSize -= (oldBlobSize + oldThumbSize) / (1024 * 1024)

          currentAssets = currentAssets.filter(a => a.id !== oldestAsset.id)
        }

        setOfflineAssets(currentAssets)
      }

      const offlineAsset: OfflineAsset = {
        ...asset,
        cachedAt: new Date().toISOString(),
        cachedBlob,
        thumbnailBlob
      }

      const updatedAssets = [...offlineAssets, offlineAsset]
      await saveOfflineAssets(updatedAssets)

      return true
    } catch (error) {
      console.error('Error caching asset:', error)
      return false
    }
  }, [offlineAssets, cacheSize])

  const removeFromCache = useCallback(async (assetId: string) => {
    const updatedAssets = offlineAssets.filter(asset => asset.id !== assetId)
    await saveOfflineAssets(updatedAssets)
  }, [offlineAssets, saveOfflineAssets])

  const getCachedAsset = useCallback((assetId: string): OfflineAsset | null => {
    return offlineAssets.find(asset => asset.id === assetId) || null
  }, [offlineAssets])

  const getCachedAssetUrl = useCallback((assetId: string): string | null => {
    const cachedAsset = getCachedAsset(assetId)
    if (cachedAsset?.cachedBlob) {
      return URL.createObjectURL(cachedAsset.cachedBlob)
    }
    return null
  }, [getCachedAsset])

  const getCachedThumbnailUrl = useCallback((assetId: string): string | null => {
    const cachedAsset = getCachedAsset(assetId)
    if (cachedAsset?.thumbnailBlob) {
      return URL.createObjectURL(cachedAsset.thumbnailBlob)
    }
    return null
  }, [getCachedAsset])

  const clearCache = useCallback(async () => {
    localStorage.removeItem(CACHE_KEY)
    setOfflineAssets([])
    setCacheSize(0)
  }, [])

  const isCached = useCallback((assetId: string): boolean => {
    return offlineAssets.some(asset => asset.id === assetId)
  }, [offlineAssets])

  const getRecentlyAccessedAssets = useCallback((): OfflineAsset[] => {
    return [...offlineAssets]
      .sort((a, b) => new Date(b.cachedAt).getTime() - new Date(a.cachedAt).getTime())
      .slice(0, 20)
  }, [offlineAssets])

  return {
    offlineAssets,
    isOnline,
    cacheSize,
    maxCacheSize: MAX_CACHE_SIZE,
    cacheAsset,
    removeFromCache,
    getCachedAsset,
    getCachedAssetUrl,
    getCachedThumbnailUrl,
    clearCache,
    isCached,
    getRecentlyAccessedAssets
  }
}