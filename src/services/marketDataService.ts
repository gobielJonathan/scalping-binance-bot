import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { logger } from './logger';
import { BinanceService } from './binanceService';
import { Candle, MarketData, TechnicalIndicators } from '../types';
import config from '../config';

export interface CandlestickStreamData {
  symbol: string;
  interval: string;
  candle: Candle;
  isClosed: boolean;
  timestamp: number;
}

export interface MarketDataUpdate {
  symbol: string;
  candle?: Candle;
  marketData?: MarketData;
  type: 'candle' | 'ticker';
  timestamp: number;
}

export interface StreamMetrics {
  symbol: string;
  interval: string;
  totalMessages: number;
  validMessages: number;
  invalidMessages: number;
  lastUpdate: number;
  latencyMs: number;
  connectionUptime: number;
  reconnectionCount: number;
}

export interface CandleWindow {
  symbol: string;
  interval: string;
  candles: Candle[];
  maxSize: number;
  lastUpdate: number;
}

export interface StreamConfig {
  symbol: string;
  intervals: string[];
  enabled: boolean;
  bufferSize: number;
}

export class MarketDataService extends EventEmitter {
  private binanceService: BinanceService;
  private candleWindows: Map<string, CandleWindow> = new Map();
  private marketDataCache: Map<string, MarketData> = new Map();
  private streamMetrics: Map<string, StreamMetrics> = new Map();
  private activeStreams: Map<string, WebSocket> = new Map();
  private streamConfigs: Map<string, StreamConfig> = new Map();
  
  // Configuration
  private readonly maxWindowSize = 500; // Maximum candles to keep in memory
  private readonly supportedIntervals = ['1m', '3m', '5m', '15m', '30m', '1h'];
  private readonly reconnectDelay = 5000; // 5 seconds
  private readonly maxReconnectAttempts = 5;
  private readonly dataValidationEnabled = true;
  
  // Monitoring
  private isStarted = false;
  private startTime: number = 0;
  private performanceTimer: NodeJS.Timeout | null = null;
  
  constructor(binanceService: BinanceService) {
    super();
    this.binanceService = binanceService;
    this.setupEventHandlers();
    
    logger.info('MarketDataService initialized', {
      supportedIntervals: this.supportedIntervals,
      maxWindowSize: this.maxWindowSize,
      validationEnabled: this.dataValidationEnabled
    });
  }

  /**
   * Initialize market data streams for configured trading pairs
   */
  public async start(): Promise<void> {
    if (this.isStarted) {
      logger.warn('MarketDataService is already started');
      return;
    }

    this.startTime = Date.now();
    this.isStarted = true;

    try {
      // Initialize stream configurations for all trading pairs
      for (const symbol of config.trading.pairs) {
        await this.initializeStreamConfig(symbol);
      }

      // Start performance monitoring
      this.startPerformanceMonitoring();

      // Start WebSocket streams
      await this.startAllStreams();

      logger.info('MarketDataService started successfully', {
        pairs: config.trading.pairs,
        streamCount: this.activeStreams.size,
        uptime: Date.now() - this.startTime
      });

      this.emit('started');
    } catch (error) {
      this.isStarted = false;
      logger.error('Failed to start MarketDataService', { error: { message: error instanceof Error ? error.message : String(error) } });
      throw error;
    }
  }

  /**
   * Stop all market data streams
   */
  public async stop(): Promise<void> {
    if (!this.isStarted) {
      logger.warn('MarketDataService is not running');
      return;
    }

    this.isStarted = false;

    try {
      // Stop performance monitoring
      if (this.performanceTimer) {
        clearInterval(this.performanceTimer);
        this.performanceTimer = null;
      }

      // Close all WebSocket connections
      await this.stopAllStreams();

      // Clear data structures
      this.candleWindows.clear();
      this.marketDataCache.clear();
      this.streamMetrics.clear();
      this.streamConfigs.clear();

      logger.info('MarketDataService stopped successfully', {
        uptime: Date.now() - this.startTime
      });

      this.emit('stopped');
    } catch (error) {
      logger.error('Error stopping MarketDataService', { error: { message: error instanceof Error ? error.message : String(error) } });
      throw error;
    }
  }

