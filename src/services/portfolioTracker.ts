import { TradePosition, Portfolio, MarketData } from '../types';
import { RiskManager } from './riskManager';
import config from '../config';

export interface PositionRisk {
  positionId: string;
  symbol: string;
  currentValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  riskScore: number; // 0-100
  volatilityAdjustedRisk: number;
  exposurePercent: number;
  timeInPosition: number; // minutes
  correlationRisk: number; // correlation with other positions
}

export interface PortfolioMetrics {
  // Core metrics
  totalValue: number;
  totalUnrealizedPnl: number;
  totalRealizedPnl: number;
  dailyPnl: number;
  weeklyPnl: number;
  monthlyPnl: number;
  
  // Risk metrics
  totalRiskExposure: number;
  riskExposurePercent: number;
  portfolioVaR95: number; // Value at Risk 95%
  portfolioVaR99: number; // Value at Risk 99%
  expectedShortfall: number; // Conditional VaR
  maxDrawdown: number;
  currentDrawdown: number;
  
  // Diversification metrics
  concentrationRisk: number;
  correlationMatrix: { [symbol: string]: { [symbol: string]: number } };
  diversificationRatio: number;
  
  // Performance metrics
  sharpeRatio: number;
  sortinoRatio: number;
  calmarRatio: number;
  informationRatio: number;
  
  // Position attribution
  positionContribution: { [positionId: string]: number }; // contribution to total return
  symbolContribution: { [symbol: string]: number }; // contribution by symbol
  
  // Trading metrics
  turnover: number; // portfolio turnover rate
  averageHoldingPeriod: number; // average position holding time in minutes
  winRate: number;
  profitFactor: number;
  
  // Risk-adjusted metrics
  riskAdjustedReturn: number;
  volatility: number; // portfolio volatility
  beta: number; // market beta if benchmark is available
  
  // Recent performance
  last1HourPnl: number;
  last4HourPnl: number;
  last24HourPnl: number;
  
  timestamp: number;
}

export interface PortfolioAlert {
  id: string;
  type: 'RISK_THRESHOLD' | 'CONCENTRATION' | 'CORRELATION' | 'DRAWDOWN' | 'VAR_BREACH' | 'PERFORMANCE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
  acknowledged: boolean;
  actionRequired: string[];
}

export interface BenchmarkData {
  symbol: string; // e.g., 'BTC-USD' for Bitcoin as benchmark
  returns: number[]; // historical returns for beta calculation
  timestamp: number;
}

export interface PerformanceAttribution {
  positionLevel: {
    [positionId: string]: {
      totalReturn: number;
      percentContribution: number;
      riskContribution: number;
      alphaContribution: number;
    };
  };
  symbolLevel: {
    [symbol: string]: {
      totalReturn: number;
      percentContribution: number;
      weightedReturn: number;
      avgHoldingPeriod: number;
    };
  };
  timeAttribution: {
    [timeframe: string]: {
      return: number;
      volatility: number;
      sharpe: number;
    };
  };
}

export interface RiskDecomposition {
  totalRisk: number;
  systematicRisk: number;
  idiosyncraticRisk: number;
  positionRisk: { [positionId: string]: number };
  correlationRisk: number;
  concentrationRisk: number;
  liquidityRisk: number;
}

export class PortfolioTracker {
  private riskManager: RiskManager;
  private historicalData: Map<string, number[]> = new Map(); // symbol -> price history
  private portfolioHistory: PortfolioMetrics[] = [];
  private performanceHistory: { [period: string]: number[] } = {};
  private alerts: PortfolioAlert[] = [];
  private correlationWindow = 100; // periods for correlation calculation

  constructor(riskManager: RiskManager) {
    this.riskManager = riskManager;
    this.initializeHistoricalData();
  }

  /**
   * Initialize historical data structures
   */
  private initializeHistoricalData(): void {
    const symbols = config.trading.pairs;
    symbols.forEach(symbol => {
      this.historicalData.set(symbol, []);
    });
    
    // Initialize performance tracking
    this.performanceHistory = {
      '1h': [],
      '4h': [],
      '1d': [],
      '1w': [],
      '1m': []
    };
  }

