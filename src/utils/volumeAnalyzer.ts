import { Candle } from '../types';
import { TechnicalIndicators } from './technicalIndicators';

export interface VolumeProfile {
  priceLevel: number;
  volume: number;
  volumePercent: number;
  transactions: number;
}

export interface VolumeMetrics {
  currentVolume: number;
  avgVolume20: number;
  avgVolume50: number;
  volumeRatio20: number;
  volumeRatio50: number;
  volumePercentile: number;
  volumeTrend: 'increasing' | 'decreasing' | 'stable';
  volumeMA: number;
  vwap: number;
  obv: number;
  accumDistLine: number;
  volumeOscillator: number;
  moneyFlowIndex: number;
  chaikinOscillator: number;
}

export interface VolumeAnomaly {
  type: 'volume_spike' | 'volume_drought' | 'dark_pool_activity' | 'unusual_transaction_size';
  timestamp: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  volume: number;
  normalVolume: number;
  ratio: number;
  priceImpact: number;
  description: string;
  confidence: number;
}

export interface VolumePriceAnalysis {
  correlation: number;
  divergence: 'bullish' | 'bearish' | 'none';
  confirmationStrength: number;
  volumeSupport: boolean;
  breakoutConfirmation: boolean;
  trendValidation: 'confirmed' | 'weak' | 'divergent';
}

export interface VolumeIndicators {
  vwap: number[];
  obv: number[];
  accumDistLine: number[];
  mfi: number[];
  chaikinOscillator: number[];
  volumeMA: number[];
  priceVolumeRank: number[];
  volumeSpread: number[];
}

export interface VolumeBreakout {
  type: 'accumulation' | 'distribution' | 'breakout_volume' | 'exhaustion';
  timestamp: number;
  volume: number;
  priceMove: number;
  efficiency: number; // price move per unit of volume
  sustainability: number;
  direction: 'up' | 'down';
  strength: number;
}

export class VolumeAnalyzer {
  private lookbackPeriods: number;
  private volumeMAPeriod: number;
  private mfiPeriod: number;

  constructor(lookbackPeriods: number = 100, volumeMAPeriod: number = 20, mfiPeriod: number = 14) {
    this.lookbackPeriods = lookbackPeriods;
    this.volumeMAPeriod = volumeMAPeriod;
    this.mfiPeriod = mfiPeriod;
  }

  /**
   * Calculate comprehensive volume metrics
   */
  public calculateVolumeMetrics(candles: Candle[]): VolumeMetrics {
    if (candles.length < this.lookbackPeriods) {
      throw new Error(`Insufficient data: need at least ${this.lookbackPeriods} candles`);
    }

    const volumes = candles.map(c => c.volume);

    const currentVolume = volumes[volumes.length - 1];
    
    // Calculate volume moving averages
    const volumeMA20 = this.calculateMA(volumes, 20);
    const volumeMA50 = this.calculateMA(volumes, 50);
    const avgVolume20 = volumeMA20[volumeMA20.length - 1];
    const avgVolume50 = volumeMA50[volumeMA50.length - 1];

    // Volume ratios
    const volumeRatio20 = currentVolume / avgVolume20;
    const volumeRatio50 = currentVolume / avgVolume50;

    // Volume percentile
    const volumePercentile = this.calculatePercentile(volumes, currentVolume);

    // Volume trend
    const volumeTrend = this.determineVolumeTrend(volumes.slice(-20));

    // VWAP calculation
    const vwap = this.calculateVWAP(candles);
    const currentVWAP = vwap[vwap.length - 1];

    // OBV (On-Balance Volume)
    const obv = this.calculateOBV(candles);
    const currentOBV = obv[obv.length - 1];

    // Accumulation/Distribution Line
    const accumDistLine = this.calculateAccumDistLine(candles);
    const currentADL = accumDistLine[accumDistLine.length - 1];

    // Volume Oscillator
    const volumeOscillator = this.calculateVolumeOscillator(volumes);
    const currentVolumeOsc = volumeOscillator[volumeOscillator.length - 1];

    // Money Flow Index
    const mfi = this.calculateMFI(candles);
    const currentMFI = mfi[mfi.length - 1];

    // Chaikin Oscillator
    const chaikinOsc = this.calculateChaikinOscillator(candles);
    const currentChaikin = chaikinOsc[chaikinOsc.length - 1];

    return {
      currentVolume,
      avgVolume20,
      avgVolume50,
      volumeRatio20,
      volumeRatio50,
      volumePercentile,
      volumeTrend,
      volumeMA: avgVolume20,
      vwap: currentVWAP,
      obv: currentOBV,
      accumDistLine: currentADL,
      volumeOscillator: currentVolumeOsc,
      moneyFlowIndex: currentMFI,
      chaikinOscillator: currentChaikin
    };
  }

