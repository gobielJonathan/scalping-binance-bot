import { 
  Candle, 
  TradePosition, 
  TradingSignal, 
  MarketData,
  OrderRequest 
} from '../types';
import { ScalpingStrategy } from '../strategies/scalpingStrategy';
import { RiskManager } from './riskManager';
import logger from './logger';
import { calculatePnL, generateTradeId } from '../utils/helpers';
import { OrderType } from 'binance-api-node';

export interface BacktestConfig {
  symbol: string;
  startDate: number;
  endDate: number;
  initialBalance: number;
  timeframe: '1m' | '5m' | '15m' | '1h';
  commissionRate: number; // 0.001 = 0.1%
  slippageRate: number; // 0.0005 = 0.05%
  latencyMs: number; // Simulated execution latency
  enableRiskManagement: boolean;
}

export interface BacktestMetrics {
  totalReturn: number;
  totalReturnPercent: number;
  annualizedReturn: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  sortinioRatio: number;
  calmarRatio: number;
  winRate: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  avgTradeDuration: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  largestWin: number;
  largestLoss: number;
  consecutiveWins: number;
  consecutiveLosses: number;
  expectancy: number;
  systemQuality: number;
}

export interface PerformanceReport {
  config: BacktestConfig;
  metrics: BacktestMetrics;
  trades: TradePosition[];
  equity: Array<{ timestamp: number; balance: number; drawdown: number }>;
  monthlyReturns: Array<{ month: string; return: number; trades: number }>;
  riskMetrics: {
    var95: number; // Value at Risk (95% confidence)
    var99: number; // Value at Risk (99% confidence)
    volatility: number;
    beta: number;
  };
  summary: {
    startDate: string;
    endDate: string;
    duration: string;
    finalBalance: number;
    peakBalance: number;
  };
}

/**
 * Comprehensive backtesting engine for crypto trading strategies
 */
export class BacktestingEngine {
  private strategy: ScalpingStrategy;
  private riskManager: RiskManager | null = null;
  private config: BacktestConfig;
  private currentBalance: number;
  private peakBalance: number;
  private trades: TradePosition[] = [];
  private openPositions: Map<string, TradePosition> = new Map();
  private equityHistory: Array<{ timestamp: number; balance: number; drawdown: number }> = [];
  private signalHistory: TradingSignal[] = [];

  constructor(config: BacktestConfig) {
    this.config = config;
    this.strategy = new ScalpingStrategy();
    this.currentBalance = config.initialBalance;
    this.peakBalance = config.initialBalance;
    
    if (config.enableRiskManagement) {
      this.riskManager = new RiskManager(config.initialBalance);
    }

    logger.info('BacktestingEngine initialized', {
      source: 'BacktestingEngine',
      context: { 
        symbol: config.symbol,
        timeframe: config.timeframe,
        initialBalance: config.initialBalance
      }
    });
  }

  /**
   * Run backtest on historical data
   */
  async runBacktest(historicalData: Candle[]): Promise<PerformanceReport> {
    logger.info('Starting backtest', {
      source: 'BacktestingEngine',
      context: {
        dataPoints: historicalData.length,
        startDate: new Date(this.config.startDate).toISOString(),
        endDate: new Date(this.config.endDate).toISOString()
      }
    });

    const filteredData = this.filterDataByDateRange(historicalData);
    
    if (filteredData.length < 50) {
      throw new Error('Insufficient historical data for backtesting');
    }

    // Reset state
    this.resetBacktest();

    // Process each candle
    for (let i = 50; i < filteredData.length; i++) {
      const currentCandle = filteredData[i];
      const historicalCandles = filteredData.slice(0, i + 1);
      
      await this.processCandle(currentCandle, historicalCandles);
    }

    // Close any remaining open positions
    this.closeAllPositions(filteredData[filteredData.length - 1].close);

    // Generate performance report
    const report = this.generatePerformanceReport();
    
    logger.info('Backtest completed', {
      source: 'BacktestingEngine',
      context: {
        totalTrades: this.trades.length,
        finalBalance: this.currentBalance,
        totalReturn: report.metrics.totalReturnPercent
      }
    });

    return report;
  }

