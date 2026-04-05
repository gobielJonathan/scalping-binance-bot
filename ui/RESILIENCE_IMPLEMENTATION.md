# Error Boundaries and Resilience System - Implementation Guide

## Overview

This comprehensive error handling and resilience system ensures the Vue 3 trading dashboard remains functional during network issues, data inconsistencies, and resource constraints.

## Components Overview

### 1. Data Integrity Validator (`src/utils/validation.ts`)

Validates all incoming data from APIs and WebSocket connections.

**Key Features:**
- Trade, Portfolio, Position, and OHLCV validation
- Data anomaly detection
- Cross-source consistency checks
- WebSocket message sanitization
- Corrupted data recovery

**Usage:**

```typescript
import { dataValidator, ValidationErrorType } from '@/utils/validation'

// Validate trade data
const result = dataValidator.validateTrade(tradeData)
if (!result.isValid) {
  console.error('Invalid trade:', result.errors)
}

// Detect anomalies
const anomalyCheck = dataValidator.detectAnomalies(
  currentPrice,
  priceHistory,
  3 // 3 standard deviations
)

// Validate API response
const apiResult = dataValidator.validateApiResponse(data, {
  totalBalance: (v) => ({ isValid: typeof v === 'number', errors: [] }),
  investedAmount: (v) => ({ isValid: typeof v === 'number', errors: [] }),
})
```

### 2. Network Resilience Manager (`src/services/resilience.ts`)

Handles offline mode, network quality monitoring, and automatic retries.

**Key Features:**
- Offline action queueing
- Network quality monitoring (latency-based)
- Circuit breaker pattern for failing services
- Background sync when connection restored
- Persistent offline queue (localStorage)

**Usage:**

```typescript
import { networkResilienceManager, NetworkQuality } from '@/services/resilience'

// Check online status
if (networkResilienceManager.isOnlineMode()) {
  // Make network request
}

// Queue action for offline execution
const actionId = networkResilienceManager.queueOfflineAction('trade-order', {
  symbol: 'BTC/USD',
  quantity: 1,
})

// Subscribe to network status changes
const unsubscribe = networkResilienceManager.onStatusChange((isOnline) => {
  if (isOnline) {
    // Process queued actions
  }
})

// Subscribe to network quality changes
networkResilienceManager.onQualityChange((quality) => {
  if (quality === NetworkQuality.CRITICAL) {
    // Reduce update frequency
  }
})

// Get network statistics
const stats = networkResilienceManager.getNetworkStats()
console.log(`Latency: ${stats.avgLatency}ms, Quality: ${stats.quality}`)
```

### 3. Graceful Degradation System (`src/services/degradation.ts`)

Manages feature prioritization based on resource constraints.

**Key Features:**
- Feature priority levels (Critical, High, Medium, Low)
- Automatic resource monitoring
- Progressive feature disabling during constraints
- Fallback data strategies
- Reduced update frequency during constraints

**Usage:**

```typescript
import {
  degradationManager,
  FeaturePriority,
  ResourceConstraintLevel,
} from '@/services/degradation'

// Register a feature
degradationManager.registerFeature({
  id: 'real-time-charts',
  name: 'Real-time Charts',
  priority: FeaturePriority.HIGH,
  enabled: true,
  resourceCost: 40,
})

// Check if feature should be enabled
if (degradationManager.isFeatureEnabled('real-time-charts')) {
  // Render real-time charts
}

// Get degradation settings
const mode = degradationManager.getDegradationMode()
if (mode?.disableAnimations) {
  // Skip animation setup
}

// Get update frequency multiplier
const multiplier = degradationManager.getUpdateFrequencyMultiplier()
const updateInterval = 1000 * multiplier // Adjust based on constraints

// Listen to constraint changes
degradationManager.onConstraintChange((level) => {
  console.log('Resource constraint level:', level)
})
```

### 4. Recovery and Monitoring Service (`src/services/monitoring.ts`)

Monitors system health, performance, and errors.

**Key Features:**
- Health checks for critical components
- Performance metrics collection
- Memory and CPU monitoring
- Error rate tracking
- Automatic alerting on issues

**Usage:**

