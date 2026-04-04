import {
  TradingSignal,
  SignalAggregation,
  StrategyPerformance,
  SignalFilters,
  SignalHistory,
  MarketRegime,
  Candle,
  MarketData
} from '../types';
import { ScalpingStrategy } from '../strategies/scalpingStrategy';
import logger from './logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * SignalAggregator combines multiple strategy signals into consolidated trading recommendations
 */
export class SignalAggregator {
  private logger: typeof logger;
  private strategies: Map<string, any> = new Map();
  private strategyPerformance: Map<string, StrategyPerformance> = new Map();
  private signalHistory: SignalHistory[] = [];
  private recentSignals: Map<string, TradingSignal[]> = new Map(); // symbol -> signals
  private maxSignalsPerSymbol = 10;
  private maxHistorySize = 1000;

  constructor(customLogger?: typeof logger) {
    this.logger = customLogger || logger;
    this.initializeStrategies();
  }

  /**
   * Initialize available strategies
   */
  private initializeStrategies(): void {
    // Initialize ScalpingStrategy
    const scalpingStrategy = new ScalpingStrategy();
    this.strategies.set('scalping-v2', scalpingStrategy);
    
    // Initialize strategy performance tracking
    this.strategyPerformance.set('scalping-v2', {
      strategyId: 'scalping-v2',
      name: 'Enhanced Scalping Strategy',
      totalSignals: 0,
      successfulSignals: 0,
      failedSignals: 0,
      pendingSignals: 0,
      successRate: 0,
      avgReturn: 0,
      avgTimeToResolve: 0,
      avgAccuracy: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      profitFactor: 0,
      lastUpdated: Date.now(),
      recentPerformance: {
        signals1h: 0,
        success1h: 0,
        signals1d: 0,
        success1d: 0,
        signals7d: 0,
        success7d: 0
      }
    });
  }

  /**
   * Generate aggregated signal from multiple strategies
   */
  async generateAggregatedSignal(
    symbol: string,
    candles: Candle[],
    marketData: MarketData,
    filters?: SignalFilters
  ): Promise<SignalAggregation> {
    const sourceSignals: TradingSignal[] = [];
    const conflictingSignals: TradingSignal[] = [];
    const weightedScores: { [strategyId: string]: number } = {};

    // Generate signals from all active strategies
    for (const [strategyId, strategy] of this.strategies) {
      try {
        const signal = strategy.generateSignal(candles, marketData);
        
        // Apply filters if provided
        if (this.passesFilters(signal, filters)) {
          sourceSignals.push(signal);
          
          // Calculate weighted score based on strategy performance
          const performance = this.strategyPerformance.get(strategyId);
          const weight = this.calculateStrategyWeight(performance);
          weightedScores[strategyId] = this.calculateSignalScore(signal) * weight;
          
          this.logger.debug(`Strategy ${strategyId} generated signal`, {
            signal: signal.type,
            strength: signal.strength,
            confidence: signal.confidence
          });
        } else {
          this.logger.debug(`Signal from ${strategyId} filtered out`, { signal });
        }
      } catch (error) {
        this.logger.error(`Error generating signal from strategy ${strategyId}`, error);
      }
    }

    // Classify signals by type
    const buySignals = sourceSignals.filter(s => s.type === 'BUY');
    const sellSignals = sourceSignals.filter(s => s.type === 'SELL');
    const holdSignals = sourceSignals.filter(s => s.type === 'HOLD');

    // Determine conflicts
    if (buySignals.length > 0 && sellSignals.length > 0) {
      // Add weaker signals to conflicting signals
      if (buySignals.length >= sellSignals.length) {
        conflictingSignals.push(...sellSignals);
      } else {
        conflictingSignals.push(...buySignals);
      }
    }

    // Generate final aggregated signal
    const finalSignal = this.aggregateSignals(
      sourceSignals,
      weightedScores,
      symbol,
      marketData
    );

    // Calculate aggregation metrics
    const consensusLevel = this.calculateConsensusLevel(sourceSignals);
    const riskScore = this.calculateRiskScore(sourceSignals, marketData);
    const qualityScore = this.calculateQualityScore(sourceSignals);

    // Store signal for tracking
    this.storeRecentSignal(symbol, finalSignal);
    
    // Track signal history
    if (finalSignal.type !== 'HOLD') {
      this.signalHistory.push({
        signalId: finalSignal.metadata?.id || uuidv4(),
        signal: finalSignal,
        outcome: 'pending',
        accuracy: 0,
        createdAt: Date.now()
      });
      
      // Update strategy performance
      this.updateStrategyPerformance(finalSignal.metadata?.strategyId || 'unknown');
    }

    const aggregation: SignalAggregation = {
      finalSignal,
      sourceSignals,
      conflictingSignals,
      weightedScores,
      aggregationMethod: this.determineAggregationMethod(sourceSignals),
      consensusLevel,
      riskScore,
      qualityScore
    };

    this.logger.info(`Generated aggregated signal for ${symbol}`, {
      signalType: finalSignal.type,
      strength: finalSignal.strength,
      confidence: finalSignal.confidence,
      sourceCount: sourceSignals.length,
      consensusLevel,
      qualityScore
    });

    return aggregation;
  }

