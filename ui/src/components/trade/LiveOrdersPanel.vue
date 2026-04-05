<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useTradesStore } from '@/stores'
import WidgetContainer from '../layout/WidgetContainer.vue'
import type { Order, OrderStatus, OrderSide, OrderType } from '@/types/api'

interface LiveOrder extends Order {
  estimatedFillTime?: string
  slippageEstimate?: number
  avgFillPrice?: number
}

interface OrderModification {
  orderId: string
  newPrice?: number
  newQuantity?: number
  newStopPrice?: number
}

interface Props {
  compact?: boolean
  showHistory?: boolean
  maxItems?: number
}

const props = withDefaults(defineProps<Props>(), {
  compact: false,
  showHistory: true,
  maxItems: 50
})

const emit = defineEmits<{
  'order-cancel': [orderId: string]
  'order-modify': [modification: OrderModification]
  'order-place': [order: Partial<Order>]
}>()

const tradesStore = useTradesStore()

// Local state
const orders = ref<LiveOrder[]>([])
const orderHistory = ref<LiveOrder[]>([])
const selectedTab = ref<'pending' | 'filled' | 'history'>('pending')
const showModifyDialog = ref(false)
const showCancelDialog = ref(false)
const selectedOrder = ref<LiveOrder | null>(null)
const modifyForm = ref({
  price: '',
  quantity: '',
  stopPrice: ''
})

// Real-time update interval
let updateInterval: number | null = null

// Mock data for orders
const mockOrders = ref<LiveOrder[]>([
  {
    id: '1',
    symbol: 'BTC/USD',
    side: 'buy' as OrderSide,
    type: 'limit' as OrderType,
    quantity: 0.5,
    price: 44800,
    filledQuantity: 0,
    status: 'open' as OrderStatus,
    commission: 0,
    createdAt: new Date(Date.now() - 300000).toISOString(),
    updatedAt: new Date(Date.now() - 300000).toISOString(),
    estimatedFillTime: '2-5 minutes',
    slippageEstimate: 0.02
  },
  {
    id: '2',
    symbol: 'ETH/USD',
    side: 'sell' as OrderSide,
    type: 'stop' as OrderType,
    quantity: 2.0,
    stopPrice: 2800,
    filledQuantity: 0,
    status: 'open' as OrderStatus,
    commission: 0,
    createdAt: new Date(Date.now() - 600000).toISOString(),
    updatedAt: new Date(Date.now() - 600000).toISOString(),
    estimatedFillTime: 'Market dependent',
    slippageEstimate: 0.05
  },
  {
    id: '3',
    symbol: 'BTC/USD',
    side: 'buy' as OrderSide,
    type: 'market' as OrderType,
    quantity: 0.25,
    filledQuantity: 0.15,
    status: 'partially_filled' as OrderStatus,
    commission: 2.75,
    createdAt: new Date(Date.now() - 120000).toISOString(),
    updatedAt: new Date(Date.now() - 60000).toISOString(),
    avgFillPrice: 45125,
    estimatedFillTime: 'Immediate',
    slippageEstimate: 0.01
  }
])

const filledOrders = ref<LiveOrder[]>([
  {
    id: '4',
    symbol: 'ETH/USD',
    side: 'buy' as OrderSide,
    type: 'limit' as OrderType,
    quantity: 1.5,
    price: 2850,
    filledQuantity: 1.5,
    filledPrice: 2852,
    status: 'filled' as OrderStatus,
    commission: 4.28,
    createdAt: new Date(Date.now() - 900000).toISOString(),
    updatedAt: new Date(Date.now() - 840000).toISOString(),
    avgFillPrice: 2852,
    slippageEstimate: 0.07
  },
  {
    id: '5',
    symbol: 'BTC/USD',
    side: 'sell' as OrderSide,
    type: 'limit' as OrderType,
    quantity: 0.3,
    price: 45500,
    filledQuantity: 0.3,
    filledPrice: 45485,
    status: 'filled' as OrderStatus,
    commission: 4.10,
    createdAt: new Date(Date.now() - 1800000).toISOString(),
    updatedAt: new Date(Date.now() - 1740000).toISOString(),
    avgFillPrice: 45485,
    slippageEstimate: -0.03
  }
])

