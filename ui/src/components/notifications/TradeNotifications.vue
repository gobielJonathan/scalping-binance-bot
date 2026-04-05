<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useTradesStore, usePositionsStore, usePortfolioStore } from '@/stores'
import type { Trade, Position, Portfolio } from '@/types/api'

interface NotificationItem {
  id: string
  type: 'trade' | 'position' | 'pnl' | 'risk' | 'system'
  level: 'info' | 'success' | 'warning' | 'error'
  title: string
  message: string
  timestamp: string
  read: boolean
  data?: any
}

interface Props {
  showHistory?: boolean
  soundEnabled?: boolean
  maxToasts?: number
}

const props = withDefaults(defineProps<Props>(), {
  showHistory: false,
  soundEnabled: true,
  maxToasts: 5
})

const emit = defineEmits<{
  'toggle-history': []
  'toggle-sound': []
}>()

const tradesStore = useTradesStore()
const positionsStore = usePositionsStore()
const portfolioStore = usePortfolioStore()

// Local state
const notifications = ref<NotificationItem[]>([])
const toasts = ref<NotificationItem[]>([])
const isHistoryOpen = ref(props.showHistory)
const soundEnabled = ref(props.soundEnabled)
const lastPnlUpdate = ref<number | null>(null)

// Settings
const pnlChangeThreshold = ref(100) // Alert if P&L changes by $100+
const riskAlertThreshold = ref(5) // Alert if position loses 5%+

// Computed
const unreadCount = computed(() => 
  notifications.value.filter(n => !n.read).length
)

const sortedNotifications = computed(() => 
  notifications.value.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
)

const recentNotifications = computed(() => 
  sortedNotifications.value.slice(0, 50)
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

const getNotificationIcon = (type: string, level: string) => {
  const icons = {
    trade: '💱',
    position: '📈',
    pnl: '💰',
    risk: '⚠️',
    system: '⚙️'
  }
  
  if (level === 'error') return '🚨'
  if (level === 'warning') return '⚠️'
  if (level === 'success') return '✅'
  
  return icons[type as keyof typeof icons] || 'ℹ️'
}

const getNotificationColor = (level: string) => {
  const colors = {
    info: 'var(--trading-accent-blue)',
    success: 'var(--trading-profit)',
    warning: 'var(--trading-warning)',
    error: 'var(--trading-loss)'
  }
  return colors[level as keyof typeof colors] || colors.info
}

// Notification creation
const createNotification = (
  type: NotificationItem['type'],
  level: NotificationItem['level'],
  title: string,
  message: string,
  data?: any
) => {
  const notification: NotificationItem = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    type,
    level,
    title,
    message,
    timestamp: new Date().toISOString(),
    read: false,
    data
  }

  notifications.value.unshift(notification)
  showToast(notification)
  
  if (soundEnabled.value) {
    playNotificationSound(level)
  }

  // Clean up old notifications (keep last 200)
  if (notifications.value.length > 200) {
    notifications.value = notifications.value.slice(0, 200)
  }

  return notification
}

const showToast = (notification: NotificationItem) => {
  toasts.value.unshift(notification)
  
  // Remove toast after 5 seconds for info/success, 8 seconds for warning/error
  const timeout = ['warning', 'error'].includes(notification.level) ? 8000 : 5000
  
  setTimeout(() => {
    removeToast(notification.id)
  }, timeout)
  
  // Keep only max number of toasts
  if (toasts.value.length > props.maxToasts) {
    toasts.value = toasts.value.slice(0, props.maxToasts)
  }
}

const removeToast = (id: string) => {
  const index = toasts.value.findIndex(t => t.id === id)
  if (index !== -1) {
    toasts.value.splice(index, 1)
  }
}

const markAsRead = (id: string) => {
  const notification = notifications.value.find(n => n.id === id)
  if (notification) {
    notification.read = true
  }
}

const markAllAsRead = () => {
  notifications.value.forEach(n => n.read = true)
}

const clearHistory = () => {
  notifications.value = []
  toasts.value = []
}

// Sound notifications
const playNotificationSound = (level: string) => {
  try {
    const audio = new Audio()
    
    // Different sounds for different levels
    if (level === 'error') {
      // Error sound - higher pitch, more urgent
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      
      osc.connect(gain)
      gain.connect(ctx.destination)
      
      osc.frequency.value = 800
      gain.gain.value = 0.1
      
      osc.start()
      setTimeout(() => osc.stop(), 200)
    } else if (level === 'warning') {
      // Warning sound - medium pitch
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      
      osc.connect(gain)
      gain.connect(ctx.destination)
      
      osc.frequency.value = 600
      gain.gain.value = 0.08
      
      osc.start()
      setTimeout(() => osc.stop(), 150)
    } else {
      // Success/Info sound - lower pitch, pleasant
      const ctx = new AudioContext()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      
      osc.connect(gain)
      gain.connect(ctx.destination)
      
      osc.frequency.value = 400
      gain.gain.value = 0.06
      
      osc.start()
      setTimeout(() => osc.stop(), 100)
    }
  } catch (error) {
    console.warn('Could not play notification sound:', error)
  }
}