  /**
   * Check if signal passes filters
   */
  private passesFilters(signal: TradingSignal, filters?: SignalFilters): boolean {
    if (!filters) return true;
    
    // Check minimum strength
    if (filters.minStrength && signal.strength < filters.minStrength) {
      return false;
    }
    
    // Check minimum confidence
    if (filters.minConfidence && signal.confidence < filters.minConfidence) {
      return false;
    }
    
    // Check signal age
    if (filters.maxAge && Date.now() - signal.timestamp > filters.maxAge) {
      return false;
    }
    
    // Check market regime filter
    if (filters.marketRegimeFilter && signal.metadata?.marketRegime) {
      if (!filters.marketRegimeFilter.includes(signal.metadata.marketRegime.type)) {
        return false;
      }
    }
    
    // Check volume filter
    if (filters.volumeFilter && signal.metadata?.volumeProfile !== filters.volumeFilter) {
      return false;
    }
    
    // Check spread filter
    if (filters.maxSpread && signal.metadata?.spread && signal.metadata.spread > filters.maxSpread) {
      return false;
    }
    
    // Check liquidity filter
    if (filters.minLiquidity && signal.metadata?.liquidityScore && signal.metadata.liquidityScore < filters.minLiquidity) {
      return false;
    }
    
    return true;
  }

  /**
   * Calculate strategy weight based on performance
   */
  private calculateStrategyWeight(performance?: StrategyPerformance): number {
    if (!performance || performance.totalSignals === 0) {
      return 0.5; // Default weight for new strategies
    }
    
    // Base weight on success rate, recent performance, and signal volume
    const successRateWeight = performance.successRate / 100;
    const recentSuccessRate = performance.recentPerformance.signals1d > 0 ? 
      performance.recentPerformance.success1d / performance.recentPerformance.signals1d : 0.5;
    const volumeWeight = Math.min(1.0, performance.totalSignals / 100); // Max weight at 100 signals
    
    return (successRateWeight * 0.5 + recentSuccessRate * 0.3 + volumeWeight * 0.2);
  }

  /**
   * Calculate signal score
   */
  private calculateSignalScore(signal: TradingSignal): number {
    const strengthScore = signal.strength / 100;
    const confidenceScore = signal.confidence / 100;
    
    // Boost score for BUY/SELL signals vs HOLD
    const typeMultiplier = signal.type === 'HOLD' ? 0.1 : 1.0;
    
    return (strengthScore * 0.6 + confidenceScore * 0.4) * typeMultiplier;
  }

