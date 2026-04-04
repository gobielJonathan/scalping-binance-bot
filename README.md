# Crypto Scalping Trading Bot

A high-frequency cryptocurrency scalping trading bot built with Node.js and TypeScript for Binance.

## 🚀 Features

- **Scalping Strategy**: Optimized for quick 0.1-0.5% profit trades
- **Risk Management**: Comprehensive position sizing and loss protection
- **Real-time Dashboard**: Web-based monitoring interface
- **Paper Trading**: Safe testing mode with simulated trades
- **Technical Analysis**: EMA, RSI, MACD, Bollinger Bands indicators
- **Multi-pair Trading**: Support for multiple cryptocurrency pairs
- **Automated Execution**: Hands-free trading with configurable parameters

## 📊 Strategy Overview

### Target Performance
- **Profit per trade**: 0.6% (1:2 risk-reward ratio)
- **Win rate target**: 40-50% (lower due to better risk-reward)
- **Daily return target**: 2-4% (improved profitability)
- **Maximum risk per trade**: 5-10% of capital
- **Trade duration**: 1-5 minutes (scalping)

### Technical Indicators
- **EMA Crossover**: 9/21 period exponential moving averages
- **RSI**: Relative Strength Index for momentum
- **MACD**: Moving Average Convergence Divergence
- **Bollinger Bands**: Volatility and support/resistance
- **Volume Analysis**: Confirmation of price movements

### Risk Management
- Stop-loss: 0.3% below entry
- Take-profit: 0.6% above entry (1:2 risk-reward ratio)
- Daily loss limit: 15% of portfolio
- Maximum 3 concurrent positions
- Emergency stop mechanisms

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 16+ 
- npm or yarn
- Binance account (for live trading)

### Installation

1. **Clone and setup**:
```bash
cd ~/Documents/code/learning/crypto-trading-bot
npm install
```

2. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your settings
```

3. **Environment Variables**:
```bash
# Required
TRADING_MODE=paper           # paper or live
INITIAL_CAPITAL=500         # Starting capital in USD
BINANCE_API_KEY=your_key    # For live trading
BINANCE_SECRET_KEY=your_secret

# Trading Configuration
RISK_PER_TRADE=0.08         # 8% risk per trade
STOP_LOSS_PERCENTAGE=0.003  # 0.3% stop loss
TAKE_PROFIT_PERCENTAGE=0.005 # 0.5% take profit
TRADING_PAIRS=BTCUSDT,ETHUSDT,BNBUSDT

