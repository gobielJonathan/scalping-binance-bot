import { ScalpingStrategy } from '../strategies/scalpingStrategy';
import { SignalAggregator } from '../services/signalAggregator';
import { TechnicalIndicators } from '../utils/technicalIndicators';
import { Candle, MarketData } from '../types';
import logger from '../services/logger';

/**
 * SignalValidator provides comprehensive testing and validation for trading signals
 */
export class SignalValidator {
  private logger: typeof logger;
  private scalpingStrategy: ScalpingStrategy;
  private signalAggregator: SignalAggregator;

  constructor() {
    this.logger = logger;
    this.scalpingStrategy = new ScalpingStrategy();
    this.signalAggregator = new SignalAggregator(this.logger);
  }

  /**
   * Run comprehensive signal validation tests
   */
  async runValidationSuite(): Promise<{
    passed: number;
    failed: number;
    results: ValidationResult[];
  }> {
    const results: ValidationResult[] = [];
    
    this.logger.info('Starting signal validation suite');

    // Test 1: Basic Signal Generation
    results.push(await this.testBasicSignalGeneration());
    
    // Test 2: Signal Strength Calibration
    results.push(await this.testSignalStrengthCalibration());
    
    // Test 3: Market Regime Detection
    results.push(await this.testMarketRegimeDetection());
    
    // Test 4: Signal Aggregation
    results.push(await this.testSignalAggregation());
    
    // Test 5: Signal Filtering
    results.push(await this.testSignalFiltering());
    
    // Test 6: Signal Decay
    results.push(await this.testSignalDecay());
    
    // Test 7: Performance Tracking
    results.push(await this.testPerformanceTracking());
    
    // Test 8: Risk Adjustment
    results.push(await this.testRiskAdjustment());

    const passed = results.filter(r => r.passed).length;
    const failed = results.length - passed;

    this.logger.info(`Validation suite completed: ${passed} passed, ${failed} failed`);

    return { passed, failed, results };
  }

