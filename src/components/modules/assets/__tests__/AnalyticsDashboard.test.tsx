import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import AnalyticsDashboard from '../AnalyticsDashboard'
import analyticsService from '@/lib/services/analyticsService'

// Mock analytics service
vi.mock('@/lib/services/analyticsService', () => ({
  default: {
    getDashboardData: vi.fn()
  }
}))

const mockDashboardData = {
  assetPopularity: [
    {
      asset_id: 'asset-1',
      asset_name: 'test-image.jpg',
      view_count: 25,
      download_count: 5,
      total_interactions: 30,
      unique_users: 8,
      avg_duration_minutes: 2.5
    },
    {
      asset_id: 'asset-2',
      asset_name: 'document.pdf',
      view_count: 15,
      download_count: 10,
      total_interactions: 25,
      unique_users: 5,
      avg_duration_minutes: 5.0
    }
  ],
  storageUsage: [
    {
      snapshot_date: '2024-01-01',
      total_size_gb: 15.5,
      file_count: 150,
      growth_rate_percent: 5.2
    },
    {
      snapshot_date: '2024-01-02',
      total_size_gb: 16.0,
      file_count: 155,
      growth_rate_percent: 3.2
    }
  ],
  performanceMetrics: {
    avgUploadSpeed: 10.5,
    avgSearchTime: 250,
    avgPageLoad: 1200,
    apiResponseTime: 150
  },
  userActivity: {
    activeUsers: 12,
    totalSessions: 45,
    avgSessionDuration: 25.5,
    collaborationScore: 78
  },
  systemHealth: {
    status: 'healthy',
    alerts: []
  }
}

const mockDashboardDataWithAlerts = {
  ...mockDashboardData,
  systemHealth: {
    status: 'warning',
    alerts: [
      {
        metric_name: 'cpu_usage',
        status: 'warning',
        value: 75,
        threshold: 70
      },
      {
        metric_name: 'memory_usage',
        status: 'critical',
        value: 95,
        threshold: 90
      }
    ]
  }
}

