<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useTradesStore, usePositionsStore, usePortfolioStore } from '@/stores'
import WidgetContainer from '../layout/WidgetContainer.vue'
import type { Trade } from '@/types/api'

interface AnalyticsPeriod {
  label: string
  value: string
  days: number
}

interface PerformanceMetrics {
  totalReturn: number
  totalReturnPercent: number
  sharpeRatio: number
  sortinoratio: number
  maxDrawdown: number
  volatility: number
  calmarRatio: number
  winRate: number
  profitFactor: number
  avgWin: number
  avgLoss: number
  avgTradeDuration: number
  totalTrades: number
  winStreak: number
  lossStreak: number
}

interface TimeBasedPerformance {
  hourly: { [hour: string]: number }
  daily: { [day: string]: number }
  weekly: { [week: string]: number }
  monthly: { [month: string]: number }
}

interface SymbolPerformance {
  symbol: string
  totalPnl: number
  totalTrades: number
  winRate: number
  avgReturn: number
  sharpeRatio: number
}

const tradesStore = useTradesStore()
const positionsStore = usePositionsStore()
const portfolioStore = usePortfolioStore()

// Local state
const selectedPeriod = ref<string>('30d')
const selectedChart = ref<'performance' | 'drawdown' | 'distribution' | 'correlations'>('performance')
const showAdvancedMetrics = ref(false)

// Period options
const periods: AnalyticsPeriod[] = [
  { label: '7D', value: '7d', days: 7 },
  { label: '30D', value: '30d', days: 30 },
  { label: '90D', value: '90d', days: 90 },
  { label: '1Y', value: '1y', days: 365 },
  { label: 'All', value: 'all', days: -1 }
]

// Computed properties
const trades = computed(() => tradesStore.trades)
const positions = computed(() => positionsStore.positions)
const portfolio = computed(() => portfolioStore.portfolio)

// Filter trades by selected period
const filteredTrades = computed(() => {
  if (selectedPeriod.value === 'all') return trades.value

  const period = periods.find(p => p.value === selectedPeriod.value)
  if (!period) return trades.value

  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - period.days)

  return trades.value.filter(trade => 
    new Date(trade.executedAt) >= cutoffDate
  )
})

