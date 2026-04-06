import { 
  MultiTimeframeAnalyzer, 
  MultiTimeframeAnalysis 
} from './multiTimeframeAnalyzer';
import { 
  VolatilityAnalyzer, 
  VolatilityMetrics, 
  MarketRegime,
  VolatilityStrategy 
} from '../utils/volatilityAnalyzer';
import { 
  VolumeAnalyzer, 
  VolumeMetrics, 
  VolumeAnomaly,
  VolumePriceAnalysis 
} from '../utils/volumeAnalyzer';
import { 
  PatternRecognizer, 
  CandlestickPattern,
  ScalpingPattern,
  SupportResistanceLevel,
  MarketStructure 
} from '../utils/patternRecognizer';
import { 
  Candle, 
  TradingSignal, 
  TechnicalIndicators as TechnicalIndicatorsType,
  MarketRegime as MarketRegimeType
} from '../types';

export interface AdvancedMarketAnalysis {
  symbol: string;
  timestamp: number;
  multiTimeframe: MultiTimeframeAnalysis;
  volatility: {
    metrics: VolatilityMetrics;
    regime: MarketRegime;
    strategy: VolatilityStrategy;
    alerts: string[];
  };
  volume: {
    metrics: VolumeMetrics;
    anomalies: VolumeAnomaly[];
    priceAnalysis: VolumePriceAnalysis;
    recommendations: string[];
  };
  patterns: {
    candlestick: CandlestickPattern[];
    scalping: ScalpingPattern[];
    supportResistance: SupportResistanceLevel[];
    marketStructure: MarketStructure;
    recommendations: string[];
  };
  combinedSignal: TradingSignal;
  confidence: number;
  riskMetrics: {
    volatilityAdjustedSize: number;
    recommendedStopLoss: number;
    recommendedTakeProfit: number;
    maxRisk: number;
  };
  marketConditions: {
    regime: MarketRegimeType;
    environment: 'trending' | 'ranging' | 'volatile' | 'stable';
    tradingOpportunity: 'excellent' | 'good' | 'fair' | 'poor';
    timeHorizon: number;
  };
}

export interface SignalEnhancement {
  originalSignal: TradingSignal;
  enhancedSignal: TradingSignal;
  enhancements: string[];
  confidence: number;
  reliability: number;
}

export class AdvancedMarketAnalysisService {
  private multiTimeframeAnalyzer: MultiTimeframeAnalyzer;
  private volatilityAnalyzer: VolatilityAnalyzer;
  private volumeAnalyzer: VolumeAnalyzer;
  private patternRecognizer: PatternRecognizer;

  constructor() {
    this.multiTimeframeAnalyzer = new MultiTimeframeAnalyzer();
    this.volatilityAnalyzer = new VolatilityAnalyzer();
    this.volumeAnalyzer = new VolumeAnalyzer();
    this.patternRecognizer = new PatternRecognizer();
  }

