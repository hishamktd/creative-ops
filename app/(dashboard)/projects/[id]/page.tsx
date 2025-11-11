'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import {
  Plus,
  List,
  LayoutGrid,
  Calendar,
  Users,
  ArrowLeft,
  CheckSquare,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import Link from 'next/link'
import { Project, Task, TaskStatus } from '@/types'

export default function ProjectDetailPage() {
  const params = useParams()
  const { user } = useAuth()
  const [project, setProject] = useState<Project | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban')
  const [showCreateTask, setShowCreateTask] = useState(false)

  useEffect(() => {
    if (params.id) {
      fetchProjectData()
    }
  }, [params.id])

  const fetchProjectData = async () => {
    try {
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', params.id)
        .single()

      if (projectError) throw projectError

      const { data: tasksData, error: tasksError } = await supabase
        .from('tasks')
        .select('*, users(full_name, avatar_url)')
        .eq('project_id', params.id)
        .order('order_index', { ascending: true })

      if (tasksError) throw tasksError

      setProject(projectData)
      setTasks(tasksData || [])
    } catch (error) {
      console.error('Error fetching project data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getTasksByStatus = (status: TaskStatus) => {
    return tasks.filter((task) => task.status === status)
  }

  const taskStatuses: TaskStatus[] = ['todo', 'in_progress', 'review', 'done']

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent"></div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Project not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Link href="/projects">
          <Button variant="ghost" size="sm">
            <ArrowLeft size={16} />
            Back to Projects
          </Button>
        </Link>

        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                {project.name}
              </h1>
              <Badge variant={project.status === 'active' ? 'success' : 'default'}>
                {project.status}
              </Badge>
            </div>
            {project.description && (
              <p className="text-gray-600">{project.description}</p>
            )}
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
              {project.deadline && (
                <div className="flex items-center gap-1">
                  <Calendar size={16} />
                  <span>Due: {new Date(project.deadline).toLocaleDateString()}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <CheckSquare size={16} />
                <span>{tasks.length} tasks</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('kanban')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  viewMode === 'kanban'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600'
                }`}
              >
                <LayoutGrid size={16} className="inline mr-1" />
                Kanban
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                  viewMode === 'list'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600'
                }`}
              >
                <List size={16} className="inline mr-1" />
                List
              </button>
            </div>
            <Button onClick={() => setShowCreateTask(true)}>
              <Plus size={18} />
              Add Task
            </Button>
          </div>
        </div>
      </div>

      {/* Tasks View */}
      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {taskStatuses.map((status) => (
            <div key={status} className="flex flex-col">
              <div className="mb-3">
                <h3 className="font-semibold text-gray-900 capitalize flex items-center justify-between">
                  {status.replace('_', ' ')}
                  <Badge variant="default">{getTasksByStatus(status).length}</Badge>
                </h3>
              </div>
              <div className="space-y-3 flex-1">
                {getTasksByStatus(status).map((task) => (
                  <TaskCard key={task.id} task={task} onUpdate={fetchProjectData} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-100">
              {tasks.map((task) => (
                <TaskListItem key={task.id} task={task} onUpdate={fetchProjectData} />
              ))}
              {tasks.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <CheckSquare size={48} className="mx-auto mb-3 opacity-20" />
                  <p>No tasks yet</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Task Modal */}
      {showCreateTask && (
        <CreateTaskModal
          projectId={project.id}
          onClose={() => setShowCreateTask(false)}
          onSuccess={() => {
            setShowCreateTask(false)
            fetchProjectData()
          }}
        />
      )}
    </div>
  )
}

function TaskCard({ task, onUpdate }: { task: any; onUpdate: () => void }) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-l-4 border-l-red-500'
      case 'medium':
        return 'border-l-4 border-l-yellow-500'
      case 'low':
        return 'border-l-4 border-l-green-500'
      default:
        return ''
    }
  }

  return (
    <Card className={`${getPriorityColor(task.priority)}`}>
      <CardContent className="p-4">
        <h4 className="font-medium text-gray-900 mb-2">{task.title}</h4>
        {task.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{task.description}</p>
        )}
        <div className="flex items-center justify-between text-xs">
          {task.deadline && (
            <span className="text-gray-500">
              {new Date(task.deadline).toLocaleDateString()}
            </span>
          )}
          <Badge variant="default" className="text-xs">
            {task.priority}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function TaskListItem({ task, onUpdate }: { task: any; onUpdate: () => void }) {
  const getStatusBadgeVariant = (status: TaskStatus) => {
    switch (status) {
      case 'done':
        return 'success'
      case 'in_progress':
        return 'info'
      case 'review':
        return 'warning'
      default:
        return 'default'
    }
  }

  return (
    <div className="flex items-center gap-4 p-4 hover:bg-gray-50 transition">
      <div className="flex-1">
        <h4 className="font-medium text-gray-900">{task.title}</h4>
        {task.description && (
          <p className="text-sm text-gray-600 mt-1">{task.description}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Badge variant={getStatusBadgeVariant(task.status)}>
          {task.status.replace('_', ' ')}
        </Badge>
        <Badge variant="default">{task.priority}</Badge>
        {task.deadline && (
          <span className="text-sm text-gray-500 hidden sm:block">
            {new Date(task.deadline).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  )
}

function CreateTaskModal({
  projectId,
  onClose,
  onSuccess,
}: {
  projectId: string
  onClose: () => void
  onSuccess: () => void
}) {
  const { user } = useAuth()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('medium')
  const [deadline, setDeadline] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const { error } = await supabase.from('tasks').insert({
        project_id: projectId,
        title,
        description,
        priority,
        deadline: deadline || null,
        status: 'todo',
        created_by: user?.id,
      })

      if (error) throw error
      onSuccess()
    } catch (error) {
      console.error('Error creating task:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose}></div>
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-xl shadow-xl z-50 p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Create New Task</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Task Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              placeholder="Enter task title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none"
              placeholder="Enter task description"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Deadline
            </label>
            <input
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </div>
    </>
  )
}