  /**
   * Detect volume anomalies and unusual activity
   */
  public detectVolumeAnomalies(candles: Candle[]): VolumeAnomaly[] {
    const anomalies: VolumeAnomaly[] = [];
    const volumes = candles.map(c => c.volume);
    const prices = candles.map(c => c.close);

    for (let i = 20; i < candles.length; i++) {
      const currentVolume = volumes[i];
      const recentVolumes = volumes.slice(i - 20, i);
      const avgVolume = recentVolumes.reduce((sum, vol) => sum + vol, 0) / 20;
      const stdVolume = this.calculateStandardDeviation(recentVolumes);
      
      const volumeRatio = currentVolume / avgVolume;
      const priceChange = Math.abs((prices[i] - prices[i - 1]) / prices[i - 1]) * 100;

      // Volume spike detection
      if (currentVolume > avgVolume + 3 * stdVolume && volumeRatio > 3) {
        anomalies.push({
          type: 'volume_spike',
          timestamp: candles[i].openTime,
          severity: volumeRatio > 10 ? 'critical' : volumeRatio > 5 ? 'high' : 'medium',
          volume: currentVolume,
          normalVolume: avgVolume,
          ratio: volumeRatio,
          priceImpact: priceChange,
          description: `Volume spike: ${volumeRatio.toFixed(1)}x normal volume`,
          confidence: Math.min(volumeRatio / 5 * 100, 100)
        });
      }

      // Volume drought detection
      if (currentVolume < avgVolume - 2 * stdVolume && volumeRatio < 0.3) {
        anomalies.push({
          type: 'volume_drought',
          timestamp: candles[i].openTime,
          severity: volumeRatio < 0.1 ? 'high' : 'medium',
          volume: currentVolume,
          normalVolume: avgVolume,
          ratio: volumeRatio,
          priceImpact: priceChange,
          description: `Volume drought: ${((1 - volumeRatio) * 100).toFixed(0)}% below normal`,
          confidence: (1 - volumeRatio) * 100
        });
      }

      // Unusual transaction size (approximation)
      const avgTransactionSize = currentVolume / (candles[i].trades || 1);
      const normalTransactionSize = avgVolume / (recentVolumes.reduce((sum, _vol, idx) => 
        sum + (candles[i - 20 + idx].trades || 1), 0) / 20);
      
      if (avgTransactionSize > normalTransactionSize * 5) {
        anomalies.push({
          type: 'unusual_transaction_size',
          timestamp: candles[i].openTime,
          severity: 'medium',
          volume: currentVolume,
          normalVolume: avgVolume,
          ratio: avgTransactionSize / normalTransactionSize,
          priceImpact: priceChange,
          description: `Large transaction sizes detected`,
          confidence: 70
        });
      }

      // Dark pool activity approximation (high volume, low price impact)
      if (volumeRatio > 2 && priceChange < 0.5) {
        anomalies.push({
          type: 'dark_pool_activity',
          timestamp: candles[i].openTime,
          severity: 'low',
          volume: currentVolume,
          normalVolume: avgVolume,
          ratio: volumeRatio,
          priceImpact: priceChange,
          description: `Possible dark pool activity: high volume, low price impact`,
          confidence: 60
        });
      }
    }

    return anomalies;
  }

