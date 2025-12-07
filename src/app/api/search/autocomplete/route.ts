import { NextRequest, NextResponse } from 'next/server'
import { searchService } from '@/lib/services/searchService'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''

    if (!query || query.length < 2) {
      return NextResponse.json({
        suggestions: [],
        recent_searches: [],
        popular_tags: []
      })
    }

    const results = await searchService.getAutocomplete(query)
    return NextResponse.json(results)
  } catch (error) {
    console.error('Autocomplete API error:', error)
    return NextResponse.json(
      { error: 'Failed to get autocomplete results' },
      { status: 500 }
    )
  }
}