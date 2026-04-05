<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useSystemStore, useAppStore } from '@/stores'
import WidgetContainer from '../layout/WidgetContainer.vue'

const systemStore = useSystemStore()
const appStore = useAppStore()

// Computed properties
const systemStatus = computed(() => systemStore.systemStatus)
const systemAlerts = computed(() => systemStore.systemAlerts)
const apiConnected = computed(() => systemStore.apiConnected)
const websocketConnected = computed(() => systemStore.websocketConnected)
const connectionMetrics = computed(() => systemStore.connectionMetrics)
const tradingEnabled = computed(() => systemStore.tradingEnabled)
const tradingMode = computed(() => systemStore.tradingMode)

// Connection health metrics
const avgLatency = computed(() => {
  if (!connectionMetrics.value || connectionMetrics.value.latency.length === 0) return 0
  const sum = connectionMetrics.value.latency.reduce((a, b) => a + b, 0)
  return sum / connectionMetrics.value.latency.length
})

const latencyStatus = computed(() => {
  if (avgLatency.value < 50) return 'excellent'
  if (avgLatency.value < 100) return 'good'
  if (avgLatency.value < 200) return 'fair'
  return 'poor'
})

const latencyColor = computed(() => {
  switch (latencyStatus.value) {
    case 'excellent':
      return 'profit'
    case 'good':
      return 'warning'
    case 'fair':
      return 'warning'
    default:
      return 'loss'
  }
})

// Alert statistics
const alertsByLevel = computed(() => {
  const grouped: Record<string, number> = {
    info: 0,
    warning: 0,
    error: 0,
    critical: 0,
  }
  
  systemAlerts.value.forEach((alert) => {
    const level = (alert.level || 'info').toLowerCase()
    if (level === 'info' || level === 'warning' || level === 'error' || level === 'critical') {
      grouped[level] = (grouped[level] ?? 0) + 1
    }
  })
  
  return grouped as Record<string, number>
})

const hasErrors = computed(() => (alertsByLevel.value.error ?? 0) > 0 || (alertsByLevel.value.critical ?? 0) > 0)

// Recent alerts (last 5)
const recentAlerts = computed(() => systemAlerts.value.slice(-5).reverse())

// Utility functions
const getStatusIcon = (status: boolean) => {
  return status ? '●' : '○'
}

const getStatusColor = (status: boolean) => {
  return status ? 'profit' : 'loss'
}

const getTradingModeIcon = () => {
  switch (tradingMode.value) {
    case 'auto':
      return '🤖'
    case 'manual':
      return '👤'
    case 'paper':
      return '📋'
    default:
      return '⚙️'
  }
}

const formatLatency = (ms: number) => {
  return `${Math.round(ms)}ms`
}

const getAlertColor = (level: string) => {
  switch (level) {
    case 'critical':
      return 'critical'
    case 'error':
      return 'loss'
    case 'warning':
      return 'warning'
    case 'info':
      return 'info'
    default:
      return 'neutral'
  }
}

const getAlertIcon = (level: string) => {
  switch (level) {
    case 'critical':
      return '⛔'
    case 'error':
      return '❌'
    case 'warning':
      return '⚠️'
    case 'info':
      return 'ℹ️'
    default:
      return '📌'
  }
}

const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// Load system status on mount
onMounted(() => {
  systemStore.fetchSystemStatus()
})
</script>

