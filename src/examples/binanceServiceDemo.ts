import { BinanceService } from '../services/binanceService';

/**
 * Example usage of the BinanceService
 * This demonstrates how to use the Binance API integration service
 */
async function demonstrateBinanceService() {
  console.log('🚀 Binance Service Demo Starting...');

  try {
    // Initialize the service
    const binanceService = new BinanceService();

    console.log('✅ BinanceService initialized');

    // Test connection
    console.log('🔌 Testing connection...');
    const connectionTest = await binanceService.testConnection();
    console.log(`Connection test: ${connectionTest ? '✅ Success' : '❌ Failed'}`);

    // In paper trading mode, demonstrate order simulation
    console.log('📄 Demonstrating paper trading...');
    
    const paperOrder = await binanceService.placeOrder({
      symbol: 'BTCUSDT',
      side: 'BUY',
      type: 'MARKET',
      quantity: 0.001,
      price: 50000
    });

    console.log('📊 Paper order result:', {
      orderId: paperOrder.orderId,
      symbol: paperOrder.symbol,
      side: paperOrder.side,
      status: paperOrder.status
    });

    // Demonstrate order cancellation (simulation)
    const cancelResult = await binanceService.cancelOrder('BTCUSDT', 123456);
    console.log('❌ Cancel order result:', cancelResult);

    // Get symbol information (this will work in both paper and live mode)
    console.log('📈 Fetching symbol information...');
    try {
      const symbolInfo = await binanceService.getSymbolInfo('BTCUSDT');
      if (symbolInfo && !Array.isArray(symbolInfo)) {
        const tradingPair = binanceService.convertToTradingPair(symbolInfo);
        console.log('💰 Trading pair info:', {
          symbol: tradingPair.symbol,
          baseAsset: tradingPair.baseAsset,
          quoteAsset: tradingPair.quoteAsset,
          minQty: tradingPair.minQty,
          tickSize: tradingPair.tickSize
        });
      }
    } catch (error) {
      console.log('⚠️  Symbol info requires valid API credentials');
    }

    // Demonstrate WebSocket streams setup
    console.log('🌐 WebSocket stream methods available:');
    console.log('- startPriceStream()');
    console.log('- startKlineStream()'); 
    console.log('- startUserDataStream()');
    console.log('- stopWebSocketStream()');

    // Clean up
    await binanceService.disconnect();
    console.log('🛑 BinanceService disconnected');

    console.log('\n🎉 Demo completed successfully!');
    console.log('\n📚 Available methods:');
    console.log('Account Management:');
    console.log('  - getAccountInfo()');
    console.log('  - getBalance(asset?)');
    console.log('\nOrder Management:');
    console.log('  - getOpenOrders(symbol?)');
    console.log('  - placeOrder(orderRequest)');
    console.log('  - cancelOrder(symbol, orderId)');
    console.log('\nMarket Data:');
    console.log('  - getSymbolInfo(symbol?)');
    console.log('  - getKlines(symbol, interval, limit?)');
    console.log('  - getPrice(symbol?)');
    console.log('\nWebSocket Streams:');
    console.log('  - startPriceStream(symbols, callback)');
    console.log('  - startKlineStream(symbol, interval, callback)');
    console.log('  - startUserDataStream(callback)');
    console.log('  - stopWebSocketStream(streamName?)');
    console.log('\nUtility Methods:');
    console.log('  - testConnection()');
    console.log('  - getServerTime()');
    console.log('  - convertToTradingPair(symbolInfo)');
    console.log('  - disconnect()');

  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  demonstrateBinanceService();
}

export { demonstrateBinanceService };