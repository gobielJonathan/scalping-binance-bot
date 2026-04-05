/**
 * Utility functions for the trading bot
 */

import { quoteAssets } from "../constants/assets";

/**
 * Format numbers for display
 */
export function formatNumber(num: number, decimals: number = 2): string {
  return num.toFixed(decimals);
}

/**
 * Format percentage for display
 */
export function formatPercentage(num: number, decimals: number = 2): string {
  return `${(num * 100).toFixed(decimals)}%`;
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number, currency: string = 'USDT', decimals: number = 2): string {
  return `${amount.toFixed(decimals)} ${currency}`;
}

/**
 * Calculate position size based on risk management
 */
export function calculatePositionSize(
  accountBalance: number,
  riskPercentage: number,
  stopLossDistance: number
): number {
  const riskAmount = accountBalance * riskPercentage;
  return riskAmount / stopLossDistance;
}

/**
 * Calculate stop loss price
 */
export function calculateStopLoss(entryPrice: number, stopLossPercent: number, side: 'BUY' | 'SELL'): number {
  if (side === 'BUY') {
    return entryPrice * (1 - stopLossPercent);
  } else {
    return entryPrice * (1 + stopLossPercent);
  }
}

/**
 * Calculate take profit price
 */
export function calculateTakeProfit(entryPrice: number, takeProfitPercent: number, side: 'BUY' | 'SELL'): number {
  if (side === 'BUY') {
    return entryPrice * (1 + takeProfitPercent);
  } else {
    return entryPrice * (1 - takeProfitPercent);
  }
}

/**
 * Calculate profit/loss for a position
 */
export function calculatePnL(
  entryPrice: number,
  currentPrice: number,
  quantity: number,
  side: 'BUY' | 'SELL',
  fees: number = 0
): { pnl: number; pnlPercent: number } {
  let pnl: number;
  
  if (side === 'BUY') {
    pnl = (currentPrice - entryPrice) * quantity - fees;
  } else {
    pnl = (entryPrice - currentPrice) * quantity - fees;
  }
  
  const pnlPercent = (pnl / (entryPrice * quantity)) * 100;
  
  return { pnl, pnlPercent };
}

/**
 * Round to step size for Binance order quantities
 */
export function roundToStepSize(quantity: number, stepSize: number): number {
  return Math.floor(quantity / stepSize) * stepSize;
}

/**
 * Round to tick size for Binance order prices
 */
export function roundToTickSize(price: number, tickSize: number): number {
  return Math.round(price / tickSize) * tickSize;
}

/**
 * Validate if a number is a valid price
 */
export function isValidPrice(price: number): boolean {
  return !isNaN(price) && isFinite(price) && price > 0;
}

/**
 * Validate if a number is a valid quantity
 */
export function isValidQuantity(quantity: number): boolean {
  return !isNaN(quantity) && isFinite(quantity) && quantity > 0;
}

/**
 * Sleep function for delays
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = baseDelay * Math.pow(2, i);
      await sleep(delay);
    }
  }
  
  throw new Error('Max retries exceeded');
}

/**
 * Calculate Sharpe ratio
 */
export function calculateSharpeRatio(returns: number[], riskFreeRate: number = 0): number {
  if (returns.length === 0) return 0;
  
  const avgReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
  const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / returns.length;
  const standardDev = Math.sqrt(variance);
  
  if (standardDev === 0) return 0;
  
  return (avgReturn - riskFreeRate) / standardDev;
}

/**
 * Calculate maximum drawdown
 */
export function calculateMaxDrawdown(values: number[]): number {
  if (values.length === 0) return 0;
  
  let maxDrawdown = 0;
  let peak = values[0];
  
  for (const value of values) {
    if (value > peak) {
      peak = value;
    } else {
      const drawdown = (peak - value) / peak;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
  }
  
  return maxDrawdown;
}

/**
 * Generate unique trade ID
 */
export function generateTradeId(): string {
  return `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if market is open (24/7 for crypto, but useful for maintenance windows)
 */
export function isMarketOpen(): boolean {
  // Crypto markets are always open, but you could add maintenance windows here
  return true;
}

/**
 * Format timestamp to readable date
 */
export function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

/**
 * Calculate time since timestamp
 */
export function timeSince(timestamp: number): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `${diffDays}d ago`;
  if (diffHours > 0) return `${diffHours}h ago`;
  if (diffMinutes > 0) return `${diffMinutes}m ago`;
  return `${diffSeconds}s ago`;
}

/**
 * Parse trading pair symbol
 */
export function parseTradingPair(symbol: string): { base: string; quote: string } {
  // Common quote currencies
  for (const quote of quoteAssets) {
    if (symbol.endsWith(quote)) {
      return {
        base: symbol.slice(0, -quote.length),
        quote: quote
      };
    }
  }
  
  throw new Error(`Unable to parse trading pair: ${symbol}`);
}

/**
 * Validate trading configuration
 */
export function validateTradingConfig(config: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!config.riskPerTrade || config.riskPerTrade <= 0 || config.riskPerTrade > 1) {
    errors.push('Risk per trade must be between 0 and 1');
  }
  
  if (!config.stopLossPercentage || config.stopLossPercentage <= 0) {
    errors.push('Stop loss percentage must be greater than 0');
  }
  
  if (!config.takeProfitPercentage || config.takeProfitPercentage <= 0) {
    errors.push('Take profit percentage must be greater than 0');
  }
  
  if (!config.pairs || !Array.isArray(config.pairs) || config.pairs.length === 0) {
    errors.push('Must specify at least one trading pair');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}