  /**
   * Analyze volume-price relationship
   */
  public analyzeVolumePriceRelationship(candles: Candle[]): VolumePriceAnalysis {
    const prices = candles.map(c => c.close);
    const volumes = candles.map(c => c.volume);
    
    // Calculate correlation between price and volume
    const correlation = this.calculateCorrelation(prices.slice(-50), volumes.slice(-50));
    
    // Detect divergences
    const priceDirection = this.getPriceDirection(prices.slice(-20));
    const volumeDirection = this.getVolumeDirection(volumes.slice(-20));
    
    let divergence: 'bullish' | 'bearish' | 'none' = 'none';
    if (priceDirection === 'down' && volumeDirection === 'up') {
      divergence = 'bullish'; // Price down, volume up - potential reversal
    } else if (priceDirection === 'up' && volumeDirection === 'down') {
      divergence = 'bearish'; // Price up, volume down - weak uptrend
    }

    // Calculate confirmation strength
    const confirmationStrength = this.calculateConfirmationStrength(candles);
    
    // Check volume support
    const volumeSupport = this.checkVolumeSupport(candles);
    
    // Breakout confirmation
    const breakoutConfirmation = this.checkBreakoutConfirmation(candles);
    
    // Trend validation
    const trendValidation = this.validateTrendWithVolume(candles);

    return {
      correlation,
      divergence,
      confirmationStrength,
      volumeSupport,
      breakoutConfirmation,
      trendValidation
    };
  }

  /**
   * Calculate all volume indicators
   */
  public calculateVolumeIndicators(candles: Candle[]): VolumeIndicators {
    return {
      vwap: this.calculateVWAP(candles),
      obv: this.calculateOBV(candles),
      accumDistLine: this.calculateAccumDistLine(candles),
      mfi: this.calculateMFI(candles),
      chaikinOscillator: this.calculateChaikinOscillator(candles),
      volumeMA: this.calculateMA(candles.map(c => c.volume), this.volumeMAPeriod),
      priceVolumeRank: this.calculatePriceVolumeRank(candles),
      volumeSpread: this.calculateVolumeSpread(candles)
    };
  }

  /**
   * Detect volume breakouts and patterns
   */
  public detectVolumeBreakouts(candles: Candle[]): VolumeBreakout[] {
    const breakouts: VolumeBreakout[] = [];
    const volumes = candles.map(c => c.volume);
    const prices = candles.map(c => c.close);

    for (let i = 20; i < candles.length - 1; i++) {
      const volumeWindow = volumes.slice(i - 20, i);
      const avgVolume = volumeWindow.reduce((sum, vol) => sum + vol, 0) / 20;
      const currentVolume = volumes[i];
      const priceChange = (prices[i] - prices[i - 1]) / prices[i - 1];

      // Accumulation pattern
      if (this.detectAccumulation(candles, i)) {
        breakouts.push({
          type: 'accumulation',
          timestamp: candles[i].openTime,
          volume: currentVolume,
          priceMove: priceChange * 100,
          efficiency: Math.abs(priceChange) / (currentVolume / avgVolume),
          sustainability: this.calculateSustainability(candles, i),
          direction: priceChange > 0 ? 'up' : 'down',
          strength: (currentVolume / avgVolume) * 30
        });
      }

      // Distribution pattern
      if (this.detectDistribution(candles, i)) {
        breakouts.push({
          type: 'distribution',
          timestamp: candles[i].openTime,
          volume: currentVolume,
          priceMove: priceChange * 100,
          efficiency: Math.abs(priceChange) / (currentVolume / avgVolume),
          sustainability: this.calculateSustainability(candles, i),
          direction: priceChange > 0 ? 'up' : 'down',
          strength: (currentVolume / avgVolume) * 25
        });
      }

      // Breakout volume
      if (currentVolume > avgVolume * 2 && Math.abs(priceChange) > 0.01) {
        breakouts.push({
          type: 'breakout_volume',
          timestamp: candles[i].openTime,
          volume: currentVolume,
          priceMove: priceChange * 100,
          efficiency: Math.abs(priceChange) / (currentVolume / avgVolume),
          sustainability: this.calculateSustainability(candles, i),
          direction: priceChange > 0 ? 'up' : 'down',
          strength: (currentVolume / avgVolume) * Math.abs(priceChange) * 100
        });
      }

      // Volume exhaustion
      if (this.detectVolumeExhaustion(candles, i)) {
        breakouts.push({
          type: 'exhaustion',
          timestamp: candles[i].openTime,
          volume: currentVolume,
          priceMove: priceChange * 100,
          efficiency: Math.abs(priceChange) / (currentVolume / avgVolume),
          sustainability: this.calculateSustainability(candles, i),
          direction: priceChange > 0 ? 'up' : 'down',
          strength: 50 - (currentVolume / avgVolume) * 10
        });
      }
    }

    return breakouts;
  }

