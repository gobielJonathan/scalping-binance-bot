import { TechnicalIndicators } from '../utils/technicalIndicators';
import { TradingSignal, Candle, MarketData } from '../types';
import config from '../config';

/**
 * Scalping strategy implementation
 * Focuses on quick trades to capture small price movements
 */
export class ScalpingStrategy {
  private readonly emaShort: number;
  private readonly emaLong: number;
  private readonly rsiPeriod: number;
  private readonly rsiOverbought: number = 70;
  private readonly rsiOversold: number = 30;
  
  constructor() {
    this.emaShort = config.indicators.emaShort;
    this.emaLong = config.indicators.emaLong;
    this.rsiPeriod = config.indicators.rsiPeriod;
  }

  /**
   * Generate trading signal based on scalping strategy
   */
  generateSignal(candles: Candle[], _marketData: MarketData): TradingSignal {
    if (candles.length < Math.max(this.emaLong, this.rsiPeriod) + 1) {
      return this.createHoldSignal('Insufficient data', candles);
    }

    const prices = candles.map(c => c.close);
    const volumes = candles.map(c => c.volume);
    
    // Calculate technical indicators
    const emaShortArray = TechnicalIndicators.calculateEMA(prices, this.emaShort);
    const emaLongArray = TechnicalIndicators.calculateEMA(prices, this.emaLong);
    const rsiArray = TechnicalIndicators.calculateRSI(prices, this.rsiPeriod);
    const macd = TechnicalIndicators.calculateMACD(prices);
    const bollinger = TechnicalIndicators.calculateBollingerBands(prices);

    if (emaShortArray.length === 0 || emaLongArray.length === 0 || rsiArray.length === 0) {
      return this.createHoldSignal('Insufficient indicator data', candles);
    }

    // Get current values with safe defaults
    const currentEmaShort = emaShortArray[emaShortArray.length - 1] ?? 0;
    const currentEmaLong = emaLongArray[emaLongArray.length - 1] ?? 0;
    const currentRsi = rsiArray[rsiArray.length - 1] ?? 50;
    const currentPrice = prices[prices.length - 1] ?? 0;
    
    // Previous values for trend detection
    const prevEmaShort = emaShortArray[emaShortArray.length - 2] ?? currentEmaShort;
    const prevEmaLong = emaLongArray[emaLongArray.length - 2] ?? currentEmaLong;
    const prevPrice = prices[prices.length - 2] ?? currentPrice;
    
    // MACD values with null safety
    const currentMacd = macd.macd.length > 0 ? (macd.macd[macd.macd.length - 1] ?? 0) : 0;
    const currentMacdSignal = macd.signal.length > 0 ? (macd.signal[macd.signal.length - 1] ?? 0) : 0;
    const currentMacdHistogram = macd.histogram.length > 0 ? (macd.histogram[macd.histogram.length - 1] ?? 0) : 0;
    
    // Bollinger Band values with null safety
    const currentBbUpper = bollinger.upper.length > 0 ? (bollinger.upper[bollinger.upper.length - 1] ?? currentPrice * 1.02) : currentPrice * 1.02;
    const currentBbMiddle = bollinger.middle.length > 0 ? (bollinger.middle[bollinger.middle.length - 1] ?? currentPrice) : currentPrice;
    const currentBbLower = bollinger.lower.length > 0 ? (bollinger.lower[bollinger.lower.length - 1] ?? currentPrice * 0.98) : currentPrice * 0.98;

    // Current volume and price changes
    const currentVolume = volumes[volumes.length - 1] ?? 0;
    const priceChange = currentPrice - prevPrice;
    const priceChangePercent = prevPrice !== 0 ? ((currentPrice - prevPrice) / prevPrice) * 100 : 0;

    const indicators = {
      ema9: currentEmaShort,
      ema21: currentEmaLong,
      rsi: currentRsi,
      macd: currentMacd,
      macdSignal: currentMacdSignal,
      macdHistogram: currentMacdHistogram,
      bollingerUpper: currentBbUpper,
      bollingerMiddle: currentBbMiddle,
      bollingerLower: currentBbLower,
      volume: currentVolume,
      priceChange: priceChange,
      priceChangePercent: priceChangePercent
    };

    // Check volume and volatility conditions
    const avgVolume = volumes.slice(-20).reduce((sum, vol) => sum + vol, 0) / 20;
    
    // Volume should be above average for scalping
    const volumeMultiplier = avgVolume > 0 ? currentVolume / avgVolume : 1;
    const isHighVolume = volumeMultiplier > 1.2;
    
    // Scalping buy conditions
    const buyConditions = this.checkBuyConditions(
      currentEmaShort, currentEmaLong, prevEmaShort, prevEmaLong,
      currentRsi, currentMacd, currentMacdSignal, currentPrice,
      currentBbLower, currentBbMiddle, isHighVolume, priceChangePercent
    );
    
    // Scalping sell conditions
    const sellConditions = this.checkSellConditions(
      currentEmaShort, currentEmaLong, prevEmaShort, prevEmaLong,
      currentRsi, currentMacd, currentMacdSignal, currentPrice,
      currentBbUpper, currentBbMiddle, isHighVolume, priceChangePercent
    );

    if (buyConditions.signal) {
      return {
        type: 'BUY',
        strength: buyConditions.strength,
        confidence: buyConditions.confidence,
        reason: buyConditions.reason,
        timestamp: Date.now(),
        indicators
      };
    } else if (sellConditions.signal) {
      return {
        type: 'SELL',
        strength: sellConditions.strength,
        confidence: sellConditions.confidence,
        reason: sellConditions.reason,
        timestamp: Date.now(),
        indicators
      };
    }

    return this.createHoldSignal('No strong signal detected', candles, indicators);
  }

