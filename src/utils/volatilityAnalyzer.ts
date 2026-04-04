import { Candle } from '../types';
import { TechnicalIndicators } from './technicalIndicators';

export interface VolatilityMetrics {
  atr: number;
  atrPercent: number;
  standardDeviation: number;
  volatilityRatio: number;
  volatilityPercentile: number;
  impliedVolatility: number;
  avgVolatility20: number;
  volatilityTrend: 'increasing' | 'decreasing' | 'stable';
}

export interface MarketRegime {
  type: 'trending_up' | 'trending_down' | 'ranging' | 'volatile' | 'low_volatility';
  strength: number;
  confidence: number;
  duration: number;
  characteristics: string[];
}

export interface VolatilityBreakout {
  type: 'expansion' | 'contraction' | 'spike';
  strength: number;
  timestamp: number;
  expectedMove: number;
  probability: number;
  direction?: 'up' | 'down';
}

export interface VolatilityStrategy {
  regime: MarketRegime;
  recommendedAction: 'trade_breakout' | 'mean_reversion' | 'trend_following' | 'wait';
  stopLossMultiplier: number;
  takeProfitMultiplier: number;
  positionSizeMultiplier: number;
  timeHorizon: number;
}

export class VolatilityAnalyzer {
  private lookbackPeriods: number;
  private atrPeriod: number;
  private volatilityPeriod: number;

  constructor(lookbackPeriods: number = 100, atrPeriod: number = 14, volatilityPeriod: number = 20) {
    this.lookbackPeriods = lookbackPeriods;
    this.atrPeriod = atrPeriod;
    this.volatilityPeriod = volatilityPeriod;
  }

  /**
   * Calculate comprehensive volatility metrics
   */
  public calculateVolatilityMetrics(candles: Candle[]): VolatilityMetrics {
    if (candles.length < this.lookbackPeriods) {
      throw new Error(`Insufficient data: need at least ${this.lookbackPeriods} candles`);
    }

    const prices = candles.map(c => c.close);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    // Calculate ATR
    const atrValues = TechnicalIndicators.calculateATR(candles, this.atrPeriod);
    const currentAtr = atrValues[atrValues.length - 1];
    const currentPrice = prices[prices.length - 1];
    const atrPercent = (currentAtr / currentPrice) * 100;

    // Calculate standard deviation volatility
    const returns = this.calculateReturns(prices);
    const stdDev = this.calculateStandardDeviation(returns.slice(-this.volatilityPeriod));

    // Calculate volatility ratio (current vs historical average)
    const avgVolatility20 = atrValues.slice(-20).reduce((sum, val) => sum + val, 0) / Math.min(20, atrValues.length);
    const volatilityRatio = currentAtr / avgVolatility20;

    // Calculate volatility percentile
    const volatilityPercentile = this.calculatePercentile(atrValues, currentAtr);

    // Calculate implied volatility (simplified)
    const impliedVolatility = this.estimateImpliedVolatility(candles);

    // Determine volatility trend
    const volatilityTrend = this.determineVolatilityTrend(atrValues);

    return {
      atr: currentAtr,
      atrPercent,
      standardDeviation: stdDev,
      volatilityRatio,
      volatilityPercentile,
      impliedVolatility,
      avgVolatility20,
      volatilityTrend
    };
  }