  /**
   * Aggregate multiple signals into final signal
   */
  private aggregateSignals(
    signals: TradingSignal[],
    weightedScores: { [strategyId: string]: number },
    symbol: string,
    marketData: MarketData
  ): TradingSignal {
    if (signals.length === 0) {
      return this.createDefaultHoldSignal(symbol, marketData);
    }

    // If only one signal, return it (but enhance it)
    if (signals.length === 1) {
      return this.enhanceSignal(signals[0], 'single_strategy');
    }

    // Calculate weighted averages
    const buySignals = signals.filter(s => s.type === 'BUY');
    const sellSignals = signals.filter(s => s.type === 'SELL');
    const holdSignals = signals.filter(s => s.type === 'HOLD');

    // Determine signal type based on consensus
    let signalType: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
    let aggregatedStrength = 0;
    let aggregatedConfidence = 0;
    let reasons: string[] = [];

    if (buySignals.length > sellSignals.length + holdSignals.length) {
      signalType = 'BUY';
      const relevantSignals = buySignals;
      aggregatedStrength = this.calculateWeightedAverage(relevantSignals, 'strength', weightedScores);
      aggregatedConfidence = this.calculateWeightedAverage(relevantSignals, 'confidence', weightedScores);
      reasons = relevantSignals.map(s => s.reason);
    } else if (sellSignals.length > buySignals.length + holdSignals.length) {
      signalType = 'SELL';
      const relevantSignals = sellSignals;
      aggregatedStrength = this.calculateWeightedAverage(relevantSignals, 'strength', weightedScores);
      aggregatedConfidence = this.calculateWeightedAverage(relevantSignals, 'confidence', weightedScores);
      reasons = relevantSignals.map(s => s.reason);
    } else {
      // No clear consensus, default to HOLD
      signalType = 'HOLD';
      aggregatedStrength = 0;
      aggregatedConfidence = Math.max(...signals.map(s => s.confidence));
      reasons = ['No clear signal consensus'];
    }

    // Create aggregated signal
    const aggregatedSignal: TradingSignal = {
      type: signalType,
      strength: Math.round(aggregatedStrength),
      confidence: Math.round(aggregatedConfidence),
      reason: `Aggregated: ${reasons.slice(0, 3).join('; ')}`,
      timestamp: Date.now(),
      indicators: this.mergeIndicators(signals),
      metadata: {
        id: uuidv4(),
        strategyId: 'signal-aggregator',
        marketRegime: signals[0]?.metadata?.marketRegime || {
          type: 'sideways',
          strength: 0,
          confidence: 0,
          duration: 0
        },
        signalComponents: [],
        volumeProfile: signals[0]?.metadata?.volumeProfile || 'normal',
        spread: signals[0]?.metadata?.spread || 0,
        liquidityScore: signals[0]?.metadata?.liquidityScore || 50,
        timeDecayFactor: 1.0,
        lastUpdate: Date.now(),
        expiresAt: Date.now() + (3 * 60 * 1000) // 3 minutes for aggregated signals
      }
    };

    return this.enhanceSignal(aggregatedSignal, 'weighted_average');
  }

  /**
   * Calculate weighted average for signal properties
   */
  private calculateWeightedAverage(
    signals: TradingSignal[],
    property: 'strength' | 'confidence',
    weightedScores: { [strategyId: string]: number }
  ): number {
    let totalWeightedValue = 0;
    let totalWeight = 0;

    signals.forEach(signal => {
      const strategyId = signal.metadata?.strategyId || 'unknown';
      const weight = weightedScores[strategyId] || 0.5;
      totalWeightedValue += signal[property] * weight;
      totalWeight += weight;
    });

    return totalWeight > 0 ? totalWeightedValue / totalWeight : 0;
  }

  /**
   * Merge indicators from multiple signals
   */
  private mergeIndicators(signals: TradingSignal[]): any {
    if (signals.length === 0) return {};
    
    // Use the most recent signal's indicators as base
    const latestSignal = signals.reduce((latest, signal) => 
      signal.timestamp > latest.timestamp ? signal : latest
    );
    
    return latestSignal.indicators;
  }

