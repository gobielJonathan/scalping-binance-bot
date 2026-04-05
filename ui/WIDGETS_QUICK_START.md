# Dashboard Widgets - Quick Start Guide

## Overview
Six production-ready Vue 3 dashboard widgets with real-time data integration from Pinia stores.

## Quick Integration

### 1. Basic Setup (DashboardLayout.vue)

```vue
<script setup lang="ts">
import { PortfolioWidget, PositionsWidget, MarketDataWidget, 
         RecentTradesWidget, SystemStatusWidget, PerformanceWidget } from '@/components/widgets'
import DashboardGrid from './DashboardGrid.vue'
</script>

<template>
  <dashboard-grid>
    <div style="grid-column: span 12">
      <portfolio-widget />
    </div>
    <div style="grid-column: span 12">
      <positions-widget />
    </div>
    <div style="grid-column: span 6">
      <market-data-widget />
    </div>
    <div style="grid-column: span 6">
      <recent-trades-widget />
    </div>
    <div style="grid-column: span 6">
      <performance-widget />
    </div>
    <div style="grid-column: span 6">
      <system-status-widget />
    </div>
  </dashboard-grid>
</template>
```

## Widget Descriptions

### Portfolio Widget
Displays account balances, P&L metrics, and account growth.
```vue
<portfolio-widget />
```
- Real-time balance updates
- Daily/Weekly/Monthly P&L
- Max drawdown, account growth
- Auto-updates from store

### Positions Widget
Shows open positions with P&L tracking and sortable columns.
```vue
<positions-widget />
```
- Sortable by: symbol, P&L, quantity, time
- Win rate and statistics
- Total exposure display
- Auto-updates on position changes

### Market Data Widget
Live price tickers with 24h data and spreads.
```vue
<market-data-widget />
```
- Configurable watched symbols
- Top gainers/losers
- Bid/Ask spreads
- Real-time WebSocket updates

### Recent Trades Widget
Recent trade history with statistics.
```vue
<recent-trades-widget />
```
- Trade P&L and percentages
- Win rate, profit factor
- Average win/loss
- Load more pagination

### System Status Widget
System health, connections, and alerts.
```vue
<system-status-widget />
```
- API/WebSocket status
- Latency monitoring
- Trading mode status
- Recent alerts display

### Performance Widget
Comprehensive performance metrics and rating.
```vue
<performance-widget />
```
- Win rate, profit factor, expectancy
- Risk metrics (max DD, R:R ratio)
- Trade statistics
- Performance rating

## Store Integration

### Required Stores

All widgets depend on these Pinia stores being properly initialized:

```typescript
import { 
  usePortfolioStore,
  usePositionsStore,
  useTradesStore,
  useMarketStore,
  useSystemStore,
  useAppStore
} from '@/stores'

// Each store has fetch actions:
// - portfolio: fetchPortfolio()
// - positions: fetchPositions()
// - trades: fetchTrades()
// - market: watchSymbol(symbol)
// - system: fetchSystemStatus()
```

## Common Use Cases

### Show Only Selected Widgets
```vue
<template>
  <dashboard-grid>
    <div style="grid-column: span 12">
      <portfolio-widget />
    </div>
    <div style="grid-column: span 12">
      <positions-widget />
    </div>
  </dashboard-grid>
</template>
```

### Custom Grid Layout
```vue
<template>
  <dashboard-grid gap="md">
    <!-- 2/3 width -->
    <div style="grid-column: span 8">
      <market-data-widget />
    </div>
    <!-- 1/3 width -->
    <div style="grid-column: span 4">
      <system-status-widget />
    </div>
  </dashboard-grid>
</template>
```

### Full Screen Widget
```vue
<template>
  <div style="padding: 2rem;">
    <positions-widget />
  </div>
</template>
```

## Data Binding Example

All widgets use computed properties for reactivity:

```typescript
// In a widget:
import { usePositionsStore } from '@/stores'

const positionsStore = usePositionsStore()

// Reactive data - automatically updates
const totalPositions = computed(() => positionsStore.totalPositions)
const profitableCount = computed(() => positionsStore.profitableCount)

// Auto-load on mount
onMounted(() => {
  positionsStore.fetchPositions()
})
```

## Styling Customization

### Override Widget Styles
```vue
<style scoped>
/* Custom styles for widgets */
:deep(.widget-card) {
  background: var(--custom-bg);
}

:deep(.metric-value) {
  font-size: 2rem;
}
</style>
```

