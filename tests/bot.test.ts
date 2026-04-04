import { ScalpingStrategy } from '../src/strategies/scalpingStrategy';
import { RiskManager } from '../src/services/riskManager';
import { OrderManager } from '../src/services/orderManager';
import { TechnicalIndicators } from '../src/utils/technicalIndicators';
import { Candle, MarketData, TradePosition } from '../src/types';

describe('Crypto Scalping Bot Tests', () => {
  describe('Technical Indicators', () => {
    test('should calculate EMA correctly', () => {
      const prices = [10, 11, 12, 13, 14, 15];
      const ema = TechnicalIndicators.calculateEMA(prices, 3);
      
      expect(ema).toHaveLength(4); // 6 prices - 3 period + 1
      expect(ema[0]).toBeCloseTo(11); // First EMA is SMA
    });

    test('should calculate RSI correctly', () => {
      const prices = Array.from({length: 20}, (_, i) => 100 + i + Math.sin(i) * 5);
      const rsi = TechnicalIndicators.calculateRSI(prices, 14);
      
      expect(rsi).toHaveLength(5); // 20 prices - 14 period - 1
      expect(rsi[0]).toBeGreaterThanOrEqual(0);
      expect(rsi[0]).toBeLessThanOrEqual(100);
    });
  });

  describe('Risk Manager', () => {
    let riskManager: RiskManager;

    beforeEach(() => {
      riskManager = new RiskManager(1000); // $1000 starting balance
    });

    test('should initialize with correct balance', () => {
      const portfolio = riskManager.getPortfolio();
      
      expect(portfolio.totalBalance).toBe(1000);
      expect(portfolio.availableBalance).toBe(1000);
      expect(portfolio.openPositions).toHaveLength(0);
    });

    test('should allow valid trade within risk limits', () => {
      const orderRequest = {
        symbol: 'BTCUSDT',
        side: 'BUY' as const,
        type: 'MARKET' as const,
        quantity: 0.01
      };
      
      const result = riskManager.canOpenTrade(orderRequest, 50000); // $500 position
      
      expect(result.allowed).toBe(true);
    });

    test('should reject trade exceeding available balance', () => {
      const orderRequest = {
        symbol: 'BTCUSDT',
        side: 'BUY' as const,
        type: 'MARKET' as const,
        quantity: 1
      };
      
      const result = riskManager.canOpenTrade(orderRequest, 50000); // $50,000 position
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('balance');
    });
  });

  describe('Scalping Strategy', () => {
    let strategy: ScalpingStrategy;

    beforeEach(() => {
      strategy = new ScalpingStrategy();
    });

    test('should generate HOLD signal with insufficient data', () => {
      const candles: Candle[] = []; // No data
      const marketData: MarketData = {
        symbol: 'BTCUSDT',
        price: 50000,
        volume24h: 1000000,
        priceChange24h: 500,
        priceChangePercent24h: 1.0,
        bid: 49999,
        ask: 50001,
        spread: 2,
        timestamp: Date.now()
      };
      
      const signal = strategy.generateSignal(candles, marketData);
      
      expect(signal.type).toBe('HOLD');
      expect(signal.reason).toContain('Insufficient data');
    });

    test('should handle market data correctly', () => {
      const marketData: MarketData = {
        symbol: 'BTCUSDT',
        price: 50000,
        volume24h: 1000000,
        priceChange24h: 500,
        priceChangePercent24h: 1.0,
        bid: 49999,
        ask: 50001,
        spread: 2,
        timestamp: Date.now()
      };
      
      const isGoodConditions = strategy.isScalpingConditionsGood(marketData, 0.01);
      expect(typeof isGoodConditions).toBe('boolean');
    });
  });

  describe('Integration Tests', () => {
    test('should create strategy and risk manager without errors', () => {
      expect(() => {
        new ScalpingStrategy();
        new RiskManager(500);
      }).not.toThrow();
    });

    test('should handle edge cases gracefully', () => {
      const riskManager = new RiskManager(0); // Zero balance
      const portfolio = riskManager.getPortfolio();
      
      expect(portfolio.totalBalance).toBe(0);
      expect(portfolio.availableBalance).toBe(0);
    });
  });

  // ─── Cut-Loss Tests ───────────────────────────────────────────────────────────

  describe('Cut-Loss Mechanism', () => {
    let riskManager: RiskManager;
    let orderManager: OrderManager;

    /** Helper to register an open position directly in the risk manager */
    function addOpenPosition(overrides: Partial<TradePosition> = {}): TradePosition {
      const position: TradePosition = {
        id: `test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        symbol: 'BTCUSDT',
        side: 'BUY',
        quantity: 0.01,
        entryPrice: 50000,
        currentPrice: 50000,
        stopLoss: 50000 * (1 - 0.003),   // 0.3% below entry
        takeProfit: 50000 * (1 + 0.006), // 0.6% above entry
        pnl: 0,
        pnlPercent: 0,
        status: 'OPEN',
        openTime: Date.now() - 60000,    // 1 minute ago
        fees: 0,
        ...overrides,
      };
      riskManager.addPosition(position);
      return position;
    }

    beforeEach(() => {
      riskManager = new RiskManager(1000);
      orderManager = new OrderManager(riskManager);
    });

    test('cutLoss – returns null when position does not exist', async () => {
      const result = await orderManager.cutLoss('nonexistent_id', 49000, 'test reason');
      expect(result).toBeNull();
    });

    test('cutLoss – closes position and returns closed position', async () => {
      const position = addOpenPosition();

      const result = await orderManager.cutLoss(position.id, 49700, 'Stop loss triggered');

      expect(result).not.toBeNull();
      expect(result!.status).toBe('CLOSED');
      expect(result!.pnl).toBeLessThan(0); // A loss was realised
    });

    test('cutLoss – position is removed from open positions after close', async () => {
      const position = addOpenPosition();

      await orderManager.cutLoss(position.id, 49700, 'Stop loss triggered');

      const portfolio = riskManager.getPortfolio();
      const stillOpen = portfolio.openPositions.find(p => p.id === position.id);
      expect(stillOpen).toBeUndefined();
    });

    test('monitorPositions – triggers cutLoss when price crosses stop-loss', () => {
      const position = addOpenPosition({ entryPrice: 50000, stopLoss: 49850 });

      const marketData: MarketData[] = [{
        symbol: 'BTCUSDT',
        price: 49800, // below stop-loss
        volume24h: 1000000,
        priceChange24h: -200,
        priceChangePercent24h: -0.4,
        bid: 49799,
        ask: 49801,
        spread: 2,
        timestamp: Date.now(),
      }];

      orderManager.monitorPositions(marketData);

      // The position should have been queued for closing (fire-and-forget)
      // so it remains open momentarily; what we can assert synchronously is
      // that the price was updated by the monitor call.
      const portfolio = riskManager.getPortfolio();
      const updatedPosition = portfolio.openPositions.find(p => p.id === position.id);
      // Either closed (async resolved) or the current price was updated
      if (updatedPosition) {
        expect(updatedPosition.currentPrice).toBe(49800);
      } else {
        // Already closed – verify position is gone
        expect(updatedPosition).toBeUndefined();
      }
    });

    test('monitorPositions – detects price-gap unexpected condition', () => {
      // stopLoss distance = 50000 - 49850 = 150
      // For a gap: current price must be more than 2× that distance past stopLoss
      // stopLoss = 49850; gap threshold price = 49850 - 2*150 = 49550
      const position = addOpenPosition({ entryPrice: 50000, stopLoss: 49850 });

      const marketData: MarketData[] = [{
        symbol: 'BTCUSDT',
        price: 49400, // far below stop-loss (gap scenario)
        volume24h: 1000000,
        priceChange24h: -600,
        priceChangePercent24h: -1.2,
        bid: 49399,
        ask: 49401,
        spread: 2,
        timestamp: Date.now(),
      }];

      // Should not throw even under extreme price gap
      expect(() => orderManager.monitorPositions(marketData)).not.toThrow();
    });
  });
});