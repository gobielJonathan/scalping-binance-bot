/**
 * Real-time Data Orchestrator Service
 * Central coordinator for all real-time data streams from the trading bot
 * Routes Socket.IO events to appropriate Pinia stores and handles data validation
 */

import websocketService, { ConnectionStatus } from './websocket'
import {
  usePortfolioStore,
  usePositionsStore,
  useTradesStore,
  useSystemStore,
} from '@/stores'
import type {
  Portfolio,
  Position,
  Trade,
  Order,
  Ticker,
  MarketData,
  SystemStatus,
  SystemAlert,
} from '@/types/api'

// ============================================================================
// Types
// ============================================================================

export enum RealtimeEventType {
  // Portfolio events
  PORTFOLIO_UPDATE = 'portfolio:updated',
  POSITION_OPENED = 'position:opened',
  POSITION_UPDATED = 'position:updated',
  POSITION_CLOSED = 'position:closed',

  // Order and trade events
  ORDER_CREATED = 'order:created',
  ORDER_UPDATED = 'order:updated',
  ORDER_FILLED = 'order:filled',
  TRADE_EXECUTED = 'trade:executed',

  // Market data events
  TICKER_UPDATE = 'ticker:update',
  MARKET_DATA = 'market:data',

  // System events
  SYSTEM_STATUS = 'system:status',
  SYSTEM_ALERT = 'system:alert',
}

export interface RealtimeSubscription {
  eventType: RealtimeEventType
  unsubscribe: () => void
}

// ============================================================================
// Data Validation
// ============================================================================

class DataValidator {
  static validatePortfolio(data: unknown): data is Portfolio {
    const p = data as Portfolio
    return (
      typeof p === 'object' &&
      p !== null &&
      typeof p.id === 'string' &&
      typeof p.accountId === 'string' &&
      typeof p.totalBalance === 'number' &&
      typeof p.availableBalance === 'number' &&
      typeof p.equity === 'number'
    )
  }

  static validatePosition(data: unknown): data is Position {
    const p = data as Position
    return (
      typeof p === 'object' &&
      p !== null &&
      typeof p.id === 'string' &&
      typeof p.symbol === 'string' &&
      typeof p.quantity === 'number' &&
      typeof p.entryPrice === 'number' &&
      typeof p.currentPrice === 'number'
    )
  }

  static validateTrade(data: unknown): data is Trade {
    const t = data as Trade
    return (
      typeof t === 'object' &&
      t !== null &&
      typeof t.id === 'string' &&
      typeof t.symbol === 'string' &&
      typeof t.quantity === 'number' &&
      typeof t.executionPrice === 'number'
    )
  }

  static validateOrder(data: unknown): data is Order {
    const o = data as Order
    return (
      typeof o === 'object' &&
      o !== null &&
      typeof o.id === 'string' &&
      typeof o.symbol === 'string' &&
      typeof o.quantity === 'number'
    )
  }

  static validateMarketData(data: unknown): data is MarketData {
    const m = data as MarketData
    return (
      typeof m === 'object' &&
      m !== null &&
      typeof m.symbol === 'string' &&
      typeof m.lastPrice === 'number' &&
      typeof m.bid === 'number' &&
      typeof m.ask === 'number'
    )
  }

  static validateSystemStatus(data: unknown): data is SystemStatus {
    const s = data as SystemStatus
    return (
      typeof s === 'object' &&
      s !== null &&
      typeof s.status === 'string' &&
      typeof s.uptime === 'number'
    )
  }

  static validateSystemAlert(data: unknown): data is SystemAlert {
    const a = data as SystemAlert
    return (
      typeof a === 'object' &&
      a !== null &&
      typeof a.id === 'string' &&
      typeof a.level === 'string' &&
      typeof a.message === 'string'
    )
  }
}

// ============================================================================
// Real-time Orchestrator
// ============================================================================

class RealtimeOrchestrator {
  private subscriptions: Map<RealtimeEventType, () => void> = new Map()
  private isInitialized = false
  private errorRecoveryAttempts: Map<RealtimeEventType, number> = new Map()
  private maxRecoveryAttempts = 3
  private lastEventTimestamps: Map<RealtimeEventType, number> = new Map()
  private eventDeduplicationWindow = 100 // ms