// Performance calculations
const performanceMetrics = computed((): PerformanceMetrics => {
  const trades = filteredTrades.value.filter(t => t.pnl !== undefined)
  
  if (trades.length === 0) {
    return {
      totalReturn: 0,
      totalReturnPercent: 0,
      sharpeRatio: 0,
      sortinoratio: 0,
      maxDrawdown: 0,
      volatility: 0,
      calmarRatio: 0,
      winRate: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      avgTradeDuration: 0,
      totalTrades: 0,
      winStreak: 0,
      lossStreak: 0
    }
  }

  // Basic metrics
  const totalReturn = trades.reduce((sum, t) => sum + (t.pnl || 0), 0)
  const totalInvested = trades.reduce((sum, t) => sum + (t.quantity * t.price), 0)
  const totalReturnPercent = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0

  const winTrades = trades.filter(t => (t.pnl || 0) > 0)
  const lossTrades = trades.filter(t => (t.pnl || 0) < 0)
  
  const winRate = trades.length > 0 ? (winTrades.length / trades.length) * 100 : 0
  const avgWin = winTrades.length > 0 ? winTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winTrades.length : 0
  const avgLoss = lossTrades.length > 0 ? Math.abs(lossTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / lossTrades.length) : 0

  const totalWins = winTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
  const totalLosses = Math.abs(lossTrades.reduce((sum, t) => sum + (t.pnl || 0), 0))
  const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0

  // Calculate returns for each trade
  const returns = trades.map(t => {
    const invested = t.quantity * t.price
    return invested > 0 ? ((t.pnl || 0) / invested) * 100 : 0
  })

  // Volatility (standard deviation of returns)
  const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
  const volatility = Math.sqrt(variance)

  // Sharpe ratio (assuming 0% risk-free rate)
  const sharpeRatio = volatility > 0 ? avgReturn / volatility : 0

  // Sortino ratio (downside deviation)
  const downsideReturns = returns.filter(r => r < 0)
  const downsideVariance = downsideReturns.length > 0 
    ? downsideReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / downsideReturns.length 
    : 0
  const downsideDeviation = Math.sqrt(downsideVariance)
  const sortinoratio = downsideDeviation > 0 ? avgReturn / downsideDeviation : 0

  // Max drawdown calculation
  let peak = 0
  let maxDrawdown = 0
  let runningPnl = 0
  
  trades.forEach(trade => {
    runningPnl += (trade.pnl || 0)
    if (runningPnl > peak) {
      peak = runningPnl
    }
    const drawdown = peak - runningPnl
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown
    }
  })

  const maxDrawdownPercent = peak > 0 ? (maxDrawdown / peak) * 100 : 0

  // Calmar ratio
  const calmarRatio = maxDrawdownPercent > 0 ? totalReturnPercent / maxDrawdownPercent : 0

  // Win/loss streaks
  let currentWinStreak = 0
  let currentLossStreak = 0
  let maxWinStreak = 0
  let maxLossStreak = 0

  trades.forEach(trade => {
    if ((trade.pnl || 0) > 0) {
      currentWinStreak++
      currentLossStreak = 0
      maxWinStreak = Math.max(maxWinStreak, currentWinStreak)
    } else if ((trade.pnl || 0) < 0) {
      currentLossStreak++
      currentWinStreak = 0
      maxLossStreak = Math.max(maxLossStreak, currentLossStreak)
    }
  })

  // Average trade duration (simplified)
  const avgTradeDuration = trades.length > 1 
    ? (new Date(trades[0]?.executedAt || '').getTime() - new Date(trades[trades.length - 1]?.executedAt || '').getTime()) / (trades.length - 1) / 60000 // minutes
    : 0

  return {
    totalReturn,
    totalReturnPercent,
    sharpeRatio,
    sortinoratio,
    maxDrawdown: maxDrawdownPercent,
    volatility,
    calmarRatio,
    winRate,
    profitFactor,
    avgWin,
    avgLoss,
    avgTradeDuration,
    totalTrades: trades.length,
    winStreak: maxWinStreak,
    lossStreak: maxLossStreak
  }
})

// Time-based performance
const timeBasedPerformance = computed((): TimeBasedPerformance => {
  const trades = filteredTrades.value

  const hourly: { [hour: string]: number } = {}
  const daily: { [day: string]: number } = {}
  const weekly: { [week: string]: number } = {}
  const monthly: { [month: string]: number } = {}

  trades.forEach(trade => {
    const date = new Date(trade.executedAt)
    const hour = date.getHours().toString().padStart(2, '0')
    const day = date.toLocaleDateString('en-US', { weekday: 'long' })
    const week = `Week ${Math.ceil(date.getDate() / 7)}`
    const month = date.toLocaleDateString('en-US', { month: 'long' })

    hourly[hour] = (hourly[hour] || 0) + (trade.pnl || 0)
    daily[day] = (daily[day] || 0) + (trade.pnl || 0)
    weekly[week] = (weekly[week] || 0) + (trade.pnl || 0)
    monthly[month] = (monthly[month] || 0) + (trade.pnl || 0)
  })

  return { hourly, daily, weekly, monthly }
})

