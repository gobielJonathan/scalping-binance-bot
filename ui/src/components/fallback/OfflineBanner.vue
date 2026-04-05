<template>
  <div v-if="isOffline" class="offline-banner">
    <div class="banner-content">
      <svg class="offline-icon" fill="currentColor" viewBox="0 0 24 24">
        <path
          d="M1 9l2 2c4.97-4.97 13.03-4.97 18 0l2-2C16.93 2.93 7.08 2.93 1 9zm8 8l3 3 3-3c-1.65-1.66-4.34-1.66-6 0zm-4-4l2 2c2.76-2.76 7.24-2.76 10 0l2-2C15.14 9.14 8.87 9.14 5 13z"
        />
      </svg>

      <div class="banner-text">
        <p class="offline-title">You're Offline</p>
        <p class="offline-message">
          {{ offlineMessage }}
        </p>
      </div>

      <div v-if="queuedActions > 0" class="queue-indicator">
        {{ queuedActions }} action{{ queuedActions > 1 ? 's' : '' }} queued
      </div>
    </div>

    <div class="banner-progress">
      <div class="progress-bar" :style="{ width: progressPercent + '%' }"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { networkResilienceManager } from '@/services/resilience'

const isOffline = ref(!navigator.onLine)
const connectionDuration = ref(0)
const connectionTimer = ref<ReturnType<typeof setInterval> | null>(null)
const queuedActions = ref(0)
const maxConnectionDuration = 3600000 // 1 hour

onMounted(() => {
  // Subscribe to network status changes
  networkResilienceManager.onStatusChange((isOnline) => {
    isOffline.value = !isOnline
    if (isOnline) {
      connectionDuration.value = 0
      if (connectionTimer.value) {
        clearInterval(connectionTimer.value)
        connectionTimer.value = null
      }
    } else {
      // Start tracking offline duration
      connectionTimer.value = setInterval(() => {
        connectionDuration.value += 1000
      }, 1000)
    }
  })

  // Update queued actions count
  queuedActions.value = networkResilienceManager.getOfflineQueue().length
})

onUnmounted(() => {
  if (connectionTimer.value) {
    clearInterval(connectionTimer.value)
  }
})

const offlineMessage = computed(() => {
  if (connectionDuration.value === 0) {
    return 'You have lost connection to the internet. Some features may not work.'
  }

  const minutes = Math.floor(connectionDuration.value / 60000)
  if (minutes < 1) {
    return 'Reconnecting...'
  }

  return `Offline for ${minutes} minute${minutes > 1 ? 's' : ''}. Changes will sync when you reconnect.`
})

const progressPercent = computed(() => {
  return (connectionDuration.value / maxConnectionDuration) * 100
})
</script>

<style scoped>
.offline-banner {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: linear-gradient(135deg, #fca5a5, #f87171);
  color: white;
  z-index: 9999;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.dark .offline-banner {
  background: linear-gradient(135deg, #7f1d1d, #991b1b);
}

.banner-content {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
}

.offline-icon {
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.banner-text {
  flex: 1;
}

.offline-title {
  font-weight: 600;
  margin: 0;
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.offline-message {
  margin: 0.25rem 0 0;
  font-size: 0.875rem;
  opacity: 0.95;
}

.queue-indicator {
  background: rgba(255, 255, 255, 0.2);
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.banner-progress {
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: rgba(255, 255, 255, 0.4);
  transition: width 0.3s ease;
}
</style>
