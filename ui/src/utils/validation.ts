/**
 * Data Integrity Validator
 * Real-time validation for Socket.IO streams, API responses, and trading data
 */

import type { Trade, Portfolio, Position, OHLCV } from '@/types/api'

/**
 * Error types for validation
 */
export enum ValidationErrorType {
  MISSING_FIELD = 'MISSING_FIELD',
  INVALID_TYPE = 'INVALID_TYPE',
  INVALID_VALUE = 'INVALID_VALUE',
  DATA_CORRUPTION = 'DATA_CORRUPTION',
  INCONSISTENCY = 'INCONSISTENCY',
  ANOMALY = 'ANOMALY',
}

/**
 * Validation error
 */
export interface ValidationError {
  type: ValidationErrorType
  field: string
  value?: unknown
  message: string
  recoverable: boolean
  suggestion?: string
}

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean
  errors: ValidationError[]
  warnings: ValidationError[]
}

/**
 * Data validator
 */
class DataValidator {
  /**
   * Validate API response structure
   */
  validateApiResponse<T>(
    data: any,
    schema: Record<string, ValidationFn>
  ): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationError[] = []

    if (!data || typeof data !== 'object') {
      errors.push({
        type: ValidationErrorType.INVALID_TYPE,
        field: 'root',
        value: data,
        message: 'Response must be an object',
        recoverable: false,
      })
      return { isValid: false, errors, warnings }
    }

