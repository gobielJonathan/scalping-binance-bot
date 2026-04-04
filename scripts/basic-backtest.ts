#!/usr/bin/env ts-node

/**
 * Basic backtesting example script
 * Runs a simple backtest with generated data
 */

import { BacktestingEngine, BacktestConfig } from '../src/services/backtestingService';
import { HistoricalDataGenerator } from '../src/utils/historicalDataGenerator';
import { BacktestReportGenerator } from '../src/utils/backtestReportGenerator';
import logger from '../src/services/logger';

async function runBasicBacktest() {
  console.log('🚀 Starting basic backtesting example...\n');

  try {
    // Configuration for backtest
    const backtestConfig: BacktestConfig = {
      symbol: 'BTCUSDT',
      startDate: Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
      endDate: Date.now(),
      initialBalance: 10000,
      timeframe: '5m',
      commissionRate: 0.001, // 0.1%
      slippageRate: 0.0005, // 0.05%
      latencyMs: 0, // No latency for basic test
      enableRiskManagement: true
    };

    console.log('📊 Generating historical data...');
    
    // Generate test data with trending market conditions
    const dataConfig = HistoricalDataGenerator.generateScenarioData('trending_up');
    dataConfig.startDate = backtestConfig.startDate;
    dataConfig.endDate = backtestConfig.endDate;
    dataConfig.timeframe = backtestConfig.timeframe;
    
    const dataGenerator = new HistoricalDataGenerator(dataConfig);
    const historicalData = dataGenerator.generateData();
    
    console.log(`✅ Generated ${historicalData.length} candles`);

    // Initialize backtesting engine
    console.log('🔧 Initializing backtesting engine...');
    const backtestEngine = new BacktestingEngine(backtestConfig);

    // Run backtest
    console.log('⚡ Running backtest...');
    const startTime = Date.now();
    
    const report = await backtestEngine.runBacktest(historicalData);
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    // Display quick summary
    console.log('\n' + BacktestReportGenerator.generateQuickSummary(report));
    console.log(`\n⏱️  Backtest completed in ${duration.toFixed(2)}s`);

    // Generate detailed reports
    console.log('\n📋 Generating detailed reports...');
    
    const reportConfig = {
      outputDir: './reports',
      filePrefix: 'basic_backtest',
      format: {
        json: true,
        text: true,
        csv: true,
        html: true
      },
      includeTrades: true,
      includeCharts: false
    };

    const reportGenerator = new BacktestReportGenerator(reportConfig);
    const generatedFiles = await reportGenerator.generateReport(report);

    console.log('\n✅ Reports generated:');
    generatedFiles.forEach(file => console.log(`   📄 ${file}`));

    // Display key insights
    console.log('\n📈 Key Insights:');
    console.log(`   • Total trades executed: ${report.metrics.totalTrades}`);
    console.log(`   • Win rate: ${report.metrics.winRate.toFixed(1)}%`);
    console.log(`   • Total return: ${report.metrics.totalReturnPercent.toFixed(2)}%`);
    console.log(`   • Maximum drawdown: ${report.metrics.maxDrawdownPercent.toFixed(2)}%`);
    console.log(`   • Sharpe ratio: ${report.metrics.sharpeRatio.toFixed(2)}`);
    console.log(`   • Profit factor: ${report.metrics.profitFactor.toFixed(2)}`);

    if (report.metrics.totalReturnPercent > 0) {
      console.log('\n🎉 Successful backtest! Strategy shows positive returns.');
    } else {
      console.log('\n⚠️  Strategy shows losses. Consider optimization.');
    }

  } catch (error) {
    console.error('\n❌ Backtest failed:', error);
    logger.error('Backtest execution failed', {
      source: 'BasicBacktestScript',
      error: { stack: (error as Error).stack }
    });
    process.exit(1);
  }
}

// Run the backtest if this script is executed directly
if (require.main === module) {
  runBasicBacktest()
    .then(() => {
      console.log('\n🏁 Backtest script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

export { runBasicBacktest };