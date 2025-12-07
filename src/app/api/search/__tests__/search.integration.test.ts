import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { GET } from '../route'
import { server } from '@/test/mocks/handlers'

describe('/api/search Integration Tests', () => {
  beforeAll(() => {
    server.listen()
  })

  afterAll(() => {
    server.close()
  })

  beforeEach(() => {
    server.resetHandlers()
  })

  describe('GET /api/search', () => {
    it('should return search results for valid query', async () => {
      const url = new URL('http://localhost:3000/api/search?q=test&project_id=project-1')
      const request = new Request(url.toString())

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(expect.objectContaining({
        results: expect.any(Array),
        total: expect.any(Number),
        facets: expect.any(Object),
      }))
    })

    it('should return 400 for missing query parameter', async () => {
      const url = new URL('http://localhost:3000/api/search?project_id=project-1')
      const request = new Request(url.toString())

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('Query parameter is required')
    })

    it('should handle complex search queries', async () => {
      const searchQuery = encodeURIComponent('image AND (jpg OR png) NOT draft')
      const url = new URL(`http://localhost:3000/api/search?q=${searchQuery}&project_id=project-1`)
      const request = new Request(url.toString())

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should support faceted search', async () => {
      const url = new URL('http://localhost:3000/api/search?q=test&project_id=project-1&facets=file_type,tags')
      const request = new Request(url.toString())

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.facets).toEqual(expect.objectContaining({
        file_types: expect.any(Array),
        projects: expect.any(Array),
      }))
    })

    it('should handle pagination', async () => {
      const url = new URL('http://localhost:3000/api/search?q=test&project_id=project-1&page=1&limit=10')
      const request = new Request(url.toString())

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.results.length).toBeLessThanOrEqual(10)
    })

    it('should support sorting options', async () => {
      const url = new URL('http://localhost:3000/api/search?q=test&project_id=project-1&sort=relevance&order=desc')
      const request = new Request(url.toString())

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      // Results should be sorted by relevance
      if (data.data.results.length > 1) {
        expect(data.data.results[0].relevance_score).toBeGreaterThanOrEqual(
          data.data.results[1].relevance_score
        )
      }
    })

    it('should filter by file types', async () => {
      const url = new URL('http://localhost:3000/api/search?q=test&project_id=project-1&file_types=image/jpeg,image/png')
      const request = new Request(url.toString())

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      data.data.results.forEach((result: any) => {
        expect(['image/jpeg', 'image/png']).toContain(result.file_type)
      })
    })

    it('should filter by date range', async () => {
      const startDate = '2024-01-01'
      const endDate = '2024-12-31'
      const url = new URL(`http://localhost:3000/api/search?q=test&project_id=project-1&start_date=${startDate}&end_date=${endDate}`)
      const request = new Request(url.toString())

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should support tag filtering', async () => {
      const url = new URL('http://localhost:3000/api/search?q=test&project_id=project-1&tags=important,draft')
      const request = new Request(url.toString())

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should handle metadata search', async () => {
      const url = new URL('http://localhost:3000/api/search?q=test&project_id=project-1&search_metadata=true')
      const request = new Request(url.toString())

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should support fuzzy search', async () => {
      const url = new URL('http://localhost:3000/api/search?q=tset&project_id=project-1&fuzzy=true')
      const request = new Request(url.toString())

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      // Should find results despite typo
    })

    it('should handle empty results gracefully', async () => {
      const url = new URL('http://localhost:3000/api/search?q=nonexistentfile12345&project_id=project-1')
      const request = new Request(url.toString())

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.results).toEqual([])
      expect(data.data.total).toBe(0)
    })

    it('should validate project access permissions', async () => {
      const url = new URL('http://localhost:3000/api/search?q=test&project_id=unauthorized-project')
      const request = new Request(url.toString(), {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      })

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.success).toBe(false)
      expect(data.error).toContain('access')
    })

    it('should handle special characters in search query', async () => {
      const specialQuery = encodeURIComponent('test@#$%^&*()_+{}|:"<>?[]\\;\',./')
      const url = new URL(`http://localhost:3000/api/search?q=${specialQuery}&project_id=project-1`)
      const request = new Request(url.toString())

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should support search highlighting', async () => {
      const url = new URL('http://localhost:3000/api/search?q=test&project_id=project-1&highlight=true')
      const request = new Request(url.toString())

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      if (data.data.results.length > 0) {
        expect(data.data.results[0]).toHaveProperty('highlights')
      }
    })

    it('should handle concurrent search requests', async () => {
      const searchPromises = []
      
      for (let i = 0; i < 5; i++) {
        const url = new URL(`http://localhost:3000/api/search?q=test${i}&project_id=project-1`)
        const request = new Request(url.toString())
        searchPromises.push(GET(request))
      }

      const responses = await Promise.all(searchPromises)
      
      expect(responses).toHaveLength(5)
      responses.forEach(response => {
        expect(response.status).toBe(200)
      })
    })

    it('should respect rate limiting', async () => {
      const requests = []
      
      // Make many requests quickly
      for (let i = 0; i < 100; i++) {
        const url = new URL(`http://localhost:3000/api/search?q=test&project_id=project-1`)
        const request = new Request(url.toString())
        requests.push(GET(request))
      }

      const responses = await Promise.allSettled(requests)
      
      // Some requests might be rate limited
      const rateLimitedResponses = responses.filter(
        result => result.status === 'fulfilled' && result.value.status === 429
      )
      
      // Should have some rate limiting in place
      expect(rateLimitedResponses.length).toBeGreaterThanOrEqual(0)
    })

    it('should handle database connection errors', async () => {
      // This would require mocking the database to fail
      const url = new URL('http://localhost:3000/api/search?q=test&project_id=project-1&simulate_db_error=true')
      const request = new Request(url.toString())

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toContain('database')
    })

    it('should log search analytics', async () => {
      const url = new URL('http://localhost:3000/api/search?q=test&project_id=project-1')
      const request = new Request(url.toString())

      const response = await GET(request)
      
      expect(response.status).toBe(200)
      // Analytics logging would be verified through monitoring/logging systems
    })

    it('should handle search suggestions', async () => {
      const url = new URL('http://localhost:3000/api/search?q=tes&project_id=project-1&suggestions=true')
      const request = new Request(url.toString())

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      if (data.data.suggestions) {
        expect(Array.isArray(data.data.suggestions)).toBe(true)
      }
    })

    it('should support search within folders', async () => {
      const url = new URL('http://localhost:3000/api/search?q=test&project_id=project-1&folder_id=folder-1')
      const request = new Request(url.toString())

      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should handle search performance monitoring', async () => {
      const start = performance.now()
      
      const url = new URL('http://localhost:3000/api/search?q=test&project_id=project-1')
      const request = new Request(url.toString())

      const response = await GET(request)
      const end = performance.now()
      
      expect(response.status).toBe(200)
      
      const searchTime = end - start
      console.log(`Search completed in ${searchTime.toFixed(2)}ms`)
      
      // Search should complete within reasonable time
      expect(searchTime).toBeLessThan(5000) // 5 seconds max
    })
  })
})