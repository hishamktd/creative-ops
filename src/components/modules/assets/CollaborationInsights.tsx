'use client'

import React, { useState, useEffect } from 'react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts'
import { 
  Users, 
  Activity, 
  TrendingUp, 
  Clock, 
  MessageCircle, 
  Upload,
  Calendar,
  Award,
  Target
} from 'lucide-react'
import { notificationService } from '@/lib/services/notificationService'

interface CollaborationInsightsProps {
  projectId: string
  className?: string
  timeRange?: number // days
}

interface InsightData {
  totalActivities: number
  activeUsers: number
  activitiesByType: Record<string, number>
  activitiesByUser: Record<string, { name: string; count: number }>
  dailyActivity: Record<string, number>
}

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#84cc16', '#f97316']

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  asset_uploaded: 'Uploads',
  asset_updated: 'Updates',
  asset_commented: 'Comments',
  asset_approved: 'Approvals',
  asset_rejected: 'Rejections',
  folder_created: 'Folders Created',
  version_created: 'Versions',
  asset_shared: 'Shares'
}

export function CollaborationInsights({ 
  projectId, 
  className = '', 
  timeRange = 30 
}: CollaborationInsightsProps) {
  const [insights, setInsights] = useState<InsightData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedMetric, setSelectedMetric] = useState<'activities' | 'users' | 'engagement'>('activities')

  useEffect(() => {
    loadInsights()
  }, [projectId, timeRange])

  const loadInsights = async () => {
    try {
      setLoading(true)
      const data = await notificationService.getCollaborationInsights(projectId, timeRange)
      setInsights(data)
    } catch (error) {
      console.error('Error loading collaboration insights:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    )
  }

  if (!insights) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="text-center text-gray-500">
          <Activity className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <p>No collaboration data available</p>
        </div>
      </div>
    )
  }

  // Prepare chart data
  const activityTypeData = Object.entries(insights.activitiesByType).map(([type, count]) => ({
    name: ACTIVITY_TYPE_LABELS[type] || type,
    value: count,
    type
  }))

  const userActivityData = Object.entries(insights.activitiesByUser)
    .map(([userId, userData]) => ({
      name: userData.name,
      activities: userData.count
    }))
    .sort((a, b) => b.activities - a.activities)
    .slice(0, 10)

  const dailyActivityData = Object.entries(insights.dailyActivity)
    .map(([date, count]) => ({
      date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      activities: count
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Calculate engagement metrics
  const avgActivitiesPerUser = insights.activeUsers > 0 ? 
    Math.round(insights.totalActivities / insights.activeUsers) : 0
  
  const mostActiveDay = Object.entries(insights.dailyActivity)
    .reduce((max, [date, count]) => count > max.count ? { date, count } : max, 
    { date: '', count: 0 })

  const engagementScore = Math.min(100, Math.round(
    (insights.totalActivities / timeRange) * 10 + 
    (insights.activeUsers * 5) + 
    (Object.keys(insights.activitiesByType).length * 2)
  ))

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Collaboration Insights
            </h3>
          </div>
          
          <div className="flex items-center space-x-2">
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value as any)}
              className="text-sm border border-gray-300 rounded px-2 py-1"
            >
              <option value="activities">Activities</option>
              <option value="users">Users</option>
              <option value="engagement">Engagement</option>
            </select>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="p-6 border-b border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Total Activities</span>
            </div>
            <p className="text-2xl font-bold text-blue-900 mt-1">
              {insights.totalActivities.toLocaleString()}
            </p>
            <p className="text-xs text-blue-700">
              Last {timeRange} days
            </p>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-900">Active Users</span>
            </div>
            <p className="text-2xl font-bold text-green-900 mt-1">
              {insights.activeUsers}
            </p>
            <p className="text-xs text-green-700">
              {avgActivitiesPerUser} avg activities/user
            </p>
          </div>

          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <Target className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-purple-900">Engagement Score</span>
            </div>
            <p className="text-2xl font-bold text-purple-900 mt-1">
              {engagementScore}%
            </p>
            <p className="text-xs text-purple-700">
              {engagementScore >= 80 ? 'Excellent' : 
               engagementScore >= 60 ? 'Good' : 
               engagementScore >= 40 ? 'Fair' : 'Low'}
            </p>
          </div>

          <div className="bg-orange-50 rounded-lg p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-orange-600" />
              <span className="text-sm font-medium text-orange-900">Peak Day</span>
            </div>
            <p className="text-2xl font-bold text-orange-900 mt-1">
              {mostActiveDay.count}
            </p>
            <p className="text-xs text-orange-700">
              {new Date(mostActiveDay.date).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="p-6">
        {selectedMetric === 'activities' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Activity Types Pie Chart */}
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-4">Activity Types</h4>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={activityTypeData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {activityTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Daily Activity Line Chart */}
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-4">Daily Activity Trend</h4>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={dailyActivityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="activities" 
                    stroke="#6366f1" 
                    fill="#6366f1" 
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {selectedMetric === 'users' && (
          <div>
            <h4 className="text-lg font-medium text-gray-900 mb-4">Most Active Users</h4>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={userActivityData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} />
                <Tooltip />
                <Bar dataKey="activities" fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {selectedMetric === 'engagement' && (
          <div className="space-y-6">
            {/* Engagement Breakdown */}
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-4">Engagement Breakdown</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Activity Frequency</span>
                    <MessageCircle className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full" 
                        style={{ width: `${Math.min(100, (insights.totalActivities / timeRange) * 2)}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-600">
                      {Math.round(insights.totalActivities / timeRange)}/day
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">User Participation</span>
                    <Users className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full" 
                        style={{ width: `${Math.min(100, insights.activeUsers * 10)}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-600">
                      {insights.activeUsers} users
                    </span>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Activity Diversity</span>
                    <Award className="w-4 h-4 text-gray-500" />
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-purple-600 h-2 rounded-full" 
                        style={{ width: `${Math.min(100, Object.keys(insights.activitiesByType).length * 12.5)}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-600">
                      {Object.keys(insights.activitiesByType).length} types
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Activity Heatmap (simplified) */}
            <div>
              <h4 className="text-lg font-medium text-gray-900 mb-4">Activity Heatmap</h4>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: Math.min(timeRange, 35) }, (_, i) => {
                  const date = new Date()
                  date.setDate(date.getDate() - i)
                  const dateStr = date.toISOString().split('T')[0]
                  const activity = insights.dailyActivity[dateStr] || 0
                  const intensity = Math.min(4, Math.floor(activity / 2))
                  
                  return (
                    <div
                      key={i}
                      className={`w-4 h-4 rounded-sm ${
                        intensity === 0 ? 'bg-gray-100' :
                        intensity === 1 ? 'bg-green-200' :
                        intensity === 2 ? 'bg-green-300' :
                        intensity === 3 ? 'bg-green-400' :
                        'bg-green-500'
                      }`}
                      title={`${date.toLocaleDateString()}: ${activity} activities`}
                    />
                  )
                })}
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                <span>Less</span>
                <div className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-gray-100 rounded-sm"></div>
                  <div className="w-3 h-3 bg-green-200 rounded-sm"></div>
                  <div className="w-3 h-3 bg-green-300 rounded-sm"></div>
                  <div className="w-3 h-3 bg-green-400 rounded-sm"></div>
                  <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
                </div>
                <span>More</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Insights Summary */}
      <div className="p-6 border-t border-gray-200 bg-gray-50">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Key Insights</h4>
        <div className="space-y-1 text-sm text-gray-600">
          {insights.totalActivities > 0 && (
            <p>
              • Team generated <strong>{insights.totalActivities}</strong> activities 
              with <strong>{insights.activeUsers}</strong> active members
            </p>
          )}
          {Object.keys(insights.activitiesByType).length > 0 && (
            <p>
              • Most common activity: <strong>
                {Object.entries(insights.activitiesByType)
                  .sort(([,a], [,b]) => b - a)[0]?.[0]?.replace(/_/g, ' ') || 'None'}
              </strong>
            </p>
          )}
          {mostActiveDay.count > 0 && (
            <p>
              • Peak activity day had <strong>{mostActiveDay.count}</strong> activities
            </p>
          )}
          {engagementScore >= 80 && (
            <p>• 🎉 Excellent team engagement! Keep up the great collaboration.</p>
          )}
          {engagementScore < 40 && (
            <p>• 💡 Consider encouraging more team interaction and asset sharing.</p>
          )}
        </div>
      </div>
    </div>
  )
}