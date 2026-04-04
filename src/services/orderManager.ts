import { OrderRequest, TradePosition, MarketData, TradingSignal } from '../types';
import { RiskManager } from './riskManager';
import { PaperTradingService } from './paperTradingService';
import { DatabaseService } from '../database/databaseService';
import { calculateStopLoss, calculateTakeProfit, generateTradeId } from '../utils/helpers';
import { logger } from './logger';
import config from '../config';

/**
 * Order management service for handling trade execution
 */
export class OrderManager {
  private riskManager: RiskManager;
  private paperTradingService: PaperTradingService | null = null;
  private paperTradingMode: boolean;
  private binanceService: any; // Will be injected when available
  private dbService: DatabaseService | null = null;

  constructor(riskManager: RiskManager) {
    this.riskManager = riskManager;
    this.paperTradingMode = config.trading.mode === 'paper';
  }

  /**
   * Set the Binance service (dependency injection)
   */
  setBinanceService(binanceService: any): void {
    this.binanceService = binanceService;
  }

  /**
   * Set the database service (dependency injection)
   */
  setDatabaseService(dbService: DatabaseService): void {
    this.dbService = dbService;
    
    // Initialize paper trading service if in paper mode
    if (this.paperTradingMode && !this.paperTradingService && this.dbService) {
      this.paperTradingService = new PaperTradingService(
        config.trading.initialCapital,
        this.riskManager,
        this.dbService
      );
      logger.info('Enhanced paper trading service initialized');
    }
  }

  /**
   * Update market data for paper trading simulation
   */
  updateMarketData(marketData: MarketData): void {
    if (this.paperTradingService) {
      this.paperTradingService.updateMarketData(marketData);
    }
  }

  /**
   * Execute a trading order with enhanced risk management
   */
  async executeOrder(orderRequest: OrderRequest, marketData: MarketData, signal?: TradingSignal): Promise<TradePosition | null> {
    try {
      // Enhanced risk management check with signal data
      const riskCheck = this.riskManager.canOpenTrade(orderRequest, marketData.price, signal, marketData);
      if (!riskCheck.allowed) {
        console.log(`Order rejected: ${riskCheck.reason}`);
        if (riskCheck.maxQuantity) {
          console.log(`Maximum allowed quantity: ${riskCheck.maxQuantity}`);
        }
        if (riskCheck.suggestedQuantity) {
          console.log(`Suggested optimal quantity: ${riskCheck.suggestedQuantity}`);
        }
        if (riskCheck.warnings) {
          riskCheck.warnings.forEach(warning => console.warn(`Warning: ${warning}`));
        }
        return null;
      }

      // Use suggested quantity if available and reasonable
      const finalQuantity = riskCheck.suggestedQuantity && 
        riskCheck.suggestedQuantity < orderRequest.quantity * 1.2 && 
        riskCheck.suggestedQuantity > orderRequest.quantity * 0.8
        ? riskCheck.suggestedQuantity 
        : orderRequest.quantity;

      // Create position object
      const position: TradePosition = {
        id: generateTradeId(),
        symbol: orderRequest.symbol,
        side: orderRequest.side,
        quantity: finalQuantity,
        entryPrice: marketData.price,
        currentPrice: marketData.price,
        stopLoss: calculateStopLoss(marketData.price, config.trading.stopLossPercentage, orderRequest.side),
        takeProfit: calculateTakeProfit(marketData.price, config.trading.takeProfitPercentage, orderRequest.side),
        pnl: 0,
        pnlPercent: 0,
        status: 'OPEN',
        openTime: Date.now(),
        fees: 0
      };

      if (this.paperTradingMode) {
        // Enhanced paper trading execution with realistic simulation
        if (this.paperTradingService) {
          const paperPosition = await this.paperTradingService.executePaperTrade(orderRequest, marketData);
          if (paperPosition) {
            // Add to risk manager for monitoring
            this.riskManager.addPosition(paperPosition);
            return paperPosition;
          }
          return null;
        } else {
          // Fallback to basic paper trading if service not available
          console.warn('PaperTradingService not available, using basic simulation');
          console.log(`[PAPER TRADE] ${orderRequest.side} ${orderRequest.quantity} ${orderRequest.symbol} @ $${marketData.price}`);
          
          // Simulate trading fees (0.1% for Binance)
          const tradingFee = position.quantity * position.entryPrice * 0.001;
          position.fees = tradingFee;
          
          // Add to risk manager
          this.riskManager.addPosition(position);
          
          return position;
        }
      } else {
        // Live trading execution
        if (!this.binanceService) {
          throw new Error('Binance service not available for live trading');
        }

        console.log(`[LIVE TRADE] Executing ${orderRequest.side} ${finalQuantity} ${orderRequest.symbol}`);
        
        // Log risk warnings if any
        if (riskCheck.warnings) {
          riskCheck.warnings.forEach(warning => console.warn(`Risk Warning: ${warning}`));
        }
        
        // Execute the order on Binance
        const binanceOrder = await this.binanceService.placeOrder({
          symbol: orderRequest.symbol,
          side: orderRequest.side,
          type: 'MARKET',
          quantity: finalQuantity
        });

        // Update position with actual execution data
        position.entryPrice = binanceOrder.price || marketData.price;
        position.fees = binanceOrder.commission || 0;
        
        // Add to risk manager
        this.riskManager.addPosition(position);

        // Place stop loss order
        await this.placeStopLossOrder(position);

        return position;
      }
    } catch (error) {
      console.error('Error executing order:', error);
      return null;
    }
  }