  /**
   * Perform comprehensive market analysis across all timeframes and indicators
   */
  public analyzeMarket(
    candleData: { [timeframe: string]: Candle[] },
    symbol: string
  ): AdvancedMarketAnalysis {
    const primaryTimeframe = '1m';
    const candles = candleData[primaryTimeframe];

    if (!candles || candles.length < 100) {
      throw new Error('Insufficient candle data for analysis');
    }

    // Multi-timeframe analysis
    const multiTimeframe = this.multiTimeframeAnalyzer.analyze(candleData, symbol);

    // Volatility analysis
    const volatilityMetrics = this.volatilityAnalyzer.calculateVolatilityMetrics(candles);
    const marketRegime = this.volatilityAnalyzer.classifyMarketRegime(candles);
    const volatilityStrategy = this.volatilityAnalyzer.generateVolatilityStrategy(candles);
    const volatilityAlerts = this.volatilityAnalyzer.getVolatilityAlerts(candles);

    // Volume analysis
    const volumeMetrics = this.volumeAnalyzer.calculateVolumeMetrics(candles);
    const volumeAnomalies = this.volumeAnalyzer.detectVolumeAnomalies(candles);
    const volumePriceAnalysis = this.volumeAnalyzer.analyzeVolumePriceRelationship(candles);
    const volumeRecommendations = this.volumeAnalyzer.getVolumeRecommendations(candles);

    // Pattern analysis
    const patternAnalysis = this.patternRecognizer.getPatternAnalysis(candles);
    const patternRecommendations = this.patternRecognizer.getPatternRecommendations(candles);

    // Combine all signals into a comprehensive signal
    const combinedSignal = this.combineAllSignals(
      multiTimeframe,
      volatilityStrategy,
      volumeMetrics,
      patternAnalysis,
      symbol
    );

    // Calculate overall confidence
    const confidence = this.calculateOverallConfidence(
      multiTimeframe,
      volatilityMetrics,
      volumeMetrics,
      patternAnalysis,
      combinedSignal
    );

    // Generate risk metrics
    const riskMetrics = this.calculateRiskMetrics(
      candles,
      volatilityStrategy,
      combinedSignal
    );

    // Assess market conditions
    const marketConditions = this.assessMarketConditions(
      marketRegime,
      volumeMetrics,
      patternAnalysis.marketStructure,
      multiTimeframe
    );

    return {
      symbol,
      timestamp: Date.now(),
      multiTimeframe,
      volatility: {
        metrics: volatilityMetrics,
        regime: marketRegime,
        strategy: volatilityStrategy,
        alerts: volatilityAlerts
      },
      volume: {
        metrics: volumeMetrics,
        anomalies: volumeAnomalies,
        priceAnalysis: volumePriceAnalysis,
        recommendations: volumeRecommendations
      },
      patterns: {
        candlestick: patternAnalysis.candlestickPatterns,
        scalping: patternAnalysis.scalpingPatterns,
        supportResistance: patternAnalysis.supportResistance,
        marketStructure: patternAnalysis.marketStructure,
        recommendations: patternRecommendations
      },
      combinedSignal,
      confidence,
      riskMetrics,
      marketConditions
    };
  }

