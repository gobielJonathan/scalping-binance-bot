# Trade Analytics System

A comprehensive analytics and reporting system for the crypto trading bot, providing detailed performance analysis, risk metrics, and automated notifications.

## Features

### Core Analytics
- **Performance Metrics**: Win rate, profit factor, Sharpe ratio, Sortino ratio, Calmar ratio
- **Risk Analysis**: Value at Risk (VaR), expected shortfall, volatility, drawdown analysis
- **Trade Attribution**: Performance by symbol, time of day, day of week, strategy
- **Streak Analysis**: Win/loss streak tracking and statistics
- **Trend Analysis**: Momentum, volatility, and pattern recognition

### Dashboard & Visualization
- **Interactive Dashboard**: Real-time analytics with interactive charts
- **Chart Types**: Line charts, bar charts, heatmaps, distribution charts
- **Time-based Filtering**: Daily, weekly, monthly, and custom date ranges
- **Symbol Filtering**: Performance analysis by trading pairs
- **Export Capabilities**: JSON, CSV export with chart screenshots

### Automated Reporting
- **Daily Reports**: End-of-day performance summary
- **Weekly Reports**: Comprehensive weekly analysis
- **Monthly Reports**: Detailed monthly performance review
- **Real-time Alerts**: Performance threshold monitoring
- **Multiple Channels**: File logging, webhook notifications, email reports

## Installation

The analytics system is integrated into the existing trading bot. No additional installation is required.

## Configuration

### Basic Setup

```typescript
import { TradeAnalyticsService, AnalyticsNotificationService } from '../services';

// Initialize analytics service
const analyticsService = new TradeAnalyticsService();
await analyticsService.initialize();

// Initialize notification service with configuration
const notificationService = new AnalyticsNotificationService(
  notificationConfig,
  thresholds
);
await notificationService.initialize();
```

### Notification Configuration

```typescript
const notificationConfig = {
  enabled: true,
  email: {
    enabled: true,
    recipients: ['trader@example.com'],
    smtpConfig: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    }
  },
  webhook: {
    enabled: true,
    url: process.env.ANALYTICS_WEBHOOK_URL,
    headers: {
      'Content-Type': 'application/json'
    }
  },
  file: {
    enabled: true,
    directory: './logs/analytics'
  }
};
```

### Alert Thresholds

```typescript
const thresholds = {
  winRate: {
    warning: 45,    // Alert if win rate < 45%
    critical: 35    // Critical alert if win rate < 35%
  },
  drawdown: {
    warning: 10,    // Alert if drawdown > 10%
    critical: 20    // Critical alert if drawdown > 20%
  },
  profitFactor: {
    warning: 1.3,   // Alert if profit factor < 1.3
    critical: 1.1   // Critical alert if profit factor < 1.1
  },
  dailyLoss: {
    warning: -200,  // Alert if daily loss > $200
    critical: -500  // Critical alert if daily loss > $500
  }
};
```

## Usage

### Dashboard Access

1. Start the trading bot dashboard
2. Navigate to `http://localhost:3000/analytics.html`
3. Use the interface to:
   - View real-time performance metrics
   - Analyze trade history
   - Generate custom reports
   - Export data

### API Endpoints

#### Get Analytics Summary
```http
GET /api/analytics/summary?mode=paper&startDate=1234567890&endDate=1234567890
```

#### Get Performance by Symbol
```http
GET /api/analytics/performance/symbol?mode=paper
```

#### Export Analytics Data
```http
POST /api/analytics/export
Content-Type: application/json

{
  "format": "csv",
  "includeCharts": false,
  "dateRange": {
    "start": 1234567890,
    "end": 1234567890
  }
}
```

### Programmatic Usage

#### Generate Analytics Report

```typescript
const report = await analyticsService.generateReport({
  startDate: Date.now() - (30 * 24 * 60 * 60 * 1000), // Last 30 days
  endDate: Date.now(),
  mode: 'paper',
  symbols: ['BTCUSDT', 'ETHUSDT']
});

console.log('Win Rate:', report.summary.winRate);
console.log('Total P&L:', report.summary.totalPnl);
console.log('Max Drawdown:', report.drawdown.maxDrawdown);
```

#### Performance by Trading Pair

```typescript
const symbolPerformance = await analyticsService.getPerformanceBySymbol({
  mode: 'paper'
});

symbolPerformance.forEach(symbol => {
  console.log(`${symbol.symbol}: ${symbol.winRate.toFixed(1)}% win rate, $${symbol.totalPnl.toFixed(2)} P&L`);
});
```

#### Export Analytics Data

```typescript
const exportPath = await analyticsService.exportAnalytics({
  format: 'csv',
  includeCharts: false,
  dateRange: {
    start: Date.now() - (7 * 24 * 60 * 60 * 1000),
    end: Date.now()
  }
});

console.log('Data exported to:', exportPath);
```

## Metrics Explained

### Performance Metrics

- **Win Rate**: Percentage of profitable trades
- **Profit Factor**: Gross profit divided by gross loss
- **Sharpe Ratio**: Risk-adjusted return measure
- **Sortino Ratio**: Sharpe ratio using downside deviation
- **Calmar Ratio**: Annual return divided by maximum drawdown

### Risk Metrics

- **Value at Risk (VaR)**: Maximum expected loss at 95% confidence
- **Expected Shortfall**: Average loss beyond VaR threshold
- **Maximum Drawdown**: Largest peak-to-trough decline
- **Volatility**: Standard deviation of returns
- **Risk-Adjusted Return**: Return per unit of risk

