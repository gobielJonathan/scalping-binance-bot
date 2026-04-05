import DatabaseService from './databaseService';
import {
  TradingSignal,
  TradePosition,
  Portfolio,
  TechnicalIndicators,
  DatabaseTrade,
  DatabaseSignal,
  DatabasePortfolioSnapshot,
  DatabasePerformanceMetrics
} from '../types';

/**
 * Database utility functions for common operations
 */
export class DatabaseUtils {
  constructor(private dbService: DatabaseService) {}

  /**
   * Convert TradingSignal to DatabaseSignal format
   */
  static convertSignalToDatabase(
    signal: TradingSignal,
    strategyId: string,
    mode: 'paper' | 'live'
  ): Omit<DatabaseSignal, 'id' | 'createdAt'> {
    return {
      symbol: '', // Should be provided by caller
      type: signal.type,
      strength: signal.strength,
      confidence: signal.confidence,
      reason: signal.reason,
      timestamp: signal.timestamp,
      indicators: JSON.stringify(signal.indicators),
      processed: false,
      strategyId,
      mode
    };
  }

  /**
   * Convert DatabaseSignal back to TradingSignal
   */
  static convertSignalFromDatabase(dbSignal: DatabaseSignal): TradingSignal & { id: string } {
    return {
      id: dbSignal.id,
      type: dbSignal.type,
      strength: dbSignal.strength,
      confidence: dbSignal.confidence,
      reason: dbSignal.reason,
      timestamp: dbSignal.timestamp,
      indicators: JSON.parse(dbSignal.indicators) as TechnicalIndicators
    };
  }

