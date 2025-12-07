import { NextRequest, NextResponse } from 'next/server'
import { SecurityService } from '../../../../../lib/services/security'

export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params
    const { searchParams } = new URL(request.url)
    const password = searchParams.get('password')
    
    // Get client IP address
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip')

    const validation = await SecurityService.validateShareLink(token, password || undefined, ip || undefined)

    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 403 })
    }

    return NextResponse.json({ 
      valid: true,
      assetId: validation.asset_id,
      folderId: validation.folder_id,
      linkType: validation.link_type
    })

  } catch (error) {
    console.error('Failed to validate share link:', error)
    return NextResponse.json(
      { error: 'Failed to validate share link' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params

    const result = await SecurityService.deactivateShareLink(token)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Failed to deactivate share link:', error)
    return NextResponse.json(
      { error: 'Failed to deactivate share link' },
      { status: 500 }
    )
  }
}