  /**
   * Get sliding window of candles for a symbol and interval
   */
  public getCandles(symbol: string, interval: string, limit?: number): Candle[] {
    const windowKey = `${symbol}_${interval}`;
    const window = this.candleWindows.get(windowKey);
    
    if (!window || !window.candles.length) {
      logger.debug('No candles available', { symbol, interval, windowKey });
      return [];
    }

    const candles = window.candles.slice();
    return limit ? candles.slice(-limit) : candles;
  }

  /**
   * Get latest market data for a symbol
   */
  public getMarketData(symbol: string): MarketData | null {
    const data = this.marketDataCache.get(symbol);
    if (!data) {
      logger.warn('No market data available — ticker stream may not have delivered yet', { symbol });
      return null;
    }
    
    return { ...data }; // Return copy to prevent mutation
  }

  /**
   * Get all market data for active symbols
   */
  public getAllMarketData(): Map<string, MarketData> {
    return new Map(this.marketDataCache);
  }

  /**
   * Get performance metrics for all streams
   */
  public getStreamMetrics(): StreamMetrics[] {
    return Array.from(this.streamMetrics.values());
  }

  /**
   * Get metrics for a specific symbol
   */
  public getSymbolMetrics(symbol: string): StreamMetrics[] {
    return Array.from(this.streamMetrics.values())
      .filter(metric => metric.symbol === symbol);
  }

  /**
   * Add a new trading pair to the stream
   */
  public async addSymbol(symbol: string, intervals: string[] = ['1m', '3m', '5m']): Promise<void> {
    if (this.streamConfigs.has(symbol)) {
      logger.warn('Symbol already being tracked', { symbol });
      return;
    }

    try {
      await this.initializeStreamConfig(symbol, intervals);
      await this.startStreamsForSymbol(symbol);
      
      logger.info('Symbol added to market data service', { symbol, intervals });
    } catch (error) {
      logger.error('Failed to add symbol', { symbol, error: { message: error instanceof Error ? error.message : String(error) } });
      throw error;
    }
  }

  /**
   * Remove a trading pair from streams
   */
  public async removeSymbol(symbol: string): Promise<void> {
    if (!this.streamConfigs.has(symbol)) {
      logger.warn('Symbol not being tracked', { symbol });
      return;
    }

    try {
      await this.stopStreamsForSymbol(symbol);
      this.streamConfigs.delete(symbol);
      
      // Clean up data structures
      const keysToDelete = Array.from(this.candleWindows.keys())
        .filter(key => key.startsWith(`${symbol}_`));
      
      keysToDelete.forEach(key => {
        this.candleWindows.delete(key);
        this.streamMetrics.delete(key);
      });
      
      this.marketDataCache.delete(symbol);
      
      logger.info('Symbol removed from market data service', { symbol });
    } catch (error) {
      logger.error('Failed to remove symbol', { symbol, error: { message: error instanceof Error ? error.message : String(error) } });
      throw error;
    }
  }

  /**
   * Force refresh historical data for a symbol
   */
  public async refreshHistoricalData(symbol: string, interval: string, limit: number = 500): Promise<void> {
    const windowKey = `${symbol}_${interval}`;
    
    try {
      logger.info('Refreshing historical data', { symbol, interval, limit });
      
      // Get historical candles from Binance
      const historicalCandles = await this.binanceService.getKlines(symbol, interval, limit);
      
      if (!historicalCandles || historicalCandles.length === 0) {
        logger.warn('No historical data received', { symbol, interval });
        return;
      }

      // Update or create candle window
      const window = this.candleWindows.get(windowKey) || {
        symbol,
        interval,
        candles: [],
        maxSize: this.maxWindowSize,
        lastUpdate: Date.now()
      };

      window.candles = historicalCandles;
      window.lastUpdate = Date.now();
      this.candleWindows.set(windowKey, window);

      logger.info('Historical data refreshed', {
        symbol,
        interval,
        candleCount: historicalCandles.length,
        timeRange: historicalCandles.length > 0 ? {
          start: new Date(historicalCandles[0].openTime).toISOString(),
          end: new Date(historicalCandles[historicalCandles.length - 1].closeTime).toISOString()
        } : null
      });

      this.emit('historicalDataRefreshed', { symbol, interval, candles: historicalCandles });
    } catch (error) {
      logger.error('Failed to refresh historical data', {
        symbol,
        interval,
        error: { message: error instanceof Error ? error.message : String(error) }
      });
      throw error;
    }
  }

