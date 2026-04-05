<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useTradesStore, usePositionsStore } from '@/stores'
import WidgetContainer from '../layout/WidgetContainer.vue'

const tradesStore = useTradesStore()
const positionsStore = usePositionsStore()

// Trade statistics
const winCount = computed(() => tradesStore.winCount)
const lossCount = computed(() => tradesStore.lossCount)
const breakEvenCount = computed(() => tradesStore.breakEvenCount)
const totalTrades = computed(() => tradesStore.totalCount)
const winRate = computed(() => tradesStore.winRate)

// P&L metrics
const totalPnl = computed(() => tradesStore.totalPnl)
const totalPnlPercent = computed(() => tradesStore.totalPnlPercent)
const avgPnl = computed(() => {
  const completed = winCount.value + lossCount.value
  if (completed === 0) return 0
  return totalPnl.value / completed
})

// Win/Loss metrics
const totalWins = computed(() => {
  return tradesStore.trades
    .filter((t) => t.pnl && t.pnl > 0)
    .reduce((sum, t) => sum + (t.pnl || 0), 0)
})

const totalLosses = computed(() => {
  return tradesStore.trades
    .filter((t) => t.pnl && t.pnl < 0)
    .reduce((sum, t) => sum + Math.abs(t.pnl || 0), 0)
})

const profitFactor = computed(() => {
  if (totalLosses.value === 0) return totalWins.value > 0 ? Infinity : 0
  return totalWins.value / totalLosses.value
})

// Position metrics
const totalPositions = computed(() => positionsStore.totalPositions)
const profitablePositions = computed(() => positionsStore.profitableCount)
const losingPositions = computed(() => positionsStore.losingCount)
const positionWinRate = computed(() => positionsStore.winRate)
const totalUnrealizedPnl = computed(() => positionsStore.totalUnrealizedPnl)
const totalExposure = computed(() => positionsStore.totalExposure)

// Risk metrics
const maxDrawdown = computed(() => {
  // Simplified max drawdown calculation
  if (tradesStore.trades.length < 2) return 0
  let maxEquity = 0
  let maxDD = 0
  let runningPnL = 0
  
  for (const trade of tradesStore.trades) {
    runningPnL += trade.pnl || 0
    const currentEquity = runningPnL
    if (currentEquity > maxEquity) {
      maxEquity = currentEquity
    }
    const dd = maxEquity > 0 ? ((maxEquity - currentEquity) / maxEquity) * 100 : 0
    if (dd > maxDD) {
      maxDD = dd
    }
  }
  
  return maxDD
})

const averageWin = computed(() => {
  if (winCount.value === 0) return 0
  return totalWins.value / winCount.value
})

const averageLoss = computed(() => {
  if (lossCount.value === 0) return 0
  return totalLosses.value / lossCount.value
})

const riskRewardRatio = computed(() => {
  if (averageLoss.value === 0) return 0
  return averageWin.value / averageLoss.value
})

