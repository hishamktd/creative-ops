export { AssetUploadZone } from './AssetUploadZone'
export { UploadModal } from './UploadModal'
export { AssetEmptyState } from './AssetEmptyState'
export { UploadNotification, NotificationManager, useNotifications } from './UploadNotification'
export { AssetBrowser } from './AssetBrowser'
export { AssetGridView } from './AssetGridView'
export { AssetListView } from './AssetListView'
export { AssetTimelineView } from './AssetTimelineView'
export { AssetFiltersPanel } from './AssetFiltersPanel'
export { AssetPreview } from './AssetPreview'
export { ImageEditor } from './ImageEditor'
export { VideoPlayer } from './VideoPlayer'
export { PDFViewer } from './PDFViewer'

// Search components
export { SearchBar } from './SearchBar'
export { AdvancedFiltersPanel } from './AdvancedFiltersPanel'
export { SearchResults } from './SearchResults'
export { EnhancedSearchResults } from './EnhancedSearchResults'
export { AssetSearchInterface } from './AssetSearchInterface'
export { SearchAnalyticsDashboard } from './SearchAnalyticsDashboard'

// Version Control and Collaboration Components
export { VersionHistory } from './VersionHistory'
export { VersionComparison } from './VersionComparison'
export { CollaborativeComments } from './CollaborativeComments'
export { ApprovalWorkflow } from './ApprovalWorkflow'
export { PresenceIndicators, PresenceCursors } from './PresenceIndicators'

// Security and Access Control Components
export { AccessControlPanel } from './AccessControlPanel'
export { SecureShareModal } from './SecureShareModal'
export { AuditLogViewer } from './AuditLogViewer'
export { SecurityDashboard } from './SecurityDashboard'

// Performance Optimized Components
export { 
  PerformanceOptimizedImage, 
  PerformanceOptimizedImageGallery,
  withPerformanceOptimization 
} from './PerformanceOptimizedImage'

export type { UploadFile, AssetUploadZoneProps } from './AssetUploadZone'
export type { UploadModalProps } from './UploadModal'
export type { AssetEmptyStateProps } from './AssetEmptyState'
export type { NotificationProps, NotificationManagerProps } from './UploadNotification'
export type { AssetBrowserProps, ViewMode, AssetFilters, SavedFilter } from './AssetBrowser'
export type { AssetPreviewProps } from './AssetPreview'
export type { ImageEditorProps, EditChanges } from './ImageEditor'
export type { VideoPlayerProps } from './VideoPlayer'
export type { PDFViewerProps } from './PDFViewer'

// Search types - re-export from types/search
export type { 
  SearchFilters, 
  SearchSortOptions, 
  SearchResult, 
  SearchResponse, 
  SearchFacets, 
  SavedSearch,
  AutocompleteResult 
} from '@/types/search'// 
Folder Management Components
export { FolderManager } from './FolderManager'
export { FolderCreateModal } from './FolderCreateModal'
export { FolderPermissionsModal } from './FolderPermissionsModal'
export { FolderStatsModal } from './FolderStatsModal'
export { FolderTemplateModal } from './FolderTemplateModal'
export { FolderBreadcrumb } from './FolderBreadcrumb'

// Analytics and Monitoring Components
export { default as AnalyticsDashboard } from './AnalyticsDashboard'