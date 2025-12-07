import { supabase } from '../supabase/client'
import { createServerSupabaseClient } from '../supabase/server'

export type PermissionLevel = 'none' | 'view' | 'comment' | 'edit' | 'admin'
export type ShareLinkType = 'view' | 'download' | 'comment'
export type AuditAction = 
  | 'view' | 'download' | 'upload' | 'edit' | 'delete' | 'move' | 'copy'
  | 'share' | 'comment' | 'approve' | 'reject' | 'lock' | 'unlock'
  | 'permission_change' | 'metadata_edit'

export interface AssetPermission {
  id: string
  asset_id?: string
  folder_id?: string
  user_id: string
  permission_level: PermissionLevel
  granted_by?: string
  expires_at?: string
  created_at: string
  updated_at: string
}

export interface SecureShareLink {
  id: string
  token: string
  asset_id?: string
  folder_id?: string
  created_by: string
  link_type: ShareLinkType
  password_hash?: string
  max_downloads?: number
  download_count: number
  expires_at: string
  is_active: boolean
  allowed_ips?: string[]
  metadata: Record<string, any>
  created_at: string
  last_accessed_at?: string
}

export interface AuditLog {
  id: string
  user_id?: string
  asset_id?: string
  folder_id?: string
  project_id?: string
  action: AuditAction
  resource_type: string
  resource_id: string
  old_values?: Record<string, any>
  new_values?: Record<string, any>
  metadata: Record<string, any>
  ip_address?: string
  user_agent?: string
  session_id?: string
  created_at: string
}

export interface SecurityScan {
  id: string
  asset_id: string
  scan_type: string
  scanner_name: string
  scan_status: 'pending' | 'scanning' | 'clean' | 'infected' | 'error'
  threat_level?: 'low' | 'medium' | 'high' | 'critical'
  threats_found?: string[]
  scan_results: Record<string, any>
  scan_duration_ms?: number
  scanned_at?: string
  created_at: string
}

export interface ShareLinkOptions {
  linkType?: ShareLinkType
  expiresInHours?: number
  password?: string
  maxDownloads?: number
  allowedIps?: string[]
}

export interface ShareLinkValidation {
  valid: boolean
  error?: string
  asset_id?: string
  folder_id?: string
  link_type?: ShareLinkType
  created_by?: string
}

export class SecurityService {
  /**
   * Check if user has specific permission for an asset
   */
  static async checkAssetPermission(
    assetId: string,
    requiredPermission: PermissionLevel = 'view',
    userId?: string
  ): Promise<boolean> {
    try {
      const { data, error } = await supabase.rpc('check_asset_permission', {
        p_asset_id: assetId,
        p_user_id: userId,
        p_required_permission: requiredPermission
      })

      if (error) {
        console.error('Permission check failed:', error)
        return false
      }

      return data === true
    } catch (error) {
      console.error('Permission check error:', error)
      return false
    }
  }

