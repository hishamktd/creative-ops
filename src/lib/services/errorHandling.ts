/**
 * Comprehensive Error Handling and Recovery System
 * Provides robust error handling, retry mechanisms, and user-friendly error messages
 */

export enum ErrorType {
  NETWORK = 'network',
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  STORAGE = 'storage',
  PROCESSING = 'processing',
  QUOTA = 'quota',
  SECURITY = 'security',
  SYSTEM = 'system',
  UNKNOWN = 'unknown'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorContext {
  operation: string
  userId?: string
  projectId?: string
  assetId?: string
  fileName?: string
  fileSize?: number
  timestamp: string
  userAgent?: string
  sessionId?: string
  additionalData?: Record<string, any>
}

export interface RecoveryAction {
  type: 'retry' | 'fallback' | 'manual' | 'contact_support'
  label: string
  description: string
  action?: () => Promise<void> | void
  autoExecute?: boolean
  priority: number
}

export interface AppError {
  id: string
  type: ErrorType
  severity: ErrorSeverity
  code: string
  message: string
  userMessage: string
  technicalDetails?: string
  context: ErrorContext
  recoveryActions: RecoveryAction[]
  retryable: boolean
  timestamp: string
  stack?: string
}

export interface RetryConfig {
  maxAttempts: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
  retryableErrors: ErrorType[]
  jitter: boolean
}

export interface ErrorHandlingConfig {
  enableLogging: boolean
  enableMonitoring: boolean
  enableUserNotifications: boolean
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  retryConfig: RetryConfig
}

export class ErrorHandlingService {
  private static readonly DEFAULT_CONFIG: ErrorHandlingConfig = {
    enableLogging: true,
    enableMonitoring: true,
    enableUserNotifications: true,
    logLevel: 'error',
    retryConfig: {
      maxAttempts: 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      retryableErrors: [ErrorType.NETWORK, ErrorType.STORAGE, ErrorType.PROCESSING],
      jitter: true
    }
  }

  private static config: ErrorHandlingConfig = this.DEFAULT_CONFIG
  private static errorLog: AppError[] = []

  /**
   * Configure error handling behavior
   */
  static configure(config: Partial<ErrorHandlingConfig>): void {
    this.config = { ...this.DEFAULT_CONFIG, ...config }
  }

  /**
   * Create a standardized error object
   */
  static createError(
    type: ErrorType,
    code: string,
    message: string,
    context: Partial<ErrorContext>,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    technicalDetails?: string
  ): AppError {
    const errorId = this.generateErrorId()
    const timestamp = new Date().toISOString()

    const error: AppError = {
      id: errorId,
      type,
      severity,
      code,
      message,
      userMessage: this.generateUserMessage(type, code, message),
      technicalDetails,
      context: {
        timestamp,
        ...context
      } as ErrorContext,
      recoveryActions: this.generateRecoveryActions(type, code, context),
      retryable: this.isRetryable(type),
      timestamp
    }

    // Log the error
    this.logError(error)

    return error
  }

  /**
   * Handle errors with automatic retry and recovery
   */
  static async handleError<T>(
    operation: () => Promise<T>,
    context: Partial<ErrorContext>,
    customRetryConfig?: Partial<RetryConfig>
  ): Promise<{ success: boolean; data?: T; error?: AppError }> {
    const retryConfig = { ...this.config.retryConfig, ...customRetryConfig }
    let lastError: AppError | null = null

    for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
      try {
        const result = await operation()
        return { success: true, data: result }
      } catch (error) {
        const appError = this.normalizeError(error, context)
        lastError = appError

        // Log attempt
        this.logError(appError, `Attempt ${attempt}/${retryConfig.maxAttempts}`)

        // Check if error is retryable and we have attempts left
        if (
          attempt < retryConfig.maxAttempts &&
          retryConfig.retryableErrors.includes(appError.type)
        ) {
          const delay = this.calculateRetryDelay(attempt, retryConfig)
          await this.sleep(delay)
          continue
        }

        // No more retries or error is not retryable
        break
      }
    }

    return { success: false, error: lastError! }
  }

