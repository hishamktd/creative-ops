import { supabase } from '../supabase/client'

export interface Tag {
  id: string
  name: string
  color?: string
  description?: string
  usage_count: number
  created_by: string
  created_at: string
  project_id?: string // null for global tags
}

export interface TagSuggestion {
  tag: string
  confidence: number
  source: 'content' | 'filename' | 'metadata' | 'similar_assets' | 'user_history'
}

export interface TaggingResult {
  success: boolean
  tags?: string[]
  error?: string
}

export interface TagSearchResult {
  tags: Tag[]
  suggestions: string[]
}

export class TaggingService {
  /**
   * Get all available tags for a project
   */
  static async getProjectTags(projectId: string): Promise<Tag[]> {
    try {
      const { data, error } = await supabase
        .from('asset_tags')
        .select('*')
        .or(`project_id.eq.${projectId},project_id.is.null`)
        .order('usage_count', { ascending: false })

      if (error) {
        console.error('Failed to fetch project tags:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Error fetching project tags:', error)
      return []
    }
  }

  /**
   * Search tags with auto-complete
   */
  static async searchTags(query: string, projectId: string, limit: number = 10): Promise<TagSearchResult> {
    try {
      const { data, error } = await supabase
        .from('asset_tags')
        .select('*')
        .or(`project_id.eq.${projectId},project_id.is.null`)
        .ilike('name', `%${query}%`)
        .order('usage_count', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Tag search failed:', error)
        return { tags: [], suggestions: [] }
      }

      const tags = data || []
      const suggestions = tags.map(tag => tag.name)

      // Add fuzzy matching suggestions
      const fuzzyMatches = await this.getFuzzyTagMatches(query, projectId)
      suggestions.push(...fuzzyMatches.filter(match => !suggestions.includes(match)))

      return {
        tags,
        suggestions: suggestions.slice(0, limit)
      }
    } catch (error) {
      console.error('Tag search error:', error)
      return { tags: [], suggestions: [] }
    }
  }

  /**
   * Get fuzzy matching tag suggestions
   */
  private static async getFuzzyTagMatches(query: string, projectId: string): Promise<string[]> {
    try {
      // Use PostgreSQL similarity search if available
      const { data, error } = await supabase
        .rpc('search_similar_tags', {
          search_query: query,
          project_id: projectId,
          similarity_threshold: 0.3
        })

      if (error || !data) {
        // Fallback to basic matching
        return this.getBasicTagSuggestions(query)
      }

      return data.map((item: any) => item.name)
    } catch (error) {
      console.warn('Fuzzy tag matching failed:', error)
      return this.getBasicTagSuggestions(query)
    }
  }

  /**
   * Get basic tag suggestions based on common patterns
   */
  private static getBasicTagSuggestions(query: string): string[] {
    const commonTags = [
      'design', 'logo', 'branding', 'website', 'mobile', 'desktop',
      'wireframe', 'mockup', 'prototype', 'final', 'draft', 'approved',
      'red', 'blue', 'green', 'yellow', 'black', 'white',
      'portrait', 'landscape', 'square', 'vertical', 'horizontal',
      'high-res', 'low-res', 'vector', 'raster', 'print', 'web',
      'photo', 'illustration', 'icon', 'screenshot', 'document',
      'presentation', 'report', 'contract', 'invoice', 'receipt'
    ]

    const lowerQuery = query.toLowerCase()
    return commonTags
      .filter(tag => tag.includes(lowerQuery) || lowerQuery.includes(tag))
      .slice(0, 5)
  }

  /**
   * Generate intelligent tag suggestions for an asset
   */
  static async generateTagSuggestions(
    file: File,
    metadata: any,
    projectId: string,
    existingTags: string[] = []
  ): Promise<TagSuggestion[]> {
    const suggestions: TagSuggestion[] = []

    try {
      // Content-based suggestions
      const contentSuggestions = this.getContentBasedSuggestions(file, metadata)
      suggestions.push(...contentSuggestions)

      // Filename-based suggestions
      const filenameSuggestions = this.getFilenameBasedSuggestions(file.name)
      suggestions.push(...filenameSuggestions)

      // Metadata-based suggestions
      const metadataSuggestions = this.getMetadataBasedSuggestions(metadata)
      suggestions.push(...metadataSuggestions)

      // Similar assets suggestions
      const similarAssetSuggestions = await this.getSimilarAssetSuggestions(file, projectId)
      suggestions.push(...similarAssetSuggestions)

      // User history suggestions
      const historySuggestions = await this.getUserHistorySuggestions(projectId)
      suggestions.push(...historySuggestions)

      // Filter out existing tags and sort by confidence
      return suggestions
        .filter(suggestion => !existingTags.includes(suggestion.tag))
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 10) // Limit to top 10 suggestions
    } catch (error) {
      console.error('Tag suggestion generation failed:', error)
      return []
    }
  }

