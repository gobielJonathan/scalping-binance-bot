import express from 'express';
import { 
  ManualOverrideCommand,
  StrategyParameter,
  RiskThreshold,
  TradePosition,
  Portfolio,
  SystemHealthMetrics
} from '../types';
import { RiskManager } from './riskManager';
import { OrderManager } from './orderManager';
import { EmergencyStopService } from './emergencyStopService';
import { ExecutionOptimizationService } from './executionOptimizationService';
import { DashboardService } from '../dashboard/dashboardService';
import logger, { toLogError } from './logger';
import config from '../config';

/**
 * Manual Override Service - Provides manual control capabilities for the trading bot
 */
export class ManualOverrideService {
  private riskManager: RiskManager;
  private orderManager: OrderManager;
  private emergencyStopService: EmergencyStopService;
  private executionOptimizationService: ExecutionOptimizationService;
  private dashboardService: DashboardService;
  
  private overrideCommands: Map<string, ManualOverrideCommand> = new Map();
  private strategyParameters: Map<string, StrategyParameter> = new Map();
  private riskThresholds: Map<string, RiskThreshold> = new Map();
  private tradingPaused: boolean = false;
  private authorizedUsers: Set<string> = new Set(['admin', 'trader1']);
  
  constructor(
    riskManager: RiskManager,
    orderManager: OrderManager,
    emergencyStopService: EmergencyStopService,
    executionOptimizationService: ExecutionOptimizationService,
    dashboardService: DashboardService
  ) {
    this.riskManager = riskManager;
    this.orderManager = orderManager;
    this.emergencyStopService = emergencyStopService;
    this.executionOptimizationService = executionOptimizationService;
    this.dashboardService = dashboardService;
    
    this.initializeDefaultParameters();
    this.initializeDefaultThresholds();
    this.setupDashboardRoutes();
  }

  /**
   * Initialize default strategy parameters
   */
  private initializeDefaultParameters(): void {
    const defaultParameters: StrategyParameter[] = [
      {
        key: 'riskPerTrade',
        currentValue: config.trading.riskPerTrade,
        type: 'number',
        min: 0.001,
        max: 0.05,
        description: 'Maximum risk per trade as percentage of total balance',
        category: 'RISK'
      },
      {
        key: 'maxConcurrentTrades',
        currentValue: config.trading.maxConcurrentTrades,
        type: 'number',
        min: 1,
        max: 20,
        description: 'Maximum number of concurrent open positions',
        category: 'RISK'
      },
      {
        key: 'stopLossPercentage',
        currentValue: config.trading.stopLossPercentage,
        type: 'number',
        min: 0.005,
        max: 0.1,
        description: 'Stop loss percentage',
        category: 'RISK'
      },
      {
        key: 'takeProfitPercentage',
        currentValue: config.trading.takeProfitPercentage,
        type: 'number',
        min: 0.005,
        max: 0.2,
        description: 'Take profit percentage',
        category: 'RISK'
      },
      {
        key: 'tradingEnabled',
        currentValue: true,
        type: 'boolean',
        description: 'Enable or disable automatic trading',
        category: 'GENERAL'
      }
    ];

    defaultParameters.forEach(param => {
      this.strategyParameters.set(param.key, param);
    });
  }

  /**
   * Initialize default risk thresholds
   */
  private initializeDefaultThresholds(): void {
    const defaultThresholds: RiskThreshold[] = [
      {
        metric: 'DAILY_LOSS',
        currentValue: 0,
        threshold: -0.05,
        warningLevel: 0.8,
        action: 'EMERGENCY_STOP',
        enabled: true
      },
      {
        metric: 'DRAWDOWN',
        currentValue: 0,
        threshold: -0.15,
        warningLevel: 0.7,
        action: 'REDUCE_EXPOSURE',
        enabled: true
      },
      {
        metric: 'EXPOSURE',
        currentValue: 0,
        threshold: 0.8,
        warningLevel: 0.9,
        action: 'STOP_NEW_TRADES',
        enabled: true
      }
    ];

    defaultThresholds.forEach(threshold => {
      this.riskThresholds.set(threshold.metric, threshold);
    });
  }

