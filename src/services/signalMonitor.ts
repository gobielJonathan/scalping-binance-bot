import { SignalAggregator } from './signalAggregator';
import { TradingSignal, SignalHistory } from '../types';
import logger from './logger';
import { EventEmitter } from 'events';

/**
 * SignalMonitor provides real-time monitoring and analysis of trading signals
 */
export class SignalMonitor extends EventEmitter {
  private logger: typeof logger;
  private signalAggregator: SignalAggregator;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private performanceCheckInterval: NodeJS.Timeout | null = null;
  private activeSignals: Map<string, ActiveSignalTrack> = new Map();
  private performanceMetrics: SignalPerformanceMetrics;
  private alertThresholds: AlertThresholds;

  constructor(signalAggregator: SignalAggregator, customLogger?: typeof logger) {
    super();
    this.signalAggregator = signalAggregator;
    this.logger = customLogger || logger;
    this.performanceMetrics = this.initializePerformanceMetrics();
    this.alertThresholds = this.getDefaultAlertThresholds();
  }

  /**
   * Start monitoring signals
   */
  startMonitoring(options?: MonitoringOptions): void {
    const intervalMs = options?.intervalMs || 30000; // 30 seconds default
    const performanceCheckMs = options?.performanceCheckMs || 300000; // 5 minutes default

    this.logger.info('Starting signal monitoring', { 
      intervalMs, 
      performanceCheckMs,
      alertThresholds: this.alertThresholds 
    });

    // Monitor active signals
    this.monitoringInterval = setInterval(() => {
      this.checkActiveSignals();
    }, intervalMs);

    // Check performance metrics
    this.performanceCheckInterval = setInterval(() => {
      this.analyzePerformance();
    }, performanceCheckMs);

    this.emit('monitoring-started', { intervalMs, performanceCheckMs });
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.performanceCheckInterval) {
      clearInterval(this.performanceCheckInterval);
      this.performanceCheckInterval = null;
    }

