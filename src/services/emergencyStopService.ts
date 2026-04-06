import { 
  EmergencyStopCondition, 
  EmergencyStopTrigger, 
  EmergencyStopState, 
  EmergencyNotification,
  SystemHealthMetrics
} from '../types';
import { RiskManager } from './riskManager';
import { OrderManager } from './orderManager';
import logger, { toLogError } from './logger';

/**
 * Emergency Stop Service - Provides advanced circuit breaker and emergency shutdown capabilities
 */
export class EmergencyStopService {
  private riskManager: RiskManager;
  private orderManager: OrderManager;
  private state: EmergencyStopState;
  private conditions: Map<string, EmergencyStopCondition>;
  private checkIntervals: Map<string, NodeJS.Timeout>;
  private notifications: EmergencyNotification[] = [];
  private systemHealthMetrics: SystemHealthMetrics | null = null;
  
  constructor(riskManager: RiskManager, orderManager: OrderManager) {
    this.riskManager = riskManager;
    this.orderManager = orderManager;
    
    this.state = {
      isActive: false,
      lastCheck: Date.now(),
      positionsClosedCount: 0,
      totalLossAtStop: 0,
      recoveryProcedureStatus: 'NONE'
    };
    
    this.conditions = new Map();
    this.checkIntervals = new Map();
    
    this.initializeDefaultConditions();
  }

  /**
   * Initialize default emergency stop conditions
   */
  private initializeDefaultConditions(): void {
    const defaultConditions: EmergencyStopCondition[] = [
      {
        id: 'daily-loss-limit',
        name: 'Daily Loss Limit',
        type: 'LOSS_LIMIT',
        threshold: 0.05, // 5% daily loss
        enabled: true,
        priority: 'CRITICAL',
        description: 'Triggers when daily losses exceed 5% of starting balance',
        checkInterval: 10000 // Check every 10 seconds
      },
      {
        id: 'max-drawdown',
        name: 'Maximum Drawdown',
        type: 'LOSS_LIMIT',
        threshold: 0.15, // 15% maximum drawdown
        enabled: true,
        priority: 'CRITICAL',
        description: 'Triggers when drawdown exceeds 15% from peak',
        checkInterval: 30000
      },
      {
        id: 'api-connection-failure',
        name: 'API Connection Failure',
        type: 'API_FAILURE',
        threshold: 3, // 3 consecutive failures
        enabled: true,
        priority: 'HIGH',
        description: 'Triggers when API connection fails 3 times consecutively',
        checkInterval: 5000
      },
      {
        id: 'abnormal-volatility',
        name: 'Abnormal Market Volatility',
        type: 'MARKET_ANOMALY',
        threshold: 0.1, // 10% price movement in 1 minute
        enabled: true,
        priority: 'HIGH',
        description: 'Triggers on extreme market volatility',
        checkInterval: 15000
      },
      {
        id: 'system-overload',
        name: 'System Resource Overload',
        type: 'SYSTEM_ERROR',
        threshold: 0.95, // 95% resource usage
        enabled: true,
        priority: 'MEDIUM',
        description: 'Triggers when system resources are critically low',
        checkInterval: 20000
      }
    ];

    defaultConditions.forEach(condition => {
      this.addCondition(condition);
    });
  }

  /**
   * Add a new emergency stop condition
   */
  addCondition(condition: EmergencyStopCondition): void {
    this.conditions.set(condition.id, condition);
    
    if (condition.enabled) {
      this.startMonitoring(condition.id);
    }
    
    logger.info(`Emergency stop condition added: ${condition.name}`, { conditionId: condition.id });
  }

  /**
   * Remove an emergency stop condition
   */
  removeCondition(conditionId: string): boolean {
    this.stopMonitoring(conditionId);
    const removed = this.conditions.delete(conditionId);
    
    if (removed) {
      logger.info(`Emergency stop condition removed: ${conditionId}`);
    }
    
    return removed;
  }

  /**
   * Update an existing condition
   */
  updateCondition(conditionId: string, updates: Partial<EmergencyStopCondition>): boolean {
    const condition = this.conditions.get(conditionId);
    if (!condition) return false;
    
    const updatedCondition = { ...condition, ...updates };
    this.conditions.set(conditionId, updatedCondition);
    
    // Restart monitoring if enabled status changed
    if (updates.enabled !== undefined) {
      if (updates.enabled) {
        this.startMonitoring(conditionId);
      } else {
        this.stopMonitoring(conditionId);
      }
    }
    
    logger.info(`Emergency stop condition updated: ${conditionId}`, { updates });
    return true;
  }