  /**
   * Setup additional dashboard routes for manual override
   */
  private setupDashboardRoutes(): void {
    const app = this.dashboardService.getApp(); // Use public method
    
    // Manual control endpoints
    app.post('/api/manual/emergency-stop', this.handleEmergencyStop.bind(this));
    app.post('/api/manual/resume-trading', this.handleResumeTrading.bind(this));
    app.post('/api/manual/close-position', this.handleClosePosition.bind(this));
    app.post('/api/manual/close-all-positions', this.handleCloseAllPositions.bind(this));
    app.post('/api/manual/pause-trading', this.handlePauseTrading.bind(this));
    app.post('/api/manual/adjust-parameter', this.handleAdjustParameter.bind(this));
    app.post('/api/manual/update-threshold', this.handleUpdateThreshold.bind(this));
    
    // Status and information endpoints
    app.get('/api/manual/commands', this.getOverrideCommands.bind(this));
    app.get('/api/manual/parameters', this.getStrategyParameters.bind(this));
    app.get('/api/manual/thresholds', this.getRiskThresholds.bind(this));
    app.get('/api/manual/status', this.getSystemStatus.bind(this));
    
    // Override command management
    app.post('/api/manual/approve-command', this.handleApproveCommand.bind(this));
    app.post('/api/manual/reject-command', this.handleRejectCommand.bind(this));
    
    logger.info('Manual override dashboard routes initialized');
  }

