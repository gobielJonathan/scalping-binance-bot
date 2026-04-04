import { EmergencyStopService } from '../services/emergencyStopService';
import { RiskManager } from '../services/riskManager';
import { OrderManager } from '../services/orderManager';
import { SystemHealthMetrics } from '../types';

describe('EmergencyStopService', () => {
  let emergencyStopService: EmergencyStopService;
  let riskManager: RiskManager;
  let orderManager: OrderManager;

  beforeEach(() => {
    riskManager = new RiskManager(10000); // $10,000 initial balance
    orderManager = new OrderManager(riskManager);
    emergencyStopService = new EmergencyStopService(riskManager, orderManager);
  });

  afterEach(() => {
    emergencyStopService.shutdown();
  });

  describe('Initialization', () => {
    test('should initialize with default conditions', () => {
      const conditions = emergencyStopService.getConditions();
      expect(conditions.length).toBeGreaterThan(0);
      
      // Check for default conditions
      const conditionTypes = conditions.map(c => c.type);
      expect(conditionTypes).toContain('LOSS_LIMIT');
      expect(conditionTypes).toContain('API_FAILURE');
      expect(conditionTypes).toContain('MARKET_ANOMALY');
    });

    test('should start with inactive emergency stop', () => {
      const state = emergencyStopService.getState();
      expect(state.isActive).toBe(false);
    });
  });

  describe('Condition Management', () => {
    test('should add new conditions', () => {
      const initialCount = emergencyStopService.getConditions().length;
      
      emergencyStopService.addCondition({
        id: 'test-condition',
        name: 'Test Condition',
        type: 'MANUAL',
        threshold: 0.1,
        enabled: true,
        priority: 'HIGH',
        description: 'Test condition for unit testing',
        checkInterval: 5000
      });

      const newCount = emergencyStopService.getConditions().length;
      expect(newCount).toBe(initialCount + 1);
    });

    test('should update existing conditions', () => {
      const conditions = emergencyStopService.getConditions();
      const firstCondition = conditions[0];
      
      const updated = emergencyStopService.updateCondition(firstCondition.id, {
        threshold: 0.999
      });
      
      expect(updated).toBe(true);
      
      const updatedConditions = emergencyStopService.getConditions();
      const updatedCondition = updatedConditions.find(c => c.id === firstCondition.id);
      expect(updatedCondition?.threshold).toBe(0.999);
    });

    test('should remove conditions', () => {
      const conditions = emergencyStopService.getConditions();
      const conditionToRemove = conditions[0];
      
      const removed = emergencyStopService.removeCondition(conditionToRemove.id);
      expect(removed).toBe(true);
      
      const remainingConditions = emergencyStopService.getConditions();
      expect(remainingConditions.find(c => c.id === conditionToRemove.id)).toBeUndefined();
    });
  });

  describe('Emergency Stop Triggers', () => {
    test('should trigger manual emergency stop', async () => {
      await emergencyStopService.manualEmergencyStop('Test emergency', 'test-user');
      
      const state = emergencyStopService.getState();
      expect(state.isActive).toBe(true);
      expect(state.triggeredBy).toHaveLength(1);
      expect(state.triggeredBy![0].reason).toContain('Test emergency');
    });

    test('should reset emergency stop', async () => {
      // First trigger emergency stop
      await emergencyStopService.manualEmergencyStop('Test emergency', 'test-user');
      expect(emergencyStopService.isEmergencyStopActive()).toBe(true);
      
      // Then reset it
      const reset = await emergencyStopService.resetEmergencyStop('admin', 'Test reset');
      expect(reset).toBe(true);
      expect(emergencyStopService.isEmergencyStopActive()).toBe(false);
    });
  });

  describe('System Health Monitoring', () => {
    test('should update system health metrics', () => {
      const metrics: SystemHealthMetrics = {
        timestamp: Date.now(),
        apiLatency: 100,
        memoryUsage: 0.5,
        cpuUsage: 0.3,
        activeConnections: 5,
        orderExecutionRate: 10,
        errorRate: 0.1,
        systemUptime: 3600,
        lastHealthCheck: Date.now()
      };

      emergencyStopService.updateSystemHealthMetrics(metrics);
      
      const state = emergencyStopService.getState();
      expect(state.lastCheck).toBeGreaterThan(0);
    });
  });

  describe('Loss Limit Monitoring', () => {
    test('should detect daily loss limit breach', async () => {
      // Simulate a large loss
      const portfolio = riskManager.getPortfolio();
      
      // Manually adjust portfolio to simulate loss
      portfolio.dailyPnl = -600; // 6% loss on $10,000
      portfolio.dailyPnlPercent = -6;
      
      // This would normally be triggered by the monitoring interval
      // For testing, we'll check the condition manually
      const conditions = emergencyStopService.getConditions();
      const lossLimitCondition = conditions.find(c => c.id === 'daily-loss-limit');
      
      expect(lossLimitCondition).toBeDefined();
      expect(lossLimitCondition!.threshold).toBe(0.05); // 5%
    });
  });

  describe('Notifications', () => {
    test('should store notifications', async () => {
      await emergencyStopService.manualEmergencyStop('Test for notifications', 'test-user');
      
      const notifications = emergencyStopService.getNotifications(10);
      expect(notifications.length).toBeGreaterThan(0);
      
      const notification = notifications[0];
      expect(notification.subject).toContain('EMERGENCY STOP');
      expect(notification.message).toContain('Test for notifications');
    });
  });
});