// Computed properties
const pendingOrders = computed(() => 
  mockOrders.value.filter(order => 
    ['pending', 'open', 'partially_filled'].includes(order.status)
  )
)

const completedOrders = computed(() => 
  filledOrders.value.filter(order => 
    ['filled', 'canceled', 'rejected', 'expired'].includes(order.status)
  )
)

const currentOrders = computed(() => {
  switch (selectedTab.value) {
    case 'pending':
      return pendingOrders.value
    case 'filled':
      return completedOrders.value
    case 'history':
      return [...pendingOrders.value, ...completedOrders.value].sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
    default:
      return pendingOrders.value
  }
})

const totalPendingValue = computed(() => 
  pendingOrders.value.reduce((sum, order) => 
    sum + (order.quantity * (order.price || 0)), 0
  )
)

const totalFilledValue = computed(() => 
  completedOrders.value.reduce((sum, order) => 
    sum + (order.filledQuantity * (order.avgFillPrice || order.filledPrice || order.price || 0)), 0
  )
)

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
  return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(3)}%`
}

const formatDateTime = (timestamp: string) => {
  const date = new Date(timestamp)
  return {
    date: date.toLocaleDateString('en-US', { 
      month: '2-digit', 
      day: '2-digit' 
    }),
    time: date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    })
  }
}

const getOrderTypeColor = (type: OrderType) => {
  const colors = {
    market: 'var(--trading-accent-blue)',
    limit: 'var(--trading-profit)',
    stop: 'var(--trading-warning)',
    stop_limit: 'var(--trading-accent-orange)'
  }
  return colors[type] || colors.market
}

const getStatusColor = (status: OrderStatus) => {
  const colors = {
    pending: 'var(--trading-warning)',
    open: 'var(--trading-accent-blue)',
    partially_filled: 'var(--trading-accent-orange)',
    filled: 'var(--trading-profit)',
    canceled: 'var(--trading-text-tertiary)',
    rejected: 'var(--trading-loss)',
    expired: 'var(--trading-text-tertiary)'
  }
  return colors[status] || colors.pending
}

const getSideColor = (side: OrderSide) => {
  return side === 'buy' ? 'var(--trading-profit)' : 'var(--trading-loss)'
}

const getSideIcon = (side: OrderSide) => {
  return side === 'buy' ? '▲' : '▼'
}

const getProgressPercent = (order: LiveOrder) => {
  if (order.quantity === 0) return 0
  return (order.filledQuantity / order.quantity) * 100
}

const canModifyOrder = (order: LiveOrder) => {
  return ['open', 'partially_filled'].includes(order.status) && 
         ['limit', 'stop', 'stop_limit'].includes(order.type)
}

const canCancelOrder = (order: LiveOrder) => {
  return ['pending', 'open', 'partially_filled'].includes(order.status)
}

// Actions
const selectTab = (tab: typeof selectedTab.value) => {
  selectedTab.value = tab
}

const showModifyOrderDialog = (order: LiveOrder) => {
  if (!canModifyOrder(order)) return
  
  selectedOrder.value = order
  modifyForm.value = {
    price: order.price?.toString() || '',
    quantity: order.quantity.toString(),
    stopPrice: order.stopPrice?.toString() || ''
  }
  showModifyDialog.value = true
}

const showCancelOrderDialog = (order: LiveOrder) => {
  if (!canCancelOrder(order)) return
  
  selectedOrder.value = order
  showCancelDialog.value = true
}

const confirmModifyOrder = () => {
  if (!selectedOrder.value) return
  
  const modification: OrderModification = {
    orderId: selectedOrder.value.id,
    newPrice: modifyForm.value.price ? parseFloat(modifyForm.value.price) : undefined,
    newQuantity: modifyForm.value.quantity ? parseFloat(modifyForm.value.quantity) : undefined,
    newStopPrice: modifyForm.value.stopPrice ? parseFloat(modifyForm.value.stopPrice) : undefined
  }
  
  emit('order-modify', modification)
  
  // Update the order locally (would be replaced by API response)
  const orderIndex = mockOrders.value.findIndex(o => o.id === selectedOrder.value!.id)
  if (orderIndex !== -1 && mockOrders.value[orderIndex]) {
    if (modification.newPrice) mockOrders.value[orderIndex]!.price = modification.newPrice
    if (modification.newQuantity) mockOrders.value[orderIndex]!.quantity = modification.newQuantity
    if (modification.newStopPrice) mockOrders.value[orderIndex]!.stopPrice = modification.newStopPrice
    mockOrders.value[orderIndex]!.updatedAt = new Date().toISOString()
  }
  
  closeModifyDialog()
}

const confirmCancelOrder = () => {
  if (!selectedOrder.value) return
  
  emit('order-cancel', selectedOrder.value.id)
  
  // Remove order locally (would be replaced by API response)
  const orderIndex = mockOrders.value.findIndex(o => o.id === selectedOrder.value!.id)
  if (orderIndex !== -1 && mockOrders.value[orderIndex]) {
    mockOrders.value[orderIndex]!.status = 'canceled' as OrderStatus
    mockOrders.value[orderIndex]!.updatedAt = new Date().toISOString()
    
    // Move to completed orders
    filledOrders.value.unshift(mockOrders.value[orderIndex]!)
    mockOrders.value.splice(orderIndex, 1)
  }
  
  closeCancelDialog()
}

const closeModifyDialog = () => {
  showModifyDialog.value = false
  selectedOrder.value = null
  modifyForm.value = {
    price: '',
    quantity: '',
    stopPrice: ''
  }
}

const closeCancelDialog = () => {
  showCancelDialog.value = false
  selectedOrder.value = null
}

// Real-time updates simulation
const startRealTimeUpdates = () => {
  updateInterval = setInterval(() => {
    // Simulate order status updates
    mockOrders.value.forEach(order => {
      if (order.status === 'partially_filled' && Math.random() > 0.7) {
        // Simulate more fills
        const remainingQty = order.quantity - order.filledQuantity
        const fillAmount = Math.min(remainingQty, remainingQty * Math.random() * 0.5)
        order.filledQuantity += fillAmount
        order.updatedAt = new Date().toISOString()
        
        if (order.filledQuantity >= order.quantity) {
          order.status = 'filled' as OrderStatus
          order.filledPrice = order.price || order.avgFillPrice
        }
      }
    })
    
    // Remove fully filled orders from pending
    const filledFromPending = mockOrders.value.filter(o => o.status === 'filled')
    filledFromPending.forEach(order => {
      filledOrders.value.unshift(order)
    })
    mockOrders.value = mockOrders.value.filter(o => o.status !== 'filled')
    
  }, 3000) // Update every 3 seconds
}

const stopRealTimeUpdates = () => {
  if (updateInterval) {
    clearInterval(updateInterval)
    updateInterval = null
  }
}

// Lifecycle
onMounted(() => {
  startRealTimeUpdates()
})

onUnmounted(() => {
  stopRealTimeUpdates()
})

// Handle escape key for dialogs
const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    if (showModifyDialog.value) closeModifyDialog()
    if (showCancelDialog.value) closeCancelDialog()
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
  <widget-container
    title="Live Orders"
    :loading="false"
    :error="false"
    :compact="compact"
  >
    <template #header-actions>
      <div class="order-stats">
        <div class="stat">
          <span class="stat-label">Pending:</span>
          <span class="stat-value">{{ pendingOrders.length }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Value:</span>
          <span class="stat-value">{{ formatCurrency(totalPendingValue) }}</span>
        </div>
      </div>
    </template>

    <div class="live-orders">
      <!-- Tabs -->
      <div class="order-tabs">
        <button 
          :class="['tab', { active: selectedTab === 'pending' }]"
          @click="selectTab('pending')"
        >
          Pending
          <span v-if="pendingOrders.length > 0" class="tab-count">{{ pendingOrders.length }}</span>
        </button>
        
        <button 
          :class="['tab', { active: selectedTab === 'filled' }]"
          @click="selectTab('filled')"
        >
          Filled
          <span v-if="completedOrders.length > 0" class="tab-count">{{ completedOrders.length }}</span>
        </button>
        
        <button 
          v-if="showHistory"
          :class="['tab', { active: selectedTab === 'history' }]"
          @click="selectTab('history')"
        >
          History
        </button>
      </div>

      <!-- Orders List -->
      <div class="orders-container">
        <div v-if="currentOrders.length === 0" class="empty-state">
          <div class="empty-icon">📋</div>
          <p class="empty-text">
            {{ selectedTab === 'pending' ? 'No pending orders' : 
               selectedTab === 'filled' ? 'No filled orders' : 'No order history' }}
          </p>
        </div>

        <div v-else class="orders-list">
          <div
            v-for="order in currentOrders"
            :key="order.id"
            class="order-item"
          >
            <!-- Order Header -->
            <div class="order-header">
              <div class="order-info">
                <div class="symbol-side">
                  <span class="symbol">{{ order.symbol }}</span>
                  <span 
                    :class="['side-badge', order.side]"
                    :style="{ color: getSideColor(order.side) }"
                  >
                    <span class="side-icon">{{ getSideIcon(order.side) }}</span>
                    {{ order.side.toUpperCase() }}
                  </span>
                </div>
                
                <div class="order-details">
                  <span 
                    class="order-type"
                    :style="{ color: getOrderTypeColor(order.type) }"
                  >
                    {{ order.type.toUpperCase().replace('_', ' ') }}
                  </span>
                  <span 
                    class="order-status"
                    :style="{ color: getStatusColor(order.status) }"
                  >
                    {{ order.status.toUpperCase().replace('_', ' ') }}
                  </span>
                </div>
              </div>

              <div class="order-actions">
                <button 
                  v-if="canModifyOrder(order)"
                  class="action-btn"
                  @click="showModifyOrderDialog(order)"
                  title="Modify Order"
                >
                  ✏️
                </button>
                
                <button 
                  v-if="canCancelOrder(order)"
                  class="action-btn danger"
                  @click="showCancelOrderDialog(order)"
                  title="Cancel Order"
                >
                  ✕
                </button>
              </div>
            </div>

            <!-- Order Details Grid -->
            <div class="order-grid">
              <div class="grid-item">
                <span class="label">Quantity:</span>
                <span class="value">{{ formatNumber(order.quantity) }}</span>
              </div>

              <div v-if="order.price" class="grid-item">
                <span class="label">{{ order.type === 'stop' ? 'Stop' : 'Limit' }} Price:</span>
                <span class="value">{{ formatCurrency(order.price) }}</span>
              </div>

              <div v-if="order.stopPrice" class="grid-item">
                <span class="label">Stop Price:</span>
                <span class="value">{{ formatCurrency(order.stopPrice) }}</span>
              </div>

              <div v-if="order.filledQuantity > 0" class="grid-item">
                <span class="label">Filled:</span>
                <span class="value">{{ formatNumber(order.filledQuantity) }}</span>
              </div>

              <div v-if="order.avgFillPrice || order.filledPrice" class="grid-item">
                <span class="label">Avg Fill Price:</span>
                <span class="value">{{ formatCurrency(order.avgFillPrice || order.filledPrice || 0) }}</span>
              </div>

              <div v-if="order.commission > 0" class="grid-item">
                <span class="label">Commission:</span>
                <span class="value">{{ formatCurrency(order.commission) }}</span>
              </div>

              <div v-if="order.slippageEstimate !== undefined" class="grid-item">
                <span class="label">Slippage:</span>
                <span 
                  :class="['value', order.slippageEstimate >= 0 ? 'loss' : 'profit']"
                >
                  {{ formatPercent(order.slippageEstimate) }}
                </span>
              </div>

              <div v-if="order.estimatedFillTime" class="grid-item">
                <span class="label">Est. Fill Time:</span>
                <span class="value">{{ order.estimatedFillTime }}</span>
              </div>
            </div>

            <!-- Progress Bar for Partially Filled Orders -->
            <div v-if="order.status === 'partially_filled'" class="fill-progress">
              <div class="progress-header">
                <span class="progress-label">Fill Progress</span>
                <span class="progress-percent">{{ getProgressPercent(order).toFixed(1) }}%</span>
              </div>
              <div class="progress-bar">
                <div 
                  class="progress-fill"
                  :style="{ width: `${getProgressPercent(order)}%` }"
                ></div>
              </div>
            </div>

            <!-- Order Timeline -->
            <div class="order-timeline">
              <div class="timeline-item">
                <span class="timeline-label">Created:</span>
                <span class="timeline-value">{{ formatDateTime(order.createdAt).time }}</span>
              </div>
              <div v-if="order.updatedAt !== order.createdAt" class="timeline-item">
                <span class="timeline-label">Updated:</span>
                <span class="timeline-value">{{ formatDateTime(order.updatedAt).time }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Summary Footer -->
      <div v-if="currentOrders.length > 0" class="orders-summary">
        <div class="summary-stat">
          <span class="label">Total Orders:</span>
          <span class="value">{{ currentOrders.length }}</span>
        </div>
        <div v-if="selectedTab === 'pending'" class="summary-stat">
          <span class="label">Total Value:</span>
          <span class="value">{{ formatCurrency(totalPendingValue) }}</span>
        </div>
        <div v-if="selectedTab === 'filled'" class="summary-stat">
          <span class="label">Total Filled:</span>
          <span class="value">{{ formatCurrency(totalFilledValue) }}</span>
        </div>
      </div>
    </div>

    <!-- Modify Order Dialog -->
    <div v-if="showModifyDialog" class="modal-backdrop" @click="closeModifyDialog">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h4>Modify Order</h4>
          <button class="close-btn" @click="closeModifyDialog">✕</button>
        </div>
        
        <div v-if="selectedOrder" class="modal-body">
          <div class="order-info-summary">
            <span class="symbol">{{ selectedOrder.symbol }}</span>
            <span :class="['side', selectedOrder.side]">{{ selectedOrder.side.toUpperCase() }}</span>
            <span class="type">{{ selectedOrder.type.toUpperCase() }}</span>
          </div>

          <div class="modify-form">
            <div class="form-group">
              <label>Quantity</label>
              <input 
                v-model="modifyForm.quantity"
                type="number"
                step="0.00000001"
                min="0"
                class="form-input"
              >
            </div>

            <div v-if="['limit', 'stop_limit'].includes(selectedOrder.type)" class="form-group">
              <label>Limit Price</label>
              <input 
                v-model="modifyForm.price"
                type="number"
                step="0.01"
                min="0"
                class="form-input"
              >
            </div>

            <div v-if="['stop', 'stop_limit'].includes(selectedOrder.type)" class="form-group">
              <label>Stop Price</label>
              <input 
                v-model="modifyForm.stopPrice"
                type="number"
                step="0.01"
                min="0"
                class="form-input"
              >
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" @click="closeModifyDialog">Cancel</button>
          <button class="btn-primary" @click="confirmModifyOrder">Update Order</button>
        </div>
      </div>
    </div>

    <!-- Cancel Order Dialog -->
    <div v-if="showCancelDialog" class="modal-backdrop" @click="closeCancelDialog">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <h4>Cancel Order</h4>
          <button class="close-btn" @click="closeCancelDialog">✕</button>
        </div>
        
        <div v-if="selectedOrder" class="modal-body">
          <p>Are you sure you want to cancel this order?</p>
          
          <div class="order-info-summary">
            <div class="summary-row">
              <span class="label">Symbol:</span>
              <span class="value">{{ selectedOrder.symbol }}</span>
            </div>
            <div class="summary-row">
              <span class="label">Side:</span>
              <span :class="['value', selectedOrder.side]">{{ selectedOrder.side.toUpperCase() }}</span>
            </div>
            <div class="summary-row">
              <span class="label">Type:</span>
              <span class="value">{{ selectedOrder.type.toUpperCase() }}</span>
            </div>
            <div class="summary-row">
              <span class="label">Quantity:</span>
              <span class="value">{{ formatNumber(selectedOrder.quantity) }}</span>
            </div>
            <div v-if="selectedOrder.price" class="summary-row">
              <span class="label">Price:</span>
              <span class="value">{{ formatCurrency(selectedOrder.price) }}</span>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-secondary" @click="closeCancelDialog">Keep Order</button>
          <button class="btn-danger" @click="confirmCancelOrder">Cancel Order</button>
        </div>
      </div>
    </div>
  </widget-container>
</template>

<style scoped>
.live-orders {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-lg);
}

.order-stats {
  display: flex;
  gap: var(--trading-spacing-lg);
}

.stat {
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-xs);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--trading-text-secondary);
}

.stat-value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--trading-text-primary);
}

.order-tabs {
  display: flex;
  background: var(--trading-bg-tertiary);
  border-radius: var(--trading-radius-md);
  padding: var(--trading-spacing-xs);
  gap: var(--trading-spacing-xs);
}

.tab {
  flex: 1;
  padding: var(--trading-spacing-sm) var(--trading-spacing-md);
  background: none;
  border: none;
  border-radius: var(--trading-radius-sm);
  color: var(--trading-text-secondary);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--trading-spacing-xs);
}

.tab:hover {
  color: var(--trading-text-primary);
  background: var(--trading-bg-hover);
}

.tab.active {
  background: var(--trading-accent-blue);
  color: white;
}

.tab-count {
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 6px;
  border-radius: 10px;
  font-size: 0.75rem;
  min-width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab.active .tab-count {
  background: rgba(255, 255, 255, 0.3);
}

.orders-container {
  min-height: 200px;
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

.orders-list {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-md);
}

.order-item {
  background: var(--trading-bg-tertiary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  padding: var(--trading-spacing-lg);
  transition: all 0.2s ease;
}

.order-item:hover {
  border-color: var(--trading-border-light);
  background: var(--trading-bg-hover);
}

.order-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--trading-spacing-md);
}

.order-info {
  flex: 1;
}

.symbol-side {
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-md);
  margin-bottom: var(--trading-spacing-xs);
}

.symbol {
  font-weight: 700;
  font-size: 1rem;
  color: var(--trading-text-primary);
}

.side-badge {
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-xs);
  padding: var(--trading-spacing-xs) var(--trading-spacing-sm);
  border-radius: var(--trading-radius-sm);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.side-badge.buy {
  color: var(--trading-profit);
  background: rgba(38, 194, 129, 0.1);
  border-color: rgba(38, 194, 129, 0.3);
}

.side-badge.sell {
  color: var(--trading-loss);
  background: rgba(231, 76, 60, 0.1);
  border-color: rgba(231, 76, 60, 0.3);
}

.side-icon {
  font-size: 0.7rem;
}

.order-details {
  display: flex;
  gap: var(--trading-spacing-md);
}

.order-type,
.order-status {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  padding: var(--trading-spacing-xs) var(--trading-spacing-sm);
  border-radius: var(--trading-radius-sm);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.order-actions {
  display: flex;
  gap: var(--trading-spacing-sm);
}

.action-btn {
  width: 32px;
  height: 32px;
  border: 1px solid var(--trading-border);
  background: var(--trading-bg-secondary);
  color: var(--trading-text-secondary);
  border-radius: var(--trading-radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  font-size: 0.9rem;
}

.action-btn:hover {
  background: var(--trading-bg-hover);
  border-color: var(--trading-border-light);
  color: var(--trading-text-primary);
}

.action-btn.danger {
  border-color: var(--trading-loss);
  color: var(--trading-loss);
}

.action-btn.danger:hover {
  background: var(--trading-loss);
  color: white;
}

.order-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: var(--trading-spacing-md);
  margin-bottom: var(--trading-spacing-md);
}

.grid-item {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-xs);
}

.grid-item .label {
  font-size: 0.75rem;
  color: var(--trading-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.grid-item .value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--trading-text-primary);
}

.grid-item .value.profit {
  color: var(--trading-profit);
}

.grid-item .value.loss {
  color: var(--trading-loss);
}

.fill-progress {
  margin-bottom: var(--trading-spacing-md);
  padding: var(--trading-spacing-md);
  background: var(--trading-bg-secondary);
  border-radius: var(--trading-radius-sm);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--trading-spacing-sm);
}

.progress-label {
  font-size: 0.75rem;
  color: var(--trading-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.progress-percent {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--trading-text-primary);
}

.progress-bar {
  height: 6px;
  background: var(--trading-bg-primary);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--trading-accent-blue), var(--trading-profit));
  border-radius: 3px;
  transition: width 0.3s ease;
}

.order-timeline {
  display: flex;
  gap: var(--trading-spacing-lg);
  padding-top: var(--trading-spacing-md);
  border-top: 1px solid var(--trading-border);
}

.timeline-item {
  display: flex;
  gap: var(--trading-spacing-sm);
  align-items: center;
}

.timeline-label {
  font-size: 0.75rem;
  color: var(--trading-text-secondary);
}

.timeline-value {
  font-size: 0.75rem;
  color: var(--trading-text-primary);
  font-family: var(--trading-font-mono);
}

.orders-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--trading-spacing-md);
  background: var(--trading-bg-tertiary);
  border-radius: var(--trading-radius-md);
  border: 1px solid var(--trading-border);
}

.summary-stat {
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-sm);
}

.summary-stat .label {
  font-size: 0.75rem;
  color: var(--trading-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.summary-stat .value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--trading-text-primary);
}

/* Modal Styles */
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
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--trading-spacing-lg);
  border-bottom: 1px solid var(--trading-border);
}

.modal-header h4 {
  margin: 0;
  color: var(--trading-text-primary);
  font-size: 1.2rem;
  font-weight: 600;
}

.close-btn {
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

.close-btn:hover {
  background: var(--trading-bg-hover);
  color: var(--trading-text-primary);
}

.modal-body {
  padding: var(--trading-spacing-lg);
}

.order-info-summary {
  padding: var(--trading-spacing-md);
  background: var(--trading-bg-tertiary);
  border-radius: var(--trading-radius-md);
  margin-bottom: var(--trading-spacing-lg);
  display: flex;
  gap: var(--trading-spacing-md);
  align-items: center;
  flex-wrap: wrap;
}

.order-info-summary .symbol {
  font-weight: 700;
  font-size: 1rem;
  color: var(--trading-text-primary);
}

.order-info-summary .side {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  padding: var(--trading-spacing-xs) var(--trading-spacing-sm);
  border-radius: var(--trading-radius-sm);
  background: rgba(255, 255, 255, 0.05);
}

.order-info-summary .side.buy {
  color: var(--trading-profit);
}

.order-info-summary .side.sell {
  color: var(--trading-loss);
}

.order-info-summary .type {
  font-size: 0.8rem;
  color: var(--trading-text-secondary);
  text-transform: uppercase;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--trading-spacing-sm);
}

.summary-row:last-child {
  margin-bottom: 0;
}

.summary-row .label {
  font-size: 0.8rem;
  color: var(--trading-text-secondary);
}

.summary-row .value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--trading-text-primary);
}

.summary-row .value.buy {
  color: var(--trading-profit);
}

.summary-row .value.sell {
  color: var(--trading-loss);
}

.modify-form {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-lg);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-xs);
}

.form-group label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--trading-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.form-input {
  padding: var(--trading-spacing-sm) var(--trading-spacing-md);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  background: var(--trading-bg-secondary);
  color: var(--trading-text-primary);
  font-size: 0.875rem;
}

.form-input:focus {
  outline: none;
  border-color: var(--trading-accent-blue);
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.modal-footer {
  padding: var(--trading-spacing-lg);
  border-top: 1px solid var(--trading-border);
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

.btn-danger:hover {
  background: linear-gradient(135deg, #c0392b, #a93226);
}

/* Responsive design */
@media (max-width: 768px) {
  .order-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .order-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--trading-spacing-md);
  }

  .order-actions {
    align-self: flex-end;
  }

  .order-timeline {
    flex-direction: column;
    gap: var(--trading-spacing-sm);
  }

  .orders-summary {
    flex-direction: column;
    gap: var(--trading-spacing-sm);
    text-align: center;
  }

  .modal-backdrop {
    padding: var(--trading-spacing-sm);
  }
}

@media (max-width: 576px) {
  .order-grid {
    grid-template-columns: 1fr;
  }

  .symbol-side {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--trading-spacing-sm);
  }

  .order-details {
    flex-direction: column;
    gap: var(--trading-spacing-sm);
  }

  .order-stats {
    flex-direction: column;
    gap: var(--trading-spacing-sm);
  }

  .modal-header {
    padding: var(--trading-spacing-md);
  }

  .modal-body {
    padding: var(--trading-spacing-md);
  }

  .modal-footer {
    padding: var(--trading-spacing-md);
    flex-direction: column;
  }
}
</style>