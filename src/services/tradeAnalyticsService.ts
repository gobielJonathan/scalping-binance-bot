import { DatabaseService } from '../database/databaseService';
import { DatabaseTrade } from '../types';
import moment from 'moment';
import * as fs from 'fs';
import * as path from 'path';

export interface TradeAnalytics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalPnl: number;
  totalPnlPercent: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  maxWin: number;
  maxLoss: number;
  avgTradeReturn: number;
  totalFees: number;
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  recoveryFactor: number;
  expectancy: number;
  riskRewardRatio: number;
}

export interface TradePerformanceByTimeframe {
  period: string;
  totalTrades: number;
  winRate: number;
  avgReturn: number;
  totalReturn: number;
  maxDrawdown: number;
  sharpeRatio: number;
}

export interface TradePerformanceBySymbol {
  symbol: string;
  totalTrades: number;
  winRate: number;
  avgReturn: number;
  totalReturn: number;
  totalPnl: number;
  bestTrade: number;
  worstTrade: number;
  averageHoldingTime: number;
}

export interface TradePerformanceByTimeOfDay {
  hour: number;
  totalTrades: number;
  winRate: number;
  avgReturn: number;
  totalReturn: number;
  totalPnl: number;
}

export interface TradePerformanceByDayOfWeek {
  dayOfWeek: number;
  dayName: string;
  totalTrades: number;
  winRate: number;
  avgReturn: number;
  totalReturn: number;
  totalPnl: number;
}

export interface DrawdownAnalysis {
  currentDrawdown: number;
  currentDrawdownPercent: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  maxDrawdownDuration: number;
  avgDrawdownDuration: number;
  recoveryTime: number;
  drawdownPeriods: Array<{
    startDate: number;
    endDate: number;
    maxDrawdown: number;
    duration: number;
    recovered: boolean;
    recoveryTime?: number;
  }>;
}

export interface WinLossStreakAnalysis {
  currentWinStreak: number;
  currentLossStreak: number;
  longestWinStreak: number;
  longestLossStreak: number;
  avgWinStreak: number;
  avgLossStreak: number;
  streakHistory: Array<{
    type: 'win' | 'loss';
    length: number;
    startDate: number;
    endDate: number;
    totalReturn: number;
  }>;
}

export interface RiskMetrics {
  valueAtRisk: number; // 95% VaR
  expectedShortfall: number; // Conditional VaR
  volatility: number;
  beta: number;
  trackingError: number;
  informationRatio: number;
  maximumRisk: number;
  riskAdjustedReturn: number;
}

export interface TrendAnalysis {
  trend: 'upward' | 'downward' | 'sideways';
  momentum: number;
  volatility: number;
  correlation: number;
  periodicity: Array<{
    period: string;
    strength: number;
    significance: number;
  }>;
  seasonality: Array<{
    period: 'monthly' | 'weekly' | 'daily' | 'hourly';
    pattern: number[];
    strength: number;
  }>;
}

export interface AnalyticsReport {
  generated: number;
  period: {
    start: number;
    end: number;
  };
  summary: TradeAnalytics;
  performance: {
    byTimeframe: TradePerformanceByTimeframe[];
    bySymbol: TradePerformanceBySymbol[];
    byTimeOfDay: TradePerformanceByTimeOfDay[];
    byDayOfWeek: TradePerformanceByDayOfWeek[];
  };
  risk: RiskMetrics;
  drawdown: DrawdownAnalysis;
  streaks: WinLossStreakAnalysis;
  trends: TrendAnalysis;
  insights: string[];
  warnings: string[];
}

export interface AnalyticsExportOptions {
  format: 'json' | 'csv' | 'xlsx' | 'pdf';
  includeCharts: boolean;
  dateRange?: {
    start: number;
    end: number;
  };
  symbols?: string[];
  groupBy?: 'day' | 'week' | 'month' | 'symbol' | 'strategy';
  metrics?: string[];
}

export class TradeAnalyticsService {
  private db: DatabaseService;
  private cache: Map<string, { data: any; expiry: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.db = new DatabaseService();
  }

  /**
   * Initialize the analytics service
   */
  async initialize(): Promise<void> {
    await this.db.initializeDatabase();
  }

