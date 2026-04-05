# Trade Management UI Components Guide

## Overview

This guide documents the comprehensive trade management UI components built for the Vue 3 trading dashboard. These components provide professional-grade trading interfaces with real-time updates, advanced analytics, and risk management capabilities.

## Components

### 1. **TradeHistoryTable** (`src/components/trade/TradeHistoryTable.vue`)

Advanced trade history interface with powerful filtering, sorting, and export capabilities.

#### Features
- **Data Table**: Displays trades with sortable columns
  - Timestamp
  - Symbol
  - Side (Buy/Sell)
  - Quantity
  - Entry/Exit Prices
  - P&L (absolute and percentage)
  - Trade Duration
  
- **Filtering**:
  - Date range (from/to)
  - Symbol search
  - Trade type (Buy/Sell)
  - Profit/Loss filtering
  - P&L range filtering
  
- **Search**: Symbol or Trade ID search with real-time filtering

- **Export**: CSV and JSON export formats

- **Pagination**: Configurable items per page with navigation

- **Styling**:
  - Color-coded P&L (green for profit, red for loss)
  - Win/loss indicators
  - Mobile-responsive collapsible details
  
#### Usage
```vue
<script setup>
import TradeHistoryTable from '@/components/trade/TradeHistoryTable.vue'
</script>

<template>
  <TradeHistoryTable />
</template>
```

#### Props
- None (uses stores directly)

#### Computed Properties
- `filteredTrades`: Trades matching current filters and search
- `sortedTrades`: Sorted based on selected column
- `paginatedTrades`: Current page of results
- `totalPages`: Number of pages available

---

### 2. **PositionDetailsModal** (`src/components/trade/PositionDetailsModal.vue`)

Detailed position view modal with real-time P&L updates and risk metrics.

#### Features
- **Position Metrics**:
  - Entry price
  - Current price
  - Quantity
  - Margin/Collateral
  - Fees (commission, slippage)
  
- **Real-time Updates**:
  - Live P&L calculation
  - Price movement tracking
  - Unrealized P&L percentage
  
- **Risk Metrics**:
  - Stop loss levels
  - Take profit targets
  - Max adverse excursion (MAE)
  - Max favorable excursion (MFE)
  - Risk-reward ratio
  
- **Position History**:
  - Timeline of price updates
  - Entry point visualization
  - Price movement chart
  
- **Quick Actions**:
  - Close position
  - Modify stop loss
  - Modify take profit
  - Set alerts
  
#### Usage
```vue
<script setup>
import PositionDetailsModal from '@/components/trade/PositionDetailsModal.vue'
import { ref } from 'vue'

const isOpen = ref(false)
const selectedPosition = ref(null)

const handleOpenDetails = (position) => {
  selectedPosition.value = position
  isOpen.value = true
}
</script>

<template>
  <PositionDetailsModal 
    v-if="isOpen"
    :position="selectedPosition"
    @close="isOpen = false"
    @close-position="handleClosePosition"
    @update-stop-loss="handleUpdateStopLoss"
    @update-take-profit="handleUpdateTakeProfit"
  />
</template>
```

#### Props
- `position: Position` - The position to display
- `showChart?: boolean` - Show mini price chart

#### Emits
- `close`: Modal closed
- `close-position`: User requested position close
- `update-stop-loss`: Stop loss value changed
- `update-take-profit`: Take profit value changed
- `set-alert`: Risk alert configured

---

### 3. **TradeNotifications** (`src/components/notifications/TradeNotifications.vue`)

Comprehensive notification system for trade events and alerts.

#### Features
- **Toast Notifications**:
  - New trade execution alerts
  - Position opened/closed notifications
  - Order fill notifications
  - P&L updates
  
- **Alert Levels**:
  - Info (blue)
  - Success (green)
  - Warning (yellow)
  - Error (red)
  
- **Notification Types**:
  - Trade executions
  - Position events
  - P&L milestones
  - Risk warnings
  - System alerts (connection issues, emergency stops)
  
- **Features**:
  - Auto-dismiss after configured duration
  - Manual dismiss capability
  - Sound notifications (optional)
  - Notification history panel
  - Unread counter
  
- **Customizable**:
  - P&L change threshold for alerts
  - Risk alert thresholds
  - Max toasts displayed
  
#### Usage
```vue
<script setup>
import TradeNotifications from '@/components/notifications/TradeNotifications.vue'
import { ref } from 'vue'

const soundEnabled = ref(true)
const showHistory = ref(false)
</script>

<template>
  <TradeNotifications 
    :sound-enabled="soundEnabled"
    :show-history="showHistory"
    :max-toasts="5"
    @toggle-sound="soundEnabled = !soundEnabled"
    @toggle-history="showHistory = !showHistory"
  />
</template>
```

#### Props
- `showHistory?: boolean` - Show history panel (default: false)
- `soundEnabled?: boolean` - Enable sound notifications (default: true)
- `maxToasts?: number` - Maximum toasts displayed (default: 5)

