/**
 * WebSocket Service
 * Manages real-time communication with the trading bot API using Socket.IO
 * With enhanced connection monitoring, health checks, and automatic reconnection
 */

import { io, Socket } from 'socket.io-client'
import config from '@/config/environment'
import type {
  SocketEvents,
  Portfolio,
  Position,
  Order,
  Trade,
  Ticker,
  MarketData,
  SystemAlert,
  SystemStatus,
} from '@/types/api'

// ============================================================================
// Connection Status Types
// ============================================================================

export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed',
}

export interface ConnectionMetrics {
  isConnected: boolean
  status: ConnectionStatus
  reconnectAttempts: number
  maxReconnectAttempts: number
  lastConnectedAt: number | null
  lastDisconnectedAt: number | null
  connectionDuration: number
  latency: number
  errorCount: number
  messagesSent: number
  messagesReceived: number
  bandwidth: {
    sent: number
    received: number
  }
}

export interface HealthCheckReport {
  isHealthy: boolean
  status: ConnectionStatus
  latency: number
  lastPingAt: number
  consecutiveFailures: number
}

// ============================================================================
// Request Queue for Offline Support
// ============================================================================

interface QueuedRequest {
  event: string
  data?: unknown
  timestamp: number
  retries: number
}

class WebSocketService {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = config.reconnectAttempts
  private reconnectDelay = config.reconnectDelay
  private reconnectDelayMultiplier = 1.5
  private maxReconnectDelay = 30000 // 30 seconds
  
  // Event management
  private eventCallbacks: Map<
    keyof SocketEvents,
    Set<(data: any) => void>
  > = new Map()
  
  // Connection monitoring
  private connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED
  private lastConnectedAt: number | null = null
  private lastDisconnectedAt: number | null = null
  private lastPingAt: number | null = null
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null
  
  // Metrics tracking
  private latency: number = 0
  private messagesSent: number = 0
  private messagesReceived: number = 0
  private errorCount: number = 0
  private bandwidthSent: number = 0
  private bandwidthReceived: number = 0
  private consecutiveHealthCheckFailures: number = 0
  
  // Connection event listeners
  private connectionStatusListeners: Set<(status: ConnectionStatus) => void> = new Set()
  private metricsListeners: Set<(metrics: ConnectionMetrics) => void> = new Set()
  
  // Request queue for offline support
  private requestQueue: QueuedRequest[] = []
  private maxQueueSize = 100
  private queueFlushInterval: ReturnType<typeof setInterval> | null = null

  /**
   * Initialize WebSocket connection with enhanced monitoring
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.setConnectionStatus(ConnectionStatus.CONNECTING)
        
        this.socket = io(config.socketUrl, {
          path: config.socketPath,
          reconnection: true,
          reconnectionDelay: this.reconnectDelay,
          reconnectionDelayMax: this.maxReconnectDelay,
          reconnectionAttempts: this.maxReconnectAttempts,
          autoConnect: config.features.enableAutoConnect,
        })

        this.socket.on('connect', () => {
          this.handleConnect()
          resolve()
        })

        this.socket.on('connect_error', (error) => {
          this.handleConnectError(error)
          reject(error)
        })

        this.socket.on('reconnect_attempt', () => {
          this.handleReconnectAttempt()
        })

        this.socket.on('reconnect', () => {
          this.handleReconnect()
        })

        this.socket.on('disconnect', (reason) => {
          this.handleDisconnect(reason)
        })

        // Set up health check
        this.startHealthCheck()
        this.startQueueFlush()
      } catch (error) {
        this.log('Failed to initialize socket:', error)
        this.setConnectionStatus(ConnectionStatus.FAILED)
        reject(error)
      }
    })
  }

  /**
   * Handle successful connection
   */
  private handleConnect(): void {
    this.log('Connected to trading bot API')
    this.reconnectAttempts = 0
    this.lastConnectedAt = Date.now()
    this.errorCount = 0
    this.consecutiveHealthCheckFailures = 0
    this.setConnectionStatus(ConnectionStatus.CONNECTED)
    this.setupEventListeners()
    this.flushRequestQueue()
  }

