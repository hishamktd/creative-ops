import { NextRequest, NextResponse } from 'next/server'
import { AssetManagerService } from '@/lib/services/assetManager'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const assetId = params.id
    const { searchParams } = new URL(request.url)
    const expiresIn = parseInt(searchParams.get('expiresIn') || '3600')

    // Get asset to check permissions
    const asset = await AssetManagerService.getAsset(assetId)
    
    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      )
    }

    // Check if user has access to the project
    const { data: projectMember } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', asset.project_id)
      .eq('user_id', user.id)
      .single()

    if (!projectMember) {
      return NextResponse.json(
        { error: 'Access denied to this asset' },
        { status: 403 }
      )
    }

    // Generate download URL
    const downloadUrl = await AssetManagerService.getDownloadUrl(assetId, expiresIn)
    
    if (!downloadUrl) {
      return NextResponse.json(
        { error: 'Failed to generate download URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      downloadUrl,
      expiresIn,
      asset: {
        id: asset.id,
        name: asset.name,
        file_type: asset.file_type,
        file_size: asset.file_size
      }
    })

  } catch (error) {
    console.error('Download URL generation failed:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}