import { BinanceService } from '../services/binanceService';
import { OrderRequest } from '../types';

async function quickDemo() {
  console.log('Binance Service Quick Demo');
  
  try {
    const service = new BinanceService();
    console.log('✅ Service initialized');
    
    // This works in paper mode
    const paperOrderRequest: OrderRequest = {
      symbol: 'BTCUSDT',
      side: 'BUY',
      type: 'MARKET',
      quantity: 0.001
    };
    const paperOrder = await service.placeOrder(paperOrderRequest);
    
    console.log('✅ Paper order placed:', paperOrder.orderId);
    
    await service.disconnect();
    console.log('✅ Demo complete');
  } catch (error) {
    console.error('❌ Demo failed:', error);
  }
}

export { quickDemo };
