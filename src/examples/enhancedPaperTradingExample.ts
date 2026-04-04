import { 
  PaperTradingService,
  PaperTradingValidator,
  OrderManager,
  RiskManager,
  BinanceService,
  DatabaseService,
  logger
} from '../services';
import config from '../config';
import { MarketData, OrderRequest } from '../types';

/**
 * Enhanced paper trading integration example
 * Demonstrates how to use the new paper trading system with all features
 */
class EnhancedPaperTradingExample {
  private paperTradingService: PaperTradingService;
  private paperTradingValidator: PaperTradingValidator;
  private orderManager: OrderManager;
  private riskManager: RiskManager;
  private dbService: DatabaseService;
  private binanceService: BinanceService;

  constructor() {
    // Initialize services
    this.dbService = new DatabaseService();
    this.riskManager = new RiskManager(config.trading.initialCapital);
    this.orderManager = new OrderManager(this.riskManager);
    
    // Initialize Binance service for market data
    this.binanceService = new BinanceService();

    // Initialize enhanced paper trading
    this.paperTradingService = new PaperTradingService(
      config.trading.initialCapital,
      this.riskManager,
      this.dbService
    );

    // Initialize validation service
    this.paperTradingValidator = new PaperTradingValidator(this.dbService);
    this.paperTradingValidator.setPaperTradingService(this.paperTradingService);
    this.paperTradingValidator.setBinanceService(this.binanceService);

    // Set up dependencies
    this.orderManager.setDatabaseService(this.dbService);
    this.orderManager.setBinanceService(this.binanceService);
  }

  /**
   * Start the enhanced paper trading demonstration
   */
  async start(): Promise<void> {
    try {
      logger.info('Starting Enhanced Paper Trading Demo...');
      
      // Initialize database
      await this.dbService.initializeDatabase();
      
      // Start market data streams
      await this.startMarketDataStream();
      
      // Start the demo trading loop
      this.startTradingLoop();
      
      logger.info('Enhanced paper trading demo started successfully');
    } catch (error) {
      logger.error(`Error starting paper trading demo: ${error}`);
    }
  }

  /**
   * Start market data streaming for realistic price simulation
   */
  private async startMarketDataStream(): Promise<void> {
    // Subscribe to market data for configured pairs
    for (const symbol of config.trading.pairs) {
      // Start price stream instead of ticker subscription
      this.binanceService.startPriceStream([symbol], (marketData) => {
        // Process market data for realistic simulation
        this.processTick(marketData);

        // Update paper trading service with real market data
        this.orderManager.updateMarketData(marketData);

        // Update positions with current prices
        this.updatePositionsWithMarketData([marketData]);
      });
    }
  }

  /**
   * Process incoming tick data
   */
  private processTick(marketData: MarketData): void {
    // Update paper trading simulation with real market data
    console.log(`Market data received for ${marketData.symbol}: $${marketData.price}`);
  }

  /**
   * Execute a paper trade with full simulation
   * @param symbol Trading pair (e.g., 'BTCUSDT')
   * @param side Order side ('BUY' or 'SELL')
   * @param quantity Order quantity
   */
  async executePaperTrade(symbol: string, side: 'BUY' | 'SELL', quantity: number): Promise<void> {
    try {
      logger.info(`Executing paper ${side} order for ${quantity} ${symbol}`);

      // Get current market price
      const priceData = await this.binanceService.getPrice(symbol);
      // Handle both single price and array of prices
      const currentPrice = Array.isArray(priceData) ? priceData[0].price : priceData.price;
      
      // Create order request
      const orderRequest: OrderRequest = {
        symbol,
        side,
        type: 'MARKET',
        quantity,
        price: currentPrice
      };

      // Execute through order manager (will use paper trading)
      // Create minimal market data for the current price
      const marketData: MarketData = {
        symbol,
        price: currentPrice,
        volume24h: 0,
        priceChange24h: 0,
        priceChangePercent24h: 0,
        bid: currentPrice,
        ask: currentPrice,
        spread: 0,
        timestamp: Date.now()
      };
      
      const result = await this.orderManager.executeOrder(orderRequest, marketData);
      
      if (result) {
        logger.info(`Paper trade executed successfully: ${JSON.stringify(result)}`);
        
        // Note: PaperTradingValidator.validateTrade method doesn't exist in the current implementation
        // This would need to be implemented if validation is required
        logger.info(`Trade executed with ID: ${result.id}`);
      } else {
        logger.error(`Paper trade failed: Order could not be executed`);
      }
    } catch (error) {
      logger.error(`Error executing paper trade: ${error}`);
    }
  }

  /**
   * Update positions with current market data
   */
  private async updatePositionsWithMarketData(marketDataArray: MarketData[]): Promise<void> {
    try {
      for (const marketData of marketDataArray) {
        // The PaperTradingService doesn't have updateMarketPrice method
        // Instead we can log the price updates
        logger.debug(`Market price updated for ${marketData.symbol}: $${marketData.price}`);
      }
    } catch (error) {
      logger.error(`Error updating positions with market data: ${error}`);
    }
  }

  /**
   * Start automated trading loop for demonstration
   */
  private startTradingLoop(): void {
    setInterval(async () => {
      try {
        // Generate random trades for demonstration
        const symbols = config.trading.pairs;
        const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];
        const randomSide = Math.random() > 0.5 ? 'BUY' : 'SELL';
        const randomQuantity = parseFloat((Math.random() * 0.01 + 0.001).toFixed(6));

        // Execute demo trade
        await this.executePaperTrade(randomSymbol, randomSide, randomQuantity);
        
        // Display current portfolio status
        await this.displayPortfolioStatus();
        
      } catch (error) {
        logger.error(`Error in trading loop: ${error}`);
      }
    }, 30000); // Execute every 30 seconds
  }

  /**
   * Display current portfolio and trading statistics
   */
  async displayPortfolioStatus(): Promise<void> {
    try {
      // Since getPortfolio and getPerformanceMetrics don't exist,
      // we'll create a basic status display
      console.log('\n=== Portfolio Status ===');
      console.log(`Paper trading simulation running...`);
      console.log('Note: Full portfolio metrics require implementing getPortfolio() and getPerformanceMetrics() methods');
      console.log('========================\n');
      
    } catch (error) {
      logger.error(`Error displaying portfolio status: ${error}`);
    }
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down paper trading demo...');
      
      // Disconnect from Binance streams
      this.binanceService.disconnect();
      
      // Close database connections
      await this.dbService.close();
      
      logger.info('Paper trading demo shutdown complete');
    } catch (error) {
      logger.error(`Error during shutdown: ${error}`);
    }
  }
}

// Demo usage
async function runPaperTradingDemo() {
  const demo = new EnhancedPaperTradingExample();
  
  try {
    await demo.start();
    
    // Keep running for demonstration
    console.log('Paper trading demo is running. Press Ctrl+C to stop.');
    
    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      await demo.shutdown();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Error running paper trading demo:', error);
  }
}

// Export for use in other modules
export { EnhancedPaperTradingExample };

// Run if this file is executed directly
if (require.main === module) {
  runPaperTradingDemo().catch(console.error);
}