    this.logger.info('Signal monitoring stopped');
    this.emit('monitoring-stopped');
  }

  /**
   * Track a new signal for monitoring
   */
  trackSignal(signal: TradingSignal, symbol: string, entryPrice: number): void {
    if (!signal.metadata?.id) return;

    const track: ActiveSignalTrack = {
      signalId: signal.metadata.id,
      signal,
      symbol,
      entryPrice,
      currentPrice: entryPrice,
      startTime: Date.now(),
      lastUpdate: Date.now(),
      status: 'active',
      unrealizedPnL: 0,
      unrealizedPnLPercent: 0,
      maxFavorableMove: 0,
      maxAdverseMove: 0,
      timeToTarget: signal.timeHorizon ? signal.timeHorizon * 60 * 1000 : 300000, // 5 min default
      alerts: []
    };

    this.activeSignals.set(signal.metadata.id, track);
    this.logger.debug(`Started tracking signal ${signal.metadata.id}`, { symbol, entryPrice });
    
    this.emit('signal-tracked', track);
  }

  /**
   * Update signal with current price
   */
  updateSignalPrice(signalId: string, currentPrice: number): void {
    const track = this.activeSignals.get(signalId);
    if (!track) return;

    track.currentPrice = currentPrice;
    track.lastUpdate = Date.now();

    // Calculate PnL
    if (track.signal.type === 'BUY') {
      track.unrealizedPnL = currentPrice - track.entryPrice;
      track.unrealizedPnLPercent = (track.unrealizedPnL / track.entryPrice) * 100;
    } else if (track.signal.type === 'SELL') {
      track.unrealizedPnL = track.entryPrice - currentPrice;
      track.unrealizedPnLPercent = (track.unrealizedPnL / track.entryPrice) * 100;
    }

    // Update max moves
    const moveFromEntry = Math.abs(currentPrice - track.entryPrice);
    const movePercent = (moveFromEntry / track.entryPrice) * 100;

    if (track.unrealizedPnLPercent > 0) {
      track.maxFavorableMove = Math.max(track.maxFavorableMove, movePercent);
    } else {
      track.maxAdverseMove = Math.max(track.maxAdverseMove, movePercent);
    }

    // Check for alerts
    this.checkSignalAlerts(track);

    this.emit('signal-updated', track);
  }

  /**
   * Mark signal as completed
   */
  completeSignal(signalId: string, outcome: 'win' | 'loss' | 'neutral', exitPrice: number): void {
    const track = this.activeSignals.get(signalId);
    if (!track) return;

    // Final PnL calculation
    this.updateSignalPrice(signalId, exitPrice);
    track.status = 'completed';
    track.outcome = outcome;
    track.exitPrice = exitPrice;
    track.completedTime = Date.now();
    track.totalDuration = track.completedTime - track.startTime;

    // Update aggregator with outcome
    this.signalAggregator.markSignalOutcome(
      signalId,
      outcome,
      Math.abs(track.unrealizedPnLPercent),
      track.totalDuration
    );

    // Update performance metrics
    this.updatePerformanceMetrics(track, outcome);

    this.logger.info(`Signal ${signalId} completed`, {
      outcome,
      pnlPercent: track.unrealizedPnLPercent,
      duration: track.totalDuration,
      symbol: track.symbol
    });

    // Remove from active tracking
    this.activeSignals.delete(signalId);
    
    this.emit('signal-completed', track);
  }

  /**
   * Check active signals for various conditions
   */
  private checkActiveSignals(): void {
    const now = Date.now();
    const expiredSignals: string[] = [];
    
    for (const [signalId, track] of this.activeSignals) {
      // Check for expiration
      if (track.signal.metadata?.expiresAt && now > track.signal.metadata.expiresAt) {
        expiredSignals.push(signalId);
        continue;
      }

      // Check for timeout
      if (now - track.startTime > track.timeToTarget) {
        this.handleSignalTimeout(track);
      }

      // Check stop loss and take profit
      this.checkStopLossAndTakeProfit(track);

      // Check for stale data
      if (now - track.lastUpdate > 300000) { // 5 minutes
        track.alerts.push({
          type: 'stale-data',
          message: 'Signal price not updated for 5+ minutes',
          timestamp: now,
          severity: 'warning'
        });
      }
    }

    // Handle expired signals
    for (const signalId of expiredSignals) {
      this.handleExpiredSignal(signalId);
    }
  }

  /**
   * Check individual signal for alerts
   */
  private checkSignalAlerts(track: ActiveSignalTrack): void {
    const now = Date.now();
    
    // Large adverse move alert
    if (track.maxAdverseMove > 2.0 && !track.alerts.some(a => a.type === 'large-adverse-move')) {
      track.alerts.push({
        type: 'large-adverse-move',
        message: `Large adverse move: ${track.maxAdverseMove.toFixed(2)}%`,
        timestamp: now,
        severity: 'warning'
      });
      
      this.emit('signal-alert', track, 'large-adverse-move');
    }

    // Expected move exceeded
    const expectedMove = track.signal.expectedMovePercent || 1.0;
    if (track.maxFavorableMove > expectedMove * 1.5 && !track.alerts.some(a => a.type === 'exceeded-expected-move')) {
      track.alerts.push({
        type: 'exceeded-expected-move',
        message: `Exceeded expected move by 50%: ${track.maxFavorableMove.toFixed(2)}% vs ${expectedMove.toFixed(2)}%`,
        timestamp: now,
        severity: 'info'
      });
      
      this.emit('signal-alert', track, 'exceeded-expected-move');
    }

    // Strength vs performance mismatch
    const signalStrength = track.signal.strength;
    if (signalStrength > 80 && track.unrealizedPnLPercent < -1.0) {
      if (!track.alerts.some(a => a.type === 'strength-performance-mismatch')) {
        track.alerts.push({
          type: 'strength-performance-mismatch',
          message: `High strength signal (${signalStrength}) performing poorly (${track.unrealizedPnLPercent.toFixed(2)}%)`,
          timestamp: now,
          severity: 'warning'
        });
        
        this.emit('signal-alert', track, 'strength-performance-mismatch');
      }
    }
  }

  /**
   * Check stop loss and take profit levels
   */
  private checkStopLossAndTakeProfit(track: ActiveSignalTrack): void {
    const signal = track.signal;
    
    // Check stop loss
    if (signal.stopLoss) {
      const hitStopLoss = signal.type === 'BUY' ? 
        track.currentPrice <= signal.stopLoss :
        track.currentPrice >= signal.stopLoss;
      
      if (hitStopLoss) {
        this.completeSignal(track.signalId, 'loss', track.currentPrice);
        return;
      }
    }

    // Check take profit
    if (signal.takeProfit) {
      const hitTakeProfit = signal.type === 'BUY' ? 
        track.currentPrice >= signal.takeProfit :
        track.currentPrice <= signal.takeProfit;
      
      if (hitTakeProfit) {
        this.completeSignal(track.signalId, 'win', track.currentPrice);
        return;
      }
    }
  }

  /**
   * Handle signal timeout
   */
  private handleSignalTimeout(track: ActiveSignalTrack): void {
    const outcome = track.unrealizedPnLPercent > 0.1 ? 'win' : 
                   track.unrealizedPnLPercent < -0.1 ? 'loss' : 'neutral';
    
    track.alerts.push({
      type: 'timeout',
      message: `Signal timed out after ${(track.timeToTarget / 60000).toFixed(1)} minutes`,
      timestamp: Date.now(),
      severity: 'info'
    });

    this.completeSignal(track.signalId, outcome, track.currentPrice);
  }

  /**
   * Handle expired signal
   */
  private handleExpiredSignal(signalId: string): void {
    const track = this.activeSignals.get(signalId);
    if (!track) return;

    this.logger.debug(`Signal ${signalId} expired`);
    this.completeSignal(signalId, 'neutral', track.currentPrice);
  }

  /**
   * Analyze overall performance
   */
  private analyzePerformance(): void {
    const signalHistory = this.signalAggregator.getSignalHistory({ limit: 100 });
    
    // Calculate recent performance metrics
    const recentMetrics = this.calculateRecentMetrics(signalHistory);
    
    // Update performance metrics
    this.performanceMetrics = {
      ...this.performanceMetrics,
      ...recentMetrics,
      lastUpdated: Date.now()
    };

    // Check for performance alerts
    this.checkPerformanceAlerts(recentMetrics);

    this.emit('performance-updated', this.performanceMetrics);
  }

  /**
   * Calculate recent performance metrics
   */
  private calculateRecentMetrics(history: SignalHistory[]): Partial<SignalPerformanceMetrics> {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    
    const recent1h = history.filter(h => h.createdAt > oneHourAgo && h.outcome !== 'pending');
    const recent1d = history.filter(h => h.createdAt > oneDayAgo && h.outcome !== 'pending');
    
    const calculateSuccessRate = (signals: SignalHistory[]): number => {
      if (signals.length === 0) return 0;
      const wins = signals.filter(h => h.outcome === 'win').length;
      return (wins / signals.length) * 100;
    };

    const calculateAvgAccuracy = (signals: SignalHistory[]): number => {
      const withAccuracy = signals.filter(h => h.accuracy > 0);
      if (withAccuracy.length === 0) return 0;
      return withAccuracy.reduce((sum, h) => sum + h.accuracy, 0) / withAccuracy.length;
    };

    return {
      totalSignals1h: recent1h.length,
      successRate1h: calculateSuccessRate(recent1h),
      totalSignals1d: recent1d.length,
      successRate1d: calculateSuccessRate(recent1d),
      avgAccuracy1h: calculateAvgAccuracy(recent1h),
      avgAccuracy1d: calculateAvgAccuracy(recent1d),
      activeSignalCount: this.activeSignals.size
    };
  }

  /**
   * Check for performance-based alerts
   */
  private checkPerformanceAlerts(metrics: Partial<SignalPerformanceMetrics>): void {
    // Low success rate alert
    if (metrics.successRate1d !== undefined && 
        metrics.successRate1d < this.alertThresholds.minSuccessRate &&
        metrics.totalSignals1d && metrics.totalSignals1d >= 5) {
      
      this.emit('performance-alert', {
        type: 'low-success-rate',
        message: `24h success rate (${metrics.successRate1d.toFixed(1)}%) below threshold (${this.alertThresholds.minSuccessRate}%)`,
        severity: 'warning',
        value: metrics.successRate1d,
        threshold: this.alertThresholds.minSuccessRate
      });
    }

    // Low accuracy alert
    if (metrics.avgAccuracy1d !== undefined && 
        metrics.avgAccuracy1d < this.alertThresholds.minAccuracy &&
        metrics.totalSignals1d && metrics.totalSignals1d >= 3) {
      
      this.emit('performance-alert', {
        type: 'low-accuracy',
        message: `24h accuracy (${metrics.avgAccuracy1d.toFixed(1)}%) below threshold (${this.alertThresholds.minAccuracy}%)`,
        severity: 'warning',
        value: metrics.avgAccuracy1d,
        threshold: this.alertThresholds.minAccuracy
      });
    }

    // Too many active signals
    if (metrics.activeSignalCount !== undefined && 
        metrics.activeSignalCount > this.alertThresholds.maxActiveSignals) {
      
      this.emit('performance-alert', {
        type: 'too-many-active-signals',
        message: `Active signals (${metrics.activeSignalCount}) exceed threshold (${this.alertThresholds.maxActiveSignals})`,
        severity: 'info',
        value: metrics.activeSignalCount,
        threshold: this.alertThresholds.maxActiveSignals
      });
    }
  }

  /**
   * Update performance metrics with completed signal
   */
  private updatePerformanceMetrics(track: ActiveSignalTrack, outcome: 'win' | 'loss' | 'neutral'): void {
    this.performanceMetrics.totalSignalsTracked++;
    
    if (outcome === 'win') {
      this.performanceMetrics.totalWins++;
    } else if (outcome === 'loss') {
      this.performanceMetrics.totalLosses++;
    }

    this.performanceMetrics.overallSuccessRate = 
      ((this.performanceMetrics.totalWins / 
        (this.performanceMetrics.totalWins + this.performanceMetrics.totalLosses)) * 100) || 0;

    // Update PnL tracking
    this.performanceMetrics.totalPnLPercent += track.unrealizedPnLPercent;
    this.performanceMetrics.avgPnLPercent = 
      this.performanceMetrics.totalPnLPercent / this.performanceMetrics.totalSignalsTracked;

    // Update timing metrics
    if (track.totalDuration) {
      this.performanceMetrics.avgSignalDuration = 
        ((this.performanceMetrics.avgSignalDuration * (this.performanceMetrics.totalSignalsTracked - 1)) + 
         track.totalDuration) / this.performanceMetrics.totalSignalsTracked;
    }
  }

  /**
   * Get current monitoring status
   */
  getMonitoringStatus(): MonitoringStatus {
    return {
      isMonitoring: this.monitoringInterval !== null,
      activeSignals: this.activeSignals.size,
      performanceMetrics: this.performanceMetrics,
      alertThresholds: this.alertThresholds
    };
  }

  /**
   * Get active signal details
   */
  getActiveSignals(): ActiveSignalTrack[] {
    return Array.from(this.activeSignals.values());
  }

  /**
   * Update alert thresholds
   */
  updateAlertThresholds(thresholds: Partial<AlertThresholds>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
    this.logger.info('Alert thresholds updated', this.alertThresholds);
  }

  /**
   * Get signal performance summary
   */
  getPerformanceSummary(): SignalPerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Initialize performance metrics
   */
  private initializePerformanceMetrics(): SignalPerformanceMetrics {
    return {
      totalSignalsTracked: 0,
      totalWins: 0,
      totalLosses: 0,
      overallSuccessRate: 0,
      totalPnLPercent: 0,
      avgPnLPercent: 0,
      avgSignalDuration: 0,
      totalSignals1h: 0,
      successRate1h: 0,
      totalSignals1d: 0,
      successRate1d: 0,
      avgAccuracy1h: 0,
      avgAccuracy1d: 0,
      activeSignalCount: 0,
      lastUpdated: Date.now()
    };
  }

  /**
   * Get default alert thresholds
   */
  private getDefaultAlertThresholds(): AlertThresholds {
    return {
      minSuccessRate: 55, // 55%
      minAccuracy: 60, // 60%
      maxActiveSignals: 10,
      maxAdverseMove: 3.0, // 3%
      minSignalStrength: 40
    };
  }
}