  /**
   * Check buy conditions for scalping
   */
  private checkBuyConditions(
    emaShort: number, emaLong: number, prevEmaShort: number, prevEmaLong: number,
    rsi: number, macd: number, macdSignal: number, price: number,
    bbLower: number, bbMiddle: number, isHighVolume: boolean, priceChangePercent: number
  ) {
    let strength = 0;
    let confidence = 0;
    const reasons: string[] = [];

    // EMA crossover and trend
    if (emaShort > emaLong && prevEmaShort <= prevEmaLong) {
      strength += 30;
      confidence += 25;
      reasons.push('EMA bullish crossover');
    } else if (emaShort > emaLong) {
      strength += 15;
      confidence += 10;
      reasons.push('EMA bullish trend');
    }

    // RSI oversold bounce
    if (rsi < this.rsiOversold && rsi > 25) {
      strength += 25;
      confidence += 20;
      reasons.push('RSI oversold bounce');
    } else if (rsi < 40 && rsi > this.rsiOversold) {
      strength += 15;
      confidence += 10;
      reasons.push('RSI recovery from oversold');
    }

    // MACD bullish signals
    if (macd > macdSignal && macd < 0) {
      strength += 20;
      confidence += 15;
      reasons.push('MACD bullish divergence');
    }

    // Bollinger Band support
    if (price <= bbLower * 1.002) {
      strength += 20;
      confidence += 15;
      reasons.push('Price near BB lower band');
    } else if (price < bbMiddle && price > bbLower) {
      strength += 10;
      confidence += 5;
      reasons.push('Price below BB middle');
    }

    // Volume confirmation
    if (isHighVolume) {
      strength += 10;
      confidence += 10;
      reasons.push('High volume confirmation');
    }

    // Recent price decline (good for scalping entries)
    if (priceChangePercent < -0.1 && priceChangePercent > -0.5) {
      strength += 15;
      confidence += 10;
      reasons.push('Minor price decline');
    }

    // Minimum threshold for scalping signals
    const signal = strength >= 50 && confidence >= 40;
    
    return {
      signal,
      strength: Math.min(strength, 100),
      confidence: Math.min(confidence, 100),
      reason: reasons.join(', ') || 'Weak buy signal'
    };
  }