  /**
   * Grant permission to user for asset or folder
   */
  static async grantPermission(
    resourceId: string,
    userId: string,
    permissionLevel: PermissionLevel,
    resourceType: 'asset' | 'folder',
    expiresAt?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const permissionData = {
        user_id: userId,
        permission_level: permissionLevel,
        granted_by: (await supabase.auth.getUser()).data.user?.id,
        expires_at: expiresAt,
        ...(resourceType === 'asset' ? { asset_id: resourceId } : { folder_id: resourceId })
      }

      const { error } = await supabase
        .from('asset_permissions')
        .upsert(permissionData, {
          onConflict: resourceType === 'asset' ? 'asset_id,user_id' : 'folder_id,user_id'
        })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to grant permission'
      }
    }
  }

  /**
   * Revoke permission from user
   */
  static async revokePermission(
    resourceId: string,
    userId: string,
    resourceType: 'asset' | 'folder'
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('asset_permissions')
        .delete()
        .match({
          user_id: userId,
          ...(resourceType === 'asset' ? { asset_id: resourceId } : { folder_id: resourceId })
        })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to revoke permission'
      }
    }
  }

  /**
   * Get all permissions for a resource
   */
  static async getResourcePermissions(
    resourceId: string,
    resourceType: 'asset' | 'folder'
  ): Promise<AssetPermission[]> {
    try {
      const { data, error } = await supabase
        .from('asset_permissions')
        .select(`
          *,
          user:users!user_id(id, full_name, email, avatar_url),
          granted_by_user:users!granted_by(id, full_name)
        `)
        .match(resourceType === 'asset' ? { asset_id: resourceId } : { folder_id: resourceId })
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Failed to fetch permissions:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Failed to fetch permissions:', error)
      return []
    }
  }

  /**
   * Create secure share link
   */
  static async createShareLink(
    resourceId: string,
    resourceType: 'asset' | 'folder',
    options: ShareLinkOptions = {}
  ): Promise<{ success: boolean; token?: string; error?: string }> {
    try {
      const {
        linkType = 'view',
        expiresInHours = 24,
        password,
        maxDownloads,
        allowedIps
      } = options

      const { data, error } = await supabase.rpc('create_secure_share_link', {
        p_asset_id: resourceType === 'asset' ? resourceId : null,
        p_folder_id: resourceType === 'folder' ? resourceId : null,
        p_link_type: linkType,
        p_expires_in_hours: expiresInHours,
        p_password: password,
        p_max_downloads: maxDownloads
      })

      if (error) {
        return { success: false, error: error.message }
      }

      // Update allowed IPs if provided
      if (allowedIps && allowedIps.length > 0) {
        await supabase
          .from('secure_share_links')
          .update({ allowed_ips: allowedIps })
          .eq('token', data)
      }

      return { success: true, token: data }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create share link'
      }
    }
  }

  /**
   * Validate share link access
   */
  static async validateShareLink(
    token: string,
    password?: string,
    ipAddress?: string
  ): Promise<ShareLinkValidation> {
    try {
      const { data, error } = await supabase.rpc('validate_share_link', {
        p_token: token,
        p_password: password,
        p_ip_address: ipAddress
      })

      if (error) {
        return { valid: false, error: error.message }
      }

      return data as ShareLinkValidation
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Failed to validate share link'
      }
    }
  }

  /**
   * Get share links created by user
   */
  static async getUserShareLinks(userId?: string): Promise<SecureShareLink[]> {
    try {
      const query = supabase
        .from('secure_share_links')
        .select(`
          *,
          asset:assets(id, name, file_type),
          folder:folders(id, name)
        `)
        .order('created_at', { ascending: false })

      if (userId) {
        query.eq('created_by', userId)
      }

      const { data, error } = await query

      if (error) {
        console.error('Failed to fetch share links:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Failed to fetch share links:', error)
      return []
    }
  }

  /**
   * Deactivate share link
   */
  static async deactivateShareLink(token: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('secure_share_links')
        .update({ is_active: false })
        .eq('token', token)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deactivate share link'
      }
    }
  }

  /**
   * Create audit log entry
   */
  static async createAuditLog(
    action: AuditAction,
    resourceType: string,
    resourceId: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>,
    metadata: Record<string, any> = {}
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.rpc('create_audit_log', {
        p_action: action,
        p_resource_type: resourceType,
        p_resource_id: resourceId,
        p_old_values: oldValues,
        p_new_values: newValues,
        p_metadata: metadata
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create audit log'
      }
    }
  }

  /**
   * Get audit logs for resource
   */
  static async getAuditLogs(
    resourceId?: string,
    resourceType?: string,
    userId?: string,
    limit: number = 50
  ): Promise<AuditLog[]> {
    try {
      let query = supabase
        .from('audit_logs')
        .select(`
          *,
          user:users(id, full_name, email, avatar_url)
        `)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (resourceId && resourceType) {
        query = query.eq('resource_id', resourceId).eq('resource_type', resourceType)
      }

      if (userId) {
        query = query.eq('user_id', userId)
      }

      const { data, error } = await query

      if (error) {
        console.error('Failed to fetch audit logs:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Failed to fetch audit logs:', error)
      return []
    }
  }

  /**
   * Initiate security scan for asset
   */
  static async initiateScan(
    assetId: string,
    scanType: string = 'virus',
    scannerName: string = 'clamav'
  ): Promise<{ success: boolean; scanId?: string; error?: string }> {
    try {
      const { data, error } = await supabase.rpc('initiate_security_scan', {
        p_asset_id: assetId,
        p_scan_type: scanType,
        p_scanner_name: scannerName
      })

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true, scanId: data }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to initiate scan'
      }
    }
  }

  /**
   * Get security scan results for asset
   */
  static async getScanResults(assetId: string): Promise<SecurityScan[]> {
    try {
      const { data, error } = await supabase
        .from('security_scans')
        .select('*')
        .eq('asset_id', assetId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Failed to fetch scan results:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Failed to fetch scan results:', error)
      return []
    }
  }

  /**
   * Update security scan status
   */
  static async updateScanStatus(
    scanId: string,
    status: SecurityScan['scan_status'],
    results?: {
      threatLevel?: SecurityScan['threat_level']
      threatsFound?: string[]
      scanResults?: Record<string, any>
      scanDurationMs?: number
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updateData: any = {
        scan_status: status,
        scanned_at: new Date().toISOString()
      }

      if (results) {
        if (results.threatLevel) updateData.threat_level = results.threatLevel
        if (results.threatsFound) updateData.threats_found = results.threatsFound
        if (results.scanResults) updateData.scan_results = results.scanResults
        if (results.scanDurationMs) updateData.scan_duration_ms = results.scanDurationMs
      }

      const { error } = await supabase
        .from('security_scans')
        .update(updateData)
        .eq('id', scanId)

      if (error) {
        return { success: false, error: error.message }
      }

      return { success: true }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update scan status'
      }
    }
  }

  /**
   * Check if asset has passed security scans
   */
  static async isAssetSecure(assetId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('security_scans')
        .select('scan_status, threat_level')
        .eq('asset_id', assetId)
        .order('created_at', { ascending: false })
        .limit(1)

      if (error) {
        console.error('Failed to check asset security:', error)
        return false
      }

      if (!data || data.length === 0) {
        // No scans yet, consider insecure until scanned
        return false
      }

      const latestScan = data[0]
      return latestScan.scan_status === 'clean' && 
             (!latestScan.threat_level || latestScan.threat_level === 'low')
    } catch (error) {
      console.error('Failed to check asset security:', error)
      return false
    }
  }

  /**
   * Get security dashboard data
   */
  static async getSecurityDashboard(projectId?: string): Promise<{
    totalScans: number
    cleanAssets: number
    threatsFound: number
    pendingScans: number
    recentThreats: SecurityScan[]
  }> {
    try {
      let query = supabase
        .from('security_scans')
        .select(`
          *,
          asset:assets!inner(id, name, project_id)
        `)

      if (projectId) {
        query = query.eq('asset.project_id', projectId)
      }

      const { data, error } = await query

      if (error) {
        console.error('Failed to fetch security dashboard:', error)
        return {
          totalScans: 0,
          cleanAssets: 0,
          threatsFound: 0,
          pendingScans: 0,
          recentThreats: []
        }
      }

      const scans = data || []
      const totalScans = scans.length
      const cleanAssets = scans.filter(s => s.scan_status === 'clean').length
      const threatsFound = scans.filter(s => s.scan_status === 'infected').length
      const pendingScans = scans.filter(s => s.scan_status === 'pending').length
      const recentThreats = scans
        .filter(s => s.scan_status === 'infected')
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10)

      return {
        totalScans,
        cleanAssets,
        threatsFound,
        pendingScans,
        recentThreats
      }
    } catch (error) {
      console.error('Failed to fetch security dashboard:', error)
      return {
        totalScans: 0,
        cleanAssets: 0,
        threatsFound: 0,
        pendingScans: 0,
        recentThreats: []
      }
    }
  }
}