  /**
   * Initialize real-time data orchestrator
   * Subscribes to all Socket.IO events and routes them to appropriate stores
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    this.log('Initializing real-time data orchestrator...')

    try {
      // Wait for WebSocket to be ready
      if (!websocketService.isConnected()) {
        this.log('Waiting for WebSocket connection...')
        await new Promise<void>((resolve) => {
          const unsubscribe = websocketService.onConnectionStatusChange(
            (status) => {
              if (status === ConnectionStatus.CONNECTED) {
                unsubscribe()
                resolve()
              }
            }
          )
        })
      }

      this.subscribeToAllEvents()
      this.isInitialized = true
      this.log('Real-time data orchestrator initialized')
    } catch (error) {
      this.log('Failed to initialize real-time orchestrator:', error)
      throw error
    }
  }

  /**
   * Subscribe to all real-time events
   */
  private subscribeToAllEvents(): void {
    // Portfolio events
    this.subscribeToEvent(
      RealtimeEventType.PORTFOLIO_UPDATE,
      'portfolio:updated',
      (data) => this.handlePortfolioUpdate(data)
    )

    this.subscribeToEvent(
      RealtimeEventType.POSITION_OPENED,
      'position:opened',
      (data) => this.handlePositionOpened(data)
    )

    this.subscribeToEvent(
      RealtimeEventType.POSITION_UPDATED,
      'position:updated',
      (data) => this.handlePositionUpdated(data)
    )

    this.subscribeToEvent(
      RealtimeEventType.POSITION_CLOSED,
      'position:closed',
      (data) => this.handlePositionClosed(data)
    )

    // Order and trade events
    this.subscribeToEvent(
      RealtimeEventType.ORDER_CREATED,
      'order:created',
      (data) => this.handleOrderCreated(data)
    )

    this.subscribeToEvent(
      RealtimeEventType.ORDER_UPDATED,
      'order:updated',
      (data) => this.handleOrderUpdated(data)
    )

    this.subscribeToEvent(
      RealtimeEventType.ORDER_FILLED,
      'order:filled',
      (data) => this.handleOrderFilled(data)
    )

    this.subscribeToEvent(
      RealtimeEventType.TRADE_EXECUTED,
      'trade:executed',
      (data) => this.handleTradeExecuted(data)
    )

    // Market data events
    this.subscribeToEvent(
      RealtimeEventType.TICKER_UPDATE,
      'ticker:update',
      (data) => this.handleTickerUpdate(data)
    )

    this.subscribeToEvent(
      RealtimeEventType.MARKET_DATA,
      'market:data',
      (data) => this.handleMarketData(data)
    )

    // System events
    this.subscribeToEvent(
      RealtimeEventType.SYSTEM_STATUS,
      'system:status',
      (data) => this.handleSystemStatus(data)
    )

    this.subscribeToEvent(
      RealtimeEventType.SYSTEM_ALERT,
      'system:alert',
      (data) => this.handleSystemAlert(data)
    )
  }

  /**
   * Subscribe to a specific event
   */
  private subscribeToEvent<T>(
    eventType: RealtimeEventType,
    socketEvent: string,
    handler: (data: T) => void
  ): void {
    const unsubscribe = websocketService.subscribe(
      socketEvent as any,
      (data: T) => {
        try {
          // Deduplication check
          if (this.isDuplicate(eventType)) {
            return
          }

          handler(data)
          this.errorRecoveryAttempts.set(eventType, 0)
        } catch (error) {
          this.handleEventError(eventType, error)
        }
      }
    )

    this.subscriptions.set(eventType, unsubscribe)
  }

  /**
   * Check if event is a duplicate (same event within deduplication window)
   */
  private isDuplicate(eventType: RealtimeEventType): boolean {
    const lastTimestamp = this.lastEventTimestamps.get(eventType)
    if (!lastTimestamp) {
      this.lastEventTimestamps.set(eventType, Date.now())
      return false
    }

    const timeSinceLastEvent = Date.now() - lastTimestamp
    if (timeSinceLastEvent < this.eventDeduplicationWindow) {
      return true
    }

    this.lastEventTimestamps.set(eventType, Date.now())
    return false
  }

  /**
   * Handle event processing errors
   */
  private handleEventError(eventType: RealtimeEventType, error: unknown): void {
    const attempts = (this.errorRecoveryAttempts.get(eventType) ?? 0) + 1
    this.errorRecoveryAttempts.set(eventType, attempts)

    this.log(`Error processing ${eventType} (attempt ${attempts}):`, error)

    if (attempts >= this.maxRecoveryAttempts) {
      this.log(`Max recovery attempts reached for ${eventType}, disabling event`)
      const unsubscribe = this.subscriptions.get(eventType)
      if (unsubscribe) {
        unsubscribe()
        this.subscriptions.delete(eventType)
      }
    }
  }

  /**
   * Handle portfolio updates
   */
  private handlePortfolioUpdate(data: unknown): void {
    if (!DataValidator.validatePortfolio(data)) {
      throw new Error('Invalid portfolio data')
    }

    const store = usePortfolioStore()
    store.updatePortfolioFromWS(data)
    this.log('Portfolio updated')
  }

