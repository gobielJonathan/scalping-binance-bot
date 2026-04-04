import { PortfolioTracker, PortfolioMetrics, PortfolioAlert } from './portfolioTracker';
import { RiskManager, RiskMetrics, LossLimit, PerformanceMetrics } from './riskManager';
import { OrderManager } from './orderManager';
import { MarketData, TradePosition } from '../types';
import { logger } from './logger';

export interface DashboardUpdate {
  timestamp: number;
  portfolio: PortfolioMetrics;
  risk: {
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    warnings: string[];
    metrics: RiskMetrics;
    lossLimitStatus: { [key: string]: { value: number; limit: number; percent: number } };
  };
  alerts: PortfolioAlert[];
  recommendations: string[];
  performance: PerformanceMetrics;
  positions: {
    id: string;
    symbol: string;
    currentValue: number;
    unrealizedPnl: number;
    riskScore: number;
    timeInPosition: number;
  }[];
}

export interface AlertNotification {
  id: string;
  type: 'RISK' | 'LOSS_LIMIT' | 'PORTFOLIO' | 'PERFORMANCE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  timestamp: number;
  data?: any;
}

export interface OptimizationSuggestion {
  id: string;
  category: 'PORTFOLIO_ALLOCATION' | 'POSITION_SIZING' | 'RISK_MANAGEMENT' | 'DIVERSIFICATION';
  title: string;
  description: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  confidence: number; // 0-100
  estimatedBenefit: string;
  actionRequired: string[];
  timestamp: number;
}

export interface BenchmarkData {
  symbol: string;
  return1d: number;
  return7d: number;
  return30d: number;
  volatility: number;
  sharpeRatio: number;
}

/**
 * Integration service that coordinates portfolio tracking, risk management, and dashboard updates
 */
export class IntegrationService {
  private portfolioTracker: PortfolioTracker;
  private riskManager: RiskManager;
  private orderManager: OrderManager;
  private notifications: AlertNotification[] = [];
  private lastDashboardUpdate: number = 0;
  private updateInterval: number = 30000; // 30 seconds
  private benchmarkData: Map<string, BenchmarkData> = new Map();
  private subscribers: Array<(update: DashboardUpdate) => void> = [];

  constructor(
    portfolioTracker: PortfolioTracker,
    riskManager: RiskManager,
    orderManager: OrderManager
  ) {
    this.portfolioTracker = portfolioTracker;
    this.riskManager = riskManager;
    this.orderManager = orderManager;
    
    // Initialize benchmark data
    this.initializeBenchmarkData();
  }

