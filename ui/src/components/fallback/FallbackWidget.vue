<template>
  <div class="fallback-widget">
    <!-- Loading state -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p class="loading-text">Loading {{ widgetName }}...</p>
    </div>

    <!-- Error state -->
    <div v-else-if="hasError" class="error-state">
      <svg class="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 8v4m0 4v2m0 0h2m-2 0h-2M7 7h10a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V9a2 2 0 012-2z"
        />
      </svg>
      <p class="error-title">{{ widgetName }} Unavailable</p>
      <p class="error-message">{{ errorMessage }}</p>
      <button v-if="retryable" class="retry-btn" @click="handleRetry">
        <span v-if="retrying" class="spinner-small" />
        {{ retrying ? 'Retrying...' : 'Try Again' }}
      </button>
    </div>

    <!-- Content with fallback -->
    <template v-else>
      <slot />
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Props {
  widgetName?: string
  isLoading?: boolean
  hasError?: boolean
  errorMessage?: string
  retryable?: boolean
  onRetry?: () => Promise<void>
}

const props = withDefaults(defineProps<Props>(), {
  widgetName: 'Widget',
  isLoading: false,
  hasError: false,
  errorMessage: 'Failed to load data. Please try again.',
  retryable: true,
})

const retrying = ref(false)

async function handleRetry() {
  if (!props.onRetry) return

  retrying.value = true
  try {
    await props.onRetry()
  } finally {
    retrying.value = false
  }
}
</script>

<style scoped>
.fallback-widget {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.loading-state,
.error-state {
  width: 100%;
  padding: 2rem;
  text-align: center;
}

.spinner {
  width: 40px;
  height: 40px;
  margin: 0 auto 1rem;
  border: 4px solid rgba(59, 130, 246, 0.1);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner-small {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
  margin-right: 0.5rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.loading-text {
  color: #6b7280;
  font-size: 0.875rem;
  margin: 0;
}

.dark .loading-text {
  color: #9ca3af;
}

.error-icon {
  width: 48px;
  height: 48px;
  margin: 0 auto 1rem;
  color: #ef4444;
}

.error-title {
  font-size: 1rem;
  font-weight: 600;
  color: #1f2937;
  margin: 0.5rem 0;
}

.dark .error-title {
  color: #f3f4f6;
}

.error-message {
  font-size: 0.875rem;
  color: #6b7280;
  margin: 0.5rem 0 1rem;
}

.dark .error-message {
  color: #9ca3af;
}

.retry-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.retry-btn:hover {
  background: #2563eb;
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}

.retry-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
