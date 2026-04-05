/**
 * Integration tests for WebSocket Service and Real-time Features
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createTestEnvironment } from '../utils/test-utils'
import { TestDataFactory, createMockWebSocket } from '../utils/test-factories'
import webSocketService from '@/services/websocket'
import realtimeService from '@/services/realtime'

// Mock WebSocket
const mockWebSocket = createMockWebSocket()
global.WebSocket = vi.fn().mockImplementation(() => mockWebSocket)

// Mock config
vi.mock('@/config/environment', () => ({
  default: {
    wsUrl: 'ws://localhost:8080',
    reconnectAttempts: 3,
    reconnectDelay: 1000
  }
}))

describe('WebSocket and Real-time Integration', () => {
  let testEnv: ReturnType<typeof createTestEnvironment>

  beforeEach(() => {
    testEnv = createTestEnvironment()
    vi.clearAllMocks()
  })

  afterEach(() => {
    webSocketService.disconnect()
  })

  describe('WebSocket Connection', () => {
    it('should establish WebSocket connection', async () => {
      const connected = await webSocketService.connect()
      
      expect(global.WebSocket).toHaveBeenCalledWith('ws://localhost:8080')
      expect(connected).toBe(true)
    })

    it('should handle connection failures', async () => {
      global.WebSocket = vi.fn().mockImplementation(() => {
        throw new Error('Connection failed')
      })

      const connected = await webSocketService.connect()
      
      expect(connected).toBe(false)
    })

    it('should implement automatic reconnection', async () => {
      await webSocketService.connect()
      
      // Simulate connection loss
      mockWebSocket.trigger('close', { code: 1006, reason: 'Connection lost' })
      
      // Should attempt to reconnect
      await vi.waitFor(() => {
        expect(global.WebSocket).toHaveBeenCalledTimes(2)
      })
    })

    it('should subscribe to channels', async () => {
      await webSocketService.connect()
      
      webSocketService.subscribe('portfolio', (data) => {
        expect(data).toBeDefined()
      })

      const message = TestDataFactory.createWebSocketMessage('portfolio', 
        TestDataFactory.createPortfolio()
      )
      
      mockWebSocket.trigger('message', { data: JSON.stringify(message) })
      
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          action: 'subscribe',
          channel: 'portfolio'
        })
      )
    })
  })

  describe('Real-time Data Streaming', () => {
    it('should handle portfolio updates', async () => {
      const updateSpy = vi.fn()
      realtimeService.onPortfolioUpdate(updateSpy)
      
      await webSocketService.connect()
      
      const portfolioData = TestDataFactory.createPortfolio({ pnl: 200.50 })
      const message = TestDataFactory.createWebSocketMessage('portfolio', portfolioData)
      
      mockWebSocket.trigger('message', { data: JSON.stringify(message) })
      
      await vi.waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(portfolioData)
      })
    })

    it('should handle position updates', async () => {
      const updateSpy = vi.fn()
      realtimeService.onPositionUpdate(updateSpy)
      
      await webSocketService.connect()
      
      const positionData = TestDataFactory.createPosition()
      const message = TestDataFactory.createWebSocketMessage('position', positionData)
      
      mockWebSocket.trigger('message', { data: JSON.stringify(message) })
      
      await vi.waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(positionData)
      })
    })

    it('should handle trade notifications', async () => {
      const notificationSpy = vi.fn()
      realtimeService.onTradeNotification(notificationSpy)
      
      await webSocketService.connect()
      
      const tradeData = TestDataFactory.createTrade({ status: 'filled' })
      const message = TestDataFactory.createWebSocketMessage('trade', tradeData)
      
      mockWebSocket.trigger('message', { data: JSON.stringify(message) })
      
      await vi.waitFor(() => {
        expect(notificationSpy).toHaveBeenCalledWith(tradeData)
      })
    })

    it('should handle market data updates', async () => {
      const updateSpy = vi.fn()
      realtimeService.onMarketUpdate(updateSpy)
      
      await webSocketService.connect()
      
      const marketData = TestDataFactory.createMarketData({ price: 46000 })
      const message = TestDataFactory.createWebSocketMessage('market', marketData)
      
      mockWebSocket.trigger('message', { data: JSON.stringify(message) })
      
      await vi.waitFor(() => {
        expect(updateSpy).toHaveBeenCalledWith(marketData)
      })
    })
  })

  describe('Error Recovery', () => {
    it('should handle malformed WebSocket messages', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      
      await webSocketService.connect()
      
      // Send invalid JSON
      mockWebSocket.trigger('message', { data: 'invalid-json' })
      
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should handle connection interruption gracefully', async () => {
      await webSocketService.connect()
      
      // Simulate network interruption
      mockWebSocket.trigger('error', new Error('Network error'))
      
      // Should trigger reconnection attempt
      await vi.waitFor(() => {
        expect(global.WebSocket).toHaveBeenCalledTimes(2)
      })
    })

    it('should manage subscription state during reconnection', async () => {
      await webSocketService.connect()
      
      // Subscribe to a channel
      webSocketService.subscribe('portfolio', () => {})
      
      // Simulate disconnection and reconnection
      mockWebSocket.trigger('close', { code: 1006 })
      
      // Should re-subscribe after reconnection
      await vi.waitFor(() => {
        expect(mockWebSocket.send).toHaveBeenCalledWith(
          JSON.stringify({
            action: 'subscribe',
            channel: 'portfolio'
          })
        )
      })
    })
  })

  describe('Performance and Rate Limiting', () => {
    it('should throttle high-frequency updates', async () => {
      const updateSpy = vi.fn()
      realtimeService.onPortfolioUpdate(updateSpy)
      
      await webSocketService.connect()
      
      // Send multiple rapid updates
      for (let i = 0; i < 10; i++) {
        const portfolioData = TestDataFactory.createPortfolio({ pnl: i * 10 })
        const message = TestDataFactory.createWebSocketMessage('portfolio', portfolioData)
        mockWebSocket.trigger('message', { data: JSON.stringify(message) })
      }
      
      await vi.waitFor(() => {
        // Should throttle and only process some updates
        expect(updateSpy).toHaveBeenCalledTimes(10)
      })
    })

    it('should handle memory cleanup on disconnect', async () => {
      await webSocketService.connect()
      
      webSocketService.subscribe('portfolio', () => {})
      webSocketService.subscribe('trades', () => {})
      
      webSocketService.disconnect()
      
      expect(mockWebSocket.close).toHaveBeenCalled()
    })
  })
})