# Trade Management Components - Integration Examples

This document provides practical examples of how to integrate the trade management components into your dashboard.

## Quick Start

### 1. Basic Dashboard Integration

```vue
<script setup lang="ts">
import { ref } from 'vue'
import TradeHistoryTable from '@/components/trade/TradeHistoryTable.vue'
import PositionDetailsModal from '@/components/trade/PositionDetailsModal.vue'
import TradeNotifications from '@/components/notifications/TradeNotifications.vue'
import LiveOrdersPanel from '@/components/trade/LiveOrdersPanel.vue'
import TradeAnalytics from '@/components/analytics/TradeAnalytics.vue'
import RiskManagement from '@/components/risk/RiskManagement.vue'

// State
const selectedPosition = ref(null)
const isPositionModalOpen = ref(false)
const soundEnabled = ref(true)
const showNotificationHistory = ref(false)

// Event handlers
const handlePositionClick = (position) => {
  selectedPosition.value = position
  isPositionModalOpen.value = true
}

const handleClosePosition = async (positionId) => {
  // Make API call to close position
  console.log('Closing position:', positionId)
}
</script>

<template>
  <div class="trading-dashboard">
    <!-- Notifications -->
    <TradeNotifications 
      :sound-enabled="soundEnabled"
      :show-history="showNotificationHistory"
      @toggle-sound="soundEnabled = !soundEnabled"
      @toggle-history="showNotificationHistory = !showNotificationHistory"
    />

    <!-- Main grid -->
    <div class="dashboard-grid">
      <!-- Row 1: Orders and Analytics -->
      <div class="grid-item">
        <LiveOrdersPanel />
      </div>
      <div class="grid-item">
        <TradeAnalytics period="30d" />
      </div>

      <!-- Row 2: Trade History and Risk -->
      <div class="grid-item wide">
        <TradeHistoryTable />
      </div>

      <!-- Row 3: Risk Management -->
      <div class="grid-item full">
        <RiskManagement />
      </div>
    </div>

    <!-- Position Details Modal -->
    <PositionDetailsModal 
      v-if="isPositionModalOpen && selectedPosition"
      :position="selectedPosition"
      @close="isPositionModalOpen = false"
      @close-position="handleClosePosition"
    />
  </div>
</template>

<style scoped>
.trading-dashboard {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding: 1.5rem;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 1.5rem;
}

.grid-item.wide {
  grid-column: span 2;
}

.grid-item.full {
  grid-column: span 3;
}

@media (max-width: 1200px) {
  .grid-item.wide {
    grid-column: span 1;
  }

  .grid-item.full {
    grid-column: span 2;
  }
}

@media (max-width: 768px) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }

  .grid-item.wide,
  .grid-item.full {
    grid-column: span 1;
  }
}
</style>
```

---

## 2. Advanced Layout with Tabs

```vue
<script setup lang="ts">
import { ref } from 'vue'
import TradeHistoryTable from '@/components/trade/TradeHistoryTable.vue'
import TradeAnalytics from '@/components/analytics/TradeAnalytics.vue'
import RiskManagement from '@/components/risk/RiskManagement.vue'
import LiveOrdersPanel from '@/components/trade/LiveOrdersPanel.vue'
import TradeNotifications from '@/components/notifications/TradeNotifications.vue'

const activeTab = ref<'overview' | 'analytics' | 'risk' | 'history'>('overview')
</script>

<template>
  <div class="trading-interface">
    <!-- Top Navigation -->
    <div class="tab-navigation">
      <button 
        v-for="tab in ['overview', 'analytics', 'risk', 'history']"
        :key="tab"
        :class="['tab-button', { active: activeTab === tab }]"
        @click="activeTab = tab"
      >
        {{ tab.charAt(0).toUpperCase() + tab.slice(1) }}
      </button>
    </div>

    <!-- Notifications -->
    <TradeNotifications :max-toasts="5" />

    <!-- Tab Content -->
    <div class="tab-content">
      <!-- Overview Tab: Live Orders + Orders Panel -->
      <div v-if="activeTab === 'overview'" class="tab-pane active">
        <div class="two-column-grid">
          <LiveOrdersPanel />
          <div class="summary-section">
            <h3>Quick Summary</h3>
            <!-- Add summary widget -->
          </div>
        </div>
      </div>

      <!-- Analytics Tab -->
      <div v-if="activeTab === 'analytics'" class="tab-pane active">
        <TradeAnalytics period="30d" />
      </div>

      <!-- Risk Tab -->
      <div v-if="activeTab === 'risk'" class="tab-pane active">
        <RiskManagement :active-tab="'overview'" />
      </div>

      <!-- History Tab -->
      <div v-if="activeTab === 'history'" class="tab-pane active">
        <TradeHistoryTable />
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-navigation {
  display: flex;
  gap: 1rem;
  border-bottom: 2px solid var(--trading-border);
  margin-bottom: 1.5rem;
}

.tab-button {
  padding: 0.75rem 1.5rem;
  background: none;
  border: none;
  color: var(--trading-text-secondary);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
}

.tab-button:hover {
  color: var(--trading-text-primary);
}

.tab-button.active {
  color: var(--trading-accent-blue);
}

.tab-button.active::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--trading-accent-blue);
}

.tab-content {
  animation: fadeIn 0.3s ease;
}

.tab-pane {
  display: none;
}

.tab-pane.active {
  display: block;
}

.two-column-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}

@media (max-width: 1024px) {
  .two-column-grid {
    grid-template-columns: 1fr;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
```