const expectancy = computed(() => {
  return (winRate.value / 100) * averageWin.value - ((100 - winRate.value) / 100) * averageLoss.value
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

const formatRatio = (value: number) => {
  if (value === Infinity) return '∞'
  return value.toFixed(2)
}

const getPnLColor = (value: number) => {
  return value >= 0 ? 'profit' : 'loss'
}

// Load trades on mount
onMounted(() => {
  tradesStore.fetchTrades()
  positionsStore.fetchPositions()
})
</script>

<template>
  <widget-container
    title="Performance Summary"
    :loading="tradesStore.loadingTrades || positionsStore.loadingPositions"
    :error="!!tradesStore.errorTrades || !!positionsStore.errorPositions"
  >
    <div class="performance-widget">
      <!-- Key Performance Indicators -->
      <div class="kpi-grid">
        <!-- Win Rate -->
        <div class="kpi-card">
          <div class="kpi-label">Win Rate</div>
          <div class="kpi-value">{{ winRate.toFixed(1) }}%</div>
          <div class="kpi-subtext">{{ winCount }}/{{ totalTrades }} trades</div>
          <div class="kpi-bar">
            <div class="kpi-bar-fill" :style="{ width: `${Math.min(winRate, 100)}%` }"></div>
          </div>
        </div>

        <!-- Profit Factor -->
        <div class="kpi-card">
          <div class="kpi-label">Profit Factor</div>
          <div :class="['kpi-value', profitFactor > 1 ? 'profit' : 'loss']">
            {{ formatRatio(profitFactor) }}
          </div>
          <div class="kpi-subtext">{{ formatCurrency(totalWins) }} / {{ formatCurrency(totalLosses) }}</div>
        </div>

        <!-- Expectancy -->
        <div class="kpi-card">
          <div class="kpi-label">Expectancy</div>
          <div :class="['kpi-value', getPnLColor(expectancy)]">
            {{ formatCurrency(expectancy) }}
          </div>
          <div class="kpi-subtext">Per trade avg</div>
        </div>

        <!-- Risk/Reward Ratio -->
        <div class="kpi-card">
          <div class="kpi-label">Risk/Reward</div>
          <div class="kpi-value">{{ formatRatio(riskRewardRatio) }}</div>
          <div class="kpi-subtext">{{ formatCurrency(averageWin) }} / {{ formatCurrency(averageLoss) }}</div>
        </div>
      </div>

      <!-- Trade Statistics Section -->
      <div class="section">
        <h6 class="section-title">Trade Statistics</h6>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Total Trades</div>
            <div class="stat-value">{{ totalTrades }}</div>
          </div>

          <div class="stat-card">
            <div class="stat-label">Winning Trades</div>
            <div :class="['stat-value', 'profit']">{{ winCount }}</div>
          </div>

          <div class="stat-card">
            <div class="stat-label">Losing Trades</div>
            <div :class="['stat-value', 'loss']">{{ lossCount }}</div>
          </div>

          <div class="stat-card">
            <div class="stat-label">Breakeven</div>
            <div class="stat-value">{{ breakEvenCount }}</div>
          </div>

          <div class="stat-card">
            <div class="stat-label">Total P&L</div>
            <div :class="['stat-value', getPnLColor(totalPnl)]">
              {{ formatCurrency(totalPnl) }}
            </div>
          </div>

          <div class="stat-card">
            <div class="stat-label">Avg P&L</div>
            <div :class="['stat-value', getPnLColor(avgPnl)]">
              {{ formatCurrency(avgPnl) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Risk Metrics Section -->
      <div class="section">
        <h6 class="section-title">Risk Metrics</h6>
        <div class="metrics-grid">
          <div class="metric-item">
            <div class="metric-label">Max Drawdown</div>
            <div :class="['metric-value', 'loss']">-{{ maxDrawdown.toFixed(2) }}%</div>
            <div class="metric-bar">
              <div class="metric-bar-fill loss-fill" :style="{ width: `${Math.min(maxDrawdown, 100)}%` }"></div>
            </div>
          </div>

          <div class="metric-item">
            <div class="metric-label">Avg Win</div>
            <div :class="['metric-value', 'profit']">{{ formatCurrency(averageWin) }}</div>
          </div>

          <div class="metric-item">
            <div class="metric-label">Avg Loss</div>
            <div :class="['metric-value', 'loss']">{{ formatCurrency(averageLoss) }}</div>
          </div>

          <div class="metric-item">
            <div class="metric-label">Total Wins</div>
            <div :class="['metric-value', 'profit']">{{ formatCurrency(totalWins) }}</div>
          </div>

          <div class="metric-item">
            <div class="metric-label">Total Losses</div>
            <div :class="['metric-value', 'loss']">{{ formatCurrency(totalLosses) }}</div>
          </div>

          <div class="metric-item">
            <div class="metric-label">P&L %</div>
            <div :class="['metric-value', getPnLColor(totalPnlPercent)]">
              {{ formatPercent(totalPnlPercent) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Position Summary Section -->
      <div class="section">
        <h6 class="section-title">Open Positions</h6>
        <div class="position-summary">
          <div class="summary-item">
            <div class="summary-label">Total Positions</div>
            <div class="summary-value">{{ totalPositions }}</div>
          </div>

          <div class="summary-item">
            <div class="summary-label">Profitable</div>
            <div :class="['summary-value', 'profit']">{{ profitablePositions }}</div>
          </div>

          <div class="summary-item">
            <div class="summary-label">Losing</div>
            <div :class="['summary-value', 'loss']">{{ losingPositions }}</div>
          </div>

          <div class="summary-item">
            <div class="summary-label">Win Rate</div>
            <div class="summary-value">{{ positionWinRate.toFixed(1) }}%</div>
          </div>

          <div class="summary-item">
            <div class="summary-label">Unrealized P&L</div>
            <div :class="['summary-value', getPnLColor(totalUnrealizedPnl)]">
              {{ formatCurrency(totalUnrealizedPnl) }}
            </div>
          </div>

          <div class="summary-item">
            <div class="summary-label">Total Exposure</div>
            <div class="summary-value">{{ formatCurrency(totalExposure) }}</div>
          </div>
        </div>
      </div>

      <!-- Performance Gauge -->
      <div class="performance-gauge">
        <div class="gauge-item">
          <div class="gauge-label">Overall Rating</div>
          <div class="gauge-display">
            <div class="gauge-circle" :class="{ 'positive': profitFactor > 1, 'negative': profitFactor <= 1 }">
              <div class="gauge-text">
                {{ profitFactor > 2 ? '⭐⭐⭐' : profitFactor > 1 ? '⭐⭐' : profitFactor > 0 ? '⭐' : '⚠️' }}
              </div>
            </div>
            <div class="gauge-description">
              <span v-if="profitFactor > 2">Excellent Performance</span>
              <span v-else-if="profitFactor > 1">Good Performance</span>
              <span v-else-if="profitFactor > 0">Average Performance</span>
              <span v-else>Below Target</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </widget-container>
</template>

<style scoped>
.performance-widget {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-lg);
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--trading-spacing-md);
}

.kpi-card {
  padding: var(--trading-spacing-lg);
  background: var(--trading-bg-tertiary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-lg);
  transition: all 0.3s ease;
}

.kpi-card:hover {
  border-color: var(--trading-border-light);
  background: var(--trading-bg-hover);
}

.kpi-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--trading-text-tertiary);
  letter-spacing: 0.05em;
  font-weight: 600;
  margin-bottom: var(--trading-spacing-sm);
}

.kpi-value {
  font-size: 2rem;
  font-weight: 700;
  color: var(--trading-text-primary);
  line-height: 1;
  margin-bottom: var(--trading-spacing-sm);
}

.kpi-value.profit {
  color: var(--trading-profit);
}

.kpi-value.loss {
  color: var(--trading-loss);
}

.kpi-subtext {
  font-size: 0.75rem;
  color: var(--trading-text-tertiary);
  margin-bottom: var(--trading-spacing-md);
}

.kpi-bar {
  height: 4px;
  background: var(--trading-border);
  border-radius: 2px;
  overflow: hidden;
}

.kpi-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--trading-profit), #27ae60);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.section {
  padding: var(--trading-spacing-lg);
  background: var(--trading-bg-tertiary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-lg);
}