// Symbol performance
const symbolPerformance = computed((): SymbolPerformance[] => {
  const trades = filteredTrades.value
  const symbolMap = new Map<string, Trade[]>()

  trades.forEach(trade => {
    if (!symbolMap.has(trade.symbol)) {
      symbolMap.set(trade.symbol, [])
    }
    symbolMap.get(trade.symbol)!.push(trade)
  })

  const results: SymbolPerformance[] = []

  symbolMap.forEach((symbolTrades, symbol) => {
    const totalPnl = symbolTrades.reduce((sum, t) => sum + (t.pnl || 0), 0)
    const totalTrades = symbolTrades.length
    const winTrades = symbolTrades.filter(t => (t.pnl || 0) > 0)
    const winRate = totalTrades > 0 ? (winTrades.length / totalTrades) * 100 : 0
    
    const returns = symbolTrades.map(t => {
      const invested = t.quantity * t.price
      return invested > 0 ? ((t.pnl || 0) / invested) * 100 : 0
    })
    
    const avgReturn = returns.length > 0 ? returns.reduce((sum, r) => sum + r, 0) / returns.length : 0
    const returnVariance = returns.length > 0 
      ? returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length 
      : 0
    const returnVolatility = Math.sqrt(returnVariance)
    const sharpeRatio = returnVolatility > 0 ? avgReturn / returnVolatility : 0

    results.push({
      symbol,
      totalPnl,
      totalTrades,
      winRate,
      avgReturn,
      sharpeRatio
    })
  })

  return results.sort((a, b) => b.totalPnl - a.totalPnl)
})

// Risk-adjusted returns
const riskAdjustedMetrics = computed(() => {
  const metrics = performanceMetrics.value
  return {
    informationRatio: metrics.volatility > 0 ? metrics.totalReturnPercent / metrics.volatility : 0,
    treynorRatio: metrics.volatility > 0 ? metrics.totalReturnPercent / (metrics.volatility / 100) : 0,
    jensenAlpha: metrics.totalReturnPercent, // Simplified, would need market benchmark
    beta: 1.0, // Simplified, would need market correlation
    rSquared: 0.85 // Mock value
  }
})

// Utility functions
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

const formatPercent = (value: number) => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

const formatNumber = (value: number, decimals: number = 2) => {
  return value.toFixed(decimals)
}

const getRatingColor = (value: number, thresholds: { excellent: number; good: number; fair: number }) => {
  if (value >= thresholds.excellent) return 'var(--trading-profit)'
  if (value >= thresholds.good) return 'var(--trading-accent-blue)'
  if (value >= thresholds.fair) return 'var(--trading-warning)'
  return 'var(--trading-loss)'
}

const getMetricRating = (metric: string, value: number): string => {
  const ratings = {
    sharpeRatio: { excellent: 2.0, good: 1.0, fair: 0.5 },
    sortinoratio: { excellent: 2.5, good: 1.5, fair: 0.8 },
    winRate: { excellent: 70, good: 60, fair: 50 },
    profitFactor: { excellent: 2.0, good: 1.5, fair: 1.2 },
    calmarRatio: { excellent: 1.0, good: 0.5, fair: 0.3 }
  }

  const thresholds = ratings[metric as keyof typeof ratings]
  if (!thresholds) return 'N/A'

  if (value >= thresholds.excellent) return 'Excellent'
  if (value >= thresholds.good) return 'Good'
  if (value >= thresholds.fair) return 'Fair'
  return 'Poor'
}

// Chart data for performance visualization
const performanceChartData = computed(() => {
  const trades = filteredTrades.value.sort((a, b) => 
    new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime()
  )

  let cumulativePnl = 0
  return trades.map(trade => {
    cumulativePnl += (trade.pnl || 0)
    return {
      date: trade.executedAt,
      pnl: cumulativePnl,
      trade: trade
    }
  })
})

// Actions
const selectPeriod = (period: string) => {
  selectedPeriod.value = period
}

const selectChart = (chart: typeof selectedChart.value) => {
  selectedChart.value = chart
}

