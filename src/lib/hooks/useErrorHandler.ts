import { useCallback } from 'react'
import { useToast } from '@/components/ui/Toast'
import { 
  getErrorMessage, 
  getErrorCode, 
  logError,
  NotFoundError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NetworkError
} from '@/lib/utils/error-handler'

export function useErrorHandler() {
  const { addToast } = useToast()

  const handleError = useCallback((error: unknown, context?: Record<string, any>) => {
    const message = getErrorMessage(error)
    const code = getErrorCode(error)
    
    logError(error, context)

    // Show appropriate toast based on error type
    if (error instanceof NotFoundError) {
      addToast({
        type: 'warning',
        title: 'Not Found',
        message: message,
      })
    } else if (error instanceof ValidationError) {
      addToast({
        type: 'warning',
        title: 'Validation Error',
        message: message,
      })
    } else if (error instanceof AuthenticationError) {
      addToast({
        type: 'error',
        title: 'Authentication Required',
        message: 'Please log in to continue',
      })
    } else if (error instanceof AuthorizationError) {
      addToast({
        type: 'error',
        title: 'Access Denied',
        message: message,
      })
    } else if (error instanceof NetworkError) {
      addToast({
        type: 'error',
        title: 'Network Error',
        message: 'Please check your connection and try again',
      })
    } else {
      addToast({
        type: 'error',
        title: 'Something went wrong',
        message: process.env.NODE_ENV === 'development' ? message : 'An unexpected error occurred',
      })
    }
  }, [addToast])

  const handleSuccess = useCallback((message: string, title = 'Success') => {
    addToast({
      type: 'success',
      title,
      message,
    })
  }, [addToast])

  const handleWarning = useCallback((message: string, title = 'Warning') => {
    addToast({
      type: 'warning',
      title,
      message,
    })
  }, [addToast])

  const handleInfo = useCallback((message: string, title = 'Info') => {
    addToast({
      type: 'info',
      title,
      message,
    })
  }, [addToast])

  return {
    handleError,
    handleSuccess,
    handleWarning,
    handleInfo,
  }
}