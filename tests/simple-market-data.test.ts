import { MarketDataService } from '../src/services/marketDataService';
import config from '../src/config';

// Simple mock without complex logging
const simpleMockBinance = {
  async startKlineStream(symbol: string, interval: string, callback: Function) {
    console.log(`📊 Starting kline stream for ${symbol} ${interval}`);
    setTimeout(() => {
      callback({
        openTime: Date.now() - 60000,
        open: 43000,
        high: 43500,
        low: 42500,
        close: 43200,
        volume: 100,
        closeTime: Date.now(),
        quoteVolume: 4320000,
        trades: 1500,
        baseAssetVolume: 80,
        quoteAssetVolume: 3456000
      });
    }, 100);
  },

  async startPriceStream(symbols: string[], callback: Function) {
    console.log(`📈 Starting price stream for ${symbols.join(', ')}`);
    symbols.forEach((symbol, index) => {
      setTimeout(() => {
        callback({
          symbol,
          price: 43000 + index * 1000,
          volume24h: 1000000,
          priceChange24h: 100,
          priceChangePercent24h: 0.5,
          bid: 42990 + index * 1000,
          ask: 43010 + index * 1000,
          spread: 20,
          timestamp: Date.now()
        });
      }, 200 + index * 100);
    });
  },

  async getKlines(symbol: string, interval: string, limit: number) {
    console.log(`📋 Getting historical data for ${symbol} ${interval} (${limit})`);
    const candles = [];
    const now = Date.now();
    
    for (let i = limit - 1; i >= 0; i--) {
      candles.push({
        openTime: now - (i * 60000),
        open: 43000 + Math.random() * 100,
        high: 43100 + Math.random() * 100,
        low: 42900 + Math.random() * 100,
        close: 43000 + Math.random() * 100,
        volume: 50 + Math.random() * 50,
        closeTime: now - (i * 60000) + 59999,
        quoteVolume: 2150000 + Math.random() * 100000,
        trades: 1000 + Math.random() * 500,
        baseAssetVolume: 40 + Math.random() * 20,
        quoteAssetVolume: 1720000 + Math.random() * 50000
      });
    }
    
    return candles;
  }
};

async function simpleTest() {
  console.log('🧪 Simple MarketDataService Test\n');
  
  try {
    // Create service
    const service = new MarketDataService(simpleMockBinance as any);
    
    // Basic event listener
    service.on('historicalDataRefreshed', (data) => {
      console.log(`✅ Historical data: ${data.symbol} - ${data.candles.length} candles`);
    });
    
    // Start service
    console.log('Starting MarketDataService...');
    await service.start();
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test data retrieval
    console.log('\n📊 Testing data retrieval:');
    for (const symbol of config.trading.pairs.slice(0, 2)) { // Test first 2 pairs
      const candles = service.getCandles(symbol, '1m');
      console.log(`${symbol}: ${candles.length} candles available`);
    }
    
    // Stop service
    console.log('\nStopping service...');
    await service.stop();
    
    console.log('✅ Test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

if (require.main === module) {
  simpleTest().catch(console.error);
}