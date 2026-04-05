/**
 * Positions Store
 * Manages open positions with real-time P&L tracking and position lifecycle
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiService from '@/services/api'
import websocketService from '@/services/websocket'
import type { Position } from '@/types/api'
import { ApiError } from '@/utils/errors'

interface PositionFilter {
  profitableOnly?: boolean
  symbol?: string
  minPnl?: number
  maxPnl?: number
}

type SortField = 'symbol' | 'quantity' | 'pnl' | 'pnlPercent' | 'unrealizedValue'
type SortOrder = 'asc' | 'desc'

export const usePositionsStore = defineStore('positions', () => {
  // ============================================================================
  // State
  // ============================================================================

  const positions = ref<Position[]>([])
  const loadingPositions = ref(false)
  const errorPositions = ref<ApiError | null>(null)
  const lastUpdated = ref<number | null>(null)

  // Tracking position lifecycle
  const openedPositions = ref<Set<string>>(new Set())
  const closedPositions = ref<Set<string>>(new Set())

  // Filter and sort state
  const activeFilter = ref<PositionFilter>({})
  const sortField = ref<SortField>('pnl')
  const sortOrder = ref<SortOrder>('desc')

  // ============================================================================
  // Computed
  // ============================================================================

  /**
   * Total number of open positions
   */
  const totalPositions = computed(() => positions.value.length)

  /**
   * Profitable positions count
   */
  const profitableCount = computed(() => {
    return positions.value.filter((p) => p.pnl > 0).length
  })

  /**
   * Losing positions count
   */
  const losingCount = computed(() => {
    return positions.value.filter((p) => p.pnl < 0).length
  })

  /**
   * Win rate percentage
   */
  const winRate = computed(() => {
    if (totalPositions.value === 0) return 0
    return (profitableCount.value / totalPositions.value) * 100
  })

  /**
   * Total unrealized P&L
   */
  const totalUnrealizedPnl = computed(() => {
    return positions.value.reduce((sum, p) => sum + p.pnl, 0)
  })

  /**
   * Total unrealized P&L percentage
   */
  const totalUnrealizedPnlPercent = computed(() => {
    const investedBalance = positions.value.reduce(
      (sum, p) => sum + p.quantity * p.entryPrice,
      0
    )
    if (investedBalance === 0) return 0
    return (totalUnrealizedPnl.value / investedBalance) * 100
  })

  /**
   * Total notional exposure
   */
  const totalExposure = computed(() => {
    return positions.value.reduce(
      (sum, p) => sum + Math.abs(p.quantity * p.currentPrice),
      0
    )
  })

  /**
   * Average P&L across positions
   */
  const averagePnl = computed(() => {
    if (totalPositions.value === 0) return 0
    return totalUnrealizedPnl.value / totalPositions.value
  })

  /**
   * Best performing position
   */
  const bestPosition = computed(() => {
    if (positions.value.length === 0) return null
    return positions.value.reduce((best, p) =>
      p.pnlPercent > best.pnlPercent ? p : best
    )
  })

  /**
   * Worst performing position
   */
  const worstPosition = computed(() => {
    if (positions.value.length === 0) return null
    return positions.value.reduce((worst, p) =>
      p.pnlPercent < worst.pnlPercent ? p : worst
    )
  })

  /**
   * Filtered and sorted positions
   */
  const filteredPositions = computed(() => {
    let filtered = positions.value

    // Apply filters
    if (activeFilter.value.profitableOnly) {
      filtered = filtered.filter((p) => p.pnl > 0)
    }
    if (activeFilter.value.symbol) {
      filtered = filtered.filter((p) =>
        p.symbol.toLowerCase().includes(activeFilter.value.symbol!.toLowerCase())
      )
    }
    if (activeFilter.value.minPnl !== undefined) {
      filtered = filtered.filter((p) => p.pnl >= activeFilter.value.minPnl!)
    }
    if (activeFilter.value.maxPnl !== undefined) {
      filtered = filtered.filter((p) => p.pnl <= activeFilter.value.maxPnl!)
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let aVal: any = a[sortField.value]
      let bVal: any = b[sortField.value]

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
   * Group positions by symbol
   */
  const positionsBySymbol = computed(() => {
    const grouped = new Map<string, Position[]>()
    positions.value.forEach((p) => {
      if (!grouped.has(p.symbol)) {
        grouped.set(p.symbol, [])
      }
      grouped.get(p.symbol)!.push(p)
    })
    return grouped
  })

  /**
   * Max risk exposure across all positions
   */
  const maxRiskExposure = computed(() => {
    return positions.value.reduce((max, p) => {
      const risk = Math.abs(p.pnl)
      return risk > max ? risk : max
    }, 0)
  })

  /**
   * Get position by ID
   */
  const getPositionById = (id: string) => {
    return positions.value.find((p) => p.id === id)
  }

  /**
   * Get positions by symbol
   */
  const getPositionsBySymbol = (symbol: string) => {
    return positions.value.filter((p) => p.symbol === symbol)
  }

  const isLoading = computed(() => loadingPositions.value)
  const hasError = computed(() => errorPositions.value !== null)

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Fetch positions from API
   */
  async function fetchPositions() {
    loadingPositions.value = true
    errorPositions.value = null

    try {
      const response = await apiService.getPositions()
      if (response.success && response.data) {
        positions.value = response.data
        lastUpdated.value = Date.now()

        // Track newly opened positions
        response.data.forEach((pos) => {
          openedPositions.value.add(pos.id)
        })
      } else {
        errorPositions.value = new ApiError(
          'FETCH_POSITIONS_ERROR',
          response.error?.message || 'Failed to fetch positions'
        )
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      errorPositions.value = new ApiError('POSITIONS_FETCH_ERROR', err.message)
    } finally {
      loadingPositions.value = false
    }
  }

  /**
   * Handle position opened event from WebSocket
   */
  function handlePositionOpened(data: Position) {
    const existingIndex = positions.value.findIndex((p) => p.id === data.id)
    if (existingIndex === -1) {
      positions.value.push(data)
      openedPositions.value.add(data.id)
    }
    lastUpdated.value = Date.now()
  }

  /**
   * Handle position updated event from WebSocket
   */
  function handlePositionUpdated(data: Position) {
    const index = positions.value.findIndex((p) => p.id === data.id)
    if (index !== -1) {
      positions.value[index] = data
    } else {
      positions.value.push(data)
    }
    lastUpdated.value = Date.now()
  }

  /**
   * Handle position closed event from WebSocket
   */
  function handlePositionClosed(data: Position) {
    const index = positions.value.findIndex((p) => p.id === data.id)
    if (index !== -1) {
      positions.value.splice(index, 1)
      closedPositions.value.add(data.id)
      openedPositions.value.delete(data.id)
    }
    lastUpdated.value = Date.now()
  }

  /**
   * Subscribe to WebSocket position updates
   */
  function subscribeToUpdates() {
    const unsubscribe1 = websocketService.subscribe(
      'position:opened',
      handlePositionOpened
    )
    const unsubscribe2 = websocketService.subscribe(
      'position:updated',
      handlePositionUpdated
    )
    const unsubscribe3 = websocketService.subscribe(
      'position:closed',
      handlePositionClosed
    )

    return () => {
      unsubscribe1()
      unsubscribe2()
      unsubscribe3()
    }
  }

  /**
   * Add position from WebSocket event (called by realtime orchestrator)
   */
  function addPositionFromWS(data: Position) {
    handlePositionOpened(data)
  }

  /**
   * Update position from WebSocket event (called by realtime orchestrator)
   */
  function updatePositionFromWS(data: Position) {
    handlePositionUpdated(data)
  }

  /**
   * Remove position from WebSocket event (called by realtime orchestrator)
   */
  function removePositionFromWS(data: Position) {
    handlePositionClosed(data)
  }

  /**
   * Set filter
   */
  function setFilter(filter: PositionFilter) {
    activeFilter.value = filter
  }

  /**
   * Clear filter
   */
  function clearFilter() {
    activeFilter.value = {}
  }

  /**
   * Set sort
   */
  function setSortBy(field: SortField, order: SortOrder = 'desc') {
    sortField.value = field
    sortOrder.value = order
  }

  /**
   * Clear error
   */
  function clearError() {
    errorPositions.value = null
  }

  /**
   * Reset store
   */
  function reset() {
    positions.value = []
    loadingPositions.value = false
    errorPositions.value = null
    lastUpdated.value = null
    openedPositions.value.clear()
    closedPositions.value.clear()
    activeFilter.value = {}
    sortField.value = 'pnl'
    sortOrder.value = 'desc'
  }

  return {
    // State
    positions,
    loadingPositions,
    errorPositions,
    lastUpdated,
    openedPositions,
    closedPositions,
    activeFilter,
    sortField,
    sortOrder,

    // Computed - Counts & Metrics
    totalPositions,
    profitableCount,
    losingCount,
    winRate,
    totalUnrealizedPnl,
    totalUnrealizedPnlPercent,
    totalExposure,
    averagePnl,
    bestPosition,
    worstPosition,
    maxRiskExposure,

    // Computed - Filtered/Grouped
    filteredPositions,
    positionsBySymbol,

    // Computed - Lookups
    getPositionById,
    getPositionsBySymbol,

    // Computed - Status
    isLoading,
    hasError,

    // Actions
    fetchPositions,
    handlePositionOpened,
    handlePositionUpdated,
    handlePositionClosed,
    addPositionFromWS,
    updatePositionFromWS,
    removePositionFromWS,
    subscribeToUpdates,
    setFilter,
    clearFilter,
    setSortBy,
    clearError,
    reset,
  }
})