  /**
   * Get connection status for all streams
   */
  public getConnectionStatus(): { [key: string]: boolean } {
    const status: { [key: string]: boolean } = {};
    
    for (const [streamKey, ws] of this.activeStreams) {
      status[streamKey] = ws.readyState === WebSocket.OPEN;
    }
    
    return status;
  }

  /**
   * Initialize stream configuration for a symbol
   */
  private async initializeStreamConfig(symbol: string, intervals?: string[]): Promise<void> {
    const useIntervals = intervals || this.supportedIntervals.slice(0, 3); // Default: 1m, 3m, 5m
    
    this.streamConfigs.set(symbol, {
      symbol,
      intervals: useIntervals,
      enabled: true,
      bufferSize: this.maxWindowSize
    });

    // Initialize candle windows for each interval
    for (const interval of useIntervals) {
      const windowKey = `${symbol}_${interval}`;
      this.candleWindows.set(windowKey, {
        symbol,
        interval,
        candles: [],
        maxSize: this.maxWindowSize,
        lastUpdate: Date.now()
      });

      // Initialize metrics
      this.streamMetrics.set(windowKey, {
        symbol,
        interval,
        totalMessages: 0,
        validMessages: 0,
        invalidMessages: 0,
        lastUpdate: Date.now(),
        latencyMs: 0,
        connectionUptime: 0,
        reconnectionCount: 0
      });
    }

    // Load historical data for each interval
    for (const interval of useIntervals) {
      try {
        await this.refreshHistoricalData(symbol, interval);
      } catch (error) {
        logger.error('Failed to load historical data during initialization', {
          symbol,
          interval,
          error: { message: error instanceof Error ? error.message : String(error) }
        });
      }
    }
  }

  /**
   * Start all WebSocket streams
   */
  private async startAllStreams(): Promise<void> {
    const promises = Array.from(this.streamConfigs.keys())
      .map(symbol => this.startStreamsForSymbol(symbol));
    
    await Promise.all(promises);
  }

  /**
   * Stop all WebSocket streams
   */
  private async stopAllStreams(): Promise<void> {
    const promises = Array.from(this.activeStreams.values())
      .map(ws => this.closeWebSocket(ws));
    
    await Promise.all(promises);
    this.activeStreams.clear();
  }

  /**
   * Start streams for a specific symbol
   */
  private async startStreamsForSymbol(symbol: string): Promise<void> {
    const config = this.streamConfigs.get(symbol);
    if (!config || !config.enabled) {
      return;
    }

    try {
      // Start candlestick streams for each interval
      for (const interval of config.intervals) {
        await this.startKlineStream(symbol, interval);
      }

      // Start price ticker stream for the symbol
      await this.startTickerStream(symbol);
      
      logger.info('Started streams for symbol', {
        symbol,
        intervals: config.intervals,
        streamCount: config.intervals.length + 1 // +1 for ticker
      });
    } catch (error) {
      logger.error('Failed to start streams for symbol', {
        symbol,
        error: { message: error instanceof Error ? error.message : String(error) }
      });
      throw error;
    }
  }

  /**
   * Stop streams for a specific symbol
   */
  private async stopStreamsForSymbol(symbol: string): Promise<void> {
    const streamsToClose = Array.from(this.activeStreams.entries())
      .filter(([key]) => key.includes(symbol))
      .map(([key, ws]) => ({ key, ws }));

    for (const { key, ws } of streamsToClose) {
      try {
        await this.closeWebSocket(ws);
        this.activeStreams.delete(key);
      } catch (error) {
        logger.error('Failed to close stream', { streamKey: key, error: { message: error instanceof Error ? error.message : String(error) } });
      }
    }

    logger.info('Stopped streams for symbol', { symbol, streamsClosed: streamsToClose.length });
  }