  /**
   * Classify market regime based on volatility and price action
   */
  public classifyMarketRegime(candles: Candle[]): MarketRegime {
    const volatilityMetrics = this.calculateVolatilityMetrics(candles);
    const prices = candles.map(c => c.close);
    
    // Calculate trend metrics
    const ema20 = TechnicalIndicators.calculateEMA(prices, 20);
    const ema50 = TechnicalIndicators.calculateEMA(prices, 50);
    const currentPrice = prices[prices.length - 1];
    const currentEma20 = ema20[ema20.length - 1];
    const currentEma50 = ema50[ema50.length - 1];

    // Analyze price movement patterns
    const priceMovement = this.analyzePriceMovement(candles);
    const trendStrength = this.calculateTrendStrength(prices, ema20, ema50);

    let regimeType: MarketRegime['type'];
    let strength: number;
    let characteristics: string[] = [];

    // Classify based on volatility and trend
    if (volatilityMetrics.volatilityRatio > 1.5 && volatilityMetrics.atrPercent > 2.0) {
      regimeType = 'volatile';
      strength = Math.min(volatilityMetrics.volatilityRatio * 30, 100);
      characteristics.push('High volatility environment');
      characteristics.push('Increased price swings expected');
    } else if (volatilityMetrics.volatilityRatio < 0.7 && volatilityMetrics.atrPercent < 1.0) {
      regimeType = 'low_volatility';
      strength = (1 - volatilityMetrics.volatilityRatio) * 50;
      characteristics.push('Low volatility environment');
      characteristics.push('Range-bound price action likely');
    } else if (trendStrength > 0.6 && currentPrice > currentEma20 && currentEma20 > currentEma50) {
      regimeType = 'trending_up';
      strength = trendStrength * 100;
      characteristics.push('Strong upward trend');
      characteristics.push('Higher highs and higher lows pattern');
    } else if (trendStrength > 0.6 && currentPrice < currentEma20 && currentEma20 < currentEma50) {
      regimeType = 'trending_down';
      strength = trendStrength * 100;
      characteristics.push('Strong downward trend');
      characteristics.push('Lower highs and lower lows pattern');
    } else {
      regimeType = 'ranging';
      strength = (1 - Math.abs(trendStrength)) * 70;
      characteristics.push('Sideways price movement');
      characteristics.push('Price oscillating within range');
    }

    // Calculate confidence based on consistency
    const confidence = this.calculateRegimeConfidence(candles, regimeType, volatilityMetrics);

    // Estimate regime duration
    const duration = this.estimateRegimeDuration(candles, regimeType);

    return {
      type: regimeType,
      strength,
      confidence,
      duration,
      characteristics
    };
  }

  /**
   * Detect volatility breakouts and contractions
   */
  public detectVolatilityBreakouts(candles: Candle[]): VolatilityBreakout[] {
    const breakouts: VolatilityBreakout[] = [];
    const atrValues = TechnicalIndicators.calculateATR(candles, this.atrPeriod);
    const prices = candles.map(c => c.close);

    if (atrValues.length < 20) return breakouts;

    for (let i = 20; i < atrValues.length; i++) {
      const currentAtr = atrValues[i];
      const avgAtr = atrValues.slice(i - 20, i).reduce((sum, val) => sum + val, 0) / 20;
      const stdAtr = this.calculateStandardDeviation(atrValues.slice(i - 20, i));

      // Volatility expansion detection
      if (currentAtr > avgAtr + 2 * stdAtr) {
        const strength = ((currentAtr - avgAtr) / avgAtr) * 100;
        breakouts.push({
          type: 'expansion',
          strength,
          timestamp: candles[i].openTime,
          expectedMove: currentAtr * 2,
          probability: Math.min(strength / 50, 1),
          direction: this.detectBreakoutDirection(candles, i)
        });
      }

      // Volatility contraction detection
      if (currentAtr < avgAtr - stdAtr) {
        const strength = ((avgAtr - currentAtr) / avgAtr) * 100;
        breakouts.push({
          type: 'contraction',
          strength,
          timestamp: candles[i].openTime,
          expectedMove: currentAtr * 1.5,
          probability: Math.min(strength / 30, 1)
        });
      }

      // Volatility spike detection (single period expansion)
      if (i > 0 && currentAtr > atrValues[i - 1] * 2) {
        breakouts.push({
          type: 'spike',
          strength: ((currentAtr - atrValues[i - 1]) / atrValues[i - 1]) * 100,
          timestamp: candles[i].openTime,
          expectedMove: currentAtr,
          probability: 0.6,
          direction: this.detectBreakoutDirection(candles, i)
        });
      }
    }

    return breakouts;
  }