  /**
   * Handle position opened
   */
  private handlePositionOpened(data: unknown): void {
    if (!DataValidator.validatePosition(data)) {
      throw new Error('Invalid position data')
    }

    const store = usePositionsStore()
    store.addPositionFromWS(data)
    this.log(`Position opened: ${data.symbol}`)
  }

  /**
   * Handle position updated
   */
  private handlePositionUpdated(data: unknown): void {
    if (!DataValidator.validatePosition(data)) {
      throw new Error('Invalid position data')
    }

    const store = usePositionsStore()
    store.updatePositionFromWS(data)
    this.log(`Position updated: ${data.symbol}`)
  }

  /**
   * Handle position closed
   */
  private handlePositionClosed(data: unknown): void {
    if (!DataValidator.validatePosition(data)) {
      throw new Error('Invalid position data')
    }

    const store = usePositionsStore()
    store.removePositionFromWS(data)
    this.log(`Position closed: ${data.symbol}`)
  }

  /**
   * Handle order created
   */
  private handleOrderCreated(data: unknown): void {
    if (!DataValidator.validateOrder(data)) {
      throw new Error('Invalid order data')
    }

    const store = useTradesStore()
    store.addOrderFromWS(data)
    this.log(`Order created: ${data.id}`)
  }

  /**
   * Handle order updated
   */
  private handleOrderUpdated(data: unknown): void {
    if (!DataValidator.validateOrder(data)) {
      throw new Error('Invalid order data')
    }

    const store = useTradesStore()
    store.updateOrderFromWS(data)
    this.log(`Order updated: ${data.id}`)
  }

  /**
   * Handle order filled
   */
  private handleOrderFilled(data: unknown): void {
    if (!DataValidator.validateTrade(data)) {
      throw new Error('Invalid trade data')
    }

    const store = useTradesStore()
    store.addTradeFromWS(data)
    this.log(`Order filled: ${data.id}`)
  }

  /**
   * Handle trade executed
   */
  private handleTradeExecuted(data: unknown): void {
    if (!DataValidator.validateTrade(data)) {
      throw new Error('Invalid trade data')
    }

    const store = useTradesStore()
    store.addTradeFromWS(data)
    this.log(`Trade executed: ${data.symbol}`)
  }

  /**
   * Handle ticker update
   */
  private handleTickerUpdate(data: unknown): void {
    // Ticker updates are high-frequency, validate minimally
    if (typeof data === 'object' && data !== null) {
      const store = useSystemStore()
      store.updateTickerFromWS(data as Ticker)
    }
  }

  /**
   * Handle market data
   */
  private handleMarketData(data: unknown): void {
    if (!DataValidator.validateMarketData(data)) {
      throw new Error('Invalid market data')
    }

    const store = useSystemStore()
    store.updateMarketDataFromWS(data)
    this.log(`Market data updated: ${data.symbol}`)
  }

  /**
   * Handle system status
   */
  private handleSystemStatus(data: unknown): void {
    if (!DataValidator.validateSystemStatus(data)) {
      throw new Error('Invalid system status data')
    }

    const store = useSystemStore()
    store.updateSystemStatusFromWS(data)
    this.log('System status updated')
  }

  /**
   * Handle system alert
   */
  private handleSystemAlert(data: unknown): void {
    if (!DataValidator.validateSystemAlert(data)) {
      throw new Error('Invalid system alert data')
    }

    const store = useSystemStore()
    store.addSystemAlertFromWS(data)
    this.log(`System alert: ${data.level} - ${data.message}`)
  }

  /**
   * Unsubscribe from all events
   */
  unsubscribeFromAll(): void {
    this.subscriptions.forEach((unsubscribe) => {
      try {
        unsubscribe()
      } catch (error) {
        this.log('Error unsubscribing:', error)
      }
    })
    this.subscriptions.clear()
    this.isInitialized = false
  }

  /**
   * Check if orchestrator is initialized
   */
  isReady(): boolean {
    return this.isInitialized && websocketService.isConnected()
  }

  /**
   * Get subscription status
   */
  getSubscriptionStatus(): Record<RealtimeEventType, boolean> {
    const status: Record<string, boolean> = {}
    Object.values(RealtimeEventType).forEach((eventType) => {
      status[eventType] = this.subscriptions.has(eventType)
    })
    return status as Record<RealtimeEventType, boolean>
  }

  /**
   * Log messages (only in development)
   */
  private log(...args: any[]): void {
    const isDevelopment = import.meta.env.MODE === 'development'
    if (isDevelopment) {
      console.log('[RealtimeOrchestrator]', ...args)
    }
  }
}

// Export singleton instance
export const realtimeOrchestrator = new RealtimeOrchestrator()
export default realtimeOrchestrator
