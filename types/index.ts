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

export interface AssetVersion {
  id: string
  asset_id: string
  version: number
  file_url: string
  uploaded_by: string
  changes_description?: string
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
