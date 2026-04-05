<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useTradesStore } from '@/stores'
import WidgetContainer from '../layout/WidgetContainer.vue'
import type { Trade } from '@/types/api'

const tradesStore = useTradesStore()

// Local state
const searchQuery = ref('')
const showFilters = ref(false)
const exportFormat = ref<'csv' | 'json'>('csv')

// Filter state
const filters = ref({
  symbol: '',
  side: '',
  dateFrom: '',
  dateTo: '',
  profitLoss: 'all', // 'all', 'profit', 'loss'
  minPnl: '',
  maxPnl: ''
})

// Sorting state
const sortBy = ref<'executedAt' | 'symbol' | 'side' | 'quantity' | 'price' | 'pnl' | 'pnlPercent'>('executedAt')
const sortOrder = ref<'asc' | 'desc'>('desc')

// Pagination state
const itemsPerPage = ref(20)
const currentPage = ref(1)

// Computed properties
const trades = computed(() => tradesStore.paginatedTrades)
const totalTrades = computed(() => tradesStore.filteredTrades.length)
const isLoading = computed(() => tradesStore.loadingTrades)
const hasError = computed(() => !!tradesStore.errorTrades)

const totalPages = computed(() => Math.ceil(totalTrades.value / itemsPerPage.value))

// Filtered trades
const filteredTrades = computed(() => {
  let filtered = trades.value

  // Search filter
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(trade => 
      trade.symbol.toLowerCase().includes(query) ||
      trade.id.toLowerCase().includes(query)
    )
  }

  // Symbol filter
  if (filters.value.symbol) {
    filtered = filtered.filter(trade => 
      trade.symbol.toLowerCase().includes(filters.value.symbol.toLowerCase())
    )
  }

  // Side filter
  if (filters.value.side) {
    filtered = filtered.filter(trade => trade.side === filters.value.side)
  }

  // Date range filter
  if (filters.value.dateFrom) {
    const fromDate = new Date(filters.value.dateFrom)
    filtered = filtered.filter(trade => 
      new Date(trade.executedAt) >= fromDate
    )
  }
  if (filters.value.dateTo) {
    const toDate = new Date(filters.value.dateTo)
    toDate.setHours(23, 59, 59, 999)
    filtered = filtered.filter(trade => 
      new Date(trade.executedAt) <= toDate
    )
  }

  // Profit/Loss filter
  if (filters.value.profitLoss === 'profit') {
    filtered = filtered.filter(trade => (trade.pnl || 0) > 0)
  } else if (filters.value.profitLoss === 'loss') {
    filtered = filtered.filter(trade => (trade.pnl || 0) < 0)
  }

  // P&L range filter
  if (filters.value.minPnl) {
    const minPnl = parseFloat(filters.value.minPnl)
    filtered = filtered.filter(trade => (trade.pnl || 0) >= minPnl)
  }
  if (filters.value.maxPnl) {
    const maxPnl = parseFloat(filters.value.maxPnl)
    filtered = filtered.filter(trade => (trade.pnl || 0) <= maxPnl)
  }

  return filtered
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

const formatNumber = (value: number) => {
  return value.toFixed(8).replace(/\.?0+$/, '')
}

const formatPercent = (value: number) => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

const formatDateTime = (timestamp: string) => {
  const date = new Date(timestamp)
  return {
    date: date.toLocaleDateString('en-US', { 
      month: '2-digit', 
      day: '2-digit', 
      year: 'numeric'
    }),
    time: date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    })
  }
}