  /**
   * Generate volatility-based trading strategy recommendations
   */
  public generateVolatilityStrategy(candles: Candle[]): VolatilityStrategy {
    const regime = this.classifyMarketRegime(candles);
    const volatilityMetrics = this.calculateVolatilityMetrics(candles);
    const breakouts = this.detectVolatilityBreakouts(candles);

    let recommendedAction: VolatilityStrategy['recommendedAction'];
    let stopLossMultiplier: number;
    let takeProfitMultiplier: number;
    let positionSizeMultiplier: number;
    let timeHorizon: number;

    switch (regime.type) {
      case 'volatile':
        recommendedAction = 'trade_breakout';
        stopLossMultiplier = 1.5;
        takeProfitMultiplier = 2.5;
        positionSizeMultiplier = 0.7; // Reduce size in high vol
        timeHorizon = 5;
        break;

      case 'low_volatility':
        if (breakouts.some(b => b.type === 'contraction')) {
          recommendedAction = 'trade_breakout'; // Prepare for expansion
          stopLossMultiplier = 1.0;
          takeProfitMultiplier = 3.0;
          positionSizeMultiplier = 1.2; // Increase size in low vol
          timeHorizon = 15;
        } else {
          recommendedAction = 'wait';
          stopLossMultiplier = 1.0;
          takeProfitMultiplier = 1.5;
          positionSizeMultiplier = 1.0;
          timeHorizon = 10;
        }
        break;

      case 'trending_up':
      case 'trending_down':
        recommendedAction = 'trend_following';
        stopLossMultiplier = 1.2;
        takeProfitMultiplier = 2.0;
        positionSizeMultiplier = 1.1;
        timeHorizon = 20;
        break;

      case 'ranging':
        recommendedAction = 'mean_reversion';
        stopLossMultiplier = 0.8;
        takeProfitMultiplier = 1.5;
        positionSizeMultiplier = 1.0;
        timeHorizon = 10;
        break;

      default:
        recommendedAction = 'wait';
        stopLossMultiplier = 1.0;
        takeProfitMultiplier = 1.5;
        positionSizeMultiplier = 1.0;
        timeHorizon = 10;
    }

    // Adjust based on volatility metrics
    if (volatilityMetrics.volatilityRatio > 2.0) {
      stopLossMultiplier *= 1.3;
      positionSizeMultiplier *= 0.8;
    } else if (volatilityMetrics.volatilityRatio < 0.5) {
      takeProfitMultiplier *= 1.2;
      positionSizeMultiplier *= 1.1;
    }

    return {
      regime,
      recommendedAction,
      stopLossMultiplier,
      takeProfitMultiplier,
      positionSizeMultiplier,
      timeHorizon
    };
  }

  /**
   * Calculate optimized parameters based on volatility
   */
  public optimizeParametersForVolatility(candles: Candle[]): {
    stopLoss: number,
    takeProfit: number,
    positionSize: number,
    timeframe: string
  } {
    const strategy = this.generateVolatilityStrategy(candles);
    const atr = this.calculateVolatilityMetrics(candles).atr;
    const currentPrice = candles[candles.length - 1].close;

    const stopLoss = (atr * strategy.stopLossMultiplier / currentPrice) * 100; // percentage
    const takeProfit = (atr * strategy.takeProfitMultiplier / currentPrice) * 100; // percentage
    const positionSize = 1.0 * strategy.positionSizeMultiplier; // base position multiplier

    // Recommend timeframe based on volatility
    let timeframe: string;
    if (strategy.regime.type === 'volatile') {
      timeframe = '1m'; // Faster timeframe for high volatility
    } else if (strategy.regime.type === 'low_volatility') {
      timeframe = '5m'; // Slower timeframe for low volatility
    } else {
      timeframe = '3m'; // Medium timeframe for trending/ranging
    }

    return {
      stopLoss,
      takeProfit,
      positionSize,
      timeframe
    };
  }

  // Helper methods
  private calculateReturns(prices: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    return returns;
  }

  private calculateStandardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculatePercentile(values: number[], target: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    let count = 0;
    for (const value of sorted) {
      if (value <= target) count++;
      else break;
    }
    return (count / sorted.length) * 100;
  }

  private estimateImpliedVolatility(candles: Candle[]): number {
    // Simplified implied volatility calculation
    const prices = candles.map(c => c.close);
    const returns = this.calculateReturns(prices);
    const volatility = this.calculateStandardDeviation(returns.slice(-20));
    
    // Annualize (252 trading days, 1440 minutes per day for crypto)
    return volatility * Math.sqrt(252 * 1440);
  }

  private determineVolatilityTrend(atrValues: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (atrValues.length < 10) return 'stable';
    
    const recent = atrValues.slice(-10);
    const slope = this.calculateSlope(recent);
    
    if (slope > 0.1) return 'increasing';
    if (slope < -0.1) return 'decreasing';
    return 'stable';
  }

