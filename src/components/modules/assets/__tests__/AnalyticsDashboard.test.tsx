import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AnalyticsDashboard } from '../AnalyticsDashboard'

// Mock fetch
global.fetch = vi.fn()

const mockInsights = {
  assetUsage: {
    totalViews: 1250,
    totalDownloads: 340,
    uniqueUsers: 25,
    averageSessionDuration: 420,
    popularAssets: [
      { id: 'asset-1', name: 'Logo Design.png', views: 150, downloads: 45 },
      { id: 'asset-2', name: 'Brand Guidelines.pdf', views: 120, downloads: 30 },
      { id: 'asset-3', name: 'Product Photo.jpg', views: 100, downloads: 25 }
    ],
    accessPatterns: [
      { hour: 9, count: 45 },
      { hour: 10, count: 60 },
      { hour: 11, count: 55 },
      { hour: 14, count: 70 },
      { hour: 15, count: 65 }
    ]
  },
  storageUsage: {
    totalStorage: 5368709120, // 5GB
    fileCount: 1250,
    storageByType: {
      'image': 2684354560, // 2.5GB
      'video': 1610612736, // 1.5GB
      'document': 1073741824 // 1GB
    },
    quotaUsage: 53.7,
    quotaLimit: 10737418240, // 10GB
    growthTrend: [
      { date: '2023-01-01', storage: 4000000000, fileCount: 1000 },
      { date: '2023-01-02', storage: 4500000000, fileCount: 1100 },
      { date: '2023-01-03', storage: 5000000000, fileCount: 1200 },
      { date: '2023-01-04', storage: 5368709120, fileCount: 1250 }
    ]
  },
  performance: {
    averageUploadSpeed: 12.5,
    averageSearchResponseTime: 145,
    averagePageLoadTime: 1200,
    systemResponseTime: 180,
    thumbnailGenerationTime: 2.3,
    performanceTrends: [
      { date: '2023-01-01', metric: 'upload_speed', value: 11.2 },
      { date: '2023-01-02', metric: 'upload_speed', value: 12.8 },
      { date: '2023-01-03', metric: 'search_response', value: 150 }
    ]
  },
  userActivity: {
    activeUsers: 25,
    totalSessions: 180,
    averageSessionDuration: 420,
    collaborationEvents: 45,
    userEngagement: [
      { userId: 'user-1', userName: 'john@example.com', activityCount: 85, lastActive: '2023-01-04T15:30:00Z' },
      { userId: 'user-2', userName: 'jane@example.com', activityCount: 72, lastActive: '2023-01-04T14:45:00Z' },
      { userId: 'user-3', userName: 'bob@example.com', activityCount: 58, lastActive: '2023-01-04T16:20:00Z' }
    ],
    activityByType: {
      upload: 120,
      search: 200,
      collaboration: 45,
      folder_create: 15,
      asset_organize: 30
    }
  },
  systemHealth: {
    overallStatus: 'healthy' as const,
    uptime: 99.8,
    errorRate: 0.2,
    responseTime: 180,
    storageHealth: 'healthy' as const,
    databaseHealth: 'healthy' as const,
    alerts: []
  },
  generatedAt: '2023-01-04T16:30:00Z'
}

