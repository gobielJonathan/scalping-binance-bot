import simpleLogger from 'simple-node-logger';
import fs from 'fs';
import config from '../config';
import { LogContext, TradeLogEntry } from '../types';
import { isObj } from '../utils/is';

interface LogMetadata {
  source?: string;
  context?: LogContext;
  tradeData?: Partial<TradeLogEntry>;
  performance?: {
    duration?: number;
    memoryUsage?: number;
  };
  error?: {
    message?: string;
    stack?: string;
    code?: string;
  };
  // Allow any additional properties
  [key: string]: any;
}

class Logger {
  private simpleLogger: any;
  private errorCount: Map<string, number> = new Map();

  constructor() {
    this.ensureLogDirectory();
    this.initializeLogger();
  }

  private ensureLogDirectory(): void {
    const logDir = config.logging?.directory || 'logs';
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  private initializeLogger(): void {
    this.simpleLogger = simpleLogger.createSimpleFileLogger({
      logFilePath: 'logs/bot.log',
      timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS',
      level: 'info'
    });
  }

  private formatMessage(message: string, metadata?: LogMetadata): string {
    let formattedMessage = message;
    
    if (metadata?.source) {
      formattedMessage = `[${metadata.source}] ${formattedMessage}`;
    }
    
    else if (metadata?.context) {
       formattedMessage+= JSON.stringify(metadata, null, 2) + '\n';
    }
    
    else if (metadata?.performance) {
      formattedMessage += ` (${metadata.performance.duration}ms)`;
    }
    else if(isObj(metadata)) {
      formattedMessage +=  JSON.stringify(metadata, null, 2) + '\n';
    }
    
    return formattedMessage;
  }

  // Keywords whose presence in a message warrants console output at INFO level.
  // Everything else is still written to the log file but silenced in the terminal.
  private static readonly IMPORTANT_PATTERNS = [
    /initializ/i,
    // /starting|started|running|stopped|shutdown|shutting/i,
    // /connected|disconnected|server/i,
    // /\[paper trade\]|\[live trade\]/i,
    /order placed|order rejected|order executed|order failed/i,
    /position (opened|closed|close)/i,
    // /paper trade executed|paper position closed/i,
    /trade executed|trade closed/i,
    /emergency stop/i,
    // /trading (paused|resumed)/i,
    /p&l:/i,
    /bot (is now|stopped)/i,
    /signal/i,
    /balance synced/i
    // /dashboard server/i,
    // /seeded portfolio/i,
  ];

  private shouldPrintToConsole(message: string): boolean {
    return Logger.IMPORTANT_PATTERNS.some((re) => re.test(message));
  }

  error(message: string, metadata?: LogMetadata): void {
    const source = metadata?.source || 'unknown';
    this.errorCount.set(source, (this.errorCount.get(source) || 0) + 1);
    
    let errorMsg = this.formatMessage(message, metadata);
    if (metadata?.error?.stack) {
      errorMsg += `\nStack: ${metadata.error.stack}`;
    }
    
    this.simpleLogger.error(errorMsg);
    console.error('❌', errorMsg);
  }

  warn(message: string, metadata?: LogMetadata): void {
    const formattedMessage = this.formatMessage(message, metadata);
    this.simpleLogger.warn(formattedMessage);
    console.warn('⚠️', formattedMessage);
  }

  info(message: string, metadata?: LogMetadata): void {
    const formattedMessage = this.formatMessage(message, metadata);
    this.simpleLogger.info(formattedMessage);
    if (this.shouldPrintToConsole(formattedMessage)) {
      console.log('ℹ️', formattedMessage);
    }
  }

  debug(message: string, metadata?: LogMetadata): void {
    const formattedMessage = this.formatMessage(message, metadata);
    this.simpleLogger.debug(formattedMessage);
    // debug messages are written to file only — never printed to console
  }

  // Specialized logging methods
  trade(tradeData: TradeLogEntry): void {
    const message = `Trade ${tradeData.action}: ${tradeData.symbol}`;
    this.info(message, {
      source: 'TradingEngine',
      context: { tradeId: tradeData.tradeId, symbol: tradeData.symbol },
      tradeData
    });
  }

  performance(message: string, duration: number, metadata?: LogMetadata): void {
    this.info(message, {
      ...metadata,
      performance: { duration, memoryUsage: process.memoryUsage().heapUsed }
    });
  }

  apiCall(method: string, endpoint: string, duration: number, success: boolean, metadata?: LogMetadata): void {
    const message = `API ${method} ${endpoint} - ${success ? 'SUCCESS' : 'FAILED'} (${duration}ms)`;
    
    if (success) {
      this.info(message, { ...metadata, source: 'ApiClient', performance: { duration } });
    } else {
      this.warn(message, { ...metadata, source: 'ApiClient', performance: { duration } });
    }
  }

  strategy(strategyId: string, message: string, metadata?: LogMetadata): void {
    this.info(message, {
      ...metadata,
      source: 'Strategy',
      context: { strategyId, ...metadata?.context }
    });
  }

  riskManagement(message: string, metadata?: LogMetadata): void {
    this.warn(message, {
      ...metadata,
      source: 'RiskManager'
    });
  }

  // Error tracking
  getErrorCount(source?: string): number {
    if (source) {
      return this.errorCount.get(source) || 0;
    }
    return Array.from(this.errorCount.values()).reduce((sum, count) => sum + count, 0);
  }

  getErrorRate(source?: string, timeWindow = 60000): number {
    const errorCount = this.getErrorCount(source);
    return (errorCount / (timeWindow / 1000)) * 60; // errors per minute
  }

  clearErrorCounts(): void {
    this.errorCount.clear();
  }

  // Graceful shutdown
  close(): Promise<void> {
    return Promise.resolve();
  }
}

// Export LogMetadata for use in other modules
export type { LogMetadata };

/**
 * Converts an unknown caught error to a LogMetadata-compatible error object.
 * Use this in catch blocks to safely pass error info to logger methods.
 */
export function toLogError(error: unknown): { error: { message: string; stack?: string } } {
  if (error instanceof Error) {
    return { error: { message: error.message, stack: error.stack } };
  }
  return { error: { message: String(error) } };
}

// Export singleton instance
export const logger = new Logger();
export default logger;
