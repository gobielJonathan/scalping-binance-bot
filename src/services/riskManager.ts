import { TradePosition, Portfolio, OrderRequest, MarketData, TradingSignal } from '../types';
import config from '../config';
import { calculatePnL, generateTradeId } from '../utils/helpers';
import { logger } from './logger';

export interface PositionSizingParams {
  method: 'FIXED' | 'KELLY' | 'VOLATILITY_ADJUSTED' | 'RISK_PARITY' | 'EQUAL_WEIGHT' | 'DYNAMIC';
  baseRiskPercent: number;
  kellyFraction?: number;
  volatilityLookback?: number;
  maxPositionSize?: number;
  minPositionSize?: number;
  dynamicAdjustment?: boolean;
}

export interface LossLimit {
  type: 'DOLLAR' | 'PERCENTAGE' | 'DRAWDOWN';
  value: number;
  warningThreshold: number; // percentage of limit that triggers warning
  enabled: boolean;
  autoReduction: boolean; // automatically reduce positions when approaching limit
  recoveryCondition?: {
    profitTarget: number; // profit needed to reset limit
    timeRequired: number; // time in minutes before trading resumes
  };
}

export interface RiskMetrics {
  currentRisk: number;
  maxRisk: number;
  riskUtilization: number; // percentage of max risk used
  avgPositionSize: number;
  positionCorrelation: number;
  portfolioVolatility: number;
  sharpeRatio: number;
  maxDrawdownPercent: number;
  winRate: number;
  profitFactor: number;
  kellyCriterion: number;
}

export interface PerformanceMetrics {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWin: number;
  avgLoss: number;
  avgReturn: number;
  recentWinRate: number; // last 20 trades
  recentAvgReturn: number; // last 20 trades
  maxConsecutiveLosses: number;
  currentStreak: number; // positive for wins, negative for losses
  lastUpdateTime: number;
}

/**
 * Enhanced risk management service with advanced position sizing and loss limits
 */
export class RiskManager {
  private portfolio: Portfolio;
  private dailyStartBalance: number;
  private emergencyStopTriggered: boolean = false;
  private positionSizingParams: PositionSizingParams;
  private lossLimits: { [key: string]: LossLimit };
  private performanceMetrics: PerformanceMetrics;
  private volatilityHistory: Map<string, number[]> = new Map();
  private priceHistory: Map<string, number[]> = new Map();
  private tradeHistory: TradePosition[] = [];
  private dailyLossLimitBreached: boolean = false;
  private warningsIssued: Set<string> = new Set();

  constructor(initialBalance: number) {
    this.portfolio = {
      totalBalance: initialBalance,
      availableBalance: initialBalance,
      lockedBalance: 0,
      totalPnl: 0,
      totalPnlPercent: 0,
      dailyPnl: 0,
      dailyPnlPercent: 0,
      openPositions: [],
      riskExposure: 0,
      maxDrawdown: 0
    };
    this.dailyStartBalance = initialBalance;
    
    // Initialize position sizing parameters
    this.positionSizingParams = {
      method: 'VOLATILITY_ADJUSTED',
      baseRiskPercent: config.trading.riskPerTrade * 100,
      kellyFraction: 0.25, // Conservative Kelly
      volatilityLookback: 50,
      maxPositionSize: initialBalance * 0.25,
      minPositionSize: initialBalance * 0.001,
      dynamicAdjustment: true
    };
    
    // Initialize loss limits
    this.lossLimits = {
      daily_dollar: {
        type: 'DOLLAR',
        value: initialBalance * config.trading.dailyLossLimit,
        warningThreshold: 80,
        enabled: true,
        autoReduction: true
      },
      daily_percentage: {
        type: 'PERCENTAGE',
        value: config.trading.dailyLossLimit * 100,
        warningThreshold: 75,
        enabled: true,
        autoReduction: true,
        recoveryCondition: {
          profitTarget: initialBalance * 0.05,
          timeRequired: 240 // 4 hours
        }
      },
      max_drawdown: {
        type: 'DRAWDOWN',
        value: 25, // 25% max drawdown
        warningThreshold: 80,
        enabled: true,
        autoReduction: true
      }
    };
    
    // Initialize performance tracking
    this.performanceMetrics = {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      avgWin: 0,
      avgLoss: 0,
      avgReturn: 0,
      recentWinRate: 0,
      recentAvgReturn: 0,
      maxConsecutiveLosses: 0,
      currentStreak: 0,
      lastUpdateTime: Date.now()
    };
  }

