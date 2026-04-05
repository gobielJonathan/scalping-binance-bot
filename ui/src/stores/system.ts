/**
 * System Store
 * Manages system status, API connection health, alerts, and user preferences
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import apiService from '@/services/api'
import websocketService from '@/services/websocket'
import type { SystemStatus, SystemAlert, SystemStatusEnum, AlertLevel } from '@/types/api'
import { ApiError } from '@/utils/errors'

interface UserPreferences {
  theme: 'light' | 'dark'
  notifications: {
    enabled: boolean
    sound: boolean
    desktop: boolean
  }
  dashboard: {
    refreshInterval: number
    showChart: boolean
    showOrders: boolean
  }
  trading: {
    confirmTradeExecution: boolean
    showRiskWarnings: boolean
  }
}

interface ConnectionMetrics {
  latency: number[] // Last 10 latencies in ms
  connectionErrors: number
  lastConnectionTime: number | null
  disconnections: number
}

export const useSystemStore = defineStore('system', () => {
  // ============================================================================
  // State
  // ============================================================================

  const systemStatus = ref<SystemStatus | null>(null)
  const systemAlerts = ref<SystemAlert[]>([])
  const loadingStatus = ref(false)
  const errorStatus = ref<ApiError | null>(null)
  const lastStatusUpdate = ref<number | null>(null)

  // Connection health
  const apiConnected = ref(true)
  const websocketConnected = ref(false)
  const connectionMetrics = ref<ConnectionMetrics>({
    latency: [],
    connectionErrors: 0,
    lastConnectionTime: null,
    disconnections: 0,
  })

  // User preferences
  const userPreferences = ref<UserPreferences>({
    theme: 'dark',
    notifications: {
      enabled: true,
      sound: true,
      desktop: false,
    },
    dashboard: {
      refreshInterval: 5000,
      showChart: true,
      showOrders: true,
    },
    trading: {
      confirmTradeExecution: true,
      showRiskWarnings: true,
    },
  })

  // Trading system state
  const tradingEnabled = ref(true)
  const tradingMode = ref<string>('auto') // 'auto', 'manual', 'live'
  const systemStatus_trading = ref<'running' | 'paused' | 'stopped' | 'error'>('running')

  // ============================================================================
  // Computed
  // ============================================================================

  /**
   * Get current system status
   */
  const currentStatus = computed(() => {
    return systemStatus.value?.status as SystemStatusEnum | null
  })

  /**
   * Is system healthy
   */
  const isHealthy = computed(() => {
    return (
      currentStatus.value === 'running' &&
      apiConnected.value &&
      websocketConnected.value
    )
  })

  /**
   * System uptime (in seconds)
   */
  const systemUptime = computed(() => {
    return systemStatus.value?.uptime ?? 0
  })

  /**
   * Formatted uptime
   */
  const formattedUptime = computed(() => {
    const uptime = systemUptime.value
    const days = Math.floor(uptime / 86400)
    const hours = Math.floor((uptime % 86400) / 3600)
    const minutes = Math.floor((uptime % 3600) / 60)
    const seconds = uptime % 60

    const parts = []
    if (days > 0) parts.push(`${days}d`)
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0) parts.push(`${minutes}m`)
    if (seconds > 0) parts.push(`${seconds}s`)

    return parts.join(' ') || '0s'
  })

  /**
   * Database connected
   */
  const isDatabaseConnected = computed(() => {
    return systemStatus.value?.databaseConnected ?? false
  })

  /**
   * API connected
   */
  const isApiConnected = computed(() => {
    return apiConnected.value && (systemStatus.value?.apiConnected ?? false)
  })

  /**
   * WebSocket connected
   */
  const isWebSocketConnected = computed(() => {
    return websocketConnected.value && websocketService.isConnected()
  })

  /**
   * Disk usage percentage
   */
  const diskUsage = computed(() => {
    return Math.round(systemStatus.value?.diskUsage ?? 0)
  })

  /**
   * Memory usage percentage
   */
  const memoryUsage = computed(() => {
    return Math.round(systemStatus.value?.memoryUsage ?? 0)
  })

  /**
   * CPU usage percentage
   */
  const cpuUsage = computed(() => {
    return Math.round(systemStatus.value?.cpuUsage ?? 0)
  })

  /**
   * Average API latency (ms)
   */
  const avgLatency = computed(() => {
    if (connectionMetrics.value.latency.length === 0) return 0
    const sum = connectionMetrics.value.latency.reduce((a, b) => a + b, 0)
    return Math.round(sum / connectionMetrics.value.latency.length)
  })

  /**
   * Max API latency
   */
  const maxLatency = computed(() => {
    if (connectionMetrics.value.latency.length === 0) return 0
    return Math.max(...connectionMetrics.value.latency)
  })

  /**
   * Min API latency
   */
  const minLatency = computed(() => {
    if (connectionMetrics.value.latency.length === 0) return 0
    return Math.min(...connectionMetrics.value.latency)
  })

  /**
   * Unread alerts count
   */
  const unreadAlerts = computed(() => {
    return systemAlerts.value.filter((a) => !a.read).length
  })

  /**
   * Unread critical alerts
   */
  const criticalAlerts = computed(() => {
    return systemAlerts.value.filter((a) => a.level === 'critical' && !a.read)
  })

  /**
   * Recent alerts (last 10)
   */
  const recentAlerts = computed(() => {
    return systemAlerts.value.slice(0, 10)
  })

  /**
   * Get alerts by level
   */
  const getAlertsByLevel = (level: AlertLevel) => {
    return systemAlerts.value.filter((a) => a.level === level)
  }

  /**
   * Connection status color
   */
  const connectionStatusColor = computed(() => {
    if (isHealthy.value) return 'text-green-500'
    if (apiConnected.value || websocketConnected.value) return 'text-yellow-500'
    return 'text-red-500'
  })

  /**
   * Trading enabled status
   */
  const isTradingEnabled = computed(() => {
    return tradingEnabled.value && systemStatus_trading.value !== 'stopped'
  })

  const isLoading = computed(() => loadingStatus.value)
  const hasError = computed(() => errorStatus.value !== null)

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Fetch system status from API
   */
  async function fetchSystemStatus() {
    loadingStatus.value = true
    errorStatus.value = null

    try {
      const response = await apiService.getStatus()
      if (response.success && response.data) {
        // Update status info
        tradingMode.value = response.data.mode
        lastStatusUpdate.value = Date.now()
      } else {
        errorStatus.value = new ApiError(
          'FETCH_STATUS_ERROR',
          response.error?.message || 'Failed to fetch system status'
        )
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      errorStatus.value = new ApiError('STATUS_FETCH_ERROR', err.message)
    } finally {
      loadingStatus.value = false
    }
  }

  /**
   * Fetch health information
   */
  async function checkHealth() {
    try {
      const startTime = Date.now()
      const response = await apiService.getHealth()
      const latency = Date.now() - startTime

      if (response.success) {
        apiConnected.value = true
        connectionMetrics.value.lastConnectionTime = Date.now()

        // Track latency
        connectionMetrics.value.latency.push(latency)
        if (connectionMetrics.value.latency.length > 10) {
          connectionMetrics.value.latency.shift()
        }

        return true
      } else {
        apiConnected.value = false
        connectionMetrics.value.connectionErrors++
        return false
      }
    } catch (error) {
      apiConnected.value = false
      connectionMetrics.value.connectionErrors++
      return false
    }
  }

  /**
   * Handle system status update from WebSocket
   */
  function handleSystemStatusUpdate(data: SystemStatus) {
    systemStatus.value = data
    websocketConnected.value = true
    lastStatusUpdate.value = Date.now()
  }

  /**
   * Handle system alert from WebSocket
   */
  function handleSystemAlert(data: SystemAlert) {
    systemAlerts.value.unshift(data)
    // Keep only last 100 alerts
    if (systemAlerts.value.length > 100) {
      systemAlerts.value.pop()
    }
  }

  /**
   * Subscribe to WebSocket updates
   */
  function subscribeToUpdates() {
    const unsubscribe1 = websocketService.subscribe(
      'system:status',
      handleSystemStatusUpdate
    )
    const unsubscribe2 = websocketService.subscribe(
      'system:alert',
      handleSystemAlert
    )

    return () => {
      unsubscribe1()
      unsubscribe2()
    }
  }

  /**
   * Update system status from WebSocket event (called by realtime orchestrator)
   */
  function updateSystemStatusFromWS(data: SystemStatus) {
    handleSystemStatusUpdate(data)
  }

  /**
   * Add system alert from WebSocket event (called by realtime orchestrator)
   */
  function addSystemAlertFromWS(data: SystemAlert) {
    handleSystemAlert(data)
  }

  /**
   * Update ticker from WebSocket (high-frequency data)
   */
  function updateTickerFromWS(data: any) {
    // Update ticker data for market information
    lastStatusUpdate.value = Date.now()
  }

  /**
   * Update market data from WebSocket
   */
  function updateMarketDataFromWS(data: any) {
    // Update market data
    lastStatusUpdate.value = Date.now()
  }

  /**
   * Mark alert as read
   */
  function markAlertAsRead(alertId: string) {
    const alert = systemAlerts.value.find((a) => a.id === alertId)
    if (alert) {
      alert.read = true
    }
  }

  /**
   * Mark all alerts as read
   */
  function markAllAlertsAsRead() {
    systemAlerts.value.forEach((a) => {
      a.read = true
    })
  }

  /**
   * Clear alerts by level
   */
  function clearAlertsByLevel(level: AlertLevel) {
    systemAlerts.value = systemAlerts.value.filter((a) => a.level !== level)
  }

  /**
   * Clear all alerts
   */
  function clearAllAlerts() {
    systemAlerts.value = []
  }

  /**
   * Delete specific alert
   */
  function deleteAlert(alertId: string) {
    systemAlerts.value = systemAlerts.value.filter((a) => a.id !== alertId)
  }

  /**
   * Update user preference
   */
  function updatePreference<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K]
  ) {
    userPreferences.value[key] = value
    // In a real app, you'd persist this
    localStorage.setItem(`pref_${String(key)}`, JSON.stringify(value))
  }

  /**
   * Toggle notification setting
   */
  function toggleNotifications() {
    userPreferences.value.notifications.enabled =
      !userPreferences.value.notifications.enabled
  }

  /**
   * Toggle sound
   */
  function toggleSound() {
    userPreferences.value.notifications.sound =
      !userPreferences.value.notifications.sound
  }

  /**
   * Toggle desktop notifications
   */
  function toggleDesktopNotifications() {
    userPreferences.value.notifications.desktop =
      !userPreferences.value.notifications.desktop
  }

  /**
   * Enable trading
   */
  async function enableTrading() {
    tradingEnabled.value = true
    // In a real app, you'd make an API call here
  }

  /**
   * Disable trading
   */
  async function disableTrading(reason?: string) {
    tradingEnabled.value = false
    // In a real app, you'd make an API call here
  }

  /**
   * Set trading mode
   */
  async function setTradingMode(mode: string) {
    tradingMode.value = mode
  }

  /**
   * Record disconnection
   */
  function recordDisconnection() {
    connectionMetrics.value.disconnections++
  }

  /**
   * Clear error
   */
  function clearError() {
    errorStatus.value = null
  }

  /**
   * Reset store
   */
  function reset() {
    systemStatus.value = null
    systemAlerts.value = []
    loadingStatus.value = false
    errorStatus.value = null
    lastStatusUpdate.value = null
    apiConnected.value = true
    websocketConnected.value = false
    connectionMetrics.value = {
      latency: [],
      connectionErrors: 0,
      lastConnectionTime: null,
      disconnections: 0,
    }
    tradingEnabled.value = true
    tradingMode.value = 'auto'
    systemStatus_trading.value = 'running'
  }

  return {
    // State
    systemStatus,
    systemAlerts,
    loadingStatus,
    errorStatus,
    lastStatusUpdate,
    apiConnected,
    websocketConnected,
    connectionMetrics,
    userPreferences,
    tradingEnabled,
    tradingMode,
    systemStatus_trading,

    // Computed - System Status
    currentStatus,
    isHealthy,
    systemUptime,
    formattedUptime,
    isDatabaseConnected,
    isApiConnected,
    isWebSocketConnected,
    diskUsage,
    memoryUsage,
    cpuUsage,

    // Computed - Connection Metrics
    avgLatency,
    maxLatency,
    minLatency,
    connectionStatusColor,

    // Computed - Alerts
    unreadAlerts,
    criticalAlerts,
    recentAlerts,
    getAlertsByLevel,

    // Computed - Trading
    isTradingEnabled,

    // Computed - Status
    isLoading,
    hasError,

    // Actions
    fetchSystemStatus,
    checkHealth,
    handleSystemStatusUpdate,
    handleSystemAlert,
    updateSystemStatusFromWS,
    addSystemAlertFromWS,
    updateTickerFromWS,
    updateMarketDataFromWS,
    subscribeToUpdates,
    markAlertAsRead,
    markAllAlertsAsRead,
    clearAlertsByLevel,
    clearAllAlerts,
    deleteAlert,
    updatePreference,
    toggleNotifications,
    toggleSound,
    toggleDesktopNotifications,
    enableTrading,
    disableTrading,
    setTradingMode,
    recordDisconnection,
    clearError,
    reset,
  }
})
