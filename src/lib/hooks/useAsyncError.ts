import { useCallback, useState } from 'react'
import { logError } from '@/lib/utils/error-handler'

export function useAsyncError() {
  const [error, setError] = useState<Error | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const execute = useCallback(async <T>(
    asyncFunction: () => Promise<T>,
    onSuccess?: (result: T) => void,
    onError?: (error: Error) => void
  ): Promise<T | null> => {
    try {
      setIsLoading(true)
      setError(null)
      
      const result = await asyncFunction()
      onSuccess?.(result)
      return result
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Unknown error')
      setError(error)
      logError(error)
      onError?.(error)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const retry = useCallback(async <T>(
    asyncFunction: () => Promise<T>,
    onSuccess?: (result: T) => void,
    onError?: (error: Error) => void
  ) => {
    return execute(asyncFunction, onSuccess, onError)
  }, [execute])

  return {
    error,
    isLoading,
    execute,
    clearError,
    retry,
  }
}