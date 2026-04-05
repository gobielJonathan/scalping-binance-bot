# Pinia Data Stores Implementation

This directory contains comprehensive Pinia stores for the Vue 3 trading dashboard application. All stores are fully typed with TypeScript and integrate with real-time WebSocket updates.

## 📦 Stores Overview

### 1. **Portfolio Store** (`portfolio.ts`)

Manages account balance, equity, and performance metrics with real-time updates.

**Key Features:**
- Current balance, available balance, and locked funds tracking
- Daily, weekly, and monthly P&L calculations with percentages
- Maximum drawdown and current drawdown metrics
- 30-day historical balance and equity tracking
- Real-time updates via WebSocket
- Win rate qualifiers (Poor, Fair, Good, Very Good, Excellent)

**Main Computed Properties:**
- `currentBalance` - Total account balance
- `availableBalance` - Available funds
- `lockedFunds` - Funds locked in positions
- `totalPnl`, `totalPnlPercent` - Total P&L and percentage
- `dailyPnl`, `weeklyPnl`, `monthlyPnl` - Period returns
- `maxDrawdown`, `currentDrawdown` - Risk metrics

**Main Actions:**
- `fetchPortfolio()` - Fetch current portfolio data
- `subscribeToUpdates()` - Listen to WebSocket portfolio updates

### 2. **Positions Store** (`positions.ts`)

Manages all open trading positions with real-time P&L calculations.

**Key Features:**
- Open position tracking with entry and current prices
- Real-time unrealized P&L per position
- Aggregate exposure and risk metric calculations
- Win rate and profitability analysis
- Position filtering (by symbol, P&L range, profitability)
- Position sorting (by symbol, quantity, P&L, etc.)
- Position grouping by symbol
- Position lifecycle tracking (opened, updated, closed)

**Main Computed Properties:**
- `totalPositions` - Number of open positions
- `profitableCount`, `losingCount` - Position counts by status
- `winRate` - Percentage of profitable positions
- `totalUnrealizedPnl`, `totalUnrealizedPnlPercent` - Aggregate P&L
- `totalExposure` - Total notional exposure
- `bestPosition`, `worstPosition` - Performance extremes
- `filteredPositions` - Positions after applying filters/sorts

**Main Actions:**
- `fetchPositions()` - Load all open positions
- `setFilter(filter)` - Apply position filters
- `setSortBy(field, order)` - Sort positions
- `subscribeToUpdates()` - Listen for position changes

### 3. **Trades Store** (`trades.ts`)

Maintains trade history with comprehensive statistics and pagination.

**Key Features:**
- Paginated trade history (configurable page size)
- Comprehensive trade statistics:
  - Win/loss counts and win rate
  - Profit factor and risk/reward ratio
  - Average win/loss sizes
  - Best/worst trades
  - Consecutive win/loss streaks
- Trade filtering (by symbol, date range, profitability)
- Trade sorting and grouping by symbol
- Symbol-level performance analysis
- Real-time trade execution updates from WebSocket

**Main Computed Properties:**
- `winCount`, `lossCount`, `winRate` - Win statistics
- `totalPnl`, `totalPnlPercent` - Aggregate results
- `avgWinSize`, `avgLossSize` - Average trade metrics
- `profitFactor`, `riskRewardRatio` - Key ratios
- `consecutiveWins`, `consecutiveLosses` - Streak tracking
- `tradesBySymbol`, `symbolPerformance` - Symbol analysis
- `paginatedTrades`, `totalPages` - Pagination helpers

**Main Actions:**
- `fetchTrades(page, limit)` - Load trades with pagination
- `setFilter(filter)` - Apply trade filters
- `goToPage(page)`, `nextPage()`, `prevPage()` - Pagination control
- `subscribeToUpdates()` - Listen for new trades

### 4. **Market Store** (`market.ts`)

Real-time price tickers and market data streaming.

**Key Features:**
- Live price updates for all watched symbols
- Bid/ask spread tracking and analysis
- 24-hour price change calculations
- Price history caching (up to 1000 points per symbol)
- Top gainers, losers, and highest volume tracking
- Formatted price display utilities
- Watch list management
- OHLCV candle data handling

**Main Computed Properties:**
- `getTicker(symbol)` - Get ticker for symbol
- `getPrice(symbol)`, `getBid(symbol)`, `getAsk(symbol)` - Price data
- `getSpread(symbol)` - Bid/ask spread
- `formatPrice(symbol)`, `formatChange(symbol)` - Formatted output
- `getPriceChangeColor(symbol)` - Visual indicators
- `getPriceHistory(symbol)` - Historical prices
- `topGainers`, `topLosers`, `highestVolume` - Market leaders
- `watchedTickers`, `allWatchedSymbols` - Watched symbols

