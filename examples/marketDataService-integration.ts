/**
 * Example Usage: MarketDataService Integration
 * 
 * This example shows how the MarketDataService integrates with the existing
 * crypto trading bot architecture to provide real-time market data streaming.
 */

import { MarketDataService } from '../src/services/marketDataService';
import { BinanceService } from '../src/services/binanceService';
import { ScalpingStrategy } from '../src/strategies/scalpingStrategy';
import config from '../src/config';

class ExampleIntegration {
  private marketDataService: MarketDataService;
  private strategy: ScalpingStrategy;
  
  constructor(binanceService: BinanceService) {
    this.marketDataService = new MarketDataService(binanceService);
    this.strategy = new ScalpingStrategy();
    
    this.setupEventHandlers();
  }

  /**
   * Setup event handlers for real-time data processing
   */
  private setupEventHandlers(): void {
    // Handle real-time candle updates
    this.marketDataService.on('candleUpdate', (update) => {
      console.log(`📊 New candle: ${update.symbol} - Close: $${update.candle?.close.toFixed(2)}`);
      
      // Get updated candle data for strategy analysis
      const candles = this.marketDataService.getCandles(update.symbol, '1m', 100);
      const marketData = this.marketDataService.getMarketData(update.symbol);
      
      if (candles.length >= 50 && marketData) {
        // Generate trading signal with fresh data
        const signal = this.strategy.generateSignal(candles, marketData);
        
        if (signal.type !== 'HOLD') {
          console.log(`🎯 Signal: ${signal.type} for ${update.symbol} (Strength: ${signal.strength}, Confidence: ${signal.confidence})`);
          console.log(`   Reason: ${signal.reason}`);
        }
      }
    });

    // Handle market data updates (price tickers)
    this.marketDataService.on('marketDataUpdate', (update) => {
      if (update.marketData) {
        console.log(`📈 Price update: ${update.symbol} = $${update.marketData.price.toFixed(2)} (${update.marketData.priceChangePercent24h.toFixed(2)}%)`);
      }
    });

    // Monitor performance metrics
    this.marketDataService.on('performanceMetrics', (metrics) => {
      console.log(`📊 Performance: ${metrics.activeStreams} streams, ${metrics.totalMessages} messages, ${metrics.avgLatency.toFixed(1)}ms avg latency`);
    });

    // Handle service lifecycle events
    this.marketDataService.on('started', () => {
      console.log('✅ MarketDataService is now streaming live data');
    });
    
    this.marketDataService.on('historicalDataRefreshed', (data) => {
      console.log(`📋 Loaded ${data.candles.length} historical candles for ${data.symbol}`);
    });
  }

  /**
   * Start the market data service and begin streaming
   */
  async start(): Promise<void> {
    console.log('🚀 Starting MarketDataService integration example...');
    
    try {
      // Start the market data service
      await this.marketDataService.start();
      
      console.log('📡 Real-time data streaming started for:');
      config.trading.pairs.forEach(pair => {
        console.log(`   • ${pair} (1m, 3m, 5m candles + price ticker)`);
      });
      
      // Show initial data status
      this.showDataStatus();
      
      // Set up periodic status updates
      setInterval(() => {
        this.showDataStatus();
      }, 30000); // Every 30 seconds
      
    } catch (error) {
      console.error('❌ Failed to start MarketDataService:', error);
      throw error;
    }
  }

  /**
   * Stop the service gracefully
   */
  async stop(): Promise<void> {
    console.log('🛑 Stopping MarketDataService...');
    await this.marketDataService.stop();
    console.log('✅ Stopped successfully');
  }

