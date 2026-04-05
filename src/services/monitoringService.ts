import { EventEmitter } from 'events';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import config from '../config';
import logger from './logger';
import { PerformanceMetrics, HealthStatus, AlertConfig } from '../types';

interface ServiceHealthCheck {
  name: string;
  check: () => Promise<boolean>;
  lastCheck?: number;
  status?: 'connected' | 'disconnected' | 'error';
}

class MonitoringService extends EventEmitter {
  private metricsInterval?: NodeJS.Timeout;
  private healthCheckInterval?: NodeJS.Timeout;
  private startTime: number = Date.now();
  private lastEventLoopTime: number = performance.now();
  private serviceChecks: Map<string, ServiceHealthCheck> = new Map();
  private alertConfig: AlertConfig;
  private alertCooldowns: Map<string, number> = new Map();
  private readonly alertCooldownDuration = 5 * 60 * 1000; // 5 minutes

  constructor() {
    super();
    
    this.alertConfig = {
      enabled: config.monitoring.enabled,
      thresholds: config.monitoring.alertThresholds,
      channels: {
        console: true,
        file: true,
        telegram: !!config.notifications.telegramBotToken,
        email: config.notifications.emailEnabled,
      },
    };

    this.setupServiceChecks();
    this.start();
  }

  private setupServiceChecks(): void {
    // Database health check
    this.serviceChecks.set('database', {
      name: 'database',
      check: async () => {
        try {
          // Check if database file exists and is accessible
          const dbPath = config.database.path;
          return fs.existsSync(dbPath);
        } catch (error) {
          logger.error('Database health check failed', {
            source: 'MonitoringService',
            error: { stack: error instanceof Error ? error.stack : String(error) }
          });
          return false;
        }
      },
    });

    // Binance API health check
    this.serviceChecks.set('binanceApi', {
      name: 'binanceApi',
      check: async () => {
        try {
          // Simple connectivity check - in real implementation, ping Binance API
          return config.binance.apiKey && config.binance.secretKey ? true : false;
        } catch (error) {
          logger.error('Binance API health check failed', {
            source: 'MonitoringService',
            error: { stack: error instanceof Error ? error.stack : String(error) }
          });
          return false;
        }
      },
    });

    // WebSocket health check
    this.serviceChecks.set('websocket', {
      name: 'websocket',
      check: async () => {
        try {
          // In real implementation, check WebSocket connection status
          return true;
        } catch (error) {
          logger.error('WebSocket health check failed', {
            source: 'MonitoringService',
            error: { stack: error instanceof Error ? error.stack : String(error) }
          });
          return false;
        }
      },
    });

    // Dashboard health check
    this.serviceChecks.set('dashboard', {
      name: 'dashboard',
      check: async () => {
        return config.dashboard.enabled;
      },
    });
  }

  private start(): void {
    if (!config.monitoring.enabled) {
      logger.info('Monitoring service is disabled', { source: 'MonitoringService' });
      return;
    }

    logger.info('Starting monitoring service', { source: 'MonitoringService' });

    // Start metrics collection
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, config.monitoring.metricsInterval);

