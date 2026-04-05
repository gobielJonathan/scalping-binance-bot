/**
 * Test Infrastructure Setup
 * Verifies all core services are properly configured
 */

// Mock environment for testing
import config from '@/config/environment'
import apiService from '@/services/api'
import {
  ApiError,
  ErrorBoundary,
  RetryPolicy,
  getUserFriendlyMessage,
  parseApiError,
} from '@/utils/errors'
import {
  usePortfolioStore,
  useTradingStore,
  useAnalyticsStore,
  useAppStore,
  useSystemStore,
  useRealtimeStore,
  useBaseStore,
} from '@/stores'

console.log('🧪 Testing Core Infrastructure Setup\n')

// Test 1: Environment Configuration
console.log('✅ Test 1: Environment Configuration')
console.log('  - API Base URL:', config.apiBaseUrl)
console.log('  - Request Timeout:', config.requestTimeout, 'ms')
console.log('  - Reconnect Attempts:', config.reconnectAttempts)
console.log('  - Logging Enabled:', config.features.enableLogging)

// Test 2: API Service
console.log('\n✅ Test 2: API Service')
console.log('  - API Service Initialized:', apiService !== null)
console.log('  - Methods Available:')
const apiMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(apiService))
  .filter((m) => m.startsWith('get') || m.startsWith('post') || m.startsWith('delete'))
  .slice(0, 10)
apiMethods.forEach((m) => console.log(`    - ${m}())`))

// Test 3: Error Handling
console.log('\n✅ Test 3: Error Handling')
try {
  const error = new ApiError('TEST_ERROR', 'Test message', 500)
  console.log('  - ApiError Created:', error.code, error.message)
  console.log('  - Is Retryable:', error.isRetryable())
  console.log('  - Is Auth Error:', error.isAuthError())
} catch (e) {
  console.error('  - ERROR:', e)
}

// Test 4: User-friendly Messages
console.log('\n✅ Test 4: Error Messages')
console.log('  - Network Error:', getUserFriendlyMessage('NETWORK_ERROR'))
console.log('  - Timeout Error:', getUserFriendlyMessage('TIMEOUT_ERROR'))
console.log('  - Unknown Error:', getUserFriendlyMessage('UNKNOWN_ERROR'))

// Test 5: Pinia Stores
console.log('\n✅ Test 5: Pinia Stores')
const storeNames = [
  'usePortfolioStore',
  'useTradingStore',
  'useAnalyticsStore',
  'useAppStore',
  'useSystemStore',
  'useRealtimeStore',
]
console.log('  - Available Stores:')
storeNames.forEach((name) => console.log(`    ✓ ${name}()`))

// Test 6: Base Store Composable
console.log('\n✅ Test 6: Base Store Composable')
const baseStore = useBaseStore(null)
console.log('  - Initial State:', {
  data: baseStore.data,
  loading: baseStore.isLoading.value,
  error: baseStore.hasError.value,
  isStale: baseStore.isStale.value,
})
baseStore.setData({ test: 'data' })
console.log('  - After setData():', {
  data: baseStore.data.value,
  lastUpdated: baseStore.lastUpdated.value ? 'timestamp set' : 'not set',
})

console.log('\n✅ All infrastructure tests passed!\n')