  /**
   * Get content-based tag suggestions
   */
  private static getContentBasedSuggestions(file: File, metadata: any): TagSuggestion[] {
    const suggestions: TagSuggestion[] = []

    // File type suggestions
    if (file.type.startsWith('image/')) {
      suggestions.push({ tag: 'image', confidence: 0.9, source: 'content' })
      
      if (file.type.includes('svg')) {
        suggestions.push({ tag: 'vector', confidence: 0.8, source: 'content' })
      } else {
        suggestions.push({ tag: 'raster', confidence: 0.7, source: 'content' })
      }
    } else if (file.type.startsWith('video/')) {
      suggestions.push({ tag: 'video', confidence: 0.9, source: 'content' })
    } else if (file.type === 'application/pdf') {
      suggestions.push({ tag: 'document', confidence: 0.9, source: 'content' })
      suggestions.push({ tag: 'pdf', confidence: 0.8, source: 'content' })
    }

    // Dimension-based suggestions
    if (metadata.width && metadata.height) {
      const aspectRatio = metadata.width / metadata.height
      
      if (Math.abs(aspectRatio - 1) < 0.1) {
        suggestions.push({ tag: 'square', confidence: 0.7, source: 'content' })
      } else if (aspectRatio > 1.5) {
        suggestions.push({ tag: 'landscape', confidence: 0.7, source: 'content' })
      } else if (aspectRatio < 0.7) {
        suggestions.push({ tag: 'portrait', confidence: 0.7, source: 'content' })
      }

      // Resolution suggestions
      const megapixels = (metadata.width * metadata.height) / 1000000
      if (megapixels > 10) {
        suggestions.push({ tag: 'high-res', confidence: 0.6, source: 'content' })
      } else if (megapixels < 1) {
        suggestions.push({ tag: 'low-res', confidence: 0.6, source: 'content' })
      }
    }

    return suggestions
  }

  /**
   * Get filename-based tag suggestions
   */
  private static getFilenameBasedSuggestions(filename: string): TagSuggestion[] {
    const suggestions: TagSuggestion[] = []
    const lowerName = filename.toLowerCase()

    const filenamePatterns = {
      'logo': /logo|brand|identity/i,
      'mockup': /mockup|mock|wireframe/i,
      'screenshot': /screenshot|screen|capture/i,
      'icon': /icon|ico/i,
      'banner': /banner|header/i,
      'thumbnail': /thumb|thumbnail/i,
      'final': /final|finished|complete/i,
      'draft': /draft|wip|work.in.progress/i,
      'v1': /v1|version.1|ver.1/i,
      'v2': /v2|version.2|ver.2/i,
      'mobile': /mobile|phone|ios|android/i,
      'desktop': /desktop|web|www/i,
      'print': /print|pdf|brochure/i
    }

    for (const [tag, pattern] of Object.entries(filenamePatterns)) {
      if (pattern.test(lowerName)) {
        suggestions.push({
          tag,
          confidence: 0.8,
          source: 'filename'
        })
      }
    }

    // Extract version numbers
    const versionMatch = lowerName.match(/v(\d+)/i)
    if (versionMatch) {
      suggestions.push({
        tag: `v${versionMatch[1]}`,
        confidence: 0.7,
        source: 'filename'
      })
    }

    return suggestions
  }

