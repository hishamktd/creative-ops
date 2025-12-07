import { NextRequest, NextResponse } from 'next/server'
import { searchService } from '@/lib/services/searchService'

export async function GET(request: NextRequest) {
  try {
    // TODO: Get user ID from auth
    const userId = 'current-user-id'
    
    const savedSearches = await searchService.getSavedSearches(userId)
    return NextResponse.json(savedSearches)
  } catch (error) {
    console.error('Get saved searches API error:', error)
    return NextResponse.json(
      { error: 'Failed to get saved searches' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // TODO: Get user ID from auth
    const userId = 'current-user-id'
    
    const savedSearch = await searchService.saveSearch({
      ...body,
      user_id: userId
    })
    
    return NextResponse.json(savedSearch)
  } catch (error) {
    console.error('Save search API error:', error)
    return NextResponse.json(
      { error: 'Failed to save search' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const searchId = searchParams.get('id')
    
    if (!searchId) {
      return NextResponse.json(
        { error: 'Search ID is required' },
        { status: 400 }
      )
    }
    
    await searchService.deleteSavedSearch(searchId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete saved search API error:', error)
    return NextResponse.json(
      { error: 'Failed to delete saved search' },
      { status: 500 }
    )
  }
}