// Event handlers
const handleTradeExecuted = (trade: Trade) => {
  const pnlText = trade.pnl 
    ? `P&L: ${formatCurrency(trade.pnl)} (${formatPercent(trade.pnlPercent || 0)})`
    : ''
  
  const level = !trade.pnl ? 'info' : trade.pnl >= 0 ? 'success' : 'warning'
  
  createNotification(
    'trade',
    level,
    `${trade.side.toUpperCase()} ${trade.symbol}`,
    `${trade.quantity} @ ${formatCurrency(trade.price)}${pnlText ? ' • ' + pnlText : ''}`,
    trade
  )
}

const handlePositionOpened = (position: Position) => {
  createNotification(
    'position',
    'info',
    `Position Opened: ${position.symbol}`,
    `Entry: ${formatCurrency(position.entryPrice)} • Qty: ${position.quantity}`,
    position
  )
}

const handlePositionClosed = (position: Position) => {
  const level = position.pnl >= 0 ? 'success' : 'warning'
  
  createNotification(
    'position',
    level,
    `Position Closed: ${position.symbol}`,
    `P&L: ${formatCurrency(position.pnl)} (${formatPercent(position.pnlPercent)})`,
    position
  )
}

const handlePnLAlert = (portfolio: Portfolio) => {
  if (lastPnlUpdate.value === null) {
    lastPnlUpdate.value = portfolio.pnl
    return
  }
  
  const pnlChange = Math.abs(portfolio.pnl - lastPnlUpdate.value)
  
  if (pnlChange >= pnlChangeThreshold.value) {
    const direction = portfolio.pnl > lastPnlUpdate.value ? 'increased' : 'decreased'
    const level = portfolio.pnl > lastPnlUpdate.value ? 'success' : 'warning'
    
    createNotification(
      'pnl',
      level,
      `P&L Alert`,
      `Total P&L ${direction} by ${formatCurrency(pnlChange)} to ${formatCurrency(portfolio.pnl)}`,
      portfolio
    )
    
    lastPnlUpdate.value = portfolio.pnl
  }
}

const handleRiskAlert = (position: Position) => {
  if (position.pnlPercent <= -riskAlertThreshold.value) {
    createNotification(
      'risk',
      'error',
      `Risk Alert: ${position.symbol}`,
      `Position down ${formatPercent(position.pnlPercent)} (${formatCurrency(position.pnl)})`,
      position
    )
  }
}

const handleSystemAlert = (message: string, level: NotificationItem['level'] = 'warning') => {
  createNotification(
    'system',
    level,
    'System Alert',
    message
  )
}

// Actions
const toggleHistory = () => {
  isHistoryOpen.value = !isHistoryOpen.value
  emit('toggle-history')
}

const toggleSound = () => {
  soundEnabled.value = !soundEnabled.value
  emit('toggle-sound')
}

const dismissToast = (id: string) => {
  removeToast(id)
  markAsRead(id)
}

// Watch for store changes
watch(() => tradesStore.trades, (newTrades, oldTrades) => {
  if (oldTrades && newTrades.length > oldTrades.length) {
    // New trade detected
    const newTrade = newTrades[0]
    if (newTrade) {
      handleTradeExecuted(newTrade)
    }
  }
}, { deep: true })

watch(() => positionsStore.positions, (newPositions, oldPositions) => {
  if (oldPositions) {
    // Check for new positions
    newPositions.forEach(position => {
      if (!oldPositions.find(p => p.id === position.id)) {
        handlePositionOpened(position)
      }
    })
    
    // Check for closed positions
    oldPositions.forEach(position => {
      if (!newPositions.find(p => p.id === position.id)) {
        handlePositionClosed(position)
      }
    })
    
    // Check for risk alerts on existing positions
    newPositions.forEach(position => {
      handleRiskAlert(position)
    })
  }
}, { deep: true })

watch(() => portfolioStore.portfolio, (newPortfolio) => {
  if (newPortfolio) {
    handlePnLAlert(newPortfolio)
  }
}, { deep: true })

