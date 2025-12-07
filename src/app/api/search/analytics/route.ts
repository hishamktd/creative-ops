import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { searchService } from '@/lib/services/searchService'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const projectId = searchParams.get('projectId')
    const days = parseInt(searchParams.get('days') || '30')

    const supabase = createClient()
    
    // Get current user if not specified
    let currentUserId = userId
    if (!currentUserId) {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        )
      }
      currentUserId = user.id
    }

    // Get analytics data
    const analytics = await searchService.getSearchAnalytics(
      currentUserId || undefined,
      projectId || undefined
    )

    return NextResponse.json(analytics)
  } catch (error) {
    console.error('Get analytics API error:', error)
    return NextResponse.json(
      { error: 'Failed to get analytics' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { query, results_count, clicked_result, project_id } = body

    if (!query || typeof results_count !== 'number') {
      return NextResponse.json(
        { error: 'Query and results_count are required' },
        { status: 400 }
      )
    }

    const supabase = createClient()
    
    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Insert analytics record
    const { error } = await supabase
      .from('search_analytics')
      .insert({
        query,
        results_count,
        clicked_result: clicked_result || null,
        user_id: user.id,
        project_id: project_id || null,
        timestamp: new Date().toISOString()
      })

    if (error) {
      console.error('Analytics insert error:', error)
      return NextResponse.json(
        { error: 'Failed to log analytics' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Search analytics API error:', error)
    return NextResponse.json(
      { error: 'Failed to log analytics' },
      { status: 500 }
    )
  }
}