/**
 * Error Handling and Resilience System Initialization
 * Initializes all error boundaries, resilience features, and monitoring
 */

import { networkResilienceManager, type NetworkQuality } from '@/services/resilience'
import { degradationManager, FeaturePriority, type ResourceConstraintLevel } from '@/services/degradation'
import { monitoringService, type HealthStatus } from '@/services/monitoring'
import { dataValidator } from '@/utils/validation'
import { notificationsService } from '@/services/notifications'
import { useAppStore } from '@/stores'

/**
 * Initialize all resilience systems
 */
export function initializeResilienceSystem(): void {
  const appStore = useAppStore()

  // Initialize monitoring service
  initializeMonitoring()

  // Initialize network resilience
  initializeNetworkResilience()

  // Initialize resource degradation
  initializeResourceDegradation()

  // Restore offline queue if needed
  networkResilienceManager.restoreOfflineQueue()

  // Register default features for degradation
  registerDefaultFeatures()

  console.log('[ResilienceSystem] Initialized successfully')
}

/**
 * Initialize monitoring service
 */
function initializeMonitoring(): void {
  const appStore = useAppStore()

  // Monitor health check status
  monitoringService.onHealthStatusChange((results) => {
    const overallHealth = monitoringService.getOverallHealth()

    if (overallHealth !== 'healthy') {
      console.warn('[Monitoring] System health degraded:', overallHealth)

      // Notify user if health is poor
      if (overallHealth === 'unhealthy') {
        appStore.addNotification('error', 'Some critical services may be unavailable.', 7000)
      }
    }
  })

  // Monitor performance metrics
  monitoringService.onPerformanceMetrics((metrics) => {
    // Check for memory issues
    if (metrics.memoryUsed > metrics.memoryLimit * 0.9) {
      console.warn('[Monitoring] High memory usage:', metrics.memoryUsed, 'MB')
    }

    // Check for CPU issues
    if (metrics.cpuUsage > 80) {
      console.warn('[Monitoring] High CPU usage:', metrics.cpuUsage, '%')
    }

    // Check for error spikes
    if (metrics.errorRate > 0.1) {
      console.warn('[Monitoring] High error rate:', metrics.errorRate)
    }
  })
}

/**
 * Initialize network resilience
 */
function initializeNetworkResilience(): void {
  const appStore = useAppStore()

  // Subscribe to network status changes
  networkResilienceManager.onStatusChange((isOnline) => {
    if (isOnline) {
      // Process offline queue when coming back online
      processOfflineQueue()

      appStore.addNotification('success', 'Connection restored. Real-time data sync is active.', 3000)
    } else {
      appStore.addNotification(
        'warning',
        'You are offline. Changes will sync when reconnected.',
        0 // Keep visible
      )
    }
  })

  // Subscribe to network quality changes
  networkResilienceManager.onQualityChange((quality) => {
    console.log('[Network] Quality changed to:', quality)

    // Trigger degradation based on network quality
    if (quality === 'critical' || quality === 'poor') {
      appStore.addNotification('warning', 'Slow connection detected. Features may be limited.', 5000)
    }
  })
}

/**
 * Initialize resource degradation
 */
function initializeResourceDegradation(): void {
  const appStore = useAppStore()

  degradationManager.onConstraintChange((level) => {
    console.log('[Degradation] Constraint level changed to:', level)

    // Show notification for significant constraint changes
    if (level === 'severe' || level === 'critical') {
      appStore.addNotification(
        'warning',
        'Running in limited mode. Some features have been disabled.',
        5000
      )
    }
  })
}

/**
 * Register default features for degradation
 */
function registerDefaultFeatures(): void {
  // Critical features - always shown
  degradationManager.registerFeature({
    id: 'portfolio-display',
    name: 'Portfolio Display',
    priority: FeaturePriority.CRITICAL,
    enabled: true,
    resourceCost: 10,
  })

  degradationManager.registerFeature({
    id: 'positions-display',
    name: 'Positions Display',
    priority: FeaturePriority.CRITICAL,
    enabled: true,
    resourceCost: 10,
  })

  // High priority features
  degradationManager.registerFeature({
    id: 'real-time-updates',
    name: 'Real-time Updates',
    priority: FeaturePriority.HIGH,
    enabled: true,
    resourceCost: 30,
  })

  degradationManager.registerFeature({
    id: 'market-charts',
    name: 'Market Charts',
    priority: FeaturePriority.HIGH,
    enabled: true,
    resourceCost: 40,
  })

  // Medium priority features
  degradationManager.registerFeature({
    id: 'advanced-analytics',
    name: 'Advanced Analytics',
    priority: FeaturePriority.MEDIUM,
    enabled: true,
    resourceCost: 50,
  })

  degradationManager.registerFeature({
    id: 'notifications',
    name: 'Notifications',
    priority: FeaturePriority.MEDIUM,
    enabled: true,
    resourceCost: 20,
  })

  // Low priority features
  degradationManager.registerFeature({
    id: 'animations',
    name: 'Animations',
    priority: FeaturePriority.LOW,
    enabled: true,
    resourceCost: 15,
  })

  degradationManager.registerFeature({
    id: 'visual-polish',
    name: 'Visual Polish',
    priority: FeaturePriority.LOW,
    enabled: true,
    resourceCost: 10,
  })
}

/**
 * Process offline queue - sync queued actions when connection restored
 */
async function processOfflineQueue(): Promise<void> {
  const appStore = useAppStore()
  const queue = networkResilienceManager.getOfflineQueue()

  if (queue.length === 0) {
    return
  }

  console.log('[ResilienceSystem] Processing offline queue:', queue.length, 'items')

  let synced = 0
  let failed = 0

  for (const action of queue) {
    try {
      // Execute queued action (this would be specific to your app)
      // For now, we just remove it from queue
      networkResilienceManager.removeOfflineAction(action.id)
      synced++
    } catch (error) {
      console.error('[ResilienceSystem] Failed to process action:', action.id, error)
      failed++
    }
  }

  if (synced > 0) {
    appStore.addNotification('success', `${synced} action(s) synced successfully`, 3000)
  }

  if (failed > 0) {
    appStore.addNotification('error', `${failed} action(s) failed to sync. Please try again.`, 5000)
  }
}

/**
 * Cleanup resilience systems
 */
export function cleanupResilienceSystem(): void {
  monitoringService.destroy()
  degradationManager.destroy()
  networkResilienceManager.destroy()

  console.log('[ResilienceSystem] Cleaned up successfully')
}

/**
 * Get system health summary
 */
export function getSystemHealthSummary() {
  return {
    overallHealth: monitoringService.getOverallHealth(),
    networkStatus: networkResilienceManager.isOnlineMode() ? 'online' : 'offline',
    networkQuality: networkResilienceManager.getNetworkQuality(),
    resourceConstraint: degradationManager.getDegradationMode(),
    performance: monitoringService.getPerformanceMetrics(),
    errors: monitoringService.getErrorStats(),
  }
}

/**
 * Enable debug logging for resilience system
 */
export function enableResilienceDebug(): void {
  // Log network stats every 10 seconds
  setInterval(() => {
    console.log('[Debug] Network Stats:', networkResilienceManager.getNetworkStats())
    console.log('[Debug] Resource Usage:', degradationManager.getResourceUsage())
    console.log('[Debug] System Health:', getSystemHealthSummary())
  }, 10000)
}

export default {
  initializeResilienceSystem,
  cleanupResilienceSystem,
  getSystemHealthSummary,
  enableResilienceDebug,
  networkResilienceManager,
  degradationManager,
  monitoringService,
  dataValidator,
}
