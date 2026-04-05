import { createPinia, setActivePinia } from 'pinia'
import { createApp } from 'vue'
import type { App } from 'vue'
import { mount, VueWrapper } from '@vue/test-utils'

/**
 * Test utilities for Vue components with Pinia store integration
 */
export interface TestEnvironment {
  app: App
  pinia: any
}

export function createTestEnvironment(): TestEnvironment {
  const app = createApp({})
  const pinia = createPinia()
  app.use(pinia)
  setActivePinia(pinia)
  
  return { app, pinia }
}

export function mountWithPinia(component: any, options: any = {}) {
  const { pinia } = createTestEnvironment()
  
  return mount(component, {
    global: {
      plugins: [pinia],
      ...options.global
    },
    ...options
  })
}

/**
 * Wait for Vue's nextTick and additional timeouts
 */
export async function waitFor(ms: number = 0) {
  await new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Helper to wait for component animations
 */
export async function waitForAnimation(wrapper: VueWrapper<any>, selector?: string) {
  await wrapper.vm.$nextTick()
  await waitFor(100) // Default animation duration
}

/**
 * Mock fetch for API testing
 */
export function mockFetch(responseData: any, status: number = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(responseData),
    text: () => Promise.resolve(JSON.stringify(responseData))
  })
}

/**
 * Create mock WebSocket for real-time testing
 */
export function createMockWebSocket() {
  const listeners: Record<string, Function[]> = {}
  
  return {
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn((event: string, callback: Function) => {
      if (!listeners[event]) listeners[event] = []
      listeners[event].push(callback)
    }),
    removeEventListener: vi.fn(),
    readyState: 1,
    trigger: (event: string, data?: any) => {
      listeners[event]?.forEach(callback => callback(data))
    }
  }
}

/**
 * Helper to trigger resize events for responsive testing
 */
export function triggerResize(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  })
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  })
  window.dispatchEvent(new Event('resize'))
}

export * from '@testing-library/vue'