  /**
   * Close a position
   */
  async closePosition(positionId: string, reason: string = 'Manual close'): Promise<TradePosition | null> {
    try {
      const portfolio = this.riskManager.getPortfolio();
      const position = portfolio.openPositions.find(p => p.id === positionId);
      
      if (!position) {
        console.log(`Position ${positionId} not found`);
        return null;
      }

      const currentPrice = position.currentPrice; // This should be updated from market data

      if (this.paperTradingMode) {
        // Enhanced paper trading close with realistic simulation
        if (this.paperTradingService) {
          // Get current market data for the symbol
          const symbolMarketData: MarketData = {
            symbol: position.symbol,
            price: currentPrice,
            volume24h: 1000000, // Default value - should be updated from live data
            priceChange24h: 0,
            priceChangePercent24h: 0,
            bid: currentPrice * 0.999,
            ask: currentPrice * 1.001,
            spread: currentPrice * 0.002,
            timestamp: Date.now()
          };

          const closedPosition = await this.paperTradingService.closePaperPosition(positionId, symbolMarketData, reason);
          if (closedPosition) {
            // Remove from risk manager
            this.riskManager.closePosition(positionId, currentPrice, 0); // Fees already handled in paper service
            return closedPosition;
          }
          return null;
        } else {
          // Fallback to basic paper trading
          console.warn('PaperTradingService not available, using basic simulation');
          console.log(`[PAPER TRADE] Closing position ${positionId}: ${reason}`);
          
          // Simulate additional trading fee for closing
          const closeFee = position.quantity * currentPrice * 0.001;
          
          const closedPosition = this.riskManager.closePosition(positionId, currentPrice, closeFee);
          
          if (closedPosition) {
            console.log(`Position closed with P&L: $${closedPosition.pnl.toFixed(2)} (${closedPosition.pnlPercent.toFixed(2)}%)`);
          }
          
          return closedPosition;
        }
      } else {
        // Live trading close
        if (!this.binanceService) {
          throw new Error('Binance service not available for live trading');
        }

        console.log(`[LIVE TRADE] Closing position ${positionId}: ${reason}`);
        
        // Determine the opposite side for closing
        const closeSide = position.side === 'BUY' ? 'SELL' : 'BUY';
        
        // Execute closing order on Binance
        const closeOrder = await this.binanceService.placeOrder({
          symbol: position.symbol,
          side: closeSide,
          type: 'MARKET',
          quantity: position.quantity
        });

        // Close the position in risk manager
        const actualClosePrice = closeOrder.price || currentPrice;
        const closeFee = closeOrder.commission || 0;
        
        const closedPosition = this.riskManager.closePosition(positionId, actualClosePrice, closeFee);
        
        return closedPosition;
      }
    } catch (error) {
      console.error('Error closing position:', error);
      return null;
    }
  }

