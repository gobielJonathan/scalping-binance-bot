<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { usePositionsStore } from '@/stores'
import WidgetContainer from '../layout/WidgetContainer.vue'
import type { Position } from '@/types/api'

const positionsStore = usePositionsStore()

// Sorting state
const sortBy = ref<'symbol' | 'pnl' | 'pnlPercent' | 'quantity' | 'createdAt'>('pnl')
const sortOrder = ref<'asc' | 'desc'>('desc')

// Computed properties
const positions = computed(() => positionsStore.positions)

const totalPositions = computed(() => positionsStore.totalPositions)
const profitableCount = computed(() => positionsStore.profitableCount)
const losingCount = computed(() => positionsStore.losingCount)
const winRate = computed(() => positionsStore.winRate)
const totalUnrealizedPnl = computed(() => positionsStore.totalUnrealizedPnl)
const totalExposure = computed(() => positionsStore.totalExposure)

// Sorted positions
const sortedPositions = computed(() => {
  const sorted = [...positions.value]
  
  sorted.sort((a, b) => {
    let aVal: any = a[sortBy.value as keyof typeof a]
    let bVal: any = b[sortBy.value as keyof typeof b]
    
    // Handle date sorting
    if (sortBy.value === 'createdAt') {
      aVal = new Date(a.createdAt).getTime()
      bVal = new Date(b.createdAt).getTime()
    }
    
    if (aVal < bVal) return sortOrder.value === 'asc' ? -1 : 1
    if (aVal > bVal) return sortOrder.value === 'asc' ? 1 : -1
    return 0
  })
  
  return sorted
})

// Toggle sort
const toggleSort = (field: typeof sortBy.value) => {
  if (sortBy.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = field
    sortOrder.value = 'desc'
  }
}

// Utility functions
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

const formatNumber = (value: number) => {
  return value.toFixed(8).replace(/\.?0+$/, '')
}

const formatPercent = (value: number) => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

const getSortIcon = (field: typeof sortBy.value) => {
  if (sortBy.value !== field) return '⇅'
  return sortOrder.value === 'asc' ? '↑' : '↓'
}

const getPnLColor = (value: number) => {
  return value >= 0 ? 'profit' : 'loss'
}

// Load positions on mount
onMounted(() => {
  positionsStore.fetchPositions()
})
</script>

<template>
  <widget-container
    title="Open Positions"
    :loading="positionsStore.loadingPositions"
    :error="!!positionsStore.errorPositions"
  >
    <div class="positions-widget">
      <!-- Summary Stats -->
      <div class="summary-stats">
        <div class="stat">
          <span class="stat-label">Total Positions</span>
          <span class="stat-value">{{ totalPositions }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Profitable</span>
          <span :class="['stat-value', 'profit']">{{ profitableCount }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Losing</span>
          <span :class="['stat-value', 'loss']">{{ losingCount }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Win Rate</span>
          <span class="stat-value">{{ winRate.toFixed(1) }}%</span>
        </div>
        <div class="stat">
          <span class="stat-label">Total P&L</span>
          <span :class="['stat-value', getPnLColor(totalUnrealizedPnl)]">
            {{ formatCurrency(totalUnrealizedPnl) }}
          </span>
        </div>
      </div>

      <!-- Positions Table -->
      <div class="table-container">
        <div v-if="positions.length === 0" class="empty-state">
          <div class="empty-icon">📭</div>
          <p class="empty-text">No open positions</p>
        </div>

        <table v-else class="positions-table">
          <thead>
            <tr>
              <th class="sortable" @click="toggleSort('symbol')">
                Symbol {{ getSortIcon('symbol') }}
              </th>
              <th class="sortable" @click="toggleSort('quantity')">
                Quantity {{ getSortIcon('quantity') }}
              </th>
              <th>Entry Price</th>
              <th>Current Price</th>
              <th class="sortable numeric" @click="toggleSort('pnl')">
                P&L {{ getSortIcon('pnl') }}
              </th>
              <th class="sortable numeric" @click="toggleSort('pnlPercent')">
                P&L % {{ getSortIcon('pnlPercent') }}
              </th>
              <th class="numeric">Exposure</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="position in sortedPositions" :key="position.id" class="position-row">
              <td class="symbol-cell">
                <div class="symbol-badge">{{ position.symbol }}</div>
              </td>
              <td class="numeric-cell">{{ formatNumber(position.quantity) }}</td>
              <td class="numeric-cell">{{ formatCurrency(position.entryPrice) }}</td>
              <td class="numeric-cell">{{ formatCurrency(position.currentPrice) }}</td>
              <td :class="['numeric-cell', getPnLColor(position.pnl)]">
                <strong>{{ formatCurrency(position.pnl) }}</strong>
              </td>
              <td :class="['numeric-cell', getPnLColor(position.pnlPercent)]">
                <strong>{{ formatPercent(position.pnlPercent) }}</strong>
              </td>
              <td class="numeric-cell">{{ formatCurrency(position.quantity * position.currentPrice) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Total Exposure Footer -->
      <div class="footer-stats">
        <div class="exposure-info">
          <span class="label">Total Exposure:</span>
          <span class="value">{{ formatCurrency(totalExposure) }}</span>
        </div>
      </div>
    </div>
  </widget-container>
</template>

<style scoped>
.positions-widget {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-lg);
}

.summary-stats {
  display: flex;
  gap: var(--trading-spacing-md);
  padding: var(--trading-spacing-md);
  background: var(--trading-bg-tertiary);
  border-radius: var(--trading-radius-md);
  flex-wrap: wrap;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-xs);
  min-width: 100px;
}

.stat-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--trading-text-tertiary);
  letter-spacing: 0.05em;
  font-weight: 600;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--trading-text-primary);
}

