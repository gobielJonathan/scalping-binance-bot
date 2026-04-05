import Binance, { OrderType, OrderSide, TimeInForce } from 'binance-api-node';
import WebSocket from 'ws';
import config from '../config/index';
import { 
  TradingPair, 
  Candle, 
  OrderRequest, 
  MarketData
} from '../types/index';
import { logger } from './logger';

export interface BinanceAccountInfo {
  makerCommission: number;
  takerCommission: number;
  buyerCommission: number;
  sellerCommission: number;
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  updateTime: number;
  accountType: string;
  permissions: string[];
  balances: Array<{
    asset: string;
    free: string;
    locked: string;
  }>;
}

export interface BinanceBalance {
  asset: string;
  free: number;
  locked: number;
  total: number;
}

export interface BinanceOrder {
  symbol: string;
  orderId: number;
  orderListId: number;
  clientOrderId: string;
  price: string;
  origQty: string;
  executedQty: string;
  cummulativeQuoteQty: string;
  status: string;
  timeInForce: string;
  type: string;
  side: string;
  stopPrice: string;
  icebergQty: string;
  time: number;
  updateTime: number;
  isWorking: boolean;
  origQuoteOrderQty: string;
}

export interface BinanceSymbolInfo {
  symbol: string;
  status: string;
  baseAsset: string;
  baseAssetPrecision: number;
  quoteAsset: string;
  quotePrecision: number;
  quoteAssetPrecision: number;
  baseCommissionPrecision: number;
  quoteCommissionPrecision: number;
  orderTypes: string[];
  icebergAllowed: boolean;
  ocoAllowed: boolean;
  quoteOrderQtyMarketAllowed: boolean;
  allowTrailingStop: boolean;
  cancelReplaceAllowed: boolean;
  isSpotTradingAllowed: boolean;
  isMarginTradingAllowed: boolean;
  filters: Array<{
    filterType: string;
    minPrice?: string;
    maxPrice?: string;
    tickSize?: string;
    minQty?: string;
    maxQty?: string;
    stepSize?: string;
    minNotional?: string;
    applyToMarket?: boolean;
    avgPriceMins?: number;
    limit?: number;
    maxNumOrders?: number;
    maxNumAlgoOrders?: number;
  }>;
  permissions: string[];
}

export interface WebSocketMessage {
  stream: string;
  data: any;
}

export interface PriceTickerData {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  c: string; // Close price
  o: string; // Open price
  h: string; // High price
  l: string; // Low price
  v: string; // Total traded base asset volume
  q: string; // Total traded quote asset volume
  O: number; // Statistics open time
  C: number; // Statistics close time
  F: number; // First trade ID
  L: number; // Last trade ID
  n: number; // Total number of trades
}

export interface KlineData {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  k: {
    t: number; // Kline start time
    T: number; // Kline close time
    s: string; // Symbol
    i: string; // Interval
    f: number; // First trade ID
    L: number; // Last trade ID
    o: string; // Open price
    c: string; // Close price
    h: string; // High price
    l: string; // Low price
    v: string; // Base asset volume
    n: number; // Number of trades
    x: boolean; // Is this kline closed?
    q: string; // Quote asset volume
    V: string; // Taker buy base asset volume
    Q: string; // Taker buy quote asset volume
    B: string; // Ignore
  };
}

export interface UserDataStreamData {
  e: string; // Event type
  E: number; // Event time
  s?: string; // Symbol
  c?: string; // Client order ID
  S?: string; // Side
  o?: string; // Order type
  f?: string; // Time in force
  q?: string; // Order quantity
  p?: string; // Order price
  P?: string; // Stop price
  F?: string; // Iceberg quantity
  g?: number; // OrderListId
  C?: string; // Original client order ID
  x?: string; // Current execution type
  X?: string; // Current order status
  r?: string; // Order reject reason
  i?: number; // Order ID
  l?: string; // Last executed quantity
  z?: string; // Cumulative filled quantity
  L?: string; // Last executed price
  n?: string; // Commission amount
  N?: string; // Commission asset
  T?: number; // Transaction time
  t?: number; // Trade ID
  I?: number; // Ignore
  w?: boolean; // Is the order working?
  m?: boolean; // Is this trade the maker side?
  M?: boolean; // Ignore
  O?: number; // Order creation time
  Z?: string; // Cumulative quote asset transacted quantity
  Y?: string; // Last quote asset transacted quantity
  Q?: string; // Quote Order Qty
}