---

## 3. Sidebar Layout

```vue
<script setup lang="ts">
import { ref } from 'vue'
import TradeHistoryTable from '@/components/trade/TradeHistoryTable.vue'
import RiskManagement from '@/components/risk/RiskManagement.vue'
import TradeNotifications from '@/components/notifications/TradeNotifications.vue'

const collapsed = ref(false)
</script>

<template>
  <div class="main-layout">
    <TradeNotifications />

    <div class="layout-container">
      <!-- Sidebar -->
      <aside :class="['sidebar', { collapsed }]">
        <button class="toggle-button" @click="collapsed = !collapsed">
          {{ collapsed ? '→' : '←' }}
        </button>
        <nav class="sidebar-nav">
          <a href="#" class="nav-item active">
            <span class="icon">📊</span>
            <span v-if="!collapsed" class="label">Dashboard</span>
          </a>
          <a href="#" class="nav-item">
            <span class="icon">💰</span>
            <span v-if="!collapsed" class="label">Positions</span>
          </a>
          <a href="#" class="nav-item">
            <span class="icon">📈</span>
            <span v-if="!collapsed" class="label">Analytics</span>
          </a>
          <a href="#" class="nav-item">
            <span class="icon">⚠️</span>
            <span v-if="!collapsed" class="label">Risk</span>
          </a>
          <a href="#" class="nav-item">
            <span class="icon">🕐</span>
            <span v-if="!collapsed" class="label">History</span>
          </a>
        </nav>
      </aside>

      <!-- Main Content -->
      <main class="main-content">
        <div class="content-wrapper">
          <TradeHistoryTable />
        </div>
      </main>

      <!-- Right Sidebar: Risk Management -->
      <aside class="right-sidebar">
        <RiskManagement />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.main-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.layout-container {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sidebar {
  width: 250px;
  background: var(--trading-bg-secondary);
  border-right: 1px solid var(--trading-border);
  padding: 1rem;
  overflow-y: auto;
  transition: width 0.3s ease;
}

.sidebar.collapsed {
  width: 80px;
}

.toggle-button {
  width: 100%;
  padding: 0.5rem;
  background: var(--trading-bg-tertiary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  color: var(--trading-text-primary);
  cursor: pointer;
  margin-bottom: 1rem;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  color: var(--trading-text-secondary);
  text-decoration: none;
  border-radius: var(--trading-radius-md);
  transition: all 0.3s ease;
}

.nav-item:hover,
.nav-item.active {
  background: var(--trading-bg-tertiary);
  color: var(--trading-accent-blue);
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.right-sidebar {
  width: 300px;
  background: var(--trading-bg-secondary);
  border-left: 1px solid var(--trading-border);
  overflow-y: auto;
}

@media (max-width: 1200px) {
  .right-sidebar {
    display: none;
  }

  .layout-container {
    flex-direction: column;
  }
}

@media (max-width: 768px) {
  .sidebar {
    width: 60px;
  }

  .nav-item .label {
    display: none;
  }
}
</style>
```

---

## 4. Real-time Socket.IO Integration

```typescript
// services/trading-events.ts
import { useTradesStore } from '@/stores'
import { usePositionsStore } from '@/stores'
import { usePortfolioStore } from '@/stores'
import { socket } from '@/services/websocket'

export function setupTradingEventListeners() {
  const tradesStore = useTradesStore()
  const positionsStore = usePositionsStore()
  const portfolioStore = usePortfolioStore()

  // Trade executed
  socket.on('trade-executed', (trade) => {
    tradesStore.addTrade(trade)
    // TradeNotifications component will auto-update
  })

  // Position updated
  socket.on('position-updated', (position) => {
    positionsStore.updatePosition(position)
  })

  // Position opened
  socket.on('position-opened', (position) => {
    positionsStore.addPosition(position)
  })

  // Position closed
  socket.on('position-closed', (positionId) => {
    positionsStore.removePosition(positionId)
  })

  // Order filled
  socket.on('order-filled', (order) => {
    // LiveOrdersPanel will auto-update
  })

  // Portfolio updated
  socket.on('portfolio-updated', (portfolio) => {
    portfolioStore.setPortfolio(portfolio)
  })

  // System alerts
  socket.on('system-alert', (alert) => {
    // TradeNotifications will show system alert
  })
}
```

