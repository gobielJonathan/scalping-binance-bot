# Socket.IO Real-time Features Implementation

## Overview

This document describes the comprehensive Socket.IO real-time functionality implemented for the Vue 3 trading dashboard. The system provides real-time data synchronization, connection monitoring, and intelligent notifications for continuous trading data streams.

## Architecture

### Core Components

#### 1. Enhanced WebSocket Service (`src/services/websocket.ts`)

The foundation of real-time communication with advanced features:

**Key Features:**
- Connection status monitoring (DISCONNECTED → CONNECTING → CONNECTED → RECONNECTING)
- Automatic reconnection with exponential backoff
- Health check monitoring with latency tracking
- Request queue system for offline support
- Bandwidth and message tracking
- Event callback system for flexible event handling

**Connection States:**
```typescript
enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed',
}
```

**Key Methods:**
```typescript
// Connection management
connect(): Promise<void>
disconnect(): void
reconnect(): Promise<void>

// Status monitoring
isConnected(): boolean
getConnectionStatus(): ConnectionStatus
getMetrics(): ConnectionMetrics
getHealthReport(): HealthCheckReport
getQueueStatus()

// Event subscriptions
subscribe<E>(event: E, callback: (data) => void): () => void
onConnectionStatusChange(callback): () => void
onMetricsChange(callback): () => void

// Server communication
emitToServer<E>(event: E, data?: any): void
request<T>(event: string, data?: any): Promise<T>
```

**Automatic Features:**
- Progressive exponential backoff (1s → 30s maximum)
- Health checks every 10 seconds via ping/pong
- Request queuing up to 100 items when offline
- Automatic queue flush every 5 seconds when connected
- Metrics emission every time messages are sent/received

#### 2. Real-time Data Orchestrator (`src/services/realtime.ts`)

Central coordinator that routes all Socket.IO events to appropriate Pinia stores.

**Responsibilities:**
- Subscribe to all Socket.IO events
- Validate incoming data with strict TypeScript types
- Route events to store handlers
- Handle duplicate detection (100ms deduplication window)
- Error recovery with retry logic (max 3 attempts)
- Subscription lifecycle management

**Event Routing:**
```
Socket.IO Event → Data Validation → Store Handler → State Update
```

**Events Handled:**
- Portfolio: `portfolio:updated`
- Positions: `position:opened`, `position:updated`, `position:closed`
- Orders: `order:created`, `order:updated`, `order:filled`
- Trades: `trade:executed`
- Market Data: `ticker:update`, `market:data`
- System: `system:status`, `system:alert`

**Data Validators:**
Built-in validators ensure type safety:
```typescript
DataValidator.validatePortfolio(data)
DataValidator.validatePosition(data)
DataValidator.validateTrade(data)
DataValidator.validateMarketData(data)
DataValidator.validateSystemStatus(data)
DataValidator.validateSystemAlert(data)
```

#### 3. Real-time Notifications Service (`src/services/notifications.ts`)

Manages user notifications for important trading events.

**Notification Types:**
- Trade Execution Notifications (success/warning based on P&L)
- System Alerts (critical, error, warning, info)
- Connection Status Changes (lost, reconnecting, restored, failed)
- Portfolio Milestones (profit/loss thresholds)
- Emergency Stop Alerts

**Notification Levels:**
```typescript
enum NotificationLevel {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}
```

**Configurable Thresholds:**
```typescript
{
  profitThreshold: 100,           // $100
  lossThreshold: -100,            // -$100
  profitPercentThreshold: 5,      // 5%
  lossPercentThreshold: -5,       // -5%
}
```

**Key Methods:**
```typescript
initialize(): void
notifyTradeExecution(trade: Trade): void
notifySystemAlert(alert: SystemAlert): void
notifyPortfolioMilestone(type, amount, percent): void
notifyEmergencyStop(reason: string): void
setThresholds(thresholds: Partial<NotificationThresholds>): void
getThresholds(): NotificationThresholds
getHistory(): NotificationConfig[]
getStats()
clearHistory(): void
```

#### 4. Connection Status Component (`src/components/common/ConnectionStatus.vue`)

Visual indicator for WebSocket connection status with detailed metrics.

**Features:**
- Real-time connection status badge (green, yellow, red)
- Animated pulse/spinner based on status
- Clickable details panel showing:
  - Current latency (color-coded: <50ms green, <100ms yellow, >100ms red)
  - Reconnection attempts counter
  - Connection duration timer
  - Message statistics (sent/received)
  - Error count
  - Queue status
  - Health report
- Manual reconnection button
- Metrics refresh functionality

**Status Indicators:**
- ✓ Green pulse: Connected and healthy
- 🔄 Yellow spinner: Reconnecting
- ✕ Red: Disconnected or failed

## Store Integration

All Pinia stores have been enhanced with WebSocket event handlers:

### Portfolio Store (`usePortfolioStore`)
```typescript
updatePortfolioFromWS(data: Portfolio): void
subscribeToUpdates(): () => void
```