  /**
   * Check if a new trade can be opened based on enhanced risk rules
   */
  canOpenTrade(
    orderRequest: OrderRequest, 
    currentPrice: number, 
    signal?: TradingSignal,
    marketData?: MarketData
  ): {
    allowed: boolean;
    reason?: string;
    maxQuantity?: number;
    suggestedQuantity?: number;
    warnings?: string[];
  } {
    const warnings: string[] = [];
    
    // Check emergency stop
    if (this.emergencyStopTriggered) {
      return { allowed: false, reason: 'Emergency stop is active' };
    }

    // Check enhanced loss limits
    const lossLimitCheck = this.checkLossLimits();
    if (!lossLimitCheck.allowed) {
      return { 
        allowed: false, 
        reason: lossLimitCheck.reason,
        warnings: lossLimitCheck.warnings
      };
    }
    warnings.push(...lossLimitCheck.warnings);

    // Check maximum concurrent trades
    if (this.portfolio.openPositions.length >= config.trading.maxConcurrentTrades) {
      return { allowed: false, reason: 'Maximum concurrent trades reached' };
    }

    // Calculate optimal position size
    const optimalQuantity = this.calculateOptimalPositionSize(
      orderRequest.symbol, 
      currentPrice, 
      signal, 
      marketData
    );
    const positionValue = orderRequest.quantity * currentPrice;
    const optimalValue = optimalQuantity * currentPrice;
    
    // Check if we have enough available balance
    if (positionValue > this.portfolio.availableBalance) {
      const maxAffordableQuantity = this.portfolio.availableBalance / currentPrice * 0.95; // 5% buffer
      return {
        allowed: false,
        reason: 'Insufficient balance',
        maxQuantity: maxAffordableQuantity,
        suggestedQuantity: Math.min(optimalQuantity, maxAffordableQuantity),
        warnings
      };
    }

    // Check position size against optimal size
    if (orderRequest.quantity > optimalQuantity * 1.5) {
      warnings.push(`Requested size is ${((orderRequest.quantity / optimalQuantity - 1) * 100).toFixed(1)}% above optimal`);
    }

    // Check total risk exposure with improved calculation
    const newRiskExposure = this.calculatePortfolioRiskExposure() + positionValue;
    const maxRiskExposure = this.portfolio.totalBalance * 0.6; // Max 60% exposure
    
    if (newRiskExposure > maxRiskExposure) {
      const maxAdditionalExposure = maxRiskExposure - this.calculatePortfolioRiskExposure();
      const maxQuantityByExposure = Math.max(0, maxAdditionalExposure / currentPrice);
      
      return { 
        allowed: false, 
        reason: 'Total risk exposure limit would be exceeded',
        maxQuantity: maxQuantityByExposure,
        suggestedQuantity: Math.min(optimalQuantity, maxQuantityByExposure),
        warnings
      };
    }
    
    // Check correlation risk
    const correlationRisk = this.calculateSymbolCorrelationRisk(orderRequest.symbol);
    if (correlationRisk > 0.8) {
      warnings.push(`High correlation risk (${(correlationRisk * 100).toFixed(0)}%) with existing positions`);
    }

    return { 
      allowed: true,
      suggestedQuantity: optimalQuantity,
      warnings: warnings.length > 0 ? warnings : undefined
    };
  }

  /**
   * Calculate optimal position size based on selected method
   */
  calculateOptimalPositionSize(
    symbol: string,
    currentPrice: number,
    signal?: TradingSignal,
    marketData?: MarketData
  ): number {
    // Update market data for volatility calculations
    if (marketData) {
      this.updateMarketData(symbol, marketData);
    }
    
    switch (this.positionSizingParams.method) {
      case 'KELLY':
        return this.calculateKellyPositionSize(currentPrice);
      case 'VOLATILITY_ADJUSTED':
        return this.calculateVolatilityAdjustedSize(symbol, currentPrice, signal);
      case 'RISK_PARITY':
        return this.calculateRiskParitySize(symbol, currentPrice);
      case 'EQUAL_WEIGHT':
        return this.calculateEqualWeightSize(currentPrice);
      case 'DYNAMIC':
        return this.calculateDynamicPositionSize(symbol, currentPrice, signal);
      case 'FIXED':
      default:
        return this.calculateFixedPositionSize(currentPrice);
    }
  }
  
  /**
   * Calculate maximum position size based on risk per trade (legacy method)
   */
  calculateMaxPositionSize(currentPrice: number): number {
    return this.calculateFixedPositionSize(currentPrice);
  }
  
  /**
   * Calculate fixed position size based on risk per trade
   */
  private calculateFixedPositionSize(currentPrice: number): number {
    const riskAmount = this.portfolio.totalBalance * config.trading.riskPerTrade;
    const stopLossDistance = currentPrice * config.trading.stopLossPercentage;
    
    if (stopLossDistance === 0) return 0;
    
    return riskAmount / stopLossDistance;
  }

