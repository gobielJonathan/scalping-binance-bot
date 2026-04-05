# Real-time Features Integration Guide

## Quick Start

### 1. Add Connection Status Component to Dashboard

Add to your dashboard layout (`src/components/layout/DashboardLayout.vue`):

```vue
<template>
  <div class="dashboard">
    <!-- Your existing layout -->
    
    <!-- Add connection status in header -->
    <div class="dashboard-header">
      <ConnectionStatus />
      <!-- Other header items -->
    </div>
    
    <!-- Rest of dashboard content -->
  </div>
</template>

<script setup lang="ts">
import ConnectionStatus from '@/components/common/ConnectionStatus.vue'
</script>
```

### 2. Subscribe to Real-time Updates in Components

For portfolio component:

```vue
<script setup lang="ts">
import { usePortfolioStore } from '@/stores'
import { onMounted, onUnmounted } from 'vue'

const portfolioStore = usePortfolioStore()
let unsubscribe: (() => void) | null = null

onMounted(() => {
  // Subscribe to real-time portfolio updates
  unsubscribe = portfolioStore.subscribeToUpdates()
})

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe()
  }
})
</script>
```

For positions component:

```vue
<script setup lang="ts">
import { usePositionsStore } from '@/stores'
import { onMounted, onUnmounted } from 'vue'

const positionsStore = usePositionsStore()
let unsubscribe: (() => void) | null = null

onMounted(() => {
  unsubscribe = positionsStore.subscribeToUpdates()
})

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe()
  }
})
</script>
```

For trades component:

```vue
<script setup lang="ts">
import { useTradesStore } from '@/stores'
import { onMounted, onUnmounted } from 'vue'

const tradesStore = useTradesStore()
let unsubscribe: (() => void) | null = null

onMounted(() => {
  unsubscribe = tradesStore.subscribeToUpdates()
})

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe()
  }
})
</script>
```

### 3. Configure Notification Thresholds

In your settings or initialization code:

```typescript
import { notificationsService } from '@/services/notifications'

// Set custom thresholds
notificationsService.setThresholds({
  profitThreshold: 100,           // Notify on $100+ profit
  lossThreshold: -100,            // Notify on $100+ loss
  profitPercentThreshold: 5,      // Notify on 5%+ profit
  lossPercentThreshold: -5,       // Notify on 5%+ loss
})
```

### 4. Monitor Connection Status

Access connection information:

```typescript
import websocketService, { ConnectionStatus } from '@/services/websocket'

// Check connection
if (websocketService.isConnected()) {
  // Safe to emit commands
}

// Listen to status changes
const unsubscribe = websocketService.onConnectionStatusChange((status) => {
  if (status === ConnectionStatus.CONNECTED) {
    console.log('Trading system connected')
  } else if (status === ConnectionStatus.DISCONNECTED) {
    console.log('Trading system disconnected')
  }
})

// Get detailed metrics
const metrics = websocketService.getMetrics()
console.log(`Current latency: ${metrics.latency}ms`)
console.log(`Connected duration: ${metrics.connectionDuration}ms`)
```

## Implementation Checklist

- [ ] Connection Status component added to dashboard
- [ ] All data components subscribed to real-time updates
- [ ] Notification thresholds configured per requirements
- [ ] Connection status monitored in critical operations
- [ ] Error handling for network failures
- [ ] Testing of real-time updates verified
- [ ] Performance monitoring for high-frequency updates
- [ ] Documentation updated for team

## Common Patterns

### Handling Connection Errors

```typescript
const handleOfflineMode = () => {
  const appStore = useAppStore()
  if (!websocketService.isConnected()) {
    appStore.notifyWarning('Real-time updates are unavailable')
    // Implement fallback to polling if needed
  }
}
```

### Conditional Rendering Based on Connection

```vue
<template>
  <div class="trading-controls">
    <button 
      v-if="appStore.isConnected"
      @click="executeTrade"
    >
      Execute Trade
    </button>
    <button 
      v-else
      disabled
    >
      Offline - Cannot Trade
    </button>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '@/stores'
const appStore = useAppStore()
</script>
```

### Custom Event Handlers

For additional events not handled by default orchestrator:

```typescript
import websocketService from '@/services/websocket'

// Subscribe to custom events
const unsubscribe = websocketService.subscribe('custom:event', (data) => {
  console.log('Custom event received:', data)
  // Handle custom event
})

// Emit to server
websocketService.emitToServer('custom:command', {
  action: 'specific-operation',
  params: { /* ... */ }
})
```

