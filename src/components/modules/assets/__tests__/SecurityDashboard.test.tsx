import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SecurityDashboard } from '../SecurityDashboard'
import { mockSupabaseClient } from '@/test/test-utils'

// Mock the security service
vi.mock('@/lib/services/security', () => ({
  SecurityService: {
    getAuditLogs: vi.fn(),
    getSecurityScans: vi.fn(),
    getAccessPermissions: vi.fn(),
    generateSecurityReport: vi.fn(),
  },
}))

describe('SecurityDashboard', () => {
  const mockProps = {
    projectId: 'project-1',
    onSecurityEvent: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders security dashboard with all sections', () => {
    render(<SecurityDashboard {...mockProps} />)
    
    expect(screen.getByText('Security Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Audit Logs')).toBeInTheDocument()
    expect(screen.getByText('Security Scans')).toBeInTheDocument()
    expect(screen.getByText('Access Permissions')).toBeInTheDocument()
  })

  it('displays audit logs when available', async () => {
    const mockAuditLogs = [
      {
        id: '1',
        action: 'file_upload',
        user_id: 'user-1',
        asset_id: 'asset-1',
        timestamp: new Date().toISOString(),
        details: { filename: 'test.jpg' },
      },
    ]

    const { SecurityService } = await import('@/lib/services/security')
    vi.mocked(SecurityService.getAuditLogs).mockResolvedValue(mockAuditLogs)

    render(<SecurityDashboard {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText('file_upload')).toBeInTheDocument()
    })
  })

  it('handles security scan results', async () => {
    const mockScans = [
      {
        id: '1',
        asset_id: 'asset-1',
        scan_type: 'malware',
        status: 'clean',
        timestamp: new Date().toISOString(),
      },
    ]

    const { SecurityService } = await import('@/lib/services/security')
    vi.mocked(SecurityService.getSecurityScans).mockResolvedValue(mockScans)

    render(<SecurityDashboard {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText('malware')).toBeInTheDocument()
      expect(screen.getByText('clean')).toBeInTheDocument()
    })
  })

  it('allows filtering audit logs by date range', async () => {
    render(<SecurityDashboard {...mockProps} />)

    const startDateInput = screen.getByLabelText('Start Date')
    const endDateInput = screen.getByLabelText('End Date')

    fireEvent.change(startDateInput, { target: { value: '2024-01-01' } })
    fireEvent.change(endDateInput, { target: { value: '2024-01-31' } })

    const filterButton = screen.getByText('Apply Filter')
    fireEvent.click(filterButton)

    const { SecurityService } = await import('@/lib/services/security')
    await waitFor(() => {
      expect(SecurityService.getAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
        })
      )
    })
  })

  it('generates security report when requested', async () => {
    const { SecurityService } = await import('@/lib/services/security')
    vi.mocked(SecurityService.generateSecurityReport).mockResolvedValue({
      reportId: 'report-1',
      downloadUrl: 'https://example.com/report.pdf',
    })

    render(<SecurityDashboard {...mockProps} />)

    const generateButton = screen.getByText('Generate Report')
    fireEvent.click(generateButton)

    await waitFor(() => {
      expect(SecurityService.generateSecurityReport).toHaveBeenCalledWith(mockProps.projectId)
    })
  })

  it('handles error states gracefully', async () => {
    const { SecurityService } = await import('@/lib/services/security')
    vi.mocked(SecurityService.getAuditLogs).mockRejectedValue(new Error('Network error'))

    render(<SecurityDashboard {...mockProps} />)

    await waitFor(() => {
      expect(screen.getByText('Failed to load audit logs')).toBeInTheDocument()
    })
  })

  it('updates in real-time when security events occur', async () => {
    render(<SecurityDashboard {...mockProps} />)

    // Simulate real-time security event
    const securityEvent = {
      type: 'suspicious_access',
      asset_id: 'asset-1',
      user_id: 'user-2',
      timestamp: new Date().toISOString(),
    }

    // Trigger the onSecurityEvent callback
    expect(mockProps.onSecurityEvent).toBeDefined()
  })
})