```typescript
import { monitoringService, HealthStatus } from '@/services/monitoring'

// Register a health check
monitoringService.registerHealthCheck(
  'api-service',
  async () => {
    const response = await fetch('/api/health')
    if (!response.ok) throw new Error('API unhealthy')
  },
  30000 // Check every 30 seconds
)

// Monitor health status changes
monitoringService.onHealthStatusChange((results) => {
  const overallHealth = monitoringService.getOverallHealth()
  console.log('System health:', overallHealth)
})

// Monitor performance
monitoringService.onPerformanceMetrics((metrics) => {
  if (metrics.memoryUsed > 300) {
    console.warn('High memory usage:', metrics.memoryUsed, 'MB')
  }
})

// Record errors
monitoringService.recordError('API_ERROR')

// Get statistics
const stats = monitoringService.getErrorStats()
console.log('Error rate:', stats.errorRate)
```

## Vue Components

### 1. ErrorBoundary Component (`src/components/error/ErrorBoundary.vue`)

Global error boundary wrapper for handling component errors.

**Features:**
- Error categorization (network, data, component, critical)
- User-friendly error messages
- Automatic retry functionality
- Technical details for developers
- Error ID for support tracking

**Usage:**

```vue
<template>
  <ErrorBoundary
    :retryable="true"
    :show-details="isDevelopment"
    @error="handleError"
  >
    <YourComponent />
  </ErrorBoundary>
</template>

<script setup>
import ErrorBoundary from '@/components/error/ErrorBoundary.vue'

function handleError(error) {
  // Custom error handling
  console.error('Component error:', error)
}
</script>
```

### 2. FallbackWidget Component (`src/components/fallback/FallbackWidget.vue`)

Generic fallback UI for individual widgets.

**Features:**
- Loading state
- Error state with retry
- Graceful degradation

**Usage:**

```vue
<template>
  <FallbackWidget
    widget-name="Portfolio Chart"
    :is-loading="loading"
    :has-error="error !== null"
    error-message="Failed to load portfolio data"
    @retry="handleRetry"
  >
    <PortfolioChart v-if="!loading && !error" />
  </FallbackWidget>
</template>

<script setup>
import { ref } from 'vue'
import FallbackWidget from '@/components/fallback/FallbackWidget.vue'

const loading = ref(false)
const error = ref(null)

async function handleRetry() {
  loading.value = true
  try {
    // Retry logic
  } catch (err) {
    error.value = err
  } finally {
    loading.value = false
  }
}
</script>
```

### 3. OfflineBanner Component (`src/components/fallback/OfflineBanner.vue`)

Shows offline status and queued actions.

**Features:**
- Offline indicator
- Duration tracking
- Queued action count
- Progress indicator

**Usage:**

```vue
<template>
  <div>
    <OfflineBanner />
    <YourContent />
  </div>
</template>

<script setup>
import OfflineBanner from '@/components/fallback/OfflineBanner.vue'
</script>
```

### 4. ErrorToast Component (`src/components/fallback/ErrorToast.vue`)

Non-intrusive error notifications.

**Features:**
- Multiple severity levels
- Auto-dismiss with progress
- Manual dismiss
- Custom actions

**Usage:**

```vue
<template>
  <ErrorToast
    level="error"
    title="Trade Failed"
    message="Unable to execute order"
    :duration="5000"
    @dismiss="handleDismiss"
  />
</template>

<script setup>
import ErrorToast from '@/components/fallback/ErrorToast.vue'

function handleDismiss() {
  // Handle dismiss
}
</script>
```

### 5. NetworkQualityIndicator Component (`src/components/fallback/NetworkQualityIndicator.vue`)

Visual indicator of network quality.

**Features:**
- Quality bar visualization
- Detailed metrics display
- Real-time updates

**Usage:**

```vue
<template>
  <NetworkQualityIndicator :show-details="true" />
</template>

<script setup>
import NetworkQualityIndicator from '@/components/fallback/NetworkQualityIndicator.vue'
</script>
```

### 6. MaintenanceMode Component (`src/components/fallback/MaintenanceMode.vue`)

Planned maintenance display.

**Features:**
- Maintenance message
- Progress indicator
- Status updates
- Contact information

**Usage:**

```vue
<template>
  <MaintenanceMode
    title="Scheduled Maintenance"
    message="We're upgrading our systems"
    estimated-time="2 hours"
    :progress="45"
    :status-updates="updates"
    contact-email="support@example.com"
  />
</template>

<script setup>
const updates = [
  { timestamp: Date.now() - 300000, message: 'Database migration started' },
  { timestamp: Date.now() - 600000, message: 'Backup created' },
]
</script>
```