    // Start health checks
    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck();
    }, config.monitoring.healthCheckInterval);

    // Initial health check
    this.performHealthCheck();

    logger.info('Monitoring service started', {
      source: 'MonitoringService',
      context: {
        metricsInterval: config.monitoring.metricsInterval,
        healthCheckInterval: config.monitoring.healthCheckInterval,
      },
    });
  }

  private async collectMetrics(): Promise<PerformanceMetrics> {
    const now = performance.now();
    const eventLoopLag = now - this.lastEventLoopTime;
    this.lastEventLoopTime = now;

    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const cpuPercent = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds

    const metrics: PerformanceMetrics = {
      timestamp: Date.now(),
      cpuUsage: cpuPercent,
      memoryUsage: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
      },
      uptime: Date.now() - this.startTime,
      eventLoopLag,
    };

    // Check for alerts
    this.checkAlerts(metrics);

    // Emit metrics event
    this.emit('metrics', metrics);

    return metrics;
  }

  private async performHealthCheck(): Promise<HealthStatus> {
    const errors: Array<{ timestamp: number; message: string; stack?: string; source: string }> = [];
    
    // Check all services
    const serviceStatuses: any = {};
    
    for (const [serviceName, serviceCheck] of this.serviceChecks.entries()) {
      try {
        const isHealthy = await serviceCheck.check();
        serviceCheck.status = isHealthy ? 'connected' : 'disconnected';
        serviceCheck.lastCheck = Date.now();
        serviceStatuses[serviceName] = serviceCheck.status;
        
        if (!isHealthy) {
          errors.push({
            timestamp: Date.now(),
            message: `Service ${serviceName} is not healthy`,
            source: 'MonitoringService',
          });
        }
      } catch (error) {
        serviceCheck.status = 'error';
        serviceStatuses[serviceName] = 'error';
        errors.push({
          timestamp: Date.now(),
          message: `Health check failed for ${serviceName}`,
          stack: error instanceof Error ? error.stack : String(error),
          source: 'MonitoringService',
        });
      }
    }

    const metrics = await this.collectMetrics();
    
    // Determine overall health status
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    
    if (errors.length > 0) {
      overallStatus = errors.length > 2 ? 'unhealthy' : 'degraded';
    }

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
      version: process.env.npm_package_version || '1.0.0',
      services: serviceStatuses,
      metrics,
      errors,
    };

    // Log health status if not healthy
    if (overallStatus !== 'healthy') {
      logger.warn(`System health is ${overallStatus}`, {
        source: 'MonitoringService',
        context: { healthStatus: overallStatus, errorCount: errors.length },
      });
    }

    // Emit health status event
    this.emit('healthStatus', healthStatus);

    return healthStatus;
  }

  private checkAlerts(metrics: PerformanceMetrics): void {
    if (!this.alertConfig.enabled) return;


    // CPU usage alert
    if (metrics.cpuUsage > this.alertConfig.thresholds.cpuUsage) {
      this.triggerAlert('high_cpu_usage', `High CPU usage detected: ${metrics.cpuUsage.toFixed(2)}%`, {
        value: metrics.cpuUsage,
        threshold: this.alertConfig.thresholds.cpuUsage,
      });
    }

    // Memory usage alert
    const memoryUsagePercent = (metrics.memoryUsage.heapUsed / os.totalmem()) * 100;
    if (memoryUsagePercent > this.alertConfig.thresholds.memoryUsage) {
      this.triggerAlert('high_memory_usage', `High memory usage detected: ${memoryUsagePercent.toFixed(2)}%`, {
        value: memoryUsagePercent,
        threshold: this.alertConfig.thresholds.memoryUsage,
      });
    }

    // Error rate alert
    const errorRate = logger.getErrorRate();
    if (errorRate > this.alertConfig.thresholds.errorRate) {
      this.triggerAlert('high_error_rate', `High error rate detected: ${errorRate.toFixed(2)} errors/min`, {
        value: errorRate,
        threshold: this.alertConfig.thresholds.errorRate,
      });
    }
  }

  private triggerAlert(alertType: string, message: string, data?: any): void {
    // Check cooldown
    const lastAlert = this.alertCooldowns.get(alertType);
    const now = Date.now();
    
    if (lastAlert && (now - lastAlert) < this.alertCooldownDuration) {
      return; // Still in cooldown
    }

    this.alertCooldowns.set(alertType, now);

    logger.error(`ALERT: ${message}`, {
      source: 'MonitoringService',
      context: { alertType, alertData: data },
    });

    // Emit alert event
    this.emit('alert', {
      type: alertType,
      message,
      timestamp: now,
      data,
    });

    // TODO: Implement additional alert channels (Telegram, email)
    if (this.alertConfig.channels.telegram) {
      this.sendTelegramAlert(alertType, message, data);
    }
  }

  private async sendTelegramAlert(alertType: string, message: string, data?: any): Promise<void> {
    // TODO: Implement Telegram alert functionality
    logger.debug('Telegram alert would be sent here', {
      source: 'MonitoringService',
      context: { alertType, message, data },
    });
  }

  // Public API methods
  public async getHealthStatus(): Promise<HealthStatus> {
    return this.performHealthCheck();
  }

  public getMetrics(): Promise<PerformanceMetrics> {
    return this.collectMetrics();
  }

  public addServiceCheck(name: string, check: () => Promise<boolean>): void {
    this.serviceChecks.set(name, { name, check });
    logger.info(`Added service health check: ${name}`, { source: 'MonitoringService' });
  }

  public removeServiceCheck(name: string): void {
    this.serviceChecks.delete(name);
    logger.info(`Removed service health check: ${name}`, { source: 'MonitoringService' });
  }

  public getSystemInfo(): any {
    return {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpus: os.cpus().length,
      uptime: os.uptime(),
      loadAverage: os.loadavg(),
    };
  }

  // File system monitoring
  public async getDiskUsage(_directory = './'): Promise<{ total: number; used: number; free: number }> {
    try {
      // This is a simplified implementation
      // In production, you might want to use a library like 'statvfs' for accurate disk space info
      return {
        total: 0,
        used: 0,
        free: 0,
      };
    } catch (error) {
      logger.error('Failed to get disk usage', {
        source: 'MonitoringService',
        error: { stack: error instanceof Error ? error.stack : String(error) },
      });
      return { total: 0, used: 0, free: 0 };
    }
  }

  // Log file monitoring
  public async getLogFileStats(): Promise<{ [filename: string]: { size: number; modified: Date } }> {
    const stats: any = {};
    const logDir = config.logging.directory;

    try {
      const files = await fs.promises.readdir(logDir);
      
      for (const file of files) {
        if (file.endsWith('.log')) {
          const filePath = path.join(logDir, file);
          const stat = await fs.promises.stat(filePath);
          stats[file] = {
            size: stat.size,
            modified: stat.mtime,
          };
        }
      }
    } catch (error) {
      logger.error('Failed to get log file stats', {
        source: 'MonitoringService',
        error: { stack: error instanceof Error ? error.stack : String(error) },
      });
    }

    return stats;
  }

  public stop(): void {
    logger.info('Stopping monitoring service', { source: 'MonitoringService' });

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }

    this.removeAllListeners();
    
    logger.info('Monitoring service stopped', { source: 'MonitoringService' });
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService();
export default monitoringService;