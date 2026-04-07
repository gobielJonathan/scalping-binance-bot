import config from "./config";
import { ScalpingStrategy } from "./strategies/scalpingStrategy";
import { RiskManager } from "./services/riskManager";
import { OrderManager } from "./services/orderManager";
import { MarketDataService } from "./services/marketDataService";
import { DashboardService } from "./dashboard/dashboardService";
import { Candle, MarketData, TradingSignal } from "./types";
import { BinanceService, DatabaseService, logger, PairSelectorService } from "./services";
import { PatternRecognizer } from "./utils/patternRecognizer";
import { OrderType } from "binance-api-node";
import { listenerCleanup } from "./utils/listenerCleanup";

/**
 * Main trading bot application
 */
class CryptoScalpingBot {
  private strategy: ScalpingStrategy;
  private riskManager: RiskManager;
  private orderManager: OrderManager;
  private marketDataService: MarketDataService | null = null;
  private dashboard: DashboardService;
  private patternRecognizer: PatternRecognizer;
  private isRunning: boolean = false;
  private marketDataCache: Map<string, Candle[]> = new Map();
  // Map is the single source of truth for market data — O(1) read/write by symbol
  private currentMarketDataMap: Map<string, MarketData> = new Map();

  // Services that will be injected when available
  private binanceService: BinanceService | null = null;
  private logger: any = null;
  private database: any = null;
  private pairSelectorService: PairSelectorService | null = null;
  private volatilityRefreshTimer: NodeJS.Timeout | null = null;
  // Re-entry cooldown: track last close time per symbol to avoid fee-burning
  // rapid re-entries immediately after a position is closed
  private symbolCooldowns: Map<string, number> = new Map();
  private openPositionSymbols: Set<string> = new Set();
  private readonly SYMBOL_COOLDOWN_MS = 90_000; // 90 seconds after each close

  constructor() {
    logger.info("Initializing Crypto Scalping Bot...");

    // Initialize core components
    this.strategy = new ScalpingStrategy();
    this.riskManager = new RiskManager(config.trading.initialCapital);
    this.orderManager = new OrderManager(this.riskManager);
    this.dashboard = new DashboardService();
    this.patternRecognizer = new PatternRecognizer();

    logger.info(`Trading Mode: ${config.trading.mode.toUpperCase()}`);
    logger.info(`Initial Capital: $${config.trading.initialCapital}`);
    logger.info(`Trading Pairs: ${config.trading.pairs.join(", ")}`);
    logger.info(
      `Risk per Trade: ${(config.trading.riskPerTrade * 100).toFixed(1)}%`,
    );
  }

  /**
   * Set external services (dependency injection)
   */
  setServices(services: {
    binanceService?: BinanceService;
    logger?: any;
    database?: any;
  }): void {
    if (services.binanceService) {
      this.binanceService = services.binanceService;
      this.orderManager.setBinanceService(services.binanceService);

      // Initialize MarketDataService with BinanceService
      this.marketDataService = new MarketDataService(services.binanceService);
      this.dashboard.setMarketDataService(this.marketDataService);
      this.setupMarketDataEventHandlers();

      // Initialize PairSelectorService for dynamic pair selection
      this.pairSelectorService = new PairSelectorService(services.binanceService);

      logger.info("Binance service connected");
    }

    if (services.logger) {
      this.logger = services.logger;
      logger.info("Logger service connected");
    }

    if (services.database) {
      this.database = services.database;
      this.orderManager.setDatabaseService(services.database);
      logger.info("Database service connected");
    }
  }

  /** Expose RiskManager so main() can sync the real exchange balance. */
  getRiskManager(): RiskManager {
    return this.riskManager;
  }