  /**
   * Execute operation with partial upload recovery
   */
  static async handleUploadWithRecovery<T>(
    uploadOperation: (resumeFrom?: number) => Promise<T>,
    context: Partial<ErrorContext> & { fileSize?: number },
    onProgress?: (progress: number) => void
  ): Promise<{ success: boolean; data?: T; error?: AppError }> {
    let resumeFrom = 0
    const maxRecoveryAttempts = 3

    for (let attempt = 1; attempt <= maxRecoveryAttempts; attempt++) {
      try {
        const result = await uploadOperation(resumeFrom)
        return { success: true, data: result }
      } catch (error) {
        const appError = this.normalizeError(error, context)

        // Check if this is a recoverable upload error
        if (
          appError.type === ErrorType.NETWORK &&
          context.fileSize &&
          resumeFrom < context.fileSize &&
          attempt < maxRecoveryAttempts
        ) {
          // Try to determine how much was uploaded
          resumeFrom = await this.getUploadProgress(context.assetId || '')
          
          if (resumeFrom > 0) {
            onProgress?.(Math.round((resumeFrom / context.fileSize) * 100))
            
            // Wait before retry
            await this.sleep(2000 * attempt)
            continue
          }
        }

        return { success: false, error: appError }
      }
    }

    return {
      success: false,
      error: this.createError(
        ErrorType.STORAGE,
        'UPLOAD_RECOVERY_FAILED',
        'Upload could not be recovered after multiple attempts',
        context,
        ErrorSeverity.HIGH
      )
    }
  }

  /**
   * Normalize any error into AppError format
   */
  private static normalizeError(error: any, context: Partial<ErrorContext>): AppError {
    // Check if error is already an AppError by checking its properties
    if (error && typeof error === 'object' && 'id' in error && 'type' in error && 'code' in error) {
      return error as AppError
    }

    // Handle different error types
    if (error instanceof TypeError || error instanceof ReferenceError) {
      return this.createError(
        ErrorType.SYSTEM,
        'JAVASCRIPT_ERROR',
        error.message,
        context,
        ErrorSeverity.HIGH,
        error.stack
      )
    }

    if (error?.name === 'NetworkError' || error?.code === 'NETWORK_ERROR') {
      return this.createError(
        ErrorType.NETWORK,
        'NETWORK_ERROR',
        'Network connection failed',
        context,
        ErrorSeverity.MEDIUM
      )
    }

    if (error?.status === 401 || error?.code === 'UNAUTHORIZED') {
      return this.createError(
        ErrorType.AUTHENTICATION,
        'UNAUTHORIZED',
        'Authentication required',
        context,
        ErrorSeverity.HIGH
      )
    }

    if (error?.status === 403 || error?.code === 'FORBIDDEN') {
      return this.createError(
        ErrorType.AUTHORIZATION,
        'FORBIDDEN',
        'Access denied',
        context,
        ErrorSeverity.HIGH
      )
    }

    if (error?.status === 413 || error?.message?.includes('file size')) {
      return this.createError(
        ErrorType.QUOTA,
        'FILE_TOO_LARGE',
        'File size exceeds limit',
        context,
        ErrorSeverity.MEDIUM
      )
    }

    // Default unknown error
    return this.createError(
      ErrorType.UNKNOWN,
      'UNKNOWN_ERROR',
      error?.message || 'An unexpected error occurred',
      context,
      ErrorSeverity.MEDIUM,
      error?.stack
    )
  }