## Initialization

### 1. In Main App (`src/main.ts`)

```typescript
import { initializeResilienceSystem } from '@/services/resilience-init'

// Initialize resilience system when app starts
initializeResilienceSystem()

// Enable debug logging in development
if (import.meta.env.DEV) {
  const { enableResilienceDebug } = await import('@/services/resilience-init')
  enableResilienceDebug()
}
```

### 2. Wrap App with Error Boundary (`src/App.vue`)

```vue
<template>
  <ErrorBoundary>
    <OfflineBanner />
    <DashboardLayout />
  </ErrorBoundary>
</template>

<script setup>
import ErrorBoundary from '@/components/error/ErrorBoundary.vue'
import OfflineBanner from '@/components/fallback/OfflineBanner.vue'
import DashboardLayout from '@/components/layout/DashboardLayout.vue'
</script>
```

## Error Handling Scenarios

### Network Error

```typescript
import { notificationsService } from '@/services/notifications'

try {
  await apiService.fetchData()
} catch (error) {
  if (error instanceof ApiError && error.code === 'NETWORK_ERROR') {
    // Automatically queue for retry when online
    networkResilienceManager.queueOfflineAction('fetch-data', {})

    notificationsService.notify({
      level: 'warning',
      title: 'Network Error',
      message: 'Data will sync when connection is restored',
    })
  }
}
```

### Data Validation Error

```typescript
const validationResult = dataValidator.validateTrade(tradeData)
if (!validationResult.isValid) {
  validationResult.errors.forEach((error) => {
    notificationsService.notify({
      level: 'error',
      title: 'Data Error',
      message: `${error.field}: ${error.message}`,
    })
  })

  // Attempt recovery
  if (error.recoverable && error.suggestion) {
    console.log('Recovery suggestion:', error.suggestion)
  }
}
```

### Resource Constraint

```typescript
import { degradationManager } from '@/services/degradation'

// In a component that uses heavy resources
const shouldShowCharts = degradationManager.shouldShowCharts()
const shouldAnimate = degradationManager.shouldAnimate()

const updateFrequency = 1000 * degradationManager.getUpdateFrequencyMultiplier()
```

## Best Practices

### 1. Always Validate External Data

```typescript
// Before storing API data
const validation = dataValidator.validateApiResponse(apiData, schema)
if (validation.isValid) {
  // Store data
} else {
  // Handle errors and warnings
}
```

### 2. Queue Actions During Offline

```typescript
// When making network requests
if (!networkResilienceManager.isOnlineMode()) {
  networkResilienceManager.queueOfflineAction('api-call', {
    endpoint,
    method,
    data,
  })
  return // Don't make the request
}
```

### 3. Monitor Component Health

```typescript
onMounted(() => {
  // Register health check for your component
  monitoringService.registerHealthCheck('my-component', async () => {
    // Verify component is working
    if (!isDataValid) throw new Error('Component unhealthy')
  })
})
```

### 4. Graceful Feature Degradation

```typescript
// Use degradation manager to adapt to constraints
const updateInterval = 1000 * degradationManager.getUpdateFrequencyMultiplier()
const shouldRenderCharts = degradationManager.isFeatureEnabled('charts')
const shouldAnimate = degradationManager.shouldAnimate()
```

### 5. User Feedback

```typescript
// Always provide feedback to users
notificationsService.notify({
  level: 'info',
  title: 'Action Started',
  message: 'Processing your request...',
  duration: 3000,
})
```

## Development Tools

### Get System Status

```typescript
import { getSystemHealthSummary } from '@/services/resilience-init'

const health = getSystemHealthSummary()
console.log('System Health:', health)
// Output: {
//   overallHealth: 'healthy',
//   networkStatus: 'online',
//   networkQuality: 'excellent',
//   resourceConstraint: {...},
//   performance: {...},
//   errors: {...}
// }
```

### Monitor Network

```typescript
import { networkResilienceManager } from '@/services/resilience'

const stats = networkResilienceManager.getNetworkStats()
console.log('Network Stats:', stats)
// Output: {
//   isOnline: true,
//   quality: 'excellent',
//   avgLatency: 25,
//   maxLatency: 45,
//   minLatency: 12,
//   offlineQueueSize: 0
// }
```

