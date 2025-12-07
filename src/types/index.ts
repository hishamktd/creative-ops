export type UserRole = 'admin' | 'team_member' | 'client'

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done'

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue'

export interface User {
  id: string
  email: string
  full_name: string
  role: UserRole
  avatar_url?: string
  xp_points: number
  created_at: string
  updated_at: string
}

export interface Project {
  id: string
  name: string
  description?: string
  client_id?: string
  status: 'active' | 'archived' | 'completed'
  start_date?: string
  deadline?: string
  budget?: number
  created_by: string
  created_at: string
  updated_at: string
  revision_count: number
}

export interface Task {
  id: string
  project_id: string
  title: string
  description?: string
  status: TaskStatus
  assigned_to?: string
  estimated_hours?: number
  billable_hours?: number
  priority: 'low' | 'medium' | 'high'
  deadline?: string
  created_by: string
  created_at: string
  updated_at: string
  order_index: number
}

export interface Subtask {
  id: string
  task_id: string
  title: string
  completed: boolean
  created_at: string
  updated_at: string
}

export interface Asset {
  id: string
  project_id: string
  folder_id?: string
  name: string
  file_url: string
  file_type: string
  file_size: number
  version: number
  thumbnail_url?: string
  uploaded_by: string
  created_at: string
  updated_at: string
}

// Enhanced Asset interface for the new storage system
export interface EnhancedAsset {
  id: string
  project_id: string
  folder_id?: string
  name: string
  description?: string
  file_url: string
  file_path: string
  file_type: string
  file_size: number
  version: number
  thumbnail_url?: string
  preview_url?: string
  metadata: AssetMetadata
  tags: string[]
  status: 'processing' | 'ready' | 'error'
  uploaded_by: string
  created_at: string
  updated_at: string
  last_accessed_at?: string
  access_count: number
  checksum: string
}

export interface AssetMetadata {
  width?: number
  height?: number
  duration?: number
  pages?: number
  color_profile?: string
  camera_info?: CameraInfo
  extracted_text?: string
  original_name: string
  mime_type: string
}

export interface CameraInfo {
  make?: string
  model?: string
  lens?: string
  focal_length?: string
  aperture?: string
  iso?: string
  shutter_speed?: string
  flash?: string
  gps?: {
    latitude?: number
    longitude?: number
  }
}

export interface AssetVersion {
  id: string
  asset_id: string
  version_number: number
  file_url: string
  file_path: string
  file_size: number
  checksum: string
  changes_description?: string
  metadata: Record<string, any>
  uploaded_by: string
  uploader_name?: string
  created_at: string
}

export interface Folder {
  id: string
  project_id: string
  name: string
  parent_id?: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface Comment {
  id: string
  asset_id?: string
  task_id?: string
  project_id: string
  user_id: string
  content: string
  parent_id?: string
  pin_x?: number
  pin_y?: number
  pin_timestamp?: number
  created_at: string
  updated_at: string
}

export interface AssetComment {
  id: string
  asset_id: string
  version_id?: string
  parent_id?: string
  user_id: string
  user_name?: string
  user_avatar?: string
  content: string
  pin_x?: number
  pin_y?: number
  pin_timestamp?: number
  resolved: boolean
  resolved_by?: string
  resolved_at?: string
  created_at: string
  updated_at: string
  replies?: AssetComment[]
}

export interface Invoice {
  id: string
  project_id: string
  client_id: string
  invoice_number: string
  status: InvoiceStatus
  issue_date: string
  due_date: string
  subtotal: number
  tax: number
  total: number
  notes?: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface InvoiceItem {
  id: string
  invoice_id: string
  description: string
  quantity: number
  rate: number
  amount: number
  task_id?: string
}

export interface TeamActivity {
  id: string
  user_id: string
  activity_type: 'task_update' | 'comment' | 'upload' | 'login' | 'logout'
  entity_type?: 'task' | 'project' | 'asset'
  entity_id?: string
  metadata?: any
  created_at: string
}

export interface Badge {
  id: string
  name: string
  description: string
  icon: string
  xp_required: number
}

export interface UserBadge {
  id: string
  user_id: string
  badge_id: string
  earned_at: string
}

export interface ProjectMember {
  id: string
  project_id: string
  user_id: string
  role: 'owner' | 'member' | 'viewer'
  added_at: string
}

export interface Notification {
  id: string
  user_id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  read: boolean
  link?: string
  created_at: string
}

// Version Control and Collaboration Types

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'changes_requested'
export type PresenceStatus = 'viewing' | 'editing' | 'idle'

export interface AssetApproval {
  id: string
  asset_id: string
  version_id: string
  requested_by: string
  requester_name?: string
  approver_id: string
  approver_name?: string
  status: ApprovalStatus
  feedback?: string
  approved_at?: string
  created_at: string
  updated_at: string
}

export interface AssetLock {
  id: string
  asset_id: string
  locked_by: string
  locker_name?: string
  lock_type: string
  expires_at: string
  created_at: string
}

export interface AssetPresence {
  id: string
  asset_id: string
  user_id: string
  user_name?: string
  user_avatar?: string
  status: PresenceStatus
  last_seen: string
  cursor_position?: {
    x?: number
    y?: number
    viewport?: {
      x: number
      y: number
      zoom: number
    }
  }
  created_at: string
}

export interface NotificationEvent {
  id: string
  user_id: string
  asset_id: string
  event_type: 'comment' | 'approval_request' | 'approval_response' | 'version_upload' | 'mention'
  event_data: Record<string, any>
  read: boolean
  created_at: string
}

export interface VersionComparison {
  oldVersion: AssetVersion
  newVersion: AssetVersion
  changes: {
    file_size_diff: number
    metadata_changes: Record<string, any>
    visual_diff?: string // URL to visual diff image
  }
}

// Security and Access Control Types

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
  user?: {
    id: string
    full_name: string
    email: string
    avatar_url?: string
  }
  permission_level: PermissionLevel
  granted_by?: string
  granted_by_user?: {
    id: string
    full_name: string
  }
  expires_at?: string
  created_at: string
  updated_at: string
}

export interface SecureShareLink {
  id: string
  token: string
  asset_id?: string
  folder_id?: string
  asset?: {
    id: string
    name: string
    file_type: string
  }
  folder?: {
    id: string
    name: string
  }
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
  user?: {
    id: string
    full_name: string
    email: string
    avatar_url?: string
  }
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
  asset?: {
    id: string
    name: string
    project_id: string
  }
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

export interface AssetEncryption {
  id: string
  asset_id: string
  encryption_key_id: string
  algorithm: string
  iv: string
  encrypted_metadata?: Record<string, any>
  is_encrypted: boolean
  encrypted_by?: string
  created_at: string
  updated_at: string
}

// Re-export notification types
export * from './notifications'