  /**
   * Generate volume profile for a price range
   */
  public generateVolumeProfile(candles: Candle[], priceLevels: number = 20): VolumeProfile[] {
    const prices = candles.map(c => c.close);
    const volumes = candles.map(c => c.volume);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceStep = (maxPrice - minPrice) / priceLevels;

    const profile: VolumeProfile[] = [];
    const totalVolume = volumes.reduce((sum, vol) => sum + vol, 0);

    for (let i = 0; i < priceLevels; i++) {
      const levelPrice = minPrice + (i * priceStep);
      let levelVolume = 0;
      let transactions = 0;

      for (let j = 0; j < candles.length; j++) {
        const candle = candles[j];
        if (candle.low <= levelPrice && candle.high >= levelPrice) {
          // Approximate volume at this price level
          const priceRangePercent = (levelPrice - candle.low) / (candle.high - candle.low);
          levelVolume += candle.volume * Math.max(0.1, 1 - Math.abs(0.5 - priceRangePercent));
          transactions += candle.trades || 1;
        }
      }

      profile.push({
        priceLevel: levelPrice,
        volume: levelVolume,
        volumePercent: (levelVolume / totalVolume) * 100,
        transactions
      });
    }

    return profile.sort((a, b) => b.volume - a.volume);
  }

  // Helper methods
  private calculateMA(values: number[], period: number): number[] {
    const ma: number[] = [];
    for (let i = period - 1; i < values.length; i++) {
      const sum = values.slice(i - period + 1, i + 1).reduce((sum, val) => sum + val, 0);
      ma.push(sum / period);
    }
    return ma;
  }

  private calculateVWAP(candles: Candle[]): number[] {
    const vwap: number[] = [];
    let cumulativeTPV = 0; // Cumulative Typical Price * Volume
    let cumulativeVolume = 0;

    for (const candle of candles) {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      cumulativeTPV += typicalPrice * candle.volume;
      cumulativeVolume += candle.volume;
      vwap.push(cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : typicalPrice);
    }

    return vwap;
  }

  private calculateOBV(candles: Candle[]): number[] {
    const obv: number[] = [0];
    
    for (let i = 1; i < candles.length; i++) {
      const prevOBV = obv[obv.length - 1];
      const currentPrice = candles[i].close;
      const prevPrice = candles[i - 1].close;
      const volume = candles[i].volume;

      if (currentPrice > prevPrice) {
        obv.push(prevOBV + volume);
      } else if (currentPrice < prevPrice) {
        obv.push(prevOBV - volume);
      } else {
        obv.push(prevOBV);
      }
    }

    return obv;
  }

  private calculateAccumDistLine(candles: Candle[]): number[] {
    const adl: number[] = [];
    let cumulativeADL = 0;

    for (const candle of candles) {
      const mfm = ((candle.close - candle.low) - (candle.high - candle.close)) / (candle.high - candle.low);
      const mfv = mfm * candle.volume;
      cumulativeADL += isNaN(mfv) ? 0 : mfv;
      adl.push(cumulativeADL);
    }

    return adl;
  }

  private calculateMFI(candles: Candle[]): number[] {
    if (candles.length < this.mfiPeriod + 1) return [];

    const mfi: number[] = [];
    
    for (let i = this.mfiPeriod; i < candles.length; i++) {
      let positiveFlow = 0;
      let negativeFlow = 0;

      for (let j = i - this.mfiPeriod + 1; j <= i; j++) {
        const typicalPrice = (candles[j].high + candles[j].low + candles[j].close) / 3;
        const prevTypicalPrice = (candles[j-1].high + candles[j-1].low + candles[j-1].close) / 3;
        const rawMoneyFlow = typicalPrice * candles[j].volume;

        if (typicalPrice > prevTypicalPrice) {
          positiveFlow += rawMoneyFlow;
        } else if (typicalPrice < prevTypicalPrice) {
          negativeFlow += rawMoneyFlow;
        }
      }

      const moneyRatio = negativeFlow !== 0 ? positiveFlow / negativeFlow : 100;
      mfi.push(100 - (100 / (1 + moneyRatio)));
    }

    return mfi;
  }

  private calculateChaikinOscillator(candles: Candle[]): number[] {
    const adl = this.calculateAccumDistLine(candles);
    const ema3 = this.calculateEMA(adl, 3);
    const ema10 = this.calculateEMA(adl, 10);

    const chaikin: number[] = [];
    for (let i = 0; i < Math.min(ema3.length, ema10.length); i++) {
      chaikin.push(ema3[i + (ema3.length - Math.min(ema3.length, ema10.length))] - ema10[i]);
    }

    return chaikin;
  }

