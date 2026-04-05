/**
 * Network Resilience Manager
 * Handles offline mode, network quality, retries, circuit breakers, and background sync
 */

import type { ApiError } from '@/utils/errors'

/**
 * Network quality levels
 */
export enum NetworkQuality {
  EXCELLENT = 'excellent', // < 50ms latency
  GOOD = 'good', // 50-100ms
  FAIR = 'fair', // 100-300ms
  POOR = 'poor', // 300-1000ms
  CRITICAL = 'critical', // > 1000ms
}

/**
 * Circuit breaker states
 */
export enum CircuitBreakerState {
  CLOSED = 'closed', // Normal operation
  OPEN = 'open', // Failing, reject requests
  HALF_OPEN = 'half-open', // Testing recovery
}

/**
 * Offline action
 */
export interface OfflineAction {
  id: string
  type: string
  data: any
  timestamp: number
  retries: number
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number // Number of failures to open circuit
  successThreshold: number // Number of successes to close circuit
  timeout: number // Time in ms before attempting half-open
  name: string
}

/**
 * Circuit breaker
 */
class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED
  private failureCount: number = 0
  private successCount: number = 0
  private lastFailureTime: number = 0

  constructor(private config: CircuitBreakerConfig) {}

  /**
   * Execute function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      const timeSinceFailure = Date.now() - this.lastFailureTime
      if (timeSinceFailure > this.config.timeout) {
        this.state = CircuitBreakerState.HALF_OPEN
        this.successCount = 0
      } else {
        throw new Error(
          `Circuit breaker open for ${this.config.name}. Retry in ${this.config.timeout - timeSinceFailure}ms`
        )
      }
    }

    try {
      const result = await fn()

      if (this.state === CircuitBreakerState.HALF_OPEN) {
        this.successCount++
        if (this.successCount >= this.config.successThreshold) {
          this.state = CircuitBreakerState.CLOSED
          this.failureCount = 0
          this.successCount = 0
        }
      }

      return result
    } catch (error) {
      this.failureCount++
      this.lastFailureTime = Date.now()

      if (this.failureCount >= this.config.failureThreshold) {
        this.state = CircuitBreakerState.OPEN
      }

      throw error
    }
  }

  getState(): CircuitBreakerState {
    return this.state
  }

  reset(): void {
    this.state = CircuitBreakerState.CLOSED
    this.failureCount = 0
    this.successCount = 0
  }
}

/**
 * Network resilience manager
 */
class NetworkResilienceManager {
  private isOnline: boolean = navigator.onLine
  private networkQuality: NetworkQuality = NetworkQuality.EXCELLENT
  private offlineQueue: Map<string, OfflineAction> = new Map()
  private circuitBreakers: Map<string, CircuitBreaker> = new Map()
  private latencyHistory: number[] = []
  private maxLatencyHistorySize = 50
  private lastSyncTime: number = 0
  private syncInterval: ReturnType<typeof setInterval> | null = null
  private statusChangeListeners: ((isOnline: boolean) => void)[] = []
  private qualityChangeListeners: ((quality: NetworkQuality) => void)[] = []
  private syncing: boolean = false

  constructor() {
    this.initializeNetworkListeners()
    this.startNetworkMonitoring()
  }

  /**
   * Initialize network status listeners
   */
  private initializeNetworkListeners(): void {
    window.addEventListener('online', () => this.handleOnline())
    window.addEventListener('offline', () => this.handleOffline())
  }

  /**
   * Handle online event
   */
  private handleOnline(): void {
    this.isOnline = true
    this.notifyStatusChange(true)
    this.triggerBackgroundSync()
  }

  /**
   * Handle offline event
   */
  private handleOffline(): void {
    this.isOnline = false
    this.notifyStatusChange(false)
  }

  /**
   * Start network monitoring (measure latency)
   */
  private startNetworkMonitoring(): void {
    // Periodically measure network latency
    setInterval(() => {
      this.measureLatency()
    }, 10000) // Every 10 seconds
  }