  /**
   * Enhance an existing trading signal with advanced analysis
   */
  public enhanceSignal(
    originalSignal: TradingSignal,
    candleData: { [timeframe: string]: Candle[] },
    symbol: string
  ): SignalEnhancement {
    const analysis = this.analyzeMarket(candleData, symbol);
    const enhancements: string[] = [];
    let enhancedStrength = originalSignal.strength;
    let enhancedConfidence = originalSignal.confidence;

    // Multi-timeframe confirmation
    if (this.multiTimeframeAnalyzer.isTimeframeAlignment(analysis.multiTimeframe, 0.7)) {
      enhancedStrength += 15;
      enhancedConfidence += 10;
      enhancements.push('Multi-timeframe alignment confirmed');
    }

    // Volatility adjustments
    if (analysis.volatility.regime.type === 'volatile' && originalSignal.type !== 'HOLD') {
      enhancedStrength += 10;
      enhancements.push('High volatility environment supports breakout signals');
    } else if (analysis.volatility.regime.type === 'low_volatility' && originalSignal.type !== 'HOLD') {
      enhancedStrength -= 5;
      enhancements.push('Low volatility may limit price movement');
    }

    // Volume confirmation
    if (analysis.volume.priceAnalysis.volumeSupport && originalSignal.type !== 'HOLD') {
      enhancedStrength += 12;
      enhancedConfidence += 8;
      enhancements.push('Volume supports price direction');
    }

    // Pattern confirmation
    const strongPatterns = analysis.patterns.candlestick.filter(p => 
      p.confidence > 75 && 
      ((p.tradingSignal === 'BUY' && originalSignal.type === 'BUY') ||
       (p.tradingSignal === 'SELL' && originalSignal.type === 'SELL'))
    );

    if (strongPatterns.length > 0) {
      enhancedStrength += 10;
      enhancedConfidence += 8;
      enhancements.push(`Strong pattern confirmation: ${strongPatterns[0].name}`);
    }

    // Support/Resistance proximity
    const nearbyLevels = analysis.patterns.supportResistance.filter(level => 
      level.priceDistance < 1 && level.strength > 70
    );

    if (nearbyLevels.length > 0) {
      const level = nearbyLevels[0];
      if ((level.type === 'support' && originalSignal.type === 'BUY') ||
          (level.type === 'resistance' && originalSignal.type === 'SELL')) {
        enhancedStrength += 8;
        enhancements.push(`Strong ${level.type} level nearby`);
      } else {
        enhancedStrength -= 5;
        enhancements.push(`Conflicting ${level.type} level nearby`);
      }
    }

    // Market structure alignment
    if (analysis.patterns.marketStructure.trend !== 'sideways') {
      const trendAligned = (analysis.patterns.marketStructure.trend === 'uptrend' && originalSignal.type === 'BUY') ||
                          (analysis.patterns.marketStructure.trend === 'downtrend' && originalSignal.type === 'SELL');
      
      if (trendAligned && analysis.patterns.marketStructure.trendStrength > 60) {
        enhancedStrength += 12;
        enhancedConfidence += 10;
        enhancements.push('Signal aligned with market structure');
      } else if (!trendAligned) {
        enhancedStrength -= 8;
        enhancements.push('Signal conflicts with market structure');
      }
    }

    // Cap the enhanced values
    enhancedStrength = Math.min(Math.max(enhancedStrength, 0), 100);
    enhancedConfidence = Math.min(Math.max(enhancedConfidence, 0), 100);

    const enhancedSignal: TradingSignal = {
      ...originalSignal,
      strength: enhancedStrength,
      confidence: enhancedConfidence,
      reason: `${originalSignal.reason} (Enhanced: ${enhancements.join(', ')})`,
      metadata: {
        id: `enhanced-${Date.now()}`,
        strategyId: 'advanced-analysis',
        marketRegime: analysis.marketConditions.regime,
        signalComponents: [
          ...(originalSignal.metadata?.signalComponents || []),
          {
            name: 'Advanced Analysis Enhancement',
            value: enhancedStrength - originalSignal.strength,
            weight: 1,
            contribution: (enhancedStrength - originalSignal.strength) / 100,
            triggered: enhancements.length > 0
          }
        ],
        volumeProfile: analysis.volume.metrics.volumeRatio20 > 1.5 ? 'high' : 
                      analysis.volume.metrics.volumeRatio20 < 0.7 ? 'low' : 'normal',
        spread: 0,
        liquidityScore: 100,
        timeDecayFactor: 1,
        lastUpdate: Date.now(),
        expiresAt: Date.now() + (analysis.marketConditions.timeHorizon * 60 * 1000)
      },
      riskAdjustedStrength: enhancedStrength * (analysis.confidence / 100),
      probabilityOfSuccess: enhancedConfidence / 100,
      stopLoss: analysis.riskMetrics.recommendedStopLoss,
      takeProfit: analysis.riskMetrics.recommendedTakeProfit,
      maxRisk: analysis.riskMetrics.maxRisk
    };

    return {
      originalSignal,
      enhancedSignal,
      enhancements,
      confidence: enhancedConfidence,
      reliability: this.calculateSignalReliability(enhancedSignal, analysis)
    };
  }

  /**
   * Combine signals from all analysis modules
   */
  private combineAllSignals(
    multiTimeframe: MultiTimeframeAnalysis,
    volatilityStrategy: VolatilityStrategy,
    volumeMetrics: VolumeMetrics,
    patternAnalysis: any,
    symbol: string
  ): TradingSignal {
    const signals: Array<{ signal: TradingSignal, weight: number }> = [];

    // Multi-timeframe signal (weight: 30%)
    signals.push({
      signal: multiTimeframe.combinedSignal,
      weight: 0.3
    });

    // Volatility-based adjustments (weight: 20%)
    const volatilitySignal = this.createVolatilitySignal(volatilityStrategy, symbol);
    signals.push({
      signal: volatilitySignal,
      weight: 0.2
    });

    // Volume-based signal (weight: 25%)
    const volumeSignal = this.createVolumeSignal(volumeMetrics, symbol);
    signals.push({
      signal: volumeSignal,
      weight: 0.25
    });

    // Pattern-based signal (weight: 25%)
    const patternSignal = this.createPatternSignal(patternAnalysis, symbol);
    signals.push({
      signal: patternSignal,
      weight: 0.25
    });

    return this.weightedSignalCombination(signals);
  }

