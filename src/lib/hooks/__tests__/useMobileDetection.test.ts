import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useMobileDetection } from '../useMobileDetection'

// Mock window properties
const mockWindow = {
  innerWidth: 1024,
  innerHeight: 768,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
}

const mockNavigator = {
  maxTouchPoints: 0
}

describe('useMobileDetection', () => {
  beforeEach(() => {
    // Reset window and navigator mocks
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: mockWindow.innerWidth
    })
    
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: mockWindow.innerHeight
    })
    
    Object.defineProperty(window, 'addEventListener', {
      writable: true,
      configurable: true,
      value: mockWindow.addEventListener
    })
    
    Object.defineProperty(window, 'removeEventListener', {
      writable: true,
      configurable: true,
      value: mockWindow.removeEventListener
    })
    
    Object.defineProperty(navigator, 'maxTouchPoints', {
      writable: true,
      configurable: true,
      value: mockNavigator.maxTouchPoints
    })
    
    // Reset touch support
    delete (window as any).ontouchstart
    
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('detects desktop by default', () => {
    const { result } = renderHook(() => useMobileDetection())
    
    expect(result.current).toEqual({
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isTouchDevice: false,
      screenSize: 'lg',
      orientation: 'landscape'
    })
  })

  it('detects mobile screen size', () => {
    // Set mobile screen size
    Object.defineProperty(window, 'innerWidth', { value: 375 })
    Object.defineProperty(window, 'innerHeight', { value: 667 })
    
    const { result } = renderHook(() => useMobileDetection())
    
    expect(result.current).toEqual({
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      isTouchDevice: false,
      screenSize: 'sm',
      orientation: 'portrait'
    })
  })

  it('detects tablet with touch support', () => {
    // Set tablet screen size with touch
    Object.defineProperty(window, 'innerWidth', { value: 768 })
    Object.defineProperty(window, 'innerHeight', { value: 1024 })
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 10 })
    
    const { result } = renderHook(() => useMobileDetection())
    
    expect(result.current).toEqual({
      isMobile: false,
      isTablet: true,
      isDesktop: false,
      isTouchDevice: true,
      screenSize: 'md',
      orientation: 'portrait'
    })
  })

  it('detects touch device with ontouchstart', () => {
    // Add touch support
    Object.defineProperty(window, 'ontouchstart', { value: {} })
    Object.defineProperty(window, 'innerWidth', { value: 375 })
    
    const { result } = renderHook(() => useMobileDetection())
    
    expect(result.current.isTouchDevice).toBe(true)
    expect(result.current.isMobile).toBe(true)
  })

  it('detects different screen sizes correctly', () => {
    const testCases = [
      { width: 320, expected: 'sm' },
      { width: 640, expected: 'md' },
      { width: 768, expected: 'md' },
      { width: 1024, expected: 'lg' },
      { width: 1280, expected: 'xl' }
    ]
    
    testCases.forEach(({ width, expected }) => {
      Object.defineProperty(window, 'innerWidth', { value: width })
      
      const { result } = renderHook(() => useMobileDetection())
      
      expect(result.current.screenSize).toBe(expected)
    })
  })

  it('detects orientation correctly', () => {
    // Portrait
    Object.defineProperty(window, 'innerWidth', { value: 375 })
    Object.defineProperty(window, 'innerHeight', { value: 667 })
    
    const { result, rerender } = renderHook(() => useMobileDetection())
    
    expect(result.current.orientation).toBe('portrait')
    
    // Landscape
    Object.defineProperty(window, 'innerWidth', { value: 667 })
    Object.defineProperty(window, 'innerHeight', { value: 375 })
    
    rerender()
    
    expect(result.current.orientation).toBe('landscape')
  })

  it('adds event listeners on mount', () => {
    renderHook(() => useMobileDetection())
    
    expect(window.addEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(window.addEventListener).toHaveBeenCalledWith('orientationchange', expect.any(Function))
  })

  it('removes event listeners on unmount', () => {
    const { unmount } = renderHook(() => useMobileDetection())
    
    unmount()
    
    expect(window.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(window.removeEventListener).toHaveBeenCalledWith('orientationchange', expect.any(Function))
  })

  it('updates detection on resize', () => {
    let resizeHandler: () => void
    
    mockWindow.addEventListener.mockImplementation((event, handler) => {
      if (event === 'resize') {
        resizeHandler = handler as () => void
      }
    })
    
    const { result } = renderHook(() => useMobileDetection())
    
    // Initially desktop
    expect(result.current.isMobile).toBe(false)
    
    // Change to mobile size
    Object.defineProperty(window, 'innerWidth', { value: 375 })
    
    act(() => {
      resizeHandler()
    })
    
    expect(result.current.isMobile).toBe(true)
  })

  it('updates detection on orientation change', () => {
    let orientationHandler: () => void
    
    mockWindow.addEventListener.mockImplementation((event, handler) => {
      if (event === 'orientationchange') {
        orientationHandler = handler as () => void
      }
    })
    
    // Start in portrait
    Object.defineProperty(window, 'innerWidth', { value: 375 })
    Object.defineProperty(window, 'innerHeight', { value: 667 })
    
    const { result } = renderHook(() => useMobileDetection())
    
    expect(result.current.orientation).toBe('portrait')
    
    // Rotate to landscape
    Object.defineProperty(window, 'innerWidth', { value: 667 })
    Object.defineProperty(window, 'innerHeight', { value: 375 })
    
    act(() => {
      orientationHandler()
    })
    
    expect(result.current.orientation).toBe('landscape')
  })

  it('handles edge case screen sizes', () => {
    // Exactly at breakpoint
    Object.defineProperty(window, 'innerWidth', { value: 640 })
    
    const { result } = renderHook(() => useMobileDetection())
    
    expect(result.current.screenSize).toBe('md')
    expect(result.current.isMobile).toBe(false) // 640px is not mobile (< 768)
  })

  it('correctly identifies desktop with large screen and no touch', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1920 })
    Object.defineProperty(window, 'innerHeight', { value: 1080 })
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 0 })
    
    const { result } = renderHook(() => useMobileDetection())
    
    expect(result.current).toEqual({
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isTouchDevice: false,
      screenSize: 'xl',
      orientation: 'landscape'
    })
  })

  it('handles touch device with large screen as desktop', () => {
    // Large touch screen (like Surface Pro)
    Object.defineProperty(window, 'innerWidth', { value: 1368 })
    Object.defineProperty(window, 'innerHeight', { value: 912 })
    Object.defineProperty(navigator, 'maxTouchPoints', { value: 10 })
    
    const { result } = renderHook(() => useMobileDetection())
    
    expect(result.current).toEqual({
      isMobile: false,
      isTablet: false,
      isDesktop: true, // Large screen overrides touch for desktop classification
      isTouchDevice: true,
      screenSize: 'xl',
      orientation: 'landscape'
    })
  })
})