  /**
   * Process a single candle for signals and trade execution
   */
  private async processCandle(currentCandle: Candle, historicalCandles: Candle[]): Promise<void> {
    const marketData: MarketData = {
      symbol: this.config.symbol,
      price: currentCandle.close,
      volume24h: currentCandle.volume,
      priceChange24h: currentCandle.close - historicalCandles[historicalCandles.length - 24]?.close || 0,
      priceChangePercent24h: 0, // Will be calculated
      bid: currentCandle.close * (1 - this.config.slippageRate),
      ask: currentCandle.close * (1 + this.config.slippageRate),
      spread: currentCandle.close * this.config.slippageRate * 2,
      timestamp: currentCandle.closeTime
    };

    // Calculate 24h price change percent
    if (historicalCandles.length >= 24) {
      const price24hAgo = historicalCandles[historicalCandles.length - 24]?.close;
      if (price24hAgo) {
        marketData.priceChangePercent24h = ((currentCandle.close - price24hAgo) / price24hAgo) * 100;
      }
    }

    // Update open positions with current price
    this.updateOpenPositions(currentCandle.close, currentCandle.closeTime);

    // Check for stop loss and take profit triggers
    this.checkStopLossAndTakeProfit(currentCandle.close, currentCandle.closeTime);

    // Generate trading signal
    const signal = this.strategy.generateSignal(historicalCandles, marketData);
    this.signalHistory.push(signal);

    // Process signal if it's not HOLD
    if (signal.type !== 'HOLD') {
      await this.processSignal(signal, currentCandle.close, currentCandle.closeTime);
    }

    // Record equity history
    this.recordEquitySnapshot(currentCandle.closeTime);
  }

  /**
   * Process a trading signal
   */
  private async processSignal(signal: TradingSignal, price: number, timestamp: number): Promise<void> {
    // Simulate latency
    await this.simulateLatency();

    // Apply slippage to execution price
    const executionPrice = this.applySlippage(price, signal.type as 'BUY' | 'SELL');

    if (signal.type === 'BUY' && this.openPositions.size === 0) {
      await this.executeBuyOrder(signal, executionPrice, timestamp);
    } else if (signal.type === 'SELL' && this.openPositions.size > 0) {
      await this.executeSellOrders(signal, executionPrice, timestamp);
    }
  }

  /**
   * Execute a buy order
   */
  private async executeBuyOrder(signal: TradingSignal, price: number, timestamp: number): Promise<void> {
    // Calculate position size
    const positionSize = this.calculatePositionSize(price, signal.confidence);
    const positionValue = positionSize * price;

    // Check if we have enough balance
    if (positionValue > this.currentBalance * 0.95) { // Leave 5% buffer
      logger.debug('Insufficient balance for trade', {
        source: 'BacktestingEngine',
        context: { 
          requiredBalance: positionValue,
          availableBalance: this.currentBalance
        }
      });
      return;
    }

    // Risk management check
    if (this.riskManager) {
      const orderRequest: OrderRequest = {
        symbol: this.config.symbol,
        side: 'BUY',
        type: OrderType.MARKET, // Default to market, risk manager may adjust
        quantity: positionSize,
        price
      };

      const riskCheck = this.riskManager.canOpenTrade(orderRequest, price);
      if (!riskCheck.allowed) {
        logger.debug('Trade rejected by risk management', {
          source: 'BacktestingEngine',
          context: { reason: riskCheck.reason }
        });
        return;
      }
    }

    // Calculate stop loss and take profit
    const stopLoss = price * (1 - this.config.commissionRate * 10); // Dynamic stop loss
    const takeProfit = price * (1 + this.config.commissionRate * 15); // Dynamic take profit

    // Create position
    const position: TradePosition = {
      id: generateTradeId(),
      symbol: this.config.symbol,
      side: 'BUY',
      quantity: positionSize,
      entryPrice: price,
      currentPrice: price,
      stopLoss,
      takeProfit,
      pnl: 0,
      pnlPercent: 0,
      status: 'OPEN',
      openTime: timestamp,
      fees: positionValue * this.config.commissionRate,
      marginMode: 'isolated_margin',
      leverage: 1,
      liquidationPrice: 0,
      borrowedAmount: 0
    };

    // Update balance for fees
    this.currentBalance -= position.fees;

    // Track the position
    this.openPositions.set(position.id, position);

    // Update risk manager if enabled
    if (this.riskManager) {
      this.riskManager.addPosition(position);
    }

    logger.debug('Buy order executed', {
      source: 'BacktestingEngine',
      context: {
        positionId: position.id,
        price,
        quantity: positionSize,
        fees: position.fees
      }
    });
  }

