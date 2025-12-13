'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { useAsyncError } from '@/lib/hooks/useAsyncError'
import { useErrorHandler } from '@/lib/hooks/useErrorHandler'
import { 
  NotFoundError, 
  ValidationError, 
  AuthenticationError, 
  NetworkError 
} from '@/lib/utils/error-handler'

// Component that might throw errors
function ErrorProneComponent() {
  const [shouldError, setShouldError] = useState(false)
  
  if (shouldError) {
    throw new Error('This is a test error from ErrorProneComponent')
  }
  
  return (
    <div className="p-4 bg-green-50 rounded-lg">
      <p className="text-green-800">This component is working fine!</p>
      <Button 
        onClick={() => setShouldError(true)}
        variant="danger"
        size="sm"
        className="mt-2"
      >
        Trigger Error
      </Button>
    </div>
  )
}

export function ErrorHandlingExample() {
  const { error, isLoading, execute, clearError } = useAsyncError()
  const { handleError, handleSuccess } = useErrorHandler()

  const simulateAsyncError = async (errorType: string) => {
    await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate delay
    
    switch (errorType) {
      case 'not-found':
        throw new NotFoundError('The requested resource was not found')
      case 'validation':
        throw new ValidationError('Invalid input provided')
      case 'auth':
        throw new AuthenticationError('Please log in to continue')
      case 'network':
        throw new NetworkError('Failed to connect to server')
      default:
        throw new Error('Unknown error occurred')
    }
  }

  const simulateSuccess = async () => {
    await new Promise(resolve => setTimeout(resolve, 1000))
    return 'Operation completed successfully!'
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Error Handling Examples</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          
          {/* Error Boundary Example */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Error Boundary</h3>
            <ErrorBoundary>
              <ErrorProneComponent />
            </ErrorBoundary>
          </div>

          {/* Async Error Handling */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Async Error Handling</h3>
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => execute(() => simulateAsyncError('not-found'))}
                  disabled={isLoading}
                  variant="outline"
                  size="sm"
                >
                  Not Found Error
                </Button>
                <Button
                  onClick={() => execute(() => simulateAsyncError('validation'))}
                  disabled={isLoading}
                  variant="outline"
                  size="sm"
                >
                  Validation Error
                </Button>
                <Button
                  onClick={() => execute(() => simulateAsyncError('auth'))}
                  disabled={isLoading}
                  variant="outline"
                  size="sm"
                >
                  Auth Error
                </Button>
                <Button
                  onClick={() => execute(() => simulateAsyncError('network'))}
                  disabled={isLoading}
                  variant="outline"
                  size="sm"
                >
                  Network Error
                </Button>
                <Button
                  onClick={() => execute(
                    simulateSuccess,
                    (result) => handleSuccess(result)
                  )}
                  disabled={isLoading}
                  variant="primary"
                  size="sm"
                >
                  Success
                </Button>
              </div>
              
              {isLoading && (
                <div className="flex items-center gap-2 text-blue-600">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  Loading...
                </div>
              )}
              
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-800 font-medium">Error: {error.message}</p>
                  <Button
                    onClick={clearError}
                    variant="outline"
                    size="sm"
                    className="mt-2"
                  >
                    Clear Error
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Toast Notifications */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Toast Notifications</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => handleError(new Error('This is a test error'))}
                variant="danger"
                size="sm"
              >
                Show Error Toast
              </Button>
              <Button
                onClick={() => handleSuccess('Operation completed!')}
                variant="primary"
                size="sm"
              >
                Show Success Toast
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}