const calculateDuration = (trade: Trade) => {
  // This is a simplified duration calculation
  // In a real implementation, you'd need entry and exit timestamps
  const executedAt = new Date(trade.executedAt)
  const now = new Date()
  const diffMs = now.getTime() - executedAt.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h`
  if (diffHours > 0) return `${diffHours}h ${diffMins % 60}m`
  return `${diffMins}m`
}

const getPnLColor = (value: number | undefined) => {
  if (!value) return 'neutral'
  return value >= 0 ? 'profit' : 'loss'
}

const getSideColor = (side: string) => {
  return side.toLowerCase() === 'buy' ? 'profit' : 'loss'
}

const getSideIcon = (side: string) => {
  return side.toLowerCase() === 'buy' ? '▲' : '▼'
}

const getSortIcon = (field: string) => {
  if (sortBy.value !== field) return '⇅'
  return sortOrder.value === 'asc' ? '↑' : '↓'
}

// Actions
const toggleSort = (field: 'executedAt' | 'symbol' | 'side' | 'quantity' | 'price' | 'pnl' | 'pnlPercent') => {
  if (sortBy.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = field
    sortOrder.value = 'desc'
  }
  // Note: This would need to be updated when tradesStore.setSortBy accepts these field types
  // For now, we'll handle sorting locally
}

const clearFilters = () => {
  filters.value = {
    symbol: '',
    side: '',
    dateFrom: '',
    dateTo: '',
    profitLoss: 'all',
    minPnl: '',
    maxPnl: ''
  }
  searchQuery.value = ''
}

const exportData = () => {
  const dataToExport = filteredTrades.value.map(trade => ({
    timestamp: trade.executedAt,
    symbol: trade.symbol,
    side: trade.side,
    quantity: trade.quantity,
    price: trade.price,
    pnl: trade.pnl || 0,
    pnlPercent: trade.pnlPercent || 0,
    commission: trade.commission,
    duration: calculateDuration(trade)
  }))

  if (exportFormat.value === 'csv') {
    exportToCsv(dataToExport)
  } else {
    exportToJson(dataToExport)
  }
}

const exportToCsv = (data: any[]) => {
  if (data.length === 0) return

  const headers = Object.keys(data[0])
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header]
        return typeof value === 'string' ? `"${value}"` : value
      }).join(',')
    )
  ].join('\n')

  const blob = new Blob([csvContent], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `trade-history-${new Date().toISOString().split('T')[0]}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

const exportToJson = (data: any[]) => {
  const jsonContent = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonContent], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `trade-history-${new Date().toISOString().split('T')[0]}.json`
  link.click()
  URL.revokeObjectURL(url)
}

const goToPage = (page: number) => {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
    tradesStore.goToPage(page)
  }
}

// Watch for filter changes to update store
watch([filters, sortBy, sortOrder], () => {
  tradesStore.setFilter({
    symbol: filters.value.symbol,
    startDate: filters.value.dateFrom ? new Date(filters.value.dateFrom).getTime() : undefined,
    endDate: filters.value.dateTo ? new Date(filters.value.dateTo).getTime() : undefined,
    profitable: filters.value.profitLoss === 'all' ? undefined : filters.value.profitLoss === 'profit',
    minPnl: filters.value.minPnl ? parseFloat(filters.value.minPnl) : undefined,
    maxPnl: filters.value.maxPnl ? parseFloat(filters.value.maxPnl) : undefined
  })
}, { deep: true })

// Load trades on mount
onMounted(() => {
  tradesStore.fetchTrades(1, itemsPerPage.value)
})
</script>

