import { DatabaseService, DatabaseUtils } from '../database';
import config from '../config';

/**
 * Example usage of the DatabaseService for the crypto trading bot
 */
async function databaseExamples() {
  const dbService = new DatabaseService();
  const dbUtils = new DatabaseUtils(dbService);

  try {
    // Initialize the database
    console.log('Initializing database...');
    await dbService.initializeDatabase();
    console.log('Database initialized successfully!');

    // Example 1: Save a trading signal
    console.log('\n1. Saving a trading signal...');
    const signalId = await dbService.saveSignal({
      symbol: 'BTCUSDT',
      type: 'BUY',
      strength: 85,
      confidence: 78,
      reason: 'Strong upward momentum with RSI oversold',
      timestamp: Date.now(),
      indicators: JSON.stringify({
        ema9: 45000,
        ema21: 44500,
        rsi: 65,
        macd: 150,
        macdSignal: 120,
        macdHistogram: 30,
        bollingerUpper: 46000,
        bollingerMiddle: 45000,
        bollingerLower: 44000,
        volume: 1500000,
        priceChange: 500,
        priceChangePercent: 1.12
      }),
      processed: false,
      strategyId: 'ema_rsi_strategy',
      mode: config.trading.mode as 'paper' | 'live'
    });
    console.log(`Signal saved with ID: ${signalId}`);

    // Example 2: Save a trade
    console.log('\n2. Saving a trade...');
    const tradeId = await dbService.saveTrade({
      symbol: 'BTCUSDT',
      side: 'BUY',
      type: 'MARKET',
      quantity: 0.001,
      entryPrice: 45000,
      stopLoss: 44100,
      takeProfit: 45900,
      fees: 0.45,
      status: 'OPEN',
      openTime: Date.now(),
      strategyId: 'ema_rsi_strategy',
      signalId: signalId,
      mode: config.trading.mode as 'paper' | 'live',
      marginMode: 'isolated_margin',
      leverage: config.trading.leverage,
      liquidationPrice: 0,
      borrowedAmount: 0
    });

    // Example 3: Update the trade (simulate closing)
    console.log('\n3. Updating trade (closing position)...');
    await dbService.updateTrade(tradeId, {
      exitPrice: 45800,
      pnl: 0.8, // $0.80 profit
      pnlPercent: 1.78,
      status: 'CLOSED',
      closeTime: Date.now()
    });
    console.log('Trade updated successfully');

    // Example 4: Mark signal as processed
    console.log('\n4. Marking signal as processed...');
    await dbService.markSignalProcessed(signalId, tradeId);
    console.log('Signal marked as processed');

    // Example 5: Save portfolio snapshot
    console.log('\n5. Saving portfolio snapshot...');
    const portfolioId = await dbService.updatePortfolio({
      timestamp: Date.now(),
      totalBalance: 1000.80,
      availableBalance: 999.80,
      lockedBalance: 1.00,
      totalPnl: 0.80,
      totalPnlPercent: 0.08,
      dailyPnl: 0.80,
      dailyPnlPercent: 0.08,
      openPositionsCount: 0,
      riskExposure: 0,
      maxDrawdown: 0,
      mode: config.trading.mode as 'paper' | 'live',
      date: new Date().toISOString().split('T')[0]
    });
    console.log(`Portfolio snapshot saved with ID: ${portfolioId}`);

    // Example 6: Calculate and save performance metrics
    console.log('\n6. Calculating performance metrics...');
    const performanceMetrics = await dbUtils.calculatePerformanceMetrics(
      config.trading.mode as 'paper' | 'live',
      'daily'
    );
    const performanceId = await dbService.savePerformanceMetrics(performanceMetrics);
    console.log(`Performance metrics saved with ID: ${performanceId}`);
    console.log('Performance Summary:', {
      totalTrades: performanceMetrics.totalTrades,
      winRate: `${performanceMetrics.winRate.toFixed(2)}%`,
      totalReturn: `$${performanceMetrics.totalReturn.toFixed(2)}`,
      profitFactor: performanceMetrics.profitFactor.toFixed(2)
    });

    // Example 7: Save configuration snapshot
    console.log('\n7. Saving configuration snapshot...');
    const configId = await dbService.saveConfig({
      configType: 'trading',
      configData: JSON.stringify(config.trading),
      version: '1.0.0',
      description: 'Initial trading configuration',
      isActive: true
    });
    console.log(`Configuration saved with ID: ${configId}`);

    // Example 8: Query data
    console.log('\n8. Querying recent data...');
    
    // Get trade history
    const trades = await dbService.getTradeHistory({
      mode: config.trading.mode as 'paper' | 'live',
      limit: 10
    });
    console.log(`Found ${trades.length} trades`);

    // Get unprocessed signals
    const unprocessedSignals = await dbService.getUnprocessedSignals(
      config.trading.mode as 'paper' | 'live'
    );
    console.log(`Found ${unprocessedSignals.length} unprocessed signals`);

    // Get portfolio history
    const portfolioHistory = await dbService.getPortfolioHistory(
      config.trading.mode as 'paper' | 'live',
      7 // Last 7 days
    );
    console.log(`Found ${portfolioHistory.length} portfolio snapshots`);

    // Example 9: Database statistics
    console.log('\n9. Database statistics...');
    const stats = await dbService.getDatabaseStats();
    console.log('Database Stats:');
    stats.tables.forEach(table => {
      console.log(`  ${table.name}: ${table.count} records (${table.size})`);
    });
    console.log(`Total size: ${stats.totalSize} bytes`);
    console.log(`Vacuum needed: ${stats.vacuumNeeded}`);

    // Example 10: Check database health
    console.log('\n10. Database health check...');
    const health = await dbUtils.checkDatabaseHealth();
    console.log('Database Health:', health.status);

    // Example 11: Export data
    console.log('\n11. Exporting data...');
    const exportPath = await dbService.exportData({
      format: 'json',
      tables: ['trades', 'signals'],
      includeConfig: true
    });
    console.log(`Data exported to: ${exportPath}`);

    // Example 12: Backup database
    console.log('\n12. Creating backup...');
    const backupPath = await dbService.backupDatabase();
    console.log(`Database backed up to: ${backupPath}`);

    // Example 13: Transaction example
    console.log('\n13. Transaction example...');
    await dbService.transaction(async () => {
      const signal1Id = await dbService.saveSignal({
        symbol: 'ETHUSDT',
        type: 'SELL',
        strength: 75,
        confidence: 80,
        reason: 'Resistance level reached',
        timestamp: Date.now(),
        indicators: JSON.stringify({
          ema9: 3200,
          ema21: 3250,
          rsi: 75,
          macd: -50,
          macdSignal: -30,
          macdHistogram: -20,
          bollingerUpper: 3300,
          bollingerMiddle: 3200,
          bollingerLower: 3100,
          volume: 2000000,
          priceChange: -50,
          priceChangePercent: -1.54
        }),
        processed: false,
        strategyId: 'resistance_strategy',
        mode: config.trading.mode as 'paper' | 'live'
      });

      const trade1Id = await dbService.saveTrade({
        symbol: 'ETHUSDT',
        side: 'SELL',
        type: 'MARKET',
        quantity: 0.1,
        entryPrice: 3200,
        stopLoss: 3250,
        takeProfit: 3150,
        fees: 0.32,
        status: 'OPEN',
        openTime: Date.now(),
        strategyId: 'resistance_strategy',
        signalId: signal1Id,
        mode: config.trading.mode as 'paper' | 'live',
        marginMode: 'isolated_margin',
        leverage: config.trading.leverage,
        liquidationPrice: 0,
        borrowedAmount: 0
      });

      console.log(`Transaction completed: Signal ${signal1Id}, Trade ${trade1Id}`);
    });

    console.log('\n✅ All database examples completed successfully!');

  } catch (error) {
    console.error('❌ Database example failed:', error);
  } finally {
    // Close the database connection
    await dbService.close();
    console.log('Database connection closed');
  }
}

