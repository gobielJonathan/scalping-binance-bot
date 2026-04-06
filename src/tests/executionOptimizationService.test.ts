import { ExecutionOptimizationService } from '../services/executionOptimizationService';
import { BinanceService } from '../services/binanceService';
import { OrderRequest, MarketData, MarketDepth, SmartRoutingDecision } from '../types';
import { OrderType } from 'binance-api-node';

// Mock BinanceService
const mockBinanceService = {
  placeOrder: jest.fn(),
  getOrderBook: jest.fn(),
  isConnected: jest.fn().mockReturnValue(true)
};

describe('ExecutionOptimizationService', () => {
  let executionOptimizationService: ExecutionOptimizationService;

  beforeEach(() => {
    jest.clearAllMocks();
    executionOptimizationService = new ExecutionOptimizationService(mockBinanceService as unknown as BinanceService);
  });

  describe('Order Optimization', () => {
    test('should optimize order execution', async () => {
      const orderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: OrderType.MARKET,
        quantity: 0.01
      };

      const marketData: MarketData = {
        symbol: 'BTCUSDT',
        price: 50000,
        volume24h: 1000000,
        priceChange24h: 100,
        priceChangePercent24h: 0.2,
        bid: 49999,
        ask: 50001,
        spread: 2,
        timestamp: Date.now()
      };

      const mockMarketDepth: MarketDepth = {
        symbol: 'BTCUSDT',
        bids: [
          { price: 49999, quantity: 1 },
          { price: 49998, quantity: 2 }
        ],
        asks: [
          { price: 50001, quantity: 1 },
          { price: 50002, quantity: 2 }
        ],
        timestamp: Date.now()
      };

      mockBinanceService.getOrderBook!.mockResolvedValue({
        bids: [['49999', '1'], ['49998', '2']],
        asks: [['50001', '1'], ['50002', '2']]
      });

      const optimization = await executionOptimizationService.optimizeOrderExecution(
        orderRequest,
        marketData
      );

      expect(optimization.optimizedOrder).toBeDefined();
      expect(optimization.executionPlan).toBeDefined();
      expect(optimization.estimatedSlippage).toBeGreaterThanOrEqual(0);
      expect(optimization.estimatedFees).toBeGreaterThanOrEqual(0);
    });

    test('should estimate slippage correctly', async () => {
      const orderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: OrderType.MARKET,
        quantity: 0.001 // Small order
      };

      const marketData: MarketData = {
        symbol: 'BTCUSDT',
        price: 50000,
        volume24h: 1000000,
        priceChange24h: 100,
        priceChangePercent24h: 0.2,
        bid: 49999,
        ask: 50001,
        spread: 2,
        timestamp: Date.now()
      };

      mockBinanceService.getOrderBook!.mockResolvedValue({
        bids: [['49999', '1']],
        asks: [['50001', '1']]
      });

      const optimization = await executionOptimizationService.optimizeOrderExecution(
        orderRequest,
        marketData
      );

      // Small orders should have minimal slippage
      expect(optimization.estimatedSlippage).toBeLessThan(0.001);
    });
  });

  describe('Order Execution', () => {
    test('should execute optimized order', async () => {
      const orderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: OrderType.MARKET,
        quantity: 0.01
      };

      const executionPlan: SmartRoutingDecision = {
        symbol: 'BTCUSDT',
        orderSize: 0.01,
        recommendedExchange: 'Binance',
        recommendedOrderType: OrderType.MARKET,
        estimatedSlippage: 0.0001,
        estimatedFees: 0.5,
        estimatedExecutionTime: 100,
        confidence: 0.9,
        reasoning: 'Small order, market execution acceptable',
        timestamp: Date.now()
      };

      const mockExecutionResult = {
        orderId: 'test-order-123',
        symbol: 'BTCUSDT',
        side: 'BUY',
        quantity: '0.01',
        price: '50000',
        avgPrice: '50000',
        commission: '0.5'
      };

      mockBinanceService.placeOrder!.mockResolvedValue(mockExecutionResult);

      const execution = await executionOptimizationService.executeOptimizedOrder(
        orderRequest,
        executionPlan
      );

      expect(execution.executedOrder).toEqual(mockExecutionResult);
      expect(execution.metrics).toBeDefined();
      expect(execution.metrics.orderId).toBe('test-order-123');
      expect(mockBinanceService.placeOrder).toHaveBeenCalledWith({
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: OrderType.MARKET,
        quantity: 0.01,
        timeInForce: 'IOC'
      });
    });

    test('should handle large orders with splitting', async () => {
      const largeOrderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: OrderType.MARKET,
        quantity: 1 // Large order that should trigger splitting
      };

      const executionPlan: SmartRoutingDecision = {
        symbol: 'BTCUSDT',
        orderSize: 1,
        recommendedExchange: 'Binance',
        recommendedOrderType: OrderType.MARKET,
        estimatedSlippage: 0.001,
        estimatedFees: 50,
        estimatedExecutionTime: 1000,
        confidence: 0.7,
        reasoning: 'Large order, splitting recommended',
        timestamp: Date.now()
      };

      // Mock multiple execution results for order splitting
      const mockSplitResults = [
        {
          orderId: 'split-1',
          symbol: 'BTCUSDT',
          quantity: '0.33',
          price: '50000',
          avgPrice: '50000',
          commission: '16.5'
        },
        {
          orderId: 'split-2', 
          symbol: 'BTCUSDT',
          quantity: '0.33',
          price: '50001',
          avgPrice: '50001',
          commission: '16.5'
        },
        {
          orderId: 'split-3',
          symbol: 'BTCUSDT',
          quantity: '0.34',
          price: '50002',
          avgPrice: '50002',
          commission: '17'
        }
      ];

      mockBinanceService.placeOrder!
        .mockResolvedValueOnce(mockSplitResults[0])
        .mockResolvedValueOnce(mockSplitResults[1])
        .mockResolvedValueOnce(mockSplitResults[2]);

      const execution = await executionOptimizationService.executeOptimizedOrder(
        largeOrderRequest,
        executionPlan
      );

      // Should have called placeOrder 3 times for splitting
      expect(mockBinanceService.placeOrder).toHaveBeenCalledTimes(3);
      
      // Combined result should reflect all splits
      expect(execution.executedOrder.isSplit).toBe(true);
      expect(execution.executedOrder.splitExecutions).toHaveLength(3);
    });
  });

  describe('Configuration Management', () => {
    test('should update configuration', () => {
      const newConfig = {
        maxSlippagePercent: 0.1,
        timingOptimization: false
      };

      executionOptimizationService.updateConfig(newConfig);

      const currentConfig = executionOptimizationService.getConfig();
      expect(currentConfig.maxSlippagePercent).toBe(0.1);
      expect(currentConfig.timingOptimization).toBe(false);
    });

    test('should get execution analytics', () => {
      const analytics = executionOptimizationService.getExecutionAnalytics();
      
      expect(analytics).toHaveProperty('avgSlippage');
      expect(analytics).toHaveProperty('avgExecutionTime');
      expect(analytics).toHaveProperty('avgFees');
      expect(analytics).toHaveProperty('totalOrders');
      expect(analytics).toHaveProperty('successRate');
    });
  });

  describe('Market Impact Calculation', () => {
    test('should calculate market impact correctly', async () => {
      // This test would verify the market impact calculation
      // For a more detailed test, we'd need access to the private method
      // or expose it for testing purposes
      
      const orderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: OrderType.MARKET,
        quantity: 10 // Large quantity to test market impact
      };

      const marketData: MarketData = {
        symbol: 'BTCUSDT',
        price: 50000,
        volume24h: 1000000,
        priceChange24h: 100,
        priceChangePercent24h: 0.2,
        bid: 49999,
        ask: 50001,
        spread: 2,
        timestamp: Date.now()
      };

      // Mock limited market depth
      mockBinanceService.getOrderBook!.mockResolvedValue({
        bids: [['49999', '0.1']], // Very limited liquidity
        asks: [['50001', '0.1'], ['50010', '5'], ['50020', '10']]
      });

      const optimization = await executionOptimizationService.optimizeOrderExecution(
        orderRequest,
        marketData
      );

      // Large order with limited liquidity should have higher estimated slippage
      expect(optimization.estimatedSlippage).toBeGreaterThan(0.001);
    });
  });

  describe('Error Handling', () => {
    test('should handle order execution failures', async () => {
      const orderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: OrderType.MARKET,
        quantity: 0.01
      };

      const executionPlan: SmartRoutingDecision = {
        symbol: 'BTCUSDT',
        orderSize: 0.01,
        recommendedExchange: 'Binance',
        recommendedOrderType: OrderType.MARKET,
        estimatedSlippage: 0.0001,
        estimatedFees: 0.5,
        estimatedExecutionTime: 100,
        confidence: 0.9,
        reasoning: 'Test order',
        timestamp: Date.now()
      };

      mockBinanceService.placeOrder!.mockRejectedValue(new Error('Order failed'));

      await expect(
        executionOptimizationService.executeOptimizedOrder(orderRequest, executionPlan)
      ).rejects.toThrow('Order failed');
    });

    test('should handle market depth fetch failures', async () => {
      const orderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: OrderType.MARKET,
        quantity: 0.01
      };

      const marketData: MarketData = {
        symbol: 'BTCUSDT',
        price: 50000,
        volume24h: 1000000,
        priceChange24h: 100,
        priceChangePercent24h: 0.2,
        bid: 49999,
        ask: 50001,
        spread: 2,
        timestamp: Date.now()
      };

      mockBinanceService.getOrderBook!.mockRejectedValue(new Error('API Error'));

      // Should still return an optimization result with fallback values
      const optimization = await executionOptimizationService.optimizeOrderExecution(
        orderRequest,
        marketData
      );

      expect(optimization.optimizedOrder).toBeDefined();
      expect(optimization.executionPlan).toBeDefined();
    });
  });
});
