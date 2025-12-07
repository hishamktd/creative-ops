import { NextRequest, NextResponse } from 'next/server'
import { searchService } from '@/lib/services/searchService'
import type { SearchFilters, SearchSortOptions } from '@/types/search'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse search filters from query parameters
    const filters: SearchFilters = {
      query: searchParams.get('q') || undefined,
      projectIds: searchParams.get('projects')?.split(',').filter(Boolean) || undefined,
      fileTypes: searchParams.get('types')?.split(',').filter(Boolean) || undefined,
      tags: searchParams.get('tags')?.split(',').filter(Boolean) || undefined,
      status: searchParams.get('status')?.split(',').filter(Boolean) as any || undefined,
      uploadedBy: searchParams.get('uploadedBy')?.split(',').filter(Boolean) || undefined
    }

    // Parse date range
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    if (startDate && endDate) {
      filters.dateRange = { start: startDate, end: endDate }
    }

    // Parse size range
    const minSize = searchParams.get('minSize')
    const maxSize = searchParams.get('maxSize')
    if (minSize && maxSize) {
      filters.sizeRange = { 
        min: parseInt(minSize), 
        max: parseInt(maxSize) 
      }
    }

    // Parse sort options
    const sort: SearchSortOptions = {
      field: (searchParams.get('sortBy') as any) || 'relevance',
      direction: (searchParams.get('sortDir') as 'asc' | 'desc') || 'desc'
    }

    // Parse pagination
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Perform search
    const results = await searchService.searchAssets(filters, sort, limit, offset)

    // Log analytics if query is provided
    if (filters.query) {
      await searchService.logSearchAnalytics({
        query: filters.query,
        results_count: results.total,
        user_id: 'current-user-id', // TODO: Get from auth
        project_id: filters.projectIds?.[0]
      })
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json(
      { error: 'Failed to search assets' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { filters, sort, limit = 50, offset = 0 } = body

    const results = await searchService.searchAssets(filters, sort, limit, offset)

    // Log analytics
    if (filters.query) {
      await searchService.logSearchAnalytics({
        query: filters.query,
        results_count: results.total,
        user_id: 'current-user-id', // TODO: Get from auth
        project_id: filters.projectIds?.[0]
      })
    }

    return NextResponse.json(results)
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json(
      { error: 'Failed to search assets' },
      { status: 500 }
    )
  }
}