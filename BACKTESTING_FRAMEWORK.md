# Crypto Trading Bot - Backtesting Framework

A comprehensive backtesting framework for cryptocurrency trading strategies with realistic market simulation, advanced performance analytics, and professional reporting capabilities.

## 🚀 Features

### Core Capabilities
- **Realistic Trading Simulation**: Simulates actual trading conditions including slippage, fees, and execution latency
- **Multiple Market Scenarios**: Test strategies against trending, sideways, and volatile market conditions
- **Comprehensive Metrics**: 25+ performance indicators including Sharpe ratio, Sortino ratio, VaR, and drawdown analysis
- **Strategy Integration**: Seamlessly works with existing ScalpingStrategy and RiskManager
- **Professional Reporting**: Generate reports in JSON, HTML, CSV, and text formats
- **Parameter Optimization**: Automated parameter sweeping to find optimal strategy settings

### Key Components

#### 1. BacktestingEngine (`src/services/backtestingService.ts`)
The core engine that simulates trading operations:
```typescript
const config: BacktestConfig = {
  symbol: 'BTCUSDT',
  startDate: Date.now() - 7 * 24 * 60 * 60 * 1000,
  endDate: Date.now(),
  initialBalance: 10000,
  timeframe: '5m',
  commissionRate: 0.001,
  slippageRate: 0.0005,
  latencyMs: 50,
  enableRiskManagement: true
};

const engine = new BacktestingEngine(config);
const report = await engine.runBacktest(historicalData);
```

#### 2. HistoricalDataGenerator (`src/utils/historicalDataGenerator.ts`)
Generates realistic market data for testing:
```typescript
// Generate trending market scenario
const dataConfig = HistoricalDataGenerator.generateScenarioData('trending_up');
const generator = new HistoricalDataGenerator(dataConfig);
const data = generator.generateData();
```

#### 3. BacktestReportGenerator (`src/utils/backtestReportGenerator.ts`)
Creates comprehensive performance reports:
```typescript
const reportConfig = {
  outputDir: './reports',
  filePrefix: 'strategy_backtest',
  format: { json: true, html: true, csv: true, text: true },
  includeTrades: true,
  includeCharts: false
};

const generator = new BacktestReportGenerator(reportConfig);
await generator.generateReport(report);
```

## 📊 Performance Metrics

The framework calculates comprehensive performance metrics:

### Return Metrics
- Total Return (absolute and percentage)
- Annualized Return
- Monthly Return Breakdown

### Risk Metrics
- Maximum Drawdown
- Sharpe Ratio
- Sortino Ratio
- Calmar Ratio
- Value at Risk (VaR 95% & 99%)
- Volatility

### Trading Metrics
- Win Rate
- Profit Factor
- Average Win/Loss
- Average Trade Duration
- Consecutive Wins/Losses
- Expectancy
- System Quality Number

## 🎯 Market Scenarios

Test your strategy against different market conditions:

| Scenario | Description | Trend | Volatility |
|----------|-------------|-------|------------|
| `trending_up` | Bullish market | +0.2% daily | 1.5% daily |
| `trending_down` | Bearish market | -0.15% daily | 2.0% daily |
| `sideways` | Range-bound market | 0% daily | 0.8% daily |
| `volatile` | High volatility | +0.05% daily | 4.0% daily |

## 🚀 Usage

### Quick Start

1. **Basic Backtest**
   ```bash
   npm run backtest:basic
   ```

2. **Advanced Multi-Scenario Analysis**
   ```bash
   npm run backtest:advanced
   ```

3. **Parameter Optimization**
   ```bash
   npm run backtest:optimize
   ```

4. **Complete Testing Suite**
   ```bash
   npm run backtest:all
   ```

### Custom Backtests

Create your own backtest script:
```typescript
import { BacktestingEngine, BacktestConfig } from './src/services/backtestingService';
import { HistoricalDataGenerator } from './src/utils/historicalDataGenerator';

async function customBacktest() {
  const config: BacktestConfig = {
    symbol: 'ETHUSDT',
    startDate: Date.now() - 30 * 24 * 60 * 60 * 1000, // 30 days
    endDate: Date.now(),
    initialBalance: 5000,
    timeframe: '1m',
    commissionRate: 0.001,
    slippageRate: 0.0005,
    latencyMs: 100,
    enableRiskManagement: true
  };

  // Generate or load historical data
  const dataConfig = HistoricalDataGenerator.generateScenarioData('volatile');
  dataConfig.symbol = config.symbol;
  dataConfig.startDate = config.startDate;
  dataConfig.endDate = config.endDate;
  
  const generator = new HistoricalDataGenerator(dataConfig);
  const data = generator.generateData();

  // Run backtest
  const engine = new BacktestingEngine(config);
  const report = await engine.runBacktest(data);

  // Display results
  console.log(`Total Return: ${report.metrics.totalReturnPercent.toFixed(2)}%`);
  console.log(`Win Rate: ${report.metrics.winRate.toFixed(1)}%`);
  console.log(`Sharpe Ratio: ${report.metrics.sharpeRatio.toFixed(2)}`);
}
```

## 📋 Reports

### Generated Report Files

Each backtest generates multiple report formats:

1. **JSON Report** (`*_timestamp.json`)
   - Complete data including all metrics and trade details
   - Machine-readable for further analysis