---

## 5. Programmatic Component Usage

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useTradesStore } from '@/stores'
import TradeHistoryTable from '@/components/trade/TradeHistoryTable.vue'

const tradesStore = useTradesStore()

// Export trades programmatically
const exportTrades = async () => {
  const trades = tradesStore.trades
  
  // Convert to CSV
  const headers = ['ID', 'Symbol', 'Side', 'Quantity', 'Price', 'P&L', 'Timestamp']
  const rows = trades.map(t => [
    t.id,
    t.symbol,
    t.side,
    t.quantity,
    t.price,
    t.pnl,
    t.executedAt
  ])
  
  const csv = [headers, ...rows]
    .map(row => row.join(','))
    .join('\n')
  
  // Download
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `trades-${new Date().toISOString()}.csv`
  a.click()
}

// Calculate statistics
const statistics = ref({
  totalTrades: 0,
  winRate: 0,
  profitFactor: 0,
  sharpeRatio: 0
})

const updateStatistics = () => {
  statistics.value.totalTrades = tradesStore.totalCount
  statistics.value.winRate = tradesStore.winRate
  // ... calculate other metrics
}
</script>

<template>
  <div>
    <div class="controls">
      <button @click="exportTrades">Export to CSV</button>
      <button @click="updateStatistics">Refresh Stats</button>
    </div>

    <div class="stats">
      <div>Total Trades: {{ statistics.totalTrades }}</div>
      <div>Win Rate: {{ statistics.winRate.toFixed(1) }}%</div>
      <div>Profit Factor: {{ statistics.profitFactor.toFixed(2) }}</div>
      <div>Sharpe Ratio: {{ statistics.sharpeRatio.toFixed(2) }}</div>
    </div>

    <TradeHistoryTable />
  </div>
</template>
```

---

## 6. Custom Theme Integration

```vue
<script setup lang="ts">
import { ref } from 'vue'
import TradeHistoryTable from '@/components/trade/TradeHistoryTable.vue'

const theme = ref('dark') // 'dark' | 'light'
</script>

<template>
  <div :class="['theme-wrapper', theme]">
    <!-- Theme Toggle -->
    <div class="theme-toggle">
      <button 
        :class="{ active: theme === 'dark' }"
        @click="theme = 'dark'"
      >
        🌙 Dark
      </button>
      <button 
        :class="{ active: theme === 'light' }"
        @click="theme = 'light'"
      >
        ☀️ Light
      </button>
    </div>

    <!-- Component -->
    <TradeHistoryTable />
  </div>
</template>

<style scoped>
.theme-wrapper.dark {
  --trading-profit: #27ae60;
  --trading-loss: #e74c3c;
  --trading-bg-primary: #0f0f0f;
  --trading-text-primary: #ffffff;
}

.theme-wrapper.light {
  --trading-profit: #229954;
  --trading-loss: #c0392b;
  --trading-bg-primary: #f8f9fa;
  --trading-text-primary: #1a1a1a;
}

.theme-toggle {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.theme-toggle button {
  padding: 0.5rem 1rem;
  border: 1px solid var(--trading-border);
  background: var(--trading-bg-secondary);
  color: var(--trading-text-primary);
  border-radius: var(--trading-radius-md);
  cursor: pointer;
}

.theme-toggle button.active {
  background: var(--trading-accent-blue);
  border-color: var(--trading-accent-blue);
}
</style>
```

---

## Integration Checklist

- [ ] Import components into your dashboard
- [ ] Set up Socket.IO event listeners
- [ ] Configure real-time subscriptions
- [ ] Customize thresholds (P&L alerts, risk limits)
- [ ] Test with sample data
- [ ] Verify responsive design on mobile
- [ ] Configure export settings
- [ ] Set up notification sounds
- [ ] Test error states
- [ ] Optimize performance with pagination
- [ ] Deploy to production

---

## Best Practices

1. **Lazy Loading**: Load components only when needed
2. **Store Subscriptions**: Use computed properties from stores
3. **Error Handling**: Wrap Socket.IO listeners in try-catch
4. **Performance**: Use pagination for large datasets
5. **Accessibility**: Test with keyboard navigation
6. **Mobile**: Test on actual devices, not just browser dev tools
7. **Monitoring**: Track component performance with analytics
8. **Updates**: Keep Socket.IO events synchronized with backend

---

For more detailed information, refer to `TRADE_MANAGEMENT_GUIDE.md`
