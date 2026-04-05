<template>
  <div class="network-quality-indicator">
    <!-- Quality indicator bar -->
    <div class="quality-bar">
      <div
        class="quality-level"
        :class="`quality-${quality}`"
        :style="{ width: qualityPercent + '%' }"
      ></div>
    </div>

    <!-- Status details -->
    <div v-if="showDetails" class="quality-details">
      <div class="detail-item">
        <span class="detail-label">Connection:</span>
        <span class="detail-value">{{ isOnline ? 'Online' : 'Offline' }}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Quality:</span>
        <span class="detail-value" :class="`quality-text-${quality}`">{{ qualityLabel }}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">Latency:</span>
        <span class="detail-value">{{ avgLatency }}ms</span>
      </div>
      <div v-if="queuedItems > 0" class="detail-item">
        <span class="detail-label">Queued:</span>
        <span class="detail-value warning">{{ queuedItems }} action(s)</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { networkResilienceManager, NetworkQuality } from '@/services/resilience'

interface Props {
  showDetails?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showDetails: false,
})

const isOnline = ref(navigator.onLine)
const quality = ref<NetworkQuality>(NetworkQuality.EXCELLENT)
const avgLatency = ref(0)
const queuedItems = ref(0)

let unsubscribeStatus: (() => void) | null = null
let unsubscribeQuality: (() => void) | null = null

onMounted(() => {
  // Subscribe to network status changes
  unsubscribeStatus = networkResilienceManager.onStatusChange((online) => {
    isOnline.value = online
    updateQueuedItems()
  })

  // Subscribe to quality changes
  unsubscribeQuality = networkResilienceManager.onQualityChange((newQuality) => {
    quality.value = newQuality
    updateLatency()
  })

  // Initial values
  updateQueuedItems()
  updateLatency()
})

onUnmounted(() => {
  unsubscribeStatus?.()
  unsubscribeQuality?.()
})

function updateQueuedItems() {
  queuedItems.value = networkResilienceManager.getOfflineQueue().length
}

function updateLatency() {
  const stats = networkResilienceManager.getNetworkStats()
  avgLatency.value = stats.avgLatency
}

const qualityPercent = computed(() => {
  const percentages: Record<NetworkQuality, number> = {
    [NetworkQuality.EXCELLENT]: 100,
    [NetworkQuality.GOOD]: 80,
    [NetworkQuality.FAIR]: 60,
    [NetworkQuality.POOR]: 40,
    [NetworkQuality.CRITICAL]: 20,
  }
  return percentages[quality.value] || 0
})

const qualityLabel = computed(() => {
  const labels: Record<NetworkQuality, string> = {
    [NetworkQuality.EXCELLENT]: 'Excellent',
    [NetworkQuality.GOOD]: 'Good',
    [NetworkQuality.FAIR]: 'Fair',
    [NetworkQuality.POOR]: 'Poor',
    [NetworkQuality.CRITICAL]: 'Critical',
  }
  return labels[quality.value] || 'Unknown'
})
</script>

<style scoped>
.network-quality-indicator {
  width: 100%;
}

.quality-bar {
  height: 4px;
  background: #e5e7eb;
  border-radius: 2px;
  overflow: hidden;
}

.dark .quality-bar {
  background: #4b5563;
}

.quality-level {
  height: 100%;
  transition: width 0.3s ease;
}

.quality-excellent {
  background: linear-gradient(90deg, #10b981, #059669);
}

.quality-good {
  background: linear-gradient(90deg, #3b82f6, #2563eb);
}

.quality-fair {
  background: linear-gradient(90deg, #f59e0b, #d97706);
}

.quality-poor {
  background: linear-gradient(90deg, #ef5350, #e53935);
}

.quality-critical {
  background: linear-gradient(90deg, #991b1b, #7f1d1d);
  animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.8;
  }
}

.quality-details {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: #f9fafb;
  border-radius: 6px;
  font-size: 0.75rem;
}

.dark .quality-details {
  background: #2a2a3e;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  margin: 0.25rem 0;
}

.detail-label {
  font-weight: 600;
  color: #6b7280;
}

.dark .detail-label {
  color: #9ca3af;
}

.detail-value {
  color: #1f2937;
}

.dark .detail-value {
  color: #e5e7eb;
}

.quality-text-excellent {
  color: #10b981;
  font-weight: 600;
}

.quality-text-good {
  color: #3b82f6;
  font-weight: 600;
}

.quality-text-fair {
  color: #f59e0b;
  font-weight: 600;
}

.quality-text-poor {
  color: #ef5350;
  font-weight: 600;
}

.quality-text-critical {
  color: #991b1b;
  font-weight: 600;
  animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.detail-value.warning {
  color: #ef5350;
  font-weight: 600;
}
</style>
