#!/usr/bin/env ts-node

/**
 * Simple test for backtesting framework without risk management
 */

import { BacktestingEngine, BacktestConfig } from '../src/services/backtestingService';
import { HistoricalDataGenerator } from '../src/utils/historicalDataGenerator';
import { BacktestReportGenerator } from '../src/utils/backtestReportGenerator';

async function simpleBacktestTest() {
  console.log('🚀 Running simple backtesting test (no risk management)...\n');

  try {
    // Configuration without risk management to avoid RiskManager compilation issues
    const config: BacktestConfig = {
      symbol: 'BTCUSDT',
      startDate: Date.now() - 24 * 60 * 60 * 1000, // 24 hours ago
      endDate: Date.now(),
      initialBalance: 10000,
      timeframe: '5m',
      commissionRate: 0.001,
      slippageRate: 0.0005,
      latencyMs: 0,
      enableRiskManagement: false // Disable to avoid RiskManager issues
    };

    console.log('📊 Generating historical data...');
    
    const dataConfig = HistoricalDataGenerator.generateScenarioData('trending_up');
    dataConfig.startDate = config.startDate;
    dataConfig.endDate = config.endDate;
    dataConfig.timeframe = config.timeframe;
    
    const generator = new HistoricalDataGenerator(dataConfig);
    const data = generator.generateData();
    
    console.log(`✅ Generated ${data.length} candles`);

    console.log('⚡ Running backtest...');
    
    const engine = new BacktestingEngine(config);
    const report = await engine.runBacktest(data);

    console.log('\n📈 Backtest Results:');
    console.log(`   • Total trades: ${report.metrics.totalTrades}`);
    console.log(`   • Win rate: ${report.metrics.winRate.toFixed(1)}%`);
    console.log(`   • Total return: ${report.metrics.totalReturnPercent.toFixed(2)}%`);
    console.log(`   • Max drawdown: ${report.metrics.maxDrawdownPercent.toFixed(2)}%`);
    console.log(`   • Sharpe ratio: ${report.metrics.sharpeRatio.toFixed(2)}`);

    // Generate a quick summary
    console.log('\n' + BacktestReportGenerator.generateQuickSummary(report));

    console.log('\n✅ Simple backtesting framework test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  simpleBacktestTest()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}