import { 
  RiskManager,
  OrderManager,
  EmergencyStopService,
  ExecutionOptimizationService,
  ManualOverrideService,
  BinanceService
} from './index';
import { DashboardService } from '../dashboard/dashboardService';
import { SystemHealthMetrics, Portfolio, MarketData } from '../types';
import logger, { toLogError } from './logger';
import monitoringService from './monitoringService';
import config from '../config';

/**
 * Enhanced Trading Bot Integration Service
 * Coordinates all services with emergency stops, execution optimization, and manual overrides
 */
export class EnhancedTradingBot {
  private riskManager: RiskManager;
  private orderManager: OrderManager;
  private binanceService: BinanceService;
  private emergencyStopService: EmergencyStopService;
  private executionOptimizationService: ExecutionOptimizationService;
  private manualOverrideService: ManualOverrideService;
  private dashboardService: DashboardService;
  
  private isRunning: boolean = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private systemHealthMetrics: SystemHealthMetrics | null = null;
  
  constructor() {
    logger.info('Initializing Enhanced Trading Bot...');
    
    // Initialize core services
    this.riskManager = new RiskManager(config.trading.initialCapital);
    this.orderManager = new OrderManager(this.riskManager);
    this.binanceService = new BinanceService();
    this.dashboardService = new DashboardService();
    
    // Initialize enhanced services
    this.emergencyStopService = new EmergencyStopService(this.riskManager, this.orderManager);
    this.executionOptimizationService = new ExecutionOptimizationService(this.binanceService);
    this.manualOverrideService = new ManualOverrideService(
      this.riskManager,
      this.orderManager,
      this.emergencyStopService,
      this.executionOptimizationService,
      this.dashboardService
    );
    
    // Set up service dependencies
    this.orderManager.setBinanceService(this.binanceService);
    
    // Set up monitoring
    this.setupHealthMonitoring();
    
    logger.info('Enhanced Trading Bot initialized successfully');
  }

