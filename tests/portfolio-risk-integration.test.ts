import { PortfolioTracker } from '../src/services/portfolioTracker';
import { RiskManager } from '../src/services/riskManager';
import { IntegrationService } from '../src/services/integrationService';
import { OrderManager } from '../src/services/orderManager';
import { MarketData, TradePosition, TradingSignal } from '../src/types';

describe('Portfolio Tracking and Risk Management Integration', () => {
  let riskManager: RiskManager;
  let portfolioTracker: PortfolioTracker;
  let orderManager: OrderManager;
  let integrationService: IntegrationService;

  const mockMarketData: MarketData[] = [
    {
      symbol: 'BTCUSDT',
      price: 50000,
      volume24h: 1000000,
      priceChange24h: 1000,
      priceChangePercent24h: 2.04,
      bid: 49995,
      ask: 50005,
      spread: 10,
      timestamp: Date.now()
    },
    {
      symbol: 'ETHUSDT',
      price: 3000,
      volume24h: 800000,
      priceChange24h: -50,
      priceChangePercent24h: -1.64,
      bid: 2998,
      ask: 3002,
      spread: 4,
      timestamp: Date.now()
    }
  ];

  const mockTradingSignal: TradingSignal = {
    type: 'BUY',
    strength: 85,
    confidence: 78,
    reason: 'Strong bullish momentum with high volume',
    timestamp: Date.now(),
    indicators: {
      ema9: 49800,
      ema21: 49200,
      rsi: 65,
      macd: 150,
      macdSignal: 120,
      macdHistogram: 30,
      bollingerUpper: 51000,
      bollingerMiddle: 50000,
      bollingerLower: 49000,
      volume: 1000000,
      priceChange: 1000,
      priceChangePercent: 2.04
    }
  };

  beforeEach(() => {
    riskManager = new RiskManager(10000); // $10,000 initial capital
    portfolioTracker = new PortfolioTracker(riskManager);
    orderManager = new OrderManager(riskManager);
    integrationService = new IntegrationService(portfolioTracker, riskManager, orderManager);
  });

  describe('PortfolioTracker', () => {
    it('should calculate comprehensive portfolio metrics', () => {
      // Add some positions first
      const position1: TradePosition = {
        id: 'test-1',
        symbol: 'BTCUSDT',
        side: 'BUY',
        quantity: 0.1,
        entryPrice: 49000,
        currentPrice: 50000,
        stopLoss: 48000,
        takeProfit: 52000,
        pnl: 100,
        pnlPercent: 2.04,
        status: 'OPEN',
        openTime: Date.now() - 3600000, // 1 hour ago
        fees: 5
      };

      riskManager.addPosition(position1);
      const metrics = portfolioTracker.updatePortfolioMetrics(mockMarketData);

      expect(metrics).toBeDefined();
      expect(metrics.totalValue).toBeGreaterThan(10000); // Should include unrealized gains
      expect(metrics.riskExposurePercent).toBeGreaterThan(0);
      expect(metrics.timestamp).toBeDefined();
    });

    it('should calculate risk metrics including VaR', () => {
      // Add multiple positions to test diversification
      const positions = [
        createMockPosition('test-1', 'BTCUSDT', 0.1, 49000, Date.now() - 3600000),
        createMockPosition('test-2', 'ETHUSDT', 1.5, 2950, Date.now() - 1800000)
      ];

      positions.forEach(pos => riskManager.addPosition(pos));
      
      // Update multiple times to build history
      for (let i = 0; i < 50; i++) {
        const mockData = mockMarketData.map(data => ({
          ...data,
          price: data.price * (1 + (Math.random() - 0.5) * 0.02) // ±1% random variation
        }));
        portfolioTracker.updatePortfolioMetrics(mockData);
      }

      const metrics = portfolioTracker.updatePortfolioMetrics(mockMarketData);
      
      expect(metrics.portfolioVaR95).toBeGreaterThanOrEqual(0);
      expect(metrics.portfolioVaR99).toBeGreaterThan(metrics.portfolioVaR95);
      expect(metrics.concentrationRisk).toBeGreaterThan(0);
      expect(metrics.correlationMatrix).toBeDefined();
    });

    it('should generate position risk analysis', () => {
      const position = createMockPosition('test-1', 'BTCUSDT', 0.2, 48000, Date.now() - 7200000);
      riskManager.addPosition(position);

      const positionRisks = portfolioTracker.getPositionRisk(mockMarketData);
      
      expect(positionRisks).toHaveLength(1);
      expect(positionRisks[0].riskScore).toBeGreaterThan(0);
      expect(positionRisks[0].timeInPosition).toBeGreaterThan(0);
      expect(positionRisks[0].volatilityAdjustedRisk).toBeDefined();
    });

    it('should trigger alerts for high risk conditions', () => {
      // Create a high-risk scenario
      const largePosition = createMockPosition('test-1', 'BTCUSDT', 2.0, 45000, Date.now() - 3600000);
      largePosition.pnl = -1500; // Large loss
      riskManager.addPosition(largePosition);

      portfolioTracker.updatePortfolioMetrics(mockMarketData);
      const alerts = portfolioTracker.getAlerts();
      
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts.some(alert => alert.severity === 'HIGH' || alert.severity === 'CRITICAL')).toBe(true);
    });
  });

  describe('Enhanced RiskManager', () => {
    it('should implement Kelly Criterion position sizing', () => {
      // Set up some trade history for Kelly calculation
      riskManager.getPerformanceMetrics().totalTrades = 20;
      riskManager.getPerformanceMetrics().winningTrades = 12;
      riskManager.getPerformanceMetrics().avgWin = 150;
      riskManager.getPerformanceMetrics().avgLoss = -80;

      riskManager.setPositionSizingParameters({ method: 'KELLY' });
      
      const positionSize = riskManager.calculateOptimalPositionSize('BTCUSDT', 50000);
      expect(positionSize).toBeGreaterThan(0);
      expect(positionSize).toBeLessThan(10000 / 50000); // Should be reasonable
    });

    it('should implement volatility-adjusted position sizing', () => {
      riskManager.setPositionSizingParameters({ method: 'VOLATILITY_ADJUSTED' });
      
      const positionSize = riskManager.calculateOptimalPositionSize(
        'BTCUSDT', 
        50000, 
        mockTradingSignal, 
        mockMarketData[0]
      );
      
      expect(positionSize).toBeGreaterThan(0);
      expect(positionSize).toBeLessThan(1); // Reasonable for BTC
    });

    it('should enforce enhanced loss limits', () => {
      // Set strict loss limits
      riskManager.setLossLimits({
        test_limit: {
          type: 'PERCENTAGE',
          value: 5, // 5% daily loss limit
          warningThreshold: 80,
          enabled: true,
          autoReduction: true
        }
      });

      // Simulate losses
      riskManager.getPortfolio().dailyPnl = -600; // 6% loss on $10k

      const orderRequest = { symbol: 'BTCUSDT', side: 'BUY' as const, type: 'MARKET' as const, quantity: 0.1 };
      const riskCheck = riskManager.canOpenTrade(orderRequest, 50000);
      
      expect(riskCheck.allowed).toBe(false);
      expect(riskCheck.reason).toContain('loss limit');
    });

    it('should calculate comprehensive risk metrics', () => {
      // Add positions and create some history
      const position = createMockPosition('test-1', 'BTCUSDT', 0.1, 49000, Date.now() - 3600000);
      riskManager.addPosition(position);

      const riskHealth = riskManager.getRiskHealth();
      
      expect(riskHealth.status).toBeDefined();
      expect(riskHealth.metrics).toBeDefined();
      expect(riskHealth.metrics.currentRisk).toBeGreaterThan(0);
      expect(riskHealth.metrics.riskUtilization).toBeGreaterThan(0);
      expect(riskHealth.lossLimitStatus).toBeDefined();
    });

    it('should trigger automatic position reduction', () => {
      // Simulate consecutive losses
      for (let i = 0; i < 5; i++) {
        const position = createMockPosition(`loss-${i}`, 'BTCUSDT', 0.05, 50000, Date.now() - i * 1000);
        position.pnl = -100;
        riskManager.addPosition(position);
        riskManager.closePosition(position.id, 49000, 1);
      }

      // Base risk should be reduced
      const params = riskManager.getPositionSizingParams();
      expect(params.baseRiskPercent).toBeLessThan(8); // Should be reduced from initial 8%
    });
  });

  describe('IntegrationService', () => {
    it('should provide comprehensive dashboard updates', async () => {
      const position = createMockPosition('test-1', 'BTCUSDT', 0.1, 49000, Date.now() - 3600000);
      riskManager.addPosition(position);

      const dashboardUpdate = await integrationService.updateSystems(mockMarketData);
      
      expect(dashboardUpdate.timestamp).toBeDefined();
      expect(dashboardUpdate.portfolio).toBeDefined();
      expect(dashboardUpdate.risk).toBeDefined();
      expect(dashboardUpdate.positions).toHaveLength(1);
      expect(dashboardUpdate.performance).toBeDefined();
    });

    it('should generate optimization suggestions', async () => {
      // Create a concentrated portfolio
      const largePosition = createMockPosition('test-1', 'BTCUSDT', 1.5, 48000, Date.now() - 3600000);
      riskManager.addPosition(largePosition);

      const dashboardUpdate = await integrationService.updateSystems(mockMarketData);
      
      expect(dashboardUpdate.recommendations.length).toBeGreaterThan(0);
      expect(dashboardUpdate.recommendations.some(rec => 
        rec.toLowerCase().includes('diversif') || rec.toLowerCase().includes('concentration')
      )).toBe(true);
    });

    it('should calculate risk-adjusted returns', () => {
      // Add some portfolio history
      for (let i = 0; i < 30; i++) {
        const mockData = mockMarketData.map(data => ({
          ...data,
          price: data.price * (1 + (Math.random() - 0.5) * 0.03)
        }));
        portfolioTracker.updatePortfolioMetrics(mockData);
      }

      const riskAdjusted = integrationService.calculateRiskAdjustedReturns();
      
      expect(riskAdjusted.sharpeRatio).toBeDefined();
      expect(riskAdjusted.sortinoRatio).toBeDefined();
      expect(riskAdjusted.maxDrawdown).toBeGreaterThanOrEqual(0);
      expect(riskAdjusted.volatility).toBeGreaterThanOrEqual(0);
    });

    it('should provide benchmark comparison', () => {
      const comparison = integrationService.getBenchmarkComparison();
      
      expect(comparison.portfolio).toBeDefined();
      expect(comparison.benchmark).toBeDefined();
      expect(comparison.outperformance).toBeDefined();
      expect(comparison.benchmark.symbol).toBe('BTC');
    });

    it('should export comprehensive portfolio report', () => {
      const position = createMockPosition('test-1', 'BTCUSDT', 0.1, 49000, Date.now() - 3600000);
      riskManager.addPosition(position);
      portfolioTracker.updatePortfolioMetrics(mockMarketData);

      const report = integrationService.exportPortfolioReport();
      
      expect(report.summary).toBeDefined();
      expect(report.performance).toBeDefined();
      expect(report.riskMetrics).toBeDefined();
      expect(report.exportDate).toBeDefined();
      expect(report.summary.totalValue).toBeGreaterThan(0);
    });
  });

  describe('Enhanced OrderManager', () => {
    it('should use optimal position sizing for orders', () => {
      const optimalSize = orderManager.getOptimalOrderSize(
        'BTCUSDT', 
        50000, 
        mockTradingSignal,
        mockMarketData[0]
      );
      
      expect(optimalSize).toBeGreaterThan(0);
      expect(optimalSize).toBeLessThan(1); // Reasonable for BTC
    });

    it('should execute orders with enhanced risk checks', async () => {
      const orderRequest = {
        symbol: 'BTCUSDT',
        side: 'BUY' as const,
        type: 'MARKET' as const,
        quantity: 0.05
      };

      const position = await orderManager.executeOrder(
        orderRequest, 
        mockMarketData[0], 
        mockTradingSignal
      );
      
      expect(position).toBeDefined();
      expect(position!.quantity).toBeGreaterThan(0);
      expect(position!.symbol).toBe('BTCUSDT');
    });
  });

  // Test integration between all components
  describe('Full System Integration', () => {
    it('should handle complete trading workflow', async () => {
      // 1. Execute a trade
      const orderRequest = {
        symbol: 'BTCUSDT',
        side: 'BUY' as const,
        type: 'MARKET' as const,
        quantity: 0.1
      };

      const position = await orderManager.executeOrder(
        orderRequest, 
        mockMarketData[0], 
        mockTradingSignal
      );
      expect(position).toBeDefined();

      // 2. Update systems
      const dashboardUpdate = await integrationService.updateSystems(mockMarketData);
      expect(dashboardUpdate.positions).toHaveLength(1);
      expect(dashboardUpdate.portfolio.totalRiskExposure).toBeGreaterThan(0);

      // 3. Simulate price movement
      const updatedMarketData = mockMarketData.map(data => ({
        ...data,
        price: data.symbol === 'BTCUSDT' ? 51000 : data.price // 2% gain
      }));

      // 4. Monitor positions
      orderManager.monitorPositions(updatedMarketData);

      // 5. Update portfolio metrics
      const updatedMetrics = portfolioTracker.updatePortfolioMetrics(updatedMarketData);
      expect(updatedMetrics.totalUnrealizedPnl).toBeGreaterThan(0); // Should show profit

      // 6. Check risk health
      const riskHealth = riskManager.getRiskHealth();
      expect(riskHealth.status).toBeDefined();

      // 7. Close position
      const closedPosition = riskManager.closePosition(position!.id, 51000, 2);
      expect(closedPosition).toBeDefined();
      expect(closedPosition!.pnl).toBeGreaterThan(0);
    });

    it('should handle risk limit breach scenario', async () => {
      // Set very tight loss limits
      riskManager.setLossLimits({
        tight_limit: {
          type: 'PERCENTAGE',
          value: 2, // 2% daily loss limit
          warningThreshold: 50,
          enabled: true,
          autoReduction: true
        }
      });

      // Execute trades that will cause losses
      for (let i = 0; i < 3; i++) {
        const orderRequest = {
          symbol: 'BTCUSDT',
          side: 'BUY' as const,
          type: 'MARKET' as const,
          quantity: 0.05
        };

        const position = await orderManager.executeOrder(orderRequest, mockMarketData[0]);
        if (position) {
          // Simulate loss
          riskManager.closePosition(position.id, 47000, 2); // 6% loss
        }
      }

      // Try to execute another trade - should be blocked
      const blockedOrder = {
        symbol: 'ETHUSDT',
        side: 'BUY' as const,
        type: 'MARKET' as const,
        quantity: 1.0
      };

      const riskCheck = riskManager.canOpenTrade(blockedOrder, 3000);
      expect(riskCheck.allowed).toBe(false);
      expect(riskCheck.reason).toContain('limit');

      // Check that position sizing was reduced
      const params = riskManager.getPositionSizingParams();
      expect(params.baseRiskPercent).toBeLessThan(8);
    });
  });

  // Helper function to create mock positions
  function createMockPosition(
    id: string, 
    symbol: string, 
    quantity: number, 
    entryPrice: number, 
    openTime: number
  ): TradePosition {
    return {
      id,
      symbol,
      side: 'BUY',
      quantity,
      entryPrice,
      currentPrice: entryPrice,
      stopLoss: entryPrice * 0.97,
      takeProfit: entryPrice * 1.05,
      pnl: 0,
      pnlPercent: 0,
      status: 'OPEN',
      openTime,
      fees: 1
    };
  }
});

