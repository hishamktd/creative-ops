import { useState, useEffect, useCallback } from 'react'
import { AssetVersion, VersionComparison } from '@/types'
import { versionControlService } from '@/lib/services/versionControl'

export function useVersionHistory(assetId: string) {
  const [versions, setVersions] = useState<AssetVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchVersions = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await versionControlService.getVersionHistory(assetId)
      setVersions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch versions')
    } finally {
      setLoading(false)
    }
  }, [assetId])

  useEffect(() => {
    if (assetId) {
      fetchVersions()
    }
  }, [assetId, fetchVersions])

  const createVersion = useCallback(async (params: {
    fileUrl: string
    filePath: string
    fileSize: number
    checksum: string
    changesDescription?: string
    metadata?: Record<string, any>
  }) => {
    try {
      const newVersion = await versionControlService.createVersion({
        assetId,
        ...params
      })
      setVersions(prev => [newVersion, ...prev])
      return newVersion
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to create version')
    }
  }, [assetId])

  const revertToVersion = useCallback(async (versionId: string, changesDescription?: string) => {
    try {
      const newVersion = await versionControlService.revertToVersion(assetId, versionId, changesDescription)
      setVersions(prev => [newVersion, ...prev])
      return newVersion
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to revert version')
    }
  }, [assetId])

  // Subscribe to real-time version updates
  useEffect(() => {
    if (!assetId) return

    const subscription = versionControlService.subscribeToVersions(assetId, (newVersion) => {
      setVersions(prev => {
        const exists = prev.find(v => v.id === newVersion.id)
        if (exists) return prev
        return [newVersion, ...prev]
      })
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [assetId])

  return {
    versions,
    loading,
    error,
    refetch: fetchVersions,
    createVersion,
    revertToVersion
  }
}

export function useVersionComparison() {
  const [comparison, setComparison] = useState<VersionComparison | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const compareVersions = useCallback(async (oldVersionId: string, newVersionId: string) => {
    try {
      setLoading(true)
      setError(null)
      const data = await versionControlService.compareVersions(oldVersionId, newVersionId)
      setComparison(data)
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compare versions')
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  const clearComparison = useCallback(() => {
    setComparison(null)
    setError(null)
  }, [])

  return {
    comparison,
    loading,
    error,
    compareVersions,
    clearComparison
  }
}

export function useVersionStats(assetId: string) {
  const [stats, setStats] = useState<{
    totalVersions: number
    totalSizeBytes: number
    averageSizeBytes: number
    oldestVersion: string
    newestVersion: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!assetId) return

    const fetchStats = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await versionControlService.getVersionStats(assetId)
        setStats(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch version stats')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [assetId])

  return { stats, loading, error }
}