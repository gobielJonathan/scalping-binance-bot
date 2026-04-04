import { logger, monitoringService } from '../services';
import config from '../config';

async function testLoggingSystem() {
  console.log('Testing Logging and Monitoring System...\n');

  // Test basic logging
  console.log('1. Testing basic logging...');
  logger.info('Logging system test started', { source: 'TestRunner' });
  logger.warn('This is a warning message', { source: 'TestRunner' });
  logger.error('This is an error message', { source: 'TestRunner' });
  logger.debug('This is a debug message', { source: 'TestRunner' });

  // Test contextual logging
  console.log('2. Testing contextual logging...');
  logger.info('Testing with context', {
    source: 'TestRunner',
    context: {
      testId: 'test_001',
      symbol: 'BTCUSDT',
      action: 'TEST_TRADE'
    }
  });

  // Test performance logging
  console.log('3. Testing performance logging...');
  logger.performance('Mock trade execution', 1250, {
    source: 'TestRunner',
    context: { tradeId: 'mock_trade_001' }
  });

  // Test API logging
  console.log('4. Testing API logging...');
  logger.apiCall('GET', '/api/v3/ticker/price', 500, true);
  logger.apiCall('POST', '/api/v3/order', 1200, false, {
    error: { code: 'INSUFFICIENT_BALANCE' }
  });

  // Test strategy logging
  console.log('5. Testing strategy logging...');
  logger.strategy('test_strategy', 'Mock strategy executed', {
    context: { signalCount: 3, confidence: 85 }
  });

  // Test risk management logging
  console.log('6. Testing risk management logging...');
  logger.riskManagement('Portfolio risk check passed', {
    context: { riskLevel: 'LOW', exposure: 0.15 }
  });

  // Test trade logging
  console.log('7. Testing trade logging...');
  logger.trade({
    tradeId: 'test_trade_001',
    timestamp: Date.now(),
    symbol: 'BTCUSDT',
    action: 'ORDER_PLACED',
    details: {
      side: 'BUY',
      quantity: 0.001,
      price: 45000,
      orderId: 'test_order_001'
    },
    metadata: {
      strategyId: 'test_strategy',
      signalStrength: 85,
      marketConditions: { trend: 'bullish', volatility: 'medium' }
    }
  });

  // Test monitoring system
  console.log('8. Testing monitoring system...');
  
  try {
    const metrics = await monitoringService.getMetrics();
    console.log(`   - CPU Usage: ${metrics.cpuUsage.toFixed(2)}`);
    console.log(`   - Memory Usage: ${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   - Uptime: ${(metrics.uptime / 1000).toFixed(2)} seconds`);
    console.log(`   - Event Loop Lag: ${metrics.eventLoopLag.toFixed(2)} ms`);
    
    const healthStatus = await monitoringService.getHealthStatus();
    console.log(`   - Health Status: ${healthStatus.status}`);
    console.log(`   - Services: ${Object.entries(healthStatus.services).map(([k, v]) => `${k}:${v}`).join(', ')}`);
    
    const systemInfo = monitoringService.getSystemInfo();
    console.log(`   - Platform: ${systemInfo.platform} ${systemInfo.arch}`);
    console.log(`   - Node Version: ${systemInfo.nodeVersion}`);
    console.log(`   - CPUs: ${systemInfo.cpus}`);
    
  } catch (error) {
    console.error('   - Error testing monitoring:', error);
  }

  // Test error counting
  console.log('9. Testing error tracking...');
  const initialErrors = logger.getErrorCount();
  logger.error('Test error 1', { source: 'TestRunner' });
  logger.error('Test error 2', { source: 'TestRunner' });
  const newErrors = logger.getErrorCount();
  console.log(`   - Error count increased from ${initialErrors} to ${newErrors}`);

  console.log('\n10. Configuration test...');
  console.log(`   - Log Level: ${config.logging.level}`);
  console.log(`   - Log Directory: ${config.logging.directory}`);
  console.log(`   - Monitoring Enabled: ${config.monitoring.enabled}`);
  console.log(`   - Metrics Interval: ${config.monitoring.metricsInterval}ms`);

  console.log('\nLogging and Monitoring System Test Complete!');
  console.log('Check the logs directory for log files.');
  
  // Clean up
  setTimeout(async () => {
    monitoringService.stop();
    await logger.close();
    console.log('Test cleanup completed.');
    process.exit(0);
  }, 2000);
}

// Handle errors gracefully
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

// Run the test
testLoggingSystem().catch(console.error);