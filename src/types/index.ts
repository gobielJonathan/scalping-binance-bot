// Core data types and interfaces for the trading bot

export interface TradingPair {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  minQty: number;
  maxQty: number;
  stepSize: number;
  tickSize: number;
}

export interface Candle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  quoteVolume: number;
  trades: number;
  baseAssetVolume: number;
  quoteAssetVolume: number;
}

export interface TechnicalIndicators {
  ema9: number;
  ema21: number;
  rsi: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  volume: number;
  priceChange: number;
  priceChangePercent: number;
  // Enhanced indicators
  volatility?: number;
  stochastic?: number;
  adx?: number;
  atr?: number;
  obv?: number;
  vwap?: number;
  williams?: number;
  cci?: number;
}

export interface SignalComponent {
  name: string;
  value: number;
  weight: number;
  contribution: number;
  triggered: boolean;
}

export interface MarketRegime {
  type: 'trending_up' | 'trending_down' | 'sideways' | 'volatile';
  strength: number;
  duration: number; // minutes
  confidence: number;
}

export interface SignalMetadata {
  id: string;
  strategyId: string;
  marketRegime: MarketRegime;
  signalComponents: SignalComponent[];
  volumeProfile: 'high' | 'normal' | 'low';
  spread: number;
  liquidityScore: number;
  timeDecayFactor: number;
  lastUpdate: number;
  expiresAt: number;
}

export interface TradingSignal {
  type: 'BUY' | 'SELL' | 'HOLD';
  strength: number; // 0-100
  confidence: number; // 0-100
  reason: string;
  timestamp: number;
  indicators: TechnicalIndicators;
  // Enhanced signal properties
  metadata?: SignalMetadata;
  riskAdjustedStrength?: number;
  expectedMovePercent?: number;
  probabilityOfSuccess?: number;
  timeHorizon?: number; // expected duration in minutes
  stopLoss?: number;
  takeProfit?: number;
  maxRisk?: number;
}

export interface SignalHistory {
  signalId: string;
  signal: TradingSignal;
  outcome: 'win' | 'loss' | 'neutral' | 'pending';
  actualMove?: number;
  timeToResolve?: number;
  maxFavorableMove?: number;
  maxAdverseMove?: number;
  accuracy: number;
  createdAt: number;
  resolvedAt?: number;
}

export interface StrategyPerformance {
  strategyId: string;
  name: string;
  totalSignals: number;
  successfulSignals: number;
  failedSignals: number;
  pendingSignals: number;
  successRate: number;
  avgReturn: number;
  avgTimeToResolve: number;
  avgAccuracy: number;
  sharpeRatio: number;
  maxDrawdown: number;
  profitFactor: number;
  lastUpdated: number;
  recentPerformance: {
    signals1h: number;
    success1h: number;
    signals1d: number;
    success1d: number;
    signals7d: number;
    success7d: number;
  };
}

export interface SignalAggregation {
  finalSignal: TradingSignal;
  sourceSignals: TradingSignal[];
  conflictingSignals: TradingSignal[];
  weightedScores: { [strategyId: string]: number };
  aggregationMethod: 'weighted_average' | 'consensus' | 'best_performer' | 'ensemble';
  consensusLevel: number; // 0-1
  riskScore: number;
  qualityScore: number;
}

export interface SignalFilters {
  minStrength?: number;
  minConfidence?: number;
  maxAge?: number; // milliseconds
  requiredIndicators?: string[];
  marketRegimeFilter?: MarketRegime['type'][];
  volumeFilter?: 'high' | 'normal' | 'low';
  maxSpread?: number;
  minLiquidity?: number;
}

export interface TradePosition {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  pnl: number;
  pnlPercent: number;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  openTime: number;
  closeTime?: number;
  fees: number;
}

export interface OrderRequest {
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';
  quantity: number;
  price?: number;
  stopPrice?: number;
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
}

export interface Portfolio {
  totalBalance: number;
  availableBalance: number;
  lockedBalance: number;
  totalPnl: number;
  totalPnlPercent: number;
  dailyPnl: number;
  dailyPnlPercent: number;
  openPositions: TradePosition[];
  riskExposure: number;
  maxDrawdown: number;
}

export interface RiskManagement {
  maxRiskPerTrade: number;
  maxConcurrentTrades: number;
  dailyLossLimit: number;
  maxDrawdownLimit: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  emergencyStopEnabled: boolean;
}

export interface TradingConfig {
  mode: 'paper' | 'live';
  pairs: string[];
  timeframes: string[];
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
  risk: RiskManagement;
}