  /**
   * Update portfolio metrics with current market data
   */
  updatePortfolioMetrics(marketData: MarketData[]): PortfolioMetrics {
    const portfolio = this.riskManager.getPortfolio();
    
    // Update historical price data
    this.updateHistoricalData(marketData);
    
    // Calculate core metrics
    const coreMetrics = this.calculateCoreMetrics(portfolio, marketData);
    
    // Calculate risk metrics
    const riskMetrics = this.calculateRiskMetrics(portfolio, marketData);
    
    // Calculate performance attribution
    const attribution = this.calculatePerformanceAttribution(portfolio, marketData);
    
    // Calculate diversification metrics
    const diversification = this.calculateDiversificationMetrics(portfolio, marketData);
    
    // Calculate recent performance
    const recentPerformance = this.calculateRecentPerformance();
    
    const metrics: PortfolioMetrics = {
      // Core metrics (required)
      totalValue: coreMetrics.totalValue || 50000, // fallback to initial value
      totalUnrealizedPnl: coreMetrics.totalUnrealizedPnl || 0,
      totalRealizedPnl: coreMetrics.totalRealizedPnl || 0,
      dailyPnl: coreMetrics.dailyPnl || 0,
      weeklyPnl: 0, // Will be calculated separately
      monthlyPnl: 0, // Will be calculated separately
      
      // Risk metrics (required)
      totalRiskExposure: coreMetrics.totalRiskExposure || 0,
      riskExposurePercent: coreMetrics.riskExposurePercent || 0,
      portfolioVaR95: riskMetrics.portfolioVaR95 || 0,
      portfolioVaR99: riskMetrics.portfolioVaR99 || 0,
      expectedShortfall: riskMetrics.expectedShortfall || 0,
      maxDrawdown: riskMetrics.maxDrawdown || 0,
      currentDrawdown: riskMetrics.currentDrawdown || 0,
      
      // Diversification metrics (required)
      concentrationRisk: diversification.concentrationRisk || 0,
      correlationMatrix: diversification.correlationMatrix || {},
      diversificationRatio: diversification.diversificationRatio || 1,
      
      // Performance metrics (required)
      sharpeRatio: 0, // Will be calculated
      sortinoRatio: 0,
      calmarRatio: 0,
      informationRatio: 0,
      
      // Position attribution (required)
      positionContribution: attribution.positionContribution || {},
      symbolContribution: attribution.symbolContribution || {},
      
      // Trading metrics (required)
      turnover: 0,
      averageHoldingPeriod: 0,
      winRate: 0,
      profitFactor: 0,
      
      // Risk-adjusted metrics (required)
      riskAdjustedReturn: 0,
      volatility: riskMetrics.volatility || 0,
      beta: 0,
      
      // Recent performance (required)
      last1HourPnl: recentPerformance.last1HourPnl || 0,
      last4HourPnl: recentPerformance.last4HourPnl || 0,
      last24HourPnl: recentPerformance.last24HourPnl || 0,
      
      timestamp: Date.now()
    };
    
    // Store metrics for historical analysis
    this.portfolioHistory.push(metrics);
    if (this.portfolioHistory.length > 1000) {
      this.portfolioHistory.shift(); // Keep last 1000 records
    }
    
    // Check for alerts
    this.checkRiskAlerts(metrics);
    
    return metrics;
  }

  /**
   * Update historical price data
   */
  private updateHistoricalData(marketData: MarketData[]): void {
    marketData.forEach(data => {
      const history = this.historicalData.get(data.symbol) || [];
      history.push(data.price);
      
      // Keep only last 500 prices for memory efficiency
      if (history.length > 500) {
        history.shift();
      }
      
      this.historicalData.set(data.symbol, history);
    });
  }

  /**
   * Calculate core portfolio metrics
   */
  private calculateCoreMetrics(portfolio: Portfolio, marketData: MarketData[]): Partial<PortfolioMetrics> {
    let totalUnrealizedPnl = 0;
    let totalCurrentValue = 0;
    
    // Calculate unrealized P&L for open positions
    for (const position of portfolio.openPositions) {
      const currentMarketData = marketData.find(m => m.symbol === position.symbol);
      if (currentMarketData) {
        const currentValue = position.quantity * currentMarketData.price;
        const entryValue = position.quantity * position.entryPrice;
        const unrealizedPnl = position.side === 'BUY' 
          ? currentValue - entryValue - position.fees
          : entryValue - currentValue - position.fees;
        
        totalUnrealizedPnl += unrealizedPnl;
        totalCurrentValue += currentValue;
      }
    }
    
    return {
      totalValue: portfolio.totalBalance + totalUnrealizedPnl,
      totalUnrealizedPnl,
      totalRealizedPnl: portfolio.totalPnl,
      dailyPnl: portfolio.dailyPnl + totalUnrealizedPnl,
      totalRiskExposure: totalCurrentValue,
      riskExposurePercent: (totalCurrentValue / portfolio.totalBalance) * 100
    };
  }