  /**
   * Handle connection error
   */
  private handleConnectError(error: Error): void {
    this.log('Connection error:', error)
    this.errorCount++
    this.setConnectionStatus(ConnectionStatus.FAILED)
  }

  /**
   * Handle reconnection attempt
   */
  private handleReconnectAttempt(): void {
    this.reconnectAttempts++
    this.setConnectionStatus(ConnectionStatus.RECONNECTING)
    this.log(
      `Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts}`
    )
    
    // Calculate exponential backoff
    const currentDelay = Math.min(
      this.reconnectDelay * Math.pow(this.reconnectDelayMultiplier, this.reconnectAttempts - 1),
      this.maxReconnectDelay
    )
    this.log(`Next reconnection attempt in ${currentDelay}ms`)
  }

  /**
   * Handle successful reconnection
   */
  private handleReconnect(): void {
    this.log('Successfully reconnected to trading bot API')
    this.reconnectAttempts = 0
    this.errorCount = 0
    this.lastConnectedAt = Date.now()
    this.setConnectionStatus(ConnectionStatus.CONNECTED)
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(reason: string): void {
    this.log('Disconnected:', reason)
    this.lastDisconnectedAt = Date.now()
    if (reason !== 'io client namespace disconnect') {
      this.setConnectionStatus(ConnectionStatus.DISCONNECTED)
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    this.stopHealthCheck()
    this.stopQueueFlush()
    if (this.socket?.connected) {
      this.socket.disconnect()
    }
    this.setConnectionStatus(ConnectionStatus.DISCONNECTED)
  }

  /**
   * Check if socket is connected
   */
  isConnected(): boolean {
    return this.connectionStatus === ConnectionStatus.CONNECTED
  }

  /**
   * Get current connection status
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus
  }

  /**
   * Set connection status and notify listeners
   */
  private setConnectionStatus(status: ConnectionStatus): void {
    if (this.connectionStatus !== status) {
      this.connectionStatus = status
      this.notifyConnectionStatusListeners()
    }
  }

  /**
   * Get current connection metrics
   */
  getMetrics(): ConnectionMetrics {
    const now = Date.now()
    const connectionDuration = this.lastConnectedAt
      ? now - this.lastConnectedAt
      : 0

    return {
      isConnected: this.isConnected(),
      status: this.connectionStatus,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
      lastConnectedAt: this.lastConnectedAt,
      lastDisconnectedAt: this.lastDisconnectedAt,
      connectionDuration,
      latency: this.latency,
      errorCount: this.errorCount,
      messagesSent: this.messagesSent,
      messagesReceived: this.messagesReceived,
      bandwidth: {
        sent: this.bandwidthSent,
        received: this.bandwidthReceived,
      },
    }
  }

  /**
   * Subscribe to connection status changes
   */
  onConnectionStatusChange(
    callback: (status: ConnectionStatus) => void
  ): () => void {
    this.connectionStatusListeners.add(callback)
    return () => {
      this.connectionStatusListeners.delete(callback)
    }
  }

  /**
   * Subscribe to metrics updates
   */
  onMetricsChange(callback: (metrics: ConnectionMetrics) => void): () => void {
    this.metricsListeners.add(callback)
    return () => {
      this.metricsListeners.delete(callback)
    }
  }

  /**
   * Notify all connection status listeners
   */
  private notifyConnectionStatusListeners(): void {
    this.connectionStatusListeners.forEach((listener) => {
      try {
        listener(this.connectionStatus)
      } catch (error) {
        this.log('Error in connection status listener:', error)
      }
    })
  }

  /**
   * Notify all metrics listeners
   */
  private notifyMetricsListeners(): void {
    const metrics = this.getMetrics()
    this.metricsListeners.forEach((listener) => {
      try {
        listener(metrics)
      } catch (error) {
        this.log('Error in metrics listener:', error)
      }
    })
  }

  /**
   * Set up all event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return

    // Portfolio events
    this.on('portfolio:updated', (data: Portfolio) => {
      this.emitToCallbacks('portfolio:updated', data)
    })

    this.on('position:opened', (data: Position) => {
      this.emitToCallbacks('position:opened', data)
    })

    this.on('position:updated', (data: Position) => {
      this.emitToCallbacks('position:updated', data)
    })

    this.on('position:closed', (data: Position) => {
      this.emitToCallbacks('position:closed', data)
    })

    // Order and Trade events
    this.on('order:created', (data: Order) => {
      this.emitToCallbacks('order:created', data)
    })

    this.on('order:updated', (data: Order) => {
      this.emitToCallbacks('order:updated', data)
    })

    this.on('order:filled', (data: Trade) => {
      this.emitToCallbacks('order:filled', data)
    })

    this.on('trade:executed', (data: Trade) => {
      this.emitToCallbacks('trade:executed', data)
    })

    // Market data events
    this.on('ticker:update', (data: Ticker) => {
      this.emitToCallbacks('ticker:update', data)
    })

    this.on('market:data', (data: MarketData) => {
      this.emitToCallbacks('market:data', data)
    })

    // System events
    this.on('system:status', (data: SystemStatus) => {
      this.emitToCallbacks('system:status', data)
    })

    this.on('system:alert', (data: SystemAlert) => {
      this.emitToCallbacks('system:alert', data)
    })
  }

  /**
   * Listen to a socket event
   */
  private on<E extends keyof SocketEvents>(
    event: E,
    callback: (data: SocketEvents[E]) => void
  ): void {
    if (this.socket) {
      this.socket.on(event as string, callback)
    }
  }

  /**
   * Subscribe to events with a callback
   */
  subscribe<E extends keyof SocketEvents>(
    event: E,
    callback: (data: SocketEvents[E]) => void
  ): () => void {
    // Store callback
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, new Set())
    }
    this.eventCallbacks.get(event)!.add(callback)

    // Return unsubscribe function
    return () => {
      const callbacks = this.eventCallbacks.get(event)
      if (callbacks) {
        callbacks.delete(callback)
      }
    }
  }