export interface MarketData {
  symbol: string;
  price: number;
  volume24h: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  bid: number;
  ask: number;
  spread: number;
  timestamp: number;
}

export interface BacktestResult {
  startDate: number;
  endDate: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalReturn: number;
  totalReturnPercent: number;
  maxDrawdown: number;
  maxDrawdownPercent: number;
  sharpeRatio: number;
  sortinioRatio: number;
  calmarRatio: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  avgTradeDuration: number;
  trades: TradePosition[];
  equity: Array<{ timestamp: number; balance: number; drawdown: number }>;
  systemQuality: number;
  expectancy: number;
  consecutiveWins: number;
  consecutiveLosses: number;
}

export interface DashboardData {
  portfolio: Portfolio;
  activePositions: TradePosition[];
  recentSignals: TradingSignal[];
  marketData: MarketData[];
  performance: {
    dailyPnl: number;
    weeklyPnl: number;
    monthlyPnl: number;
    totalTrades: number;
    winRate: number;
  };
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  message: string;
  data?: any;
  source?: string;
}

export interface LogContext {
  tradeId?: string;
  symbol?: string;
  orderId?: string;
  userId?: string;
  strategyId?: string;
  sessionId?: string;
  [key: string]: any; // Allow additional properties
}

export interface PerformanceMetrics {
  timestamp: number;
  cpuUsage: number;
  memoryUsage: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external: number;
  };
  uptime: number;
  eventLoopLag: number;
  gcStats?: {
    totalGCTime: number;
    totalGCCount: number;
  };
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  uptime: number;
  version: string;
  services: {
    database: 'connected' | 'disconnected' | 'error';
    binanceApi: 'connected' | 'disconnected' | 'error';
    websocket: 'connected' | 'disconnected' | 'error';
    dashboard: 'active' | 'inactive' | 'error';
  };
  metrics: PerformanceMetrics;
  errors: Array<{
    timestamp: number;
    message: string;
    stack?: string;
    source: string;
  }>;
}

export interface AlertConfig {
  enabled: boolean;
  thresholds: {
    cpuUsage: number;
    memoryUsage: number;
    errorRate: number;
    apiLatency: number;
  };
  channels: {
    console: boolean;
    file: boolean;
    telegram?: boolean;
    email?: boolean;
  };
}

export interface TradeLogEntry {
  tradeId: string;
  timestamp: number;
  symbol: string;
  action: 'ORDER_PLACED' | 'ORDER_FILLED' | 'ORDER_CANCELLED' | 'POSITION_OPENED' | 'POSITION_CLOSED';
  details: {
    side: 'BUY' | 'SELL';
    quantity: number;
    price?: number;
    orderId?: string;
    pnl?: number;
    fees?: number;
    reason?: string;
  };
  metadata: {
    strategyId: string;
    signalStrength?: number;
    marketConditions?: any;
    riskMetrics?: any;
  };
}

// Database specific types
export interface DatabaseTrade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';
  quantity: number;
  entryPrice: number;
  exitPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  pnl?: number;
  pnlPercent?: number;
  fees: number;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
  openTime: number;
  closeTime?: number;
  strategyId: string;
  signalId?: string;
  mode: 'paper' | 'live';
  orderId?: string;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DatabasePortfolioSnapshot {
  id: string;
  timestamp: number;
  totalBalance: number;
  availableBalance: number;
  lockedBalance: number;
  totalPnl: number;
  totalPnlPercent: number;
  dailyPnl: number;
  dailyPnlPercent: number;
  openPositionsCount: number;
  riskExposure: number;
  maxDrawdown: number;
  mode: 'paper' | 'live';
  date: string; // YYYY-MM-DD format
  createdAt: number;
}

export interface DatabaseSignal {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL' | 'HOLD';
  strength: number;
  confidence: number;
  reason: string;
  timestamp: number;
  indicators: string; // JSON string of TechnicalIndicators
  processed: boolean;
  tradeId?: string;
  strategyId: string;
  mode: 'paper' | 'live';
  createdAt: number;
}

export interface DatabasePerformanceMetrics {
  id: string;
  timestamp: number;
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalReturn: number;
  totalReturnPercent: number;
  maxDrawdown: number;
  avgWin: number;
  avgLoss: number;
  profitFactor: number;
  sharpeRatio?: number;
  sortinioRatio?: number;
  calmarRatio?: number;
  volatility: number;
  bestTrade: number;
  worstTrade: number;
  avgTradeReturn: number;
  mode: 'paper' | 'live';
  createdAt: number;
}