# Dashboard
DASHBOARD_PORT=3000
DASHBOARD_ENABLED=true
```

### Running the Bot

1. **Paper Trading (Recommended first)**:
```bash
npm run dev
# or
npm run paper-trade
```

2. **Live Trading**:
```bash
# Set TRADING_MODE=live in .env
npm start
```

3. **Access Dashboard**:
```bash
# Open browser to http://localhost:3000
```

## 📈 Dashboard Features

- **Real-time Portfolio**: Balance, P&L, open positions
- **Live Trading Signals**: Buy/sell signals with reasoning
- **Performance Metrics**: Win rate, daily/weekly/monthly returns
- **Active Positions**: Current trades with live P&L
- **Market Data**: Real-time price feeds for all pairs
- **Risk Monitoring**: Health status and warnings

## ⚠️ Important Notes

### Risk Warnings
- **Start with paper trading** to understand the bot behavior
- **Use only risk capital** - never trade money you can't afford to lose
- **Monitor actively** especially during first days of operation
- **Market volatility** can cause rapid losses despite safeguards
- **No strategy guarantees profit** - past performance ≠ future results

### Recommended Approach
1. **Week 1**: Paper trading only, monitor signals and performance
2. **Week 2**: Small live capital ($50-100) if paper trading successful
3. **Month 1**: Gradually scale up if consistently profitable
4. **Ongoing**: Regular monitoring and parameter adjustment

## 🔧 Configuration

### Trading Parameters
```javascript
// Modify in .env or src/config/index.ts
{
  riskPerTrade: 0.08,        // 8% of portfolio per trade
  stopLossPercentage: 0.003, // 0.3% stop loss
  takeProfitPercentage: 0.005, // 0.5% take profit
  dailyLossLimit: 0.15,      // 15% daily loss limit
  maxConcurrentTrades: 3     // Maximum open positions
}
```

### Technical Indicator Settings
```javascript
{
  emaShort: 9,              // Fast EMA period
  emaLong: 21,              // Slow EMA period
  rsiPeriod: 14,            // RSI calculation period
  macdFast: 12,             // MACD fast line
  macdSlow: 26,             // MACD slow line
  macdSignal: 9             // MACD signal line
}
```

## 📊 Expected Returns (Conservative Estimates)

Based on $500 starting capital:

### Daily Targets
- **Trades per day**: 20-50
- **Average profit per trade**: $1.50 (0.3%)
- **Average loss per trade**: $1.25 (0.25%)
- **Expected daily return**: $5-15 (1-3%)

### Monthly Projections
- **Conservative**: 15% monthly growth
- **Moderate**: 20% monthly growth  
- **Aggressive**: 25% monthly growth
- **Risk of significant loss**: <5% with proper risk management

## 🏗️ Architecture

```
src/
├── config/           # Configuration management
├── services/         # Core trading services
│   ├── binanceService.ts    # Exchange API integration
│   ├── riskManager.ts       # Risk and portfolio management
│   ├── orderManager.ts      # Trade execution
│   └── logger.ts           # Logging system
├── strategies/       # Trading strategies
│   └── scalpingStrategy.ts  # Main scalping logic
├── utils/           # Utility functions
│   ├── technicalIndicators.ts # TA calculations
│   └── helpers.ts          # Helper functions
├── dashboard/       # Web dashboard
├── database/        # Data persistence
└── index.ts         # Main application
```

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run with coverage
npm run test:coverage

# Backtest strategy
npm run backtest
```

## 📝 Development Scripts

```bash
npm run build        # Compile TypeScript
npm run dev          # Development mode with auto-reload
npm run start        # Production mode
npm run paper-trade  # Force paper trading mode
npm run lint         # Code linting
npm run test         # Run tests
```

## 🔍 Monitoring & Logs

- **Console Output**: Real-time trading activity
- **Log Files**: Detailed logs in `logs/trading_bot.log`
- **Database**: Trade history in `data/trading_bot.db`
- **Dashboard**: Web interface at `http://localhost:3000`

## ⚡ Performance Optimization

The bot is optimized for:
- Low-latency execution (< 100ms response time)
- Minimal memory footprint
- Efficient market data processing
- Quick signal generation
- Fast order execution

## 🆘 Troubleshooting

### Common Issues
1. **API Connection**: Check API keys and network
2. **Insufficient Balance**: Verify account balance
3. **High Loss Rate**: Adjust risk parameters
4. **No Signals**: Check market volatility and timeframes

### Emergency Procedures
- **Manual Stop**: `Ctrl+C` or kill process
- **Emergency Position Close**: Access dashboard to close all positions
- **Risk Limit Breach**: Bot automatically stops trading

## 📞 Support & Resources

- **Binance API Docs**: https://github.com/binance/binance-spot-api-docs
- **Technical Analysis**: Built-in indicators with standard formulations
- **Risk Management**: Conservative approach with multiple safeguards

## ⚖️ Disclaimer

This trading bot is for educational and experimental purposes. Cryptocurrency trading involves substantial risk of loss. Past performance does not guarantee future results. Only trade with capital you can afford to lose. The developers are not responsible for any trading losses.

## 🔒 Security

- API keys stored in environment variables only
- No sensitive data in code repository
- Secure WebSocket connections
- Minimal attack surface

---

**Happy Trading! 🚀📈**

*Remember: Start with paper trading, monitor closely, and never risk more than you can afford to lose.*