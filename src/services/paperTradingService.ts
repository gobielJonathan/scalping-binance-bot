import { 
  TradePosition, 
  OrderRequest, 
  MarketData, 
  Portfolio,
  DatabaseTrade
} from '../types';
import { RiskManager } from './riskManager';
import { logger } from './logger';
import { DatabaseService } from '../database/databaseService';
import config from '../config';
import { 
  calculatePnL, 
  generateTradeId,
  calculateStopLoss,
  calculateTakeProfit
} from '../utils/helpers';

interface PaperTradeExecution {
  orderId: string;
  originalQuantity: number;
  executedQuantity: number;
  averagePrice: number;
  slippage: number;
  fees: number;
  executionTime: number;
  marketImpact: number;
}

interface SlippageSettings {
  baseSlippageBps: number; // Base slippage in basis points
  volumeImpactFactor: number; // How volume affects slippage
  volatilityMultiplier: number; // Multiplier based on volatility
  liquidityPenalty: number; // Additional penalty for low liquidity
}

interface VirtualPortfolio extends Portfolio {
  paperTradingStats: {
    totalSimulatedTrades: number;
    totalSimulatedVolume: number;
    averageSlippage: number;
    totalSimulatedFees: number;
    executionAccuracy: number;
    largestOrder: number;
    averageOrderSize: number;
  };
}

interface PaperTradeComparison {
  paperTrade: {
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    fees: number;
    slippage: number;
  };
  liveTradeEstimate: {
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    fees: number;
    slippage: number;
  };
  accuracy: {
    priceDeviation: number;
    pnlDeviation: number;
    feeDeviation: number;
  };
}

interface MarketConditions {
  spread: number;
  spreadPercent: number;
  volume24h: number;
  volatility: number;
  orderBookDepth: number;
  recentPriceMovement: number;
}

export class PaperTradingService {
  private portfolio: VirtualPortfolio;
  private riskManager: RiskManager;
  private dbService: DatabaseService;
  private slippageSettings: SlippageSettings;
  private marketDataHistory: Map<string, MarketData[]> = new Map();
  private executionHistory: PaperTradeExecution[] = [];
  private comparisonData: Map<string, PaperTradeComparison> = new Map();

  constructor(initialBalance: number, riskManager: RiskManager, dbService: DatabaseService) {
    this.riskManager = riskManager;
    this.dbService = dbService;

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
      maxDrawdown: 0,
      paperTradingStats: {
        totalSimulatedTrades: 0,
        totalSimulatedVolume: 0,
        averageSlippage: 0,
        totalSimulatedFees: 0,
        executionAccuracy: 0,
        largestOrder: 0,
        averageOrderSize: 0
      }
    };

    // Realistic slippage settings based on crypto market conditions
    this.slippageSettings = {
      baseSlippageBps: 2, // 0.02% base slippage
      volumeImpactFactor: 0.1,
      volatilityMultiplier: 1.5,
      liquidityPenalty: 0.5
    };