  /**
   * Calculate position size using Kelly Criterion
   */
  private calculateKellyPositionSize(currentPrice: number): number {
    const metrics = this.performanceMetrics;
    
    if (metrics.avgLoss === 0 || metrics.totalTrades < 10) {
      return this.calculateFixedPositionSize(currentPrice);
    }

    // Kelly fraction = (bp - q) / b
    const b = metrics.avgWin / Math.abs(metrics.avgLoss);
    const p = metrics.winningTrades / metrics.totalTrades;
    const q = 1 - p;
    
    const kellyFraction = (b * p - q) / b;
    
    // Apply fractional Kelly for risk management
    const fractionalKelly = kellyFraction * (this.positionSizingParams.kellyFraction || 0.25);
    
    // Cap at max risk per trade and ensure it's positive
    const cappedKelly = Math.max(0, Math.min(fractionalKelly, config.trading.riskPerTrade));
    
    const positionValue = this.portfolio.totalBalance * cappedKelly;
    return positionValue / currentPrice;
  }
  
  /**
   * Calculate volatility-adjusted position size
   */
  private calculateVolatilityAdjustedSize(symbol: string, currentPrice: number, signal?: TradingSignal): number {
    const baseSize = this.calculateFixedPositionSize(currentPrice);
    const volatility = this.getSymbolVolatility(symbol);
    
    // Adjust size inversely to volatility
    const avgVolatility = 15; // Baseline volatility in %
    const volatilityAdjustment = Math.min(avgVolatility / Math.max(volatility, 5), 2); // Cap at 2x
    
    // Signal strength adjustment
    let signalAdjustment = 1;
    if (signal) {
      signalAdjustment = (signal.confidence / 100) * (signal.strength / 100);
      signalAdjustment = Math.max(0.3, Math.min(signalAdjustment, 1.5)); // 30% to 150%
    }
    
    const adjustedSize = baseSize * volatilityAdjustment * signalAdjustment;
    
    // Apply min/max constraints
    const minSize = (this.positionSizingParams.minPositionSize || 0) / currentPrice;
    const maxSize = (this.positionSizingParams.maxPositionSize || this.portfolio.totalBalance * 0.25) / currentPrice;
    
    return Math.max(minSize, Math.min(adjustedSize, maxSize));
  }
  
  /**
   * Calculate risk parity position size
   */
  private calculateRiskParitySize(symbol: string, currentPrice: number): number {
    const openPositions = this.portfolio.openPositions;
    const volatility = this.getSymbolVolatility(symbol);
    
    if (openPositions.length === 0) {
      // First position - use volatility adjusted size
      const baseSize = this.calculateFixedPositionSize(currentPrice);
      const avgVolatility = 15;
      const adjustment = Math.min(avgVolatility / Math.max(volatility, 5), 2);
      return baseSize * adjustment;
    }
    
    // Calculate target risk per position
    const targetRiskPerPosition = (this.portfolio.totalBalance * config.trading.riskPerTrade) / (openPositions.length + 1);
    
    // Position size = target risk / (price * volatility)
    const positionSize = targetRiskPerPosition / (currentPrice * (volatility / 100));
    
    // Apply constraints
    const minSize = (this.positionSizingParams.minPositionSize || 0) / currentPrice;
    const maxSize = (this.positionSizingParams.maxPositionSize || this.portfolio.totalBalance * 0.25) / currentPrice;
    
    return Math.max(minSize, Math.min(positionSize, maxSize));
  }
  
  /**
   * Calculate equal weight position size
   */
  private calculateEqualWeightSize(currentPrice: number): number {
    const maxConcurrentTrades = config.trading.maxConcurrentTrades;
    const targetAllocation = this.portfolio.totalBalance / maxConcurrentTrades;
    
    // Use 80% of target allocation for safety
    const positionValue = targetAllocation * 0.8;
    return positionValue / currentPrice;
  }
  
  /**
   * Calculate dynamic position size based on recent performance
   */
  private calculateDynamicPositionSize(symbol: string, currentPrice: number, signal?: TradingSignal): number {
    let baseSize = this.calculateVolatilityAdjustedSize(symbol, currentPrice, signal);
    
    // Recent performance adjustment
    const recentPerformance = this.performanceMetrics.recentAvgReturn;
    const performanceMultiplier = Math.max(0.5, Math.min(1.5, 1 + (recentPerformance / 10))); // -50% to +50%
    
    // Winning streak bonus
    const streak = this.performanceMetrics.currentStreak;
    let streakMultiplier = 1;
    if (streak > 0) {
      streakMultiplier = Math.min(1.25, 1 + (streak * 0.05)); // Up to 25% bonus
    } else if (streak < 0) {
      streakMultiplier = Math.max(0.7, 1 + (streak * 0.03)); // Up to 30% reduction
    }
    
    // Market conditions adjustment
    const marketVolatility = this.getSymbolVolatility(symbol);
    const marketMultiplier = marketVolatility > 25 ? 0.8 : 1.0; // Reduce size in high volatility
    
    return baseSize * performanceMultiplier * streakMultiplier * marketMultiplier;
  }

