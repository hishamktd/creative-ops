import { configureAxe } from 'vitest-axe'
import 'vitest-axe/extend-expect'

// Configure axe-core for accessibility testing
configureAxe({
  rules: {
    // Disable color-contrast rule for tests (can be flaky in jsdom)
    'color-contrast': { enabled: false },
    // Enable other important accessibility rules
    'aria-allowed-attr': { enabled: true },
    'aria-required-attr': { enabled: true },
    'aria-valid-attr': { enabled: true },
    'aria-valid-attr-value': { enabled: true },
    'button-name': { enabled: true },
    'duplicate-id': { enabled: true },
    'form-field-multiple-labels': { enabled: true },
    'frame-title': { enabled: true },
    'html-has-lang': { enabled: true },
    'image-alt': { enabled: true },
    'input-image-alt': { enabled: true },
    'label': { enabled: true },
    'link-name': { enabled: true },
    'list': { enabled: true },
    'listitem': { enabled: true },
    'meta-refresh': { enabled: true },
    'meta-viewport': { enabled: true },
    'region': { enabled: true },
    'scope-attr-valid': { enabled: true },
    'server-side-image-map': { enabled: true },
    'valid-lang': { enabled: true },
  },
})

// Mock screen reader announcements for testing
global.mockScreenReaderAnnouncements = []

// Mock aria-live regions
const mockAriaLive = {
  announce: (message: string, priority: 'polite' | 'assertive' = 'polite') => {
    global.mockScreenReaderAnnouncements.push({ message, priority, timestamp: Date.now() })
  },
  clear: () => {
    global.mockScreenReaderAnnouncements = []
  },
  getAnnouncements: () => global.mockScreenReaderAnnouncements,
}

global.mockAriaLive = mockAriaLive

// Mock focus management
let mockFocusedElement: Element | null = null

Object.defineProperty(document, 'activeElement', {
  get: () => mockFocusedElement,
  configurable: true,
})

const originalFocus = HTMLElement.prototype.focus
HTMLElement.prototype.focus = function(this: HTMLElement) {
  mockFocusedElement = this
  originalFocus.call(this)
}

const originalBlur = HTMLElement.prototype.blur
HTMLElement.prototype.blur = function(this: HTMLElement) {
  if (mockFocusedElement === this) {
    mockFocusedElement = null
  }
  originalBlur.call(this)
}

// Accessibility test utilities
export const expectFocusManagement = {
  toBeFocused: (element: Element) => {
    expect(document.activeElement).toBe(element)
  },
  toHaveFocusWithin: (container: Element) => {
    expect(container.contains(document.activeElement)).toBe(true)
  },
  toTrapFocus: (container: Element) => {
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    expect(focusableElements.length).toBeGreaterThan(0)
  },
}

export const expectScreenReaderSupport = {
  toHaveAnnounced: (message: string) => {
    const announcements = global.mockAriaLive.getAnnouncements()
    expect(announcements.some(a => a.message.includes(message))).toBe(true)
  },
  toHaveAriaLabel: (element: Element, expectedLabel?: string) => {
    const ariaLabel = element.getAttribute('aria-label')
    if (expectedLabel) {
      expect(ariaLabel).toBe(expectedLabel)
    } else {
      expect(ariaLabel).toBeTruthy()
    }
  },
  toHaveAriaDescribedBy: (element: Element) => {
    expect(element.getAttribute('aria-describedby')).toBeTruthy()
  },
}

// Keyboard navigation testing utilities
export const simulateKeyboardNavigation = {
  tab: (element: Element) => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }))
  },
  shiftTab: (element: Element) => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true }))
  },
  enter: (element: Element) => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
  },
  space: (element: Element) => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }))
  },
  escape: (element: Element) => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  },
  arrowDown: (element: Element) => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }))
  },
  arrowUp: (element: Element) => {
    element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }))
  },
}