  /**
   * Calculate risk metrics including VaR
   */
  private calculateRiskMetrics(_portfolio: Portfolio, _marketData: MarketData[]): Partial<PortfolioMetrics> {
    const returns = this.calculatePortfolioReturns();
    
    // Calculate VaR using historical simulation
    const var95 = this.calculateVaR(returns, 0.05);
    const var99 = this.calculateVaR(returns, 0.01);
    const expectedShortfall = this.calculateExpectedShortfall(returns, 0.05);
    
    // Calculate drawdown metrics
    const drawdownMetrics = this.calculateDrawdownMetrics();
    
    // Calculate portfolio volatility
    const volatility = this.calculateVolatility(returns);
    
    return {
      portfolioVaR95: var95,
      portfolioVaR99: var99,
      expectedShortfall,
      maxDrawdown: drawdownMetrics.maxDrawdown,
      currentDrawdown: drawdownMetrics.currentDrawdown,
      volatility
    };
  }

  /**
   * Calculate performance attribution
   */
  private calculatePerformanceAttribution(portfolio: Portfolio, marketData: MarketData[]): Partial<PortfolioMetrics> {
    const positionContribution: { [positionId: string]: number } = {};
    const symbolContribution: { [symbol: string]: number } = {};
    
    let totalPortfolioReturn = 0;
    
    for (const position of portfolio.openPositions) {
      const currentMarketData = marketData.find(m => m.symbol === position.symbol);
      if (currentMarketData) {
        // Calculate position return
        const positionReturn = position.side === 'BUY'
          ? (currentMarketData.price - position.entryPrice) / position.entryPrice
          : (position.entryPrice - currentMarketData.price) / position.entryPrice;
        
        const positionWeight = (position.quantity * position.entryPrice) / portfolio.totalBalance;
        const contribution = positionReturn * positionWeight;
        
        positionContribution[position.id] = contribution * 100;
        
        // Aggregate by symbol
        if (!symbolContribution[position.symbol]) {
          symbolContribution[position.symbol] = 0;
        }
        symbolContribution[position.symbol] += contribution * 100;
        
        totalPortfolioReturn += contribution;
      }
    }
    
    return {
      positionContribution,
      symbolContribution
    };
  }

  /**
   * Calculate diversification metrics
   */
  private calculateDiversificationMetrics(portfolio: Portfolio, _marketData: MarketData[]): Partial<PortfolioMetrics> {
    // Calculate concentration risk (Herfindahl index)
    const concentrationRisk = this.calculateConcentrationRisk(portfolio);
    
    // Calculate correlation matrix
    const correlationMatrix = this.calculateCorrelationMatrix();
    
    // Calculate diversification ratio
    const diversificationRatio = this.calculateDiversificationRatio(portfolio, correlationMatrix);
    
    return {
      concentrationRisk,
      correlationMatrix,
      diversificationRatio
    };
  }

  /**
   * Calculate recent performance metrics
   */
  private calculateRecentPerformance(): Partial<PortfolioMetrics> {
    const now = Date.now();
    const history = this.portfolioHistory;
    
    const last1Hour = history.filter(h => h.timestamp > now - 3600000);
    const last4Hours = history.filter(h => h.timestamp > now - 14400000);
    const last24Hours = history.filter(h => h.timestamp > now - 86400000);
    
    return {
      last1HourPnl: this.calculatePeriodPnl(last1Hour),
      last4HourPnl: this.calculatePeriodPnl(last4Hours),
      last24HourPnl: this.calculatePeriodPnl(last24Hours)
    };
  }

