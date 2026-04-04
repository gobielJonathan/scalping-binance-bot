// Example configuration for the Trade Analytics System
import { AnalyticsNotificationConfig, AnalyticsThresholds } from '../services/analyticsNotificationService';

// Analytics notification configuration
export const analyticsNotificationConfig: AnalyticsNotificationConfig = {
  enabled: true,
  email: {
    enabled: false, // Set to true when email service is configured
    recipients: ['trader@example.com', 'risk@example.com'],
    smtpConfig: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      }
    }
  },
  webhook: {
    enabled: true,
    url: process.env.ANALYTICS_WEBHOOK_URL || 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK',
    headers: {
      'Content-Type': 'application/json'
    }
  },
  file: {
    enabled: true,
    directory: './logs/analytics'
  }
};

// Performance alert thresholds
export const analyticsThresholds: AnalyticsThresholds = {
  winRate: {
    warning: 45, // Alert if win rate drops below 45%
    critical: 35 // Critical alert if win rate drops below 35%
  },
  drawdown: {
    warning: 10, // Alert if drawdown exceeds 10%
    critical: 20 // Critical alert if drawdown exceeds 20%
  },
  profitFactor: {
    warning: 1.3, // Alert if profit factor drops below 1.3
    critical: 1.1 // Critical alert if profit factor drops below 1.1
  },
  dailyLoss: {
    warning: -200, // Alert if daily loss exceeds $200
    critical: -500 // Critical alert if daily loss exceeds $500
  },
  consecutiveLosses: {
    warning: 5, // Alert after 5 consecutive losses
    critical: 8 // Critical alert after 8 consecutive losses
  }
};

// Example usage in main application
export async function initializeAnalyticsSystem() {
  const { TradeAnalyticsService, AnalyticsNotificationService } = await import('../services');
  
  // Initialize analytics service
  const analyticsService = new TradeAnalyticsService();
  await analyticsService.initialize();
  
  // Initialize notification service
  const notificationService = new AnalyticsNotificationService(
    analyticsNotificationConfig,
    analyticsThresholds
  );
  await notificationService.initialize();
  
  // Start scheduled reports
  notificationService.startScheduledReports();
  
  // Return services for use in application
  return {
    analyticsService,
    notificationService
  };
}

// Example integration with trading bot
export class TradingBotWithAnalytics {
  private analyticsService: any;
  private notificationService: any;

  constructor(private config: any) {
    this.initializeServices();
  }

  private async initializeServices() {
    const services = await initializeAnalyticsSystem();
    this.analyticsService = services.analyticsService;
    this.notificationService = services.notificationService;
  }

  // Example method to trigger analytics after each trade
  async onTradeCompleted(trade: any) {
    try {
      // Regular trade processing...
      
      // Check for real-time alerts after each trade
      await this.notificationService.checkRealTimeAlerts(this.config.mode);
      
      // Generate analytics summary if significant trade
      if (Math.abs(trade.pnl) > 100) {
        const summary = await this.analyticsService.generateReport({
          mode: this.config.mode
        });
        
        console.log('Trade Analytics Summary:', {
          totalTrades: summary.summary.totalTrades,
          winRate: summary.summary.winRate,
          totalPnl: summary.summary.totalPnl
        });
      }
      
    } catch (error) {
      console.error('Error processing analytics for trade:', error);
    }
  }

  // Example method for on-demand reporting
  async generateAnalyticsReport(options?: {
    format?: 'json' | 'csv';
    timeRange?: string;
    symbols?: string[];
  }) {
    try {
      const report = await this.analyticsService.generateReport({
        mode: this.config.mode,
        symbols: options?.symbols
      });

      if (options?.format === 'csv') {
        const exportPath = await this.analyticsService.exportAnalytics({
          format: 'csv',
          includeCharts: false
        });
        console.log('Report exported to:', exportPath);
      }

      return report;
      
    } catch (error) {
      console.error('Error generating analytics report:', error);
      throw error;
    }
  }

