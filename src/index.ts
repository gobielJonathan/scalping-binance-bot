import config from "./config";
import { ScalpingStrategy } from "./strategies/scalpingStrategy";
import { RiskManager } from "./services/riskManager";
import { OrderManager } from "./services/orderManager";
import { MarketDataService } from "./services/marketDataService";
import { DashboardService } from "./dashboard/dashboardService";
import { Candle, MarketData, TradingSignal } from "./types";
import { BinanceService, DatabaseService, logger, PairSelectorService } from "./services";

/**
 * Main trading bot application
 */
class CryptoScalpingBot {
  private strategy: ScalpingStrategy;
  private riskManager: RiskManager;
  private orderManager: OrderManager;
  private marketDataService: MarketDataService | null = null;
  private dashboard: DashboardService;
  private isRunning: boolean = false;
  private marketDataCache: Map<string, Candle[]> = new Map();
  private currentMarketData: MarketData[] = [];

  // Services that will be injected when available
  private binanceService: any = null;
  private logger: any = null;
  private database: any = null;
  private pairSelectorService: PairSelectorService | null = null;
  private volatilityRefreshTimer: NodeJS.Timeout | null = null;

  constructor() {
    console.log("🚀 Initializing Crypto Scalping Bot...");

    // Initialize core components
    this.strategy = new ScalpingStrategy();
    this.riskManager = new RiskManager(config.trading.initialCapital);
    this.orderManager = new OrderManager(this.riskManager);
    this.dashboard = new DashboardService();

    console.log(`📊 Trading Mode: ${config.trading.mode.toUpperCase()}`);
    console.log(`💰 Initial Capital: $${config.trading.initialCapital}`);
    console.log(`🎯 Trading Pairs: ${config.trading.pairs.join(", ")}`);
    console.log(
      `⚡ Risk per Trade: ${(config.trading.riskPerTrade * 100).toFixed(1)}%`,
    );
  }

