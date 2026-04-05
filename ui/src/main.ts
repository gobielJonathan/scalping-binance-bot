import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import Aura from '@primeuix/themes/aura'
import App from './App.vue'
import { ErrorBoundary } from '@/utils/errors'
import config from '@/config/environment'
import websocket from '@/services/websocket'
import { realtimeOrchestrator } from '@/services/realtime'
import { notificationsService } from '@/services/notifications'
import { useAppStore } from '@/stores'
import '@/styles/animations.css'

const app = createApp(App)

// Initialize Pinia for state management
const pinia = createPinia()
app.use(pinia)

// Initialize PrimeVue with Aura dark-aware theme
app.use(PrimeVue, {
  theme: {
    preset: Aura,
    options: {
      darkModeSelector: '.dark',
    },
  },
})

// Set up global error handling
ErrorBoundary.registerHandler('vue-error', (error) => {
  const appStore = useAppStore()
  appStore.addNotification(
    'error',
    'An error occurred. Please check the console for details.'
  )
  console.error('[Vue Error Handler]', error)
})

// Set up global error handler
app.config.errorHandler = (error, instance, info) => {
  console.error('[Vue Global Error Handler]', error, {
    componentName: instance?.$options.__name,
    lifecycleHook: info,
  })
  ErrorBoundary.executeSync(
    () => {
      const appStore = useAppStore()
      appStore.addNotification('error', 'An unexpected error occurred')
    },
    {
      onError: (err) => console.error('[Error in error handler]', err),
    }
  )
}

// Initialize WebSocket connection and real-time services on app startup
const initializeRealtimeServices = async () => {
  if (config.features.enableAutoConnect) {
    try {
      // Connect to WebSocket
      await websocket.connect()
      const appStore = useAppStore()
      appStore.setConnectionStatus('connected')

      // Initialize notifications service
      notificationsService.initialize()

      // Initialize real-time data orchestrator
      await realtimeOrchestrator.initialize()

      console.log('[App Startup] Real-time services initialized successfully')
    } catch (error) {
      console.error('[WebSocket Initialization]', error)
      const appStore = useAppStore()
      appStore.setConnectionStatus('disconnected')
    }
  }
}

// Provide services and utilities globally
app.provide('apiService', () => {
  const apiModule = import('@/services/api')
  return apiModule.then((m) => m.default)
})

// Mount and initialize
const mountApp = async () => {
  await initializeRealtimeServices()
  app.mount('#app')
}

mountApp().catch((error) => {
  console.error('[App Startup Error]', error)
})

