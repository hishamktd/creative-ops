import React from 'react'
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SearchAnalyticsDashboard } from '../SearchAnalyticsDashboard'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('SearchAnalyticsDashboard', () => {
  const mockAnalyticsData = {
    popularQueries: [
      { query: 'design mockup', count: 150 },
      { query: 'logo design', count: 120 },
      { query: 'ui components', count: 95 },
      { query: 'brand guidelines', count: 80 },
      { query: 'marketing materials', count: 65 }
    ],
    searchTrends: [
      { date: '2024-01-01', count: 25 },
      { date: '2024-01-02', count: 30 },
      { date: '2024-01-03', count: 28 },
      { date: '2024-01-04', count: 35 },
      { date: '2024-01-05', count: 40 },
      { date: '2024-01-06', count: 38 },
      { date: '2024-01-07', count: 42 }
    ],
    topClickedAssets: [
      { asset_id: 'asset-1', clicks: 85 },
      { asset_id: 'asset-2', clicks: 72 },
      { asset_id: 'asset-3', clicks: 68 },
      { asset_id: 'asset-4', clicks: 55 },
      { asset_id: 'asset-5', clicks: 48 }
    ]
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAnalyticsData)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should render dashboard with analytics data', async () => {
    render(<SearchAnalyticsDashboard />)

    // Check if header is rendered
    expect(screen.getByText('Search Analytics')).toBeInTheDocument()
    expect(screen.getByText('Insights into search behavior and performance')).toBeInTheDocument()

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('510')).toBeInTheDocument() // Total searches
    })

    // Check overview cards
    expect(screen.getByText('Total Searches')).toBeInTheDocument()
    expect(screen.getByText('Avg. Searches/Day')).toBeInTheDocument()
    expect(screen.getByText('Unique Queries')).toBeInTheDocument()

    // Check popular queries section
    expect(screen.getByText('Most Popular Queries')).toBeInTheDocument()
    expect(screen.getByText('"design mockup"')).toBeInTheDocument()
    expect(screen.getByText('150')).toBeInTheDocument()

    // Check top clicked assets section
    expect(screen.getByText('Most Clicked Assets')).toBeInTheDocument()
    expect(screen.getByText('85 clicks')).toBeInTheDocument()

    // Check trends section
    expect(screen.getByText('Search Trends Over Time')).toBeInTheDocument()
  })

  it('should handle time range changes', async () => {
    render(<SearchAnalyticsDashboard />)

    // Wait for initial load
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('days=30')
      )
    })

    // Change time range to 7 days
    const timeRangeSelect = screen.getByDisplayValue('Last 30 days')
    fireEvent.change(timeRangeSelect, { target: { value: '7d' } })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('days=7')
      )
    })

    // Change to 90 days
    fireEvent.change(timeRangeSelect, { target: { value: '90d' } })

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('days=90')
      )
    })
  })

  it('should handle refresh button', async () => {
    render(<SearchAnalyticsDashboard />)

    // Wait for initial load
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    // Click refresh button
    const refreshButton = screen.getByText('Refresh')
    fireEvent.click(refreshButton)

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })

  it('should handle project and user filters', async () => {
    render(
      <SearchAnalyticsDashboard 
        projectId="project-123" 
        userId="user-456" 
      />
    )

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('userId=user-456')
      )
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('projectId=project-123')
      )
    })
  })

  it('should display loading state', () => {
    // Mock a delayed response
    mockFetch.mockImplementation(() => 
      new Promise(resolve => setTimeout(() => resolve({
        ok: true,
        json: () => Promise.resolve(mockAnalyticsData)
      }), 1000))
    )

    render(<SearchAnalyticsDashboard />)

    // Check for loading indicators
    expect(screen.getByText('...')).toBeInTheDocument()
    
    // Check for skeleton loaders in charts
    const skeletonElements = document.querySelectorAll('.animate-pulse')
    expect(skeletonElements.length).toBeGreaterThan(0)
  })

  it('should handle error state', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500
    })

    render(<SearchAnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Analytics Error')).toBeInTheDocument()
      expect(screen.getByText('Failed to load analytics')).toBeInTheDocument()
      expect(screen.getByText('Try Again')).toBeInTheDocument()
    })

    // Test retry functionality
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAnalyticsData)
    })

    const tryAgainButton = screen.getByText('Try Again')
    fireEvent.click(tryAgainButton)

    await waitFor(() => {
      expect(screen.getByText('Search Analytics')).toBeInTheDocument()
    })
  })

  it('should handle empty data gracefully', async () => {
    const emptyData = {
      popularQueries: [],
      searchTrends: [],
      topClickedAssets: []
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(emptyData)
    })

    render(<SearchAnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('No search data available')).toBeInTheDocument()
      expect(screen.getByText('No click data available')).toBeInTheDocument()
      expect(screen.getByText('No trend data available')).toBeInTheDocument()
    })

    // Check that totals show 0
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('should calculate trends correctly', async () => {
    const trendingUpData = {
      ...mockAnalyticsData,
      searchTrends: [
        // Previous week (lower)
        { date: '2024-01-01', count: 10 },
        { date: '2024-01-02', count: 12 },
        { date: '2024-01-03', count: 11 },
        { date: '2024-01-04', count: 13 },
        { date: '2024-01-05', count: 14 },
        { date: '2024-01-06', count: 12 },
        { date: '2024-01-07', count: 15 },
        // Recent week (higher)
        { date: '2024-01-08', count: 25 },
        { date: '2024-01-09', count: 28 },
        { date: '2024-01-10', count: 30 },
        { date: '2024-01-11', count: 32 },
        { date: '2024-01-12', count: 35 },
        { date: '2024-01-13', count: 33 },
        { date: '2024-01-14', count: 38 }
      ]
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(trendingUpData)
    })

    render(<SearchAnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Trending up')).toBeInTheDocument()
    })
  })

  it('should format numbers correctly', async () => {
    const largeNumbersData = {
      popularQueries: [
        { query: 'popular search', count: 1500 }
      ],
      searchTrends: Array.from({ length: 30 }, (_, i) => ({
        date: `2024-01-${String(i + 1).padStart(2, '0')}`,
        count: 100
      })),
      topClickedAssets: [
        { asset_id: 'asset-1', clicks: 2500 }
      ]
    }

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(largeNumbersData)
    })

    render(<SearchAnalyticsDashboard />)

    await waitFor(() => {
      // Check for comma-formatted numbers
      expect(screen.getByText('3,000')).toBeInTheDocument() // Total searches
      expect(screen.getByText('1,500')).toBeInTheDocument() // Popular query count
      expect(screen.getByText('2,500 clicks')).toBeInTheDocument() // Asset clicks
    })
  })

  it('should display insights and recommendations', async () => {
    render(<SearchAnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Insights & Recommendations')).toBeInTheDocument()
      expect(screen.getByText('Search Behavior')).toBeInTheDocument()
      expect(screen.getByText('Optimization Tips')).toBeInTheDocument()
    })

    // Check for specific insights
    await waitFor(() => {
      expect(screen.getByText(/Most popular search:/)).toBeInTheDocument()
      expect(screen.getByText(/Average \d+ searches per day/)).toBeInTheDocument()
    })

    // Check for optimization tips
    expect(screen.getByText(/Consider creating smart folders/)).toBeInTheDocument()
    expect(screen.getByText(/Review search terms to improve/)).toBeInTheDocument()
  })

  it('should render progress bars correctly', async () => {
    render(<SearchAnalyticsDashboard />)

    await waitFor(() => {
      // Check that progress bars are rendered
      const progressBars = document.querySelectorAll('.bg-blue-500, .bg-green-500')
      expect(progressBars.length).toBeGreaterThan(0)
    })
  })

  it('should handle network errors', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'))

    render(<SearchAnalyticsDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Analytics Error')).toBeInTheDocument()
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('should show correct date formatting in trends', async () => {
    render(<SearchAnalyticsDashboard />)

    await waitFor(() => {
      // Check that dates are formatted correctly (e.g., "Jan 1")
      const dateElements = document.querySelectorAll('[title*="2024-01-01"]')
      expect(dateElements.length).toBeGreaterThan(0)
    })
  })

  it('should handle hover effects on trend bars', async () => {
    render(<SearchAnalyticsDashboard />)

    await waitFor(() => {
      const trendBars = document.querySelectorAll('.bg-blue-500')
      expect(trendBars.length).toBeGreaterThan(0)
      
      // Check that hover classes are present
      const hoverElements = document.querySelectorAll('.group-hover\\:bg-blue-600')
      expect(hoverElements.length).toBeGreaterThan(0)
    })
  })
})