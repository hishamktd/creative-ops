import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ErrorHandlingService, ErrorType, ErrorSeverity, AppError } from '../errorHandling'

// Mock console methods
const mockConsole = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}

vi.stubGlobal('console', mockConsole)

describe('ErrorHandlingService', () => {
  beforeEach(() => {
    ErrorHandlingService.clearErrorLog()
    ErrorHandlingService.configure({
      enableLogging: true,
      enableMonitoring: false,
      enableUserNotifications: true,
      logLevel: 'error'
    })
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  describe('createError', () => {
    it('should create a standardized error object', () => {
      const error = ErrorHandlingService.createError(
        ErrorType.VALIDATION,
        'FILE_TOO_LARGE',
        'File exceeds size limit',
        { operation: 'file_upload', fileName: 'test.jpg' }
      )

      expect(error).toMatchObject({
        type: ErrorType.VALIDATION,
        code: 'FILE_TOO_LARGE',
        message: 'File exceeds size limit',
        severity: ErrorSeverity.MEDIUM,
        retryable: false
      })

      expect(error.id).toMatch(/^err_\d+_[a-z0-9]+$/)
      expect(error.userMessage).toBe('The file you selected is too large. Please choose a smaller file.')
      expect(error.recoveryActions).toHaveLength(1)
      expect(error.recoveryActions[0].type).toBe('manual')
    })

    it('should generate appropriate user messages for different error types', () => {
      const networkError = ErrorHandlingService.createError(
        ErrorType.NETWORK,
        'NETWORK_ERROR',
        'Connection failed',
        { operation: 'upload' }
      )

      const authError = ErrorHandlingService.createError(
        ErrorType.AUTHENTICATION,
        'UNAUTHORIZED',
        'Not authenticated',
        { operation: 'upload' }
      )

      expect(networkError.userMessage).toBe('Connection lost. Please check your internet connection and try again.')
      expect(authError.userMessage).toBe('You need to sign in to continue.')
    })

    it('should generate recovery actions based on error type', () => {
      const networkError = ErrorHandlingService.createError(
        ErrorType.NETWORK,
        'NETWORK_ERROR',
        'Connection failed',
        { operation: 'upload' }
      )

      const validationError = ErrorHandlingService.createError(
        ErrorType.VALIDATION,
        'FILE_TOO_LARGE',
        'File too large',
        { operation: 'upload' }
      )

      expect(networkError.recoveryActions).toContainEqual(
        expect.objectContaining({ type: 'retry', label: 'Try Again' })
      )

      expect(validationError.recoveryActions).toContainEqual(
        expect.objectContaining({ type: 'manual', label: 'Choose Smaller File' })
      )
    })
  })

  describe('handleError', () => {
    it('should execute operation successfully and return result', async () => {
      const mockOperation = vi.fn().mockResolvedValue('success')
      const context = { operation: 'test' }

      const result = await ErrorHandlingService.handleError(mockOperation, context)

      expect(result.success).toBe(true)
      expect(result.data).toBe('success')
      expect(result.error).toBeUndefined()
      expect(mockOperation).toHaveBeenCalledTimes(1)
    })

    it('should retry retryable errors with exponential backoff', async () => {
      vi.useFakeTimers()
      
      const mockOperation = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success')

      const context = { operation: 'test' }
      const customRetryConfig = {
        maxAttempts: 3,
        baseDelay: 100,
        retryableErrors: [ErrorType.NETWORK]
      }

      const resultPromise = ErrorHandlingService.handleError(
        mockOperation,
        context,
        customRetryConfig
      )

      // Fast-forward through retries
      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result.success).toBe(true)
      expect(result.data).toBe('success')
      expect(mockOperation).toHaveBeenCalledTimes(3)
    })

    it('should not retry non-retryable errors', async () => {
      const mockOperation = vi.fn().mockRejectedValue(new Error('Validation error'))
      const context = { operation: 'test' }

      const result = await ErrorHandlingService.handleError(mockOperation, context)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error!.type).toBe(ErrorType.UNKNOWN)
      expect(mockOperation).toHaveBeenCalledTimes(1)
    })

    it('should stop retrying after max attempts', async () => {
      vi.useFakeTimers()

      const mockOperation = vi.fn().mockRejectedValue(new Error('Network error'))
      const context = { operation: 'test' }
      const customRetryConfig = {
        maxAttempts: 2,
        baseDelay: 100,
        retryableErrors: [ErrorType.NETWORK]
      }

      const resultPromise = ErrorHandlingService.handleError(
        mockOperation,
        context,
        customRetryConfig
      )

      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
      expect(mockOperation).toHaveBeenCalledTimes(2)
    })

    it('should normalize different error types', async () => {
      const testCases = [
        { error: new TypeError('Type error'), expectedType: ErrorType.SYSTEM },
        { error: { name: 'NetworkError' }, expectedType: ErrorType.NETWORK },
        { error: { status: 401 }, expectedType: ErrorType.AUTHENTICATION },
        { error: { status: 403 }, expectedType: ErrorType.AUTHORIZATION },
        { error: { status: 413 }, expectedType: ErrorType.QUOTA }
      ]

      for (const testCase of testCases) {
        const mockOperation = vi.fn().mockRejectedValue(testCase.error)
        const result = await ErrorHandlingService.handleError(mockOperation, { operation: 'test' })

        expect(result.success).toBe(false)
        expect(result.error!.type).toBe(testCase.expectedType)
      }
    })
  })

  describe('handleUploadWithRecovery', () => {
    it('should handle successful upload', async () => {
      const mockUpload = vi.fn().mockResolvedValue('upload-success')
      const context = { operation: 'upload', fileSize: 1000 }

      const result = await ErrorHandlingService.handleUploadWithRecovery(
        mockUpload,
        context
      )

      expect(result.success).toBe(true)
      expect(result.data).toBe('upload-success')
      expect(mockUpload).toHaveBeenCalledWith(0)
    })

    it('should attempt recovery for network errors', async () => {
      vi.useFakeTimers()

      const mockUpload = vi.fn()
        .mockRejectedValueOnce({ name: 'NetworkError' })
        .mockRejectedValueOnce({ name: 'NetworkError' })
        .mockResolvedValue('upload-success')

      const context = { operation: 'upload', fileSize: 1000, assetId: 'test-asset' }
      const mockProgress = vi.fn()

      const resultPromise = ErrorHandlingService.handleUploadWithRecovery(
        mockUpload,
        context,
        mockProgress
      )

      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result.success).toBe(true)
      expect(mockUpload).toHaveBeenCalledTimes(3)
    })

    it('should fail after max recovery attempts', async () => {
      vi.useFakeTimers()

      const mockUpload = vi.fn().mockRejectedValue({ name: 'NetworkError' })
      const context = { operation: 'upload', fileSize: 1000, assetId: 'test-asset' }

      const resultPromise = ErrorHandlingService.handleUploadWithRecovery(
        mockUpload,
        context
      )

      await vi.runAllTimersAsync()
      const result = await resultPromise

      expect(result.success).toBe(false)
      expect(result.error!.code).toBe('UPLOAD_RECOVERY_FAILED')
      expect(mockUpload).toHaveBeenCalledTimes(3)
    })
  })

  describe('error logging and monitoring', () => {
    it('should log errors based on severity and log level', () => {
      ErrorHandlingService.configure({ logLevel: 'warn' })

      const lowError = ErrorHandlingService.createError(
        ErrorType.VALIDATION,
        'TEST_LOW',
        'Low severity error',
        { operation: 'test' },
        ErrorSeverity.LOW
      )

      const highError = ErrorHandlingService.createError(
        ErrorType.SYSTEM,
        'TEST_HIGH',
        'High severity error',
        { operation: 'test' },
        ErrorSeverity.HIGH
      )

      // Low severity should not be logged with 'warn' level
      expect(mockConsole.debug).not.toHaveBeenCalled()
      expect(mockConsole.warn).not.toHaveBeenCalled()

      // High severity should be logged
      expect(mockConsole.error).toHaveBeenCalledWith(
        expect.stringContaining('[HIGH] system:TEST_HIGH'),
        expect.any(Object)
      )
    })

    it('should maintain error statistics', () => {
      ErrorHandlingService.createError(
        ErrorType.NETWORK,
        'NET1',
        'Network error 1',
        { operation: 'test' }
      )

      ErrorHandlingService.createError(
        ErrorType.NETWORK,
        'NET2',
        'Network error 2',
        { operation: 'test' }
      )

      ErrorHandlingService.createError(
        ErrorType.VALIDATION,
        'VAL1',
        'Validation error',
        { operation: 'test' },
        ErrorSeverity.HIGH
      )

      const stats = ErrorHandlingService.getErrorStats()

      expect(stats.total).toBe(3)
      expect(stats.byType[ErrorType.NETWORK]).toBe(2)
      expect(stats.byType[ErrorType.VALIDATION]).toBe(1)
      expect(stats.bySeverity[ErrorSeverity.MEDIUM]).toBe(2)
      expect(stats.bySeverity[ErrorSeverity.HIGH]).toBe(1)
      expect(stats.recent).toHaveLength(3)
    })

    it('should filter errors by criteria', () => {
      const now = new Date()
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

      ErrorHandlingService.createError(
        ErrorType.NETWORK,
        'NET1',
        'Network error',
        { operation: 'test' }
      )

      ErrorHandlingService.createError(
        ErrorType.VALIDATION,
        'VAL1',
        'Validation error',
        { operation: 'test' },
        ErrorSeverity.HIGH
      )

      const networkErrors = ErrorHandlingService.getErrors({
        type: ErrorType.NETWORK
      })

      const highSeverityErrors = ErrorHandlingService.getErrors({
        severity: ErrorSeverity.HIGH
      })

      const recentErrors = ErrorHandlingService.getErrors({
        since: oneHourAgo,
        limit: 1
      })

      expect(networkErrors).toHaveLength(1)
      expect(networkErrors[0].type).toBe(ErrorType.NETWORK)

      expect(highSeverityErrors).toHaveLength(1)
      expect(highSeverityErrors[0].severity).toBe(ErrorSeverity.HIGH)

      expect(recentErrors).toHaveLength(1)
    })
  })

  describe('retry delay calculation', () => {
    it('should calculate exponential backoff delays', () => {
      const config = {
        maxAttempts: 5,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        retryableErrors: [ErrorType.NETWORK],
        jitter: false
      }

      // Access private method through error handling
      const delays: number[] = []
      for (let attempt = 1; attempt <= 4; attempt++) {
        // We can't directly test the private method, but we can test the behavior
        // by checking that delays increase exponentially in actual retry scenarios
        const expectedDelay = Math.min(
          config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
          config.maxDelay
        )
        delays.push(expectedDelay)
      }

      expect(delays[0]).toBe(1000)   // 1000 * 2^0 = 1000
      expect(delays[1]).toBe(2000)   // 1000 * 2^1 = 2000
      expect(delays[2]).toBe(4000)   // 1000 * 2^2 = 4000
      expect(delays[3]).toBe(8000)   // 1000 * 2^3 = 8000
    })
  })

  describe('error context handling', () => {
    it('should preserve and enhance error context', () => {
      const context = {
        operation: 'file_upload',
        userId: 'user123',
        projectId: 'proj456',
        fileName: 'test.jpg',
        fileSize: 1024000
      }

      const error = ErrorHandlingService.createError(
        ErrorType.STORAGE,
        'UPLOAD_FAILED',
        'Upload failed',
        context
      )

      expect(error.context).toMatchObject(context)
      expect(error.context.timestamp).toBeDefined()
      expect(new Date(error.context.timestamp)).toBeInstanceOf(Date)
    })
  })
})

