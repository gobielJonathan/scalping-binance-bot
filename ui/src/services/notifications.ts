/**
 * Real-time Notifications Service
 * Handles trade execution notifications, system alerts, and connection status changes
 * Manages notification urgency levels and routing
 */

import { useAppStore } from '@/stores'
import websocketService, { ConnectionStatus } from './websocket'
import type { Trade, SystemAlert } from '@/types/api'

// ============================================================================
// Notification Types
// ============================================================================

export enum NotificationLevel {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export interface NotificationConfig {
  level: NotificationLevel
  title: string
  message: string
  duration?: number
  action?: {
    label: string
    callback: () => void
  }
}

export interface TradeNotification {
  tradeId: string
  symbol: string
  side: string
  quantity: number
  executionPrice: number
  profit?: number
  profitPercent?: number
}

export interface AlertNotification {
  alertId: string
  level: string
  category: string
  message: string
  timestamp: number
}

// ============================================================================
// Notification Thresholds
// ============================================================================

interface NotificationThresholds {
  profitThreshold: number // Notify when profit exceeds this amount
  lossThreshold: number // Notify when loss exceeds this amount
  profitPercentThreshold: number // Notify when profit % exceeds this
  lossPercentThreshold: number // Notify when loss % exceeds this
}

const DEFAULT_THRESHOLDS: NotificationThresholds = {
  profitThreshold: 100, // $100
  lossThreshold: -100, // -$100
  profitPercentThreshold: 5, // 5%
  lossPercentThreshold: -5, // -5%
}

// ============================================================================
// Notifications Service
// ============================================================================

class NotificationsService {
  private _appStore: ReturnType<typeof useAppStore> | null = null
  private get appStore() {
    if (!this._appStore) this._appStore = useAppStore()
    return this._appStore
  }
  private thresholds: NotificationThresholds = DEFAULT_THRESHOLDS
  private notificationHistory: NotificationConfig[] = []
  private maxHistorySize = 100
  private connectionStatusUnsubscribe: (() => void) | null = null
  private tradeNotificationCount = 0
  private alertNotificationCount = 0
  private lastConnectionChangeAt: number | null = null
  private connectionChangeDebounceMs = 500

  /**
   * Initialize notifications service
   */
  initialize(): void {
    this.log('Initializing notifications service...')

    // Monitor connection status changes
    this.monitorConnectionStatus()

    this.log('Notifications service initialized')
  }

  /**
   * Monitor connection status changes and notify user
   */
  private monitorConnectionStatus(): void {
    this.connectionStatusUnsubscribe =
      websocketService.onConnectionStatusChange((status) => {
        // Debounce connection change notifications
        const now = Date.now()
        if (
          this.lastConnectionChangeAt &&
          now - this.lastConnectionChangeAt < this.connectionChangeDebounceMs
        ) {
          return
        }
        this.lastConnectionChangeAt = now

        switch (status) {
          case ConnectionStatus.CONNECTED:
            this.notifyConnectionRestored()
            break
          case ConnectionStatus.DISCONNECTED:
            this.notifyConnectionLost()
            break
          case ConnectionStatus.RECONNECTING:
            this.notifyReconnecting()
            break
          case ConnectionStatus.FAILED:
            this.notifyConnectionFailed()
            break
        }
      })
  }