  /**
   * Execute sell orders for open positions
   */
  private async executeSellOrders(_signal: TradingSignal, price: number, timestamp: number): Promise<void> {
    const positionsToClose = Array.from(this.openPositions.values());

    for (const position of positionsToClose) {
      await this.closePosition(position.id, price, timestamp, 'SIGNAL');
    }
  }

  /**
   * Close a specific position
   */
  private async closePosition(
    positionId: string, 
    exitPrice: number, 
    _timestamp: number, 
    closeReason: string
  ): Promise<void> {
    const position = this.openPositions.get(positionId);
    if (!position) return;

    // Apply slippage and fees
    const actualExitPrice = this.applySlippage(exitPrice, 'SELL');
    const exitFees = position.quantity * actualExitPrice * this.config.commissionRate;

    // Calculate P&L
    const pnlData = calculatePnL(
      position.entryPrice,
      actualExitPrice,
      position.quantity,
      position.side,
      position.fees + exitFees
    );

    // Update position
    position.currentPrice = actualExitPrice;
    position.pnl = pnlData.pnl;
    position.pnlPercent = pnlData.pnlPercent;
    position.status = 'CLOSED';
    position.closeTime = _timestamp;
    position.fees += exitFees;

    // Update balance
    this.currentBalance += position.quantity * actualExitPrice + position.pnl;

    // Update peak balance for drawdown calculation
    if (this.currentBalance > this.peakBalance) {
      this.peakBalance = this.currentBalance;
    }

    // Move to completed trades
    this.trades.push(position);
    this.openPositions.delete(positionId);

    // Update risk manager
    if (this.riskManager) {
      this.riskManager.closePosition(positionId, actualExitPrice, exitFees);
    }

    logger.debug('Position closed', {
      source: 'BacktestingEngine',
      context: {
        positionId,
        reason: closeReason,
        exitPrice: actualExitPrice,
        pnl: position.pnl,
        pnlPercent: position.pnlPercent
      }
    });
  }

  /**
   * Update open positions with current market price
   */
  private updateOpenPositions(currentPrice: number, timestamp: number): void {
    for (const position of this.openPositions.values()) {
      position.currentPrice = currentPrice;
      
      const pnlData = calculatePnL(
        position.entryPrice,
        currentPrice,
        position.quantity,
        position.side,
        position.fees
      );
      
      position.pnl = pnlData.pnl;
      position.pnlPercent = pnlData.pnlPercent;

      // Update risk manager
      if (this.riskManager) {
        this.riskManager.updatePosition(position.id, currentPrice);
      }
    }
  }

