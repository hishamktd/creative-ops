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
    const assetId = searchParams.get('assetId')
    const projectId = searchParams.get('projectId')

    if (assetId) {
      // Get scan results for specific asset
      const scanResults = await SecurityService.getScanResults(assetId)
      return NextResponse.json({ scanResults })
    } else if (projectId) {
      // Get security dashboard for project
      const dashboard = await SecurityService.getSecurityDashboard(projectId)
      return NextResponse.json({ dashboard })
    } else {
      // Get overall security dashboard
      const dashboard = await SecurityService.getSecurityDashboard()
      return NextResponse.json({ dashboard })
    }

  } catch (error) {
    console.error('Failed to fetch security scans:', error)
    return NextResponse.json(
      { error: 'Failed to fetch security scans' },
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
    const { assetId, scanType = 'virus', scannerName = 'clamav' } = body

    if (!assetId) {
      return NextResponse.json({ error: 'Missing assetId' }, { status: 400 })
    }

    // Check if user has permission to scan this asset
    const hasPermission = await SecurityService.checkAssetPermission(assetId, 'view', user.id)
    if (!hasPermission) {
      return NextResponse.json({ error: 'Insufficient permissions to scan this asset' }, { status: 403 })
    }

    const result = await SecurityService.initiateScan(assetId, scanType, scannerName)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      scanId: result.scanId 
    })

  } catch (error) {
    console.error('Failed to initiate security scan:', error)
    return NextResponse.json(
      { error: 'Failed to initiate security scan' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { scanId, status, threatLevel, threatsFound, scanResults, scanDurationMs } = body

    if (!scanId || !status) {
      return NextResponse.json({ error: 'Missing scanId or status' }, { status: 400 })
    }

    const result = await SecurityService.updateScanStatus(scanId, status, {
      threatLevel,
      threatsFound,
      scanResults,
      scanDurationMs
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Failed to update scan status:', error)
    return NextResponse.json(
      { error: 'Failed to update scan status' },
      { status: 500 }
    )
  }
}