// Initialize with some example notifications
onMounted(() => {
  // Add connection success notification
  createNotification(
    'system',
    'success',
    'Connected',
    'Real-time data connection established'
  )
  
  // Simulate some trading activity for demo
  setTimeout(() => {
    createNotification(
      'trade',
      'success',
      'BUY BTC/USD',
      '0.5 @ $45,250 • P&L: +$125.50 (+0.28%)'
    )
  }, 2000)
  
  setTimeout(() => {
    createNotification(
      'position',
      'info',
      'Position Opened: ETH/USD',
      'Entry: $2,850 • Qty: 2.5'
    )
  }, 4000)
})

// Cleanup
onUnmounted(() => {
  toasts.value = []
})
</script>

<template>
  <div class="notifications-system">
    <!-- Toast Container -->
    <div class="toast-container">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="['toast', `toast-${toast.level}`]"
        @click="dismissToast(toast.id)"
      >
        <div class="toast-content">
          <div class="toast-header">
            <span class="toast-icon">{{ getNotificationIcon(toast.type, toast.level) }}</span>
            <span class="toast-title">{{ toast.title }}</span>
            <button class="toast-close" @click.stop="dismissToast(toast.id)">✕</button>
          </div>
          <div class="toast-message">{{ toast.message }}</div>
        </div>
        <div class="toast-progress"></div>
      </div>
    </div>

    <!-- Notification Controls -->
    <div class="notification-controls">
      <button 
        class="control-btn"
        @click="toggleHistory"
        :class="{ active: isHistoryOpen }"
      >
        <span class="icon">🔔</span>
        <span class="badge" v-if="unreadCount > 0">{{ unreadCount }}</span>
      </button>
      
      <button 
        class="control-btn"
        @click="toggleSound"
        :class="{ active: soundEnabled }"
      >
        <span class="icon">{{ soundEnabled ? '🔊' : '🔇' }}</span>
      </button>
    </div>

    <!-- Notification History Panel -->
    <div v-if="isHistoryOpen" class="history-panel">
      <div class="panel-header">
        <h4>Notifications</h4>
        <div class="header-actions">
          <button 
            v-if="unreadCount > 0"
            class="btn-text"
            @click="markAllAsRead"
          >
            Mark all read
          </button>
          <button 
            class="btn-text"
            @click="clearHistory"
          >
            Clear
          </button>
          <button 
            class="btn-close"
            @click="toggleHistory"
          >
            ✕
          </button>
        </div>
      </div>

      <div class="panel-content">
        <div v-if="notifications.length === 0" class="empty-state">
          <div class="empty-icon">🔔</div>
          <p>No notifications yet</p>
        </div>

        <div v-else class="notifications-list">
          <div
            v-for="notification in recentNotifications"
            :key="notification.id"
            :class="['notification-item', { unread: !notification.read }]"
            @click="markAsRead(notification.id)"
          >
            <div class="notification-content">
              <div class="notification-header">
                <span class="notification-icon">
                  {{ getNotificationIcon(notification.type, notification.level) }}
                </span>
                <span class="notification-title">{{ notification.title }}</span>
                <span class="notification-time">{{ formatTimeAgo(notification.timestamp) }}</span>
              </div>
              <div class="notification-message">{{ notification.message }}</div>
              <div class="notification-meta">
                <span :class="['notification-type', `type-${notification.type}`]">
                  {{ notification.type.toUpperCase() }}
                </span>
                <span :class="['notification-level', `level-${notification.level}`]">
                  {{ notification.level.toUpperCase() }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Settings Panel (collapsed by default) -->
    <div v-if="isHistoryOpen" class="settings-section">
      <div class="settings-header">
        <h5>Alert Settings</h5>
      </div>
      <div class="settings-content">
        <div class="setting-item">
          <label>P&L Change Alert ($)</label>
          <input 
            v-model.number="pnlChangeThreshold"
            type="number"
            min="1"
            step="1"
            class="setting-input"
          >
        </div>
        <div class="setting-item">
          <label>Risk Alert Threshold (%)</label>
          <input 
            v-model.number="riskAlertThreshold"
            type="number"
            min="1"
            max="50"
            step="1"
            class="setting-input"
          >
        </div>
        <div class="setting-item">
          <label>
            <input 
              v-model="soundEnabled"
              type="checkbox"
              class="setting-checkbox"
            >
            Sound notifications
          </label>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.notifications-system {
  position: relative;
}

/* Toast Container */
.toast-container {
  position: fixed;
  top: var(--trading-spacing-lg);
  right: var(--trading-spacing-lg);
  z-index: var(--trading-z-tooltip);
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-sm);
  max-width: 400px;
  width: 100%;
}

