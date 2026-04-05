/**
 * Market Data Store
 * Real-time price tickers, market data streams, and price history tracking
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import websocketService from '@/services/websocket'
import type { Ticker, MarketData, OHLCV } from '@/types/api'

interface PriceHistoryEntry {
  timestamp: number
  price: number
}

interface MarketDataCache {
  ticker: Ticker
  priceHistory: PriceHistoryEntry[]
}

export const useMarketStore = defineStore('market', () => {
  // ============================================================================
  // State
  // ============================================================================

  const tickers = ref<Map<string, Ticker>>(new Map())
  const marketDataCache = ref<Map<string, MarketDataCache>>(new Map())
  const watchedSymbols = ref<Set<string>>(new Set())
  const lastUpdated = ref<number | null>(null)

  // Cache settings
  const maxPriceHistoryLength = 1000 // Keep 1000 price points per symbol

  // ============================================================================
  // Computed
  // ============================================================================

  /**
   * Get ticker by symbol
   */
  const getTicker = (symbol: string) => {
    return tickers.value.get(symbol) || null
  }

  /**
   * All tickers as array
   */
  const allTickers = computed(() => {
    return Array.from(tickers.value.values())
  })

  /**
   * Get price for symbol
   */
  const getPrice = (symbol: string) => {
    return tickers.value.get(symbol)?.lastPrice ?? 0
  }

  /**
   * Get bid price
   */
  const getBid = (symbol: string) => {
    return tickers.value.get(symbol)?.bid ?? 0
  }

  /**
   * Get ask price
   */
  const getAsk = (symbol: string) => {
    return tickers.value.get(symbol)?.ask ?? 0
  }

  /**
   * Get bid-ask spread
   */
  const getSpread = (symbol: string) => {
    const ticker = tickers.value.get(symbol)
    if (!ticker) return 0
    return ticker.ask - ticker.bid
  }

  /**
   * Get spread percentage
   */
  const getSpreadPercent = (symbol: string) => {
    const ticker = tickers.value.get(symbol)
    if (!ticker || ticker.lastPrice === 0) return 0
    return ((ticker.ask - ticker.bid) / ticker.lastPrice) * 100
  }

  /**
   * Get 24h price change
   */
  const getPriceChange24h = (symbol: string) => {
    return tickers.value.get(symbol)?.priceChange24h ?? 0
  }

  /**
   * Get 24h price change percent
   */
  const getPriceChangePercent24h = (symbol: string) => {
    return tickers.value.get(symbol)?.priceChangePercent24h ?? 0
  }

  /**
   * Get 24h high
   */
  const getHigh24h = (symbol: string) => {
    return tickers.value.get(symbol)?.high24h ?? 0
  }

  /**
   * Get 24h low
   */
  const getLow24h = (symbol: string) => {
    return tickers.value.get(symbol)?.low24h ?? 0
  }

  /**
   * Get 24h volume
   */
  const getVolume24h = (symbol: string) => {
    return tickers.value.get(symbol)?.volume24h ?? 0
  }

  /**
   * Get formatted price
   */
  const formatPrice = (symbol: string): string => {
    const price = getPrice(symbol)
    if (price === 0) return '$0.00'
    if (price < 0.01) return `$${price.toFixed(6)}`
    if (price < 1) return `$${price.toFixed(4)}`
    return `$${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  }

  /**
   * Get formatted change
   */
  const formatChange = (symbol: string): string => {
    const change = getPriceChange24h(symbol)
    if (change === 0) return '$0.00'
    const sign = change > 0 ? '+' : ''
    return `${sign}$${change.toFixed(2)}`
  }

  /**
   * Get formatted change percent
   */
  const formatChangePercent = (symbol: string): string => {
    const changePercent = getPriceChangePercent24h(symbol)
    if (changePercent === 0) return '0.00%'
    const sign = changePercent > 0 ? '+' : ''
    return `${sign}${changePercent.toFixed(2)}%`
  }

  /**
   * Get price change color (up/down)
   */
  const getPriceChangeColor = (symbol: string): string => {
    const change = getPriceChange24h(symbol)
    if (change > 0) return 'text-green-500'
    if (change < 0) return 'text-red-500'
    return 'text-gray-400'
  }

  /**
   * Get price history for symbol
   */
  const getPriceHistory = (symbol: string): PriceHistoryEntry[] => {
    const cache = marketDataCache.value.get(symbol)
    return cache?.priceHistory ?? []
  }

  /**
   * Get highest price in history
   */
  const getHistoryHigh = (symbol: string): number => {
    const history = getPriceHistory(symbol)
    if (history.length === 0) return 0
    return Math.max(...history.map((h) => h.price))
  }

  /**
   * Get lowest price in history
   */
  const getHistoryLow = (symbol: string): number => {
    const history = getPriceHistory(symbol)
    if (history.length === 0) return 0
    return Math.min(...history.map((h) => h.price))
  }

  /**
   * Get average price in history
   */
  const getHistoryAverage = (symbol: string): number => {
    const history = getPriceHistory(symbol)
    if (history.length === 0) return 0
    const sum = history.reduce((acc, h) => acc + h.price, 0)
    return sum / history.length
  }

  /**
   * Check if symbol is watched
   */
  const isWatched = (symbol: string): boolean => {
    return watchedSymbols.value.has(symbol)
  }

  /**
   * Get all watched symbols
   */
  const allWatchedSymbols = computed(() => {
    return Array.from(watchedSymbols.value)
  })

  /**
   * Get tickers for watched symbols
   */
  const watchedTickers = computed(() => {
    return allWatchedSymbols.value
      .map((symbol) => tickers.value.get(symbol))
      .filter((ticker) => ticker !== undefined) as Ticker[]
  })

  /**
   * Top gainers (by 24h change percent)
   */
  const topGainers = computed(() => {
    return allTickers.value
      .sort(
        (a, b) => (b.priceChangePercent24h || 0) - (a.priceChangePercent24h || 0)
      )
      .slice(0, 10)
  })

  /**
   * Top losers (by 24h change percent)
   */
  const topLosers = computed(() => {
    return allTickers.value
      .sort(
        (a, b) => (a.priceChangePercent24h || 0) - (b.priceChangePercent24h || 0)
      )
      .slice(0, 10)
  })

  /**
   * Highest volume
   */
  const highestVolume = computed(() => {
    return allTickers.value
      .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))
      .slice(0, 10)
  })

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Handle ticker update from WebSocket
   */
  function handleTickerUpdate(data: Ticker) {
    tickers.value.set(data.symbol, data)

    // Update price history
    let cache = marketDataCache.value.get(data.symbol)
    if (!cache) {
      cache = {
        ticker: data,
        priceHistory: [],
      }
      marketDataCache.value.set(data.symbol, cache)
    }

    // Add price to history
    cache.priceHistory.push({
      timestamp: new Date(data.timestamp).getTime(),
      price: data.lastPrice,
    })

    // Keep only the latest entries
    if (cache.priceHistory.length > maxPriceHistoryLength) {
      cache.priceHistory.shift()
    }

    lastUpdated.value = Date.now()
  }

  /**
   * Handle market data from WebSocket (OHLCV candles)
   */
  function handleMarketData(data: MarketData) {
    // Update or create ticker with latest candle data
    const candles = data.candles ?? []
    if (candles.length === 0) return

    const latestCandle = candles[candles.length - 1]
    if (latestCandle) {
      let cache = marketDataCache.value.get(data.symbol)
      if (!cache) {
        cache = {
          ticker: {
            symbol: data.symbol,
            lastPrice: latestCandle.close,
            bid: latestCandle.close * 0.99, // Estimate
            ask: latestCandle.close * 1.01, // Estimate
            high24h: latestCandle.high,
            low24h: latestCandle.low,
            volume24h: latestCandle.volume,
            priceChange24h: 0,
            priceChangePercent24h: 0,
            timestamp: new Date().toISOString(),
          },
          priceHistory: [],
        }
        marketDataCache.value.set(data.symbol, cache)
        tickers.value.set(data.symbol, cache.ticker)
      }

      // Update price history with all candles
      candles.forEach((candle) => {
        const existing = cache!.priceHistory.find(
          (h) => h.timestamp === candle.time * 1000
        )
        if (!existing) {
          cache!.priceHistory.push({
            timestamp: candle.time * 1000,
            price: candle.close,
          })
        }
      })

      // Trim history
      if (cache.priceHistory.length > maxPriceHistoryLength) {
        cache.priceHistory = cache.priceHistory.slice(
          -maxPriceHistoryLength
        )
      }
    }

    lastUpdated.value = Date.now()
  }

  /**
   * Subscribe to ticker updates
   */
  function subscribeToTickerUpdates() {
    return websocketService.subscribe('ticker:update', handleTickerUpdate)
  }

  /**
   * Subscribe to market data (OHLCV)
   */
  function subscribeToMarketData() {
    return websocketService.subscribe('market:data', handleMarketData)
  }

  /**
   * Subscribe to specific symbol
   */
  function watchSymbol(symbol: string) {
    watchedSymbols.value.add(symbol)
    // In a real app, you might emit a custom event to the server to subscribe
    // For now, just track locally
  }

  /**
   * Unwatch specific symbol
   */
  function unwatchSymbol(symbol: string) {
    watchedSymbols.value.delete(symbol)
    // In a real app, you might emit a custom event to the server to unsubscribe
    // For now, just track locally
  }

  /**
   * Clear all price history
   */
  function clearPriceHistory(symbol?: string) {
    if (symbol) {
      const cache = marketDataCache.value.get(symbol)
      if (cache) {
        cache.priceHistory = []
      }
    } else {
      marketDataCache.value.forEach((cache) => {
        cache.priceHistory = []
      })
    }
  }

  /**
   * Reset store
   */
  function reset() {
    tickers.value.clear()
    marketDataCache.value.clear()
    watchedSymbols.value.clear()
    lastUpdated.value = null
  }

  return {
    // State
    tickers,
    marketDataCache,
    watchedSymbols,
    lastUpdated,

    // Computed - Price Data
    getTicker,
    allTickers,
    getPrice,
    getBid,
    getAsk,
    getSpread,
    getSpreadPercent,

    // Computed - 24h Changes
    getPriceChange24h,
    getPriceChangePercent24h,
    getHigh24h,
    getLow24h,
    getVolume24h,

    // Computed - Formatting
    formatPrice,
    formatChange,
    formatChangePercent,
    getPriceChangeColor,

    // Computed - Price History
    getPriceHistory,
    getHistoryHigh,
    getHistoryLow,
    getHistoryAverage,

    // Computed - Watched Symbols
    isWatched,
    allWatchedSymbols,
    watchedTickers,

    // Computed - Market Analysis
    topGainers,
    topLosers,
    highestVolume,

    // Actions
    handleTickerUpdate,
    handleMarketData,
    subscribeToTickerUpdates,
    subscribeToMarketData,
    watchSymbol,
    unwatchSymbol,
    clearPriceHistory,
    reset,
  }
})