  /**
   * Setup event handlers for MarketDataService
   */
  private setupMarketDataEventHandlers(): void {
    if (!this.marketDataService) return;

    // Handle real-time candle updates
    this.marketDataService.on("candleUpdate", (update) => {
      try {
        // Update local cache
        const candles = this.marketDataService!.getCandles(update.symbol, "5m");
        this.marketDataCache.set(update.symbol, candles);

        if (this.logger) {
          this.logger.debug("Candle update received", {
            symbol: update.symbol,
            interval: "5m",
            candleCount: candles.length,
          });
        }
      } catch (error) {
        logger.error("Error handling candle update:", { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
        if (this.logger) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.logger.error("Candle update error", {
            error: errorMessage,
            update,
          });
        }
      }
    });

    // Handle real-time market data updates
    this.marketDataService.on("marketDataUpdate", (update) => {
      try {
        if (update.marketData) {
          // O(1) Map update — no array scan needed
          this.currentMarketDataMap.set(update.symbol, update.marketData);

          // Broadcast to dashboard
          this.dashboard.broadcastMarketData([update.marketData]);

          if (this.logger) {
            this.logger.debug("Market data updated", {
              symbol: update.symbol,
              price: update.marketData.price,
              change: update.marketData.priceChangePercent24h,
            });
          }
        }
      } catch (error) {
        logger.error("Error handling market data update:", { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
        if (this.logger) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.logger.error("Market data update error", {
            error: errorMessage,
            update,
          });
        }
      }
    });

    // Handle performance metrics
    this.marketDataService.on("performanceMetrics", (metrics) => {
      if (this.logger) {
        this.logger.performance("MarketDataService performance", 0, metrics);
      }
    });

    // Handle service events
    this.marketDataService.on("started", () => {
      logger.info("MarketDataService started successfully");
      if (this.logger) {
        this.logger.info("MarketDataService started");
      }
    });

    this.marketDataService.on("stopped", () => {
      logger.info("MarketDataService stopped");
      if (this.logger) {
        this.logger.info("MarketDataService stopped");
      }
    });

    this.marketDataService.on("historicalDataRefreshed", (data) => {
      logger.info(
        `Historical data loaded for ${data.symbol} (${data.candles.length} candles)`,
      );
      if (this.logger) {
        this.logger.info("Historical data refreshed", {
          symbol: data.symbol,
          interval: data.interval,
          candleCount: data.candles.length,
        });
      }
    });
  }

  /**
   * Start the trading bot
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("Bot is already running");
      return;
    }

    try {
      logger.info("Starting services...");

      // Dynamically select high-volatility pairs when configured
      if (config.trading.pairSelectionMode === 'dynamic') {
        await this.refreshVolatilityPairs();

        // Schedule periodic pair refresh
        this.volatilityRefreshTimer = setInterval(
          () => this.refreshVolatilityPairs(),
          config.trading.volatilityRefreshInterval,
        );
      }

      // Start dashboard if enabled
      if (config.dashboard.enabled) {
        await this.dashboard.start();
        logger.info(
          `Dashboard available at: http://localhost:${config.dashboard.port}`,
        );
      }

      // Start MarketDataService if available
      if (this.marketDataService) {
        logger.info("Starting MarketDataService...");
        await this.marketDataService.start();
      } else {
        logger.warn("MarketDataService not available, using simulated data");
        // Initialize market data for all trading pairs (fallback)
        await this.initializeMarketData();
      }

      this.isRunning = true;
      logger.info("Crypto Scalping Bot is now running!");

      // In live mode, set ISOLATED margin + leverage on every trading pair
      // before any orders are placed. Binance defaults new symbols to CROSS.
      if (config.trading.mode === 'live' && this.binanceService) {
        for (const pair of config.trading.pairs) {
          try {
            await this.binanceService.setFuturesLeverage(pair, config.trading.leverage);
            logger.info(`[init] ${pair}: ISOLATED margin, ${config.trading.leverage}x leverage set`);
          } catch (err) {
            logger.warn(`[init] Could not set leverage for ${pair}: ${String(err)}`);
          }
        }

        // Start real-time balance sync via Futures user data stream.
        // Falls back to REST polling (syncBalanceFromExchange) if stream is unavailable.
        try {
          const cleanup = await this.binanceService.startFuturesUserDataStream(
            (usdtWalletBalance: number) => {
              this.riskManager.syncBalance(usdtWalletBalance);
              logger.debug(`[WS] Balance synced: $${usdtWalletBalance.toFixed(2)} USDT`);
            },
          );
          listenerCleanup.registerCleanup(cleanup);
        } catch (err) {
          logger.warn(`[WS] Could not start futures user data stream: ${String(err)}`);
        }
      }

      // Start main trading loop
      this.startTradingLoop();
    } catch (error) {
      logger.error("Failed to start bot:", { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
      throw error;
    }
  }

  /**
   * Stop the trading bot
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn("Bot is not running");
      return;
    }

    logger.info("Stopping Crypto Scalping Bot...");
    this.isRunning = false;

    try {
      // Stop periodic pair refresh timer if running
      if (this.volatilityRefreshTimer) {
        clearInterval(this.volatilityRefreshTimer);
        this.volatilityRefreshTimer = null;
      }

      // Close all live mark price WebSocket streams before general cleanup
      this.orderManager.stopAllMarkPriceStreams();

      listenerCleanup.cleanupAll();

      // Stop MarketDataService
      if (this.marketDataService) {
        logger.info("Stopping MarketDataService...");
        await this.marketDataService.stop();
      }

      // Close all open positions
      await this.closeAllPositions("Bot shutdown");

      // Stop dashboard
      if (config.dashboard.enabled) {
        await this.dashboard.stop();
      }

      logger.info("Bot stopped successfully");
    } catch (error) {
      logger.error("Error stopping bot:", { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
      throw error;
    }
  }

  /**
   * Fetch high-volatility pairs from Binance and update the active trading pairs.
   * Called once on startup (in dynamic mode) and then periodically.
   */
  private async refreshVolatilityPairs(): Promise<void> {
    if (!this.pairSelectorService) {
      logger.warn("PairSelectorService not available — skipping volatility pair refresh");
      return;
    }

    logger.info("Scanning Binance for high-volatility pairs...");

    const selected = await this.pairSelectorService.selectTopVolatilityPairs(
      {
        quoteAsset: 'USDT',
        topN: config.trading.topVolatilityPairs,
        minVolume24hUsdt: config.trading.minVolume24hUsdt,
      },
      config.trading.pairs, // fallback to currently configured pairs
    );

    // Update the active pairs in the shared config so the trading loop (which
    // iterates config.trading.pairs on every tick) immediately picks up the
    // new selection without requiring a restart.
    config.trading.pairs = selected;

    if (this.logger) {
      this.logger.info("Trading pairs updated via volatility scan", {
        pairs: selected,
      });
    }
  }

  /**
   * Initialize market data for all trading pairs
   */
  private async initializeMarketData(): Promise<void> {
    logger.info("Initializing market data...");

    for (const pair of config.trading.pairs) {
      try {
        // Initialize with empty data - will be populated by real-time streams
        this.marketDataCache.set(pair, []);

        // Add to current market data with placeholder values
        const placeholder: MarketData = {
          symbol: pair,
          price: 0,
          volume24h: 0,
          priceChange24h: 0,
          priceChangePercent24h: 0,
          bid: 0,
          ask: 0,
          spread: 0,
          timestamp: Date.now(),
        };
        this.currentMarketDataMap.set(pair, placeholder);

        logger.info(`Initialized ${pair}`);
      } catch (error) {
        logger.error(`Failed to initialize ${pair}:`, { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
      }
    }
  }

  /**
   * Main trading loop
   */
  private async startTradingLoop(): Promise<void> {
    logger.info("Starting trading loop...");

    const loopInterval = 5000; // 5 seconds for scalping

    const tradingLoop = async () => {
      if (!this.isRunning) return;

      try {
        // Update market data (only if MarketDataService is not available)
        if (!this.marketDataService) {
          await this.updateMarketData();
        }

        // Monitor existing positions
        // In live mode, per-symbol WS mark price streams handle monitoring;
        // polling is only used in paper mode.
        if (config.trading.mode === 'paper') {
          this.orderManager.monitorPositions(Array.from(this.currentMarketDataMap.values()));
        }

        // Generate trading signals for each pair — always process all pairs
        // so signals are broadcast and logged for every symbol.
        // The canOpenNewPosition guard lives inside processSignalForPair.
        for (const pair of config.trading.pairs) {
          await this.processSignalForPair(pair);
        }

        // Update dashboard (if not using MarketDataService real-time updates)
        if (!this.marketDataService) {
          await this.updateDashboard();
        }

        // Update risk management
        this.updateRiskManagement();
      } catch (error) {
        logger.error("Error in trading loop:", { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
        if (this.logger) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          this.logger.error("Trading loop error", { error: errorMessage });
        }
      }

      // Schedule next iteration
      if (this.isRunning) {
        setTimeout(tradingLoop, loopInterval);
      }
    };

    // Start the loop
    tradingLoop();
  }

  /**
   * Update market data (simulated for now)
   */
  private async updateMarketData(): Promise<void> {
    // This would normally fetch real data from Binance
    // For now, we'll simulate some basic price movements
    for (const data of this.currentMarketDataMap.values()) {
      if (!data) continue;

      if (data.price === 0) {
        // Initialize with realistic prices
        switch (data.symbol) {
          case "BTCUSDT":
            data.price = 43000 + (Math.random() - 0.5) * 1000;
            break;
          case "ETHUSDT":
            data.price = 2600 + (Math.random() - 0.5) * 100;
            break;
          case "BNBUSDT":
            data.price = 300 + (Math.random() - 0.5) * 20;
            break;
          default:
            data.price = 100 + (Math.random() - 0.5) * 10;
        }
      } else {
        // Simulate small price movements (typical for scalping)
        const changePercent = (Math.random() - 0.5) * 0.002; // ±0.1% max change
        data.price *= 1 + changePercent;
        data.priceChangePercent24h = changePercent * 100;
      }

      data.bid = data.price * 0.999;
      data.ask = data.price * 1.001;
      data.spread = data.ask - data.bid;
      data.timestamp = Date.now();
    }
  }

  /**
   * Process trading signals for a specific pair
   */
  /**
   * Boost a signal's confidence using chart pattern confirmation.
   * - Aligning pattern (same direction, recent): +confidence × 0.3 (up to +20 pts)
   * - Conflicting pattern (opposite direction, recent): −10 pts
   * - Volume-confirmed pattern adds an extra +5 pts
   * Returns a new signal object (original is not mutated).
   */
  private boostSignalWithPatterns(signal: TradingSignal, candles: Candle[]): TradingSignal {
    const patterns = this.patternRecognizer.identifyScalpingPatterns(candles);
    if (patterns.length === 0) return signal;

    const signalDir = signal.type === 'BUY' ? 'bullish' : 'bearish';
    let boost = 0;
    let boostReasons: string[] = [];

    for (const p of patterns) {
      const aligns = p.direction === signalDir;
      const conflicts = p.direction !== signalDir;
      const weight = (p.confidence / 100) * 0.3; // scale by pattern's own confidence

      if (aligns) {
        const pts = Math.min(20, Math.round(signal.confidence * weight));
        boost += pts;
        if (p.volumeConfirmation) boost += 5;
        boostReasons.push(`${p.name}(+${pts}${p.volumeConfirmation ? '+5vol' : ''})`);
      } else if (conflicts) {
        boost -= 10;
        boostReasons.push(`${p.name}(-10 conflict)`);
      }
    }

    const newConfidence = Math.max(0, Math.min(100, signal.confidence + boost));
    const reasonSuffix = boostReasons.length > 0 ? ` | Patterns: ${boostReasons.join(', ')}` : '';
    return {
      ...signal,
      confidence: newConfidence,
      reason: (signal.reason ?? '') + reasonSuffix,
    };
  }

  private async processSignalForPair(pair: string): Promise<void> {
    try {
      let candles: Candle[] = [];
      let marketData: MarketData | undefined;

      // ── Re-entry cooldown: detect close events and enforce minimum wait ──
      const portfolio = this.riskManager.getPortfolio();
      const hasOpenPos = portfolio.openPositions.some(p => p.symbol === pair);

      // Position just closed this cycle → record close timestamp
      if (this.openPositionSymbols.has(pair) && !hasOpenPos) {
        this.symbolCooldowns.set(pair, Date.now());
        this.openPositionSymbols.delete(pair);
        logger.info(`Cooldown started for ${pair} (${this.SYMBOL_COOLDOWN_MS / 1000}s)`);
      }
      if (hasOpenPos) {
        this.openPositionSymbols.add(pair);
      }

      // Skip if within cooldown window to prevent immediate fee-burning re-entry
      const lastClose = this.symbolCooldowns.get(pair) ?? 0;
      if (Date.now() - lastClose < this.SYMBOL_COOLDOWN_MS) {
        const remainingSec = Math.ceil((this.SYMBOL_COOLDOWN_MS - (Date.now() - lastClose)) / 1000);
        logger.info(`Signal skipped (cooldown ${remainingSec}s remaining): ${pair}`);
        return;
      }

      // Get data from MarketDataService if available, otherwise use cache
      if (this.marketDataService) {
        candles = this.marketDataService.getCandles(pair, "5m", 500);
        marketData = this.marketDataService.getMarketData(pair) || undefined;
      } else {
        candles = this.marketDataCache.get(pair) || [];
        // O(1) Map lookup instead of O(n) Array.find
        marketData = this.currentMarketDataMap.get(pair);
      }

      if (!marketData) {
        logger.info(`Signal skipped (no market data): ${pair}`);
        if (this.logger) {
          this.logger.warn("No market data available for pair — waiting for ticker stream", { pair });
        }
        return;
      }

      if (candles.length < 20) {
        logger.info(`Signal skipped (insufficient candles ${candles.length}/20): ${pair}`);
        if (this.logger) {
          this.logger.warn("Insufficient candles for signal generation", {
            pair,
            candleCount: candles.length,
            required: 20,
            interval: "5m",
          });
        }
        return;
      }

      // Generate trading signal
      const rawSignal = this.strategy.generateSignal(candles, marketData);

      // Boost confidence using chart pattern recognition
      const signal = (rawSignal.type === 'BUY' || rawSignal.type === 'SELL')
        ? this.boostSignalWithPatterns(rawSignal, candles)
        : rawSignal;

      if (this.logger) {
        this.logger.info("Signal generated", {
          pair,
          signal: {
            type: signal.type,
            strength: signal.strength,
            confidence: signal.confidence,
            reason: signal.reason,
          },
        });
      }

      // Broadcast signal to dashboard
      this.dashboard.broadcastSignal({ ...signal, symbol: pair });

      const isValidSignal = signal.type === "BUY" || signal.type === "SELL";
      if (!isValidSignal) {
        logger.info(`Signal skipped (HOLD): ${pair}`);
        return;
      }

      if (signal.confidence > 50) {
        const portfolio = this.riskManager.getPortfolio();
        const hasOpenPositionForPair = portfolio.openPositions.some(p => p.symbol === pair);
        if (hasOpenPositionForPair) {
          logger.info(`Signal skipped (position already open): ${signal.type} ${pair}`);
        } else if (this.orderManager.canOpenNewPosition()) {
          await this.executeSignal(pair, signal, marketData);
        } else {
          logger.info(`Signal skipped (max positions reached): ${signal.type} ${pair}`);
        }
        return;
      }

      logger.info(`Signal skipped (low confidence ${signal.confidence}%, need >65%): ${signal.type} ${pair}`);
    } catch (error) {
      logger.error(`Error processing signal for ${pair}:`, { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
      if (this.logger) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        this.logger.error("Signal processing error", {
          pair,
          error: errorMessage,
        });
      }
    }
  }

  /**
   * Execute a trading signal
   */
  private async executeSignal(
    pair: string,
    signal: TradingSignal,
    marketData: MarketData,
  ): Promise<void> {
    try {
      const orderSize = this.orderManager.getOptimalOrderSize(
        pair,
        marketData.price,
        signal,
      );

      if (orderSize <= 0) {
        logger.warn(`Order size too small for ${pair}: ${orderSize}`);
        return;
      }

      const orderRequest = {
        symbol: pair,
        side: signal.type as "BUY" | "SELL",
        type: OrderType.MARKET,
        quantity: orderSize,
        stopPrice: signal.stopLoss,
      };

      logger.info(
        `Signal: ${signal.type} ${pair} - Confidence: ${signal.confidence}%`,
      );

      const position = await this.orderManager.executeOrder(
        orderRequest,
        marketData,
      );

      if (position) {
        logger.info(
          `Position opened: ${position.side} ${position.quantity.toFixed(6)} ${position.symbol} @ $${position.entryPrice.toFixed(4)}`,
        );

        // Broadcast to dashboard
        this.dashboard.broadcastTrade(position);

        // Save to database if available
        if (this.database) {
          await this.database.saveTrade({
            ...position,
            type: 'MARKET' as const,
            strategyId: 'scalping',
            mode: config.trading.mode,
          });
        }
      }
    } catch (error) {
      logger.error(`Error executing signal for ${pair}:`, { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
    }
  }

  /**
   * Close all open positions
   */
  private async closeAllPositions(reason: string): Promise<void> {
    const portfolio = this.riskManager.getPortfolio();

    for (const position of portfolio.openPositions) {
      try {
        await this.orderManager.closePosition(position.id, reason);
      } catch (error) {
        logger.error(`Error closing position ${position.id}:`, { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
      }
    }
  }

  /**
   * Update dashboard with current data
   */
  private async updateDashboard(): Promise<void> {
    if (!config.dashboard.enabled) return;

    const portfolio = this.riskManager.getPortfolio();
    const riskHealth = this.riskManager.getRiskHealth();

    // Include MarketDataService metrics if available
    const dashboardData: any = {
      portfolio,
      riskHealth,
      marketData: Array.from(this.currentMarketDataMap.values()),
    };

    if (this.marketDataService) {
      dashboardData.streamMetrics = this.marketDataService.getStreamMetrics();
      dashboardData.connectionStatus =
        this.marketDataService.getConnectionStatus();
    }

    this.dashboard.broadcastPortfolioUpdate(dashboardData);
  }

  /**
   * Update risk management
   */
  private updateRiskManagement(): void {
    this.riskManager.updateDailyPnL();

    const riskHealth = this.riskManager.getRiskHealth();

    if (riskHealth.status === "CRITICAL") {
      logger.error("CRITICAL RISK LEVEL DETECTED");
      logger.error(`Warnings: ${riskHealth.warnings.join(", ")}`);

      if (
        riskHealth.metrics.dailyPnlPercent <
        -config.trading.dailyLossLimit * 100
      ) {
        logger.error(
          "Daily loss limit exceeded - triggering emergency stop",
        );
        this.riskManager.triggerEmergencyStop("Daily loss limit exceeded");
        // Close all open positions to cut further losses immediately
        this.closeAllPositions("Emergency stop: Daily loss limit exceeded");
      }
    }
  }

}

// Main execution
async function main() {
  const bot = new CryptoScalpingBot();

  // Inject services so MarketDataService and live trading are available
  const binanceService = new BinanceService();
  const databaseService = new DatabaseService();
  await databaseService.initializeDatabase();
  bot.setServices({ binanceService, database: databaseService });

  // ── Sync live balance ──────────────────────────────────────────────────────
  // In live mode, replace the static INITIAL_CAPITAL with the real Binance USDT
  // balance so the RiskManager's available balance is accurate from the start.
  if (config.trading.mode === 'live') {
    try {
      const balances = await binanceService.getBalance('USDT');
      const freeUsdt = balances[0]?.free ?? 0;
      if (freeUsdt > 0) {
        config.trading.initialCapital = freeUsdt;
        bot.getRiskManager().syncBalance(freeUsdt);
        logger.info(`[main] Synced initial capital from Binance: $${freeUsdt.toFixed(2)} USDT`);
      }
    } catch (err) {
      logger.warn('[main] Could not fetch Binance balance for initial sync — using .env INITIAL_CAPITAL: ' + String(err));
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  // Graceful shutdown handling
  process.on("SIGINT", async () => {
    logger.info("Received SIGINT, shutting down gracefully...");
    await bot.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    logger.info("Received SIGTERM, shutting down gracefully...");
    await bot.stop();
    process.exit(0);
  });

  try {
    // Start the bot
    await bot.start();
  } catch (error) {
    logger.error("Failed to start bot:", { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
    process.exit(1);
  }
}

// Export for testing
export { CryptoScalpingBot };

// Run if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    logger.error("Unhandled error:", { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
    process.exit(1);
  });
}