**Main Actions:**
- `subscribeToTickerUpdates()` - Listen for price ticks
- `subscribeToMarketData()` - Listen for OHLCV candles
- `watchSymbol(symbol)`, `unwatchSymbol(symbol)` - Manage watch list

### 5. **System Store** (`system.ts`)

System status monitoring, connection health, alerts, and preferences.

**Key Features:**
- Trading system status (running, paused, stopped, error)
- API and WebSocket connection health monitoring
- Latency tracking and performance metrics
- System alerts with severity levels
- User preferences (theme, notifications, trading settings)
- System resource monitoring (CPU, memory, disk)
- Trading control (enable/disable trading, trading modes)

**Main Computed Properties:**
- `isHealthy` - Overall system health
- `isApiConnected`, `isWebSocketConnected` - Connection status
- `avgLatency`, `maxLatency`, `minLatency` - Latency metrics
- `cpuUsage`, `memoryUsage`, `diskUsage` - Resource usage
- `unreadAlerts`, `criticalAlerts`, `recentAlerts` - Alert management
- `isTradingEnabled` - Trading status
- `connectionStatusColor` - Visual status indicator

**Main Actions:**
- `fetchSystemStatus()` - Load system status
- `checkHealth()` - Check API connectivity
- `subscribeToUpdates()` - Listen for status changes
- `markAlertAsRead(id)` - Mark alert as read
- `addAlert(alert)` - Add system alert
- `enableTrading()`, `disableTrading()` - Control trading

### 6. **App Store** (`app.ts`)

UI-level state management for theme, notifications, and connection status.

**Key Features:**
- Theme management (light/dark mode)
- Sidebar collapse state
- Notification system with auto-dismiss
- Connection status tracking
- Preference persistence to localStorage
- Quick notification methods (success, error, warning, info)

**Main Computed Properties:**
- `isDarkMode` - Theme indicator
- `isSidebarCollapsed` - Sidebar state
- `isConnected`, `isConnecting` - Connection status
- `hasNotifications`, `notificationCount` - Notification status

**Main Actions:**
- `setTheme(theme)`, `toggleTheme()` - Theme control
- `toggleSidebar()`, `collapseSidebar()`, `expandSidebar()` - Sidebar control
- `addNotification()` - Add custom notification
- `notifySuccess()`, `notifyError()`, `notifyWarning()`, `notifyInfo()` - Quick notifications
- `loadPreferences()` - Load saved preferences
- `setConnectionStatus(status)` - Update connection status

## 🔌 WebSocket Integration

All data stores that require real-time updates subscribe to WebSocket events:

```javascript
// Portfolio updates
websocketService.subscribe('portfolio:updated', handlePortfolioUpdate)

// Position lifecycle
websocketService.subscribe('position:opened', handlePositionOpened)
websocketService.subscribe('position:updated', handlePositionUpdated)
websocketService.subscribe('position:closed', handlePositionClosed)

// Trade execution
websocketService.subscribe('trade:executed', handleTradeExecuted)

// Market data
websocketService.subscribe('ticker:update', handleTickerUpdate)
websocketService.subscribe('market:data', handleMarketData)

// System events
websocketService.subscribe('system:status', handleSystemStatusUpdate)
websocketService.subscribe('system:alert', handleSystemAlert)
```

## 📊 Usage Examples

### Initialize Dashboard

```typescript
import { usePortfolioStore } from '@/stores/portfolio'
import { usePositionsStore } from '@/stores/positions'
import { useTradesStore } from '@/stores/trades'
import { useMarketStore } from '@/stores/market'
import { useSystemStore } from '@/stores/system'
import { useAppStore } from '@/stores/app'

// In your app setup (e.g., App.vue or main.ts)
async function setupDashboard() {
  const app = useAppStore()
  const portfolio = usePortfolioStore()
  const positions = usePositionsStore()
  const trades = useTradesStore()
  const market = useMarketStore()
  const system = useSystemStore()

  // Load preferences
  app.loadPreferences()

  // Fetch initial data
  await Promise.all([
    portfolio.fetchPortfolio(),
    positions.fetchPositions(),
    trades.fetchTrades(1, 50),
    system.fetchSystemStatus(),
  ])

  // Subscribe to real-time updates
  portfolio.subscribeToUpdates()
  positions.subscribeToUpdates()
  trades.subscribeToUpdates()
  system.subscribeToUpdates()
  market.subscribeToTickerUpdates()

  // Watch important symbols
  market.watchSymbol('BTC/USD')
  market.watchSymbol('ETH/USD')
}
```

