/**
 * Graceful Degradation System
 * Manages feature prioritization, progressive enhancement, and fallback strategies
 */

import { useAppStore } from '@/stores'

/**
 * Feature priority levels
 */
export enum FeaturePriority {
  CRITICAL = 'critical', // Must work (portfolio, positions)
  HIGH = 'high', // Important (charts, real-time updates)
  MEDIUM = 'medium', // Nice to have (advanced features)
  LOW = 'low', // Optional (animations, polish)
}

/**
 * Resource constraint levels
 */
export enum ResourceConstraintLevel {
  OPTIMAL = 'optimal', // No constraints
  MODERATE = 'moderate', // Some constraints
  SEVERE = 'severe', // Significant constraints
  CRITICAL = 'critical', // Major constraints
}

/**
 * Feature configuration
 */
export interface FeatureConfig {
  id: string
  name: string
  priority: FeaturePriority
  enabled: boolean
  resourceCost: number // 0-100
  fallback?: any
  degradationMode?: 'hide' | 'reduce' | 'cache'
}

/**
 * Degradation mode
 */
export interface DegradationMode {
  level: ResourceConstraintLevel
  enabledPriorities: FeaturePriority[]
  cacheMode: boolean
  reducedUpdateFrequency: boolean
  disableAnimations: boolean
  disableCharts: boolean
  disableRealtime: boolean
  useCachedData: boolean
}

/**
 * Resource usage snapshot
 */
export interface ResourceUsage {
  timestamp: number
  memory: number // In MB
  cpu: number // 0-100
  networkBandwidth: number // In Mbps
}

/**
 * Graceful degradation manager
 */
class DegradationManager {
  private appStore = useAppStore()
  private features: Map<string, FeatureConfig> = new Map()
  private degradationModes: Map<ResourceConstraintLevel, DegradationMode> = new Map()
  private currentConstraintLevel: ResourceConstraintLevel = ResourceConstraintLevel.OPTIMAL
  private resourceHistory: ResourceUsage[] = []
  private maxResourceHistorySize = 100
  private resourceCheckInterval: ReturnType<typeof setInterval> | null = null
  private constraintListeners: ((level: ResourceConstraintLevel) => void)[] = []

  constructor() {
    this.initializeDegradationModes()
    this.startResourceMonitoring()
  }

  /**
   * Initialize degradation modes
   */
  private initializeDegradationModes(): void {
    // Optimal mode - all features enabled
    this.degradationModes.set(ResourceConstraintLevel.OPTIMAL, {
      level: ResourceConstraintLevel.OPTIMAL,
      enabledPriorities: [
        FeaturePriority.CRITICAL,
        FeaturePriority.HIGH,
        FeaturePriority.MEDIUM,
        FeaturePriority.LOW,
      ],
      cacheMode: false,
      reducedUpdateFrequency: false,
      disableAnimations: false,
      disableCharts: false,
      disableRealtime: false,
      useCachedData: false,
    })

    // Moderate mode - disable low priority features
    this.degradationModes.set(ResourceConstraintLevel.MODERATE, {
      level: ResourceConstraintLevel.MODERATE,
      enabledPriorities: [FeaturePriority.CRITICAL, FeaturePriority.HIGH, FeaturePriority.MEDIUM],
      cacheMode: false,
      reducedUpdateFrequency: true,
      disableAnimations: true,
      disableCharts: false,
      disableRealtime: false,
      useCachedData: false,
    })

    // Severe mode - only high priority features
    this.degradationModes.set(ResourceConstraintLevel.SEVERE, {
      level: ResourceConstraintLevel.SEVERE,
      enabledPriorities: [FeaturePriority.CRITICAL, FeaturePriority.HIGH],
      cacheMode: true,
      reducedUpdateFrequency: true,
      disableAnimations: true,
      disableCharts: true,
      disableRealtime: false,
      useCachedData: true,
    })

    // Critical mode - essential features only
    this.degradationModes.set(ResourceConstraintLevel.CRITICAL, {
      level: ResourceConstraintLevel.CRITICAL,
      enabledPriorities: [FeaturePriority.CRITICAL],
      cacheMode: true,
      reducedUpdateFrequency: true,
      disableAnimations: true,
      disableCharts: true,
      disableRealtime: true,
      useCachedData: true,
    })
  }

