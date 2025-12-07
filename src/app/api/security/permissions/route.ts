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
    const resourceType = searchParams.get('resourceType') as 'asset' | 'folder'

    if (!resourceId || !resourceType) {
      return NextResponse.json({ error: 'Missing resourceId or resourceType' }, { status: 400 })
    }

    const permissions = await SecurityService.getResourcePermissions(resourceId, resourceType)
    return NextResponse.json({ permissions })

  } catch (error) {
    console.error('Failed to fetch permissions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch permissions' },
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
    const { resourceId, resourceType, userId, permissionLevel, expiresAt } = body

    if (!resourceId || !resourceType || !userId || !permissionLevel) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const result = await SecurityService.grantPermission(
      resourceId,
      userId,
      permissionLevel,
      resourceType,
      expiresAt
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    // Log the permission change
    await SecurityService.createAuditLog(
      'permission_change',
      resourceType,
      resourceId,
      null,
      { userId, permissionLevel, expiresAt }
    )

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Failed to grant permission:', error)
    return NextResponse.json(
      { error: 'Failed to grant permission' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const resourceId = searchParams.get('resourceId')
    const resourceType = searchParams.get('resourceType') as 'asset' | 'folder'
    const userId = searchParams.get('userId')

    if (!resourceId || !resourceType || !userId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
    }

    const result = await SecurityService.revokePermission(resourceId, userId, resourceType)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    // Log the permission revocation
    await SecurityService.createAuditLog(
      'permission_change',
      resourceType,
      resourceId,
      { userId },
      null
    )

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Failed to revoke permission:', error)
    return NextResponse.json(
      { error: 'Failed to revoke permission' },
      { status: 500 }
    )
  }
}