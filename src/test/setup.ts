import '@testing-library/jest-dom'

// Mock environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

// Mock File constructor for Node.js environment
global.File = class File {
  name: string
  size: number
  type: string
  lastModified: number
  
  constructor(chunks: any[], filename: string, options: any = {}) {
    this.name = filename
    // Calculate size properly
    this.size = chunks.reduce((acc, chunk) => {
      if (typeof chunk === 'string') return acc + chunk.length
      if (chunk instanceof ArrayBuffer) return acc + chunk.byteLength
      if (chunk && chunk.length !== undefined) return acc + chunk.length
      return acc + 1
    }, 0)
    this.type = options.type || ''
    this.lastModified = options.lastModified || Date.now()
  }
  
  arrayBuffer(): Promise<ArrayBuffer> {
    return Promise.resolve(new ArrayBuffer(this.size))
  }
  
  text(): Promise<string> {
    return Promise.resolve('test content')
  }
} as any

// Allow overriding File properties for testing
Object.defineProperty(global.File.prototype, 'size', {
  configurable: true,
  writable: true
})

// Mock Image constructor
global.Image = class Image {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  width = 100
  height = 100
  
  set src(value: string) {
    setTimeout(() => {
      if (this.onload) this.onload()
    }, 0)
  }
} as any

// Mock canvas and context
global.HTMLCanvasElement.prototype.getContext = function(contextId: string) {
  if (contextId === '2d') {
    return {
      drawImage: () => {},
      canvas: { width: 100, height: 100 }
    }
  }
  return null
} as any

global.HTMLCanvasElement.prototype.toBlob = function(callback: (blob: Blob | null) => void) {
  setTimeout(() => {
    callback(new Blob(['test'], { type: 'image/jpeg' }))
  }, 0)
}

// Mock video element
global.HTMLVideoElement = class HTMLVideoElement {
  onloadedmetadata: (() => void) | null = null
  onseeked: (() => void) | null = null
  onerror: (() => void) | null = null
  videoWidth = 100
  videoHeight = 100
  duration = 60
  currentTime = 0
  
  load() {
    setTimeout(() => {
      if (this.onloadedmetadata) this.onloadedmetadata()
    }, 0)
  }
  
  set src(value: string) {
    // Mock implementation
  }
} as any

// Mock URL.createObjectURL
global.URL.createObjectURL = () => 'blob:test-url'

// Mock FileReader
global.FileReader = class FileReader {
  onload: ((event: any) => void) | null = null
  onerror: (() => void) | null = null
  result: string | ArrayBuffer | null = null
  
  readAsDataURL(file: File) {
    setTimeout(() => {
      this.result = 'data:image/jpeg;base64,test'
      if (this.onload) {
        this.onload({ target: { result: this.result } })
      }
    }, 0)
  }
} as any