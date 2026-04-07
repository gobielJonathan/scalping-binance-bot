/**
 * Trades Store
 * Manages trade history with pagination, statistics, and real-time trade execution updates
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiService from '@/services/api'
import websocketService from '@/services/websocket'
import type { Trade, Order } from '@/types/api'
import { ApiError } from '@/utils/errors'

interface TradeFilter {
  symbol?: string
  startDate?: number
  endDate?: number
  profitable?: boolean
  minPnl?: number
  maxPnl?: number
}

type SortField = 'executedAt' | 'pnl' | 'pnlPercent' | 'quantity' | 'price'
type SortOrder = 'asc' | 'desc'

export const useTradesStore = defineStore('trades', () => {
  // ============================================================================
  // State
  // ============================================================================

  const trades = ref<Trade[]>([])
  const recentTrades = ref<Trade[]>([]) // Last 10 trades for dashboard
  const loadingTrades = ref(false)
  const errorTrades = ref<ApiError | null>(null)
  const lastUpdated = ref<number | null>(null)

  // Pagination
  const currentPage = ref(1)
  const pageSize = ref(50)
  const totalTrades = ref(0)

  // Filter and sort state
  const activeFilter = ref<TradeFilter>({})
  const sortField = ref<SortField>('executedAt')
  const sortOrder = ref<SortOrder>('desc')

  // ============================================================================
  // Computed - Statistics
  // ============================================================================

  /**
   * Total number of trades (from all pages)
   */
  const totalCount = computed(() => totalTrades.value)

  /**
   * Winning trades count
   */
  const winCount = computed(() => {
    return trades.value.filter((t) => t.pnl && t.pnl > 0).length
  })

  /**
   * Losing trades count
   */
  const lossCount = computed(() => {
    return trades.value.filter((t) => t.pnl && t.pnl < 0).length
  })

  /**
   * Breakeven trades count
   */
  const breakEvenCount = computed(() => {
    return trades.value.filter((t) => t.pnl === 0).length
  })

  /**
   * Win rate percentage
   */
  const winRate = computed(() => {
    const completed = winCount.value + lossCount.value
    if (completed === 0) return 0
    return (winCount.value / completed) * 100
  })

  /**
   * Total realized P&L
   */
  const totalPnl = computed(() => {
    return trades.value.reduce((sum, t) => sum + (t.pnl || 0), 0)
  })

  /**
   * Total realized P&L percentage
   */
  const totalPnlPercent = computed(() => {
    const totalCost = trades.value.reduce(
      (sum, t) => sum + t.quantity * t.price,
      0
    )
    if (totalCost === 0) return 0
    return (totalPnl.value / totalCost) * 100
  })

  /**
   * Average profit per winning trade
   */
  const avgWinSize = computed(() => {
    if (winCount.value === 0) return 0
    const totalWins = trades.value
      .filter((t) => t.pnl && t.pnl > 0)
      .reduce((sum, t) => sum + (t.pnl || 0), 0)
    return totalWins / winCount.value
  })

  /**
   * Average loss per losing trade
   */
  const avgLossSize = computed(() => {
    if (lossCount.value === 0) return 0
    const totalLosses = trades.value
      .filter((t) => t.pnl && t.pnl < 0)
      .reduce((sum, t) => sum + (t.pnl || 0), 0)
    return Math.abs(totalLosses / lossCount.value)
  })

  /**
   * Profit factor (total wins / total losses)
   */
  const profitFactor = computed(() => {
    const totalWins = trades.value
      .filter((t) => t.pnl && t.pnl > 0)
      .reduce((sum, t) => sum + (t.pnl || 0), 0)
    const totalLosses = Math.abs(
      trades.value
        .filter((t) => t.pnl && t.pnl < 0)
        .reduce((sum, t) => sum + (t.pnl || 0), 0)
    )
    if (totalLosses === 0) return totalWins > 0 ? Infinity : 0
    return totalWins / totalLosses
  })

  /**
   * Risk/Reward ratio
   */
  const riskRewardRatio = computed(() => {
    if (avgLossSize.value === 0) return 0
    return avgWinSize.value / avgLossSize.value
  })

  /**
   * Best trade
   */
  const bestTrade = computed(() => {
    if (trades.value.length === 0) return null
    return trades.value.reduce((best, t) =>
      (t.pnl || 0) > (best.pnl || 0) ? t : best
    )
  })

  /**
   * Worst trade
   */
  const worstTrade = computed(() => {
    if (trades.value.length === 0) return null
    return trades.value.reduce((worst, t) =>
      (t.pnl || 0) < (worst.pnl || 0) ? t : worst
    )
  })

  /**
   * Consecutive wins
   */
  const consecutiveWins = computed(() => {
    let maxStreak = 0
    let currentStreak = 0
    for (const trade of trades.value) {
      if (trade.pnl && trade.pnl > 0) {
        currentStreak++
        maxStreak = Math.max(maxStreak, currentStreak)
      } else {
        currentStreak = 0
      }
    }
    return maxStreak
  })

  /**
   * Consecutive losses
   */
  const consecutiveLosses = computed(() => {
    let maxStreak = 0
    let currentStreak = 0
    for (const trade of trades.value) {
      if (trade.pnl && trade.pnl < 0) {
        currentStreak++
        maxStreak = Math.max(maxStreak, currentStreak)
      } else {
        currentStreak = 0
      }
    }
    return maxStreak
  })

  /**
   * Average trade duration (if timestamps available)
   */
  const avgTradeDuration = computed(() => {
    if (trades.value.length < 2) return 0
    const durations = trades.value
      .filter((t) => t.executedAt)
      .map((t, idx, arr) => {
        if (idx === 0) return 0
        const prevTrade = arr[idx - 1]
        if (!prevTrade) return 0
        return (
          new Date(t.executedAt).getTime() -
          new Date(prevTrade.executedAt).getTime()
        )
      })
    const total = durations.reduce((sum, d) => sum + d, 0)
    return Math.floor(total / trades.value.length / 1000 / 60) // Convert to minutes
  })

  /**
   * Trades by symbol
   */
  const tradesBySymbol = computed(() => {
    const grouped = new Map<string, Trade[]>()
    trades.value.forEach((t) => {
      if (!grouped.has(t.symbol)) {
        grouped.set(t.symbol, [])
      }
      grouped.get(t.symbol)!.push(t)
    })
    return grouped
  })

  /**
   * Symbol performance (P&L by symbol)
   */
  const symbolPerformance = computed(() => {
    const perf = new Map<
      string,
      { pnl: number; pnlPercent: number; tradeCount: number }
    >()
    trades.value.forEach((t) => {
      const existing = perf.get(t.symbol) || {
        pnl: 0,
        pnlPercent: 0,
        tradeCount: 0,
      }
      existing.pnl += t.pnl || 0
      existing.tradeCount += 1
      perf.set(t.symbol, existing)
    })
    // Calculate pnlPercent for each symbol
    perf.forEach((stats, symbol) => {
      const symbolTrades = tradesBySymbol.value.get(symbol) || []
      const totalCost = symbolTrades.reduce(
        (sum, t) => sum + t.quantity * t.price,
        0
      )
      stats.pnlPercent = totalCost > 0 ? (stats.pnl / totalCost) * 100 : 0
    })
    return perf
  })

  /**
   * Filtered and sorted trades
   */
  const filteredTrades = computed(() => {
    let filtered = trades.value

    // Apply filters
    if (activeFilter.value.symbol) {
      filtered = filtered.filter((t) =>
        t.symbol
          .toLowerCase()
          .includes(activeFilter.value.symbol!.toLowerCase())
      )
    }
    if (activeFilter.value.startDate) {
      filtered = filtered.filter(
        (t) => new Date(t.executedAt).getTime() >= activeFilter.value.startDate!
      )
    }
    if (activeFilter.value.endDate) {
      filtered = filtered.filter(
        (t) => new Date(t.executedAt).getTime() <= activeFilter.value.endDate!
      )
    }
    if (activeFilter.value.profitable !== undefined) {
      filtered = filtered.filter((t) =>
        activeFilter.value.profitable
          ? (t.pnl || 0) > 0
          : (t.pnl || 0) < 0
      )
    }
    if (activeFilter.value.minPnl !== undefined) {
      filtered = filtered.filter((t) => (t.pnl || 0) >= activeFilter.value.minPnl!)
    }
    if (activeFilter.value.maxPnl !== undefined) {
      filtered = filtered.filter((t) => (t.pnl || 0) <= activeFilter.value.maxPnl!)
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let aVal: any = a[sortField.value]
      let bVal: any = b[sortField.value]

      if (sortField.value === 'executedAt') {
        aVal = new Date(aVal).getTime()
        bVal = new Date(bVal).getTime()
      }

      if (typeof aVal === 'string') {
        return sortOrder.value === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }

      if (sortOrder.value === 'asc') {
        return (aVal as number) - (bVal as number)
      } else {
        return (bVal as number) - (aVal as number)
      }
    })

    return sorted
  })

  /**
   * Paginated trades
   */
  const paginatedTrades = computed(() => {
    const start = (currentPage.value - 1) * pageSize.value
    const end = start + pageSize.value
    return filteredTrades.value.slice(start, end)
  })

  /**
   * Total pages
   */
  const totalPages = computed(() => {
    return Math.ceil(filteredTrades.value.length / pageSize.value)
  })

  /**
   * Get trade by ID
   */
  const getTradeById = (id: string) => {
    return trades.value.find((t) => t.id === id)
  }

  const isLoading = computed(() => loadingTrades.value)
  const hasError = computed(() => errorTrades.value !== null)

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Fetch trades from API with pagination
   */
  async function fetchTrades(page: number = 1, limit: number = 50) {
    loadingTrades.value = true
    errorTrades.value = null
    currentPage.value = page
    pageSize.value = limit

    try {
      const response = await apiService.getAnalyticsTrades({
        limit,
        offset: (page - 1) * limit,
        sortBy: 'executedAt',
        sortOrder: 'desc',
      })

      if (response.success && response.data) {
        // Backend returns { trades, pagination } — map to expected shape
        const data = response.data as any
        trades.value = data.items ?? data.trades ?? []
        totalTrades.value = data.total ?? data.pagination?.total ?? 0
        lastUpdated.value = Date.now()
      } else {
        errorTrades.value = new ApiError(
          'FETCH_TRADES_ERROR',
          response.error?.message || 'Failed to fetch trades'
        )
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      errorTrades.value = new ApiError('TRADES_FETCH_ERROR', err.message)
    } finally {
      loadingTrades.value = false
    }
  }

  /**
   * Handle trade executed event from WebSocket
   */
  function handleTradeExecuted(data: Trade) {
    // Add to recent trades
    recentTrades.value.unshift(data)
    if (recentTrades.value.length > 10) {
      recentTrades.value.pop()
    }

    // Add to full trades list
    trades.value.unshift(data)
    totalTrades.value += 1
    lastUpdated.value = Date.now()
  }

  /**
   * Handle order created from WebSocket
   */
  function handleOrderCreated(data: Order) {
    // Store order for tracking
    lastUpdated.value = Date.now()
  }

  /**
   * Handle order updated from WebSocket
   */
  function handleOrderUpdated(data: Order) {
    // Update order status
    lastUpdated.value = Date.now()
  }

  /**
   * Subscribe to WebSocket trade updates
   */
  function subscribeToUpdates() {
    return websocketService.subscribe('trade:executed', handleTradeExecuted)
  }

  /**
   * Add trade from WebSocket event (called by realtime orchestrator)
   */
  function addTradeFromWS(data: Trade) {
    handleTradeExecuted(data)
  }

  /**
   * Add order from WebSocket event (called by realtime orchestrator)
   */
  function addOrderFromWS(data: Order) {
    handleOrderCreated(data)
  }

  /**
   * Update order from WebSocket event (called by realtime orchestrator)
   */
  function updateOrderFromWS(data: Order) {
    handleOrderUpdated(data)
  }

  /**
   * Set filter
   */
  function setFilter(filter: TradeFilter) {
    activeFilter.value = filter
    currentPage.value = 1 // Reset to first page
  }

  /**
   * Clear filter
   */
  function clearFilter() {
    activeFilter.value = {}
    currentPage.value = 1
  }

  /**
   * Set sort
   */
  function setSortBy(field: SortField, order: SortOrder = 'desc') {
    sortField.value = field
    sortOrder.value = order
  }

  /**
   * Go to page
   */
  function goToPage(page: number) {
    currentPage.value = Math.max(1, Math.min(page, totalPages.value))
  }

  /**
   * Next page
   */
  function nextPage() {
    goToPage(currentPage.value + 1)
  }

  /**
   * Previous page
   */
  function prevPage() {
    goToPage(currentPage.value - 1)
  }

  /**
   * Clear error
   */
  function clearError() {
    errorTrades.value = null
  }

  /**
   * Reset store
   */
  function reset() {
    trades.value = []
    recentTrades.value = []
    loadingTrades.value = false
    errorTrades.value = null
    lastUpdated.value = null
    currentPage.value = 1
    pageSize.value = 50
    totalTrades.value = 0
    activeFilter.value = {}
    sortField.value = 'executedAt'
    sortOrder.value = 'desc'
  }

  return {
    // State
    trades,
    recentTrades,
    loadingTrades,
    errorTrades,
    lastUpdated,
    currentPage,
    pageSize,
    totalTrades,
    activeFilter,
    sortField,
    sortOrder,

    // Computed - Statistics
    totalCount,
    winCount,
    lossCount,
    breakEvenCount,
    winRate,
    totalPnl,
    totalPnlPercent,
    avgWinSize,
    avgLossSize,
    profitFactor,
    riskRewardRatio,
    bestTrade,
    worstTrade,
    consecutiveWins,
    consecutiveLosses,
    avgTradeDuration,

    // Computed - Grouped/Analyzed
    tradesBySymbol,
    symbolPerformance,

    // Computed - Filtered/Paginated
    filteredTrades,
    paginatedTrades,
    totalPages,

    // Computed - Lookups
    getTradeById,

    // Computed - Status
    isLoading,
    hasError,

    // Actions
    fetchTrades,
    handleTradeExecuted,
    handleOrderCreated,
    handleOrderUpdated,
    addTradeFromWS,
    addOrderFromWS,
    updateOrderFromWS,
    subscribeToUpdates,
    setFilter,
    clearFilter,
    setSortBy,
    goToPage,
    nextPage,
    prevPage,
    clearError,
    reset,
  }
})
