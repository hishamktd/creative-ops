import { renderHook } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useSwipeGestures } from '../useSwipeGestures'

describe('useSwipeGestures', () => {
  let mockElement: HTMLElement
  let addEventListenerSpy: ReturnType<typeof vi.fn>
  let removeEventListenerSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    addEventListenerSpy = vi.fn()
    removeEventListenerSpy = vi.fn()
    
    mockElement = {
      addEventListener: addEventListenerSpy,
      removeEventListener: removeEventListenerSpy
    } as unknown as HTMLElement
    
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns attachListeners function', () => {
    const { result } = renderHook(() => useSwipeGestures({}))
    
    expect(result.current.attachListeners).toBeInstanceOf(Function)
  })

  it('attaches event listeners when element is provided', () => {
    const { result } = renderHook(() => useSwipeGestures({}))
    
    const cleanup = result.current.attachListeners(mockElement)
    
    expect(addEventListenerSpy).toHaveBeenCalledWith('touchstart', expect.any(Function), { passive: true })
    expect(addEventListenerSpy).toHaveBeenCalledWith('touchmove', expect.any(Function), { passive: true })
    expect(addEventListenerSpy).toHaveBeenCalledWith('touchend', expect.any(Function), { passive: true })
    
    // Test cleanup function
    if (cleanup) {
      cleanup()
      expect(removeEventListenerSpy).toHaveBeenCalledTimes(3)
    }
  })

  it('does not attach listeners when element is null', () => {
    const { result } = renderHook(() => useSwipeGestures({}))
    
    const cleanup = result.current.attachListeners(null)
    
    expect(addEventListenerSpy).not.toHaveBeenCalled()
    expect(cleanup).toBeUndefined()
  })

  it('handles swipe left gesture', () => {
    const onSwipeLeft = vi.fn()
    const { result } = renderHook(() => useSwipeGestures({ onSwipeLeft }))
    
    result.current.attachListeners(mockElement)
    
    // Get the event handlers
    const touchStartHandler = addEventListenerSpy.mock.calls.find(call => call[0] === 'touchstart')?.[1]
    const touchEndHandler = addEventListenerSpy.mock.calls.find(call => call[0] === 'touchend')?.[1]
    
    expect(touchStartHandler).toBeDefined()
    expect(touchEndHandler).toBeDefined()
    
    // Simulate swipe left (start right, end left)
    const startEvent = {
      touches: [{ clientX: 200, clientY: 100 }]
    } as TouchEvent
    
    const endEvent = {
      changedTouches: [{ clientX: 100, clientY: 100 }]
    } as TouchEvent
    
    // Mock Date.now for consistent timing
    const mockTime = 1000
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(mockTime) // touchstart
      .mockReturnValueOnce(mockTime + 200) // touchend
    
    touchStartHandler(startEvent)
    touchEndHandler(endEvent)
    
    expect(onSwipeLeft).toHaveBeenCalled()
  })

  it('handles swipe right gesture', () => {
    const onSwipeRight = vi.fn()
    const { result } = renderHook(() => useSwipeGestures({ onSwipeRight }))
    
    result.current.attachListeners(mockElement)
    
    const touchStartHandler = addEventListenerSpy.mock.calls.find(call => call[0] === 'touchstart')?.[1]
    const touchEndHandler = addEventListenerSpy.mock.calls.find(call => call[0] === 'touchend')?.[1]
    
    // Simulate swipe right (start left, end right)
    const startEvent = {
      touches: [{ clientX: 100, clientY: 100 }]
    } as TouchEvent
    
    const endEvent = {
      changedTouches: [{ clientX: 200, clientY: 100 }]
    } as TouchEvent
    
    const mockTime = 1000
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(mockTime)
      .mockReturnValueOnce(mockTime + 200)
    
    touchStartHandler(startEvent)
    touchEndHandler(endEvent)
    
    expect(onSwipeRight).toHaveBeenCalled()
  })

  it('handles swipe up gesture', () => {
    const onSwipeUp = vi.fn()
    const { result } = renderHook(() => useSwipeGestures({ onSwipeUp }))
    
    result.current.attachListeners(mockElement)
    
    const touchStartHandler = addEventListenerSpy.mock.calls.find(call => call[0] === 'touchstart')?.[1]
    const touchEndHandler = addEventListenerSpy.mock.calls.find(call => call[0] === 'touchend')?.[1]
    
    // Simulate swipe up (start bottom, end top)
    const startEvent = {
      touches: [{ clientX: 100, clientY: 200 }]
    } as TouchEvent
    
    const endEvent = {
      changedTouches: [{ clientX: 100, clientY: 100 }]
    } as TouchEvent
    
    const mockTime = 1000
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(mockTime)
      .mockReturnValueOnce(mockTime + 200)
    
    touchStartHandler(startEvent)
    touchEndHandler(endEvent)
    
    expect(onSwipeUp).toHaveBeenCalled()
  })

  it('handles swipe down gesture', () => {
    const onSwipeDown = vi.fn()
    const { result } = renderHook(() => useSwipeGestures({ onSwipeDown }))
    
    result.current.attachListeners(mockElement)
    
    const touchStartHandler = addEventListenerSpy.mock.calls.find(call => call[0] === 'touchstart')?.[1]
    const touchEndHandler = addEventListenerSpy.mock.calls.find(call => call[0] === 'touchend')?.[1]
    
    // Simulate swipe down (start top, end bottom)
    const startEvent = {
      touches: [{ clientX: 100, clientY: 100 }]
    } as TouchEvent
    
    const endEvent = {
      changedTouches: [{ clientX: 100, clientY: 200 }]
    } as TouchEvent
    
    const mockTime = 1000
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(mockTime)
      .mockReturnValueOnce(mockTime + 200)
    
    touchStartHandler(startEvent)
    touchEndHandler(endEvent)
    
    expect(onSwipeDown).toHaveBeenCalled()
  })

  it('respects custom threshold', () => {
    const onSwipeLeft = vi.fn()
    const { result } = renderHook(() => useSwipeGestures({ 
      onSwipeLeft, 
      threshold: 100 
    }))
    
    result.current.attachListeners(mockElement)
    
    const touchStartHandler = addEventListenerSpy.mock.calls.find(call => call[0] === 'touchstart')?.[1]
    const touchEndHandler = addEventListenerSpy.mock.calls.find(call => call[0] === 'touchend')?.[1]
    
    // Simulate small swipe (below threshold)
    const startEvent = {
      touches: [{ clientX: 150, clientY: 100 }]
    } as TouchEvent
    
    const endEvent = {
      changedTouches: [{ clientX: 100, clientY: 100 }]
    } as TouchEvent
    
    const mockTime = 1000
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(mockTime)
      .mockReturnValueOnce(mockTime + 200)
    
    touchStartHandler(startEvent)
    touchEndHandler(endEvent)
    
    // Should not trigger (50px < 100px threshold)
    expect(onSwipeLeft).not.toHaveBeenCalled()
  })

  it('ignores slow swipes', () => {
    const onSwipeLeft = vi.fn()
    const { result } = renderHook(() => useSwipeGestures({ onSwipeLeft }))
    
    result.current.attachListeners(mockElement)
    
    const touchStartHandler = addEventListenerSpy.mock.calls.find(call => call[0] === 'touchstart')?.[1]
    const touchEndHandler = addEventListenerSpy.mock.calls.find(call => call[0] === 'touchend')?.[1]
    
    // Simulate slow swipe (> 500ms)
    const startEvent = {
      touches: [{ clientX: 200, clientY: 100 }]
    } as TouchEvent
    
    const endEvent = {
      changedTouches: [{ clientX: 100, clientY: 100 }]
    } as TouchEvent
    
    const mockTime = 1000
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(mockTime)
      .mockReturnValueOnce(mockTime + 600) // 600ms duration
    
    touchStartHandler(startEvent)
    touchEndHandler(endEvent)
    
    expect(onSwipeLeft).not.toHaveBeenCalled()
  })

  it('prioritizes horizontal over vertical swipes', () => {
    const onSwipeLeft = vi.fn()
    const onSwipeUp = vi.fn()
    const { result } = renderHook(() => useSwipeGestures({ 
      onSwipeLeft, 
      onSwipeUp 
    }))
    
    result.current.attachListeners(mockElement)
    
    const touchStartHandler = addEventListenerSpy.mock.calls.find(call => call[0] === 'touchstart')?.[1]
    const touchEndHandler = addEventListenerSpy.mock.calls.find(call => call[0] === 'touchend')?.[1]
    
    // Simulate diagonal swipe with more horizontal movement
    const startEvent = {
      touches: [{ clientX: 200, clientY: 150 }]
    } as TouchEvent
    
    const endEvent = {
      changedTouches: [{ clientX: 100, clientY: 100 }]
    } as TouchEvent
    
    const mockTime = 1000
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(mockTime)
      .mockReturnValueOnce(mockTime + 200)
    
    touchStartHandler(startEvent)
    touchEndHandler(endEvent)
    
    // Should trigger horizontal swipe (100px horizontal vs 50px vertical)
    expect(onSwipeLeft).toHaveBeenCalled()
    expect(onSwipeUp).not.toHaveBeenCalled()
  })

  it('handles touchmove with preventDefault when enabled', () => {
    const { result } = renderHook(() => useSwipeGestures({ 
      preventDefaultTouchmove: true 
    }))
    
    result.current.attachListeners(mockElement)
    
    const touchMoveHandler = addEventListenerSpy.mock.calls.find(call => call[0] === 'touchmove')?.[1]
    
    expect(touchMoveHandler).toBeDefined()
    
    const mockEvent = {
      preventDefault: vi.fn()
    } as unknown as TouchEvent
    
    touchMoveHandler(mockEvent)
    
    expect(mockEvent.preventDefault).toHaveBeenCalled()
  })

  it('handles touchmove without preventDefault when disabled', () => {
    const { result } = renderHook(() => useSwipeGestures({ 
      preventDefaultTouchmove: false 
    }))
    
    result.current.attachListeners(mockElement)
    
    // Should use passive: true for touchmove
    const touchMoveCall = addEventListenerSpy.mock.calls.find(call => call[0] === 'touchmove')
    expect(touchMoveCall?.[2]).toEqual({ passive: true })
  })

  it('handles missing touchstart before touchend', () => {
    const onSwipeLeft = vi.fn()
    const { result } = renderHook(() => useSwipeGestures({ onSwipeLeft }))
    
    result.current.attachListeners(mockElement)
    
    const touchEndHandler = addEventListenerSpy.mock.calls.find(call => call[0] === 'touchend')?.[1]
    
    // Simulate touchend without touchstart
    const endEvent = {
      changedTouches: [{ clientX: 100, clientY: 100 }]
    } as TouchEvent
    
    touchEndHandler(endEvent)
    
    // Should not trigger any swipe
    expect(onSwipeLeft).not.toHaveBeenCalled()
  })

  it('resets state after handling swipe', () => {
    const onSwipeLeft = vi.fn()
    const { result } = renderHook(() => useSwipeGestures({ onSwipeLeft }))
    
    result.current.attachListeners(mockElement)
    
    const touchStartHandler = addEventListenerSpy.mock.calls.find(call => call[0] === 'touchstart')?.[1]
    const touchEndHandler = addEventListenerSpy.mock.calls.find(call => call[0] === 'touchend')?.[1]
    
    // First swipe
    const startEvent1 = {
      touches: [{ clientX: 200, clientY: 100 }]
    } as TouchEvent
    
    const endEvent1 = {
      changedTouches: [{ clientX: 100, clientY: 100 }]
    } as TouchEvent
    
    const mockTime = 1000
    vi.spyOn(Date, 'now')
      .mockReturnValueOnce(mockTime)
      .mockReturnValueOnce(mockTime + 200)
      .mockReturnValueOnce(mockTime + 1000)
      .mockReturnValueOnce(mockTime + 1200)
    
    touchStartHandler(startEvent1)
    touchEndHandler(endEvent1)
    
    expect(onSwipeLeft).toHaveBeenCalledTimes(1)
    
    // Second swipe should work independently
    const startEvent2 = {
      touches: [{ clientX: 200, clientY: 100 }]
    } as TouchEvent
    
    const endEvent2 = {
      changedTouches: [{ clientX: 100, clientY: 100 }]
    } as TouchEvent
    
    touchStartHandler(startEvent2)
    touchEndHandler(endEvent2)
    
    expect(onSwipeLeft).toHaveBeenCalledTimes(2)
  })
})