  /**
   * Start monitoring a specific condition
   */
  private startMonitoring(conditionId: string): void {
    const condition = this.conditions.get(conditionId);
    if (!condition || !condition.enabled) return;
    
    // Clear existing interval if any
    this.stopMonitoring(conditionId);
    
    const interval = setInterval(() => {
      this.checkCondition(conditionId);
    }, condition.checkInterval);
    
    this.checkIntervals.set(conditionId, interval);
    logger.debug(`Started monitoring condition: ${condition.name}`);
  }

  /**
   * Stop monitoring a specific condition
   */
  private stopMonitoring(conditionId: string): void {
    const interval = this.checkIntervals.get(conditionId);
    if (interval) {
      clearInterval(interval);
      this.checkIntervals.delete(conditionId);
      logger.debug(`Stopped monitoring condition: ${conditionId}`);
    }
  }

  /**
   * Check a specific emergency condition
   */
  private async checkCondition(conditionId: string): Promise<void> {
    const condition = this.conditions.get(conditionId);
    if (!condition || !condition.enabled) return;
    
    try {
      let shouldTrigger = false;
      let currentValue = 0;
      let reason = '';
      
      switch (condition.type) {
        case 'LOSS_LIMIT':
          ({ shouldTrigger, currentValue, reason } = this.checkLossLimits(condition));
          break;
        case 'API_FAILURE':
          ({ shouldTrigger, currentValue, reason } = await this.checkApiHealth(condition));
          break;
        case 'MARKET_ANOMALY':
          ({ shouldTrigger, currentValue, reason } = await this.checkMarketAnomalies(condition));
          break;
        case 'SYSTEM_ERROR':
          ({ shouldTrigger, currentValue, reason } = this.checkSystemHealth(condition));
          break;
        case 'MANUAL':
          // Manual triggers are handled separately
          break;
      }
      
      if (shouldTrigger) {
        const trigger: EmergencyStopTrigger = {
          id: `trigger_${conditionId}_${Date.now()}`,
          conditionId,
          timestamp: Date.now(),
          value: currentValue,
          reason,
          severity: condition.priority,
          acknowledgeBy: condition.priority === 'CRITICAL' ? Date.now() + 300000 : undefined // 5 min for critical
        };
        
        await this.triggerEmergencyStop(trigger);
      }
      
    } catch (error) {
      logger.error(`Error checking emergency condition ${conditionId}:`, toLogError(error));
    }
  }

  /**
   * Check loss limit conditions
   */
  private checkLossLimits(condition: EmergencyStopCondition): { shouldTrigger: boolean; currentValue: number; reason: string } {
    const portfolio = this.riskManager.getPortfolio();
    let shouldTrigger = false;
    let currentValue = 0;
    let reason = '';
    
    switch (condition.id) {
      case 'daily-loss-limit':
        currentValue = Math.abs(portfolio.dailyPnlPercent) / 100;
        shouldTrigger = portfolio.dailyPnl < 0 && currentValue >= (condition.threshold || 0.05);
        reason = `Daily loss of ${(currentValue * 100).toFixed(2)}% exceeds limit of ${((condition.threshold || 0.05) * 100).toFixed(2)}%`;
        break;
        
      case 'max-drawdown':
        currentValue = Math.abs(portfolio.maxDrawdown) / 100;
        shouldTrigger = currentValue >= (condition.threshold || 0.15);
        reason = `Maximum drawdown of ${(currentValue * 100).toFixed(2)}% exceeds limit of ${((condition.threshold || 0.15) * 100).toFixed(2)}%`;
        break;
        
      default:
        // Handle other loss-related conditions
        break;
    }
    
    return { shouldTrigger, currentValue, reason };
  }

  /**
   * Check API health conditions
   */
  private async checkApiHealth(_condition: EmergencyStopCondition): Promise<{ shouldTrigger: boolean; currentValue: number; reason: string }> {
    // This would integrate with your BinanceService to check API health
    // For now, using placeholder logic
    let shouldTrigger = false;
    let currentValue = 0;
    let reason = '';
    
    // Check API response times, error rates, connection status
    if (this.systemHealthMetrics) {
      currentValue = this.systemHealthMetrics.apiLatency;
      
      if (currentValue > 5000) { // 5 second latency threshold
        shouldTrigger = true;
        reason = `API latency of ${currentValue}ms exceeds acceptable threshold`;
      }
      
      if (this.systemHealthMetrics.errorRate > 10) { // 10 errors per minute
        shouldTrigger = true;
        reason = `High API error rate: ${this.systemHealthMetrics.errorRate} errors/minute`;
      }
    }
    
    return { shouldTrigger, currentValue, reason };
  }