  /**
   * Generate user-friendly error messages
   */
  private static generateUserMessage(type: ErrorType, code: string, message: string): string {
    const userMessages: Record<string, Record<string, string>> = {
      [ErrorType.NETWORK]: {
        'NETWORK_ERROR': 'Connection lost. Please check your internet connection and try again.',
        'TIMEOUT': 'The request took too long. Please try again.',
        'CONNECTION_REFUSED': 'Unable to connect to the server. Please try again later.'
      },
      [ErrorType.VALIDATION]: {
        'FILE_TOO_LARGE': 'The file you selected is too large. Please choose a smaller file.',
        'INVALID_FILE_TYPE': 'This file type is not supported. Please choose a different file.',
        'INVALID_FILE_NAME': 'The file name contains invalid characters. Please rename the file.'
      },
      [ErrorType.AUTHENTICATION]: {
        'UNAUTHORIZED': 'You need to sign in to continue.',
        'SESSION_EXPIRED': 'Your session has expired. Please sign in again.'
      },
      [ErrorType.AUTHORIZATION]: {
        'FORBIDDEN': 'You don\'t have permission to perform this action.',
        'PROJECT_ACCESS_DENIED': 'You don\'t have access to this project.'
      },
      [ErrorType.STORAGE]: {
        'UPLOAD_FAILED': 'File upload failed. Please try again.',
        'STORAGE_FULL': 'Storage space is full. Please free up space or contact your administrator.',
        'FILE_NOT_FOUND': 'The file could not be found.'
      },
      [ErrorType.PROCESSING]: {
        'THUMBNAIL_GENERATION_FAILED': 'Preview generation failed, but your file was uploaded successfully.',
        'METADATA_EXTRACTION_FAILED': 'File information could not be extracted, but your file was uploaded successfully.'
      },
      [ErrorType.QUOTA]: {
        'QUOTA_EXCEEDED': 'You\'ve reached your storage limit. Please delete some files or upgrade your plan.',
        'FILE_TOO_LARGE': 'This file is too large for your current plan. Please choose a smaller file or upgrade.'
      },
      [ErrorType.SECURITY]: {
        'VIRUS_DETECTED': 'This file contains malicious content and cannot be uploaded.',
        'SECURITY_SCAN_FAILED': 'Security scan failed. Please try uploading again.'
      }
    }

    return userMessages[type]?.[code] || message || 'Something went wrong. Please try again.'
  }

  /**
   * Generate recovery actions based on error type
   */
  private static generateRecoveryActions(
    type: ErrorType,
    code: string,
    context: Partial<ErrorContext>
  ): RecoveryAction[] {
    const actions: RecoveryAction[] = []

    switch (type) {
      case ErrorType.NETWORK:
        actions.push({
          type: 'retry',
          label: 'Try Again',
          description: 'Retry the operation',
          priority: 1,
          autoExecute: false
        })
        actions.push({
          type: 'manual',
          label: 'Check Connection',
          description: 'Check your internet connection and try again',
          priority: 2
        })
        break

      case ErrorType.VALIDATION:
        if (code === 'FILE_TOO_LARGE') {
          actions.push({
            type: 'manual',
            label: 'Choose Smaller File',
            description: 'Select a file that\'s smaller than the size limit',
            priority: 1
          })
        } else if (code === 'INVALID_FILE_TYPE') {
          actions.push({
            type: 'manual',
            label: 'Convert File',
            description: 'Convert your file to a supported format',
            priority: 1
          })
        }
        break

      case ErrorType.AUTHENTICATION:
        actions.push({
          type: 'manual',
          label: 'Sign In',
          description: 'Sign in to your account',
          priority: 1
        })
        break

      case ErrorType.STORAGE:
        actions.push({
          type: 'retry',
          label: 'Try Again',
          description: 'Retry the upload',
          priority: 1
        })
        if (code === 'STORAGE_FULL') {
          actions.push({
            type: 'manual',
            label: 'Free Up Space',
            description: 'Delete some files to make room',
            priority: 2
          })
        }
        break

      case ErrorType.QUOTA:
        actions.push({
          type: 'manual',
          label: 'Upgrade Plan',
          description: 'Upgrade to a plan with more storage',
          priority: 1
        })
        actions.push({
          type: 'manual',
          label: 'Delete Files',
          description: 'Delete some files to free up space',
          priority: 2
        })
        break

      case ErrorType.SECURITY:
        actions.push({
          type: 'manual',
          label: 'Scan File',
          description: 'Scan your file with antivirus software',
          priority: 1
        })
        actions.push({
          type: 'contact_support',
          label: 'Contact Support',
          description: 'Contact support if you believe this is an error',
          priority: 2
        })
        break

      default:
        actions.push({
          type: 'retry',
          label: 'Try Again',
          description: 'Retry the operation',
          priority: 1
        })
        actions.push({
          type: 'contact_support',
          label: 'Contact Support',
          description: 'Contact support if the problem persists',
          priority: 2
        })
    }

    return actions.sort((a, b) => a.priority - b.priority)
  }

