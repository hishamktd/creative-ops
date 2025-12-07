'use client'

import React, { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

interface DashboardInsights {
  assetUsage: {
    totalViews: number
    totalDownloads: number
    uniqueUsers: number
    averageSessionDuration: number
    popularAssets: Array<{
      id: string
      name: string
      views: number
      downloads: number
    }>
    accessPatterns: Array<{
      hour: number
      count: number
    }>
  }
  storageUsage: {
    totalStorage: number
    fileCount: number
    storageByType: Record<string, number>
    quotaUsage: number
    quotaLimit: number
    growthTrend: Array<{
      date: string
      storage: number
      fileCount: number
    }>
  }
  performance: {
    averageUploadSpeed: number
    averageSearchResponseTime: number
    averagePageLoadTime: number
    systemResponseTime: number
    thumbnailGenerationTime: number
  }
  userActivity: {
    activeUsers: number
    totalSessions: number
    averageSessionDuration: number
    collaborationEvents: number
    userEngagement: Array<{
      userId: string
      userName: string
      activityCount: number
      lastActive: string
    }>
    activityByType: Record<string, number>
  }
  systemHealth: {
    overallStatus: 'healthy' | 'warning' | 'critical'
    uptime: number
    errorRate: number
    responseTime: number
    storageHealth: 'healthy' | 'warning' | 'critical'
    databaseHealth: 'healthy' | 'warning' | 'critical'
    alerts: Array<{
      id: string
      severity: 'warning' | 'critical'
      message: string
      timestamp: string
    }>
  }
  generatedAt: string
}

interface AnalyticsDashboardProps {
  projectId: string
  className?: string
}

export function AnalyticsDashboard({ projectId, className = '' }: AnalyticsDashboardProps) {
  const [insights, setInsights] = useState<DashboardInsights | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d')
  const [refreshing, setRefreshing] = useState(false)

  const fetchInsights = async () => {
    try {
      setRefreshing(true)
      const response = await fetch(`/api/analytics/dashboard?projectId=${projectId}&timeRange=${timeRange}`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data')
      }

      const data = await response.json()
      setInsights(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchInsights()
  }, [projectId, timeRange])

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`
    if (minutes > 0) return `${minutes}m ${secs}s`
    return `${secs}s`
  }

  const getStatusColor = (status: 'healthy' | 'warning' | 'critical') => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800'
      case 'warning': return 'bg-yellow-100 text-yellow-800'
      case 'critical': return 'bg-red-100 text-red-800'
    }
  }

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${className}`}>
        <Card className="p-6 text-center">
          <div className="text-red-600 mb-4">
            <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-lg font-medium">Error loading analytics</p>
            <p className="text-sm text-gray-600">{error}</p>
          </div>
          <Button onClick={fetchInsights} variant="outline">
            Try Again
          </Button>
        </Card>
      </div>
    )
  }

  if (!insights) return null

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
          <p className="text-sm text-gray-600">
            Last updated: {new Date(insights.generatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as '24h' | '7d' | '30d')}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="24h">Last 24 hours</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
          <Button
            onClick={fetchInsights}
            disabled={refreshing}
            variant="outline"
            size="sm"
          >
            {refreshing ? (
              <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            Refresh
          </Button>
        </div>
      </div>

      {/* System Health Status */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">System Health</h3>
          <Badge className={getStatusColor(insights.systemHealth.overallStatus)}>
            {insights.systemHealth.overallStatus.toUpperCase()}
          </Badge>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{insights.systemHealth.uptime.toFixed(1)}%</p>
            <p className="text-sm text-gray-600">Uptime</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{insights.systemHealth.errorRate.toFixed(2)}%</p>
            <p className="text-sm text-gray-600">Error Rate</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{insights.systemHealth.responseTime.toFixed(0)}ms</p>
            <p className="text-sm text-gray-600">Response Time</p>
          </div>
          <div className="text-center">
            <Badge className={getStatusColor(insights.systemHealth.storageHealth)}>
              Storage {insights.systemHealth.storageHealth}
            </Badge>
          </div>
        </div>
        
        {insights.systemHealth.alerts.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h4 className="font-medium text-gray-900 mb-2">Active Alerts</h4>
            <div className="space-y-2">
              {insights.systemHealth.alerts.slice(0, 3).map((alert) => (
                <div key={alert.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center space-x-2">
                    <Badge className={alert.severity === 'critical' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}>
                      {alert.severity}
                    </Badge>
                    <span className="text-sm">{alert.message}</span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">{insights.assetUsage.totalViews.toLocaleString()}</p>
              <p className="text-sm text-gray-600">Total Views</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">{insights.assetUsage.totalDownloads.toLocaleString()}</p>
              <p className="text-sm text-gray-600">Downloads</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">{insights.userActivity.activeUsers}</p>
              <p className="text-sm text-gray-600">Active Users</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="p-2 bg-orange-100 rounded-lg">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2m-9 0h10m-10 0a2 2 0 00-2 2v14a2 2 0 002 2h8a2 2 0 002-2V6a2 2 0 00-2-2" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-2xl font-bold text-gray-900">{formatBytes(insights.storageUsage.totalStorage)}</p>
              <p className="text-sm text-gray-600">Storage Used</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Storage Usage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Storage Usage</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Used: {formatBytes(insights.storageUsage.totalStorage)}</span>
                <span>{insights.storageUsage.quotaUsage.toFixed(1)}% of quota</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full" 
                  style={{ width: `${Math.min(insights.storageUsage.quotaUsage, 100)}%` }}
                ></div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium">Total Files</p>
                <p className="text-2xl font-bold">{insights.storageUsage.fileCount.toLocaleString()}</p>
              </div>
              <div>
                <p className="font-medium">Quota Limit</p>
                <p className="text-2xl font-bold">{formatBytes(insights.storageUsage.quotaLimit)}</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Performance Metrics</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Upload Speed</span>
              <span className="font-medium">{insights.performance.averageUploadSpeed.toFixed(1)} Mbps</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Search Response</span>
              <span className="font-medium">{insights.performance.averageSearchResponseTime.toFixed(0)}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Page Load Time</span>
              <span className="font-medium">{insights.performance.averagePageLoadTime.toFixed(0)}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">API Response</span>
              <span className="font-medium">{insights.performance.systemResponseTime.toFixed(0)}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-600">Thumbnail Generation</span>
              <span className="font-medium">{insights.performance.thumbnailGenerationTime.toFixed(1)}s</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Popular Assets */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Popular Assets</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 text-sm font-medium text-gray-600">Asset Name</th>
                <th className="text-right py-2 text-sm font-medium text-gray-600">Views</th>
                <th className="text-right py-2 text-sm font-medium text-gray-600">Downloads</th>
                <th className="text-right py-2 text-sm font-medium text-gray-600">Total Activity</th>
              </tr>
            </thead>
            <tbody>
              {insights.assetUsage.popularAssets.slice(0, 10).map((asset) => (
                <tr key={asset.id} className="border-b">
                  <td className="py-2 text-sm">{asset.name}</td>
                  <td className="py-2 text-sm text-right">{asset.views}</td>
                  <td className="py-2 text-sm text-right">{asset.downloads}</td>
                  <td className="py-2 text-sm text-right font-medium">{asset.views + asset.downloads}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* User Engagement */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">User Engagement</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium mb-3">Activity Summary</h4>
            <div className="space-y-2">
              {Object.entries(insights.userActivity.activityByType).map(([type, count]) => (
                <div key={type} className="flex justify-between text-sm">
                  <span className="capitalize">{type.replace('_', ' ')}</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-medium mb-3">Top Contributors</h4>
            <div className="space-y-2">
              {insights.userActivity.userEngagement.slice(0, 5).map((user) => (
                <div key={user.userId} className="flex justify-between text-sm">
                  <span>{user.userName}</span>
                  <span className="font-medium">{user.activityCount} actions</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}