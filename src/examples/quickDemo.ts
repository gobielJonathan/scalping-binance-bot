import { BinanceService } from '../services/binanceService';

async function quickDemo() {
  console.log('Binance Service Quick Demo');
  
  try {
    const service = new BinanceService();
    console.log('✅ Service initialized');
    
    // This works in paper mode
    const paperOrder = await service.placeOrder({
      symbol: 'BTCUSDT',
      side: 'BUY',
      type: 'MARKET',
      quantity: 0.001
    });
    
    console.log('✅ Paper order placed:', paperOrder.orderId);
    
    await service.disconnect();
    console.log('✅ Demo complete');
  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

export { quickDemo };