### Trade Attribution

- **By Symbol**: Performance breakdown by trading pairs
- **By Time of Day**: Hourly performance patterns
- **By Day of Week**: Daily performance patterns
- **By Strategy**: Performance attribution by strategy ID

## Automated Reporting

### Daily Reports
- Sent every day at 11:00 PM
- Includes key metrics, alerts, and insights
- Delivered via configured notification channels

### Weekly Reports
- Sent every Sunday at 11:30 PM
- Comprehensive performance analysis
- Risk metrics and streak analysis

### Monthly Reports
- Sent on last day of month at 11:45 PM
- Detailed trend analysis and full report export
- Historical performance comparison

### Real-time Alerts
- Monitored every 5 minutes
- Threshold-based warnings and critical alerts
- Immediate notification for significant events

## Dashboard Features

### Overview Section
- Key performance metrics cards
- Cumulative P&L chart
- Win/loss distribution chart
- Key insights and warnings

### Performance Section
- Performance by symbol chart and table
- Time-based performance analysis
- Detailed trade attribution

### Risk Section
- Drawdown analysis chart
- Risk metrics dashboard
- Win/loss streak analysis
- Risk distribution visualization

### Trade History
- Searchable and filterable trade table
- Pagination and sorting
- Trade outcome analysis
- Export functionality

### Reports Section
- Custom report generation
- Multiple export formats
- Quick actions for cache management
- Current view export

## Environment Variables

```bash
# Email Configuration (Optional)
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Webhook Configuration (Optional)
ANALYTICS_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK

# Custom Thresholds (Optional)
ANALYTICS_WIN_RATE_WARNING=45
ANALYTICS_WIN_RATE_CRITICAL=35
ANALYTICS_DRAWDOWN_WARNING=10
ANALYTICS_DRAWDOWN_CRITICAL=20
ANALYTICS_DAILY_LOSS_WARNING=-200
ANALYTICS_DAILY_LOSS_CRITICAL=-500
```

## CLI Commands

### Generate Reports

```bash
# Daily report
npm run analytics:daily

# Weekly report
npm run analytics:weekly

# Export data
npm run analytics:export -- --format csv --days 30

# Check alerts
npm run analytics:check-alerts
```

## Integration Examples

### Basic Integration

```typescript
import { TradeAnalyticsService } from './services';

class TradingBot {
  private analyticsService: TradeAnalyticsService;

  async initialize() {
    this.analyticsService = new TradeAnalyticsService();
    await this.analyticsService.initialize();
  }

  async onTradeCompleted(trade: any) {
    // Regular trade processing...
    
    // Check analytics after significant trades
    if (Math.abs(trade.pnl) > 100) {
      const report = await this.analyticsService.generateReport();
      console.log(`Current Win Rate: ${report.summary.winRate.toFixed(1)}%`);
    }
  }
}
```

### Advanced Integration with Alerts

```typescript
import { AnalyticsNotificationService } from './services';

class TradingBotWithAlerts extends TradingBot {
  private notificationService: AnalyticsNotificationService;

  async initialize() {
    await super.initialize();
    
    this.notificationService = new AnalyticsNotificationService(config, thresholds);
    await this.notificationService.initialize();
    this.notificationService.startScheduledReports();
  }

  async onTradeCompleted(trade: any) {
    await super.onTradeCompleted(trade);
    
    // Check for real-time alerts
    await this.notificationService.checkRealTimeAlerts('paper');
  }
}
```

## Troubleshooting

### Common Issues

1. **Analytics Service Not Initializing**
   - Ensure database is properly configured and accessible
   - Check that SQLite database file has write permissions

2. **Dashboard Not Loading**
   - Verify that the dashboard service is running
   - Check that analytics routes are properly registered
   - Ensure Chart.js and other dependencies are loaded

3. **Notifications Not Sending**
   - Verify notification configuration
   - Check webhook URLs and email SMTP settings
   - Ensure notification service is properly initialized

4. **Performance Issues**
   - Analytics service uses caching (5-minute TTL)
   - Large datasets may require pagination
   - Consider using database indices for better performance

### Debug Mode

Enable debug logging to troubleshoot issues:

```typescript
// Set debug logging for analytics
process.env.DEBUG = 'analytics:*';
```

## Performance Considerations

- **Caching**: 5-minute cache for frequently requested data
- **Database Optimization**: Proper indices on trade tables
- **Pagination**: Large trade datasets are paginated
- **Background Processing**: Reports generated asynchronously
- **Memory Management**: Charts are destroyed and recreated to prevent leaks

## Security Considerations

- **Data Access**: Analytics API requires same authentication as trading bot
- **Export Security**: Exported files are stored locally, consider access controls
- **Webhook Security**: Validate webhook endpoints and use HTTPS
- **Database Security**: Ensure proper database permissions and encryption

## Future Enhancements

- **Advanced Visualizations**: 3D charts, heatmaps, correlation matrices
- **Machine Learning**: Predictive analytics and pattern recognition
- **Real-time Streaming**: WebSocket-based real-time updates
- **Mobile Dashboard**: Responsive design for mobile devices
- **Custom Indicators**: User-defined performance metrics
- **Benchmark Comparison**: Performance vs. market indices
- **Portfolio Attribution**: Multi-strategy performance analysis

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review the console logs for error messages
3. Ensure all dependencies are properly installed
4. Verify configuration settings

## License

This analytics system is part of the crypto trading bot project and follows the same license terms.