  /**
   * Place stop loss order for a position (live trading only)
   */
  private async placeStopLossOrder(position: TradePosition): Promise<void> {
    if (this.paperTradingMode || !this.binanceService) return;

    try {
      const stopSide = position.side === 'BUY' ? 'SELL' : 'BUY';
      
      await this.binanceService.placeOrder({
        symbol: position.symbol,
        side: stopSide,
        type: 'STOP_LOSS',
        quantity: position.quantity,
        stopPrice: position.stopLoss
      });

      console.log(`Stop loss order placed for position ${position.id} at $${position.stopLoss}`);
    } catch (error) {
      console.error(`Failed to place stop loss for position ${position.id}:`, error);
    }
  }

  /**
   * Cut loss for a position due to an unexpected condition.
   *
   * This method logs every step so it is easy to trace exactly what the
   * system does when it decides to exit a losing trade under adverse or
   * abnormal circumstances.
   *
   * Steps:
   *   1. Detect – confirm the position exists and log the triggering condition.
   *   2. Evaluate – calculate the unrealised loss at the current market price.
   *   3. Execute – place a market close order to exit immediately.
   *   4. Confirm – log the final realised P&L (or report a failure to close).
   */
  async cutLoss(positionId: string, currentPrice: number, reason: string): Promise<TradePosition | null> {
    const portfolio = this.riskManager.getPortfolio();
    const position = portfolio.openPositions.find(p => p.id === positionId);

    // Step 1 – Detect
    if (!position) {
      console.warn(`[CUT LOSS] Step 1: Position ${positionId} not found – already closed or unknown`);
      return null;
    }

    console.warn(
      `[CUT LOSS] Step 1: Unexpected condition detected for ${position.symbol} (${position.side}) | ` +
      `Reason: ${reason} | Entry: $${position.entryPrice.toFixed(4)} | Current: $${currentPrice.toFixed(4)} | Stop-loss: $${position.stopLoss.toFixed(4)}`
    );

    // Step 2 – Evaluate loss
    const rawPnl =
      position.side === 'BUY'
        ? (currentPrice - position.entryPrice) * position.quantity
        : (position.entryPrice - currentPrice) * position.quantity;

    const lossPercent =
      ((currentPrice - position.entryPrice) / position.entryPrice) *
      100 *
      (position.side === 'BUY' ? 1 : -1);

    console.warn(
      `[CUT LOSS] Step 2: Evaluating loss – unrealised P&L: $${rawPnl.toFixed(2)} (${lossPercent.toFixed(2)}%)`
    );

    // Step 3 – Execute close at current market price
    console.warn(
      `[CUT LOSS] Step 3: Executing market close – ${position.symbol} ${position.side} ` +
      `${position.quantity.toFixed(6)} @ $${currentPrice.toFixed(4)}`
    );

    const closedPosition = await this.closePosition(positionId, reason);

    // Step 4 – Confirm
    if (closedPosition) {
      console.warn(
        `[CUT LOSS] Step 4: Position closed – Final P&L: $${closedPosition.pnl.toFixed(2)} (${closedPosition.pnlPercent.toFixed(2)}%)`
      );
    } else {
      console.error(
        `[CUT LOSS] Step 4: FAILED to close position ${positionId} – manual intervention may be required`
      );
    }

    return closedPosition;
  }

  /**
   * Monitor positions and trigger stop loss/take profit
   */
  monitorPositions(marketData: MarketData[]): void {
    const portfolio = this.riskManager.getPortfolio();
    
    for (const position of portfolio.openPositions) {
      const symbolData = marketData.find(data => data.symbol === position.symbol);
      if (!symbolData) continue;

      // Update current price
      this.riskManager.updatePosition(position.id, symbolData.price);

      // Detect a price-gap scenario: price has moved far past the stop-loss
      // (e.g. flash crash / sudden news event) – treat as unexpected condition
      const gapThreshold = 2; // price is more than 2× the stop-loss distance away
      const stopDistance = Math.abs(position.entryPrice - position.stopLoss);
      const priceDistance = Math.abs(symbolData.price - position.stopLoss);
      const isPriceGap =
        this.riskManager.shouldTriggerStopLoss(position.id, symbolData.price) &&
        priceDistance > stopDistance * gapThreshold;

      if (isPriceGap) {
        console.warn(
          `[UNEXPECTED CONDITION] Price gap detected for ${position.symbol}: ` +
          `current $${symbolData.price.toFixed(4)} is far past stop-loss $${position.stopLoss.toFixed(4)}`
        );
        this.cutLoss(position.id, symbolData.price, 'Unexpected price gap beyond stop-loss');
        continue;
      }

      // Check stop loss
      if (this.riskManager.shouldTriggerStopLoss(position.id, symbolData.price)) {
        this.cutLoss(position.id, symbolData.price, 'Stop loss triggered');
        continue;
      }

      // Check take profit
      if (this.riskManager.shouldTriggerTakeProfit(position.id, symbolData.price)) {
        console.log(`Take profit triggered for position ${position.id}`);
        this.closePosition(position.id, 'Take profit triggered');
        continue;
      }

      // Check for scalping exit conditions (quick profit taking)
      this.checkScalpingExit(position, symbolData.price);
    }
  }