  /**
   * Emit event to registered callbacks
   */
  private emitToCallbacks<E extends keyof SocketEvents>(
    event: E,
    data: SocketEvents[E]
  ): void {
    this.messagesReceived++
    const callbacks = this.eventCallbacks.get(event)
    if (callbacks) {
      callbacks.forEach((callback) => {
        try {
          callback(data)
        } catch (error) {
          this.log(`Error in event callback for ${String(event)}:`, error)
        }
      })
    }
    this.notifyMetricsListeners()
  }

  /**
   * Emit a socket event to the server
   */
  emitToServer<E extends keyof SocketEvents>(
    event: E,
    data?: SocketEvents[E]
  ): void {
    if (this.socket?.connected) {
      this.messagesSent++
      this.socket.emit(event as string, data)
      this.notifyMetricsListeners()
    } else {
      this.log(`Cannot emit ${String(event)}: socket not connected`)
      this.queueRequest(event as string, data)
    }
  }

  /**
   * Request a response from the server
   */
  request<T = unknown>(
    event: string,
    data?: unknown,
    timeout: number = config.requestTimeout
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.socket?.connected) {
        reject(new Error('Socket not connected'))
        return
      }

      const timeoutId = setTimeout(() => {
        reject(new Error(`Request timeout for event: ${event}`))
      }, timeout)