export interface DatabaseConfig {
  id: string;
  configType: 'trading' | 'indicators' | 'risk' | 'general';
  configData: string; // JSON string of the config
  version: string;
  description?: string;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DatabaseQuery {
  sql: string;
  params?: any[];
}

export interface DatabaseTransactionCallback<T> {
  (): Promise<T>;
}

export interface DatabaseExportOptions {
  format: 'json' | 'csv' | 'sql';
  tables?: string[];
  dateRange?: {
    start: number;
    end: number;
  };
  includeConfig?: boolean;
}

// Emergency Stop System Types
export interface EmergencyStopCondition {
  id: string;
  name: string;
  type: 'LOSS_LIMIT' | 'API_FAILURE' | 'MARKET_ANOMALY' | 'SYSTEM_ERROR' | 'MANUAL';
  threshold?: number;
  enabled: boolean;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  checkInterval: number; // in milliseconds
}

export interface EmergencyStopTrigger {
  id: string;
  conditionId: string;
  timestamp: number;
  value: number;
  reason: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  acknowledgeBy?: number; // timestamp when manual acknowledgment is required
  metadata?: any;
}

export interface EmergencyStopState {
  isActive: boolean;
  activatedAt?: number;
  triggeredBy?: EmergencyStopTrigger[];
  lastCheck: number;
  positionsClosedCount: number;
  totalLossAtStop: number;
  recoveryProcedureStatus: 'NONE' | 'INITIATED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  manualOverrideBy?: string; // user ID or system
}

export interface EmergencyNotification {
  id: string;
  type: 'EMAIL' | 'SMS' | 'WEBHOOK' | 'TELEGRAM' | 'SLACK';
  recipient: string;
  subject: string;
  message: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: number;
  deliveryStatus: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED';
  retryCount: number;
}

// Execution Optimization Types
export interface OrderExecutionMetrics {
  orderId: string;
  symbol: string;
  requestedPrice: number;
  executedPrice: number;
  slippage: number;
  slippagePercent: number;
  executionTime: number; // milliseconds
  fees: number;
  marketImpact: number;
  timestamp: number;
  orderType: 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'TAKE_PROFIT';
  size: number;
}

export interface MarketDepth {
  symbol: string;
  bids: Array<{ price: number; quantity: number }>;
  asks: Array<{ price: number; quantity: number }>;
  timestamp: number;
}

export interface ExecutionOptimizationConfig {
  maxSlippagePercent: number;
  maxOrderSizePercent: number; // percent of daily volume
  orderSplitThreshold: number; // split orders larger than this
  timingOptimization: boolean;
  smartRouting: boolean;
  marketImpactMinimization: boolean;
  feeOptimization: boolean;
  latencyThreshold: number; // max acceptable latency in ms
}

export interface SmartRoutingDecision {
  symbol: string;
  orderSize: number;
  recommendedExchange: string;
  recommendedOrderType: 'MARKET' | 'LIMIT';
  estimatedSlippage: number;
  estimatedFees: number;
  estimatedExecutionTime: number;
  confidence: number; // 0-100
  reasoning: string;
  timestamp: number;
}

// Manual Override System Types
export interface ManualOverrideCommand {
  id: string;
  type: 'EMERGENCY_STOP' | 'RESUME_TRADING' | 'CLOSE_POSITION' | 'ADJUST_RISK' | 'PAUSE_STRATEGY';
  parameters: any;
  requestedBy: string;
  requestedAt: number;
  approvedBy?: string;
  approvedAt?: number;
  executedAt?: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'FAILED';
  reason: string;
  requiresApproval: boolean;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface StrategyParameter {
  key: string;
  currentValue: any;
  newValue?: any;
  type: 'number' | 'boolean' | 'string' | 'array' | 'object';
  min?: number;
  max?: number;
  description: string;
  category: 'RISK' | 'INDICATORS' | 'EXECUTION' | 'GENERAL';
}

export interface SystemHealthMetrics {
  timestamp: number;
  apiLatency: number;
  memoryUsage: number;
  cpuUsage: number;
  activeConnections: number;
  orderExecutionRate: number; // orders per minute
  errorRate: number; // errors per minute
  systemUptime: number;
  lastHealthCheck: number;
}

export interface RiskThreshold {
  metric: 'DAILY_LOSS' | 'DRAWDOWN' | 'EXPOSURE' | 'POSITION_COUNT' | 'VOLATILITY';
  currentValue: number;
  threshold: number;
  warningLevel: number; // percentage of threshold that triggers warning
  action: 'ALERT' | 'REDUCE_EXPOSURE' | 'STOP_NEW_TRADES' | 'EMERGENCY_STOP';
  enabled: boolean;
}