    // Validate each field
    for (const [field, validator] of Object.entries(schema)) {
      try {
        const result = validator(data[field], field)
        if (!result.isValid) {
          if (result.recoverable) {
            warnings.push(...result.errors)
          } else {
            errors.push(...result.errors)
          }
        }
      } catch (error) {
        errors.push({
          type: ValidationErrorType.INVALID_VALUE,
          field,
          value: data[field],
          message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          recoverable: false,
        })
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Validate Trade object
   */
  validateTrade(trade: any): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationError[] = []

    // Required fields
    const requiredFields: (keyof Trade)[] = [
      'id',
      'symbol',
      'side',
      'quantity',
      'price',
    ]

    for (const field of requiredFields) {
      if (!(field in trade) || trade[field] === null || trade[field] === undefined) {
        errors.push({
          type: ValidationErrorType.MISSING_FIELD,
          field,
          message: `Required field missing: ${field}`,
          recoverable: false,
        })
      }
    }

    // Validate numeric fields
    const numericFields: (keyof Trade)[] = ['quantity', 'price', 'commission']
    for (const field of numericFields) {
      if (field in trade && trade[field] !== undefined) {
        if (typeof trade[field] !== 'number' || !Number.isFinite(trade[field])) {
          errors.push({
            type: ValidationErrorType.INVALID_TYPE,
            field,
            value: trade[field],
            message: `${field} must be a valid number`,
            recoverable: false,
          })
        }
      }
    }

    // Validate quantity > 0
    if (trade.quantity !== undefined && trade.quantity <= 0) {
      errors.push({
        type: ValidationErrorType.INVALID_VALUE,
        field: 'quantity',
        value: trade.quantity,
        message: 'Quantity must be positive',
        recoverable: false,
      })
    }

    // Validate price > 0
    if (trade.price !== undefined && trade.price <= 0) {
      errors.push({
        type: ValidationErrorType.INVALID_VALUE,
        field: 'price',
        value: trade.price,
        message: 'Price must be positive',
        recoverable: false,
      })
    }

    // Validate side
    const validSides = ['buy', 'sell', 'BUY', 'SELL']
    if (!validSides.includes(trade.side)) {
      errors.push({
        type: ValidationErrorType.INVALID_VALUE,
        field: 'side',
        value: trade.side,
        message: `Side must be one of: ${validSides.join(', ')}`,
        recoverable: false,
      })
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Validate Portfolio object
   */
  validatePortfolio(portfolio: any): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationError[] = []

    const requiredFields: (keyof Portfolio)[] = ['totalBalance', 'investedBalance', 'id']

    for (const field of requiredFields) {
      if (!(field in portfolio)) {
        errors.push({
          type: ValidationErrorType.MISSING_FIELD,
          field,
          message: `Required field missing: ${field}`,
          recoverable: true,
          suggestion: `Set ${field} to default value`,
        })
      }
    }

    // Validate numeric fields are finite numbers
    const numericFields = ['totalBalance', 'investedBalance', 'pnl', 'pnlPercent']
    for (const field of numericFields) {
      if (field in portfolio && portfolio[field] !== undefined) {
        if (typeof portfolio[field] !== 'number' || !Number.isFinite(portfolio[field])) {
          errors.push({
            type: ValidationErrorType.INVALID_TYPE,
            field,
            value: portfolio[field],
            message: `${field} must be a finite number`,
            recoverable: false,
          })
        }
      }
    }

    // Validate portfolio calculation: totalBalance >= investedBalance
    if (
      portfolio.totalBalance !== undefined &&
      portfolio.investedBalance !== undefined &&
      portfolio.totalBalance < 0
    ) {
      warnings.push({
        type: ValidationErrorType.INCONSISTENCY,
        field: 'totalBalance',
        value: portfolio.totalBalance,
        message: 'Total balance is negative',
        recoverable: true,
        suggestion: 'Check for data corruption or incorrect calculation',
      })
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Validate Position object
   */
  validatePosition(position: any): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationError[] = []

    const requiredFields: (keyof Position)[] = ['symbol', 'quantity', 'entryPrice']

    for (const field of requiredFields) {
      if (!(field in position)) {
        errors.push({
          type: ValidationErrorType.MISSING_FIELD,
          field,
          message: `Required field missing: ${field}`,
          recoverable: false,
        })
      }
    }

    // Validate numeric fields
    const numericFields = ['quantity', 'entryPrice', 'currentPrice']
    for (const field of numericFields) {
      if (field in position && position[field] !== undefined) {
        if (typeof position[field] !== 'number' || !Number.isFinite(position[field])) {
          errors.push({
            type: ValidationErrorType.INVALID_TYPE,
            field,
            value: position[field],
            message: `${field} must be a valid number`,
            recoverable: false,
          })
        }
      }
    }

    // Validate quantity != 0
    if (position.quantity !== undefined && position.quantity === 0) {
      warnings.push({
        type: ValidationErrorType.INCONSISTENCY,
        field: 'quantity',
        value: position.quantity,
        message: 'Position has zero quantity',
        recoverable: true,
        suggestion: 'Consider closing this position',
      })
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Validate OHLCV data (candlestick data)
   */
  validateOHLCV(candle: any): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationError[] = []

    const requiredFields = ['open', 'high', 'low', 'close', 'volume', 'timestamp']

    for (const field of requiredFields) {
      if (!(field in candle)) {
        errors.push({
          type: ValidationErrorType.MISSING_FIELD,
          field,
          message: `Required field missing: ${field}`,
          recoverable: false,
        })
      }
    }

    // Validate numeric fields
    const numericFields = ['open', 'high', 'low', 'close', 'volume']
    for (const field of numericFields) {
      if (field in candle && candle[field] !== undefined) {
        if (typeof candle[field] !== 'number' || !Number.isFinite(candle[field])) {
          errors.push({
            type: ValidationErrorType.INVALID_TYPE,
            field,
            value: candle[field],
            message: `${field} must be a valid number`,
            recoverable: false,
          })
        }
      }
    }

    // Validate OHLC relationships: high >= open, high >= close, high >= low, low <= open, low <= close
    const { open, high, low, close } = candle
    if (high < open || high < close || high < low) {
      errors.push({
        type: ValidationErrorType.DATA_CORRUPTION,
        field: 'high',
        value: { open, high, low, close },
        message: 'High price is lower than other prices',
        recoverable: true,
        suggestion: 'Recalculate OHLCV or fetch fresh data',
      })
    }

    if (low > open || low > close) {
      errors.push({
        type: ValidationErrorType.DATA_CORRUPTION,
        field: 'low',
        value: { open, high, low, close },
        message: 'Low price is higher than other prices',
        recoverable: true,
        suggestion: 'Recalculate OHLCV or fetch fresh data',
      })
    }

    // Validate volume >= 0
    if (candle.volume !== undefined && candle.volume < 0) {
      errors.push({
        type: ValidationErrorType.INVALID_VALUE,
        field: 'volume',
        value: candle.volume,
        message: 'Volume must be non-negative',
        recoverable: false,
      })
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Detect data anomalies
   */
  detectAnomalies(
    currentValue: number,
    historicalValues: number[],
    deviationThreshold: number = 3 // Standard deviations
  ): { isAnomaly: boolean; reason: string } {
    if (historicalValues.length < 2) {
      return { isAnomaly: false, reason: 'Insufficient historical data' }
    }

    const mean = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length
    const variance =
      historicalValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      historicalValues.length
    const stdDev = Math.sqrt(variance)

    const zScore = Math.abs((currentValue - mean) / (stdDev || 1))

    if (zScore > deviationThreshold) {
      return {
        isAnomaly: true,
        reason: `Value ${currentValue} deviates ${zScore.toFixed(2)} standard deviations from mean`,
      }
    }

    return { isAnomaly: false, reason: 'Value is within normal range' }
  }

  /**
   * Validate data consistency between sources
   */
  validateCrossSourceConsistency(
    data1: any,
    data2: any,
    tolerance: number = 0.01 // 1% tolerance for price data
  ): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationError[] = []

    // For price data, check if they're within tolerance
    if (typeof data1 === 'number' && typeof data2 === 'number') {
      const diff = Math.abs(data1 - data2)
      const maxDiff = Math.max(data1, data2) * tolerance

      if (diff > maxDiff) {
        warnings.push({
          type: ValidationErrorType.INCONSISTENCY,
          field: 'price',
          value: { source1: data1, source2: data2, difference: diff },
          message: `Data inconsistency: values differ by ${(diff * 100).toFixed(2)}%`,
          recoverable: true,
          suggestion: 'Verify data sources and resync if necessary',
        })
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Sanitize WebSocket message
   */
  sanitizeWebSocketMessage(message: any): any {
    if (typeof message !== 'object' || message === null) {
      return null
    }

    const sanitized: any = {}

    // Whitelist known fields based on message type
    if (message.type === 'trade') {
      const tradeFields = ['id', 'symbol', 'side', 'quantity', 'price', 'timestamp']
      for (const field of tradeFields) {
        if (field in message) {
          sanitized[field] = message[field]
        }
      }
    } else if (message.type === 'price') {
      const priceFields = ['symbol', 'price', 'timestamp', 'bid', 'ask']
      for (const field of priceFields) {
        if (field in message) {
          sanitized[field] = message[field]
        }
      }
    } else {
      // Generic copy for unknown types
      return message
    }

    return sanitized
  }

  /**
   * Recover corrupted data with fallback values
   */
  recoverCorruptedData<T>(
    corruptedData: any,
    fallbackData?: T
  ): { data: T | null; isRecovered: boolean } {
    try {
      // Try to validate and use corrupted data if mostly valid
      if (corruptedData && typeof corruptedData === 'object') {
        return { data: corruptedData as T, isRecovered: true }
      }
    } catch (error) {
      // Fall through to fallback
    }

    if (fallbackData) {
      return { data: fallbackData, isRecovered: true }
    }

    return { data: null, isRecovered: false }
  }

  /**
   * Validate timestamp freshness
   */
  validateTimestampFreshness(
    timestamp: number,
    maxAgeMsecs: number = 5000 // 5 seconds
  ): { isFresh: boolean; ageMs: number } {
    const now = Date.now()
    const ageMs = now - timestamp

    return {
      isFresh: ageMs <= maxAgeMsecs && ageMs >= 0,
      ageMs,
    }
  }
}

/**
 * Validation function type
 */
export type ValidationFn = (
  value: any,
  field: string
) => { isValid: boolean; errors: ValidationError[]; recoverable?: boolean }

// Export singleton instance
export const dataValidator = new DataValidator()
export default dataValidator