  /**
   * Notify trade execution
   */
  notifyTradeExecution(trade: Trade): void {
    const executionPrice = trade.executionPrice ?? trade.price
    const profit = trade.profit ?? trade.pnl ?? 0
    const profitPercent = trade.profitPercent ?? trade.pnlPercent ?? 0

    const notification: TradeNotification = {
      tradeId: trade.id,
      symbol: trade.symbol,
      side: trade.side,
      quantity: trade.quantity,
      executionPrice,
      profit,
      profitPercent,
    }

    this.tradeNotificationCount++

    // Determine notification level and content
    const side = trade.side.toUpperCase()
    const profitStatus =
      profit > 0
        ? `+$${profit.toFixed(2)}`
        : `-$${Math.abs(profit).toFixed(2)}`

    const level =
      profit > this.thresholds.profitThreshold
        ? NotificationLevel.SUCCESS
        : profit < this.thresholds.lossThreshold
          ? NotificationLevel.WARNING
          : NotificationLevel.INFO

    const config: NotificationConfig = {
      level,
      title: `Trade Executed: ${side} ${trade.quantity} ${trade.symbol}`,
      message: `Execution Price: $${executionPrice.toFixed(2)} | ${profitStatus}`,
      duration: 5000,
    }

    this.notify(config)
    this.log('Trade notification sent:', notification)
  }

  /**
   * Notify system alert
   */
  notifySystemAlert(alert: SystemAlert): void {
    const notification: AlertNotification = {
      alertId: alert.id,
      level: alert.level,
      category: alert.category ?? 'system',
      message: alert.message,
      timestamp: Date.now(),
    }

    this.alertNotificationCount++

    // Map alert level to notification level
    const notificationLevel = this.mapAlertLevelToNotificationLevel(
      alert.level
    )
    const duration = this.getNotificationDuration(notificationLevel)

    const config: NotificationConfig = {
      level: notificationLevel,
      title: `System Alert: ${alert.category ?? 'System'}`,
      message: alert.message,
      duration,
    }

    this.notify(config)
    this.log('System alert notification sent:', notification)
  }

  /**
   * Notify portfolio milestone (e.g., profit/loss threshold)
   */
  notifyPortfolioMilestone(
    type: 'profit' | 'loss',
    amount: number,
    percentChange: number
  ): void {
    const shouldNotify =
      type === 'profit'
        ? amount >= this.thresholds.profitThreshold &&
          percentChange >= this.thresholds.profitPercentThreshold
        : Math.abs(amount) >= Math.abs(this.thresholds.lossThreshold) &&
          percentChange <= this.thresholds.lossPercentThreshold

    if (!shouldNotify) {
      return
    }

    const level =
      type === 'profit' ? NotificationLevel.SUCCESS : NotificationLevel.WARNING
    const amountStr = `$${Math.abs(amount).toFixed(2)}`
    const percentStr = `${Math.abs(percentChange).toFixed(2)}%`

    const config: NotificationConfig = {
      level,
      title: `Portfolio ${type === 'profit' ? 'Profit' : 'Loss'} Milestone!`,
      message: `${amountStr} (${percentStr}) reached`,
      duration: 7000,
    }

    this.notify(config)
  }

  /**
   * Notify emergency stop
   */
  notifyEmergencyStop(reason: string): void {
    const config: NotificationConfig = {
      level: NotificationLevel.CRITICAL,
      title: '⚠️ Emergency Stop Activated',
      message: `All trading has been halted. Reason: ${reason}`,
      duration: 0, // Keep visible until dismissed
    }

    this.notify(config)
    this.log('Emergency stop notification sent')
  }

  /**
   * Notify connection restored
   */
  private notifyConnectionRestored(): void {
    const config: NotificationConfig = {
      level: NotificationLevel.SUCCESS,
      title: '✅ Connection Restored',
      message: 'Real-time data sync is active',
      duration: 3000,
    }

    this.notify(config)
  }

  /**
   * Notify connection lost
   */
  private notifyConnectionLost(): void {
    const config: NotificationConfig = {
      level: NotificationLevel.WARNING,
      title: '⚠️ Connection Lost',
      message: 'Attempting to reconnect to trading bot...',
      duration: 0, // Keep visible until connection restored
    }

    this.notify(config)
  }

  /**
   * Notify reconnecting
   */
  private notifyReconnecting(): void {
    const config: NotificationConfig = {
      level: NotificationLevel.INFO,
      title: '🔄 Reconnecting',
      message: 'Attempting to restore connection...',
      duration: 0,
    }

    this.notify(config)
  }

