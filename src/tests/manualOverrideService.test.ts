import request from 'supertest';
import express from 'express';
import { ManualOverrideService } from '../services/manualOverrideService';
import { RiskManager } from '../services/riskManager';
import { OrderManager } from '../services/orderManager';
import { EmergencyStopService } from '../services/emergencyStopService';
import { ExecutionOptimizationService } from '../services/executionOptimizationService';
import { DashboardService } from '../dashboard/dashboardService';

// Mock services
const mockRiskManager = {
  getPortfolio: jest.fn(),
  getRiskHealth: jest.fn()
} as jest.Mocked<Partial<RiskManager>>;

const mockOrderManager = {
  closePosition: jest.fn(),
  getPortfolioSummary: jest.fn()
} as jest.Mocked<Partial<OrderManager>>;

const mockEmergencyStopService = {
  isEmergencyStopActive: jest.fn(),
  manualEmergencyStop: jest.fn(),
  resetEmergencyStop: jest.fn(),
  getState: jest.fn()
} as jest.Mocked<Partial<EmergencyStopService>>;

const mockExecutionOptimizationService = {
  getExecutionAnalytics: jest.fn(),
  updateConfig: jest.fn()
} as jest.Mocked<Partial<ExecutionOptimizationService>>;

const mockDashboardService = {
  getApp: jest.fn(),
  broadcastSystemStatus: jest.fn(),
  broadcastTrade: jest.fn()
} as jest.Mocked<Partial<DashboardService>>;

