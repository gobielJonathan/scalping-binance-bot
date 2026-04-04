import { MarketDataService } from '../src/services/marketDataService';
import config from '../src/config';

/**
 * Test script for MarketDataService
 * This tests the basic functionality without requiring live API keys
 */

async function testMarketDataService() {
  console.log('🧪 Testing MarketDataService...\n');

  try {
    // Create a mock BinanceService for testing
    const mockBinanceService = new Proxy({}, {
      get(_target: any, prop: string | symbol) {
        if (prop === 'startKlineStream') {
          return async (symbol: string, interval: string, callback: Function) => {
            console.log(`📊 Mock: Starting kline stream for ${symbol} ${interval}`);
            
            // Simulate periodic candle data
            const mockCandle = {
              openTime: Date.now() - 60000,
              open: 43000 + Math.random() * 1000,
              high: 43500 + Math.random() * 1000,
              low: 42500 + Math.random() * 1000,
              close: 43000 + Math.random() * 1000,
              volume: 100 + Math.random() * 50,
              closeTime: Date.now(),
              quoteVolume: 4300000 + Math.random() * 500000,
              trades: 1000 + Math.random() * 500,
              baseAssetVolume: 80 + Math.random() * 40,
              quoteAssetVolume: 3440000 + Math.random() * 400000
            };
            
            // Call callback immediately for testing
            setTimeout(() => callback(mockCandle), 100);
            
            return Promise.resolve();
          };
        }
        
        if (prop === 'startPriceStream') {
          return async (symbols: string[], callback: Function) => {
            console.log(`📈 Mock: Starting price stream for ${symbols.join(', ')}`);
            
            // Simulate market data updates for each symbol
            symbols.forEach((symbol, index) => {
              const mockMarketData = {
                symbol,
                price: 43000 + index * 1000 + Math.random() * 100,
                volume24h: 1000000 + Math.random() * 500000,
                priceChange24h: -100 + Math.random() * 200,
                priceChangePercent24h: -2 + Math.random() * 4,
                bid: 42990 + index * 1000,
                ask: 43010 + index * 1000,
                spread: 20,
                timestamp: Date.now()
              };
              
              setTimeout(() => callback(mockMarketData), 200 + index * 100);
            });
            
            return Promise.resolve();
          };
        }
        
        if (prop === 'getKlines') {
          return async (symbol: string, interval: string, limit: number) => {
            console.log(`📋 Mock: Getting historical klines for ${symbol} ${interval} (${limit})`);
            
            // Generate mock historical candles
            const candles = [];
            const now = Date.now();
            const intervalMs = interval === '1m' ? 60000 : 180000; // 1m or 3m
            
            for (let i = limit - 1; i >= 0; i--) {
              const openTime = now - (i * intervalMs);
              const basePrice = 43000;
              
              candles.push({
                openTime,
                open: basePrice + Math.random() * 100 - 50,
                high: basePrice + Math.random() * 200,
                low: basePrice - Math.random() * 200,
                close: basePrice + Math.random() * 100 - 50,
                volume: 50 + Math.random() * 100,
                closeTime: openTime + intervalMs - 1,
                quoteVolume: (basePrice * (50 + Math.random() * 100)),
                trades: 500 + Math.random() * 1000,
                baseAssetVolume: 40 + Math.random() * 80,
                quoteAssetVolume: basePrice * (40 + Math.random() * 80)
              });
            }
            
            return candles;
          };
        }
        
        return () => Promise.resolve();
      }
    }) as any;

    // Initialize MarketDataService
    console.log('1️⃣ Creating MarketDataService instance...');
    const marketDataService = new MarketDataService(mockBinanceService);
    console.log('✅ MarketDataService created\n');

    // Set up event listeners
    console.log('2️⃣ Setting up event listeners...');
    let candleUpdateCount = 0;
    let marketDataUpdateCount = 0;
    
    marketDataService.on('candleUpdate', (update) => {
      candleUpdateCount++;
      console.log(`📊 Candle update #${candleUpdateCount}: ${update.symbol} - ${new Date(update.candle?.openTime || 0).toLocaleTimeString()}`);
    });

    marketDataService.on('marketDataUpdate', (update) => {
      marketDataUpdateCount++;
      console.log(`📈 Market data update #${marketDataUpdateCount}: ${update.symbol} - $${update.marketData?.price.toFixed(2)}`);
    });

    marketDataService.on('historicalDataRefreshed', (data) => {
      console.log(`📋 Historical data loaded: ${data.symbol} - ${data.candles.length} candles`);
    });

    marketDataService.on('performanceMetrics', (metrics) => {
      console.log(`📊 Performance metrics - Active streams: ${metrics.activeStreams}, Total messages: ${metrics.totalMessages}`);
    });

    console.log('✅ Event listeners configured\n');

    // Start the service
    console.log('3️⃣ Starting MarketDataService...');
    await marketDataService.start();
    console.log('✅ MarketDataService started\n');

    // Wait a bit for data to flow
    console.log('4️⃣ Waiting for real-time data...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Test data retrieval
    console.log('5️⃣ Testing data retrieval...');
    for (const symbol of config.trading.pairs) {
      const candles = marketDataService.getCandles(symbol, '1m', 10);
      const marketData = marketDataService.getMarketData(symbol);
      
      console.log(`${symbol}:`);
      console.log(`  📊 Candles: ${candles.length} available`);
      console.log(`  📈 Market Data: ${marketData ? `$${marketData.price.toFixed(2)}` : 'Not available'}`);
      
      if (candles.length > 0) {
        const latest = candles[candles.length - 1];
        if (latest) {
          console.log(`  🕐 Latest candle: ${new Date(latest.openTime).toLocaleTimeString()} - Close: $${latest.close.toFixed(2)}`);
        }
      }
      console.log('');
    }

    // Test performance metrics
    console.log('6️⃣ Performance metrics:');
    const streamMetrics = marketDataService.getStreamMetrics();
    streamMetrics.forEach(metric => {
      console.log(`  ${metric.symbol} ${metric.interval}: ${metric.totalMessages} messages, ${metric.latencyMs}ms latency`);
    });

    const connectionStatus = marketDataService.getConnectionStatus();
    console.log('  Connection status:', connectionStatus);
    console.log('');

    // Test adding a new symbol
    console.log('7️⃣ Testing dynamic symbol addition...');
    try {
      await marketDataService.addSymbol('ADAUSDT', ['1m']);
      console.log('✅ Successfully added ADAUSDT');
      
      // Wait a bit and check data
      await new Promise(resolve => setTimeout(resolve, 1000));
      const adaCandles = marketDataService.getCandles('ADAUSDT', '1m');
      console.log(`  📊 ADA Candles: ${adaCandles.length} available\n`);
    } catch (error: any) {
      console.error('❌ Error adding symbol:', error?.message || String(error));
    }

    // Stop the service
    console.log('8️⃣ Stopping MarketDataService...');
    await marketDataService.stop();
    console.log('✅ MarketDataService stopped\n');

    console.log('🎉 All tests completed successfully!');
    console.log(`📊 Total candle updates received: ${candleUpdateCount}`);
    console.log(`📈 Total market data updates received: ${marketDataUpdateCount}`);

  } catch (error: any) {
    console.error('❌ Test failed:', error);
    console.error(error?.stack || String(error));
  }
}

// Run the test
if (require.main === module) {
  testMarketDataService().catch(console.error);
}

export { testMarketDataService };