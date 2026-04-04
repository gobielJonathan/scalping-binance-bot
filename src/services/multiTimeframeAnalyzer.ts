import { TechnicalIndicators } from '../utils/technicalIndicators';
import { Candle, TradingSignal, TechnicalIndicators as TechnicalIndicatorsType } from '../types';

export interface TimeframeConfig {
  interval: string;
  weight: number;
  analysisLength: number;
}

export interface TimeframeSignal {
  timeframe: string;
  signal: TradingSignal;
  weight: number;
}

export interface MultiTimeframeAnalysis {
  symbol: string;
  timestamp: number;
  signals: TimeframeSignal[];
  combinedSignal: TradingSignal;
  alignment: {
    bullish: number;
    bearish: number;
    neutral: number;
  };
  confidence: number;
  strongestTimeframe: string;
  weakestTimeframe: string;
}

export class MultiTimeframeAnalyzer {
  private timeframeConfigs: TimeframeConfig[];

  constructor() {
    this.timeframeConfigs = [
      { interval: '1m', weight: 1.0, analysisLength: 100 },
      { interval: '3m', weight: 1.5, analysisLength: 60 },
      { interval: '5m', weight: 2.0, analysisLength: 50 }
    ];
  }

  /**
   * Analyze multiple timeframes and combine signals
   */
  public analyze(candleData: { [timeframe: string]: Candle[] }, symbol: string): MultiTimeframeAnalysis {
    const signals: TimeframeSignal[] = [];
    let totalWeight = 0;
    let weightedBullishSignals = 0;
    let weightedBearishSignals = 0;

    for (const config of this.timeframeConfigs) {
      const candles = candleData[config.interval];
      if (!candles || candles.length < config.analysisLength) {
        continue;
      }

      const signal = this.generateSignalForTimeframe(candles, config, symbol);
      signals.push({
        timeframe: config.interval,
        signal,
        weight: config.weight
      });

      totalWeight += config.weight;
      
      if (signal.type === 'BUY') {
        weightedBullishSignals += config.weight * (signal.strength / 100);
      } else if (signal.type === 'SELL') {
        weightedBearishSignals += config.weight * (signal.strength / 100);
      }
    }

    const alignment = this.calculateAlignment(signals);
    const combinedSignal = this.combineSignals(signals, symbol);
    
    return {
      symbol,
      timestamp: Date.now(),
      signals,
      combinedSignal,
      alignment,
      confidence: this.calculateConfidence(signals, alignment),
      strongestTimeframe: this.getStrongestTimeframe(signals),
      weakestTimeframe: this.getWeakestTimeframe(signals)
    };
  }

  /**
   * Generate trading signal for a specific timeframe
   */
  private generateSignalForTimeframe(candles: Candle[], config: TimeframeConfig, symbol: string): TradingSignal {
    const prices = candles.map(c => c.close);
    const volumes = candles.map(c => c.volume);
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);

    // Calculate technical indicators
    const ema9 = TechnicalIndicators.calculateEMA(prices, 9);
    const ema21 = TechnicalIndicators.calculateEMA(prices, 21);
    const rsi = TechnicalIndicators.calculateRSI(prices, 14);
    const macd = TechnicalIndicators.calculateMACD(prices);
    const bollinger = TechnicalIndicators.calculateBollingerBands(prices);
    const atr = TechnicalIndicators.calculateATR(candles, 14);

    const currentPrice = prices[prices.length - 1];
    const currentEma9 = ema9[ema9.length - 1];
    const currentEma21 = ema21[ema21.length - 1];
    const currentRsi = rsi[rsi.length - 1];
    const currentMacd = macd.macd[macd.macd.length - 1];
    const currentMacdSignal = macd.signal[macd.signal.length - 1];
    const currentMacdHistogram = macd.histogram[macd.histogram.length - 1];

    // Trend analysis
    const trendStrength = this.analyzeTrend(ema9, ema21);
    const momentumScore = this.analyzeMomentum(rsi, macd);
    const volatilityFactor = this.analyzeVolatility(atr, prices);

    // Calculate signal strength
    let strength = 0;
    let signalType: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';

    // EMA crossover analysis
    if (currentEma9 > currentEma21) {
      strength += 20 * trendStrength;
    } else {
      strength -= 20 * trendStrength;
    }

    // MACD analysis
    if (currentMacd > currentMacdSignal && currentMacdHistogram > 0) {
      strength += 15;
    } else if (currentMacd < currentMacdSignal && currentMacdHistogram < 0) {
      strength -= 15;
    }

    // RSI analysis
    if (currentRsi < 30) {
      strength += 10; // Oversold, potential buy
    } else if (currentRsi > 70) {
      strength -= 10; // Overbought, potential sell
    }