  /**
   * Generate comprehensive analytics report
   */
  async generateReport(options?: {
    startDate?: number;
    endDate?: number;
    symbols?: string[];
    mode?: 'paper' | 'live';
  }): Promise<AnalyticsReport> {
    const cacheKey = `report_${JSON.stringify(options)}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    const trades = await this.getTrades(options);
    
    if (trades.length === 0) {
      throw new Error('No trades found for the specified criteria');
    }

    const summary = await this.calculateSummaryMetrics(trades);
    const performance = await this.calculatePerformanceMetrics(trades);
    const risk = await this.calculateRiskMetrics(trades);
    const drawdown = await this.analyzeDrawdowns(trades);
    const streaks = await this.analyzeWinLossStreaks(trades);
    const trends = await this.analyzeTrends(trades);
    const insights = await this.generateInsights(trades, summary, risk);
    const warnings = await this.generateWarnings(trades, summary, risk);

    const report: AnalyticsReport = {
      generated: Date.now(),
      period: {
        start: options?.startDate || trades[0].openTime,
        end: options?.endDate || trades[trades.length - 1].closeTime || Date.now()
      },
      summary,
      performance,
      risk,
      drawdown,
      streaks,
      trends,
      insights,
      warnings
    };

    this.setCachedData(cacheKey, report);
    return report;
  }

  /**
   * Get detailed performance by symbol
   */
  async getPerformanceBySymbol(options?: {
    startDate?: number;
    endDate?: number;
    mode?: 'paper' | 'live';
  }): Promise<TradePerformanceBySymbol[]> {
    const trades = await this.getTrades(options);
    const symbolGroups = this.groupTradesBySymbol(trades);
    
    return Object.entries(symbolGroups).map(([symbol, symbolTrades]) => {
      const winningTrades = symbolTrades.filter(t => (t.pnl || 0) > 0);
      const totalPnl = symbolTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
      const returns = symbolTrades.map(t => (t.pnlPercent || 0));
      const holdingTimes = symbolTrades
        .filter(t => t.closeTime)
        .map(t => t.closeTime! - t.openTime);

      return {
        symbol,
        totalTrades: symbolTrades.length,
        winRate: symbolTrades.length > 0 ? (winningTrades.length / symbolTrades.length) * 100 : 0,
        avgReturn: returns.length > 0 ? returns.reduce((sum, r) => sum + r, 0) / returns.length : 0,
        totalReturn: returns.reduce((sum, r) => sum + r, 0),
        totalPnl,
        bestTrade: Math.max(...symbolTrades.map(t => t.pnl || 0)),
        worstTrade: Math.min(...symbolTrades.map(t => t.pnl || 0)),
        averageHoldingTime: holdingTimes.length > 0 ? 
          holdingTimes.reduce((sum, time) => sum + time, 0) / holdingTimes.length : 0
      };
    });
  }

  /**
   * Get performance by time of day
   */
  async getPerformanceByTimeOfDay(options?: {
    startDate?: number;
    endDate?: number;
    mode?: 'paper' | 'live';
  }): Promise<TradePerformanceByTimeOfDay[]> {
    const trades = await this.getTrades(options);
    const hourGroups: Record<number, DatabaseTrade[]> = {};

    // Group trades by hour of day
    trades.forEach(trade => {
      const hour = moment(trade.openTime).hour();
      if (!hourGroups[hour]) hourGroups[hour] = [];
      hourGroups[hour].push(trade);
    });

    return Array.from({ length: 24 }, (_, hour) => {
      const hourTrades = hourGroups[hour] || [];
      const winningTrades = hourTrades.filter(t => (t.pnl || 0) > 0);
      const returns = hourTrades.map(t => t.pnlPercent || 0);
      const totalPnl = hourTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);

      return {
        hour,
        totalTrades: hourTrades.length,
        winRate: hourTrades.length > 0 ? (winningTrades.length / hourTrades.length) * 100 : 0,
        avgReturn: returns.length > 0 ? returns.reduce((sum, r) => sum + r, 0) / returns.length : 0,
        totalReturn: returns.reduce((sum, r) => sum + r, 0),
        totalPnl
      };
    });
  }

  /**
   * Get performance by day of week
   */
  async getPerformanceByDayOfWeek(options?: {
    startDate?: number;
    endDate?: number;
    mode?: 'paper' | 'live';
  }): Promise<TradePerformanceByDayOfWeek[]> {
    const trades = await this.getTrades(options);
    const dayGroups: Record<number, DatabaseTrade[]> = {};
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Group trades by day of week
    trades.forEach(trade => {
      const dayOfWeek = moment(trade.openTime).day();
      if (!dayGroups[dayOfWeek]) dayGroups[dayOfWeek] = [];
      dayGroups[dayOfWeek].push(trade);
    });

    return Array.from({ length: 7 }, (_, dayOfWeek) => {
      const dayTrades = dayGroups[dayOfWeek] || [];
      const winningTrades = dayTrades.filter(t => (t.pnl || 0) > 0);
      const returns = dayTrades.map(t => t.pnlPercent || 0);
      const totalPnl = dayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);

      return {
        dayOfWeek,
        dayName: dayNames[dayOfWeek],
        totalTrades: dayTrades.length,
        winRate: dayTrades.length > 0 ? (winningTrades.length / dayTrades.length) * 100 : 0,
        avgReturn: returns.length > 0 ? returns.reduce((sum, r) => sum + r, 0) / returns.length : 0,
        totalReturn: returns.reduce((sum, r) => sum + r, 0),
        totalPnl
      };
    });
  }

  /**
   * Analyze drawdowns
   */
  async analyzeDrawdowns(trades?: DatabaseTrade[]): Promise<DrawdownAnalysis> {
    if (!trades) {
      trades = await this.getTrades();
    }

    const sortedTrades = trades
      .filter(t => t.closeTime)
      .sort((a, b) => a.closeTime! - b.closeTime!);

    let runningBalance = 0;
    let peak = 0;
    let currentDrawdown = 0;
    let maxDrawdown = 0;
    let drawdownStart: number | null = null;
    const drawdownPeriods: any[] = [];

    sortedTrades.forEach(trade => {
      runningBalance += trade.pnl || 0;
      
      if (runningBalance > peak) {
        // New peak reached
        if (drawdownStart !== null) {
          // Drawdown period ended
          drawdownPeriods.push({
            startDate: drawdownStart,
            endDate: trade.closeTime!,
            maxDrawdown: currentDrawdown,
            duration: trade.closeTime! - drawdownStart,
            recovered: true,
            recoveryTime: trade.closeTime! - drawdownStart
          });
          drawdownStart = null;
        }
        peak = runningBalance;
        currentDrawdown = 0;
      } else {
        // In drawdown
        if (drawdownStart === null) {
          drawdownStart = trade.closeTime!;
        }
        currentDrawdown = peak - runningBalance;
        maxDrawdown = Math.max(maxDrawdown, currentDrawdown);
      }
    });

    // Handle ongoing drawdown
    if (drawdownStart !== null) {
      drawdownPeriods.push({
        startDate: drawdownStart,
        endDate: Date.now(),
        maxDrawdown: currentDrawdown,
        duration: Date.now() - drawdownStart,
        recovered: false
      });
    }

    const avgDrawdownDuration = drawdownPeriods.length > 0 
      ? drawdownPeriods.reduce((sum, period) => sum + period.duration, 0) / drawdownPeriods.length 
      : 0;

    const maxDrawdownDuration = drawdownPeriods.length > 0 
      ? Math.max(...drawdownPeriods.map(period => period.duration)) 
      : 0;

    const recoveryTime = drawdownPeriods
      .filter(period => period.recovered)
      .reduce((sum, period) => sum + (period.recoveryTime || 0), 0) / 
      Math.max(1, drawdownPeriods.filter(period => period.recovered).length);

    return {
      currentDrawdown,
      currentDrawdownPercent: peak > 0 ? (currentDrawdown / peak) * 100 : 0,
      maxDrawdown,
      maxDrawdownPercent: peak > 0 ? (maxDrawdown / peak) * 100 : 0,
      maxDrawdownDuration,
      avgDrawdownDuration,
      recoveryTime,
      drawdownPeriods
    };
  }

  /**
   * Analyze win/loss streaks
   */
  async analyzeWinLossStreaks(trades?: DatabaseTrade[]): Promise<WinLossStreakAnalysis> {
    if (!trades) {
      trades = await this.getTrades();
    }

    const sortedTrades = trades
      .filter(t => t.closeTime && t.pnl !== undefined)
      .sort((a, b) => a.closeTime! - b.closeTime!);

    if (sortedTrades.length === 0) {
      return {
        currentWinStreak: 0,
        currentLossStreak: 0,
        longestWinStreak: 0,
        longestLossStreak: 0,
        avgWinStreak: 0,
        avgLossStreak: 0,
        streakHistory: []
      };
    }

    let currentStreak = 0;
    let currentStreakType: 'win' | 'loss' | null = null;
    let currentStreakStart: number | null = null;
    let currentStreakReturn = 0;

    const streakHistory: any[] = [];
    const winStreaks: number[] = [];
    const lossStreaks: number[] = [];

    sortedTrades.forEach((trade, index) => {
      const isWin = (trade.pnl || 0) > 0;
      const streakType: 'win' | 'loss' = isWin ? 'win' : 'loss';

      if (currentStreakType === null || currentStreakType !== streakType) {
        // End previous streak if exists
        if (currentStreakType !== null && currentStreakStart !== null) {
          streakHistory.push({
            type: currentStreakType,
            length: currentStreak,
            startDate: currentStreakStart,
            endDate: sortedTrades[index - 1].closeTime!,
            totalReturn: currentStreakReturn
          });

          if (currentStreakType === 'win') {
            winStreaks.push(currentStreak);
          } else {
            lossStreaks.push(currentStreak);
          }
        }

        // Start new streak
        currentStreakType = streakType;
        currentStreak = 1;
        currentStreakStart = trade.closeTime!;
        currentStreakReturn = trade.pnlPercent || 0;
      } else {
        // Continue current streak
        currentStreak++;
        currentStreakReturn += trade.pnlPercent || 0;
      }
    });

    // Add final streak
    if (currentStreakType !== null && currentStreakStart !== null) {
      streakHistory.push({
        type: currentStreakType,
        length: currentStreak,
        startDate: currentStreakStart,
        endDate: sortedTrades[sortedTrades.length - 1].closeTime!,
        totalReturn: currentStreakReturn
      });

      if (currentStreakType === 'win') {
        winStreaks.push(currentStreak);
      } else {
        lossStreaks.push(currentStreak);
      }
    }

    return {
      currentWinStreak: currentStreakType === 'win' ? currentStreak : 0,
      currentLossStreak: currentStreakType === 'loss' ? currentStreak : 0,
      longestWinStreak: winStreaks.length > 0 ? Math.max(...winStreaks) : 0,
      longestLossStreak: lossStreaks.length > 0 ? Math.max(...lossStreaks) : 0,
      avgWinStreak: winStreaks.length > 0 ? winStreaks.reduce((sum, s) => sum + s, 0) / winStreaks.length : 0,
      avgLossStreak: lossStreaks.length > 0 ? lossStreaks.reduce((sum, s) => sum + s, 0) / lossStreaks.length : 0,
      streakHistory
    };
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(options: AnalyticsExportOptions): Promise<string> {
    const report = await this.generateReport({
      startDate: options.dateRange?.start,
      endDate: options.dateRange?.end
    });

    const timestamp = moment().format('YYYY-MM-DD_HH-mm-ss');
    const filename = `trade_analytics_${timestamp}`;
    
    switch (options.format) {
      case 'json':
        return this.exportToJSON(report, filename);
      case 'csv':
        return this.exportToCSV(report, filename);
      default:
        throw new Error(`Export format ${options.format} not supported yet`);
    }
  }

  // Private helper methods

  private async getTrades(options?: {
    startDate?: number;
    endDate?: number;
    symbols?: string[];
    mode?: 'paper' | 'live';
  }): Promise<DatabaseTrade[]> {
    let query = 'SELECT * FROM trades WHERE 1=1';
    const params: any[] = [];

    if (options?.startDate) {
      query += ' AND openTime >= ?';
      params.push(options.startDate);
    }

    if (options?.endDate) {
      query += ' AND openTime <= ?';
      params.push(options.endDate);
    }

    if (options?.symbols && options.symbols.length > 0) {
      query += ` AND symbol IN (${options.symbols.map(() => '?').join(',')})`;
      params.push(...options.symbols);
    }

    if (options?.mode) {
      query += ' AND mode = ?';
      params.push(options.mode);
    }

    query += ' ORDER BY openTime ASC';

    return await this.db.queryAll(query, params) as DatabaseTrade[];
  }

  private async calculateSummaryMetrics(trades: DatabaseTrade[]): Promise<TradeAnalytics> {
    const closedTrades = trades.filter(t => t.status === 'CLOSED' && t.pnl !== undefined);
    const winningTrades = closedTrades.filter(t => (t.pnl || 0) > 0);
    const losingTrades = closedTrades.filter(t => (t.pnl || 0) < 0);

    const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalFees = closedTrades.reduce((sum, t) => sum + t.fees, 0);
    const returns = closedTrades.map(t => t.pnlPercent || 0);
    
    const avgWin = winningTrades.length > 0 
      ? winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / winningTrades.length 
      : 0;
    
    const avgLoss = losingTrades.length > 0 
      ? Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0) / losingTrades.length)
      : 0;

    const grossProfit = winningTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl || 0), 0));

    return {
      totalTrades: closedTrades.length,
      winningTrades: winningTrades.length,
      losingTrades: losingTrades.length,
      winRate: closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0,
      totalPnl,
      totalPnlPercent: returns.reduce((sum, r) => sum + r, 0),
      avgWin,
      avgLoss,
      profitFactor: grossLoss > 0 ? grossProfit / grossLoss : 0,
      maxWin: winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.pnl || 0)) : 0,
      maxLoss: losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.pnl || 0)) : 0,
      avgTradeReturn: returns.length > 0 ? returns.reduce((sum, r) => sum + r, 0) / returns.length : 0,
      totalFees,
      sharpeRatio: this.calculateSharpeRatio(returns),
      sortinoRatio: this.calculateSortinoRatio(returns),
      calmarRatio: this.calculateCalmarRatio(returns),
      maxDrawdown: 0, // Will be calculated in drawdown analysis
      maxDrawdownPercent: 0,
      recoveryFactor: 0,
      expectancy: closedTrades.length > 0 
        ? (winningTrades.length / closedTrades.length) * avgWin - (losingTrades.length / closedTrades.length) * avgLoss
        : 0,
      riskRewardRatio: avgLoss > 0 ? avgWin / avgLoss : 0
    };
  }

  private async calculatePerformanceMetrics(trades: DatabaseTrade[]): Promise<any> {
    return {
      byTimeframe: await this.getPerformanceByTimeframe(trades),
      bySymbol: this.groupTradesBySymbol(trades),
      byTimeOfDay: await this.getPerformanceByTimeOfDay({ startDate: trades[0]?.openTime, endDate: trades[trades.length - 1]?.closeTime }),
      byDayOfWeek: await this.getPerformanceByDayOfWeek({ startDate: trades[0]?.openTime, endDate: trades[trades.length - 1]?.closeTime })
    };
  }

  private async getPerformanceByTimeframe(trades: DatabaseTrade[]): Promise<TradePerformanceByTimeframe[]> {
    const timeframes = ['daily', 'weekly', 'monthly'];
    const results: TradePerformanceByTimeframe[] = [];

    for (const timeframe of timeframes) {
      const groupedTrades = this.groupTradesByTimeframe(trades, timeframe);
      
      Object.entries(groupedTrades).forEach(([period, periodTrades]) => {
        const winningTrades = periodTrades.filter(t => (t.pnl || 0) > 0);
        const returns = periodTrades.map(t => t.pnlPercent || 0);
        
        results.push({
          period,
          totalTrades: periodTrades.length,
          winRate: periodTrades.length > 0 ? (winningTrades.length / periodTrades.length) * 100 : 0,
          avgReturn: returns.length > 0 ? returns.reduce((sum, r) => sum + r, 0) / returns.length : 0,
          totalReturn: returns.reduce((sum, r) => sum + r, 0),
          maxDrawdown: 0, // Simplified for now
          sharpeRatio: this.calculateSharpeRatio(returns)
        });
      });
    }

    return results;
  }

  private async calculateRiskMetrics(trades: DatabaseTrade[]): Promise<RiskMetrics> {
    const returns = trades
      .filter(t => t.pnlPercent !== undefined)
      .map(t => t.pnlPercent!);

    if (returns.length === 0) {
      return {
        valueAtRisk: 0,
        expectedShortfall: 0,
        volatility: 0,
        beta: 0,
        trackingError: 0,
        informationRatio: 0,
        maximumRisk: 0,
        riskAdjustedReturn: 0
      };
    }

    const volatility = this.calculateVolatility(returns);
    const var95 = this.calculateVaR(returns, 0.95);
    const expectedShortfall = this.calculateExpectedShortfall(returns, 0.95);

    return {
      valueAtRisk: var95,
      expectedShortfall,
      volatility,
      beta: 0, // Would need benchmark data
      trackingError: 0, // Would need benchmark data
      informationRatio: 0, // Would need benchmark data
      maximumRisk: Math.min(...returns),
      riskAdjustedReturn: volatility > 0 ? (returns.reduce((sum, r) => sum + r, 0) / returns.length) / volatility : 0
    };
  }

  private async analyzeTrends(trades: DatabaseTrade[]): Promise<TrendAnalysis> {
    const returns = trades
      .filter(t => t.pnlPercent !== undefined)
      .map(t => t.pnlPercent!);

    return {
      trend: this.determineTrend(returns),
      momentum: this.calculateMomentum(returns),
      volatility: this.calculateVolatility(returns),
      correlation: 0, // Would need additional data
      periodicity: [],
      seasonality: []
    };
  }

  private async generateInsights(trades: DatabaseTrade[], summary: TradeAnalytics, risk: RiskMetrics): Promise<string[]> {
    const insights: string[] = [];

    if (summary.winRate > 60) {
      insights.push(`Strong win rate of ${summary.winRate.toFixed(1)}% indicates good trade selection`);
    } else if (summary.winRate < 40) {
      insights.push(`Low win rate of ${summary.winRate.toFixed(1)}% suggests need for strategy refinement`);
    }

    if (summary.profitFactor > 1.5) {
      insights.push(`Excellent profit factor of ${summary.profitFactor.toFixed(2)} shows strong profitability`);
    }

    if (summary.riskRewardRatio > 2) {
      insights.push(`Good risk-reward ratio of ${summary.riskRewardRatio.toFixed(2)} supports profitable trading`);
    }

    if (risk.volatility < 0.02) {
      insights.push('Low volatility trading style with consistent returns');
    } else if (risk.volatility > 0.05) {
      insights.push('High volatility trading style - consider risk management');
    }

    return insights;
  }

  private async generateWarnings(trades: DatabaseTrade[], summary: TradeAnalytics, risk: RiskMetrics): Promise<string[]> {
    const warnings: string[] = [];

    if (summary.winRate < 30) {
      warnings.push('Very low win rate - strategy needs significant improvement');
    }

    if (summary.profitFactor < 1.2) {
      warnings.push('Low profit factor - not sufficiently profitable after costs');
    }

    if (risk.valueAtRisk < -0.05) {
      warnings.push('High risk exposure - consider reducing position sizes');
    }

    if (summary.maxDrawdown > 0.2) {
      warnings.push('Significant drawdown periods detected - review risk management');
    }

    return warnings;
  }

  private groupTradesBySymbol(trades: DatabaseTrade[]): Record<string, DatabaseTrade[]> {
    return trades.reduce((groups, trade) => {
      if (!groups[trade.symbol]) groups[trade.symbol] = [];
      groups[trade.symbol].push(trade);
      return groups;
    }, {} as Record<string, DatabaseTrade[]>);
  }

  private groupTradesByTimeframe(trades: DatabaseTrade[], timeframe: string): Record<string, DatabaseTrade[]> {
    return trades.reduce((groups, trade) => {
      let key: string;
      const date = moment(trade.openTime);

      switch (timeframe) {
        case 'daily':
          key = date.format('YYYY-MM-DD');
          break;
        case 'weekly':
          key = date.format('YYYY-[W]WW');
          break;
        case 'monthly':
          key = date.format('YYYY-MM');
          break;
        default:
          key = date.format('YYYY-MM-DD');
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(trade);
      return groups;
    }, {} as Record<string, DatabaseTrade[]>);
  }

  // Statistical calculation methods

  private calculateSharpeRatio(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const volatility = this.calculateVolatility(returns);
    
    return volatility > 0 ? avgReturn / volatility : 0;
  }

  private calculateSortinoRatio(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const downwardReturns = returns.filter(r => r < 0);
    
    if (downwardReturns.length === 0) return Infinity;
    
    const downwardVolatility = Math.sqrt(
      downwardReturns.reduce((sum, r) => sum + r * r, 0) / downwardReturns.length
    );
    
    return downwardVolatility > 0 ? avgReturn / downwardVolatility : 0;
  }

  private calculateCalmarRatio(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    const totalReturn = returns.reduce((sum, r) => sum + r, 0);
    const maxDrawdown = this.calculateMaxDrawdown(returns);
    
    return maxDrawdown > 0 ? totalReturn / maxDrawdown : 0;
  }

  private calculateVolatility(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  private calculateVaR(returns: number[], confidence: number): number {
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const index = Math.ceil((1 - confidence) * sortedReturns.length) - 1;
    
    return sortedReturns[Math.max(0, index)] || 0;
  }

  private calculateExpectedShortfall(returns: number[], confidence: number): number {
    const var95 = this.calculateVaR(returns, confidence);
    const tailReturns = returns.filter(r => r <= var95);
    
    return tailReturns.length > 0 
      ? tailReturns.reduce((sum, r) => sum + r, 0) / tailReturns.length 
      : 0;
  }

  private calculateMaxDrawdown(returns: number[]): number {
    let peak = 0;
    let maxDrawdown = 0;
    let runningReturn = 0;

    returns.forEach(ret => {
      runningReturn += ret;
      if (runningReturn > peak) {
        peak = runningReturn;
      }
      const drawdown = peak - runningReturn;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    });

    return maxDrawdown;
  }

  private determineTrend(returns: number[]): 'upward' | 'downward' | 'sideways' {
    if (returns.length === 0) return 'sideways';
    
    const totalReturn = returns.reduce((sum, r) => sum + r, 0);
    const avgReturn = totalReturn / returns.length;
    
    if (avgReturn > 0.01) return 'upward';
    if (avgReturn < -0.01) return 'downward';
    return 'sideways';
  }

  private calculateMomentum(returns: number[]): number {
    if (returns.length < 2) return 0;
    
    const recentPeriod = Math.min(10, returns.length);
    const recentReturns = returns.slice(-recentPeriod);
    
    return recentReturns.reduce((sum, r) => sum + r, 0) / recentReturns.length;
  }

  // Export methods

  private async exportToJSON(report: AnalyticsReport, filename: string): Promise<string> {
    const filePath = path.join(process.cwd(), 'data', `${filename}.json`);
    
    // Ensure data directory exists
    const dataDir = path.dirname(filePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    return filePath;
  }

  private async exportToCSV(report: AnalyticsReport, filename: string): Promise<string> {
    const filePath = path.join(process.cwd(), 'data', `${filename}.csv`);
    
    // Create CSV content with summary metrics
    const csvRows = [
      ['Metric', 'Value'],
      ['Total Trades', report.summary.totalTrades.toString()],
      ['Win Rate (%)', report.summary.winRate.toFixed(2)],
      ['Total PnL', report.summary.totalPnl.toFixed(2)],
      ['Profit Factor', report.summary.profitFactor.toFixed(2)],
      ['Sharpe Ratio', report.summary.sharpeRatio.toFixed(2)],
      ['Max Drawdown', report.drawdown.maxDrawdown.toFixed(2)],
      ['Recovery Factor', report.summary.recoveryFactor.toFixed(2)]
    ];
    
    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    
    // Ensure data directory exists
    const dataDir = path.dirname(filePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, csvContent);
    return filePath;
  }

  // Cache management

  private getCachedData(key: string): any {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCachedData(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.CACHE_TTL
    });
  }

  /**
   * Clear analytics cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Close the analytics service
   */
  async close(): Promise<void> {
    await this.db.close();
    this.cache.clear();
  }
}