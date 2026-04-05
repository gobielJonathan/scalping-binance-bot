<template>
  <div v-if="show" class="error-toast" :class="`error-toast-${level}`">
    <div class="toast-icon">
      <svg
        v-if="level === 'error' || level === 'critical'"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
        />
      </svg>
      <svg v-else-if="level === 'warning'" fill="currentColor" viewBox="0 0 24 24">
        <path
          d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"
        />
      </svg>
      <svg v-else-if="level === 'success'" fill="currentColor" viewBox="0 0 24 24">
        <path
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
        />
      </svg>
      <svg v-else fill="currentColor" viewBox="0 0 24 24">
        <path
          d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"
        />
      </svg>
    </div>

    <div class="toast-content">
      <p v-if="title" class="toast-title">{{ title }}</p>
      <p class="toast-message">{{ message }}</p>
    </div>

    <button v-if="dismissible" class="toast-close" @click="handleDismiss">
      <svg fill="currentColor" viewBox="0 0 24 24">
        <path
          d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"
        />
      </svg>
    </button>

    <div v-if="autoClose" class="toast-progress">
      <div class="progress-bar" :style="{ width: progressWidth + '%' }"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

interface Props {
  level?: 'success' | 'error' | 'warning' | 'info' | 'critical'
  title?: string
  message: string
  duration?: number
  dismissible?: boolean
  action?: {
    label: string
    callback: () => void
  }
}

const props = withDefaults(defineProps<Props>(), {
  level: 'info',
  message: '',
  duration: 5000,
  dismissible: true,
})

const emit = defineEmits<{
  dismiss: []
}>()

const show = ref(true)
const timeRemaining = ref(props.duration)
const progressWidth = computed(() => {
  return (timeRemaining.value / props.duration) * 100
})

const autoClose = computed(() => props.duration > 0 && props.duration < Infinity)

let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  if (autoClose.value) {
    timer = setInterval(() => {
      timeRemaining.value -= 100
      if (timeRemaining.value <= 0) {
        handleDismiss()
      }
    }, 100)
  }
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
})

function handleDismiss() {
  show.value = false
  if (timer) {
    clearInterval(timer)
  }
  emit('dismiss')
}

watch(
  () => props.duration,
  (newDuration) => {
    timeRemaining.value = newDuration
  }
)
</script>

<style scoped>
.error-toast {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  display: flex;
  gap: 1rem;
  align-items: flex-start;
  max-width: 400px;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 10px 35px rgba(0, 0, 0, 0.2);
  z-index: 9998;
  animation: slideInUp 0.3s ease-out;
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.dark .error-toast {
  background: #1a1a2e;
  color: #eee;
}

.error-toast-error {
  border-left: 4px solid #ef4444;
}

.dark .error-toast-error {
  border-left-color: #f87171;
}

.error-toast-warning {
  border-left: 4px solid #f59e0b;
}

.error-toast-success {
  border-left: 4px solid #10b981;
}

.error-toast-info {
  border-left: 4px solid #3b82f6;
}

.error-toast-critical {
  border-left: 4px solid #8b5cf6;
}

.toast-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  color: #ef4444;
}

.error-toast-warning .toast-icon {
  color: #f59e0b;
}

.error-toast-success .toast-icon {
  color: #10b981;
}

.error-toast-info .toast-icon {
  color: #3b82f6;
}

.error-toast-critical .toast-icon {
  color: #8b5cf6;
}

.toast-content {
  flex: 1;
  min-width: 0;
}

.toast-title {
  font-weight: 600;
  margin: 0 0 0.25rem;
  font-size: 0.875rem;
}

.toast-message {
  margin: 0;
  font-size: 0.875rem;
  color: #6b7280;
}

.dark .toast-message {
  color: #d1d5db;
}

.toast-close {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  color: #9ca3af;
  transition: color 0.2s;
}

.toast-close:hover {
  color: #6b7280;
}

.dark .toast-close:hover {
  color: #d1d5db;
}

.toast-progress {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 0 0 8px 8px;
  overflow: hidden;
}

.progress-bar {
  height: 100%;
  background: currentColor;
  opacity: 0.5;
  transition: width 0.1s linear;
}

.error-toast-error .progress-bar {
  background: #ef4444;
}

.error-toast-warning .progress-bar {
  background: #f59e0b;
}

.error-toast-success .progress-bar {
  background: #10b981;
}

.error-toast-info .progress-bar {
  background: #3b82f6;
}

@media (max-width: 640px) {
  .error-toast {
    bottom: 1rem;
    right: 1rem;
    left: 1rem;
    max-width: none;
  }
}
</style>