  private createVolatilitySignal(strategy: VolatilityStrategy, _symbol: string): TradingSignal {
    let type: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let strength = 50;

    switch (strategy.recommendedAction) {
      case 'trade_breakout':
        type = strategy.regime.type === 'trending_up' ? 'BUY' : 'SELL';
        strength = 70;
        break;
      case 'trend_following':
        type = strategy.regime.type === 'trending_up' ? 'BUY' : 'SELL';
        strength = 65;
        break;
      case 'mean_reversion':
        // Signal would depend on current price relative to mean
        strength = 55;
        break;
      case 'wait':
        strength = 0;
        break;
    }

    return {
      type,
      strength,
      confidence: strategy.regime.confidence,
      reason: `Volatility-based: ${strategy.recommendedAction} in ${strategy.regime.type} regime`,
      timestamp: Date.now(),
      indicators: {} as TechnicalIndicatorsType,
      timeHorizon: strategy.timeHorizon
    };
  }

  private createVolumeSignal(metrics: VolumeMetrics, _symbol: string): TradingSignal {
    let strength = 50;
    let confidence = 60;
    let type: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';

    // Volume ratio analysis
    if (metrics.volumeRatio20 > 1.5) {
      strength += 15;
      confidence += 10;
    } else if (metrics.volumeRatio20 < 0.7) {
      strength -= 10;
    }

    // OBV trend
    if (metrics.obv > 0) {
      type = 'BUY';
      strength += 10;
    } else if (metrics.obv < 0) {
      type = 'SELL';
      strength += 10;
    }

    // Money Flow Index
    if (metrics.moneyFlowIndex > 70) {
      type = 'SELL';
      strength += 8;
    } else if (metrics.moneyFlowIndex < 30) {
      type = 'BUY';
      strength += 8;
    }

    return {
      type,
      strength: Math.min(Math.max(strength, 0), 100),
      confidence,
      reason: `Volume analysis: ${type} signal based on volume metrics`,
      timestamp: Date.now(),
      indicators: {} as TechnicalIndicatorsType
    };
  }

  private createPatternSignal(patternAnalysis: any, _symbol: string): TradingSignal {
    let type: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let strength = 50;
    let confidence = 60;

    // Candlestick patterns
    const strongBullishPatterns = patternAnalysis.candlestickPatterns
      .filter((p: CandlestickPattern) => p.tradingSignal === 'BUY' && p.confidence > 75);
    const strongBearishPatterns = patternAnalysis.candlestickPatterns
      .filter((p: CandlestickPattern) => p.tradingSignal === 'SELL' && p.confidence > 75);

    if (strongBullishPatterns.length > 0) {
      type = 'BUY';
      strength += 15;
      confidence += 10;
    } else if (strongBearishPatterns.length > 0) {
      type = 'SELL';
      strength += 15;
      confidence += 10;
    }

    // Market structure
    if (patternAnalysis.marketStructure.trend === 'uptrend' && 
        patternAnalysis.marketStructure.trendStrength > 70) {
      if (type !== 'SELL') type = 'BUY';
      strength += 12;
    } else if (patternAnalysis.marketStructure.trend === 'downtrend' && 
               patternAnalysis.marketStructure.trendStrength > 70) {
      if (type !== 'BUY') type = 'SELL';
      strength += 12;
    }

    // Support/Resistance levels
    const strongLevels = patternAnalysis.supportResistance
      .filter((level: SupportResistanceLevel) => level.strength > 80 && level.priceDistance < 2);

    if (strongLevels.length > 0) {
      confidence += 8;
    }

    return {
      type,
      strength: Math.min(Math.max(strength, 0), 100),
      confidence: Math.min(confidence, 100),
      reason: `Pattern analysis: ${type} signal from market patterns`,
      timestamp: Date.now(),
      indicators: {} as TechnicalIndicatorsType
    };
  }