  /**
   * Add a new position to tracking
   */
  addPosition(position: TradePosition): void {
    this.portfolio.openPositions.push(position);
    const positionValue = position.quantity * position.entryPrice;
    
    this.portfolio.lockedBalance += positionValue;
    this.portfolio.availableBalance -= positionValue;
    this.portfolio.riskExposure += positionValue;
  }

  /**
   * Update an existing position
   */
  updatePosition(positionId: string, currentPrice: number, fees: number = 0): void {
    const position = this.portfolio.openPositions.find(p => p.id === positionId);
    if (!position) return;

    position.currentPrice = currentPrice;
    position.fees += fees;
    
    const pnlData = calculatePnL(
      position.entryPrice,
      currentPrice,
      position.quantity,
      position.side,
      position.fees
    );
    
    position.pnl = pnlData.pnl;
    position.pnlPercent = pnlData.pnlPercent;
  }

  /**
   * Close a position with enhanced tracking
   */
  closePosition(positionId: string, exitPrice: number, fees: number = 0): TradePosition | null {
    const positionIndex = this.portfolio.openPositions.findIndex(p => p.id === positionId);
    if (positionIndex === -1) return null;

    const position = this.portfolio.openPositions[positionIndex];
    position.currentPrice = exitPrice;
    position.status = 'CLOSED';
    position.closeTime = Date.now();
    position.fees += fees;

    const pnlData = calculatePnL(
      position.entryPrice,
      exitPrice,
      position.quantity,
      position.side,
      position.fees
    );
    
    position.pnl = pnlData.pnl;
    position.pnlPercent = pnlData.pnlPercent;

    // Update portfolio
    const positionValue = position.quantity * position.entryPrice;
    this.portfolio.lockedBalance -= positionValue;
    this.portfolio.availableBalance += positionValue + position.pnl;
    this.portfolio.totalBalance += position.pnl;
    this.portfolio.riskExposure -= positionValue;
    this.portfolio.totalPnl += position.pnl;
    this.portfolio.dailyPnl += position.pnl;

    // Update performance metrics
    this.updatePerformanceMetrics(position);

    // Add to trade history
    this.tradeHistory.push({ ...position });
    
    // Keep only last 1000 trades in memory
    if (this.tradeHistory.length > 1000) {
      this.tradeHistory.shift();
    }

    // Remove from open positions
    this.portfolio.openPositions.splice(positionIndex, 1);

    // Check if we need to reduce position sizes due to losses
    this.triggerAutoPositionReduction();

    return position;
  }

  /**
   * Check if stop loss should be triggered
   */
  shouldTriggerStopLoss(positionId: string, currentPrice: number): boolean {
    const position = this.portfolio.openPositions.find(p => p.id === positionId);
    if (!position) return false;

    if (position.side === 'BUY') {
      return currentPrice <= position.stopLoss;
    } else {
      return currentPrice >= position.stopLoss;
    }
  }

  /**
   * Check if take profit should be triggered
   */
  shouldTriggerTakeProfit(positionId: string, currentPrice: number): boolean {
    const position = this.portfolio.openPositions.find(p => p.id === positionId);
    if (!position) return false;

    if (position.side === 'BUY') {
      return currentPrice >= position.takeProfit;
    } else {
      return currentPrice <= position.takeProfit;
    }
  }

  /**
   * Update daily P&L calculations
   */
  updateDailyPnL(): void {
    this.portfolio.dailyPnlPercent = (this.portfolio.dailyPnl / this.dailyStartBalance) * 100;
    this.portfolio.totalPnlPercent = (this.portfolio.totalPnl / this.dailyStartBalance) * 100;
  }

  /**
   * Reset daily P&L at start of new trading day
   */
  resetDailyPnL(): void {
    this.dailyStartBalance = this.portfolio.totalBalance;
    this.portfolio.dailyPnl = 0;
    this.portfolio.dailyPnlPercent = 0;
  }

  /**
   * Trigger emergency stop
   */
  triggerEmergencyStop(reason: string): void {
    this.emergencyStopTriggered = true;
    logger.error(`Emergency stop triggered: ${reason}`);
    
    // Log all open positions for manual review
    logger.info('Open positions at emergency stop', { positions: this.portfolio.openPositions });
  }

  /**
   * Reset emergency stop (manual action required)
   */
  resetEmergencyStop(): void {
    this.emergencyStopTriggered = false;
  }