  private calculateEMA(values: number[], period: number): number[] {
    return TechnicalIndicators.calculateEMA(values, period);
  }

  private calculateVolumeOscillator(volumes: number[]): number[] {
    const shortMA = this.calculateMA(volumes, 14);
    const longMA = this.calculateMA(volumes, 28);

    const oscillator: number[] = [];
    for (let i = 0; i < Math.min(shortMA.length, longMA.length); i++) {
      const shortIndex = i + (shortMA.length - Math.min(shortMA.length, longMA.length));
      oscillator.push(((shortMA[shortIndex] - longMA[i]) / longMA[i]) * 100);
    }

    return oscillator;
  }

  private calculatePriceVolumeRank(candles: Candle[]): number[] {
    const ranks: number[] = [];
    
    for (let i = 20; i < candles.length; i++) {
      const recentCandles = candles.slice(i - 20, i + 1);
      const sortedByVolume = recentCandles.sort((a, b) => b.volume - a.volume);
      const currentIndex = sortedByVolume.findIndex(c => c.openTime === candles[i].openTime);
      ranks.push((20 - currentIndex) / 20 * 100); // Percentile rank
    }

    return ranks;
  }

  private calculateVolumeSpread(candles: Candle[]): number[] {
    const spreads: number[] = [];
    
    for (const candle of candles) {
      const spread = candle.high - candle.low;
      const volumeSpread = candle.volume / spread;
      spreads.push(volumeSpread);
    }

    return spreads;
  }

  private calculateStandardDeviation(values: number[]): number {
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

  private determineVolumeTrend(volumes: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (volumes.length < 10) return 'stable';
    
    const recent = volumes.slice(-10);
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

  private calculateCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    const xMean = x.slice(0, n).reduce((sum, val) => sum + val, 0) / n;
    const yMean = y.slice(0, n).reduce((sum, val) => sum + val, 0) / n;
    
    let numerator = 0;
    let xDenominator = 0;
    let yDenominator = 0;
    
    for (let i = 0; i < n; i++) {
      const xDiff = x[i] - xMean;
      const yDiff = y[i] - yMean;
      numerator += xDiff * yDiff;
      xDenominator += xDiff * xDiff;
      yDenominator += yDiff * yDiff;
    }
    
    const denominator = Math.sqrt(xDenominator * yDenominator);
    return denominator !== 0 ? numerator / denominator : 0;
  }

  private getPriceDirection(prices: number[]): 'up' | 'down' | 'sideways' {
    const firstPrice = prices[0];
    const lastPrice = prices[prices.length - 1];
    const change = (lastPrice - firstPrice) / firstPrice;
    
    if (change > 0.02) return 'up';
    if (change < -0.02) return 'down';
    return 'sideways';
  }

  private getVolumeDirection(volumes: number[]): 'up' | 'down' | 'stable' {
    const firstHalf = volumes.slice(0, Math.floor(volumes.length / 2));
    const secondHalf = volumes.slice(Math.floor(volumes.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, vol) => sum + vol, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, vol) => sum + vol, 0) / secondHalf.length;
    
    const change = (secondAvg - firstAvg) / firstAvg;
    
    if (change > 0.2) return 'up';
    if (change < -0.2) return 'down';
    return 'stable';
  }

  private calculateConfirmationStrength(candles: Candle[]): number {
    const prices = candles.map(c => c.close);
    const volumes = candles.map(c => c.volume);
    
    const priceDirection = this.getPriceDirection(prices.slice(-10));
    const volumeDirection = this.getVolumeDirection(volumes.slice(-10));
    
    if ((priceDirection === 'up' && volumeDirection === 'up') ||
        (priceDirection === 'down' && volumeDirection === 'up')) {
      return 80;
    } else if ((priceDirection === 'up' && volumeDirection === 'down') ||
               (priceDirection === 'down' && volumeDirection === 'down')) {
      return 20;
    }
    
    return 50;
  }

  private checkVolumeSupport(candles: Candle[]): boolean {
    const volumes = candles.map(c => c.volume);
    const recentVolumes = volumes.slice(-20);
    const avgVolume = recentVolumes.reduce((sum, vol) => sum + vol, 0) / 20;
    const currentVolume = volumes[volumes.length - 1];
    
    return currentVolume > avgVolume * 1.2;
  }

