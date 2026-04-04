import { Candle } from '../types';
import logger from '../services/logger';

export interface DataGenerationConfig {
  symbol: string;
  startDate: number;
  endDate: number;
  timeframe: '1m' | '5m' | '15m' | '1h';
  basePrice: number;
  volatility: number; // 0.01 = 1% daily volatility
  trend: number; // 0.001 = 0.1% daily trend
  volume: {
    base: number;
    volatility: number;
  };
}

/**
 * Historical market data generator for backtesting
 * Generates realistic OHLCV data for testing purposes
 */
export class HistoricalDataGenerator {
  private config: DataGenerationConfig;
  private timeframeMs: number;

  constructor(config: DataGenerationConfig) {
    this.config = config;
    this.timeframeMs = this.getTimeframeMs(config.timeframe);
  }

  /**
   * Generate historical candle data
   */
  generateData(): Candle[] {
    const candles: Candle[] = [];
    const totalCandles = Math.floor((this.config.endDate - this.config.startDate) / this.timeframeMs);
    
    let currentPrice = this.config.basePrice;
    let currentTime = this.config.startDate;

    logger.info('Generating historical data', {
      source: 'HistoricalDataGenerator',
      context: {
        symbol: this.config.symbol,
        candles: totalCandles,
        timeframe: this.config.timeframe
      }
    });

    for (let i = 0; i < totalCandles; i++) {
      const candle = this.generateCandle(currentPrice, currentTime, i);
      candles.push(candle);
      
      currentPrice = candle.close;
      currentTime += this.timeframeMs;

      // Add some realistic price movements
      if (i % 100 === 0) {
        // Occasional larger movements
        currentPrice *= (1 + (Math.random() - 0.5) * this.config.volatility * 5);
      }
    }

    logger.info('Historical data generated', {
      source: 'HistoricalDataGenerator',
      context: {
        candlesGenerated: candles.length,
        priceRange: {
          start: candles[0].close,
          end: candles[candles.length - 1].close
        }
      }
    });

    return candles;
  }

  /**
   * Generate a single candle
   */
  private generateCandle(basePrice: number, openTime: number, index: number): Candle {
    // Generate open price with trend and some randomness
    const trendComponent = this.config.trend * (index / 1000); // Gradual trend
    const randomComponent = (Math.random() - 0.5) * this.config.volatility * basePrice;
    
    const open = basePrice * (1 + trendComponent) + randomComponent;

    // Generate realistic OHLC within the period
    const volatilityRange = open * this.config.volatility / 24; // Intraday volatility
    
    // Generate high and low
    const highRange = Math.random() * volatilityRange;
    const lowRange = Math.random() * volatilityRange;
    
    const high = Math.max(open + highRange, open);
    const low = Math.min(open - lowRange, open);

    // Generate close with mean reversion tendency
    const closeBias = (Math.random() - 0.5) * 0.6; // Slight mean reversion
    const close = Math.max(low, Math.min(high, open + (Math.random() - 0.5 + closeBias) * volatilityRange));

    // Generate volume with some correlation to price movement
    const priceMovement = Math.abs((close - open) / open);
    const volumeMultiplier = 1 + priceMovement * 2; // Higher volume with larger moves
    const baseVolume = this.config.volume.base * volumeMultiplier;
    const volumeNoise = (Math.random() - 0.5) * this.config.volume.volatility;
    const volume = Math.max(baseVolume * (1 + volumeNoise), baseVolume * 0.1);

    // Generate derived fields
    const quoteVolume = volume * ((open + high + low + close) / 4);
    const trades = Math.floor(volume / 100) + Math.floor(Math.random() * 50);
    const baseAssetVolume = volume * 0.6; // Approximate
    const quoteAssetVolume = quoteVolume * 0.6;

    return {
      openTime,
      open: this.roundToTickSize(open),
      high: this.roundToTickSize(high),
      low: this.roundToTickSize(low),
      close: this.roundToTickSize(close),
      volume: Math.round(volume),
      closeTime: openTime + this.timeframeMs - 1,
      quoteVolume: Math.round(quoteVolume * 100) / 100,
      trades,
      baseAssetVolume: Math.round(baseAssetVolume),
      quoteAssetVolume: Math.round(quoteAssetVolume * 100) / 100
    };
  }

  /**
   * Round price to realistic tick size
   */
  private roundToTickSize(price: number): number {
    if (price > 100) {
      return Math.round(price * 100) / 100; // $0.01 tick
    } else if (price > 1) {
      return Math.round(price * 1000) / 1000; // $0.001 tick
    } else {
      return Math.round(price * 100000) / 100000; // $0.00001 tick
    }
  }