export class BinanceService {
  private client: any;
  private wsConnections: Map<string, WebSocket> = new Map();
  private wsReconnectAttempts: Map<string, number> = new Map();
  private maxReconnectAttempts = 5;
  private reconnectDelay = 5000; // 5 seconds
  private requestCount = 0;
  private requestWindow = 60000; // 1 minute
  private maxRequestsPerWindow = 1200; // Binance limit
  private isTestnet: boolean;
  private baseURL: string;
  private wsBaseURL: string;
  private listenKey: string | null = null;

  constructor() {
    this.isTestnet = config.binance.testnet;
    this.baseURL = this.isTestnet 
      ? 'https://demo-api.binance.com'
      : 'https://api.binance.com';
    this.wsBaseURL = this.isTestnet 
      ? 'wss://demo-stream.binance.com:9443/ws'
      : 'wss://stream.binance.com:9443/ws';

    this.initializeClient();
    this.setupRateLimiting();
  }

  private initializeClient(): void {
    try {
      this.client = Binance({
        apiKey: config.binance.apiKey,
        apiSecret: config.binance.secretKey,
        httpBase: this.baseURL,
        wsBase: this.wsBaseURL.replace('/ws', ''),
        getTime: () => Date.now()
      });

      logger.info('Binance client initialized', {
        source: 'BinanceService',
        context: { 
          testnet: this.isTestnet,
          baseURL: this.baseURL
        }
      });
    } catch (error) {
      logger.error('Failed to initialize Binance client', { 
        source: 'BinanceService', 
        error: { stack: error instanceof Error ? error.stack : String(error) }
      });
      throw error;
    }
  }

  private setupRateLimiting(): void {
    setInterval(() => {
      this.requestCount = 0;
    }, this.requestWindow);
  }

