/**
 * Error Handling Utilities
 * Provides error classes, handlers, and utilities for consistent error management
 */

import config from '@/config/environment'

/**
 * Custom error class for API errors
 */
export class ApiError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode?: number,
    public details?: unknown
  ) {
    super(message)
    this.name = 'ApiError'
    Object.setPrototypeOf(this, ApiError.prototype)
  }

  isRetryable(): boolean {
    // Retryable errors: network issues, timeouts, server errors (5xx)
    return (
      this.code === 'NETWORK_ERROR' ||
      this.code === 'TIMEOUT_ERROR' ||
      (this.statusCode !== undefined && this.statusCode >= 500)
    )
  }

  isAuthError(): boolean {
    return this.statusCode === 401 || this.statusCode === 403
  }
}

/**
 * Error boundary wrapper for async operations
 */
export class ErrorBoundary {
  private static errorHandlers: Map<string, (error: Error) => void> = new Map()

  /**
   * Register a global error handler
   */
  static registerHandler(
    name: string,
    handler: (error: Error) => void
  ): void {
    this.errorHandlers.set(name, handler)
  }

  /**
   * Execute async function with error handling
   */
  static async executeAsync<T>(
    fn: () => Promise<T>,
    options?: {
      fallback?: T
      onError?: (error: Error) => void
    }
  ): Promise<T | undefined> {
    try {
      return await fn()
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      options?.onError?.(err)
      this.notifyHandlers(err)
      return options?.fallback
    }
  }

  /**
   * Execute sync function with error handling
   */
  static executeSync<T>(
    fn: () => T,
    options?: {
      fallback?: T
      onError?: (error: Error) => void
    }
  ): T | undefined {
    try {
      return fn()
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      options?.onError?.(err)
      this.notifyHandlers(err)
      return options?.fallback
    }
  }

  /**
   * Notify all registered error handlers
   */
  private static notifyHandlers(error: Error): void {
    this.errorHandlers.forEach((handler) => {
      try {
        handler(error)
      } catch (err) {
        this.log('Error in error handler:', err)
      }
    })
  }

  private static log(...args: any[]): void {
    if (config.features.enableLogging) {
      console.error('[ErrorBoundary]', ...args)
    }
  }
}

/**
 * Retry logic with exponential backoff
 */
export class RetryPolicy {
  constructor(
    private maxRetries: number = 3,
    private initialDelayMs: number = 1000,
    private maxDelayMs: number = 30000,
    private backoffFactor: number = 2
  ) {}

  /**
   * Execute function with automatic retry
   */
  async execute<T>(
    fn: () => Promise<T>,
    shouldRetry?: (error: Error) => boolean
  ): Promise<T> {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))

        // Check if we should retry
        const canRetry =
          attempt < this.maxRetries &&
          (shouldRetry ? shouldRetry(lastError) : true)

        if (canRetry) {
          const delayMs = this.calculateDelay(attempt)
          this.log(
            `Retry attempt ${attempt + 1}/${this.maxRetries} after ${delayMs}ms`
          )
          await this.sleep(delayMs)
        } else {
          break
        }
      }
    }

    throw lastError || new Error('Failed after retries')
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateDelay(attempt: number): number {
    const delay = this.initialDelayMs * Math.pow(this.backoffFactor, attempt)
    return Math.min(delay, this.maxDelayMs)
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  private log(...args: any[]): void {
    if (config.features.enableLogging) {
      console.log('[RetryPolicy]', ...args)
    }
  }
}

/**
 * User-friendly error messages
 */
export const ERROR_MESSAGES: Record<string, string> = {
  // Network errors
  NETWORK_ERROR:
    'Network connection error. Please check your connection and try again.',
  TIMEOUT_ERROR: 'Request timeout. The server took too long to respond.',
  CONNECTION_REFUSED: 'Failed to connect to the server. Is it running?',

  // Authentication errors
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  FORBIDDEN: 'Access denied. You do not have permission.',
  INVALID_CREDENTIALS: 'Invalid credentials. Please try again.',

  // Server errors
  INTERNAL_SERVER_ERROR: 'An unexpected error occurred. Please try again later.',
  SERVICE_UNAVAILABLE: 'Service is temporarily unavailable. Please try again.',
  NOT_FOUND: 'The requested resource was not found.',

  // Validation errors
  INVALID_REQUEST: 'Invalid request. Please check your input.',
  VALIDATION_ERROR: 'There are validation errors. Please review and try again.',

  // API specific errors
  INVALID_ORDER: 'Invalid order parameters. Please review and try again.',
  INSUFFICIENT_BALANCE: 'Insufficient balance to execute this trade.',
  ORDER_FAILED: 'Order execution failed. Please try again.',
  POSITION_NOT_FOUND: 'Position not found.',
  SYMBOL_NOT_FOUND: 'Trading symbol not found.',

  // Default
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyMessage(
  code: string,
  defaultMessage?: string
): string {
  const message = ERROR_MESSAGES[code]
  if (message) {
    return message
  }
  if (defaultMessage) {
    return defaultMessage
  }
  return ERROR_MESSAGES['UNKNOWN_ERROR'] || 'An unexpected error occurred. Please try again.'
}

/**
 * Parse API error response
 */
export function parseApiError(error: any): ApiError {
  // Handle response error
  if (error.response) {
    const data = error.response.data
    const statusCode = error.response.status

    return new ApiError(
      data?.error?.code || 'API_ERROR',
      data?.error?.message || 'API error',
      statusCode,
      data?.error?.details
    )
  }

  // Handle timeout error
  if (error.code === 'ECONNABORTED') {
    return new ApiError('TIMEOUT_ERROR', 'Request timeout', undefined, error)
  }

  // Handle network error
  if (error.message === 'Network Error' || !error.response) {
    return new ApiError(
      'NETWORK_ERROR',
      'Network connection error',
      undefined,
      error
    )
  }

  // Handle generic error
  return new ApiError(
    'UNKNOWN_ERROR',
    error.message ? String(error.message) : 'Unknown error',
    undefined,
    error
  )
}

/**
 * Format error for logging
 */
export function formatErrorForLogging(error: Error | ApiError): string {
  if (error instanceof ApiError) {
    return `[${error.code}] ${error.message}${
      error.statusCode ? ` (${error.statusCode})` : ''
    }`
  }
  return `${error.name || 'Error'}: ${error.message}`
}

/**
 * Log error with context
 */
export function logError(
  error: Error | ApiError,
  context?: string,
  extra?: unknown
): void {
  if (!config.features.enableLogging) return

  const formatted = formatErrorForLogging(error)
  console.error(
    `[${context || 'App'}] ${formatted}`,
    extra ? { extra } : undefined
  )
}