### Check Resources

```typescript
import { degradationManager } from '@/services/degradation'

const usage = degradationManager.getResourceUsage()
console.log('Resource Usage:', usage)
// Output: {
//   timestamp: 1234567890,
//   memory: 150,
//   cpu: 35,
//   networkBandwidth: 10
// }
```

## Error Categories

### Network Errors
- `NETWORK_ERROR` - General network connectivity issues
- `TIMEOUT_ERROR` - Request timeout
- `CONNECTION_REFUSED` - Unable to reach server
- `OFFLINE` - No internet connection

### Data Errors
- `VALIDATION_ERROR` - Data doesn't match schema
- `DATA_CORRUPTION` - Data integrity issues
- `PARSE_ERROR` - JSON or response parsing failed
- `INCONSISTENCY` - Cross-source data mismatch

### Component Errors
- `RENDER_ERROR` - Component rendering failed
- `LIFECYCLE_ERROR` - Component lifecycle error
- `EVENT_ERROR` - Event handler error

### System Errors
- `MEMORY_ERROR` - Out of memory
- `STORAGE_ERROR` - LocalStorage/SessionStorage error
- `BROWSER_ERROR` - Browser API not available

## Monitoring Thresholds

- **Memory**: Critical at 300MB, Severe at 250MB, Warning at 200MB
- **CPU**: Critical at >80%, Warning at >60%
- **Network Quality**: Critical at >1000ms latency, Poor at >300ms
- **Error Rate**: Warning at >10% errors in time window
- **Health Check**: Fails after 5 consecutive errors, recovers after 2 successes

## Customization

### Custom Health Checks

```typescript
monitoringService.registerHealthCheck('my-service', async () => {
  const response = await fetch('/api/my-service/health')
  const data = await response.json()
  if (data.status !== 'ok') {
    throw new Error('Service unhealthy: ' + data.reason)
  }
})
```

### Custom Features

```typescript
degradationManager.registerFeature({
  id: 'my-feature',
  name: 'My Feature',
  priority: FeaturePriority.HIGH,
  enabled: true,
  resourceCost: 25,
  fallback: { /* fallback data */ },
})
```

### Custom Circuit Breaker

```typescript
const breaker = networkResilienceManager.getCircuitBreaker('my-api', {
  failureThreshold: 3,
  successThreshold: 2,
  timeout: 60000, // 1 minute
  name: 'my-api-breaker',
})

// Use with protection
try {
  await breaker.execute(() => fetchFromMyAPI())
} catch (error) {
  console.error('Circuit breaker open:', error.message)
}
```

## Debugging

Enable debug logging:

```typescript
import { enableResilienceDebug } from '@/services/resilience-init'

// In development
if (import.meta.env.DEV) {
  enableResilienceDebug()
}
```

This will log every 10 seconds:
- Network statistics
- Resource usage
- Overall system health
- Error statistics

## Migration Guide

### From Basic Error Handling to Resilience System

1. **Replace try-catch with ErrorBoundary**
   ```vue
   <!-- Before -->
   <div v-if="error">Error occurred</div>

   <!-- After -->
   <ErrorBoundary>
     <YourComponent />
   </ErrorBoundary>
   ```

2. **Use dataValidator for API responses**
   ```typescript
   // Before
   const data = await api.get('/endpoint')

   // After
   const data = await api.get('/endpoint')
   const validation = dataValidator.validateApiResponse(data, schema)
   ```

3. **Queue offline actions**
   ```typescript
   // Before
   await api.post('/order', orderData)

   // After
   if (networkResilienceManager.isOnlineMode()) {
     await api.post('/order', orderData)
   } else {
     networkResilienceManager.queueOfflineAction('place-order', orderData)
   }
   ```

## Performance Impact

- **Network Monitoring**: ~1-2% CPU overhead (5 second check interval)
- **Resource Monitoring**: ~0.5-1% CPU overhead (5 second check interval)
- **Data Validation**: <1ms per validation operation
- **Memory**: ~5-10MB for offline queue and history buffers

## Support and Troubleshooting

- **Nothing is cached offline**: Check browser's localStorage is enabled
- **Network quality always critical**: Check API endpoint availability at `/api/health`
- **Features not disabling**: Check feature priority registration
- **Errors not logged**: Check browser console and monitoring service logs