  /**
   * Enhance signal with additional metadata
   */
  private enhanceSignal(signal: TradingSignal, aggregationMethod: string): TradingSignal {
    const enhanced = { ...signal };
    
    // Add aggregation-specific enhancements
    if (!enhanced.metadata) {
      enhanced.metadata = {
        id: uuidv4(),
        strategyId: 'signal-aggregator',
        marketRegime: { type: 'sideways', strength: 0, confidence: 0, duration: 0 },
        signalComponents: [],
        volumeProfile: 'normal',
        spread: 0,
        liquidityScore: 50,
        timeDecayFactor: 1.0,
        lastUpdate: Date.now(),
        expiresAt: Date.now() + (5 * 60 * 1000)
      };
    }

    // Calculate risk-adjusted strength
    enhanced.riskAdjustedStrength = this.calculateRiskAdjustedStrength(signal);
    
    // Estimate probability of success based on historical data
    enhanced.probabilityOfSuccess = this.estimateSuccessProbability(signal);
    
    return enhanced;
  }

  /**
   * Calculate risk-adjusted signal strength
   */
  private calculateRiskAdjustedStrength(signal: TradingSignal): number {
    let adjustmentFactor = 1.0;
    
    // Adjust based on market volatility
    const volatility = signal.indicators?.volatility || 0;
    if (volatility > 0.03) adjustmentFactor *= 0.8; // Reduce for high volatility
    
    // Adjust based on spread
    const spread = signal.metadata?.spread || 0;
    if (spread > 0.1) adjustmentFactor *= 0.9; // Reduce for wide spreads
    
    // Adjust based on liquidity
    const liquidity = signal.metadata?.liquidityScore || 50;
    if (liquidity < 30) adjustmentFactor *= 0.85; // Reduce for low liquidity
    
    return Math.round(signal.strength * adjustmentFactor);
  }

  /**
   * Estimate success probability based on historical performance
   */
  private estimateSuccessProbability(signal: TradingSignal): number {
    // Base probability on signal strength and confidence
    const baseProbability = (signal.strength * 0.4 + signal.confidence * 0.6) * 0.01;
    
    // Adjust based on historical performance of similar signals
    const strategyPerformance = signal.metadata?.strategyId ? 
      this.strategyPerformance.get(signal.metadata.strategyId) : null;
    
    if (strategyPerformance && strategyPerformance.totalSignals > 10) {
      const historicalSuccess = strategyPerformance.successRate / 100;
      return Math.round((baseProbability * 0.3 + historicalSuccess * 0.7) * 100);
    }
    
    // Default probability for new strategies
    return Math.round(baseProbability * 65); // Assume 65% base success rate
  }

  /**
   * Calculate consensus level among signals
   */
  private calculateConsensusLevel(signals: TradingSignal[]): number {
    if (signals.length <= 1) return 1.0;
    
    const buyCount = signals.filter(s => s.type === 'BUY').length;
    const sellCount = signals.filter(s => s.type === 'SELL').length;
    const holdCount = signals.filter(s => s.type === 'HOLD').length;
    
    const maxCount = Math.max(buyCount, sellCount, holdCount);
    return maxCount / signals.length;
  }

  /**
   * Calculate aggregated risk score
   */
  private calculateRiskScore(signals: TradingSignal[], marketData: MarketData): number {
    let riskScore = 50; // Base risk score
    
    // Increase risk for conflicting signals
    const signalTypes = new Set(signals.map(s => s.type));
    if (signalTypes.size > 1 && signalTypes.has('BUY') && signalTypes.has('SELL')) {
      riskScore += 20;
    }
    
    // Increase risk for low confidence signals
    const avgConfidence = signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length;
    if (avgConfidence < 50) riskScore += 15;
    
    // Increase risk for wide spreads
    const spreadPercent = ((marketData.ask - marketData.bid) / marketData.price) * 100;
    if (spreadPercent > 0.1) riskScore += 10;
    
    // Increase risk for low volume
    if (marketData.volume24h < 1000000) riskScore += 15; // $1M threshold
    
    return Math.min(riskScore, 100);
  }

  /**
   * Calculate overall signal quality score
   */
  private calculateQualityScore(signals: TradingSignal[]): number {
    if (signals.length === 0) return 0;
    
    const avgStrength = signals.reduce((sum, s) => sum + s.strength, 0) / signals.length;
    const avgConfidence = signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length;
    
    // Quality based on signal strength, confidence, and count
    const strengthScore = avgStrength * 0.4;
    const confidenceScore = avgConfidence * 0.4;
    const countScore = Math.min(signals.length * 10, 20); // Max 20 points for multiple signals
    
    return Math.round(strengthScore + confidenceScore + countScore);
  }