describe('AnalyticsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render loading state initially', () => {
    analyticsService.getDashboardData.mockImplementation(() => new Promise(() => {}))

    render(<AnalyticsDashboard />)

    expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument()
    expect(screen.getAllByRole('generic')).toHaveLength(expect.any(Number))
  })

  it('should render dashboard data successfully', async () => {
    analyticsService.getDashboardData.mockResolvedValue(mockDashboardData)

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument()
    })

    // Check key metrics
    expect(screen.getByText('10.5 Mbps')).toBeInTheDocument() // Upload speed
    expect(screen.getByText('250ms')).toBeInTheDocument() // Search time
    expect(screen.getByText('12')).toBeInTheDocument() // Active users
    expect(screen.getByText('78%')).toBeInTheDocument() // Collaboration score

    // Check system health
    expect(screen.getByText('HEALTHY')).toBeInTheDocument()

    // Check popular assets
    expect(screen.getByText('test-image.jpg')).toBeInTheDocument()
    expect(screen.getByText('document.pdf')).toBeInTheDocument()
  })

  it('should render system health alerts', async () => {
    analyticsService.getDashboardData.mockResolvedValue(mockDashboardDataWithAlerts)

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('WARNING')).toBeInTheDocument()
    })

    expect(screen.getByText('Active Alerts:')).toBeInTheDocument()
    expect(screen.getByText('cpu_usage')).toBeInTheDocument()
    expect(screen.getByText('memory_usage')).toBeInTheDocument()
    expect(screen.getByText('75 / 70')).toBeInTheDocument()
    expect(screen.getByText('95 / 90')).toBeInTheDocument()
  })

  it('should handle error state', async () => {
    analyticsService.getDashboardData.mockRejectedValue(new Error('API Error'))

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load analytics data')).toBeInTheDocument()
    })

    expect(screen.getByText('Try Again')).toBeInTheDocument()
  })

  it('should handle retry on error', async () => {
    analyticsService.getDashboardData
      .mockRejectedValueOnce(new Error('API Error'))
      .mockResolvedValueOnce(mockDashboardData)

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load analytics data')).toBeInTheDocument()
    })

    const retryButton = screen.getByText('Try Again')
    fireEvent.click(retryButton)

    await waitFor(() => {
      expect(screen.getByText('10.5 Mbps')).toBeInTheDocument()
    })
  })

  it('should handle time range changes', async () => {
    analyticsService.getDashboardData.mockResolvedValue(mockDashboardData)

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument()
    })

    // Click 7 Days button
    const sevenDaysButton = screen.getByText('7 Days')
    fireEvent.click(sevenDaysButton)

    expect(sevenDaysButton).toHaveClass('bg-blue-600 text-white')

    // Click 90 Days button
    const ninetyDaysButton = screen.getByText('90 Days')
    fireEvent.click(ninetyDaysButton)

    expect(ninetyDaysButton).toHaveClass('bg-blue-600 text-white')
  })

  it('should handle refresh functionality', async () => {
    analyticsService.getDashboardData.mockResolvedValue(mockDashboardData)

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Analytics Dashboard')).toBeInTheDocument()
    })

    const refreshButton = screen.getByText('Refresh')
    fireEvent.click(refreshButton)

    expect(analyticsService.getDashboardData).toHaveBeenCalledTimes(2)
  })

  it('should pass project ID to analytics service', async () => {
    analyticsService.getDashboardData.mockResolvedValue(mockDashboardData)

    render(<AnalyticsDashboard projectId="project-123" />)

    await waitFor(() => {
      expect(analyticsService.getDashboardData).toHaveBeenCalledWith('project-123')
    })
  })

  it('should render empty states for missing data', async () => {
    const emptyData = {
      assetPopularity: [],
      storageUsage: [],
      performanceMetrics: {
        avgUploadSpeed: 0,
        avgSearchTime: 0,
        avgPageLoad: 0,
        apiResponseTime: 0
      },
      userActivity: {
        activeUsers: 0,
        totalSessions: 0,
        avgSessionDuration: 0,
        collaborationScore: 0
      },
      systemHealth: {
        status: 'healthy',
        alerts: []
      }
    }

    analyticsService.getDashboardData.mockResolvedValue(emptyData)

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('No asset data available')).toBeInTheDocument()
      expect(screen.getByText('No storage data available')).toBeInTheDocument()
    })
  })

  it('should format file sizes correctly', async () => {
    const dataWithLargeFiles = {
      ...mockDashboardData,
      storageUsage: [
        {
          snapshot_date: '2024-01-01',
          total_size_gb: 1024.5,
          file_count: 1000,
          growth_rate_percent: 10.5
        }
      ]
    }

    analyticsService.getDashboardData.mockResolvedValue(dataWithLargeFiles)

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('1024.50 GB')).toBeInTheDocument()
    })
  })

  it('should format durations correctly', async () => {
    const dataWithLongDurations = {
      ...mockDashboardData,
      assetPopularity: [
        {
          asset_id: 'asset-1',
          asset_name: 'long-video.mp4',
          view_count: 5,
          download_count: 1,
          total_interactions: 6,
          unique_users: 3,
          avg_duration_minutes: 125.5 // 2h 5m
        }
      ],
      userActivity: {
        ...mockDashboardData.userActivity,
        avgSessionDuration: 90.5 // 1h 30m
      }
    }

    analyticsService.getDashboardData.mockResolvedValue(dataWithLongDurations)

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('2h 6m')).toBeInTheDocument() // Asset duration
      expect(screen.getByText('1h 31m')).toBeInTheDocument() // Session duration
    })
  })

  it('should handle growth rate indicators', async () => {
    const dataWithGrowth = {
      ...mockDashboardData,
      storageUsage: [
        {
          snapshot_date: '2024-01-01',
          total_size_gb: 10.0,
          file_count: 100,
          growth_rate_percent: 5.2
        },
        {
          snapshot_date: '2024-01-02',
          total_size_gb: 9.5,
          file_count: 95,
          growth_rate_percent: -5.0
        },
        {
          snapshot_date: '2024-01-03',
          total_size_gb: 9.5,
          file_count: 95,
          growth_rate_percent: 0.0
        }
      ]
    }

    analyticsService.getDashboardData.mockResolvedValue(dataWithGrowth)

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('+5.2%')).toBeInTheDocument()
      expect(screen.getByText('-5.0%')).toBeInTheDocument()
      expect(screen.getByText('0.0%')).toBeInTheDocument()
    })
  })

  it('should apply custom className', () => {
    analyticsService.getDashboardData.mockImplementation(() => new Promise(() => {}))

    const { container } = render(<AnalyticsDashboard className="custom-class" />)

    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('should handle quick action buttons', async () => {
    analyticsService.getDashboardData.mockResolvedValue(mockDashboardData)
    
    // Mock window.open
    const mockOpen = vi.fn()
    Object.defineProperty(window, 'open', { value: mockOpen, writable: true })

    render(<AnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Detailed Reports')).toBeInTheDocument()
    })

    const detailedReportsButton = screen.getByText('Detailed Reports')
    fireEvent.click(detailedReportsButton)

    expect(mockOpen).toHaveBeenCalledWith('/analytics/detailed', '_blank')

    const exportButton = screen.getByText('Export Data')
    fireEvent.click(exportButton)

    expect(mockOpen).toHaveBeenCalledWith('/analytics/export', '_blank')
  })
})