  /**
   * Register feature
   */
  registerFeature(config: FeatureConfig): void {
    this.features.set(config.id, config)
    this.log(`Feature registered: ${config.id}`)
  }

  /**
   * Enable feature
   */
  enableFeature(id: string): void {
    const feature = this.features.get(id)
    if (feature) {
      feature.enabled = true
    }
  }

  /**
   * Disable feature
   */
  disableFeature(id: string): void {
    const feature = this.features.get(id)
    if (feature) {
      feature.enabled = false
    }
  }

  /**
   * Check if feature is enabled considering constraints
   */
  isFeatureEnabled(id: string): boolean {
    const feature = this.features.get(id)
    if (!feature || !feature.enabled) {
      return false
    }

    const mode = this.degradationModes.get(this.currentConstraintLevel)
    if (!mode) {
      return true
    }

    return mode.enabledPriorities.includes(feature.priority)
  }

  /**
   * Get degradation mode
   */
  getDegradationMode(): DegradationMode {
    return (
      this.degradationModes.get(this.currentConstraintLevel) || {
        level: ResourceConstraintLevel.OPTIMAL,
        enabledPriorities: [
          FeaturePriority.CRITICAL,
          FeaturePriority.HIGH,
          FeaturePriority.MEDIUM,
          FeaturePriority.LOW,
        ],
        cacheMode: false,
        reducedUpdateFrequency: false,
        disableAnimations: false,
        disableCharts: false,
        disableRealtime: false,
        useCachedData: false,
      }
    )
  }

  /**
   * Set constraint level
   */
  setConstraintLevel(level: ResourceConstraintLevel): void {
    if (level === this.currentConstraintLevel) {
      return
    }

    const oldLevel = this.currentConstraintLevel
    this.currentConstraintLevel = level

    this.log(`Constraint level changed from ${oldLevel} to ${level}`)
    this.notifyConstraintChange(level)
  }

  /**
   * Start resource monitoring
   */
  private startResourceMonitoring(): void {
    this.resourceCheckInterval = setInterval(() => {
      this.checkResources()
    }, 5000) // Every 5 seconds
  }

  /**
   * Check system resources
   */
  private checkResources(): void {
    const usage = this.measureResources()
    this.resourceHistory.push(usage)

    if (this.resourceHistory.length > this.maxResourceHistorySize) {
      this.resourceHistory.shift()
    }

    // Determine constraint level based on resources
    let newLevel = ResourceConstraintLevel.OPTIMAL

    if (usage.memory > 300) {
      newLevel = ResourceConstraintLevel.CRITICAL
    } else if (usage.memory > 250) {
      newLevel = ResourceConstraintLevel.SEVERE
    } else if (usage.memory > 200) {
      newLevel = ResourceConstraintLevel.MODERATE
    }

    if (usage.cpu > 80) {
      newLevel = this.escalateConstraint(newLevel)
    } else if (usage.cpu > 60) {
      newLevel = this.escalateConstraint(newLevel, 1)
    }

    if (newLevel !== this.currentConstraintLevel) {
      this.setConstraintLevel(newLevel)
    }
  }

  /**
   * Escalate constraint level
   */
  private escalateConstraint(
    currentLevel: ResourceConstraintLevel,
    steps: number = 1
  ): ResourceConstraintLevel {
    const levels: ResourceConstraintLevel[] = [
      ResourceConstraintLevel.OPTIMAL,
      ResourceConstraintLevel.MODERATE,
      ResourceConstraintLevel.SEVERE,
      ResourceConstraintLevel.CRITICAL,
    ]

    const currentIndex = Math.max(0, levels.indexOf(currentLevel))
    const newIndex = Math.min(currentIndex + steps, levels.length - 1)

    return levels[newIndex]!
  }

  /**
   * Measure system resources
   */
  private measureResources(): ResourceUsage {
    const now = Date.now()

    // Try to get memory usage from performance API
    let memory = 0
    if ((performance as any).memory) {
      memory = Math.round((performance as any).memory.usedJSHeapSize / 1024 / 1024) // Convert to MB
    }

    // Estimate CPU usage based on event loop responsiveness
    const cpu = this.estimateCPU()

    // Estimate network bandwidth (simplified)
    const networkBandwidth = 10 // Placeholder

    return {
      timestamp: now,
      memory,
      cpu,
      networkBandwidth,
    }
  }