### Positions Store (`usePositionsStore`)
```typescript
addPositionFromWS(data: Position): void
updatePositionFromWS(data: Position): void
removePositionFromWS(data: Position): void
subscribeToUpdates(): () => void
```

### Trades Store (`useTradesStore`)
```typescript
addTradeFromWS(data: Trade): void
addOrderFromWS(data: Order): void
updateOrderFromWS(data: Order): void
subscribeToUpdates(): () => void
```

### System Store (`useSystemStore`)
```typescript
updateSystemStatusFromWS(data: SystemStatus): void
addSystemAlertFromWS(data: SystemAlert): void
updateTickerFromWS(data: Ticker): void
updateMarketDataFromWS(data: MarketData): void
subscribeToUpdates(): () => void
```

## Initialization

The real-time system is initialized in `src/main.ts`:

```typescript
const initializeRealtimeServices = async () => {
  // 1. Connect WebSocket
  await websocket.connect()
  
  // 2. Initialize notifications
  notificationsService.initialize()
  
  // 3. Initialize data orchestrator
  await realtimeOrchestrator.initialize()
}
```

This happens automatically when `enableAutoConnect` is true in the environment config.

## Usage Examples

### Accessing Connection Status

```typescript
import websocketService, { ConnectionStatus } from '@/services/websocket'

// Check if connected
if (websocketService.isConnected()) {
  // Safe to emit events
  websocketService.emitToServer('custom-event', data)
}

// Get current metrics
const metrics = websocketService.getMetrics()
console.log(`Latency: ${metrics.latency}ms`)
console.log(`Messages sent: ${metrics.messagesSent}`)

// Subscribe to status changes
const unsubscribe = websocketService.onConnectionStatusChange((status) => {
  if (status === ConnectionStatus.CONNECTED) {
    console.log('Ready for trading!')
  }
})
```

### Handling Trade Notifications

```typescript
import { notificationsService } from '@/services/notifications'

// Trade execution automatically triggers notifications
// via the realtime orchestrator

// Customize notification thresholds
notificationsService.setThresholds({
  profitThreshold: 200,      // Notify on $200+ profit
  profitPercentThreshold: 10, // Notify on 10%+ profit
  lossThreshold: -200,       // Notify on $200+ loss
})

// Get notification statistics
const stats = notificationsService.getStats()
console.log(`Trades notified: ${stats.totalTradeNotifications}`)
```

### Subscribing to Real-time Data

```typescript
import { usePortfolioStore } from '@/stores'

const portfolioStore = usePortfolioStore()

// Subscribe to portfolio updates
const unsubscribe = portfolioStore.subscribeToUpdates()

// Component cleanup
onUnmounted(() => {
  unsubscribe()
})
```

## Performance Optimization

### High-Frequency Data Handling

The system is optimized for high-frequency data streams:

**Throttling:**
- Market data updates are deduplicated within 100ms window
- Multiple updates to the same event in quick succession are ignored

**Batching:**
- Request queue batches operations during network issues
- Queue is flushed every 5 seconds for efficiency

**Memory Management:**
- Notification history limited to 100 items
- System alerts limited to 100 items
- Price history automatically pruned to 30 days

**Efficient Re-rendering:**
- Vue 3 reactive system automatically optimizes re-renders
- Store mutations trigger only necessary component updates
- Connection status changes debounced by 500ms

### Network Usage Optimization

**Connection Management:**
- Single WebSocket connection for all data streams
- Event batching reduces connection overhead
- Request queue prevents duplicate transmissions
- Health checks use minimal bandwidth (ping/pong)

**Data Validation:**
- Early validation prevents processing invalid data
- Type guards catch errors before store updates
- Error recovery prevents cascade failures

## Error Handling

### Connection Errors

The system handles various connection scenarios:

```
Manual Disconnect
    ↓
User Initiates Reconnect
    ↓
Auto Reconnect with Exponential Backoff
    ↓
Health Check Failures (consecutive failures)
    ↓
Connection Failed Status → User Notified
```

### Data Validation Errors

Invalid data is caught and handled gracefully:

```
Invalid Data Received
    ↓
DataValidator Rejects
    ↓
Error Recovery (retry up to 3 times)
    ↓
Event Handler Disabled if Max Retries Exceeded
```

### Request Queue Overflow

When offline for extended periods:

```
Queue Reaches Max (100 items)
    ↓
Oldest Request Discarded
    ↓
User Notified via Connection Status
    ↓
Queue Flushed on Reconnection
```

## Monitoring and Debugging

### Development Console Output

Enable logging in development mode:

```typescript
// src/config/environment.ts
features: {
  enableLogging: isDevelopment,
}
```

Console output includes:
- `[WebSocket]` - Connection events and metrics
- `[RealtimeOrchestrator]` - Event routing and data updates
- `[NotificationsService]` - Notification events

### Metrics Tracking

```typescript
const metrics = websocketService.getMetrics()

// Full metrics available:
{
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
```

### Health Reports

