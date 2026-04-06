import { TradeAnalyticsService } from './tradeAnalyticsService';
import { DatabaseService } from '../database/databaseService';
import { AnalyticsReport } from './tradeAnalyticsService';
import * as fs from 'fs';
import * as path from 'path';
import moment from 'moment';
import { logger } from './logger';

export interface AnalyticsNotificationConfig {
  enabled: boolean;
  email?: {
    enabled: boolean;
    recipients: string[];
    smtpConfig?: {
      host: string;
      port: number;
      secure: boolean;
      auth: {
        user: string;
        pass: string;
      };
    };
  };
  webhook?: {
    enabled: boolean;
    url: string;
    headers?: Record<string, string>;
  };
  file?: {
    enabled: boolean;
    directory: string;
  };
}

export interface PerformanceAlert {
  type: 'warning' | 'critical' | 'info';
  title: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
  category: 'performance' | 'risk' | 'trading';
}

export interface AnalyticsThresholds {
  winRate: {
    warning: number; // e.g., 40%
    critical: number; // e.g., 30%
  };
  drawdown: {
    warning: number; // e.g., 10%
    critical: number; // e.g., 20%
  };
  profitFactor: {
    warning: number; // e.g., 1.2
    critical: number; // e.g., 1.0
  };
  dailyLoss: {
    warning: number; // e.g., -100
    critical: number; // e.g., -500
  };
  consecutiveLosses: {
    warning: number; // e.g., 5
    critical: number; // e.g., 10
  };
}

export class AnalyticsNotificationService {
  private analyticsService: TradeAnalyticsService;
  private dbService: DatabaseService;
  private config: AnalyticsNotificationConfig;
  private thresholds: AnalyticsThresholds;
  private alertHistory: Map<string, number> = new Map();
  private readonly ALERT_COOLDOWN = 1 * 60 * 60 * 1000; // 1 hour

  constructor(config: AnalyticsNotificationConfig, thresholds: AnalyticsThresholds) {
    this.analyticsService = new TradeAnalyticsService();
    this.dbService = new DatabaseService();
    this.config = config;
    this.thresholds = thresholds;
  }

  /**
   * Initialize the notification service
   */
  async initialize(): Promise<void> {
    await this.analyticsService.initialize();
    await this.dbService.initializeDatabase();
    
    // Ensure output directories exist
    if (this.config.file?.enabled && this.config.file.directory) {
      if (!fs.existsSync(this.config.file.directory)) {
        fs.mkdirSync(this.config.file.directory, { recursive: true });
      }
    }
  }