  /**
   * Check for market anomalies
   */
  private async checkMarketAnomalies(_condition: EmergencyStopCondition): Promise<{ shouldTrigger: boolean; currentValue: number; reason: string }> {
    // This would analyze recent price movements, volume spikes, etc.
    let shouldTrigger = false;
    let currentValue = 0;
    let reason = '';
    
    // Placeholder for market anomaly detection
    // In a real implementation, this would:
    // 1. Analyze recent price movements
    // 2. Check for unusual volume patterns
    // 3. Detect potential market manipulation
    // 4. Monitor order book irregularities
    
    return { shouldTrigger, currentValue, reason };
  }

  /**
   * Check system health conditions
   */
  private checkSystemHealth(condition: EmergencyStopCondition): { shouldTrigger: boolean; currentValue: number; reason: string } {
    let shouldTrigger = false;
    let currentValue = 0;
    let reason = '';
    
    if (this.systemHealthMetrics) {
      const { cpuUsage, memoryUsage } = this.systemHealthMetrics;
      
      if (cpuUsage > (condition.threshold || 0.95)) {
        shouldTrigger = true;
        currentValue = cpuUsage;
        reason = `High CPU usage: ${(cpuUsage * 100).toFixed(1)}%`;
      }
      
      if (memoryUsage > (condition.threshold || 0.95)) {
        shouldTrigger = true;
        currentValue = memoryUsage;
        reason = `High memory usage: ${(memoryUsage * 100).toFixed(1)}%`;
      }
    }
    
    return { shouldTrigger, currentValue, reason };
  }

  /**
   * Trigger emergency stop
   */
  async triggerEmergencyStop(trigger: EmergencyStopTrigger): Promise<void> {
    if (this.state.isActive) {
      logger.warn(`Emergency stop already active, adding trigger: ${trigger.reason}`);
      
      if (!this.state.triggeredBy) {
        this.state.triggeredBy = [];
      }
      this.state.triggeredBy.push(trigger);
      return;
    }
    
    logger.error(`EMERGENCY STOP TRIGGERED: ${trigger.reason}`, trigger);
    
    this.state = {
      isActive: true,
      activatedAt: Date.now(),
      triggeredBy: [trigger],
      lastCheck: Date.now(),
      positionsClosedCount: 0,
      totalLossAtStop: this.riskManager.getPortfolio().totalPnl,
      recoveryProcedureStatus: 'INITIATED'
    };
    
    // Stop all condition monitoring
    this.stopAllMonitoring();
    
    // Execute emergency procedures
    await this.executeEmergencyProcedures(trigger);
    
    // Send notifications
    await this.sendEmergencyNotifications(trigger);
  }

  /**
   * Execute emergency procedures
   */
  private async executeEmergencyProcedures(trigger: EmergencyStopTrigger): Promise<void> {
    try {
      logger.info('Executing emergency procedures...');
      this.state.recoveryProcedureStatus = 'IN_PROGRESS';
      
      // 1. Stop all new trading
      logger.info('Stopping new trade execution...');
      
      // 2. Close all open positions gracefully
      const portfolio = this.riskManager.getPortfolio();
      const openPositions = [...portfolio.openPositions];
      
      logger.info(`Closing ${openPositions.length} open positions...`);
      
      for (const position of openPositions) {
        try {
          const closedPosition = await this.orderManager.closePosition(
            position.id, 
            `Emergency stop: ${trigger.reason}`
          );
          
          if (closedPosition) {
            this.state.positionsClosedCount++;
            logger.info(`Position ${position.id} closed during emergency stop`, {
              positionId: position.id,
              symbol: position.symbol,
              pnl: closedPosition.pnl
            });
          }
        } catch (error) {
          logger.error(`Failed to close position ${position.id} during emergency stop:`, toLogError(error));
        }
      }
      
      // 3. Save emergency stop log
      await this.logEmergencyStop(trigger);
      
      this.state.recoveryProcedureStatus = 'COMPLETED';
      logger.info('Emergency procedures completed successfully');
      
    } catch (error) {
      this.state.recoveryProcedureStatus = 'FAILED';
      logger.error('Emergency procedures failed:', toLogError(error));
      throw error;
    }
  }