  /**
   * Get metadata-based tag suggestions
   */
  private static getMetadataBasedSuggestions(metadata: any): TagSuggestion[] {
    const suggestions: TagSuggestion[] = []

    // Camera-based suggestions
    if (metadata.camera_info?.make) {
      suggestions.push({
        tag: metadata.camera_info.make.toLowerCase(),
        confidence: 0.6,
        source: 'metadata'
      })
    }

    // Text content suggestions
    if (metadata.extracted_text) {
      const textSuggestions = this.extractTagsFromText(metadata.extracted_text)
      suggestions.push(...textSuggestions.map(tag => ({
        tag,
        confidence: 0.5,
        source: 'metadata' as const
      })))
    }

    return suggestions
  }

  /**
   * Extract tags from text content
   */
  private static extractTagsFromText(text: string): string[] {
    const tags: string[] = []
    const lowerText = text.toLowerCase()

    const contentKeywords = {
      'contract': ['contract', 'agreement', 'terms', 'conditions'],
      'invoice': ['invoice', 'bill', 'payment', 'amount due'],
      'report': ['report', 'analysis', 'summary', 'findings'],
      'presentation': ['presentation', 'slide', 'deck', 'agenda'],
      'proposal': ['proposal', 'quote', 'estimate', 'bid'],
      'manual': ['manual', 'guide', 'instructions', 'how to'],
      'specification': ['specification', 'spec', 'requirements', 'criteria']
    }

    for (const [tag, keywords] of Object.entries(contentKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        tags.push(tag)
      }
    }

    return tags
  }

