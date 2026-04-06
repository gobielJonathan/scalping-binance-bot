import Binance, {
  CandleChartInterval_LT,
  UserDataStreamEvent,
  NewOrderSpot,
  NewFuturesOrder,
  FuturesBalanceResult,
} from "binance-api-node";
import WebSocket from "ws";
import config from "../config/index";
import { TradingPair, Candle, OrderRequest, MarketData } from "../types/index";
import { logger } from "./logger";

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
  private client!: ReturnType<typeof Binance>;
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
  private symbolInfoCache: Map<string, BinanceSymbolInfo> = new Map();

  constructor() {
    this.isTestnet = config.binance.testnet;
    // Isolated margin lives on the spot/margin exchange (not futures)
    this.baseURL = config.binance.baseURL;
    this.wsBaseURL = config.binance.wsURL;
    this.initializeClient();
    this.setupRateLimiting();
  }

  private initializeClient(): void {
    try {
      this.client = Binance({
        apiKey: config.binance.apiKey,
        apiSecret: config.binance.secretKey,
        httpBase: this.baseURL,
        wsBase: this.wsBaseURL.replace("/ws", ""),
        httpFutures: this.baseURL,
        getTime: () => Date.now(),
      });

      logger.info("Binance client initialized", {
        source: "BinanceService",
        context: {
          testnet: this.isTestnet,
          baseURL: this.baseURL,
        },
      });
    } catch (error) {
      logger.error("Failed to initialize Binance client", {
        source: "BinanceService",
        error: { stack: error instanceof Error ? error.stack : String(error) },
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
        source: "BinanceService",
        context: { waitTime },
      });
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    this.requestCount++;
  }

  // Account Information Methods
  async getAccountInfo(): Promise<BinanceAccountInfo> {
    if (!this.client) {
      throw new Error("Binance client not initialized");
    }

    await this.checkRateLimit();
    try {
      logger.debug("Fetching account info", {
        source: "BinanceService",
      });
      const accountInfo = await this.client.futuresAccountInfo();
      logger.info("Account info retrieved successfully", {
        source: "BinanceService",
      });
      return accountInfo as unknown as BinanceAccountInfo;
    } catch (error) {
      logger.error("Failed to fetch account info", {
        source: "BinanceService",
        error: { stack: error instanceof Error ? error.stack : String(error) },
      });
      throw this.handleBinanceError(error);
    }
  }

  async getBalance(asset?: string): Promise<BinanceBalance[]> {
    const futuresBalances = await this.client.futuresAccountBalance();
    const balances = futuresBalances
      .filter((b: FuturesBalanceResult) =>
        asset
          ? b.asset === asset
          : parseFloat(b.availableBalance) > 0 || parseFloat(b.balance) > 0,
      )
      .map((b: FuturesBalanceResult) => ({
        asset: b.asset,
        free: parseFloat(b.availableBalance),
        locked: parseFloat(b.balance) - parseFloat(b.availableBalance),
        total: parseFloat(b.balance),
      }));

    logger.debug("Balance retrieved", {
      source: "BinanceService",
      context: { asset, count: balances.length },
    });
    return balances;
  }

  // Order Management Methods
  async getOpenOrders(symbol?: string): Promise<BinanceOrder[]> {
    if (!this.client) {
      throw new Error("Binance client not initialized");
    }

    await this.checkRateLimit();
    try {
      logger.debug("Fetching open orders", {
        source: "BinanceService",
        context: { symbol },
      });
      const orders = await this.client.openOrders({ symbol });
      logger.info("Open orders retrieved", {
        source: "BinanceService",
        context: { count: orders.length, symbol },
      });
      return orders;
    } catch (error) {
      logger.error("Failed to fetch open orders", {
        source: "BinanceService",
        error: { stack: error instanceof Error ? error.stack : String(error) },
        context: { symbol },
      });
      throw this.handleBinanceError(error);
    }
  }

  /**
   * Return decimal precision implied by a step/tick size string e.g. "0.00100" → 5
   */
  private stepPrecision(stepStr: string): number {
    const match = stepStr.replace(/0+$/, "").match(/\.(.*)$/);
    return match ? match[1].length : 0;
  }

  /**
   * Truncate (floor) a value to the exchange-defined step size and return as
   * a fixed-decimal string so Binance never sees floating-point noise.
   */
  private formatToStep(value: number, stepStr: string): string {
    const step = parseFloat(stepStr);
    if (!step) return value.toString();
    const precision = this.stepPrecision(stepStr);
    const floored = Math.floor(value / step) * step;
    return floored.toFixed(precision);
  }

  /**
   * Fetch symbol info with a per-session in-memory cache to avoid hammering
   * the exchange info endpoint on every order.
   */
  private async getCachedSymbolInfo(
    symbol: string,
  ): Promise<BinanceSymbolInfo | null> {
    if (this.symbolInfoCache.has(symbol)) {
      return this.symbolInfoCache.get(symbol)!;
    }
    try {
      const info = (await this.getSymbolInfo(
        symbol,
      )) as unknown as BinanceSymbolInfo;
      this.symbolInfoCache.set(symbol, info);
      return info;
    } catch {
      return null;
    }
  }

  async placeOrder(orderRequest: OrderRequest): Promise<any> {
    if (!this.client) {
      throw new Error("Binance client not initialized");
    }

    await this.checkRateLimit();

    if (config.trading.mode === "paper") {
      return this.simulateOrder(orderRequest);
    }

    try {
      logger.info("Placing order", {
        source: "BinanceService",
        context: orderRequest,
      });

      // ── Precision rounding ──────────────────────────────────────────────
      // Binance error -1111 is thrown when quantity/price exceed the allowed
      // decimal precision defined by the LOT_SIZE and PRICE_FILTER for the
      // symbol.  Apply floor-rounding to both before building the request.
      let quantityStr = orderRequest.quantity.toString();
      let priceStr = orderRequest.price?.toString();
      let stopPriceStr = orderRequest.stopPrice?.toString();

      const symbolInfo = await this.getCachedSymbolInfo(orderRequest.symbol);
      if (symbolInfo) {
        const lotSize = symbolInfo.filters.find(
          (f) => f.filterType === "LOT_SIZE",
        );
        const priceFilter = symbolInfo.filters.find(
          (f) => f.filterType === "PRICE_FILTER",
        );

        if (lotSize?.stepSize) {
          quantityStr = this.formatToStep(
            orderRequest.quantity,
            lotSize.stepSize,
          );
        }
        if (priceFilter?.tickSize) {
          if (orderRequest.price) {
            priceStr = this.formatToStep(
              orderRequest.price,
              priceFilter.tickSize,
            );
          }
          if (orderRequest.stopPrice) {
            stopPriceStr = this.formatToStep(
              orderRequest.stopPrice,
              priceFilter.tickSize,
            );
          }
        }

        logger.debug("Rounded order values", {
          source: "BinanceService",
          context: {
            rawQty: orderRequest.quantity,
            roundedQty: quantityStr,
            stepSize: lotSize?.stepSize,
          },
        });
      }
      // ───────────────────────────────────────────────────────────────────

      const binanceOrder = {
        symbol: orderRequest.symbol,
        side: orderRequest.side,
        type: orderRequest.type,
        quantity: quantityStr,
        ...(priceStr && { price: priceStr }),
        ...(stopPriceStr && { stopPrice: stopPriceStr }),
        ...(orderRequest.timeInForce && {
          timeInForce: orderRequest.timeInForce,
        }),
      };

      const result = await this.client.order(binanceOrder as NewOrderSpot);
      logger.info("Order placed successfully", {
        source: "BinanceService",
        context: {
          orderId: result.orderId.toString(),
          symbol: orderRequest.symbol,
        },
      });
      return result;
    } catch (error) {
      logger.error("Failed to place order", {
        source: "BinanceService",
        error: { stack: error instanceof Error ? error.stack : String(error) },
        context: { orderRequest },
      });
      throw this.handleBinanceError(error);
    }
  }

  async cancelOrder(symbol: string, orderId: number): Promise<any> {
    await this.checkRateLimit();

    if (config.trading.mode === "paper") {
      logger.info("Simulating order cancellation", {
        source: "BinanceService",
        context: { symbol, orderId: orderId.toString() },
      });
      return { symbol, orderId, status: "CANCELED" };
    }

    try {
      logger.info("Canceling order", {
        source: "BinanceService",
        context: { symbol, orderId: orderId.toString() },
      });
      const result = await this.client.cancelOrder({ symbol, orderId });
      logger.info("Order canceled successfully", {
        source: "BinanceService",
        context: { orderId: orderId.toString(), symbol },
      });
      return result;
    } catch (error) {
      logger.error("Failed to cancel order", {
        source: "BinanceService",
        error: { stack: error instanceof Error ? error.stack : String(error) },
        context: { symbol, orderId: orderId.toString() },
      });
      throw this.handleBinanceError(error);
    }
  }

  // ── Isolated Margin Methods ────────────────────────────────────────────────

  /**
   * Place a futures order with isolated margin.
   * Margin type must be set to ISOLATED for the symbol before calling this
   * (done once via setFuturesLeverage which also sets margin type).
   */
  async placeMarginOrder(orderRequest: OrderRequest): Promise<any> {
    if (!this.client) throw new Error("Binance client not initialized");
    await this.checkRateLimit();

    if (config.trading.mode === "paper") {
      return this.simulateOrder(orderRequest);
    }

    try {
      logger.info("Placing futures order", {
        source: "BinanceService",
        context: orderRequest,
      });

      let quantityStr = orderRequest.quantity.toString();
      let priceStr = orderRequest.price?.toString();
      let stopPriceStr = orderRequest.stopPrice?.toString();

      const symbolInfo = await this.getCachedSymbolInfo(orderRequest.symbol);
      if (symbolInfo) {
        const lotSize = symbolInfo.filters.find(
          (f: any) => f.filterType === "LOT_SIZE",
        );
        const priceFilter = symbolInfo.filters.find(
          (f: any) => f.filterType === "PRICE_FILTER",
        );
        if (lotSize?.stepSize)
          quantityStr = this.formatToStep(
            orderRequest.quantity,
            lotSize.stepSize,
          );
        if (priceFilter?.tickSize) {
          if (orderRequest.price)
            priceStr = this.formatToStep(
              orderRequest.price,
              priceFilter.tickSize,
            );
          if (orderRequest.stopPrice)
            stopPriceStr = this.formatToStep(
              orderRequest.stopPrice,
              priceFilter.tickSize,
            );
        }
      }

      // AUTO_REPAY side effect → SELL with reduceOnly closes the position
      const isClose = orderRequest.sideEffectType === "AUTO_REPAY";

      const params = {
        symbol: orderRequest.symbol,
        side: orderRequest.side,
        type: orderRequest.type as NewFuturesOrder["type"],
        quantity: quantityStr,
        ...(isClose && { reduceOnly: "true" as const }),
        ...(priceStr && { price: priceStr }),
        ...(stopPriceStr && { stopPrice: stopPriceStr }),
        ...(orderRequest.timeInForce && {
          timeInForce: orderRequest.timeInForce,
        }),
      } as NewFuturesOrder;

      const result = await this.client.futuresOrder(params);
      logger.info("Futures order placed", {
        source: "BinanceService",
        context: {
          orderId: result.orderId?.toString(),
          symbol: orderRequest.symbol,
        },
      });
      return result;
    } catch (error) {
      logger.error("Failed to place futures order", {
        source: "BinanceService",
        error: { stack: error instanceof Error ? error.stack : String(error) },
        context: { orderRequest },
      });
      throw this.handleBinanceError(error);
    }
  }

  /**
   * Get the available balance of an asset in the futures account.
   */
  async getIsolatedMarginBalance(
    _symbol: string,
    asset: string,
  ): Promise<number> {
    if (!this.client) throw new Error("Binance client not initialized");
    await this.checkRateLimit();
    try {
      const balances: FuturesBalanceResult[] =
        await this.client.futuresAccountBalance();
      const entry = balances.find((b) => b.asset === asset);
      return parseFloat(entry?.availableBalance ?? "0");
    } catch {
      return 0;
    }
  }

  /**
   * Set leverage and margin type (ISOLATED) for a futures symbol.
   * Call once before placing the first order on a symbol.
   */
  async setFuturesLeverage(symbol: string, leverage: number): Promise<void> {
    if (!this.client) throw new Error("Binance client not initialized");
    await this.checkRateLimit();
    try {
      await this.client.futuresMarginType({ symbol, marginType: "ISOLATED" });
    } catch {
      // -4046: already set to ISOLATED — safe to ignore
    }
    await this.client.futuresLeverage({ symbol, leverage });
    logger.info("Futures leverage set", {
      source: "BinanceService",
      context: { symbol, leverage },
    });
  }

  /**
   * Place a STOP_MARKET order that closes the entire position (closePosition: true).
   * Some symbols (e.g. newly listed pairs) do not support STOP_MARKET on the
   * standard endpoint — for those, returns null and the caller falls back to
   * software-based stop-loss monitoring.
   */
  async placeFuturesStopMarket(
    symbol: string,
    side: "BUY" | "SELL",
    stopPrice: number,
  ): Promise<any> {
    if (!this.client) throw new Error("Binance client not initialized");
    if (stopPrice <= 0) {
      logger.warn(
        `placeFuturesStopMarket: invalid stopPrice ${stopPrice} for ${symbol} — skipping`,
        { source: "BinanceService" },
      );
      return null;
    }
    await this.checkRateLimit();

    const symbolInfo = await this.getCachedSymbolInfo(symbol);
    let stopPriceStr = stopPrice.toString();
    if (symbolInfo) {
      // Check if STOP_MARKET is supported for this symbol
      const supportedTypes: string[] = symbolInfo.orderTypes ?? [];
      if (
        supportedTypes.length > 0 &&
        !supportedTypes.includes("STOP_MARKET")
      ) {
        logger.warn(
          `STOP_MARKET not supported for ${symbol} — relying on software stop-loss`,
          {
            source: "BinanceService",
            context: { symbol, supportedTypes },
          },
        );
        return null;
      }

      const priceFilter = symbolInfo.filters.find(
        (f: any) => f.filterType === "PRICE_FILTER",
      );
      if (priceFilter?.tickSize)
        stopPriceStr = this.formatToStep(stopPrice, priceFilter.tickSize);
    }

    try {
      const params = {
        symbol,
        side,
        type: "STOP_MARKET" as NewFuturesOrder["type"],
        stopPrice: stopPriceStr,
        closePosition: "true",
      } as NewFuturesOrder;

      const result = await this.client.futuresOrder(params);
      logger.info("Futures stop-market order placed", {
        source: "BinanceService",
        context: { symbol, side, stopPrice: stopPriceStr },
      });
      return result;
    } catch (error: any) {
      // -4135 / "Algo Order API" error means this symbol requires a different endpoint
      const msg: string = error?.message ?? "";
      if (msg.includes("Algo Order") || error?.code === -4135) {
        logger.warn(
          `STOP_MARKET rejected for ${symbol} (Algo Order API required) — relying on software stop-loss`,
          {
            source: "BinanceService",
            context: { symbol, side, stopPrice: stopPriceStr },
          },
        );
        return null;
      }
      logger.error("Failed to place futures stop-market order", {
        source: "BinanceService",
        error: { stack: error instanceof Error ? error.stack : String(error) },
        context: { symbol, side, stopPrice: stopPriceStr },
      });
      throw this.handleBinanceError(error);
    }
  }

  /**
   * Place a TAKE_PROFIT_MARKET order that closes the entire position (closePosition: true).
   * Returns null if the symbol doesn't support the order type.
   */
  async placeFuturesTakeProfitMarket(
    symbol: string,
    side: "BUY" | "SELL",
    takeProfitPrice: number,
  ): Promise<any> {
    if (!this.client) throw new Error("Binance client not initialized");
    if (takeProfitPrice <= 0) {
      logger.warn(
        `placeFuturesTakeProfitMarket: invalid price ${takeProfitPrice} for ${symbol} — skipping`,
        { source: "BinanceService" },
      );
      return null;
    }
    await this.checkRateLimit();

    const symbolInfo = await this.getCachedSymbolInfo(symbol);
    let tpPriceStr = takeProfitPrice.toString();
    if (symbolInfo) {
      const supportedTypes: string[] = symbolInfo.orderTypes ?? [];
      if (
        supportedTypes.length > 0 &&
        !supportedTypes.includes("TAKE_PROFIT_MARKET")
      ) {
        logger.warn(
          `TAKE_PROFIT_MARKET not supported for ${symbol} — relying on software take-profit`,
          {
            source: "BinanceService",
            context: { symbol, supportedTypes },
          },
        );
        return null;
      }

      const priceFilter = symbolInfo.filters.find(
        (f: any) => f.filterType === "PRICE_FILTER",
      );
      if (priceFilter?.tickSize)
        tpPriceStr = this.formatToStep(takeProfitPrice, priceFilter.tickSize);
    }

    try {
      const params = {
        symbol,
        side,
        type: "TAKE_PROFIT_MARKET" as NewFuturesOrder["type"],
        stopPrice: tpPriceStr,
        closePosition: "true",
      } as unknown as NewFuturesOrder;

      const result = await this.client.futuresOrder(params);
      logger.info("Futures take-profit-market order placed", {
        source: "BinanceService",
        context: { symbol, side, takeProfitPrice: tpPriceStr },
      });
      return result;
    } catch (error: any) {
      const msg: string = error?.message ?? "";
      if (msg.includes("Algo Order") || error?.code === -4135) {
        logger.warn(
          `TAKE_PROFIT_MARKET rejected for ${symbol} (Algo Order API) — relying on software take-profit`,
          {
            source: "BinanceService",
            context: { symbol, side, takeProfitPrice: tpPriceStr },
          },
        );
        return null;
      }
      logger.error("Failed to place futures take-profit-market order", {
        source: "BinanceService",
        error: { stack: error instanceof Error ? error.stack : String(error) },
        context: { symbol, side, takeProfitPrice: tpPriceStr },
      });
      throw this.handleBinanceError(error);
    }
  }

  // ── End Isolated Margin Methods ────────────────────────────────────────────

  // Market Data Methods
  async getSymbolInfo(symbol?: string) {
    await this.checkRateLimit();
    try {
      logger.debug("Fetching exchange info", {
        source: "BinanceService",
        context: { symbol },
      });
      const exchangeInfo = await this.client.futuresExchangeInfo();

      if (symbol) {
        const symbolInfo = exchangeInfo.symbols.find(
          (s) => s.symbol === symbol,
        );
        if (!symbolInfo) {
          throw new Error(`Symbol ${symbol} not found`);
        }
        return symbolInfo;
      }

      return exchangeInfo.symbols;
    } catch (error) {
      logger.error("Failed to fetch symbol info", {
        source: "BinanceService",
        error: { stack: error instanceof Error ? error.stack : String(error) },
        context: { symbol },
      });
      throw this.handleBinanceError(error);
    }
  }

  async getKlines(
    symbol: string,
    interval: CandleChartInterval_LT,
    limit: number = 500,
  ): Promise<Candle[]> {
    await this.checkRateLimit();
    try {
      logger.debug("Fetching klines", {
        source: "BinanceService",
        context: { symbol, interval, limit },
      });
      const klines = await this.client.futuresCandles({
        symbol,
        interval,
        limit,
      });

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
        quoteAssetVolume: parseFloat(kline.quoteAssetVolume),
      }));

      logger.info("Klines retrieved", {
        source: "BinanceService",
        context: { symbol, interval, count: candles.length },
      });
      return candles;
    } catch (error) {
      logger.error("Failed to fetch klines", {
        source: "BinanceService",
        error: { stack: error instanceof Error ? error.stack : String(error) },
        context: { symbol, interval },
      });
      throw this.handleBinanceError(error);
    }
  }

  async getPrice(symbol?: string): Promise<MarketData | MarketData[]> {
    if (!this.client) {
      throw new Error("Binance client not initialized");
    }

    await this.checkRateLimit();
    try {
      logger.debug("Fetching price data", {
        source: "BinanceService",
        context: { symbol },
      });
      const ticker24hr = symbol
        ? await this.client.futuresDailyStats({ symbol })
        : await this.client.futuresDailyStats();

      if (Array.isArray(ticker24hr)) {
        return ticker24hr.map(this.formatMarketData);
      } else {
        return this.formatMarketData(ticker24hr);
      }
    } catch (error) {
      logger.error("Failed to fetch price data", {
        source: "BinanceService",
        error: { stack: error instanceof Error ? error.stack : String(error) },
        context: { symbol },
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
      timestamp: Date.now(),
    };
  }

  // WebSocket Methods
  async startPriceStream(
    symbols: string[],
    callback: (data: MarketData) => void,
  ): Promise<void> {
    const streamName = symbols
      .map((s) => `${s.toLowerCase()}@ticker`)
      .join("/");
    const wsUrl = `${this.wsBaseURL}/${streamName}`;

    try {
      await this.createWebSocketConnection(
        wsUrl,
        streamName,
        (message: any) => {
          // Single-stream format: the payload is the ticker object directly (has field 's')
          // Combined-stream format: payload is wrapped in { stream, data } (has field 'data.s')
          const tickerData = message.data ?? message;
          if (tickerData && tickerData.s) {
            const marketData = this.formatTickerToMarketData(tickerData);
            callback(marketData);
          }
        },
      );

      logger.info("Price stream started", {
        source: "BinanceService",
        context: { symbols, streamName },
      });
    } catch (error) {
      logger.error("Failed to start price stream", {
        source: "BinanceService",
        error: { stack: error instanceof Error ? error.stack : String(error) },
        context: { symbols },
      });
      throw error;
    }
  }

  async startKlineStream(
    symbol: string,
    interval: CandleChartInterval_LT,
    callback: (data: Candle) => void,
  ): Promise<void> {
    const streamName = `${symbol.toLowerCase()}@kline_${interval}`;
    const wsUrl = `${this.wsBaseURL}/${streamName}`;

    try {
      await this.createWebSocketConnection(
        wsUrl,
        streamName,
        (message: KlineData) => {
          if (message.k && message.k.x) {
            // Only process closed candles
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
              quoteAssetVolume: parseFloat(message.k.Q),
            };
            callback(candle);
          }
        },
      );

      logger.info("Kline stream started", {
        source: "BinanceService",
        context: { symbol, interval, streamName },
      });
    } catch (error) {
      logger.error("Failed to start kline stream", {
        source: "BinanceService",
        error: { stack: error instanceof Error ? error.stack : String(error) },
        context: { symbol, interval },
      });
      throw error;
    }
  }

  async startUserDataStream(
    callback: (data: UserDataStreamEvent) => void,
  ): Promise<void> {
    try {
      await this.client.ws.user(callback);
      logger.info("User data stream started", {
        source: "BinanceService",
      });
    } catch (error) {
      logger.error("Failed to start user data stream", {
        source: "BinanceService",
        error: { stack: error instanceof Error ? error.stack : String(error) },
      });
      throw error;
    }
  }

  /**
   * Start the Futures user data stream.
   * Fires ACCOUNT_UPDATE events whenever the USDT balance changes
   * (trades filled, funding fees, deposits, etc.).
   * Returns a cleanup function that closes the stream.
   */
  async startFuturesUserDataStream(
    onBalanceUpdate: (usdtWalletBalance: number) => void,
  ): Promise<() => void> {
    let cleanup: (() => void) | null = null;

    try {
      const handler = await this.client.ws.futuresUser((event) => {
        if (event.eventType !== "ACCOUNT_UPDATE") return;

        const usdtBalance = event.balances.find((b) => b.asset === "USDT");
        if (usdtBalance) {
          const balance = parseFloat(usdtBalance.walletBalance);
          logger.debug(
            "[WS] Futures ACCOUNT_UPDATE — USDT walletBalance: " + balance,
            {
              source: "BinanceService",
            },
          );
          onBalanceUpdate(balance);
        }
      });

      cleanup = handler as unknown as () => void;
      logger.info("Futures user data stream started", {
        source: "BinanceService",
      });
    } catch (error) {
      logger.warn(
        "Failed to start futures user data stream — falling back to polling",
        {
          source: "BinanceService",
          error: {
            stack: error instanceof Error ? error.stack : String(error),
          },
        },
      );
    }

    return () => {
      if (cleanup) {
        try {
          cleanup();
        } catch {
          /* ignore */
        }
        cleanup = null;
        logger.info("Futures user data stream closed", {
          source: "BinanceService",
        });
      }
    };
  }

  private async createWebSocketConnection(
    url: string,
    streamName: string,
    messageHandler: (message: any) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const ws = new WebSocket(url);
        this.wsConnections.set(streamName, ws);
        this.wsReconnectAttempts.set(streamName, 0);

        ws.on("open", () => {
          logger.info("WebSocket connected", {
            source: "BinanceService",
            context: { streamName },
          });
          this.wsReconnectAttempts.set(streamName, 0);
          resolve();
        });

        ws.on("message", (data: string) => {
          try {
            const message = JSON.parse(data);
            messageHandler(message);
          } catch (error) {
            logger.error("Failed to parse WebSocket message", {
              source: "BinanceService",
              error: {
                stack: error instanceof Error ? error.stack : String(error),
              },
              context: { data },
            });
          }
        });

        ws.on("error", (error) => {
          logger.error("WebSocket error", {
            source: "BinanceService",
            error: {
              stack: error instanceof Error ? error.stack : String(error),
            },
            context: { streamName },
          });
          reject(error);
        });

        ws.on("close", (code, reason) => {
          logger.warn("WebSocket closed", {
            source: "BinanceService",
            context: { code, reason: reason.toString(), streamName },
          });
          this.handleWebSocketReconnection(url, streamName, messageHandler);
        });
      } catch (error) {
        logger.error("Failed to create WebSocket connection", {
          source: "BinanceService",
          error: {
            stack: error instanceof Error ? error.stack : String(error),
          },
          context: { streamName },
        });
        reject(error);
      }
    });
  }

  private async handleWebSocketReconnection(
    url: string,
    streamName: string,
    messageHandler: (message: any) => void,
  ): Promise<void> {
    const attempts = this.wsReconnectAttempts.get(streamName) || 0;

    if (attempts >= this.maxReconnectAttempts) {
      logger.error("Max reconnection attempts reached", {
        source: "BinanceService",
        context: { streamName, attempts },
      });
      return;
    }

    this.wsReconnectAttempts.set(streamName, attempts + 1);

    logger.info("Attempting WebSocket reconnection", {
      source: "BinanceService",
      context: {
        streamName,
        attempt: attempts + 1,
        delay: this.reconnectDelay,
      },
    });

    setTimeout(async () => {
      try {
        await this.createWebSocketConnection(url, streamName, messageHandler);
      } catch (error) {
        logger.error("WebSocket reconnection failed", {
          source: "BinanceService",
          error: {
            stack: error instanceof Error ? error.stack : String(error),
          },
          context: { streamName },
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
        logger.info("WebSocket stream stopped", {
          source: "BinanceService",
          context: { streamName },
        });
      }
    } else {
      // Close all connections
      this.wsConnections.forEach((ws, name) => {
        ws.close();
        logger.info("WebSocket stream stopped", {
          source: "BinanceService",
          context: { streamName: name },
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
      priceChangePercent24h:
        ((parseFloat(ticker.c) - parseFloat(ticker.o)) / parseFloat(ticker.o)) *
        100,
      bid: 0, // Not available in ticker stream
      ask: 0, // Not available in ticker stream
      spread: 0,
      timestamp: ticker.E,
    };
  }

  // Paper Trading Simulation
  private simulateOrder(orderRequest: OrderRequest): any {
    const orderId = Date.now();
    logger.info("Simulating order (paper trading)", {
      source: "BinanceService",
      context: { ...orderRequest, orderId: orderId.toString() },
    });

    return {
      symbol: orderRequest.symbol,
      orderId,
      clientOrderId: `paper_${orderId}`,
      transactTime: Date.now(),
      price: orderRequest.price?.toString() || "0",
      origQty: orderRequest.quantity.toString(),
      executedQty: orderRequest.quantity.toString(),
      status: "FILLED",
      timeInForce: orderRequest.timeInForce || "GTC",
      type: orderRequest.type,
      side: orderRequest.side,
      fills: [
        {
          price: orderRequest.price?.toString() || "0",
          qty: orderRequest.quantity.toString(),
          commission: "0",
          commissionAsset: orderRequest.symbol
            .replace(/USDT$/, "")
            .replace(/BTC$/, "")
            .replace(/ETH$/, ""),
        },
      ],
    };
  }

  // Utility Methods
  convertToTradingPair(symbolInfo: BinanceSymbolInfo): TradingPair {
    const lotSizeFilter = symbolInfo.filters.find(
      (f) => f.filterType === "LOT_SIZE",
    );
    const priceFilter = symbolInfo.filters.find(
      (f) => f.filterType === "PRICE_FILTER",
    );

    return {
      symbol: symbolInfo.symbol,
      baseAsset: symbolInfo.baseAsset,
      quoteAsset: symbolInfo.quoteAsset,
      minQty: parseFloat(lotSizeFilter?.minQty || "0"),
      maxQty: parseFloat(lotSizeFilter?.maxQty || "0"),
      stepSize: parseFloat(lotSizeFilter?.stepSize || "0"),
      tickSize: parseFloat(priceFilter?.tickSize || "0"),
    };
  }

  private handleBinanceError(error: any): Error {
    if (error.code) {
      switch (error.code) {
        case -1021:
          return new Error(
            "Timestamp for this request is outside the recvWindow",
          );
        case -2010:
          return new Error("NEW_ORDER_REJECTED - Order rejected");
        case -2011:
          return new Error("CANCEL_REJECTED - Order cancellation rejected");
        case -1003:
          return new Error("Too many requests - Rate limit exceeded");
        case -1002:
          return new Error("UNAUTHORIZED - Invalid API key");
        case -1022:
          return new Error("Invalid signature");
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
      logger.info("Binance connection test successful", {
        source: "BinanceService",
      });
      return true;
    } catch (error) {
      logger.error("Binance connection test failed", {
        source: "BinanceService",
        error: { stack: error instanceof Error ? error.stack : String(error) },
      });
      return false;
    }
  }

  async getServerTime(): Promise<number> {
    try {
      const response = await this.client.time();
      return response;
    } catch (error) {
      logger.error("Failed to get server time", {
        source: "BinanceService",
        error: { stack: error instanceof Error ? error.stack : String(error) },
      });
      throw this.handleBinanceError(error);
    }
  }

  // Cleanup
  async disconnect(): Promise<void> {
    logger.info("Disconnecting Binance service", {
      source: "BinanceService",
    });
    this.stopWebSocketStream();

    logger.info("Binance service disconnected", {
      source: "BinanceService",
    });
  }
}

export default BinanceService;