  private async checkRateLimit(): Promise<void> {
    if (this.requestCount >= this.maxRequestsPerWindow) {
      const waitTime = this.requestWindow;
      logger.warn(`Rate limit reached, waiting ${waitTime}ms`, { 
        source: 'BinanceService',
        context: { waitTime }
      });
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    this.requestCount++;
  }

  // Account Information Methods
  async getAccountInfo(): Promise<BinanceAccountInfo> {
    await this.checkRateLimit();
    try {
      logger.debug('Fetching account info', { 
        source: 'BinanceService'
      });
      const accountInfo = await this.client.accountInfo();
      logger.info('Account info retrieved successfully', { 
        source: 'BinanceService'
      });
      return accountInfo;
    } catch (error) {
      logger.error('Failed to fetch account info', { 
        source: 'BinanceService',
        error: { stack: error instanceof Error ? error.stack : String(error) }
      });
      throw this.handleBinanceError(error);
    }
  }

  async getBalance(asset?: string): Promise<BinanceBalance[]> {
    const accountInfo = await this.getAccountInfo();
    const balances = accountInfo.balances
      .filter(balance => asset ? balance.asset === asset : parseFloat(balance.free) > 0 || parseFloat(balance.locked) > 0)
      .map(balance => ({
        asset: balance.asset,
        free: parseFloat(balance.free),
        locked: parseFloat(balance.locked),
        total: parseFloat(balance.free) + parseFloat(balance.locked)
      }));

    logger.debug('Balance retrieved', { 
      source: 'BinanceService',
      context: { asset, count: balances.length }
    });
    return balances;
  }

  // Order Management Methods
  async getOpenOrders(symbol?: string): Promise<BinanceOrder[]> {
    await this.checkRateLimit();
    try {
      logger.debug('Fetching open orders', { 
        source: 'BinanceService',
        context: { symbol }
      });
      const orders = await this.client.openOrders({ symbol });
      logger.info('Open orders retrieved', { 
        source: 'BinanceService',
        context: { count: orders.length, symbol }
      });
      return orders;
    } catch (error) {
      logger.error('Failed to fetch open orders', { 
        source: 'BinanceService',
        error: { stack: error instanceof Error ? error.stack : String(error) },
        context: { symbol }
      });
      throw this.handleBinanceError(error);
    }
  }

  async placeOrder(orderRequest: OrderRequest): Promise<any> {
    await this.checkRateLimit();
    
    if (config.trading.mode === 'paper') {
      return this.simulateOrder(orderRequest);
    }

    try {
      logger.info('Placing order', { 
        source: 'BinanceService',
        context: orderRequest
      });
      
      const binanceOrder = {
        symbol: orderRequest.symbol,
        side: orderRequest.side as OrderSide,
        type: orderRequest.type as OrderType,
        quantity: orderRequest.quantity.toString(),
        ...(orderRequest.price && { price: orderRequest.price.toString() }),
        ...(orderRequest.stopPrice && { stopPrice: orderRequest.stopPrice.toString() }),
        ...(orderRequest.timeInForce && { timeInForce: orderRequest.timeInForce as TimeInForce })
      };

      const result = await this.client.order(binanceOrder);
      logger.info('Order placed successfully', { 
        source: 'BinanceService',
        context: { orderId: result.orderId.toString(), symbol: orderRequest.symbol }
      });
      return result;
    } catch (error) {
      logger.error('Failed to place order', { 
        source: 'BinanceService',
        error: { stack: error instanceof Error ? error.stack : String(error) },
        context: { orderRequest }
      });
      throw this.handleBinanceError(error);
    }
  }

  async cancelOrder(symbol: string, orderId: number): Promise<any> {
    await this.checkRateLimit();

    if (config.trading.mode === 'paper') {
      logger.info('Simulating order cancellation', { 
        source: 'BinanceService',
        context: { symbol, orderId: orderId.toString() }
      });
      return { symbol, orderId, status: 'CANCELED' };
    }

    try {
      logger.info('Canceling order', { 
        source: 'BinanceService',
        context: { symbol, orderId: orderId.toString() }
      });
      const result = await this.client.cancelOrder({ symbol, orderId });
      logger.info('Order canceled successfully', { 
        source: 'BinanceService',
        context: { orderId: orderId.toString(), symbol }
      });
      return result;
    } catch (error) {
      logger.error('Failed to cancel order', { 
        source: 'BinanceService',
        error: { stack: error instanceof Error ? error.stack : String(error) },
        context: { symbol, orderId: orderId.toString() }
      });
      throw this.handleBinanceError(error);
    }
  }

  // Market Data Methods
  async getSymbolInfo(symbol?: string): Promise<BinanceSymbolInfo | BinanceSymbolInfo[]> {
    await this.checkRateLimit();
    try {
      logger.debug('Fetching exchange info', { 
        source: 'BinanceService',
        context: { symbol }
      });
      const exchangeInfo = await this.client.exchangeInfo();
      
      if (symbol) {
        const symbolInfo = exchangeInfo.symbols.find((s: BinanceSymbolInfo) => s.symbol === symbol);
        if (!symbolInfo) {
          throw new Error(`Symbol ${symbol} not found`);
        }
        return symbolInfo;
      }
      
      return exchangeInfo.symbols;
    } catch (error) {
      logger.error('Failed to fetch symbol info', { 
        source: 'BinanceService',
        error: { stack: error instanceof Error ? error.stack : String(error) },
        context: { symbol }
      });
      throw this.handleBinanceError(error);
    }
  }

  async getKlines(symbol: string, interval: string, limit: number = 500): Promise<Candle[]> {
    await this.checkRateLimit();
    try {
      logger.debug('Fetching klines', { 
        source: 'BinanceService',
        context: { symbol, interval, limit }
      });
      const klines = await this.client.candles({ symbol, interval, limit });
      
      const candles: Candle[] = klines.map((kline: any) => ({
        openTime: kline.openTime,
        open: parseFloat(kline.open),
        high: parseFloat(kline.high),
        low: parseFloat(kline.low),
        close: parseFloat(kline.close),
        volume: parseFloat(kline.volume),
        closeTime: kline.closeTime,
        quoteVolume: parseFloat(kline.quoteAssetVolume),
        trades: kline.trades,
        baseAssetVolume: parseFloat(kline.baseAssetVolume),
        quoteAssetVolume: parseFloat(kline.quoteAssetVolume)
      }));

      logger.info('Klines retrieved', { 
        source: 'BinanceService',
        context: { symbol, interval, count: candles.length }
      });
      return candles;
    } catch (error) {
      logger.error('Failed to fetch klines', { 
        source: 'BinanceService',
        error: { stack: error instanceof Error ? error.stack : String(error) },
        context: { symbol, interval }
      });
      throw this.handleBinanceError(error);
    }
  }

  async getPrice(symbol?: string): Promise<MarketData | MarketData[]> {
    await this.checkRateLimit();
    try {
      logger.debug('Fetching price data', { 
        source: 'BinanceService',
        context: { symbol }
      });
      const ticker24hr = symbol 
        ? await this.client.dailyStats({ symbol })
        : await this.client.dailyStats();

      if (Array.isArray(ticker24hr)) {
        return ticker24hr.map(this.formatMarketData);
      } else {
        return this.formatMarketData(ticker24hr);
      }
    } catch (error) {
      logger.error('Failed to fetch price data', { 
        source: 'BinanceService',
        error: { stack: error instanceof Error ? error.stack : String(error) },
        context: { symbol }
      });
      throw this.handleBinanceError(error);
    }
  }

  private formatMarketData(ticker: any): MarketData {
    return {
      symbol: ticker.symbol,
      price: parseFloat(ticker.lastPrice),
      volume24h: parseFloat(ticker.volume),
      priceChange24h: parseFloat(ticker.priceChange),
      priceChangePercent24h: parseFloat(ticker.priceChangePercent),
      bid: parseFloat(ticker.bidPrice),
      ask: parseFloat(ticker.askPrice),
      spread: parseFloat(ticker.askPrice) - parseFloat(ticker.bidPrice),
      timestamp: Date.now()
    };
  }

  // WebSocket Methods
  async startPriceStream(symbols: string[], callback: (data: MarketData) => void): Promise<void> {
    const streamName = symbols.map(s => `${s.toLowerCase()}@ticker`).join('/');
    const wsUrl = `${this.wsBaseURL}/${streamName}`;
    
    try {
      await this.createWebSocketConnection(wsUrl, streamName, (message: any) => {
        // Single-stream format: the payload is the ticker object directly (has field 's')
        // Combined-stream format: payload is wrapped in { stream, data } (has field 'data.s')
        const tickerData = message.data ?? message;
        if (tickerData && tickerData.s) {
          const marketData = this.formatTickerToMarketData(tickerData);
          callback(marketData);
        }
      });
      
      logger.info('Price stream started', { 
        source: 'BinanceService',
        context: { symbols, streamName }
      });
    } catch (error) {
      logger.error('Failed to start price stream', { 
        source: 'BinanceService',
        error: { stack: error instanceof Error ? error.stack : String(error) },
        context: { symbols }
      });
      throw error;
    }
  }

  async startKlineStream(
    symbol: string, 
    interval: string, 
    callback: (data: Candle) => void
  ): Promise<void> {
    const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
    const wsUrl = `${this.wsBaseURL}/${streamName}`;
    
    try {
      await this.createWebSocketConnection(wsUrl, streamName, (message: KlineData) => {
        if (message.k && message.k.x) { // Only process closed candles
          const candle: Candle = {
            openTime: message.k.t,
            open: parseFloat(message.k.o),
            high: parseFloat(message.k.h),
            low: parseFloat(message.k.l),
            close: parseFloat(message.k.c),
            volume: parseFloat(message.k.v),
            closeTime: message.k.T,
            quoteVolume: parseFloat(message.k.q),
            trades: message.k.n,
            baseAssetVolume: parseFloat(message.k.V),
            quoteAssetVolume: parseFloat(message.k.Q)
          };
          callback(candle);
        }
      });
      
      logger.info('Kline stream started', { 
        source: 'BinanceService',
        context: { symbol, interval, streamName }
      });
    } catch (error) {
      logger.error('Failed to start kline stream', { 
        source: 'BinanceService',
        error: { stack: error instanceof Error ? error.stack : String(error) },
        context: { symbol, interval }
      });
      throw error;
    }
  }

  async startUserDataStream(_callback: (data: UserDataStreamData) => void): Promise<void> {
    try {
      // Get listen key for user data stream
      if (!this.listenKey) {
        logger.info('User data stream started', { 
          source: 'BinanceService'
        });
        return;
      }
    } catch (error) {
      logger.error('Failed to start user data stream', { 
        source: 'BinanceService',
        error: { stack: error instanceof Error ? error.stack : String(error) }
      });
      throw error;
    }
  }

  private async createWebSocketConnection(
    url: string, 
    streamName: string, 
    messageHandler: (message: any) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        
        const ws = new WebSocket(url);
        this.wsConnections.set(streamName, ws);
        this.wsReconnectAttempts.set(streamName, 0);

        ws.on('open', () => {
          logger.info('WebSocket connected', { 
            source: 'BinanceService',
            context: { streamName }
          });
          this.wsReconnectAttempts.set(streamName, 0);
          resolve();
        });

        ws.on('message', (data: string) => {
          try {
            const message = JSON.parse(data);
            messageHandler(message);
          } catch (error) {
            logger.error('Failed to parse WebSocket message', { 
              source: 'BinanceService',
              error: { stack: error instanceof Error ? error.stack : String(error) },
              context: { data }
            });
          }
        });

        ws.on('error', (error) => {
          logger.error('WebSocket error', { 
            source: 'BinanceService',
            error: { stack: error instanceof Error ? error.stack : String(error) },
            context: { streamName }
          });
          reject(error);
        });

        ws.on('close', (code, reason) => {
          logger.warn('WebSocket closed', { 
            source: 'BinanceService',
            context: { code, reason: reason.toString(), streamName }
          });
          this.handleWebSocketReconnection(url, streamName, messageHandler);
        });

      } catch (error) {
        logger.error('Failed to create WebSocket connection', { 
          source: 'BinanceService',
          error: { stack: error instanceof Error ? error.stack : String(error) },
          context: { streamName }
        });
        reject(error);
      }
    });
  }

  private async handleWebSocketReconnection(
    url: string, 
    streamName: string, 
    messageHandler: (message: any) => void
  ): Promise<void> {
    const attempts = this.wsReconnectAttempts.get(streamName) || 0;
    
    if (attempts >= this.maxReconnectAttempts) {
      logger.error('Max reconnection attempts reached', { 
        source: 'BinanceService',
        context: { streamName, attempts }
      });
      return;
    }

    this.wsReconnectAttempts.set(streamName, attempts + 1);
    
    logger.info('Attempting WebSocket reconnection', { 
      source: 'BinanceService',
      context: {
        streamName, 
        attempt: attempts + 1,
        delay: this.reconnectDelay 
      }
    });

    setTimeout(async () => {
      try {
        await this.createWebSocketConnection(url, streamName, messageHandler);
      } catch (error) {
        logger.error('WebSocket reconnection failed', { 
          source: 'BinanceService',
          error: { stack: error instanceof Error ? error.stack : String(error) },
          context: { streamName }
        });
      }
    }, this.reconnectDelay);
  }

  stopWebSocketStream(streamName?: string): void {
    if (streamName) {
      const ws = this.wsConnections.get(streamName);
      if (ws) {
        ws.close();
        this.wsConnections.delete(streamName);
        logger.info('WebSocket stream stopped', { 
          source: 'BinanceService',
          context: { streamName }
        });
      }
    } else {
      // Close all connections
      this.wsConnections.forEach((ws, name) => {
        ws.close();
        logger.info('WebSocket stream stopped', { 
          source: 'BinanceService',
          context: { streamName: name }
        });
      });
      this.wsConnections.clear();
    }
  }

  private formatTickerToMarketData(ticker: PriceTickerData): MarketData {
    return {
      symbol: ticker.s,
      price: parseFloat(ticker.c),
      volume24h: parseFloat(ticker.v),
      priceChange24h: parseFloat(ticker.c) - parseFloat(ticker.o),
      priceChangePercent24h: ((parseFloat(ticker.c) - parseFloat(ticker.o)) / parseFloat(ticker.o)) * 100,
      bid: 0, // Not available in ticker stream
      ask: 0, // Not available in ticker stream
      spread: 0,
      timestamp: ticker.E
    };
  }

  // Paper Trading Simulation
  private simulateOrder(orderRequest: OrderRequest): any {
    const orderId = Date.now();
    logger.info('Simulating order (paper trading)', { 
      source: 'BinanceService',
      context: { ...orderRequest, orderId: orderId.toString() }
    });
    
    return {
      symbol: orderRequest.symbol,
      orderId,
      clientOrderId: `paper_${orderId}`,
      transactTime: Date.now(),
      price: orderRequest.price?.toString() || '0',
      origQty: orderRequest.quantity.toString(),
      executedQty: orderRequest.quantity.toString(),
      status: 'FILLED',
      timeInForce: orderRequest.timeInForce || 'GTC',
      type: orderRequest.type,
      side: orderRequest.side,
      fills: [{
        price: orderRequest.price?.toString() || '0',
        qty: orderRequest.quantity.toString(),
        commission: '0',
        commissionAsset: orderRequest.symbol.replace(/USDT$/, '').replace(/BTC$/, '').replace(/ETH$/, '')
      }]
    };
  }

  // Utility Methods
  convertToTradingPair(symbolInfo: BinanceSymbolInfo): TradingPair {
    const lotSizeFilter = symbolInfo.filters.find(f => f.filterType === 'LOT_SIZE');
    const priceFilter = symbolInfo.filters.find(f => f.filterType === 'PRICE_FILTER');

    return {
      symbol: symbolInfo.symbol,
      baseAsset: symbolInfo.baseAsset,
      quoteAsset: symbolInfo.quoteAsset,
      minQty: parseFloat(lotSizeFilter?.minQty || '0'),
      maxQty: parseFloat(lotSizeFilter?.maxQty || '0'),
      stepSize: parseFloat(lotSizeFilter?.stepSize || '0'),
      tickSize: parseFloat(priceFilter?.tickSize || '0')
    };
  }

  private handleBinanceError(error: any): Error {
    if (error.code) {
      switch (error.code) {
        case -1021:
          return new Error('Timestamp for this request is outside the recvWindow');
        case -2010:
          return new Error('NEW_ORDER_REJECTED - Order rejected');
        case -2011:
          return new Error('CANCEL_REJECTED - Order cancellation rejected');
        case -1003:
          return new Error('Too many requests - Rate limit exceeded');
        case -1002:
          return new Error('UNAUTHORIZED - Invalid API key');
        case -1022:
          return new Error('Invalid signature');
        default:
          return new Error(`Binance API Error ${error.code}: ${error.msg}`);
      }
    }
    return error instanceof Error ? error : new Error(String(error));
  }

  // Health Check Methods
  async testConnection(): Promise<boolean> {
    try {
      await this.client.ping();
      logger.info('Binance connection test successful', { 
        source: 'BinanceService'
      });
      return true;
    } catch (error) {
      logger.error('Binance connection test failed', { 
        source: 'BinanceService',
        error: { stack: error instanceof Error ? error.stack : String(error) }
      });
      return false;
    }
  }

  async getServerTime(): Promise<number> {
    try {
      const response = await this.client.time();
      return response.serverTime;
    } catch (error) {
      logger.error('Failed to get server time', { 
        source: 'BinanceService',
        error: { stack: error instanceof Error ? error.stack : String(error) }
      });
      throw this.handleBinanceError(error);
    }
  }

  // Cleanup
  async disconnect(): Promise<void> {
    logger.info('Disconnecting Binance service', { 
      source: 'BinanceService'
    });
    this.stopWebSocketStream();
    
    // Close user data stream if exists
    if (this.listenKey) {
      try {
        // Implementation would depend on binance-api-node library methods
        // await this.client.ws.close();
      } catch (error) {
        logger.error('Error closing user data stream', { 
          source: 'BinanceService',
          error: { stack: error instanceof Error ? error.stack : String(error) }
        });
      }
    }

    logger.info('Binance service disconnected', { 
      source: 'BinanceService'
    });
  }
}

export default BinanceService;