```typescript
const health = websocketService.getHealthReport()

// Health report:
{
  isHealthy: boolean                    // Consecutive failures < 3
  status: ConnectionStatus
  latency: number                       // In milliseconds
  lastPingAt: number                    // Timestamp
  consecutiveFailures: number           // Failed health checks
}
```

## Configuration

### Environment Variables

```bash
VITE_SOCKET_URL=http://localhost:3000        # WebSocket server URL
VITE_SOCKET_PATH=/socket.io                  # Socket.IO path
VITE_API_BASE_URL=http://localhost:3000      # API base URL (same as socket URL typically)
```

### Feature Flags

```typescript
// src/config/environment.ts
features: {
  enableAutoConnect: true,      // Auto-connect on app startup
  enableLogging: isDevelopment, // Console logging
  enableDevTools: isDevelopment,
}

// Connection settings
reconnectAttempts: 5,           // Max reconnection attempts
reconnectDelay: 1000,           // Initial delay in ms (uses exponential backoff)
requestTimeout: 30000,          // Request timeout in ms
```

## Event Types Reference

### Socket.IO Events from Trading Bot

**Portfolio Events:**
- `portfolio:updated` - Portfolio balance, equity, P&L updated
- `position:opened` - New position opened
- `position:updated` - Position price/P&L updated
- `position:closed` - Position closed

**Trade & Order Events:**
- `order:created` - Order submitted
- `order:updated` - Order status changed
- `order:filled` - Order partially/fully filled
- `trade:executed` - Trade execution completed

**Market Events:**
- `ticker:update` - Ticker data update (high-frequency)
- `market:data` - OHLCV candle data

**System Events:**
- `system:status` - System status update
- `system:alert` - System alert/warning

## Troubleshooting

### Connection Issues

**Symptoms:** "Connection Lost" notification persists

**Solutions:**
1. Check network connectivity
2. Verify WebSocket server is running on configured URL
3. Check browser console for error messages
4. Look for CORS or authentication errors
5. Try manual reconnect via connection status panel

### Missing Real-time Updates

**Symptoms:** Portfolio/positions not updating in real-time

**Solutions:**
1. Check connection status indicator
2. Verify stores have subscribed to updates
3. Check console for validation errors
4. Ensure event types match those emitted by server
5. Check data format matches TypeScript interfaces

### High Latency

**Symptoms:** Latency shown >100ms in connection status

**Solutions:**
1. Check network conditions
2. Reduce number of high-frequency subscriptions
3. Consider request batching on server
4. Move server closer (reduce network hop count)
5. Profile with browser dev tools

### Queue Full Messages

**Symptoms:** "Request queue is full" in console

**Solutions:**
1. Indicates extended offline periods
2. Check network stability
3. Oldest requests will be discarded
4. Queue automatically flushes on reconnection
5. Consider queuing strategy in application logic

## Testing

### Unit Tests for Services

```typescript
// Test connection lifecycle
describe('WebSocket Connection', () => {
  it('should connect and update status', async () => {
    await websocketService.connect()
    expect(websocketService.isConnected()).toBe(true)
  })
})

// Test event routing
describe('Realtime Orchestrator', () => {
  it('should route portfolio events to store', async () => {
    // Mock event
    const mockData = { /* portfolio data */ }
    websocketService.emitToCallbacks('portfolio:updated', mockData)
    // Assert store update
  })
})

// Test notifications
describe('Notifications Service', () => {
  it('should notify on trade execution', () => {
    const trade = { /* trade data */ }
    notificationsService.notifyTradeExecution(trade)
    // Assert notification added
  })
})
```

## Migration from Manual Polling

If migrating from REST polling to real-time:

**Before (Polling):**
```typescript
onMounted(async () => {
  const data = await api.getPortfolio()
  store.setPortfolio(data)
  
  setInterval(async () => {
    const data = await api.getPortfolio()
    store.setPortfolio(data)
  }, 5000)
})
```

**After (Real-time):**
```typescript
onMounted(() => {
  const store = usePortfolioStore()
  const unsubscribe = store.subscribeToUpdates()
  
  onUnmounted(() => {
    unsubscribe()
  })
})
```

## Future Enhancements

Potential improvements for future versions:

1. **Compression:** Add message compression for high-frequency data
2. **Caching:** Implement client-side caching for offline recovery
3. **Persistence:** Save pending requests to IndexedDB
4. **Rate Limiting:** Client-side rate limiting for expensive operations
5. **Partial Updates:** Support incremental data patches
6. **WebWorker:** Move orchestration to Web Worker for better performance
7. **Analytics:** Detailed analytics on connection quality
8. **Circuit Breaker:** Automatic fallback to REST API on persistent failures

## Support

For issues or questions about the real-time system:

1. Check console output (in development mode)
2. Review Connection Status component metrics
3. Check integration tests for usage examples
4. Review event validation in data orchestrator
5. Check store handler implementations

---

**Last Updated:** 2024
**Version:** 1.0
**Status:** Production Ready