  /**
   * Measure network latency
   */
  private async measureLatency(): Promise<void> {
    if (!this.isOnline) return

    const startTime = performance.now()
    try {
      await fetch('/api/health', {
        method: 'GET',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000),
      })
      const latency = performance.now() - startTime
      this.recordLatency(latency)
      this.updateNetworkQuality()
    } catch (error) {
      // Latency measurement failed, assume poor connection
      this.recordLatency(5000)
      this.updateNetworkQuality()
    }
  }

  /**
   * Record latency measurement
   */
  private recordLatency(latency: number): void {
    this.latencyHistory.push(latency)
    if (this.latencyHistory.length > this.maxLatencyHistorySize) {
      this.latencyHistory.shift()
    }
  }

  /**
   * Update network quality based on latency
   */
  private updateNetworkQuality(): void {
    if (this.latencyHistory.length === 0) {
      return
    }

    const avgLatency =
      this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length

    let newQuality = NetworkQuality.EXCELLENT

    if (avgLatency > 1000) {
      newQuality = NetworkQuality.CRITICAL
    } else if (avgLatency > 300) {
      newQuality = NetworkQuality.POOR
    } else if (avgLatency > 100) {
      newQuality = NetworkQuality.FAIR
    } else if (avgLatency > 50) {
      newQuality = NetworkQuality.GOOD
    }

    if (newQuality !== this.networkQuality) {
      const oldQuality = this.networkQuality
      this.networkQuality = newQuality
      this.notifyQualityChange(newQuality)

      // Log significant quality changes
      if (this.isSignificantQualityChange(oldQuality, newQuality)) {
        this.log(`Network quality changed from ${oldQuality} to ${newQuality}`)
      }
    }
  }

  /**
   * Check if quality change is significant
   */
  private isSignificantQualityChange(
    oldQuality: NetworkQuality,
    newQuality: NetworkQuality
  ): boolean {
    const qualityIndex = {
      [NetworkQuality.EXCELLENT]: 4,
      [NetworkQuality.GOOD]: 3,
      [NetworkQuality.FAIR]: 2,
      [NetworkQuality.POOR]: 1,
      [NetworkQuality.CRITICAL]: 0,
    }

    return Math.abs(qualityIndex[oldQuality] - qualityIndex[newQuality]) >= 2
  }

  /**
   * Queue offline action
   */
  queueOfflineAction(type: string, data: any): string {
    const id = `${type}-${Date.now()}-${Math.random()}`
    const action: OfflineAction = {
      id,
      type,
      data,
      timestamp: Date.now(),
      retries: 0,
    }

    this.offlineQueue.set(id, action)
    this.persistOfflineQueue()

    return id
  }

  /**
   * Get offline queue
   */
  getOfflineQueue(): OfflineAction[] {
    return Array.from(this.offlineQueue.values())
  }

  /**
   * Get offline action by ID
   */
  getOfflineAction(id: string): OfflineAction | undefined {
    return this.offlineQueue.get(id)
  }

  /**
   * Remove offline action
   */
  removeOfflineAction(id: string): void {
    this.offlineQueue.delete(id)
    this.persistOfflineQueue()
  }

  /**
   * Clear offline queue
   */
  clearOfflineQueue(): void {
    this.offlineQueue.clear()
    this.persistOfflineQueue()
  }

  /**
   * Persist offline queue to localStorage
   */
  private persistOfflineQueue(): void {
    try {
      const items = Array.from(this.offlineQueue.values())
      localStorage.setItem('offlineQueue', JSON.stringify(items))
    } catch (error) {
      this.log('Failed to persist offline queue:', error)
    }
  }

  /**
   * Restore offline queue from localStorage
   */
  restoreOfflineQueue(): void {
    try {
      const items = localStorage.getItem('offlineQueue')
      if (items) {
        const actions: OfflineAction[] = JSON.parse(items)
        this.offlineQueue.clear()
        for (const action of actions) {
          this.offlineQueue.set(action.id, action)
        }
      }
    } catch (error) {
      this.log('Failed to restore offline queue:', error)
    }
  }

  /**
   * Trigger background sync
   */
  private triggerBackgroundSync(): void {
    if (this.syncing || this.offlineQueue.size === 0) {
      return
    }

    this.syncing = true
    this.lastSyncTime = Date.now()

    // Sync will be handled by listeners
    this.statusChangeListeners.forEach((listener) => listener(true))
  }

  /**
   * Get or create circuit breaker
   */
  getCircuitBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.circuitBreakers.has(name)) {
      const defaultConfig: CircuitBreakerConfig = {
        failureThreshold: 5,
        successThreshold: 2,
        timeout: 30000, // 30 seconds
        name,
      }

      const finalConfig = { ...defaultConfig, ...config }
      this.circuitBreakers.set(name, new CircuitBreaker(finalConfig))
    }

    return this.circuitBreakers.get(name)!
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(name: string): void {
    const cb = this.circuitBreakers.get(name)
    if (cb) {
      cb.reset()
    }
  }

  /**
   * Get network quality
   */
  getNetworkQuality(): NetworkQuality {
    return this.networkQuality
  }

  /**
   * Is online
   */
  isOnlineMode(): boolean {
    return this.isOnline
  }

  /**
   * Subscribe to status changes
   */
  onStatusChange(listener: (isOnline: boolean) => void): () => void {
    this.statusChangeListeners.push(listener)
    return () => {
      const index = this.statusChangeListeners.indexOf(listener)
      if (index > -1) {
        this.statusChangeListeners.splice(index, 1)
      }
    }
  }

  /**
   * Subscribe to quality changes
   */
  onQualityChange(listener: (quality: NetworkQuality) => void): () => void {
    this.qualityChangeListeners.push(listener)
    return () => {
      const index = this.qualityChangeListeners.indexOf(listener)
      if (index > -1) {
        this.qualityChangeListeners.splice(index, 1)
      }
    }
  }

  /**
   * Notify status change
   */
  private notifyStatusChange(isOnline: boolean): void {
    this.statusChangeListeners.forEach((listener) => {
      try {
        listener(isOnline)
      } catch (error) {
        this.log('Error in status change listener:', error)
      }
    })
  }

  /**
   * Notify quality change
   */
  private notifyQualityChange(quality: NetworkQuality): void {
    this.qualityChangeListeners.forEach((listener) => {
      try {
        listener(quality)
      } catch (error) {
        this.log('Error in quality change listener:', error)
      }
    })
  }

  /**
   * Get network statistics
   */
  getNetworkStats() {
    const avgLatency =
      this.latencyHistory.length > 0
        ? this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length
        : 0

    const maxLatency = Math.max(...this.latencyHistory, 0)
    const minLatency = Math.min(...this.latencyHistory, 0)

    return {
      isOnline: this.isOnline,
      quality: this.networkQuality,
      avgLatency: Math.round(avgLatency),
      maxLatency: Math.round(maxLatency),
      minLatency: this.latencyHistory.length > 0 ? Math.round(minLatency) : 0,
      latencyHistorySize: this.latencyHistory.length,
      offlineQueueSize: this.offlineQueue.size,
      lastSyncTime: this.lastSyncTime,
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }
  }

  /**
   * Log helper
   */
  private log(...args: any[]): void {
    if (import.meta.env.MODE === 'development') {
      console.log('[NetworkResilienceManager]', ...args)
    }
  }
}

// Export singleton instance
export const networkResilienceManager = new NetworkResilienceManager()
export default networkResilienceManager