#### Emits
- `toggle-history`: History panel toggle requested
- `toggle-sound`: Sound notifications toggle requested

#### Configuration
- P&L Change Threshold: Configurable alert threshold for P&L changes
- Risk Alert Threshold: Percentage loss that triggers risk alerts

---

### 4. **LiveOrdersPanel** (`src/components/trade/LiveOrdersPanel.vue`)

Real-time order management interface with live order tracking.

#### Features
- **Pending Orders**:
  - Order ID, symbol, side
  - Order type and status
  - Quantity, price, filled quantity
  - Time in market
  
- **Status Tracking**:
  - Pending
  - Partially Filled
  - Filled
  - Cancelled
  - Rejected
  
- **Quick Actions**:
  - Modify price/quantity
  - Cancel order
  - View details
  - Add alerts
  
- **Order History**:
  - Recently filled orders
  - Execution details
  - Slippage analysis
  - Fill time and price
  
- **Fill Notifications**:
  - Real-time fill alerts
  - Slippage calculation
  - Average fill price
  
- **Confirmation Dialogs**:
  - Order modification confirmation
  - Cancellation confirmation
  - Risk warnings for large orders
  
#### Usage
```vue
<script setup>
import LiveOrdersPanel from '@/components/trade/LiveOrdersPanel.vue'
</script>

<template>
  <LiveOrdersPanel 
    @order-cancelled="handleOrderCancelled"
    @order-modified="handleOrderModified"
    @order-filled="handleOrderFilled"
  />
</template>
```

#### Emits
- `order-cancelled`: Order was cancelled
- `order-modified`: Order was modified
- `order-filled`: Order was filled
- `order-rejected`: Order was rejected

#### Features
- Sortable order list
- Filterable by status and symbol
- Real-time updates via Socket.IO
- Slippage analysis for executed trades

---

### 5. **TradeAnalytics** (`src/components/analytics/TradeAnalytics.vue`)

Advanced trading statistics and performance analytics dashboard.

#### Features
- **Performance Metrics**:
  - Total return (absolute and percentage)
  - Sharpe Ratio (risk-adjusted returns)
  - Sortino Ratio (downside risk)
  - Max Drawdown
  - Volatility
  - Calmar Ratio
  
- **Trade Statistics**:
  - Win rate
  - Profit factor
  - Average win/loss
  - Win/loss streaks
  - Average trade duration
  
- **Time-Based Performance**:
  - Hourly performance breakdown
  - Daily performance chart
  - Weekly patterns
  - Monthly trends
  - Time of day analysis
  
- **Symbol Performance**:
  - P&L by symbol
  - Win rate per symbol
  - Trade count per symbol
  - Risk-adjusted returns
  - Symbol comparison
  
- **Charts**:
  - Performance comparison charts
  - Time-based performance curves
  - Symbol performance heatmap
  - Equity curve
  - Drawdown visualization
  
- **Period Selection**:
  - Last 7 days
  - Last 30 days
  - Last 90 days
  - Year-to-date
  - All time
  
#### Usage
```vue
<script setup>
import TradeAnalytics from '@/components/analytics/TradeAnalytics.vue'
import { ref } from 'vue'

const selectedPeriod = ref('30d')
</script>

<template>
  <TradeAnalytics :period="selectedPeriod" />
</template>
```

#### Props
- `period?: string` - Time period for analytics (default: '30d')

#### Computed Properties
- `performanceMetrics`: Calculated performance statistics
- `timeBasedPerformance`: Hourly/daily/weekly breakdown
- `symbolPerformance`: Per-symbol statistics
- `equityCurve`: Account equity over time
- `drawdownData`: Drawdown periods and recovery

---

### 6. **RiskManagement** (`src/components/risk/RiskManagement.vue`)

Comprehensive risk monitoring and management interface.

#### Features
- **Risk Monitoring**:
  - Real-time risk exposure
  - Portfolio risk score
  - Value at Risk (VaR)
  - Concentration risk
  - Correlation risk
  
- **Position Size Calculator**:
  - Account balance input
  - Risk percentage (1-2-3% rules)
  - Entry price and stop loss
  - Suggested position size
  - Risk/reward calculation
  
- **Risk Limits Configuration**:
  - Daily loss limit
  - Max position size
  - Total portfolio exposure
  - Drawdown limit
  - Correlation limit
  
  Each limit includes:
  - Threshold values
  - Current values
  - Status (OK/Warning/Breach)
  - Enable/disable toggle
  
- **Account Protection**:
  - Balance protection percentage
  - Equity stop-out level
  - Emergency stop settings
  - Daily max loss monitoring
  
- **Correlation Analysis**:
  - Position correlation matrix
  - Correlation heatmap
  - Diversification score
  - Optimal portfolio suggestions
  
- **Portfolio Heatmap**:
  - Position concentration visualization
  - Risk heat by symbol
  - Exposure distribution
  - Sector allocation
  
#### Tabs
1. **Overview**: Real-time risk metrics and summary
2. **Limits**: Risk limit configuration and monitoring
3. **Calculator**: Position size calculator
4. **Heatmap**: Portfolio correlation and concentration