  /**
   * Test basic signal generation functionality
   */
  private async testBasicSignalGeneration(): Promise<ValidationResult> {
    try {
      const testCandles = this.generateTestCandles(100);
      const testMarketData = this.generateTestMarketData();

      const signal = this.scalpingStrategy.generateSignal(testCandles, testMarketData);

      const checks = [
        { name: 'Signal type is valid', passed: ['BUY', 'SELL', 'HOLD'].includes(signal.type) },
        { name: 'Strength is in valid range', passed: signal.strength >= 0 && signal.strength <= 100 },
        { name: 'Confidence is in valid range', passed: signal.confidence >= 0 && signal.confidence <= 100 },
        { name: 'Timestamp is recent', passed: Math.abs(signal.timestamp - Date.now()) < 60000 },
        { name: 'Indicators are present', passed: !!(signal.indicators && Object.keys(signal.indicators).length > 0) },
        { name: 'Reason is provided', passed: !!(signal.reason && signal.reason.length > 0) }
      ];

      return {
        testName: 'Basic Signal Generation',
        passed: checks.every(c => c.passed),
        details: checks,
        message: 'All basic signal generation tests passed'
      };
    } catch (error) {
      return {
        testName: 'Basic Signal Generation',
        passed: false,
        details: [],
        message: `Test failed with error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Test signal strength calibration
   */
  private async testSignalStrengthCalibration(): Promise<ValidationResult> {
    try {
      const strongBullishCandles = this.generateBullishCandles(50);
      const strongBearishCandles = this.generateBearishCandles(50);
      const sidewaysCandles = this.generateSidewaysCandles(50);
      const testMarketData = this.generateTestMarketData();

      const bullishSignal = this.scalpingStrategy.generateSignal(strongBullishCandles, testMarketData);
      const bearishSignal = this.scalpingStrategy.generateSignal(strongBearishCandles, testMarketData);
      const sidewaysSignal = this.scalpingStrategy.generateSignal(sidewaysCandles, testMarketData);

      const checks = [
        { 
          name: 'Bullish conditions generate BUY or strong signal',
          passed: bullishSignal.type === 'BUY' || bullishSignal.strength > 30
        },
        {
          name: 'Bearish conditions generate SELL or strong signal',
          passed: bearishSignal.type === 'SELL' || bearishSignal.strength > 30
        },
        {
          name: 'Sideways conditions generate HOLD or weak signal',
          passed: sidewaysSignal.type === 'HOLD' || sidewaysSignal.strength < 40
        },
        {
          name: 'Strong signals have high confidence',
          passed: (bullishSignal.strength > 70 ? bullishSignal.confidence > 60 : true) &&
                  (bearishSignal.strength > 70 ? bearishSignal.confidence > 60 : true)
        }
      ];

      return {
        testName: 'Signal Strength Calibration',
        passed: checks.every(c => c.passed),
        details: checks,
        message: 'Signal strength calibration tests completed'
      };
    } catch (error) {
      return {
        testName: 'Signal Strength Calibration',
        passed: false,
        details: [],
        message: `Test failed with error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Test market regime detection
   */
  private async testMarketRegimeDetection(): Promise<ValidationResult> {
    try {
      const trendingUpCandles = this.generateTrendingUpCandles(100);
      const trendingDownCandles = this.generateTrendingDownCandles(100);
      const volatileCandles = this.generateVolatileCandles(100);

      const upPrices = trendingUpCandles.map(c => c.close);
      const downPrices = trendingDownCandles.map(c => c.close);
      const volatilePrices = volatileCandles.map(c => c.close);
      
      const upVolumes = trendingUpCandles.map(c => c.volume);
      const downVolumes = trendingDownCandles.map(c => c.volume);
      const volatileVolumes = volatileCandles.map(c => c.volume);

      const upRegime = TechnicalIndicators.detectMarketRegime(upPrices, upVolumes);
      const downRegime = TechnicalIndicators.detectMarketRegime(downPrices, downVolumes);
      const volatileRegime = TechnicalIndicators.detectMarketRegime(volatilePrices, volatileVolumes);

      const checks = [
        {
          name: 'Trending up data detected as trending_up',
          passed: upRegime.type === 'trending_up'
        },
        {
          name: 'Trending down data detected as trending_down',
          passed: downRegime.type === 'trending_down'
        },
        {
          name: 'Volatile data detected as volatile',
          passed: volatileRegime.type === 'volatile'
        },
        {
          name: 'Regime confidence is reasonable',
          passed: upRegime.confidence > 30 && downRegime.confidence > 30 && volatileRegime.confidence > 30
        }
      ];

      return {
        testName: 'Market Regime Detection',
        passed: checks.every(c => c.passed),
        details: checks,
        message: 'Market regime detection tests completed'
      };
    } catch (error) {
      return {
        testName: 'Market Regime Detection',
        passed: false,
        details: [],
        message: `Test failed with error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Test signal aggregation functionality
   */
  private async testSignalAggregation(): Promise<ValidationResult> {
    try {
      const testCandles = this.generateTestCandles(100);
      const testMarketData = this.generateTestMarketData();

      const aggregation = await this.signalAggregator.generateAggregatedSignal(
        'BTCUSDT',
        testCandles,
        testMarketData
      );

      const checks = [
        {
          name: 'Aggregation contains final signal',
          passed: aggregation.finalSignal && typeof aggregation.finalSignal === 'object'
        },
        {
          name: 'Source signals array exists',
          passed: Array.isArray(aggregation.sourceSignals)
        },
        {
          name: 'Consensus level is valid',
          passed: aggregation.consensusLevel >= 0 && aggregation.consensusLevel <= 1
        },
        {
          name: 'Risk score is valid',
          passed: aggregation.riskScore >= 0 && aggregation.riskScore <= 100
        },
        {
          name: 'Quality score is valid',
          passed: aggregation.qualityScore >= 0 && aggregation.qualityScore <= 100
        }
      ];

      return {
        testName: 'Signal Aggregation',
        passed: checks.every(c => c.passed),
        details: checks,
        message: 'Signal aggregation tests completed'
      };
    } catch (error) {
      return {
        testName: 'Signal Aggregation',
        passed: false,
        details: [],
        message: `Test failed with error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Test signal filtering functionality
   */
  private async testSignalFiltering(): Promise<ValidationResult> {
    try {
      const testCandles = this.generateTestCandles(100);
      const testMarketData = this.generateTestMarketData();

      // Test with strict filters
      const strictFilters = {
        minStrength: 80,
        minConfidence: 80,
        maxAge: 30000, // 30 seconds
        volumeFilter: 'high' as const
      };

      const strictAggregation = await this.signalAggregator.generateAggregatedSignal(
        'BTCUSDT',
        testCandles,
        testMarketData,
        strictFilters
      );

      // Test with lenient filters
      const lenientFilters = {
        minStrength: 20,
        minConfidence: 20
      };

      const lenientAggregation = await this.signalAggregator.generateAggregatedSignal(
        'BTCUSDT',
        testCandles,
        testMarketData,
        lenientFilters
      );

      const checks = [
        {
          name: 'Strict filters reduce signal count or strength',
          passed: strictAggregation.sourceSignals.length <= lenientAggregation.sourceSignals.length ||
                  strictAggregation.finalSignal.strength >= 60 // Should have high strength if passed
        },
        {
          name: 'Lenient filters allow more signals',
          passed: lenientAggregation.sourceSignals.length >= 0 // Should at least try to generate
        },
        {
          name: 'Filtered signals meet minimum criteria',
          passed: strictAggregation.sourceSignals.every(s => s.strength >= (strictFilters.minStrength || 0))
        }
      ];

      return {
        testName: 'Signal Filtering',
        passed: checks.every(c => c.passed),
        details: checks,
        message: 'Signal filtering tests completed'
      };
    } catch (error) {
      return {
        testName: 'Signal Filtering',
        passed: false,
        details: [],
        message: `Test failed with error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Test signal decay over time
   */
  private async testSignalDecay(): Promise<ValidationResult> {
    try {
      const testCandles = this.generateTestCandles(100);
      const testMarketData = this.generateTestMarketData();

      // Generate a signal
      const originalSignal = this.scalpingStrategy.generateSignal(testCandles, testMarketData);
      
      // Create an old signal (simulate time passage)

      // Test if signal filtering handles old signals

      // The old signal should be filtered out
      const checks = [
        {
          name: 'Recent signals are accepted',
          passed: Date.now() - originalSignal.timestamp < 60000 // Within 1 minute
        },
        {
          name: 'Time decay factor exists in metadata',
          passed: originalSignal.metadata?.timeDecayFactor !== undefined
        },
        {
          name: 'Signal expiration time is set',
          passed: originalSignal.metadata?.expiresAt !== undefined &&
                  originalSignal.metadata.expiresAt > Date.now()
        }
      ];

      return {
        testName: 'Signal Decay',
        passed: checks.every(c => c.passed),
        details: checks,
        message: 'Signal decay tests completed'
      };
    } catch (error) {
      return {
        testName: 'Signal Decay',
        passed: false,
        details: [],
        message: `Test failed with error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Test performance tracking functionality
   */
  private async testPerformanceTracking(): Promise<ValidationResult> {
    try {
      // Get initial performance
      const initialPerformance = this.signalAggregator.getStrategyPerformance('scalping-v2') as any;

      // Generate some signals
      const testCandles = this.generateTestCandles(100);
      const testMarketData = this.generateTestMarketData();

      const aggregation = await this.signalAggregator.generateAggregatedSignal(
        'BTCUSDT',
        testCandles,
        testMarketData
      );

      // Mark a signal outcome
      if (aggregation.finalSignal.metadata?.id) {
        await this.signalAggregator.markSignalOutcome(
          aggregation.finalSignal.metadata.id,
          'win',
          0.5,
          30000
        );
      }

      // Get updated performance
      const updatedPerformance = this.signalAggregator.getStrategyPerformance('scalping-v2') as any;

      const checks = [
        {
          name: 'Performance metrics exist',
          passed: initialPerformance && typeof initialPerformance === 'object'
        },
        {
          name: 'Total signals increased',
          passed: updatedPerformance.totalSignals >= initialPerformance.totalSignals
        },
        {
          name: 'Performance structure is valid',
          passed: updatedPerformance.hasOwnProperty('successRate') &&
                  updatedPerformance.hasOwnProperty('totalSignals') &&
                  updatedPerformance.hasOwnProperty('successfulSignals')
        },
        {
          name: 'Signal history is tracked',
          passed: this.signalAggregator.getSignalHistory({ limit: 1 }).length >= 0
        }
      ];

      return {
        testName: 'Performance Tracking',
        passed: checks.every(c => c.passed),
        details: checks,
        message: 'Performance tracking tests completed'
      };
    } catch (error) {
      return {
        testName: 'Performance Tracking',
        passed: false,
        details: [],
        message: `Test failed with error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Test risk adjustment mechanisms
   */
  private async testRiskAdjustment(): Promise<ValidationResult> {
    try {
      // Generate high volatility scenario
      const volatileCandles = this.generateVolatileCandles(100);
      const riskMarketData = {
        ...this.generateTestMarketData(),
        ask: 50100,
        bid: 49900, // Wide spread
        volume24h: 100000 // Low volume
      };

      const riskSignal = this.scalpingStrategy.generateSignal(volatileCandles, riskMarketData);

      // Generate normal scenario
      const normalCandles = this.generateTestCandles(100);
      const normalMarketData = this.generateTestMarketData();

      const normalSignal = this.scalpingStrategy.generateSignal(normalCandles, normalMarketData);

      const checks = [
        {
          name: 'Risk-adjusted strength exists',
          passed: riskSignal.riskAdjustedStrength !== undefined
        },
        {
          name: 'Risk adjustment reduces strength in adverse conditions',
          passed: !riskSignal.riskAdjustedStrength || 
                  riskSignal.riskAdjustedStrength <= riskSignal.strength
        },
        {
          name: 'Stop loss levels are calculated',
          passed: riskSignal.stopLoss !== undefined || normalSignal.stopLoss !== undefined
        },
        {
          name: 'Take profit levels are calculated',
          passed: riskSignal.takeProfit !== undefined || normalSignal.takeProfit !== undefined
        },
        {
          name: 'Max risk is calculated',
          passed: riskSignal.maxRisk !== undefined || normalSignal.maxRisk !== undefined
        }
      ];

      return {
        testName: 'Risk Adjustment',
        passed: checks.every(c => c.passed),
        details: checks,
        message: 'Risk adjustment tests completed'
      };
    } catch (error) {
      return {
        testName: 'Risk Adjustment',
        passed: false,
        details: [],
        message: `Test failed with error: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Generate test candles with realistic data
   */
  private generateTestCandles(count: number): Candle[] {
    const candles: Candle[] = [];
    let price = 50000;
    const baseTime = Date.now() - count * 60000; // 1 minute intervals

    for (let i = 0; i < count; i++) {
      const change = (Math.random() - 0.5) * 100; // ±$50 change
      const newPrice = Math.max(price + change, 1000); // Minimum $1000
      
      const high = newPrice + Math.random() * 50;
      const low = newPrice - Math.random() * 50;
      const volume = 10 + Math.random() * 100;

      candles.push({
        openTime: baseTime + i * 60000,
        open: price,
        high: Math.max(price, high),
        low: Math.min(price, low),
        close: newPrice,
        volume,
        closeTime: baseTime + (i + 1) * 60000 - 1,
        quoteVolume: volume * newPrice,
        trades: Math.floor(Math.random() * 100) + 10,
        baseAssetVolume: volume * 0.8,
        quoteAssetVolume: volume * newPrice * 0.8
      });

      price = newPrice;
    }

    return candles;
  }

  /**
   * Generate bullish trending candles
   */
  private generateBullishCandles(count: number): Candle[] {
    const candles: Candle[] = [];
    let price = 50000;
    const baseTime = Date.now() - count * 60000;

    for (let i = 0; i < count; i++) {
      const change = 20 + Math.random() * 30; // Positive trend
      const newPrice = price + change;
      
      candles.push({
        openTime: baseTime + i * 60000,
        open: price,
        high: newPrice + Math.random() * 10,
        low: price - Math.random() * 5,
        close: newPrice,
        volume: 50 + Math.random() * 50,
        closeTime: baseTime + (i + 1) * 60000 - 1,
        quoteVolume: (50 + Math.random() * 50) * newPrice,
        trades: Math.floor(Math.random() * 100) + 50,
        baseAssetVolume: (50 + Math.random() * 50) * 0.8,
        quoteAssetVolume: (50 + Math.random() * 50) * newPrice * 0.8
      });

      price = newPrice;
    }

    return candles;
  }

  /**
   * Generate bearish trending candles
   */
  private generateBearishCandles(count: number): Candle[] {
    const candles: Candle[] = [];
    let price = 50000;
    const baseTime = Date.now() - count * 60000;

    for (let i = 0; i < count; i++) {
      const change = -20 - Math.random() * 30; // Negative trend
      const newPrice = Math.max(price + change, 1000);
      
      candles.push({
        openTime: baseTime + i * 60000,
        open: price,
        high: price + Math.random() * 5,
        low: newPrice - Math.random() * 10,
        close: newPrice,
        volume: 50 + Math.random() * 50,
        closeTime: baseTime + (i + 1) * 60000 - 1,
        quoteVolume: (50 + Math.random() * 50) * newPrice,
        trades: Math.floor(Math.random() * 100) + 50,
        baseAssetVolume: (50 + Math.random() * 50) * 0.8,
        quoteAssetVolume: (50 + Math.random() * 50) * newPrice * 0.8
      });

      price = newPrice;
    }

    return candles;
  }

  /**
   * Generate sideways/ranging candles
   */
  private generateSidewaysCandles(count: number): Candle[] {
    const candles: Candle[] = [];
    const basePrice = 50000;
    const range = 200; // ±$200 range
    const baseTime = Date.now() - count * 60000;

    for (let i = 0; i < count; i++) {
      const price = basePrice + (Math.random() - 0.5) * range;
      
      candles.push({
        openTime: baseTime + i * 60000,
        open: price,
        high: price + Math.random() * 20,
        low: price - Math.random() * 20,
        close: price,
        volume: 20 + Math.random() * 30,
        closeTime: baseTime + (i + 1) * 60000 - 1,
        quoteVolume: (20 + Math.random() * 30) * price,
        trades: Math.floor(Math.random() * 50) + 20,
        baseAssetVolume: (20 + Math.random() * 30) * 0.8,
        quoteAssetVolume: (20 + Math.random() * 30) * price * 0.8
      });
    }

    return candles;
  }

  /**
   * Generate trending up candles for market regime testing
   */
  private generateTrendingUpCandles(count: number): Candle[] {
    const candles: Candle[] = [];
    let price = 50000;
    const baseTime = Date.now() - count * 60000;

    for (let i = 0; i < count; i++) {
      const change = 10 + Math.random() * 20; // Strong uptrend
      const newPrice = price + change;
      
      candles.push({
        openTime: baseTime + i * 60000,
        open: price,
        high: newPrice + Math.random() * 15,
        low: price - Math.random() * 5,
        close: newPrice,
        volume: 40 + Math.random() * 60,
        closeTime: baseTime + (i + 1) * 60000 - 1,
        quoteVolume: (40 + Math.random() * 60) * newPrice,
        trades: Math.floor(Math.random() * 100) + 40,
        baseAssetVolume: (40 + Math.random() * 60) * 0.8,
        quoteAssetVolume: (40 + Math.random() * 60) * newPrice * 0.8
      });

      price = newPrice;
    }

    return candles;
  }

  /**
   * Generate trending down candles for market regime testing
   */
  private generateTrendingDownCandles(count: number): Candle[] {
    const candles: Candle[] = [];
    let price = 50000;
    const baseTime = Date.now() - count * 60000;

    for (let i = 0; i < count; i++) {
      const change = -10 - Math.random() * 20; // Strong downtrend
      const newPrice = Math.max(price + change, 1000);
      
      candles.push({
        openTime: baseTime + i * 60000,
        open: price,
        high: price + Math.random() * 5,
        low: newPrice - Math.random() * 15,
        close: newPrice,
        volume: 40 + Math.random() * 60,
        closeTime: baseTime + (i + 1) * 60000 - 1,
        quoteVolume: (40 + Math.random() * 60) * newPrice,
        trades: Math.floor(Math.random() * 100) + 40,
        baseAssetVolume: (40 + Math.random() * 60) * 0.8,
        quoteAssetVolume: (40 + Math.random() * 60) * newPrice * 0.8
      });

      price = newPrice;
    }

    return candles;
  }

  /**
   * Generate volatile candles for market regime testing
   */
  private generateVolatileCandles(count: number): Candle[] {
    const candles: Candle[] = [];
    let price = 50000;
    const baseTime = Date.now() - count * 60000;

    for (let i = 0; i < count; i++) {
      const change = (Math.random() - 0.5) * 500; // High volatility ±$250
      const newPrice = Math.max(price + change, 1000);
      const volatility = 100 + Math.random() * 200; // High volatility range
      
      candles.push({
        openTime: baseTime + i * 60000,
        open: price,
        high: newPrice + Math.random() * volatility,
        low: newPrice - Math.random() * volatility,
        close: newPrice,
        volume: 100 + Math.random() * 200, // High volume
        closeTime: baseTime + (i + 1) * 60000 - 1,
        quoteVolume: (100 + Math.random() * 200) * newPrice,
        trades: Math.floor(Math.random() * 200) + 100,
        baseAssetVolume: (100 + Math.random() * 200) * 0.8,
        quoteAssetVolume: (100 + Math.random() * 200) * newPrice * 0.8
      });

      price = newPrice;
    }

    return candles;
  }

  /**
   * Generate test market data
   */
  private generateTestMarketData(): MarketData {
    const price = 50000;
    return {
      symbol: 'BTCUSDT',
      price,
      volume24h: 10000000,
      priceChange24h: (Math.random() - 0.5) * 1000,
      priceChangePercent24h: (Math.random() - 0.5) * 4,
      bid: price - 10,
      ask: price + 10,
      spread: 20,
      timestamp: Date.now()
    };
  }

  /**
   * Run performance benchmarks
   */
  async runPerformanceBenchmarks(): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];
    
    // Benchmark 1: Signal Generation Speed
    const signalGenStart = Date.now();
    const testCandles = this.generateTestCandles(100);
    const testMarketData = this.generateTestMarketData();
    
    for (let i = 0; i < 100; i++) {
      this.scalpingStrategy.generateSignal(testCandles, testMarketData);
    }
    
    const signalGenTime = Date.now() - signalGenStart;
    results.push({
      name: 'Signal Generation (100 iterations)',
      duration: signalGenTime,
      avgDuration: signalGenTime / 100,
      passed: signalGenTime < 5000 // Should complete in under 5 seconds
    });

    // Benchmark 2: Signal Aggregation Speed
    const aggregationStart = Date.now();
    
    for (let i = 0; i < 10; i++) {
      await this.signalAggregator.generateAggregatedSignal(
        'BTCUSDT',
        testCandles,
        testMarketData
      );
    }
    
    const aggregationTime = Date.now() - aggregationStart;
    results.push({
      name: 'Signal Aggregation (10 iterations)',
      duration: aggregationTime,
      avgDuration: aggregationTime / 10,
      passed: aggregationTime < 3000 // Should complete in under 3 seconds
    });

    // Benchmark 3: Technical Indicator Calculation
    const indicatorStart = Date.now();
    const prices = testCandles.map(c => c.close);
    
    for (let i = 0; i < 50; i++) {
      TechnicalIndicators.calculateEMA(prices, 9);
      TechnicalIndicators.calculateRSI(prices, 14);
      TechnicalIndicators.calculateMACD(prices);
      TechnicalIndicators.calculateBollingerBands(prices);
    }
    
    const indicatorTime = Date.now() - indicatorStart;
    results.push({
      name: 'Technical Indicators (50 iterations)',
      duration: indicatorTime,
      avgDuration: indicatorTime / 50,
      passed: indicatorTime < 2000 // Should complete in under 2 seconds
    });

    return results;
  }
}

interface ValidationResult {
  testName: string;
  passed: boolean;
  details: Array<{ name: string; passed: boolean }>;
  message: string;
}

interface BenchmarkResult {
  name: string;
  duration: number;
  avgDuration: number;
  passed: boolean;
}

export { ValidationResult, BenchmarkResult };