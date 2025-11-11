'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import {
  FolderKanban,
  CheckSquare,
  Clock,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Plus,
  ArrowRight,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import Link from 'next/link'

interface DashboardStats {
  activeProjects: number
  totalTasks: number
  upcomingDeadlines: number
  totalRevenue: number
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<DashboardStats>({
    activeProjects: 0,
    totalTasks: 0,
    upcomingDeadlines: 0,
    totalRevenue: 0,
  })
  const [loading, setLoading] = useState(true)
  const [recentProjects, setRecentProjects] = useState<any[]>([])
  const [upcomingTasks, setUpcomingTasks] = useState<any[]>([])

  useEffect(() => {
    if (user) {
      fetchDashboardData()
    }
  }, [user])

  const fetchDashboardData = async () => {
    try {
      // Fetch active projects count
      const { count: projectCount } = await supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')

      // Fetch total tasks
      const { count: taskCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })

      // Fetch upcoming deadlines (next 7 days)
      const nextWeek = new Date()
      nextWeek.setDate(nextWeek.getDate() + 7)
      const { count: deadlineCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true })
        .lte('deadline', nextWeek.toISOString())
        .neq('status', 'done')

      // Fetch total revenue
      const { data: invoices } = await supabase
        .from('invoices')
        .select('total')
        .eq('status', 'paid')

      const totalRevenue = invoices?.reduce((sum, inv) => sum + Number(inv.total), 0) || 0

      // Fetch recent projects
      const { data: projects } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5)

      // Fetch upcoming tasks
      const { data: tasks } = await supabase
        .from('tasks')
        .select('*, projects(name)')
        .not('deadline', 'is', null)
        .order('deadline', { ascending: true })
        .limit(5)

      setStats({
        activeProjects: projectCount || 0,
        totalTasks: taskCount || 0,
        upcomingDeadlines: deadlineCount || 0,
        totalRevenue,
      })

      setRecentProjects(projects || [])
      setUpcomingTasks(tasks || [])
    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    {
      title: 'Active Projects',
      value: stats.activeProjects,
      icon: FolderKanban,
      color: 'text-primary-600',
      bgColor: 'bg-primary-50',
    },
    {
      title: 'Total Tasks',
      value: stats.totalTasks,
      icon: CheckSquare,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Upcoming Deadlines',
      value: stats.upcomingDeadlines,
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
    },
    {
      title: 'Revenue (Paid)',
      value: `$${stats.totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
  ]

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
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Welcome back, {user?.full_name}!
          </h1>
          <p className="text-gray-600 mt-1">Here&apos;s what&apos;s happening with your studio</p>
        </div>
        <div className="flex gap-2">
          <Link href="/projects">
            <Button>
              <Plus size={18} />
              New Project
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                    <p className="text-2xl md:text-3xl font-bold text-gray-900 mt-2">
                      {stat.value}
                    </p>
                  </div>
                  <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                    <Icon className={stat.color} size={24} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Projects */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Projects</CardTitle>
            <Link href="/projects">
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight size={16} />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentProjects.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FolderKanban size={48} className="mx-auto mb-3 opacity-20" />
                <p>No projects yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentProjects.map((project) => (
                  <Link
                    key={project.id}
                    href={`/projects/${project.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition border border-gray-100"
                  >
                    <div>
                      <h4 className="font-medium text-gray-900">{project.name}</h4>
                      {project.deadline && (
                        <p className="text-sm text-gray-500">
                          Due: {new Date(project.deadline).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={
                        project.status === 'active'
                          ? 'success'
                          : project.status === 'completed'
                          ? 'info'
                          : 'default'
                      }
                    >
                      {project.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Deadlines */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Upcoming Deadlines</CardTitle>
            <Link href="/tasks">
              <Button variant="ghost" size="sm">
                View All
                <ArrowRight size={16} />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {upcomingTasks.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Clock size={48} className="mx-auto mb-3 opacity-20" />
                <p>No upcoming deadlines</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-gray-100"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{task.title}</h4>
                      <p className="text-sm text-gray-500">{task.projects?.name}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="warning">
                        {new Date(task.deadline).toLocaleDateString()}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Link href="/projects">
              <Button variant="outline" className="w-full">
                <FolderKanban size={18} />
                New Project
              </Button>
            </Link>
            <Link href="/tasks">
              <Button variant="outline" className="w-full">
                <CheckSquare size={18} />
                Add Task
              </Button>
            </Link>
            <Link href="/assets">
              <Button variant="outline" className="w-full">
                <Plus size={18} />
                Upload Asset
              </Button>
            </Link>
            <Link href="/invoices">
              <Button variant="outline" className="w-full">
                <DollarSign size={18} />
                Create Invoice
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