  /**
   * Show current data status and metrics
   */
  private showDataStatus(): void {
    console.log('\n📊 Current Data Status:');
    
    // Show data for each trading pair
    config.trading.pairs.forEach(symbol => {
      const candles = this.marketDataService.getCandles(symbol, '1m');
      const marketData = this.marketDataService.getMarketData(symbol);
      
      console.log(`  ${symbol}:`);
      console.log(`    📈 Price: ${marketData ? `$${marketData.price.toFixed(2)}` : 'N/A'}`);
      console.log(`    📊 Candles: ${candles.length} available`);
      
      if (candles.length > 0) {
        const latest = candles[candles.length - 1];
        console.log(`    🕐 Latest: ${new Date(latest!.closeTime).toLocaleTimeString()} - Close: $${latest!.close.toFixed(2)}`);
      }
    });
    
    // Show performance metrics
    const metrics = this.marketDataService.getStreamMetrics();
    const connections = this.marketDataService.getConnectionStatus();
    
    console.log('\n📡 Stream Status:');
    metrics.forEach(metric => {
      const isConnected = connections[`${metric.symbol}_${metric.interval}`];
      console.log(`    ${metric.symbol} ${metric.interval}: ${metric.totalMessages} msgs, ${metric.latencyMs}ms latency ${isConnected ? '✅' : '❌'}`);
    });
    
    console.log('---');
  }

  /**
   * Example of dynamic symbol management
   */
  async addNewSymbol(symbol: string): Promise<void> {
    console.log(`➕ Adding new symbol: ${symbol}`);
    
    try {
      await this.marketDataService.addSymbol(symbol, ['1m', '5m']);
      console.log(`✅ Successfully added ${symbol} to streaming`);
      
      // Wait a moment for data to arrive
      setTimeout(() => {
        const candles = this.marketDataService.getCandles(symbol, '1m');
        console.log(`📊 ${symbol} now has ${candles.length} candles available`);
      }, 2000);
      
    } catch (error) {
      console.error(`❌ Failed to add ${symbol}:`, error);
    }
  }

  /**
   * Example of getting data for strategy analysis
   */
  analyzeSymbol(symbol: string): void {
    console.log(`🔍 Analyzing ${symbol}...`);
    
    // Get various timeframe data
    const candles1m = this.marketDataService.getCandles(symbol, '1m', 50);
    const candles5m = this.marketDataService.getCandles(symbol, '5m', 20);
    const marketData = this.marketDataService.getMarketData(symbol);
    
    if (candles1m.length > 0 && marketData) {
      // Generate signals for different timeframes
      const signal1m = this.strategy.generateSignal(candles1m, marketData);
      
      console.log(`📊 ${symbol} Analysis:`);
      console.log(`   1m Signal: ${signal1m.type} (Strength: ${signal1m.strength}, Confidence: ${signal1m.confidence})`);
      console.log(`   Reason: ${signal1m.reason}`);
      console.log(`   Current Price: $${marketData.price.toFixed(2)}`);
      console.log(`   24h Change: ${marketData.priceChangePercent24h.toFixed(2)}%`);
      console.log(`   Volume: ${marketData.volume24h.toLocaleString()}`);
      
      // Show technical indicators
      if (signal1m.indicators) {
        console.log(`   EMA9: ${signal1m.indicators.ema9.toFixed(2)}`);
        console.log(`   EMA21: ${signal1m.indicators.ema21.toFixed(2)}`);
        console.log(`   RSI: ${signal1m.indicators.rsi.toFixed(1)}`);
        console.log(`   MACD: ${signal1m.indicators.macd.toFixed(4)}`);
      }
    } else {
      console.log(`⚠️ Insufficient data for ${symbol} analysis`);
    }
  }
}

// Example usage function
async function runExample() {
  console.log('🧪 MarketDataService Integration Example\n');
  
  // Note: This would normally use real BinanceService
  // For this example, we'll use a mock
  const mockBinanceService = {
    async startKlineStream() { console.log('Mock: Starting kline stream'); },
    async startPriceStream() { console.log('Mock: Starting price stream'); },
    async getKlines() { return []; }
  } as any;
  
  try {
    const integration = new ExampleIntegration(mockBinanceService);
    
    // Start streaming
    await integration.start();
    
    // Let it run for a bit
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    // Example analysis
    integration.analyzeSymbol('BTCUSDT');
    
    // Example adding new symbol
    await integration.addNewSymbol('ADAUSDT');
    
    // Let it run a bit more
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Stop gracefully
    await integration.stop();
    
  } catch (error) {
    console.error('Example failed:', error);
  }
}

// Export for use in other files
export { ExampleIntegration, runExample };

// Run if executed directly
if (require.main === module) {
  runExample().catch(console.error);
}