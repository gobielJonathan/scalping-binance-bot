/**
 * REST API Service
 * Comprehensive service for all trading bot HTTP endpoints
 */

import config from '@/config/environment'
import {
  ApiError,
  RetryPolicy,
  parseApiError,
  logError,
  getUserFriendlyMessage,
} from '@/utils/errors'
import type {
  ApiResponse,
  Portfolio,
  Order,
  Trade,
  TradeHistory,
  PaginatedResponse,
  Position,
  OHLCV,
} from '@/types/api'

/**
 * API Service for all REST endpoints
 */
class ApiService {
  private baseUrl: string
  private requestTimeout: number
  private retryPolicy: RetryPolicy
  private lastError: ApiError | null = null

  constructor() {
    this.baseUrl = config.apiBaseUrl
    this.requestTimeout = config.requestTimeout
    this.retryPolicy = new RetryPolicy(
      3, // maxRetries
      1000, // initialDelayMs
      10000, // maxDelayMs
      2 // backoffFactor
    )
  }

  /**
   * Make HTTP request with retry and error handling
   */
  private async request<T = unknown>(
    endpoint: string,
    options?: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
      body?: any
      headers?: Record<string, string>
      skipRetry?: boolean
    }
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`
    const method = options?.method || 'GET'

    const makeRequest = async () => {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout)

      try {
        const response = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
          },
          body: options?.body ? JSON.stringify(options.body) : undefined,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new ApiError(
            errorData.error?.code || 'HTTP_ERROR',
            errorData.error?.message || response.statusText,
            response.status,
            errorData.error?.details
          )
        }

        return await response.json()
      } catch (error) {
        clearTimeout(timeoutId)
        throw parseApiError(error)
      }
    }

    // Apply retry policy unless explicitly disabled
    if (!options?.skipRetry && method === 'GET') {
      return await this.retryPolicy.execute(makeRequest, (error) =>
        error instanceof ApiError ? error.isRetryable() : true
      )
    }

    return await makeRequest()
  }

  /**
   * Handle API response errors
   */
  private handleError<T>(
    error: unknown,
    context: string
  ): ApiResponse<T> {
    const apiError = error instanceof ApiError ? error : parseApiError(error)
    this.lastError = apiError
    logError(apiError, context)
    return {
      success: false,
      error: {
        code: apiError.code,
        message: apiError.message,
        details: apiError.details,
      },
      timestamp: new Date().toISOString(),
    }
  }

  // ============================================================================
  // Health & Status Endpoints
  // ============================================================================

  /**
   * Get server health status
   */
  async getHealth(): Promise<
    ApiResponse<{ status: string; uptime: number; timestamp: number }>
  > {
    try {
      return await this.request('/api/health')
    } catch (error) {
      return this.handleError(error, 'getHealth')
    }
  }

  /**
   * Get trading status
   */
  async getStatus(): Promise<
    ApiResponse<{
      trading: boolean
      mode: string
      pairs: string[]
      lastUpdate: number
    }>
  > {
    try {
      return await this.request('/api/status')
    } catch (error) {
      return this.handleError(error, 'getStatus')
    }
  }

  // ============================================================================
  // Portfolio Endpoints
  // ============================================================================

  /**
   * Get current portfolio
   */
  async getPortfolio(): Promise<ApiResponse<Portfolio>> {
    try {
      return await this.request('/api/portfolio')
    } catch (error) {
      return this.handleError(error, 'getPortfolio')
    }
  }

  /**
   * Get all open positions
   */
  async getPositions(): Promise<ApiResponse<Position[]>> {
    try {
      const response = await this.request<{ openPositions: Position[] }>(
        '/api/portfolio'
      )
      if (response.success && response.data) {
        return {
          success: true,
          data: response.data.openPositions || [],
          timestamp: response.timestamp,
        } as ApiResponse<Position[]>
      }
      return {
        success: false,
        error: response.error,
        timestamp: response.timestamp,
      } as ApiResponse<Position[]>
    } catch (error) {
      return this.handleError(error, 'getPositions')
    }
  }

  // ============================================================================
  // Paper Trading Endpoints
  // ============================================================================

  /**
   * Get paper trading metrics
   */
  async getPaperTradingMetrics(): Promise<
    ApiResponse<{
      totalSimulatedTrades: number
      totalSimulatedVolume: number
      averageSlippage: string
      totalSimulatedFees: number
      executionAccuracy: string
      largestOrder: number
      averageOrderSize: number
      currentOpenPositions: number
      totalPnl: number
      dailyPnl: number
      riskExposure: number
      availableBalance: number
      recentSlippage: number
    }>
  > {
    try {
      return await this.request('/api/paper-trading/metrics')
    } catch (error) {
      return this.handleError(error, 'getPaperTradingMetrics')
    }
  }

  /**
   * Get paper trading validation report
   */
  async getPaperTradingValidation(): Promise<
    ApiResponse<{
      overallAccuracy: string
      slippageAccuracy: string
      feeAccuracy: string
      executionTimeAccuracy: string
      status: string
      lastValidation: number
      recommendations: string[]
    }>
  > {
    try {
      return await this.request('/api/paper-trading/validation')
    } catch (error) {
      return this.handleError(error, 'getPaperTradingValidation')
    }
  }

  /**
   * Get paper trading executions
   */
  async getPaperTradingExecutions(): Promise<
    ApiResponse<{
      executions: any[]
      totalExecutions: number
      averageExecutionTime: number
      successRate: number
    }>
  > {
    try {
      return await this.request('/api/paper-trading/executions')
    } catch (error) {
      return this.handleError(error, 'getPaperTradingExecutions')
    }
  }

  /**
   * Reset paper trading statistics
   */
  async resetPaperTrading(): Promise<ApiResponse<{ message: string }>> {
    try {
      return await this.request('/api/paper-trading/reset', {
        method: 'POST',
        skipRetry: true,
      })
    } catch (error) {
      return this.handleError(error, 'resetPaperTrading')
    }
  }

  /**
   * Export paper trading data
   */
  async exportPaperTradingData(): Promise<
    ApiResponse<{ exportData: any; timestamp: number; format: string }>
  > {
    try {
      return await this.request('/api/paper-trading/export')
    } catch (error) {
      return this.handleError(error, 'exportPaperTradingData')
    }
  }

  // ============================================================================
  // Performance Endpoints
  // ============================================================================

  /**
   * Get performance projections
   */
  async getPerformanceProjections(): Promise<
    ApiResponse<{
      current: any
      comparison: any
      validation: any
      timestamp: number
    }>
  > {
    try {
      return await this.request('/api/performance/projections')
    } catch (error) {
      return this.handleError(error, 'getPerformanceProjections')
    }
  }

  // ============================================================================
  // Analytics Endpoints
  // ============================================================================

  /**
   * Get analytics summary
   */
  async getAnalyticsSummary(options?: {
    startDate?: number
    endDate?: number
    symbols?: string
    mode?: string
  }): Promise<ApiResponse<any>> {
    try {
      const params = new URLSearchParams()
      if (options?.startDate) params.append('startDate', String(options.startDate))
      if (options?.endDate) params.append('endDate', String(options.endDate))
      if (options?.symbols) params.append('symbols', options.symbols)
      if (options?.mode) params.append('mode', options.mode)

      const endpoint =
        `/api/analytics/summary` +
        (params.toString() ? `?${params.toString()}` : '')

      return await this.request(endpoint)
    } catch (error) {
      return this.handleError(error, 'getAnalyticsSummary')
    }
  }

  /**
   * Get analytics report
   */
  async getAnalyticsReport(options?: {
    startDate?: number
    endDate?: number
    symbols?: string
    mode?: string
  }): Promise<ApiResponse<any>> {
    try {
      const params = new URLSearchParams()
      if (options?.startDate) params.append('startDate', String(options.startDate))
      if (options?.endDate) params.append('endDate', String(options.endDate))
      if (options?.symbols) params.append('symbols', options.symbols)
      if (options?.mode) params.append('mode', options.mode)

      const endpoint =
        `/api/analytics/report` +
        (params.toString() ? `?${params.toString()}` : '')

      return await this.request(endpoint)
    } catch (error) {
      return this.handleError(error, 'getAnalyticsReport')
    }
  }

  /**
   * Get analytics trade history
   */
  async getAnalyticsTrades(options?: {
    startDate?: number
    endDate?: number
    symbols?: string
    mode?: string
    limit?: number
    offset?: number
    sortBy?: string
    sortOrder?: string
  }): Promise<ApiResponse<PaginatedResponse<Trade>>> {
    try {
      const params = new URLSearchParams()
      if (options?.startDate) params.append('startDate', String(options.startDate))
      if (options?.endDate) params.append('endDate', String(options.endDate))
      if (options?.symbols) params.append('symbols', options.symbols)
      if (options?.mode) params.append('mode', options.mode)
      if (options?.limit) params.append('limit', String(options.limit))
      if (options?.offset) params.append('offset', String(options.offset))
      if (options?.sortBy) params.append('sortBy', options.sortBy)
      if (options?.sortOrder) params.append('sortOrder', options.sortOrder)

      const endpoint =
        `/api/analytics/trades` +
        (params.toString() ? `?${params.toString()}` : '')

      return await this.request(endpoint)
    } catch (error) {
      return this.handleError(error, 'getAnalyticsTrades')
    }
  }

  /**
   * Get analytics stats
   */
  async getAnalyticsStats(options?: {
    startDate?: number
    endDate?: number
    symbols?: string
    mode?: string
  }): Promise<ApiResponse<any>> {
    try {
      const params = new URLSearchParams()
      if (options?.startDate) params.append('startDate', String(options.startDate))
      if (options?.endDate) params.append('endDate', String(options.endDate))
      if (options?.symbols) params.append('symbols', options.symbols)
      if (options?.mode) params.append('mode', options.mode)

      const endpoint =
        `/api/analytics/stats` +
        (params.toString() ? `?${params.toString()}` : '')

      return await this.request(endpoint)
    } catch (error) {
      return this.handleError(error, 'getAnalyticsStats')
    }
  }

  /**
   * Get drawdown analysis
   */
  async getAnalyticsDrawdown(options?: {
    startDate?: number
    endDate?: number
    symbols?: string
    mode?: string
  }): Promise<ApiResponse<any>> {
    try {
      const params = new URLSearchParams()
      if (options?.startDate) params.append('startDate', String(options.startDate))
      if (options?.endDate) params.append('endDate', String(options.endDate))
      if (options?.symbols) params.append('symbols', options.symbols)
      if (options?.mode) params.append('mode', options.mode)

      const endpoint =
        `/api/analytics/drawdown` +
        (params.toString() ? `?${params.toString()}` : '')

      return await this.request(endpoint)
    } catch (error) {
      return this.handleError(error, 'getAnalyticsDrawdown')
    }
  }

  /**
   * Get streak analysis
   */
  async getAnalyticsStreaks(options?: {
    startDate?: number
    endDate?: number
    symbols?: string
    mode?: string
  }): Promise<ApiResponse<any>> {
    try {
      const params = new URLSearchParams()
      if (options?.startDate) params.append('startDate', String(options.startDate))
      if (options?.endDate) params.append('endDate', String(options.endDate))
      if (options?.symbols) params.append('symbols', options.symbols)
      if (options?.mode) params.append('mode', options.mode)

      const endpoint =
        `/api/analytics/streaks` +
        (params.toString() ? `?${params.toString()}` : '')

      return await this.request(endpoint)
    } catch (error) {
      return this.handleError(error, 'getAnalyticsStreaks')
    }
  }

  /**
   * Export analytics data
   */
  async exportAnalyticsData(options: {
    format: string
    includeCharts?: boolean
    dateRange?: { start: number; end: number }
    symbols?: string[]
    groupBy?: string
    metrics?: string[]
  }): Promise<ApiResponse<any>> {
    try {
      return await this.request('/api/analytics/export', {
        method: 'POST',
        body: options,
        skipRetry: true,
      })
    } catch (error) {
      return this.handleError(error, 'exportAnalyticsData')
    }
  }

  /**
   * Clear analytics cache
   */
  async clearAnalyticsCache(): Promise<ApiResponse<any>> {
    try {
      return await this.request('/api/analytics/cache', {
        method: 'DELETE',
        skipRetry: true,
      })
    } catch (error) {
      return this.handleError(error, 'clearAnalyticsCache')
    }
  }

  // ============================================================================
  // Manual Override Endpoints
  // ============================================================================

  /**
   * Execute emergency stop
   */
  async emergencyStop(userId: string, reason: string): Promise<ApiResponse<any>> {
    try {
      return await this.request('/api/manual/emergency-stop', {
        method: 'POST',
        body: { userId, reason },
        skipRetry: true,
      })
    } catch (error) {
      return this.handleError(error, 'emergencyStop')
    }
  }

  /**
   * Resume trading
   */
  async resumeTrading(userId: string, reason: string): Promise<ApiResponse<any>> {
    try {
      return await this.request('/api/manual/resume-trading', {
        method: 'POST',
        body: { userId, reason },
        skipRetry: true,
      })
    } catch (error) {
      return this.handleError(error, 'resumeTrading')
    }
  }

  /**
   * Close specific position
   */
  async closePosition(
    userId: string,
    positionId: string,
    reason: string
  ): Promise<ApiResponse<any>> {
    try {
      return await this.request('/api/manual/close-position', {
        method: 'POST',
        body: { userId, positionId, reason },
        skipRetry: true,
      })
    } catch (error) {
      return this.handleError(error, 'closePosition')
    }
  }

  /**
   * Close all positions
   */
  async closeAllPositions(userId: string, reason: string): Promise<ApiResponse<any>> {
    try {
      return await this.request('/api/manual/close-all-positions', {
        method: 'POST',
        body: { userId, reason },
        skipRetry: true,
      })
    } catch (error) {
      return this.handleError(error, 'closeAllPositions')
    }
  }

  /**
   * Pause trading
   */
  async pauseTrading(userId: string, reason: string): Promise<ApiResponse<any>> {
    try {
      return await this.request('/api/manual/pause-trading', {
        method: 'POST',
        body: { userId, reason },
        skipRetry: true,
      })
    } catch (error) {
      return this.handleError(error, 'pauseTrading')
    }
  }

  /**
   * Get system status
   */
  async getSystemStatus(): Promise<ApiResponse<any>> {
    try {
      return await this.request('/api/manual/status')
    } catch (error) {
      return this.handleError(error, 'getSystemStatus')
    }
  }

  /**
   * Get recorded override commands
   */
  async getOverrideCommands(): Promise<ApiResponse<any>> {
    try {
      return await this.request('/api/manual/commands')
    } catch (error) {
      return this.handleError(error, 'getOverrideCommands')
    }
  }

  /**
   * Get strategy parameters
   */
  async getStrategyParameters(): Promise<ApiResponse<any>> {
    try {
      return await this.request('/api/manual/parameters')
    } catch (error) {
      return this.handleError(error, 'getStrategyParameters')
    }
  }

  /**
   * Get risk thresholds
   */
  async getRiskThresholds(): Promise<ApiResponse<any>> {
    try {
      return await this.request('/api/manual/thresholds')
    } catch (error) {
      return this.handleError(error, 'getRiskThresholds')
    }
  }

  // ============================================================================
  // Market Data & Charts Endpoints
  // ============================================================================

  /**
   * Get latest market data for all tracked symbols
   */
  async getMarketDataAll(): Promise<ApiResponse<any>> {
    try {
      return await this.request('/api/market/data')
    } catch (error) {
      return this.handleError(error, 'getMarketDataAll')
    }
  }

  /**
   * Get historical OHLCV data
   */
  async getHistoricalData(
    symbol: string,
    interval: string,
    limit: number = 500,
    startTime?: number,
    endTime?: number
  ): Promise<ApiResponse<OHLCV[]>> {
    try {
      const params = new URLSearchParams({
        symbol,
        interval,
        limit: String(limit),
      })

      if (startTime) params.append('startTime', String(startTime))
      if (endTime) params.append('endTime', String(endTime))

      const endpoint = `/api/market/candles?${params.toString()}`
      const response = await this.request<OHLCV[]>(endpoint)

      if (response.success && Array.isArray(response.data)) {
        return {
          success: true,
          data: response.data,
          timestamp: response.timestamp,
        }
      }

      return {
        success: false,
        error: response.error,
        timestamp: response.timestamp,
      }
    } catch (error) {
      return this.handleError<OHLCV[]>(error, 'getHistoricalData')
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get last error
   */
  getLastError(): ApiError | null {
    return this.lastError
  }

  /**
   * Clear last error
   */
  clearLastError(): void {
    this.lastError = null
  }

  /**
   * Get user-friendly error message
   */
  getErrorMessage(code: string, defaultMessage?: string): string {
    return getUserFriendlyMessage(code, defaultMessage)
  }
}

// Export singleton instance
export default new ApiService()
