# Logging and Monitoring System

This document describes the comprehensive logging and monitoring system implemented for the crypto trading bot.

## Overview

The logging and monitoring system provides:
- **Structured logging** with multiple log levels and formats
- **Performance monitoring** with metrics collection
- **Health checks** for system components
- **Alert system** for critical issues
- **Trade-specific logging** for audit trails
- **Log rotation** and archival

## Components

### Logger Service (`src/services/logger.ts`)

The Logger service provides structured logging capabilities using Winston with the following features:

#### Log Levels
- **error**: System errors, trade failures, critical issues
- **warn**: Warnings, risk management alerts, degraded performance
- **info**: General information, trade executions, strategy actions
- **debug**: Detailed debugging information

#### Log Formats
- **Console**: Colorized output with timestamps and context
- **File**: JSON or structured text format with daily rotation
- **Error logs**: Separate error file with full stack traces
- **Trade logs**: Dedicated trade audit trail

#### Usage Examples

```typescript
import { logger } from '../services';

// Basic logging
logger.info('Trading bot started');
logger.error('Database connection failed');

// Logging with context
logger.info('Executing trade', {
  source: 'TradingEngine',
  context: { symbol: 'BTCUSDT', side: 'BUY' }
});

// Performance logging
logger.performance('Order execution completed', 1250, {
  source: 'TradingEngine',
  context: { orderId: 'order_123' }
});

// API call logging
logger.apiCall('POST', '/api/v3/order', 850, true);

// Strategy logging
logger.strategy('scalping_v1', 'Signal generated', {
  context: { strength: 85, confidence: 92 }
});

// Risk management logging
logger.riskManagement('Daily loss limit approaching', {
  context: { currentLoss: -145, limit: -150 }
});

// Trade logging
logger.trade({
  tradeId: 'trade_123',
  timestamp: Date.now(),
  symbol: 'BTCUSDT',
  action: 'ORDER_PLACED',
  details: {
    side: 'BUY',
    quantity: 0.001,
    price: 45000
  },
  metadata: {
    strategyId: 'scalping_v1',
    signalStrength: 85
  }
});
```

### Monitoring Service (`src/services/monitoringService.ts`)

The Monitoring service tracks system performance and health with these capabilities:

#### Performance Metrics
- **CPU usage**: Process CPU utilization
- **Memory usage**: Heap and RSS memory consumption
- **Event loop lag**: Node.js event loop responsiveness
- **Uptime**: System uptime tracking

#### Health Checks
- **Database connectivity**: Database connection status
- **API connectivity**: Binance API connection status
- **WebSocket status**: Real-time data feed status
- **Dashboard status**: Web dashboard availability

#### Alert System
- **Configurable thresholds**: CPU, memory, error rate limits
- **Alert cooldowns**: Prevent alert spam
- **Multiple channels**: Console, file, Telegram, email
- **Severity levels**: Info, warning, critical

#### Usage Examples

```typescript
import { monitoringService } from '../services';

// Get current health status
const health = await monitoringService.getHealthStatus();
console.log(`System status: ${health.status}`);

// Get performance metrics
const metrics = await monitoringService.getMetrics();
console.log(`Memory usage: ${metrics.memoryUsage.heapUsed / 1024 / 1024}MB`);

// Add custom service check
monitoringService.addServiceCheck('custom-service', async () => {
  // Return true if service is healthy
  return checkCustomServiceHealth();
});

// Listen for alerts
monitoringService.on('alert', (alert) => {
  console.log(`Alert: ${alert.message}`);
  // Handle critical alerts
});

// Listen for health status changes
monitoringService.on('healthStatus', (status) => {
  if (status.status !== 'healthy') {
    // Handle unhealthy system
  }
});
```

## Configuration

### Environment Variables

```bash
# Logging Configuration
LOG_LEVEL=info                    # error, warn, info, debug
LOG_DIRECTORY=./logs             # Log directory
LOG_MAX_SIZE=20m                 # Max log file size
LOG_MAX_FILES=14                 # Number of log files to keep
LOG_JSON=false                   # Use JSON format
LOG_CONSOLE=true                 # Log to console

# Monitoring Configuration
MONITORING_ENABLED=true          # Enable monitoring
METRICS_INTERVAL=30000           # Metrics collection interval (ms)
HEALTH_CHECK_INTERVAL=60000      # Health check interval (ms)
CPU_ALERT_THRESHOLD=80           # CPU usage alert threshold (%)
MEMORY_ALERT_THRESHOLD=85        # Memory usage alert threshold (%)
ERROR_RATE_THRESHOLD=5           # Error rate alert threshold (errors/min)
API_LATENCY_THRESHOLD=5000       # API latency alert threshold (ms)
```

