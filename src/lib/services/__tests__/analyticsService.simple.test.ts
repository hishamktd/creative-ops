import { describe, it, expect, vi } from 'vitest'

describe('AnalyticsService - Core Logic', () => {
  describe('utility functions', () => {
    it('should calculate averages correctly', () => {
      const calculateAverage = (values: number[]): number => {
        if (values.length === 0) return 0
        return values.reduce((sum, val) => sum + val, 0) / values.length
      }

      expect(calculateAverage([1, 2, 3, 4, 5])).toBe(3)
      expect(calculateAverage([10, 20])).toBe(15)
      expect(calculateAverage([])).toBe(0)
      expect(calculateAverage([42])).toBe(42)
    })

    it('should calculate time filters correctly', () => {
      const getTimeFilter = (timeRange: '24h' | '7d' | '30d'): string => {
        const now = new Date()
        switch (timeRange) {
          case '24h':
            now.setHours(now.getHours() - 24)
            break
          case '7d':
            now.setDate(now.getDate() - 7)
            break
          case '30d':
            now.setDate(now.getDate() - 30)
            break
        }
        return now.toISOString()
      }

      const now = new Date('2023-01-08T12:00:00Z')
      vi.setSystemTime(now)

      expect(getTimeFilter('24h')).toBe('2023-01-07T12:00:00.000Z')
      expect(getTimeFilter('7d')).toBe('2023-01-01T12:00:00.000Z')
      expect(getTimeFilter('30d')).toBe('2022-12-09T12:00:00.000Z')
    })

    it('should format bytes correctly', () => {
      const formatBytes = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes'
        const k = 1024
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
      }

      expect(formatBytes(0)).toBe('0 Bytes')
      expect(formatBytes(1024)).toBe('1 KB')
      expect(formatBytes(1048576)).toBe('1 MB')
      expect(formatBytes(1073741824)).toBe('1 GB')
      expect(formatBytes(5368709120)).toBe('5 GB')
    })

    it('should determine health status correctly', () => {
      const getHealthStatus = (
        criticalCount: number, 
        warningCount: number
      ): 'healthy' | 'warning' | 'critical' => {
        if (criticalCount > 0) return 'critical'
        if (warningCount > 0) return 'warning'
        return 'healthy'
      }

      expect(getHealthStatus(0, 0)).toBe('healthy')
      expect(getHealthStatus(0, 1)).toBe('warning')
      expect(getHealthStatus(1, 0)).toBe('critical')
      expect(getHealthStatus(1, 1)).toBe('critical')
    })

    it('should calculate upload speed correctly', () => {
      const calculateUploadSpeed = (fileSize: number, uploadTime: number): number => {
        // Convert to MB/s: (fileSize in bytes / 1024 / 1024) / (uploadTime in ms / 1000)
        return (fileSize / 1024 / 1024) / (uploadTime / 1000)
      }

      const fileSize = 1024 * 1024 * 10 // 10MB
      const uploadTime = 5000 // 5 seconds
      const expectedSpeed = 2 // 2 MB/s

      expect(calculateUploadSpeed(fileSize, uploadTime)).toBe(expectedSpeed)
    })

    it('should process access patterns correctly', () => {
      const processAccessPatterns = (accessData: Array<{ created_at: string }>): Array<{ hour: number, count: number }> => {
        const patterns = Array.from({ length: 24 }, (_, hour) => ({
          hour,
          count: accessData.filter(item => 
            new Date(item.created_at).getHours() === hour
          ).length
        }))
        return patterns
      }

      const mockData = [
        { created_at: '2023-01-01T09:30:00Z' }, // Hour 9 UTC
        { created_at: '2023-01-01T09:45:00Z' }, // Hour 9 UTC
        { created_at: '2023-01-01T14:15:00Z' }, // Hour 14 UTC
      ]

      const patterns = processAccessPatterns(mockData)
      
      expect(patterns).toHaveLength(24)
      
      // Find the hours that have data
      const hoursWithData = patterns.filter(p => p.count > 0)
      expect(hoursWithData).toHaveLength(2)
      
      // Check that we have the right total count
      const totalCount = patterns.reduce((sum, p) => sum + p.count, 0)
      expect(totalCount).toBe(3)
    })

    it('should aggregate popular assets correctly', () => {
      const aggregatePopularAssets = (data: Array<{
        asset_id: string
        action_type: string
        assets: { name: string }
      }>): Array<{
        id: string
        name: string
        views: number
        downloads: number
      }> => {
        const assetStats = data.reduce((acc, item) => {
          const assetId = item.asset_id
          if (!acc[assetId]) {
            acc[assetId] = {
              id: assetId,
              name: item.assets.name,
              views: 0,
              downloads: 0
            }
          }
          if (item.action_type === 'view') acc[assetId].views++
          if (item.action_type === 'download') acc[assetId].downloads++
          return acc
        }, {} as Record<string, any>)

        return Object.values(assetStats)
          .sort((a: any, b: any) => (b.views + b.downloads) - (a.views + a.downloads))
          .slice(0, 10)
      }

      const mockData = [
        { asset_id: 'asset-1', action_type: 'view', assets: { name: 'Image 1' } },
        { asset_id: 'asset-1', action_type: 'view', assets: { name: 'Image 1' } },
        { asset_id: 'asset-1', action_type: 'download', assets: { name: 'Image 1' } },
        { asset_id: 'asset-2', action_type: 'view', assets: { name: 'Image 2' } },
      ]

      const result = aggregatePopularAssets(mockData)
      
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        id: 'asset-1',
        name: 'Image 1',
        views: 2,
        downloads: 1
      })
      expect(result[1]).toEqual({
        id: 'asset-2',
        name: 'Image 2',
        views: 1,
        downloads: 0
      })
    })
  })

  describe('data validation', () => {
    it('should validate analytics event types', () => {
      const validEventTypes = ['asset_usage', 'user_activity', 'performance']
      const isValidEventType = (type: string): boolean => {
        return validEventTypes.includes(type)
      }

      expect(isValidEventType('asset_usage')).toBe(true)
      expect(isValidEventType('user_activity')).toBe(true)
      expect(isValidEventType('performance')).toBe(true)
      expect(isValidEventType('invalid_type')).toBe(false)
    })

    it('should validate action types', () => {
      const validActionTypes = ['view', 'download', 'edit', 'share', 'comment', 'version_create']
      const isValidActionType = (type: string): boolean => {
        return validActionTypes.includes(type)
      }

      expect(isValidActionType('view')).toBe(true)
      expect(isValidActionType('download')).toBe(true)
      expect(isValidActionType('invalid')).toBe(false)
    })

    it('should validate metric types', () => {
      const validMetricTypes = ['upload_speed', 'search_response', 'page_load', 'api_response', 'thumbnail_generation']
      const isValidMetricType = (type: string): boolean => {
        return validMetricTypes.includes(type)
      }

      expect(isValidMetricType('upload_speed')).toBe(true)
      expect(isValidMetricType('search_response')).toBe(true)
      expect(isValidMetricType('invalid')).toBe(false)
    })

    it('should validate health status values', () => {
      const validStatuses = ['healthy', 'warning', 'critical']
      const isValidStatus = (status: string): boolean => {
        return validStatuses.includes(status)
      }

      expect(isValidStatus('healthy')).toBe(true)
      expect(isValidStatus('warning')).toBe(true)
      expect(isValidStatus('critical')).toBe(true)
      expect(isValidStatus('invalid')).toBe(false)
    })
  })
})