// Helper function to demonstrate paper trading scenario
async function paperTradingScenario() {
  console.log('\n=== Paper Trading Scenario ===');
  
  const dbService = new DatabaseService();
  const dbUtils = new DatabaseUtils(dbService);

  try {
    await dbService.initializeDatabase();

    // Simulate a day of paper trading
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
    const strategies = ['ema_crossover', 'rsi_divergence', 'bollinger_bounce'];

    for (let i = 0; i < 10; i++) {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const strategy = strategies[Math.floor(Math.random() * strategies.length)];
      
      // Generate random signal
      const signalId = await dbService.saveSignal({
        symbol,
        type: Math.random() > 0.5 ? 'BUY' : 'SELL',
        strength: Math.floor(Math.random() * 40) + 60, // 60-100
        confidence: Math.floor(Math.random() * 30) + 70, // 70-100
        reason: `Strategy ${strategy} triggered`,
        timestamp: Date.now() - (Math.random() * 86400000), // Random time in last 24h
        indicators: JSON.stringify({
          ema9: 45000 + Math.random() * 1000,
          ema21: 44500 + Math.random() * 1000,
          rsi: Math.random() * 100,
          macd: Math.random() * 200 - 100,
          macdSignal: Math.random() * 200 - 100,
          macdHistogram: Math.random() * 100 - 50,
          bollingerUpper: 46000,
          bollingerMiddle: 45000,
          bollingerLower: 44000,
          volume: Math.random() * 2000000,
          priceChange: Math.random() * 1000 - 500,
          priceChangePercent: Math.random() * 4 - 2
        }),
        processed: true,
        strategyId: strategy,
        mode: 'paper'
      });

      // Generate corresponding trade
      const entryPrice = 45000 + Math.random() * 1000;
      const pnlPercent = (Math.random() * 6) - 3; // -3% to +3%
      const pnl = entryPrice * 0.001 * (pnlPercent / 100); // For 0.001 BTC

      const tradeId = await dbService.saveTrade({
        symbol,
        side: Math.random() > 0.5 ? 'BUY' : 'SELL',
        type: 'MARKET',
        quantity: 0.001,
        entryPrice,
        exitPrice: entryPrice * (1 + pnlPercent / 100),
        pnl,
        pnlPercent,
        fees: entryPrice * 0.001 * 0.001, // 0.1% fee
        status: 'CLOSED',
        openTime: Date.now() - (Math.random() * 86400000),
        closeTime: Date.now() - (Math.random() * 43200000), // Random close within 12h
        strategyId: strategy,
        signalId,
        mode: 'paper',
        marginMode: 'isolated_margin',
        leverage: config.trading.leverage,
        liquidationPrice: 0,
        borrowedAmount: 0
      });

      console.log(`Generated trade ${i + 1}: ${symbol} ${pnlPercent.toFixed(2)}% PnL`);
    }

    // Calculate performance for the paper trading session
    const performance = await dbUtils.calculatePerformanceMetrics('paper', 'daily');
    console.log('\n📊 Paper Trading Performance:');
    console.log(`Total Trades: ${performance.totalTrades}`);
    console.log(`Win Rate: ${performance.winRate.toFixed(2)}%`);
    console.log(`Total Return: $${performance.totalReturn.toFixed(2)}`);
    console.log(`Best Trade: $${performance.bestTrade.toFixed(2)}`);
    console.log(`Worst Trade: $${performance.worstTrade.toFixed(2)}`);
    console.log(`Profit Factor: ${performance.profitFactor.toFixed(2)}`);

    await dbService.savePerformanceMetrics(performance);

  } catch (error) {
    console.error('Paper trading scenario failed:', error);
  } finally {
    await dbService.close();
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  databaseExamples()
    .then(() => paperTradingScenario())
    .catch(console.error);
}

export { databaseExamples, paperTradingScenario };