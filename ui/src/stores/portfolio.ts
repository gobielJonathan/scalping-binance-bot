/**
 * Portfolio Store
 * Manages portfolio state including balance, equity, P&L, and real-time updates
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiService from '@/services/api'
import websocketService from '@/services/websocket'
import type { Portfolio } from '@/types/api'
import { ApiError } from '@/utils/errors'

interface PortfolioState {
  portfolio: Portfolio | null
  loadingPortfolio: boolean
  errorPortfolio: ApiError | null
  lastUpdated: number | null
}

export const usePortfolioStore = defineStore('portfolio', () => {
  // ============================================================================
  // State
  // ============================================================================

  const portfolio = ref<Portfolio | null>(null)
  const loadingPortfolio = ref(false)
  const errorPortfolio = ref<ApiError | null>(null)
  const lastUpdated = ref<number | null>(null)

  // Store historical data for P&L calculations
  const balanceHistory = ref<Array<{ timestamp: number; balance: number }>>([])
  const equityHistory = ref<Array<{ timestamp: number; equity: number }>>([])

  // ============================================================================
  // Computed
  // ============================================================================

  const currentBalance = computed(() => portfolio.value?.totalBalance ?? 0)
  const availableBalance = computed(() => portfolio.value?.availableBalance ?? 0)
  const lockedFunds = computed(() => currentBalance.value - availableBalance.value)
  const equity = computed(() => portfolio.value?.equity ?? 0)
  const investedBalance = computed(() => portfolio.value?.investedBalance ?? 0)

  // P&L calculations
  const totalPnl = computed(() => portfolio.value?.pnl ?? 0)
  const totalPnlPercent = computed(() => portfolio.value?.pnlPercent ?? 0)
  const pnlColor = computed(() => {
    if (totalPnl.value > 0) return 'text-green-500'
    if (totalPnl.value < 0) return 'text-red-500'
    return 'text-gray-400'
  })

  // Period-based P&L (calculated from history)
  const dailyPnl = computed(() => {
    if (equityHistory.value.length < 2) return 0
    const now = Date.now()
    const oneDayAgo = now - 24 * 60 * 60 * 1000
    const oldEntry = equityHistory.value.find(
      (e) => e.timestamp <= oneDayAgo
    )
    if (!oldEntry) return 0
    return equity.value - oldEntry.equity
  })

  const dailyPnlPercent = computed(() => {
    if (equityHistory.value.length < 2) return 0
    const oldEquity = equityHistory.value.find(
      (e) => e.timestamp <= Date.now() - 24 * 60 * 60 * 1000
    )?.equity
    if (!oldEquity || oldEquity === 0) return 0
    return ((dailyPnl.value / oldEquity) * 100)
  })

  const weeklyPnl = computed(() => {
    if (equityHistory.value.length < 2) return 0
    const now = Date.now()
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000
    const oldEntry = equityHistory.value.find(
      (e) => e.timestamp <= oneWeekAgo
    )
    if (!oldEntry) return 0
    return equity.value - oldEntry.equity
  })

  const weeklyPnlPercent = computed(() => {
    if (equityHistory.value.length < 2) return 0
    const oldEquity = equityHistory.value.find(
      (e) => e.timestamp <= Date.now() - 7 * 24 * 60 * 60 * 1000
    )?.equity
    if (!oldEquity || oldEquity === 0) return 0
    return ((weeklyPnl.value / oldEquity) * 100)
  })

  const monthlyPnl = computed(() => {
    if (equityHistory.value.length < 2) return 0
    const now = Date.now()
    const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000
    const oldEntry = equityHistory.value.find(
      (e) => e.timestamp <= oneMonthAgo
    )
    if (!oldEntry) return 0
    return equity.value - oldEntry.equity
  })

  const monthlyPnlPercent = computed(() => {
    if (equityHistory.value.length < 2) return 0
    const oldEquity = equityHistory.value.find(
      (e) => e.timestamp <= Date.now() - 30 * 24 * 60 * 60 * 1000
    )?.equity
    if (!oldEquity || oldEquity === 0) return 0
    return ((monthlyPnl.value / oldEquity) * 100)
  })

  // Max Drawdown calculation
  const maxDrawdown = computed(() => {
    if (equityHistory.value.length < 2) return 0
    const firstEntry = equityHistory.value[0]
    if (!firstEntry) return 0
    let peak = firstEntry.equity
    let maxDD = 0
    equityHistory.value.forEach((entry) => {
      if (entry.equity > peak) {
        peak = entry.equity
      }
      const drawdown = ((peak - entry.equity) / peak) * 100
      if (drawdown > maxDD) {
        maxDD = drawdown
      }
    })
    return maxDD
  })

  // Equity curve statistics
  const currentDrawdown = computed(() => {
    if (equityHistory.value.length === 0) return 0
    const peak = Math.max(...equityHistory.value.map((e) => e.equity))
    return ((peak - equity.value) / peak) * 100
  })

  const winRateQualifier = computed(() => {
    if (totalPnlPercent.value > 20) return 'Excellent'
    if (totalPnlPercent.value > 10) return 'Very Good'
    if (totalPnlPercent.value > 0) return 'Good'
    if (totalPnlPercent.value > -10) return 'Fair'
    return 'Poor'
  })

  const isLoading = computed(() => loadingPortfolio.value)
  const hasError = computed(() => errorPortfolio.value !== null)

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Fetch portfolio data from API
   */
  async function fetchPortfolio() {
    loadingPortfolio.value = true
    errorPortfolio.value = null

    try {
      const response = await apiService.getPortfolio()
      if (response.success && response.data) {
        portfolio.value = response.data
        lastUpdated.value = Date.now()

        // Add to history for P&L calculations
        balanceHistory.value.push({
          timestamp: Date.now(),
          balance: response.data.totalBalance,
        })
        equityHistory.value.push({
          timestamp: Date.now(),
          equity: response.data.equity,
        })

        // Keep only 30 days of history
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
        balanceHistory.value = balanceHistory.value.filter(
          (h) => h.timestamp > thirtyDaysAgo
        )
        equityHistory.value = equityHistory.value.filter(
          (h) => h.timestamp > thirtyDaysAgo
        )
      } else {
        errorPortfolio.value = new ApiError(
          'FETCH_PORTFOLIO_ERROR',
          response.error?.message || 'Failed to fetch portfolio'
        )
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      errorPortfolio.value = new ApiError(
        'PORTFOLIO_FETCH_ERROR',
        err.message
      )
    } finally {
      loadingPortfolio.value = false
    }
  }

  /**
   * Handle portfolio updates from WebSocket
   */
  function handlePortfolioUpdate(data: Portfolio) {
    portfolio.value = data
    lastUpdated.value = Date.now()
    errorPortfolio.value = null

    // Update history
    balanceHistory.value.push({
      timestamp: Date.now(),
      balance: data.totalBalance,
    })
    equityHistory.value.push({
      timestamp: Date.now(),
      equity: data.equity,
    })

    // Keep only 30 days of history
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
    balanceHistory.value = balanceHistory.value.filter(
      (h) => h.timestamp > thirtyDaysAgo
    )
    equityHistory.value = equityHistory.value.filter(
      (h) => h.timestamp > thirtyDaysAgo
    )
  }

  /**
   * Subscribe to WebSocket portfolio updates
   */
  function subscribeToUpdates() {
    return websocketService.subscribe('portfolio:updated', handlePortfolioUpdate)
  }

  /**
   * Update portfolio from WebSocket event (called by realtime orchestrator)
   */
  function updatePortfolioFromWS(data: Portfolio) {
    handlePortfolioUpdate(data)
  }

  /**
   * Clear error
   */
  function clearError() {
    errorPortfolio.value = null
  }

  /**
   * Reset store
   */
  function reset() {
    portfolio.value = null
    loadingPortfolio.value = false
    errorPortfolio.value = null
    lastUpdated.value = null
    balanceHistory.value = []
    equityHistory.value = []
  }

  return {
    // State
    portfolio,
    loadingPortfolio,
    errorPortfolio,
    lastUpdated,
    balanceHistory,
    equityHistory,

    // Computed - Balance & Equity
    currentBalance,
    availableBalance,
    lockedFunds,
    equity,
    investedBalance,

    // Computed - P&L
    totalPnl,
    totalPnlPercent,
    pnlColor,
    dailyPnl,
    dailyPnlPercent,
    weeklyPnl,
    weeklyPnlPercent,
    monthlyPnl,
    monthlyPnlPercent,

    // Computed - Risk Metrics
    maxDrawdown,
    currentDrawdown,
    winRateQualifier,

    // Computed - Status
    isLoading,
    hasError,

    // Actions
    fetchPortfolio,
    handlePortfolioUpdate,
    updatePortfolioFromWS,
    subscribeToUpdates,
    clearError,
    reset,
  }
})
