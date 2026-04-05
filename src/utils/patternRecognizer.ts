import { Candle } from '../types';

export interface CandlestickPattern {
  name: string;
  type: 'bullish' | 'bearish' | 'neutral' | 'reversal' | 'continuation';
  confidence: number;
  timestamp: number;
  candles: Candle[];
  description: string;
  tradingSignal: 'BUY' | 'SELL' | 'HOLD';
  reliability: number;
  timeframe: string;
  stopLoss?: number;
  takeProfit?: number;
}

export interface ScalpingPattern {
  name: string;
  type: 'flag' | 'pennant' | 'triangle' | 'rectangle' | 'wedge' | 'channel';
  direction: 'bullish' | 'bearish';
  breakoutLevel: number;
  targetPrice: number;
  stopLoss: number;
  confidence: number;
  timestamp: number;
  expectedDuration: number; // minutes
  volumeConfirmation: boolean;
  priceAction: {
    entryZone: { min: number; max: number };
    consolidationRange: number;
    breakoutStrength: number;
  };
}

export interface SupportResistanceLevel {
  price: number;
  type: 'support' | 'resistance';
  strength: number;
  touchCount: number;
  lastTouch: number;
  volume: number;
  timeframe: string;
  isActive: boolean;
  breakoutProbability: number;
  priceDistance: number; // distance from current price
}

export interface PriceActionPattern {
  name: string;
  type: 'engulfing' | 'inside_bar' | 'pin_bar' | 'doji' | 'hammer' | 'shooting_star' | 'marubozu';
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  strength: number;
  timestamp: number;
  candle: Candle;
  context: string;
  followThrough: boolean;
  volumeConfirmation: boolean;
}

export interface MarketStructure {
  trend: 'uptrend' | 'downtrend' | 'sideways';
  higherHighs: number[];
  higherLows: number[];
  lowerHighs: number[];
  lowerLows: number[];
  swingHighs: SupportResistanceLevel[];
  swingLows: SupportResistanceLevel[];
  trendStrength: number;
  structureBreak: boolean;
  lastStructureUpdate: number;
}

export class PatternRecognizer {
  private lookbackPeriods: number;
  private minPatternLength: number;
  private maxPatternLength: number;

  constructor(lookbackPeriods: number = 100, minPatternLength: number = 3, maxPatternLength: number = 20) {
    this.lookbackPeriods = lookbackPeriods;
    this.minPatternLength = minPatternLength;
    this.maxPatternLength = maxPatternLength;
  }

  /**
   * Recognize candlestick patterns
   */
  public recognizeCandlestickPatterns(candles: Candle[]): CandlestickPattern[] {
    const patterns: CandlestickPattern[] = [];
    
    for (let i = 2; i < candles.length; i++) {
      const current = candles[i];
      const prev = candles[i - 1];
      const prev2 = candles[i - 2];

      // Single candle patterns
      const doji = this.isDoji(current);
      if (doji) patterns.push(doji);

      const hammer = this.isHammer(current);
      if (hammer) patterns.push(hammer);

      const shootingStar = this.isShootingStar(current);
      if (shootingStar) patterns.push(shootingStar);

      const marubozu = this.isMarubozu(current);
      if (marubozu) patterns.push(marubozu);

      // Two candle patterns
      const engulfing = this.isEngulfingPattern(prev, current);
      if (engulfing) patterns.push(engulfing);

      const insideBar = this.isInsideBar(prev, current);
      if (insideBar) patterns.push(insideBar);

      // Three candle patterns
      if (i >= 2) {
        const morningStar = this.isMorningStar(prev2, prev, current);
        if (morningStar) patterns.push(morningStar);

        const eveningStar = this.isEveningStar(prev2, prev, current);
        if (eveningStar) patterns.push(eveningStar);

        const threeWhiteSoldiers = this.isThreeWhiteSoldiers(prev2, prev, current);
        if (threeWhiteSoldiers) patterns.push(threeWhiteSoldiers);

        const threeBlackCrows = this.isThreeBlackCrows(prev2, prev, current);
        if (threeBlackCrows) patterns.push(threeBlackCrows);
      }
    }

    return patterns.slice(-20); // Return most recent patterns
  }

  /**
   * Identify scalping patterns
   */
  public identifyScalpingPatterns(candles: Candle[]): ScalpingPattern[] {
    const patterns: ScalpingPattern[] = [];
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const closes = candles.map(c => c.close);

    for (let i = this.minPatternLength; i < candles.length - this.minPatternLength; i++) {
      // Flag patterns
      const flag = this.detectFlagPattern(candles, i);
      if (flag) patterns.push(flag);

      // Pennant patterns
      const pennant = this.detectPennantPattern(candles, i);
      if (pennant) patterns.push(pennant);

      // Triangle patterns
      const triangle = this.detectTrianglePattern(candles, i);
      if (triangle) patterns.push(triangle);

      // Rectangle patterns
      const rectangle = this.detectRectanglePattern(candles, i);
      if (rectangle) patterns.push(rectangle);

      // Wedge patterns
      const wedge = this.detectWedgePattern(candles, i);
      if (wedge) patterns.push(wedge);

      // Channel patterns
      const channel = this.detectChannelPattern(candles, i);
      if (channel) patterns.push(channel);
    }

    return patterns;
  }

  /**
   * Detect support and resistance levels
   */
  public detectSupportResistanceLevels(candles: Candle[]): SupportResistanceLevel[] {
    const levels: SupportResistanceLevel[] = [];
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);
    const currentPrice = candles[candles.length - 1].close;

