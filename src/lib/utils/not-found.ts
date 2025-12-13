import { notFound } from 'next/navigation'
import { logError } from './error-handler'

/**
 * Utility to trigger Next.js not-found page with optional logging
 */
export function triggerNotFound(context?: string, additionalInfo?: Record<string, any>) {
  if (context) {
    logError(new Error(`Not found: ${context}`), additionalInfo)
  }
  
  notFound()
}

/**
 * Check if a resource exists and trigger not-found if it doesn't
 */
export function assertExists<T>(
  resource: T | null | undefined,
  context?: string,
  additionalInfo?: Record<string, any>
): asserts resource is T {
  if (resource === null || resource === undefined) {
    triggerNotFound(context, additionalInfo)
  }
}

/**
 * Wrapper for async operations that might result in not-found
 */
export async function withNotFoundHandling<T>(
  operation: () => Promise<T | null | undefined>,
  context?: string,
  additionalInfo?: Record<string, any>
): Promise<T> {
  try {
    const result = await operation()
    assertExists(result, context, additionalInfo)
    return result
  } catch (error) {
    logError(error, { context, ...additionalInfo })
    throw error
  }
}