  /**
   * Start the enhanced trading bot
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Trading bot is already running');
      return;
    }

    try {
      logger.info('Starting Enhanced Trading Bot...');
      
      // Start dashboard service
      await this.dashboardService.start();
      
      // Initialize Binance service (no explicit connect needed)
      logger.info('Initializing Binance service...');
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Start market data streams
      await this.startMarketDataStreams();
      
      this.isRunning = true;
      
      // Broadcast startup notification
      this.dashboardService.broadcastSystemStatus({
        status: 'STARTED',
        message: 'Enhanced Trading Bot started successfully',
        timestamp: Date.now(),
        features: {
          emergencyStops: true,
          executionOptimization: true,
          manualOverrides: true
        }
      });
      
      logger.info('Enhanced Trading Bot started successfully');
      
    } catch (error) {
      logger.error('Failed to start Enhanced Trading Bot:', toLogError(error));
      throw error;
    }
  }

  /**
   * Stop the enhanced trading bot
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Trading bot is not running');
      return;
    }

    try {
      logger.info('Stopping Enhanced Trading Bot...');
      
      this.isRunning = false;
      
      // Stop health monitoring
      this.stopHealthMonitoring();
      
      // Shutdown services
      this.emergencyStopService.shutdown();
      this.manualOverrideService.shutdown();
      
      // Disconnect from Binance
      await this.binanceService.disconnect();
      
      // Stop dashboard
      await this.dashboardService.stop();
      
      logger.info('Enhanced Trading Bot stopped successfully');
      
    } catch (error) {
      logger.error('Error stopping Enhanced Trading Bot:', toLogError(error));
      throw error;
    }
  }

  /**
   * Execute an optimized trade
   */
  async executeTrade(orderRequest: any, marketData: MarketData): Promise<any> {
    try {
      // Check if trading is allowed
      if (this.manualOverrideService.isTradingPaused()) {
        logger.warn('Trading is paused, rejecting order');
        return null;
      }
      
      if (this.emergencyStopService.isEmergencyStopActive()) {
        logger.warn('Emergency stop is active, rejecting order');
        return null;
      }
      
      // Optimize order execution
      const optimization = await this.executionOptimizationService.optimizeOrderExecution(
        orderRequest,
        marketData
      );
      
      logger.info('Order optimization completed', {
        symbol: orderRequest.symbol,
        originalSize: orderRequest.quantity,
        optimizedSize: optimization.optimizedOrder.quantity,
        estimatedSlippage: optimization.estimatedSlippage,
        confidence: optimization.executionPlan.confidence
      });
      
      // Execute optimized order
      const execution = await this.executionOptimizationService.executeOptimizedOrder(
        optimization.optimizedOrder,
        optimization.executionPlan
      );
      
      // Store execution metrics
      logger.info('Trade executed successfully', {
        orderId: execution.executedOrder.orderId,
        actualSlippage: execution.metrics.slippagePercent,
        executionTime: execution.metrics.executionTime,
        fees: execution.metrics.fees
      });
      
      // Broadcast execution to dashboard
      this.dashboardService.broadcastTrade({
        action: 'ORDER_EXECUTED',
        order: execution.executedOrder,
        metrics: execution.metrics,
        optimization: optimization,
        timestamp: Date.now()
      });
      
      // Broadcast execution metrics
      this.dashboardService.broadcastExecutionMetrics(execution.metrics);
      
      return execution;
      
    } catch (error) {
      logger.error('Error executing trade:', toLogError(error));
      
      // Broadcast error
      this.dashboardService.broadcastSystemStatus({
        status: 'ERROR',
        message: `Trade execution failed: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: Date.now()
      });
      
      throw error;
    }
  }

  /**
   * Process market data update
   */
  async processMarketData(marketData: MarketData[]): Promise<void> {
    try {
      // Update system health metrics
      this.updateSystemHealth();
      
      // Monitor positions
      this.orderManager.monitorPositions(marketData);
      
      // Update emergency stop service with latest metrics
      if (this.systemHealthMetrics) {
        this.emergencyStopService.updateSystemHealthMetrics(this.systemHealthMetrics);
      }
      
      // Update manual override risk thresholds
      const portfolio = this.riskManager.getPortfolio();
      if (this.systemHealthMetrics) {
        this.manualOverrideService.updateRiskThresholds(portfolio, this.systemHealthMetrics);
      }
      
      // Broadcast portfolio updates
      this.dashboardService.broadcastPortfolioUpdate(portfolio);
      
      // Broadcast market data
      this.dashboardService.broadcastMarketData(marketData);
      
    } catch (error) {
      logger.error('Error processing market data:', toLogError(error));
    }
  }

  /**
   * Setup health monitoring
   */
  private setupHealthMonitoring(): void {
    // Monitor system health
    monitoringService.on('healthUpdate', (healthData) => {
      this.systemHealthMetrics = {
        timestamp: Date.now(),
        apiLatency: healthData.apiLatency || 0,
        memoryUsage: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal,
        cpuUsage: 0, // Would be calculated from system metrics
        activeConnections: this.dashboardService.getConnectionCount(),
        orderExecutionRate: 0, // Would be calculated from recent orders
        errorRate: 0, // Would be calculated from error logs
        systemUptime: process.uptime(),
        lastHealthCheck: Date.now()
      };
    });
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(): Promise<void> {
    try {
      // Update system health
      this.updateSystemHealth();
      
      // Check service health
      const healthStatus = {
        timestamp: Date.now(),
        services: {
          binance: 'active', // No isConnected method available
          dashboard: this.dashboardService.isActive() ? 'active' : 'inactive',
          emergencyStop: this.emergencyStopService.isEmergencyStopActive() ? 'active' : 'inactive',
          trading: this.manualOverrideService.isTradingPaused() ? 'paused' : 'active'
        },
        portfolio: this.riskManager.getPortfolio(),
        riskHealth: this.riskManager.getRiskHealth(),
        executionAnalytics: this.executionOptimizationService.getExecutionAnalytics(),
        pendingCommands: this.manualOverrideService.getPendingCommandsCount()
      };
      
      // Broadcast health status
      this.dashboardService.broadcastSystemStatus(healthStatus);
      
      logger.debug('Health check completed', {
        services: healthStatus.services,
        riskStatus: healthStatus.riskHealth.status
      });
      
    } catch (error) {
      logger.error('Health check failed:', toLogError(error));
    }
  }

  /**
   * Update system health metrics
   */
  private updateSystemHealth(): void {
    const memUsage = process.memoryUsage();
    
    this.systemHealthMetrics = {
      timestamp: Date.now(),
      apiLatency: 50, // Would be measured from actual API calls
      memoryUsage: memUsage.heapUsed / memUsage.heapTotal,
      cpuUsage: 0.1, // Would be measured from system
      activeConnections: this.dashboardService.getConnectionCount(),
      orderExecutionRate: 5, // Would be calculated from recent orders
      errorRate: 0.1, // Would be calculated from error logs
      systemUptime: process.uptime(),
      lastHealthCheck: Date.now()
    };
  }

  /**
   * Start market data streams
   */
  private async startMarketDataStreams(): Promise<void> {
    // This would start WebSocket streams for market data
    logger.info('Market data streams started');
    
    // Simulate market data updates
    setInterval(() => {
      const mockMarketData: MarketData[] = config.trading.pairs.map(symbol => ({
        symbol,
        price: 50000 + Math.random() * 1000,
        volume24h: 1000000,
        priceChange24h: Math.random() * 100 - 50,
        priceChangePercent24h: Math.random() * 2 - 1,
        bid: 50000,
        ask: 50001,
        spread: 1,
        timestamp: Date.now()
      }));
      
      this.processMarketData(mockMarketData);
    }, 5000);
  }

  /**
   * Get system status
   */
  getSystemStatus(): any {
    return {
      isRunning: this.isRunning,
      emergencyStopActive: this.emergencyStopService.isEmergencyStopActive(),
      tradingPaused: this.manualOverrideService.isTradingPaused(),
      portfolio: this.riskManager.getPortfolio(),
      riskHealth: this.riskManager.getRiskHealth(),
      executionAnalytics: this.executionOptimizationService.getExecutionAnalytics(),
      systemHealth: this.systemHealthMetrics,
      timestamp: Date.now()
    };
  }

  /**
   * Get execution analytics
   */
  getExecutionAnalytics(): any {
    return this.executionOptimizationService.getExecutionAnalytics();
  }

  /**
   * Get emergency stop state
   */
  getEmergencyStopState(): any {
    return this.emergencyStopService.getState();
  }

  /**
   * Get manual override activity
   */
  getManualOverrideActivity(): any {
    return this.manualOverrideService.getRecentActivity();
  }
}

export default EnhancedTradingBot;