<template>
  <widget-container
    title="Trade History"
    :loading="isLoading"
    :error="hasError"
  >
    <template #header-actions>
      <div class="header-actions">
        <button 
          class="btn-secondary"
          @click="showFilters = !showFilters"
          :class="{ active: showFilters }"
        >
          <span class="icon">🔍</span>
          Filters
        </button>
        
        <div class="export-group">
          <select v-model="exportFormat" class="export-select">
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
          <button 
            class="btn-primary"
            @click="exportData"
            :disabled="filteredTrades.length === 0"
          >
            Export
          </button>
        </div>
      </div>
    </template>

    <div class="trade-history">
      <!-- Search Bar -->
      <div class="search-section">
        <div class="search-input">
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Search by symbol or trade ID..."
            class="search-field"
          >
          <span class="search-icon">🔍</span>
        </div>
        
        <div class="results-info">
          <span class="text-secondary">
            {{ filteredTrades.length }} of {{ totalTrades }} trades
          </span>
        </div>
      </div>

      <!-- Filters Panel -->
      <div v-if="showFilters" class="filters-panel">
        <div class="filters-grid">
          <div class="filter-group">
            <label>Symbol</label>
            <input
              v-model="filters.symbol"
              type="text"
              placeholder="e.g., BTC"
              class="filter-input"
            >
          </div>
          
          <div class="filter-group">
            <label>Side</label>
            <select v-model="filters.side" class="filter-select">
              <option value="">All</option>
              <option value="buy">Buy</option>
              <option value="sell">Sell</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label>From Date</label>
            <input
              v-model="filters.dateFrom"
              type="date"
              class="filter-input"
            >
          </div>
          
          <div class="filter-group">
            <label>To Date</label>
            <input
              v-model="filters.dateTo"
              type="date"
              class="filter-input"
            >
          </div>
          
          <div class="filter-group">
            <label>Profit/Loss</label>
            <select v-model="filters.profitLoss" class="filter-select">
              <option value="all">All</option>
              <option value="profit">Profit Only</option>
              <option value="loss">Loss Only</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label>Min P&L ($)</label>
            <input
              v-model="filters.minPnl"
              type="number"
              step="0.01"
              placeholder="0.00"
              class="filter-input"
            >
          </div>
          
          <div class="filter-group">
            <label>Max P&L ($)</label>
            <input
              v-model="filters.maxPnl"
              type="number"
              step="0.01"
              placeholder="1000.00"
              class="filter-input"
            >
          </div>
          
          <div class="filter-actions">
            <button class="btn-secondary" @click="clearFilters">
              Clear All
            </button>
          </div>
        </div>
      </div>

      <!-- Trade Table -->
      <div class="table-container">
        <div v-if="filteredTrades.length === 0" class="empty-state">
          <div class="empty-icon">📊</div>
          <p class="empty-text">No trades match your criteria</p>
        </div>

        <table v-else class="trades-table">
          <thead>
            <tr>
              <th class="sortable" @click="toggleSort('executedAt')">
                Timestamp {{ getSortIcon('executedAt') }}
              </th>
              <th class="sortable" @click="toggleSort('symbol')">
                Symbol {{ getSortIcon('symbol') }}
              </th>
              <th class="sortable" @click="toggleSort('side')">
                Side {{ getSortIcon('side') }}
              </th>
              <th class="sortable numeric" @click="toggleSort('quantity')">
                Quantity {{ getSortIcon('quantity') }}
              </th>
              <th class="sortable numeric" @click="toggleSort('price')">
                Price {{ getSortIcon('price') }}
              </th>
              <th class="sortable numeric" @click="toggleSort('pnl')">
                P&L {{ getSortIcon('pnl') }}
              </th>
              <th class="sortable numeric" @click="toggleSort('pnlPercent')">
                P&L % {{ getSortIcon('pnlPercent') }}
              </th>
              <th class="numeric">Duration</th>
            </tr>
          </thead>
          <tbody>
            <tr 
              v-for="trade in filteredTrades" 
              :key="trade.id" 
              :class="['trade-row', `pnl-${getPnLColor(trade.pnl)}`]"
            >
              <!-- Timestamp -->
              <td class="timestamp-cell">
                <div class="timestamp">
                  <div class="date">{{ formatDateTime(trade.executedAt).date }}</div>
                  <div class="time text-secondary">{{ formatDateTime(trade.executedAt).time }}</div>
                </div>
              </td>

              <!-- Symbol -->
              <td class="symbol-cell">
                <div class="symbol-badge">{{ trade.symbol }}</div>
              </td>

              <!-- Side -->
              <td class="side-cell">
                <div :class="['side-badge', getSideColor(trade.side)]">
                  <span class="side-icon">{{ getSideIcon(trade.side) }}</span>
                  {{ trade.side.toUpperCase() }}
                </div>
              </td>

              <!-- Quantity -->
              <td class="numeric-cell">
                {{ formatNumber(trade.quantity) }}
              </td>

              <!-- Price -->
              <td class="numeric-cell">
                {{ formatCurrency(trade.price) }}
              </td>

              <!-- P&L -->
              <td :class="['numeric-cell', 'pnl-cell', getPnLColor(trade.pnl)]">
                <strong>{{ trade.pnl ? formatCurrency(trade.pnl) : '—' }}</strong>
              </td>

              <!-- P&L % -->
              <td :class="['numeric-cell', 'pnl-cell', getPnLColor(trade.pnlPercent)]">
                <strong>{{ trade.pnlPercent ? formatPercent(trade.pnlPercent) : '—' }}</strong>
              </td>

              <!-- Duration -->
              <td class="numeric-cell duration-cell">
                {{ calculateDuration(trade) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="pagination">
        <button 
          class="pagination-btn"
          :disabled="currentPage === 1"
          @click="goToPage(currentPage - 1)"
        >
          ‹ Previous
        </button>
        
        <div class="pagination-info">
          Page {{ currentPage }} of {{ totalPages }}
        </div>
        
        <button 
          class="pagination-btn"
          :disabled="currentPage === totalPages"
          @click="goToPage(currentPage + 1)"
        >
          Next ›
        </button>
      </div>
    </div>
  </widget-container>
</template>

<style scoped>
.trade-history {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-lg);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-md);
}

