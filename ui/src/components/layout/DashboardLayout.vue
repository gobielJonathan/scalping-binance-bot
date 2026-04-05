<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import WidgetContainer from './WidgetContainer.vue'
import DashboardGrid from './DashboardGrid.vue'
import { TradingChart, PnLChart, MarketChart } from '@/components/charts'
import chartService from '@/services/chart'
import apiService from '@/services/api'
import { useResponsive, useServiceWorker } from '@/composables'
import type { OHLCV, Portfolio } from '@/types/api'

// State management for dashboard
const isCollapsed = ref(false)
const expandedWidget = ref<string | null>(null)
const chartData = ref<OHLCV[]>([])
const portfolioHistory = ref<Portfolio[]>([])
const marketData = ref<OHLCV[]>([])
const loading = ref(false)

// Responsive utilities
const { isMobile, isTablet, isDesktop } = useResponsive()
const { isRegistered: swRegistered } = useServiceWorker()

// --- API-driven state ---

interface PortfolioData {
  totalBalance: number
  availableBalance: number
  dailyPnl: number
  openPositions: Array<{ symbol: string; quantity: number; entryPrice: number; currentPrice: number; pnl: number }>
}

interface AnalyticsStats {
  total: { trades: number; closedTrades: number; openTrades: number; uniqueSymbols: number; totalPnl: number; totalFees: number; winRate: number; profitFactor: number; bestTrade: number; worstTrade: number }
  today: { trades: number; pnl: number; wins: number }
  week: { trades: number; pnl: number }
}

interface AnalyticsTrade {
  id?: string | number
  symbol: string
  side: string
  outcome: 'WIN' | 'LOSS' | 'BREAKEVEN'
  pnlRounded: number
  pnlPercentRounded: number
  openTimeFormatted: string
  closeTimeFormatted: string | null
  status: string
  openTime?: number
}

const portfolio = ref<PortfolioData>({
  totalBalance: 0,
  availableBalance: 0,
  dailyPnl: 0,
  openPositions: [],
})

const analyticsStats = ref<AnalyticsStats | null>(null)

const recentTrades = ref<AnalyticsTrade[]>([])

const systemStatus = ref({
  connected: false,
  apiLatency: 0,
  lastSync: '--',
  alerts: 0,
})

// Portfolio metrics derived from real API data
const portfolioMetrics = computed(() => {
  const balance = portfolio.value.totalBalance || 0
  const dailyPnL = analyticsStats.value?.today.pnl ?? portfolio.value.dailyPnl ?? 0
  const weeklyPnL = analyticsStats.value?.week.pnl ?? 0
  return {
    totalBalance: balance,
    dailyPnL,
    dailyPnLPercent: balance > 0 ? Math.round((dailyPnL / balance) * 10000) / 100 : 0,
    weeklyPnL,
    weeklyPnLPercent: balance > 0 ? Math.round((weeklyPnL / balance) * 10000) / 100 : 0,
  }
})

const openPositions = computed(() => portfolio.value.openPositions)

// Computed properties for conditional rendering
const hasPnLGain = computed(() => portfolioMetrics.value.dailyPnL >= 0)

// Responsive grid columns
const chartGridSpan = computed(() => (isMobile.value ? 12 : isTablet.value ? 12 : 8))
const pnlChartGridSpan = computed(() => (isMobile.value ? 12 : isTablet.value ? 12 : 4))
const positionsGridSpan = computed(() => (isMobile.value ? 12 : isTablet.value ? 6 : 6))
const recentTradesGridSpan = computed(() => (isMobile.value ? 12 : isTablet.value ? 6 : 6))

const toggleWidgetExpanded = (widgetId: string) => {
  expandedWidget.value = expandedWidget.value === widgetId ? null : widgetId
}

/**
 * Load analytics stats and recent closed trades
 */
const loadAnalyticsData = async () => {
  const [statsRes, tradesRes] = await Promise.all([
    apiService.getAnalyticsStats({ mode: 'paper' }),
    apiService.getAnalyticsTrades({ mode: 'paper', limit: 5, sortBy: 'closeTime', sortOrder: 'DESC' }),
  ])

  if (statsRes.success && statsRes.data) {
    analyticsStats.value = statsRes.data as AnalyticsStats
  }

  const tradesData = tradesRes.data as any
  if (tradesRes.success && Array.isArray(tradesData?.trades)) {
    recentTrades.value = tradesData.trades
  }
}

/**
 * Load portfolio (balance + open positions) from API
 */
const loadPortfolioData = async () => {
  const res = await apiService.getPortfolio()
  if (res.success && res.data) {
    portfolio.value = res.data as unknown as PortfolioData
  }
}

/**
 * Load system status and measure API latency
 */
