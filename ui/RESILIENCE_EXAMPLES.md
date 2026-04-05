/**
 * Integration Examples
 * Examples of how to integrate error boundaries and resilience features
 */

// ============================================================================
// Example 1: Wrapping App with Error Boundary
// ============================================================================

// App.vue
export const AppExample = `
<template>
  <ErrorBoundary :show-details="isDev">
    <OfflineBanner />
    <DashboardLayout />
  </ErrorBoundary>
</template>

<script setup lang="ts">
import ErrorBoundary from '@/components/error/ErrorBoundary.vue'
import OfflineBanner from '@/components/fallback/OfflineBanner.vue'
import DashboardLayout from '@/components/layout/DashboardLayout.vue'

const isDev = import.meta.env.DEV
</script>
`

// ============================================================================
// Example 2: Component with Fallback UI
// ============================================================================

export const ComponentWithFallbackExample = `
<template>
  <FallbackWidget
    widget-name="Portfolio Chart"
    :is-loading="loading"
    :has-error="!!error"
    :error-message="error?.message"
    :retryable="true"
    @retry="fetchPortfolio"
  >
    <PortfolioChart v-if="portfolio" :data="portfolio" />
  </FallbackWidget>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import FallbackWidget from '@/components/fallback/FallbackWidget.vue'
import PortfolioChart from './PortfolioChart.vue'
import { dataValidator } from '@/utils/validation'
import { networkResilienceManager } from '@/services/resilience'

const loading = ref(false)
const error = ref<Error | null>(null)
const portfolio = ref(null)

async function fetchPortfolio() {
  loading.value = true
  error.value = null

  try {
    const response = await fetch('/api/portfolio')
    const data = await response.json()

    // Validate data
    const validation = dataValidator.validatePortfolio(data)
    if (!validation.isValid) {
      throw new Error('Invalid portfolio data')
    }

    portfolio.value = data
  } catch (err) {
    error.value = err instanceof Error ? err : new Error('Unknown error')

    // Queue for retry if offline
    if (!networkResilienceManager.isOnlineMode()) {
      networkResilienceManager.queueOfflineAction('fetch-portfolio', {})
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchPortfolio()
})
</script>
`

// ============================================================================
// Example 3: API Service with Resilience
// ============================================================================

export const ApiServiceExample = `
import { networkResilienceManager } from '@/services/resilience'
import { dataValidator } from '@/utils/validation'
import { ApiError, RetryPolicy } from '@/utils/errors'

class ResilientApiService {
  private retryPolicy = new RetryPolicy(3, 1000, 10000, 2)

  async fetchTrade(tradeId: string) {
    // Check if online
    if (!networkResilienceManager.isOnlineMode()) {
      throw new Error('Offline mode - request queued')
    }

    try {
      // Make request with retry
      const response = await this.retryPolicy.execute(async () => {
        return await fetch(\`/api/trades/\${tradeId}\`)
      })

      const data = await response.json()

      // Validate response
      const validation = dataValidator.validateTrade(data)
      if (!validation.isValid) {
        throw new Error('Invalid trade data')
      }

      return data
    } catch (error) {
      // Queue for later if network error
      if (error instanceof ApiError && error.isRetryable()) {
        networkResilienceManager.queueOfflineAction('fetch-trade', { tradeId })
      }

      throw error
    }
  }

  async placeTrade(orderData: any) {
    // Validate input
    const validation = dataValidator.validateTrade(orderData)
    if (!validation.isValid) {
      throw new Error('Invalid order data')
    }

    // Check online
    if (!networkResilienceManager.isOnlineMode()) {
      // Queue for execution when online
      const actionId = networkResilienceManager.queueOfflineAction('place-trade', orderData)
      return { actionId, queued: true }
    }

    // Execute with circuit breaker
    const circuitBreaker = networkResilienceManager.getCircuitBreaker('trade-api')

    try {
      const response = await circuitBreaker.execute(async () => {
        return await fetch('/api/trades', {
          method: 'POST',
          body: JSON.stringify(orderData),
        })
      })

      return await response.json()
    } catch (error) {
      // If circuit open, queue the action
      if (error.message.includes('Circuit breaker open')) {
        const actionId = networkResilienceManager.queueOfflineAction('place-trade', orderData)
        return { actionId, queued: true }
      }

      throw error
    }
  }
}
`

// ============================================================================
// Example 4: Store with Error Handling
// ============================================================================

