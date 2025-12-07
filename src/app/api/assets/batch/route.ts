import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { assetIds } = await request.json()
    
    if (!assetIds || !Array.isArray(assetIds)) {
      return NextResponse.json(
        { error: 'Asset IDs array is required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Get assets with full metadata using the database function
    const { data: assets, error } = await supabase
      .rpc('get_assets_with_metadata', { asset_ids: assetIds })

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch assets' },
        { status: 500 }
      )
    }

    return NextResponse.json(assets || [])
  } catch (error) {
    console.error('Batch assets API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch assets' },
      { status: 500 }
    )
  }
}