  /**
   * Check for scalping-specific exit conditions
   */
  private checkScalpingExit(position: TradePosition, currentPrice: number): void {
    const positionAge = Date.now() - position.openTime;
    const ageInMinutes = positionAge / (1000 * 60);
    
    // Exit after 5 minutes if still in profit (scalping behavior)
    if (ageInMinutes > 5 && position.pnl > 0) {
      console.log(`Scalping time-based exit for position ${position.id} after ${ageInMinutes.toFixed(1)} minutes`);
      this.closePosition(position.id, 'Scalping time-based exit');
      return;
    }

    // Exit if profit exceeds 0.7% (good scalping profit)
    if (position.pnlPercent > 0.7) {
      console.log(`Scalping profit target hit for position ${position.id}: ${position.pnlPercent.toFixed(2)}%`);
      this.closePosition(position.id, 'Scalping profit target');
      return;
    }

    // Exit if loss exceeds the configured stop-loss percentage – unexpected
    // because the price-based check above should have caught this first; this
    // acts as a safety net when P&L-based tracking diverges from price.
    if (position.pnlPercent < -config.trading.stopLossPercentage * 100) {
      this.cutLoss(position.id, currentPrice, 'Emergency stop loss – P&L exceeded stop-loss threshold');
      return;
    }
  }

  /**
   * Get optimal order size for a trading signal
   */
  getOptimalOrderSize(_symbol: string, currentPrice: number, signal: any): number {
    // Calculate position size based on volatility and signal strength
    const basePositionSize = this.riskManager.calculateMaxPositionSize(currentPrice);
    
    // Adjust based on signal confidence
    const confidenceMultiplier = Math.min(signal.confidence / 100, 1);
    const strengthMultiplier = Math.min(signal.strength / 100, 1);
    
    // Conservative approach for scalping
    const adjustedSize = basePositionSize * confidenceMultiplier * strengthMultiplier * 0.8;
    
    return Math.max(adjustedSize, 0);
  }

  /**
   * Check if we can open a new position
   */
  canOpenNewPosition(): boolean {
    const portfolio = this.riskManager.getPortfolio();
    const riskHealth = this.riskManager.getRiskHealth();
    
    return (
      portfolio.openPositions.length < config.trading.maxConcurrentTrades &&
      riskHealth.status !== 'CRITICAL' &&
      portfolio.availableBalance > portfolio.totalBalance * 0.1 // At least 10% available
    );
  }

  /**
   * Get current risk status
   */
  getRiskStatus(): any {
    return this.riskManager.getRiskHealth();
  }

  /**
   * Get portfolio summary
   */
  getPortfolioSummary(): any {
    if (this.paperTradingMode && this.paperTradingService) {
      return this.paperTradingService.getVirtualPortfolio();
    }
    return this.riskManager.getPortfolio();
  }

  /**
   * Get paper trading specific metrics
   */
  getPaperTradingMetrics(): any {
    if (this.paperTradingMode && this.paperTradingService) {
      return this.paperTradingService.getPaperTradingMetrics();
    }
    return null;
  }

  /**
   * Get paper trading comparison report for a specific position
   */
  getPaperTradingComparison(positionId: string): any {
    if (this.paperTradingMode && this.paperTradingService) {
      return this.paperTradingService.generateComparisonReport(positionId);
    }
    return null;
  }

