/**
 * Chart Utilities
 * Helper functions for chart data formatting, aggregation, and responsive handling
 */

import type { OHLCV } from '@/types/api'

/**
 * Format time for different intervals
 */
export function formatChartTime(timestamp: number, interval: string): string {
  const date = new Date(timestamp * 1000)

  switch (interval) {
    case '1m':
    case '5m':
    case '15m':
    case '30m':
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })

    case '1h':
    case '4h':
      return date.toLocaleTimeString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        hour12: true,
      })

    case '1d':
    case '1w':
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })

    case '1M':
      return date.toLocaleDateString('en-US', {
        month: 'short',
        year: '2-digit',
      })

    default:
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
  }
}

/**
 * Format price with appropriate precision
 */
export function formatPrice(price: number, precision: number = 2): string {
  // Use higher precision for small prices
  if (price < 0.01) {
    return price.toFixed(8)
  }
  if (price < 1) {
    return price.toFixed(4)
  }
  return price.toFixed(precision)
}

/**
 * Format price for display with locale
 */
export function formatPriceDisplay(price: number, symbol?: string): string {
  const formatted = price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 8,
  })

  return symbol ? `${symbol}${formatted}` : formatted
}

/**
 * Format volume for display
 */
export function formatVolume(volume: number): string {
  if (volume >= 1_000_000) {
    return `${(volume / 1_000_000).toFixed(2)}M`
  }
  if (volume >= 1_000) {
    return `${(volume / 1_000).toFixed(2)}K`
  }
  return volume.toFixed(0)
}

/**
 * Convert OHLCV data to TradingView Lightweight Charts format
 */
export function transformOHLCVToChartData(
  candles: OHLCV[]
): Array<{ time: number; open: number; high: number; low: number; close: number }> {
  return candles.map((candle) => ({
    time: Math.floor(candle.time),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }))
}

/**
 * Convert OHLCV data to candlestick chart format with volume
 */
export function transformCandlestickData(candles: OHLCV[]): {
  candlesticks: Array<{ time: number; open: number; high: number; low: number; close: number }>
  volumes: Array<{ time: number; value: number }>
} {
  const candlesticks = candles.map((candle) => ({
    time: Math.floor(candle.time),
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
  }))

  const volumes = candles.map((candle) => ({
    time: Math.floor(candle.time),
    value: candle.volume,
  }))

  return { candlesticks, volumes }
}

/**
 * Convert P&L time series data to area chart format
 */
export function transformPnLData(
  data: Array<{ timestamp: number; value: number }>
): Array<{ time: number; value: number }> {
  return data.map((item) => ({
    time: Math.floor(item.timestamp),
    value: item.value,
  }))
}

/**
 * Aggregate OHLCV data to different timeframe
 * Used for timeframe conversion (e.g., 1m to 5m)
 */
export function aggregateOHLCVData(
  candles: OHLCV[],
  fromInterval: string,
  toInterval: string
): OHLCV[] {
  const multiplier = getIntervalMultiplier(fromInterval, toInterval)

  if (multiplier <= 1 || candles.length === 0) {
    return candles
  }

  const aggregated: OHLCV[] = []
  let currentGroup: OHLCV[] = []

  for (const candle of candles) {
    currentGroup.push(candle)

    if (currentGroup.length === multiplier) {
      const first = currentGroup[0]
      const last = currentGroup[currentGroup.length - 1]
      
      if (first && last) {
        const high = Math.max(...currentGroup.map((c) => c.high))
        const low = Math.min(...currentGroup.map((c) => c.low))
        const volume = currentGroup.reduce((sum, c) => sum + c.volume, 0)

        aggregated.push({
          open: first.open,
          high,
          low,
          close: last.close,
          volume,
          time: first.time,
        })
      }

      currentGroup = []
    }
  }

  return aggregated
}

/**
 * Get multiplier for interval aggregation
 */
