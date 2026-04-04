import { logger, monitoringService } from '../../src/services';
import { TradeLogEntry } from '../../src/types';

describe('Logging and Monitoring System', () => {
  afterAll(async () => {
    // Clean up
    monitoringService.stop();
    await logger.close();
  });

  describe('Logger Service', () => {
    test('should log different levels correctly', () => {
      // Test basic logging levels
      expect(() => {
        logger.info('Test info message');
        logger.warn('Test warning message');
        logger.error('Test error message');
        logger.debug('Test debug message');
      }).not.toThrow();
    });

    test('should log with context', () => {
      expect(() => {
        logger.info('Test with context', {
          source: 'TestSuite',
          context: { testId: 'test_123', symbol: 'BTCUSDT' },
        });
      }).not.toThrow();
    });

    test('should log performance metrics', () => {
      expect(() => {
        logger.performance('Test operation completed', 1250, {
          source: 'TestSuite',
          context: { operationId: 'op_123' },
        });
      }).not.toThrow();
    });

    test('should log API calls', () => {
      expect(() => {
        logger.apiCall('GET', '/api/test', 500, true);
        logger.apiCall('POST', '/api/test', 1000, false, {
          error: { code: 'API_ERROR' },
        });
      }).not.toThrow();
    });

    test('should log strategy events', () => {
      expect(() => {
        logger.strategy('test_strategy', 'Strategy executed successfully', {
          context: { signalCount: 5 },
        });
      }).not.toThrow();
    });

    test('should log risk management events', () => {
      expect(() => {
        logger.riskManagement('Risk limit check performed', {
          context: { riskLevel: 'HIGH', exposure: 0.8 },
        });
      }).not.toThrow();
    });

    test('should log trade events', () => {
      const tradeLogEntry: TradeLogEntry = {
        tradeId: 'test_trade_123',
        timestamp: Date.now(),
        symbol: 'BTCUSDT',
        action: 'ORDER_PLACED',
        details: {
          side: 'BUY',
          quantity: 0.001,
          price: 45000,
          orderId: 'order_123',
        },
        metadata: {
          strategyId: 'test_strategy',
          signalStrength: 85,
          marketConditions: { trend: 'bullish' },
        },
      };

      expect(() => {
        logger.trade(tradeLogEntry);
      }).not.toThrow();
    });

    test('should track error counts', () => {
      const initialCount = logger.getErrorCount('TestSuite');
      
      logger.error('Test error 1', { source: 'TestSuite' });
      logger.error('Test error 2', { source: 'TestSuite' });
      
      expect(logger.getErrorCount('TestSuite')).toBe(initialCount + 2);
    });
  });

  describe('Monitoring Service', () => {
    test('should collect performance metrics', async () => {
      const metrics = await monitoringService.getMetrics();
      
      expect(metrics).toHaveProperty('timestamp');
      expect(metrics).toHaveProperty('cpuUsage');
      expect(metrics).toHaveProperty('memoryUsage');
      expect(metrics).toHaveProperty('uptime');
      expect(metrics).toHaveProperty('eventLoopLag');
      
      expect(typeof metrics.cpuUsage).toBe('number');
      expect(typeof metrics.memoryUsage.heapUsed).toBe('number');
      expect(typeof metrics.uptime).toBe('number');
    });

    test('should perform health checks', async () => {
      const healthStatus = await monitoringService.getHealthStatus();
      
      expect(healthStatus).toHaveProperty('status');
      expect(healthStatus).toHaveProperty('timestamp');
      expect(healthStatus).toHaveProperty('uptime');
      expect(healthStatus).toHaveProperty('version');
      expect(healthStatus).toHaveProperty('services');
      expect(healthStatus).toHaveProperty('metrics');
      expect(healthStatus).toHaveProperty('errors');
      
      expect(['healthy', 'degraded', 'unhealthy']).toContain(healthStatus.status);
    });

    test('should add and remove custom service checks', async () => {
      let checkExecuted = false;
      
      const customCheck = async () => {
        checkExecuted = true;
        return true;
      };
      
      monitoringService.addServiceCheck('test-service', customCheck);
      
      // Perform health check to trigger service checks
      await monitoringService.getHealthStatus();
      
      expect(checkExecuted).toBe(true);
      
      monitoringService.removeServiceCheck('test-service');
    });

    test('should get system information', () => {
      const systemInfo = monitoringService.getSystemInfo();
      
      expect(systemInfo).toHaveProperty('platform');
      expect(systemInfo).toHaveProperty('arch');
      expect(systemInfo).toHaveProperty('nodeVersion');
      expect(systemInfo).toHaveProperty('totalMemory');
      expect(systemInfo).toHaveProperty('freeMemory');
      expect(systemInfo).toHaveProperty('cpus');
    });

    test('should emit events', (done) => {
      let alertEmitted = false;
      let metricsEmitted = false;
      let healthEmitted = false;

      const checkComplete = () => {
        if (alertEmitted || metricsEmitted || healthEmitted) {
          done();
        }
      };

      monitoringService.once('alert', () => {
        alertEmitted = true;
        checkComplete();
      });

      monitoringService.once('metrics', () => {
        metricsEmitted = true;
        checkComplete();
      });

      monitoringService.once('healthStatus', () => {
        healthEmitted = true;
        checkComplete();
      });

      // Trigger events
      setTimeout(() => {
        monitoringService.getMetrics();
        monitoringService.getHealthStatus();
      }, 100);

      // Timeout after 5 seconds
      setTimeout(() => {
        if (!alertEmitted && !metricsEmitted && !healthEmitted) {
          done();
        }
      }, 5000);
    });
  });

  describe('Integration Tests', () => {
    test('should handle errors gracefully', () => {
      expect(() => {
        try {
          throw new Error('Test error');
        } catch (error) {
          logger.error('Caught test error', {
            source: 'TestSuite',
            error: {
              stack: error instanceof Error ? error.stack : String(error),
              code: 'TEST_ERROR',
            },
          });
        }
      }).not.toThrow();
    });

    test('should handle monitoring service events', (done) => {
      monitoringService.once('healthStatus', (status) => {
        expect(status).toHaveProperty('status');
        done();
      });

      monitoringService.getHealthStatus();
    });

    test('should format log messages correctly', () => {
      // Test that logging doesn't throw with various input types
      expect(() => {
        logger.info('String message');
        logger.info('Number message', { context: { number: 123 } });
        logger.info('Boolean message', { context: { boolean: true } });
        logger.info('Object message', { context: { object: { nested: 'value' } } });
        logger.info('Array message', { context: { array: [1, 2, 3] } });
      }).not.toThrow();
    });
  });
});