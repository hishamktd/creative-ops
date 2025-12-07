'use client'

import React, { useState, useEffect } from 'react'
import { SecurityService, type SecurityScan } from '../../../lib/services/security'
import { Card } from '../../ui/Card'
import { Button } from '../../ui/Button'

interface SecurityDashboardProps {
  projectId?: string
}

interface SecurityStats {
  totalScans: number
  cleanAssets: number
  threatsFound: number
  pendingScans: number
  recentThreats: SecurityScan[]
}

export function SecurityDashboard({ projectId }: SecurityDashboardProps) {
  const [stats, setStats] = useState<SecurityStats>({
    totalScans: 0,
    cleanAssets: 0,
    threatsFound: 0,
    pendingScans: 0,
    recentThreats: []
  })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    loadSecurityStats()
  }, [projectId])

  const loadSecurityStats = async () => {
    setLoading(true)
    try {
      const data = await SecurityService.getSecurityDashboard(projectId)
      setStats(data)
    } catch (error) {
      console.error('Failed to load security stats:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadSecurityStats()
    setRefreshing(false)
  }

  const getThreatLevelColor = (level?: string) => {
    switch (level) {
      case 'low': return 'bg-yellow-100 text-yellow-800'
      case 'medium': return 'bg-orange-100 text-orange-800'
      case 'high': return 'bg-red-100 text-red-800'
      case 'critical': return 'bg-red-200 text-red-900'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'clean': return 'bg-green-100 text-green-800'
      case 'infected': return 'bg-red-100 text-red-800'
      case 'pending': return 'bg-yellow-100 text-yellow-800'
      case 'scanning': return 'bg-blue-100 text-blue-800'
      case 'error': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="p-6">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Security Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Scans</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalScans}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Clean Assets</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.cleanAssets}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Threats Found</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.threatsFound}</p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pending Scans</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.pendingScans}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Threats */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Recent Security Threats</h3>
          <Button
            onClick={handleRefresh}
            disabled={refreshing}
            variant="outline"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        {stats.recentThreats.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <p className="text-lg font-medium">No threats detected</p>
            <p className="text-sm">Your assets are secure</p>
          </div>
        ) : (
          <div className="space-y-4">
            {stats.recentThreats.map((threat) => (
              <div key={threat.id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(threat.scan_status)}`}>
                        {threat.scan_status.toUpperCase()}
                      </span>
                      {threat.threat_level && (
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getThreatLevelColor(threat.threat_level)}`}>
                          {threat.threat_level.toUpperCase()} RISK
                        </span>
                      )}
                      <span className="text-xs text-gray-500">
                        {threat.scanner_name}
                      </span>
                    </div>

                    <h4 className="font-medium text-gray-900 mb-1">
                      Asset ID: {threat.asset_id}
                    </h4>

                    {threat.threats_found && threat.threats_found.length > 0 && (
                      <div className="mb-2">
                        <p className="text-sm font-medium text-red-800 mb-1">Threats Detected:</p>
                        <ul className="text-sm text-red-700 list-disc list-inside">
                          {threat.threats_found.map((threatName, index) => (
                            <li key={index}>{threatName}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="flex items-center space-x-4 text-xs text-gray-600">
                      <span>
                        Scanned: {threat.scanned_at ? new Date(threat.scanned_at).toLocaleString() : 'N/A'}
                      </span>
                      {threat.scan_duration_ms && (
                        <span>
                          Duration: {threat.scan_duration_ms}ms
                        </span>
                      )}
                    </div>

                    {threat.scan_results && Object.keys(threat.scan_results).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800">
                          View Scan Details
                        </summary>
                        <pre className="mt-2 p-2 bg-white rounded text-xs text-gray-600 overflow-x-auto">
                          {JSON.stringify(threat.scan_results, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>

                  <div className="flex-shrink-0 ml-4">
                    <Button
                      variant="outline"
                      className="text-red-600 border-red-300 hover:bg-red-50"
                    >
                      Quarantine
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Security Recommendations */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Recommendations</h3>
        <div className="space-y-3">
          {stats.pendingScans > 0 && (
            <div className="flex items-start space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="font-medium text-yellow-800">Pending Security Scans</p>
                <p className="text-sm text-yellow-700">
                  {stats.pendingScans} assets are waiting for security scanning. Consider enabling real-time scanning for faster threat detection.
                </p>
              </div>
            </div>
          )}

          {stats.threatsFound > 0 && (
            <div className="flex items-start space-x-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <svg className="w-5 h-5 text-red-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="font-medium text-red-800">Security Threats Detected</p>
                <p className="text-sm text-red-700">
                  {stats.threatsFound} threats have been detected. Review and quarantine infected assets immediately.
                </p>
              </div>
            </div>
          )}

          {stats.totalScans === 0 && (
            <div className="flex items-start space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium text-blue-800">Enable Security Scanning</p>
                <p className="text-sm text-blue-700">
                  No security scans have been performed yet. Enable automatic scanning to protect your assets from threats.
                </p>
              </div>
            </div>
          )}

          {stats.totalScans > 0 && stats.threatsFound === 0 && stats.pendingScans === 0 && (
            <div className="flex items-start space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg">
              <svg className="w-5 h-5 text-green-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="font-medium text-green-800">All Clear</p>
                <p className="text-sm text-green-700">
                  All assets have been scanned and no threats were detected. Your security posture is good.
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}