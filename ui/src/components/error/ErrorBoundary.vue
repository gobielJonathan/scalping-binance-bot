<template>
  <component :is="'div'" class="error-boundary">
    <!-- Normal content -->
    <template v-if="!hasError">
      <slot />
    </template>

    <!-- Error UI -->
    <template v-else>
      <div class="error-boundary-container">
        <div class="error-content">
          <!-- Error Icon -->
          <div class="error-icon" :class="`error-${errorCategory}`">
            <svg
              v-if="errorCategory === 'network'"
              class="icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
              />
            </svg>
            <svg
              v-else-if="errorCategory === 'data'"
              class="icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 9v2m0 4v2m0 4v2M6.34 7.66A9 9 0 119.66 6.34M9 2h6m0 16H9"
              />
            </svg>
            <svg
              v-else-if="errorCategory === 'component'"
              class="icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4m0 4v2m0 0h2m-2 0h-2M7 7h10a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V9a2 2 0 012-2z"
              />
            </svg>
            <svg
              v-else
              class="icon"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4m0 4v2m0 0h2m-2 0h-2M7 7h10a2 2 0 012 2v10a2 2 0 01-2 2H7a2 2 0 01-2-2V9a2 2 0 012-2z"
              />
            </svg>
          </div>

          <!-- Error Title and Message -->
          <h2 class="error-title">{{ errorTitle }}</h2>
          <p class="error-message">{{ errorMessage }}</p>

          <!-- Recovery Suggestions -->
          <div v-if="recoverySuggestions.length > 0" class="recovery-suggestions">
            <h3 class="suggestions-title">What you can try:</h3>
            <ul class="suggestions-list">
              <li v-for="suggestion in recoverySuggestions" :key="suggestion">
                {{ suggestion }}
              </li>
            </ul>
          </div>

          <!-- Error Details (Development Only) -->
          <details v-if="isDevelopment && error" class="error-details">
            <summary>Technical Details</summary>
            <pre class="error-stack">{{ formatError(error) }}</pre>
          </details>

          <!-- Action Buttons -->
          <div class="error-actions">
            <button class="btn btn-primary" @click="handleRetry">
              <span v-if="retrying" class="spinner" />
              {{ retrying ? 'Retrying...' : 'Try Again' }}
            </button>

            <button v-if="supportsGoBack" class="btn btn-secondary" @click="handleGoBack">
              Go Back
            </button>

            <button v-if="isDevelopment" class="btn btn-secondary" @click="handleReportError">
              Report Error
            </button>
          </div>

          <!-- Error ID for Support -->
          <div class="error-id">Error ID: {{ errorId }}</div>
        </div>
      </div>
    </template>
  </component>
</template>

<script setup lang="ts">
import { ref, computed, onErrorCaptured } from 'vue'
import {
  ApiError,
  logError,
  getUserFriendlyMessage,
  formatErrorForLogging,
} from '@/utils/errors'
import { notificationsService, NotificationLevel } from '@/services/notifications'
import { monitoringService } from '@/services/monitoring'

/**
 * Props
 */
interface Props {
  showDetails?: boolean
  retryable?: boolean
  onError?: (error: Error) => void
  reportError?: (error: Error, context: any) => Promise<void>
}

const props = withDefaults(defineProps<Props>(), {
  showDetails: false,
  retryable: true,
})

/**
 * Setup
 */
const isDevelopment = import.meta.env.MODE === 'development'

/**
 * State
 */
const hasError = ref(false)
const error = ref<Error | null>(null)
const errorId = ref('')
const retrying = ref(false)
const retryCount = ref(0)
const maxRetries = 3

/**
 * Error categorization
 */
const errorCategory = computed(() => {
  if (!error.value) return 'unknown'

  const message = error.value.message.toLowerCase()

  if (message.includes('network') || message.includes('fetch') || message.includes('offline')) {
    return 'network'
  }
  if (
    message.includes('data') ||
    message.includes('parse') ||
    message.includes('json') ||
    message.includes('validation')
  ) {
    return 'data'
  }
  if (message.includes('component') || message.includes('render')) {
    return 'component'
  }

  return 'critical'
})

/**
 * Error title
 */
const errorTitle = computed(() => {
  switch (errorCategory.value) {
    case 'network':
      return '🌐 Connection Problem'
    case 'data':
      return '📊 Data Error'
    case 'component':
      return '⚙️ Component Error'
    default:
      return '❌ Something Went Wrong'
  }
})

/**
 * Error message
 */
const errorMessage = computed(() => {
  if (!error.value) return 'An unknown error occurred.'

  if (error.value instanceof ApiError) {
    return getUserFriendlyMessage(error.value.code, error.value.message)
  }

  return error.value.message || 'An unexpected error occurred.'
})

/**
 * Recovery suggestions
 */
const recoverySuggestions = computed(() => {
  const suggestions: string[] = []

  switch (errorCategory.value) {
    case 'network':
      suggestions.push(
        'Check your internet connection',
        'Try refreshing the page',
        'Wait a moment and try again',
        'Check if the server is running'
      )
      break

    case 'data':
      suggestions.push(
        'Refresh the page to reload data',
        'Clear your browser cache',
        'Try a different action',
        'Contact support if the problem persists'
      )
      break

    case 'component':
      suggestions.push(
        'Refresh the page',
        'Clear your browser cache and cookies',
        'Try a different browser',
        'Contact support if the problem persists'
      )
      break

    default:
      suggestions.push(
        'Try refreshing the page',
        'Check your connection',
        'Try again later',
        'Contact support if the problem persists'
      )
  }

  return suggestions
})

/**
 * Supports going back
 */
const supportsGoBack = computed(() => {
  return window.history.length > 1
})

/**
 * Reset error
 */
