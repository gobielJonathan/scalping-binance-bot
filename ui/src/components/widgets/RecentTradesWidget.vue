<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useTradesStore } from '@/stores'
import WidgetContainer from '../layout/WidgetContainer.vue'
import type { Trade } from '@/types/api'

const tradesStore = useTradesStore()

// Local state
const showCount = ref(20)

// Computed properties
const recentTrades = computed(() => tradesStore.trades.slice(0, showCount.value))

const winCount = computed(() => tradesStore.winCount)
const lossCount = computed(() => tradesStore.lossCount)
const breakEvenCount = computed(() => tradesStore.breakEvenCount)
const winRate = computed(() => tradesStore.winRate)
const totalPnl = computed(() => tradesStore.totalPnl)
const totalPnlPercent = computed(() => tradesStore.totalPnlPercent)
const totalCount = computed(() => tradesStore.totalCount)

const averageWin = computed(() => {
  if (winCount.value === 0) return 0
  const winTrades = tradesStore.trades.filter((t) => t.pnl && t.pnl > 0)
  return winTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winCount.value
})

const averageLoss = computed(() => {
  if (lossCount.value === 0) return 0
  const lossTrades = tradesStore.trades.filter((t) => t.pnl && t.pnl < 0)
  return lossTrades.reduce((sum, t) => sum + Math.abs(t.pnl || 0), 0) / lossCount.value
})

const profitFactor = computed(() => {
  const totalWins = winCount.value === 0 ? 0 : tradesStore.trades
    .filter((t) => t.pnl && t.pnl > 0)
    .reduce((sum, t) => sum + (t.pnl || 0), 0)
  const totalLosses = lossCount.value === 0 ? 0 : tradesStore.trades
    .filter((t) => t.pnl && t.pnl < 0)
    .reduce((sum, t) => sum + Math.abs(t.pnl || 0), 0)
  
  if (totalLosses === 0) return totalWins > 0 ? Infinity : 0
  return totalWins / totalLosses
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

const formatTimeAgo = (timestamp: string) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

const getSideColor = (side: string) => {
  return side.toLowerCase() === 'buy' ? 'profit' : 'loss'
}

const getSideIcon = (side: string) => {
  return side.toLowerCase() === 'buy' ? '▲' : '▼'
}

const getPnLColor = (value: number | undefined) => {
  if (!value) return 'neutral'
  return value >= 0 ? 'profit' : 'loss'
}

// Load trades on mount
onMounted(() => {
  tradesStore.fetchTrades()
})
</script>

<template>
  <widget-container
    title="Recent Trades"
    :loading="tradesStore.loadingTrades"
    :error="!!tradesStore.errorTrades"
  >
    <div class="trades-widget">
      <!-- Summary Statistics -->
      <div class="summary-section">
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-label">Total Trades</div>
            <div class="stat-value">{{ totalCount }}</div>
          </div>

          <div class="stat-box">
            <div class="stat-label">Wins</div>
            <div :class="['stat-value', 'profit']">{{ winCount }}</div>
          </div>

          <div class="stat-box">
            <div class="stat-label">Losses</div>
            <div :class="['stat-value', 'loss']">{{ lossCount }}</div>
          </div>

          <div class="stat-box">
            <div class="stat-label">Win Rate</div>
            <div class="stat-value">{{ winRate.toFixed(1) }}%</div>
          </div>

          <div class="stat-box">
            <div class="stat-label">Profit Factor</div>
            <div :class="['stat-value', profitFactor > 1 ? 'profit' : 'loss']">
              {{ profitFactor === Infinity ? '∞' : profitFactor.toFixed(2) }}
            </div>
          </div>

          <div class="stat-box">
            <div class="stat-label">Total P&L</div>
            <div :class="['stat-value', getPnLColor(totalPnl)]">
              {{ formatCurrency(totalPnl) }}
            </div>
          </div>
        </div>

        <!-- Average Win/Loss -->
        <div class="avg-stats">
          <div class="avg-stat">
            <span class="label">Avg Win:</span>
            <span :class="['value', 'profit']">{{ formatCurrency(averageWin) }}</span>
          </div>
          <div class="avg-stat">
            <span class="label">Avg Loss:</span>
            <span :class="['value', 'loss']">{{ formatCurrency(averageLoss) }}</span>
          </div>
        </div>
      </div>

      <!-- Trades List -->
      <div class="trades-list">
        <div v-if="recentTrades.length === 0" class="empty-state">
          <div class="empty-icon">📊</div>
          <p class="empty-text">No trades yet</p>
        </div>

        <div v-else class="trades-container">
          <div
            v-for="(trade, index) in recentTrades"
            :key="trade.id"
            :class="['trade-item', `pnl-${getPnLColor(trade.pnl)}`]"
          >
            <!-- Trade Row -->
            <div class="trade-row">
              <div class="trade-info">
                <div class="trade-header">
                  <div class="trade-symbol">
                    <span :class="['side-indicator', getSideColor(trade.side)]">
                      {{ getSideIcon(trade.side) }}
                    </span>
                    {{ trade.symbol }}
                  </div>
                  <div class="trade-side">{{ trade.side.toUpperCase() }}</div>
                </div>
                <div class="trade-details">
                  <span class="detail">{{ trade.quantity }} @ {{ trade.price.toFixed(2) }}</span>
                  <span class="time-badge">{{ formatTimeAgo(trade.executedAt) }}</span>
                </div>
              </div>

              <div class="trade-result">
                <div :class="['pnl-amount', getPnLColor(trade.pnl)]">
                  {{ trade.pnl ? formatCurrency(trade.pnl) : '—' }}
                </div>
                <div :class="['pnl-percent', getPnLColor(trade.pnlPercent)]">
                  {{ trade.pnlPercent ? formatPercent(trade.pnlPercent) : '—' }}
                </div>
              </div>
            </div>

            <!-- Commission Badge (if applicable) -->
            <div v-if="trade.commission > 0" class="commission-badge">
              Fee: {{ formatCurrency(trade.commission) }}
            </div>
          </div>
        </div>
      </div>

      <!-- Load More Button -->
      <div v-if="totalCount > showCount" class="load-more-section">
        <button
          class="load-more-btn"
          @click="showCount += 20"
        >
          Load More ({{ recentTrades.length }}/{{ totalCount }})
        </button>
      </div>
    </div>
  </widget-container>
</template>

<style scoped>
.trades-widget {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-lg);
}

.summary-section {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-lg);
  padding: var(--trading-spacing-md);
  background: var(--trading-bg-tertiary);
  border-radius: var(--trading-radius-lg);
  border: 1px solid var(--trading-border);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--trading-spacing-md);
}