const exportAnalytics = () => {
  const data = {
    period: selectedPeriod.value,
    metrics: performanceMetrics.value,
    timeBasedPerformance: timeBasedPerformance.value,
    symbolPerformance: symbolPerformance.value,
    riskAdjustedMetrics: riskAdjustedMetrics.value,
    generatedAt: new Date().toISOString()
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `trade-analytics-${selectedPeriod.value}-${new Date().toISOString().split('T')[0]}.json`
  link.click()
  URL.revokeObjectURL(url)
}

// Load data on mount
onMounted(() => {
  tradesStore.fetchTrades()
})
</script>

<template>
  <widget-container
    title="Trade Analytics"
    :loading="tradesStore.isLoading"
    :error="tradesStore.hasError"
  >
    <template #header-actions>
      <div class="header-controls">
        <div class="period-selector">
          <button
            v-for="period in periods"
            :key="period.value"
            :class="['period-btn', { active: selectedPeriod === period.value }]"
            @click="selectPeriod(period.value)"
          >
            {{ period.label }}
          </button>
        </div>
        
        <button class="export-btn" @click="exportAnalytics">
          📊 Export
        </button>
      </div>
    </template>

    <div class="analytics-dashboard">
      <!-- Key Performance Metrics -->
      <div class="metrics-section">
        <h4 class="section-title">Performance Overview</h4>
        
        <div class="metrics-grid">
          <!-- Total Return -->
          <div class="metric-card highlight">
            <div class="metric-header">
              <span class="metric-label">Total Return</span>
              <span class="metric-period">{{ selectedPeriod.toUpperCase() }}</span>
            </div>
            <div class="metric-value">
              <div :class="['primary-value', performanceMetrics.totalReturn >= 0 ? 'profit' : 'loss']">
                {{ formatCurrency(performanceMetrics.totalReturn) }}
              </div>
              <div :class="['secondary-value', performanceMetrics.totalReturnPercent >= 0 ? 'profit' : 'loss']">
                {{ formatPercent(performanceMetrics.totalReturnPercent) }}
              </div>
            </div>
          </div>

          <!-- Sharpe Ratio -->
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">Sharpe Ratio</span>
              <span 
                class="metric-rating"
                :style="{ color: getRatingColor(performanceMetrics.sharpeRatio, { excellent: 2.0, good: 1.0, fair: 0.5 }) }"
              >
                {{ getMetricRating('sharpeRatio', performanceMetrics.sharpeRatio) }}
              </span>
            </div>
            <div class="metric-value">
              <div class="primary-value">{{ formatNumber(performanceMetrics.sharpeRatio, 3) }}</div>
            </div>
          </div>

          <!-- Win Rate -->
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">Win Rate</span>
              <span 
                class="metric-rating"
                :style="{ color: getRatingColor(performanceMetrics.winRate, { excellent: 70, good: 60, fair: 50 }) }"
              >
                {{ getMetricRating('winRate', performanceMetrics.winRate) }}
              </span>
            </div>
            <div class="metric-value">
              <div class="primary-value">{{ formatPercent(performanceMetrics.winRate) }}</div>
              <div class="secondary-value">
                {{ performanceMetrics.totalTrades }} trades
              </div>
            </div>
          </div>

          <!-- Max Drawdown -->
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">Max Drawdown</span>
              <span class="metric-rating loss">Risk</span>
            </div>
            <div class="metric-value">
              <div class="primary-value loss">-{{ formatPercent(performanceMetrics.maxDrawdown) }}</div>
            </div>
          </div>

          <!-- Profit Factor -->
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">Profit Factor</span>
              <span 
                class="metric-rating"
                :style="{ color: getRatingColor(performanceMetrics.profitFactor, { excellent: 2.0, good: 1.5, fair: 1.2 }) }"
              >
                {{ getMetricRating('profitFactor', performanceMetrics.profitFactor) }}
              </span>
            </div>
            <div class="metric-value">
              <div class="primary-value">
                {{ performanceMetrics.profitFactor === Infinity ? '∞' : formatNumber(performanceMetrics.profitFactor, 2) }}
              </div>
            </div>
          </div>

          <!-- Volatility -->
          <div class="metric-card">
            <div class="metric-header">
              <span class="metric-label">Volatility</span>
              <span class="metric-rating">{{ performanceMetrics.volatility > 5 ? 'High' : performanceMetrics.volatility > 2 ? 'Medium' : 'Low' }}</span>
            </div>
            <div class="metric-value">
              <div class="primary-value">{{ formatPercent(performanceMetrics.volatility) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Advanced Metrics Toggle -->
      <div class="advanced-toggle">
        <button 
          class="toggle-btn"
          @click="showAdvancedMetrics = !showAdvancedMetrics"
        >
          {{ showAdvancedMetrics ? 'Hide' : 'Show' }} Advanced Metrics
          <span class="toggle-icon">{{ showAdvancedMetrics ? '−' : '+' }}</span>
        </button>
      </div>

      <!-- Advanced Metrics -->
      <div v-if="showAdvancedMetrics" class="advanced-metrics">
        <h4 class="section-title">Advanced Risk-Adjusted Metrics</h4>
        
        <div class="advanced-grid">
          <div class="metric-group">
            <h5>Risk Metrics</h5>
            <div class="metric-list">
              <div class="metric-row">
                <span class="label">Sortino Ratio:</span>
                <span class="value">{{ formatNumber(performanceMetrics.sortinoratio, 3) }}</span>
              </div>
              <div class="metric-row">
                <span class="label">Calmar Ratio:</span>
                <span class="value">{{ formatNumber(performanceMetrics.calmarRatio, 3) }}</span>
              </div>
              <div class="metric-row">
                <span class="label">Information Ratio:</span>
                <span class="value">{{ formatNumber(riskAdjustedMetrics.informationRatio, 3) }}</span>
              </div>
              <div class="metric-row">
                <span class="label">Beta:</span>
                <span class="value">{{ formatNumber(riskAdjustedMetrics.beta, 3) }}</span>
              </div>
            </div>
          </div>

          <div class="metric-group">
            <h5>Trade Metrics</h5>
            <div class="metric-list">
              <div class="metric-row">
                <span class="label">Avg Win:</span>
                <span class="value profit">{{ formatCurrency(performanceMetrics.avgWin) }}</span>
              </div>
              <div class="metric-row">
                <span class="label">Avg Loss:</span>
                <span class="value loss">{{ formatCurrency(performanceMetrics.avgLoss) }}</span>
              </div>
              <div class="metric-row">
                <span class="label">Win Streak:</span>
                <span class="value">{{ performanceMetrics.winStreak }}</span>
              </div>
              <div class="metric-row">
                <span class="label">Loss Streak:</span>
                <span class="value">{{ performanceMetrics.lossStreak }}</span>
              </div>
            </div>
          </div>

          <div class="metric-group">
            <h5>Efficiency</h5>
            <div class="metric-list">
              <div class="metric-row">
                <span class="label">Avg Trade Duration:</span>
                <span class="value">{{ Math.round(performanceMetrics.avgTradeDuration) }}m</span>
              </div>
              <div class="metric-row">
                <span class="label">R-Squared:</span>
                <span class="value">{{ formatPercent(riskAdjustedMetrics.rSquared * 100) }}</span>
              </div>
              <div class="metric-row">
                <span class="label">Jensen's Alpha:</span>
                <span class="value">{{ formatPercent(riskAdjustedMetrics.jensenAlpha) }}</span>
              </div>
              <div class="metric-row">
                <span class="label">Treynor Ratio:</span>
                <span class="value">{{ formatNumber(riskAdjustedMetrics.treynorRatio, 3) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Time-based Performance -->
      <div class="time-performance-section">
        <h4 class="section-title">Time-based Performance Patterns</h4>
        
        <div class="time-charts">
          <div class="time-chart">
            <h5>Hourly Performance</h5>
            <div class="chart-container">
              <div class="chart-bars">
                <div 
                  v-for="hour in 24" 
                  :key="hour - 1"
                  class="chart-bar"
                  :style="{
                    height: Math.abs(timeBasedPerformance.hourly[(hour - 1).toString().padStart(2, '0')] || 0) * 2 + 'px',
                    backgroundColor: (timeBasedPerformance.hourly[(hour - 1).toString().padStart(2, '0')] || 0) >= 0 ? 'var(--trading-profit)' : 'var(--trading-loss)'
                  }"
                  :title="`${hour - 1}:00 - ${formatCurrency(timeBasedPerformance.hourly[(hour - 1).toString().padStart(2, '0')] || 0)}`"
                ></div>
              </div>
              <div class="chart-labels">
                <span>00</span>
                <span>06</span>
                <span>12</span>
                <span>18</span>
                <span>24</span>
              </div>
            </div>
          </div>

          <div class="time-chart">
            <h5>Daily Performance</h5>
            <div class="daily-performance">
              <div 
                v-for="(pnl, day) in timeBasedPerformance.daily"
                :key="day"
                class="daily-item"
              >
                <span class="day-name">{{ day.slice(0, 3) }}</span>
                <span :class="['day-pnl', pnl >= 0 ? 'profit' : 'loss']">
                  {{ formatCurrency(pnl) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Symbol Performance -->
      <div class="symbol-performance-section">
        <h4 class="section-title">Symbol Performance Breakdown</h4>
        
        <div class="symbol-table-container">
          <table class="symbol-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th class="numeric">Total P&L</th>
                <th class="numeric">Trades</th>
                <th class="numeric">Win Rate</th>
                <th class="numeric">Avg Return</th>
                <th class="numeric">Sharpe</th>
              </tr>
            </thead>
            <tbody>
              <tr 
                v-for="symbol in symbolPerformance.slice(0, 10)"
                :key="symbol.symbol"
                class="symbol-row"
              >
                <td class="symbol-cell">
                  <div class="symbol-badge">{{ symbol.symbol }}</div>
                </td>
                <td :class="['numeric', symbol.totalPnl >= 0 ? 'profit' : 'loss']">
                  <strong>{{ formatCurrency(symbol.totalPnl) }}</strong>
                </td>
                <td class="numeric">{{ symbol.totalTrades }}</td>
                <td class="numeric">{{ formatPercent(symbol.winRate) }}</td>
                <td :class="['numeric', symbol.avgReturn >= 0 ? 'profit' : 'loss']">
                  {{ formatPercent(symbol.avgReturn) }}
                </td>
                <td class="numeric">
                  <span 
                    :style="{ color: getRatingColor(symbol.sharpeRatio, { excellent: 2.0, good: 1.0, fair: 0.5 }) }"
                  >
                    {{ formatNumber(symbol.sharpeRatio, 2) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Performance Chart -->
      <div class="chart-section">
        <h4 class="section-title">Cumulative Performance</h4>
        
        <div class="chart-container performance-chart">
          <svg width="100%" height="200" class="performance-svg">
            <!-- Chart background -->
            <defs>
              <linearGradient id="performanceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" :style="`stop-color:${performanceMetrics.totalReturn >= 0 ? 'var(--trading-profit)' : 'var(--trading-loss)'};stop-opacity:0.3`" />
                <stop offset="100%" :style="`stop-color:${performanceMetrics.totalReturn >= 0 ? 'var(--trading-profit)' : 'var(--trading-loss)'};stop-opacity:0.05`" />
              </linearGradient>
            </defs>
            
            <!-- Zero line -->
            <line 
              x1="0" 
              y1="100" 
              x2="100%" 
              y2="100" 
              stroke="var(--trading-border)"
              stroke-width="1"
              stroke-dasharray="5,5"
            />
            
            <!-- Performance line -->
            <polyline
              v-if="performanceChartData.length > 1"
              :points="performanceChartData.map((point, index) => 
                `${(index / (performanceChartData.length - 1)) * 100}%,${100 - (point.pnl / Math.max(...performanceChartData.map(p => Math.abs(p.pnl)))) * 50}`
              ).join(' ')"
              fill="none"
              :stroke="performanceMetrics.totalReturn >= 0 ? 'var(--trading-profit)' : 'var(--trading-loss)'"
              stroke-width="2"
            />
          </svg>
          
          <div class="chart-info">
            <div class="chart-stat">
              <span class="label">Start:</span>
              <span class="value">{{ formatCurrency(0) }}</span>
            </div>
            <div class="chart-stat">
              <span class="label">Current:</span>
              <span :class="['value', performanceMetrics.totalReturn >= 0 ? 'profit' : 'loss']">
                {{ formatCurrency(performanceMetrics.totalReturn) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </widget-container>
</template>

<style scoped>
.analytics-dashboard {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-xl);
}

.header-controls {
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-lg);
}

.period-selector {
  display: flex;
  gap: var(--trading-spacing-xs);
  background: var(--trading-bg-tertiary);
  border-radius: var(--trading-radius-md);
  padding: var(--trading-spacing-xs);
}

.period-btn {
  padding: var(--trading-spacing-sm) var(--trading-spacing-md);
  background: none;
  border: none;
  border-radius: var(--trading-radius-sm);
  color: var(--trading-text-secondary);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.period-btn:hover {
  color: var(--trading-text-primary);
  background: var(--trading-bg-hover);
}

.period-btn.active {
  background: var(--trading-accent-blue);
  color: white;
}

.export-btn {
  padding: var(--trading-spacing-sm) var(--trading-spacing-md);
  background: var(--trading-bg-tertiary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  color: var(--trading-text-primary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.export-btn:hover {
  background: var(--trading-bg-hover);
  border-color: var(--trading-border-light);
}

.section-title {
  margin: 0 0 var(--trading-spacing-lg) 0;
  color: var(--trading-text-primary);
  font-size: 1.1rem;
  font-weight: 600;
  padding-bottom: var(--trading-spacing-sm);
  border-bottom: 1px solid var(--trading-border);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--trading-spacing-lg);
}

.metric-card {
  background: var(--trading-bg-tertiary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  padding: var(--trading-spacing-lg);
  transition: all 0.2s ease;
}

.metric-card:hover {
  border-color: var(--trading-border-light);
  transform: translateY(-2px);
}

.metric-card.highlight {
  background: linear-gradient(135deg, var(--trading-bg-tertiary), var(--trading-bg-secondary));
  border-color: var(--trading-accent-blue);
}

.metric-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--trading-spacing-md);
}

.metric-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--trading-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metric-period,
.metric-rating {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: var(--trading-radius-sm);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metric-period {
  background: rgba(52, 152, 219, 0.1);
  color: var(--trading-accent-blue);
}

.metric-rating {
  background: rgba(255, 255, 255, 0.05);
  color: var(--trading-text-tertiary);
}

.metric-value {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-xs);
}

.primary-value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--trading-text-primary);
}

.secondary-value {
  font-size: 1rem;
  font-weight: 600;
  color: var(--trading-text-secondary);
}

.primary-value.profit,
.secondary-value.profit {
  color: var(--trading-profit);
}

.primary-value.loss,
.secondary-value.loss {
  color: var(--trading-loss);
}

.advanced-toggle {
  display: flex;
  justify-content: center;
}

.toggle-btn {
  padding: var(--trading-spacing-sm) var(--trading-spacing-lg);
  background: var(--trading-bg-tertiary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  color: var(--trading-text-primary);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-sm);
}

.toggle-btn:hover {
  background: var(--trading-bg-hover);
  border-color: var(--trading-border-light);
}

.toggle-icon {
  font-size: 1.2rem;
  font-weight: 700;
}

.advanced-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--trading-spacing-xl);
}

.metric-group {
  background: var(--trading-bg-tertiary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  padding: var(--trading-spacing-lg);
}

.metric-group h5 {
  margin: 0 0 var(--trading-spacing-lg) 0;
  color: var(--trading-text-primary);
  font-size: 1rem;
  font-weight: 600;
  padding-bottom: var(--trading-spacing-sm);
  border-bottom: 1px solid var(--trading-border);
}

.metric-list {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-sm);
}

.metric-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.metric-row .label {
  font-size: 0.8rem;
  color: var(--trading-text-secondary);
}

.metric-row .value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--trading-text-primary);
}

.metric-row .value.profit {
  color: var(--trading-profit);
}

.metric-row .value.loss {
  color: var(--trading-loss);
}

.time-charts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--trading-spacing-xl);
}

.time-chart {
  background: var(--trading-bg-tertiary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  padding: var(--trading-spacing-lg);
}

.time-chart h5 {
  margin: 0 0 var(--trading-spacing-lg) 0;
  color: var(--trading-text-primary);
  font-size: 0.95rem;
  font-weight: 600;
}

.chart-bars {
  display: flex;
  align-items: end;
  gap: 2px;
  height: 80px;
  margin-bottom: var(--trading-spacing-sm);
}

.chart-bar {
  flex: 1;
  min-height: 2px;
  border-radius: 1px;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.chart-bar:hover {
  opacity: 0.7;
}

.chart-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--trading-text-tertiary);
}

.daily-performance {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-sm);
}