interface ActiveSignalTrack {
  signalId: string;
  signal: TradingSignal;
  symbol: string;
  entryPrice: number;
  currentPrice: number;
  startTime: number;
  lastUpdate: number;
  status: 'active' | 'completed' | 'expired';
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  maxFavorableMove: number;
  maxAdverseMove: number;
  timeToTarget: number;
  alerts: SignalAlert[];
  outcome?: 'win' | 'loss' | 'neutral';
  exitPrice?: number;
  completedTime?: number;
  totalDuration?: number;
}

interface SignalAlert {
  type: 'large-adverse-move' | 'exceeded-expected-move' | 'strength-performance-mismatch' | 'timeout' | 'stale-data';
  message: string;
  timestamp: number;
  severity: 'info' | 'warning' | 'error';
}

interface SignalPerformanceMetrics {
  totalSignalsTracked: number;
  totalWins: number;
  totalLosses: number;
  overallSuccessRate: number;
  totalPnLPercent: number;
  avgPnLPercent: number;
  avgSignalDuration: number;
  totalSignals1h: number;
  successRate1h: number;
  totalSignals1d: number;
  successRate1d: number;
  avgAccuracy1h: number;
  avgAccuracy1d: number;
  activeSignalCount: number;
  lastUpdated: number;
}

interface AlertThresholds {
  minSuccessRate: number;
  minAccuracy: number;
  maxActiveSignals: number;
  maxAdverseMove: number;
  minSignalStrength: number;
}

interface MonitoringOptions {
  intervalMs?: number;
  performanceCheckMs?: number;
}

interface MonitoringStatus {
  isMonitoring: boolean;
  activeSignals: number;
  performanceMetrics: SignalPerformanceMetrics;
  alertThresholds: AlertThresholds;
}

export {
  ActiveSignalTrack,
  SignalAlert,
  SignalPerformanceMetrics,
  AlertThresholds,
  MonitoringOptions,
  MonitoringStatus
};