### Request/Response Pattern

```typescript
try {
  const response = await websocketService.request('system:restart', {
    force: true
  })
  console.log('Server response:', response)
} catch (error) {
  console.error('Request failed:', error)
  // Handle timeout or disconnection
}
```

## Performance Considerations

### High-Frequency Updates

For components receiving frequent updates (e.g., ticker updates):

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { throttle } from '@/utils/throttle' // Create if needed

const lastUpdate = ref<number>(0)
const updateThrottle = 100 // ms

const handleUpdate = throttle(() => {
  lastUpdate.value = Date.now()
  // Process update
}, updateThrottle)
</script>
```

### Large Data Sets

For components with many items (positions, trades):

```vue
<script setup lang="ts">
import { computed } from 'vue'

const pageSize = 10
const filteredAndPaginated = computed(() => {
  // Use store's existing pagination
  // Avoid processing all items on each update
})
</script>
```

### Memory Management

- Component cleanup with `onUnmounted`
- Unsubscribe from all events when components destroy
- Use notification history getter with caution (limited to 100)

## Debugging

### Enable Detailed Logging

In `src/config/environment.ts`:

```typescript
features: {
  enableLogging: true, // Set to true even in production temporarily
}
```

### Check Metrics

```typescript
// In browser console
websocketService.getMetrics() // Full metrics
websocketService.getHealthReport() // Health status
websocketService.getQueueStatus() // Queue info
realtimeOrchestrator.getSubscriptionStatus() // Event subscriptions
notificationsService.getStats() // Notification stats
notificationsService.getHistory() // All notifications
```

### Monitor Network Traffic

1. Open DevTools → Network tab
2. Filter by WebSocket
3. Observe connection and messages
4. Check for reconnections and queue operations

### Check Store State

In Vue DevTools Pinia extension:
- Watch store mutations
- Observe when real-time updates trigger changes
- Verify data consistency

## Troubleshooting

### Real-time Updates Not Working

1. **Check connection:** Is ConnectionStatus showing green?
2. **Check subscriptions:** Run `realtimeOrchestrator.getSubscriptionStatus()`
3. **Check console:** Look for error messages from orchestrator
4. **Verify data:** Check if incoming data matches interface types
5. **Check store:** Verify store handler is being called

### Connection Keeps Dropping

1. **Check network:** Is internet connection stable?
2. **Check server:** Is Socket.IO server running?
3. **Check latency:** Is ConnectionStatus showing high latency?
4. **Check logs:** Server logs for connection issues
5. **Increase timeouts:** Adjust reconnect settings if on slow network

### High Memory Usage

1. **Check notification history:** Clear with `notificationsService.clearHistory()`
2. **Check alert retention:** System alerts keep last 100, adjust if needed
3. **Check subscriptions:** Ensure components unsubscribe on unmount
4. **Profile:** Use Chrome DevTools Memory profiler

### Duplicate Updates

1. **Check deduplication:** 100ms window is default
2. **Adjust if needed:** Modify `eventDeduplicationWindow` in orchestrator
3. **Check server:** Is server sending duplicate events?

## API Integration

### Connecting to Trading Bot

Ensure your trading bot WebSocket server is configured:

```javascript
// Backend Socket.IO server setup (for reference)
const io = require('socket.io')
const server = io(3000, {
  cors: { origin: 'http://localhost:5173' }
})

// Emit events
server.on('connection', (socket) => {
  // Emit portfolio updates
  socket.emit('portfolio:updated', portfolioData)
  
  // Listen for commands
  socket.on('execute-trade', (data) => {
    // Handle trade execution
  })
})
```

Frontend expects events:
- `portfolio:updated` - Portfolio data
- `position:opened/updated/closed` - Position changes
- `trade:executed` - Trade completions
- `order:created/updated/filled` - Order events
- `ticker:update` - Ticker data
- `market:data` - OHLCV data
- `system:status` - System status
- `system:alert` - System alerts

## Next Steps

1. Test with your trading bot WebSocket server
2. Adjust notification thresholds based on trading strategy
3. Monitor real-time performance in production
4. Gather user feedback on connection stability
5. Consider implementing server-side request compression for high-frequency data
6. Plan for optional features like local caching and persistence

---

**Version:** 1.0  
**Last Updated:** 2024  
**Maintainer:** Trading Bot Team