### Display Portfolio Metrics

```vue
<template>
  <div v-if="!portfolio.isLoading" class="portfolio">
    <div class="balance">
      <span class="label">Balance</span>
      <span class="value">${{ portfolio.currentBalance.toFixed(2) }}</span>
    </div>
    <div class="pnl" :class="portfolio.pnlColor">
      <span class="label">Total P&L</span>
      <span class="value">{{ portfolio.totalPnlPercent.toFixed(2) }}%</span>
    </div>
    <div class="returns">
      <div>Daily: {{ portfolio.dailyPnlPercent.toFixed(2) }}%</div>
      <div>Weekly: {{ portfolio.weeklyPnlPercent.toFixed(2) }}%</div>
      <div>Monthly: {{ portfolio.monthlyPnlPercent.toFixed(2) }}%</div>
    </div>
  </div>
</template>

<script setup>
import { usePortfolioStore } from '@/stores/portfolio'

const portfolio = usePortfolioStore()

// Fetch on mount
onMounted(async () => {
  await portfolio.fetchPortfolio()
  portfolio.subscribeToUpdates()
})
</script>
```

### Filter and Sort Positions

```typescript
const positions = usePositionsStore()

// Show only profitable positions
positions.setFilter({ profitableOnly: true })

// Sort by P&L descending
positions.setSortBy('pnl', 'desc')

// Get filtered/sorted positions
const profitable = positions.filteredPositions

// Filter by symbol
positions.setFilter({ symbol: 'BTC' })

// Clear filters
positions.clearFilter()
```

### Analyze Trade Statistics

```typescript
const trades = useTradesStore()

await trades.fetchTrades(1, 100)

// Display key metrics
console.log(`Win Rate: ${trades.winRate.toFixed(2)}%`)
console.log(`Profit Factor: ${trades.profitFactor.toFixed(2)}`)
console.log(`Avg Win: $${trades.avgWinSize.toFixed(2)}`)
console.log(`Avg Loss: $${trades.avgLossSize.toFixed(2)}`)
console.log(`Risk/Reward: ${trades.riskRewardRatio.toFixed(2)}`)

// Pagination
trades.nextPage()
trades.prevPage()
trades.goToPage(3)
```

### Handle Notifications

```typescript
const app = useAppStore()

// Quick notification methods
app.notifySuccess('Trade executed successfully!')
app.notifyError('Failed to place order')
app.notifyWarning('Market volatility high')
app.notifyInfo('System update in 10 minutes')

// Custom notification
app.addNotification('info', 'Custom message', 5000) // 5 second auto-dismiss
```

## 🏗️ Store Architecture

### State Management Pattern

Each store follows a consistent pattern:

1. **State** - Raw data storage
2. **Computed** - Derived values and calculations
3. **Actions** - Async operations and mutations

### Error Handling

All stores include built-in error handling:

```typescript
// Each store has error state
if (store.hasError) {
  console.error(store.errorPortfolio?.message)
  store.clearError()
}

// Async operations are wrapped
try {
  await store.fetchData()
  // Success
} catch (error) {
  // Error already captured in store
  console.error(store.errorPortfolio)
}
```

### Real-Time Updates

Stores handle real-time updates through:

1. **WebSocket Subscriptions** - Direct handlers for each event type
2. **Optimistic Updates** - UI updates immediately, server confirms
3. **History Tracking** - 30-day data retention for analytics
4. **Connection Recovery** - Automatic reconnection and data sync

## 📈 Performance Considerations

1. **Computed Properties** - Cached calculations, only recomputed when dependencies change
2. **Pagination** - Trades store uses pagination to limit DOM elements
3. **History Limits** - Portfolio keeps 30 days, Market keeps 1000 price points
4. **Debounced Updates** - WebSocket handlers batch multiple updates
5. **Type Safety** - Full TypeScript integration prevents runtime errors

## 🔐 Security

- API errors don't expose sensitive data
- WebSocket events are validated before processing
- LocalStorage only stores non-sensitive preferences
- No credentials stored in stores (managed by auth service)

## 📝 Notes

- All stores are Pinia singleton instances
- Stores are automatically available throughout the app via composition
- WebSocket subscriptions return unsubscribe functions for cleanup
- Preferences are persisted to localStorage automatically
- Error states are preserved until explicitly cleared

## 🚀 Next Steps

1. Integrate stores into Vue components using `useStore()` composition function
2. Add store watchers for reactive side effects
3. Implement error boundary components for error handling
4. Create custom composables that combine multiple stores
5. Add analytics tracking for user interactions