  /**
   * Determine aggregation method used
   */
  private determineAggregationMethod(signals: TradingSignal[]): 'weighted_average' | 'consensus' | 'best_performer' | 'ensemble' {
    if (signals.length === 1) return 'best_performer';
    if (signals.length <= 3) return 'weighted_average';
    
    // Use ensemble for multiple signals
    return 'ensemble';
  }

  /**
   * Store recent signal for symbol
   */
  private storeRecentSignal(symbol: string, signal: TradingSignal): void {
    if (!this.recentSignals.has(symbol)) {
      this.recentSignals.set(symbol, []);
    }
    
    const signals = this.recentSignals.get(symbol)!;
    signals.unshift(signal);
    
    // Keep only recent signals
    if (signals.length > this.maxSignalsPerSymbol) {
      signals.splice(this.maxSignalsPerSymbol);
    }
  }

  /**
   * Update strategy performance metrics
   */
  private updateStrategyPerformance(strategyId: string): void {
    const performance = this.strategyPerformance.get(strategyId);
    if (!performance) return;
    
    performance.pendingSignals++;
    performance.totalSignals++;
    performance.lastUpdated = Date.now();
    
    // Update recent performance counters
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    
    // Count recent signals (simplified - in production this would query a database)
    performance.recentPerformance.signals1h++;
    performance.recentPerformance.signals1d++;
    performance.recentPerformance.signals7d++;
  }

  /**
   * Mark signal outcome for performance tracking
   */
  async markSignalOutcome(
    signalId: string,
    outcome: 'win' | 'loss' | 'neutral',
    actualMove?: number,
    timeToResolve?: number
  ): Promise<void> {
    const historyIndex = this.signalHistory.findIndex(h => h.signalId === signalId);
    if (historyIndex === -1) return;
    
    const signalHistory = this.signalHistory[historyIndex];
    signalHistory.outcome = outcome;
    signalHistory.actualMove = actualMove;
    signalHistory.timeToResolve = timeToResolve;
    signalHistory.resolvedAt = Date.now();
    
    // Calculate accuracy
    if (signalHistory.signal.expectedMovePercent && actualMove !== undefined) {
      signalHistory.accuracy = Math.max(0, 100 - Math.abs(signalHistory.signal.expectedMovePercent - Math.abs(actualMove)) * 100);
    }
    
    // Update strategy performance
    const strategyId = signalHistory.signal.metadata?.strategyId;
    if (strategyId) {
      const performance = this.strategyPerformance.get(strategyId);
      if (performance) {
        performance.pendingSignals = Math.max(0, performance.pendingSignals - 1);
        
        if (outcome === 'win') {
          performance.successfulSignals++;
          performance.recentPerformance.success1h++;
          performance.recentPerformance.success1d++;
          performance.recentPerformance.success7d++;
        } else if (outcome === 'loss') {
          performance.failedSignals++;
        }
        
        // Recalculate success rate
        const totalResolved = performance.successfulSignals + performance.failedSignals;
        performance.successRate = totalResolved > 0 ? (performance.successfulSignals / totalResolved) * 100 : 0;
        
        // Update average accuracy
        const accurateSignals = this.signalHistory.filter(h => 
          h.signal.metadata?.strategyId === strategyId && h.accuracy > 0
        );
        performance.avgAccuracy = accurateSignals.length > 0 ? 
          accurateSignals.reduce((sum, h) => sum + h.accuracy, 0) / accurateSignals.length : 0;
        
        performance.lastUpdated = Date.now();
      }
    }
    
    this.logger.info(`Signal outcome marked`, {
      signalId,
      outcome,
      actualMove,
      timeToResolve,
      strategyId
    });
  }

  /**
   * Get recent signals for a symbol
   */
  getRecentSignals(symbol: string, limit = 10): TradingSignal[] {
    return this.recentSignals.get(symbol)?.slice(0, limit) || [];
  }