.daily-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--trading-spacing-sm);
  background: var(--trading-bg-secondary);
  border-radius: var(--trading-radius-sm);
}

.day-name {
  font-size: 0.8rem;
  color: var(--trading-text-secondary);
  font-weight: 600;
}

.day-pnl {
  font-size: 0.875rem;
  font-weight: 600;
}

.day-pnl.profit {
  color: var(--trading-profit);
}

.day-pnl.loss {
  color: var(--trading-loss);
}

.symbol-table-container {
  background: var(--trading-bg-tertiary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  overflow: hidden;
}

.symbol-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.symbol-table thead {
  background: var(--trading-bg-secondary);
  border-bottom: 1px solid var(--trading-border);
}

.symbol-table th {
  padding: var(--trading-spacing-md);
  text-align: left;
  color: var(--trading-text-secondary);
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.symbol-table th.numeric {
  text-align: right;
}

.symbol-row {
  border-bottom: 1px solid var(--trading-border);
  transition: background-color 0.2s ease;
}

.symbol-row:hover {
  background: var(--trading-bg-hover);
}

.symbol-row:last-child {
  border-bottom: none;
}

.symbol-table td {
  padding: var(--trading-spacing-md);
  color: var(--trading-text-primary);
}

.symbol-cell .symbol-badge {
  display: inline-block;
  padding: var(--trading-spacing-xs) var(--trading-spacing-md);
  background: linear-gradient(135deg, rgba(52, 152, 219, 0.1), rgba(52, 152, 219, 0.05));
  border: 1px solid rgba(52, 152, 219, 0.3);
  border-radius: var(--trading-radius-sm);
  font-weight: 700;
  font-size: 0.875rem;
}

.symbol-table .numeric {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.symbol-table .profit {
  color: var(--trading-profit);
}

.symbol-table .loss {
  color: var(--trading-loss);
}

.performance-chart {
  background: var(--trading-bg-tertiary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  padding: var(--trading-spacing-lg);
}

.performance-svg {
  display: block;
  margin-bottom: var(--trading-spacing-md);
}

.chart-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chart-stat {
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-sm);
}

.chart-stat .label {
  font-size: 0.8rem;
  color: var(--trading-text-secondary);
}

.chart-stat .value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--trading-text-primary);
}

.chart-stat .value.profit {
  color: var(--trading-profit);
}

.chart-stat .value.loss {
  color: var(--trading-loss);
}

/* Responsive design */
@media (max-width: 768px) {
  .header-controls {
    flex-direction: column;
    gap: var(--trading-spacing-md);
    align-items: stretch;
  }

  .period-selector {
    justify-content: center;
  }

  .metrics-grid {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }

  .advanced-grid {
    grid-template-columns: 1fr;
  }

  .time-charts {
    grid-template-columns: 1fr;
  }

  .symbol-table {
    font-size: 0.8rem;
  }

  .symbol-table th,
  .symbol-table td {
    padding: var(--trading-spacing-sm);
  }
}

@media (max-width: 576px) {
  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .primary-value {
    font-size: 1.5rem;
  }

  .secondary-value {
    font-size: 0.9rem;
  }

  .symbol-table {
    font-size: 0.75rem;
  }

  .chart-info {
    flex-direction: column;
    gap: var(--trading-spacing-sm);
    text-align: center;
  }
}
</style>