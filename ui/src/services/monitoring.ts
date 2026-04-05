/**
 * Recovery and Monitoring Service
 * Health checks, performance monitoring, memory tracking, and error rate monitoring
 */

import { logError } from '@/utils/errors'

/**
 * Health check status
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  name: string
  status: HealthStatus
  lastCheck: number
  responseTime: number
  error?: string
  details?: any
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  timestamp: number
  memoryUsed: number
  memoryLimit: number
  cpuUsage: number
  frameRate: number
  apiLatency: number
  errorRate: number
}

/**
 * Service health
 */
export interface ServiceHealth {
  name: string
  status: HealthStatus
  lastCheck: number
  consecutiveFailures: number
  lastError?: string
}

/**
 * Monitoring service
 */
class MonitoringService {
  private healthChecks: Map<string, HealthCheckResult> = new Map()
  private serviceHealth: Map<string, ServiceHealth> = new Map()
  private performanceMetrics: PerformanceMetrics[] = []
  private maxMetricsHistory = 60
  private errorCounts: Map<string, number> = new Map()
  private errorRateThreshold = 0.1 // 10%
  private errorRateWindow = 60000 // 1 minute
  private lastErrorRateReset = Date.now()
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null
  private performanceMonitorInterval: ReturnType<typeof setInterval> | null = null
  private healthStatusListeners: ((results: Map<string, HealthCheckResult>) => void)[] = []
  private performanceListeners: ((metrics: PerformanceMetrics) => void)[] = []
  private errorCountListeners: ((counts: Map<string, number>) => void)[] = []

  constructor() {
    this.startHealthChecks()
    this.startPerformanceMonitoring()
    this.setupWindowErrorHandler()
  }

  /**
   * Register a health check
   */
  registerHealthCheck(
    name: string,
    checkFn: () => Promise<any>,
    intervalMs: number = 30000
  ): void {
    // Initial check
    this.performHealthCheck(name, checkFn)

    // Periodic checks
    if (intervalMs > 0) {
      setInterval(() => {
        this.performHealthCheck(name, checkFn)
      }, intervalMs)
    }
  }

  /**
   * Perform health check
   */
  private async performHealthCheck(
    name: string,
    checkFn: () => Promise<any>
  ): Promise<void> {
    const startTime = performance.now()
    const result: HealthCheckResult = {
      name,
      status: HealthStatus.UNHEALTHY,
      lastCheck: Date.now(),
      responseTime: 0,
    }

    try {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Health check timeout')), 5000)
      )
      await Promise.race([checkFn(), timeout])

      result.status = HealthStatus.HEALTHY
      result.responseTime = performance.now() - startTime

      // Update service health
      const serviceHealth = this.serviceHealth.get(name) || {
        name,
        status: HealthStatus.HEALTHY,
        lastCheck: Date.now(),
        consecutiveFailures: 0,
      }
      serviceHealth.status = HealthStatus.HEALTHY
      serviceHealth.lastCheck = Date.now()
      serviceHealth.consecutiveFailures = 0
      this.serviceHealth.set(name, serviceHealth)
    } catch (error) {
      result.status = HealthStatus.UNHEALTHY
      result.error = error instanceof Error ? error.message : 'Unknown error'
      result.responseTime = performance.now() - startTime

      // Update service health
      const serviceHealth = this.serviceHealth.get(name) || {
        name,
        status: HealthStatus.UNHEALTHY,
        lastCheck: Date.now(),
        consecutiveFailures: 0,
      }
      serviceHealth.status = HealthStatus.UNHEALTHY
      serviceHealth.lastCheck = Date.now()
      serviceHealth.consecutiveFailures += 1
      serviceHealth.lastError = result.error
      this.serviceHealth.set(name, serviceHealth)

      this.log(`Health check failed for ${name}:`, result.error)
    }

