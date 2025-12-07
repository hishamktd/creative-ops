import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '../../../../lib/supabase/server'
import { SecurityService } from '../../../../lib/services/security'

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const resourceId = searchParams.get('resourceId')
    const resourceType = searchParams.get('resourceType')
    const userId = searchParams.get('userId')
    const limit = parseInt(searchParams.get('limit') || '50')

    const auditLogs = await SecurityService.getAuditLogs(
      resourceId || undefined,
      resourceType || undefined,
      userId || undefined,
      limit
    )

    return NextResponse.json({ auditLogs })

  } catch (error) {
    console.error('Failed to fetch audit logs:', error)
    return NextResponse.json(
      { error: 'Failed to fetch audit logs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { action, resourceType, resourceId, oldValues, newValues, metadata } = body

    if (!action || !resourceType || !resourceId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const result = await SecurityService.createAuditLog(
      action,
      resourceType,
      resourceId,
      oldValues,
      newValues,
      metadata || {}
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Failed to create audit log:', error)
    return NextResponse.json(
      { error: 'Failed to create audit log' },
      { status: 500 }
    )
  }
}