export const StoreExample = `
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { networkResilienceManager } from '@/services/resilience'
import { monitoringService } from '@/services/monitoring'

export const usePortfolioStore = defineStore('portfolio', () => {
  const portfolio = ref(null)
  const loading = ref(false)
  const error = ref<Error | null>(null)
  const lastUpdate = ref(0)

  const isStale = computed(() => {
    const now = Date.now()
    return lastUpdate.value > 0 && (now - lastUpdate.value) > 60000 // 1 minute
  })

  async function fetchPortfolio() {
    loading.value = true
    error.value = null

    try {
      const response = await fetch('/api/portfolio')
      const data = await response.json()

      // Validate
      const validation = dataValidator.validatePortfolio(data)
      if (!validation.isValid) {
        throw new Error('Invalid portfolio data')
      }

      portfolio.value = data
      lastUpdate.value = Date.now()
    } catch (err) {
      error.value = err instanceof Error ? err : new Error('Unknown error')

      // Queue if offline
      if (!networkResilienceManager.isOnlineMode()) {
        networkResilienceManager.queueOfflineAction('fetch-portfolio', {})
      }

      // Record error
      monitoringService.recordError('PORTFOLIO_FETCH_ERROR')

      throw error.value
    } finally {
      loading.value = false
    }
  }

  return {
    portfolio,
    loading,
    error,
    isStale,
    fetchPortfolio,
  }
})
`

// ============================================================================
// Example 5: Using Degradation Features
// ============================================================================

export const DegradationExample = `
<template>
  <div class="dashboard">
    <!-- Always show critical features -->
    <PortfolioSummary />
    <PositionsList />

    <!-- Conditionally show non-critical features -->
    <MarketCharts v-if="shouldShowCharts" />
    <AdvancedAnalytics v-if="shouldShowAnalytics" />

    <!-- Adapt real-time update frequency -->
    <RealtimeWidget :update-interval="updateInterval" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { degradationManager, FeaturePriority } from '@/services/degradation'

// Register features
onMounted(() => {
  degradationManager.registerFeature({
    id: 'charts',
    name: 'Market Charts',
    priority: FeaturePriority.HIGH,
    enabled: true,
    resourceCost: 40,
  })

  degradationManager.registerFeature({
    id: 'analytics',
    name: 'Advanced Analytics',
    priority: FeaturePriority.MEDIUM,
    enabled: true,
    resourceCost: 30,
  })
})

const shouldShowCharts = computed(() => {
  return degradationManager.isFeatureEnabled('charts')
})

const shouldShowAnalytics = computed(() => {
  return degradationManager.isFeatureEnabled('analytics')
})

const updateInterval = computed(() => {
  return 1000 * degradationManager.getUpdateFrequencyMultiplier()
})
</script>
`

// ============================================================================
// Example 6: Main.ts Initialization
// ============================================================================

export const MainTsExample = `
import { createApp } from 'vue'
import App from './App.vue'
import { initializeResilienceSystem } from '@/services/resilience-init'

const app = createApp(App)

// Initialize resilience before mounting
initializeResilienceSystem()

// Enable debug in development
if (import.meta.env.DEV) {
  const { enableResilienceDebug } = await import('@/services/resilience-init')
  enableResilienceDebug()
}

app.mount('#app')
`

// ============================================================================
// Example 7: WebSocket with Validation
// ============================================================================

export const WebSocketExample = `
import { dataValidator, ValidationErrorType } from '@/utils/validation'
import { notificationsService } from '@/services/notifications'

class ValidatedWebSocketService {
  private ws: WebSocket | null = null

  connect(url: string) {
    this.ws = new WebSocket(url)

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)

        // Sanitize message
        const sanitized = dataValidator.sanitizeWebSocketMessage(message)
        if (!sanitized) {
          console.warn('Invalid WebSocket message received')
          return
        }

        // Validate based on type
        if (sanitized.type === 'trade') {
          const validation = dataValidator.validateTrade(sanitized)
          if (!validation.isValid) {
            console.error('Invalid trade data from WebSocket', validation.errors)
            notificationsService.notify({
              level: 'error',
              title: 'Data Error',
              message: 'Received invalid trade data',
            })
            return
          }
        }

        // Process validated data
        this.handleMessage(sanitized)
      } catch (error) {
        console.error('WebSocket message processing error:', error)
      }
    }
  }

  private handleMessage(message: any) {
    // Process message
  }
}
`

export default {
  AppExample,
  ComponentWithFallbackExample,
  ApiServiceExample,
  StoreExample,
  DegradationExample,
  MainTsExample,
  WebSocketExample,
}
