import { Candle } from '../types';

/**
 * Technical indicator calculations for trading signals
 */
export class TechnicalIndicators {
  /**
   * Calculate Exponential Moving Average
   */
  static calculateEMA(prices: number[], period: number): number[] {
    if (prices.length < period) return [];
    
    const multiplier = 2 / (period + 1);
    const emaArray: number[] = [];
    
    // First EMA value is SMA
    const sma = prices.slice(0, period).reduce((sum, price) => sum + price, 0) / period;
    emaArray.push(sma);
    
    // Calculate subsequent EMA values
    for (let i = period; i < prices.length; i++) {
      const ema = (prices[i] - emaArray[emaArray.length - 1]) * multiplier + emaArray[emaArray.length - 1];
      emaArray.push(ema);
    }
    
    return emaArray;
  }

  /**
   * Calculate Relative Strength Index
   */
  static calculateRSI(prices: number[], period: number = 14): number[] {
    if (prices.length < period + 1) return [];
    
    const gains: number[] = [];
    const losses: number[] = [];
    
    // Calculate price changes
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? -change : 0);
    }
    
    const rsiValues: number[] = [];
    
    // Calculate first RS and RSI
    let avgGain = gains.slice(0, period).reduce((sum, gain) => sum + gain, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((sum, loss) => sum + loss, 0) / period;
    
    if (avgLoss === 0) {
      rsiValues.push(100);
    } else {
      const rs = avgGain / avgLoss;
      rsiValues.push(100 - (100 / (1 + rs)));
    }
    
    // Calculate subsequent RSI values using smoothed averages
    for (let i = period; i < gains.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      
      if (avgLoss === 0) {
        rsiValues.push(100);
      } else {
        const rs = avgGain / avgLoss;
        rsiValues.push(100 - (100 / (1 + rs)));
      }
    }
    
    return rsiValues;
  }

  /**
   * Calculate MACD (Moving Average Convergence Divergence)
   */
  static calculateMACD(prices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9) {
    const fastEMA = this.calculateEMA(prices, fastPeriod);
    const slowEMA = this.calculateEMA(prices, slowPeriod);
    
    if (fastEMA.length === 0 || slowEMA.length === 0) {
      return { macd: [], signal: [], histogram: [] };
    }
    
    // Calculate MACD line
    const macdLine: number[] = [];
    const startIndex = slowPeriod - fastPeriod;
    
    for (let i = 0; i < slowEMA.length; i++) {
      macdLine.push(fastEMA[i + startIndex] - slowEMA[i]);
    }
    
    // Calculate signal line (EMA of MACD)
    const signalLine = this.calculateEMA(macdLine, signalPeriod);
    
    // Calculate histogram
    const histogram: number[] = [];
    for (let i = 0; i < signalLine.length; i++) {
      histogram.push(macdLine[i + (macdLine.length - signalLine.length)] - signalLine[i]);
    }
    
    return {
      macd: macdLine,
      signal: signalLine,
      histogram: histogram
    };
  }

  /**
   * Calculate Bollinger Bands
   */
  static calculateBollingerBands(prices: number[], period: number = 20, deviation: number = 2) {
    if (prices.length < period) return { upper: [], middle: [], lower: [] };
    
    const middle: number[] = [];
    const upper: number[] = [];
    const lower: number[] = [];
    
    for (let i = period - 1; i < prices.length; i++) {
      const slice = prices.slice(i - period + 1, i + 1);
      const sma = slice.reduce((sum, price) => sum + price, 0) / period;
      
      // Calculate standard deviation
      const variance = slice.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period;
      const standardDev = Math.sqrt(variance);
      
      middle.push(sma);
      upper.push(sma + (deviation * standardDev));
      lower.push(sma - (deviation * standardDev));
    }
    
    return { upper, middle, lower };
  }

  /**
   * Calculate Simple Moving Average
   */
  static calculateSMA(prices: number[], period: number): number[] {
    if (prices.length < period) return [];
    
    const smaArray: number[] = [];
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((sum, price) => sum + price, 0);
      smaArray.push(sum / period);
    }
    
    return smaArray;
  }

  /**
   * Calculate percentage change between two values
   */
  static calculatePercentageChange(oldValue: number, newValue: number): number {
    return ((newValue - oldValue) / oldValue) * 100;
  }

  /**
   * Calculate volatility (standard deviation of returns)
   */
  static calculateVolatility(prices: number[], period: number = 20): number[] {
    if (prices.length < period + 1) return [];
    
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    
    const volatilityArray: number[] = [];
    for (let i = period - 1; i < returns.length; i++) {
      const slice = returns.slice(i - period + 1, i + 1);
      const mean = slice.reduce((sum, ret) => sum + ret, 0) / period;
      const variance = slice.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / period;
      volatilityArray.push(Math.sqrt(variance));
    }
    
    return volatilityArray;
  }

  /**
   * Calculate Average True Range (ATR) for volatility measurement
   */
  static calculateATR(candles: Candle[], period: number = 14): number[] {
    if (candles.length < 2) return [];
    
    const trueRanges: number[] = [];
    
    for (let i = 1; i < candles.length; i++) {
      const current = candles[i];
      const previous = candles[i - 1];
      
      const tr1 = current.high - current.low;
      const tr2 = Math.abs(current.high - previous.close);
      const tr3 = Math.abs(current.low - previous.close);
      
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    
    return this.calculateSMA(trueRanges, period);
  }

  /**
   * Calculate Stochastic Oscillator
   */
  static calculateStochastic(candles: Candle[], kPeriod: number = 14, dPeriod: number = 3): { k: number[], d: number[] } {
    if (candles.length < kPeriod) return { k: [], d: [] };
    
    const kValues: number[] = [];
    
    for (let i = kPeriod - 1; i < candles.length; i++) {
      const slice = candles.slice(i - kPeriod + 1, i + 1);
      const current = candles[i];
      
      const lowestLow = Math.min(...slice.map(c => c.low));
      const highestHigh = Math.max(...slice.map(c => c.high));
      
      const k = ((current.close - lowestLow) / (highestHigh - lowestLow)) * 100;
      kValues.push(k);
    }
    
    const dValues = this.calculateSMA(kValues, dPeriod);
    
    return { k: kValues, d: dValues };
  }

  /**
   * Calculate Average Directional Index (ADX) for trend strength
   */
  static calculateADX(candles: Candle[], period: number = 14): number[] {
    if (candles.length < period + 1) return [];
    
    const dmPlus: number[] = [];
    const dmMinus: number[] = [];
    const trueRanges: number[] = [];
    
    for (let i = 1; i < candles.length; i++) {
      const current = candles[i];
      const previous = candles[i - 1];
      
      const dmPlusValue = current.high - previous.high > previous.low - current.low && current.high - previous.high > 0 
        ? current.high - previous.high : 0;
      const dmMinusValue = previous.low - current.low > current.high - previous.high && previous.low - current.low > 0 
        ? previous.low - current.low : 0;
      
      dmPlus.push(dmPlusValue);
      dmMinus.push(dmMinusValue);
      
      const tr1 = current.high - current.low;
      const tr2 = Math.abs(current.high - previous.close);
      const tr3 = Math.abs(current.low - previous.close);
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    
    const smoothedDMPlus = this.calculateSMA(dmPlus, period);
    const smoothedDMMinus = this.calculateSMA(dmMinus, period);
    const smoothedTR = this.calculateSMA(trueRanges, period);
    
    const diPlus: number[] = [];
    const diMinus: number[] = [];
    
    for (let i = 0; i < smoothedTR.length; i++) {
      diPlus.push((smoothedDMPlus[i] / smoothedTR[i]) * 100);
      diMinus.push((smoothedDMMinus[i] / smoothedTR[i]) * 100);
    }
    
    const dx: number[] = [];
    for (let i = 0; i < diPlus.length; i++) {
      dx.push(Math.abs(diPlus[i] - diMinus[i]) / (diPlus[i] + diMinus[i]) * 100);
    }
    
    return this.calculateSMA(dx, period);
  }

  /**
   * Calculate Williams %R oscillator
   */
  static calculateWilliamsR(candles: Candle[], period: number = 14): number[] {
    if (candles.length < period) return [];
    
    const williamsRValues: number[] = [];
    
    for (let i = period - 1; i < candles.length; i++) {
      const slice = candles.slice(i - period + 1, i + 1);
      const current = candles[i];
      
      const highestHigh = Math.max(...slice.map(c => c.high));
      const lowestLow = Math.min(...slice.map(c => c.low));
      
      const williamsR = ((highestHigh - current.close) / (highestHigh - lowestLow)) * -100;
      williamsRValues.push(williamsR);
    }
    
    return williamsRValues;
  }

  /**
   * Calculate Commodity Channel Index (CCI)
   */
  static calculateCCI(candles: Candle[], period: number = 20): number[] {
    if (candles.length < period) return [];
    
    const typicalPrices: number[] = [];
    for (const candle of candles) {
      typicalPrices.push((candle.high + candle.low + candle.close) / 3);
    }
    
    const smaTypicalPrices = this.calculateSMA(typicalPrices, period);
    const cciValues: number[] = [];
    
    for (let i = period - 1; i < candles.length; i++) {
      const slice = typicalPrices.slice(i - period + 1, i + 1);
      const sma = smaTypicalPrices[i - period + 1];
      const current = typicalPrices[i];
      
      const meanDeviation = slice.reduce((sum, tp) => sum + Math.abs(tp - sma), 0) / period;
      const cci = meanDeviation !== 0 ? (current - sma) / (0.015 * meanDeviation) : 0;
      
      cciValues.push(cci);
    }
    
    return cciValues;
  }

  /**
   * Calculate On-Balance Volume (OBV)
   */
  static calculateOBV(candles: Candle[]): number[] {
    if (candles.length < 2) return [];
    
    const obvValues: number[] = [candles[0].volume];
    
    for (let i = 1; i < candles.length; i++) {
      const current = candles[i];
      const previous = candles[i - 1];
      let obvChange = 0;
      
      if (current.close > previous.close) {
        obvChange = current.volume;
      } else if (current.close < previous.close) {
        obvChange = -current.volume;
      }
      // If close prices are equal, OBV remains the same
      
      obvValues.push(obvValues[obvValues.length - 1] + obvChange);
    }
    
    return obvValues;
  }

  /**
   * Calculate Volume Weighted Average Price (VWAP)
   */
  static calculateVWAP(candles: Candle[]): number[] {
    if (candles.length === 0) return [];
    
    const vwapValues: number[] = [];
    let cumulativeVolumePrice = 0;
    let cumulativeVolume = 0;
    
    for (const candle of candles) {
      const typicalPrice = (candle.high + candle.low + candle.close) / 3;
      cumulativeVolumePrice += typicalPrice * candle.volume;
      cumulativeVolume += candle.volume;
      
      vwapValues.push(cumulativeVolume > 0 ? cumulativeVolumePrice / cumulativeVolume : typicalPrice);
    }
    
    return vwapValues;
  }

  /**
   * Calculate market regime based on price action and volatility
   */
  static detectMarketRegime(prices: number[], volumes: number[], lookback: number = 50): {
    type: 'trending_up' | 'trending_down' | 'sideways' | 'volatile';
    strength: number;
    confidence: number;
  } {
    if (prices.length < lookback) {
      return { type: 'sideways', strength: 0, confidence: 0 };
    }
    
    const recentPrices = prices.slice(-lookback);
    const recentVolumes = volumes.slice(-lookback);
    
    // Calculate trend strength
    const firstPrice = recentPrices[0];
    const lastPrice = recentPrices[recentPrices.length - 1];
    const totalReturn = (lastPrice - firstPrice) / firstPrice;
    
    // Calculate volatility
    const volatility = this.calculateVolatility(recentPrices, Math.min(20, lookback));
    const avgVolatility = volatility.length > 0 ? 
      volatility.reduce((sum, vol) => sum + vol, 0) / volatility.length : 0;
    
    // Calculate average volume
    const avgVolume = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
    const recentVolume = recentVolumes.slice(-5).reduce((sum, vol) => sum + vol, 0) / 5;
    
    // Determine regime
    const absReturn = Math.abs(totalReturn);
    const trendThreshold = 0.02; // 2%
    const volatilityThreshold = 0.03; // 3%
    
    let type: 'trending_up' | 'trending_down' | 'sideways' | 'volatile';
    let strength: number;
    let confidence: number;
    
    if (avgVolatility > volatilityThreshold) {
      type = 'volatile';
      strength = Math.min(avgVolatility * 100, 100);
      confidence = Math.min((avgVolatility / volatilityThreshold) * 50, 80);
    } else if (totalReturn > trendThreshold) {
      type = 'trending_up';
      strength = Math.min(absReturn * 100, 100);
      confidence = Math.min((absReturn / trendThreshold) * 60 + (recentVolume / avgVolume) * 20, 90);
    } else if (totalReturn < -trendThreshold) {
      type = 'trending_down';
      strength = Math.min(absReturn * 100, 100);
      confidence = Math.min((absReturn / trendThreshold) * 60 + (recentVolume / avgVolume) * 20, 90);
    } else {
      type = 'sideways';
      strength = Math.max(0, (trendThreshold - absReturn) * 100);
      confidence = Math.min(60 + (1 - avgVolatility / volatilityThreshold) * 30, 85);
    }
    
    return { type, strength, confidence };
  }

  /**
   * Detect support and resistance levels
   */
  static findSupportResistance(prices: number[], window: number = 5): { support: number[], resistance: number[] } {
    const support: number[] = [];
    const resistance: number[] = [];
    
    for (let i = window; i < prices.length - window; i++) {
      const slice = prices.slice(i - window, i + window + 1);
      const current = prices[i];
      
      // Check for local minimum (support)
      const isLocalMin = slice.every((price, idx) => 
        idx === window || price >= current
      );
      
      // Check for local maximum (resistance)
      const isLocalMax = slice.every((price, idx) => 
        idx === window || price <= current
      );
      
      if (isLocalMin) support.push(current);
      if (isLocalMax) resistance.push(current);
    }
    
    return { support, resistance };
  }
}