  /**
   * Set external services (dependency injection)
   */
  setServices(services: {
    binanceService?: any;
    logger?: any;
    database?: any;
  }): void {
    if (services.binanceService) {
      this.binanceService = services.binanceService;
      this.orderManager.setBinanceService(services.binanceService);

      // Initialize MarketDataService with BinanceService
      this.marketDataService = new MarketDataService(services.binanceService);
      this.setupMarketDataEventHandlers();

      // Initialize PairSelectorService for dynamic pair selection
      this.pairSelectorService = new PairSelectorService(services.binanceService);

      console.log("✅ Binance service connected");
    }

    if (services.logger) {
      this.logger = services.logger;
      console.log("✅ Logger service connected");
    }

    if (services.database) {
      this.database = services.database;
      console.log("✅ Database service connected");
    }
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
        const candles = this.marketDataService!.getCandles(update.symbol, "1m");
        this.marketDataCache.set(update.symbol, candles);

        if (this.logger) {
          this.logger.debug("Candle update received", {
            symbol: update.symbol,
            interval: "1m",
            candleCount: candles.length,
          });
        }
      } catch (error) {
        console.error("Error handling candle update:", error);
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
          // Update current market data
          const index = this.currentMarketData.findIndex(
            (data) => data.symbol === update.symbol,
          );
          if (index !== -1) {
            this.currentMarketData[index] = update.marketData;
          } else {
            this.currentMarketData.push(update.marketData);
          }

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
        console.error("Error handling market data update:", error);
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
      console.log("✅ MarketDataService started successfully");
      if (this.logger) {
        this.logger.info("MarketDataService started");
      }
    });

    this.marketDataService.on("stopped", () => {
      console.log("⏹️ MarketDataService stopped");
      if (this.logger) {
        this.logger.info("MarketDataService stopped");
      }
    });

    this.marketDataService.on("historicalDataRefreshed", (data) => {
      console.log(
        `📈 Historical data loaded for ${data.symbol} (${data.candles.length} candles)`,
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
      console.log("⚠️ Bot is already running");
      return;
    }

    try {
      console.log("🔧 Starting services...");

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
        console.log(
          `📊 Dashboard available at: http://localhost:${config.dashboard.port}`,
        );
      }

      // Start MarketDataService if available
      if (this.marketDataService) {
        console.log("📡 Starting MarketDataService...");
        await this.marketDataService.start();
      } else {
        console.log("⚠️ MarketDataService not available, using simulated data");
        // Initialize market data for all trading pairs (fallback)
        await this.initializeMarketData();
      }

      this.isRunning = true;
      console.log("✅ Crypto Scalping Bot is now running!");

      // Start main trading loop
      this.startTradingLoop();
    } catch (error) {
      console.error("❌ Failed to start bot:", error);
      throw error;
    }
  }

  /**
   * Stop the trading bot
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log("⚠️ Bot is not running");
      return;
    }

    console.log("🛑 Stopping Crypto Scalping Bot...");
    this.isRunning = false;

    try {
      // Stop periodic pair refresh timer if running
      if (this.volatilityRefreshTimer) {
        clearInterval(this.volatilityRefreshTimer);
        this.volatilityRefreshTimer = null;
      }

      // Stop MarketDataService
      if (this.marketDataService) {
        console.log("📡 Stopping MarketDataService...");
        await this.marketDataService.stop();
      }

      // Close all open positions
      await this.closeAllPositions("Bot shutdown");

      // Stop dashboard
      if (config.dashboard.enabled) {
        await this.dashboard.stop();
      }

      console.log("✅ Bot stopped successfully");
    } catch (error) {
      console.error("❌ Error stopping bot:", error);
      throw error;
    }
  }

  /**
   * Fetch high-volatility pairs from Binance and update the active trading pairs.
   * Called once on startup (in dynamic mode) and then periodically.
   */
  private async refreshVolatilityPairs(): Promise<void> {
    if (!this.pairSelectorService) {
      console.warn("⚠️ PairSelectorService not available — skipping volatility pair refresh");
      return;
    }

    console.log("🔍 Scanning Binance for high-volatility pairs...");

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
    console.log("📈 Initializing market data...");

    for (const pair of config.trading.pairs) {
      try {
        // Initialize with empty data - will be populated by real-time streams
        this.marketDataCache.set(pair, []);

        // Add to current market data with placeholder values
        this.currentMarketData.push({
          symbol: pair,
          price: 0,
          volume24h: 0,
          priceChange24h: 0,
          priceChangePercent24h: 0,
          bid: 0,
          ask: 0,
          spread: 0,
          timestamp: Date.now(),
        });

        console.log(`📊 Initialized ${pair}`);
      } catch (error) {
        console.error(`❌ Failed to initialize ${pair}:`, error);
      }
    }
  }

  /**
   * Main trading loop
   */
  private async startTradingLoop(): Promise<void> {
    console.log("🔄 Starting trading loop...");

    const loopInterval = 5000; // 5 seconds for scalping

    const tradingLoop = async () => {
      if (!this.isRunning) return;

      try {
        // Update market data (only if MarketDataService is not available)
        if (!this.marketDataService) {
          await this.updateMarketData();
        }

        // Monitor existing positions
        this.orderManager.monitorPositions(this.currentMarketData);

        // Generate trading signals for each pair
        for (const pair of config.trading.pairs) {
          if (!this.orderManager.canOpenNewPosition()) {
            break; // Stop looking for new trades if we can't open any
          }

          await this.processSignalForPair(pair);
        }

        // Update dashboard (if not using MarketDataService real-time updates)
        if (!this.marketDataService) {
          await this.updateDashboard();
        }

        // Update risk management
        this.updateRiskManagement();
      } catch (error) {
        console.error("❌ Error in trading loop:", error);
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
    for (let i = 0; i < this.currentMarketData.length; i++) {
      const data = this.currentMarketData[i];
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
  private async processSignalForPair(pair: string): Promise<void> {
    try {
      let candles: Candle[] = [];
      let marketData: MarketData | undefined;

      // Get data from MarketDataService if available, otherwise use cache
      if (this.marketDataService) {
        candles = this.marketDataService.getCandles(pair, "5m", 500);
        marketData = this.marketDataService.getMarketData(pair) || undefined;
      } else {
        candles = this.marketDataCache.get(pair) || [];
        marketData = this.currentMarketData.find(
          (data) => data.symbol === pair,
        );
      }

      if (!marketData) {
        if (this.logger) {
          this.logger.warn("No market data available for pair — waiting for ticker stream", {
            pair,
          });
        }
        return;
      }

      if (candles.length < 20) {
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
      const signal = this.strategy.generateSignal(candles, marketData);

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

      // Execute trades based on signals
      if (signal.type === "BUY" || signal.type === "SELL") {
        await this.executeSignal(pair, signal, marketData);
      }
    } catch (error) {
      console.error(`❌ Error processing signal for ${pair}:`, error);
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
        console.log(`⚠️ Order size too small for ${pair}: ${orderSize}`);
        return;
      }

      const orderRequest = {
        symbol: pair,
        side: signal.type as "BUY" | "SELL",
        type: "MARKET" as const,
        quantity: orderSize,
      };

      console.log(
        `🎯 Signal: ${signal.type} ${pair} - Confidence: ${signal.confidence}% - ${signal.reason}`,
      );

      const position = await this.orderManager.executeOrder(
        orderRequest,
        marketData,
      );

      if (position) {
        console.log(
          `✅ Position opened: ${position.side} ${position.quantity.toFixed(6)} ${position.symbol} @ $${position.entryPrice.toFixed(4)}`,
        );

        // Broadcast to dashboard
        this.dashboard.broadcastTrade(position);

        // Save to database if available
        if (this.database) {
          await this.database.saveTrade(position);
        }
      }
    } catch (error) {
      console.error(`❌ Error executing signal for ${pair}:`, error);
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
        console.error(`Error closing position ${position.id}:`, error);
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
      marketData: this.currentMarketData,
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
      console.error("🚨 CRITICAL RISK LEVEL DETECTED");
      console.error("Warnings:", riskHealth.warnings.join(", "));

      if (
        riskHealth.metrics.dailyPnlPercent <
        -config.trading.dailyLossLimit * 100
      ) {
        console.error(
          "🛑 Daily loss limit exceeded - triggering emergency stop",
        );
        this.riskManager.triggerEmergencyStop("Daily loss limit exceeded");
        // Close all open positions to cut further losses immediately
        this.closeAllPositions("Emergency stop: Daily loss limit exceeded");
      }
    }
  }

  /**
   * Get bot status
   */
  getStatus(): any {
    const status: any = {
      running: this.isRunning,
      mode: config.trading.mode,
      pairs: config.trading.pairs,
      portfolio: this.riskManager.getPortfolio(),
      riskHealth: this.riskManager.getRiskHealth(),
      services: {
        binance: !!this.binanceService,
        logger: !!this.logger,
        database: !!this.database,
        dashboard: config.dashboard.enabled,
        marketDataService: !!this.marketDataService,
      },
    };

    // Add MarketDataService specific status if available
    if (this.marketDataService) {
      status.marketDataStatus = {
        streamMetrics: this.marketDataService.getStreamMetrics(),
        connectionStatus: this.marketDataService.getConnectionStatus(),
        activeSymbols: config.trading.pairs,
        supportedIntervals: ["1m", "3m", "5m", "15m", "30m", "1h"],
      };
    }

    return status;
  }
}

// Main execution
async function main() {
  const bot = new CryptoScalpingBot();
  bot.setServices({
    binanceService: new BinanceService(),
    database: new DatabaseService(), // Replace with actual database service if available
    logger: logger,
  });

  // Graceful shutdown handling
  process.on("SIGINT", async () => {
    console.log("\n🛑 Received SIGINT, shutting down gracefully...");
    await bot.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\n🛑 Received SIGTERM, shutting down gracefully...");
    await bot.stop();
    process.exit(0);
  });

  try {
    // Start the bot
    await bot.start();
  } catch (error) {
    console.error("❌ Failed to start bot:", error);
    process.exit(1);
  }
}

// Export for testing
export { CryptoScalpingBot };

// Run if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Unhandled error:", error);
    process.exit(1);
  });
}