.section-title {
  margin: 0 0 var(--trading-spacing-lg) 0;
  font-size: 0.875rem;
  text-transform: uppercase;
  color: var(--trading-text-secondary);
  letter-spacing: 0.05em;
  font-weight: 600;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--trading-spacing-md);
}

.stat-card {
  padding: var(--trading-spacing-md);
  background: var(--trading-bg-secondary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
}

.stat-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  color: var(--trading-text-tertiary);
  letter-spacing: 0.05em;
  font-weight: 600;
  margin-bottom: var(--trading-spacing-xs);
}

.stat-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--trading-text-primary);
}

.stat-value.profit {
  color: var(--trading-profit);
}

.stat-value.loss {
  color: var(--trading-loss);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--trading-spacing-md);
}

.metric-item {
  padding: var(--trading-spacing-md);
  background: var(--trading-bg-secondary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
}

.metric-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--trading-text-tertiary);
  letter-spacing: 0.05em;
  font-weight: 600;
  margin-bottom: var(--trading-spacing-sm);
}

.metric-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--trading-text-primary);
  margin-bottom: var(--trading-spacing-sm);
}

.metric-value.profit {
  color: var(--trading-profit);
}

.metric-value.loss {
  color: var(--trading-loss);
}

.metric-bar {
  height: 4px;
  background: var(--trading-border);
  border-radius: 2px;
  overflow: hidden;
}

.metric-bar-fill {
  height: 100%;
  background: var(--trading-accent-blue);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.metric-bar-fill.loss-fill {
  background: var(--trading-loss);
}

.position-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--trading-spacing-md);
}

.summary-item {
  padding: var(--trading-spacing-md);
  background: var(--trading-bg-secondary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  text-align: center;
}

.summary-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--trading-text-tertiary);
  letter-spacing: 0.05em;
  font-weight: 600;
  margin-bottom: var(--trading-spacing-sm);
}

.summary-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--trading-text-primary);
}

.summary-value.profit {
  color: var(--trading-profit);
}

.summary-value.loss {
  color: var(--trading-loss);
}

.performance-gauge {
  padding: var(--trading-spacing-lg);
  background: linear-gradient(135deg, rgba(52, 152, 219, 0.1), rgba(46, 204, 113, 0.1));
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-lg);
}

.gauge-item {
  text-align: center;
}

.gauge-label {
  font-size: 0.875rem;
  text-transform: uppercase;
  color: var(--trading-text-secondary);
  letter-spacing: 0.05em;
  font-weight: 600;
  margin-bottom: var(--trading-spacing-lg);
}

.gauge-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--trading-spacing-md);
}

.gauge-circle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: var(--trading-bg-secondary);
  border: 3px solid var(--trading-border);
  transition: all 0.3s ease;
}

.gauge-circle.positive {
  border-color: var(--trading-profit);
  background: rgba(46, 204, 113, 0.1);
}

.gauge-circle.negative {
  border-color: var(--trading-loss);
  background: rgba(231, 76, 60, 0.1);
}

.gauge-text {
  font-size: 2.5rem;
  line-height: 1;
}

.gauge-description {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--trading-text-primary);
}

/* Responsive design */
@media (max-width: 768px) {
  .kpi-grid,
  .stats-grid,
  .metrics-grid,
  .position-summary {
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  }

  .gauge-circle {
    width: 100px;
    height: 100px;
  }

  .gauge-text {
    font-size: 2rem;
  }
}

@media (max-width: 576px) {
  .kpi-grid,
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .metrics-grid,
  .position-summary {
    grid-template-columns: 1fr;
  }

  .kpi-card,
  .section {
    padding: var(--trading-spacing-md);
  }

  .gauge-circle {
    width: 90px;
    height: 90px;
  }
}
</style>