  /**
   * Check if error type is retryable
   */
  private static isRetryable(type: ErrorType): boolean {
    return this.config.retryConfig.retryableErrors.includes(type)
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private static calculateRetryDelay(attempt: number, config: RetryConfig): number {
    const exponentialDelay = Math.min(
      config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1),
      config.maxDelay
    )

    if (config.jitter) {
      // Add random jitter (±25%)
      const jitterRange = exponentialDelay * 0.25
      const jitter = (Math.random() - 0.5) * 2 * jitterRange
      return Math.max(0, exponentialDelay + jitter)
    }

    return exponentialDelay
  }

  /**
   * Sleep for specified milliseconds
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get upload progress for recovery
   */
  private static async getUploadProgress(assetId: string): Promise<number> {
    try {
      // This would typically query the server for upload progress
      // For now, return 0 (start from beginning)
      return 0
    } catch {
      return 0
    }
  }

  /**
   * Generate unique error ID
   */
  private static generateErrorId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  }

  /**
   * Log error to console and storage
   */
  private static logError(error: AppError, additionalInfo?: string): void {
    if (!this.config.enableLogging) return

    const logMessage = `[${error.severity.toUpperCase()}] ${error.type}:${error.code} - ${error.message}`
    const logData = {
      ...error,
      additionalInfo
    }

    // Console logging based on severity
    switch (error.severity) {
      case ErrorSeverity.LOW:
        if (this.config.logLevel === 'debug') console.debug(logMessage, logData)
        break
      case ErrorSeverity.MEDIUM:
        if (['debug', 'info', 'warn'].includes(this.config.logLevel)) {
          console.warn(logMessage, logData)
        }
        break
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        console.error(logMessage, logData)
        break
    }

    // Store in memory (in production, this would go to a proper logging service)
    this.errorLog.push(error)

    // Keep only last 1000 errors in memory
    if (this.errorLog.length > 1000) {
      this.errorLog = this.errorLog.slice(-1000)
    }

    // Send to monitoring service if enabled
    if (this.config.enableMonitoring) {
      this.sendToMonitoring(error)
    }
  }

  /**
   * Send error to monitoring service
   */
  private static async sendToMonitoring(error: AppError): Promise<void> {
    try {
      // In production, this would send to a service like Sentry, DataDog, etc.
      // For now, we'll just log it
      if (error.severity === ErrorSeverity.HIGH || error.severity === ErrorSeverity.CRITICAL) {
        console.warn('High severity error detected:', error)
      }
    } catch (monitoringError) {
      console.warn('Failed to send error to monitoring:', monitoringError)
    }
  }

  /**
   * Get error statistics
   */
  static getErrorStats(): {
    total: number
    byType: Record<ErrorType, number>
    bySeverity: Record<ErrorSeverity, number>
    recent: AppError[]
  } {
    const byType = {} as Record<ErrorType, number>
    const bySeverity = {} as Record<ErrorSeverity, number>

    for (const error of this.errorLog) {
      byType[error.type] = (byType[error.type] || 0) + 1
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1
    }

    return {
      total: this.errorLog.length,
      byType,
      bySeverity,
      recent: this.errorLog.slice(-10)
    }
  }

  /**
   * Clear error log
   */
  static clearErrorLog(): void {
    this.errorLog = []
  }

  /**
   * Get errors by criteria
   */
  static getErrors(criteria?: {
    type?: ErrorType
    severity?: ErrorSeverity
    since?: Date
    limit?: number
  }): AppError[] {
    let filtered = this.errorLog

    if (criteria?.type) {
      filtered = filtered.filter(error => error.type === criteria.type)
    }

    if (criteria?.severity) {
      filtered = filtered.filter(error => error.severity === criteria.severity)
    }

    if (criteria?.since) {
      filtered = filtered.filter(error => new Date(error.timestamp) >= criteria.since!)
    }

    if (criteria?.limit) {
      filtered = filtered.slice(-criteria.limit)
    }

    return filtered
  }
}