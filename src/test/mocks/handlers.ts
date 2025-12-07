import { http, HttpResponse } from 'msw'

// Mock API handlers for testing
export const handlers = [
  // Assets API handlers
  http.post('/api/assets/upload', async ({ request }) => {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const projectId = formData.get('project_id') as string
    const folderId = formData.get('folder_id') as string | null
    const description = formData.get('description') as string | null
    
    // Simulate validation errors
    if (formData.get('simulate_storage_failure')) {
      return HttpResponse.json(
        { success: false, error: 'Storage service unavailable' },
        { status: 500 }
      )
    }
    
    if (formData.get('simulate_db_error')) {
      return HttpResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 500 }
      )
    }
    
    if (!file) {
      return HttpResponse.json(
        { success: false, error: 'File is required' },
        { status: 400 }
      )
    }
    
    if (!projectId) {
      return HttpResponse.json(
        { success: false, error: 'project_id is required' },
        { status: 400 }
      )
    }
    
    // Validate file type
    if (file.name.endsWith('.exe') || file.type === 'application/octet-stream') {
      return HttpResponse.json(
        { success: false, error: 'File type not allowed' },
        { status: 400 }
      )
    }
    
    // Validate file size (100MB limit)
    if (file.size > 100 * 1024 * 1024) {
      return HttpResponse.json(
        { success: false, error: 'File size exceeds maximum limit' },
        { status: 400 }
      )
    }
    
    // Check for suspicious content
    const buffer = await file.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    if (bytes[0] === 0x4d && bytes[1] === 0x5a) { // PE executable header
      return HttpResponse.json(
        { success: false, error: 'File failed security validation' },
        { status: 400 }
      )
    }
    
    // Handle multiple files
    const files = formData.getAll('files') as File[]
    if (files.length > 0) {
      const results = files.map((f, index) => ({
        id: `asset-${Date.now()}-${index}`,
        name: f.name,
        file_type: f.type,
        file_size: f.size,
        project_id: projectId,
        folder_id: folderId,
        description,
        file_url: `https://example.com/${f.name}`,
        thumbnail_url: f.type.startsWith('image/') ? `https://example.com/${f.name}-thumb.jpg` : null,
        metadata: {
          original_name: f.name,
          mime_type: f.type,
        },
        status: 'ready',
        created_at: new Date().toISOString(),
      }))
      
      return HttpResponse.json({ success: true, data: results })
    }
    
    // Single file upload
    const mockAsset = {
      id: `asset-${Date.now()}`,
      name: file.name,
      file_type: file.type,
      file_size: file.size,
      project_id: projectId,
      folder_id: folderId,
      description,
      file_url: `https://example.com/${file.name}`,
      thumbnail_url: file.type.startsWith('image/') ? `https://example.com/${file.name}-thumb.jpg` : null,
      metadata: {
        original_name: file.name,
        mime_type: file.type,
      },
      status: 'ready',
      created_at: new Date().toISOString(),
      upload_progress: formData.get('track_progress') ? 100 : undefined,
    }
    
    return HttpResponse.json({ success: true, data: mockAsset })
  }),

  // Search API handlers
  http.get('/api/search', ({ request }) => {
    const url = new URL(request.url)
    const query = url.searchParams.get('q')
    const projectId = url.searchParams.get('project_id')
    
    if (!query) {
      return HttpResponse.json(
        { success: false, error: 'Query parameter is required' },
        { status: 400 }
      )
    }
    
    const mockResults = [
      {
        id: 'asset-1',
        name: 'test-image.jpg',
        file_type: 'image/jpeg',
        project_id: projectId || 'project-1',
        thumbnail_url: 'https://example.com/thumb.jpg',
        relevance_score: 0.95,
      },
    ]
    
    return HttpResponse.json({
      success: true,
      data: {
        results: mockResults,
        total: mockResults.length,
        facets: {
          file_types: [{ value: 'image/jpeg', count: 1 }],
          projects: [{ value: projectId || 'project-1', count: 1 }],
        },
      },
    })
  }),

  // Security API handlers
  http.get('/api/security/permissions', ({ request }) => {
    const url = new URL(request.url)
    const assetId = url.searchParams.get('asset_id')
    
    return HttpResponse.json({
      success: true,
      data: {
        asset_id: assetId,
        permissions: {
          read: true,
          write: true,
          delete: false,
          share: true,
        },
        user_role: 'team_member',
      },
    })
  }),

  // Notification API handlers
  http.post('/api/notifications/email', async ({ request }) => {
    const body = await request.json()
    
    if (!body.to || !body.subject) {
      return HttpResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    return HttpResponse.json({
      success: true,
      data: { message_id: `msg-${Date.now()}` },
    })
  }),

  // Storage API handlers
  http.post('/api/storage/init', () => {
    return HttpResponse.json({
      success: true,
      data: { buckets_created: ['assets'] },
    })
  }),

  // Supabase mock endpoints
  http.post('https://test-project.supabase.co/rest/v1/assets', async ({ request }) => {
    const body = await request.json()
    
    return HttpResponse.json({
      id: `asset-${Date.now()}`,
      ...body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }),

  http.get('https://test-project.supabase.co/rest/v1/assets', ({ request }) => {
    const url = new URL(request.url)
    const projectId = url.searchParams.get('project_id')
    
    const mockAssets = [
      {
        id: 'asset-1',
        project_id: projectId || 'project-1',
        name: 'test-image.jpg',
        file_type: 'image/jpeg',
        file_size: 1024000,
        status: 'ready',
        created_at: '2024-01-01T00:00:00Z',
      },
    ]
    
    return HttpResponse.json(mockAssets)
  }),

  // Fallback handler for unhandled requests
  http.all('*', ({ request }) => {
    console.warn(`Unhandled ${request.method} request to ${request.url}`)
    return HttpResponse.json(
      { error: 'Not found' },
      { status: 404 }
    )
  }),
]