export interface AppError extends Error {
  code?: string
  statusCode?: number
  context?: Record<string, any>
}

export class NotFoundError extends Error implements AppError {
  code = 'NOT_FOUND'
  statusCode = 404

  constructor(message = 'Resource not found', public context?: Record<string, any>) {
    super(message)
    this.name = 'NotFoundError'
  }
}

export class ValidationError extends Error implements AppError {
  code = 'VALIDATION_ERROR'
  statusCode = 400

  constructor(message = 'Validation failed', public context?: Record<string, any>) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class AuthenticationError extends Error implements AppError {
  code = 'AUTHENTICATION_ERROR'
  statusCode = 401

  constructor(message = 'Authentication required', public context?: Record<string, any>) {
    super(message)
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends Error implements AppError {
  code = 'AUTHORIZATION_ERROR'
  statusCode = 403

  constructor(message = 'Access denied', public context?: Record<string, any>) {
    super(message)
    this.name = 'AuthorizationError'
  }
}

export class NetworkError extends Error implements AppError {
  code = 'NETWORK_ERROR'
  statusCode = 500

  constructor(message = 'Network error occurred', public context?: Record<string, any>) {
    super(message)
    this.name = 'NetworkError'
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof Error && 'code' in error
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'An unknown error occurred'
}

export function getErrorCode(error: unknown): string | undefined {
  if (isAppError(error)) {
    return error.code
  }
  return undefined
}

export function logError(error: unknown, context?: Record<string, any>) {
  const errorMessage = getErrorMessage(error)
  const errorCode = getErrorCode(error)
  
  console.error('Error occurred:', {
    message: errorMessage,
    code: errorCode,
    context,
    stack: error instanceof Error ? error.stack : undefined,
    timestamp: new Date().toISOString(),
  })

  // In production, you might want to send this to an error tracking service
  // like Sentry, LogRocket, or Bugsnag
}

export function handleApiError(error: unknown): Response {
  const message = getErrorMessage(error)
  const statusCode = isAppError(error) ? error.statusCode || 500 : 500
  
  logError(error)
  
  return new Response(
    JSON.stringify({
      error: message,
      code: getErrorCode(error),
      timestamp: new Date().toISOString(),
    }),
    {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  )
}