/**
 * Environment Configuration
 * Configure API endpoints and feature flags
 */

interface EnvironmentConfig {
  apiBaseUrl: string
  socketUrl: string
  socketPath: string
  reconnectAttempts: number
  reconnectDelay: number
  requestTimeout: number
  features: {
    chartHistoryDays: number
    enableAutoConnect: boolean
    enableLogging: boolean
    enableDevTools: boolean
  }
}

const isDevelopment = import.meta.env.MODE === 'development'

const config: EnvironmentConfig = {
  // API Configuration
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  socketUrl: import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000',
  socketPath: import.meta.env.VITE_SOCKET_PATH || '/socket.io',

  // Connection Configuration
  reconnectAttempts: 5,
  reconnectDelay: 1000, // ms

  // Request Configuration
  requestTimeout: 30000, // 30 seconds

  // Feature Flags
  features: {
    chartHistoryDays: 7,
    enableAutoConnect: true,
    enableLogging: isDevelopment,
    enableDevTools: isDevelopment,
  },
}

export default config