  private weightedSignalCombination(signals: Array<{ signal: TradingSignal, weight: number }>): TradingSignal {
    let weightedBuyStrength = 0;
    let weightedSellStrength = 0;
    let weightedConfidence = 0;
    let totalWeight = 0;

    const reasons: string[] = [];

    for (const { signal, weight } of signals) {
      const normalizedWeight = weight;
      totalWeight += normalizedWeight;

      if (signal.type === 'BUY') {
        weightedBuyStrength += signal.strength * normalizedWeight;
      } else if (signal.type === 'SELL') {
        weightedSellStrength += signal.strength * normalizedWeight;
      }

      weightedConfidence += signal.confidence * normalizedWeight;
      reasons.push(signal.reason);
    }

    const avgConfidence = totalWeight > 0 ? weightedConfidence / totalWeight : 0;
    const buyScore = weightedBuyStrength / totalWeight;
    const sellScore = weightedSellStrength / totalWeight;

    let finalType: 'BUY' | 'SELL' | 'HOLD';
    let finalStrength: number;

    if (buyScore > sellScore && buyScore > 30) {
      finalType = 'BUY';
      finalStrength = buyScore;
    } else if (sellScore > buyScore && sellScore > 30) {
      finalType = 'SELL';
      finalStrength = sellScore;
    } else {
      finalType = 'HOLD';
      finalStrength = 0;
    }

    return {
      type: finalType,
      strength: Math.min(Math.max(finalStrength, 0), 100),
      confidence: Math.min(Math.max(avgConfidence, 0), 100),
      reason: `Advanced combined analysis: ${reasons.join('; ')}`,
      timestamp: Date.now(),
      indicators: {} as TechnicalIndicatorsType,
      timeHorizon: Math.max(...signals.map(s => s.signal.timeHorizon || 5)),
      probabilityOfSuccess: avgConfidence / 100
    };
  }

  private calculateOverallConfidence(
    multiTimeframe: MultiTimeframeAnalysis,
    volatilityMetrics: VolatilityMetrics,
    volumeMetrics: VolumeMetrics,
    patternAnalysis: any,
    combinedSignal: TradingSignal
  ): number {
    let confidence = combinedSignal.confidence;

    // Multi-timeframe alignment bonus
    if (this.multiTimeframeAnalyzer.isTimeframeAlignment(multiTimeframe, 0.8)) {
      confidence += 15;
    }

    // Volatility stability
    if (volatilityMetrics.volatilityRatio < 2.0) {
      confidence += 5;
    }

    // Volume confirmation
    if (volumeMetrics.volumeRatio20 > 1.2) {
      confidence += 8;
    }

    // Pattern strength
    const strongPatterns = patternAnalysis.candlestickPatterns.filter((p: any) => p.confidence > 80);
    if (strongPatterns.length > 0) {
      confidence += 10;
    }

    return Math.min(confidence, 100);
  }

  private calculateRiskMetrics(
    candles: Candle[],
    volatilityStrategy: VolatilityStrategy,
    _signal: TradingSignal
  ): {
    volatilityAdjustedSize: number,
    recommendedStopLoss: number,
    recommendedTakeProfit: number,
    maxRisk: number
  } {
    const optimizedParams = this.volatilityAnalyzer.optimizeParametersForVolatility(candles);

    return {
      volatilityAdjustedSize: optimizedParams.positionSize * volatilityStrategy.positionSizeMultiplier,
      recommendedStopLoss: optimizedParams.stopLoss,
      recommendedTakeProfit: optimizedParams.takeProfit,
      maxRisk: Math.min(optimizedParams.stopLoss * 2, 3) // Cap at 3%
    };
  }

