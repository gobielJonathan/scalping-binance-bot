# Trade Management UI Components

This document describes the 6 comprehensive trade management UI components created for the Vue 3 trading dashboard.

## Components Overview

### 1. TradeHistoryTable.vue
**Location**: `src/components/trade/TradeHistoryTable.vue`
**Purpose**: Advanced trade history with filtering, sorting, pagination, and export

**Features**:
- Columns: timestamp, symbol, side, quantity, entry/exit prices, P&L, duration
- Sorting, filtering (date range, symbol, profit/loss, trade type), pagination
- Search by symbol/trade ID
- Export (CSV/JSON)
- Color-coded P&L with win/loss indicators
- Mobile responsive with collapsible details

**Usage**:
```vue
<script setup>
import { TradeHistoryTable } from '@/components/trade'
</script>

<template>
  <TradeHistoryTable />
</template>
```

### 2. PositionDetailsModal.vue
**Location**: `src/components/trade/PositionDetailsModal.vue`
**Purpose**: Position details modal with real-time updates and quick actions

**Features**:
- Real-time P&L updates
- Position metrics: entry price, current price, quantity, margin, fees
- Risk metrics: stop loss, take profit, max adverse excursion
- Position history timeline
- Quick actions: close position, modify stop/take profit
- Mini chart showing entry point and price movement

**Usage**:
```vue
<script setup>
import { PositionDetailsModal } from '@/components/trade'
const showModal = ref(false)
const selectedPositionId = ref(null)
</script>

<template>
  <PositionDetailsModal 
    :isOpen="showModal"
    :positionId="selectedPositionId"
    @close="showModal = false"
    @position-action="handlePositionAction"
  />
</template>
```

### 3. TradeNotifications.vue
**Location**: `src/components/notifications/TradeNotifications.vue`
**Purpose**: Comprehensive notification system for trading events

**Features**:
- Toast notifications for trade executions
- Alert system for significant P&L changes
- Position opened/closed notifications
- Risk alerts (approaching stop loss/take profit)
- System alerts (emergency stops, connection issues)
- Notification history panel
- Sound notifications (optional)

**Usage**:
```vue
<script setup>
import { TradeNotifications } from '@/components/notifications'
</script>

<template>
  <TradeNotifications 
    :soundEnabled="true"
    :maxToasts="5"
    @toggle-history="handleToggleHistory"
    @toggle-sound="handleToggleSound"
  />
</template>
```

### 4. LiveOrdersPanel.vue
**Location**: `src/components/trade/LiveOrdersPanel.vue`
**Purpose**: Real-time display and management of trading orders

**Features**:
- Real-time display of pending orders
- Order status tracking (pending, filled, cancelled)
- Quick order modification/cancellation
- Order history with execution details
- Fill notifications with slippage analysis
- Order placement confirmation dialogs

**Usage**:
```vue
<script setup>
import { LiveOrdersPanel } from '@/components/trade'
</script>

<template>
  <LiveOrdersPanel 
    :compact="false"
    :showHistory="true"
    :maxItems="50"
    @order-cancel="handleOrderCancel"
    @order-modify="handleOrderModify"
    @order-place="handleOrderPlace"
  />
</template>
```

### 5. TradeAnalytics.vue
**Location**: `src/components/analytics/TradeAnalytics.vue`
**Purpose**: Advanced trade statistics and performance analysis dashboard

**Features**:
- Advanced trade statistics dashboard
- Performance metrics: Sharpe ratio, Sortino ratio, max drawdown
- Win/loss streaks analysis
- Time-based performance (hourly, daily, weekly patterns)
- Symbol-specific performance breakdown
- Risk-adjusted returns
- Performance comparison charts

**Usage**:
```vue
<script setup>
import { TradeAnalytics } from '@/components/analytics'
</script>

<template>
  <TradeAnalytics />
</template>
```

### 6. RiskManagement.vue
**Location**: `src/components/risk/RiskManagement.vue`
**Purpose**: Comprehensive risk management interface and tools

**Features**:
- Real-time risk exposure monitoring
- Position size calculator
- Account balance protection settings
- Risk limits and alerts configuration
- Daily loss limits monitoring
- Correlation analysis between positions
- Portfolio heat map

**Usage**:
```vue
<script setup>
import { RiskManagement } from '@/components/risk'
</script>

<template>
  <RiskManagement />
</template>
```

## Key Features

### Integration with Existing Architecture
- **Pinia Stores**: All components integrate with existing stores (`trades`, `positions`, `portfolio`)
- **Socket.IO**: Support for real-time updates via WebSocket connections
- **TypeScript**: Full TypeScript support with proper type definitions
- **Responsive Design**: Bootstrap 5 responsive design patterns
- **Theme Integration**: Uses existing CSS variables and color schemes

### Common Patterns
- **WidgetContainer**: All main components use the existing `WidgetContainer` wrapper
- **Error Handling**: Consistent error handling and loading states
- **Utility Functions**: Reuse existing utility functions (`formatCurrency`, `formatPercent`, etc.)
- **Mobile Support**: Touch-friendly interfaces and responsive breakpoints

### Data Export
- **CSV Export**: Available in TradeHistoryTable and TradeAnalytics
- **JSON Export**: Available in TradeHistoryTable and TradeAnalytics
- **Configuration Export**: RiskManagement allows exporting risk settings

### Real-time Features
- **Live Updates**: All components support real-time data updates
- **WebSocket Integration**: Connected to the existing Socket.IO infrastructure
- **Auto-refresh**: Configurable refresh intervals for data updates

## Installation & Setup

1. All components are already created in the appropriate directories
2. Index files are created for easy importing
3. Components follow existing patterns and integrate with current stores
4. TypeScript types are compatible with existing `src/types/api.ts`

## Mobile Responsiveness

All components include comprehensive responsive design:
- **Tablet (768px)**: Adjusted layouts and grid systems
- **Mobile (576px)**: Collapsed navigation, stacked layouts
- **Touch Support**: Touch-friendly buttons and swipe gestures where appropriate

## Color Coding

Consistent color coding throughout all components:
- **Profit**: `var(--trading-profit)` - Green
- **Loss**: `var(--trading-loss)` - Red  
- **Neutral**: `var(--trading-neutral)` - Blue
- **Warning**: `var(--trading-warning)` - Orange

## Performance Considerations

- **Virtual Scrolling**: Large data sets are paginated
- **Lazy Loading**: Components load data on demand
- **Efficient Updates**: Real-time updates use efficient diff algorithms
- **Memory Management**: Proper cleanup of intervals and event listeners