  // Example method for manual alert checking
  async checkCurrentPerformance() {
    try {
      await this.notificationService.checkRealTimeAlerts(this.config.mode);
    } catch (error) {
      console.error('Error checking performance alerts:', error);
    }
  }

  // Cleanup method
  async close() {
    await this.analyticsService?.close();
    await this.notificationService?.close();
  }
}

// Example CLI commands for analytics
export const analyticsCommands = {
  // Generate daily report
  async dailyReport(mode: 'paper' | 'live' = 'paper') {
    const services = await initializeAnalyticsSystem();
    await services.notificationService.sendDailyReport(mode);
    await services.analyticsService.close();
    await services.notificationService.close();
  },

  // Generate weekly report
  async weeklyReport(mode: 'paper' | 'live' = 'paper') {
    const services = await initializeAnalyticsSystem();
    await services.notificationService.sendWeeklyReport(mode);
    await services.analyticsService.close();
    await services.notificationService.close();
  },

  // Export analytics data
  async exportData(format: 'json' | 'csv' = 'json', days: number = 30) {
    const services = await initializeAnalyticsSystem();
    
    const endDate = Date.now();
    const startDate = endDate - (days * 24 * 60 * 60 * 1000);
    
    const exportPath = await services.analyticsService.exportAnalytics({
      format,
      includeCharts: false,
      dateRange: { start: startDate, end: endDate }
    });
    
    console.log(`Analytics data exported to: ${exportPath}`);
    
    await services.analyticsService.close();
    await services.notificationService.close();
  },

  // Check current performance
  async checkAlerts(mode: 'paper' | 'live' = 'paper') {
    const services = await initializeAnalyticsSystem();
    await services.notificationService.checkRealTimeAlerts(mode);
    await services.analyticsService.close();
    await services.notificationService.close();
  }
};

// Example environment variables for configuration
export const requiredEnvVars = [
  // Optional: Email configuration
  'SMTP_USER',
  'SMTP_PASS',
  
  // Optional: Webhook URL for notifications (Slack, Discord, etc.)
  'ANALYTICS_WEBHOOK_URL',
  
  // Optional: Custom thresholds
  'ANALYTICS_WIN_RATE_WARNING',
  'ANALYTICS_WIN_RATE_CRITICAL',
  'ANALYTICS_DRAWDOWN_WARNING',
  'ANALYTICS_DRAWDOWN_CRITICAL',
  'ANALYTICS_DAILY_LOSS_WARNING',
  'ANALYTICS_DAILY_LOSS_CRITICAL'
];

// Load thresholds from environment variables if available
export function loadThresholdsFromEnv(): Partial<AnalyticsThresholds> {
  return {
    winRate: {
      warning: parseFloat(process.env.ANALYTICS_WIN_RATE_WARNING || '45'),
      critical: parseFloat(process.env.ANALYTICS_WIN_RATE_CRITICAL || '35')
    },
    drawdown: {
      warning: parseFloat(process.env.ANALYTICS_DRAWDOWN_WARNING || '10'),
      critical: parseFloat(process.env.ANALYTICS_DRAWDOWN_CRITICAL || '20')
    },
    dailyLoss: {
      warning: parseFloat(process.env.ANALYTICS_DAILY_LOSS_WARNING || '-200'),
      critical: parseFloat(process.env.ANALYTICS_DAILY_LOSS_CRITICAL || '-500')
    },
    profitFactor: {
      warning: parseFloat(process.env.ANALYTICS_PROFIT_FACTOR_WARNING || '1.3'),
      critical: parseFloat(process.env.ANALYTICS_PROFIT_FACTOR_CRITICAL || '1.1')
    },
    consecutiveLosses: {
      warning: parseInt(process.env.ANALYTICS_CONSECUTIVE_LOSSES_WARNING || '5'),
      critical: parseInt(process.env.ANALYTICS_CONSECUTIVE_LOSSES_CRITICAL || '8')
    }
  };
}