    // Find swing highs and lows
    const swingHighs = this.findSwingHighs(candles);
    const swingLows = this.findSwingLows(candles);

    // Convert swing highs to resistance levels
    for (const swing of swingHighs) {
      const touchCount = this.countTouches(highs, swing.price, 0.002); // 0.2% tolerance
      const volume = this.getVolumeAtPrice(candles, swing.price);
      
      levels.push({
        price: swing.price,
        type: 'resistance',
        strength: this.calculateLevelStrength(touchCount, volume, swing.lastTouch),
        touchCount,
        lastTouch: swing.lastTouch,
        volume,
        timeframe: '1m',
        isActive: Math.abs(swing.price - currentPrice) / currentPrice < 0.05, // 5% range
        breakoutProbability: this.calculateBreakoutProbability(candles, swing.price, 'resistance'),
        priceDistance: Math.abs(swing.price - currentPrice) / currentPrice * 100
      });
    }

    // Convert swing lows to support levels
    for (const swing of swingLows) {
      const touchCount = this.countTouches(lows, swing.price, 0.002);
      const volume = this.getVolumeAtPrice(candles, swing.price);
      
      levels.push({
        price: swing.price,
        type: 'support',
        strength: this.calculateLevelStrength(touchCount, volume, swing.lastTouch),
        touchCount,
        lastTouch: swing.lastTouch,
        volume,
        timeframe: '1m',
        isActive: Math.abs(swing.price - currentPrice) / currentPrice < 0.05,
        breakoutProbability: this.calculateBreakoutProbability(candles, swing.price, 'support'),
        priceDistance: Math.abs(swing.price - currentPrice) / currentPrice * 100
      });
    }

