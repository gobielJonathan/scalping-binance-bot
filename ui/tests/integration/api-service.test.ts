/**
 * Integration tests for API Service
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import apiService from '@/services/api'
import { TestDataFactory } from '../utils/test-factories'

// Mock the config
vi.mock('@/config/environment', () => ({
  default: {
    apiBaseUrl: 'http://localhost:8080',
    requestTimeout: 5000,
    features: {
      enableLogging: false
    }
  }
}))

describe('API Service Integration', () => {
  let fetchMock: any

  beforeEach(() => {
    fetchMock = vi.fn()
    global.fetch = fetchMock
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Portfolio endpoints', () => {
    it('should fetch portfolio data successfully', async () => {
      const mockPortfolio = TestDataFactory.createPortfolio()
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: mockPortfolio, success: true })
      })

      const result = await apiService.getPortfolio()
      
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:8080/api/portfolio',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      )
      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockPortfolio)
    })

    it('should handle API errors gracefully', async () => {
      const mockError = TestDataFactory.createApiError('NETWORK_ERROR', 'Network unavailable')
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve(mockError)
      })

      const result = await apiService.getPortfolio()
      
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('NETWORK_ERROR')
    })

    it('should retry failed requests', async () => {
      const mockPortfolio = TestDataFactory.createPortfolio()
      
      // First call fails, second succeeds
      fetchMock
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          json: () => Promise.resolve({ error: { code: 'SERVICE_UNAVAILABLE' } })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: mockPortfolio, success: true })
        })

      const result = await apiService.getPortfolio()
      
      expect(fetchMock).toHaveBeenCalledTimes(2)
      expect(result.success).toBe(true)
    })
  })

  describe('Positions endpoints', () => {
    it('should fetch active positions', async () => {
      const mockPositions = TestDataFactory.createMultiplePositions(3)
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: mockPositions, success: true })
      })

      const result = await apiService.getPositions()
      
      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(3)
    })

    it('should handle empty positions list', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [], success: true })
      })

      const result = await apiService.getPositions()
      
      expect(result.success).toBe(true)
      expect(result.data).toEqual([])
    })
  })

  describe('Trades endpoints', () => {
    it('should fetch trade history with pagination', async () => {
      const mockTrades = TestDataFactory.createMultipleTrades(5)
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          data: mockTrades,
          pagination: { page: 1, limit: 10, total: 5, hasMore: false },
          success: true
        })
      })

      const result = await apiService.getTradeHistory({ limit: 10, page: 1 })
      
      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(5)
      expect(result.pagination?.hasMore).toBe(false)
    })

    it('should handle trade execution', async () => {
      const mockTrade = TestDataFactory.createTrade()
      fetchMock.mockResolvedValue({
        ok: true,
        status: 201,
        json: () => Promise.resolve({ data: mockTrade, success: true })
      })

      const tradeRequest = {
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        amount: 0.1,
        type: 'market' as const
      }

      const result = await apiService.executeTrade(tradeRequest)
      
      expect(result.success).toBe(true)
      expect(result.data?.symbol).toBe('BTCUSDT')
    })
  })

  describe('Market data endpoints', () => {
    it('should fetch market data', async () => {
      const mockMarketData = TestDataFactory.createMarketData()
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [mockMarketData], success: true })
      })

      const result = await apiService.getMarketData(['BTCUSDT'])
      
      expect(result.success).toBe(true)
      expect(result.data).toHaveLength(1)
    })
  })

  describe('Error handling', () => {
    it('should handle network timeouts', async () => {
      fetchMock.mockRejectedValue(new Error('fetch timeout'))

      const result = await apiService.getPortfolio()
      
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('NETWORK_ERROR')
    })

    it('should handle malformed JSON responses', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Invalid JSON'))
      })

      const result = await apiService.getPortfolio()
      
      expect(result.success).toBe(false)
    })

    it('should handle rate limiting', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({ 
          error: { 
            code: 'RATE_LIMITED', 
            message: 'Too many requests',
            retryAfter: 1000
          } 
        })
      })

      const result = await apiService.getPortfolio()
      
      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('RATE_LIMITED')
    })
  })
})