2. **HTML Report** (`*_timestamp.html`)
   - Interactive dashboard with metrics and charts
   - Professional presentation format

3. **CSV Report** (`*_trades_timestamp.csv`)
   - Detailed trade-by-trade data
   - Perfect for spreadsheet analysis

4. **Text Report** (`*_timestamp.txt`)
   - Human-readable summary
   - Quick performance overview

### Sample Report Structure

```
===========================================
     BACKTESTING PERFORMANCE REPORT
===========================================

STRATEGY CONFIGURATION
---------------------
Symbol:              BTCUSDT
Timeframe:           5m
Period:              2024-01-01 to 2024-01-07
Initial Balance:     $10,000

PERFORMANCE SUMMARY
------------------
Final Balance:       $10,247.50
Total Return:        $247.50
Total Return %:      2.48%
Max Drawdown:        1.23%

TRADING STATISTICS
-----------------
Total Trades:        23
Winning Trades:      15
Losing Trades:       8
Win Rate:            65.22%
Profit Factor:       1.45
Sharpe Ratio:        1.82
```

## 🔧 Configuration

### Backtest Configuration

```typescript
interface BacktestConfig {
  symbol: string;                // Trading pair (e.g., 'BTCUSDT')
  startDate: number;            // Start timestamp
  endDate: number;              // End timestamp  
  initialBalance: number;       // Starting capital
  timeframe: '1m'|'5m'|'15m'|'1h'; // Candle timeframe
  commissionRate: number;       // Trading fees (0.001 = 0.1%)
  slippageRate: number;         // Market impact (0.0005 = 0.05%)
  latencyMs: number;            // Execution delay
  enableRiskManagement: boolean; // Use RiskManager
}
```

### Report Configuration

```typescript
interface ReportConfig {
  outputDir: string;            // Output directory
  filePrefix: string;           // File name prefix
  format: {                     // Report formats
    json: boolean;
    text: boolean;
    csv: boolean;
    html: boolean;
  };
  includeTrades: boolean;       // Include trade details
  includeCharts: boolean;       // Include chart placeholders
}
```

## 🧪 Advanced Features

### Parameter Optimization

The framework includes automated parameter optimization:

```typescript
// Define parameters to optimize
const optimizationParams = [
  {
    name: 'commissionRate',
    values: [0.0005, 0.001, 0.0015, 0.002]
  },
  {
    name: 'slippageRate', 
    values: [0.0002, 0.0005, 0.001, 0.0015]
  }
];

// Run optimization
const results = await runOptimization(optimizationParams);
```

### Stress Testing

Test strategy robustness under extreme conditions:

```typescript
const stressScenarios = [
  { name: 'High Commission', config: { commissionRate: 0.005 } },
  { name: 'High Latency', config: { latencyMs: 500 } },
  { name: 'Extreme Volatility', config: { slippageRate: 0.002 } }
];
```

### Market Event Simulation

Add realistic market events to data:

```typescript
const events = [
  { timestamp: startTime + 3600000, type: 'pump', magnitude: 0.02 },
  { timestamp: startTime + 7200000, type: 'dump', magnitude: 0.03 }
];

const dataWithEvents = generator.addMarketEvents(data, events);
```

## 📁 File Structure

```
crypto-trading-bot/
├── src/
│   ├── services/
│   │   └── backtestingService.ts       # Core backtesting engine
│   └── utils/
│       ├── historicalDataGenerator.ts  # Market data generation
│       └── backtestReportGenerator.ts  # Report generation
├── scripts/
│   ├── backtest.ts                     # Main runner script
│   ├── basic-backtest.ts               # Basic backtest example
│   ├── advanced-backtest.ts            # Multi-scenario testing
│   ├── optimization-backtest.ts        # Parameter optimization
│   └── test-backtest.ts               # Framework validation
└── reports/                            # Generated reports
    ├── basic/
    ├── advanced/
    └── optimization/
```

## 🎯 Best Practices

### 1. Data Quality
- Use sufficient historical data (minimum 50 candles)
- Test across different market conditions
- Include realistic market events

### 2. Parameter Selection
- Start with conservative commission rates (0.1-0.2%)
- Include realistic slippage (0.05-0.1%)
- Test with various latency scenarios

### 3. Performance Analysis
- Focus on risk-adjusted returns (Sharpe ratio)
- Monitor maximum drawdown levels
- Analyze trade frequency and duration

### 4. Validation
- Test on out-of-sample data
- Use walk-forward optimization
- Validate across multiple time periods

## 🚨 Important Notes

1. **Risk Management**: The existing RiskManager has compilation issues that need to be resolved before using `enableRiskManagement: true`

2. **Data Sources**: Currently uses generated data. For production use, integrate real historical data sources

3. **Strategy Integration**: Framework is designed for the existing ScalpingStrategy but can be extended for other strategies

4. **Performance**: Large datasets may require optimization for better performance

## 🤝 Contributing

To extend the framework:

1. Add new performance metrics in `calculateMetrics()`
2. Create new market scenarios in `generateScenarioData()`
3. Extend report formats in `BacktestReportGenerator`
4. Add new optimization parameters in optimization scripts

## 📞 Support

For questions or issues:
1. Check the generated reports for detailed analysis
2. Review the console output for debugging information  
3. Examine log files in the `logs/` directory
4. Test with simplified configurations first

---

**Happy Backtesting!** 🚀📈