  /**
   * Check sell conditions for scalping
   */
  private checkSellConditions(
    emaShort: number, emaLong: number, prevEmaShort: number, prevEmaLong: number,
    rsi: number, macd: number, macdSignal: number, price: number,
    bbUpper: number, bbMiddle: number, isHighVolume: boolean, priceChangePercent: number
  ) {
    let strength = 0;
    let confidence = 0;
    const reasons: string[] = [];

    // EMA crossover and trend
    if (emaShort < emaLong && prevEmaShort >= prevEmaLong) {
      strength += 30;
      confidence += 25;
      reasons.push('EMA bearish crossover');
    } else if (emaShort < emaLong) {
      strength += 15;
      confidence += 10;
      reasons.push('EMA bearish trend');
    }

    // RSI overbought reversal
    if (rsi > this.rsiOverbought && rsi < 75) {
      strength += 25;
      confidence += 20;
      reasons.push('RSI overbought reversal');
    } else if (rsi > 60 && rsi < this.rsiOverbought) {
      strength += 15;
      confidence += 10;
      reasons.push('RSI approaching overbought');
    }

    // MACD bearish signals
    if (macd < macdSignal && macd > 0) {
      strength += 20;
      confidence += 15;
      reasons.push('MACD bearish divergence');
    }

    // Bollinger Band resistance
    if (price >= bbUpper * 0.998) {
      strength += 20;
      confidence += 15;
      reasons.push('Price near BB upper band');
    } else if (price > bbMiddle && price < bbUpper) {
      strength += 10;
      confidence += 5;
      reasons.push('Price above BB middle');
    }

    // Volume confirmation
    if (isHighVolume) {
      strength += 10;
      confidence += 10;
      reasons.push('High volume confirmation');
    }

    // Recent price increase (good for scalping exits)
    if (priceChangePercent > 0.1 && priceChangePercent < 0.5) {
      strength += 15;
      confidence += 10;
      reasons.push('Minor price increase');
    }

    // Minimum threshold for scalping signals
    const signal = strength >= 50 && confidence >= 40;
    
    return {
      signal,
      strength: Math.min(strength, 100),
      confidence: Math.min(confidence, 100),
      reason: reasons.join(', ') || 'Weak sell signal'
    };
  }

  /**
   * Create a HOLD signal
   */
  private createHoldSignal(reason: string, candles: Candle[], customIndicators?: any): TradingSignal {
    const prices = candles.map(c => c.close);
    const currentPrice = prices[prices.length - 1] ?? 0;
    const prevPrice = prices[prices.length - 2] ?? currentPrice;
    
    const indicators = customIndicators || {
      ema9: currentPrice,
      ema21: currentPrice,
      rsi: 50,
      macd: 0,
      macdSignal: 0,
      macdHistogram: 0,
      bollingerUpper: currentPrice * 1.02,
      bollingerMiddle: currentPrice,
      bollingerLower: currentPrice * 0.98,
      volume: candles[candles.length - 1]?.volume ?? 0,
      priceChange: currentPrice - prevPrice,
      priceChangePercent: prevPrice !== 0 ? ((currentPrice - prevPrice) / prevPrice) * 100 : 0
    };
    
    return {
      type: 'HOLD',
      strength: 0,
      confidence: 0,
      reason,
      timestamp: Date.now(),
      indicators
    };
  }

  /**
   * Check if current market conditions are suitable for scalping
   */
  isScalpingConditionsGood(marketData: MarketData, volatility: number): boolean {
    // Good scalping conditions:
    // 1. Reasonable spread (< 0.1%)
    // 2. Good volatility (not too high, not too low)
    // 3. Decent volume
    
    const spreadPercent = ((marketData.ask - marketData.bid) / marketData.price) * 100;
    const isGoodSpread = spreadPercent < 0.1;
    const isGoodVolatility = volatility > 0.001 && volatility < 0.05; // 0.1% to 5%
    const hasVolume = marketData.volume24h > 0;
    
    return isGoodSpread && isGoodVolatility && hasVolume;
  }