  /**
   * Convert timeframe to milliseconds
   */
  private getTimeframeMs(timeframe: string): number {
    switch (timeframe) {
      case '1m': return 60 * 1000;
      case '5m': return 5 * 60 * 1000;
      case '15m': return 15 * 60 * 1000;
      case '1h': return 60 * 60 * 1000;
      default: throw new Error(`Unsupported timeframe: ${timeframe}`);
    }
  }

  /**
   * Generate data with specific market scenarios
   */
  static generateScenarioData(scenario: 'trending_up' | 'trending_down' | 'sideways' | 'volatile'): DataGenerationConfig {
    const baseConfig = {
      symbol: 'BTCUSDT',
      startDate: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days ago
      endDate: Date.now(),
      timeframe: '1m' as const,
      basePrice: 50000,
      volume: {
        base: 100,
        volatility: 0.3
      }
    };

    switch (scenario) {
      case 'trending_up':
        return {
          ...baseConfig,
          volatility: 0.015, // 1.5% daily volatility
          trend: 0.002 // 0.2% daily upward trend
        };

      case 'trending_down':
        return {
          ...baseConfig,
          volatility: 0.02, // 2% daily volatility
          trend: -0.0015 // -0.15% daily downward trend
        };

      case 'sideways':
        return {
          ...baseConfig,
          volatility: 0.008, // 0.8% daily volatility
          trend: 0 // No trend
        };

      case 'volatile':
        return {
          ...baseConfig,
          volatility: 0.04, // 4% daily volatility
          trend: 0.0005 // Slight upward trend
        };

      default:
        throw new Error(`Unknown scenario: ${scenario}`);
    }
  }

  /**
   * Add realistic market events to generated data
   */
  addMarketEvents(candles: Candle[], events: Array<{
    timestamp: number;
    type: 'pump' | 'dump' | 'consolidation';
    magnitude: number;
  }>): Candle[] {
    const modifiedCandles = [...candles];

    for (const event of events) {
      const eventIndex = candles.findIndex(c => c.openTime <= event.timestamp && c.closeTime >= event.timestamp);
      if (eventIndex === -1) continue;

      const startIndex = Math.max(0, eventIndex - 5);
      const endIndex = Math.min(candles.length - 1, eventIndex + 10);

      for (let i = startIndex; i <= endIndex; i++) {
        const candle = modifiedCandles[i];
        if (!candle) continue; // Skip if candle doesn't exist
        
        const distance = Math.abs(i - eventIndex);
        const effect = event.magnitude * Math.exp(-distance * 0.3); // Exponential decay

        switch (event.type) {
          case 'pump':
            candle.high *= (1 + effect);
            candle.close *= (1 + effect * 0.7);
            candle.volume *= (1 + effect * 2);
            break;

          case 'dump':
            candle.low *= (1 - effect);
            candle.close *= (1 - effect * 0.7);
            candle.volume *= (1 + effect * 2);
            break;

          case 'consolidation':
            // Reduce volatility
            const midPrice = (candle.high + candle.low) / 2;
            candle.high = midPrice + (candle.high - midPrice) * (1 - effect);
            candle.low = midPrice - (midPrice - candle.low) * (1 - effect);
            candle.volume *= (1 - effect * 0.5);
            break;
        }

        // Ensure OHLC consistency
        this.ensureOHLCConsistency(candle);
      }
    }

    return modifiedCandles;
  }

  /**
   * Ensure OHLC data is consistent
   */
  private ensureOHLCConsistency(candle: Candle): void {
    candle.high = Math.max(candle.open, candle.high, candle.low, candle.close);
    candle.low = Math.min(candle.open, candle.high, candle.low, candle.close);
  }

  /**
   * Load real historical data from file (if available)
   */
  static async loadFromFile(filePath: string): Promise<Candle[]> {
    try {
      const fs = await import('fs');
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      
      logger.info('Loaded historical data from file', {
        source: 'HistoricalDataGenerator',
        context: { filePath, candlesLoaded: data.length }
      });

      return data;
    } catch (error) {
      logger.error('Failed to load historical data from file', {
        source: 'HistoricalDataGenerator',
        error: { stack: (error as Error).stack || undefined }
      });
      throw error;
    }
  }

  /**
   * Save generated data to file for future use
   */
  static async saveToFile(candles: Candle[], filePath: string): Promise<void> {
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      // Ensure directory exists
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, JSON.stringify(candles, null, 2));
      
      logger.info('Saved historical data to file', {
        source: 'HistoricalDataGenerator',
        context: { filePath, candlesSaved: candles.length }
      });
    } catch (error) {
      logger.error('Failed to save historical data to file', {
        source: 'HistoricalDataGenerator',
        error: { stack: (error as Error).stack || undefined }
      });
      throw error;
    }
  }
}