  /**
   * Get suggestions based on similar assets
   */
  private static async getSimilarAssetSuggestions(file: File, projectId: string): Promise<TagSuggestion[]> {
    try {
      // Find assets with similar file types and names
      const { data, error } = await supabase
        .from('assets')
        .select('tags')
        .eq('project_id', projectId)
        .eq('file_type', file.type)
        .not('tags', 'is', null)
        .limit(10)

      if (error || !data) {
        return []
      }

      // Aggregate tag frequencies
      const tagFrequency: Record<string, number> = {}
      data.forEach(asset => {
        if (asset.tags && Array.isArray(asset.tags)) {
          asset.tags.forEach(tag => {
            tagFrequency[tag] = (tagFrequency[tag] || 0) + 1
          })
        }
      })

      // Convert to suggestions
      return Object.entries(tagFrequency)
        .map(([tag, count]) => ({
          tag,
          confidence: Math.min(count / data.length, 0.8),
          source: 'similar_assets' as const
        }))
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 5)
    } catch (error) {
      console.warn('Similar asset suggestions failed:', error)
      return []
    }
  }

  /**
   * Get suggestions based on user history
   */
  private static async getUserHistorySuggestions(projectId: string): Promise<TagSuggestion[]> {
    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return []

      // Get user's most frequently used tags
      const { data, error } = await supabase
        .from('assets')
        .select('tags')
        .eq('project_id', projectId)
        .eq('uploaded_by', user.user.id)
        .not('tags', 'is', null)
        .limit(20)

      if (error || !data) {
        return []
      }

      // Aggregate tag frequencies
      const tagFrequency: Record<string, number> = {}
      data.forEach(asset => {
        if (asset.tags && Array.isArray(asset.tags)) {
          asset.tags.forEach(tag => {
            tagFrequency[tag] = (tagFrequency[tag] || 0) + 1
          })
        }
      })

      // Convert to suggestions
      return Object.entries(tagFrequency)
        .map(([tag, count]) => ({
          tag,
          confidence: Math.min(count / data.length * 0.6, 0.6),
          source: 'user_history' as const
        }))
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3)
    } catch (error) {
      console.warn('User history suggestions failed:', error)
      return []
    }
  }

  /**
   * Add tags to an asset
   */
  static async addTagsToAsset(assetId: string, tags: string[]): Promise<TaggingResult> {
    try {
      // Get current asset tags
      const { data: asset, error: fetchError } = await supabase
        .from('assets')
        .select('tags, project_id')
        .eq('id', assetId)
        .single()

      if (fetchError || !asset) {
        return { success: false, error: 'Asset not found' }
      }

      // Merge with existing tags
      const currentTags = asset.tags || []
      const newTags = [...new Set([...currentTags, ...tags])]

      // Update asset tags
      const { error: updateError } = await supabase
        .from('assets')
        .update({ tags: newTags })
        .eq('id', assetId)

      if (updateError) {
        return { success: false, error: updateError.message }
      }

      // Update tag usage counts
      await this.updateTagUsageCounts(tags, asset.project_id)

      return { success: true, tags: newTags }
    } catch (error) {
      console.error('Failed to add tags:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Remove tags from an asset
   */
  static async removeTagsFromAsset(assetId: string, tagsToRemove: string[]): Promise<TaggingResult> {
    try {
      // Get current asset tags
      const { data: asset, error: fetchError } = await supabase
        .from('assets')
        .select('tags')
        .eq('id', assetId)
        .single()

      if (fetchError || !asset) {
        return { success: false, error: 'Asset not found' }
      }

      // Remove specified tags
      const currentTags = asset.tags || []
      const newTags = currentTags.filter(tag => !tagsToRemove.includes(tag))

      // Update asset tags
      const { error: updateError } = await supabase
        .from('assets')
        .update({ tags: newTags })
        .eq('id', assetId)

      if (updateError) {
        return { success: false, error: updateError.message }
      }

      return { success: true, tags: newTags }
    } catch (error) {
      console.error('Failed to remove tags:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Update tag usage counts
   */
  private static async updateTagUsageCounts(tags: string[], projectId: string): Promise<void> {
    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return

      for (const tagName of tags) {
        // Check if tag exists
        const { data: existingTag } = await supabase
          .from('asset_tags')
          .select('id, usage_count')
          .eq('name', tagName)
          .or(`project_id.eq.${projectId},project_id.is.null`)
          .single()

        if (existingTag) {
          // Update usage count
          await supabase
            .from('asset_tags')
            .update({ usage_count: existingTag.usage_count + 1 })
            .eq('id', existingTag.id)
        } else {
          // Create new tag
          await supabase
            .from('asset_tags')
            .insert({
              name: tagName,
              project_id: projectId,
              usage_count: 1,
              created_by: user.user.id
            })
        }
      }
    } catch (error) {
      console.warn('Failed to update tag usage counts:', error)
    }
  }

  /**
   * Create a new tag
   */
  static async createTag(
    name: string,
    projectId: string,
    color?: string,
    description?: string
  ): Promise<Tag | null> {
    try {
      const { data: user } = await supabase.auth.getUser()
      if (!user.user) return null

      const { data, error } = await supabase
        .from('asset_tags')
        .insert({
          name: name.toLowerCase().trim(),
          project_id: projectId,
          color,
          description,
          usage_count: 0,
          created_by: user.user.id
        })
        .select()
        .single()

      if (error) {
        console.error('Failed to create tag:', error)
        return null
      }

      return data
    } catch (error) {
      console.error('Tag creation error:', error)
      return null
    }
  }

  /**
   * Delete a tag
   */
  static async deleteTag(tagId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('asset_tags')
        .delete()
        .eq('id', tagId)

      return !error
    } catch (error) {
      console.error('Failed to delete tag:', error)
      return false
    }
  }

  /**
   * Get tag statistics for a project
   */
  static async getTagStatistics(projectId: string): Promise<{
    totalTags: number
    mostUsedTags: Array<{ name: string; count: number }>
    recentTags: string[]
  }> {
    try {
      // Get all tags for the project
      const { data: tags } = await supabase
        .from('asset_tags')
        .select('name, usage_count, created_at')
        .or(`project_id.eq.${projectId},project_id.is.null`)
        .order('usage_count', { ascending: false })

      if (!tags) {
        return { totalTags: 0, mostUsedTags: [], recentTags: [] }
      }

      const mostUsedTags = tags
        .slice(0, 10)
        .map(tag => ({ name: tag.name, count: tag.usage_count }))

      const recentTags = tags
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .map(tag => tag.name)

      return {
        totalTags: tags.length,
        mostUsedTags,
        recentTags
      }
    } catch (error) {
      console.error('Failed to get tag statistics:', error)
      return { totalTags: 0, mostUsedTags: [], recentTags: [] }
    }
  }
}