  /**
   * Export paper trading data for analysis
   */
  exportPaperTradingData(): any {
    if (this.paperTradingMode && this.paperTradingService) {
      return this.paperTradingService.exportPaperTradingData();
    }
    return null;
  }

  /**
   * Reset paper trading statistics
   */
  resetPaperTradingStats(): void {
    if (this.paperTradingMode && this.paperTradingService) {
      this.paperTradingService.resetPaperTradingStats();
      logger.info('Paper trading statistics reset');
    }
  }

  /**
   * Validate that an order meets 1:2 risk-reward requirements before execution
   */
  private validateRiskRewardRatio(orderRequest: OrderRequest, entryPrice: number): {
    valid: boolean;
    actualRatio: number;
    stopLoss: number;
    takeProfit: number;
    reason?: string;
  } {
    const stopLoss = calculateStopLoss(entryPrice, config.trading.stopLossPercentage, orderRequest.side);
    const takeProfit = calculateTakeProfit(entryPrice, config.trading.takeProfitPercentage, orderRequest.side);
    
    const riskAmount = Math.abs(entryPrice - stopLoss);
    const rewardAmount = Math.abs(takeProfit - entryPrice);
    
    if (riskAmount === 0) {
      return {
        valid: false,
        actualRatio: 0,
        stopLoss,
        takeProfit,
        reason: 'Stop-loss distance cannot be zero'
      };
    }
    
    const actualRatio = rewardAmount / riskAmount;
    const minimumRatio = 2.0; // 1:2 risk-reward
    
    if (actualRatio < minimumRatio) {
      return {
        valid: false,
        actualRatio: Number(actualRatio.toFixed(2)),
        stopLoss,
        takeProfit,
        reason: `Risk-reward ratio ${actualRatio.toFixed(2)}:1 is below minimum ${minimumRatio}:1`
      };
    }
    
    return {
      valid: true,
      actualRatio: Number(actualRatio.toFixed(2)),
      stopLoss,
      takeProfit
    };
  }

  /**
   * Execute order with enforced 1:2 risk-reward ratio validation
   */
  async executeOrderWithRiskReward(orderRequest: OrderRequest, marketData: MarketData, signal?: TradingSignal): Promise<TradePosition | null> {
    // Validate risk-reward ratio before executing
    const riskRewardValidation = this.validateRiskRewardRatio(orderRequest, marketData.price);
    
    if (!riskRewardValidation.valid) {
      logger.warn(`Order rejected due to poor risk-reward ratio: ${riskRewardValidation.reason}`, {
        symbol: orderRequest.symbol,
        side: orderRequest.side,
        entryPrice: marketData.price,
        actualRatio: riskRewardValidation.actualRatio,
        stopLoss: riskRewardValidation.stopLoss,
        takeProfit: riskRewardValidation.takeProfit
      });
      return null;
    }
    
    logger.info(`Order validated with 1:2 risk-reward ratio: ${riskRewardValidation.actualRatio}:1`, {
      symbol: orderRequest.symbol,
      side: orderRequest.side,
      entryPrice: marketData.price,
      stopLoss: riskRewardValidation.stopLoss,
      takeProfit: riskRewardValidation.takeProfit
    });
    
    // Execute the order using existing logic
    return this.executeOrder(orderRequest, marketData, signal);
  }

  /**
   * Get current risk-reward configuration summary
   */
  getRiskRewardConfig(): {
    stopLossPercentage: number;
    takeProfitPercentage: number;
    targetRatio: number;
    actualRatio: number;
    status: 'OPTIMAL' | 'WARNING' | 'ERROR';
  } {
    const stopLossPercentage = config.trading.stopLossPercentage;
    const takeProfitPercentage = config.trading.takeProfitPercentage;
    const actualRatio = takeProfitPercentage / stopLossPercentage;
    const targetRatio = 2.0;
    
    let status: 'OPTIMAL' | 'WARNING' | 'ERROR';
    if (actualRatio >= targetRatio) {
      status = 'OPTIMAL';
    } else if (actualRatio >= 1.5) {
      status = 'WARNING';
    } else {
      status = 'ERROR';
    }
    
    return {
      stopLossPercentage,
      takeProfitPercentage,
      targetRatio,
      actualRatio: Number(actualRatio.toFixed(2)),
      status
    };
  }
}