  /**
   * Sync internal balance with the real on-exchange USDT balance.
   * Call this before placing a live order to prevent "Insufficient balance" errors
   * that occur when the bot restarts and the in-memory state drifts from reality.
   */
  syncBalance(realUsdtBalance: number): void {
    const lockedBalance = this.portfolio.lockedBalance;
    this.portfolio.availableBalance = Math.max(0, realUsdtBalance - lockedBalance);
    this.portfolio.totalBalance = realUsdtBalance + this.portfolio.totalPnl;
  }

  /**
   * Get current portfolio status
   */
  getPortfolio(): Portfolio {
    // Update real-time P&L for open positions
    this.updateDailyPnL();
    return { ...this.portfolio };
  }

  /**
   * Check overall risk health
   */
  getRiskHealth(): {
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    warnings: string[];
    metrics: {
      dailyPnlPercent: number;
      riskExposurePercent: number;
      openPositionsCount: number;
      availableBalancePercent: number;
    };
  } {
    const warnings: string[] = [];
    let status: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
    
    const dailyPnlPercent = this.portfolio.dailyPnlPercent;
    const riskExposurePercent = (this.portfolio.riskExposure / this.portfolio.totalBalance) * 100;
    const availableBalancePercent = (this.portfolio.availableBalance / this.portfolio.totalBalance) * 100;

    // Check daily P&L
    if (dailyPnlPercent < -10) {
      warnings.push('High daily losses detected');
      status = 'WARNING';
    }
    if (dailyPnlPercent < -config.trading.dailyLossLimit * 100 * 0.8) {
      warnings.push('Approaching daily loss limit');
      status = 'CRITICAL';
    }

    // Check risk exposure
    if (riskExposurePercent > 40) {
      warnings.push('High risk exposure');
      status = 'WARNING';
    }

    // Check available balance
    if (availableBalancePercent < 20) {
      warnings.push('Low available balance');
      status = 'WARNING';
    }

    // Check number of open positions
    if (this.portfolio.openPositions.length >= config.trading.maxConcurrentTrades * 0.8) {
      warnings.push('Approaching max concurrent trades');
      status = 'WARNING';
    }

    return {
      status,
      warnings,
      metrics: {
        dailyPnlPercent,
        riskExposurePercent,
        openPositionsCount: this.portfolio.openPositions.length,
        availableBalancePercent
      }
    };
  }

  /**
   * Get enhanced risk health assessment
   */
  getEnhancedRiskHealth(): {
    status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    warnings: string[];
    metrics: RiskMetrics;
    lossLimitStatus: { [key: string]: { value: number; limit: number; percent: number } };
  } {
     const warnings: string[] = [];
     let status: 'HEALTHY' | 'WARNING' | 'CRITICAL' = 'HEALTHY';
     
     // Calculate comprehensive risk metrics
     const metrics: RiskMetrics = {
       currentRisk: this.calculatePortfolioRiskExposure(),
       maxRisk: this.portfolio.totalBalance * 0.6,
       riskUtilization: (this.calculatePortfolioRiskExposure() / (this.portfolio.totalBalance * 0.6)) * 100,
       avgPositionSize: this.portfolio.openPositions.length > 0 
         ? this.calculatePortfolioRiskExposure() / this.portfolio.openPositions.length 
         : 0,
       positionCorrelation: this.calculateAveragePositionCorrelation(),
       portfolioVolatility: this.calculatePortfolioVolatility(),
       sharpeRatio: this.calculateSharpeRatio(),
       maxDrawdownPercent: this.calculateCurrentDrawdown(),
       winRate: this.performanceMetrics.totalTrades > 0 
         ? (this.performanceMetrics.winningTrades / this.performanceMetrics.totalTrades) * 100 
         : 0,
       profitFactor: this.calculateProfitFactor(),
       kellyCriterion: this.calculateKellyCriterion()
     };
     
     // Loss limit status
     const lossLimitStatus: { [key: string]: { value: number; limit: number; percent: number } } = {};
     
     for (const [limitId, limit] of Object.entries(this.lossLimits)) {
       if (!limit.enabled) continue;
       
       let currentValue = 0;
       switch (limit.type) {
         case 'DOLLAR':
           currentValue = Math.abs(this.portfolio.dailyPnl);
           break;
         case 'PERCENTAGE':
           currentValue = Math.abs((this.portfolio.dailyPnl / this.dailyStartBalance) * 100);
           break;
         case 'DRAWDOWN':
           currentValue = this.calculateCurrentDrawdown();
           break;
       }
       
       const percentUsed = (currentValue / limit.value) * 100;
       lossLimitStatus[limitId] = {
         value: currentValue,
         limit: limit.value,
         percent: percentUsed
       };
       
       if (percentUsed >= 100) {
         warnings.push(`${limit.type} loss limit breached`);
         status = 'CRITICAL';
       } else if (percentUsed >= limit.warningThreshold) {
         warnings.push(`Approaching ${limit.type} loss limit (${percentUsed.toFixed(1)}%)`);
         if (status === 'HEALTHY') status = 'WARNING';
       }
     }
     
     // Additional risk checks
     if (metrics.riskUtilization > 80) {
       warnings.push('High risk utilization');
       if (status === 'HEALTHY') status = 'WARNING';
     }
     
     if (metrics.positionCorrelation > 0.7) {
       warnings.push('High position correlation risk');
       if (status === 'HEALTHY') status = 'WARNING';
     }
     
     if (this.performanceMetrics.currentStreak < -3) {
       warnings.push(`${Math.abs(this.performanceMetrics.currentStreak)} consecutive losses`);
       if (status === 'HEALTHY') status = 'WARNING';
     }
     
     if (metrics.maxDrawdownPercent > 20) {
       warnings.push('High portfolio drawdown');
       status = 'CRITICAL';
     }
     
     return {
       status,
       warnings,
       metrics,
       lossLimitStatus
     };
  }
  