.stat-box {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-xs);
  text-align: center;
}

.stat-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--trading-text-tertiary);
  letter-spacing: 0.05em;
  font-weight: 600;
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

.avg-stats {
  display: flex;
  gap: var(--trading-spacing-lg);
  justify-content: center;
  flex-wrap: wrap;
  padding-top: var(--trading-spacing-md);
  border-top: 1px solid var(--trading-border);
}

.avg-stat {
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-sm);
}

.avg-stat .label {
  font-size: 0.8rem;
  color: var(--trading-text-secondary);
  font-weight: 600;
}

.avg-stat .value {
  font-size: 1.1rem;
  font-weight: 700;
}

.avg-stat .value.profit {
  color: var(--trading-profit);
}

.avg-stat .value.loss {
  color: var(--trading-loss);
}

.trades-list {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-sm);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--trading-spacing-xl);
  color: var(--trading-text-tertiary);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: var(--trading-spacing-md);
  opacity: 0.5;
}

.empty-text {
  margin: 0;
  font-size: 0.875rem;
}

.trades-container {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-sm);
}

.trade-item {
  padding: var(--trading-spacing-md);
  background: var(--trading-bg-tertiary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  transition: all 0.2s ease;
}

.trade-item:hover {
  border-color: var(--trading-border-light);
  background: var(--trading-bg-hover);
}

.trade-item.pnl-profit {
  border-left: 4px solid var(--trading-profit);
}

.trade-item.pnl-loss {
  border-left: 4px solid var(--trading-loss);
}

.trade-item.pnl-neutral {
  border-left: 4px solid var(--trading-text-tertiary);
}

.trade-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--trading-spacing-md);
}

.trade-info {
  flex: 1;
  min-width: 0;
}

.trade-header {
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-md);
  margin-bottom: var(--trading-spacing-xs);
}

.trade-symbol {
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-sm);
  font-weight: 700;
  color: var(--trading-text-primary);
  font-size: 0.95rem;
}

.side-indicator {
  font-size: 0.8rem;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--trading-bg-secondary);
}

.side-indicator.profit {
  color: var(--trading-profit);
}

.side-indicator.loss {
  color: var(--trading-loss);
}

.trade-side {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--trading-text-tertiary);
}

.trade-details {
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-md);
  flex-wrap: wrap;
}

.detail {
  font-size: 0.8rem;
  color: var(--trading-text-secondary);
}

.time-badge {
  font-size: 0.75rem;
  padding: 2px 8px;
  background: var(--trading-bg-secondary);
  color: var(--trading-text-tertiary);
  border-radius: var(--trading-radius-sm);
  white-space: nowrap;
}

.trade-result {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--trading-spacing-xs);
  text-align: right;
}

.pnl-amount {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--trading-text-primary);
}

.pnl-amount.profit {
  color: var(--trading-profit);
}

.pnl-amount.loss {
  color: var(--trading-loss);
}

.pnl-percent {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--trading-text-secondary);
}

.pnl-percent.profit {
  color: var(--trading-profit);
}

.pnl-percent.loss {
  color: var(--trading-loss);
}

.commission-badge {
  font-size: 0.75rem;
  color: var(--trading-text-tertiary);
  margin-left: 32px;
  padding-top: var(--trading-spacing-xs);
}

.load-more-section {
  display: flex;
  justify-content: center;
  padding: var(--trading-spacing-md);
}

.load-more-btn {
  padding: var(--trading-spacing-sm) var(--trading-spacing-lg);
  background: linear-gradient(135deg, var(--trading-accent-blue), #2980b9);
  border: 1px solid var(--trading-accent-blue);
  color: white;
  border-radius: var(--trading-radius-md);
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 600;
  transition: all 0.3s ease;
}

.load-more-btn:hover {
  background: linear-gradient(135deg, #2980b9, #2471a3);
  border-color: #2471a3;
}

/* Responsive design */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .trade-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .trade-result {
    width: 100%;
    align-items: flex-start;
    margin-top: var(--trading-spacing-sm);
  }
}

@media (max-width: 576px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .trade-item {
    padding: var(--trading-spacing-sm);
  }

  .trade-symbol {
    font-size: 0.85rem;
  }

  .detail {
    font-size: 0.75rem;
  }
}
</style>