  /**
   * Calculate portfolio returns for risk metrics
   */
  private calculatePortfolioReturns(): number[] {
    const returns: number[] = [];
    
    for (let i = 1; i < this.portfolioHistory.length; i++) {
      const currentValue = this.portfolioHistory[i].totalValue;
      const previousValue = this.portfolioHistory[i - 1].totalValue;
      
      if (previousValue > 0) {
        const portfolioReturn = (currentValue - previousValue) / previousValue;
        returns.push(portfolioReturn);
      }
    }
    
    return returns;
  }

  /**
   * Calculate Value at Risk using historical simulation
   */
  private calculateVaR(returns: number[], confidence: number): number {
    if (returns.length === 0) return 0;
    
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidence) * sortedReturns.length);
    
    return Math.abs(sortedReturns[index] || 0) * 100; // Return as percentage
  }

  /**
   * Calculate Expected Shortfall (Conditional VaR)
   */
  private calculateExpectedShortfall(returns: number[], confidence: number): number {
    if (returns.length === 0) return 0;
    
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const cutoffIndex = Math.floor((1 - confidence) * sortedReturns.length);
    const tailReturns = sortedReturns.slice(0, cutoffIndex);
    
    if (tailReturns.length === 0) return 0;
    
    const averageTailReturn = tailReturns.reduce((sum, ret) => sum + ret, 0) / tailReturns.length;
    return Math.abs(averageTailReturn) * 100; // Return as percentage
  }

  /**
   * Calculate drawdown metrics
   */
  private calculateDrawdownMetrics(): { maxDrawdown: number; currentDrawdown: number } {
    if (this.portfolioHistory.length === 0) {
      return { maxDrawdown: 0, currentDrawdown: 0 };
    }
    
    let maxValue = this.portfolioHistory[0].totalValue;
    let maxDrawdown = 0;
    let currentDrawdown = 0;
    
    for (const metrics of this.portfolioHistory) {
      if (metrics.totalValue > maxValue) {
        maxValue = metrics.totalValue;
      }
      
      const drawdown = (maxValue - metrics.totalValue) / maxValue;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
      
      // Current drawdown is from the most recent peak
      const recentPeak = Math.max(...this.portfolioHistory.slice(-50).map(h => h.totalValue));
      currentDrawdown = (recentPeak - metrics.totalValue) / recentPeak;
    }
    
    return {
      maxDrawdown: maxDrawdown * 100,
      currentDrawdown: currentDrawdown * 100
    };
  }

  /**
   * Calculate portfolio volatility
   */
  private calculateVolatility(returns: number[]): number {
    if (returns.length < 2) return 0;
    
    const meanReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - meanReturn, 2), 0) / (returns.length - 1);
    
    return Math.sqrt(variance) * 100; // Return as percentage
  }

  /**
   * Calculate concentration risk using Herfindahl index
   */
  private calculateConcentrationRisk(portfolio: Portfolio): number {
    if (portfolio.openPositions.length === 0) return 0;
    
    const totalValue = portfolio.openPositions.reduce(
      (sum, pos) => sum + (pos.quantity * pos.entryPrice), 0
    );
    
    if (totalValue === 0) return 0;
    
    const weights = portfolio.openPositions.map(
      pos => (pos.quantity * pos.entryPrice) / totalValue
    );
    
    const herfindahl = weights.reduce((sum, weight) => sum + Math.pow(weight, 2), 0);
    
    // Convert to scale where 0 = perfectly diversified, 100 = completely concentrated
    return herfindahl * 100;
  }

  /**
   * Calculate correlation matrix between symbols
   */
  private calculateCorrelationMatrix(): { [symbol: string]: { [symbol: string]: number } } {
    const matrix: { [symbol: string]: { [symbol: string]: number } } = {};
    const symbols = Array.from(this.historicalData.keys());
    
    for (const symbol1 of symbols) {
      matrix[symbol1] = {};
      for (const symbol2 of symbols) {
        if (symbol1 === symbol2) {
          matrix[symbol1][symbol2] = 1.0;
        } else {
          matrix[symbol1][symbol2] = this.calculateCorrelation(symbol1, symbol2);
        }
      }
    }
    
    return matrix;
  }

  /**
   * Calculate correlation between two symbols
   */
  private calculateCorrelation(symbol1: string, symbol2: string): number {
    const data1 = this.historicalData.get(symbol1) || [];
    const data2 = this.historicalData.get(symbol2) || [];
    
    const minLength = Math.min(data1.length, data2.length, this.correlationWindow);
    if (minLength < 10) return 0; // Need minimum data points
    
    const returns1 = this.calculateReturns(data1.slice(-minLength));
    const returns2 = this.calculateReturns(data2.slice(-minLength));
    
    if (returns1.length !== returns2.length || returns1.length === 0) return 0;
    
    const mean1 = returns1.reduce((sum, ret) => sum + ret, 0) / returns1.length;
    const mean2 = returns2.reduce((sum, ret) => sum + ret, 0) / returns2.length;
    
    let numerator = 0;
    let denominator1 = 0;
    let denominator2 = 0;
    
    for (let i = 0; i < returns1.length; i++) {
      const diff1 = returns1[i] - mean1;
      const diff2 = returns2[i] - mean2;
      
      numerator += diff1 * diff2;
      denominator1 += diff1 * diff1;
      denominator2 += diff2 * diff2;
    }
    
    const denominator = Math.sqrt(denominator1 * denominator2);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Calculate returns from price array
   */
  private calculateReturns(prices: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      if (prices[i - 1] > 0) {
        returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
      }
    }
    return returns;
  }

  /**
   * Calculate diversification ratio
   */
  private calculateDiversificationRatio(portfolio: Portfolio, correlationMatrix: { [symbol: string]: { [symbol: string]: number } }): number {
    if (portfolio.openPositions.length <= 1) return 1;
    
    // Simplified diversification ratio calculation
    const positions = portfolio.openPositions;
    const totalValue = positions.reduce((sum, pos) => sum + (pos.quantity * pos.entryPrice), 0);
    
    if (totalValue === 0) return 1;
    
    const weights = positions.map(pos => (pos.quantity * pos.entryPrice) / totalValue);
    const symbols = positions.map(pos => pos.symbol);
    
    // Calculate weighted average correlation
    let weightedCorrelation = 0;
    let weightSum = 0;
    
    for (let i = 0; i < symbols.length; i++) {
      for (let j = i + 1; j < symbols.length; j++) {
        const correlation = correlationMatrix[symbols[i]]?.[symbols[j]] || 0;
        const weight = weights[i] * weights[j];
        weightedCorrelation += correlation * weight;
        weightSum += weight;
      }
    }
    
    const avgCorrelation = weightSum > 0 ? weightedCorrelation / weightSum : 0;
    
    // Diversification ratio = 1 / sqrt(weighted average correlation)
    return 1 / Math.sqrt(1 + avgCorrelation * (symbols.length - 1));
  }

  /**
   * Calculate P&L for a specific period
   */
  private calculatePeriodPnl(periodHistory: PortfolioMetrics[]): number {
    if (periodHistory.length === 0) return 0;
    
    const firstValue = periodHistory[0].totalValue;
    const lastValue = periodHistory[periodHistory.length - 1].totalValue;
    
    return ((lastValue - firstValue) / firstValue) * 100;
  }

  /**
   * Check for risk alerts
   */
  private checkRiskAlerts(metrics: PortfolioMetrics): void {
    const alerts: PortfolioAlert[] = [];
    
    // VaR breach alert
    if (metrics.currentDrawdown > metrics.portfolioVaR95) {
      alerts.push({
        id: `var_breach_${Date.now()}`,
        type: 'VAR_BREACH',
        severity: 'HIGH',
        title: 'VaR Breach Detected',
        message: `Current drawdown (${metrics.currentDrawdown.toFixed(2)}%) exceeds 95% VaR (${metrics.portfolioVaR95.toFixed(2)}%)`,
        value: metrics.currentDrawdown,
        threshold: metrics.portfolioVaR95,
        timestamp: Date.now(),
        acknowledged: false,
        actionRequired: ['Review position sizing', 'Consider reducing exposure', 'Reassess risk limits']
      });
    }
    
    // Concentration risk alert
    if (metrics.concentrationRisk > 70) {
      alerts.push({
        id: `concentration_${Date.now()}`,
        type: 'CONCENTRATION',
        severity: 'MEDIUM',
        title: 'High Concentration Risk',
        message: `Portfolio concentration risk is ${metrics.concentrationRisk.toFixed(1)}%`,
        value: metrics.concentrationRisk,
        threshold: 70,
        timestamp: Date.now(),
        acknowledged: false,
        actionRequired: ['Diversify positions', 'Reduce large position sizes']
      });
    }
    
    // Risk exposure alert
    if (metrics.riskExposurePercent > 80) {
      alerts.push({
        id: `exposure_${Date.now()}`,
        type: 'RISK_THRESHOLD',
        severity: 'HIGH',
        title: 'High Risk Exposure',
        message: `Portfolio risk exposure is ${metrics.riskExposurePercent.toFixed(1)}%`,
        value: metrics.riskExposurePercent,
        threshold: 80,
        timestamp: Date.now(),
        acknowledged: false,
        actionRequired: ['Reduce position sizes', 'Close some positions']
      });
    }
    
    // High drawdown alert
    if (metrics.currentDrawdown > 15) {
      alerts.push({
        id: `drawdown_${Date.now()}`,
        type: 'DRAWDOWN',
        severity: 'CRITICAL',
        title: 'High Drawdown Alert',
        message: `Current drawdown is ${metrics.currentDrawdown.toFixed(2)}%`,
        value: metrics.currentDrawdown,
        threshold: 15,
        timestamp: Date.now(),
        acknowledged: false,
        actionRequired: ['Emergency risk review', 'Consider stopping trading', 'Reassess strategy']
      });
    }
    
    // Add alerts to the list
    this.alerts.push(...alerts);
    
    // Keep only last 100 alerts for memory management
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  /**
   * Get position-level risk analysis
   */
  getPositionRisk(marketData: MarketData[]): PositionRisk[] {
    const portfolio = this.riskManager.getPortfolio();
    const positionRisks: PositionRisk[] = [];
    
    for (const position of portfolio.openPositions) {
      const currentMarketData = marketData.find(m => m.symbol === position.symbol);
      if (currentMarketData) {
        const currentValue = position.quantity * currentMarketData.price;
        const entryValue = position.quantity * position.entryPrice;
        
        const unrealizedPnl = position.side === 'BUY'
          ? currentValue - entryValue - position.fees
          : entryValue - currentValue - position.fees;
        
        const unrealizedPnlPercent = (unrealizedPnl / entryValue) * 100;
        const exposurePercent = (currentValue / portfolio.totalBalance) * 100;
        const timeInPosition = (Date.now() - position.openTime) / (1000 * 60); // minutes
        
        // Calculate risk score based on multiple factors
        const riskScore = this.calculatePositionRiskScore(position, currentMarketData, exposurePercent);
        
        // Calculate volatility-adjusted risk
        const volatilityAdjustedRisk = this.calculateVolatilityAdjustedRisk(position.symbol, exposurePercent);
        
        // Calculate correlation risk with other positions
        const correlationRisk = this.calculatePositionCorrelationRisk(position, portfolio.openPositions);
        
        positionRisks.push({
          positionId: position.id,
          symbol: position.symbol,
          currentValue,
          unrealizedPnl,
          unrealizedPnlPercent,
          riskScore,
          volatilityAdjustedRisk,
          exposurePercent,
          timeInPosition,
          correlationRisk
        });
      }
    }
    
    return positionRisks;
  }

  /**
   * Calculate position risk score
   */
  private calculatePositionRiskScore(position: TradePosition, marketData: MarketData, exposurePercent: number): number {
    let riskScore = 0;
    
    // Size risk (0-30 points)
    riskScore += Math.min(exposurePercent * 0.6, 30);
    
    // Time risk (0-20 points)
    const timeInPosition = (Date.now() - position.openTime) / (1000 * 60 * 60); // hours
    riskScore += Math.min(timeInPosition * 2, 20);
    
    // P&L risk (0-25 points)
    const pnlPercent = Math.abs(position.pnlPercent);
    riskScore += Math.min(pnlPercent * 2.5, 25);
    
    // Volatility risk (0-15 points)
    const volatility = this.getSymbolVolatility(position.symbol);
    riskScore += Math.min(volatility * 1.5, 15);
    
    // Liquidity risk (0-10 points)
    const spread = marketData.spread;
    const spreadPercent = (spread / marketData.price) * 100;
    riskScore += Math.min(spreadPercent * 100, 10);
    
    return Math.min(riskScore, 100);
  }

  /**
   * Calculate volatility-adjusted risk
   */
  private calculateVolatilityAdjustedRisk(symbol: string, exposurePercent: number): number {
    const volatility = this.getSymbolVolatility(symbol);
    return exposurePercent * (volatility / 10); // Normalize volatility impact
  }

  /**
   * Get symbol volatility
   */
  private getSymbolVolatility(symbol: string): number {
    const history = this.historicalData.get(symbol) || [];
    if (history.length < 20) return 10; // Default volatility if insufficient data
    
    const returns = this.calculateReturns(history.slice(-50));
    return this.calculateVolatility(returns);
  }

  /**
   * Calculate correlation risk for a position
   */
  private calculatePositionCorrelationRisk(position: TradePosition, allPositions: TradePosition[]): number {
    const correlationMatrix = this.calculateCorrelationMatrix();
    let totalCorrelationRisk = 0;
    let correlationCount = 0;
    
    for (const otherPosition of allPositions) {
      if (otherPosition.id !== position.id) {
        const correlation = correlationMatrix[position.symbol]?.[otherPosition.symbol] || 0;
        totalCorrelationRisk += Math.abs(correlation);
        correlationCount++;
      }
    }
    
    return correlationCount > 0 ? (totalCorrelationRisk / correlationCount) * 100 : 0;
  }

  /**
   * Get current alerts
   */
  getAlerts(): PortfolioAlert[] {
    return [...this.alerts];
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  /**
   * Get portfolio metrics history
   */
  getPortfolioHistory(limit: number = 100): PortfolioMetrics[] {
    return this.portfolioHistory.slice(-limit);
  }

  /**
   * Get comprehensive portfolio summary
   */
  getPortfolioSummary(marketData: MarketData[]): {
    metrics: PortfolioMetrics;
    positionRisks: PositionRisk[];
    alerts: PortfolioAlert[];
    recommendations: string[];
  } {
    const metrics = this.updatePortfolioMetrics(marketData);
    const positionRisks = this.getPositionRisk(marketData);
    const alerts = this.getAlerts().filter(a => !a.acknowledged);
    const recommendations = this.generateRecommendations(metrics, positionRisks, alerts);
    
    return {
      metrics,
      positionRisks,
      alerts,
      recommendations
    };
  }

  /**
   * Generate recommendations based on portfolio analysis
   */
  private generateRecommendations(
    metrics: PortfolioMetrics,
    positionRisks: PositionRisk[],
    alerts: PortfolioAlert[]
  ): string[] {
    const recommendations: string[] = [];
    
    // Risk-based recommendations
    if (metrics.riskExposurePercent > 70) {
      recommendations.push('Consider reducing overall portfolio exposure');
    }
    
    if (metrics.concentrationRisk > 60) {
      recommendations.push('Diversify portfolio by adding positions in uncorrelated assets');
    }
    
    if (metrics.currentDrawdown > 10) {
      recommendations.push('Review risk management settings and consider tighter stop losses');
    }
    
    // Position-specific recommendations
    const highRiskPositions = positionRisks.filter(p => p.riskScore > 70);
    if (highRiskPositions.length > 0) {
      recommendations.push(`Consider reducing size of high-risk positions: ${highRiskPositions.map(p => p.symbol).join(', ')}`);
    }
    
    // Performance recommendations
    if (metrics.sharpeRatio < 1.0 && metrics.volatility > 20) {
      recommendations.push('Consider reducing position sizes to improve risk-adjusted returns');
    }
    
    // Alert-based recommendations
    const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL');
    if (criticalAlerts.length > 0) {
      recommendations.push('Address critical alerts immediately to prevent further losses');
    }
    
    return recommendations;
  }

  /**
   * Reset daily tracking (called at start of new trading day)
   */
  resetDailyTracking(): void {
    // Clear daily performance tracking
    this.performanceHistory['1d'] = [];
    
    // Reset daily alerts
    this.alerts = this.alerts.filter(a => 
      a.type !== 'PERFORMANCE' || 
      Date.now() - a.timestamp > 86400000 // Keep non-performance alerts older than 1 day
    );
  }

  /**
   * Export portfolio data for analysis
   */
  exportPortfolioData(): {
    metrics: PortfolioMetrics[];
    alerts: PortfolioAlert[];
    historicalData: { [symbol: string]: number[] };
  } {
    return {
      metrics: [...this.portfolioHistory],
      alerts: [...this.alerts],
      historicalData: Object.fromEntries(this.historicalData)
    };
  }
}