.toast {
  background: var(--trading-bg-primary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  box-shadow: var(--trading-shadow-lg);
  cursor: pointer;
  transition: all 0.3s ease;
  overflow: hidden;
  position: relative;
}

.toast:hover {
  transform: translateX(-4px);
  box-shadow: var(--trading-shadow-lg), -4px 0 0 0 var(--trading-accent-blue);
}

.toast-success {
  border-left: 4px solid var(--trading-profit);
}

.toast-warning {
  border-left: 4px solid var(--trading-warning);
}

.toast-error {
  border-left: 4px solid var(--trading-loss);
}

.toast-info {
  border-left: 4px solid var(--trading-accent-blue);
}

.toast-content {
  padding: var(--trading-spacing-md);
}

.toast-header {
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-sm);
  margin-bottom: var(--trading-spacing-xs);
}

.toast-icon {
  font-size: 1.2rem;
  min-width: 20px;
}

.toast-title {
  flex: 1;
  font-weight: 600;
  color: var(--trading-text-primary);
  font-size: 0.875rem;
}

.toast-close {
  background: none;
  border: none;
  color: var(--trading-text-tertiary);
  cursor: pointer;
  font-size: 1rem;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.toast-close:hover {
  background: var(--trading-bg-hover);
  color: var(--trading-text-primary);
}

.toast-message {
  font-size: 0.8rem;
  color: var(--trading-text-secondary);
  line-height: 1.4;
}

.toast-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  background: var(--trading-accent-blue);
  animation: toastProgress 5s linear forwards;
}

.toast-success .toast-progress {
  background: var(--trading-profit);
}

.toast-warning .toast-progress {
  background: var(--trading-warning);
}

.toast-error .toast-progress {
  background: var(--trading-loss);
  animation-duration: 8s;
}

@keyframes toastProgress {
  from { width: 100%; }
  to { width: 0%; }
}

/* Notification Controls */
.notification-controls {
  position: fixed;
  bottom: var(--trading-spacing-lg);
  right: var(--trading-spacing-lg);
  display: flex;
  gap: var(--trading-spacing-sm);
  z-index: var(--trading-z-fixed);
}

.control-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--trading-bg-tertiary);
  border: 1px solid var(--trading-border);
  color: var(--trading-text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.3s ease;
  box-shadow: var(--trading-shadow);
}

.control-btn:hover {
  background: var(--trading-bg-hover);
  border-color: var(--trading-border-light);
  color: var(--trading-text-primary);
  transform: scale(1.05);
}

.control-btn.active {
  background: var(--trading-accent-blue);
  border-color: var(--trading-accent-blue);
  color: white;
}

.control-btn .icon {
  font-size: 1.2rem;
}

.badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--trading-loss);
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
  min-width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: pulse 2s infinite;
}

/* History Panel */
.history-panel {
  position: fixed;
  bottom: 80px;
  right: var(--trading-spacing-lg);
  width: 400px;
  max-height: 500px;
  background: var(--trading-bg-primary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-lg);
  box-shadow: var(--trading-shadow-lg);
  z-index: var(--trading-z-popover);
  display: flex;
  flex-direction: column;
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.panel-header {
  padding: var(--trading-spacing-lg);
  border-bottom: 1px solid var(--trading-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--trading-bg-secondary);
  border-radius: var(--trading-radius-lg) var(--trading-radius-lg) 0 0;
}

.panel-header h4 {
  margin: 0;
  color: var(--trading-text-primary);
  font-size: 1.1rem;
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-md);
}

.btn-text {
  background: none;
  border: none;
  color: var(--trading-text-secondary);
  cursor: pointer;
  font-size: 0.8rem;
  padding: var(--trading-spacing-xs) var(--trading-spacing-sm);
  border-radius: var(--trading-radius-sm);
  transition: all 0.2s ease;
}

.btn-text:hover {
  background: var(--trading-bg-hover);
  color: var(--trading-text-primary);
}

.btn-close {
  background: none;
  border: none;
  color: var(--trading-text-tertiary);
  cursor: pointer;
  font-size: 1.1rem;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.btn-close:hover {
  background: var(--trading-bg-hover);
  color: var(--trading-text-primary);
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  max-height: 350px;
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
  font-size: 2rem;
  margin-bottom: var(--trading-spacing-sm);
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: 0.875rem;
}

.notifications-list {
  padding: var(--trading-spacing-sm);
}

.notification-item {
  padding: var(--trading-spacing-md);
  border-radius: var(--trading-radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: var(--trading-spacing-sm);
  border: 1px solid transparent;
}

.notification-item:hover {
  background: var(--trading-bg-hover);
  border-color: var(--trading-border);
}

.notification-item.unread {
  background: rgba(52, 152, 219, 0.05);
  border-color: rgba(52, 152, 219, 0.2);
}

.notification-content {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-xs);
}

.notification-header {
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-sm);
}