const loadSystemStatus = async () => {
  const start = Date.now()
  const res = await apiService.getHealth()
  const latency = Date.now() - start

  systemStatus.value = {
    connected: res.success,
    apiLatency: latency,
    lastSync: new Date().toLocaleTimeString(),
    alerts: 0,
  }
}

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
      // Use sample data if API fails
      chartData.value = generateSampleChartData()
    }

    // Fetch market data for other symbols
    const marketResponse = await apiService.getHistoricalData('ETH/USD', '1h', 500)
    if (marketResponse.success && Array.isArray(marketResponse.data)) {
      marketData.value = marketResponse.data
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

// Load all dashboard data on mount
onMounted(async () => {
  await Promise.all([
    loadChartData(),
    loadAnalyticsData(),
    loadPortfolioData(),
    loadSystemStatus(),
  ])
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
        <widget-container 
          title="Portfolio Summary"
          variant="default"
          height="auto"
        >
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: var(--trading-spacing-lg)">
            <!-- Total Balance -->
            <div style="padding: var(--trading-spacing-lg); border-radius: var(--trading-radius-lg); background: linear-gradient(135deg, rgba(52, 152, 219, 0.1), rgba(52, 152, 219, 0.05)); border: 1px solid var(--trading-border)">
              <div class="data-label">Total Balance</div>
              <div class="data-value">${{ portfolioMetrics.totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</div>
            </div>

            <!-- Daily P&L -->
            <div style="padding: var(--trading-spacing-lg); border-radius: var(--trading-radius-lg); background: linear-gradient(135deg, rgba(38, 194, 129, 0.1), rgba(38, 194, 129, 0.05)); border: 1px solid var(--trading-border)">
              <div class="data-label">Daily P&L</div>
              <div :class="['data-value', hasPnLGain ? 'profit' : 'loss']">
                {{ hasPnLGain ? '+' : '-' }}${{ Math.abs(portfolioMetrics.dailyPnL).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
              </div>
              <div :class="['data-change', hasPnLGain ? 'up' : 'down']" style="margin-top: var(--trading-spacing-xs)">
                {{ hasPnLGain ? '↑' : '↓' }} {{ Math.abs(portfolioMetrics.dailyPnLPercent) }}%
              </div>
            </div>

            <!-- Weekly P&L -->
            <div style="padding: var(--trading-spacing-lg); border-radius: var(--trading-radius-lg); background: linear-gradient(135deg, rgba(38, 194, 129, 0.1), rgba(38, 194, 129, 0.05)); border: 1px solid var(--trading-border)">
              <div class="data-label">Weekly P&L</div>
              <div class="data-value profit">+${{ portfolioMetrics.weeklyPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}</div>
              <div class="data-change up">↑ {{ portfolioMetrics.weeklyPnLPercent }}%</div>
            </div>
          </div>
        </widget-container>
      </div>

      <!-- Row 2: Charts Section (Responsive spans) -->
      <div :style="{ gridColumn: `span ${chartGridSpan}` }">
        <widget-container 
          title="Price Chart"
          variant="default"
          :height="isMobile ? '250px' : '400px'"
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

      <!-- Row 2: P&L Chart (Responsive spans) -->
      <div :style="{ gridColumn: `span ${pnlChartGridSpan}` }">
        <widget-container 
          title="P&L Timeline"
          variant="default"
          :height="isMobile ? '250px' : '400px'"
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

      <!-- Row 3: Open Positions -->
      <div :style="{ gridColumn: `span ${positionsGridSpan}` }">
        <widget-container 
          title="Open Positions"
          variant="default"
          height="auto"
        >
          <div class="table-responsive">
            <table>
              <thead>
                <tr>
                  <th data-label="Symbol">Symbol</th>
                  <th data-label="Qty">Qty</th>
                  <th data-label="Entry Price">Entry Price</th>
                  <th data-label="Current Price">Current Price</th>
                  <th data-label="P&L">P&L</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="position in openPositions" :key="position.symbol">
                  <td data-label="Symbol" style="font-weight: 600">{{ position.symbol }}</td>
                  <td data-label="Qty">{{ position.quantity }}</td>
                  <td data-label="Entry Price">${{ position.entryPrice.toLocaleString() }}</td>
                  <td data-label="Current Price">${{ position.currentPrice.toLocaleString() }}</td>
                  <td data-label="P&L" :class="['text-profit', { 'text-loss': position.pnl < 0 }]">
                    {{ position.pnl >= 0 ? '+' : '-' }}${{ Math.abs(position.pnl).toLocaleString() }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </widget-container>
      </div>

      <!-- Row 3: Trade History -->
      <div :style="{ gridColumn: `span ${recentTradesGridSpan}` }">
        <widget-container 
          title="Recent Trades"
          variant="default"
          height="auto"
        >
          <div style="display: flex; flex-direction: column; gap: var(--trading-spacing-md)">
            <template v-if="recentTrades.length">
              <div
                v-for="trade in recentTrades"
                :key="trade.id ?? trade.openTime"
                style="padding: var(--trading-spacing-md); background: var(--trading-bg-tertiary); border-radius: var(--trading-radius-md);"
                :style="{ borderLeft: `3px solid ${trade.outcome === 'WIN' ? 'var(--trading-profit)' : trade.outcome === 'LOSS' ? 'var(--trading-loss)' : 'var(--trading-accent-blue)'}` }"
              >
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: var(--trading-spacing-sm)">
                  <div>
                    <div class="data-label">{{ trade.symbol }} - {{ trade.side }}</div>
                    <div style="color: var(--trading-text-primary); font-size: 0.875rem; margin-top: var(--trading-spacing-xs)">
                      {{ trade.closeTimeFormatted ?? trade.openTimeFormatted }}
                    </div>
                  </div>
                  <div style="text-align: right">
                    <div
                      :class="['data-value', trade.outcome === 'WIN' ? 'profit' : trade.outcome === 'LOSS' ? 'loss' : '']"
                      style="font-size: 1.25rem"
                    >
                      {{ trade.outcome === 'WIN' ? '+' : trade.outcome === 'LOSS' ? '-' : '' }}${{ Math.abs(trade.pnlRounded ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }}
                    </div>
                    <div style="color: var(--trading-text-tertiary); font-size: 0.75rem; margin-top: var(--trading-spacing-xs)">
                      {{ Math.abs(trade.pnlPercentRounded ?? 0) }}%
                      {{ trade.outcome === 'WIN' ? 'gain' : trade.outcome === 'LOSS' ? 'loss' : '' }}
                    </div>
                  </div>
                </div>
              </div>
            </template>
            <div
              v-else
              style="color: var(--trading-text-tertiary); font-size: 0.875rem; text-align: center; padding: var(--trading-spacing-lg)"
            >
              {{ loading ? 'Loading trades…' : 'No recent trades' }}
            </div>
          </div>
        </widget-container>
      </div>

      <!-- Row 4: System Status -->
      <div style="grid-column: span 12">
        <widget-container 
          title="System Status"
          variant="compact"
          height="auto"
        >
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--trading-spacing-lg)">
            <!-- Connection Status -->
            <div style="padding: var(--trading-spacing-md); background: var(--trading-bg-tertiary); border-radius: var(--trading-radius-md); display: flex; align-items: center; gap: var(--trading-spacing-md)">
              <div style="display: flex; align-items: center; gap: var(--trading-spacing-sm)">
                <span class="status-dot" :class="{ active: systemStatus.connected, inactive: !systemStatus.connected }"></span>
                <span style="color: var(--trading-text-secondary); font-size: 0.875rem">API Connection</span>
              </div>
              <div style="margin-left: auto; font-weight: 600; color: var(--trading-profit)">
                {{ systemStatus.connected ? 'Connected' : 'Disconnected' }}
              </div>
            </div>

            <!-- API Latency -->
            <div style="padding: var(--trading-spacing-md); background: var(--trading-bg-tertiary); border-radius: var(--trading-radius-md); display: flex; align-items: center; gap: var(--trading-spacing-md)">
              <div style="display: flex; align-items: center; gap: var(--trading-spacing-sm)">
                <span style="font-size: 1.25rem">⚡</span>
                <span style="color: var(--trading-text-secondary); font-size: 0.875rem">API Latency</span>
              </div>
              <div style="margin-left: auto; font-weight: 600; color: var(--trading-text-primary)">
                {{ systemStatus.apiLatency }}ms
              </div>
            </div>

            <!-- Last Sync -->
            <div style="padding: var(--trading-spacing-md); background: var(--trading-bg-tertiary); border-radius: var(--trading-radius-md); display: flex; align-items: center; gap: var(--trading-spacing-md)">
              <div style="display: flex; align-items: center; gap: var(--trading-spacing-sm)">
                <span style="font-size: 1.25rem">🔄</span>
                <span style="color: var(--trading-text-secondary); font-size: 0.875rem">Last Sync</span>
              </div>
              <div style="margin-left: auto; font-weight: 600; color: var(--trading-text-primary)">
                {{ systemStatus.lastSync }}
              </div>
            </div>

            <!-- Active Alerts -->
            <div style="padding: var(--trading-spacing-md); background: var(--trading-bg-tertiary); border-radius: var(--trading-radius-md); display: flex; align-items: center; gap: var(--trading-spacing-md)">
              <div style="display: flex; align-items: center; gap: var(--trading-spacing-sm)">
                <span style="font-size: 1.25rem" :style="{ color: systemStatus.alerts > 0 ? 'var(--trading-warning)' : 'var(--trading-profit)' }">🔔</span>
                <span style="color: var(--trading-text-secondary); font-size: 0.875rem">Active Alerts</span>
              </div>
              <div style="margin-left: auto; font-weight: 600; color: var(--trading-text-primary)">
                {{ systemStatus.alerts }}
              </div>
            </div>
          </div>
        </widget-container>
      </div>
    </dashboard-grid>
  </div>
</template>

<style scoped>
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
}

.action-button-primary:hover {
  background: linear-gradient(135deg, #2980b9, #2471a3);
  border-color: #2471a3;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  :deep(.widget-container) {
    margin-bottom: var(--trading-spacing-md);
  }
}

@media (max-width: 576px) {
  .action-button {
    padding: var(--trading-spacing-xs) var(--trading-spacing-md);
    font-size: 0.875rem;
  }
}
</style>
