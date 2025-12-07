import { NextRequest, NextResponse } from 'next/server'
import { initializeStorage, verifyStorageSetup } from '@/lib/services/initStorage'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Check if user is authenticated and has admin role
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user has admin role
    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Initialize storage
    await initializeStorage()
    
    // Verify setup
    const isVerified = await verifyStorageSetup()
    
    if (!isVerified) {
      return NextResponse.json(
        { error: 'Storage verification failed' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Storage initialized and verified successfully'
    })

  } catch (error) {
    console.error('Storage initialization failed:', error)
    return NextResponse.json(
      { error: 'Storage initialization failed' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    
    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Verify storage setup
    const isVerified = await verifyStorageSetup()
    
    return NextResponse.json({
      initialized: isVerified,
      message: isVerified ? 'Storage is properly configured' : 'Storage needs initialization'
    })

  } catch (error) {
    console.error('Storage verification failed:', error)
    return NextResponse.json(
      { error: 'Storage verification failed' },
      { status: 500 }
    )
  }
}