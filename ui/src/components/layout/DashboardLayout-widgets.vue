<script setup lang="ts">
import { ref, onMounted } from 'vue'
import DashboardGrid from './DashboardGrid.vue'
import WidgetContainer from './WidgetContainer.vue'
import { TradingChart, PnLChart } from '@/components/charts'
import {
  PortfolioWidget,
  PositionsWidget,
  MarketDataWidget,
  RecentTradesWidget,
  SystemStatusWidget,
  PerformanceWidget,
} from '@/components/widgets'
import apiService from '@/services/api'
import type { OHLCV, Portfolio } from '@/types/api'

// State management for dashboard
const isCollapsed = ref(false)
const chartData = ref<OHLCV[]>([])
const portfolioHistory = ref<Portfolio[]>([])
const loading = ref(false)

/**
 * Load historical chart data
 */
const loadChartData = async () => {
  try {
    loading.value = true

    // Fetch BTC/USD hourly data (last 500 candles)
    const response = await apiService.getHistoricalData('BTC/USD', '1h', 500)
    if (response.success && Array.isArray(response.data)) {
      chartData.value = response.data
    } else {
      chartData.value = generateSampleChartData()
    }

    // Generate sample portfolio history for P&L chart
    portfolioHistory.value = generateSamplePortfolioHistory()
  } catch (error) {
    console.error('Failed to load chart data:', error)
    // Fall back to sample data
    chartData.value = generateSampleChartData()
    portfolioHistory.value = generateSamplePortfolioHistory()
  } finally {
    loading.value = false
  }
}

/**
 * Generate sample chart data for demo purposes
 */
const generateSampleChartData = (): OHLCV[] => {
  const data: OHLCV[] = []
  let price = 43000
  const now = Math.floor(Date.now() / 1000)

  for (let i = 500; i > 0; i--) {
    const change = (Math.random() - 0.5) * 100
    const open = price
    const close = price + change
    const high = Math.max(open, close) + Math.abs(change) * 0.2
    const low = Math.min(open, close) - Math.abs(change) * 0.2
    const volume = Math.random() * 1000 + 100

    data.push({
      time: now - i * 3600,
      open,
      high,
      low,
      close,
      volume,
    })

    price = close
  }

  return data
}

/**
 * Generate sample portfolio history for demo purposes
 */
const generateSamplePortfolioHistory = (): Portfolio[] => {
  const data: Portfolio[] = []
  let balance = 25000
  let equity = 25000
  const now = new Date()

  for (let i = 0; i < 100; i++) {
    const randomChange = (Math.random() - 0.48) * 500
    balance += randomChange
    equity = balance * (1 + (Math.random() - 0.5) * 0.02)

    const timestamp = new Date(now.getTime() - (100 - i) * 3600000)

    data.push({
      id: `portfolio-${i}`,
      accountId: 'account-1',
      totalBalance: Math.max(balance, 20000),
      availableBalance: Math.max(balance, 20000) * 0.9,
      equity: equity,
      investedBalance: Math.max(balance, 20000) * 0.7,
      pnl: balance - 25000,
      pnlPercent: ((balance - 25000) / 25000) * 100,
      updatedAt: timestamp.toISOString(),
    })
  }

  return data
}

// Load chart data on mount
onMounted(() => {
  loadChartData()
})
</script>

<template>
  <div class="dashboard-container">
    <!-- Header Section -->
    <div style="margin-bottom: var(--trading-spacing-xl); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--trading-spacing-lg)">
      <div>
        <h1 style="margin: 0; font-size: 2rem; color: var(--trading-text-primary)">
          Trading Dashboard
        </h1>
        <p style="margin: var(--trading-spacing-sm) 0 0 0; color: var(--trading-text-secondary)">
          Real-time portfolio and market overview
        </p>
      </div>
      <div style="display: flex; gap: var(--trading-spacing-md)">
        <button 
          class="action-button"
          title="Collapse sidebar"
          @click="isCollapsed = !isCollapsed"
        >
          ≡
        </button>
        <button 
          class="action-button action-button-primary"
          title="New trade"
        >
          + Trade
        </button>
      </div>
    </div>

    <!-- Main Dashboard Grid -->
    <dashboard-grid gap="lg">
      <!-- Row 1: Portfolio Summary (Full Width) -->
      <div style="grid-column: span 12">
        <portfolio-widget />
      </div>

      <!-- Row 2: Charts Section (Takes 2/3 on desktop) -->
      <div style="grid-column: span 8">
        <widget-container 
          title="Price Chart"
          variant="default"
          height="400px"
        >
          <trading-chart 
            symbol="BTC/USD"
            :data="chartData"
            :type="'candlestick' as any"
            interval="1h"
            height="100%"
            theme="dark"
            show-volume
            show-ma
            @error="(error: Error) => console.error('Chart error:', error)"
          />
        </widget-container>
      </div>

      <!-- Row 2: P&L Chart (Takes 1/3 on desktop) -->
      <div style="grid-column: span 4">
        <widget-container 
          title="P&L Timeline"
          variant="default"
          height="400px"
        >
          <pnl-chart 
            :data="portfolioHistory"
            height="100%"
            theme="dark"
            interval="1D"
            show-watermark
            @error="(error: Error) => console.error('P&L Chart error:', error)"
          />
        </widget-container>
      </div>

      <!-- Row 3: Open Positions Widget (Full Width) -->
      <div style="grid-column: span 12">
        <positions-widget />
      </div>

      <!-- Row 4: Market Data & Recent Trades -->
      <div style="grid-column: span 6">
        <market-data-widget />
      </div>

      <div style="grid-column: span 6">
        <recent-trades-widget />
      </div>

      <!-- Row 5: Performance & System Status -->
      <div style="grid-column: span 6">
        <performance-widget />
      </div>

      <div style="grid-column: span 6">
        <system-status-widget />
      </div>
    </dashboard-grid>
  </div>
</template>

<style scoped>
.dashboard-container {
  padding: var(--trading-spacing-lg);
  background: var(--trading-bg-primary);
  min-height: 100vh;
}

.action-button {
  padding: var(--trading-spacing-sm) var(--trading-spacing-lg);
  background: var(--trading-bg-tertiary);
  border: 1px solid var(--trading-border);
  color: var(--trading-text-primary);
  border-radius: var(--trading-radius-md);
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.3s ease;
  font-weight: 600;
}

.action-button:hover {
  background: var(--trading-bg-hover);
  border-color: var(--trading-border-light);
}

.action-button-primary {
  background: linear-gradient(135deg, var(--trading-accent-blue), #2980b9);
  border-color: var(--trading-accent-blue);
  color: white;
}

.action-button-primary:hover {
  background: linear-gradient(135deg, #2980b9, #2471a3);
  border-color: #2471a3;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .dashboard-container {
    padding: var(--trading-spacing-md);
  }
}

@media (max-width: 576px) {
  .action-button {
    padding: var(--trading-spacing-xs) var(--trading-spacing-md);
    font-size: 0.875rem;
  }
}
</style>
