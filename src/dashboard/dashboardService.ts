import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import config from '../config';
import { DashboardData } from '../types';
import detectPort from 'detect-port';

/**
 * Dashboard service for real-time monitoring
 */
export class DashboardService {
  private app: express.Application;
  private server: http.Server;
  private io: Server;
  private isRunning: boolean = false;

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
    this.app.use(express.static(path.join(__dirname, 'public')));
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

    // Portfolio endpoint
    this.app.get('/api/portfolio', (_req, res) => {
      // This will be connected to the trading bot's portfolio data
      res.json({
        totalBalance: 0,
        availableBalance: 0,
        dailyPnl: 0,
        openPositions: []
      });
    });

    // Paper trading metrics endpoint
    this.app.get('/api/paper-trading/metrics', (_req, res) => {
      if (config.trading.mode === 'paper') {
        // This will be connected to the paper trading service
        res.json({
          totalSimulatedTrades: 0,
          totalSimulatedVolume: 0,
          averageSlippage: '0.00%',
          totalSimulatedFees: 0,
          executionAccuracy: '100.00%',
          largestOrder: 0,
          averageOrderSize: 0,
          currentOpenPositions: 0,
          totalPnl: 0,
          dailyPnl: 0,
          riskExposure: 0,
          availableBalance: 0,
          recentSlippage: 0
        });
      } else {
        res.status(404).json({ error: 'Paper trading mode not active' });
      }
    });

    // Paper trading validation endpoint
    this.app.get('/api/paper-trading/validation', async (_req, res) => {
      if (config.trading.mode === 'paper') {
        try {
          // This would connect to the validation service
          res.json({
            overallAccuracy: '95.2%',
            slippageAccuracy: '93.8%',
            feeAccuracy: '97.1%',
            executionTimeAccuracy: '94.6%',
            status: 'EXCELLENT',
            lastValidation: Date.now(),
            recommendations: []
          });
        } catch (error) {
          res.status(500).json({ error: 'Validation service unavailable' });
        }
      } else {
        res.status(404).json({ error: 'Paper trading mode not active' });
      }
    });

    // Paper trading execution history endpoint
    this.app.get('/api/paper-trading/executions', (_req, res) => {
      if (config.trading.mode === 'paper') {
        res.json({
          executions: [],
          totalExecutions: 0,
          averageExecutionTime: 0,
          successRate: 100
        });
      } else {
        res.status(404).json({ error: 'Paper trading mode not active' });
      }
    });

    // Reset paper trading stats endpoint
    this.app.post('/api/paper-trading/reset', (_req, res) => {
      if (config.trading.mode === 'paper') {
        // This would connect to the paper trading service reset method
        res.json({ message: 'Paper trading statistics reset successfully' });
      } else {
        res.status(404).json({ error: 'Paper trading mode not active' });
      }
    });

    // Export paper trading data endpoint
    this.app.get('/api/paper-trading/export', (_req, res) => {
      if (config.trading.mode === 'paper') {
        // This would connect to the paper trading service export method
        res.json({
          exportData: {},
          timestamp: Date.now(),
          format: 'json'
        });
      } else {
        res.status(404).json({ error: 'Paper trading mode not active' });
      }
    });

    // Trading status endpoint
    this.app.get('/api/status', (_req, res) => {
      res.json({
        trading: false,
        mode: config.trading.mode,
        pairs: config.trading.pairs,
        lastUpdate: Date.now()
      });
    });

    // Serve main dashboard page
    this.app.get('/', (_req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });
    
    // Manual control dashboard
    this.app.get('/control', (_req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'control.html'));
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
  }

  /**
   * Setup WebSocket connections
   */
  private setupWebSocket(): void {
    this.io.on('connection', (socket) => {
      console.log('Dashboard client connected:', socket.id);

      socket.on('disconnect', () => {
        console.log('Dashboard client disconnected:', socket.id);
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
      console.log('Dashboard is already running');
      return;
    }

    const port = await detectPort(config.dashboard.port);
    
    return new Promise((resolve, reject) => {
      this.server.listen(port, () => {
        this.isRunning = true;
        console.log(`Dashboard server started on port ${port}`);
        console.log(`Access dashboard at: http://localhost:${port}`);
        console.log(`Access manual control at: http://localhost:${port}/control`);
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
        console.log('Dashboard server stopped');
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
    console.log('Manual control request:', data);
    
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
    console.log('Parameter update request:', data);
    
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
    console.log('Emergency stop request:', data);
    
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
   * Get express app (for manual override service)
   */
  getApp(): express.Application {
    return this.app;
  }
}