    this.healthChecks.set(name, result)
    this.notifyHealthStatusChange()
  }

  /**
   * Start health checks
   */
  private startHealthChecks(): void {
    // Register default health checks
    this.registerHealthCheck('api', () =>
      fetch('/api/health').then((r) => {
        if (!r.ok) throw new Error('API health check failed')
      })
    )

    this.registerHealthCheck('localStorage', () => {
      return new Promise((resolve, reject) => {
        try {
          localStorage.setItem('__health_check__', 'ok')
          localStorage.removeItem('__health_check__')
          resolve(null)
        } catch (error) {
          reject(error)
        }
      })
    })
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    this.performanceMonitorInterval = setInterval(() => {
      this.recordPerformanceMetrics()
    }, 5000) // Every 5 seconds
  }

  /**
   * Record performance metrics
   */
  private recordPerformanceMetrics(): void {
    const metrics: PerformanceMetrics = {
      timestamp: Date.now(),
      memoryUsed: this.getMemoryUsed(),
      memoryLimit: this.getMemoryLimit(),
      cpuUsage: this.estimateCPUUsage(),
      frameRate: this.estimateFrameRate(),
      apiLatency: 0, // Will be tracked separately
      errorRate: this.calculateErrorRate(),
    }

    this.performanceMetrics.push(metrics)
    if (this.performanceMetrics.length > this.maxMetricsHistory) {
      this.performanceMetrics.shift()
    }

    this.notifyPerformanceMetrics(metrics)
  }

  /**
   * Get memory used
   */
  private getMemoryUsed(): number {
    if ((performance as any).memory) {
      return Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024) // MB
    }
    return 0
  }

  /**
   * Get memory limit
   */
  private getMemoryLimit(): number {
    if ((performance as any).memory) {
      return Math.round((performance as any).memory.jsHeapSizeLimit / 1024 / 1024) // MB
    }
    return 0
  }

  /**
   * Estimate CPU usage
   */
  private estimateCPUUsage(): number {
    const startTime = performance.now()
    let iterations = 0

    while (performance.now() - startTime < 10) {
      Math.sqrt(Math.random())
      iterations++
    }

    return Math.min(100, Math.max(0, 100 - iterations / 100))
  }

  /**
   * Estimate frame rate
   */
  private estimateFrameRate(): number {
    // Return a reasonable default; actual measurement would require RAF tracking
    return 60
  }

  /**
   * Calculate error rate
   */
  private calculateErrorRate(): number {
    const now = Date.now()

    // Reset counter if window has passed
    if (now - this.lastErrorRateReset > this.errorRateWindow) {
      this.errorCounts.clear()
      this.lastErrorRateReset = now
    }

    const totalErrors = Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0)
    const uniqueErrors = this.errorCounts.size

    // Simple error rate: total errors / error types
    return uniqueErrors > 0 ? totalErrors / uniqueErrors : 0
  }

  /**
   * Record error
   */
  recordError(errorCode: string): void {
    const count = this.errorCounts.get(errorCode) || 0
    this.errorCounts.set(errorCode, count + 1)
    this.notifyErrorCounts()
  }

  /**
   * Setup window error handler
   */
  private setupWindowErrorHandler(): void {
    window.addEventListener('error', (event) => {
      this.recordError('WINDOW_ERROR')
      logError(new Error(event.message), 'Window', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      })
    })

    window.addEventListener('unhandledrejection', (event) => {
      this.recordError('UNHANDLED_REJECTION')
      if (event.reason instanceof Error) {
        logError(event.reason, 'UnhandledRejection')
      }
    })
  }

  /**
   * Get health check results
   */
  getHealthCheckResults(): HealthCheckResult[] {
    return Array.from(this.healthChecks.values())
  }

  /**
   * Get specific health check
   */
  getHealthCheck(name: string): HealthCheckResult | undefined {
    return this.healthChecks.get(name)
  }

  /**
   * Get overall system health
   */
  getOverallHealth(): HealthStatus {
    const results = Array.from(this.healthChecks.values())

    if (results.length === 0) {
      return HealthStatus.HEALTHY
    }

    const unhealthyCount = results.filter((r) => r.status === HealthStatus.UNHEALTHY).length
    const degradedCount = results.filter((r) => r.status === HealthStatus.DEGRADED).length

    if (unhealthyCount > results.length / 2) {
      return HealthStatus.UNHEALTHY
    }

    if (degradedCount > 0 || unhealthyCount > 0) {
      return HealthStatus.DEGRADED
    }

    return HealthStatus.HEALTHY
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics | undefined {
    return this.performanceMetrics.length > 0
      ? this.performanceMetrics[this.performanceMetrics.length - 1]
      : undefined
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(): PerformanceMetrics[] {
    return [...this.performanceMetrics]
  }

  /**
   * Get average metrics
   */
  getAverageMetrics(): PerformanceMetrics | undefined {
    if (this.performanceMetrics.length === 0) {
      return undefined
    }

    const avgMemory =
      this.performanceMetrics.reduce((sum, m) => sum + m.memoryUsed, 0) /
      this.performanceMetrics.length
    const avgCpu =
      this.performanceMetrics.reduce((sum, m) => sum + m.cpuUsage, 0) /
      this.performanceMetrics.length
    const avgErrorRate =
      this.performanceMetrics.reduce((sum, m) => sum + m.errorRate, 0) /
      this.performanceMetrics.length

    return {
      timestamp: Date.now(),
      memoryUsed: Math.round(avgMemory),
      memoryLimit: this.performanceMetrics[0]?.memoryLimit || 0,
      cpuUsage: Math.round(avgCpu),
      frameRate: 60,
      apiLatency: 0,
      errorRate: avgErrorRate,
    }
  }

  /**
   * Get service health
   */
  getServiceHealth(name: string): ServiceHealth | undefined {
    return this.serviceHealth.get(name)
  }

  /**
   * Get all service health
   */
  getAllServiceHealth(): ServiceHealth[] {
    return Array.from(this.serviceHealth.values())
  }

  /**
   * Subscribe to health status changes
   */
  onHealthStatusChange(listener: (results: Map<string, HealthCheckResult>) => void): () => void {
    this.healthStatusListeners.push(listener)
    return () => {
      const index = this.healthStatusListeners.indexOf(listener)
      if (index > -1) {
        this.healthStatusListeners.splice(index, 1)
      }
    }
  }

  /**
   * Notify health status change
   */
  private notifyHealthStatusChange(): void {
    this.healthStatusListeners.forEach((listener) => {
      try {
        listener(this.healthChecks)
      } catch (error) {
        this.log('Error in health status listener:', error)
      }
    })
  }

  /**
   * Subscribe to performance metrics
   */
  onPerformanceMetrics(listener: (metrics: PerformanceMetrics) => void): () => void {
    this.performanceListeners.push(listener)
    return () => {
      const index = this.performanceListeners.indexOf(listener)
      if (index > -1) {
        this.performanceListeners.splice(index, 1)
      }
    }
  }

  /**
   * Notify performance metrics
   */
  private notifyPerformanceMetrics(metrics: PerformanceMetrics): void {
    this.performanceListeners.forEach((listener) => {
      try {
        listener(metrics)
      } catch (error) {
        this.log('Error in performance metrics listener:', error)
      }
    })
  }

  /**
   * Subscribe to error count changes
   */
  onErrorCountChange(listener: (counts: Map<string, number>) => void): () => void {
    this.errorCountListeners.push(listener)
    return () => {
      const index = this.errorCountListeners.indexOf(listener)
      if (index > -1) {
        this.errorCountListeners.splice(index, 1)
      }
    }
  }

  /**
   * Notify error counts
   */
  private notifyErrorCounts(): void {
    this.errorCountListeners.forEach((listener) => {
      try {
        listener(this.errorCounts)
      } catch (error) {
        this.log('Error in error count listener:', error)
      }
    })
  }

  /**
   * Get error statistics
   */
  getErrorStats() {
    const totalErrors = Array.from(this.errorCounts.values()).reduce((a, b) => a + b, 0)
    return {
      totalErrors,
      uniqueErrors: this.errorCounts.size,
      errors: Object.fromEntries(this.errorCounts),
      errorRate: this.calculateErrorRate(),
    }
  }

  /**
   * Clear metrics
   */
  clearMetrics(): void {
    this.performanceMetrics = []
    this.errorCounts.clear()
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
    }
    if (this.performanceMonitorInterval) {
      clearInterval(this.performanceMonitorInterval)
    }
  }

  /**
   * Log helper
   */
  private log(...args: any[]): void {
    if (import.meta.env.MODE === 'development') {
      console.log('[MonitoringService]', ...args)
    }
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService()
export default monitoringService
