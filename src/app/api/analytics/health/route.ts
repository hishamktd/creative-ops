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

    // Check if user is admin (has admin role in any project)
    const { data: adminCheck } = await supabase
      .from('project_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .limit(1)

    if (!adminCheck || adminCheck.length === 0) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get system health metrics
    const healthMetrics = await analyticsService.getSystemHealthMetrics()

    return NextResponse.json(healthMetrics)
  } catch (error) {
    console.error('Error fetching system health:', error)
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

    // Check if user is admin
    const { data: adminCheck } = await supabase
      .from('project_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .limit(1)

    if (!adminCheck || adminCheck.length === 0) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { metricName, value, unit, status, thresholdWarning, thresholdCritical, metadata } = body

    // Record system health metric
    await analyticsService.recordSystemHealthMetric({
      metricName,
      value,
      unit,
      status,
      thresholdWarning,
      thresholdCritical,
      metadata
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error recording system health metric:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}