  /**
   * Generate and send daily performance report
   */
  async sendDailyReport(mode: 'paper' | 'live' = 'paper'): Promise<void> {
    try {
      const endDate = moment().endOf('day').valueOf();
      const startDate = moment().startOf('day').valueOf();

      const report = await this.analyticsService.generateReport({
        startDate,
        endDate,
        mode
      });

      const alerts = await this.checkPerformanceAlerts(report);
      
      const dailyReport = {
        type: 'daily_report',
        date: moment().format('YYYY-MM-DD'),
        mode,
        summary: report.summary,
        alerts,
        insights: report.insights,
        warnings: report.warnings,
        generated: Date.now()
      };

      await this.sendNotification('Daily Performance Report', this.formatDailyReport(dailyReport), dailyReport);
      
    } catch (error) {
      logger.error('Error sending daily report:', { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
      await this.sendNotification('Daily Report Error', 
        `Failed to generate daily report: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { type: 'error', error: error instanceof Error ? error.message : 'Unknown error' }
      );
    }
  }

  /**
   * Generate and send weekly performance report
   */
  async sendWeeklyReport(mode: 'paper' | 'live' = 'paper'): Promise<void> {
    try {
      const endDate = moment().endOf('week').valueOf();
      const startDate = moment().startOf('week').valueOf();

      const report = await this.analyticsService.generateReport({
        startDate,
        endDate,
        mode
      });

      const weeklyReport = {
        type: 'weekly_report',
        week: moment().format('YYYY-[W]WW'),
        mode,
        summary: report.summary,
        performance: report.performance,
        risk: report.risk,
        drawdown: report.drawdown,
        streaks: report.streaks,
        insights: report.insights,
        warnings: report.warnings,
        generated: Date.now()
      };

      await this.sendNotification('Weekly Performance Report', this.formatWeeklyReport(weeklyReport), weeklyReport);
      
    } catch (error) {
      logger.error('Error sending weekly report:', { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
    }
  }

  /**
   * Generate and send monthly performance report
   */
  async sendMonthlyReport(mode: 'paper' | 'live' = 'paper'): Promise<void> {
    try {
      const endDate = moment().endOf('month').valueOf();
      const startDate = moment().startOf('month').valueOf();

      const report = await this.analyticsService.generateReport({
        startDate,
        endDate,
        mode
      });

      const monthlyReport = {
        type: 'monthly_report',
        month: moment().format('YYYY-MM'),
        mode,
        summary: report.summary,
        performance: report.performance,
        risk: report.risk,
        drawdown: report.drawdown,
        streaks: report.streaks,
        trends: report.trends,
        insights: report.insights,
        warnings: report.warnings,
        generated: Date.now()
      };

      // Export detailed monthly report
      const exportPath = await this.analyticsService.exportAnalytics({
        format: 'json',
        includeCharts: false,
        dateRange: { start: startDate, end: endDate }
      });

      await this.sendNotification('Monthly Performance Report', this.formatMonthlyReport(monthlyReport), {
        ...monthlyReport,
        exportPath
      });
      
    } catch (error) {
      logger.error('Error sending monthly report:', { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
    }
  }

  /**
   * Check for performance alerts based on current metrics
   */
  async checkPerformanceAlerts(report: AnalyticsReport): Promise<PerformanceAlert[]> {
    const alerts: PerformanceAlert[] = [];
    const summary = report.summary;

    // Win rate alerts
    if (summary.winRate < this.thresholds.winRate.critical) {
      alerts.push({
        type: 'critical',
        title: 'Critical Win Rate',
        message: `Win rate has fallen to ${summary.winRate.toFixed(1)}%, below critical threshold of ${this.thresholds.winRate.critical}%`,
        value: summary.winRate,
        threshold: this.thresholds.winRate.critical,
        timestamp: Date.now(),
        category: 'performance'
      });
    } else if (summary.winRate < this.thresholds.winRate.warning) {
      alerts.push({
        type: 'warning',
        title: 'Low Win Rate',
        message: `Win rate is ${summary.winRate.toFixed(1)}%, below warning threshold of ${this.thresholds.winRate.warning}%`,
        value: summary.winRate,
        threshold: this.thresholds.winRate.warning,
        timestamp: Date.now(),
        category: 'performance'
      });
    }

    // Drawdown alerts
    if (report.drawdown.maxDrawdownPercent > this.thresholds.drawdown.critical) {
      alerts.push({
        type: 'critical',
        title: 'Critical Drawdown',
        message: `Maximum drawdown is ${report.drawdown.maxDrawdownPercent.toFixed(1)}%, above critical threshold`,
        value: report.drawdown.maxDrawdownPercent,
        threshold: this.thresholds.drawdown.critical,
        timestamp: Date.now(),
        category: 'risk'
      });
    } else if (report.drawdown.maxDrawdownPercent > this.thresholds.drawdown.warning) {
      alerts.push({
        type: 'warning',
        title: 'High Drawdown',
        message: `Maximum drawdown is ${report.drawdown.maxDrawdownPercent.toFixed(1)}%, above warning threshold`,
        value: report.drawdown.maxDrawdownPercent,
        threshold: this.thresholds.drawdown.warning,
        timestamp: Date.now(),
        category: 'risk'
      });
    }

    // Profit factor alerts
    if (summary.profitFactor < this.thresholds.profitFactor.critical) {
      alerts.push({
        type: 'critical',
        title: 'Critical Profit Factor',
        message: `Profit factor is ${summary.profitFactor.toFixed(2)}, below critical threshold`,
        value: summary.profitFactor,
        threshold: this.thresholds.profitFactor.critical,
        timestamp: Date.now(),
        category: 'performance'
      });
    } else if (summary.profitFactor < this.thresholds.profitFactor.warning) {
      alerts.push({
        type: 'warning',
        title: 'Low Profit Factor',
        message: `Profit factor is ${summary.profitFactor.toFixed(2)}, below warning threshold`,
        value: summary.profitFactor,
        threshold: this.thresholds.profitFactor.warning,
        timestamp: Date.now(),
        category: 'performance'
      });
    }

    // Consecutive losses alert
    if (report.streaks.currentLossStreak >= this.thresholds.consecutiveLosses.critical) {
      alerts.push({
        type: 'critical',
        title: 'Critical Loss Streak',
        message: `Currently in a ${report.streaks.currentLossStreak}-trade loss streak`,
        value: report.streaks.currentLossStreak,
        threshold: this.thresholds.consecutiveLosses.critical,
        timestamp: Date.now(),
        category: 'trading'
      });
    } else if (report.streaks.currentLossStreak >= this.thresholds.consecutiveLosses.warning) {
      alerts.push({
        type: 'warning',
        title: 'Loss Streak Warning',
        message: `Currently in a ${report.streaks.currentLossStreak}-trade loss streak`,
        value: report.streaks.currentLossStreak,
        threshold: this.thresholds.consecutiveLosses.warning,
        timestamp: Date.now(),
        category: 'trading'
      });
    }

    return alerts;
  }

  /**
   * Check real-time alerts (to be called periodically)
   */
  async checkRealTimeAlerts(mode: 'paper' | 'live' = 'paper'): Promise<void> {
    try {
      // Get today's performance
      const startDate = moment().startOf('day').valueOf();
      const endDate = Date.now();

      const report = await this.analyticsService.generateReport({
        startDate,
        endDate,
        mode
      });

      const alerts = await this.checkPerformanceAlerts(report);
      
      // Filter out alerts that are in cooldown
      const activeAlerts = alerts.filter(alert => {
        const alertKey = `${alert.category}_${alert.type}_${alert.title}`;
        const lastAlert = this.alertHistory.get(alertKey);
        
        if (!lastAlert || Date.now() - lastAlert > this.ALERT_COOLDOWN) {
          this.alertHistory.set(alertKey, Date.now());
          return true;
        }
        
        return false;
      });

      // Send immediate alerts for critical issues
      for (const alert of activeAlerts.filter(a => a.type === 'critical')) {
        await this.sendNotification(`CRITICAL ALERT: ${alert.title}`, alert.message, alert);
      }

      // Check daily loss threshold
      if (report.summary.totalPnl < this.thresholds.dailyLoss.critical) {
        const alertKey = 'daily_loss_critical';
        const lastAlert = this.alertHistory.get(alertKey);
        
        if (!lastAlert || Date.now() - lastAlert > this.ALERT_COOLDOWN) {
          await this.sendNotification('CRITICAL: Daily Loss Limit', 
            `Daily P&L is $${report.summary.totalPnl.toFixed(2)}, below critical threshold of $${this.thresholds.dailyLoss.critical}`,
            {
              type: 'critical',
              title: 'Daily Loss Limit',
              value: report.summary.totalPnl,
              threshold: this.thresholds.dailyLoss.critical,
              category: 'risk'
            }
          );
          this.alertHistory.set(alertKey, Date.now());
        }
      }
      
    } catch (error) {
      logger.error('Error checking real-time alerts:', { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
    }
  }

  /**
   * Send a notification through configured channels
   */
  private async sendNotification(subject: string, message: string, data?: any): Promise<void> {
    if (!this.config.enabled) return;

    const notification = {
      subject,
      message,
      timestamp: Date.now(),
      data
    };

    // Send to file
    if (this.config.file?.enabled) {
      await this.writeToFile(notification);
    }

    // Send via webhook
    if (this.config.webhook?.enabled) {
      await this.sendWebhook(notification);
    }

    // Send via email (placeholder - would need email service)
    if (this.config.email?.enabled) {
      await this.sendEmail(notification);
    }
  }

  /**
   * Write notification to file
   */
  private async writeToFile(notification: any): Promise<void> {
    try {
      const filename = `analytics_notifications_${moment().format('YYYY-MM-DD')}.log`;
      const filepath = path.join(this.config.file!.directory, filename);
      
      const logEntry = `${moment().toISOString()} - ${notification.subject}\n${notification.message}\n${'='.repeat(80)}\n`;
      
      fs.appendFileSync(filepath, logEntry);
      
    } catch (error) {
      logger.error('Error writing notification to file:', { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
    }
  }

  /**
   * Send notification via webhook
   */
  private async sendWebhook(notification: any): Promise<void> {
    try {
      if (!this.config.webhook?.url) return;

      const response = await fetch(this.config.webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.webhook.headers
        },
        body: JSON.stringify(notification)
      });

      if (!response.ok) {
        logger.error('Webhook notification failed:', { statusText: response.statusText });
      }
      
    } catch (error) {
      logger.error('Error sending webhook notification:', { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
    }
  }

  /**
   * Send notification via email (placeholder)
   */
  private async sendEmail(notification: any): Promise<void> {
    // This would be implemented with an email service like nodemailer
    logger.info('Email notification (not implemented):', { subject: notification.subject });
  }

  // Report formatting methods

  private formatDailyReport(report: any): string {
    return `
Daily Performance Report - ${report.date}
Mode: ${report.mode.toUpperCase()}

📊 SUMMARY
• Total Trades: ${report.summary.totalTrades}
• Win Rate: ${report.summary.winRate.toFixed(1)}%
• Total P&L: $${report.summary.totalPnl.toFixed(2)}
• Profit Factor: ${report.summary.profitFactor.toFixed(2)}

${report.alerts.length > 0 ? `
🚨 ALERTS (${report.alerts.length})
${report.alerts.map((alert: PerformanceAlert) => `• ${alert.type.toUpperCase()}: ${alert.message}`).join('\n')}
` : ''}

${report.insights.length > 0 ? `
💡 INSIGHTS
${report.insights.map((insight: string) => `• ${insight}`).join('\n')}
` : ''}

${report.warnings.length > 0 ? `
⚠️ WARNINGS
${report.warnings.map((warning: string) => `• ${warning}`).join('\n')}
` : ''}

Generated: ${moment(report.generated).format('YYYY-MM-DD HH:mm:ss')}
    `.trim();
  }

  private formatWeeklyReport(report: any): string {
    return `
Weekly Performance Report - Week ${report.week}
Mode: ${report.mode.toUpperCase()}

📊 SUMMARY
• Total Trades: ${report.summary.totalTrades}
• Win Rate: ${report.summary.winRate.toFixed(1)}%
• Total P&L: $${report.summary.totalPnl.toFixed(2)}
• Profit Factor: ${report.summary.profitFactor.toFixed(2)}
• Sharpe Ratio: ${report.summary.sharpeRatio.toFixed(2)}

🎯 PERFORMANCE
• Max Win: $${report.summary.maxWin.toFixed(2)}
• Max Loss: $${report.summary.maxLoss.toFixed(2)}
• Avg Win: $${report.summary.avgWin.toFixed(2)}
• Avg Loss: $${report.summary.avgLoss.toFixed(2)}

🛡️ RISK METRICS
• Max Drawdown: ${report.drawdown.maxDrawdownPercent.toFixed(1)}%
• Current Drawdown: ${report.drawdown.currentDrawdownPercent.toFixed(1)}%
• VaR (95%): $${Math.abs(report.risk.valueAtRisk).toFixed(2)}
• Volatility: ${(report.risk.volatility * 100).toFixed(2)}%

📈 STREAKS
• Longest Win Streak: ${report.streaks.longestWinStreak}
• Longest Loss Streak: ${report.streaks.longestLossStreak}
• Current Win Streak: ${report.streaks.currentWinStreak}
• Current Loss Streak: ${report.streaks.currentLossStreak}

Generated: ${moment(report.generated).format('YYYY-MM-DD HH:mm:ss')}
    `.trim();
  }

  private formatMonthlyReport(report: any): string {
    return `
Monthly Performance Report - ${report.month}
Mode: ${report.mode.toUpperCase()}

📊 SUMMARY
• Total Trades: ${report.summary.totalTrades}
• Win Rate: ${report.summary.winRate.toFixed(1)}%
• Total P&L: $${report.summary.totalPnl.toFixed(2)}
• Total Return: ${report.summary.totalPnlPercent.toFixed(2)}%
• Profit Factor: ${report.summary.profitFactor.toFixed(2)}
• Sharpe Ratio: ${report.summary.sharpeRatio.toFixed(2)}

🎯 PERFORMANCE BREAKDOWN
• Winning Trades: ${report.summary.winningTrades} (${((report.summary.winningTrades / report.summary.totalTrades) * 100).toFixed(1)}%)
• Losing Trades: ${report.summary.losingTrades} (${((report.summary.losingTrades / report.summary.totalTrades) * 100).toFixed(1)}%)
• Max Win: $${report.summary.maxWin.toFixed(2)}
• Max Loss: $${report.summary.maxLoss.toFixed(2)}
• Avg Trade Return: ${report.summary.avgTradeReturn.toFixed(2)}%
• Total Fees: $${report.summary.totalFees.toFixed(2)}

🛡️ RISK ANALYSIS
• Max Drawdown: ${report.drawdown.maxDrawdownPercent.toFixed(1)}% ($${report.drawdown.maxDrawdown.toFixed(2)})
• Current Drawdown: ${report.drawdown.currentDrawdownPercent.toFixed(1)}%
• Recovery Factor: ${report.summary.recoveryFactor.toFixed(2)}
• Risk-Reward Ratio: ${report.summary.riskRewardRatio.toFixed(2)}
• VaR (95%): $${Math.abs(report.risk.valueAtRisk).toFixed(2)}
• Expected Shortfall: $${Math.abs(report.risk.expectedShortfall).toFixed(2)}
• Volatility: ${(report.risk.volatility * 100).toFixed(2)}%

📈 TREND ANALYSIS
• Trend Direction: ${report.trends.trend.toUpperCase()}
• Momentum: ${(report.trends.momentum * 100).toFixed(2)}%
• Correlation: ${report.trends.correlation.toFixed(3)}

📋 DETAILED REPORT
A detailed export has been generated: ${report.exportPath || 'N/A'}

Generated: ${moment(report.generated).format('YYYY-MM-DD HH:mm:ss')}
    `.trim();
  }

  /**
   * Schedule automatic reports
   */
  startScheduledReports(): void {
    // Daily report at 23:00
    setInterval(async () => {
      const now = moment();
      if (now.hour() === 23 && now.minute() === 0) {
        await this.sendDailyReport();
      }
    }, 60 * 1000); // Check every minute

    // Weekly report on Sunday at 23:30
    setInterval(async () => {
      const now = moment();
      if (now.day() === 0 && now.hour() === 23 && now.minute() === 30) {
        await this.sendWeeklyReport();
      }
    }, 60 * 1000);

    // Monthly report on last day of month at 23:45
    setInterval(async () => {
      const now = moment();
      const endOfMonth = moment().endOf('month');
      if (now.date() === endOfMonth.date() && now.hour() === 23 && now.minute() === 45) {
        await this.sendMonthlyReport();
      }
    }, 60 * 1000);

    // Real-time alerts every 5 minutes
    setInterval(async () => {
      await this.checkRealTimeAlerts();
    }, 5 * 60 * 1000);
  }

  /**
   * Close the notification service
   */
  async close(): Promise<void> {
    await this.analyticsService.close();
    await this.dbService.close();
  }
}