      this.socket.emit(event, data, (response: T) => {
        clearTimeout(timeoutId)
        resolve(response)
      })
    })
  }

  /**
   * Start health check monitoring
   */
  private startHealthCheck(): void {
    this.stopHealthCheck()
    
    this.healthCheckInterval = setInterval(() => {
      if (this.socket?.connected) {
        const startTime = Date.now()
        
        this.socket.emit('ping', () => {
          this.latency = Date.now() - startTime
          this.lastPingAt = Date.now()
          this.consecutiveHealthCheckFailures = 0
          this.notifyMetricsListeners()
        })
      } else {
        this.consecutiveHealthCheckFailures++
        if (this.consecutiveHealthCheckFailures > 3) {
          this.log('Health check failed multiple times, connection may be unstable')
        }
      }
    }, 10000) // Check every 10 seconds
  }

  /**
   * Stop health check monitoring
   */
  private stopHealthCheck(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
    }
  }

  /**
   * Get health check report
   */
  getHealthReport(): HealthCheckReport {
    return {
      isHealthy: this.consecutiveHealthCheckFailures < 3,
      status: this.connectionStatus,
      latency: this.latency,
      lastPingAt: this.lastPingAt ?? 0,
      consecutiveFailures: this.consecutiveHealthCheckFailures,
    }
  }

  /**
   * Queue request for later sending (when offline)
   */
  private queueRequest(event: string, data?: unknown): void {
    if (this.requestQueue.length >= this.maxQueueSize) {
      this.log('Request queue is full, discarding oldest request')
      this.requestQueue.shift()
    }

    this.requestQueue.push({
      event,
      data,
      timestamp: Date.now(),
      retries: 0,
    })

    this.log(`Queued request: ${event} (queue size: ${this.requestQueue.length})`)
  }

  /**
   * Flush queued requests
   */
  private flushRequestQueue(): void {
    if (!this.socket?.connected || this.requestQueue.length === 0) {
      return
    }

    const queue = [...this.requestQueue]
    this.requestQueue = []

    queue.forEach((request) => {
      try {
        this.socket!.emit(request.event, request.data)
        this.log(`Flushed queued request: ${request.event}`)
      } catch (error) {
        this.log(`Failed to flush request: ${request.event}`, error)
        // Re-queue if failed
        if (request.retries < 3) {
          request.retries++
          this.requestQueue.push(request)
        }
      }
    })
  }

  /**
   * Start queue flush timer
   */
  private startQueueFlush(): void {
    this.queueFlushInterval = setInterval(() => {
      this.flushRequestQueue()
    }, 5000) // Attempt to flush every 5 seconds
  }

  /**
   * Stop queue flush timer
   */
  private stopQueueFlush(): void {
    if (this.queueFlushInterval) {
      clearInterval(this.queueFlushInterval)
      this.queueFlushInterval = null
    }
  }

  /**
   * Get current queue status
   */
  getQueueStatus() {
    const firstRequest = this.requestQueue[0]
    return {
      queueSize: this.requestQueue.length,
      maxQueueSize: this.maxQueueSize,
      isFull: this.requestQueue.length >= this.maxQueueSize,
      oldestRequestAge: firstRequest ? Date.now() - firstRequest.timestamp : 0,
    }
  }

  /**
   * Manually reconnect to the server
   */
  async reconnect(): Promise<void> {
    this.log('Manual reconnection requested')
    if (this.socket?.connected) {
      this.socket.disconnect()
    }
    
    // Reset reconnect attempts to allow fresh connection
    this.reconnectAttempts = 0
    
    // Reconnect will be handled by Socket.IO's reconnection logic
    return new Promise((resolve) => {
      const unsubscribe = this.onConnectionStatusChange((status) => {
        if (status === ConnectionStatus.CONNECTED) {
          unsubscribe()
          resolve()
        }
      })
      
      if (this.socket) {
        this.socket.connect()
      }
    })
  }

  /**
   * Log messages (only in development)
   */
  private log(...args: any[]): void {
    if (config.features.enableLogging) {
      console.log('[WebSocket]', ...args)
    }
  }
}

// Export singleton instance
export default new WebSocketService()
