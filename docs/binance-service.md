# Binance API Integration Service

A comprehensive TypeScript service for integrating with the Binance API, supporting both REST API operations and WebSocket real-time data streams.

## Features

### ✅ Complete API Coverage
- **Account Management**: Account info, balance checking
- **Order Management**: Place, cancel, and track orders
- **Market Data**: Symbol information, historical klines, real-time prices
- **WebSocket Streams**: Price tickers, kline data, user data streams

### ✅ Trading Modes
- **Paper Trading**: Full simulation mode for testing strategies
- **Live Trading**: Real trading with Binance API
- **Testnet Support**: Use Binance testnet for safe testing

### ✅ Enterprise Features
- **Rate Limiting**: Built-in compliance with Binance rate limits
- **Reconnection Logic**: Automatic WebSocket reconnection with exponential backoff
- **Error Handling**: Comprehensive error mapping and handling
- **Logging**: Detailed logging with the integrated logger service
- **TypeScript**: Full type safety and IntelliSense support

## Quick Start

```typescript
import { BinanceService } from './services/binanceService';

// Initialize the service
const binanceService = new BinanceService();

// Test connection
const isConnected = await binanceService.testConnection();

// Get account information
const accountInfo = await binanceService.getAccountInfo();

// Place an order (paper trading mode)
const order = await binanceService.placeOrder({
  symbol: 'BTCUSDT',
  side: 'BUY',
  type: 'MARKET',
  quantity: 0.001
});
```

## Configuration

The service automatically uses configuration from `src/config/index.ts`:

```typescript
{
  binance: {
    apiKey: string;        // Your Binance API key
    secretKey: string;     // Your Binance secret key
    testnet: boolean;      // Use testnet (default: true)
  },
  trading: {
    mode: 'paper' | 'live'; // Trading mode (default: 'paper')
    // ... other trading config
  }
}
```

### Environment Variables

```bash
# Binance API credentials
BINANCE_API_KEY=your_api_key
BINANCE_SECRET_KEY=your_secret_key
BINANCE_TESTNET=true

# Trading mode
TRADING_MODE=paper  # or 'live'
```

## API Reference

### Account Management

#### `getAccountInfo(): Promise<BinanceAccountInfo>`
Retrieves account information including permissions and balances.

#### `getBalance(asset?: string): Promise<BinanceBalance[]>`
Gets account balances. If `asset` is provided, returns balance for that specific asset.

### Order Management

#### `getOpenOrders(symbol?: string): Promise<BinanceOrder[]>`
Fetches open orders. Optionally filter by symbol.

#### `placeOrder(orderRequest: OrderRequest): Promise<any>`
Places a new order. In paper trading mode, simulates the order.

```typescript
interface OrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
}
```

#### `cancelOrder(symbol: string, orderId: number): Promise<any>`
Cancels an existing order.

### Market Data

#### `getSymbolInfo(symbol?: string): Promise<BinanceSymbolInfo | BinanceSymbolInfo[]>`
Retrieves exchange information for symbols. If no symbol provided, returns all symbols.

#### `getKlines(symbol: string, interval: string, limit?: number): Promise<Candle[]>`
Gets historical kline/candlestick data.

```typescript
// Example intervals: '1m', '5m', '15m', '1h', '4h', '1d', '1w'
const klines = await binanceService.getKlines('BTCUSDT', '1h', 100);
```

#### `getPrice(symbol?: string): Promise<MarketData | MarketData[]>`
Gets 24hr ticker price data.

### WebSocket Streams

#### `startPriceStream(symbols: string[], callback: (data: MarketData) => void): Promise<void>`
Starts a real-time price stream for multiple symbols.

```typescript
await binanceService.startPriceStream(['BTCUSDT', 'ETHUSDT'], (data) => {
  console.log(`${data.symbol}: $${data.price}`);
});
```

#### `startKlineStream(symbol: string, interval: string, callback: (data: Candle) => void): Promise<void>`
Starts a real-time kline stream for a symbol.

```typescript
await binanceService.startKlineStream('BTCUSDT', '1h', (candle) => {
  if (candle.closeTime > candle.openTime) {
    console.log('New candle closed:', candle);
  }
});
```

#### `startUserDataStream(callback: (data: UserDataStreamData) => void): Promise<void>`
Starts the user data stream for order updates and account changes.

#### `stopWebSocketStream(streamName?: string): void`
Stops WebSocket streams. If no streamName provided, stops all streams.

### Utility Methods

#### `testConnection(): Promise<boolean>`
Tests the connection to Binance API.

#### `getServerTime(): Promise<number>`
Gets Binance server time.

#### `convertToTradingPair(symbolInfo: BinanceSymbolInfo): TradingPair`
Converts Binance symbol info to internal TradingPair format.

#### `disconnect(): Promise<void>`
Cleanly disconnects all WebSocket connections.

## Error Handling

The service includes comprehensive error handling with specific error types:

```typescript
try {
  await binanceService.placeOrder(orderRequest);
} catch (error) {
  if (error.message.includes('Rate limit exceeded')) {
    // Handle rate limit
  } else if (error.message.includes('Invalid signature')) {
    // Handle auth error
  } else if (error.message.includes('NEW_ORDER_REJECTED')) {
    // Handle order rejection
  }
}
```

## Rate Limiting

The service automatically handles Binance rate limits:
- Max 1200 requests per minute
- Automatic request counting and throttling
- Rate limit warnings in logs

## Paper Trading

When `trading.mode` is set to `'paper'`, the service simulates all trading operations:
- Orders are simulated with realistic responses
- No real money is used
- Perfect for strategy testing
- All other API calls (market data, account info) work normally

## WebSocket Reconnection

Automatic reconnection for WebSocket streams:
- Up to 5 reconnection attempts
- Exponential backoff delay
- Automatic retry on connection loss
- Detailed logging of connection events

## Logging

All operations are logged using the integrated logger service:
- API calls and responses
- WebSocket events
- Rate limiting events
- Errors and warnings
- Performance metrics

## Dependencies

- `binance-api-node`: Official Binance API client
- `ws`: WebSocket client for real-time streams
- Built-in logger service for comprehensive logging

## Security Notes

- API keys are loaded from environment variables
- Never commit API keys to source control
- Use testnet for development and testing
- Paper trading mode for strategy development
- Proper error handling prevents key leakage in logs

## Testing

Comprehensive test suite included:
```bash
npm test src/tests/binanceService.test.ts
```

Tests cover:
- All API methods
- Error handling
- Paper trading simulation
- WebSocket management
- Rate limiting
- Type safety

## Examples

See `src/examples/binanceServiceDemo.ts` for a complete usage example.

```bash
# Run the demo
npx ts-node src/examples/binanceServiceDemo.ts
```