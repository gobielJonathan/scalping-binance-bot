/**
 * Integration tests for Pinia Stores
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createTestEnvironment } from '../utils/test-utils'
import { TestDataFactory } from '../utils/test-factories'
import { usePortfolioStore } from '@/stores/portfolio'
import { usePositionsStore } from '@/stores/positions'
import { useTradesStore } from '@/stores/trades'
import { useMarketStore } from '@/stores/market'

// Mock API service
const mockApiService = {
  getPortfolio: vi.fn(),
  getPositions: vi.fn(),
  getTradeHistory: vi.fn(),
  getMarketData: vi.fn(),
  executeTrade: vi.fn()
}

vi.mock('@/services/api', () => ({
  default: mockApiService
}))

describe('Pinia Store Integration', () => {
  let testEnv: ReturnType<typeof createTestEnvironment>

  beforeEach(() => {
    testEnv = createTestEnvironment()
    vi.clearAllMocks()
  })

  describe('Portfolio Store', () => {
    it('should fetch and update portfolio data', async () => {
      const portfolioStore = usePortfolioStore()
      const mockPortfolio = TestDataFactory.createPortfolio()

      mockApiService.getPortfolio.mockResolvedValue({
        success: true,
        data: mockPortfolio
      })

      expect(portfolioStore.isLoading).toBe(false)
      expect(portfolioStore.data).toBeNull()

      await portfolioStore.fetchData()

      expect(portfolioStore.isLoading).toBe(false)
      expect(portfolioStore.data).toEqual(mockPortfolio)
      expect(portfolioStore.hasError).toBe(false)
    })

    it('should handle portfolio fetch errors', async () => {
      const portfolioStore = usePortfolioStore()

      mockApiService.getPortfolio.mockResolvedValue({
        success: false,
        error: { code: 'NETWORK_ERROR', message: 'Network failed' }
      })

      await portfolioStore.fetchData()

      expect(portfolioStore.hasError).toBe(true)
      expect(portfolioStore.error?.code).toBe('NETWORK_ERROR')
      expect(portfolioStore.data).toBeNull()
    })

    it('should update portfolio via real-time data', () => {
      const portfolioStore = usePortfolioStore()
      const updatedPortfolio = TestDataFactory.createPortfolio({ pnl: 300 })

      portfolioStore.updateRealtime(updatedPortfolio)

      expect(portfolioStore.data).toEqual(updatedPortfolio)
      expect(portfolioStore.lastUpdated).toBeDefined()
    })

    it('should calculate derived portfolio metrics', async () => {
      const portfolioStore = usePortfolioStore()
      const mockPortfolio = TestDataFactory.createPortfolio({
        balance: 10000,
        pnl: 150,
        pnlPercentage: 1.5,
        winRate: 65.4,
        totalTrades: 50
      })

      mockApiService.getPortfolio.mockResolvedValue({
        success: true,
        data: mockPortfolio
      })

      await portfolioStore.fetchData()

      expect(portfolioStore.totalValue).toBe(10150) // balance + pnl
      expect(portfolioStore.profitability).toBe(1.5)
      expect(portfolioStore.performance.winRate).toBe(65.4)
    })
  })

  describe('Positions Store', () => {
    it('should fetch and manage positions', async () => {
      const positionsStore = usePositionsStore()
      const mockPositions = TestDataFactory.createMultiplePositions(3)

      mockApiService.getPositions.mockResolvedValue({
        success: true,
        data: mockPositions
      })

      await positionsStore.fetchData()

      expect(positionsStore.data).toEqual(mockPositions)
      expect(positionsStore.activePositions).toHaveLength(3)
    })

    it('should filter positions by type', async () => {
      const positionsStore = usePositionsStore()
      const mockPositions = [
        TestDataFactory.createPosition({ side: 'long', symbol: 'BTCUSDT' }),
        TestDataFactory.createPosition({ side: 'short', symbol: 'ETHUSDT' }),
        TestDataFactory.createPosition({ side: 'long', symbol: 'ADAUSDT' })
      ]

      mockApiService.getPositions.mockResolvedValue({
        success: true,
        data: mockPositions
      })

      await positionsStore.fetchData()

      expect(positionsStore.longPositions).toHaveLength(2)
      expect(positionsStore.shortPositions).toHaveLength(1)
    })

    it('should calculate total P&L across positions', async () => {
      const positionsStore = usePositionsStore()
      const mockPositions = [
        TestDataFactory.createPosition({ pnl: 100 }),
        TestDataFactory.createPosition({ pnl: -50 }),
        TestDataFactory.createPosition({ pnl: 25 })
      ]

      mockApiService.getPositions.mockResolvedValue({
        success: true,
        data: mockPositions
      })

      await positionsStore.fetchData()

      expect(positionsStore.totalPnL).toBe(75) // 100 - 50 + 25
    })

    it('should handle position updates via WebSocket', () => {
      const positionsStore = usePositionsStore()
      const initialPositions = TestDataFactory.createMultiplePositions(2)
      const updatedPosition = { ...initialPositions[0], pnl: 200 }

      positionsStore.setData(initialPositions)
      positionsStore.updatePosition(updatedPosition)

      const positions = positionsStore.data || []
      expect(positions[0].pnl).toBe(200)
      expect(positions[1]).toEqual(initialPositions[1])
    })
  })

  describe('Trades Store', () => {
    it('should fetch trade history with pagination', async () => {
      const tradesStore = useTradesStore()
      const mockTrades = TestDataFactory.createMultipleTrades(5)

      mockApiService.getTradeHistory.mockResolvedValue({
        success: true,
        data: mockTrades,
        pagination: { page: 1, limit: 10, total: 5, hasMore: false }
      })

      await tradesStore.fetchTradeHistory({ page: 1, limit: 10 })

      expect(tradesStore.trades).toEqual(mockTrades)
      expect(tradesStore.pagination?.hasMore).toBe(false)
    })

    it('should execute trades successfully', async () => {
      const tradesStore = useTradesStore()
      const mockTrade = TestDataFactory.createTrade({ status: 'filled' })

      mockApiService.executeTrade.mockResolvedValue({
        success: true,
        data: mockTrade
      })

      const tradeRequest = {
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        amount: 0.1,
        type: 'market' as const
      }

      const result = await tradesStore.executeTrade(tradeRequest)

      expect(result.success).toBe(true)
      expect(result.data?.status).toBe('filled')
    })

    it('should handle trade execution errors', async () => {
      const tradesStore = useTradesStore()

      mockApiService.executeTrade.mockResolvedValue({
        success: false,
        error: { code: 'INSUFFICIENT_BALANCE', message: 'Not enough balance' }
      })

      const tradeRequest = {
        symbol: 'BTCUSDT',
        side: 'buy' as const,
        amount: 10,
        type: 'market' as const
      }

      const result = await tradesStore.executeTrade(tradeRequest)

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('INSUFFICIENT_BALANCE')
    })

    it('should track recent trade activity', async () => {
      const tradesStore = useTradesStore()
      const mockTrades = TestDataFactory.createMultipleTrades(10)

      mockApiService.getTradeHistory.mockResolvedValue({
        success: true,
        data: mockTrades
      })

      await tradesStore.fetchTradeHistory()

      expect(tradesStore.recentTrades).toBeDefined()
      expect(tradesStore.todaysTrades.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Market Store', () => {
    it('should fetch market data for multiple symbols', async () => {
      const marketStore = useMarketStore()
      const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT']
      const mockMarketData = symbols.map(symbol => 
        TestDataFactory.createMarketData({ symbol })
      )

      mockApiService.getMarketData.mockResolvedValue({
        success: true,
        data: mockMarketData
      })

      await marketStore.fetchMarketData(symbols)

      expect(marketStore.marketData).toEqual(mockMarketData)
      expect(marketStore.getSymbolPrice('BTCUSDT')).toBeDefined()
    })

    it('should handle market data updates', () => {
      const marketStore = useMarketStore()
      const mockData = TestDataFactory.createMarketData({ 
        symbol: 'BTCUSDT', 
        price: 47000 
      })

      marketStore.updateMarketData(mockData)

      expect(marketStore.getSymbolPrice('BTCUSDT')).toBe(47000)
    })

    it('should calculate price changes', () => {
      const marketStore = useMarketStore()
      const mockData = TestDataFactory.createMarketData({ 
        symbol: 'BTCUSDT', 
        price: 46000,
        change24h: 2.5 
      })

      marketStore.setData([mockData])

      expect(marketStore.getPriceChange('BTCUSDT')).toBe(2.5)
    })
  })

  describe('Cross-store Integration', () => {
    it('should sync data between portfolio and positions stores', async () => {
      const portfolioStore = usePortfolioStore()
      const positionsStore = usePositionsStore()
      
      const mockPortfolio = TestDataFactory.createPortfolio({ pnl: 150 })
      const mockPositions = TestDataFactory.createMultiplePositions(2)

      mockApiService.getPortfolio.mockResolvedValue({
        success: true,
        data: mockPortfolio
      })
      mockApiService.getPositions.mockResolvedValue({
        success: true,
        data: mockPositions
      })

      await Promise.all([
        portfolioStore.fetchData(),
        positionsStore.fetchData()
      ])

      // Both stores should have consistent data
      expect(portfolioStore.data?.pnl).toBe(150)
      expect(positionsStore.data).toHaveLength(2)
    })

    it('should handle real-time updates across stores', () => {
      const portfolioStore = usePortfolioStore()
      const positionsStore = usePositionsStore()
      const marketStore = useMarketStore()

      // Simulate coordinated real-time updates
      const updatedPortfolio = TestDataFactory.createPortfolio({ pnl: 200 })
      const updatedPosition = TestDataFactory.createPosition({ pnl: 50 })
      const updatedMarket = TestDataFactory.createMarketData({ price: 47000 })

      portfolioStore.updateRealtime(updatedPortfolio)
      positionsStore.updatePosition(updatedPosition)
      marketStore.updateMarketData(updatedMarket)

      expect(portfolioStore.data?.pnl).toBe(200)
      expect(positionsStore.data?.find(p => p.id === updatedPosition.id)?.pnl).toBe(50)
      expect(marketStore.getSymbolPrice('BTCUSDT')).toBe(47000)
    })
  })
})