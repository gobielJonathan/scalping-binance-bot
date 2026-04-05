import { OrderRequest, TradePosition, MarketData, TradingSignal } from '../types';
import { RiskManager } from './riskManager';
import { PaperTradingService } from './paperTradingService';
import { DatabaseService } from '../database/databaseService';
import { calculateStopLoss, calculateTakeProfit, generateTradeId } from '../utils/helpers';
import { logger } from './logger';
import config from '../config';
import BinanceService from './binanceService';
import { OrderType } from 'binance-api-node';
import { quoteAssets } from '../constants/assets';

/**
 * Order management service for handling trade execution
 */
export class OrderManager {
  private riskManager: RiskManager;
  private paperTradingService: PaperTradingService | null = null;
  private paperTradingMode: boolean;
  private binanceService: BinanceService; // Will be injected when available
  private dbService: DatabaseService | null = null;

  constructor(riskManager: RiskManager) {
    this.riskManager = riskManager;
    this.paperTradingMode = config.trading.mode === 'paper';
  }

  /**
   * Set the Binance service (dependency injection)
   */
  setBinanceService(binanceService: BinanceService): void {
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
        logger.info(`Order rejected: ${riskCheck.reason}`);
        if (riskCheck.maxQuantity) {
          logger.info(`Maximum allowed quantity: ${riskCheck.maxQuantity}`);
        }
        if (riskCheck.suggestedQuantity) {
          logger.info(`Suggested optimal quantity: ${riskCheck.suggestedQuantity}`);
        }
        if (riskCheck.warnings) {
          riskCheck.warnings.forEach(warning => logger.warn(`Warning: ${warning}`));
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
        stopLoss: orderRequest.stopPrice ?? calculateStopLoss(marketData.price, config.trading.stopLossPercentage, orderRequest.side),
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
          logger.warn('PaperTradingService not available, using basic simulation');
          logger.info(`[PAPER TRADE] ${orderRequest.side} ${orderRequest.quantity} ${orderRequest.symbol} @ $${marketData.price}`);
          
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

        logger.info(`[LIVE TRADE] Executing ${orderRequest.side} ${finalQuantity} ${orderRequest.symbol}`);
        
        // Log risk warnings if any
        if (riskCheck.warnings) {
          riskCheck.warnings.forEach(warning => logger.warn(`Risk Warning: ${warning}`));
        }

        // ── Balance guards before placing order ──────────────────────────
        let safeQuantity = finalQuantity;

        // Resolve base asset from symbol (e.g. BNBUSDT → BNB, PEPEUSDT → PEPE)
        const baseAsset = quoteAssets.reduce(
          (s, q) => (s.endsWith(q) ? s.slice(0, -q.length) : s),
          orderRequest.symbol
        );

        if (orderRequest.side === 'BUY') {
          // BUY: verify we have enough USDT to cover the order
          try {
            const balances = await this.binanceService.getBalance('USDT');
            const freeUsdt = balances[0]?.free ?? 0;
            if (freeUsdt > 0) {
              this.riskManager.syncBalance(freeUsdt);
              // Reserve 0.2% for taker fee so we never exceed available funds
              const maxAffordable = (freeUsdt * 0.998) / marketData.price;
              if (safeQuantity > maxAffordable) {
                logger.warn(`[OrderManager] Capping qty ${safeQuantity.toFixed(6)} → ${maxAffordable.toFixed(6)} (free USDT: ${freeUsdt})`);
                safeQuantity = maxAffordable;
              }
            }
          } catch (balErr) {
            logger.warn('[OrderManager] Could not fetch USDT balance for pre-order check: ' + String(balErr));
          }
        } else if (orderRequest.side === 'SELL') {
          // SELL: verify we actually hold the base asset before trying to sell it
          // For isolated margin, check the margin account balance instead
          try {
            const freeBase = config.trading.tradingAccount === 'isolated_margin'
              ? await this.binanceService.getIsolatedMarginBalance(orderRequest.symbol, baseAsset)
              : (await this.binanceService.getBalance(baseAsset))[0]?.free ?? 0;
            if (freeBase <= 0) {
              logger.warn(`[OrderManager] SELL skipped — no ${baseAsset} balance on exchange (${orderRequest.symbol})`);
              return null;
            }
            if (safeQuantity > freeBase) {
              logger.warn(`[OrderManager] Capping SELL qty ${safeQuantity.toFixed(6)} → ${freeBase.toFixed(6)} (free ${baseAsset}: ${freeBase})`);
              safeQuantity = freeBase * 0.999;
            }
          } catch (balErr) {
            logger.warn(`[OrderManager] Could not fetch ${baseAsset} balance for SELL check: ` + String(balErr));
          }
        }
        // ──────────────────────────────────────────────────────────────────

        // Execute the order — branch on trading account mode
        let binanceOrder: any;
        if (config.trading.tradingAccount === 'isolated_margin') {
          binanceOrder = await this.binanceService.placeMarginOrder({
            symbol: orderRequest.symbol,
            side: orderRequest.side,
            type: OrderType.MARKET,
            quantity: safeQuantity,
            isIsolated: true,
            sideEffectType: 'AUTO_BORROW_REPAY',
          });
        } else {
          binanceOrder = await this.binanceService.placeOrder({
            symbol: orderRequest.symbol,
            side: orderRequest.side,
            type: OrderType.MARKET,
            quantity: safeQuantity,
          });
        }

        // Parse actual average fill price
        const execQty = parseFloat(String(binanceOrder.executedQty ?? 0));
        const quoteQty = parseFloat(String((binanceOrder as any).cummulativeQuoteQty ?? 0));
        const fillPrice = execQty > 0 && quoteQty > 0 ? quoteQty / execQty : parseFloat(String(binanceOrder.price ?? 0));
        position.entryPrice = fillPrice > 0 ? fillPrice : marketData.price;
        if (execQty > 0) position.quantity = execQty;
        position.fees = parseFloat(String(binanceOrder.commission ?? 0)) || 0;

        // Attach margin metadata for isolated_margin trades
        if (config.trading.tradingAccount === 'isolated_margin') {
          position.marginMode = 'isolated_margin';
          position.leverage = config.trading.leverage;
          position.liquidationPrice = this.riskManager.calculateLiquidationPrice(
            position.entryPrice,
            position.side,
            config.trading.leverage,
            config.trading.marginMaintenanceRate,
          );
          // Borrowed = notional - margin collateral
          position.borrowedAmount = position.quantity * position.entryPrice * (1 - 1 / config.trading.leverage);
        }
        
        // Add to risk manager
        this.riskManager.addPosition(position);

        // Place stop loss order
        await this.placeStopLossOrder(position);

        return position;
      }
    } catch (error) {
      logger.error('Error executing order:', { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
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
        logger.info(`Position ${positionId} not found`);
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
          logger.warn('PaperTradingService not available, using basic simulation');
          logger.info(`[PAPER TRADE] Closing position ${positionId}: ${reason}`);
          
          // Simulate additional trading fee for closing
          const closeFee = position.quantity * currentPrice * 0.001;
          
          const closedPosition = this.riskManager.closePosition(positionId, currentPrice, closeFee);
          
          if (closedPosition) {
            logger.info(`Position closed with P&L: $${closedPosition.pnl.toFixed(2)} (${closedPosition.pnlPercent.toFixed(2)}%)`);
          }
          
          return closedPosition;
        }
      } else {
        // Live trading close
        if (!this.binanceService) {
          throw new Error('Binance service not available for live trading');
        }

        logger.info(`[LIVE TRADE] Closing position ${positionId}: ${reason}`);
        
        // Determine the opposite side for closing
        const closeSide = position.side === 'BUY' ? 'SELL' : 'BUY';
        const isMargin = position.marginMode === 'isolated_margin' || config.trading.tradingAccount === 'isolated_margin';
        
        // Resolve base asset to check real available balance
        let closeQty = position.quantity;
        try {
          const baseAsset = quoteAssets.reduce((s, q) => s.endsWith(q) ? s.slice(0, -q.length) : s, position.symbol);
          const available = isMargin
            ? await this.binanceService.getIsolatedMarginBalance(position.symbol, baseAsset)
            : (await this.binanceService.getBalance(baseAsset))[0]?.free ?? 0;
          if (available > 0 && available < closeQty) {
            logger.warn(`[OrderManager] Adjusting close qty ${closeQty} → ${available} (actual balance)`);
            closeQty = available;
          }
        } catch { /* proceed with stored quantity */ }

        // Execute closing order
        const closeOrder = isMargin
          ? await this.binanceService.placeMarginOrder({
              symbol: position.symbol, side: closeSide, type: OrderType.MARKET,
              quantity: closeQty, isIsolated: true, sideEffectType: 'AUTO_BORROW_REPAY',
            })
          : await this.binanceService.placeOrder({
              symbol: position.symbol, side: closeSide, type: OrderType.MARKET, quantity: closeQty,
            });

        // Close the position in risk manager
        const actualClosePrice = closeOrder.price || currentPrice;
        const closeFee = closeOrder.commission || 0;
        
        const closedPosition = this.riskManager.closePosition(positionId, actualClosePrice, closeFee);
        
        return closedPosition;
      }
    } catch (error) {
      logger.error('Error closing position:', { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
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
      const isMargin = position.marginMode === 'isolated_margin' || config.trading.tradingAccount === 'isolated_margin';
      
      // STOP_LOSS_LIMIT requires both stopPrice (trigger) and price (limit).
      const limitPrice = stopSide === 'SELL'
        ? position.stopLoss * 0.995
        : position.stopLoss * 1.005;

      if (isMargin) {
        await this.binanceService.placeMarginOrder({
          symbol: position.symbol,
          side: stopSide,
          type: OrderType.STOP_LOSS_LIMIT,
          quantity: position.quantity,
          stopPrice: position.stopLoss,
          price: limitPrice,
          timeInForce: 'GTC',
          isIsolated: true,
          sideEffectType: 'AUTO_REPAY',
        });
      } else {
        await this.binanceService.placeOrder({
          symbol: position.symbol,
          side: stopSide,
          type: OrderType.STOP_LOSS_LIMIT,
          quantity: position.quantity,
          stopPrice: position.stopLoss,
          price: limitPrice,
          timeInForce: 'GTC',
        });
      }

      logger.info(`Stop loss order placed for position ${position.id} at $${position.stopLoss}`);
    } catch (error) {
      logger.error(`Failed to place stop loss for position ${position.id}:`, { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
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
      logger.warn(`[CUT LOSS] Step 1: Position ${positionId} not found – already closed or unknown`);
      return null;
    }

    logger.warn(
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

    logger.warn(
      `[CUT LOSS] Step 2: Evaluating loss – unrealised P&L: $${rawPnl.toFixed(2)} (${lossPercent.toFixed(2)}%)`
    );

    // Step 3 – Execute close at current market price
    logger.warn(
      `[CUT LOSS] Step 3: Executing market close – ${position.symbol} ${position.side} ` +
      `${position.quantity.toFixed(6)} @ $${currentPrice.toFixed(4)}`
    );

    const closedPosition = await this.closePosition(positionId, reason);

    // Step 4 – Confirm
    if (closedPosition) {
      logger.warn(
        `[CUT LOSS] Step 4: Position closed – Final P&L: $${closedPosition.pnl.toFixed(2)} (${closedPosition.pnlPercent.toFixed(2)}%)`
      );
    } else {
      logger.error(
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
        logger.warn(
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
        logger.info(`Take profit triggered for position ${position.id}`);
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
      logger.info(`Scalping time-based exit for position ${position.id} after ${ageInMinutes.toFixed(1)} minutes`);
      this.closePosition(position.id, 'Scalping time-based exit');
      return;
    }

    // Exit if profit exceeds 0.7% (good scalping profit)
    if (position.pnlPercent > 0.7) {
      logger.info(`Scalping profit target hit for position ${position.id}: ${position.pnlPercent.toFixed(2)}%`);
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
    console.log(`[OrderManager] Checking if we can open new position: openPositions=${portfolio.openPositions.length}, riskStatus=${riskHealth.status}, availableBalance=${portfolio.availableBalance.toFixed(2)}`);
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