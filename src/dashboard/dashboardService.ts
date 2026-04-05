import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import config from '../config';
import { DashboardData } from '../types';
import detectPort from 'detect-port';
import { logger } from '../services/logger';
import { MarketDataService } from '../services/marketDataService';

/**
 * Dashboard service for real-time monitoring
 */
/** Normalize a symbol like 'BTC/USD' or 'BTC/USDT' to Binance format 'BTCUSDT' */
function normalizeSymbol(symbol: string): string {
  let s = symbol.replace('/', '').toUpperCase();
  if (s.endsWith('USD') && !s.endsWith('USDT')) s += 'T';
  return s;
}

export class DashboardService {
  private app: express.Application;
  private server: http.Server;
  private io: Server;
  private isRunning: boolean = false;
  private marketDataService: MarketDataService | null = null;

  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    this.app.use(express.json());
    this.app.use(cors());
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Import analytics routes
    const analyticsRoutes = require('./analyticsRoutes').default;
    this.app.use('/api/analytics', analyticsRoutes);

    // Health check endpoint
    this.app.get('/api/health', (_req, res) => {
      res.json({
        status: 'healthy',
        timestamp: Date.now(),
        uptime: process.uptime()
      });
    });

    // Performance projections endpoint for 1:2 risk-reward ratio
    this.app.get('/api/performance/projections', (_req, res) => {
      try {
        const performanceProjectionService = require('../services/performanceProjectionService').default;
        const projections = performanceProjectionService.getFormattedSummary();
        const comparison = performanceProjectionService.getPerformanceComparison();
        const validation = performanceProjectionService.validateConfiguration();
        
        res.json({
          current: projections,
          comparison,
          validation,
          timestamp: Date.now()
        });
      } catch (error) {
        res.status(500).json({ error: 'Failed to get performance projections' });
      }
    });

    // Market data endpoints
    this.app.get('/api/market/candles', (req, res) => {
      if (!this.marketDataService) {
        res.json({ success: true, data: [], timestamp: Date.now() });
        return;
      }
      const symbol = normalizeSymbol(String(req.query.symbol || ''));
      const interval = String(req.query.interval || '5m');
      const limit = Math.min(Number(req.query.limit) || 100, 1000);
      const candles = this.marketDataService.getCandles(symbol, interval, limit);
      res.json({ success: true, data: candles, timestamp: Date.now() });
    });

    this.app.get('/api/market/ticker', (req, res) => {
      if (!this.marketDataService) {
        res.json({ success: true, data: null, timestamp: Date.now() });
        return;
      }
      const symbol = normalizeSymbol(String(req.query.symbol || ''));
      const data = this.marketDataService.getMarketData(symbol);
      res.json({ success: true, data, timestamp: Date.now() });
    });