  /**
   * Convert TradePosition to DatabaseTrade format
   */
  static convertTradeToDatabase(
    trade: TradePosition,
    strategyId: string,
    mode: 'paper' | 'live',
    signalId?: string
  ): Omit<DatabaseTrade, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      symbol: trade.symbol,
      side: trade.side,
      type: 'MARKET', // Default to market order
      quantity: trade.quantity,
      entryPrice: trade.entryPrice,
      exitPrice: trade.status === 'CLOSED' ? trade.currentPrice : undefined,
      stopLoss: trade.stopLoss,
      takeProfit: trade.takeProfit,
      pnl: trade.pnl,
      pnlPercent: trade.pnlPercent,
      fees: trade.fees,
      status: trade.status,
      openTime: trade.openTime,
      closeTime: trade.closeTime,
      strategyId,
      signalId,
      mode,
      orderId: trade.id
    };
  }

  /**
   * Convert Portfolio to DatabasePortfolioSnapshot
   */
  static convertPortfolioToDatabase(
    portfolio: Portfolio,
    mode: 'paper' | 'live'
  ): Omit<DatabasePortfolioSnapshot, 'id' | 'createdAt'> {
    const now = Date.now();
    const date = new Date(now).toISOString().split('T')[0]; // YYYY-MM-DD

    return {
      timestamp: now,
      totalBalance: portfolio.totalBalance,
      availableBalance: portfolio.availableBalance,
      lockedBalance: portfolio.lockedBalance,
      totalPnl: portfolio.totalPnl,
      totalPnlPercent: portfolio.totalPnlPercent,
      dailyPnl: portfolio.dailyPnl,
      dailyPnlPercent: portfolio.dailyPnlPercent,
      openPositionsCount: portfolio.openPositions.length,
      riskExposure: portfolio.riskExposure,
      maxDrawdown: portfolio.maxDrawdown,
      mode,
      date
    };
  }

  /**
   * Calculate performance metrics from trade history
   */
  async calculatePerformanceMetrics(
    mode: 'paper' | 'live',
    period: 'daily' | 'weekly' | 'monthly' | 'yearly'
  ): Promise<Omit<DatabasePerformanceMetrics, 'id' | 'createdAt'>> {
    const periodMs = this.getPeriodInMilliseconds(period);
    const endTime = Date.now();
    const startTime = endTime - periodMs;

    const trades = await this.dbService.getTradeHistory({
      mode,
      status: 'CLOSED',
      startDate: startTime,
      endDate: endTime
    });

    if (trades.length === 0) {
      return this.getEmptyPerformanceMetrics(period, mode);
    }

    const winningTrades = trades.filter(t => (t.pnl || 0) > 0);
    const losingTrades = trades.filter(t => (t.pnl || 0) < 0);
    const totalReturn = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const returns = trades.map(t => (t.pnlPercent || 0) / 100);

    // Calculate various metrics
    const winRate = trades.length > 0 ? winningTrades.length / trades.length : 0;
    const avgWin = winningTrades.length > 0 ? 
      winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? 
      Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / losingTrades.length) : 0;
    
    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0;
    const volatility = this.calculateVolatility(returns);
    const sharpeRatio = this.calculateSharpeRatio(returns, volatility);
    
    // Get initial balance for percentage calculations
    const initialBalance = 1000; // Default, should come from config
    const totalReturnPercent = (totalReturn / initialBalance) * 100;

    // Calculate drawdown
    let peak = 0;
    let maxDrawdown = 0;
    let runningPnl = 0;

    for (const trade of trades.sort((a, b) => a.openTime - b.openTime)) {
      runningPnl += trade.pnl || 0;
      if (runningPnl > peak) {
        peak = runningPnl;
      }
      const drawdown = peak - runningPnl;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return {
      timestamp: endTime,
      period,
      totalTrades: trades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: winRate * 100,
      totalReturn,
      totalReturnPercent,
      maxDrawdown: (maxDrawdown / initialBalance) * 100,
      avgWin,
      avgLoss,
      profitFactor,
      sharpeRatio,
      sortinioRatio: this.calculateSortinoRatio(returns, volatility),
      calmarRatio: totalReturnPercent > 0 && maxDrawdown > 0 ? totalReturnPercent / maxDrawdown : 0,
      volatility: volatility * 100,
      bestTrade: trades.length > 0 ? Math.max(...trades.map(t => t.pnl || 0)) : 0,
      worstTrade: trades.length > 0 ? Math.min(...trades.map(t => t.pnl || 0)) : 0,
      avgTradeReturn: trades.length > 0 ? totalReturn / trades.length : 0,
      mode
    };
  }

  /**
   * Get trades summary for dashboard
   */
  async getTradesSummary(mode: 'paper' | 'live', days: number = 30) {
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    const trades = await this.dbService.getTradeHistory({
      mode,
      startDate: cutoffTime
    });

    const openTrades = trades.filter(t => t.status === 'OPEN');
    const closedTrades = trades.filter(t => t.status === 'CLOSED');
    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);

    return {
      totalTrades: trades.length,
      openTrades: openTrades.length,
      closedTrades: closedTrades.length,
      totalPnl,
      todayTrades: trades.filter(t => this.isToday(t.openTime)).length,
      avgTradeReturn: closedTrades.length > 0 ? totalPnl / closedTrades.length : 0
    };
  }

  /**
   * Get recent signals with processing status
   */
  async getRecentSignals(mode: 'paper' | 'live', limit: number = 50) {
    const signals = await this.dbService.queryAll(
      'SELECT * FROM signals WHERE mode = ? ORDER BY timestamp DESC LIMIT ?',
      [mode, limit]
    );

    return signals.map(signal => ({
      ...signal,
      indicators: JSON.parse(signal.indicators),
      age: Date.now() - signal.timestamp
    }));
  }

  /**
   * Check database health and return status
   */
  async checkDatabaseHealth() {
    try {
      const stats = await this.dbService.getDatabaseStats();
      const recentTrades = await this.dbService.getTradeHistory({ limit: 1 });
      const unprocessedSignals = await this.dbService.getUnprocessedSignals('paper');

      return {
        status: 'healthy',
        stats,
        lastTradeTime: recentTrades.length > 0 ? recentTrades[0].openTime : null,
        unprocessedSignalsCount: unprocessedSignals.length,
        timestamp: Date.now()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      };
    }
  }

  // Helper methods
  private getPeriodInMilliseconds(period: 'daily' | 'weekly' | 'monthly' | 'yearly'): number {
    const day = 24 * 60 * 60 * 1000;
    switch (period) {
      case 'daily': return day;
      case 'weekly': return day * 7;
      case 'monthly': return day * 30;
      case 'yearly': return day * 365;
      default: return day;
    }
  }

  private getEmptyPerformanceMetrics(
    period: 'daily' | 'weekly' | 'monthly' | 'yearly',
    mode: 'paper' | 'live'
  ): Omit<DatabasePerformanceMetrics, 'id' | 'createdAt'> {
    return {
      timestamp: Date.now(),
      period,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalReturn: 0,
      totalReturnPercent: 0,
      maxDrawdown: 0,
      avgWin: 0,
      avgLoss: 0,
      profitFactor: 0,
      volatility: 0,
      bestTrade: 0,
      worstTrade: 0,
      avgTradeReturn: 0,
      mode
    };
  }

  private calculateVolatility(returns: number[]): number {
    if (returns.length < 2) return 0;
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);
    
    return Math.sqrt(variance);
  }

  private calculateSharpeRatio(returns: number[], volatility: number, riskFreeRate: number = 0.02): number {
    if (volatility === 0) return 0;
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const annualizedReturn = avgReturn * 252; // Assuming 252 trading days
    const annualizedVolatility = volatility * Math.sqrt(252);
    
    return (annualizedReturn - riskFreeRate) / annualizedVolatility;
  }

  private calculateSortinoRatio(returns: number[], _volatility: number, targetReturn: number = 0): number {
    const downside = returns.filter(r => r < targetReturn);
    if (downside.length === 0) return 0;
    
    const downsideDeviation = Math.sqrt(
      downside.reduce((sum, r) => sum + Math.pow(r - targetReturn, 2), 0) / downside.length
    );
    
    if (downsideDeviation === 0) return 0;
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    return (avgReturn - targetReturn) / downsideDeviation;
  }

  private isToday(timestamp: number): boolean {
    const today = new Date();
    const date = new Date(timestamp);
    return today.toDateString() === date.toDateString();
  }
}

export default DatabaseUtils;