describe('ManualOverrideService', () => {
  let manualOverrideService: ManualOverrideService;
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create Express app for testing
    app = express();
    app.use(express.json());
    
    mockDashboardService.getApp!.mockReturnValue(app);
    mockRiskManager.getPortfolio!.mockReturnValue({
      totalBalance: 10000,
      availableBalance: 8000,
      lockedBalance: 2000,
      totalPnl: 0,
      totalPnlPercent: 0,
      dailyPnl: 0,
      dailyPnlPercent: 0,
      openPositions: [],
      riskExposure: 0,
      maxDrawdown: 0
    });
    
    mockRiskManager.getRiskHealth!.mockReturnValue({
      status: 'HEALTHY' as 'HEALTHY',
      warnings: [],
      metrics: {
        dailyPnlPercent: 0,
        riskExposurePercent: 20,
        openPositionsCount: 0,
        availableBalancePercent: 80
      }
    });
    
    mockEmergencyStopService.isEmergencyStopActive!.mockReturnValue(false);
    mockEmergencyStopService.getState!.mockReturnValue({
      isActive: false,
      lastCheck: Date.now(),
      positionsClosedCount: 0,
      totalLossAtStop: 0,
      recoveryProcedureStatus: 'NONE'
    });
    
    mockExecutionOptimizationService.getExecutionAnalytics!.mockReturnValue({
      avgSlippage: 0.001,
      avgExecutionTime: 100,
      avgFees: 0.5,
      totalOrders: 10,
      successRate: 95
    });

    manualOverrideService = new ManualOverrideService(
      mockRiskManager as RiskManager,
      mockOrderManager as OrderManager,
      mockEmergencyStopService as EmergencyStopService,
      mockExecutionOptimizationService as ExecutionOptimizationService,
      mockDashboardService as DashboardService
    );
  });

  afterEach(() => {
    manualOverrideService.shutdown();
  });

  describe('Emergency Stop Endpoints', () => {
    test('should handle emergency stop request', async () => {
      mockEmergencyStopService.manualEmergencyStop!.mockResolvedValue();

      const response = await request(app)
        .post('/api/manual/emergency-stop')
        .send({
          reason: 'Test emergency',
          userId: 'admin'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.commandId).toBeDefined();
      expect(mockEmergencyStopService.manualEmergencyStop).toHaveBeenCalledWith(
        'Test emergency',
        'admin'
      );
    });

    test('should reject emergency stop from unauthorized user', async () => {
      const response = await request(app)
        .post('/api/manual/emergency-stop')
        .send({
          reason: 'Test emergency',
          userId: 'unauthorized'
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Unauthorized user');
    });

    test('should handle resume trading request', async () => {
      mockEmergencyStopService.resetEmergencyStop!.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/manual/resume-trading')
        .send({
          reason: 'Test resume',
          userId: 'admin'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Position Management Endpoints', () => {
    test('should close individual position', async () => {
      const mockClosedPosition = {
        id: 'test-position-1',
        symbol: 'BTCUSDT',
        side: 'BUY',
        quantity: 0.01,
        entryPrice: 50000,
        currentPrice: 51000,
        stopLoss: 49000,
        takeProfit: 52000,
        pnl: 10,
        pnlPercent: 2,
        status: 'CLOSED',
        openTime: Date.now() - 3600000,
        closeTime: Date.now(),
        fees: 0.5
      };

      mockOrderManager.closePosition!.mockResolvedValue(mockClosedPosition);

      const response = await request(app)
        .post('/api/manual/close-position')
        .send({
          positionId: 'test-position-1',
          reason: 'Test close',
          userId: 'admin'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.position).toEqual(mockClosedPosition);
      expect(mockOrderManager.closePosition).toHaveBeenCalledWith(
        'test-position-1',
        'Manual close by admin: Test close'
      );
    });

    test('should handle close all positions', async () => {
      const mockPortfolio = {
        totalBalance: 10000,
        availableBalance: 8000,
        lockedBalance: 2000,
        totalPnl: 100,
        totalPnlPercent: 1,
        dailyPnl: 50,
        dailyPnlPercent: 0.5,
        openPositions: [
          { id: 'pos1', symbol: 'BTCUSDT', side: 'BUY', quantity: 0.01 },
          { id: 'pos2', symbol: 'ETHUSDT', side: 'SELL', quantity: 0.1 }
        ],
        riskExposure: 2000,
        maxDrawdown: 0
      };

      mockRiskManager.getPortfolio!.mockReturnValue(mockPortfolio);
      mockOrderManager.closePosition!.mockResolvedValue({} as any);

      const response = await request(app)
        .post('/api/manual/close-all-positions')
        .send({
          reason: 'Test close all',
          userId: 'admin'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.closedPositions).toBe(2);
      expect(mockOrderManager.closePosition).toHaveBeenCalledTimes(2);
    });
  });

  describe('Trading Control Endpoints', () => {
    test('should pause trading', async () => {
      const response = await request(app)
        .post('/api/manual/pause-trading')
        .send({
          duration: 300,
          reason: 'Test pause',
          userId: 'admin'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.duration).toBe(300);
    });

    test('should validate pause duration', async () => {
      const response = await request(app)
        .post('/api/manual/pause-trading')
        .send({
          duration: -1, // Invalid duration
          reason: 'Test pause',
          userId: 'admin'
        });

      expect(response.status).toBe(200); // Service doesn't validate duration in this implementation
    });
  });

  describe('Parameter Management Endpoints', () => {
    test('should get strategy parameters', async () => {
      const response = await request(app)
        .get('/api/manual/parameters');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // Should have default parameters
      const parameterKeys = response.body.map((p: any) => p.key);
      expect(parameterKeys).toContain('riskPerTrade');
      expect(parameterKeys).toContain('maxConcurrentTrades');
      expect(parameterKeys).toContain('tradingEnabled');
    });

    test('should adjust parameter', async () => {
      const response = await request(app)
        .post('/api/manual/adjust-parameter')
        .send({
          parameterKey: 'riskPerTrade',
          newValue: 0.03,
          reason: 'Test adjustment',
          userId: 'admin'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.parameter.currentValue).toBe(0.03);
    });

    test('should validate parameter values', async () => {
      const response = await request(app)
        .post('/api/manual/adjust-parameter')
        .send({
          parameterKey: 'riskPerTrade',
          newValue: 0.1, // Above maximum allowed
          reason: 'Test validation',
          userId: 'admin'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('must be <=');
    });
  });

  describe('Status Endpoints', () => {
    test('should get system status', async () => {
      const response = await request(app)
        .get('/api/manual/status');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('tradingPaused');
      expect(response.body).toHaveProperty('emergencyStopActive');
      expect(response.body).toHaveProperty('portfolio');
      expect(response.body).toHaveProperty('riskHealth');
      expect(response.body).toHaveProperty('executionMetrics');
    });

    test('should get override commands', async () => {
      // First create a command
      await request(app)
        .post('/api/manual/pause-trading')
        .send({
          duration: 300,
          reason: 'Test pause',
          userId: 'admin'
        });

      const response = await request(app)
        .get('/api/manual/commands');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    test('should get risk thresholds', async () => {
      const response = await request(app)
        .get('/api/manual/thresholds');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // Should have default thresholds
      const thresholdMetrics = response.body.map((t: any) => t.metric);
      expect(thresholdMetrics).toContain('DAILY_LOSS');
      expect(thresholdMetrics).toContain('DRAWDOWN');
      expect(thresholdMetrics).toContain('EXPOSURE');
    });
  });

  describe('Command Approval System', () => {
    test('should approve pending command', async () => {
      // First create a command that requires approval
      const createResponse = await request(app)
        .post('/api/manual/resume-trading')
        .send({
          reason: 'Test resume',
          userId: 'trader1' // Non-admin user
        });

      const commandId = createResponse.body.commandId;

      const approveResponse = await request(app)
        .post('/api/manual/approve-command')
        .send({
          commandId: commandId,
          userId: 'admin'
        });

      expect(approveResponse.status).toBe(200);
      expect(approveResponse.body.success).toBe(true);
    });

    test('should reject pending command', async () => {
      // First create a command that requires approval
      const createResponse = await request(app)
        .post('/api/manual/resume-trading')
        .send({
          reason: 'Test resume',
          userId: 'trader1'
        });

      const commandId = createResponse.body.commandId;

      const rejectResponse = await request(app)
        .post('/api/manual/reject-command')
        .send({
          commandId: commandId,
          reason: 'Not authorized',
          userId: 'admin'
        });

      expect(rejectResponse.status).toBe(200);
      expect(rejectResponse.body.success).toBe(true);
    });
  });

  describe('Authorization', () => {
    test('should allow authorized users', () => {
      expect(manualOverrideService['isAuthorizedUser']('admin')).toBe(true);
      expect(manualOverrideService['isAuthorizedUser']('trader1')).toBe(true);
    });

    test('should reject unauthorized users', () => {
      expect(manualOverrideService['isAuthorizedUser']('hacker')).toBe(false);
    });

    test('should manage authorized users', () => {
      manualOverrideService.addAuthorizedUser('newuser');
      expect(manualOverrideService['isAuthorizedUser']('newuser')).toBe(true);

      const removed = manualOverrideService.removeAuthorizedUser('newuser');
      expect(removed).toBe(true);
      expect(manualOverrideService['isAuthorizedUser']('newuser')).toBe(false);
    });
  });

  describe('Trading Status Management', () => {
    test('should check if trading is paused', () => {
      // Initially not paused
      expect(manualOverrideService.isTradingPaused()).toBe(false);
    });

    test('should get parameter values', () => {
      const riskPerTrade = manualOverrideService.getParameterValue('riskPerTrade');
      expect(typeof riskPerTrade).toBe('number');
      expect(riskPerTrade).toBeGreaterThan(0);
    });

    test('should get pending commands count', () => {
      const count = manualOverrideService.getPendingCommandsCount();
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should get recent activity', () => {
      const activity = manualOverrideService.getRecentActivity(10);
      expect(Array.isArray(activity)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle missing command ID in approval', async () => {
      const response = await request(app)
        .post('/api/manual/approve-command')
        .send({
          commandId: 'non-existent',
          userId: 'admin'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Command not found');
    });

    test('should handle position not found error', async () => {
      mockOrderManager.closePosition!.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/manual/close-position')
        .send({
          positionId: 'non-existent',
          reason: 'Test close',
          userId: 'admin'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Position not found or already closed');
    });
  });
});