    this.app.get('/api/market/status', (_req, res) => {
      if (!this.marketDataService) {
        res.json({ success: true, data: { active: false }, timestamp: Date.now() });
        return;
      }
      const status = this.marketDataService.getConnectionStatus();
      res.json({ success: true, data: status, timestamp: Date.now() });
    });
  }

  /**
   * Setup WebSocket connections
   */
  private setupWebSocket(): void {
    this.io.on('connection', (socket) => {
      logger.info(`Dashboard client connected: ${socket.id}`);

      socket.on('disconnect', () => {
        logger.info(`Dashboard client disconnected: ${socket.id}`);
      });

      // Send initial data
      this.sendInitialData(socket);
      
      // Handle manual control requests
      socket.on('manual-control', (data) => {
        this.handleManualControl(socket, data);
      });
      
      // Handle parameter updates
      socket.on('update-parameter', (data) => {
        this.handleParameterUpdate(socket, data);
      });
      
      // Handle emergency stop
      socket.on('emergency-stop', (data) => {
        this.handleEmergencyStop(socket, data);
      });
    });
  }

  /**
   * Send initial data to connected client
   */
  private sendInitialData(socket: any): void {
    const initialData: DashboardData = {
      portfolio: {
        totalBalance: config.trading.initialCapital,
        availableBalance: config.trading.initialCapital,
        lockedBalance: 0,
        totalPnl: 0,
        totalPnlPercent: 0,
        dailyPnl: 0,
        dailyPnlPercent: 0,
        openPositions: [],
        riskExposure: 0,
        maxDrawdown: 0
      },
      activePositions: [],
      recentSignals: [],
      marketData: [],
      performance: {
        dailyPnl: 0,
        weeklyPnl: 0,
        monthlyPnl: 0,
        totalTrades: 0,
        winRate: 0
      }
    };

    socket.emit('dashboard-data', initialData);
  }

  /**
   * Start the dashboard server
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.info('Dashboard is already running');
      return;
    }

    const port = await detectPort(config.dashboard.port);
    
    return new Promise((resolve, reject) => {
      this.server.listen(port, () => {
        this.isRunning = true;
        logger.info(`Dashboard server started on port ${port}`);
        logger.info(`Access dashboard at: http://localhost:${port}`);
        logger.info(`Access manual control at: http://localhost:${port}/control`);
        resolve();
      });

      this.server.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Stop the dashboard server
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;

    return new Promise((resolve) => {
      this.server.close(() => {
        this.isRunning = false;
        logger.info('Dashboard server stopped');
        resolve();
      });
    });
  }

  /**
   * Broadcast portfolio update to all connected clients
   */
  broadcastPortfolioUpdate(portfolioData: any): void {
    this.io.emit('portfolio-update', portfolioData);
  }

  /**
   * Broadcast new trade signal to all connected clients
   */
  broadcastSignal(signal: any): void {
    this.io.emit('new-signal', signal);
  }

  /**
   * Broadcast trade execution to all connected clients
   */
  broadcastTrade(trade: any): void {
    this.io.emit('trade-executed', trade);
  }

  /**
   * Broadcast market data update
   */
  broadcastMarketData(marketData: any): void {
    this.io.emit('market-data', marketData);
  }

  /**
   * Broadcast system status update
   */
  broadcastSystemStatus(status: any): void {
    this.io.emit('system-status', status);
  }

  /**
   * Get connection count
   */
  getConnectionCount(): number {
    return this.io.sockets.sockets.size;
  }

  /**
   * Check if dashboard is running
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Handle manual control requests from WebSocket
   */
  private handleManualControl(socket: any, data: any): void {
    logger.info('Manual control request', { data });
    
    // Emit response back to client
    socket.emit('manual-control-response', {
      success: true,
      action: data.action,
      timestamp: Date.now()
    });
    
    // Broadcast to all clients
    this.io.emit('system-update', {
      type: 'MANUAL_CONTROL',
      action: data.action,
      user: data.user || 'unknown',
      timestamp: Date.now()
    });
  }

  /**
   * Handle parameter update requests
   */
  private handleParameterUpdate(socket: any, data: any): void {
    logger.info('Parameter update request', { data });
    
    socket.emit('parameter-update-response', {
      success: true,
      parameter: data.parameter,
      oldValue: data.oldValue,
      newValue: data.newValue,
      timestamp: Date.now()
    });
  }

  /**
   * Handle emergency stop requests
   */
  private handleEmergencyStop(socket: any, data: any): void {
    logger.info('Emergency stop request', { data });
    
    socket.emit('emergency-stop-response', {
      success: true,
      reason: data.reason,
      timestamp: Date.now()
    });
    
    // Broadcast emergency status to all clients
    this.io.emit('emergency-alert', {
      type: 'EMERGENCY_STOP',
      reason: data.reason,
      triggeredBy: data.user || 'unknown',
      timestamp: Date.now()
    });
  }

  /**
   * Broadcast emergency alerts
   */
  broadcastEmergencyAlert(alert: any): void {
    this.io.emit('emergency-alert', {
      ...alert,
      timestamp: Date.now()
    });
  }

  /**
   * Broadcast manual override notifications
   */
  broadcastManualOverride(override: any): void {
    this.io.emit('manual-override', {
      ...override,
      timestamp: Date.now()
    });
  }

  /**
   * Broadcast execution optimization updates
   */
  broadcastExecutionMetrics(metrics: any): void {
    this.io.emit('execution-metrics', metrics);
  }

  /**
   * Wire up a MarketDataService so the /api/market/* routes can serve live data
   */
  setMarketDataService(mds: MarketDataService): void {
    this.marketDataService = mds;
  }

  /**
   * Get express app (for manual override service)
   */
  getApp(): express.Application {
    return this.app;
  }
}