  /**
   * Calculate average position correlation
   */
  private calculateAveragePositionCorrelation(): number {
     const symbols = this.portfolio.openPositions.map(pos => pos.symbol);
     if (symbols.length < 2) return 0;
     
     // Simplified correlation calculation for crypto pairs
     const btcCorrelated = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
     const btcPositions = symbols.filter(s => btcCorrelated.includes(s)).length;
     
     if (btcPositions >= 2) {
       return Math.min(0.9, btcPositions * 0.3);
     }
     
     return 0.3; // Default moderate correlation
   }
   
   /**
    * Calculate portfolio volatility
    */
   private calculatePortfolioVolatility(): number {
     if (this.portfolio.openPositions.length === 0) return 0;
     
     const volatilities = this.portfolio.openPositions.map(pos => {
       const weight = (pos.quantity * pos.currentPrice) / this.calculatePortfolioRiskExposure();
       const symbolVol = this.getSymbolVolatility(pos.symbol);
       return weight * symbolVol;
     });
     
     return volatilities.reduce((sum, vol) => sum + vol, 0);
   }
   
   /**
    * Calculate Sharpe ratio
    */
   private calculateSharpeRatio(): number {
     if (this.performanceMetrics.totalTrades < 10) return 0;
     
     const avgReturn = this.performanceMetrics.avgReturn;
     const portfolioVol = this.calculatePortfolioVolatility();
     
     if (portfolioVol === 0) return 0;
     
     // Assuming risk-free rate of 0 for simplicity
     return (avgReturn / this.portfolio.totalBalance) / (portfolioVol / 100);
   }
   
   /**
    * Calculate profit factor
    */
   private calculateProfitFactor(): number {
     if (this.performanceMetrics.avgLoss === 0 || this.performanceMetrics.losingTrades === 0) return 0;
     
     const grossProfit = this.performanceMetrics.avgWin * this.performanceMetrics.winningTrades;
     const grossLoss = Math.abs(this.performanceMetrics.avgLoss * this.performanceMetrics.losingTrades);
     
     return grossLoss === 0 ? 0 : grossProfit / grossLoss;
   }
   
   /**
    * Calculate Kelly Criterion value
    */
   private calculateKellyCriterion(): number {
     const metrics = this.performanceMetrics;
     
     if (metrics.avgLoss === 0 || metrics.totalTrades < 10) return 0;
     
     const winRate = metrics.winningTrades / metrics.totalTrades;
     const avgWinLossRatio = metrics.avgWin / Math.abs(metrics.avgLoss);
     
     return (winRate * avgWinLossRatio - (1 - winRate)) / avgWinLossRatio;
   }