  private calculateSlope(values: number[]): number {
    const n = values.length;
    const xMean = (n - 1) / 2;
    const yMean = values.reduce((sum, val) => sum + val, 0) / n;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (values[i] - yMean);
      denominator += Math.pow(i - xMean, 2);
    }
    
    return denominator !== 0 ? numerator / denominator : 0;
  }

  private analyzePriceMovement(candles: Candle[]): {
    direction: 'up' | 'down' | 'sideways',
    strength: number
  } {
    const prices = candles.map(c => c.close);
    const recentPrices = prices.slice(-20);
    
    const firstPrice = recentPrices[0];
    const lastPrice = recentPrices[recentPrices.length - 1];
    const priceChange = (lastPrice - firstPrice) / firstPrice;
    
    const direction = priceChange > 0.02 ? 'up' : 
                     priceChange < -0.02 ? 'down' : 'sideways';
    const strength = Math.abs(priceChange) * 100;
    
    return { direction, strength };
  }

  private calculateTrendStrength(prices: number[], ema20: number[], ema50: number[]): number {
    if (ema20.length < 10 || ema50.length < 10) return 0;
    
    const recent20 = ema20.slice(-10);
    const recent50 = ema50.slice(-10);
    
    let trendConsistency = 0;
    for (let i = 0; i < 10; i++) {
      if (recent20[i] > recent50[i - (ema20.length - ema50.length)] && 
          (i === 0 || recent20[i] > recent20[i - 1])) {
        trendConsistency++;
      } else if (recent20[i] < recent50[i - (ema20.length - ema50.length)] && 
                 (i === 0 || recent20[i] < recent20[i - 1])) {
        trendConsistency++;
      }
    }
    
    return trendConsistency / 10;
  }

  private calculateRegimeConfidence(candles: Candle[], regime: MarketRegime['type'], volatilityMetrics: VolatilityMetrics): number {
    let confidence = 50;
    
    // Volatility consistency
    if (volatilityMetrics.volatilityPercentile > 80 && regime === 'volatile') {
      confidence += 25;
    } else if (volatilityMetrics.volatilityPercentile < 20 && regime === 'low_volatility') {
      confidence += 25;
    }
    
    // Trend consistency
    const prices = candles.map(c => c.close);
    const ema20 = TechnicalIndicators.calculateEMA(prices, 20);
    const trendStrength = this.calculateTrendStrength(prices, ema20, ema20);
    
    if (trendStrength > 0.7 && (regime === 'trending_up' || regime === 'trending_down')) {
      confidence += 20;
    } else if (trendStrength < 0.3 && regime === 'ranging') {
      confidence += 15;
    }
    
    return Math.min(confidence, 100);
  }

  private estimateRegimeDuration(candles: Candle[], regime: MarketRegime['type']): number {
    // Estimate duration in minutes based on historical patterns
    const durations: { [key: string]: number } = {
      'volatile': 30,
      'low_volatility': 120,
      'trending_up': 180,
      'trending_down': 180,
      'ranging': 90
    };
    
    return durations[regime] || 60;
  }

  private detectBreakoutDirection(candles: Candle[], index: number): 'up' | 'down' | undefined {
    if (index < 5) return undefined;
    
    const recentCandles = candles.slice(index - 5, index + 1);
    const priceChange = recentCandles[recentCandles.length - 1].close - recentCandles[0].close;
    
    return priceChange > 0 ? 'up' : 'down';
  }

  /**
   * Get real-time volatility alerts
   */
  public getVolatilityAlerts(candles: Candle[]): string[] {
    const alerts: string[] = [];
    const metrics = this.calculateVolatilityMetrics(candles);
    const breakouts = this.detectVolatilityBreakouts(candles);
    
    if (metrics.volatilityRatio > 2.0) {
      alerts.push('HIGH VOLATILITY ALERT: Current volatility is 2x normal levels');
    }
    
    if (metrics.volatilityPercentile > 95) {
      alerts.push('EXTREME VOLATILITY: Volatility in top 5% of historical range');
    }
    
    if (breakouts.some(b => b.type === 'expansion' && b.strength > 50)) {
      alerts.push('VOLATILITY BREAKOUT: Significant volatility expansion detected');
    }
    
    if (breakouts.some(b => b.type === 'contraction' && b.strength > 30)) {
      alerts.push('VOLATILITY SQUEEZE: Low volatility may precede breakout');
    }
    
    return alerts;
  }
}