// Performance benchmark tests
describe('Performance Benchmarks', () => {
  let riskManager: RiskManager;
  let portfolioTracker: PortfolioTracker;

  beforeEach(() => {
    riskManager = new RiskManager(10000);
    portfolioTracker = new PortfolioTracker(riskManager);
  });

  it('should handle large portfolios efficiently', () => {
    const startTime = Date.now();

    // Create 100 positions
    for (let i = 0; i < 100; i++) {
      const position: TradePosition = {
        id: `perf-test-${i}`,
        symbol: i % 2 === 0 ? 'BTCUSDT' : 'ETHUSDT',
        side: 'BUY',
        quantity: 0.01,
        entryPrice: 50000 + (i * 10),
        currentPrice: 50000 + (i * 10),
        stopLoss: 49000,
        takeProfit: 52000,
        pnl: 0,
        pnlPercent: 0,
        status: 'OPEN',
        openTime: Date.now() - i * 1000,
        fees: 1
      };
      riskManager.addPosition(position);
    }

    // Update portfolio metrics
    const mockData: MarketData[] = [
      {
        symbol: 'BTCUSDT', price: 50000, volume24h: 1000000, priceChange24h: 0, 
        priceChangePercent24h: 0, bid: 49995, ask: 50005, spread: 10, timestamp: Date.now()
      },
      {
        symbol: 'ETHUSDT', price: 3000, volume24h: 800000, priceChange24h: 0, 
        priceChangePercent24h: 0, bid: 2998, ask: 3002, spread: 4, timestamp: Date.now()
      }
    ];

    portfolioTracker.updatePortfolioMetrics(mockData);
    
    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(1000); // Should complete within 1 second
    
    const portfolio = riskManager.getPortfolio();
    expect(portfolio.openPositions).toHaveLength(100);
  });

  it('should handle rapid updates efficiently', () => {
    // Add some positions
    for (let i = 0; i < 10; i++) {
      const position: TradePosition = {
        id: `rapid-test-${i}`,
        symbol: 'BTCUSDT',
        side: 'BUY',
        quantity: 0.1,
        entryPrice: 50000,
        currentPrice: 50000,
        stopLoss: 49000,
        takeProfit: 52000,
        pnl: 0,
        pnlPercent: 0,
        status: 'OPEN',
        openTime: Date.now() - i * 1000,
        fees: 1
      };
      riskManager.addPosition(position);
    }

    const startTime = Date.now();

    // Perform 1000 rapid updates
    for (let i = 0; i < 1000; i++) {
      const mockData: MarketData[] = [{
        symbol: 'BTCUSDT',
        price: 50000 + (Math.random() - 0.5) * 1000,
        volume24h: 1000000,
        priceChange24h: 0,
        priceChangePercent24h: 0,
        bid: 49995,
        ask: 50005,
        spread: 10,
        timestamp: Date.now()
      }];

      portfolioTracker.updatePortfolioMetrics(mockData);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    
    const history = portfolioTracker.getPortfolioHistory();
    expect(history.length).toBeGreaterThan(100); // Should have significant history
  });
});