  /**
   * Send emergency notifications
   */
  private async sendEmergencyNotifications(trigger: EmergencyStopTrigger): Promise<void> {
    const notifications: EmergencyNotification[] = [];
    
    // Create notification based on severity
    const baseNotification = {
      id: `notify_${trigger.id}`,
      subject: `TRADING BOT EMERGENCY STOP - ${trigger.severity}`,
      message: `
Emergency Stop Activated

Reason: ${trigger.reason}
Severity: ${trigger.severity}
Timestamp: ${new Date(trigger.timestamp).toISOString()}
Value: ${trigger.value}

Positions Closed: ${this.state.positionsClosedCount}
Total Loss at Stop: $${this.state.totalLossAtStop.toFixed(2)}

Manual intervention may be required before resuming trading.
      `.trim(),
      priority: trigger.severity,
      timestamp: Date.now(),
      deliveryStatus: 'PENDING' as const,
      retryCount: 0
    };

    // Add different notification channels based on severity
    if (trigger.severity === 'CRITICAL') {
      notifications.push({
        ...baseNotification,
        type: 'EMAIL',
        recipient: 'admin@example.com' // config.notifications?.email fallback
      });
      
      notifications.push({
        ...baseNotification,
        type: 'SMS',
        recipient: '+1234567890' // config.notifications?.sms fallback
      });
    }
    
    // Always send console/log notification
    notifications.push({
      ...baseNotification,
      type: 'WEBHOOK',
      recipient: 'console'
    });
    
    // Store and attempt to send notifications
    for (const notification of notifications) {
      this.notifications.push(notification);
      await this.sendNotification(notification);
    }
  }

  /**
   * Send individual notification
   */
  private async sendNotification(notification: EmergencyNotification): Promise<void> {
    try {
      // In a real implementation, this would integrate with email, SMS, etc.
      // For now, just log the notification
      logger.error(`EMERGENCY NOTIFICATION [${notification.type}]:`, {
        recipient: notification.recipient,
        subject: notification.subject,
        message: notification.message
      });
      
      notification.deliveryStatus = 'SENT';
      
    } catch (error) {
      notification.deliveryStatus = 'FAILED';
      notification.retryCount++;
      logger.error(`Failed to send emergency notification:`, toLogError(error));
    }
  }

  /**
   * Log emergency stop event
   */
  private async logEmergencyStop(trigger: EmergencyStopTrigger): Promise<void> {
    const logEntry = {
      timestamp: Date.now(),
      event: 'EMERGENCY_STOP',
      trigger: trigger,
      state: this.state,
      portfolio: this.riskManager.getPortfolio(),
      systemMetrics: this.systemHealthMetrics
    };
    
    logger.error('Emergency stop logged', logEntry);
    
    // In a real implementation, this would also save to a database
    // for audit trail and analysis
  }

  /**
   * Manual emergency stop trigger
   */
  async manualEmergencyStop(reason: string, requestedBy: string): Promise<void> {
    const trigger: EmergencyStopTrigger = {
      id: `manual_${Date.now()}`,
      conditionId: 'manual',
      timestamp: Date.now(),
      value: 0,
      reason: `Manual stop: ${reason}`,
      severity: 'HIGH',
      metadata: { requestedBy }
    };
    
    await this.triggerEmergencyStop(trigger);
  }

  /**
   * Reset emergency stop (requires manual intervention)
   */
  async resetEmergencyStop(authorizedBy: string, reason: string): Promise<boolean> {
    if (!this.state.isActive) {
      logger.warn('No emergency stop is currently active');
      return false;
    }
    
    logger.info(`Emergency stop reset by ${authorizedBy}: ${reason}`);
    
    // Reset state
    this.state = {
      isActive: false,
      lastCheck: Date.now(),
      positionsClosedCount: 0,
      totalLossAtStop: 0,
      recoveryProcedureStatus: 'NONE',
      manualOverrideBy: authorizedBy
    };
    
    // Restart condition monitoring
    this.restartMonitoring();
    
    return true;
  }

  /**
   * Stop all condition monitoring
   */
  private stopAllMonitoring(): void {
    for (const [conditionId] of this.checkIntervals) {
      this.stopMonitoring(conditionId);
    }
  }

  /**
   * Restart monitoring for all enabled conditions
   */
  private restartMonitoring(): void {
    for (const [conditionId, condition] of this.conditions) {
      if (condition.enabled) {
        this.startMonitoring(conditionId);
      }
    }
  }

  /**
   * Update system health metrics (called by monitoring service)
   */
  updateSystemHealthMetrics(metrics: SystemHealthMetrics): void {
    this.systemHealthMetrics = metrics;
    this.state.lastCheck = Date.now();
  }

  /**
   * Get current emergency stop state
   */
  getState(): EmergencyStopState {
    return { ...this.state };
  }

  /**
   * Get all conditions
   */
  getConditions(): EmergencyStopCondition[] {
    return Array.from(this.conditions.values());
  }

  /**
   * Get recent notifications
   */
  getNotifications(limit: number = 50): EmergencyNotification[] {
    return this.notifications.slice(-limit);
  }

  /**
   * Check if emergency stop is active
   */
  isEmergencyStopActive(): boolean {
    return this.state.isActive;
  }

  /**
   * Shutdown the emergency stop service
   */
  shutdown(): void {
    logger.info('Shutting down emergency stop service...');
    this.stopAllMonitoring();
  }
}
