/**
 * Integration Example: How to use BinanceService with the Trading Bot
 * 
 * This example demonstrates how the BinanceService integrates with
 * the broader crypto trading bot architecture.
 */

import { BinanceService } from '../services/binanceService';
import { logger } from '../services/logger';
import config from '../config/index';
import { OrderRequest, MarketData, Candle } from '../types/index';

class TradingBotIntegration {
  private binanceService: BinanceService;
  private isRunning = false;

  constructor() {
    this.binanceService = new BinanceService();
  }

  async initialize(): Promise<void> {
    logger.info('Initializing Trading Bot with Binance Service', {
      source: 'TradingBot',
      context: { 
        mode: config.trading.mode,
        testnet: config.binance.testnet,
        pairs: config.trading.pairs
      }
    });

    // Test connection
    const connected = await this.binanceService.testConnection();
    if (!connected && config.trading.mode === 'live') {
      throw new Error('Cannot connect to Binance API in live mode');
    }

    // Get account info for live trading
    if (config.trading.mode === 'live') {
      const accountInfo = await this.binanceService.getAccountInfo();
      logger.info('Account connected', {
        source: 'TradingBot',
        context: {
          canTrade: accountInfo.canTrade,
          accountType: accountInfo.accountType,
          permissions: accountInfo.permissions
        }
      });
    }

    // Set up real-time price monitoring
    await this.setupPriceMonitoring();
    
    this.isRunning = true;
    logger.info('Trading Bot initialized successfully', { source: 'TradingBot' });
  }

  private async setupPriceMonitoring(): Promise<void> {
    // Monitor prices for configured trading pairs
    await this.binanceService.startPriceStream(
      config.trading.pairs,
      this.handlePriceUpdate.bind(this)
    );

    // Monitor klines for each pair
    for (const pair of config.trading.pairs) {
      await this.binanceService.startKlineStream(
        pair,
        '1m', // 1-minute candles for real-time analysis
        (candle) => this.handleKlineUpdate(pair, candle)
      );
    }

    logger.info('Price monitoring started', {
      source: 'TradingBot',
      context: { pairs: config.trading.pairs }
    });
  }

  private handlePriceUpdate(marketData: MarketData): void {
    // This would integrate with your technical analysis
    logger.debug('Price update received', {
      source: 'TradingBot',
      context: {
        symbol: marketData.symbol,
        price: marketData.price,
        change: marketData.priceChangePercent24h
      }
    });

    // Example: Check for significant price movements
    if (Math.abs(marketData.priceChangePercent24h) > 5) {
      logger.warn('Significant price movement detected', {
        source: 'TradingBot',
        context: {
          symbol: marketData.symbol,
          priceChange: marketData.priceChangePercent24h
        }
      });
    }
  }

  private handleKlineUpdate(symbol: string, candle: Candle): void {
    // This would feed into your strategy analysis
    logger.debug('Kline update received', {
      source: 'TradingBot',
      context: {
        symbol,
        open: candle.open,
        close: candle.close,
        volume: candle.volume
      }
    });

    // Example: Simple volume analysis
    if (candle.volume > 1000) { // Adjust threshold as needed
      logger.info('High volume candle detected', {
        source: 'TradingBot',
        context: { symbol, volume: candle.volume }
      });
    }
  }

  async placeTradeOrder(orderRequest: OrderRequest): Promise<any> {
    try {
      logger.info('Attempting to place trade order', {
        source: 'TradingBot',
        context: orderRequest
      });

      // In a full implementation, this would include:
      // 1. Risk management checks
      // 2. Portfolio validation
      // 3. Strategy confirmation

      const result = await this.binanceService.placeOrder(orderRequest);

      logger.info('Trade order placed successfully', {
        source: 'TradingBot',
        context: {
          orderId: result.orderId,
          symbol: orderRequest.symbol,
          side: orderRequest.side,
          status: result.status
        }
      });

      return result;

    } catch (error) {
      logger.error('Failed to place trade order', {
        source: 'TradingBot',
        error: { stack: error instanceof Error ? error.stack : String(error) },
        context: orderRequest
      });
      throw error;
    }
  }

  async getPortfolioBalance(): Promise<any> {
    try {
      // Get all non-zero balances
      const balances = await this.binanceService.getBalance();
      
      const portfolio = balances.reduce((acc, balance) => {
        if (balance.total > 0) {
          acc[balance.asset] = balance;
        }
        return acc;
      }, {} as any);

      logger.info('Portfolio balance retrieved', {
        source: 'TradingBot',
        context: {
          assets: Object.keys(portfolio).length,
          mode: config.trading.mode
        }
      });

      return portfolio;

    } catch (error) {
      logger.error('Failed to get portfolio balance', {
        source: 'TradingBot',
        error: { stack: error instanceof Error ? error.stack : String(error) }
      });
      throw error;
    }
  }

  async stop(): Promise<void> {
    logger.info('Stopping Trading Bot', { source: 'TradingBot' });
    
    this.isRunning = false;
    
    // Stop all WebSocket streams
    this.binanceService.stopWebSocketStream();
    
    // Disconnect from Binance
    await this.binanceService.disconnect();
    
    logger.info('Trading Bot stopped', { source: 'TradingBot' });
  }

  get status(): { running: boolean; mode: string; pairs: string[] } {
    return {
      running: this.isRunning,
      mode: config.trading.mode,
      pairs: config.trading.pairs
    };
  }
}

// Example usage function
async function demonstrateIntegration(): Promise<void> {
  const bot = new TradingBotIntegration();

  try {
    // Initialize the bot
    await bot.initialize();

    // Check portfolio (in paper mode, this will be simulated)
    const portfolio = await bot.getPortfolioBalance();
    console.log('Current portfolio:', portfolio);

    // Place a sample trade (paper mode)
    if (config.trading.mode === 'paper') {
      const sampleOrder: OrderRequest = {
        symbol: 'BTCUSDT',
        side: 'BUY',
        type: 'MARKET',
        quantity: 0.001
      };
      await bot.placeTradeOrder(sampleOrder);
    }

    // Run for 10 seconds to see price updates
    console.log('Running for 10 seconds to monitor prices...');
    await new Promise(resolve => setTimeout(resolve, 10000));

  } catch (error) {
    logger.error('Integration demo failed', {
      source: 'Demo',
      error: { stack: error instanceof Error ? error.stack : String(error) }
    });
  } finally {
    await bot.stop();
  }
}

export { TradingBotIntegration, demonstrateIntegration };
