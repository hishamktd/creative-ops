// Search-related types for the enhanced asset system

export interface SearchFilters {
  query?: string
  projectIds?: string[]
  fileTypes?: string[]
  tags?: string[]
  tagLogic?: 'AND' | 'OR' // Boolean logic for tag matching
  dateRange?: {
    start: string
    end: string
  }
  sizeRange?: {
    min: number
    max: number
  }
  status?: ('processing' | 'ready' | 'error')[]
  uploadedBy?: string[]
}

export interface SearchSortOptions {
  field: 'name' | 'created_at' | 'updated_at' | 'file_size' | 'access_count' | 'relevance'
  direction: 'asc' | 'desc'
}

export interface SearchResult {
  asset_id: string
  name: string
  file_type: string
  project_id: string
  rank: number
  highlight?: string
}

export interface SearchResponse {
  results: SearchResult[]
  total: number
  facets: SearchFacets
  suggestions?: string[]
  took: number
}

export interface SearchFacets {
  fileTypes: FacetCount[]
  projects: FacetCount[]
  tags: FacetCount[]
  uploadedBy: FacetCount[]
  dateRanges: FacetCount[]
}

export interface FacetCount {
  value: string
  count: number
  label?: string
}

export interface SavedSearch {
  id: string
  name: string
  description?: string
  filters: SearchFilters
  sort: SearchSortOptions
  user_id: string
  is_smart_folder: boolean
  created_at: string
  updated_at: string
}

export interface SearchSuggestion {
  text: string
  type: 'query' | 'tag' | 'filename' | 'project' | 'filetype'
  count?: number
}

export interface SearchAnalytics {
  query: string
  results_count: number
  clicked_result?: string
  user_id: string
  project_id?: string
  timestamp: string
}

export interface AutocompleteResult {
  suggestions: SearchSuggestion[]
  recent_searches: string[]
  popular_tags: string[]
}