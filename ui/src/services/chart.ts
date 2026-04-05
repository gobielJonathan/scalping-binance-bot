/**
 * Chart Services
 * Handles data transformation, API integration, and chart configuration
 */

import type { OHLCV, Portfolio } from '@/types/api'
import {
  transformCandlestickData,
  transformOHLCVToChartData,
  getPnLColor,
} from '@/utils/chart'
import apiService from './api'

/**
 * Chart type definitions
 */
export enum ChartType {
  CANDLESTICK = 'candlestick',
  LINE = 'line',
  AREA = 'area',
}

/**
 * Chart theme configuration
 */
export interface ChartTheme {
  backgroundColor: string
  textColor: string
  gridColor: string
  candleUpColor: string
  candleDownColor: string
  wickUpColor: string
  wickDownColor: string
  volumeUpColor: string
  volumeDownColor: string
  maColor: string
}

/**
 * Chart configuration
 */
export interface ChartConfig {
  type: ChartType
  symbol: string
  interval: string
  width: number
  height: number
  theme: ChartTheme
  showVolume?: boolean
  showMA?: boolean
  maLength?: number
  enableCrossHair?: boolean
  enableRightScaleAlignment?: boolean
}

/**
 * Historical data request parameters
 */
export interface HistoricalDataParams {
  symbol: string
  interval: string
  limit?: number
  startTime?: number
  endTime?: number
}

/**
 * P&L data point
 */
export interface PnLDataPoint {
  timestamp: number
  value: number
  balance: number
}

/**
 * Predefined chart themes
 */
export const CHART_THEMES = {
  dark: {
    backgroundColor: '#1a1a2e',
    textColor: '#e0e0e0',
    gridColor: '#2a2a3e',
    candleUpColor: '#26c281',
    candleDownColor: '#e74c3c',
    wickUpColor: '#26c281',
    wickDownColor: '#e74c3c',
    volumeUpColor: 'rgba(38, 194, 129, 0.3)',
    volumeDownColor: 'rgba(231, 76, 60, 0.3)',
    maColor: '#3498db',
  } as ChartTheme,
  light: {
    backgroundColor: '#ffffff',
    textColor: '#333333',
    gridColor: '#e0e0e0',
    candleUpColor: '#26c281',
    candleDownColor: '#e74c3c',
    wickUpColor: '#26c281',
    wickDownColor: '#e74c3c',
    volumeUpColor: 'rgba(38, 194, 129, 0.2)',
    volumeDownColor: 'rgba(231, 76, 60, 0.2)',
    maColor: '#3498db',
  } as ChartTheme,
}

/**
 * Chart Services
 */
class ChartService {
  /**
   * Fetch historical OHLCV data from API
   */
  async fetchHistoricalData(params: HistoricalDataParams): Promise<OHLCV[]> {
    try {
      // Build query parameters
      const queryParams = new URLSearchParams({
        symbol: params.symbol,
        interval: params.interval,
        limit: String(params.limit || 500),
      })

      if (params.startTime) {
        queryParams.append('startTime', String(params.startTime))
      }

      if (params.endTime) {
        queryParams.append('endTime', String(params.endTime))
      }

      // Fetch from API
      const response = await apiService.getHistoricalData(
        params.symbol,
        params.interval,
        params.limit || 500
      )

      if (response.success && response.data) {
        return response.data as OHLCV[]
      }

      return []
    } catch (error) {
      console.error('Failed to fetch historical data:', error)
      return []
    }
  }

  /**
   * Transform candlestick data for chart
   */
  transformCandlestickChartData(candles: OHLCV[]) {
    return transformCandlestickData(candles)
  }

  /**
   * Transform OHLCV data for line/area chart
   */
  transformLineChartData(candles: OHLCV[]) {
    return transformOHLCVToChartData(candles)
  }

  /**
   * Get chart theme
   */
  getChartTheme(themeName: 'dark' | 'light' = 'dark'): ChartTheme {
    return CHART_THEMES[themeName]
  }

  /**
   * Create candlestick chart series options
   */
  getCandlestickSeriesOptions(theme: ChartTheme) {
    return {
      upColor: theme.candleUpColor,
      downColor: theme.candleDownColor,
      borderUpColor: theme.candleUpColor,
      borderDownColor: theme.candleDownColor,
    }
  }

  /**
   * Create volume histogram series options
   */
  getVolumeSeriesOptions() {
    return {
      priceFormat: {
        type: 'volume',
      },
      lastValueVisible: false,
      priceScaleId: 'right',
    }
  }

  /**
   * Create moving average line options
   */
  getMovingAverageOptions(theme: ChartTheme, maLength: number = 20) {
    return {
      color: theme.maColor,
      lineWidth: 2,
      lineStyle: 1, // solid
      title: `MA ${maLength}`,
      priceScaleId: 'left',
      lastValueVisible: true,
    }
  }

  /**
   * Get default chart options
   */
  getDefaultChartOptions(width: number, height: number, theme: ChartTheme) {
    return {
      width,
      height,
      layout: {
        background: {
          color: theme.backgroundColor,
        },
        textColor: theme.textColor,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        fontSize: 11,
      },
      grid: {
        horzLines: {
          color: theme.gridColor,
        },
        vertLines: {
          color: theme.gridColor,
        },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 10,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
      },
      crosshair: {
        mode: 1, // CrosshairMode.Normal
        vertLine: {
          color: theme.gridColor,
          style: 3, // LineStyle.Dashed
        },
        horzLine: {
          color: theme.gridColor,
          style: 3, // LineStyle.Dashed
        },
      },
    } as any
  }

  /**
   * Transform P&L data from portfolio history
   */
  transformPortfolioPnLData(portfolioHistory: Portfolio[]): PnLDataPoint[] {
    return portfolioHistory.map((portfolio) => ({
      timestamp: new Date(portfolio.updatedAt).getTime() / 1000,
      value: portfolio.pnl,
      balance: portfolio.totalBalance,
    }))
  }

  /**
   * Get P&L color based on value
   */
  getPnLColor(value: number): string {
    return getPnLColor(value)
  }

  /**
   * Create P&L area chart series options
   */
  getPnLAreaSeriesOptions() {
    return {
      lineColor: (value: number) => this.getPnLColor(value),
      topColor: (value: number) =>
        value >= 0 ? 'rgba(38, 194, 129, 0.2)' : 'rgba(231, 76, 60, 0.2)',
      bottomColor: 'rgba(0, 0, 0, 0)',
      lineWidth: 2,
      priceFormat: {
        type: 'price',
        precision: 2,
        minMove: 0.01,
      },
    }
  }

  /**
   * Validate and sanitize chart data
   */
  validateChartData(data: any[]): boolean {
    if (!Array.isArray(data) || data.length === 0) {
      return false
    }

    // Check for required fields
    return data.every((item) => {
      // For OHLCV data
      if ('open' in item) {
        return (
          typeof item.time === 'number' &&
          typeof item.open === 'number' &&
          typeof item.high === 'number' &&
          typeof item.low === 'number' &&
          typeof item.close === 'number'
        )
      }

      // For simple price data
      return typeof item.time === 'number' && typeof item.value === 'number'
    })
  }

  /**
   * Get watermark text for chart
   */
  getWatermark(symbol: string, interval: string): string {
    return `${symbol} - ${interval.toUpperCase()}`
  }
}

export default new ChartService()
