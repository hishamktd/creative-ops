import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyticsService } from '@/lib/services/analyticsService'

interface AnalyticsEvent {
  type: 'asset_usage' | 'user_activity' | 'performance'
  data: any
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { events }: { events: AnalyticsEvent[] } = body

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: 'Events array is required' }, { status: 400 })
    }

    // Process events in batches to avoid overwhelming the database
    const batchSize = 10
    const results = []

    for (let i = 0; i < events.length; i += batchSize) {
      const batch = events.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (event) => {
        try {
          switch (event.type) {
            case 'asset_usage':
              return await analyticsService.trackAssetUsage({
                assetId: event.data.assetId,
                userId: user.id,
                projectId: event.data.projectId,
                actionType: event.data.actionType,
                sessionId: event.data.sessionId,
                durationSeconds: event.data.durationSeconds,
                metadata: event.data.metadata
              })

            case 'user_activity':
              return await analyticsService.trackUserActivity({
                userId: user.id,
                projectId: event.data.projectId,
                activityType: event.data.activityType,
                activityDetails: event.data.activityDetails,
                sessionDurationMinutes: event.data.sessionDurationMinutes
              })

            case 'performance':
              return await analyticsService.recordPerformanceMetric({
                metricType: event.data.metricType,
                value: event.data.value,
                unit: event.data.unit,
                context: event.data.context,
                userId: user.id,
                projectId: event.data.projectId
              })

            default:
              throw new Error(`Invalid event type: ${event.type}`)
          }
        } catch (error) {
          console.error(`Error processing event ${event.type}:`, error)
          return { error: error instanceof Error ? error.message : 'Unknown error' }
        }
      })

      const batchResults = await Promise.allSettled(batchPromises)
      results.push(...batchResults)
    }

    // Count successful and failed events
    const successful = results.filter(result => result.status === 'fulfilled').length
    const failed = results.filter(result => result.status === 'rejected').length

    return NextResponse.json({
      success: true,
      processed: events.length,
      successful,
      failed,
      errors: results
        .filter(result => result.status === 'rejected')
        .map(result => (result as PromiseRejectedResult).reason)
    })
  } catch (error) {
    console.error('Error processing batch analytics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}