.btn-primary,
.btn-secondary {
  padding: var(--trading-spacing-xs) var(--trading-spacing-md);
  border-radius: var(--trading-radius-md);
  border: 1px solid var(--trading-border);
  background: var(--trading-bg-tertiary);
  color: var(--trading-text-primary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-xs);
}

.btn-primary {
  background: linear-gradient(135deg, var(--trading-accent-blue), #2980b9);
  border-color: var(--trading-accent-blue);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #2980b9, #2471a3);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary:hover {
  background: var(--trading-bg-hover);
  border-color: var(--trading-border-light);
}

.btn-secondary.active {
  background: var(--trading-accent-blue);
  border-color: var(--trading-accent-blue);
  color: white;
}

.export-group {
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-xs);
}

.export-select {
  padding: var(--trading-spacing-xs) var(--trading-spacing-sm);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  background: var(--trading-bg-tertiary);
  color: var(--trading-text-primary);
  font-size: 0.875rem;
}

.search-section {
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-lg);
  padding: var(--trading-spacing-md);
  background: var(--trading-bg-tertiary);
  border-radius: var(--trading-radius-md);
  border: 1px solid var(--trading-border);
}

.search-input {
  flex: 1;
  position: relative;
}

.search-field {
  width: 100%;
  padding: var(--trading-spacing-sm) var(--trading-spacing-md);
  padding-left: 2.5rem;
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  background: var(--trading-bg-secondary);
  color: var(--trading-text-primary);
  font-size: 0.875rem;
}

.search-field:focus {
  outline: none;
  border-color: var(--trading-accent-blue);
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.search-icon {
  position: absolute;
  left: var(--trading-spacing-sm);
  top: 50%;
  transform: translateY(-50%);
  color: var(--trading-text-tertiary);
}

.results-info {
  white-space: nowrap;
  color: var(--trading-text-secondary);
  font-size: 0.875rem;
}

.filters-panel {
  padding: var(--trading-spacing-lg);
  background: var(--trading-bg-tertiary);
  border-radius: var(--trading-radius-md);
  border: 1px solid var(--trading-border);
}

.filters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--trading-spacing-md);
  align-items: end;
}

.filter-group {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-xs);
}

.filter-group label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--trading-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.filter-input,
.filter-select {
  padding: var(--trading-spacing-sm) var(--trading-spacing-md);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  background: var(--trading-bg-secondary);
  color: var(--trading-text-primary);
  font-size: 0.875rem;
}

