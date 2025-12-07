import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyticsService } from '@/lib/services/analyticsService'

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')
    const metricType = searchParams.get('type')
    const timeRange = (searchParams.get('timeRange') as '24h' | '7d' | '30d') || '7d'

    if (!projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 })
    }

    // Verify user has access to the project
    const { data: projectMember } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', user.id)
      .single()

    if (!projectMember) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    let metrics

    switch (metricType) {
      case 'asset_usage':
        metrics = await analyticsService.getAssetUsageMetrics(projectId, timeRange)
        break
      case 'storage_usage':
        metrics = await analyticsService.getStorageUsageMetrics(projectId)
        break
      case 'performance':
        metrics = await analyticsService.getPerformanceMetrics(timeRange)
        break
      case 'user_activity':
        metrics = await analyticsService.getUserActivityMetrics(projectId, timeRange)
        break
      default:
        return NextResponse.json({ error: 'Invalid metric type' }, { status: 400 })
    }

    return NextResponse.json(metrics)
  } catch (error) {
    console.error('Error fetching metrics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { type, data } = body

    switch (type) {
      case 'performance':
        await analyticsService.recordPerformanceMetric({
          metricType: data.metricType,
          value: data.value,
          unit: data.unit,
          context: data.context,
          userId: user.id,
          projectId: data.projectId
        })
        break

      case 'user_activity':
        await analyticsService.trackUserActivity({
          userId: user.id,
          projectId: data.projectId,
          activityType: data.activityType,
          activityDetails: data.activityDetails,
          sessionDurationMinutes: data.sessionDurationMinutes
        })
        break

      case 'asset_usage':
        await analyticsService.trackAssetUsage({
          assetId: data.assetId,
          userId: user.id,
          projectId: data.projectId,
          actionType: data.actionType,
          sessionId: data.sessionId,
          durationSeconds: data.durationSeconds,
          metadata: data.metadata
        })
        break

      default:
        return NextResponse.json({ error: 'Invalid metric type' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error recording metric:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}