  /**
   * Get strategy performance metrics
   */
  getStrategyPerformance(strategyId?: string): StrategyPerformance | StrategyPerformance[] {
    if (strategyId) {
      return this.strategyPerformance.get(strategyId) || this.createEmptyPerformance(strategyId);
    }
    return Array.from(this.strategyPerformance.values());
  }

  /**
   * Get signal history with filters
   */
  getSignalHistory(filters?: {
    strategyId?: string;
    outcome?: 'win' | 'loss' | 'neutral' | 'pending';
    limit?: number;
    fromDate?: number;
  }): SignalHistory[] {
    let filtered = [...this.signalHistory];
    
    if (filters?.strategyId) {
      filtered = filtered.filter(h => h.signal.metadata?.strategyId === filters.strategyId);
    }
    
    if (filters?.outcome) {
      filtered = filtered.filter(h => h.outcome === filters.outcome);
    }
    
    if (filters?.fromDate) {
      filtered = filtered.filter(h => h.createdAt >= filters.fromDate!);
    }
    
    // Sort by creation date (newest first)
    filtered.sort((a, b) => b.createdAt - a.createdAt);
    
    if (filters?.limit) {
      filtered = filtered.slice(0, filters.limit);
    }
    
    return filtered;
  }

  /**
   * Clean up old signals and history
   */
  cleanup(): void {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
    
    // Clean up signal history
    this.signalHistory = this.signalHistory.filter(h => h.createdAt > cutoff);
    
    // Clean up recent signals
    for (const [symbol, signals] of this.recentSignals) {
      const filtered = signals.filter(s => s.timestamp > cutoff);
      if (filtered.length === 0) {
        this.recentSignals.delete(symbol);
      } else {
        this.recentSignals.set(symbol, filtered);
      }
    }
    
    // Clean up strategy performance counters (reset old counters)
    for (const performance of this.strategyPerformance.values()) {
      performance.recentPerformance.signals1h = 0;
      performance.recentPerformance.success1h = 0;
      // Keep daily and weekly counters for now
    }
    
    this.logger.info('Cleaned up old signals and performance data');
  }

  /**
   * Create default HOLD signal
   */
  private createDefaultHoldSignal(symbol: string, marketData: MarketData): TradingSignal {
    return {
      type: 'HOLD',
      strength: 0,
      confidence: 0,
      reason: 'No signals available',
      timestamp: Date.now(),
      indicators: {
        ema9: marketData.price,
        ema21: marketData.price,
        rsi: 50,
        macd: 0,
        macdSignal: 0,
        macdHistogram: 0,
        bollingerUpper: marketData.price * 1.02,
        bollingerMiddle: marketData.price,
        bollingerLower: marketData.price * 0.98,
        volume: 0,
        priceChange: 0,
        priceChangePercent: 0
      },
      metadata: {
        id: uuidv4(),
        strategyId: 'signal-aggregator',
        marketRegime: { type: 'sideways', strength: 0, confidence: 0, duration: 0 },
        signalComponents: [],
        volumeProfile: 'normal',
        spread: ((marketData.ask - marketData.bid) / marketData.price) * 100,
        liquidityScore: 50,
        timeDecayFactor: 1.0,
        lastUpdate: Date.now(),
        expiresAt: Date.now() + (5 * 60 * 1000)
      }
    };
  }

  /**
   * Create empty performance metrics
   */
  private createEmptyPerformance(strategyId: string): StrategyPerformance {
    return {
      strategyId,
      name: strategyId,
      totalSignals: 0,
      successfulSignals: 0,
      failedSignals: 0,
      pendingSignals: 0,
      successRate: 0,
      avgReturn: 0,
      avgTimeToResolve: 0,
      avgAccuracy: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      profitFactor: 0,
      lastUpdated: Date.now(),
      recentPerformance: {
        signals1h: 0,
        success1h: 0,
        signals1d: 0,
        success1d: 0,
        signals7d: 0,
        success7d: 0
      }
    };
  }
}