.filter-input:focus,
.filter-select:focus {
  outline: none;
  border-color: var(--trading-accent-blue);
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.filter-actions {
  display: flex;
  align-items: flex-end;
}

.table-container {
  overflow-x: auto;
  border-radius: var(--trading-radius-md);
  border: 1px solid var(--trading-border);
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

.trades-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.trades-table thead {
  background: var(--trading-bg-tertiary);
  border-bottom: 2px solid var(--trading-border);
}

.trades-table th {
  padding: var(--trading-spacing-md);
  text-align: left;
  color: var(--trading-text-secondary);
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.trades-table th.sortable {
  cursor: pointer;
  user-select: none;
  transition: color 0.2s ease;
}

.trades-table th.sortable:hover {
  color: var(--trading-text-primary);
}

.trades-table th.numeric {
  text-align: right;
}

.trade-row {
  border-bottom: 1px solid var(--trading-border);
  transition: background-color 0.2s ease;
}

.trade-row:hover {
  background-color: var(--trading-bg-hover);
}

.trade-row.pnl-profit {
  border-left: 3px solid var(--trading-profit);
}

.trade-row.pnl-loss {
  border-left: 3px solid var(--trading-loss);
}

.trade-row.pnl-neutral {
  border-left: 3px solid var(--trading-text-tertiary);
}

.trades-table td {
  padding: var(--trading-spacing-md);
  color: var(--trading-text-primary);
  vertical-align: middle;
}

.timestamp-cell .timestamp {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-xs);
}

.timestamp .date {
  font-weight: 600;
  font-size: 0.875rem;
}

.timestamp .time {
  font-size: 0.75rem;
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

.side-cell .side-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--trading-spacing-xs);
  padding: var(--trading-spacing-xs) var(--trading-spacing-sm);
  border-radius: var(--trading-radius-sm);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
}

.side-badge.profit {
  background: rgba(38, 194, 129, 0.1);
  color: var(--trading-profit);
  border: 1px solid rgba(38, 194, 129, 0.3);
}

.side-badge.loss {
  background: rgba(231, 76, 60, 0.1);
  color: var(--trading-loss);
  border: 1px solid rgba(231, 76, 60, 0.3);
}

.side-icon {
  font-size: 0.7rem;
}

.numeric-cell {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.pnl-cell.profit {
  color: var(--trading-profit);
}

.pnl-cell.loss {
  color: var(--trading-loss);
}

.duration-cell {
  font-family: var(--trading-font-mono);
  font-size: 0.8rem;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--trading-spacing-md);
  padding: var(--trading-spacing-md);
}

.pagination-btn {
  padding: var(--trading-spacing-sm) var(--trading-spacing-md);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  background: var(--trading-bg-tertiary);
  color: var(--trading-text-primary);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.pagination-btn:hover:not(:disabled) {
  background: var(--trading-bg-hover);
  border-color: var(--trading-border-light);
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pagination-info {
  font-size: 0.875rem;
  color: var(--trading-text-secondary);
  margin: 0 var(--trading-spacing-md);
}

/* Responsive design */
@media (max-width: 768px) {
  .search-section {
    flex-direction: column;
    align-items: stretch;
    gap: var(--trading-spacing-md);
  }

  .filters-grid {
    grid-template-columns: 1fr;
  }

  .header-actions {
    flex-direction: column;
    align-items: stretch;
    gap: var(--trading-spacing-sm);
  }

  .export-group {
    justify-content: center;
  }

  .trades-table {
    font-size: 0.8rem;
  }

  .trades-table th,
  .trades-table td {
    padding: var(--trading-spacing-sm);
  }

  .timestamp .date {
    font-size: 0.8rem;
  }

  .timestamp .time {
    font-size: 0.7rem;
  }
}

@media (max-width: 576px) {
  .trades-table {
    font-size: 0.75rem;
  }

  .symbol-badge {
    font-size: 0.75rem;
    padding: var(--trading-spacing-xs) var(--trading-spacing-sm);
  }

  .side-badge {
    font-size: 0.7rem;
  }

  .pagination {
    flex-direction: column;
    gap: var(--trading-spacing-sm);
  }

  .pagination-info {
    margin: 0;
  }
}
</style>