    this.initializeDataTracking();
  }

  /**
   * Initialize data tracking for market conditions
   */
  private initializeDataTracking(): void {
    setInterval(() => {
      this.cleanupOldMarketData();
    }, 60000 * 10); // Clean up every 10 minutes
  }

  /**
   * Update market data for slippage and execution calculations
   */
  updateMarketData(marketData: MarketData): void {
    if (!this.marketDataHistory.has(marketData.symbol)) {
      this.marketDataHistory.set(marketData.symbol, []);
    }

    const history = this.marketDataHistory.get(marketData.symbol)!;
    history.push(marketData);

    // Keep only last 100 data points per symbol
    if (history.length > 100) {
      history.shift();
    }
  }

  /**
   * Calculate realistic market conditions for order execution
   */
  private calculateMarketConditions(symbol: string, marketData: MarketData): MarketConditions {
    const history = this.marketDataHistory.get(symbol) || [];
    
    // Calculate volatility from recent price movements
    let volatility = 0;
    if (history.length > 10) {
      const recentPrices = history.slice(-10).map(d => d.price);
      const returns = recentPrices.slice(1).map((price, i) => 
        Math.log(price / (recentPrices[i] || 1))
      );
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
      volatility = Math.sqrt(variance) * 100; // Convert to percentage
    }

    // Estimate order book depth based on volume
    const orderBookDepth = marketData.volume24h * 0.001; // Rough estimate

    return {
      spread: marketData.ask - marketData.bid,
      spreadPercent: ((marketData.ask - marketData.bid) / marketData.price) * 100,
      volume24h: marketData.volume24h,
      volatility,
      orderBookDepth,
      recentPriceMovement: marketData.priceChangePercent24h
    };
  }

  /**
   * Calculate realistic slippage based on market conditions and order size
   */
  private calculateSlippage(
    orderRequest: OrderRequest, 
    marketData: MarketData, 
    marketConditions: MarketConditions
  ): number {
    const orderValue = orderRequest.quantity * marketData.price;
    
    // Base slippage
    let slippage = this.slippageSettings.baseSlippageBps / 10000;

    // Volume impact - larger orders relative to daily volume get more slippage
    const volumeRatio = orderValue / (marketConditions.volume24h * marketData.price);
    const volumeImpact = volumeRatio * this.slippageSettings.volumeImpactFactor;
    slippage += volumeImpact;

    // Volatility impact - more volatile markets have higher slippage
    const volatilityImpact = (marketConditions.volatility / 100) * this.slippageSettings.volatilityMultiplier / 10000;
    slippage += volatilityImpact;

    // Spread impact - wider spreads increase slippage
    const spreadImpact = marketConditions.spreadPercent / 100;
    slippage += spreadImpact;

    // Liquidity penalty for large orders
    if (volumeRatio > 0.01) { // Order is >1% of daily volume
      slippage += this.slippageSettings.liquidityPenalty / 10000;
    }

    // Market timing impact - orders during high volatility periods get more slippage
    if (Math.abs(marketConditions.recentPriceMovement) > 5) {
      slippage += 0.001; // Additional 0.1% slippage during high movement
    }

    // Cap slippage at reasonable levels (0.5% max for normal conditions)
    return Math.min(slippage, 0.005);
  }

  /**
   * Calculate realistic trading fees including maker/taker differences
   */
  private calculateTradingFees(orderRequest: OrderRequest, executedPrice: number): number {
    const orderValue = orderRequest.quantity * executedPrice;
    
    // Binance fee structure simulation
    let feeRate = 0.001; // 0.1% taker fee (market orders)
    
    // VIP level simulation based on volume
    if (this.portfolio.paperTradingStats.totalSimulatedVolume > 1000000) {
      feeRate = 0.0009; // VIP 1
    }
    if (this.portfolio.paperTradingStats.totalSimulatedVolume > 5000000) {
      feeRate = 0.0008; // VIP 2
    }

    // BNB discount simulation (assume 25% fee reduction if using BNB)
    const bnbDiscount = 0.75;
    feeRate *= bnbDiscount;

    return orderValue * feeRate;
  }

  /**
   * Simulate realistic order execution with partial fills and delays
   */
  private async simulateOrderExecution(
    orderRequest: OrderRequest,
    marketData: MarketData,
    marketConditions: MarketConditions
  ): Promise<PaperTradeExecution> {
    const orderId = generateTradeId();
    const startTime = Date.now();

    // Calculate slippage
    const slippage = this.calculateSlippage(orderRequest, marketData, marketConditions);
    
    // Determine execution price with slippage
    let executionPrice: number;
    if (orderRequest.side === 'BUY') {
      executionPrice = marketData.price * (1 + slippage);
    } else {
      executionPrice = marketData.price * (1 - slippage);
    }

    // Simulate partial fills for large orders
    let executedQuantity = orderRequest.quantity;
    const orderValue = orderRequest.quantity * marketData.price;
    const dailyVolumeValue = marketConditions.volume24h * marketData.price;
    
    // If order is more than 0.5% of daily volume, simulate partial fill
    if (orderValue / dailyVolumeValue > 0.005) {
      executedQuantity = orderRequest.quantity * 0.8; // 80% fill
      logger.warn(`Large order detected: ${orderRequest.symbol}. Simulating partial fill: ${executedQuantity}/${orderRequest.quantity}`);
    }

    // Calculate fees
    const fees = this.calculateTradingFees(orderRequest, executionPrice);

    // Simulate execution delay based on market conditions
    const executionDelay = Math.max(100, marketConditions.volatility * 50); // 100ms to 1s+ delay
    await new Promise(resolve => setTimeout(resolve, executionDelay));

    // Calculate market impact (price movement caused by our order)
    const marketImpact = orderValue / dailyVolumeValue * 0.1; // Simplified market impact

    const execution: PaperTradeExecution = {
      orderId,
      originalQuantity: orderRequest.quantity,
      executedQuantity,
      averagePrice: executionPrice,
      slippage,
      fees,
      executionTime: Date.now() - startTime,
      marketImpact
    };

    this.executionHistory.push(execution);
    this.updateExecutionStats(execution);

    logger.info(`Simulated order execution: ${orderRequest.side} ${executedQuantity} ${orderRequest.symbol} @ ${executionPrice.toFixed(6)}`);

    return execution;
  }

  /**
   * Execute a paper trade with realistic simulation
   */
  async executePaperTrade(orderRequest: OrderRequest, marketData: MarketData): Promise<TradePosition | null> {
    try {
      // Risk management check
      const riskCheck = this.riskManager.canOpenTrade(orderRequest, marketData.price);
      if (!riskCheck.allowed) {
        logger.warn(`Paper trade rejected: ${riskCheck.reason}`, { 
          symbol: orderRequest.symbol,
          mode: 'paper'
        } as any);
        return null;
      }

      // Calculate market conditions
      const marketConditions = this.calculateMarketConditions(orderRequest.symbol, marketData);

      // Simulate execution
      const execution = await this.simulateOrderExecution(orderRequest, marketData, marketConditions);

      // Create position with actual execution data
      const position: TradePosition = {
        id: generateTradeId(),
        symbol: orderRequest.symbol,
        side: orderRequest.side,
        quantity: execution.executedQuantity,
        entryPrice: execution.averagePrice,
        currentPrice: execution.averagePrice,
        stopLoss: calculateStopLoss(execution.averagePrice, config.trading.stopLossPercentage, orderRequest.side),
        takeProfit: calculateTakeProfit(execution.averagePrice, config.trading.takeProfitPercentage, orderRequest.side),
        pnl: 0,
        pnlPercent: 0,
        status: 'OPEN',
        openTime: Date.now(),
        fees: execution.fees
      };

      // Update portfolio
      const positionValue = position.quantity * position.entryPrice;
      this.portfolio.lockedBalance += positionValue;
      this.portfolio.availableBalance -= positionValue;
      this.portfolio.riskExposure += positionValue;
      this.portfolio.openPositions.push(position);

      // Update paper trading stats
      this.portfolio.paperTradingStats.totalSimulatedTrades++;
      this.portfolio.paperTradingStats.totalSimulatedVolume += positionValue;
      this.portfolio.paperTradingStats.totalSimulatedFees += execution.fees;

      if (positionValue > this.portfolio.paperTradingStats.largestOrder) {
        this.portfolio.paperTradingStats.largestOrder = positionValue;
      }

      // Save to database
      await this.savePaperTradeToDatabase(position, execution);

      logger.info(`Paper trade executed: ${position.side} ${position.quantity} ${position.symbol}`);

      return position;

    } catch (error) {
      logger.error('Error executing paper trade:', error);
      return null;
    }
  }

  /**
   * Close a paper trading position with realistic simulation
   */
  async closePaperPosition(positionId: string, marketData: MarketData, reason: string = 'Manual close'): Promise<TradePosition | null> {
    try {
      const positionIndex = this.portfolio.openPositions.findIndex(p => p.id === positionId);
      if (positionIndex === -1) {
        logger.warn(`Paper position ${positionId} not found`);
        return null;
      }

      const position = this.portfolio.openPositions[positionIndex];
      if (!position) {
        logger.warn(`Position ${positionId} is invalid`);
        return null;
      }

      const marketConditions = this.calculateMarketConditions(position.symbol, marketData);

      // Create close order request
      const closeOrderRequest: OrderRequest = {
        symbol: position.symbol,
        side: position.side === 'BUY' ? 'SELL' : 'BUY',
        type: 'MARKET',
        quantity: position.quantity
      };

      // Simulate close execution
      const execution = await this.simulateOrderExecution(closeOrderRequest, marketData, marketConditions);

      // Update position
      position.currentPrice = execution.averagePrice;
      position.status = 'CLOSED';
      position.closeTime = Date.now();
      position.fees += execution.fees;

      // Calculate final P&L
      const pnlData = calculatePnL(
        position.entryPrice,
        execution.averagePrice,
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

      // Remove from open positions
      this.portfolio.openPositions.splice(positionIndex, 1);

      // Update stats
      this.portfolio.paperTradingStats.totalSimulatedFees += execution.fees;

      // Update database
      await this.updatePaperTradeInDatabase(position);

      logger.info(`Paper position closed: ${position.id} - ${reason}`);

      return position;

    } catch (error) {
      logger.error('Error closing paper position:', error);
      return null;
    }
  }

  /**
   * Update execution statistics
   */
  private updateExecutionStats(execution: PaperTradeExecution): void {
    const stats = this.portfolio.paperTradingStats;
    
    // Update average slippage
    const totalSlippage = stats.averageSlippage * (stats.totalSimulatedTrades - 1) + execution.slippage;
    stats.averageSlippage = totalSlippage / stats.totalSimulatedTrades;

    // Update average order size
    const orderValue = execution.executedQuantity * execution.averagePrice;
    const totalOrderValue = stats.averageOrderSize * (stats.totalSimulatedTrades - 1) + orderValue;
    stats.averageOrderSize = totalOrderValue / stats.totalSimulatedTrades;

    // Calculate execution accuracy (how close to market price)
    const expectedVolume = execution.originalQuantity;
    const actualVolume = execution.executedQuantity;
    stats.executionAccuracy = (actualVolume / expectedVolume) * 100;
  }

  /**
   * Compare paper trading results with estimated live trading results
   */
  generateComparisonReport(positionId: string): PaperTradeComparison | null {
    const comparison = this.comparisonData.get(positionId);
    if (!comparison) {
      logger.warn(`No comparison data found for position ${positionId}`);
      return null;
    }

    return comparison;
  }

  /**
   * Get comprehensive portfolio status including paper trading metrics
   */
  getVirtualPortfolio(): VirtualPortfolio {
    // Update real-time P&L calculations
    this.updatePortfolioMetrics();
    return { ...this.portfolio };
  }

  /**
   * Get paper trading performance metrics
   */
  getPaperTradingMetrics(): any {
    const stats = this.portfolio.paperTradingStats;
    const openPositions = this.portfolio.openPositions;

    return {
      totalSimulatedTrades: stats.totalSimulatedTrades,
      totalSimulatedVolume: stats.totalSimulatedVolume,
      averageSlippage: (stats.averageSlippage * 100).toFixed(4) + '%',
      totalSimulatedFees: stats.totalSimulatedFees,
      executionAccuracy: stats.executionAccuracy.toFixed(2) + '%',
      largestOrder: stats.largestOrder,
      averageOrderSize: stats.averageOrderSize,
      currentOpenPositions: openPositions.length,
      totalPnl: this.portfolio.totalPnl,
      dailyPnl: this.portfolio.dailyPnl,
      riskExposure: this.portfolio.riskExposure,
      availableBalance: this.portfolio.availableBalance,
      executionHistory: this.executionHistory.slice(-10), // Last 10 executions
      recentSlippage: this.calculateRecentAverageSlippage()
    };
  }

  /**
   * Calculate recent average slippage
   */
  private calculateRecentAverageSlippage(): number {
    const recent = this.executionHistory.slice(-20); // Last 20 trades
    if (recent.length === 0) return 0;
    
    const totalSlippage = recent.reduce((sum, exec) => sum + exec.slippage, 0);
    return totalSlippage / recent.length;
  }

  /**
   * Save paper trade to database
   */
  private async savePaperTradeToDatabase(position: TradePosition, execution: PaperTradeExecution): Promise<void> {
    const dbTrade: DatabaseTrade = {
      id: position.id,
      symbol: position.symbol,
      side: position.side,
      type: 'MARKET',
      quantity: position.quantity,
      entryPrice: position.entryPrice,
      exitPrice: position.closeTime ? position.currentPrice : undefined,
      stopLoss: position.stopLoss,
      takeProfit: position.takeProfit,
      pnl: position.pnl,
      pnlPercent: position.pnlPercent,
      fees: position.fees,
      status: position.status,
      openTime: position.openTime,
      closeTime: position.closeTime || undefined,
      strategyId: 'paper-trading',
      signalId: undefined,
      mode: 'paper',
      orderId: execution.orderId,
      notes: `Slippage: ${(execution.slippage * 100).toFixed(4)}%, Execution Time: ${execution.executionTime}ms`,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await this.dbService.saveTrade(dbTrade);
  }

  /**
   * Update paper trade in database when closed
   */
  private async updatePaperTradeInDatabase(position: TradePosition): Promise<void> {
    await this.dbService.updateTrade(position.id, {
      exitPrice: position.currentPrice,
      pnl: position.pnl,
      pnlPercent: position.pnlPercent,
      status: position.status,
      closeTime: position.closeTime || Date.now(),
      fees: position.fees,
      updatedAt: Date.now()
    });
  }

  /**
   * Update portfolio metrics
   */
  private updatePortfolioMetrics(): void {
    // Calculate current P&L for open positions
    let unrealizedPnl = 0;
    
    for (const position of this.portfolio.openPositions) {
      const currentPnl = calculatePnL(
        position.entryPrice,
        position.currentPrice,
        position.quantity,
        position.side,
        position.fees
      );
      position.pnl = currentPnl.pnl;
      position.pnlPercent = currentPnl.pnlPercent;
      unrealizedPnl += currentPnl.pnl;
    }

    // Update portfolio totals
    const realizedPnl = this.portfolio.totalPnl;
    const totalCurrentPnl = realizedPnl + unrealizedPnl;
    
    this.portfolio.totalPnlPercent = (totalCurrentPnl / config.trading.initialCapital) * 100;
    this.portfolio.dailyPnlPercent = (this.portfolio.dailyPnl / config.trading.initialCapital) * 100;

    // Update max drawdown
    if (totalCurrentPnl < this.portfolio.maxDrawdown) {
      this.portfolio.maxDrawdown = totalCurrentPnl;
    }
  }

  /**
   * Clean up old market data to prevent memory leaks
   */
  private cleanupOldMarketData(): void {
    const maxAge = 60 * 60 * 1000; // 1 hour
    const cutoff = Date.now() - maxAge;

    for (const [symbol, history] of this.marketDataHistory.entries()) {
      const filtered = history.filter(data => data.timestamp > cutoff);
      this.marketDataHistory.set(symbol, filtered);
    }

    // Clean up old execution history (keep last 1000)
    if (this.executionHistory.length > 1000) {
      this.executionHistory = this.executionHistory.slice(-1000);
    }
  }

  /**
   * Reset paper trading statistics (for new trading session)
   */
  resetPaperTradingStats(): void {
    this.portfolio.paperTradingStats = {
      totalSimulatedTrades: 0,
      totalSimulatedVolume: 0,
      averageSlippage: 0,
      totalSimulatedFees: 0,
      executionAccuracy: 0,
      largestOrder: 0,
      averageOrderSize: 0
    };

    this.executionHistory = [];
    this.comparisonData.clear();
    this.marketDataHistory.clear();

    logger.info('Paper trading statistics reset');
  }

  /**
   * Export paper trading data for analysis
   */
  exportPaperTradingData(): any {
    return {
      portfolio: this.portfolio,
      executionHistory: this.executionHistory,
      marketDataHistory: Object.fromEntries(this.marketDataHistory),
      slippageSettings: this.slippageSettings,
      timestamp: Date.now()
    };
  }
}