function resetError(): void {
  hasError.value = false
  error.value = null
  retryCount.value = 0
}

/**
 * Handle retry
 */
async function handleRetry(): Promise<void> {
  if (retrying.value || retryCount.value >= maxRetries) return

  retrying.value = true
  retryCount.value++

  try {
    // Wait a bit before retrying
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Try to recover
    resetError()

    // Notify user
    notificationsService.notifyTradeExecution({
      id: `retry-${Date.now()}`,
      symbol: 'RETRY',
      side: 'buy',
      quantity: 0,
      price: 0,
      executionPrice: 0,
      executedAt: new Date().toISOString(),
    } as any)
  } catch (err) {
    console.error('Retry failed:', err)
  } finally {
    retrying.value = false
  }
}

/**
 * Handle go back
 */
function handleGoBack(): void {
  window.history.back()
}

/**
 * Handle report error
 */
async function handleReportError(): Promise<void> {
  if (!error.value || !props.reportError) return

  try {
    await props.reportError(error.value, {
      errorId: errorId.value,
      category: errorCategory.value,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    })

    notificationsService.notifySystemAlert({
      id: `report-${Date.now()}`,
      message: 'Thank you for reporting this issue.',
      category: 'success',
      level: 'info',
    } as any)
  } catch (err) {
    notificationsService.notifySystemAlert({
      id: `report-error-${Date.now()}`,
      message: 'Failed to report error. Please try again.',
      category: 'error',
      level: 'error',
    } as any)
  }
}

/**
 * Format error for display
 */
function formatError(err: Error): string {
  return `${err.name}: ${err.message}\n\n${err.stack || 'No stack trace available'}`
}

/**
 * Handle errors from child components
 */
onErrorCaptured((err, instance, info) => {
  hasError.value = true
  error.value = err instanceof Error ? err : new Error(String(err))
  errorId.value = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  // Log error
  logError(
    error.value,
    'ErrorBoundary',
    {
      component: instance?.$options.name || instance?.$options.__name,
      info,
      errorId: errorId.value,
    }
  )

  // Record error in monitoring
  monitoringService.recordError(`${errorCategory.value.toUpperCase()}_ERROR`)

  // Call custom error handler if provided
  if (props.onError) {
    try {
      props.onError(error.value)
    } catch (handlerErr) {
      console.error('Error handler failed:', handlerErr)
    }
  }

  // Prevent propagation to parent error boundary
  return false
})
</script>

<style scoped>
.error-boundary {
  width: 100%;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
}

.error-boundary-container {
  width: 100%;
  max-width: 600px;
  padding: 2rem;
}

.error-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
  padding: 3rem 2rem;
  text-align: center;
}

.dark .error-content {
  background: #1a1a2e;
  color: #eee;
}

.error-icon {
  width: 80px;
  height: 80px;
  margin: 0 auto 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.error-icon.error-network {
  background: rgba(59, 130, 246, 0.1);
  color: #3b82f6;
}

.error-icon.error-data {
  background: rgba(168, 85, 247, 0.1);
  color: #a855f7;
}

.error-icon.error-component {
  background: rgba(234, 179, 8, 0.1);
  color: #eab308;
}

.icon {
  width: 50%;
  height: 50%;
}

.error-title {
  font-size: 1.75rem;
  font-weight: 700;
  margin: 0 0 0.75rem;
  color: #1f2937;
}

.dark .error-title {
  color: #fff;
}

.error-message {
  font-size: 1rem;
  color: #6b7280;
  margin: 0 0 1.5rem;
  line-height: 1.6;
}

.dark .error-message {
  color: #d1d5db;
}

.recovery-suggestions {
  margin: 2rem 0;
  padding: 1.5rem;
  background: #f9fafb;
  border-radius: 8px;
  text-align: left;
}

.dark .recovery-suggestions {
  background: #2a2a3e;
}

.suggestions-title {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0 0 0.75rem;
  color: #374151;
}

.dark .suggestions-title {
  color: #9ca3af;
}

.suggestions-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.suggestions-list li {
  padding: 0.5rem 0;
  padding-left: 1.5rem;
  position: relative;
  color: #4b5563;
  font-size: 0.875rem;
}

.dark .suggestions-list li {
  color: #d1d5db;
}

.suggestions-list li:before {
  content: '✓';
  position: absolute;
  left: 0;
  color: #10b981;
  font-weight: bold;
}

.error-details {
  margin: 1.5rem 0;
  padding: 1rem;
  background: #f3f4f6;
  border-radius: 8px;
  text-align: left;
}

.dark .error-details {
  background: #2a2a3e;
}

.error-details summary {
  cursor: pointer;
  color: #6b7280;
  font-size: 0.875rem;
  font-weight: 600;
  user-select: none;
}

.dark .error-details summary {
  color: #9ca3af;
}

.error-stack {
  margin: 0.75rem 0 0;
  padding: 1rem;
  background: #1f2937;
  color: #10b981;
  border-radius: 6px;
  overflow-x: auto;
  font-size: 0.75rem;
  line-height: 1.5;
  max-height: 300px;
  overflow-y: auto;
}

.error-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
  margin: 2rem 0 1rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #2563eb;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: #e5e7eb;
  color: #1f2937;
}

.dark .btn-secondary {
  background: #4b5563;
  color: #e5e7eb;
}

.btn-secondary:hover {
  background: #d1d5db;
  transform: translateY(-2px);
}

.spinner {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 2px solid #ffffff;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-id {
  margin-top: 1.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid #e5e7eb;
  font-size: 0.75rem;
  color: #9ca3af;
  font-family: monospace;
  word-break: break-all;
}

.dark .error-id {
  border-top-color: #4b5563;
  color: #6b7280;
}
</style>
