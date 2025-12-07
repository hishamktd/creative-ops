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

    // Get dashboard insights
    const insights = await analyticsService.getDashboardInsights(projectId, timeRange)

    return NextResponse.json(insights)
  } catch (error) {
    console.error('Error fetching dashboard analytics:', error)
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

      case 'user_activity':
        await analyticsService.trackUserActivity({
          userId: user.id,
          projectId: data.projectId,
          activityType: data.activityType,
          activityDetails: data.activityDetails,
          sessionDurationMinutes: data.sessionDurationMinutes
        })
        break

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

      default:
        return NextResponse.json({ error: 'Invalid analytics type' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error recording analytics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}