function getIntervalMultiplier(fromInterval: string, toInterval: string): number {
  const intervals = ['1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w', '1M']
  const fromIndex = intervals.indexOf(fromInterval)
  const toIndex = intervals.indexOf(toInterval)

  if (fromIndex === -1 || toIndex === -1 || fromIndex > toIndex) {
    return 1
  }

  // Simple multiplier calculation
  const fromMs = parseInterval(fromInterval)
  const toMs = parseInterval(toInterval)

  return Math.floor(toMs / fromMs)
}

/**
 * Parse interval string to milliseconds
 */
function parseInterval(interval: string): number {
  const unit = interval.slice(-1)
  const value = parseInt(interval.slice(0, -1), 10)

  switch (unit) {
    case 'm':
      return value * 60 * 1000
    case 'h':
      return value * 60 * 60 * 1000
    case 'd':
      return value * 24 * 60 * 60 * 1000
    case 'w':
      return value * 7 * 24 * 60 * 60 * 1000
    case 'M':
      return value * 30 * 24 * 60 * 60 * 1000
    default:
      return 0
  }
}

/**
 * Calculate moving average
 */
export function calculateMovingAverage(prices: number[], period: number): number[] {
  const result: number[] = []

  for (let i = period - 1; i < prices.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) {
      sum += prices[j] || 0
    }
    result.push(sum / period)
  }

  return result
}

/**
 * Convert moving average to chart data
 */
export function transformMovingAverageData(
  closePrices: Array<{ time: number; close: number }>,
  period: number
): Array<{ time: number; value: number }> {
  const prices = closePrices.map((c) => c.close)
  const ma = calculateMovingAverage(prices, period)

  return closePrices.slice(period - 1).map((item, index) => ({
    time: item.time,
    value: ma[index] ?? 0,
  }))
}

/**
 * Get color based on P&L value
 */
export function getPnLColor(
  value: number,
  profitColor: string = '#26c281',
  lossColor: string = '#e74c3c'
): string {
  return value >= 0 ? profitColor : lossColor
}

/**
 * Format percentage change
 */
export function formatPercentChange(value: number, decimals: number = 2): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

/**
 * Calculate percentage change
 */
export function calculatePercentChange(current: number, previous: number): number {
  if (previous === 0) return 0
  return ((current - previous) / previous) * 100
}

/**
 * Get responsive chart height based on viewport
 */
export function getResponsiveChartHeight(container: HTMLElement): number {
  const width = container.offsetWidth

  // Mobile: smaller height
  if (width < 768) {
    return 250
  }

  // Tablet: medium height
  if (width < 1024) {
    return 350
  }

  // Desktop: full height
  return 400
}

/**
 * Debounce function for chart resize handlers
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      func(...args)
      timeoutId = null
    }, wait)
  }
}

/**
 * Get interval label for display
 */
export function getIntervalLabel(interval: string): string {
  const labels: Record<string, string> = {
    '1m': '1 Min',
    '5m': '5 Min',
    '15m': '15 Min',
    '30m': '30 Min',
    '1h': '1 Hour',
    '4h': '4 Hours',
    '1d': '1 Day',
    '1w': '1 Week',
    '1M': '1 Month',
  }

  return labels[interval] || interval
}

/**
 * Validate OHLCV data
 */
export function isValidOHLCVData(data: any): data is OHLCV {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.open === 'number' &&
    typeof data.high === 'number' &&
    typeof data.low === 'number' &&
    typeof data.close === 'number' &&
    typeof data.volume === 'number' &&
    typeof data.time === 'number' &&
    data.high >= data.low &&
    data.high >= data.open &&
    data.high >= data.close &&
    data.low <= data.open &&
    data.low <= data.close
  )
}

/**
 * Get chart dimensions for container
 */
export function getChartDimensions(container: HTMLElement | null): {
  width: number
  height: number
} {
  if (!container) {
    return { width: 0, height: 0 }
  }

  return {
    width: container.offsetWidth,
    height: container.offsetHeight,
  }
}

