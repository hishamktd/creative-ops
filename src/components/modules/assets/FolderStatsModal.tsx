'use client'

import { useState, useEffect } from 'react'
import { X, BarChart3, FileText, Users, Calendar, HardDrive, TrendingUp, Eye } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { supabase } from '@/lib/supabase/client'
import { Folder } from '@/types'

interface FolderStatsModalProps {
  isOpen: boolean
  folder: Folder
  onClose: () => void
}

interface FolderStats {
  total_assets: number
  total_size: number
  file_types: { type: string; count: number; size: number }[]
  recent_activity: {
    date: string
    uploads: number
    views: number
    downloads: number
  }[]
  top_contributors: {
    user_id: string
    user_name: string
    upload_count: number
    total_size: number
  }[]
  access_stats: {
    total_views: number
    unique_viewers: number
    avg_views_per_asset: number
  }
  storage_breakdown: {
    images: { count: number; size: number }
    videos: { count: number; size: number }
    documents: { count: number; size: number }
    other: { count: number; size: number }
  }
}

export function FolderStatsModal({
  isOpen,
  folder,
  onClose
}: FolderStatsModalProps) {
  const [stats, setStats] = useState<FolderStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d')

  useEffect(() => {
    if (isOpen) {
      fetchStats()
    }
  }, [isOpen, folder.id, timeRange])

  const fetchStats = async () => {
    setLoading(true)
    try {
      // Calculate date range
      const endDate = new Date()
      const startDate = new Date()
      switch (timeRange) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7)
          break
        case '30d':
          startDate.setDate(endDate.getDate() - 30)
          break
        case '90d':
          startDate.setDate(endDate.getDate() - 90)
          break
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1)
          break
      }

      // Fetch basic folder stats
      const { data: assets, error: assetsError } = await supabase
        .from('assets')
        .select(`
          id,
          file_type,
          file_size,
          access_count,
          uploaded_by,
          created_at,
          users!uploaded_by(full_name)
        `)
        .eq('folder_id', folder.id)

      if (assetsError) throw assetsError

      // Calculate statistics
      const totalAssets = assets?.length || 0
      const totalSize = assets?.reduce((sum, asset) => sum + (asset.file_size || 0), 0) || 0

      // File types breakdown
      const fileTypesMap = new Map<string, { count: number; size: number }>()
      assets?.forEach(asset => {
        const type = asset.file_type || 'unknown'
        const existing = fileTypesMap.get(type) || { count: 0, size: 0 }
        fileTypesMap.set(type, {
          count: existing.count + 1,
          size: existing.size + (asset.file_size || 0)
        })
      })

      const fileTypes = Array.from(fileTypesMap.entries()).map(([type, data]) => ({
        type,
        count: data.count,
        size: data.size
      }))

      // Contributors stats
      const contributorsMap = new Map<string, { user_name: string; upload_count: number; total_size: number }>()
      assets?.forEach(asset => {
        const userId = asset.uploaded_by
        const userName = asset.users?.full_name || 'Unknown User'
        const existing = contributorsMap.get(userId) || { user_name: userName, upload_count: 0, total_size: 0 }
        contributorsMap.set(userId, {
          user_name: userName,
          upload_count: existing.upload_count + 1,
          total_size: existing.total_size + (asset.file_size || 0)
        })
      })

      const topContributors = Array.from(contributorsMap.entries())
        .map(([user_id, data]) => ({ user_id, ...data }))
        .sort((a, b) => b.upload_count - a.upload_count)
        .slice(0, 5)

      // Access stats
      const totalViews = assets?.reduce((sum, asset) => sum + (asset.access_count || 0), 0) || 0
      const uniqueViewers = new Set(assets?.map(asset => asset.uploaded_by)).size
      const avgViewsPerAsset = totalAssets > 0 ? totalViews / totalAssets : 0

      // Storage breakdown by category
      const storageBreakdown = {
        images: { count: 0, size: 0 },
        videos: { count: 0, size: 0 },
        documents: { count: 0, size: 0 },
        other: { count: 0, size: 0 }
      }

      assets?.forEach(asset => {
        const type = asset.file_type?.toLowerCase() || ''
        let category: keyof typeof storageBreakdown = 'other'

        if (type.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].some(ext => type.includes(ext))) {
          category = 'images'
        } else if (type.includes('video') || ['mp4', 'avi', 'mov', 'wmv', 'flv'].some(ext => type.includes(ext))) {
          category = 'videos'
        } else if (type.includes('pdf') || type.includes('document') || ['doc', 'docx', 'txt', 'rtf'].some(ext => type.includes(ext))) {
          category = 'documents'
        }

        storageBreakdown[category].count += 1
        storageBreakdown[category].size += asset.file_size || 0
      })

      // Mock recent activity data (in a real app, this would come from audit logs)
      const recentActivity = Array.from({ length: 7 }, (_, i) => {
        const date = new Date()
        date.setDate(date.getDate() - i)
        return {
          date: date.toISOString().split('T')[0],
          uploads: Math.floor(Math.random() * 5),
          views: Math.floor(Math.random() * 20),
          downloads: Math.floor(Math.random() * 10)
        }
      }).reverse()

      setStats({
        total_assets: totalAssets,
        total_size: totalSize,
        file_types: fileTypes,
        recent_activity: recentActivity,
        top_contributors: topContributors,
        access_stats: {
          total_views: totalViews,
          unique_viewers: uniqueViewers,
          avg_views_per_asset: avgViewsPerAsset
        },
        storage_breakdown: storageBreakdown
      })
    } catch (error) {
      console.error('Error fetching folder stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getFileTypeIcon = (type: string) => {
    if (type.includes('image')) return '🖼️'
    if (type.includes('video')) return '🎥'
    if (type.includes('pdf') || type.includes('document')) return '📄'
    if (type.includes('audio')) return '🎵'
    return '📁'
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose}></div>

      {/* Modal */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl bg-surface-light dark:bg-surface-dark rounded-xl shadow-xl z-50 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="size-8 bg-primary/20 rounded-lg flex items-center justify-center">
              <BarChart3 size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-text-light-primary dark:text-dark-primary">
                Folder Analytics
              </h2>
              <p className="text-sm text-text-light-secondary dark:text-dark-secondary">
                {folder.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="px-3 py-2 text-sm bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-800 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </select>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {loading ? (
            <div className="text-center py-12 text-gray-500">
              Loading analytics...
            </div>
          ) : !stats ? (
            <div className="text-center py-12 text-gray-500">
              Failed to load analytics
            </div>
          ) : (
            <div className="space-y-6">
              {/* Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <FileText size={20} className="text-blue-600" />
                    <span className="text-sm font-medium text-text-light-secondary dark:text-dark-secondary">
                      Total Assets
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-text-light-primary dark:text-dark-primary">
                    {stats.total_assets}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <HardDrive size={20} className="text-green-600" />
                    <span className="text-sm font-medium text-text-light-secondary dark:text-dark-secondary">
                      Total Size
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-text-light-primary dark:text-dark-primary">
                    {formatFileSize(stats.total_size)}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Eye size={20} className="text-purple-600" />
                    <span className="text-sm font-medium text-text-light-secondary dark:text-dark-secondary">
                      Total Views
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-text-light-primary dark:text-dark-primary">
                    {stats.access_stats.total_views}
                  </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <Users size={20} className="text-orange-600" />
                    <span className="text-sm font-medium text-text-light-secondary dark:text-dark-secondary">
                      Contributors
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-text-light-primary dark:text-dark-primary">
                    {stats.top_contributors.length}
                  </p>
                </div>
              </div>

              {/* Storage Breakdown */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-text-light-primary dark:text-dark-primary mb-4">
                  Storage Breakdown
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(stats.storage_breakdown).map(([category, data]) => (
                    <div key={category} className="text-center">
                      <div className="text-2xl mb-2">
                        {category === 'images' && '🖼️'}
                        {category === 'videos' && '🎥'}
                        {category === 'documents' && '📄'}
                        {category === 'other' && '📁'}
                      </div>
                      <p className="text-sm font-medium text-text-light-primary dark:text-dark-primary capitalize">
                        {category}
                      </p>
                      <p className="text-xs text-text-light-secondary dark:text-dark-secondary">
                        {data.count} files
                      </p>
                      <p className="text-xs text-text-light-secondary dark:text-dark-secondary">
                        {formatFileSize(data.size)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* File Types */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-text-light-primary dark:text-dark-primary mb-4">
                  File Types
                </h3>
                <div className="space-y-3">
                  {stats.file_types.slice(0, 10).map((fileType) => (
                    <div key={fileType.type} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{getFileTypeIcon(fileType.type)}</span>
                        <span className="text-sm font-medium text-text-light-primary dark:text-dark-primary">
                          {fileType.type || 'Unknown'}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-text-light-primary dark:text-dark-primary">
                          {fileType.count} files
                        </p>
                        <p className="text-xs text-text-light-secondary dark:text-dark-secondary">
                          {formatFileSize(fileType.size)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top Contributors */}
              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-text-light-primary dark:text-dark-primary mb-4">
                  Top Contributors
                </h3>
                <div className="space-y-3">
                  {stats.top_contributors.map((contributor, index) => (
                    <div key={contributor.user_id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-8 bg-primary/20 rounded-full flex items-center justify-center">
                          <span className="text-primary font-medium text-sm">
                            {contributor.user_name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-text-light-primary dark:text-dark-primary">
                            {contributor.user_name}
                          </p>
                          <p className="text-xs text-text-light-secondary dark:text-dark-secondary">
                            #{index + 1} contributor
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-text-light-primary dark:text-dark-primary">
                          {contributor.upload_count} uploads
                        </p>
                        <p className="text-xs text-text-light-secondary dark:text-dark-secondary">
                          {formatFileSize(contributor.total_size)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-800">
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </>
  )
}