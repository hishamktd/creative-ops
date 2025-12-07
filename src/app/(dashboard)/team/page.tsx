'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import {
  User,
  Zap,
  Trophy,
  TrendingUp,
  Activity,
  Award,
  Clock,
  CheckSquare,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { User as UserType, TeamActivity, Badge as BadgeType } from '@/types'

export default function TeamPage() {
  const [teamMembers, setTeamMembers] = useState<UserType[]>([])
  const [recentActivity, setRecentActivity] = useState<TeamActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTeamData()

    // Set up real-time subscription for team activity
    const subscription = supabase
      .channel('team_activity')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'team_activity' }, () => {
        fetchRecentActivity()
      })
      .subscribe()

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const fetchTeamData = async () => {
    try {
      await Promise.all([fetchTeamMembers(), fetchRecentActivity()])
    } catch (error) {
      console.error('Error fetching team data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTeamMembers = async () => {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('is_active', true)
      .order('xp_points', { ascending: false })

    if (error) throw error
    setTeamMembers(data || [])
  }

  const fetchRecentActivity = async () => {
    const { data, error } = await supabase
      .from('team_activity')
      .select('*, users(full_name, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) throw error
    setRecentActivity(data || [])
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'task_update':
        return <CheckSquare size={16} className="text-blue-500" />
      case 'comment':
        return <Activity size={16} className="text-green-500" />
      case 'upload':
        return <TrendingUp size={16} className="text-purple-500" />
      default:
        return <Activity size={16} className="text-gray-500" />
    }
  }

  const getActivityMessage = (activity: TeamActivity) => {
    switch (activity.activity_type) {
      case 'task_update':
        return 'updated a task'
      case 'comment':
        return 'added a comment'
      case 'upload':
        return 'uploaded a file'
      case 'login':
        return 'logged in'
      default:
        return 'performed an action'
    }
  }

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
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Studio Game Mode</h1>
        <p className="text-gray-600 mt-1">Track your team&apos;s live activity and achievements</p>
      </div>

      {/* Team Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team Members */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="text-yellow-500" size={24} />
                Team Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {teamMembers.map((member, index) => (
                  <TeamMemberCard key={member.id} member={member} rank={index + 1} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="text-primary-500" size={24} />
                Live Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[600px] overflow-y-auto">
              <div className="space-y-3">
                {recentActivity.map((activity: any) => (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100"
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {getActivityIcon(activity.activity_type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">
                        <span className="font-medium">{activity.users?.full_name}</span>{' '}
                        {getActivityMessage(activity)}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(activity.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
                {recentActivity.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Activity size={48} className="mx-auto mb-3 opacity-20" />
                    <p>No recent activity</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Team Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-50 rounded-lg">
                <User className="text-blue-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Active Members</p>
                <p className="text-2xl font-bold text-gray-900">{teamMembers.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-50 rounded-lg">
                <Zap className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total XP</p>
                <p className="text-2xl font-bold text-gray-900">
                  {teamMembers.reduce((sum, m) => sum + m.xp_points, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-50 rounded-lg">
                <Activity className="text-purple-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Today&apos;s Activity</p>
                <p className="text-2xl font-bold text-gray-900">{recentActivity.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-yellow-50 rounded-lg">
                <Award className="text-yellow-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Avg Level</p>
                <p className="text-2xl font-bold text-gray-900">
                  {Math.floor(
                    teamMembers.reduce((sum, m) => sum + m.xp_points, 0) /
                    (teamMembers.length || 1) / 100
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function TeamMemberCard({ member, rank }: { member: UserType; rank: number }) {
  const level = Math.floor(member.xp_points / 100)
  const progressInLevel = (member.xp_points % 100)

  const getRankBadge = () => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  const getStatusColor = () => {
    // Simulate activity status (in production, check last activity timestamp)
    const random = Math.random()
    if (random > 0.7) return 'bg-green-500'
    if (random > 0.4) return 'bg-yellow-500'
    return 'bg-gray-300'
  }

  return (
    <div className="relative p-4 rounded-xl border-2 border-gray-200 hover:border-primary-500 transition bg-gradient-to-br from-white to-gray-50">
      {/* Rank Badge */}
      <div className="absolute top-2 right-2 text-lg font-bold">
        {getRankBadge()}
      </div>

      {/* Avatar with status */}
      <div className="flex items-start gap-3 mb-3">
        <div className="relative">
          {member.avatar_url ? (
            <img
              src={member.avatar_url}
              alt={member.full_name}
              className="w-12 h-12 rounded-full"
            />
          ) : (
            <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center">
              <User size={24} className="text-white" />
            </div>
          )}
          {/* Status indicator */}
          <div className={`absolute bottom-0 right-0 w-3 h-3 ${getStatusColor()} rounded-full border-2 border-white`}></div>
        </div>

        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{member.full_name}</h3>
          <p className="text-xs text-gray-500 capitalize">{member.role.replace('_', ' ')}</p>
        </div>
      </div>

      {/* Level & XP */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="font-medium text-primary-600">Level {level}</span>
          <span className="text-gray-600">{member.xp_points} XP</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-primary-500 to-primary-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${progressInLevel}%` }}
          ></div>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-gray-600 mt-3 pt-3 border-t border-gray-100">
        <div className="flex items-center gap-1">
          <Zap size={14} className="text-yellow-500" />
          <span>{member.xp_points} XP</span>
        </div>
        <div className="flex items-center gap-1">
          <Trophy size={14} className="text-purple-500" />
          <span>L{level}</span>
        </div>
      </div>
    </div>
  )
}
