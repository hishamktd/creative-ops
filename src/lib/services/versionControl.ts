import { createClient } from '@/lib/supabase/client'
import { AssetVersion, VersionComparison } from '@/types'

export class VersionControlService {
  private supabase: any

  constructor(supabaseClient?: any) {
    this.supabase = supabaseClient || createClient()
  }

  /**
   * Create a new version of an asset
   */
  async createVersion(params: {
    assetId: string
    fileUrl: string
    filePath: string
    fileSize: number
    checksum: string
    changesDescription?: string
    metadata?: Record<string, any>
  }): Promise<AssetVersion> {
    const { data, error } = await this.supabase.rpc('create_asset_version', {
      p_asset_id: params.assetId,
      p_file_url: params.fileUrl,
      p_file_path: params.filePath,
      p_file_size: params.fileSize,
      p_checksum: params.checksum,
      p_changes_description: params.changesDescription,
      p_metadata: params.metadata || {}
    })

    if (error) {
      throw new Error(`Failed to create asset version: ${error.message}`)
    }

    // Fetch the created version
    return this.getVersion(data)
  }

  /**
   * Get a specific version by ID
   */
  async getVersion(versionId: string): Promise<AssetVersion> {
    const { data, error } = await this.supabase
      .from('asset_versions')
      .select(`
        *,
        uploader:users!uploaded_by(full_name)
      `)
      .eq('id', versionId)
      .single()

    if (error) {
      throw new Error(`Failed to fetch version: ${error.message}`)
    }

    return {
      ...data,
      uploader_name: data.uploader?.full_name
    }
  }

  /**
   * Get version history for an asset
   */
  async getVersionHistory(assetId: string): Promise<AssetVersion[]> {
    const { data, error } = await this.supabase.rpc('get_asset_version_history', {
      p_asset_id: assetId
    })

    if (error) {
      throw new Error(`Failed to fetch version history: ${error.message}`)
    }

    return data || []
  }

  /**
   * Compare two versions of an asset
   */
  async compareVersions(oldVersionId: string, newVersionId: string): Promise<VersionComparison> {
    const [oldVersion, newVersion] = await Promise.all([
      this.getVersion(oldVersionId),
      this.getVersion(newVersionId)
    ])

    const fileSizeDiff = newVersion.file_size - oldVersion.file_size
    const metadataChanges = this.calculateMetadataChanges(oldVersion.metadata, newVersion.metadata)

    return {
      oldVersion,
      newVersion,
      changes: {
        file_size_diff: fileSizeDiff,
        metadata_changes: metadataChanges
      }
    }
  }

  /**
   * Revert to a previous version
   */
  async revertToVersion(assetId: string, versionId: string, changesDescription?: string): Promise<AssetVersion> {
    const targetVersion = await this.getVersion(versionId)
    
    return this.createVersion({
      assetId,
      fileUrl: targetVersion.file_url,
      filePath: targetVersion.file_path,
      fileSize: targetVersion.file_size,
      checksum: targetVersion.checksum,
      changesDescription: changesDescription || `Reverted to version ${targetVersion.version_number}`,
      metadata: targetVersion.metadata
    })
  }

  /**
   * Delete a version (soft delete by marking as deleted)
   */
  async deleteVersion(versionId: string): Promise<void> {
    const { error } = await this.supabase
      .from('asset_versions')
      .delete()
      .eq('id', versionId)

    if (error) {
      throw new Error(`Failed to delete version: ${error.message}`)
    }
  }

  /**
   * Get versions by asset with pagination
   */
  async getVersionsPaginated(
    assetId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ versions: AssetVersion[]; total: number; hasMore: boolean }> {
    const offset = (page - 1) * limit

    const [versionsResult, countResult] = await Promise.all([
      this.supabase
        .from('asset_versions')
        .select(`
          *,
          uploader:users!uploaded_by(full_name)
        `)
        .eq('asset_id', assetId)
        .order('version_number', { ascending: false })
        .range(offset, offset + limit - 1),
      
      this.supabase
        .from('asset_versions')
        .select('id', { count: 'exact', head: true })
        .eq('asset_id', assetId)
    ])

    if (versionsResult.error) {
      throw new Error(`Failed to fetch versions: ${versionsResult.error.message}`)
    }

    if (countResult.error) {
      throw new Error(`Failed to count versions: ${countResult.error.message}`)
    }

    const versions = versionsResult.data.map(version => ({
      ...version,
      uploader_name: version.uploader?.full_name
    }))

    const total = countResult.count || 0
    const hasMore = offset + limit < total

    return { versions, total, hasMore }
  }

  /**
   * Subscribe to version changes for an asset
   */
  subscribeToVersions(assetId: string, callback: (version: AssetVersion) => void) {
    return this.supabase
      .channel(`asset_versions:${assetId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'asset_versions',
          filter: `asset_id=eq.${assetId}`
        },
        async (payload) => {
          try {
            const version = await this.getVersion(payload.new.id)
            callback(version)
          } catch (error) {
            console.error('Error fetching new version:', error)
          }
        }
      )
      .subscribe()
  }

  /**
   * Calculate metadata changes between two versions
   */
  private calculateMetadataChanges(
    oldMetadata: Record<string, any>,
    newMetadata: Record<string, any>
  ): Record<string, any> {
    const changes: Record<string, any> = {}

    // Find added or changed fields
    for (const [key, value] of Object.entries(newMetadata)) {
      if (!(key in oldMetadata) || oldMetadata[key] !== value) {
        changes[key] = {
          old: oldMetadata[key] || null,
          new: value
        }
      }
    }

    // Find removed fields
    for (const key of Object.keys(oldMetadata)) {
      if (!(key in newMetadata)) {
        changes[key] = {
          old: oldMetadata[key],
          new: null
        }
      }
    }

    return changes
  }

  /**
   * Get version statistics for an asset
   */
  async getVersionStats(assetId: string): Promise<{
    totalVersions: number
    totalSizeBytes: number
    averageSizeBytes: number
    oldestVersion: string
    newestVersion: string
  }> {
    const { data, error } = await this.supabase
      .from('asset_versions')
      .select('file_size, created_at')
      .eq('asset_id', assetId)
      .order('created_at', { ascending: true })

    if (error) {
      throw new Error(`Failed to fetch version stats: ${error.message}`)
    }

    if (!data || data.length === 0) {
      return {
        totalVersions: 0,
        totalSizeBytes: 0,
        averageSizeBytes: 0,
        oldestVersion: '',
        newestVersion: ''
      }
    }

    const totalSizeBytes = data.reduce((sum, version) => sum + version.file_size, 0)
    const averageSizeBytes = totalSizeBytes / data.length

    return {
      totalVersions: data.length,
      totalSizeBytes,
      averageSizeBytes,
      oldestVersion: data[0].created_at,
      newestVersion: data[data.length - 1].created_at
    }
  }
}

export const versionControlService = new VersionControlService()