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

    const shareLinks = await SecurityService.getUserShareLinks(user.id)
    return NextResponse.json({ shareLinks })

  } catch (error) {
    console.error('Failed to fetch share links:', error)
    return NextResponse.json(
      { error: 'Failed to fetch share links' },
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
    const { 
      resourceId, 
      resourceType, 
      linkType = 'view',
      expiresInHours = 24,
      password,
      maxDownloads,
      allowedIps
    } = body

    if (!resourceId || !resourceType) {
      return NextResponse.json({ error: 'Missing resourceId or resourceType' }, { status: 400 })
    }

    // Check if user has permission to share this resource
    if (resourceType === 'asset') {
      const hasPermission = await SecurityService.checkAssetPermission(resourceId, 'edit', user.id)
      if (!hasPermission) {
        return NextResponse.json({ error: 'Insufficient permissions to share this asset' }, { status: 403 })
      }
    }

    const result = await SecurityService.createShareLink(resourceId, resourceType, {
      linkType,
      expiresInHours,
      password,
      maxDownloads,
      allowedIps
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      token: result.token,
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL}/share/${result.token}`
    })

  } catch (error) {
    console.error('Failed to create share link:', error)
    return NextResponse.json(
      { error: 'Failed to create share link' },
      { status: 500 }
    )
  }
}