  /**
   * Notify connection failed
   */
  private notifyConnectionFailed(): void {
    const config: NotificationConfig = {
      level: NotificationLevel.ERROR,
      title: '❌ Connection Failed',
      message: 'Unable to connect to trading bot. Please check your connection.',
      duration: 0,
      action: {
        label: 'Retry',
        callback: () => {
          websocketService.reconnect().catch((error) => {
            this.log('Reconnection failed:', error)
          })
        },
      },
    }

    this.notify(config)
  }

  /**
   * Generic notification handler
   */
  private notify(config: NotificationConfig): void {
    // Add to history
    this.notificationHistory.push(config)
    if (this.notificationHistory.length > this.maxHistorySize) {
      this.notificationHistory.shift()
    }

    // Map NotificationLevel to app store type
    const storeType = this.mapNotificationLevelToStoreType(config.level)

    // Send to app store
    this.appStore.addNotification(storeType, config.message, config.duration)
  }

  /**
   * Map alert level to notification level
   */
  private mapAlertLevelToNotificationLevel(alertLevel: string): NotificationLevel {
    switch (alertLevel.toLowerCase()) {
      case 'critical':
      case 'fatal':
        return NotificationLevel.CRITICAL
      case 'error':
        return NotificationLevel.ERROR
      case 'warning':
        return NotificationLevel.WARNING
      case 'info':
      case 'notice':
        return NotificationLevel.INFO
      default:
        return NotificationLevel.INFO
    }
  }

  /**
   * Map notification level to app store type
   */
  private mapNotificationLevelToStoreType(
    level: NotificationLevel
  ): string {
    switch (level) {
      case NotificationLevel.SUCCESS:
        return 'success'
      case NotificationLevel.ERROR:
      case NotificationLevel.CRITICAL:
        return 'error'
      case NotificationLevel.WARNING:
        return 'warning'
      case NotificationLevel.INFO:
      default:
        return 'info'
    }
  }

  /**
   * Get notification duration based on level
   */
  private getNotificationDuration(level: NotificationLevel): number {
    switch (level) {
      case NotificationLevel.CRITICAL:
      case NotificationLevel.ERROR:
        return 0 // Keep until dismissed
      case NotificationLevel.WARNING:
        return 7000
      case NotificationLevel.SUCCESS:
        return 5000
      case NotificationLevel.INFO:
      default:
        return 4000
    }
  }

  /**
   * Set notification thresholds
   */
  setThresholds(thresholds: Partial<NotificationThresholds>): void {
    this.thresholds = {
      ...this.thresholds,
      ...thresholds,
    }
    this.log('Notification thresholds updated:', this.thresholds)
  }

  /**
   * Get notification thresholds
   */
  getThresholds(): NotificationThresholds {
    return { ...this.thresholds }
  }

  /**
   * Get notification history
   */
  getHistory(): NotificationConfig[] {
    return [...this.notificationHistory]
  }

  /**
   * Get notification statistics
   */
  getStats() {
    return {
      totalTradeNotifications: this.tradeNotificationCount,
      totalAlertNotifications: this.alertNotificationCount,
      historySize: this.notificationHistory.length,
      maxHistorySize: this.maxHistorySize,
    }
  }

  /**
   * Clear notification history
   */
  clearHistory(): void {
    this.notificationHistory = []
    this.tradeNotificationCount = 0
    this.alertNotificationCount = 0
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.connectionStatusUnsubscribe) {
      this.connectionStatusUnsubscribe()
      this.connectionStatusUnsubscribe = null
    }
  }

  /**
   * Log messages (only in development)
   */
  private log(...args: any[]): void {
    const isDevelopment = import.meta.env.MODE === 'development'
    if (isDevelopment) {
      console.log('[NotificationsService]', ...args)
    }
  }
}

// Export singleton instance
export const notificationsService = new NotificationsService()
export default notificationsService
