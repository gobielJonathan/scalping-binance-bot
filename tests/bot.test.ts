import { ScalpingStrategy } from '../src/strategies/scalpingStrategy';
import { RiskManager } from '../src/services/riskManager';
import { TechnicalIndicators } from '../src/utils/technicalIndicators';
import { Candle, MarketData } from '../src/types';

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
});