### Config Object

The configuration is defined in `src/config/index.ts`:

```typescript
logging: {
  level: 'info',
  file: './logs/trading_bot.log',
  directory: './logs',
  maxSize: '20m',
  maxFiles: 14,
  json: false,
  console: true,
},
monitoring: {
  enabled: true,
  metricsInterval: 30000,
  healthCheckInterval: 60000,
  alertThresholds: {
    cpuUsage: 80,
    memoryUsage: 85,
    errorRate: 5,
    apiLatency: 5000,
  },
},
```

## Log Files Structure

```
logs/
├── application-2023-12-01.log    # Daily application logs
├── application-2023-12-02.log
├── error-2023-12-01.log          # Daily error logs
├── error-2023-12-02.log
├── trades-2023-12-01.log         # Daily trade logs
├── trades-2023-12-02.log
└── ...
```

## Log Rotation

- **Daily rotation**: New log files created daily
- **Compression**: Old logs are gzipped automatically
- **Retention**: Configurable number of days to keep logs
- **Size limits**: Maximum size per log file

## Integration Example

```typescript
import { logger, monitoringService } from './services';

class TradingBot {
  constructor() {
    // Set up event listeners
    monitoringService.on('alert', this.handleAlert);
    monitoringService.on('healthStatus', this.handleHealthStatus);
    
    logger.info('Trading bot initialized', { 
      source: 'TradingBot',
      context: { version: '1.0.0' }
    });
  }

  async start() {
    try {
      logger.info('Starting trading bot');
      
      // Your trading bot logic here
      await this.initializeStrategies();
      await this.startTrading();
      
      logger.info('Trading bot started successfully');
    } catch (error) {
      logger.error('Failed to start trading bot', {
        error: { 
          stack: error.stack,
          code: 'STARTUP_FAILED'
        }
      });
      throw error;
    }
  }

  private handleAlert = (alert) => {
    // Handle system alerts
    if (alert.type === 'high_error_rate') {
      this.pauseTrading();
    }
  };

  private handleHealthStatus = (status) => {
    // Handle health status changes
    if (status.status === 'unhealthy') {
      this.enterSafeMode();
    }
  };

  async shutdown() {
    logger.info('Shutting down trading bot');
    
    monitoringService.stop();
    await logger.close();
    
    logger.info('Trading bot shutdown complete');
  }
}
```

## Best Practices

### Logging Guidelines

1. **Use appropriate log levels**:
   - `error` for failures that require attention
   - `warn` for potential issues or degraded performance
   - `info` for important business events
   - `debug` for detailed troubleshooting information

2. **Include context**:
   - Always include relevant context (trade IDs, symbols, user IDs)
   - Use structured logging with consistent field names
   - Include performance metrics for timing-sensitive operations

3. **Error handling**:
   - Log errors with full stack traces
   - Include error codes for categorization
   - Add context about what operation was being performed

4. **Security**:
   - Never log sensitive information (API keys, passwords)
   - Sanitize user input before logging
   - Be careful with PII (personally identifiable information)

### Monitoring Guidelines

1. **Set appropriate thresholds**:
   - Monitor key metrics (CPU, memory, error rates)
   - Set thresholds that provide early warning without false positives
   - Adjust thresholds based on historical data

2. **Health checks**:
   - Implement meaningful health checks for all critical services
   - Keep health checks lightweight and fast
   - Return detailed status information for debugging

3. **Alert management**:
   - Use alert cooldowns to prevent spam
   - Categorize alerts by severity
   - Implement escalation procedures for critical alerts

## Troubleshooting

### Common Issues

1. **Log files not rotating**:
   - Check file permissions on log directory
   - Verify disk space availability
   - Check configuration settings

2. **High memory usage**:
   - Monitor log buffer sizes
   - Check for memory leaks in application code
   - Verify log retention settings

3. **Missing logs**:
   - Check log level configuration
   - Verify file paths and permissions
   - Check for uncaught exceptions

4. **Performance issues**:
   - Review logging frequency
   - Consider async logging for high-volume scenarios
   - Monitor disk I/O performance

### Debug Mode

Enable debug logging to troubleshoot issues:

```bash
LOG_LEVEL=debug npm run dev
```

This will provide detailed information about:
- Service health checks
- Metric collection
- Alert processing
- Log file operations

## License

This logging and monitoring system is part of the crypto trading bot project and follows the same MIT license.