  /**
   * Update all systems with latest market data
   */
  async updateSystems(marketData: MarketData[]): Promise<DashboardUpdate> {
    try {
      // Update portfolio metrics
      const portfolioMetrics = this.portfolioTracker.updatePortfolioMetrics(marketData);
      
      // Get risk assessment
      const riskHealth = this.riskManager.getEnhancedRiskHealth();
      
      // Get portfolio summary including alerts and recommendations
      const portfolioSummary = this.portfolioTracker.getPortfolioSummary(marketData);
      
      // Get performance metrics
      const performanceMetrics = this.riskManager.getPerformanceMetrics();
      
      // Create position summaries
      const positions = this.createPositionSummaries(marketData);
      
      // Generate optimization suggestions
      const optimizations = this.generateOptimizationSuggestions(portfolioMetrics, riskHealth);
      
      // Create dashboard update
      const dashboardUpdate: DashboardUpdate = {
        timestamp: Date.now(),
        portfolio: portfolioMetrics,
        risk: riskHealth,
        alerts: portfolioSummary.alerts,
        recommendations: portfolioSummary.recommendations,
        performance: performanceMetrics,
        positions
      };
      
      // Check for new alerts and notifications
      this.processAlerts(portfolioSummary.alerts, riskHealth);
      
      // Store optimization suggestions
      this.storeOptimizationSuggestions(optimizations);
      
      // Notify subscribers
      this.notifySubscribers(dashboardUpdate);
      
      this.lastDashboardUpdate = Date.now();
      
      return dashboardUpdate;
    } catch (error) {
      logger.error('Error updating systems:', { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
      throw error;
    }
  }

  /**
   * Subscribe to dashboard updates
   */
  subscribe(callback: (update: DashboardUpdate) => void): () => void {
    this.subscribers.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.subscribers.indexOf(callback);
      if (index > -1) {
        this.subscribers.splice(index, 1);
      }
    };
  }

  /**
   * Notify all subscribers of dashboard updates
   */
  private notifySubscribers(update: DashboardUpdate): void {
    this.subscribers.forEach(callback => {
      try {
        callback(update);
      } catch (error) {
        logger.error('Error notifying subscriber:', { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
      }
    });
  }

  /**
   * Create position summaries for dashboard
   */
  private createPositionSummaries(marketData: MarketData[]): DashboardUpdate['positions'] {
    const portfolio = this.riskManager.getPortfolio();
    const positionRisks = this.portfolioTracker.getPositionRisk(marketData);
    
    return portfolio.openPositions.map(position => {
      const currentMarketData = marketData.find(m => m.symbol === position.symbol);
      const positionRisk = positionRisks.find(r => r.positionId === position.id);
      
      return {
        id: position.id,
        symbol: position.symbol,
        currentValue: currentMarketData ? position.quantity * currentMarketData.price : 0,
        unrealizedPnl: positionRisk?.unrealizedPnl || 0,
        riskScore: positionRisk?.riskScore || 0,
        timeInPosition: positionRisk?.timeInPosition || 0
      };
    });
  }

  /**
   * Process alerts and create notifications
   */
  private processAlerts(
    portfolioAlerts: PortfolioAlert[], 
    riskHealth: { status: string; warnings: string[] }
  ): void {
    // Process portfolio alerts
    for (const alert of portfolioAlerts) {
      if (!alert.acknowledged) {
        this.createNotification({
          type: 'PORTFOLIO',
          severity: alert.severity,
          title: alert.title,
          message: alert.message,
          data: alert
        });
      }
    }

    // Process risk warnings
    for (const warning of riskHealth.warnings) {
      this.createNotification({
        type: 'RISK',
        severity: riskHealth.status === 'CRITICAL' ? 'CRITICAL' : 'MEDIUM',
        title: 'Risk Warning',
        message: warning
      });
    }
  }

  /**
   * Create a notification
   */
  private createNotification(notification: Omit<AlertNotification, 'id' | 'timestamp'>): void {
    const newNotification: AlertNotification = {
      id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      ...notification
    };

    this.notifications.push(newNotification);

    // Keep only last 100 notifications
    if (this.notifications.length > 100) {
      this.notifications.shift();
    }

    // Log critical notifications
    if (notification.severity === 'CRITICAL') {
      logger.error(`CRITICAL NOTIFICATION: ${notification.title} - ${notification.message}`);
    } else if (notification.severity === 'HIGH') {
      logger.warn(`HIGH PRIORITY NOTIFICATION: ${notification.title} - ${notification.message}`);
    }
  }

  /**
   * Generate optimization suggestions
   */
  private generateOptimizationSuggestions(
    portfolio: PortfolioMetrics,
    riskHealth: { metrics: RiskMetrics }
  ): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Portfolio allocation suggestions
    if (portfolio.concentrationRisk > 60) {
      suggestions.push({
        id: `opt_diversification_${Date.now()}`,
        category: 'DIVERSIFICATION',
        title: 'Improve Portfolio Diversification',
        description: `Current concentration risk is ${portfolio.concentrationRisk.toFixed(1)}%. Consider diversifying into uncorrelated assets.`,
        impact: 'HIGH',
        confidence: 85,
        estimatedBenefit: 'Reduce portfolio volatility by 15-25%',
        actionRequired: [
          'Reduce largest position sizes',
          'Add positions in different asset classes',
          'Review correlation matrix'
        ],
        timestamp: Date.now()
      });
    }

    // Risk management suggestions
    if (riskHealth.metrics.riskUtilization > 80) {
      suggestions.push({
        id: `opt_risk_${Date.now()}`,
        category: 'RISK_MANAGEMENT',
        title: 'Reduce Risk Exposure',
        description: `Risk utilization is ${riskHealth.metrics.riskUtilization.toFixed(1)}%. Consider reducing position sizes.`,
        impact: 'MEDIUM',
        confidence: 90,
        estimatedBenefit: 'Lower portfolio risk by 20-30%',
        actionRequired: [
          'Close some positions',
          'Reduce new position sizes',
          'Tighten stop losses'
        ],
        timestamp: Date.now()
      });
    }

    // Position sizing suggestions
    if (riskHealth.metrics.sharpeRatio < 1.0 && riskHealth.metrics.portfolioVolatility > 20) {
      suggestions.push({
        id: `opt_sizing_${Date.now()}`,
        category: 'POSITION_SIZING',
        title: 'Optimize Position Sizing',
        description: `Sharpe ratio is ${riskHealth.metrics.sharpeRatio.toFixed(2)} with high volatility. Consider smaller position sizes.`,
        impact: 'MEDIUM',
        confidence: 75,
        estimatedBenefit: 'Improve risk-adjusted returns by 10-20%',
        actionRequired: [
          'Switch to volatility-adjusted sizing',
          'Reduce base risk per trade',
          'Implement Kelly criterion'
        ],
        timestamp: Date.now()
      });
    }

    // Performance suggestions
    if (riskHealth.metrics.winRate < 45) {
      suggestions.push({
        id: `opt_performance_${Date.now()}`,
        category: 'PORTFOLIO_ALLOCATION',
        title: 'Review Trading Strategy',
        description: `Win rate is ${riskHealth.metrics.winRate.toFixed(1)}%. Consider strategy adjustments.`,
        impact: 'HIGH',
        confidence: 70,
        estimatedBenefit: 'Potential 15-25% improvement in win rate',
        actionRequired: [
          'Review signal quality',
          'Adjust entry criteria',
          'Optimize exit strategy'
        ],
        timestamp: Date.now()
      });
    }

    return suggestions;
  }

  /**
   * Store optimization suggestions (placeholder for persistence)
   */
  private storeOptimizationSuggestions(suggestions: OptimizationSuggestion[]): void {
    // In a real implementation, these would be stored in a database
    suggestions.forEach(suggestion => {
      logger.info(`OPTIMIZATION SUGGESTION [${suggestion.impact}]: ${suggestion.title}`);
    });
  }

  /**
   * Initialize benchmark data
   */
  private initializeBenchmarkData(): void {
    // Sample benchmark data for major crypto assets
    this.benchmarkData.set('BTC', {
      symbol: 'BTC',
      return1d: 2.5,
      return7d: 8.2,
      return30d: 15.8,
      volatility: 65.0,
      sharpeRatio: 1.2
    });

    this.benchmarkData.set('ETH', {
      symbol: 'ETH',
      return1d: 3.2,
      return7d: 12.1,
      return30d: 22.5,
      volatility: 80.0,
      sharpeRatio: 1.1
    });
  }

  /**
   * Get portfolio performance vs benchmark
   */
  getBenchmarkComparison(): {
    portfolio: {
      return1d: number;
      return7d: number;
      return30d: number;
      volatility: number;
      sharpeRatio: number;
    };
    benchmark: BenchmarkData;
    outperformance: {
      return1d: number;
      return7d: number;
      return30d: number;
      riskAdjusted: number;
    };
  } {
    const portfolioMetrics = this.portfolioTracker.getPortfolioHistory(30);
    const btcBenchmark = this.benchmarkData.get('BTC')!;
    
    // Calculate portfolio returns (simplified)
    const portfolio1d = portfolioMetrics.length > 1 ? portfolioMetrics[portfolioMetrics.length - 1].last24HourPnl : 0;
    const portfolio7d = portfolioMetrics.length > 1 ? portfolioMetrics[portfolioMetrics.length - 1].weeklyPnl : 0;
    const portfolio30d = portfolioMetrics.length > 1 ? portfolioMetrics[portfolioMetrics.length - 1].monthlyPnl : 0;
    const portfolioVol = portfolioMetrics.length > 1 ? portfolioMetrics[portfolioMetrics.length - 1].volatility : 0;
    const portfolioSharpe = portfolioMetrics.length > 1 ? portfolioMetrics[portfolioMetrics.length - 1].sharpeRatio : 0;

    return {
      portfolio: {
        return1d: portfolio1d,
        return7d: portfolio7d,
        return30d: portfolio30d,
        volatility: portfolioVol,
        sharpeRatio: portfolioSharpe
      },
      benchmark: btcBenchmark,
      outperformance: {
        return1d: portfolio1d - btcBenchmark.return1d,
        return7d: portfolio7d - btcBenchmark.return7d,
        return30d: portfolio30d - btcBenchmark.return30d,
        riskAdjusted: portfolioSharpe - btcBenchmark.sharpeRatio
      }
    };
  }

  /**
   * Get all notifications
   */
  getNotifications(): AlertNotification[] {
    return [...this.notifications];
  }

  /**
   * Mark notifications as read
   */
  markNotificationsRead(notificationIds: string[]): void {
    // In a real implementation, this would update a database
    logger.info(`Marked ${notificationIds.length} notifications as read`);
  }

  /**
   * Get real-time dashboard data
   */
  async getDashboardData(marketData: MarketData[]): Promise<DashboardUpdate> {
    const now = Date.now();
    
    // Only update if enough time has passed or forced
    if (now - this.lastDashboardUpdate >= this.updateInterval) {
      return this.updateSystems(marketData);
    }
    
    // Return cached data with current market prices
    const portfolio = this.portfolioTracker.getPortfolioHistory(1)[0];
    const risk = this.riskManager.getEnhancedRiskHealth();
    const performance = this.riskManager.getPerformanceMetrics();
    const positions = this.createPositionSummaries(marketData);
    
    return {
      timestamp: now,
      portfolio: portfolio || {} as PortfolioMetrics,
      risk,
      alerts: this.portfolioTracker.getAlerts(),
      recommendations: [],
      performance,
      positions
    };
  }

  /**
   * Force immediate update
   */
  async forceUpdate(marketData: MarketData[]): Promise<DashboardUpdate> {
    return this.updateSystems(marketData);
  }

  /**
   * Calculate risk-adjusted return metrics
   */
  calculateRiskAdjustedReturns(): {
    sharpeRatio: number;
    sortinoRatio: number;
    calmarRatio: number;
    maxDrawdown: number;
    volatility: number;
  } {
    const portfolioHistory = this.portfolioTracker.getPortfolioHistory(100);
    
    if (portfolioHistory.length < 10) {
      return {
        sharpeRatio: 0,
        sortinoRatio: 0,
        calmarRatio: 0,
        maxDrawdown: 0,
        volatility: 0
      };
    }
    
    const returns = portfolioHistory.map((metrics, index) => {
      if (index === 0) return 0;
      return (metrics.totalValue - portfolioHistory[index - 1].totalValue) / portfolioHistory[index - 1].totalValue;
    }).slice(1);
    
    const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const volatility = Math.sqrt(
      returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / (returns.length - 1)
    );
    
    // Calculate downside deviation for Sortino ratio
    const downsideReturns = returns.filter(ret => ret < 0);
    const downsideDeviation = downsideReturns.length > 0 
      ? Math.sqrt(downsideReturns.reduce((sum, ret) => sum + Math.pow(ret, 2), 0) / downsideReturns.length)
      : volatility;
    
    const maxDrawdown = Math.max(...portfolioHistory.map(h => h.maxDrawdown));
    
    return {
      sharpeRatio: volatility > 0 ? avgReturn / volatility : 0,
      sortinoRatio: downsideDeviation > 0 ? avgReturn / downsideDeviation : 0,
      calmarRatio: maxDrawdown > 0 ? (avgReturn * 252) / maxDrawdown : 0, // Annualized
      maxDrawdown,
      volatility: volatility * Math.sqrt(252) * 100 // Annualized percentage
    };
  }

  /**
   * Get system health status
   */
  getSystemHealth(): {
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    components: {
      portfolioTracker: 'OK' | 'WARNING' | 'ERROR';
      riskManager: 'OK' | 'WARNING' | 'ERROR';
      orderManager: 'OK' | 'WARNING' | 'ERROR';
      dataFeed: 'OK' | 'WARNING' | 'ERROR';
    };
    lastUpdate: number;
  } {
    return {
      status: 'HEALTHY',
      components: {
        portfolioTracker: 'OK',
        riskManager: 'OK',
        orderManager: 'OK',
        dataFeed: 'OK'
      },
      lastUpdate: this.lastDashboardUpdate
    };
  }

  /**
   * Export comprehensive portfolio report
   */
  exportPortfolioReport(): {
    summary: {
      totalValue: number;
      totalReturn: number;
      totalReturnPercent: number;
      maxDrawdown: number;
      sharpeRatio: number;
      volatility: number;
      winRate: number;
    };
    positions: any[];
    performance: PerformanceMetrics;
    riskMetrics: any;
    alerts: PortfolioAlert[];
    recommendations: string[];
    exportDate: number;
  } {
    const portfolioHistory = this.portfolioTracker.getPortfolioHistory();
    const currentPortfolio = portfolioHistory[portfolioHistory.length - 1];
    const performance = this.riskManager.getPerformanceMetrics();
    const riskHealth = this.riskManager.getEnhancedRiskHealth();
    const alerts = this.portfolioTracker.getAlerts();
    
    // Get recommendations from the latest portfolio summary
    const portfolioSummary = this.portfolioTracker.getPortfolioSummary([]);
    
    return {
      summary: {
        totalValue: currentPortfolio?.totalValue || 0,
        totalReturn: currentPortfolio?.totalRealizedPnl || 0,
        totalReturnPercent: currentPortfolio?.totalRealizedPnl ? 
          (currentPortfolio.totalRealizedPnl / (currentPortfolio.totalValue - currentPortfolio.totalRealizedPnl)) * 100 : 0,
        maxDrawdown: currentPortfolio?.maxDrawdown || 0,
        sharpeRatio: currentPortfolio?.sharpeRatio || 0,
        volatility: currentPortfolio?.volatility || 0,
        winRate: performance.totalTrades > 0 ? (performance.winningTrades / performance.totalTrades) * 100 : 0
      },
      positions: this.createPositionSummaries([]),
      performance,
      riskMetrics: riskHealth.metrics,
      alerts,
      recommendations: portfolioSummary.recommendations,
      exportDate: Date.now()
    };
  }
}