  private checkBreakoutConfirmation(candles: Candle[]): boolean {
    if (candles.length < 21) return false;
    
    const currentCandle = candles[candles.length - 1];
    const previousCandles = candles.slice(-21, -1);
    const avgVolume = previousCandles.reduce((sum, c) => sum + c.volume, 0) / 20;
    
    const priceBreakout = Math.abs((currentCandle.close - previousCandles[19].close) / previousCandles[19].close) > 0.02;
    const volumeConfirmation = currentCandle.volume > avgVolume * 1.5;
    
    return priceBreakout && volumeConfirmation;
  }

  private validateTrendWithVolume(candles: Candle[]): 'confirmed' | 'weak' | 'divergent' {
    const prices = candles.map(c => c.close);
    const volumes = candles.map(c => c.volume);
    
    const priceDirection = this.getPriceDirection(prices.slice(-20));
    const volumeDirection = this.getVolumeDirection(volumes.slice(-20));
    
    if ((priceDirection === 'up' && volumeDirection === 'up') ||
        (priceDirection === 'down' && volumeDirection === 'up')) {
      return 'confirmed';
    } else if ((priceDirection === 'up' && volumeDirection === 'down') ||
               (priceDirection === 'down' && volumeDirection === 'down')) {
      return 'divergent';
    }
    
    return 'weak';
  }

  private detectAccumulation(candles: Candle[], index: number): boolean {
    if (index < 10) return false;
    
    const recentCandles = candles.slice(index - 10, index + 1);
    const prices = recentCandles.map(c => c.close);
    const volumes = recentCandles.map(c => c.volume);
    
    const priceStability = this.calculateStandardDeviation(prices) / prices[prices.length - 1] < 0.02;
    const increasingVolume = this.getVolumeDirection(volumes) === 'up';
    
    return priceStability && increasingVolume;
  }

  private detectDistribution(candles: Candle[], index: number): boolean {
    if (index < 10) return false;
    
    const recentCandles = candles.slice(index - 10, index + 1);
    const prices = recentCandles.map(c => c.close);
    const volumes = recentCandles.map(c => c.volume);
    
    const priceDirection = this.getPriceDirection(prices);
    const highVolume = volumes[volumes.length - 1] > volumes.slice(0, -1).reduce((sum, vol) => sum + vol, 0) / (volumes.length - 1) * 1.5;
    
    return priceDirection === 'up' && highVolume;
  }

  private detectVolumeExhaustion(candles: Candle[], index: number): boolean {
    if (index < 5) return false;
    
    const recentVolumes = candles.slice(index - 5, index + 1).map(c => c.volume);
    const volumeDecreasing = this.getVolumeDirection(recentVolumes) === 'down';
    const highInitialVolume = recentVolumes[0] > recentVolumes[recentVolumes.length - 1] * 2;
    
    return volumeDecreasing && highInitialVolume;
  }

  private calculateSustainability(candles: Candle[], index: number): number {
    if (index < 5 || index >= candles.length - 5) return 50;
    
    const followingCandles = candles.slice(index + 1, index + 6);
    const volumes = followingCandles.map(c => c.volume);
    const avgVolume = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
    const currentVolume = candles[index].volume;
    
    return Math.min((avgVolume / currentVolume) * 100, 100);
  }

  /**
   * Get volume-based trading recommendations
   */
  public getVolumeRecommendations(candles: Candle[]): string[] {
    const recommendations: string[] = [];
    const metrics = this.calculateVolumeMetrics(candles);
    const anomalies = this.detectVolumeAnomalies(candles);
    const breakouts = this.detectVolumeBreakouts(candles);
    
    if (metrics.volumeRatio20 > 2) {
      recommendations.push('HIGH VOLUME: Consider increased position sizing');
    }
    
    if (metrics.volumeRatio20 < 0.5) {
      recommendations.push('LOW VOLUME: Reduce position size or wait for confirmation');
    }
    
    if (anomalies.some(a => a.type === 'volume_spike')) {
      recommendations.push('VOLUME SPIKE: Monitor for potential breakout');
    }
    
    if (breakouts.some(b => b.type === 'accumulation')) {
      recommendations.push('ACCUMULATION DETECTED: Potential upward move incoming');
    }
    
    if (breakouts.some(b => b.type === 'distribution')) {
      recommendations.push('DISTRIBUTION DETECTED: Consider taking profits');
    }
    
    return recommendations;
  }
}