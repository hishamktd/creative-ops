'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, Search, MousePointer, Calendar, BarChart3, Users } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface SearchAnalytics {
  popularQueries: Array<{ query: string; count: number }>
  searchTrends: Array<{ date: string; count: number }>
  topClickedAssets: Array<{ asset_id: string; clicks: number }>
}

interface SearchAnalyticsDashboardProps {
  projectId?: string
  userId?: string
  className?: string
}

export function SearchAnalyticsDashboard({
  projectId,
  userId,
  className = ''
}: SearchAnalyticsDashboardProps) {
  const [analytics, setAnalytics] = useState<SearchAnalytics>({
    popularQueries: [],
    searchTrends: [],
    topClickedAssets: []
  })
  const [isLoading, setIsLoading] = useState(false)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d')
  const [error, setError] = useState<string | null>(null)

  // Load analytics data
  const loadAnalytics = async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams()
      if (userId) params.append('userId', userId)
      if (projectId) params.append('projectId', projectId)
      
      const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90
      params.append('days', days.toString())

      const response = await fetch(`/api/search/analytics?${params}`)
      
      if (response.ok) {
        const data = await response.json()
        setAnalytics(data)
      } else {
        throw new Error('Failed to load analytics')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
    } finally {
      setIsLoading(false)
    }
  }

  // Load analytics on mount and when filters change
  useEffect(() => {
    loadAnalytics()
  }, [timeRange, userId, projectId])

  // Format numbers with commas
  const formatNumber = (num: number) => {
    return num.toLocaleString()
  }

  // Get trend direction
  const getTrendDirection = (trends: Array<{ date: string; count: number }>) => {
    if (trends.length < 2) return 'neutral'
    
    const recent = trends.slice(-7) // Last 7 days
    const previous = trends.slice(-14, -7) // Previous 7 days
    
    const recentAvg = recent.reduce((sum, t) => sum + t.count, 0) / recent.length
    const previousAvg = previous.reduce((sum, t) => sum + t.count, 0) / previous.length
    
    if (recentAvg > previousAvg * 1.1) return 'up'
    if (recentAvg < previousAvg * 0.9) return 'down'
    return 'neutral'
  }

  // Calculate total searches
  const totalSearches = analytics.searchTrends.reduce((sum, trend) => sum + trend.count, 0)
  const avgSearchesPerDay = analytics.searchTrends.length > 0 
    ? Math.round(totalSearches / analytics.searchTrends.length)
    : 0

  const trendDirection = getTrendDirection(analytics.searchTrends)

  if (error) {
    return (
      <div className={`p-6 ${className}`}>
        <Card className="p-6 text-center">
          <div className="text-red-500 mb-2">
            <BarChart3 className="w-8 h-8 mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Analytics Error</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={loadAnalytics} variant="secondary">
            Try Again
          </Button>
        </Card>
      </div>
    )
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Search Analytics</h2>
          <p className="text-gray-600">Insights into search behavior and performance</p>
        </div>
        
        {/* Time Range Selector */}
        <div className="flex items-center space-x-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as '7d' | '30d' | '90d')}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <Button onClick={loadAnalytics} variant="secondary" size="sm">
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Searches */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Searches</p>
              <p className="text-2xl font-bold text-gray-900">
                {isLoading ? '...' : formatNumber(totalSearches)}
              </p>
            </div>
            <div className="p-3 bg-blue-100 rounded-full">
              <Search className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <div className="mt-4 flex items-center">
            <div className={`flex items-center text-sm ${
              trendDirection === 'up' ? 'text-green-600' : 
              trendDirection === 'down' ? 'text-red-600' : 'text-gray-600'
            }`}>
              <TrendingUp className={`w-4 h-4 mr-1 ${
                trendDirection === 'down' ? 'rotate-180' : ''
              }`} />
              {trendDirection === 'up' ? 'Trending up' : 
               trendDirection === 'down' ? 'Trending down' : 'Stable'}
            </div>
          </div>
        </Card>

        {/* Average per Day */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg. Searches/Day</p>
              <p className="text-2xl font-bold text-gray-900">
                {isLoading ? '...' : formatNumber(avgSearchesPerDay)}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <BarChart3 className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-600">
              Based on {analytics.searchTrends.length} days of data
            </p>
          </div>
        </Card>

        {/* Popular Queries */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Unique Queries</p>
              <p className="text-2xl font-bold text-gray-900">
                {isLoading ? '...' : formatNumber(analytics.popularQueries.length)}
              </p>
            </div>
            <div className="p-3 bg-purple-100 rounded-full">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-600">
              Different search terms used
            </p>
          </div>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Popular Queries */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <Search className="w-5 h-5 mr-2" />
            Most Popular Queries
          </h3>
          
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-2 bg-gray-100 rounded w-1/2"></div>
                </div>
              ))}
            </div>
          ) : analytics.popularQueries.length > 0 ? (
            <div className="space-y-3">
              {analytics.popularQueries.slice(0, 10).map((query, index) => {
                const maxCount = Math.max(...analytics.popularQueries.map(q => q.count))
                const percentage = (query.count / maxCount) * 100
                
                return (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-900 truncate">
                        "{query.query}"
                      </span>
                      <span className="text-gray-600">
                        {formatNumber(query.count)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No search data available</p>
            </div>
          )}
        </Card>

        {/* Top Clicked Assets */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <MousePointer className="w-5 h-5 mr-2" />
            Most Clicked Assets
          </h3>
          
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-2/3 mb-2"></div>
                  <div className="h-2 bg-gray-100 rounded w-1/3"></div>
                </div>
              ))}
            </div>
          ) : analytics.topClickedAssets.length > 0 ? (
            <div className="space-y-3">
              {analytics.topClickedAssets.slice(0, 10).map((asset, index) => {
                const maxClicks = Math.max(...analytics.topClickedAssets.map(a => a.clicks))
                const percentage = (asset.clicks / maxClicks) * 100
                
                return (
                  <div key={index} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-900 truncate">
                        Asset {asset.asset_id.slice(0, 8)}...
                      </span>
                      <span className="text-gray-600">
                        {formatNumber(asset.clicks)} clicks
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <MousePointer className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No click data available</p>
            </div>
          )}
        </Card>
      </div>

      {/* Search Trends Chart */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <TrendingUp className="w-5 h-5 mr-2" />
          Search Trends Over Time
        </h3>
        
        {isLoading ? (
          <div className="h-64 bg-gray-100 rounded animate-pulse"></div>
        ) : analytics.searchTrends.length > 0 ? (
          <div className="h-64 flex items-end space-x-1 overflow-x-auto">
            {analytics.searchTrends.map((trend, index) => {
              const maxCount = Math.max(...analytics.searchTrends.map(t => t.count))
              const height = maxCount > 0 ? (trend.count / maxCount) * 100 : 0
              
              return (
                <div
                  key={index}
                  className="flex-shrink-0 flex flex-col items-center group"
                  style={{ minWidth: '20px' }}
                >
                  <div
                    className="bg-blue-500 rounded-t transition-all duration-300 group-hover:bg-blue-600 min-h-[2px]"
                    style={{ 
                      height: `${Math.max(height, 2)}%`,
                      width: '16px'
                    }}
                    title={`${trend.date}: ${trend.count} searches`}
                  />
                  <div className="text-xs text-gray-500 mt-1 transform -rotate-45 origin-left">
                    {new Date(trend.date).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="h-64 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p>No trend data available</p>
            </div>
          </div>
        )}
      </Card>

      {/* Insights and Recommendations */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Insights & Recommendations
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search Behavior Insights */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Search Behavior</h4>
            <div className="space-y-2 text-sm text-gray-600">
              {analytics.popularQueries.length > 0 && (
                <p>
                  • Most popular search: "{analytics.popularQueries[0]?.query}" 
                  ({analytics.popularQueries[0]?.count} times)
                </p>
              )}
              {avgSearchesPerDay > 0 && (
                <p>
                  • Average {avgSearchesPerDay} searches per day
                </p>
              )}
              {trendDirection === 'up' && (
                <p className="text-green-600">
                  • Search activity is increasing
                </p>
              )}
              {trendDirection === 'down' && (
                <p className="text-red-600">
                  • Search activity is decreasing
                </p>
              )}
            </div>
          </div>

          {/* Optimization Suggestions */}
          <div className="space-y-3">
            <h4 className="font-medium text-gray-900">Optimization Tips</h4>
            <div className="space-y-2 text-sm text-gray-600">
              {analytics.popularQueries.length > 5 && (
                <p>
                  • Consider creating smart folders for popular searches
                </p>
              )}
              {analytics.topClickedAssets.length > 0 && (
                <p>
                  • Promote frequently accessed assets for better discoverability
                </p>
              )}
              <p>
                • Review search terms to improve asset tagging and metadata
              </p>
              <p>
                • Monitor trends to understand user needs and content gaps
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}