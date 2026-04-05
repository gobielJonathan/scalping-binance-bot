<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { usePositionsStore, usePortfolioStore } from '@/stores'
import type { Position } from '@/types/api'

interface Props {
  positionId: string | null
  isOpen: boolean
}

interface Emits {
  (e: 'close'): void
  (e: 'position-action', action: string, positionId: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const positionsStore = usePositionsStore()
const portfolioStore = usePortfolioStore()

// Local state
const isClosing = ref(false)
const showConfirmClose = ref(false)
const showModifyStop = ref(false)
const showModifyTakeProfit = ref(false)
const newStopLoss = ref('')
const newTakeProfit = ref('')

// Real-time update interval
let updateInterval: number | null = null

// Computed properties
const position = computed(() => 
  props.positionId ? positionsStore.getPositionById(props.positionId) : null
)

const isLoading = computed(() => positionsStore.isLoading)

// Position metrics
const currentValue = computed(() => {
  if (!position.value) return 0
  return position.value.quantity * position.value.currentPrice
})

const investedAmount = computed(() => {
  if (!position.value) return 0
  return position.value.quantity * position.value.entryPrice
})

const totalFees = computed(() => {
  // This would come from trade history related to this position
  // For now, we'll estimate based on typical trading fees
  if (!position.value) return 0
  return investedAmount.value * 0.001 // 0.1% estimated fee
})

const netPnl = computed(() => {
  if (!position.value) return 0
  return position.value.pnl - totalFees.value
})

const netPnlPercent = computed(() => {
  if (!position.value || investedAmount.value === 0) return 0
  return (netPnl.value / investedAmount.value) * 100
})

// Risk metrics (mock data - would come from backend)
const riskMetrics = computed(() => {
  if (!position.value) return null
  
  const currentPrice = position.value.currentPrice
  const entryPrice = position.value.entryPrice
  
  return {
    stopLoss: entryPrice * 0.95, // 5% stop loss
    takeProfit: entryPrice * 1.15, // 15% take profit
    maxAdverseExcursion: Math.min(currentPrice, entryPrice * 0.98), // 2% MAE
    maxFavorableExcursion: Math.max(currentPrice, entryPrice * 1.05), // 5% MFE
    riskRewardRatio: 3.0 // 1:3 ratio
  }
})

// Position timeline (mock data)
const positionTimeline = computed(() => [
  {
    timestamp: position.value?.createdAt || '',
    event: 'Position Opened',
    price: position.value?.entryPrice || 0,
    quantity: position.value?.quantity || 0,
    description: 'Initial position opened'
  },
  {
    timestamp: new Date().toISOString(),
    event: 'Current Price',
    price: position.value?.currentPrice || 0,
    quantity: position.value?.quantity || 0,
    description: 'Live market price'
  }
])

// Chart data for mini price chart
const chartData = computed(() => {
  if (!position.value) return []
  
  // Mock price movement data
  const entryPrice = position.value.entryPrice
  const currentPrice = position.value.currentPrice
  const points = 20
  const priceRange = Math.abs(currentPrice - entryPrice)
  
  return Array.from({ length: points }, (_, i) => {
    const progress = i / (points - 1)
    const noise = (Math.random() - 0.5) * priceRange * 0.1
    const price = entryPrice + (currentPrice - entryPrice) * progress + noise
    return {
      time: new Date(Date.now() - (points - i) * 60000).toISOString(),
      price: price
    }
  })
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
  return new Date(timestamp).toLocaleString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const getPnLColor = (value: number) => {
  return value >= 0 ? 'profit' : 'loss'
}

const getPositionAge = () => {
  if (!position.value) return ''
  const createdAt = new Date(position.value.createdAt)
  const now = new Date()
  const diffMs = now.getTime() - createdAt.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h`
  if (diffHours > 0) return `${diffHours}h ${diffMins % 60}m`
  return `${diffMins}m`
}

// Actions
const closeModal = () => {
  emit('close')
}

const confirmClosePosition = () => {
  if (!position.value) return
  
  isClosing.value = true
  emit('position-action', 'close', position.value.id)
  
  // Simulate API call
  setTimeout(() => {
    isClosing.value = false
    showConfirmClose.value = false
    closeModal()
  }, 1500)
}

const modifyStopLoss = () => {
  if (!position.value || !newStopLoss.value) return
  
  emit('position-action', 'modify-stop', position.value.id)
  showModifyStop.value = false
  newStopLoss.value = ''
}

const modifyTakeProfit = () => {
  if (!position.value || !newTakeProfit.value) return
  
  emit('position-action', 'modify-take-profit', position.value.id)
  showModifyTakeProfit.value = false
  newTakeProfit.value = ''
}

// Start real-time updates when modal opens
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    updateInterval = setInterval(() => {
      if (props.positionId) {
        positionsStore.fetchPositions()
      }
    }, 5000) // Update every 5 seconds
  } else {
    if (updateInterval) {
      clearInterval(updateInterval)
      updateInterval = null
    }
  }
})

// Cleanup on unmount
onUnmounted(() => {
  if (updateInterval) {
    clearInterval(updateInterval)
  }
})

// Handle escape key
const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeModal()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscape)
})
</script>

<template>
  <!-- Modal Backdrop -->
  <div 
    v-if="isOpen" 
    class="modal-backdrop"
    @click="closeModal"
  >
    <!-- Modal Content -->
    <div 
      class="modal-content"
      @click.stop
    >
      <!-- Modal Header -->
      <div class="modal-header">
        <div class="header-info">
          <h3 class="modal-title">
            Position Details
            <span v-if="position" class="symbol-badge">{{ position.symbol }}</span>
          </h3>
          <div v-if="position" class="position-age">
            Opened {{ getPositionAge() }} ago
          </div>
        </div>
        
        <button class="close-button" @click="closeModal">
          ✕
        </button>
      </div>

      <!-- Modal Body -->
      <div class="modal-body">
        <div v-if="!position" class="loading-state">
          <div class="spinner"></div>
          <p>Loading position details...</p>
        </div>

        <div v-else class="position-details">
          <!-- Real-time P&L Section -->
          <div class="pnl-section">
            <div class="pnl-card">
              <div class="pnl-header">
                <h4>Real-time P&L</h4>
                <div class="live-indicator">
                  <span class="pulse"></span>
                  LIVE
                </div>
              </div>
              
              <div class="pnl-metrics">
                <div class="pnl-main">
                  <div :class="['pnl-amount', getPnLColor(position.pnl)]">
                    {{ formatCurrency(position.pnl) }}
                  </div>
                  <div :class="['pnl-percent', getPnLColor(position.pnlPercent)]">
                    {{ formatPercent(position.pnlPercent) }}
                  </div>
                </div>
                
                <div class="pnl-breakdown">
                  <div class="metric">
                    <span class="label">Net P&L:</span>
                    <span :class="['value', getPnLColor(netPnl)]">
                      {{ formatCurrency(netPnl) }}
                    </span>
                  </div>
                  <div class="metric">
                    <span class="label">Est. Fees:</span>
                    <span class="value">{{ formatCurrency(totalFees) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Position Metrics Grid -->
          <div class="metrics-grid">
            <!-- Entry Information -->
            <div class="metric-card">
              <h5>Entry Information</h5>
              <div class="metric-content">
                <div class="metric-row">
                  <span class="label">Entry Price:</span>
                  <span class="value">{{ formatCurrency(position.entryPrice) }}</span>
                </div>
                <div class="metric-row">
                  <span class="label">Quantity:</span>
                  <span class="value">{{ formatNumber(position.quantity) }}</span>
                </div>
                <div class="metric-row">
                  <span class="label">Invested:</span>
                  <span class="value">{{ formatCurrency(investedAmount) }}</span>
                </div>
              </div>
            </div>

            <!-- Current Information -->
            <div class="metric-card">
              <h5>Current Status</h5>
              <div class="metric-content">
                <div class="metric-row">
                  <span class="label">Current Price:</span>
                  <span class="value">{{ formatCurrency(position.currentPrice) }}</span>
                </div>
                <div class="metric-row">
                  <span class="label">Current Value:</span>
                  <span class="value">{{ formatCurrency(currentValue) }}</span>
                </div>
                <div class="metric-row">
                  <span class="label">Position Age:</span>
                  <span class="value">{{ getPositionAge() }}</span>
                </div>
              </div>
            </div>

            <!-- Risk Metrics -->
            <div v-if="riskMetrics" class="metric-card">
              <h5>Risk Management</h5>
              <div class="metric-content">
                <div class="metric-row">
                  <span class="label">Stop Loss:</span>
                  <span class="value loss">{{ formatCurrency(riskMetrics.stopLoss) }}</span>
                </div>
                <div class="metric-row">
                  <span class="label">Take Profit:</span>
                  <span class="value profit">{{ formatCurrency(riskMetrics.takeProfit) }}</span>
                </div>
                <div class="metric-row">
                  <span class="label">Risk/Reward:</span>
                  <span class="value">1:{{ riskMetrics.riskRewardRatio.toFixed(1) }}</span>
                </div>
              </div>
            </div>

            <!-- Max Excursion -->
            <div v-if="riskMetrics" class="metric-card">
              <h5>Max Excursion</h5>
              <div class="metric-content">
                <div class="metric-row">
                  <span class="label">Max Adverse:</span>
                  <span class="value loss">{{ formatCurrency(riskMetrics.maxAdverseExcursion) }}</span>
                </div>
                <div class="metric-row">
                  <span class="label">Max Favorable:</span>
                  <span class="value profit">{{ formatCurrency(riskMetrics.maxFavorableExcursion) }}</span>
                </div>
                <div class="metric-row">
                  <span class="label">Current:</span>
                  <span class="value">{{ formatCurrency(position.currentPrice) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Mini Chart Section -->
          <div class="chart-section">
            <h5>Price Movement</h5>
            <div class="mini-chart">
              <div class="chart-container">
                <svg width="100%" height="120" class="price-chart">
                  <!-- Chart background -->
                  <defs>
                    <linearGradient id="priceGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" :style="`stop-color:${position.pnl >= 0 ? 'var(--trading-profit)' : 'var(--trading-loss)'};stop-opacity:0.3`" />
                      <stop offset="100%" :style="`stop-color:${position.pnl >= 0 ? 'var(--trading-profit)' : 'var(--trading-loss)'};stop-opacity:0.05`" />
                    </linearGradient>
                  </defs>
                  
                  <!-- Entry price line -->
                  <line 
                    x1="0" 
                    y1="60" 
                    x2="100%" 
                    y2="60" 
                    stroke="var(--trading-accent-blue)" 
                    stroke-width="2"
                    stroke-dasharray="5,5"
                    opacity="0.7"
                  />
                  
                  <!-- Price line (simplified) -->
                  <polyline
                    v-if="position"
                    :points="chartData.map((point, index) => `${(index / (chartData.length - 1)) * 100}%,${60 + (position!.entryPrice - point.price) / position!.entryPrice * 200}`).join(' ')"
                    fill="none"
                    :stroke="position.pnl >= 0 ? 'var(--trading-profit)' : 'var(--trading-loss)'"
                    stroke-width="2"
                  />
                  
                  <!-- Fill area -->
                  <polygon
                    v-if="position"
                    :points="`0,60 ${chartData.map((point, index) => `${(index / (chartData.length - 1)) * 100}%,${60 + (position!.entryPrice - point.price) / position!.entryPrice * 200}`).join(' ')} 100%,60`"
                    fill="url(#priceGradient)"
                  />
                </svg>
                
                <div class="chart-labels">
                  <div class="entry-label">
                    Entry: {{ formatCurrency(position.entryPrice) }}
                  </div>
                  <div class="current-label">
                    Current: {{ formatCurrency(position.currentPrice) }}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Position Timeline -->
          <div class="timeline-section">
            <h5>Position History</h5>
            <div class="timeline">
              <div 
                v-for="(event, index) in positionTimeline" 
                :key="index"
                class="timeline-item"
              >
                <div class="timeline-marker"></div>
                <div class="timeline-content">
                  <div class="timeline-header">
                    <span class="event-name">{{ event.event }}</span>
                    <span class="event-time">{{ formatDateTime(event.timestamp) }}</span>
                  </div>
                  <div class="timeline-details">
                    <span class="detail">Price: {{ formatCurrency(event.price) }}</span>
                    <span class="detail">Qty: {{ formatNumber(event.quantity) }}</span>
                  </div>
                  <div class="timeline-description">{{ event.description }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Footer with Actions -->
      <div class="modal-footer">
        <div class="footer-actions">
          <button 
            class="btn-secondary"
            @click="showModifyStop = true"
          >
            Modify Stop Loss
          </button>
          
          <button 
            class="btn-secondary"
            @click="showModifyTakeProfit = true"
          >
            Modify Take Profit
          </button>
          
          <button 
            class="btn-danger"
            @click="showConfirmClose = true"
            :disabled="isClosing"
          >
            <span v-if="isClosing" class="spinner-small"></span>
            {{ isClosing ? 'Closing...' : 'Close Position' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Confirmation Dialogs -->
    <!-- Close Position Confirmation -->
    <div v-if="showConfirmClose" class="confirmation-dialog" @click.stop>
      <div class="dialog-content">
        <h4>Close Position</h4>
        <p>Are you sure you want to close this position?</p>
        <div class="dialog-info">
          <div>Current P&L: <span :class="getPnLColor(position?.pnl || 0)">{{ position ? formatCurrency(position.pnl) : '' }}</span></div>
        </div>
        <div class="dialog-actions">
          <button class="btn-secondary" @click="showConfirmClose = false">Cancel</button>
          <button class="btn-danger" @click="confirmClosePosition">Close Position</button>
        </div>
      </div>
    </div>

    <!-- Modify Stop Loss Dialog -->
    <div v-if="showModifyStop" class="confirmation-dialog" @click.stop>
      <div class="dialog-content">
        <h4>Modify Stop Loss</h4>
        <p>Enter new stop loss price:</p>
        <input 
          v-model="newStopLoss"
          type="number"
          step="0.01"
          :placeholder="riskMetrics ? formatCurrency(riskMetrics.stopLoss) : ''"
          class="dialog-input"
        >
        <div class="dialog-actions">
          <button class="btn-secondary" @click="showModifyStop = false">Cancel</button>
          <button class="btn-primary" @click="modifyStopLoss">Update</button>
        </div>
      </div>
    </div>

    <!-- Modify Take Profit Dialog -->
    <div v-if="showModifyTakeProfit" class="confirmation-dialog" @click.stop>
      <div class="dialog-content">
        <h4>Modify Take Profit</h4>
        <p>Enter new take profit price:</p>
        <input 
          v-model="newTakeProfit"
          type="number"
          step="0.01"
          :placeholder="riskMetrics ? formatCurrency(riskMetrics.takeProfit) : ''"
          class="dialog-input"
        >
        <div class="dialog-actions">
          <button class="btn-secondary" @click="showModifyTakeProfit = false">Cancel</button>
          <button class="btn-primary" @click="modifyTakeProfit">Update</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--trading-z-modal);
  padding: var(--trading-spacing-lg);
}

.modal-content {
  background: var(--trading-bg-primary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-lg);
  box-shadow: var(--trading-shadow-lg);
  width: 100%;
  max-width: 900px;
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--trading-spacing-lg);
  border-bottom: 1px solid var(--trading-border);
}

.header-info {
  flex: 1;
}

.modal-title {
  margin: 0;
  color: var(--trading-text-primary);
  font-size: 1.5rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-md);
}

.symbol-badge {
  display: inline-block;
  padding: var(--trading-spacing-xs) var(--trading-spacing-md);
  background: linear-gradient(135deg, rgba(52, 152, 219, 0.1), rgba(52, 152, 219, 0.05));
  border: 1px solid rgba(52, 152, 219, 0.3);
  border-radius: var(--trading-radius-sm);
  font-weight: 700;
  font-size: 1rem;
}

.position-age {
  color: var(--trading-text-secondary);
  font-size: 0.875rem;
  margin-top: var(--trading-spacing-xs);
}

.close-button {
  width: 32px;
  height: 32px;
  border: none;
  background: var(--trading-bg-tertiary);
  color: var(--trading-text-secondary);
  border-radius: var(--trading-radius-sm);
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
}

.close-button:hover {
  background: var(--trading-bg-hover);
  color: var(--trading-text-primary);
}

.modal-body {
  padding: var(--trading-spacing-lg);
  flex: 1;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--trading-spacing-xl);
  color: var(--trading-text-secondary);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--trading-border);
  border-top: 3px solid var(--trading-accent-blue);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: var(--trading-spacing-md);
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.position-details {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-xl);
}

.pnl-section {
  background: var(--trading-bg-tertiary);
  border-radius: var(--trading-radius-md);
  padding: var(--trading-spacing-lg);
  border: 1px solid var(--trading-border);
}

.pnl-card .pnl-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--trading-spacing-md);
}

.pnl-header h4 {
  margin: 0;
  color: var(--trading-text-primary);
  font-size: 1.1rem;
}

.live-indicator {
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-xs);
  color: var(--trading-profit);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.pulse {
  width: 8px;
  height: 8px;
  background: var(--trading-profit);
  border-radius: 50%;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(1.2); }
  100% { opacity: 1; transform: scale(1); }
}

.pnl-metrics {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-md);
}

.pnl-main {
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-lg);
}

.pnl-amount {
  font-size: 2rem;
  font-weight: 700;
}

.pnl-amount.profit {
  color: var(--trading-profit);
}

.pnl-amount.loss {
  color: var(--trading-loss);
}

.pnl-percent {
  font-size: 1.5rem;
  font-weight: 600;
}

.pnl-percent.profit {
  color: var(--trading-profit);
}

.pnl-percent.loss {
  color: var(--trading-loss);
}

.pnl-breakdown {
  display: flex;
  gap: var(--trading-spacing-lg);
}

.pnl-breakdown .metric {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-xs);
}

.pnl-breakdown .label {
  font-size: 0.75rem;
  color: var(--trading-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.pnl-breakdown .value {
  font-size: 1rem;
  font-weight: 600;
}

.pnl-breakdown .value.profit {
  color: var(--trading-profit);
}

.pnl-breakdown .value.loss {
  color: var(--trading-loss);
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--trading-spacing-lg);
}

.metric-card {
  background: var(--trading-bg-tertiary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  padding: var(--trading-spacing-lg);
}

.metric-card h5 {
  margin: 0 0 var(--trading-spacing-md) 0;
  color: var(--trading-text-primary);
  font-size: 1rem;
  font-weight: 600;
}

.metric-content {
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
  color: var(--trading-text-secondary);
  font-size: 0.875rem;
}

.metric-row .value {
  color: var(--trading-text-primary);
  font-weight: 600;
  font-size: 0.875rem;
}

.metric-row .value.profit {
  color: var(--trading-profit);
}

.metric-row .value.loss {
  color: var(--trading-loss);
}

.chart-section {
  background: var(--trading-bg-tertiary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  padding: var(--trading-spacing-lg);
}

.chart-section h5 {
  margin: 0 0 var(--trading-spacing-md) 0;
  color: var(--trading-text-primary);
  font-size: 1rem;
  font-weight: 600;
}

.mini-chart {
  position: relative;
}

.chart-container {
  position: relative;
  background: var(--trading-bg-secondary);
  border-radius: var(--trading-radius-sm);
  overflow: hidden;
}

.price-chart {
  display: block;
}

.chart-labels {
  position: absolute;
  top: var(--trading-spacing-sm);
  left: var(--trading-spacing-sm);
  right: var(--trading-spacing-sm);
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  font-weight: 600;
}

.entry-label {
  color: var(--trading-accent-blue);
}

.current-label {
  color: var(--trading-text-primary);
}

.timeline-section {
  background: var(--trading-bg-tertiary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  padding: var(--trading-spacing-lg);
}

.timeline-section h5 {
  margin: 0 0 var(--trading-spacing-md) 0;
  color: var(--trading-text-primary);
  font-size: 1rem;
  font-weight: 600;
}

.timeline {
  position: relative;
  padding-left: var(--trading-spacing-lg);
}

.timeline::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--trading-border);
}

.timeline-item {
  position: relative;
  margin-bottom: var(--trading-spacing-lg);
}

.timeline-marker {
  position: absolute;
  left: -12px;
  top: 4px;
  width: 12px;
  height: 12px;
  background: var(--trading-accent-blue);
  border-radius: 50%;
  border: 2px solid var(--trading-bg-tertiary);
}

.timeline-content {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-xs);
}

.timeline-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.event-name {
  font-weight: 600;
  color: var(--trading-text-primary);
  font-size: 0.875rem;
}

.event-time {
  color: var(--trading-text-tertiary);
  font-size: 0.75rem;
  font-family: var(--trading-font-mono);
}

.timeline-details {
  display: flex;
  gap: var(--trading-spacing-md);
}

.timeline-details .detail {
  color: var(--trading-text-secondary);
  font-size: 0.8rem;
}

.timeline-description {
  color: var(--trading-text-tertiary);
  font-size: 0.8rem;
}

.modal-footer {
  padding: var(--trading-spacing-lg);
  border-top: 1px solid var(--trading-border);
  background: var(--trading-bg-secondary);
}

.footer-actions {
  display: flex;
  gap: var(--trading-spacing-md);
  justify-content: flex-end;
}

.btn-primary,
.btn-secondary,
.btn-danger {
  padding: var(--trading-spacing-sm) var(--trading-spacing-lg);
  border-radius: var(--trading-radius-md);
  border: 1px solid;
  font-size: 0.875rem;
  font-weight: 600;
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

.btn-primary:hover {
  background: linear-gradient(135deg, #2980b9, #2471a3);
}

.btn-secondary {
  background: var(--trading-bg-tertiary);
  border-color: var(--trading-border);
  color: var(--trading-text-primary);
}

.btn-secondary:hover {
  background: var(--trading-bg-hover);
  border-color: var(--trading-border-light);
}

.btn-danger {
  background: linear-gradient(135deg, var(--trading-loss), #c0392b);
  border-color: var(--trading-loss);
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background: linear-gradient(135deg, #c0392b, #a93226);
}

.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top: 2px solid white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.confirmation-dialog {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--trading-bg-primary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-lg);
  box-shadow: var(--trading-shadow-lg);
  z-index: calc(var(--trading-z-modal) + 10);
}

.dialog-content {
  padding: var(--trading-spacing-xl);
  min-width: 300px;
}

.dialog-content h4 {
  margin: 0 0 var(--trading-spacing-md) 0;
  color: var(--trading-text-primary);
  font-size: 1.2rem;
}

.dialog-content p {
  margin: 0 0 var(--trading-spacing-md) 0;
  color: var(--trading-text-secondary);
}

.dialog-info {
  background: var(--trading-bg-tertiary);
  padding: var(--trading-spacing-md);
  border-radius: var(--trading-radius-sm);
  margin-bottom: var(--trading-spacing-lg);
  border: 1px solid var(--trading-border);
}

.dialog-input {
  width: 100%;
  padding: var(--trading-spacing-sm) var(--trading-spacing-md);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  background: var(--trading-bg-secondary);
  color: var(--trading-text-primary);
  font-size: 0.875rem;
  margin-bottom: var(--trading-spacing-lg);
}

.dialog-input:focus {
  outline: none;
  border-color: var(--trading-accent-blue);
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.dialog-actions {
  display: flex;
  gap: var(--trading-spacing-md);
  justify-content: flex-end;
}

/* Responsive design */
@media (max-width: 768px) {
  .modal-backdrop {
    padding: var(--trading-spacing-sm);
  }

  .modal-content {
    max-height: 95vh;
  }

  .metrics-grid {
    grid-template-columns: 1fr;
  }

  .pnl-main {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--trading-spacing-sm);
  }

  .pnl-breakdown {
    flex-direction: column;
    gap: var(--trading-spacing-md);
  }

  .footer-actions {
    flex-direction: column;
  }

  .timeline-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--trading-spacing-xs);
  }
}

@media (max-width: 576px) {
  .modal-header {
    padding: var(--trading-spacing-md);
  }

  .modal-body {
    padding: var(--trading-spacing-md);
  }

  .modal-footer {
    padding: var(--trading-spacing-md);
  }

  .modal-title {
    font-size: 1.25rem;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--trading-spacing-sm);
  }

  .pnl-amount {
    font-size: 1.5rem;
  }

  .pnl-percent {
    font-size: 1.2rem;
  }
}
</style>