  /**
   * Check enhanced loss limits with warnings and auto-reduction
   */
  private checkLossLimits(): {
    allowed: boolean;
    reason?: string;
    warnings: string[];
  } {
    const warnings: string[] = [];
    
    for (const [limitId, limit] of Object.entries(this.lossLimits)) {
      if (!limit.enabled) continue;
      
      let currentValue = 0;
      let limitValue = limit.value;
      
      switch (limit.type) {
        case 'DOLLAR':
          currentValue = Math.abs(this.portfolio.dailyPnl);
          break;
        case 'PERCENTAGE':
          currentValue = Math.abs((this.portfolio.dailyPnl / this.dailyStartBalance) * 100);
          break;
        case 'DRAWDOWN':
          currentValue = this.calculateCurrentDrawdown();
          break;
      }
      
      // Check if limit is exceeded
      if (currentValue >= limitValue) {
        this.dailyLossLimitBreached = true;
        return {
          allowed: false,
          reason: `${limit.type.toLowerCase()} loss limit exceeded (${currentValue.toFixed(2)} >= ${limitValue.toFixed(2)})`,
          warnings
        };
      }
      
      // Check warning threshold
      const warningLevel = limitValue * (limit.warningThreshold / 100);
      if (currentValue >= warningLevel) {
        const warningKey = `${limitId}_warning`;
        if (!this.warningsIssued.has(warningKey)) {
          warnings.push(`Approaching ${limit.type.toLowerCase()} loss limit: ${currentValue.toFixed(2)} / ${limitValue.toFixed(2)} (${((currentValue/limitValue)*100).toFixed(1)}%)`);
          this.warningsIssued.add(warningKey);
        }
        
        // Auto-reduce positions if enabled
        if (limit.autoReduction && currentValue >= warningLevel * 1.1) { // 10% above warning
          this.triggerAutoPositionReduction();
        }
      }
    }
    
    return { allowed: true, warnings };
  }

  /**
   * Calculate current portfolio drawdown
   */
  private calculateCurrentDrawdown(): number {
    const currentBalance = this.portfolio.totalBalance;
    const peakBalance = Math.max(this.dailyStartBalance, currentBalance);
    return ((peakBalance - currentBalance) / peakBalance) * 100;
  }

  /**
   * Update performance metrics after closing a position
   */
  private updatePerformanceMetrics(closedPosition: TradePosition): void {
    const metrics = this.performanceMetrics;
    
    metrics.totalTrades++;
    
    if (closedPosition.pnl > 0) {
      metrics.winningTrades++;
      if (metrics.currentStreak >= 0) {
        metrics.currentStreak++;
      } else {
        metrics.currentStreak = 1;
      }
    } else {
      metrics.losingTrades++;
      if (metrics.currentStreak <= 0) {
        metrics.currentStreak--;
        metrics.maxConsecutiveLosses = Math.max(metrics.maxConsecutiveLosses, Math.abs(metrics.currentStreak));
      } else {
        metrics.currentStreak = -1;
      }
    }
    
    // Update averages
    const totalWins = metrics.winningTrades;
    const totalLosses = metrics.losingTrades;
    
    if (totalWins > 0) {
      const winningTrades = this.tradeHistory.filter(t => t.pnl > 0);
      metrics.avgWin = winningTrades.reduce((sum, t) => sum + t.pnl, 0) / winningTrades.length;
    }
    
    if (totalLosses > 0) {
      const losingTrades = this.tradeHistory.filter(t => t.pnl < 0);
      metrics.avgLoss = losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losingTrades.length;
    }
    
    metrics.avgReturn = this.tradeHistory.reduce((sum, t) => sum + t.pnl, 0) / this.tradeHistory.length;
    
    // Calculate recent performance (last 20 trades)
    const recentTrades = this.tradeHistory.slice(-20);
    if (recentTrades.length > 0) {
      const recentWins = recentTrades.filter(t => t.pnl > 0).length;
      metrics.recentWinRate = (recentWins / recentTrades.length) * 100;
      metrics.recentAvgReturn = recentTrades.reduce((sum, t) => sum + t.pnl, 0) / recentTrades.length;
    }
    
    metrics.lastUpdateTime = Date.now();
  }

  /**
   * Trigger automatic position reduction
   */
  private triggerAutoPositionReduction(): void {
    const positions = this.portfolio.openPositions;
    if (positions.length === 0) return;
    
    // Reduce position sizing for new trades by 50%
    this.positionSizingParams.baseRiskPercent *= 0.5;
    
    logger.warn(`Auto position reduction triggered. Reduced base risk to ${this.positionSizingParams.baseRiskPercent.toFixed(2)}%.`);
  }

  /**
   * Configure position sizing parameters
   */
  setPositionSizingParameters(params: Partial<PositionSizingParams>): void {
    this.positionSizingParams = { ...this.positionSizingParams, ...params };
  }