  /**
   * Check for stop loss and take profit triggers
   */
  private checkStopLossAndTakeProfit(currentPrice: number, timestamp: number): void {
    const positionsToClose: Array<{ id: string; reason: string }> = [];

    for (const position of this.openPositions.values()) {
      let shouldClose = false;
      let reason = '';

      // Check stop loss
      if (this.riskManager?.shouldTriggerStopLoss(position.id, currentPrice)) {
        shouldClose = true;
        reason = 'STOP_LOSS';
      }
      // Check take profit
      else if (this.riskManager?.shouldTriggerTakeProfit(position.id, currentPrice)) {
        shouldClose = true;
        reason = 'TAKE_PROFIT';
      }
      // Manual stop loss check if no risk manager
      else if (!this.riskManager) {
        if (position.side === 'BUY' && currentPrice <= position.stopLoss) {
          shouldClose = true;
          reason = 'STOP_LOSS';
        } else if (position.side === 'BUY' && currentPrice >= position.takeProfit) {
          shouldClose = true;
          reason = 'TAKE_PROFIT';
        }
      }

      if (shouldClose) {
        positionsToClose.push({ id: position.id, reason });
      }
    }

    // Close triggered positions
    for (const closeInfo of positionsToClose) {
      this.closePosition(closeInfo.id, currentPrice, timestamp, closeInfo.reason);
    }
  }

  /**
   * Calculate position size based on confidence and risk management
   */
  private calculatePositionSize(price: number, confidence: number): number {
    const basePositionValue = this.currentBalance * 0.1; // Base 10% of balance
    const confidenceMultiplier = confidence / 100; // 0-1 based on signal confidence
    const adjustedPositionValue = basePositionValue * confidenceMultiplier;
    
    return Math.floor((adjustedPositionValue / price) * 100) / 100; // Round to 2 decimals
  }

  /**
   * Apply slippage to execution price
   */
  private applySlippage(price: number, side: 'BUY' | 'SELL'): number {
    const slippageMultiplier = side === 'BUY' ? (1 + this.config.slippageRate) : (1 - this.config.slippageRate);
    return price * slippageMultiplier;
  }