  private assessMarketConditions(
    marketRegime: MarketRegime,
    volumeMetrics: VolumeMetrics,
    marketStructure: MarketStructure,
    multiTimeframe: MultiTimeframeAnalysis
  ): {
    regime: MarketRegimeType,
    environment: 'trending' | 'ranging' | 'volatile' | 'stable',
    tradingOpportunity: 'excellent' | 'good' | 'fair' | 'poor',
    timeHorizon: number
  } {
    const regime: MarketRegimeType = {
      type: marketRegime.type as any,
      strength: marketRegime.strength,
      duration: marketRegime.duration,
      confidence: marketRegime.confidence
    };

    let environment: 'trending' | 'ranging' | 'volatile' | 'stable';
    if (marketRegime.type === 'volatile') {
      environment = 'volatile';
    } else if (marketRegime.type === 'trending_up' || marketRegime.type === 'trending_down') {
      environment = 'trending';
    } else if (marketRegime.type === 'ranging') {
      environment = 'ranging';
    } else {
      environment = 'stable';
    }

    // Assess trading opportunity
    let opportunityScore = 0;
    
    // Multi-timeframe alignment
    if (multiTimeframe.confidence > 80) opportunityScore += 25;
    
    // Volume support
    if (volumeMetrics.volumeRatio20 > 1.5) opportunityScore += 25;
    
    // Market regime strength
    if (marketRegime.strength > 70) opportunityScore += 25;
    
    // Market structure clarity
    if (marketStructure.trendStrength > 60) opportunityScore += 25;

    let tradingOpportunity: 'excellent' | 'good' | 'fair' | 'poor';
    if (opportunityScore >= 75) tradingOpportunity = 'excellent';
    else if (opportunityScore >= 50) tradingOpportunity = 'good';
    else if (opportunityScore >= 25) tradingOpportunity = 'fair';
    else tradingOpportunity = 'poor';

    return {
      regime,
      environment,
      tradingOpportunity,
      timeHorizon: Math.max(multiTimeframe.combinedSignal.timeHorizon || 5, 5)
    };
  }

  private calculateSignalReliability(signal: TradingSignal, analysis: AdvancedMarketAnalysis): number {
    let reliability = signal.confidence;

    // Multi-module confirmation
    const agreements = this.countModuleAgreements(signal, analysis);
    reliability += agreements * 5;

    // Market condition assessment
    if (analysis.marketConditions.tradingOpportunity === 'excellent') {
      reliability += 15;
    } else if (analysis.marketConditions.tradingOpportunity === 'good') {
      reliability += 10;
    }

    // Volatility consideration
    if (analysis.volatility.regime.confidence > 80) {
      reliability += 10;
    }

    return Math.min(reliability, 100);
  }

  private countModuleAgreements(signal: TradingSignal, analysis: AdvancedMarketAnalysis): number {
    let agreements = 0;

    // Check multi-timeframe agreement
    if (analysis.multiTimeframe.combinedSignal.type === signal.type) agreements++;

    // Check volume agreement
    if ((analysis.volume.metrics.obv > 0 && signal.type === 'BUY') ||
        (analysis.volume.metrics.obv < 0 && signal.type === 'SELL')) {
      agreements++;
    }

    // Check pattern agreement
    const patternSignals = analysis.patterns.candlestick
      .map(p => p.tradingSignal)
      .filter(s => s === signal.type);
    if (patternSignals.length > 0) agreements++;

    // Check volatility strategy agreement
    if (analysis.volatility.strategy.recommendedAction !== 'wait') {
      agreements++;
    }

    return agreements;
  }

  /**
   * Get trading recommendations based on comprehensive analysis
   */
  public getAdvancedRecommendations(analysis: AdvancedMarketAnalysis): string[] {
    const recommendations: string[] = [];

    // Overall market assessment
    recommendations.push(
      `Market Environment: ${analysis.marketConditions.environment} with ${analysis.marketConditions.tradingOpportunity} trading opportunity`
    );

    // Signal strength assessment
    if (analysis.combinedSignal.strength > 70) {
      recommendations.push(`Strong ${analysis.combinedSignal.type} signal detected (${analysis.combinedSignal.strength}% strength)`);
    }

    // Risk recommendations
    recommendations.push(
      `Recommended position size: ${(analysis.riskMetrics.volatilityAdjustedSize * 100).toFixed(0)}% of normal size`
    );

    // Include module-specific recommendations
    recommendations.push(...analysis.volatility.alerts);
    recommendations.push(...analysis.volume.recommendations);
    recommendations.push(...analysis.patterns.recommendations);

    return recommendations;
  }
}