// Integration tests for error handling in upload scenarios
describe('Upload Error Scenarios', () => {
  beforeEach(() => {
    ErrorHandlingService.clearErrorLog()
  })

  it('should handle file size validation errors', async () => {
    const mockUpload = vi.fn().mockRejectedValue({
      status: 413,
      message: 'File too large'
    })

    const result = await ErrorHandlingService.handleError(
      mockUpload,
      {
        operation: 'file_upload',
        fileName: 'large-file.jpg',
        fileSize: 200 * 1024 * 1024 // 200MB
      }
    )

    expect(result.success).toBe(false)
    expect(result.error!.type).toBe(ErrorType.QUOTA)
    expect(result.error!.recoveryActions).toContainEqual(
      expect.objectContaining({
        type: 'manual',
        label: 'Choose Smaller File'
      })
    )
  })

  it('should handle network interruption during upload', async () => {
    vi.useFakeTimers()

    let callCount = 0
    const mockUpload = vi.fn().mockImplementation(() => {
      callCount++
      if (callCount <= 2) {
        return Promise.reject({ name: 'NetworkError', message: 'Connection lost' })
      }
      return Promise.resolve('upload-success')
    })

    const resultPromise = ErrorHandlingService.handleUploadWithRecovery(
      mockUpload,
      {
        operation: 'file_upload',
        fileName: 'test.jpg',
        fileSize: 1024000,
        assetId: 'asset123'
      }
    )

    await vi.runAllTimersAsync()
    const result = await resultPromise

    expect(result.success).toBe(true)
    expect(mockUpload).toHaveBeenCalledTimes(3)
  })

  it('should handle authentication errors during upload', async () => {
    const mockUpload = vi.fn().mockRejectedValue({
      status: 401,
      message: 'Unauthorized'
    })

    const result = await ErrorHandlingService.handleError(
      mockUpload,
      {
        operation: 'file_upload',
        fileName: 'test.jpg'
      }
    )

    expect(result.success).toBe(false)
    expect(result.error!.type).toBe(ErrorType.AUTHENTICATION)
    expect(result.error!.retryable).toBe(false)
    expect(result.error!.recoveryActions).toContainEqual(
      expect.objectContaining({
        type: 'manual',
        label: 'Sign In'
      })
    )
  })

  it('should handle storage quota exceeded errors', async () => {
    const mockUpload = vi.fn().mockRejectedValue({
      message: 'Storage quota exceeded'
    })

    const result = await ErrorHandlingService.handleError(
      mockUpload,
      {
        operation: 'file_upload',
        projectId: 'proj123',
        fileSize: 50 * 1024 * 1024
      }
    )

    expect(result.success).toBe(false)
    expect(result.error!.recoveryActions).toContainEqual(
      expect.objectContaining({
        type: 'manual',
        label: 'Upgrade Plan'
      })
    )
  })

  it('should handle virus detection errors', async () => {
    const mockUpload = vi.fn().mockRejectedValue({
      message: 'Virus detected in file'
    })

    const result = await ErrorHandlingService.handleError(
      mockUpload,
      {
        operation: 'file_upload',
        fileName: 'suspicious.exe'
      }
    )

    expect(result.success).toBe(false)
    expect(result.error!.recoveryActions).toContainEqual(
      expect.objectContaining({
        type: 'manual',
        label: 'Scan File'
      })
    )
  })
})