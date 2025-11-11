'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  MessageSquare,
  Pin,
  Image as ImageIcon,
  Film,
  Sparkles,
  Plus,
  User,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { Comment } from '@/types'

export default function FeedbackPage() {
  const { user } = useAuth()
  const [comments, setComments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProject, setSelectedProject] = useState<string>('all')

  useEffect(() => {
    fetchProjects()
    fetchComments()
  }, [selectedProject])

  const fetchProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('id, name')
      .eq('status', 'active')
      .order('name')

    setProjects(data || [])
  }

  const fetchComments = async () => {
    try {
      let query = supabase
        .from('comments')
        .select('*, users(full_name, avatar_url), projects(name), assets(name)')
        .order('created_at', { ascending: false })

      if (selectedProject !== 'all') {
        query = query.eq('project_id', selectedProject)
      }

      const { data, error } = await query

      if (error) throw error
      setComments(data || [])
    } catch (error) {
      console.error('Error fetching comments:', error)
    } finally {
      setLoading(false)
    }
  }

  const groupedComments = comments.reduce((acc, comment) => {
    const projectName = comment.projects?.name || 'General'
    if (!acc[projectName]) {
      acc[projectName] = []
    }
    acc[projectName].push(comment)
    return acc
  }, {} as Record<string, any[]>)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Feedback & Reviews</h1>
          <p className="text-gray-600 mt-1">View and manage project feedback</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          >
            <option value="all">All Projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* AI Summary Placeholder */}
      <Card className="border-2 border-primary-200 bg-gradient-to-br from-primary-50 to-white">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary-100 rounded-lg">
              <Sparkles className="text-primary-600" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">AI Feedback Summary</h3>
              <p className="text-sm text-gray-600 mb-4">
                Get an AI-powered summary of all feedback and common themes across your projects.
                This feature is coming soon!
              </p>
              <Button variant="outline" size="sm" disabled>
                <Sparkles size={16} />
                Generate Summary (Coming Soon)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feedback by Project */}
      {Object.keys(groupedComments).length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <MessageSquare size={64} className="mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No feedback yet</h3>
            <p className="text-gray-500">Feedback and comments will appear here</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedComments).map(([projectName, projectComments]) => (
            <Card key={projectName}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="text-primary-600" size={20} />
                  {projectName}
                  <Badge variant="default" className="ml-auto">
                    {(projectComments as any[])?.length} comments
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(projectComments as any[])?.map((comment) => (
                    <CommentCard key={comment.id} comment={comment} />
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function CommentCard({ comment }: { comment: any }) {
  const isPinned = comment.pin_x !== null || comment.pin_y !== null || comment.pin_timestamp !== null

  return (
    <div className="flex gap-4 p-4 rounded-lg border border-gray-200 hover:border-primary-300 hover:bg-primary-50/30 transition">
      {/* Avatar */}
      <div className="flex-shrink-0">
        {comment.users?.avatar_url ? (
          <img
            src={comment.users.avatar_url}
            alt={comment.users.full_name}
            className="w-10 h-10 rounded-full"
          />
        ) : (
          <div className="w-10 h-10 bg-primary-500 rounded-full flex items-center justify-center">
            <User size={20} className="text-white" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h4 className="font-medium text-gray-900">{comment.users?.full_name}</h4>
            <p className="text-xs text-gray-500">
              {new Date(comment.created_at).toLocaleString()}
            </p>
          </div>
          {isPinned && (
            <Badge variant="warning" className="flex items-center gap-1">
              <Pin size={12} />
              Pinned
            </Badge>
          )}
        </div>

        <p className="text-gray-700 mb-2">{comment.content}</p>

        {comment.assets && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            {comment.assets.name.match(/\.(jpg|jpeg|png|gif)$/i) ? (
              <ImageIcon size={14} />
            ) : (
              <Film size={14} />
            )}
            <span>On: {comment.assets.name}</span>
          </div>
        )}

        {isPinned && (
          <div className="mt-2 text-xs text-gray-500">
            {comment.pin_x && comment.pin_y && (
              <span>Position: ({comment.pin_x}, {comment.pin_y})</span>
            )}
            {comment.pin_timestamp && (
              <span className="ml-3">Timestamp: {comment.pin_timestamp}s</span>
            )}
          </div>
        )}

        {/* Thread indicator */}
        {comment.parent_id && (
          <div className="mt-2 text-xs text-primary-600">
            <MessageSquare size={12} className="inline mr-1" />
            Reply to thread
          </div>
        )}
      </div>
    </div>
  )
}