.stat-value.profit {
  color: var(--trading-profit);
}

.stat-value.loss {
  color: var(--trading-loss);
}

.table-container {
  overflow-x: auto;
  min-height: 150px;
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

.positions-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.positions-table thead {
  border-bottom: 2px solid var(--trading-border);
}

.positions-table th {
  padding: var(--trading-spacing-md) var(--trading-spacing-lg);
  text-align: left;
  color: var(--trading-text-secondary);
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--trading-bg-tertiary);
}

.positions-table th.sortable {
  cursor: pointer;
  user-select: none;
  transition: color 0.2s ease;
}

.positions-table th.sortable:hover {
  color: var(--trading-text-primary);
}

.positions-table th.numeric {
  text-align: right;
}

.position-row {
  border-bottom: 1px solid var(--trading-border);
  transition: background-color 0.2s ease;
}

.position-row:hover {
  background-color: var(--trading-bg-hover);
}

.positions-table td {
  padding: var(--trading-spacing-md) var(--trading-spacing-lg);
  color: var(--trading-text-primary);
}

.symbol-cell {
  font-weight: 600;
}

.symbol-badge {
  display: inline-block;
  padding: var(--trading-spacing-xs) var(--trading-spacing-md);
  background: linear-gradient(135deg, rgba(52, 152, 219, 0.1), rgba(52, 152, 219, 0.05));
  border: 1px solid rgba(52, 152, 219, 0.3);
  border-radius: var(--trading-radius-sm);
  font-weight: 700;
}

.numeric-cell {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.numeric-cell.profit {
  color: var(--trading-profit);
}

.numeric-cell.loss {
  color: var(--trading-loss);
}

.footer-stats {
  display: flex;
  justify-content: flex-end;
  padding: var(--trading-spacing-md);
  border-top: 1px solid var(--trading-border);
  background: var(--trading-bg-tertiary);
  border-radius: var(--trading-radius-md);
}

.exposure-info {
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-md);
}

.exposure-info .label {
  color: var(--trading-text-secondary);
  font-size: 0.875rem;
  font-weight: 600;
}

.exposure-info .value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--trading-text-primary);
}

/* Responsive design */
@media (max-width: 768px) {
  .summary-stats {
    flex-direction: column;
    gap: var(--trading-spacing-sm);
  }

  .stat {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }

  .positions-table {
    font-size: 0.8rem;
  }

  .positions-table th,
  .positions-table td {
    padding: var(--trading-spacing-sm) var(--trading-spacing-md);
  }
}

@media (max-width: 576px) {
  .positions-table {
    font-size: 0.75rem;
  }

  .positions-table th,
  .positions-table td {
    padding: var(--trading-spacing-xs) var(--trading-spacing-sm);
  }

  .symbol-badge {
    padding: var(--trading-spacing-xs) var(--trading-spacing-sm);
    font-size: 0.75rem;
  }
}
</style>