  /**
   * Start candlestick stream for symbol and interval
   */
  private async startKlineStream(symbol: string, interval: string): Promise<void> {
    const streamKey = `kline_${symbol}_${interval}`;
    
    if (this.activeStreams.has(streamKey)) {
      logger.debug('Kline stream already exists', { symbol, interval });
      return;
    }

    try {
      await this.binanceService.startKlineStream(symbol, interval, (candle: Candle) => {
        this.handleKlineData(symbol, interval, candle);
      });

      logger.debug('Started kline stream', { symbol, interval, streamKey });
    } catch (error) {
      logger.error('Failed to start kline stream', {
        symbol,
        interval,
        error: { message: error instanceof Error ? error.message : String(error) }
      });
      throw error;
    }
  }

  /**
   * Start price ticker stream for symbol
   */
  private async startTickerStream(symbol: string): Promise<void> {
    const streamKey = `ticker_${symbol}`;
    
    if (this.activeStreams.has(streamKey)) {
      logger.debug('Ticker stream already exists', { symbol });
      return;
    }

    try {
      await this.binanceService.startPriceStream([symbol], (marketData: MarketData) => {
        this.handleTickerData(symbol, marketData);
      });

      logger.debug('Started ticker stream', { symbol, streamKey });
    } catch (error) {
      logger.error('Failed to start ticker stream', {
        symbol,
        error: { message: error instanceof Error ? error.message : String(error) }
      });
      throw error;
    }
  }

  /**
   * Handle incoming candlestick data
   */
  private handleKlineData(symbol: string, interval: string, candle: Candle): void {
    const startTime = Date.now();
    const windowKey = `${symbol}_${interval}`;
    
    try {
      // Validate candlestick data
      if (this.dataValidationEnabled && !this.validateCandleData(candle)) {
        this.updateMetrics(windowKey, false, startTime);
        logger.warn('Invalid candle data received', { symbol, interval, candle });
        return;
      }

      // Get or create candle window
      const window = this.candleWindows.get(windowKey);
      if (!window) {
        logger.error('Candle window not found', { symbol, interval, windowKey });
        return;
      }

      // Add candle to sliding window
      this.addCandleToWindow(window, candle);

      // Update metrics
      this.updateMetrics(windowKey, true, startTime);

      // Emit events
      this.emit('candleUpdate', {
        symbol,
        interval,
        candle,
        type: 'candle',
        timestamp: Date.now()
      } as MarketDataUpdate);

      logger.debug('Candle data processed', {
        symbol,
        interval,
        candleTime: new Date(candle.openTime).toISOString(),
        windowSize: window.candles.length
      });

    } catch (error) {
      this.updateMetrics(windowKey, false, startTime);
      logger.error('Error processing candle data', {
        symbol,
        interval,
        error: { message: error instanceof Error ? error.message : String(error) },
        candle
      });
    }
  }

  /**
   * Handle incoming ticker data
   */
  private handleTickerData(symbol: string, marketData: MarketData): void {
    const startTime = Date.now();
    
    try {
      // Validate market data
      if (this.dataValidationEnabled && !this.validateMarketData(marketData)) {
        logger.warn('Invalid market data received', { symbol, marketData });
        return;
      }

      // Update market data cache
      this.marketDataCache.set(symbol, marketData);

      // Emit events
      this.emit('marketDataUpdate', {
        symbol,
        marketData,
        type: 'ticker',
        timestamp: Date.now()
      } as MarketDataUpdate);

      logger.debug('Market data updated', {
        symbol,
        price: marketData.price,
        volume: marketData.volume24h,
        change: marketData.priceChangePercent24h
      });

    } catch (error) {
      logger.error('Error processing ticker data', {
        symbol,
        error: { message: error instanceof Error ? error.message : String(error) },
        marketData
      });
    }
  }

  /**
   * Add candle to sliding window with memory management
   */
  private addCandleToWindow(window: CandleWindow, newCandle: Candle): void {
    // Check if this is an update to the last candle or a new candle
    const lastCandle = window.candles[window.candles.length - 1];
    
    if (lastCandle && lastCandle.openTime === newCandle.openTime) {
      // Update existing candle in-place
      window.candles[window.candles.length - 1] = newCandle;
    } else {
      // Add new candle and maintain sliding window size
      window.candles.push(newCandle);
      
      // Remove oldest element in O(1) instead of copying the entire array
      if (window.candles.length > window.maxSize) {
        window.candles.shift();
      }
    }
    
    window.lastUpdate = Date.now();
  }

