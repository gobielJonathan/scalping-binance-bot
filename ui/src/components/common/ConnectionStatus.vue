<template>
  <div class="connection-status-container">
    <!-- Connection Status Badge -->
    <div
      class="connection-badge"
      :class="connectionStatusClass"
      @click="showDetails = !showDetails"
    >
      <div class="status-icon">
        <span v-if="isConnected" class="pulse-dot"></span>
        <span v-else-if="isReconnecting" class="spinner"></span>
        <span v-else class="disconnect-icon">✕</span>
      </div>
      <div class="status-text">
        <div class="status-label">{{ statusLabel }}</div>
        <div class="status-secondary">{{ statusSecondary }}</div>
      </div>
    </div>

    <!-- Detailed Status Modal -->
    <Transition name="slide">
      <div v-if="showDetails" class="connection-details">
        <div class="details-header">
          <h3>Connection Details</h3>
          <button class="close-btn" @click="showDetails = false">✕</button>
        </div>

        <div class="details-content">
          <!-- Connection Status -->
          <div class="detail-item">
            <label>Status</label>
            <span :class="statusBadgeClass">{{ statusLabel }}</span>
          </div>

          <!-- Latency -->
          <div class="detail-item">
            <label>Latency</label>
            <span :class="latencyClass">{{ latency }}ms</span>
          </div>

          <!-- Reconnect Info -->
          <div v-if="isReconnecting" class="detail-item">
            <label>Reconnection Attempts</label>
            <span>{{ reconnectAttempts }}/{{ maxReconnectAttempts }}</span>
          </div>

          <!-- Connection Duration -->
          <div v-if="isConnected" class="detail-item">
            <label>Connected For</label>
            <span>{{ connectionDuration }}</span>
          </div>

          <!-- Error Count -->
          <div v-if="errorCount > 0" class="detail-item warning">
            <label>Errors</label>
            <span>{{ errorCount }}</span>
          </div>

          <!-- Message Stats -->
          <div class="detail-item">
            <label>Messages Sent/Received</label>
            <span>{{ messagesSent }} / {{ messagesReceived }}</span>
          </div>

          <!-- Queue Status -->
          <div v-if="queueStatus.queueSize > 0" class="detail-item warning">
            <label>Queued Requests</label>
            <span>{{ queueStatus.queueSize }}/{{ queueStatus.maxQueueSize }}</span>
          </div>

          <!-- Health Status -->
          <div class="detail-item">
            <label>Health</label>
            <span :class="healthClass">{{
              isHealthy ? '✓ Healthy' : '✗ Degraded'
            }}</span>
          </div>
        </div>

        <div class="details-footer">
          <button
            v-if="!isConnected"
            class="btn btn-primary"
            @click="handleReconnect"
            :disabled="isReconnecting"
          >
            {{ isReconnecting ? 'Reconnecting...' : 'Reconnect' }}
          </button>
          <button
            v-else
            class="btn btn-secondary"
            @click="handleRefresh"
          >
            Refresh Metrics
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import websocketService, { ConnectionStatus, type ConnectionMetrics } from '@/services/websocket'

// ============================================================================
// State
// ============================================================================

const showDetails = ref(false)
const metrics = ref<ConnectionMetrics | null>(null)
const healthReport = ref<any>(null)
const queueStatus = ref<any>({ queueSize: 0, maxQueueSize: 100 })
const refreshInterval = ref<ReturnType<typeof setInterval> | null>(null)
const unsubscribeMertrics = ref<(() => void) | null>(null)
const unsubscribeConnection = ref<(() => void) | null>(null)

// ============================================================================
// Computed
// ============================================================================

const isConnected = computed(() => {
  return metrics.value?.status === ConnectionStatus.CONNECTED
})

const isReconnecting = computed(() => {
  return metrics.value?.status === ConnectionStatus.RECONNECTING
})

const statusLabel = computed(() => {
  switch (metrics.value?.status) {
    case ConnectionStatus.CONNECTED:
      return 'Connected'
    case ConnectionStatus.CONNECTING:
      return 'Connecting...'
    case ConnectionStatus.RECONNECTING:
      return 'Reconnecting...'
    case ConnectionStatus.DISCONNECTED:
      return 'Disconnected'
    case ConnectionStatus.FAILED:
      return 'Failed'
    default:
      return 'Unknown'
  }
})

const statusSecondary = computed(() => {
  if (isConnected.value && latency.value > 0) {
    return `${latency.value}ms`
  }
  if (isReconnecting.value) {
    return `${metrics.value?.reconnectAttempts}/${metrics.value?.maxReconnectAttempts}`
  }
  return ''
})

const connectionStatusClass = computed(() => {
  return {
    connected: isConnected.value,
    connecting: metrics.value?.status === ConnectionStatus.CONNECTING,
    reconnecting: isReconnecting.value,
    disconnected: metrics.value?.status === ConnectionStatus.DISCONNECTED,
    failed: metrics.value?.status === ConnectionStatus.FAILED,
  }
})

const statusBadgeClass = computed(() => {
  return {
    'status-connected': isConnected.value,
    'status-warning': isReconnecting.value,
    'status-error': metrics.value?.status === ConnectionStatus.FAILED,
  }
})

const latencyClass = computed(() => {
  if (!latency.value) return ''
  if (latency.value < 50) return 'text-green-500'
  if (latency.value < 100) return 'text-yellow-500'
  return 'text-red-500'
})