    // Momentum factor
    strength += momentumScore * 20;

    // Volatility adjustment
    strength = strength * volatilityFactor;

    // Determine signal type
    if (strength > 15) {
      signalType = 'BUY';
    } else if (strength < -15) {
      signalType = 'SELL';
      strength = Math.abs(strength);
    } else {
      strength = 0;
    }

    const indicators: TechnicalIndicatorsType = {
      ema9: currentEma9,
      ema21: currentEma21,
      rsi: currentRsi,
      macd: currentMacd,
      macdSignal: currentMacdSignal,
      macdHistogram: currentMacdHistogram,
      bollingerUpper: bollinger.upper[bollinger.upper.length - 1] || 0,
      bollingerMiddle: bollinger.middle[bollinger.middle.length - 1] || 0,
      bollingerLower: bollinger.lower[bollinger.lower.length - 1] || 0,
      volume: volumes[volumes.length - 1],
      priceChange: prices[prices.length - 1] - prices[prices.length - 2],
      priceChangePercent: ((prices[prices.length - 1] - prices[prices.length - 2]) / prices[prices.length - 2]) * 100,
      atr: atr[atr.length - 1] || 0,
      volatility: volatilityFactor
    };

    return {
      type: signalType,
      strength: Math.min(Math.max(strength, 0), 100),
      confidence: this.calculateTimeframeConfidence(config.interval, indicators),
      reason: this.generateSignalReason(signalType, config.interval, indicators),
      timestamp: Date.now(),
      indicators,
      timeHorizon: this.getTimeHorizonForTimeframe(config.interval)
    };
  }

  /**
   * Analyze trend strength from EMA relationship
   */
  private analyzeTrend(ema9: number[], ema21: number[]): number {
    if (ema9.length < 5 || ema21.length < 5) return 0;

    let trendScore = 0;
    const recentPeriods = 5;

    for (let i = ema9.length - recentPeriods; i < ema9.length; i++) {
      if (ema9[i] > ema21[i - (ema9.length - ema21.length)]) {
        trendScore += 1;
      } else {
        trendScore -= 1;
      }
    }

    return trendScore / recentPeriods;
  }

  /**
   * Analyze momentum from RSI and MACD
   */
  private analyzeMomentum(rsi: number[], macd: { macd: number[], signal: number[], histogram: number[] }): number {
    if (rsi.length < 3 || macd.histogram.length < 3) return 0;

    const rsiMomentum = (rsi[rsi.length - 1] - rsi[rsi.length - 3]) / 20; // Normalize
    const macdMomentum = macd.histogram[macd.histogram.length - 1] - macd.histogram[macd.histogram.length - 2];

    return (rsiMomentum + macdMomentum) / 2;
  }

  /**
   * Analyze volatility factor
   */
  private analyzeVolatility(atr: number[], prices: number[]): number {
    if (atr.length === 0 || prices.length < 20) return 1;

    const currentAtr = atr[atr.length - 1];
    const avgAtr = atr.slice(-10).reduce((sum, val) => sum + val, 0) / Math.min(10, atr.length);
    const currentPrice = prices[prices.length - 1];

    // Calculate volatility relative to price
    const volatilityRatio = (currentAtr / currentPrice) * 100;

    // High volatility increases signal confidence, but too high reduces it
    if (volatilityRatio > 2) {
      return 0.8; // High volatility, reduce confidence
    } else if (volatilityRatio > 0.5) {
      return 1.2; // Good volatility for trading
    } else {
      return 0.9; // Low volatility
    }
  }

  /**
   * Calculate alignment across timeframes
   */
  private calculateAlignment(signals: TimeframeSignal[]): { bullish: number, bearish: number, neutral: number } {
    let bullish = 0;
    let bearish = 0;
    let neutral = 0;

    for (const signal of signals) {
      if (signal.signal.type === 'BUY') {
        bullish += signal.weight;
      } else if (signal.signal.type === 'SELL') {
        bearish += signal.weight;
      } else {
        neutral += signal.weight;
      }
    }

    const total = bullish + bearish + neutral;
    return {
      bullish: total > 0 ? bullish / total : 0,
      bearish: total > 0 ? bearish / total : 0,
      neutral: total > 0 ? neutral / total : 0
    };
  }

  /**
   * Combine signals from multiple timeframes
   */
  private combineSignals(signals: TimeframeSignal[], symbol: string): TradingSignal {
    if (signals.length === 0) {
      return {
        type: 'HOLD',
        strength: 0,
        confidence: 0,
        reason: 'No timeframe data available',
        timestamp: Date.now(),
        indicators: {} as TechnicalIndicatorsType
      };
    }

    let totalWeightedStrength = 0;
    let totalWeight = 0;
    let buySignals = 0;
    let sellSignals = 0;

    const combinedIndicators = this.combineIndicators(signals);

    for (const signal of signals) {
      const signalStrength = signal.signal.type === 'BUY' ? signal.signal.strength :
                           signal.signal.type === 'SELL' ? -signal.signal.strength : 0;
      
      totalWeightedStrength += signalStrength * signal.weight;
      totalWeight += signal.weight;

      if (signal.signal.type === 'BUY') buySignals++;
      if (signal.signal.type === 'SELL') sellSignals++;
    }

    const averageStrength = totalWeight > 0 ? totalWeightedStrength / totalWeight : 0;
    const signalType: 'BUY' | 'SELL' | 'HOLD' = averageStrength > 20 ? 'BUY' :
                                                averageStrength < -20 ? 'SELL' : 'HOLD';

    const confidence = this.calculateCombinedConfidence(signals, Math.abs(averageStrength));

    return {
      type: signalType,
      strength: Math.min(Math.max(Math.abs(averageStrength), 0), 100),
      confidence,
      reason: this.generateCombinedReason(signals, signalType),
      timestamp: Date.now(),
      indicators: combinedIndicators,
      timeHorizon: Math.max(...signals.map(s => s.signal.timeHorizon || 5)),
      expectedMovePercent: this.calculateExpectedMove(signals),
      probabilityOfSuccess: confidence / 100
    };
  }

  /**
   * Combine indicators from all timeframes
   */
  private combineIndicators(signals: TimeframeSignal[]): TechnicalIndicatorsType {
    const indicators = signals.map(s => s.signal.indicators);
    if (indicators.length === 0) return {} as TechnicalIndicatorsType;

    // Weight-averaged combination
    const weights = signals.map(s => s.weight);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    return {
      ema9: this.weightedAverage(indicators.map(i => i.ema9), weights, totalWeight),
      ema21: this.weightedAverage(indicators.map(i => i.ema21), weights, totalWeight),
      rsi: this.weightedAverage(indicators.map(i => i.rsi), weights, totalWeight),
      macd: this.weightedAverage(indicators.map(i => i.macd), weights, totalWeight),
      macdSignal: this.weightedAverage(indicators.map(i => i.macdSignal), weights, totalWeight),
      macdHistogram: this.weightedAverage(indicators.map(i => i.macdHistogram), weights, totalWeight),
      bollingerUpper: this.weightedAverage(indicators.map(i => i.bollingerUpper), weights, totalWeight),
      bollingerMiddle: this.weightedAverage(indicators.map(i => i.bollingerMiddle), weights, totalWeight),
      bollingerLower: this.weightedAverage(indicators.map(i => i.bollingerLower), weights, totalWeight),
      volume: Math.max(...indicators.map(i => i.volume)),
      priceChange: this.weightedAverage(indicators.map(i => i.priceChange), weights, totalWeight),
      priceChangePercent: this.weightedAverage(indicators.map(i => i.priceChangePercent), weights, totalWeight),
      atr: this.weightedAverage(indicators.map(i => i.atr || 0), weights, totalWeight),
      volatility: this.weightedAverage(indicators.map(i => i.volatility || 0), weights, totalWeight)
    };
  }

  private weightedAverage(values: number[], weights: number[], totalWeight: number): number {
    let sum = 0;
    for (let i = 0; i < values.length; i++) {
      sum += values[i] * weights[i];
    }
    return totalWeight > 0 ? sum / totalWeight : 0;
  }

  private calculateTimeframeConfidence(timeframe: string, indicators: TechnicalIndicatorsType): number {
    let confidence = 50;

    // RSI confirmation
    if (indicators.rsi > 30 && indicators.rsi < 70) {
      confidence += 10;
    }

    // MACD confirmation
    if (Math.abs(indicators.macdHistogram) > 0.001) {
      confidence += 15;
    }

    // Volatility factor
    if (indicators.atr && indicators.atr > 0) {
      confidence += 10;
    }

    // Timeframe weight (longer timeframes get higher base confidence)
    const timeframeMultiplier = timeframe === '5m' ? 1.2 : timeframe === '3m' ? 1.1 : 1.0;
    confidence *= timeframeMultiplier;

    return Math.min(Math.max(confidence, 0), 100);
  }

  private calculateConfidence(signals: TimeframeSignal[], alignment: any): number {
    if (signals.length === 0) return 0;

    const avgConfidence = signals.reduce((sum, s) => sum + s.signal.confidence, 0) / signals.length;
    const alignmentBonus = Math.max(alignment.bullish, alignment.bearish) * 20;
    
    return Math.min(avgConfidence + alignmentBonus, 100);
  }

  private calculateCombinedConfidence(signals: TimeframeSignal[], strength: number): number {
    const avgConfidence = signals.reduce((sum, s) => sum + s.signal.confidence, 0) / signals.length;
    const strengthBonus = strength > 50 ? 15 : strength > 30 ? 10 : 5;
    const consensusBonus = this.calculateConsensusBonus(signals);
    
    return Math.min(avgConfidence + strengthBonus + consensusBonus, 100);
  }

  private calculateConsensusBonus(signals: TimeframeSignal[]): number {
    const signalTypes = signals.map(s => s.signal.type);
    const buyCount = signalTypes.filter(t => t === 'BUY').length;
    const sellCount = signalTypes.filter(t => t === 'SELL').length;
    const totalCount = signals.length;

    const consensus = Math.max(buyCount, sellCount) / totalCount;
    return consensus > 0.8 ? 20 : consensus > 0.6 ? 10 : 0;
  }

  private calculateExpectedMove(signals: TimeframeSignal[]): number {
    if (signals.length === 0) return 0;

    const moves = signals.map(s => s.signal.expectedMovePercent || 1);
    return moves.reduce((sum, move) => sum + move, 0) / moves.length;
  }

  private generateSignalReason(type: 'BUY' | 'SELL' | 'HOLD', timeframe: string, indicators: TechnicalIndicatorsType): string {
    const reasons: string[] = [];

    if (type === 'BUY') {
      if (indicators.ema9 > indicators.ema21) reasons.push('EMA bullish crossover');
      if (indicators.rsi < 40) reasons.push('RSI oversold');
      if (indicators.macdHistogram > 0) reasons.push('MACD positive momentum');
    } else if (type === 'SELL') {
      if (indicators.ema9 < indicators.ema21) reasons.push('EMA bearish crossover');
      if (indicators.rsi > 60) reasons.push('RSI overbought');
      if (indicators.macdHistogram < 0) reasons.push('MACD negative momentum');
    }

    const baseReason = `${timeframe} timeframe analysis`;
    return reasons.length > 0 ? `${baseReason}: ${reasons.join(', ')}` : baseReason;
  }

  private generateCombinedReason(signals: TimeframeSignal[], type: 'BUY' | 'SELL' | 'HOLD'): string {
    const alignedSignals = signals.filter(s => s.signal.type === type);
    const timeframes = alignedSignals.map(s => s.timeframe).join(', ');
    
    if (alignedSignals.length === signals.length) {
      return `Strong ${type} consensus across all timeframes (${timeframes})`;
    } else if (alignedSignals.length > signals.length / 2) {
      return `${type} majority across timeframes (${timeframes})`;
    } else {
      return `Mixed signals with slight ${type} bias`;
    }
  }

  private getStrongestTimeframe(signals: TimeframeSignal[]): string {
    if (signals.length === 0) return '';
    
    let strongest = signals[0];
    for (const signal of signals) {
      if (signal.signal.strength > strongest.signal.strength) {
        strongest = signal;
      }
    }
    
    return strongest.timeframe;
  }

  private getWeakestTimeframe(signals: TimeframeSignal[]): string {
    if (signals.length === 0) return '';
    
    let weakest = signals[0];
    for (const signal of signals) {
      if (signal.signal.strength < weakest.signal.strength) {
        weakest = signal;
      }
    }
    
    return weakest.timeframe;
  }

  private getTimeHorizonForTimeframe(interval: string): number {
    const horizons: { [key: string]: number } = {
      '1m': 3,
      '3m': 5,
      '5m': 10
    };
    
    return horizons[interval] || 5;
  }

  /**
   * Check if timeframes are aligned for stronger signals
   */
  public isTimeframeAlignment(analysis: MultiTimeframeAnalysis, threshold: number = 0.7): boolean {
    return Math.max(analysis.alignment.bullish, analysis.alignment.bearish) >= threshold;
  }

  /**
   * Get timeframe-specific recommendations
   */
  public getTimeframeRecommendations(analysis: MultiTimeframeAnalysis): string[] {
    const recommendations: string[] = [];

    if (analysis.alignment.bullish > 0.8) {
      recommendations.push('Strong bullish alignment across timeframes');
    } else if (analysis.alignment.bearish > 0.8) {
      recommendations.push('Strong bearish alignment across timeframes');
    }

    if (analysis.confidence > 80) {
      recommendations.push('High confidence multi-timeframe signal');
    }

    if (analysis.strongestTimeframe === '5m' && analysis.combinedSignal.strength > 70) {
      recommendations.push('Strong higher timeframe confirmation');
    }

    return recommendations;
  }
}