  /**
   * Estimate CPU usage
   */
  private estimateCPU(): number {
    // Measure how long it takes to execute a simple operation
    const startTime = performance.now()
    let iterations = 0

    while (performance.now() - startTime < 10) {
      // Simple loop to measure CPU
      Math.sqrt(Math.random())
      iterations++
    }

    // Higher iterations = lower CPU usage
    return Math.min(100, Math.max(0, 100 - iterations / 100))
  }

  /**
   * Get enabled features
   */
  getEnabledFeatures(): FeatureConfig[] {
    return Array.from(this.features.values()).filter((f) => this.isFeatureEnabled(f.id))
  }

  /**
   * Get all features
   */
  getAllFeatures(): FeatureConfig[] {
    return Array.from(this.features.values())
  }

  /**
   * Get feature fallback
   */
  getFeatureFallback(id: string): any {
    const feature = this.features.get(id)
    if (feature && !this.isFeatureEnabled(id)) {
      return feature.fallback
    }
    return null
  }

  /**
   * Should update in real-time
   */
  shouldUpdateRealtime(): boolean {
    const mode = this.getDegradationMode()
    return mode ? !mode.disableRealtime : true
  }

  /**
   * Should show charts
   */
  shouldShowCharts(): boolean {
    const mode = this.getDegradationMode()
    return mode ? !mode.disableCharts : true
  }

  /**
   * Should animate
   */
  shouldAnimate(): boolean {
    const mode = this.getDegradationMode()
    return mode ? !mode.disableAnimations : true
  }

  /**
   * Should use cached data
   */
  shouldUseCachedData(): boolean {
    const mode = this.getDegradationMode()
    return mode ? mode.useCachedData : false
  }

  /**
   * Get update frequency multiplier
   */
  getUpdateFrequencyMultiplier(): number {
    const mode = this.getDegradationMode()
    if (!mode || !mode.reducedUpdateFrequency) {
      return 1
    }

    // Reduce update frequency based on constraint level
    switch (this.currentConstraintLevel) {
      case ResourceConstraintLevel.MODERATE:
        return 2 // Update half as frequently
      case ResourceConstraintLevel.SEVERE:
        return 5 // Update 5x less frequently
      case ResourceConstraintLevel.CRITICAL:
        return 10 // Update 10x less frequently
      default:
        return 1
    }
  }

  /**
   * Get resource usage
   */
  getResourceUsage(): ResourceUsage | undefined {
    return this.resourceHistory.length > 0 ? this.resourceHistory[this.resourceHistory.length - 1] : undefined
  }

  /**
   * Get resource history
   */
  getResourceHistory(): ResourceUsage[] {
    return [...this.resourceHistory]
  }

  /**
   * Get average resource usage
   */
  getAverageResourceUsage(): ResourceUsage | undefined {
    if (this.resourceHistory.length === 0) {
      return undefined
    }

    const avgMemory =
      this.resourceHistory.reduce((sum, r) => sum + r.memory, 0) / this.resourceHistory.length
    const avgCpu =
      this.resourceHistory.reduce((sum, r) => sum + r.cpu, 0) / this.resourceHistory.length

    return {
      timestamp: Date.now(),
      memory: Math.round(avgMemory),
      cpu: Math.round(avgCpu),
      networkBandwidth: 10,
    }
  }

  /**
   * Subscribe to constraint changes
   */
  onConstraintChange(listener: (level: ResourceConstraintLevel) => void): () => void {
    this.constraintListeners.push(listener)
    return () => {
      const index = this.constraintListeners.indexOf(listener)
      if (index > -1) {
        this.constraintListeners.splice(index, 1)
      }
    }
  }

  /**
   * Notify constraint change
   */
  private notifyConstraintChange(level: ResourceConstraintLevel): void {
    this.constraintListeners.forEach((listener) => {
      try {
        listener(level)
      } catch (error) {
        this.log('Error in constraint change listener:', error)
      }
    })
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (this.resourceCheckInterval) {
      clearInterval(this.resourceCheckInterval)
    }
  }

  /**
   * Log helper
   */
  private log(...args: any[]): void {
    if (import.meta.env.MODE === 'development') {
      console.log('[DegradationManager]', ...args)
    }
  }
}

// Export singleton instance
export const degradationManager = new DegradationManager()
export default degradationManager