const healthClass = computed(() => {
  return isHealthy.value ? 'text-green-500' : 'text-red-500'
})

const latency = computed(() => metrics.value?.latency ?? 0)
const reconnectAttempts = computed(() => metrics.value?.reconnectAttempts ?? 0)
const maxReconnectAttempts = computed(() => metrics.value?.maxReconnectAttempts ?? 5)
const errorCount = computed(() => metrics.value?.errorCount ?? 0)
const messagesSent = computed(() => metrics.value?.messagesSent ?? 0)
const messagesReceived = computed(() => metrics.value?.messagesReceived ?? 0)
const isHealthy = computed(() => healthReport.value?.isHealthy ?? true)

const connectionDuration = computed(() => {
  if (!metrics.value?.lastConnectedAt) return 'N/A'
  const duration = metrics.value.connectionDuration
  const hours = Math.floor(duration / 3600000)
  const minutes = Math.floor((duration % 3600000) / 60000)
  const seconds = Math.floor((duration % 60000) / 1000)
  return `${hours}h ${minutes}m ${seconds}s`
})

// ============================================================================
// Methods
// ============================================================================

const updateMetrics = () => {
  metrics.value = websocketService.getMetrics()
  healthReport.value = websocketService.getHealthReport()
  queueStatus.value = websocketService.getQueueStatus()
}

const handleReconnect = async () => {
  try {
    await websocketService.reconnect()
  } catch (error) {
    console.error('Reconnection failed:', error)
  }
}

const handleRefresh = () => {
  updateMetrics()
}

// ============================================================================
// Lifecycle
// ============================================================================

onMounted(() => {
  // Initial metrics
  updateMetrics()

  // Subscribe to metrics updates
  unsubscribeMertrics.value = websocketService.onMetricsChange(() => {
    updateMetrics()
  })

  // Subscribe to connection status changes
  unsubscribeConnection.value = websocketService.onConnectionStatusChange(() => {
    updateMetrics()
  })

  // Periodic refresh
  refreshInterval.value = setInterval(updateMetrics, 2000)
})

onUnmounted(() => {
  if (refreshInterval.value) {
    clearInterval(refreshInterval.value)
  }
  if (unsubscribeMertrics.value) {
    unsubscribeMertrics.value()
  }
  if (unsubscribeConnection.value) {
    unsubscribeConnection.value()
  }
})
</script>

<style scoped>
.connection-status-container {
  position: relative;
  z-index: 100;
}

/* Connection Badge */
.connection-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  background-color: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  cursor: pointer;
  transition: all 0.3s ease;
  user-select: none;
}

.connection-badge:hover {
  background-color: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.5);
}

.connection-badge.connected {
  background-color: rgba(34, 197, 94, 0.1);
  border-color: rgba(34, 197, 94, 0.3);
}

.connection-badge.connected:hover {
  background-color: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.5);
}

.connection-badge.reconnecting {
  background-color: rgba(249, 115, 22, 0.1);
  border-color: rgba(249, 115, 22, 0.3);
}

.connection-badge.disconnected,
.connection-badge.failed {
  background-color: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
}

/* Status Icon */
.status-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: #22c55e;
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.spinner {
  display: inline-block;
  width: 8px;
  height: 8px;
  border: 2px solid rgba(249, 115, 22, 0.3);
  border-radius: 50%;
  border-top-color: #f97316;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.disconnect-icon {
  color: #ef4444;
  font-size: 12px;
  font-weight: bold;
}

/* Status Text */
.status-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.status-label {
  font-size: 12px;
  font-weight: 600;
  color: currentColor;
  white-space: nowrap;
}

.status-secondary {
  font-size: 11px;
  color: rgba(156, 163, 175, 1);
  white-space: nowrap;
}

/* Details Modal */
.connection-details {
  position: fixed;
  top: 60px;
  right: 16px;
  width: 320px;
  max-height: 80vh;
  background: linear-gradient(135deg, #1f2937 0%, #111827 100%);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 8px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
  z-index: 1001;
  overflow-y: auto;
}

/* Details Header */
.details-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid rgba(59, 130, 246, 0.2);
}

.details-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #e5e7eb;
}

.close-btn {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
  font-size: 16px;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: #f3f4f6;
}

/* Details Content */
.details-content {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  border-radius: 4px;
  background-color: rgba(255, 255, 255, 0.05);
}

.detail-item.warning {
  background-color: rgba(249, 115, 22, 0.1);
}

.detail-item label {
  font-size: 12px;
  color: #9ca3af;
  font-weight: 500;
}

.detail-item span {
  font-size: 12px;
  color: #e5e7eb;
  font-weight: 600;
}

.status-connected {
  color: #22c55e;
}

.status-warning {
  color: #f97316;
}

.status-error {
  color: #ef4444;
}

/* Details Footer */
.details-footer {
  padding: 12px 16px;
  border-top: 1px solid rgba(59, 130, 246, 0.2);
  display: flex;
  gap: 8px;
}

.btn {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background-color: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #2563eb;
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: rgba(255, 255, 255, 0.1);
  color: #e5e7eb;
}

.btn-secondary:hover {
  background-color: rgba(255, 255, 255, 0.15);
}

/* Transitions */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from {
  opacity: 0;
  transform: translateY(-10px);
}

.slide-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* Responsive */
@media (max-width: 640px) {
  .connection-details {
    width: calc(100vw - 32px);
    max-height: 60vh;
    right: 16px;
    left: 16px;
  }
}
</style>