  /**
   * Simulate execution latency
   */
  private async simulateLatency(): Promise<void> {
    if (this.config.latencyMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.config.latencyMs));
    }
  }

  /**
   * Filter historical data by date range
   */
  private filterDataByDateRange(data: Candle[]): Candle[] {
    return data.filter(candle => 
      candle.closeTime >= this.config.startDate && 
      candle.closeTime <= this.config.endDate
    );
  }

  /**
   * Close all open positions at the end of backtest
   */
  private closeAllPositions(finalPrice: number): void {
    const positionIds = Array.from(this.openPositions.keys());
    const finalTimestamp = this.config.endDate;

    for (const positionId of positionIds) {
      this.closePosition(positionId, finalPrice, finalTimestamp, 'BACKTEST_END');
    }
  }

  /**
   * Record equity snapshot for equity curve
   */
  private recordEquitySnapshot(timestamp: number): void {
    let totalValue = this.currentBalance;

    // Add unrealized P&L from open positions
    for (const position of this.openPositions.values()) {
      totalValue += position.pnl;
    }

    const drawdown = ((this.peakBalance - totalValue) / this.peakBalance) * 100;

    this.equityHistory.push({
      timestamp,
      balance: totalValue,
      drawdown: Math.max(0, drawdown)
    });
  }

  /**
   * Reset backtest state
   */
  private resetBacktest(): void {
    this.currentBalance = this.config.initialBalance;
    this.peakBalance = this.config.initialBalance;
    this.trades = [];
    this.openPositions.clear();
    this.equityHistory = [];
    this.signalHistory = [];
    
    if (this.riskManager) {
      this.riskManager = new RiskManager(this.config.initialBalance);
    }
  }

  /**
   * Generate comprehensive performance report
   */
  private generatePerformanceReport(): PerformanceReport {
    const metrics = this.calculateMetrics();
    const riskMetrics = this.calculateRiskMetrics();
    const monthlyReturns = this.calculateMonthlyReturns();

    return {
      config: this.config,
      metrics,
      trades: this.trades,
      equity: this.equityHistory,
      monthlyReturns,
      riskMetrics,
      summary: {
        startDate: new Date(this.config.startDate).toISOString(),
        endDate: new Date(this.config.endDate).toISOString(),
        duration: this.formatDuration(this.config.endDate - this.config.startDate),
        finalBalance: this.currentBalance,
        peakBalance: this.peakBalance
      }
    };
  }

  /**
   * Calculate comprehensive trading metrics
   */
  private calculateMetrics(): BacktestMetrics {
    const totalTrades = this.trades.length;
    if (totalTrades === 0) {
      throw new Error('No trades executed during backtest period');
    }

    const winningTrades = this.trades.filter(t => t.pnl > 0);
    const losingTrades = this.trades.filter(t => t.pnl < 0);
    const wins = winningTrades.length;
    const losses = losingTrades.length;

    const totalReturn = this.currentBalance - this.config.initialBalance;
    const totalReturnPercent = (totalReturn / this.config.initialBalance) * 100;

    // Calculate time-related metrics
    const durationDays = (this.config.endDate - this.config.startDate) / (1000 * 60 * 60 * 24);
    const annualizedReturn = (Math.pow(this.currentBalance / this.config.initialBalance, 365 / durationDays) - 1) * 100;

    // Calculate drawdown metrics
    let maxDrawdown = 0;
    let maxDrawdownPercent = 0;
    for (const equity of this.equityHistory) {
      maxDrawdown = Math.max(maxDrawdown, this.peakBalance - equity.balance);
      maxDrawdownPercent = Math.max(maxDrawdownPercent, equity.drawdown);
    }

    // Calculate win/loss metrics
    const avgWin = wins > 0 ? winningTrades.reduce((sum, t) => sum + t.pnl, 0) / wins : 0;
    const avgLoss = losses > 0 ? Math.abs(losingTrades.reduce((sum, t) => sum + t.pnl, 0) / losses) : 0;
    const winRate = (wins / totalTrades) * 100;
    const profitFactor = avgLoss > 0 ? (avgWin * wins) / (avgLoss * losses) : 0;

    // Calculate Sharpe ratio
    const returns = this.calculatePeriodReturns();
    const avgReturn = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const returnStdDev = Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length);
    const sharpeRatio = returnStdDev > 0 ? (avgReturn / returnStdDev) * Math.sqrt(252) : 0;

    // Calculate Sortino ratio (only negative returns in denominator)
    const negativeReturns = returns.filter(r => r < 0);
    const downStdDev = negativeReturns.length > 0 ? 
      Math.sqrt(negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) / negativeReturns.length) : 0;
    const sortinioRatio = downStdDev > 0 ? (avgReturn / downStdDev) * Math.sqrt(252) : 0;

    // Calculate Calmar ratio
    const calmarRatio = maxDrawdownPercent > 0 ? annualizedReturn / maxDrawdownPercent : 0;

    // Additional metrics
    const avgTradeDuration = this.calculateAvgTradeDuration();
    const largestWin = wins > 0 ? Math.max(...winningTrades.map(t => t.pnl)) : 0;
    const largestLoss = losses > 0 ? Math.min(...losingTrades.map(t => t.pnl)) : 0;
    const expectancy = (winRate / 100) * avgWin - ((100 - winRate) / 100) * avgLoss;
    
    // Consecutive wins/losses
    const { consecutiveWins, consecutiveLosses } = this.calculateConsecutiveWinsLosses();
    
    // System Quality Number (simplified)
    const systemQuality = this.calculateSystemQuality(returns, avgReturn, returnStdDev);

    return {
      totalReturn,
      totalReturnPercent,
      annualizedReturn,
      maxDrawdown,
      maxDrawdownPercent,
      sharpeRatio,
      sortinioRatio,
      calmarRatio,
      winRate,
      profitFactor,
      avgWin,
      avgLoss,
      avgTradeDuration,
      totalTrades,
      winningTrades: wins,
      losingTrades: losses,
      largestWin,
      largestLoss,
      consecutiveWins,
      consecutiveLosses,
      expectancy,
      systemQuality
    };
  }

  /**
   * Calculate risk metrics
   */
  private calculateRiskMetrics() {
    const returns = this.calculatePeriodReturns();
    returns.sort((a, b) => a - b);

    const var95Index = Math.floor(returns.length * 0.05);
    const var99Index = Math.floor(returns.length * 0.01);

    return {
      var95: returns[var95Index] || 0,
      var99: returns[var99Index] || 0,
      volatility: this.calculateVolatility(returns),
      beta: 0 // Would need market benchmark to calculate
    };
  }

  /**
   * Calculate monthly returns
   */
  private calculateMonthlyReturns() {
    const monthlyData = new Map<string, { startBalance: number; endBalance: number; trades: number }>();
    
    let currentBalance = this.config.initialBalance;
    
    for (const trade of this.trades) {
      if (!trade.closeTime) continue;
      
      const month = new Date(trade.closeTime).toISOString().slice(0, 7); // YYYY-MM
      
      if (!monthlyData.has(month)) {
        monthlyData.set(month, { startBalance: currentBalance, endBalance: currentBalance, trades: 0 });
      }
      
      const monthData = monthlyData.get(month)!;
      monthData.endBalance += trade.pnl;
      monthData.trades += 1;
      currentBalance += trade.pnl;
    }

    return Array.from(monthlyData.entries()).map(([month, data]) => ({
      month,
      return: ((data.endBalance - data.startBalance) / data.startBalance) * 100,
      trades: data.trades
    }));
  }

  /**
   * Calculate period returns for statistical analysis
   */
  private calculatePeriodReturns(): number[] {
    const returns: number[] = [];
    
    for (let i = 1; i < this.equityHistory.length; i++) {
      const currentBalance = this.equityHistory[i].balance;
      const previousBalance = this.equityHistory[i - 1].balance;
      const returnPct = ((currentBalance - previousBalance) / previousBalance);
      returns.push(returnPct);
    }

    return returns;
  }

  /**
   * Calculate average trade duration in hours
   */
  private calculateAvgTradeDuration(): number {
    const completedTrades = this.trades.filter(t => t.closeTime);
    if (completedTrades.length === 0) return 0;

    const totalDuration = completedTrades.reduce((sum, trade) => {
      return sum + ((trade.closeTime! - trade.openTime) / (1000 * 60 * 60)); // Convert to hours
    }, 0);

    return totalDuration / completedTrades.length;
  }

  /**
   * Calculate consecutive wins and losses
   */
  private calculateConsecutiveWinsLosses() {
    let consecutiveWins = 0;
    let consecutiveLosses = 0;
    let currentWinStreak = 0;
    let currentLossStreak = 0;

    for (const trade of this.trades) {
      if (trade.pnl > 0) {
        currentWinStreak++;
        currentLossStreak = 0;
        consecutiveWins = Math.max(consecutiveWins, currentWinStreak);
      } else {
        currentLossStreak++;
        currentWinStreak = 0;
        consecutiveLosses = Math.max(consecutiveLosses, currentLossStreak);
      }
    }

    return { consecutiveWins, consecutiveLosses };
  }

  /**
   * Calculate volatility
   */
  private calculateVolatility(returns: number[]): number {
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance) * Math.sqrt(252); // Annualized
  }

  /**
   * Calculate System Quality Number
   */
  private calculateSystemQuality(returns: number[], avgReturn: number, stdDev: number): number {
    if (stdDev === 0 || returns.length === 0) return 0;
    
    const sqn = Math.sqrt(returns.length) * (avgReturn / stdDev);
    return sqn;
  }

  /**
   * Format duration string
   */
  private formatDuration(ms: number): string {
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${days}d ${hours}h`;
  }
}