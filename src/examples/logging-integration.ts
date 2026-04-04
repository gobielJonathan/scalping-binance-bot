/**
 * Example integration of logging and monitoring services
 * This shows how to integrate the logging and monitoring into your main trading bot
 */

import { logger, monitoringService } from '../services';
import config from '../config';
import { TradeLogEntry } from '../types';

class TradingBotIntegration {
  constructor() {
    this.setupLoggingAndMonitoring();
  }

  private setupLoggingAndMonitoring(): void {
    // Log startup information
    logger.info('Trading bot starting up', {
      source: 'TradingBot',
      context: {
        mode: config.trading.mode,
        pairs: config.trading.pairs.join(','),
      },
    });

    // Set up monitoring event listeners
    monitoringService.on('alert', (alert) => {
      logger.error(`SYSTEM ALERT: ${alert.message}`, {
        source: 'MonitoringService',
        context: { alertType: alert.type, alertData: alert.data },
      });
      
      // Handle critical alerts
      if (alert.type === 'high_error_rate' || alert.type === 'system_unhealthy') {
        this.handleCriticalAlert(alert);
      }
    });

    monitoringService.on('healthStatus', (status) => {
      if (status.status !== 'healthy') {
        logger.warn(`System health status: ${status.status}`, {
          source: 'MonitoringService',
          context: { 
            status: status.status,
            errorCount: status.errors.length,
            servicesDown: Object.entries(status.services)
              .filter(([_, status]) => status !== 'connected')
              .map(([name]) => name)
          },
        });
      }
    });

    monitoringService.on('metrics', (metrics) => {
      // Log performance metrics periodically (every 5 minutes)
      if (Date.now() % (5 * 60 * 1000) < config.monitoring.metricsInterval) {
        logger.performance('System performance metrics', 0, {
          source: 'MonitoringService',
          performance: {
            memoryUsage: metrics.memoryUsage.heapUsed,
          },
        });
      }
    });
  }

  // Example trading operations with logging
  public async executeTrade(symbol: string, side: 'BUY' | 'SELL', quantity: number): Promise<void> {
    const tradeId = this.generateTradeId();
    const startTime = Date.now();

    try {
      logger.info(`Executing ${side} order for ${symbol}`, {
        source: 'TradingEngine',
        context: { tradeId, symbol, side, quantity },
      });

      // Simulate trade execution
      await this.simulateApiCall();

      const tradeLogEntry: TradeLogEntry = {
        tradeId,
        timestamp: Date.now(),
        symbol,
        action: 'ORDER_PLACED',
        details: {
          side,
          quantity,
          orderId: 'order_' + Date.now(),
        },
        metadata: {
          strategyId: 'scalping_v1',
          signalStrength: 85,
        },
      };

      logger.trade(tradeLogEntry);
      
      logger.performance(
        `Trade execution completed for ${symbol}`,
        Date.now() - startTime,
        {
          source: 'TradingEngine',
          context: { tradeId, symbol },
        }
      );

    } catch (error) {
      logger.error(`Trade execution failed for ${symbol}`, {
        source: 'TradingEngine',
        context: { tradeId, symbol, side, quantity },
        error: {
          stack: error instanceof Error ? error.stack : String(error),
          code: 'TRADE_EXECUTION_FAILED',
        },
      });
      throw error;
    }
  }

  // Example strategy execution with logging
  public async runTradingStrategy(strategyId: string): Promise<void> {
    logger.strategy(strategyId, 'Strategy execution started');

    try {
      // Simulate strategy logic
      const signals = await this.generateTradingSignals();
      
      logger.strategy(strategyId, `Generated ${signals.length} trading signals`, {
        context: { signalCount: signals.length },
      });

      for (const signal of signals) {
        if (signal.type !== 'HOLD') {
          await this.executeTrade(signal.symbol, signal.type, signal.quantity);
        }
      }

      logger.strategy(strategyId, 'Strategy execution completed successfully');

    } catch (error) {
      logger.error('Strategy execution failed', {
        source: 'Strategy',
        context: { strategyId },
        error: {
          stack: error instanceof Error ? error.stack : String(error),
        },
      });
    }
  }

  // Example risk management with logging
  public checkRiskLimits(): boolean {
    const portfolio = this.getPortfolioData();
    
    if (portfolio.dailyPnl < -config.trading.dailyLossLimit * portfolio.totalBalance) {
      logger.riskManagement('Daily loss limit exceeded - stopping trading', {
        context: {
          dailyPnl: portfolio.dailyPnl,
          lossLimit: config.trading.dailyLossLimit,
          totalBalance: portfolio.totalBalance,
        },
      });
      return false;
    }

    if (portfolio.openPositions.length >= config.trading.maxConcurrentTrades) {
      logger.riskManagement('Maximum concurrent trades limit reached', {
        context: {
          openPositions: portfolio.openPositions.length,
          maxTrades: config.trading.maxConcurrentTrades,
        },
      });
      return false;
    }

    return true;
  }

  // Example API call logging
  private async simulateApiCall(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
      
      const duration = Date.now() - startTime;
      logger.apiCall('POST', '/api/v3/order', duration, true);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.apiCall('POST', '/api/v3/order', duration, false, {
        error: {
          stack: error instanceof Error ? error.stack : String(error),
        },
      });
      throw error;
    }
  }

  // Example health check integration
  public async performSystemHealthCheck(): Promise<void> {
    const healthStatus = await monitoringService.getHealthStatus();
    
    if (healthStatus.status === 'unhealthy') {
      logger.error('System health check failed - entering safe mode', {
        source: 'TradingBot',
        context: { healthStatus: healthStatus.status },
      });
      
      // Enter safe mode - close positions, stop trading
      await this.enterSafeMode();
    }
  }

  private handleCriticalAlert(alert: any): void {
    logger.error(`Handling critical alert: ${alert.type}`, {
      source: 'TradingBot',
      context: { alertType: alert.type },
    });

    // Implement critical alert handling logic
    // For example: pause trading, notify administrators, etc.
  }

  private async enterSafeMode(): Promise<void> {
    logger.info('Entering safe mode', { source: 'TradingBot' });
    // Implement safe mode logic
  }

  private generateTradeId(): string {
    return `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async generateTradingSignals(): Promise<Array<{ type: 'BUY' | 'SELL' | 'HOLD'; symbol: string; quantity: number }>> {
    // Simulate signal generation
    return [
      { type: 'BUY', symbol: 'BTCUSDT', quantity: 0.001 },
      { type: 'HOLD', symbol: 'ETHUSDT', quantity: 0 },
    ];
  }

  private getPortfolioData(): any {
    // Simulate portfolio data
    return {
      totalBalance: 1000,
      dailyPnl: -50,
      openPositions: [],
    };
  }

  // Graceful shutdown with cleanup
  public async shutdown(): Promise<void> {
    logger.info('Trading bot shutting down', { source: 'TradingBot' });
    
    try {
      // Stop monitoring
      monitoringService.stop();
      
      // Close logger
      await logger.close();
      
      logger.info('Trading bot shutdown completed', { source: 'TradingBot' });
    } catch (error) {
      console.error('Error during shutdown:', error);
    }
  }
}

export default TradingBotIntegration;