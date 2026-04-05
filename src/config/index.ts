import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface Config {
  binance: {
    apiKey: string;
    secretKey: string;
    testnet: boolean;
  };
  trading: {
    mode: 'paper' | 'live';
    tradingAccount: 'spot' | 'isolated_margin';
    leverage: number;
    marginMaintenanceRate: number;
    initialCapital: number;
    riskPerTrade: number;
    stopLossPercentage: number;
    takeProfitPercentage: number;
    dailyLossLimit: number;
    maxConcurrentTrades: number;
    pairs: string[];
    pairSelectionMode: 'static' | 'dynamic';
    topVolatilityPairs: number;
    minVolume24hUsdt: number;
    volatilityRefreshInterval: number;
  };
  indicators: {
    emaShort: number;
    emaLong: number;
    rsiPeriod: number;
    macdFast: number;
    macdSlow: number;
    macdSignal: number;
    bollingerPeriod: number;
    bollingerDeviation: number;
  };
  database: {
    path: string;
  };
  logging: {
    level: string;
    file: string;
    directory: string;
    maxSize: string;
    maxFiles: number;
    json: boolean;
    console: boolean;
  };
  monitoring: {
    enabled: boolean;
    metricsInterval: number;
    healthCheckInterval: number;
    alertThresholds: {
      cpuUsage: number;
      memoryUsage: number;
      errorRate: number;
      apiLatency: number;
    };
  };
  dashboard: {
    port: number;
    enabled: boolean;
  };
  notifications: {
    telegramBotToken?: string;
    telegramChatId?: string;
    emailEnabled: boolean;
  };
}

const config: Config = {
  binance: {
    apiKey: process.env.BINANCE_API_KEY || '',
    secretKey: process.env.BINANCE_SECRET_KEY || '',
    testnet: process.env.BINANCE_TESTNET === 'true',
  },
  trading: {
    mode: (process.env.TRADING_MODE as 'paper' | 'live') || 'paper',
    tradingAccount: (() => {
      const acct = process.env.TRADING_ACCOUNT;
      if (acct === 'isolated_margin') return 'isolated_margin' as const;
      return 'spot' as const;
    })(),
    leverage: Math.max(1, parseInt(process.env.LEVERAGE || '3')),
    marginMaintenanceRate: parseFloat(process.env.MARGIN_MAINTENANCE_RATE || '0.05'),
    initialCapital: parseFloat(process.env.INITIAL_CAPITAL || '500'),
    riskPerTrade: parseFloat(process.env.RISK_PER_TRADE || '0.08'),
    stopLossPercentage: parseFloat(process.env.STOP_LOSS_PERCENTAGE || '0.003'), // 0.3% for 1:2 risk-reward ratio
    takeProfitPercentage: parseFloat(process.env.TAKE_PROFIT_PERCENTAGE || '0.006'), // 0.6% for 1:2 risk-reward ratio
    dailyLossLimit: parseFloat(process.env.DAILY_LOSS_LIMIT || '0.15'),
    maxConcurrentTrades: parseInt(process.env.MAX_CONCURRENT_TRADES || '3'),
    pairs: (process.env.TRADING_PAIRS || 'BTCUSDT,ETHUSDT,BNBUSDT').split(','),
    pairSelectionMode: (() => {
      const mode = process.env.PAIR_SELECTION_MODE;
      if (mode === 'dynamic' || mode === 'static') return mode;
      if (mode !== undefined) {
        console.warn(`Warning: PAIR_SELECTION_MODE="${mode}" is not valid — defaulting to "static"`);
      }
      return 'static';
    })(),
    topVolatilityPairs: parseInt(process.env.TOP_VOLATILITY_PAIRS || '5'),
    minVolume24hUsdt: parseFloat(process.env.MIN_VOLUME_24H_USDT || '10000000'),
    volatilityRefreshInterval: parseInt(process.env.VOLATILITY_REFRESH_INTERVAL || '3600000'),
  },
  indicators: {
    emaShort: parseInt(process.env.EMA_SHORT || '9'),
    emaLong: parseInt(process.env.EMA_LONG || '21'),
    rsiPeriod: parseInt(process.env.RSI_PERIOD || '14'),
    macdFast: parseInt(process.env.MACD_FAST || '12'),
    macdSlow: parseInt(process.env.MACD_SLOW || '26'),
    macdSignal: parseInt(process.env.MACD_SIGNAL || '9'),
    bollingerPeriod: parseInt(process.env.BOLLINGER_PERIOD || '20'),
    bollingerDeviation: parseFloat(process.env.BOLLINGER_DEVIATION || '2'),
  },
  database: {
    path: process.env.DATABASE_PATH || './data/trading_bot.db',
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || './logs/trading_bot.log',
    directory: process.env.LOG_DIRECTORY || './logs',
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: parseInt(process.env.LOG_MAX_FILES || '14'),
    json: process.env.LOG_JSON === 'true',
    console: process.env.LOG_CONSOLE !== 'false',
  },
  monitoring: {
    enabled: process.env.MONITORING_ENABLED !== 'false',
    metricsInterval: parseInt(process.env.METRICS_INTERVAL || '30000'),
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL || '60000'),
    alertThresholds: {
      cpuUsage: parseFloat(process.env.CPU_ALERT_THRESHOLD || '80'),
      memoryUsage: parseFloat(process.env.MEMORY_ALERT_THRESHOLD || '85'),
      errorRate: parseFloat(process.env.ERROR_RATE_THRESHOLD || '5'),
      apiLatency: parseInt(process.env.API_LATENCY_THRESHOLD || '5000'),
    },
  },
  dashboard: {
    port: parseInt(process.env.DASHBOARD_PORT || '3000'),
    enabled: process.env.DASHBOARD_ENABLED === 'true',
  },
  notifications: {
    ...(process.env.TELEGRAM_BOT_TOKEN && { telegramBotToken: process.env.TELEGRAM_BOT_TOKEN }),
    ...(process.env.TELEGRAM_CHAT_ID && { telegramChatId: process.env.TELEGRAM_CHAT_ID }),
    emailEnabled: process.env.EMAIL_NOTIFICATIONS === 'true',
  },
};

// Validation
if (config.trading.mode === 'live') {
  if (!config.binance.apiKey || !config.binance.secretKey) {
    throw new Error('Binance API credentials are required for live trading');
  }
}

if (config.trading.riskPerTrade > 0.2) {
  console.warn('Warning: Risk per trade is set to more than 20%');
}

if (config.trading.maxConcurrentTrades > 5) {
  console.warn('Warning: More than 5 concurrent trades may increase risk');
}

export default config;