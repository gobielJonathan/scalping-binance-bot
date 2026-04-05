/**
 * App Store
 * UI and application-level state management
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAppStore = defineStore('app', () => {
  // ============================================================================
  // State
  // ============================================================================

  const theme = ref<'light' | 'dark'>('dark')
  const sidebarCollapsed = ref(false)
  const notifications = ref<
    Array<{ id: string; type: string; message: string; duration?: number }>
  >([])
  const connectionStatus = ref<'connected' | 'disconnected' | 'connecting'>(
    'disconnected'
  )
  const isInitialized = ref(false)

  // ============================================================================
  // Computed
  // ============================================================================

  const isDarkMode = computed(() => theme.value === 'dark')
  const isSidebarCollapsed = computed(() => sidebarCollapsed.value)
  const hasNotifications = computed(() => notifications.value.length > 0)
  const notificationCount = computed(() => notifications.value.length)
  const isConnected = computed(() => connectionStatus.value === 'connected')
  const isConnecting = computed(() => connectionStatus.value === 'connecting')

  // ============================================================================
  // Actions
  // ============================================================================

  /**
   * Set theme
   */
  function setTheme(newTheme: 'light' | 'dark') {
    theme.value = newTheme
    // Persist theme preference
    localStorage.setItem('theme', newTheme)
    // Apply to document
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  /**
   * Toggle theme
   */
  function toggleTheme() {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  /**
   * Toggle sidebar
   */
  function toggleSidebar() {
    sidebarCollapsed.value = !sidebarCollapsed.value
    localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed.value))
  }

  /**
   * Collapse sidebar
   */
  function collapseSidebar() {
    sidebarCollapsed.value = true
    localStorage.setItem('sidebarCollapsed', 'true')
  }

  /**
   * Expand sidebar
   */
  function expandSidebar() {
    sidebarCollapsed.value = false
    localStorage.setItem('sidebarCollapsed', 'false')
  }

  /**
   * Add notification
   */
  function addNotification(
    type: string,
    message: string,
    duration: number = 5000
  ) {
    const id = `notif-${Date.now()}-${Math.random()}`
    notifications.value.push({ id, type, message, duration })

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => {
        removeNotification(id)
      }, duration)
    }

    return id
  }

  /**
   * Remove notification by ID
   */
  function removeNotification(id: string) {
    const index = notifications.value.findIndex((n) => n.id === id)
    if (index > -1) {
      notifications.value.splice(index, 1)
    }
  }

  /**
   * Clear all notifications
   */
  function clearNotifications() {
    notifications.value = []
  }

  /**
   * Add success notification
   */
  function notifySuccess(message: string, duration?: number) {
    return addNotification('success', message, duration)
  }

  /**
   * Add error notification
   */
  function notifyError(message: string, duration?: number) {
    return addNotification('error', message, duration)
  }

  /**
   * Add warning notification
   */
  function notifyWarning(message: string, duration?: number) {
    return addNotification('warning', message, duration)
  }

  /**
   * Add info notification
   */
  function notifyInfo(message: string, duration?: number) {
    return addNotification('info', message, duration)
  }

  /**
   * Set connection status
   */
  function setConnectionStatus(
    status: 'connected' | 'disconnected' | 'connecting'
  ) {
    connectionStatus.value = status
  }

  /**
   * Mark app as initialized
   */
  function markInitialized() {
    isInitialized.value = true
  }

  /**
   * Load preferences from storage
   */
  function loadPreferences() {
    const savedTheme = localStorage.getItem('theme') as
      | 'light'
      | 'dark'
      | null
    if (savedTheme) {
      theme.value = savedTheme
    }

    const savedSidebarState = localStorage.getItem('sidebarCollapsed')
    if (savedSidebarState !== null) {
      sidebarCollapsed.value = savedSidebarState === 'true'
    }
  }

  /**
   * Reset store
   */
  function reset() {
    theme.value = 'dark'
    sidebarCollapsed.value = false
    notifications.value = []
    connectionStatus.value = 'disconnected'
    isInitialized.value = false
  }

  return {
    // State
    theme,
    sidebarCollapsed,
    notifications,
    connectionStatus,
    isInitialized,

    // Computed
    isDarkMode,
    isSidebarCollapsed,
    hasNotifications,
    notificationCount,
    isConnected,
    isConnecting,

    // Actions
    setTheme,
    toggleTheme,
    toggleSidebar,
    collapseSidebar,
    expandSidebar,
    addNotification,
    removeNotification,
    clearNotifications,
    notifySuccess,
    notifyError,
    notifyWarning,
    notifyInfo,
    setConnectionStatus,
    markInitialized,
    loadPreferences,
    reset,
  }
})
