/**
 * Trading Bot API Type Definitions
 * Interfaces for real-time trading data communication via Socket.IO
 */

// ============================================================================
// Portfolio & Account Types
// ============================================================================

export interface Portfolio {
  id: string
  accountId: string
  totalBalance: number
  availableBalance: number
  equity: number
  investedBalance: number
  pnl: number
  pnlPercent: number
  updatedAt: string
}

export interface Position {
  id: string
  symbol: string
  quantity: number
  entryPrice: number
  currentPrice: number
  pnl: number
  pnlPercent: number
  unrealizedValue: number
  createdAt: string
  updatedAt: string
}

// ============================================================================
// Trade & Execution Types
// ============================================================================

export enum OrderSide {
  BUY = 'buy',
  SELL = 'sell',
}

export enum OrderType {
  MARKET = 'market',
  LIMIT = 'limit',
  STOP = 'stop',
  STOP_LIMIT = 'stop_limit',
}

export enum OrderStatus {
  PENDING = 'pending',
  OPEN = 'open',
  PARTIALLY_FILLED = 'partially_filled',
  FILLED = 'filled',
  CANCELED = 'canceled',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
}

export interface Order {
  id: string
  symbol: string
  side: OrderSide
  type: OrderType
  quantity: number
  price?: number
  stopPrice?: number
  limitPrice?: number
  filledQuantity: number
  filledPrice?: number
  status: OrderStatus
  commission: number
  createdAt: string
  updatedAt: string
  canceledAt?: string
}

export interface Trade {
  id: string
  orderId: string
  symbol: string
  side: OrderSide
  quantity: number
  price: number
  executionPrice?: number // Alias for price
  commission: number
  pnl?: number
  pnlPercent?: number
  profit?: number // Alias for pnl
  profitPercent?: number // Alias for pnlPercent
  executedAt: string
  notes?: string
}

export interface TradeHistory {
  trades: Trade[]
  totalCount: number
  pageSize: number
  currentPage: number
}

// ============================================================================
// Market Data Types
// ============================================================================

export interface Ticker {
  symbol: string
  lastPrice: number
  bid: number
  ask: number
  high24h: number
  low24h: number
  volume24h: number
  priceChange24h: number
  priceChangePercent24h: number
  timestamp: string
}

export interface OHLCV {
  open: number
  high: number
  low: number
  close: number
  volume: number
  time: number
}

export interface MarketData {
  symbol: string
  lastPrice?: number
  bid?: number
  ask?: number
  interval?: string // '1m', '5m', '15m', '1h', '4h', '1d'
  candles?: OHLCV[]
  timestamp: string
}

// ============================================================================
// System Status & Alerts
// ============================================================================

export enum SystemStatusEnum {
  RUNNING = 'running',
  PAUSED = 'paused',
  ERROR = 'error',
  OFFLINE = 'offline',
}

export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export interface SystemAlert {
  id: string
  level: AlertLevel
  title: string
  message: string
  category?: string
  code?: string
  timestamp: string
  read: boolean
}

export interface SystemStatus {
  status: SystemStatusEnum
  uptime: number
  lastUpdate: string
  apiConnected: boolean
  databaseConnected: boolean
  diskUsage: number
  memoryUsage: number
  cpuUsage: number
}

// ============================================================================
// Socket.IO Event Types
// ============================================================================

export interface SocketEvents {
  // Connection events
  connect: void
  disconnect: void

  // Portfolio updates
  'portfolio:updated': Portfolio
  'position:opened': Position
  'position:updated': Position
  'position:closed': Position

  // Trade execution
  'order:created': Order
  'order:updated': Order
  'order:filled': Trade
  'trade:executed': Trade

  // Market data (real-time)
  'ticker:update': Ticker
  'market:data': MarketData

  // System
  'system:status': SystemStatus
  'system:alert': SystemAlert
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: unknown
  }
  timestamp: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}
