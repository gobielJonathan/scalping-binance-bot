/**
 * Test data factories for generating mock data
 */

export interface MockPortfolio {
  balance: number
  pnl: number
  pnlPercentage: number
  drawdown: number
  winRate: number
  totalTrades: number
  timestamp: string
}

export interface MockPosition {
  id: string
  symbol: string
  side: 'long' | 'short'
  size: number
  entryPrice: number
  markPrice: number
  pnl: number
  pnlPercentage: number
  timestamp: string
}

export interface MockTrade {
  id: string
  symbol: string
  side: 'buy' | 'sell'
  size: number
  price: number
  timestamp: string
  status: 'filled' | 'pending' | 'cancelled'
}

export interface MockMarketData {
  symbol: string
  price: number
  change24h: number
  volume: number
  high24h: number
  low24h: number
  timestamp: string
}

export class TestDataFactory {
  static createPortfolio(overrides: Partial<MockPortfolio> = {}): MockPortfolio {
    return {
      balance: 10000,
      pnl: 150.50,
      pnlPercentage: 1.51,
      drawdown: -2.3,
      winRate: 65.4,
      totalTrades: 47,
      timestamp: new Date().toISOString(),
      ...overrides
    }
  }

  static createPosition(overrides: Partial<MockPosition> = {}): MockPosition {
    return {
      id: `pos_${Math.random().toString(36).substr(2, 9)}`,
      symbol: 'BTCUSDT',
      side: 'long',
      size: 0.1,
      entryPrice: 45000,
      markPrice: 45250,
      pnl: 25,
      pnlPercentage: 0.56,
      timestamp: new Date().toISOString(),
      ...overrides
    }
  }

  static createTrade(overrides: Partial<MockTrade> = {}): MockTrade {
    return {
      id: `trade_${Math.random().toString(36).substr(2, 9)}`,
      symbol: 'BTCUSDT',
      side: 'buy',
      size: 0.05,
      price: 45123.45,
      timestamp: new Date().toISOString(),
      status: 'filled',
      ...overrides
    }
  }

  static createMarketData(overrides: Partial<MockMarketData> = {}): MockMarketData {
    return {
      symbol: 'BTCUSDT',
      price: 45000,
      change24h: 2.45,
      volume: 1234567,
      high24h: 46000,
      low24h: 44000,
      timestamp: new Date().toISOString(),
      ...overrides
    }
  }

  static createMultiplePositions(count: number = 5): MockPosition[] {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'DOGEUSDT', 'SOLUSDT']
    const sides: ('long' | 'short')[] = ['long', 'short']
    
    return Array.from({ length: count }, (_, i) => {
      return this.createPosition({
        symbol: symbols[i % symbols.length],
        side: sides[i % sides.length],
        entryPrice: 45000 + (Math.random() - 0.5) * 1000,
        size: Math.random() * 0.5 + 0.01,
        pnl: (Math.random() - 0.5) * 100,
        pnlPercentage: (Math.random() - 0.5) * 5
      })
    })
  }

  static createMultipleTrades(count: number = 10): MockTrade[] {
    const symbols = ['BTCUSDT', 'ETHUSDT', 'ADAUSDT', 'DOGEUSDT', 'SOLUSDT']
    const sides: ('buy' | 'sell')[] = ['buy', 'sell']
    const statuses: ('filled' | 'pending' | 'cancelled')[] = ['filled', 'pending', 'cancelled']
    
    return Array.from({ length: count }, (_, i) => {
      return this.createTrade({
        symbol: symbols[i % symbols.length],
        side: sides[i % sides.length],
        status: statuses[i % statuses.length],
        price: 45000 + (Math.random() - 0.5) * 1000,
        size: Math.random() * 0.5 + 0.01,
        timestamp: new Date(Date.now() - i * 60000).toISOString()
      })
    })
  }

  static createChartData(points: number = 100): Array<{time: string, value: number}> {
    const now = Date.now()
    return Array.from({ length: points }, (_, i) => ({
      time: new Date(now - (points - i) * 60000).toISOString(),
      value: 10000 + (Math.random() - 0.5) * 1000
    }))
  }

  static createWebSocketMessage(type: string, data: any) {
    return {
      type,
      data,
      timestamp: new Date().toISOString()
    }
  }

  static createApiError(code: string = 'UNKNOWN_ERROR', message: string = 'Test error') {
    return {
      error: {
        code,
        message,
        timestamp: new Date().toISOString()
      }
    }
  }
}