  /**
   * Configure loss limits
   */
  setLossLimits(limits: { [key: string]: Partial<LossLimit> }): void {
    for (const [limitId, limitUpdate] of Object.entries(limits)) {
      if (this.lossLimits[limitId]) {
        this.lossLimits[limitId] = { ...this.lossLimits[limitId], ...limitUpdate };
      } else {
        this.lossLimits[limitId] = limitUpdate as LossLimit;
      }
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Get position sizing parameters
   */
  getPositionSizingParams(): PositionSizingParams {
    return { ...this.positionSizingParams };
  }

  /**
   * Get loss limits configuration
   */
  getLossLimits(): { [key: string]: LossLimit } {
    return { ...this.lossLimits };
  }

  /**
   * Calculate current portfolio risk exposure
   */
  private calculatePortfolioRiskExposure(): number {
    return this.portfolio.openPositions.reduce((total, position) => {
      return total + Math.abs(position.quantity * position.entryPrice);
    }, 0);
  }

  /**
   * Calculate symbol correlation risk
   */
  private calculateSymbolCorrelationRisk(symbol: string): number {
    // Simplified correlation risk calculation
    // In a full implementation, this would check correlations with existing positions
    const existingSymbols = this.portfolio.openPositions.map(p => p.symbol);
    const uniqueSymbols = Array.from(new Set(existingSymbols));
    
    // Basic risk factor based on number of correlated positions
    const baseRisk = 0.1;
    const correlationFactor = uniqueSymbols.length * 0.05;
    
    return Math.min(baseRisk + correlationFactor, 0.5); // Max 50% additional risk
  }

  /**
   * Update market data for volatility calculations
   */
  private updateMarketData(symbol: string, marketData: MarketData): void {
    // Store market data for volatility calculations
    if (!this.marketData.has(symbol)) {
      this.marketData.set(symbol, []);
    }
    
    const prices = this.marketData.get(symbol)!;
    prices.push(marketData.price);
    
    // Keep only last 100 price points for volatility calculation
    if (prices.length > 100) {
      prices.shift();
    }
  }

  /**
   * Get symbol volatility
   */
  private getSymbolVolatility(symbol: string): number {
    const prices = this.marketData.get(symbol) || [];
    
    if (prices.length < 10) {
      return 0.02; // Default 2% volatility
    }
    
    // Calculate price returns
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    
    // Calculate standard deviation of returns
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  /**
   * Validate risk-reward ratio for a trade
   * Ensures the trade meets the configured 1:2 minimum ratio
   */
  validateRiskRewardRatio(entryPrice: number, stopLossPrice: number, takeProfitPrice: number, side: 'BUY' | 'SELL'): {
    valid: boolean;
    actualRatio: number;
    reason?: string;
  } {
    const riskAmount = side === 'BUY' 
      ? Math.abs(entryPrice - stopLossPrice) 
      : Math.abs(stopLossPrice - entryPrice);
    
    const rewardAmount = side === 'BUY' 
      ? Math.abs(takeProfitPrice - entryPrice) 
      : Math.abs(entryPrice - takeProfitPrice);

    if (riskAmount === 0) {
      return { valid: false, actualRatio: 0, reason: 'Stop-loss distance cannot be zero' };
    }

    const actualRatio = rewardAmount / riskAmount;
    const minimumRatio = 2.0; // 1:2 risk-reward

    if (actualRatio < minimumRatio) {
      return { 
        valid: false, 
        actualRatio, 
        reason: `Risk-reward ratio ${actualRatio.toFixed(2)}:1 is below minimum ${minimumRatio}:1` 
      };
    }

    return { valid: true, actualRatio };
  }

  /**
   * Calculate optimal stop-loss and take-profit levels using 1:2 ratio
   */
  calculateOptimalLevels(entryPrice: number, side: 'BUY' | 'SELL'): {
    stopLoss: number;
    takeProfit: number;
    riskAmount: number;
    rewardAmount: number;
  } {
    const stopLossDistance = entryPrice * config.trading.stopLossPercentage;
    const takeProfitDistance = entryPrice * config.trading.takeProfitPercentage;

    let stopLoss: number;
    let takeProfit: number;

    if (side === 'BUY') {
      stopLoss = entryPrice - stopLossDistance;
      takeProfit = entryPrice + takeProfitDistance;
    } else {
      stopLoss = entryPrice + stopLossDistance;
      takeProfit = entryPrice - takeProfitDistance;
    }

    const riskAmount = Math.abs(entryPrice - stopLoss);
    const rewardAmount = Math.abs(takeProfit - entryPrice);

    return {
      stopLoss: Number(stopLoss.toFixed(8)),
      takeProfit: Number(takeProfit.toFixed(8)),
      riskAmount,
      rewardAmount
    };
  }

  /**
   * Get current risk-reward configuration
   */
  getRiskRewardConfig(): {
    stopLossPercentage: number;
    takeProfitPercentage: number;
    targetRatio: number;
    actualRatio: number;
  } {
    const stopLossPercentage = config.trading.stopLossPercentage;
    const takeProfitPercentage = config.trading.takeProfitPercentage;
    const actualRatio = takeProfitPercentage / stopLossPercentage;

    return {
      stopLossPercentage,
      takeProfitPercentage,
      targetRatio: 2.0, // 1:2 target ratio
      actualRatio: Number(actualRatio.toFixed(2))
    };
  }

  // Add market data storage
  private marketData: Map<string, number[]> = new Map();
}