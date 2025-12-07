import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SecurityService } from '../security'

// Mock Supabase
vi.mock('../../supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        }))
      })),
      upsert: vi.fn(() => Promise.resolve({ error: null })),
      delete: vi.fn(() => ({
        match: vi.fn(() => Promise.resolve({ error: null }))
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ error: null }))
      })),
      insert: vi.fn(() => Promise.resolve({ error: null }))
    })),
    auth: {
      getUser: vi.fn(() => Promise.resolve({
        data: { user: { id: 'test-user-id' } },
        error: null
      }))
    }
  }
}))

describe('SecurityService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkAssetPermission', () => {
    it('should check asset permission successfully', async () => {
      const { supabase } = await import('../../supabase/client')
      vi.mocked(supabase.rpc).mockResolvedValue({ data: true, error: null })

      const result = await SecurityService.checkAssetPermission('asset-1', 'view', 'user-1')

      expect(result).toBe(true)
      expect(supabase.rpc).toHaveBeenCalledWith('check_asset_permission', {
        p_asset_id: 'asset-1',
        p_user_id: 'user-1',
        p_required_permission: 'view'
      })
    })

    it('should return false on permission check error', async () => {
      const { supabase } = await import('../../supabase/client')
      vi.mocked(supabase.rpc).mockResolvedValue({ 
        data: null, 
        error: { message: 'Permission denied' } 
      })

      const result = await SecurityService.checkAssetPermission('asset-1', 'edit', 'user-1')

      expect(result).toBe(false)
    })

    it('should handle permission check exceptions', async () => {
      const { supabase } = await import('../../supabase/client')
      vi.mocked(supabase.rpc).mockRejectedValue(new Error('Network error'))

      const result = await SecurityService.checkAssetPermission('asset-1', 'view', 'user-1')

      expect(result).toBe(false)
    })
  })

  describe('grantPermission', () => {
    it('should grant permission successfully', async () => {
      const { supabase } = await import('../../supabase/client')
      const mockUpsert = vi.fn(() => Promise.resolve({ error: null }))
      vi.mocked(supabase.from).mockReturnValue({
        upsert: mockUpsert
      } as any)

      const result = await SecurityService.grantPermission(
        'asset-1',
        'user-1',
        'edit',
        'asset'
      )

      expect(result.success).toBe(true)
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          permission_level: 'edit',
          asset_id: 'asset-1'
        }),
        { onConflict: 'asset_id,user_id' }
      )
    })

    it('should handle grant permission errors', async () => {
      const { supabase } = await import('../../supabase/client')
      const mockUpsert = vi.fn(() => Promise.resolve({ 
        error: { message: 'Constraint violation' } 
      }))
      vi.mocked(supabase.from).mockReturnValue({
        upsert: mockUpsert
      } as any)

      const result = await SecurityService.grantPermission(
        'asset-1',
        'user-1',
        'edit',
        'asset'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Constraint violation')
    })
  })

  describe('createShareLink', () => {
    it('should create share link successfully', async () => {
      const { supabase } = await import('../../supabase/client')
      vi.mocked(supabase.rpc).mockResolvedValue({ 
        data: 'test-token-123', 
        error: null 
      })

      const result = await SecurityService.createShareLink('asset-1', 'asset', {
        linkType: 'view',
        expiresInHours: 24
      })

      expect(result.success).toBe(true)
      expect(result.token).toBe('test-token-123')
      expect(supabase.rpc).toHaveBeenCalledWith('create_secure_share_link', {
        p_asset_id: 'asset-1',
        p_folder_id: null,
        p_link_type: 'view',
        p_expires_in_hours: 24,
        p_password: undefined,
        p_max_downloads: undefined
      })
    })

    it('should handle share link creation errors', async () => {
      const { supabase } = await import('../../supabase/client')
      vi.mocked(supabase.rpc).mockResolvedValue({ 
        data: null, 
        error: { message: 'Invalid asset' } 
      })

      const result = await SecurityService.createShareLink('invalid-asset', 'asset')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid asset')
    })
  })

  describe('validateShareLink', () => {
    it('should validate share link successfully', async () => {
      const { supabase } = await import('../../supabase/client')
      vi.mocked(supabase.rpc).mockResolvedValue({ 
        data: {
          valid: true,
          asset_id: 'asset-1',
          link_type: 'view'
        }, 
        error: null 
      })

      const result = await SecurityService.validateShareLink('test-token')

      expect(result.valid).toBe(true)
      expect(result.asset_id).toBe('asset-1')
      expect(result.link_type).toBe('view')
    })

    it('should handle invalid share links', async () => {
      const { supabase } = await import('../../supabase/client')
      vi.mocked(supabase.rpc).mockResolvedValue({ 
        data: {
          valid: false,
          error: 'Link expired'
        }, 
        error: null 
      })

      const result = await SecurityService.validateShareLink('invalid-token')

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Link expired')
    })
  })

  describe('createAuditLog', () => {
    it('should create audit log successfully', async () => {
      const { supabase } = await import('../../supabase/client')
      vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: null })

      const result = await SecurityService.createAuditLog(
        'view',
        'asset',
        'asset-1',
        null,
        { timestamp: Date.now() }
      )

      expect(result.success).toBe(true)
      expect(supabase.rpc).toHaveBeenCalledWith('create_audit_log', {
        p_action: 'view',
        p_resource_type: 'asset',
        p_resource_id: 'asset-1',
        p_old_values: null,
        p_new_values: { timestamp: expect.any(Number) },
        p_metadata: {}
      })
    })

    it('should handle audit log creation errors', async () => {
      const { supabase } = await import('../../supabase/client')
      vi.mocked(supabase.rpc).mockResolvedValue({ 
        data: null, 
        error: { message: 'Database error' } 
      })

      const result = await SecurityService.createAuditLog(
        'edit',
        'asset',
        'asset-1'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Database error')
    })
  })

  describe('initiateScan', () => {
    it('should initiate security scan successfully', async () => {
      const { supabase } = await import('../../supabase/client')
      vi.mocked(supabase.rpc).mockResolvedValue({ 
        data: 'scan-id-123', 
        error: null 
      })

      const result = await SecurityService.initiateScan('asset-1', 'virus', 'clamav')

      expect(result.success).toBe(true)
      expect(result.scanId).toBe('scan-id-123')
      expect(supabase.rpc).toHaveBeenCalledWith('initiate_security_scan', {
        p_asset_id: 'asset-1',
        p_scan_type: 'virus',
        p_scanner_name: 'clamav'
      })
    })

    it('should handle scan initiation errors', async () => {
      const { supabase } = await import('../../supabase/client')
      vi.mocked(supabase.rpc).mockResolvedValue({ 
        data: null, 
        error: { message: 'Scanner unavailable' } 
      })

      const result = await SecurityService.initiateScan('asset-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Scanner unavailable')
    })
  })

  describe('isAssetSecure', () => {
    it('should return true for clean assets', async () => {
      const { supabase } = await import('../../supabase/client')
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({
              data: [{ scan_status: 'clean', threat_level: 'low' }],
              error: null
            }))
          }))
        }))
      }))
      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect
      } as any)

      const result = await SecurityService.isAssetSecure('asset-1')

      expect(result).toBe(true)
    })

    it('should return false for infected assets', async () => {
      const { supabase } = await import('../../supabase/client')
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({
              data: [{ scan_status: 'infected', threat_level: 'high' }],
              error: null
            }))
          }))
        }))
      }))
      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect
      } as any)

      const result = await SecurityService.isAssetSecure('asset-1')

      expect(result).toBe(false)
    })

    it('should return false for unscanned assets', async () => {
      const { supabase } = await import('../../supabase/client')
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({
              data: [],
              error: null
            }))
          }))
        }))
      }))
      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect
      } as any)

      const result = await SecurityService.isAssetSecure('asset-1')

      expect(result).toBe(false)
    })
  })

  describe('getSecurityDashboard', () => {
    it('should return security dashboard data', async () => {
      const { supabase } = await import('../../supabase/client')
      const mockScans = [
        { scan_status: 'clean', asset: { project_id: 'project-1' } },
        { scan_status: 'infected', asset: { project_id: 'project-1' } },
        { scan_status: 'pending', asset: { project_id: 'project-1' } }
      ]
      
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({
          data: mockScans,
          error: null
        }))
      }))
      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect
      } as any)

      const result = await SecurityService.getSecurityDashboard('project-1')

      expect(result.totalScans).toBe(3)
      expect(result.cleanAssets).toBe(1)
      expect(result.threatsFound).toBe(1)
      expect(result.pendingScans).toBe(1)
    })

    it('should handle dashboard data errors', async () => {
      const { supabase } = await import('../../supabase/client')
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({
          data: null,
          error: { message: 'Database error' }
        }))
      }))
      vi.mocked(supabase.from).mockReturnValue({
        select: mockSelect
      } as any)

      const result = await SecurityService.getSecurityDashboard()

      expect(result.totalScans).toBe(0)
      expect(result.cleanAssets).toBe(0)
      expect(result.threatsFound).toBe(0)
      expect(result.pendingScans).toBe(0)
    })
  })
})