describe('AnalyticsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render loading state initially', () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockImplementation(() => new Promise(() => {})) // Never resolves

    render(<AnalyticsDashboard projectId="project-123" />)

    expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument()
    
    // Should show loading skeleton
    const skeletonCards = document.querySelectorAll('.animate-pulse')
    expect(skeletonCards.length).toBeGreaterThan(0)
  })

  it('should render analytics data successfully', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(new Response(JSON.stringify(mockInsights)))

    render(<AnalyticsDashboard projectId="project-123" />)

    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument()
    })

    // Check key metrics
    expect(screen.getByText('1,250')).toBeInTheDocument() // Total Views
    expect(screen.getByText('340')).toBeInTheDocument() // Downloads
    expect(screen.getByText('25')).toBeInTheDocument() // Active Users
    expect(screen.getByText('5.00 GB')).toBeInTheDocument() // Storage Used

    // Check system health
    expect(screen.getByText('HEALTHY')).toBeInTheDocument()
    expect(screen.getByText('99.8%')).toBeInTheDocument() // Uptime
    expect(screen.getByText('0.20%')).toBeInTheDocument() // Error Rate
    expect(screen.getByText('180ms')).toBeInTheDocument() // Response Time

    // Check popular assets table
    expect(screen.getByText('Logo Design.png')).toBeInTheDocument()
    expect(screen.getByText('Brand Guidelines.pdf')).toBeInTheDocument()
    expect(screen.getByText('Product Photo.jpg')).toBeInTheDocument()

    // Check performance metrics
    expect(screen.getByText('12.5 Mbps')).toBeInTheDocument() // Upload Speed
    expect(screen.getByText('145ms')).toBeInTheDocument() // Search Response
    expect(screen.getByText('1200ms')).toBeInTheDocument() // Page Load Time

    // Check user engagement
    expect(screen.getByText('john@example.com')).toBeInTheDocument()
    expect(screen.getByText('jane@example.com')).toBeInTheDocument()
    expect(screen.getByText('85 actions')).toBeInTheDocument()
  })

  it('should handle API errors gracefully', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockRejectedValue(new Error('Network error'))

    render(<AnalyticsDashboard projectId="project-123" />)

    await waitFor(() => {
      expect(screen.getByText('Error loading analytics')).toBeInTheDocument()
      expect(screen.getByText('Network error')).toBeInTheDocument()
      expect(screen.getByText('Try Again')).toBeInTheDocument()
    })
  })

  it('should handle HTTP error responses', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(new Response('Not Found', { status: 404 }))

    render(<AnalyticsDashboard projectId="project-123" />)

    await waitFor(() => {
      expect(screen.getByText('Error loading analytics')).toBeInTheDocument()
      expect(screen.getByText('Failed to fetch analytics data')).toBeInTheDocument()
    })
  })

  it('should allow time range selection', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(new Response(JSON.stringify(mockInsights)))

    render(<AnalyticsDashboard projectId="project-123" />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('Last 7 days')).toBeInTheDocument()
    })

    // Change time range
    const timeRangeSelect = screen.getByDisplayValue('Last 7 days')
    fireEvent.change(timeRangeSelect, { target: { value: '30d' } })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('timeRange=30d'),
        expect.any(Object)
      )
    })
  })

  it('should refresh data when refresh button is clicked', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(new Response(JSON.stringify(mockInsights)))

    render(<AnalyticsDashboard projectId="project-123" />)

    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument()
    })

    // Clear previous calls
    mockFetch.mockClear()

    // Click refresh button
    const refreshButton = screen.getByRole('button', { name: /refresh/i })
    fireEvent.click(refreshButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/analytics/dashboard'),
        expect.any(Object)
      )
    })
  })

  it('should show system alerts when present', async () => {
    const insightsWithAlerts = {
      ...mockInsights,
      systemHealth: {
        ...mockInsights.systemHealth,
        overallStatus: 'warning' as const,
        alerts: [
          {
            id: 'alert-1',
            severity: 'warning' as const,
            message: 'High storage usage detected',
            timestamp: '2023-01-04T16:25:00Z'
          },
          {
            id: 'alert-2',
            severity: 'critical' as const,
            message: 'Database connection timeout',
            timestamp: '2023-01-04T16:20:00Z'
          }
        ]
      }
    }

    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(new Response(JSON.stringify(insightsWithAlerts)))

    render(<AnalyticsDashboard projectId="project-123" />)

    await waitFor(() => {
      expect(screen.getByText('WARNING')).toBeInTheDocument()
      expect(screen.getByText('Active Alerts')).toBeInTheDocument()
      expect(screen.getByText('High storage usage detected')).toBeInTheDocument()
      expect(screen.getByText('Database connection timeout')).toBeInTheDocument()
    })
  })

  it('should format bytes correctly', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(new Response(JSON.stringify(mockInsights)))

    render(<AnalyticsDashboard projectId="project-123" />)

    await waitFor(() => {
      // Storage should be formatted as GB
      expect(screen.getByText('5.00 GB')).toBeInTheDocument()
      // Quota limit should be formatted as GB
      expect(screen.getByText('10.00 GB')).toBeInTheDocument()
    })
  })

  it('should show storage usage percentage', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(new Response(JSON.stringify(mockInsights)))

    render(<AnalyticsDashboard projectId="project-123" />)

    await waitFor(() => {
      expect(screen.getByText('53.7% of quota')).toBeInTheDocument()
    })

    // Check that progress bar is rendered with correct width
    const progressBar = document.querySelector('.bg-blue-600')
    expect(progressBar).toHaveStyle({ width: '53.7%' })
  })

  it('should display last updated timestamp', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(new Response(JSON.stringify(mockInsights)))

    render(<AnalyticsDashboard projectId="project-123" />)

    await waitFor(() => {
      expect(screen.getByText(/Last updated:/)).toBeInTheDocument()
    })
  })

  it('should handle empty popular assets gracefully', async () => {
    const insightsWithEmptyAssets = {
      ...mockInsights,
      assetUsage: {
        ...mockInsights.assetUsage,
        popularAssets: []
      }
    }

    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(new Response(JSON.stringify(insightsWithEmptyAssets)))

    render(<AnalyticsDashboard projectId="project-123" />)

    await waitFor(() => {
      expect(screen.getByText('Popular Assets')).toBeInTheDocument()
      // Table headers should still be present
      expect(screen.getByText('Asset Name')).toBeInTheDocument()
      expect(screen.getByText('Views')).toBeInTheDocument()
      expect(screen.getByText('Downloads')).toBeInTheDocument()
    })
  })

  it('should apply custom className', () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockImplementation(() => new Promise(() => {}))

    const { container } = render(
      <AnalyticsDashboard projectId="project-123" className="custom-class" />
    )

    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('should make correct API call with project ID and time range', async () => {
    const mockFetch = vi.mocked(fetch)
    mockFetch.mockResolvedValue(new Response(JSON.stringify(mockInsights)))

    render(<AnalyticsDashboard projectId="project-123" />)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/analytics/dashboard?projectId=project-123&timeRange=7d'
      )
    })
  })
})