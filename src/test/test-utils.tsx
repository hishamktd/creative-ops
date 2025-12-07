import React, { ReactElement } from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { vi } from 'vitest'

// Mock providers that might be needed for testing
const MockAuthProvider = ({ children }: { children: React.ReactNode }) => {
  return <div data-testid="mock-auth-provider">{children}</div>
}

const MockThemeProvider = ({ children }: { children: React.ReactNode }) => {
  return <div data-testid="mock-theme-provider">{children}</div>
}

const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <MockAuthProvider>
      <MockThemeProvider>
        {children}
      </MockThemeProvider>
    </MockAuthProvider>
  )
}

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options })

export * from '@testing-library/react'
export { customRender as render }

// Common test utilities
export const createMockFile = (
  name: string,
  content: string = 'test content',
  type: string = 'text/plain'
): File => {
  return new File([content], name, { type })
}

export const createMockImageFile = (
  name: string = 'test-image.jpg',
  width: number = 100,
  height: number = 100
): File => {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#ff0000'
    ctx.fillRect(0, 0, width, height)
  }
  
  return new File([canvas.toDataURL()], name, { type: 'image/jpeg' })
}

export const createMockVideoFile = (
  name: string = 'test-video.mp4',
  duration: number = 60
): File => {
  // Create a minimal MP4-like file for testing
  const mp4Header = new Uint8Array([
    0x00, 0x00, 0x00, 0x20, // Box size
    0x66, 0x74, 0x79, 0x70, // 'ftyp'
    0x69, 0x73, 0x6f, 0x6d, // 'isom'
    0x00, 0x00, 0x02, 0x00, // Minor version
    0x69, 0x73, 0x6f, 0x6d, // Compatible brands
    0x69, 0x73, 0x6f, 0x32,
    0x61, 0x76, 0x63, 0x31,
    0x6d, 0x70, 0x34, 0x31,
  ])
  
  return new File([mp4Header], name, { type: 'video/mp4' })
}

export const createMockPDFFile = (
  name: string = 'test-document.pdf',
  pages: number = 1
): File => {
  const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count ${pages}
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
>>
endobj

xref
0 4
0000000000 65535 f 
0000000010 00000 n 
0000000079 00000 n 
0000000173 00000 n 
trailer
<<
/Size 4
/Root 1 0 R
>>
startxref
301
%%EOF`

  return new File([pdfContent], name, { type: 'application/pdf' })
}

// Mock API responses
export const mockApiResponse = <T>(data: T, error: any = null) => ({
  data,
  error,
})

export const mockSupabaseResponse = <T>(data: T, error: any = null) => ({
  data,
  error,
  status: error ? 400 : 200,
  statusText: error ? 'Bad Request' : 'OK',
})

// Test data generators
export const generateMockAsset = (overrides: Partial<any> = {}) => ({
  id: `asset-${Math.random().toString(36).substr(2, 9)}`,
  project_id: 'project-1',
  name: 'test-asset.jpg',
  description: 'Test asset',
  file_url: 'https://example.com/test-asset.jpg',
  file_path: 'assets/test-asset.jpg',
  file_type: 'image/jpeg',
  file_size: 1024000,
  version: 1,
  thumbnail_url: 'https://example.com/test-asset-thumb.jpg',
  preview_url: 'https://example.com/test-asset-preview.jpg',
  metadata: {
    width: 1920,
    height: 1080,
    original_name: 'test-asset.jpg',
    mime_type: 'image/jpeg',
  },
  tags: ['test', 'mock'],
  status: 'ready',
  uploaded_by: 'user-1',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  access_count: 0,
  checksum: 'mock-checksum',
  ...overrides,
})

export const generateMockUser = (overrides: Partial<any> = {}) => ({
  id: `user-${Math.random().toString(36).substr(2, 9)}`,
  email: 'test@example.com',
  full_name: 'Test User',
  avatar_url: 'https://example.com/avatar.jpg',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
})

export const generateMockProject = (overrides: Partial<any> = {}) => ({
  id: `project-${Math.random().toString(36).substr(2, 9)}`,
  name: 'Test Project',
  description: 'Test project description',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  created_by: 'user-1',
  ...overrides,
})

// Performance testing utilities
export const measureRenderTime = async (renderFn: () => void): Promise<number> => {
  const start = performance.now()
  renderFn()
  const end = performance.now()
  return end - start
}

export const waitForNextTick = (): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, 0))
}

// Accessibility testing utilities
export const getByLabelText = (container: HTMLElement, text: string) => {
  return container.querySelector(`[aria-label*="${text}"]`) ||
         container.querySelector(`[aria-labelledby*="${text}"]`)
}

export const getByRole = (container: HTMLElement, role: string) => {
  return container.querySelector(`[role="${role}"]`)
}

// Mock implementations for common services
export const mockStorageService = {
  uploadFile: vi.fn().mockResolvedValue({
    success: true,
    data: {
      path: 'test/path',
      fullPath: 'full/test/path',
      publicUrl: 'https://example.com/test.jpg',
    },
  }),
  deleteFile: vi.fn().mockResolvedValue(true),
  getSignedUrl: vi.fn().mockResolvedValue('https://example.com/signed-url'),
  validateFile: vi.fn().mockReturnValue({
    isValid: true,
    errors: [],
    warnings: [],
    metadata: {},
    securityFlags: [],
  }),
}

export const mockSupabaseClient = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
      })),
    })),
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn(() => Promise.resolve({ data: {}, error: null })),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  })),
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn(() => Promise.resolve({
        data: { path: 'test-path' },
        error: null,
      })),
      getPublicUrl: vi.fn(() => ({
        data: { publicUrl: 'https://example.com/test.jpg' },
      })),
    })),
  },
  channel: vi.fn(() => ({
    on: vi.fn(() => ({ subscribe: vi.fn() })),
  })),
  removeChannel: vi.fn(),
}

// Error simulation utilities
export const simulateNetworkError = () => {
  throw new Error('Network error')
}

export const simulateTimeoutError = () => {
  throw new Error('Request timeout')
}

export const simulateValidationError = (message: string) => {
  throw new Error(`Validation error: ${message}`)
}

// Test environment utilities
export const isTestEnvironment = () => process.env.NODE_ENV === 'test'

export const skipInCI = (testFn: () => void) => {
  if (process.env.CI) {
    return () => { /* skip */ }
  }
  return testFn
}

export const runOnlyInCI = (testFn: () => void) => {
  if (!process.env.CI) {
    return () => { /* skip */ }
  }
  return testFn
}