<template>
  <widget-container
    title="System Status"
    :loading="systemStore.loadingStatus"
    :error="!!systemStore.errorStatus"
    :class="{ 'has-alerts': hasErrors }"
  >
    <div class="system-widget">
      <!-- Connection Status Grid -->
      <div class="status-grid">
        <!-- API Connection -->
        <div class="status-card">
          <div class="status-header">
            <span :class="['status-dot', getStatusColor(apiConnected)]">
              {{ getStatusIcon(apiConnected) }}
            </span>
            <span class="status-label">API Connection</span>
          </div>
          <div class="status-info">
            {{ apiConnected ? 'Connected' : 'Disconnected' }}
          </div>
        </div>

        <!-- WebSocket Connection -->
        <div class="status-card">
          <div class="status-header">
            <span :class="['status-dot', getStatusColor(websocketConnected)]">
              {{ getStatusIcon(websocketConnected) }}
            </span>
            <span class="status-label">WebSocket</span>
          </div>
          <div class="status-info">
            {{ websocketConnected ? 'Connected' : 'Disconnected' }}
          </div>
        </div>

        <!-- API Latency -->
        <div class="status-card">
          <div class="status-header">
            <span class="latency-indicator">⚡</span>
            <span class="status-label">API Latency</span>
          </div>
          <div :class="['status-info', latencyColor]">
            {{ formatLatency(avgLatency) }}
          </div>
        </div>

        <!-- Trading Status -->
        <div class="status-card">
          <div class="status-header">
            <span class="trading-icon">{{ getTradingModeIcon() }}</span>
            <span class="status-label">Trading</span>
          </div>
          <div :class="['status-info', tradingEnabled ? 'profit' : 'loss']">
            {{ tradingEnabled ? 'Enabled' : 'Disabled' }}
          </div>
          <div class="status-mode">
            Mode: {{ tradingMode }}
          </div>
        </div>

        <!-- Connection Errors -->
        <div class="status-card">
          <div class="status-header">
            <span class="error-icon" :class="{ 'has-error': connectionMetrics.connectionErrors > 0 }">
              ⚠️
            </span>
            <span class="status-label">Errors</span>
          </div>
          <div :class="['status-info', connectionMetrics.connectionErrors > 0 ? 'loss' : 'profit']">
            {{ connectionMetrics.connectionErrors }}
          </div>
        </div>

        <!-- Disconnections -->
        <div class="status-card">
          <div class="status-header">
            <span class="disc-icon">🔄</span>
            <span class="status-label">Disconnections</span>
          </div>
          <div :class="['status-info', connectionMetrics.disconnections > 0 ? 'loss' : 'profit']">
            {{ connectionMetrics.disconnections }}
          </div>
        </div>
      </div>

      <!-- Alerts Section -->
      <div class="alerts-section">
        <div class="alerts-header">
          <h6 class="section-title">System Alerts</h6>
          <div class="alerts-summary">
            <div class="alert-count info">ℹ️ {{ alertsByLevel.info }}</div>
            <div class="alert-count warning">⚠️ {{ alertsByLevel.warning }}</div>
            <div class="alert-count error">❌ {{ alertsByLevel.error }}</div>
            <div class="alert-count critical">⛔ {{ alertsByLevel.critical }}</div>
          </div>
        </div>

        <div v-if="recentAlerts.length === 0" class="empty-alerts">
          <p>✓ No active alerts</p>
        </div>

        <div v-else class="alerts-list">
          <div
            v-for="(alert, index) in recentAlerts"
            :key="alert.id || index"
            :class="['alert-item', `alert-${getAlertColor(alert.level)}`]"
          >
            <div class="alert-icon">{{ getAlertIcon(alert.level) }}</div>
            <div class="alert-content">
              <div class="alert-title">{{ alert.message }}</div>
              <div class="alert-time">{{ formatTime(alert.timestamp) }}</div>
            </div>
            <div class="alert-level">{{ alert.level }}</div>
          </div>
        </div>
      </div>

      <!-- System Details -->
      <div class="system-details">
        <div class="detail-item">
          <span class="detail-label">System Status</span>
          <span :class="['detail-value', systemStatus?.status ? 'profit' : 'loss']">
            {{ systemStatus?.status || 'Unknown' }}
          </span>
        </div>

        <div class="detail-item">
          <span class="detail-label">Last Update</span>
          <span class="detail-value">
            {{ systemStore.lastStatusUpdate 
              ? new Date(systemStore.lastStatusUpdate).toLocaleTimeString() 
              : '—' }}
          </span>
        </div>

        <div class="detail-item">
          <span class="detail-label">Uptime</span>
          <span class="detail-value">
            {{ systemStatus?.uptime ? Math.floor(systemStatus.uptime / 3600) : 0 }}h
          </span>
        </div>
      </div>
    </div>
  </widget-container>
</template>

<style scoped>
.system-widget {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-lg);
}

.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--trading-spacing-md);
}

.status-card {
  padding: var(--trading-spacing-lg);
  background: var(--trading-bg-tertiary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-lg);
  transition: all 0.3s ease;
}

.status-card:hover {
  border-color: var(--trading-border-light);
  background: var(--trading-bg-hover);
}

.status-header {
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-sm);
  margin-bottom: var(--trading-spacing-md);
}

.status-dot {
  font-size: 1rem;
  font-weight: 700;
}

.status-dot.profit {
  color: var(--trading-profit);
}