.notification-icon {
  font-size: 1rem;
  min-width: 16px;
}

.notification-title {
  flex: 1;
  font-weight: 600;
  color: var(--trading-text-primary);
  font-size: 0.875rem;
}

.notification-time {
  color: var(--trading-text-tertiary);
  font-size: 0.75rem;
  white-space: nowrap;
}

.notification-message {
  font-size: 0.8rem;
  color: var(--trading-text-secondary);
  line-height: 1.4;
  margin-left: 24px;
}

.notification-meta {
  display: flex;
  gap: var(--trading-spacing-sm);
  margin-left: 24px;
}

.notification-type,
.notification-level {
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: var(--trading-radius-sm);
  letter-spacing: 0.02em;
}

.type-trade {
  background: rgba(52, 152, 219, 0.1);
  color: var(--trading-accent-blue);
}

.type-position {
  background: rgba(38, 194, 129, 0.1);
  color: var(--trading-profit);
}

.type-pnl {
  background: rgba(243, 156, 18, 0.1);
  color: var(--trading-warning);
}

.type-risk {
  background: rgba(231, 76, 60, 0.1);
  color: var(--trading-loss);
}

.type-system {
  background: rgba(155, 89, 182, 0.1);
  color: #9b59b6;
}

.level-info {
  background: rgba(52, 152, 219, 0.1);
  color: var(--trading-accent-blue);
}

.level-success {
  background: rgba(38, 194, 129, 0.1);
  color: var(--trading-profit);
}

.level-warning {
  background: rgba(243, 156, 18, 0.1);
  color: var(--trading-warning);
}

.level-error {
  background: rgba(231, 76, 60, 0.1);
  color: var(--trading-loss);
}

/* Settings Section */
.settings-section {
  position: fixed;
  bottom: 80px;
  right: 430px;
  width: 300px;
  background: var(--trading-bg-primary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-lg);
  box-shadow: var(--trading-shadow-lg);
  z-index: var(--trading-z-popover);
  animation: slideIn 0.3s ease-out 0.1s both;
}

.settings-header {
  padding: var(--trading-spacing-lg);
  border-bottom: 1px solid var(--trading-border);
  background: var(--trading-bg-secondary);
  border-radius: var(--trading-radius-lg) var(--trading-radius-lg) 0 0;
}

.settings-header h5 {
  margin: 0;
  color: var(--trading-text-primary);
  font-size: 1rem;
  font-weight: 600;
}

.settings-content {
  padding: var(--trading-spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-lg);
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-xs);
}

.setting-item label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--trading-text-secondary);
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-sm);
}

.setting-input {
  padding: var(--trading-spacing-sm) var(--trading-spacing-md);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  background: var(--trading-bg-secondary);
  color: var(--trading-text-primary);
  font-size: 0.875rem;
}

.setting-input:focus {
  outline: none;
  border-color: var(--trading-accent-blue);
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.setting-checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--trading-accent-blue);
}

/* Responsive design */
@media (max-width: 768px) {
  .toast-container {
    left: var(--trading-spacing-md);
    right: var(--trading-spacing-md);
    max-width: none;
  }

  .history-panel {
    left: var(--trading-spacing-md);
    right: var(--trading-spacing-md);
    width: auto;
    max-width: none;
  }

  .settings-section {
    display: none; /* Hide settings on mobile */
  }

  .notification-controls {
    bottom: var(--trading-spacing-md);
    right: var(--trading-spacing-md);
  }
}

@media (max-width: 576px) {
  .toast-container {
    left: var(--trading-spacing-sm);
    right: var(--trading-spacing-sm);
  }

  .history-panel {
    left: var(--trading-spacing-sm);
    right: var(--trading-spacing-sm);
    bottom: 70px;
    max-height: 400px;
  }

  .notification-controls {
    bottom: var(--trading-spacing-sm);
    right: var(--trading-spacing-sm);
  }

  .control-btn {
    width: 44px;
    height: 44px;
  }

  .toast {
    margin-bottom: var(--trading-spacing-xs);
  }

  .panel-header {
    padding: var(--trading-spacing-md);
  }

  .notification-item {
    padding: var(--trading-spacing-sm);
  }

  .notification-message {
    font-size: 0.75rem;
  }

  .notification-meta {
    flex-wrap: wrap;
  }
}
</style>