    return levels
      .filter(level => level.touchCount >= 2) // At least 2 touches
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 10); // Top 10 levels
  }

  /**
   * Analyze price action patterns
   */
  public analyzePriceActionPatterns(candles: Candle[]): PriceActionPattern[] {
    const patterns: PriceActionPattern[] = [];

    for (let i = 1; i < candles.length; i++) {
      const current = candles[i];
      const prev = candles[i - 1];

      // Pin bar pattern
      const pinBar = this.isPinBar(current);
      if (pinBar) patterns.push(pinBar);

      // Inside bar pattern
      if (this.isInsideBarPattern(prev, current)) {
        patterns.push({
          name: 'Inside Bar',
          type: 'inside_bar',
          signal: 'NEUTRAL',
          strength: 60,
          timestamp: current.openTime,
          candle: current,
          context: 'Consolidation, await breakout direction',
          followThrough: this.checkFollowThrough(candles, i),
          volumeConfirmation: this.checkVolumeConfirmation(candles, i)
        });
      }

      // Engulfing patterns
      if (this.isBullishEngulfing(prev, current)) {
        patterns.push({
          name: 'Bullish Engulfing',
          type: 'engulfing',
          signal: 'BUY',
          strength: 75,
          timestamp: current.openTime,
          candle: current,
          context: 'Bullish reversal signal',
          followThrough: this.checkFollowThrough(candles, i),
          volumeConfirmation: this.checkVolumeConfirmation(candles, i)
        });
      }

      if (this.isBearishEngulfing(prev, current)) {
        patterns.push({
          name: 'Bearish Engulfing',
          type: 'engulfing',
          signal: 'SELL',
          strength: 75,
          timestamp: current.openTime,
          candle: current,
          context: 'Bearish reversal signal',
          followThrough: this.checkFollowThrough(candles, i),
          volumeConfirmation: this.checkVolumeConfirmation(candles, i)
        });
      }
    }

    return patterns.slice(-15); // Return most recent patterns
  }

  /**
   * Analyze market structure
   */
  public analyzeMarketStructure(candles: Candle[]): MarketStructure {
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    
    const swingHighs = this.findSwingHighs(candles);
    const swingLows = this.findSwingLows(candles);

    // Classify highs and lows
    const higherHighs: number[] = [];
    const higherLows: number[] = [];
    const lowerHighs: number[] = [];
    const lowerLows: number[] = [];

    // Analyze swing highs
    for (let i = 1; i < swingHighs.length; i++) {
      if (swingHighs[i].price > swingHighs[i - 1].price) {
        higherHighs.push(swingHighs[i].price);
      } else {
        lowerHighs.push(swingHighs[i].price);
      }
    }

    // Analyze swing lows
    for (let i = 1; i < swingLows.length; i++) {
      if (swingLows[i].price > swingLows[i - 1].price) {
        higherLows.push(swingLows[i].price);
      } else {
        lowerLows.push(swingLows[i].price);
      }
    }

    // Determine trend
    let trend: 'uptrend' | 'downtrend' | 'sideways';
    let trendStrength = 0;

    if (higherHighs.length > lowerHighs.length && higherLows.length > lowerLows.length) {
      trend = 'uptrend';
      trendStrength = ((higherHighs.length + higherLows.length) / (swingHighs.length + swingLows.length)) * 100;
    } else if (lowerHighs.length > higherHighs.length && lowerLows.length > higherLows.length) {
      trend = 'downtrend';
      trendStrength = ((lowerHighs.length + lowerLows.length) / (swingHighs.length + swingLows.length)) * 100;
    } else {
      trend = 'sideways';
      trendStrength = 50;
    }

    // Check for structure break
    const structureBreak = this.detectStructureBreak(candles, swingHighs, swingLows);

    return {
      trend,
      higherHighs,
      higherLows,
      lowerHighs,
      lowerLows,
      swingHighs,
      swingLows,
      trendStrength,
      structureBreak,
      lastStructureUpdate: Date.now()
    };
  }

  // Candlestick pattern detection methods
  private isDoji(candle: Candle): CandlestickPattern | null {
    const bodySize = Math.abs(candle.close - candle.open);
    const totalRange = candle.high - candle.low;
    const bodyRatio = bodySize / totalRange;

    if (bodyRatio < 0.1 && totalRange > 0) {
      return {
        name: 'Doji',
        type: 'neutral',
        confidence: 70,
        timestamp: candle.openTime,
        candles: [candle],
        description: 'Indecision pattern, potential reversal',
        tradingSignal: 'HOLD',
        reliability: 60,
        timeframe: '1m'
      };
    }

    return null;
  }

  private isHammer(candle: Candle): CandlestickPattern | null {
    const bodySize = Math.abs(candle.close - candle.open);
    const totalRange = candle.high - candle.low;
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;
    const upperWick = candle.high - Math.max(candle.open, candle.close);

    if (lowerWick > bodySize * 2 && upperWick < bodySize * 0.5 && totalRange > 0) {
      return {
        name: 'Hammer',
        type: 'bullish',
        confidence: 75,
        timestamp: candle.openTime,
        candles: [candle],
        description: 'Bullish reversal pattern at support',
        tradingSignal: 'BUY',
        reliability: 70,
        timeframe: '1m',
        stopLoss: candle.low,
        takeProfit: candle.high + (candle.high - candle.low)
      };
    }

    return null;
  }

  private isShootingStar(candle: Candle): CandlestickPattern | null {
    const bodySize = Math.abs(candle.close - candle.open);
    const totalRange = candle.high - candle.low;
    const upperWick = candle.high - Math.max(candle.open, candle.close);
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;

    if (upperWick > bodySize * 2 && lowerWick < bodySize * 0.5 && totalRange > 0) {
      return {
        name: 'Shooting Star',
        type: 'bearish',
        confidence: 75,
        timestamp: candle.openTime,
        candles: [candle],
        description: 'Bearish reversal pattern at resistance',
        tradingSignal: 'SELL',
        reliability: 70,
        timeframe: '1m',
        stopLoss: candle.high,
        takeProfit: candle.low - (candle.high - candle.low)
      };
    }

    return null;
  }

  private isMarubozu(candle: Candle): CandlestickPattern | null {
    const bodySize = Math.abs(candle.close - candle.open);
    const totalRange = candle.high - candle.low;
    const wickRatio = (totalRange - bodySize) / totalRange;

    if (wickRatio < 0.05 && bodySize > 0) {
      const type = candle.close > candle.open ? 'bullish' : 'bearish';
      return {
        name: 'Marubozu',
        type,
        confidence: 80,
        timestamp: candle.openTime,
        candles: [candle],
        description: `Strong ${type} momentum`,
        tradingSignal: type === 'bullish' ? 'BUY' : 'SELL',
        reliability: 75,
        timeframe: '1m'
      };
    }

    return null;
  }

  private isEngulfingPattern(prev: Candle, current: Candle): CandlestickPattern | null {
    if (this.isBullishEngulfing(prev, current)) {
      return {
        name: 'Bullish Engulfing',
        type: 'bullish',
        confidence: 80,
        timestamp: current.openTime,
        candles: [prev, current],
        description: 'Strong bullish reversal signal',
        tradingSignal: 'BUY',
        reliability: 80,
        timeframe: '1m'
      };
    }

    if (this.isBearishEngulfing(prev, current)) {
      return {
        name: 'Bearish Engulfing',
        type: 'bearish',
        confidence: 80,
        timestamp: current.openTime,
        candles: [prev, current],
        description: 'Strong bearish reversal signal',
        tradingSignal: 'SELL',
        reliability: 80,
        timeframe: '1m'
      };
    }

    return null;
  }

  private isInsideBar(prev: Candle, current: Candle): CandlestickPattern | null {
    if (current.high < prev.high && current.low > prev.low) {
      return {
        name: 'Inside Bar',
        type: 'neutral',
        confidence: 65,
        timestamp: current.openTime,
        candles: [prev, current],
        description: 'Consolidation pattern, await breakout',
        tradingSignal: 'HOLD',
        reliability: 60,
        timeframe: '1m'
      };
    }

    return null;
  }

  private isMorningStar(first: Candle, second: Candle, third: Candle): CandlestickPattern | null {
    const firstBearish = first.close < first.open;
    const secondSmall = Math.abs(second.close - second.open) < Math.abs(first.close - first.open) * 0.5;
    const thirdBullish = third.close > third.open;
    const gapDown = second.high < first.low;
    const gapUp = third.open > second.high;

    if (firstBearish && secondSmall && thirdBullish && third.close > (first.open + first.close) / 2) {
      return {
        name: 'Morning Star',
        type: 'bullish',
        confidence: 85,
        timestamp: third.openTime,
        candles: [first, second, third],
        description: 'Strong bullish reversal pattern',
        tradingSignal: 'BUY',
        reliability: 85,
        timeframe: '1m'
      };
    }

    return null;
  }

  private isEveningStar(first: Candle, second: Candle, third: Candle): CandlestickPattern | null {
    const firstBullish = first.close > first.open;
    const secondSmall = Math.abs(second.close - second.open) < Math.abs(first.close - first.open) * 0.5;
    const thirdBearish = third.close < third.open;

    if (firstBullish && secondSmall && thirdBearish && third.close < (first.open + first.close) / 2) {
      return {
        name: 'Evening Star',
        type: 'bearish',
        confidence: 85,
        timestamp: third.openTime,
        candles: [first, second, third],
        description: 'Strong bearish reversal pattern',
        tradingSignal: 'SELL',
        reliability: 85,
        timeframe: '1m'
      };
    }

    return null;
  }

  private isThreeWhiteSoldiers(first: Candle, second: Candle, third: Candle): CandlestickPattern | null {
    const allBullish = first.close > first.open && second.close > second.open && third.close > third.open;
    const ascending = second.close > first.close && third.close > second.close;
    const progressiveOpens = second.open > first.open && third.open > second.open;

    if (allBullish && ascending && progressiveOpens) {
      return {
        name: 'Three White Soldiers',
        type: 'bullish',
        confidence: 80,
        timestamp: third.openTime,
        candles: [first, second, third],
        description: 'Strong bullish continuation',
        tradingSignal: 'BUY',
        reliability: 80,
        timeframe: '1m'
      };
    }

    return null;
  }

  private isThreeBlackCrows(first: Candle, second: Candle, third: Candle): CandlestickPattern | null {
    const allBearish = first.close < first.open && second.close < second.open && third.close < third.open;
    const descending = second.close < first.close && third.close < second.close;
    const progressiveOpens = second.open < first.open && third.open < second.open;

    if (allBearish && descending && progressiveOpens) {
      return {
        name: 'Three Black Crows',
        type: 'bearish',
        confidence: 80,
        timestamp: third.openTime,
        candles: [first, second, third],
        description: 'Strong bearish continuation',
        tradingSignal: 'SELL',
        reliability: 80,
        timeframe: '1m'
      };
    }

    return null;
  }

  // Pattern detection helper methods
  private detectFlagPattern(candles: Candle[], centerIndex: number): ScalpingPattern | null {
    if (centerIndex < 10 || centerIndex > candles.length - 5) return null;

    const poleCandles = candles.slice(centerIndex - 10, centerIndex - 5);
    const flagCandles = candles.slice(centerIndex - 5, centerIndex);

    // Check for strong price move (pole)
    const poleMove = (poleCandles[poleCandles.length - 1].close - poleCandles[0].close) / poleCandles[0].close;
    if (Math.abs(poleMove) < 0.02) return null; // Need at least 2% move for pole

    // Check for consolidation (flag)
    const flagHigh = Math.max(...flagCandles.map(c => c.high));
    const flagLow = Math.min(...flagCandles.map(c => c.low));
    const consolidationRange = (flagHigh - flagLow) / flagCandles[0].close;

    if (consolidationRange > 0.015) return null; // Flag should be tight consolidation

    const direction = poleMove > 0 ? 'bullish' : 'bearish';
    const breakoutLevel = direction === 'bullish' ? flagHigh : flagLow;
    const targetPrice = direction === 'bullish' ? 
      breakoutLevel + Math.abs(poleMove) * poleCandles[0].close :
      breakoutLevel - Math.abs(poleMove) * poleCandles[0].close;

    return {
      name: 'Flag Pattern',
      type: 'flag',
      direction,
      breakoutLevel,
      targetPrice,
      stopLoss: direction === 'bullish' ? flagLow : flagHigh,
      confidence: 75,
      timestamp: candles[centerIndex].openTime,
      expectedDuration: 5,
      volumeConfirmation: this.checkVolumePattern(candles, centerIndex),
      priceAction: {
        entryZone: { 
          min: direction === 'bullish' ? breakoutLevel : breakoutLevel - 0.001,
          max: direction === 'bullish' ? breakoutLevel + 0.001 : breakoutLevel
        },
        consolidationRange,
        breakoutStrength: Math.abs(poleMove) * 100
      }
    };
  }

  private detectPennantPattern(candles: Candle[], centerIndex: number): ScalpingPattern | null {
    if (centerIndex < 12 || centerIndex > candles.length - 3) return null;

    // Pennant = strong pole + converging trendlines (like a small symmetrical triangle)
    const poleCandles = candles.slice(centerIndex - 12, centerIndex - 6);
    const pennantCandles = candles.slice(centerIndex - 6, centerIndex);

    // Require a strong pole move (≥ 1.5%)
    const poleMove = (poleCandles[poleCandles.length - 1].close - poleCandles[0].close) / poleCandles[0].close;
    if (Math.abs(poleMove) < 0.015) return null;

    // Fit linear regression on pennant highs and lows
    const highSlope = this.linRegSlope(pennantCandles.map(c => c.high));
    const lowSlope = this.linRegSlope(pennantCandles.map(c => c.low));

    // Highs must be falling and lows must be rising (converging)
    if (highSlope >= 0 || lowSlope <= 0) return null;

    // Convergence rate: slopes should have similar magnitude
    const convergence = Math.abs(highSlope) + Math.abs(lowSlope);
    const balance = Math.min(Math.abs(highSlope), Math.abs(lowSlope)) / Math.max(Math.abs(highSlope), Math.abs(lowSlope));
    if (balance < 0.3) return null; // Too lopsided — not a pennant

    const pennantHigh = Math.max(...pennantCandles.map(c => c.high));
    const pennantLow = Math.min(...pennantCandles.map(c => c.low));
    const consolidationRange = (pennantHigh - pennantLow) / pennantCandles[0].close;

    const direction = poleMove > 0 ? 'bullish' : 'bearish';
    const breakoutLevel = direction === 'bullish' ? pennantHigh : pennantLow;
    const measured = Math.abs(poleMove) * poleCandles[0].close;
    const targetPrice = direction === 'bullish' ? breakoutLevel + measured : breakoutLevel - measured;

    return {
      name: 'Pennant Pattern',
      type: 'pennant',
      direction,
      breakoutLevel,
      targetPrice,
      stopLoss: direction === 'bullish' ? pennantLow : pennantHigh,
      confidence: 70 + Math.round(balance * 10),
      timestamp: candles[centerIndex].openTime,
      expectedDuration: 5,
      volumeConfirmation: this.checkVolumePattern(candles, centerIndex),
      priceAction: {
        entryZone: {
          min: direction === 'bullish' ? breakoutLevel : breakoutLevel - consolidationRange * pennantCandles[0].close * 0.2,
          max: direction === 'bullish' ? breakoutLevel + consolidationRange * pennantCandles[0].close * 0.2 : breakoutLevel,
        },
        consolidationRange,
        breakoutStrength: Math.abs(poleMove) * 100,
      },
    };
  }

  private detectTrianglePattern(candles: Candle[], centerIndex: number): ScalpingPattern | null {
    if (centerIndex < 10 || centerIndex > candles.length - 3) return null;

    const window = candles.slice(centerIndex - 10, centerIndex);
    const highs = window.map(c => c.high);
    const lows = window.map(c => c.low);
    const highSlope = this.linRegSlope(highs);
    const lowSlope = this.linRegSlope(lows);
    const price = window[0].close;

    // Normalise slopes relative to price so thresholds are comparable across assets
    const normHigh = highSlope / price;
    const normLow = lowSlope / price;
    const flatThreshold = 0.00002; // basically flat

    let direction: 'bullish' | 'bearish';
    let subType: string;

    if (Math.abs(normHigh) < flatThreshold && normLow > flatThreshold) {
      // Ascending triangle: flat top, rising lows → bullish
      direction = 'bullish';
      subType = 'Ascending';
    } else if (normHigh < -flatThreshold && Math.abs(normLow) < flatThreshold) {
      // Descending triangle: falling highs, flat bottom → bearish
      direction = 'bearish';
      subType = 'Descending';
    } else if (normHigh < -flatThreshold && normLow > flatThreshold) {
      // Symmetrical triangle: converging → direction from prior trend
      const priorMove = (window[0].close - candles[Math.max(centerIndex - 15, 0)].close) / candles[Math.max(centerIndex - 15, 0)].close;
      direction = priorMove > 0 ? 'bullish' : 'bearish';
      subType = 'Symmetrical';
    } else {
      return null;
    }

    const windowHigh = Math.max(...highs);
    const windowLow = Math.min(...lows);
    const consolidationRange = (windowHigh - windowLow) / price;
    if (consolidationRange < 0.003 || consolidationRange > 0.05) return null; // too tight or too wide

    const breakoutLevel = direction === 'bullish' ? windowHigh : windowLow;
    const targetPrice = direction === 'bullish'
      ? breakoutLevel + (windowHigh - windowLow)
      : breakoutLevel - (windowHigh - windowLow);

    return {
      name: `${subType} Triangle`,
      type: 'triangle',
      direction,
      breakoutLevel,
      targetPrice,
      stopLoss: direction === 'bullish' ? windowLow : windowHigh,
      confidence: subType === 'Symmetrical' ? 65 : 75,
      timestamp: candles[centerIndex].openTime,
      expectedDuration: 8,
      volumeConfirmation: this.checkVolumePattern(candles, centerIndex),
      priceAction: {
        entryZone: {
          min: direction === 'bullish' ? breakoutLevel : breakoutLevel - consolidationRange * price * 0.15,
          max: direction === 'bullish' ? breakoutLevel + consolidationRange * price * 0.15 : breakoutLevel,
        },
        consolidationRange,
        breakoutStrength: consolidationRange * 100,
      },
    };
  }

  private detectRectanglePattern(candles: Candle[], centerIndex: number): ScalpingPattern | null {
    if (centerIndex < 10 || centerIndex > candles.length - 3) return null;

    const window = candles.slice(centerIndex - 10, centerIndex);
    const highs = window.map(c => c.high);
    const lows = window.map(c => c.low);
    const price = window[0].close;

    // Both trendlines should be roughly flat
    const normHighSlope = Math.abs(this.linRegSlope(highs) / price);
    const normLowSlope = Math.abs(this.linRegSlope(lows) / price);
    const flatThreshold = 0.00003;
    if (normHighSlope > flatThreshold || normLowSlope > flatThreshold) return null;

    const rectHigh = Math.max(...highs);
    const rectLow = Math.min(...lows);
    const consolidationRange = (rectHigh - rectLow) / price;

    // Ensure meaningful range
    if (consolidationRange < 0.003 || consolidationRange > 0.03) return null;

    // Require at least 2 touches on each side (within 0.15% tolerance)
    const topTouches = highs.filter(h => (rectHigh - h) / price < 0.0015).length;
    const bottomTouches = lows.filter(l => (l - rectLow) / price < 0.0015).length;
    if (topTouches < 2 || bottomTouches < 2) return null;

    // Direction from prior trend
    const priorClose = candles[Math.max(centerIndex - 15, 0)].close;
    const direction: 'bullish' | 'bearish' = window[0].close > priorClose ? 'bullish' : 'bearish';
    const breakoutLevel = direction === 'bullish' ? rectHigh : rectLow;
    const targetPrice = direction === 'bullish'
      ? rectHigh + (rectHigh - rectLow)
      : rectLow - (rectHigh - rectLow);

    return {
      name: 'Rectangle Pattern',
      type: 'rectangle',
      direction,
      breakoutLevel,
      targetPrice,
      stopLoss: direction === 'bullish' ? rectLow : rectHigh,
      confidence: 70,
      timestamp: candles[centerIndex].openTime,
      expectedDuration: 10,
      volumeConfirmation: this.checkVolumePattern(candles, centerIndex),
      priceAction: {
        entryZone: {
          min: direction === 'bullish' ? breakoutLevel : breakoutLevel - (rectHigh - rectLow) * 0.1,
          max: direction === 'bullish' ? breakoutLevel + (rectHigh - rectLow) * 0.1 : breakoutLevel,
        },
        consolidationRange,
        breakoutStrength: consolidationRange * 100,
      },
    };
  }

  private detectWedgePattern(candles: Candle[], centerIndex: number): ScalpingPattern | null {
    if (centerIndex < 10 || centerIndex > candles.length - 3) return null;

    const window = candles.slice(centerIndex - 10, centerIndex);
    const highs = window.map(c => c.high);
    const lows = window.map(c => c.low);
    const price = window[0].close;

    const highSlope = this.linRegSlope(highs);
    const lowSlope = this.linRegSlope(lows);
    const normHigh = highSlope / price;
    const normLow = lowSlope / price;

    // Both slopes must go in the same direction AND converge
    const slopeDiff = Math.abs(normHigh - normLow);
    const sameDirection = (normHigh > 0 && normLow > 0) || (normHigh < 0 && normLow < 0);
    if (!sameDirection) return null;

    // Must be converging — the upper trendline slope should be less steep (for rising)
    // or the lower trendline slope should be less steep (for falling)
    const converging = Math.abs(normHigh) < Math.abs(normLow)
      ? normHigh > 0 // rising wedge: high slope < low slope
      : normHigh < 0; // falling wedge: high slope > low slope (closer to zero)
    if (!converging && Math.abs(normHigh) !== Math.abs(normLow)) {
      // Actually check properly: trendlines must get closer
      const rangeStart = highs[0] - lows[0];
      const rangeEnd = highs[highs.length - 1] - lows[lows.length - 1];
      if (rangeEnd >= rangeStart) return null; // diverging or parallel
    }

    const wedgeHigh = Math.max(...highs);
    const wedgeLow = Math.min(...lows);
    const consolidationRange = (wedgeHigh - wedgeLow) / price;
    if (consolidationRange < 0.003) return null;

    // Rising wedge → bearish; Falling wedge → bullish
    const isRising = normHigh > 0;
    const direction: 'bullish' | 'bearish' = isRising ? 'bearish' : 'bullish';
    const breakoutLevel = direction === 'bullish' ? wedgeHigh : wedgeLow;
    const targetPrice = direction === 'bullish'
      ? breakoutLevel + (wedgeHigh - wedgeLow) * 0.618
      : breakoutLevel - (wedgeHigh - wedgeLow) * 0.618;

    return {
      name: `${isRising ? 'Rising' : 'Falling'} Wedge`,
      type: 'wedge',
      direction,
      breakoutLevel,
      targetPrice,
      stopLoss: direction === 'bullish' ? wedgeLow : wedgeHigh,
      confidence: 70,
      timestamp: candles[centerIndex].openTime,
      expectedDuration: 8,
      volumeConfirmation: this.checkVolumePattern(candles, centerIndex),
      priceAction: {
        entryZone: {
          min: direction === 'bullish' ? breakoutLevel : breakoutLevel - (wedgeHigh - wedgeLow) * 0.1,
          max: direction === 'bullish' ? breakoutLevel + (wedgeHigh - wedgeLow) * 0.1 : breakoutLevel,
        },
        consolidationRange,
        breakoutStrength: consolidationRange * 100,
      },
    };
  }

  private detectChannelPattern(candles: Candle[], centerIndex: number): ScalpingPattern | null {
    if (centerIndex < 12 || centerIndex > candles.length - 3) return null;

    const window = candles.slice(centerIndex - 12, centerIndex);
    const highs = window.map(c => c.high);
    const lows = window.map(c => c.low);
    const price = window[0].close;

    const highSlope = this.linRegSlope(highs);
    const lowSlope = this.linRegSlope(lows);
    const normHigh = highSlope / price;
    const normLow = lowSlope / price;

    // Both slopes must go in the same direction (parallel channel)
    if ((normHigh > 0) !== (normLow > 0)) return null;

    // Slopes must be similar in magnitude (parallel) — ratio close to 1
    const slopeRatio = Math.abs(highSlope) > 0 ? Math.abs(lowSlope / highSlope) : 0;
    if (slopeRatio < 0.5 || slopeRatio > 2.0) return null;

    // Must have a meaningful slope — not just a rectangle
    const flatThreshold = 0.00003;
    if (Math.abs(normHigh) < flatThreshold && Math.abs(normLow) < flatThreshold) return null;

    const channelHigh = Math.max(...highs);
    const channelLow = Math.min(...lows);
    const consolidationRange = (channelHigh - channelLow) / price;
    if (consolidationRange < 0.004) return null;

    // Require bounces: at least 2 touches near each trendline
    const highLine = this.linRegValues(highs);
    const lowLine = this.linRegValues(lows);
    const tolerance = consolidationRange * price * 0.15;
    const topTouches = highs.filter((h, i) => Math.abs(h - highLine[i]) < tolerance).length;
    const botTouches = lows.filter((l, i) => Math.abs(l - lowLine[i]) < tolerance).length;
    if (topTouches < 3 || botTouches < 3) return null;

    const isAscending = normHigh > 0;
    // Ascending channel → continuation bullish, but watch for bearish breakdown
    // Descending channel → continuation bearish, but watch for bullish breakout
    const direction: 'bullish' | 'bearish' = isAscending ? 'bullish' : 'bearish';
    const breakoutLevel = direction === 'bullish' ? channelHigh : channelLow;
    const targetPrice = direction === 'bullish'
      ? channelHigh + (channelHigh - channelLow) * 0.5
      : channelLow - (channelHigh - channelLow) * 0.5;

    return {
      name: `${isAscending ? 'Ascending' : 'Descending'} Channel`,
      type: 'channel',
      direction,
      breakoutLevel,
      targetPrice,
      stopLoss: direction === 'bullish' ? channelLow : channelHigh,
      confidence: 65 + Math.round((slopeRatio > 1 ? 1 / slopeRatio : slopeRatio) * 10),
      timestamp: candles[centerIndex].openTime,
      expectedDuration: 10,
      volumeConfirmation: this.checkVolumePattern(candles, centerIndex),
      priceAction: {
        entryZone: {
          min: direction === 'bullish' ? breakoutLevel : breakoutLevel - (channelHigh - channelLow) * 0.1,
          max: direction === 'bullish' ? breakoutLevel + (channelHigh - channelLow) * 0.1 : breakoutLevel,
        },
        consolidationRange,
        breakoutStrength: Math.abs(normHigh) * 10000,
      },
    };
  }

  /** Simple linear regression slope for an array of values (indexed 0..n-1). */
  private linRegSlope(values: number[]): number {
    const n = values.length;
    if (n < 2) return 0;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
      sumX += i;
      sumY += values[i];
      sumXY += i * values[i];
      sumX2 += i * i;
    }
    const denom = n * sumX2 - sumX * sumX;
    return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
  }

  /** Return the fitted y-values of a linear regression on values[]. */
  private linRegValues(values: number[]): number[] {
    const n = values.length;
    const slope = this.linRegSlope(values);
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const midX = (n - 1) / 2;
    const intercept = mean - slope * midX;
    return values.map((_, i) => intercept + slope * i);
  }

  // Helper methods for pattern analysis
  private findSwingHighs(candles: Candle[], lookback: number = 5): SupportResistanceLevel[] {
    const swingHighs: SupportResistanceLevel[] = [];

    for (let i = lookback; i < candles.length - lookback; i++) {
      const isSwingHigh = candles.slice(i - lookback, i + lookback + 1)
        .every((candle, idx) => idx === lookback || candle.high <= candles[i].high);

      if (isSwingHigh) {
        swingHighs.push({
          price: candles[i].high,
          type: 'resistance',
          strength: 0,
          touchCount: 1,
          lastTouch: candles[i].openTime,
          volume: candles[i].volume,
          timeframe: '1m',
          isActive: true,
          breakoutProbability: 0,
          priceDistance: 0
        });
      }
    }

    return swingHighs;
  }

  private findSwingLows(candles: Candle[], lookback: number = 5): SupportResistanceLevel[] {
    const swingLows: SupportResistanceLevel[] = [];

    for (let i = lookback; i < candles.length - lookback; i++) {
      const isSwingLow = candles.slice(i - lookback, i + lookback + 1)
        .every((candle, idx) => idx === lookback || candle.low >= candles[i].low);

      if (isSwingLow) {
        swingLows.push({
          price: candles[i].low,
          type: 'support',
          strength: 0,
          touchCount: 1,
          lastTouch: candles[i].openTime,
          volume: candles[i].volume,
          timeframe: '1m',
          isActive: true,
          breakoutProbability: 0,
          priceDistance: 0
        });
      }
    }

    return swingLows;
  }

  private countTouches(prices: number[], level: number, tolerance: number): number {
    return prices.filter(price => Math.abs(price - level) / level <= tolerance).length;
  }

  private getVolumeAtPrice(candles: Candle[], price: number): number {
    return candles
      .filter(c => c.low <= price && c.high >= price)
      .reduce((sum, c) => sum + c.volume, 0);
  }

  private calculateLevelStrength(touches: number, volume: number, timestamp: number): number {
    const touchScore = Math.min(touches * 20, 60);
    const volumeScore = Math.min(volume / 1000000, 20); // Normalize volume
    const ageScore = Math.max(20 - (Date.now() - timestamp) / (1000 * 60 * 60), 0); // Age in hours
    
    return touchScore + volumeScore + ageScore;
  }

  private calculateBreakoutProbability(candles: Candle[], level: number, type: 'support' | 'resistance'): number {
    const currentPrice = candles[candles.length - 1].close;
    const distance = Math.abs(currentPrice - level) / level;
    
    if (distance > 0.05) return 30; // Too far away
    
    const recentCandles = candles.slice(-10);
    const volumeIncrease = recentCandles[recentCandles.length - 1].volume > 
      recentCandles.slice(0, -1).reduce((sum, c) => sum + c.volume, 0) / 9;
    
    return volumeIncrease ? 70 : 50;
  }

  private isPinBar(candle: Candle): PriceActionPattern | null {
    const bodySize = Math.abs(candle.close - candle.open);
    const totalRange = candle.high - candle.low;
    const upperWick = candle.high - Math.max(candle.open, candle.close);
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;

    const longWick = Math.max(upperWick, lowerWick);
    const shortWick = Math.min(upperWick, lowerWick);

    if (longWick > bodySize * 3 && shortWick < bodySize && totalRange > 0) {
      const signal = upperWick > lowerWick ? 'SELL' : 'BUY';
      return {
        name: 'Pin Bar',
        type: 'pin_bar',
        signal,
        strength: 80,
        timestamp: candle.openTime,
        candle,
        context: `${signal === 'BUY' ? 'Bullish' : 'Bearish'} rejection at key level`,
        followThrough: false,
        volumeConfirmation: false
      };
    }

    return null;
  }

  private isInsideBarPattern(prev: Candle, current: Candle): boolean {
    return current.high < prev.high && current.low > prev.low;
  }

  private isBullishEngulfing(prev: Candle, current: Candle): boolean {
    return prev.close < prev.open && // Previous bearish
           current.close > current.open && // Current bullish
           current.open < prev.close && // Opens below previous close
           current.close > prev.open; // Closes above previous open
  }

  private isBearishEngulfing(prev: Candle, current: Candle): boolean {
    return prev.close > prev.open && // Previous bullish
           current.close < current.open && // Current bearish
           current.open > prev.close && // Opens above previous close
           current.close < prev.open; // Closes below previous open
  }

  private checkFollowThrough(candles: Candle[], index: number): boolean {
    if (index >= candles.length - 1) return false;
    
    const currentCandle = candles[index];
    const nextCandle = candles[index + 1];
    
    // Check if next candle follows the pattern direction
    if (currentCandle.close > currentCandle.open) {
      return nextCandle.close > nextCandle.open && nextCandle.close > currentCandle.close;
    } else {
      return nextCandle.close < nextCandle.open && nextCandle.close < currentCandle.close;
    }
  }

  private checkVolumeConfirmation(candles: Candle[], index: number): boolean {
    if (index < 5) return false;
    
    const currentVolume = candles[index].volume;
    const avgVolume = candles.slice(index - 5, index)
      .reduce((sum, c) => sum + c.volume, 0) / 5;
    
    return currentVolume > avgVolume * 1.2;
  }

  private checkVolumePattern(candles: Candle[], index: number): boolean {
    if (index < 10) return false;
    
    const flagVolume = candles.slice(index - 5, index)
      .reduce((sum, c) => sum + c.volume, 0) / 5;
    const poleVolume = candles.slice(index - 10, index - 5)
      .reduce((sum, c) => sum + c.volume, 0) / 5;
    
    return flagVolume < poleVolume * 0.7; // Volume should dry up in flag
  }

  private detectStructureBreak(candles: Candle[], highs: SupportResistanceLevel[], lows: SupportResistanceLevel[]): boolean {
    if (candles.length < 20) return false;
    
    const currentPrice = candles[candles.length - 1].close;
    const recentHigh = Math.max(...candles.slice(-10).map(c => c.high));
    const recentLow = Math.min(...candles.slice(-10).map(c => c.low));
    
    // Check if recent price broke above recent structure high
    const structureHigh = Math.max(...highs.slice(-5).map(h => h.price));
    const structureLow = Math.min(...lows.slice(-5).map(l => l.price));
    
    return recentHigh > structureHigh * 1.002 || recentLow < structureLow * 0.998;
  }

  /**
   * Get comprehensive pattern analysis
   */
  public getPatternAnalysis(candles: Candle[]): {
    candlestickPatterns: CandlestickPattern[],
    scalpingPatterns: ScalpingPattern[],
    supportResistance: SupportResistanceLevel[],
    priceActionPatterns: PriceActionPattern[],
    marketStructure: MarketStructure
  } {
    return {
      candlestickPatterns: this.recognizeCandlestickPatterns(candles),
      scalpingPatterns: this.identifyScalpingPatterns(candles),
      supportResistance: this.detectSupportResistanceLevels(candles),
      priceActionPatterns: this.analyzePriceActionPatterns(candles),
      marketStructure: this.analyzeMarketStructure(candles)
    };
  }

  /**
   * Get pattern-based trading recommendations
   */
  public getPatternRecommendations(candles: Candle[]): string[] {
    const recommendations: string[] = [];
    const analysis = this.getPatternAnalysis(candles);
    
    // Check for strong candlestick patterns
    const strongPatterns = analysis.candlestickPatterns.filter(p => p.confidence > 80);
    if (strongPatterns.length > 0) {
      recommendations.push(`Strong candlestick patterns detected: ${strongPatterns.map(p => p.name).join(', ')}`);
    }
    
    // Check for scalping opportunities
    if (analysis.scalpingPatterns.length > 0) {
      recommendations.push('Scalping patterns identified - monitor for breakouts');
    }
    
    // Check support/resistance proximity
    const nearbyLevels = analysis.supportResistance.filter(level => level.priceDistance < 2);
    if (nearbyLevels.length > 0) {
      recommendations.push(`Price near key levels: ${nearbyLevels[0].type} at ${nearbyLevels[0].price.toFixed(4)}`);
    }
    
    // Market structure recommendations
    if (analysis.marketStructure.structureBreak) {
      recommendations.push('STRUCTURE BREAK: Major level broken - trend may be changing');
    }
    
    if (analysis.marketStructure.trendStrength > 70) {
      recommendations.push(`Strong ${analysis.marketStructure.trend} detected - consider trend following`);
    }
    
    return recommendations;
  }
}