  /**
   * Validate candlestick data
   */
  private validateCandleData(candle: Candle): boolean {
    if (!candle) return false;
    
    // Check required fields
    const requiredFields = ['openTime', 'open', 'high', 'low', 'close', 'volume'];
    for (const field of requiredFields) {
      if (candle[field] === undefined || candle[field] === null) {
        return false;
      }
    }

    // Check logical consistency
    if (candle.high < candle.open || candle.high < candle.close) return false;
    if (candle.low > candle.open || candle.low > candle.close) return false;
    if (candle.volume < 0) return false;
    if (candle.openTime >= candle.closeTime) return false;

    // Check for reasonable price values
    if (candle.open <= 0 || candle.high <= 0 || candle.low <= 0 || candle.close <= 0) {
      return false;
    }

    return true;
  }

  /**
   * Validate market data
   */
  private validateMarketData(data: MarketData): boolean {
    if (!data || !data.symbol) return false;
    
    // Check for reasonable price values
    if (data.price <= 0) return false;
    if (data.volume24h < 0) return false;
    
    return true;
  }

  /**
   * Update stream metrics
   */
  private updateMetrics(streamKey: string, isValid: boolean, startTime: number): void {
    const metrics = this.streamMetrics.get(streamKey);
    if (!metrics) return;

    metrics.totalMessages++;
    
    if (isValid) {
      metrics.validMessages++;
    } else {
      metrics.invalidMessages++;
    }
    
    metrics.lastUpdate = Date.now();
    metrics.latencyMs = Date.now() - startTime;
    metrics.connectionUptime = Date.now() - this.startTime;
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    // Intentionally empty — shutdown is orchestrated by the bot's process signal handlers
    // in src/index.ts to avoid double-stop warnings.
  }

  /**
   * Start performance monitoring
   */
  private startPerformanceMonitoring(): void {
    this.performanceTimer = setInterval(() => {
      this.emitPerformanceMetrics();
    }, config.monitoring.metricsInterval || 30000);
  }

  /**
   * Emit performance metrics
   */
  private emitPerformanceMetrics(): void {
    const metrics = {
      uptime: Date.now() - this.startTime,
      activeStreams: this.activeStreams.size,
      candleWindows: this.candleWindows.size,
      marketDataEntries: this.marketDataCache.size,
      totalMessages: Array.from(this.streamMetrics.values())
        .reduce((sum, metric) => sum + metric.totalMessages, 0),
      validMessages: Array.from(this.streamMetrics.values())
        .reduce((sum, metric) => sum + metric.validMessages, 0),
      invalidMessages: Array.from(this.streamMetrics.values())
        .reduce((sum, metric) => sum + metric.invalidMessages, 0),
      avgLatency: this.calculateAverageLatency(),
      memoryUsage: process.memoryUsage()
    };

    this.emit('performanceMetrics', metrics);
    
    logger.performance('MarketDataService metrics', metrics.uptime, {
      streams: metrics.activeStreams,
      windows: metrics.candleWindows,
      messages: metrics.totalMessages,
      avgLatency: metrics.avgLatency
    });
  }

  /**
   * Calculate average latency across all streams
   */
  private calculateAverageLatency(): number {
    const latencies = Array.from(this.streamMetrics.values())
      .map(metric => metric.latencyMs)
      .filter(latency => latency > 0);
    
    if (latencies.length === 0) return 0;
    
    return latencies.reduce((sum, latency) => sum + latency, 0) / latencies.length;
  }

  /**
   * Close WebSocket connection gracefully
   */
  private async closeWebSocket(ws: WebSocket): Promise<void> {
    return new Promise((resolve) => {
      if (ws.readyState === WebSocket.CLOSED) {
        resolve();
        return;
      }

      ws.once('close', () => resolve());
      ws.close();

      // Force close after timeout
      setTimeout(() => {
        if (ws.readyState !== WebSocket.CLOSED) {
          ws.terminate();
        }
        resolve();
      }, 5000);
    });
  }
}