  /**
   * Get optimal position size for scalping based on volatility
   */
  getOptimalPositionSize(accountBalance: number, volatility: number): number {
    const baseRiskPerTrade = config.trading.riskPerTrade;
    
    // Reduce position size in high volatility
    const volatilityAdjustment = Math.max(0.5, Math.min(1.0, 1 / (volatility * 50)));
    const adjustedRisk = baseRiskPerTrade * volatilityAdjustment;
    
    return accountBalance * adjustedRisk;
  }

  /**
   * Calculate stop-loss and take-profit levels for 1:2 risk-reward ratio
   */
  calculateExitLevels(entryPrice: number, side: 'BUY' | 'SELL'): {
    stopLoss: number;
    takeProfit: number;
    riskRewardRatio: number;
  } {
    const stopLossPercentage = config.trading.stopLossPercentage; // 0.003 (0.3%)
    const takeProfitPercentage = config.trading.takeProfitPercentage; // 0.006 (0.6%)
    
    let stopLoss: number;
    let takeProfit: number;
    
    if (side === 'BUY') {
      stopLoss = entryPrice * (1 - stopLossPercentage);
      takeProfit = entryPrice * (1 + takeProfitPercentage);
    } else {
      stopLoss = entryPrice * (1 + stopLossPercentage);
      takeProfit = entryPrice * (1 - takeProfitPercentage);
    }
    
    // Calculate actual risk-reward ratio
    const riskAmount = Math.abs(entryPrice - stopLoss);
    const rewardAmount = Math.abs(takeProfit - entryPrice);
    const riskRewardRatio = rewardAmount / riskAmount;
    
    return {
      stopLoss: Number(stopLoss.toFixed(8)),
      takeProfit: Number(takeProfit.toFixed(8)),
      riskRewardRatio: Number(riskRewardRatio.toFixed(2))
    };
  }

  /**
   * Generate enhanced trading signal with exit levels
   */
  generateSignalWithExitLevels(candles: Candle[], marketData: MarketData): TradingSignal & {
    exitLevels?: {
      stopLoss: number;
      takeProfit: number;
      riskRewardRatio: number;
    };
  } {
    const signal = this.generateSignal(candles, marketData);
    
    // Add exit levels for BUY and SELL signals
    if (signal.type === 'BUY' || signal.type === 'SELL') {
      const currentPrice = candles[candles.length - 1]?.close || marketData.price;
      const exitLevels = this.calculateExitLevels(currentPrice, signal.type);
      
      return {
        ...signal,
        exitLevels
      };
    }
    
    return signal;
  }

  /**
   * Check if scalping signal meets minimum risk-reward requirements
   */
  validateSignalRiskReward(signal: TradingSignal, entryPrice: number): {
    valid: boolean;
    actualRatio: number;
    requiredRatio: number;
    reason?: string;
  } {
    if (signal.type === 'HOLD') {
      return { valid: false, actualRatio: 0, requiredRatio: 2.0, reason: 'No trading signal' };
    }
    
    const exitLevels = this.calculateExitLevels(entryPrice, signal.type);
    const requiredRatio = 2.0; // 1:2 minimum
    
    if (exitLevels.riskRewardRatio < requiredRatio) {
      return {
        valid: false,
        actualRatio: exitLevels.riskRewardRatio,
        requiredRatio,
        reason: `Risk-reward ratio ${exitLevels.riskRewardRatio}:1 below minimum ${requiredRatio}:1`
      };
    }
    
    return {
      valid: true,
      actualRatio: exitLevels.riskRewardRatio,
      requiredRatio
    };
  }
}