  /**
   * Handle emergency stop command
   */
  private async handleEmergencyStop(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { reason, userId } = req.body;
      
      if (!this.isAuthorizedUser(userId)) {
        res.status(401).json({ error: 'Unauthorized user' });
        return;
      }
      
      const command: ManualOverrideCommand = {
        id: `cmd_${Date.now()}`,
        type: 'EMERGENCY_STOP',
        parameters: { reason },
        requestedBy: userId,
        requestedAt: Date.now(),
        status: 'EXECUTED', // Emergency stops are executed immediately
        reason: reason || 'Manual emergency stop',
        requiresApproval: false,
        priority: 'CRITICAL'
      };
      
      // Execute emergency stop immediately
      await this.emergencyStopService.manualEmergencyStop(command.reason, userId);
      
      command.executedAt = Date.now();
      this.overrideCommands.set(command.id, command);
      
      // Broadcast to dashboard
      this.dashboardService.broadcastSystemStatus({
        emergencyStop: true,
        message: `Emergency stop triggered by ${userId}`,
        timestamp: Date.now()
      });
      
      logger.warn(`Manual emergency stop executed by ${userId}: ${reason}`);
      
      res.json({
        success: true,
        commandId: command.id,
        message: 'Emergency stop executed successfully'
      });
      
    } catch (error) {
      logger.error('Error executing emergency stop:', toLogError(error));
      res.status(500).json({ error: 'Failed to execute emergency stop' });
    }
  }

  /**
   * Handle resume trading command
   */
  private async handleResumeTrading(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { reason, userId } = req.body;
      
      if (!this.isAuthorizedUser(userId)) {
        res.status(401).json({ error: 'Unauthorized user' });
        return;
      }
      
      const command: ManualOverrideCommand = {
        id: `cmd_${Date.now()}`,
        type: 'RESUME_TRADING',
        parameters: { reason },
        requestedBy: userId,
        requestedAt: Date.now(),
        status: 'PENDING',
        reason: reason || 'Manual trading resume',
        requiresApproval: true, // Resuming requires approval
        priority: 'HIGH'
      };
      
      this.overrideCommands.set(command.id, command);
      
      // If no approval required or user has admin privileges, execute immediately
      if (userId === 'admin') {
        await this.executeResumeTrading(command);
      }
      
      res.json({
        success: true,
        commandId: command.id,
        message: command.status === 'EXECUTED' ? 'Trading resumed' : 'Command pending approval',
        requiresApproval: command.requiresApproval
      });
      
    } catch (error) {
      logger.error('Error handling resume trading:', toLogError(error));
      res.status(500).json({ error: 'Failed to process resume trading request' });
    }
  }

  /**
   * Handle close position command
   */
  private async handleClosePosition(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { positionId, reason, userId } = req.body;
      
      if (!this.isAuthorizedUser(userId)) {
        res.status(401).json({ error: 'Unauthorized user' });
        return;
      }
      
      const command: ManualOverrideCommand = {
        id: `cmd_${Date.now()}`,
        type: 'CLOSE_POSITION',
        parameters: { positionId, reason },
        requestedBy: userId,
        requestedAt: Date.now(),
        status: 'EXECUTED',
        reason: `Manual close: ${reason || 'No reason provided'}`,
        requiresApproval: false,
        priority: 'MEDIUM'
      };
      
      // Execute position close
      const closedPosition = await this.orderManager.closePosition(
        positionId,
        `Manual close by ${userId}: ${reason}`
      );
      
      if (closedPosition) {
        command.executedAt = Date.now();
        this.overrideCommands.set(command.id, command);
        
        // Broadcast update
        this.dashboardService.broadcastTrade({
          action: 'POSITION_CLOSED',
          position: closedPosition,
          reason: command.reason,
          timestamp: Date.now()
        });
        
        logger.info(`Position ${positionId} manually closed by ${userId}`);
        
        res.json({
          success: true,
          commandId: command.id,
          position: closedPosition,
          message: 'Position closed successfully'
        });
      } else {
        command.status = 'FAILED';
        res.status(404).json({ error: 'Position not found or already closed' });
      }
      
    } catch (error) {
      logger.error('Error closing position:', toLogError(error));
      res.status(500).json({ error: 'Failed to close position' });
    }
  }

  /**
   * Handle close all positions command
   */
  private async handleCloseAllPositions(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { reason, userId } = req.body;
      
      if (!this.isAuthorizedUser(userId)) {
        res.status(401).json({ error: 'Unauthorized user' });
        return;
      }
      
      const command: ManualOverrideCommand = {
        id: `cmd_${Date.now()}`,
        type: 'CLOSE_POSITION',
        parameters: { all: true, reason },
        requestedBy: userId,
        requestedAt: Date.now(),
        status: 'EXECUTED',
        reason: `Close all positions: ${reason || 'Manual request'}`,
        requiresApproval: false,
        priority: 'HIGH'
      };
      
      // Get all open positions
      const portfolio = this.riskManager.getPortfolio();
      const openPositions = [...portfolio.openPositions];
      const closedPositions: TradePosition[] = [];
      
      // Close each position
      for (const position of openPositions) {
        try {
          const closed = await this.orderManager.closePosition(
            position.id,
            `Bulk close by ${userId}: ${reason}`
          );
          if (closed) {
            closedPositions.push(closed);
          }
        } catch (error) {
          logger.error(`Failed to close position ${position.id}:`, toLogError(error));
        }
      }
      
      command.executedAt = Date.now();
      command.parameters.closedCount = closedPositions.length;
      this.overrideCommands.set(command.id, command);
      
      // Broadcast update
      this.dashboardService.broadcastSystemStatus({
        message: `All positions closed by ${userId}`,
        closedPositions: closedPositions.length,
        timestamp: Date.now()
      });
      
      logger.info(`All positions (${closedPositions.length}) closed by ${userId}`);
      
      res.json({
        success: true,
        commandId: command.id,
        closedPositions: closedPositions.length,
        message: `${closedPositions.length} positions closed successfully`
      });
      
    } catch (error) {
      logger.error('Error closing all positions:', toLogError(error));
      res.status(500).json({ error: 'Failed to close all positions' });
    }
  }

  /**
   * Handle pause trading command
   */
  private async handlePauseTrading(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { duration, reason, userId } = req.body;
      
      if (!this.isAuthorizedUser(userId)) {
        res.status(401).json({ error: 'Unauthorized user' });
        return;
      }
      
      const command: ManualOverrideCommand = {
        id: `cmd_${Date.now()}`,
        type: 'PAUSE_STRATEGY',
        parameters: { duration, reason },
        requestedBy: userId,
        requestedAt: Date.now(),
        status: 'EXECUTED',
        reason: `Trading paused: ${reason || 'Manual request'}`,
        requiresApproval: false,
        priority: 'MEDIUM'
      };
      
      // Set trading pause
      this.tradingPaused = true;
      
      // Auto-resume after duration if specified
      if (duration && duration > 0) {
        setTimeout(() => {
          this.tradingPaused = false;
          logger.info('Trading automatically resumed after pause duration');
          
          this.dashboardService.broadcastSystemStatus({
            tradingPaused: false,
            message: 'Trading automatically resumed',
            timestamp: Date.now()
          });
        }, duration * 1000);
      }
      
      command.executedAt = Date.now();
      this.overrideCommands.set(command.id, command);
      
      // Update strategy parameter
      const tradingParam = this.strategyParameters.get('tradingEnabled');
      if (tradingParam) {
        tradingParam.currentValue = false;
      }
      
      // Broadcast update
      this.dashboardService.broadcastSystemStatus({
        tradingPaused: true,
        pausedBy: userId,
        duration,
        message: `Trading paused by ${userId}`,
        timestamp: Date.now()
      });
      
      logger.info(`Trading paused by ${userId} for ${duration || 'indefinite'} seconds`);
      
      res.json({
        success: true,
        commandId: command.id,
        duration,
        message: 'Trading paused successfully'
      });
      
    } catch (error) {
      logger.error('Error pausing trading:', toLogError(error));
      res.status(500).json({ error: 'Failed to pause trading' });
    }
  }

  /**
   * Handle parameter adjustment
   */
  private async handleAdjustParameter(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { parameterKey, newValue, reason, userId } = req.body;
      
      if (!this.isAuthorizedUser(userId)) {
        res.status(401).json({ error: 'Unauthorized user' });
        return;
      }
      
      const parameter = this.strategyParameters.get(parameterKey);
      if (!parameter) {
        res.status(404).json({ error: 'Parameter not found' });
        return;
      }
      
      // Validate new value
      const validation = this.validateParameterValue(parameter, newValue);
      if (!validation.valid) {
        res.status(400).json({ error: validation.error });
        return;
      }
      
      const command: ManualOverrideCommand = {
        id: `cmd_${Date.now()}`,
        type: 'ADJUST_RISK',
        parameters: { parameterKey, oldValue: parameter.currentValue, newValue, reason },
        requestedBy: userId,
        requestedAt: Date.now(),
        status: 'EXECUTED',
        reason: `Parameter adjustment: ${parameterKey} = ${newValue}`,
        requiresApproval: false,
        priority: 'LOW'
      };
      
      // Update parameter
      parameter.newValue = newValue;
      parameter.currentValue = newValue;
      
      command.executedAt = Date.now();
      this.overrideCommands.set(command.id, command);
      
      // Apply parameter change to relevant services
      await this.applyParameterChange(parameterKey, newValue);
      
      // Broadcast update
      this.dashboardService.broadcastSystemStatus({
        parameterChanged: {
          key: parameterKey,
          oldValue: command.parameters.oldValue,
          newValue,
          changedBy: userId
        },
        timestamp: Date.now()
      });
      
      logger.info(`Parameter ${parameterKey} adjusted by ${userId}: ${command.parameters.oldValue} -> ${newValue}`);
      
      res.json({
        success: true,
        commandId: command.id,
        parameter: parameter,
        message: 'Parameter updated successfully'
      });
      
    } catch (error) {
      logger.error('Error adjusting parameter:', toLogError(error));
      res.status(500).json({ error: 'Failed to adjust parameter' });
    }
  }

  /**
   * Handle threshold update
   */
  private async handleUpdateThreshold(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { metric, newThreshold, newWarningLevel, enabled, userId } = req.body;
      
      if (!this.isAuthorizedUser(userId)) {
        res.status(401).json({ error: 'Unauthorized user' });
        return;
      }
      
      const threshold = this.riskThresholds.get(metric);
      if (!threshold) {
        res.status(404).json({ error: 'Risk threshold not found' });
        return;
      }
      
      const oldThreshold = threshold.threshold;
      const oldWarningLevel = threshold.warningLevel;
      const oldEnabled = threshold.enabled;
      
      // Update threshold
      if (newThreshold !== undefined) threshold.threshold = newThreshold;
      if (newWarningLevel !== undefined) threshold.warningLevel = newWarningLevel;
      if (enabled !== undefined) threshold.enabled = enabled;
      
      logger.info(`Risk threshold ${metric} updated by ${userId}`, {
        oldThreshold,
        newThreshold,
        oldWarningLevel,
        newWarningLevel,
        oldEnabled,
        enabled
      });
      
      res.json({
        success: true,
        threshold,
        message: 'Risk threshold updated successfully'
      });
      
    } catch (error) {
      logger.error('Error updating threshold:', toLogError(error));
      res.status(500).json({ error: 'Failed to update risk threshold' });
    }
  }

  /**
   * Get override commands
   */
  private getOverrideCommands(req: express.Request, res: express.Response): void {
    const commands = Array.from(this.overrideCommands.values())
      .sort((a, b) => b.requestedAt - a.requestedAt)
      .slice(0, 100); // Last 100 commands
    
    res.json(commands);
  }

  /**
   * Get strategy parameters
   */
  private getStrategyParameters(req: express.Request, res: express.Response): void {
    const parameters = Array.from(this.strategyParameters.values());
    res.json(parameters);
  }

  /**
   * Get risk thresholds
   */
  private getRiskThresholds(req: express.Request, res: express.Response): void {
    const thresholds = Array.from(this.riskThresholds.values());
    res.json(thresholds);
  }

  /**
   * Get system status
   */
  private getSystemStatus(req: express.Request, res: express.Response): void {
    const portfolio = this.riskManager.getPortfolio();
    const emergencyStopState = this.emergencyStopService.getState();
    const executionAnalytics = this.executionOptimizationService.getExecutionAnalytics();
    
    const status = {
      timestamp: Date.now(),
      tradingPaused: this.tradingPaused,
      emergencyStopActive: emergencyStopState.isActive,
      portfolio: {
        totalBalance: portfolio.totalBalance,
        availableBalance: portfolio.availableBalance,
        dailyPnl: portfolio.dailyPnl,
        openPositionsCount: portfolio.openPositions.length
      },
      riskHealth: this.riskManager.getRiskHealth(),
      executionMetrics: executionAnalytics,
      activeCommands: this.overrideCommands.size,
      lastUpdate: Date.now()
    };
    
    res.json(status);
  }

  /**
   * Handle command approval
   */
  private async handleApproveCommand(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { commandId, userId } = req.body;
      
      if (!this.isAuthorizedUser(userId)) {
        res.status(401).json({ error: 'Unauthorized user' });
        return;
      }
      
      const command = this.overrideCommands.get(commandId);
      if (!command) {
        res.status(404).json({ error: 'Command not found' });
        return;
      }
      
      if (command.status !== 'PENDING') {
        res.status(400).json({ error: 'Command is not pending approval' });
        return;
      }
      
      command.approvedBy = userId;
      command.approvedAt = Date.now();
      command.status = 'APPROVED';
      
      // Execute the approved command
      await this.executeCommand(command);
      
      res.json({
        success: true,
        command,
        message: 'Command approved and executed'
      });
      
    } catch (error) {
      logger.error('Error approving command:', toLogError(error));
      res.status(500).json({ error: 'Failed to approve command' });
    }
  }

  /**
   * Handle command rejection
   */
  private async handleRejectCommand(req: express.Request, res: express.Response): Promise<void> {
    try {
      const { commandId, reason, userId } = req.body;
      
      if (!this.isAuthorizedUser(userId)) {
        res.status(401).json({ error: 'Unauthorized user' });
        return;
      }
      
      const command = this.overrideCommands.get(commandId);
      if (!command) {
        res.status(404).json({ error: 'Command not found' });
        return;
      }
      
      if (command.status !== 'PENDING') {
        res.status(400).json({ error: 'Command is not pending approval' });
        return;
      }
      
      command.status = 'REJECTED';
      command.reason = `${command.reason} (Rejected: ${reason})`;
      
      logger.info(`Command ${commandId} rejected by ${userId}: ${reason}`);
      
      res.json({
        success: true,
        command,
        message: 'Command rejected'
      });
      
    } catch (error) {
      logger.error('Error rejecting command:', toLogError(error));
      res.status(500).json({ error: 'Failed to reject command' });
    }
  }

  /**
   * Execute approved command
   */
  private async executeCommand(command: ManualOverrideCommand): Promise<void> {
    try {
      switch (command.type) {
        case 'RESUME_TRADING':
          await this.executeResumeTrading(command);
          break;
        default:
          logger.warn(`Unknown command type for execution: ${command.type}`);
      }
    } catch (error) {
      command.status = 'FAILED';
      logger.error(`Failed to execute command ${command.id}:`, toLogError(error));
      throw error;
    }
  }

  /**
   * Execute resume trading command
   */
  private async executeResumeTrading(command: ManualOverrideCommand): Promise<void> {
    // Reset emergency stop if active
    if (this.emergencyStopService.isEmergencyStopActive()) {
      await this.emergencyStopService.resetEmergencyStop(
        command.approvedBy || command.requestedBy,
        'Manual override - resume trading'
      );
    }
    
    // Resume trading
    this.tradingPaused = false;
    
    // Update parameter
    const tradingParam = this.strategyParameters.get('tradingEnabled');
    if (tradingParam) {
      tradingParam.currentValue = true;
    }
    
    command.status = 'EXECUTED';
    command.executedAt = Date.now();
    
    // Broadcast update
    this.dashboardService.broadcastSystemStatus({
      tradingPaused: false,
      emergencyStopActive: false,
      resumedBy: command.approvedBy || command.requestedBy,
      message: 'Trading resumed',
      timestamp: Date.now()
    });
    
    logger.info('Trading resumed via manual override');
  }

  /**
   * Validate parameter value
   */
  private validateParameterValue(parameter: StrategyParameter, value: any): {
    valid: boolean;
    error?: string;
  } {
    if (parameter.type === 'number') {
      const numValue = Number(value);
      if (isNaN(numValue)) {
        return { valid: false, error: 'Value must be a number' };
      }
      if (parameter.min !== undefined && numValue < parameter.min) {
        return { valid: false, error: `Value must be >= ${parameter.min}` };
      }
      if (parameter.max !== undefined && numValue > parameter.max) {
        return { valid: false, error: `Value must be <= ${parameter.max}` };
      }
    } else if (parameter.type === 'boolean') {
      if (typeof value !== 'boolean') {
        return { valid: false, error: 'Value must be a boolean' };
      }
    }
    
    return { valid: true };
  }

  /**
   * Apply parameter change to relevant services
   */
  private async applyParameterChange(parameterKey: string, newValue: any): Promise<void> {
    // Apply parameter changes to the actual configuration and services
    // This would integrate with your config system and update running services
    
    switch (parameterKey) {
      case 'tradingEnabled':
        this.tradingPaused = !newValue;
        break;
      case 'maxSlippagePercent':
        this.executionOptimizationService.updateConfig({ maxSlippagePercent: newValue });
        break;
      // Add other parameter applications as needed
    }
    
    logger.info(`Applied parameter change: ${parameterKey} = ${newValue}`);
  }

  /**
   * Check if user is authorized
   */
  private isAuthorizedUser(userId: string): boolean {
    return this.authorizedUsers.has(userId);
  }

  /**
   * Add authorized user
   */
  addAuthorizedUser(userId: string): void {
    this.authorizedUsers.add(userId);
    logger.info(`User ${userId} added to authorized users`);
  }

  /**
   * Remove authorized user
   */
  removeAuthorizedUser(userId: string): boolean {
    const removed = this.authorizedUsers.delete(userId);
    if (removed) {
      logger.info(`User ${userId} removed from authorized users`);
    }
    return removed;
  }

  /**
   * Check if trading is paused
   */
  isTradingPaused(): boolean {
    return this.tradingPaused || this.emergencyStopService.isEmergencyStopActive();
  }

  /**
   * Get current strategy parameter value
   */
  getParameterValue(key: string): any {
    const parameter = this.strategyParameters.get(key);
    return parameter?.currentValue;
  }

  /**
   * Update risk threshold values with current metrics
   */
  updateRiskThresholds(portfolio: Portfolio, systemMetrics: SystemHealthMetrics): void {
    const dailyLossThreshold = this.riskThresholds.get('DAILY_LOSS');
    if (dailyLossThreshold) {
      dailyLossThreshold.currentValue = portfolio.dailyPnlPercent / 100;
    }
    
    const drawdownThreshold = this.riskThresholds.get('DRAWDOWN');
    if (drawdownThreshold) {
      drawdownThreshold.currentValue = portfolio.maxDrawdown;
    }
    
    const exposureThreshold = this.riskThresholds.get('EXPOSURE');
    if (exposureThreshold) {
      exposureThreshold.currentValue = portfolio.riskExposure / portfolio.totalBalance;
    }
  }

  /**
   * Get pending commands count
   */
  getPendingCommandsCount(): number {
    return Array.from(this.overrideCommands.values())
      .filter(cmd => cmd.status === 'PENDING').length;
  }

  /**
   * Get recent override activity
   */
  getRecentActivity(limit: number = 20): ManualOverrideCommand[] {
    return Array.from(this.overrideCommands.values())
      .sort((a, b) => b.requestedAt - a.requestedAt)
      .slice(0, limit);
  }

  /**
   * Shutdown the manual override service
   */
  shutdown(): void {
    logger.info('Shutting down manual override service...');
    
    // Clean up any ongoing operations
    this.tradingPaused = false;
    this.overrideCommands.clear();
  }
}

export default ManualOverrideService;