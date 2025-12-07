import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { VersionHistory } from '../VersionHistory'
import { useVersionHistory, useVersionComparison } from '@/lib/hooks/useVersionControl'

// Mock the hooks
vi.mock('@/lib/hooks/useVersionControl', () => ({
  useVersionHistory: vi.fn(),
  useVersionComparison: vi.fn()
}))

// Mock the format utilities
vi.mock('@/lib/utils/format', () => ({
  formatBytes: vi.fn((bytes) => `${bytes} bytes`),
  formatDate: vi.fn((date) => 'Jan 1, 2023'),
  formatTimeAgo: vi.fn((date) => '2 hours ago')
}))

const mockVersions = [
  {
    id: 'version-2',
    asset_id: 'asset-123',
    version_number: 2,
    file_url: 'https://example.com/v2.jpg',
    file_path: 'assets/v2.jpg',
    file_size: 2048,
    checksum: 'abc123',
    changes_description: 'Updated colors',
    metadata: {},
    uploaded_by: 'user-123',
    uploader_name: 'John Doe',
    created_at: '2023-01-02T00:00:00Z'
  },
  {
    id: 'version-1',
    asset_id: 'asset-123',
    version_number: 1,
    file_url: 'https://example.com/v1.jpg',
    file_path: 'assets/v1.jpg',
    file_size: 1024,
    checksum: 'def456',
    changes_description: 'Initial version',
    metadata: {},
    uploaded_by: 'user-456',
    uploader_name: 'Jane Smith',
    created_at: '2023-01-01T00:00:00Z'
  }
]

describe('VersionHistory', () => {
  const mockUseVersionHistory = {
    versions: mockVersions,
    loading: false,
    error: null,
    revertToVersion: vi.fn(),
    refetch: vi.fn()
  }

  const mockUseVersionComparison = {
    comparison: null,
    compareVersions: vi.fn(),
    clearComparison: vi.fn(),
    loading: false,
    error: null
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useVersionHistory as any).mockReturnValue(mockUseVersionHistory)
    ;(useVersionComparison as any).mockReturnValue(mockUseVersionComparison)
  })

  it('should render version history correctly', () => {
    render(<VersionHistory assetId="asset-123" />)

    expect(screen.getByText('Version History')).toBeInTheDocument()
    expect(screen.getByText('Version 2')).toBeInTheDocument()
    expect(screen.getByText('Version 1')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
    expect(screen.getByText('Jane Smith')).toBeInTheDocument()
  })

  it('should show loading state', () => {
    ;(useVersionHistory as any).mockReturnValue({
      ...mockUseVersionHistory,
      loading: true
    })

    render(<VersionHistory assetId="asset-123" />)

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('should show error state', () => {
    ;(useVersionHistory as any).mockReturnValue({
      ...mockUseVersionHistory,
      loading: false,
      error: 'Failed to load versions'
    })

    render(<VersionHistory assetId="asset-123" />)

    expect(screen.getByText('Failed to load versions')).toBeInTheDocument()
  })

  it('should handle version selection for comparison', () => {
    render(<VersionHistory assetId="asset-123" />)

    const version1 = screen.getByText('Version 1').closest('div')
    const version2 = screen.getByText('Version 2').closest('div')

    // Select first version
    fireEvent.click(version1!)
    expect(screen.getByText('Select another version to compare')).toBeInTheDocument()

    // Select second version
    fireEvent.click(version2!)
    expect(screen.getByText('2 versions selected for comparison')).toBeInTheDocument()
    expect(screen.getByText('Compare Selected')).toBeInTheDocument()
  })

  it('should trigger version comparison', async () => {
    render(<VersionHistory assetId="asset-123" />)

    const version1 = screen.getByText('Version 1').closest('div')
    const version2 = screen.getByText('Version 2').closest('div')

    // Select both versions
    fireEvent.click(version1!)
    fireEvent.click(version2!)

    // Click compare button
    const compareButton = screen.getByText('Compare Selected')
    fireEvent.click(compareButton)

    await waitFor(() => {
      expect(mockUseVersionComparison.compareVersions).toHaveBeenCalledWith(
        'version-1',
        'version-2'
      )
    })
  })

  it('should handle version revert', async () => {
    const mockOnRevert = vi.fn()
    
    // Mock window.confirm
    const originalConfirm = window.confirm
    window.confirm = vi.fn(() => true)

    render(<VersionHistory assetId="asset-123" onRevert={mockOnRevert} />)

    const revertButtons = screen.getAllByText('Revert')
    fireEvent.click(revertButtons[0])

    await waitFor(() => {
      expect(mockUseVersionHistory.revertToVersion).toHaveBeenCalledWith(
        'version-1',
        'Reverted to version 1'
      )
    })

    // Restore original confirm
    window.confirm = originalConfirm
  })

  it('should show latest and current badges correctly', () => {
    render(<VersionHistory assetId="asset-123" currentVersion={2} />)

    expect(screen.getByText('Latest')).toBeInTheDocument()
    expect(screen.getByText('Current')).toBeInTheDocument()
  })

  it('should handle empty version history', () => {
    ;(useVersionHistory as any).mockReturnValue({
      ...mockUseVersionHistory,
      versions: []
    })

    render(<VersionHistory assetId="asset-123" />)

    expect(screen.getByText('No version history available')).toBeInTheDocument()
  })

  it('should call onVersionSelect when view button is clicked', () => {
    const mockOnVersionSelect = vi.fn()

    render(<VersionHistory assetId="asset-123" onVersionSelect={mockOnVersionSelect} />)

    const viewButtons = screen.getAllByText('View')
    fireEvent.click(viewButtons[0])

    expect(mockOnVersionSelect).toHaveBeenCalledWith(mockVersions[0])
  })

  it('should disable revert button for current version', () => {
    render(<VersionHistory assetId="asset-123" currentVersion={2} />)

    const revertButtons = screen.getAllByText('Revert')
    
    // Should only have one revert button (for version 1, not version 2 which is current)
    expect(revertButtons).toHaveLength(1)
  })

  it('should show reverting state', async () => {
    const mockRevertToVersion = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)))
    ;(useVersionHistory as any).mockReturnValue({
      ...mockUseVersionHistory,
      revertToVersion: mockRevertToVersion
    })

    // Mock window.confirm
    window.confirm = vi.fn(() => true)

    render(<VersionHistory assetId="asset-123" />)

    const revertButton = screen.getByText('Revert')
    fireEvent.click(revertButton)

    await waitFor(() => {
      expect(screen.getByText('Reverting...')).toBeInTheDocument()
    })
  })
})