### Available CSS Variables
```css
/* Colors */
--trading-profit: #2ecc71
--trading-loss: #e74c3c
--trading-warning: #f39c12
--trading-accent-blue: #3498db

/* Theme */
--trading-bg-primary: #0f1419
--trading-bg-secondary: #1a1f26
--trading-text-primary: #e8eef2
--trading-border: #424754

/* Spacing */
--trading-spacing-md: 1rem
--trading-spacing-lg: 1.5rem
--trading-radius-lg: 0.75rem
```

## Real-Time Updates

Widgets automatically update when store data changes:

```typescript
// Portfolio updates when balance changes
const currentBalance = computed(() => portfolioStore.currentBalance)

// Positions update when position is added/modified
const positions = computed(() => positionsStore.positions)

// Market data updates via WebSocket
const tickers = computed(() => marketStore.allTickers)
```

No manual refresh needed - Vue handles all updates reactively.

## Loading and Error States

Widgets handle loading and errors automatically:

```vue
<template>
  <widget-container
    title="Positions"
    :loading="positionsStore.loadingPositions"
    :error="!!positionsStore.errorPositions"
  >
    <!-- Widget content -->
  </widget-container>
</template>
```

- **Loading**: Shows spinner overlay
- **Error**: Shows error message
- **Empty**: Shows empty state message

## Responsive Behavior

Widgets are fully responsive:

| Screen | Layout | Changes |
|--------|--------|---------|
| Desktop (>1200px) | 12-column | Full size widgets |
| Tablet (768-1199px) | 2-column | Medium size |
| Mobile (<768px) | 1-column | Stacked, compact |

No additional configuration needed - responsive by default.

## Performance Tips

1. **Lazy load** widgets below the fold
2. **Limit data** - use pagination for trades
3. **Debounce updates** - don't refresh too frequently
4. **Unwatch symbols** you don't need
5. **Use computed properties** for derived data

## Troubleshooting

### Widget Shows Empty State
Check that store data is loaded:
```typescript
onMounted(async () => {
  await positionsStore.fetchPositions()
})
```

### Data Not Updating
Ensure store actions properly update reactive state:
```typescript
// In store:
const positions = ref<Position[]>([])

async function fetchPositions() {
  // Must update the ref
  positions.value = await api.getPositions()
}
```

### Styling Doesn't Apply
Use `::deep()` to reach child components:
```vue
<style scoped>
:deep(.metric-value) {
  color: red;
}
</style>
```

## Testing

Test widgets with mock data:

```typescript
import { setActivePinia, createPinia } from 'pinia'
import { usePositionsStore } from '@/stores'

describe('PositionsWidget', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('displays positions', () => {
    const store = usePositionsStore()
    store.positions = [/* mock data */]
    // Assert widget displays data
  })
})
```

## API Reference

### Portfolio Widget
```typescript
currentBalance        // Total balance
availableBalance      // Available to trade
equity               // Current equity
totalPnl             // Total P&L
dailyPnl             // Daily P&L
weeklyPnl            // Weekly P&L
monthlyPnl           // Monthly P&L
maxDrawdown          // Max drawdown %
accountGrowth        // Growth %
```

### Positions Widget
```typescript
positions            // Array of Position
totalPositions       // Count
profitableCount      // # Profitable
losingCount         // # Losing
winRate             // Win rate %
totalUnrealizedPnl  // Total P&L
totalExposure       // Total exposure
```

### Market Data Widget
```typescript
filteredTickers     // Watched tickers
topGainers          // Top 3 gainers
topLosers           // Top 3 losers
```

### Recent Trades Widget
```typescript
recentTrades        // Last trades
winCount            // # Wins
lossCount           // # Losses
winRate             // Win rate %
totalPnl            // Total P&L
profitFactor        // Profit factor
```

### System Status Widget
```typescript
apiConnected        // API status
websocketConnected  // WS status
avgLatency          // Avg latency ms
tradingEnabled      // Trading mode
systemAlerts        // Active alerts
```

### Performance Widget
```typescript
winRate             // Trade win rate %
profitFactor        // Wins/losses ratio
expectancy          // Avg expectancy
riskRewardRatio     // Avg win/loss ratio
maxDrawdown         // Max drawdown %
totalPnl            // Total P&L
```

## Next Steps

1. ✅ Widgets implemented and tested
2. ✅ Real-time store integration
3. ✅ Responsive design
4. ✅ Error handling
5. ⏭️ Custom configurations (future)
6. ⏭️ Widget positioning (future)
7. ⏭️ Theme customization (future)

---

**Status:** Production Ready ✅

All widgets are fully implemented and ready for use in the trading dashboard.
