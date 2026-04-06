import { BinanceService } from '../services/binanceService';
import config from '../config/index';
import { OrderRequest } from '../types';
import { OrderType } from 'binance-api-node';

// Mock WebSocket for testing
jest.mock('ws');
jest.mock('binance-api-node');

describe('BinanceService', () => {
  let binanceService: BinanceService;

  beforeEach(() => {
    // Reset config to paper trading mode for tests
    config.trading.mode = 'paper';
    binanceService = new BinanceService();
  });

  afterEach(() => {
    if (binanceService) {
      binanceService.disconnect();
    }
  });

  describe('Initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(binanceService).toBeDefined();
      expect(binanceService).toBeInstanceOf(BinanceService);
    });

    it('should set testnet URLs when testnet is enabled', () => {
      config.binance.testnet = true;
      const service = new BinanceService();
      expect(service).toBeDefined();
    });
  });

  describe('Account Information', () => {
    it('should fetch account info', async () => {
      // Mock the Binance client
      const mockAccountInfo = {
        makerCommission: 10,
        takerCommission: 10,
        buyerCommission: 0,
        sellerCommission: 0,
        canTrade: true,
        canWithdraw: true,
        canDeposit: true,
        updateTime: Date.now(),
        accountType: 'SPOT',
        permissions: ['SPOT'],
        balances: [
          { asset: 'BTC', free: '1.00000000', locked: '0.00000000' },
          { asset: 'USDT', free: '1000.00000000', locked: '0.00000000' }
        ]
      };

      // Mock implementation
      const mockClient = {
        accountInfo: jest.fn().mockResolvedValue(mockAccountInfo)
      };
      (binanceService as any).client = mockClient;

      const result = await binanceService.getAccountInfo();
      expect(result).toEqual(mockAccountInfo);
      expect(mockClient.accountInfo).toHaveBeenCalled();
    });

    it('should get balance for specific asset', async () => {
      const mockAccountInfo = {
        balances: [
          { asset: 'BTC', free: '1.00000000', locked: '0.00000000' },
          { asset: 'USDT', free: '1000.00000000', locked: '0.00000000' }
        ]
      };

      const mockClient = {
        accountInfo: jest.fn().mockResolvedValue(mockAccountInfo)
      };
      (binanceService as any).client = mockClient;

      const result = await binanceService.getBalance('BTC');
      expect(result).toHaveLength(1);
      expect(result[0]?.asset).toBe('BTC');
      expect(result[0]?.free).toBe(1);
      expect(result[0]?.locked).toBe(0);
      expect(result[0]?.total).toBe(1);
    });
  });

  describe('Order Management', () => {
    it('should simulate order placement in paper trading mode', async () => {
      const orderRequest: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: OrderType.MARKET,
        quantity: 0.001,
        price: 50000
      };

      const result = await binanceService.placeOrder(orderRequest);
      
      expect(result).toBeDefined();
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.status).toBe('FILLED');
      expect(result.side).toBe('BUY');
      expect(result.orderId).toBeDefined();
    });

    it('should simulate order cancellation in paper trading mode', async () => {
      const result = await binanceService.cancelOrder('BTCUSDT', 123456);
      
      expect(result).toBeDefined();
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.orderId).toBe(123456);
      expect(result.status).toBe('CANCELED');
    });

    it('should fetch open orders', async () => {
      const mockOrders = [
        {
          symbol: 'BTCUSDT',
          orderId: 123456,
          price: '50000.00',
          origQty: '0.001',
          status: 'NEW',
          side: 'BUY',
          type: 'LIMIT'
        }
      ];

      const mockClient = {
        openOrders: jest.fn().mockResolvedValue(mockOrders)
      };
      (binanceService as any).client = mockClient;

      const result = await binanceService.getOpenOrders();
      expect(result).toEqual(mockOrders);
      expect(mockClient.openOrders).toHaveBeenCalled();
    });
  });

  describe('Market Data', () => {
    it('should fetch symbol information', async () => {
      const mockExchangeInfo = {
        symbols: [
          {
            symbol: 'BTCUSDT',
            status: 'TRADING',
            baseAsset: 'BTC',
            quoteAsset: 'USDT',
            filters: [
              {
                filterType: 'LOT_SIZE',
                minQty: '0.00001',
                maxQty: '900000000',
                stepSize: '0.00001'
              },
              {
                filterType: 'PRICE_FILTER',
                minPrice: '0.01',
                maxPrice: '1000000',
                tickSize: '0.01'
              }
            ]
          }
        ]
      };

      const mockClient = {
        exchangeInfo: jest.fn().mockResolvedValue(mockExchangeInfo)
      };
      (binanceService as any).client = mockClient;

      const result = await binanceService.getSymbolInfo('BTCUSDT');
      expect(result).toBeDefined();
      expect((result as any)?.symbol).toBe('BTCUSDT');
      expect(mockClient.exchangeInfo).toHaveBeenCalled();
    });

    it('should fetch klines data', async () => {
      const mockKlines = [
        {
          openTime: 1634567890000,
          open: '50000.00',
          high: '51000.00',
          low: '49500.00',
          close: '50500.00',
          volume: '123.45',
          closeTime: 1634567949999,
          quoteAssetVolume: '6172500.00',
          trades: 1500,
          baseAssetVolume: '61.725',
          quoteBuyAssetVolume: '3086250.00'
        }
      ];

      const mockClient = {
        candles: jest.fn().mockResolvedValue(mockKlines)
      };
      (binanceService as any).client = mockClient;

      const result = await binanceService.getKlines('BTCUSDT', '1h');
      expect(result).toHaveLength(1);
      expect(result[0].open).toBe(50000);
      expect(result[0].close).toBe(50500);
      expect(mockClient.candles).toHaveBeenCalledWith({
        symbol: 'BTCUSDT',
        interval: '1h',
        limit: 500
      });
    });

    it('should fetch price data', async () => {
      const mockTicker = {
        symbol: 'BTCUSDT',
        lastPrice: '50000.00',
        volume: '123456.78',
        priceChange: '500.00',
        priceChangePercent: '1.00',
        bidPrice: '49999.00',
        askPrice: '50001.00'
      };

      const mockClient = {
        dailyStats: jest.fn().mockResolvedValue(mockTicker)
      };
      (binanceService as any).client = mockClient;

      const result = await binanceService.getPrice('BTCUSDT');
      expect(result).toBeDefined();
      expect((result as any)?.symbol).toBe('BTCUSDT');
      expect((result as any)?.price).toBe(50000);
      expect(mockClient.dailyStats).toHaveBeenCalledWith({ symbol: 'BTCUSDT' });
    });
  });

  describe('Utility Methods', () => {
    it('should convert symbol info to trading pair', () => {
      const symbolInfo = {
        symbol: 'BTCUSDT',
        baseAsset: 'BTC',
        quoteAsset: 'USDT',
        filters: [
          {
            filterType: 'LOT_SIZE',
            minQty: '0.00001',
            maxQty: '900000000',
            stepSize: '0.00001'
          },
          {
            filterType: 'PRICE_FILTER',
            minPrice: '0.01',
            maxPrice: '1000000',
            tickSize: '0.01'
          }
        ]
      };

      const result = binanceService.convertToTradingPair(symbolInfo as any);
      expect(result).toBeDefined();
      expect(result.symbol).toBe('BTCUSDT');
      expect(result.baseAsset).toBe('BTC');
      expect(result.quoteAsset).toBe('USDT');
      expect(result.minQty).toBe(0.00001);
      expect(result.tickSize).toBe(0.01);
    });

    it('should test connection', async () => {
      const mockClient = {
        ping: jest.fn().mockResolvedValue({})
      };
      (binanceService as any).client = mockClient;

      const result = await binanceService.testConnection();
      expect(result).toBe(true);
      expect(mockClient.ping).toHaveBeenCalled();
    });

    it('should handle connection test failure', async () => {
      const mockClient = {
        ping: jest.fn().mockRejectedValue(new Error('Connection failed'))
      };
      (binanceService as any).client = mockClient;

      const result = await binanceService.testConnection();
      expect(result).toBe(false);
    });

    it('should get server time', async () => {
      const mockTime = { serverTime: Date.now() };
      const mockClient = {
        time: jest.fn().mockResolvedValue(mockTime)
      };
      (binanceService as any).client = mockClient;

      const result = await binanceService.getServerTime();
      expect(result).toBe(mockTime.serverTime);
      expect(mockClient.time).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle Binance API errors correctly', async () => {
      const mockError = {
        code: -1021,
        msg: 'Timestamp for this request is outside the recvWindow'
      };

      const mockClient = {
        accountInfo: jest.fn().mockRejectedValue(mockError)
      };
      (binanceService as any).client = mockClient;

      await expect(binanceService.getAccountInfo()).rejects.toThrow(
        'Timestamp for this request is outside the recvWindow'
      );
    });

    it('should handle rate limit errors', async () => {
      const mockError = {
        code: -1003,
        msg: 'Too many requests'
      };

      const mockClient = {
        accountInfo: jest.fn().mockRejectedValue(mockError)
      };
      (binanceService as any).client = mockClient;

      await expect(binanceService.getAccountInfo()).rejects.toThrow(
        'Too many requests - Rate limit exceeded'
      );
    });
  });

  describe('Rate Limiting', () => {
    it('should track request count', async () => {
      const initialCount = (binanceService as any).requestCount;
      
      const mockClient = {
        accountInfo: jest.fn().mockResolvedValue({})
      };
      (binanceService as any).client = mockClient;

      await binanceService.getAccountInfo();
      
      const newCount = (binanceService as any).requestCount;
      expect(newCount).toBe(initialCount + 1);
    });
  });

  describe('WebSocket Management', () => {
    it('should handle WebSocket stream lifecycle', () => {
      expect(binanceService.stopWebSocketStream).toBeDefined();
      expect(binanceService.startPriceStream).toBeDefined();
      expect(binanceService.startKlineStream).toBeDefined();
      expect(binanceService.startUserDataStream).toBeDefined();
    });

    it('should stop all WebSocket streams', () => {
      // Mock WebSocket connections
      const mockWs = { close: jest.fn() };
      (binanceService as any).wsConnections.set('test-stream', mockWs);

      binanceService.stopWebSocketStream();
      
      expect(mockWs.close).toHaveBeenCalled();
      expect((binanceService as any).wsConnections.size).toBe(0);
    });
  });
});