.status-dot.loss {
  color: var(--trading-loss);
}

.status-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--trading-text-tertiary);
  letter-spacing: 0.05em;
  font-weight: 600;
}

.latency-indicator,
.trading-icon,
.error-icon,
.disc-icon {
  font-size: 1.25rem;
}

.status-info {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--trading-text-primary);
  margin-bottom: var(--trading-spacing-xs);
}

.status-info.profit {
  color: var(--trading-profit);
}

.status-info.loss {
  color: var(--trading-loss);
}

.status-info.warning {
  color: var(--trading-warning);
}

.status-mode {
  font-size: 0.75rem;
  color: var(--trading-text-tertiary);
  text-transform: capitalize;
}

.alerts-section {
  padding: var(--trading-spacing-lg);
  background: var(--trading-bg-tertiary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-lg);
}

.alerts-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--trading-spacing-lg);
  flex-wrap: wrap;
  gap: var(--trading-spacing-md);
}

.section-title {
  margin: 0;
  font-size: 0.875rem;
  text-transform: uppercase;
  color: var(--trading-text-secondary);
  letter-spacing: 0.05em;
  font-weight: 600;
}

.alerts-summary {
  display: flex;
  gap: var(--trading-spacing-md);
}

.alert-count {
  font-size: 0.8rem;
  padding: 2px 8px;
  border-radius: var(--trading-radius-sm);
  font-weight: 600;
}

.alert-count.info {
  background: rgba(52, 152, 219, 0.1);
  color: #3498db;
}

.alert-count.warning {
  background: rgba(241, 196, 15, 0.1);
  color: #f1c40f;
}

.alert-count.error {
  background: rgba(231, 76, 60, 0.1);
  color: #e74c3c;
}

.alert-count.critical {
  background: rgba(192, 57, 43, 0.1);
  color: #c0392b;
}

.empty-alerts {
  padding: var(--trading-spacing-lg);
  text-align: center;
  color: var(--trading-text-tertiary);
  font-size: 0.875rem;
}

.alerts-list {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-sm);
}

.alert-item {
  display: flex;
  align-items: flex-start;
  gap: var(--trading-spacing-md);
  padding: var(--trading-spacing-md);
  background: var(--trading-bg-secondary);
  border: 1px solid var(--trading-border);
  border-left: 4px solid transparent;
  border-radius: var(--trading-radius-md);
  transition: all 0.2s ease;
}

.alert-item:hover {
  background: var(--trading-bg-hover);
  border-color: var(--trading-border-light);
}

.alert-item.alert-info {
  border-left-color: #3498db;
}

.alert-item.alert-warning {
  border-left-color: #f1c40f;
}

.alert-item.alert-error {
  border-left-color: #e74c3c;
}

.alert-item.alert-critical {
  border-left-color: #c0392b;
}

.alert-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.alert-content {
  flex: 1;
  min-width: 0;
}

.alert-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--trading-text-primary);
  margin-bottom: var(--trading-spacing-xs);
  word-break: break-word;
}

.alert-time {
  font-size: 0.75rem;
  color: var(--trading-text-tertiary);
}

.alert-level {
  font-size: 0.7rem;
  text-transform: uppercase;
  color: var(--trading-text-tertiary);
  font-weight: 600;
  letter-spacing: 0.05em;
  white-space: nowrap;
}

.system-details {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--trading-spacing-md);
  padding: var(--trading-spacing-md);
  background: var(--trading-bg-tertiary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-lg);
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-xs);
}

.detail-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--trading-text-tertiary);
  letter-spacing: 0.05em;
  font-weight: 600;
}

.detail-value {
  font-size: 1rem;
  font-weight: 600;
  color: var(--trading-text-primary);
}

.detail-value.profit {
  color: var(--trading-profit);
}

.detail-value.loss {
  color: var(--trading-loss);
}

/* Responsive design */
@media (max-width: 768px) {
  .status-grid {
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  }

  .alerts-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .alerts-summary {
    width: 100%;
    justify-content: space-between;
  }
}

@media (max-width: 576px) {
  .status-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .status-card {
    padding: var(--trading-spacing-md);
  }

  .alerts-summary {
    flex-wrap: wrap;
  }

  .alert-item {
    flex-direction: column;
    gap: var(--trading-spacing-sm);
  }

  .alert-level {
    align-self: flex-start;
  }
}
</style>