#### Usage
```vue
<script setup>
import RiskManagement from '@/components/risk/RiskManagement.vue'
import { ref } from 'vue'

const selectedTab = ref('overview')
</script>

<template>
  <RiskManagement 
    :active-tab="selectedTab"
    @tab-change="selectedTab = $event"
    @limit-breach="handleLimitBreach"
    @limit-updated="handleLimitUpdated"
  />
</template>
```

#### Emits
- `tab-change`: Active tab changed
- `limit-breach`: Risk limit was breached
- `limit-updated`: Risk limit configuration changed
- `calculator-result`: Position size calculated

---

## Integration with Stores

All components integrate seamlessly with Pinia stores:

### Trades Store (`useTradesStore`)
```typescript
// Used by: TradeHistoryTable, TradeAnalytics, TradeNotifications
const tradesStore = useTradesStore()
- trades: Trade[]
- totalCount: number
- winCount: number
- lossCount: number
- totalPnl: number
- winRate: number
- paginatedTrades: Trade[]
- filteredTrades: Trade[]
```

### Positions Store (`usePositionsStore`)
```typescript
// Used by: PositionDetailsModal, RiskManagement, TradeAnalytics
const positionsStore = usePositionsStore()
- positions: Position[]
- totalPositions: number
- profitableCount: number
- losingCount: number
- totalUnrealizedPnl: number
- totalExposure: number
```

### Portfolio Store (`usePortfolioStore`)
```typescript
// Used by: RiskManagement, TradeAnalytics, TradeNotifications
const portfolioStore = usePortfolioStore()
- portfolio: Portfolio | null
- totalBalance: number
- availableBalance: number
- totalPnl: number
- pnlPercent: number
```

---

## Real-time Integration

All components support real-time updates via Socket.IO:

### Trade Notifications
```typescript
// Events from Socket.IO
socket.on('trade-executed', (trade: Trade) => {
  // Automatically handled by stores and components
})

socket.on('position-updated', (position: Position) => {
  // Position details update in real-time
})

socket.on('position-closed', (position: Position) => {
  // Notification generated automatically
})

socket.on('order-filled', (order: Order) => {
  // Live orders panel updates
})
```

---

## Styling & Theming

All components use consistent CSS variables:

```css
/* Colors */
--trading-profit: #27ae60      /* Green */
--trading-loss: #e74c3c        /* Red */
--trading-neutral: #95a5a6     /* Gray */
--trading-warning: #f39c12     /* Orange */
--trading-accent-blue: #3498db /* Blue */

/* Backgrounds */
--trading-bg-primary: #0f0f0f
--trading-bg-secondary: #1a1a1a
--trading-bg-tertiary: #2a2a2a

/* Text */
--trading-text-primary: #ffffff
--trading-text-secondary: #bdc3c7
--trading-text-tertiary: #95a5a6

/* Spacing and radius */
--trading-spacing-xs: 4px
--trading-spacing-sm: 8px
--trading-spacing-md: 12px
--trading-spacing-lg: 16px
--trading-spacing-xl: 24px

--trading-radius-sm: 4px
--trading-radius-md: 8px
--trading-radius-lg: 12px
```

---

## Mobile Optimization

All components are fully responsive:

- **Tablet (768px)**: Adjusted spacing and font sizes
- **Mobile (576px)**: Single-column layouts, collapsed tables, bottom sheets
- **Touch Events**: Swipe gestures for common actions
- **Responsive Tables**: Horizontal scroll with sticky headers

---

## Performance Considerations

### Virtual Scrolling
- TradeHistoryTable uses pagination (20-100 items per page)
- Efficient filtered/sorted computations with memoization

### Real-time Updates
- Debounced store updates to prevent excessive re-renders
- Efficient change detection with Vue 3 reactivity

### Chart Rendering
- Lazy-loaded mini charts in modals
- Chart updates throttled to 1 per second

---

## Error Handling

All components include:
- Error state displays
- Loading indicators
- Graceful fallbacks
- User-friendly error messages

---

## Accessibility

- Keyboard navigation support
- ARIA labels for icons
- High contrast for visibility
- Screen reader friendly

---

## Future Enhancements

- Advanced filtering UI
- Custom column configuration
- Data export scheduling
- Strategy comparison
- Multi-account support
- Custom alerts/webhooks

---

## API Endpoints Used

- `/api/analytics/trades` - Trade history with filters
- `/api/portfolio` - Portfolio state
- `/api/positions` - Open positions
- `/api/manual/*` - Manual control endpoints (if authorized)

## WebSocket Events Used

- `trade-executed` - New trade execution
- `position-updated` - Position P&L update
- `position-opened` - New position opened
- `position-closed` - Position closed
- `order-filled` - Order execution
- `order-cancelled` - Order cancellation
- `alert` - System alerts

---

## Support

For issues or questions about these components, refer to:
- Component inline documentation
- Store implementations
- Type definitions in `src/types/api.ts`
