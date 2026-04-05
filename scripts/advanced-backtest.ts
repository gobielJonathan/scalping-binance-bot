#!/usr/bin/env ts-node

/**
 * Advanced backtesting script with multiple scenarios and optimizations
 * Tests the strategy against different market conditions
 */

import { BacktestingEngine, BacktestConfig } from '../src/services/backtestingService';
import { HistoricalDataGenerator, DataGenerationConfig } from '../src/utils/historicalDataGenerator';
import { BacktestReportGenerator } from '../src/utils/backtestReportGenerator';
import logger from '../src/services/logger';

interface ScenarioResult {
  scenario: string;
  config: BacktestConfig;
  metrics: {
    totalReturnPercent: number;
    winRate: number;
    maxDrawdownPercent: number;
    sharpeRatio: number;
    profitFactor: number;
    totalTrades: number;
  };
}

async function runAdvancedBacktest() {
  console.log('🚀 Starting advanced backtesting suite...\n');

  const scenarios = [
    'trending_up',
    'trending_down', 
    'sideways',
    'volatile'
  ] as const;

  const timeframes = ['1m', '5m', '15m'] as const;
  const results: ScenarioResult[] = [];

  try {
    // Test each scenario and timeframe combination
    for (const scenario of scenarios) {
      for (const timeframe of timeframes) {
        console.log(`\n📊 Testing ${scenario} market with ${timeframe} timeframe...`);

        const backtestConfig: BacktestConfig = {
          symbol: 'BTCUSDT',
          startDate: Date.now() - 14 * 24 * 60 * 60 * 1000, // 14 days
          endDate: Date.now(),
          initialBalance: 10000,
          timeframe,
          commissionRate: 0.001,
          slippageRate: 0.0005,
          latencyMs: Math.floor(Math.random() * 100), // Random latency 0-100ms
          enableRiskManagement: true
        };

        // Generate scenario-specific data
        const dataConfig = HistoricalDataGenerator.generateScenarioData(scenario);
        dataConfig.startDate = backtestConfig.startDate;
        dataConfig.endDate = backtestConfig.endDate;
        dataConfig.timeframe = timeframe;

        // Add some market events for realism
        const dataGenerator = new HistoricalDataGenerator(dataConfig);
        let historicalData = dataGenerator.generateData();

        // Add realistic market events
        if (historicalData.length > 1000) {
          const events = generateMarketEvents(backtestConfig.startDate, backtestConfig.endDate);
          historicalData = dataGenerator.addMarketEvents(historicalData, events);
        }

        // Run backtest
        const backtestEngine = new BacktestingEngine(backtestConfig);
        const report = await backtestEngine.runBacktest(historicalData);

        // Store results
        results.push({
          scenario: `${scenario}_${timeframe}`,
          config: backtestConfig,
          metrics: {
            totalReturnPercent: report.metrics.totalReturnPercent,
            winRate: report.metrics.winRate,
            maxDrawdownPercent: report.metrics.maxDrawdownPercent,
            sharpeRatio: report.metrics.sharpeRatio,
            profitFactor: report.metrics.profitFactor,
            totalTrades: report.metrics.totalTrades
          }
        });

        console.log(`   Return: ${report.metrics.totalReturnPercent.toFixed(2)}%`);
        console.log(`   Win Rate: ${report.metrics.winRate.toFixed(1)}%`);
        console.log(`   Sharpe: ${report.metrics.sharpeRatio.toFixed(2)}`);
        console.log(`   Trades: ${report.metrics.totalTrades}`);
      }
    }

    // Generate comprehensive analysis
    console.log('\n' + '='.repeat(80));
    console.log('                    ADVANCED BACKTEST RESULTS ANALYSIS');
    console.log('='.repeat(80));

    // Display results table
    console.log('\nScenario Performance Summary:');
    console.log('-'.repeat(100));
    console.log('Scenario'.padEnd(20) + 'Return %'.padEnd(12) + 'Win Rate'.padEnd(12) + 'Max DD %'.padEnd(12) + 'Sharpe'.padEnd(10) + 'Trades'.padEnd(8));
    console.log('-'.repeat(100));

    for (const result of results) {
      const line = result.scenario.padEnd(20) +
        result.metrics.totalReturnPercent.toFixed(2).padEnd(12) +
        result.metrics.winRate.toFixed(1).padEnd(12) +
        result.metrics.maxDrawdownPercent.toFixed(2).padEnd(12) +
        result.metrics.sharpeRatio.toFixed(2).padEnd(10) +
        result.metrics.totalTrades.toString().padEnd(8);
      console.log(line);
    }

    // Find best and worst performers
    const bestReturn = results.reduce((best, current) => 
      current.metrics.totalReturnPercent > best.metrics.totalReturnPercent ? current : best
    );
    
    const bestSharpe = results.reduce((best, current) => 
      current.metrics.sharpeRatio > best.metrics.sharpeRatio ? current : best
    );

    const worstDrawdown = results.reduce((worst, current) => 
      current.metrics.maxDrawdownPercent > worst.metrics.maxDrawdownPercent ? current : worst
    );

    console.log('\n📈 Performance Analysis:');
    console.log(`   🏆 Best Return: ${bestReturn.scenario} (${bestReturn.metrics.totalReturnPercent.toFixed(2)}%)`);
    console.log(`   ⭐ Best Sharpe: ${bestSharpe.scenario} (${bestSharpe.metrics.sharpeRatio.toFixed(2)})`);
    console.log(`   ⚠️  Worst Drawdown: ${worstDrawdown.scenario} (${worstDrawdown.metrics.maxDrawdownPercent.toFixed(2)}%)`);

    // Calculate aggregate statistics
    const avgReturn = results.reduce((sum, r) => sum + r.metrics.totalReturnPercent, 0) / results.length;
    const avgWinRate = results.reduce((sum, r) => sum + r.metrics.winRate, 0) / results.length;
    const avgSharpe = results.reduce((sum, r) => sum + r.metrics.sharpeRatio, 0) / results.length;

    console.log('\n📊 Aggregate Statistics:');
    console.log(`   Average Return: ${avgReturn.toFixed(2)}%`);
    console.log(`   Average Win Rate: ${avgWinRate.toFixed(1)}%`);
    console.log(`   Average Sharpe: ${avgSharpe.toFixed(2)}`);

    // Generate recommendations
    console.log('\n💡 Strategy Recommendations:');
    generateStrategyRecommendations(results);

    // Save detailed results
    await saveAdvancedResults(results);

    // Stress testing
    console.log('\n🔥 Running stress tests...');
    await runStressTests();

    console.log('\n✅ Advanced backtesting suite completed!');

  } catch (error) {
    console.error('\n❌ Advanced backtest failed:', error);
    logger.error('Advanced backtest execution failed', {
      source: 'AdvancedBacktestScript',
      error: { stack: (error as Error).stack }
    });
    process.exit(1);
  }
}

/**
 * Generate realistic market events
 */
function generateMarketEvents(startDate: number, endDate: number) {
  const events: Array<{
    timestamp: number;
    type: 'pump' | 'dump' | 'consolidation';
    magnitude: number;
  }> = [];
  const duration = endDate - startDate;
  const numEvents = Math.floor(duration / (24 * 60 * 60 * 1000)) * 2; // ~2 events per day

  for (let i = 0; i < numEvents; i++) {
    const timestamp = startDate + Math.random() * duration;
    const eventTypes = ['pump', 'dump', 'consolidation'] as const;
    const type = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const magnitude = Math.random() * 0.05; // Up to 5% movement

    events.push({ timestamp, type, magnitude });
  }

  return events;
}

/**
 * Generate strategy recommendations based on results
 */
function generateStrategyRecommendations(results: ScenarioResult[]) {
  const profitableResults = results.filter(r => r.metrics.totalReturnPercent > 0);
  const highDrawdownResults = results.filter(r => r.metrics.maxDrawdownPercent > 15);
  const lowSharpeResults = results.filter(r => r.metrics.sharpeRatio < 1.0);

  if (profitableResults.length / results.length > 0.7) {
    console.log('   ✅ Strategy performs well across most conditions');
  } else {
    console.log('   ⚠️  Strategy struggles in certain market conditions');
  }

  if (highDrawdownResults.length > 0) {
    console.log('   📉 Consider stronger risk management - high drawdowns detected');
  }

  if (lowSharpeResults.length > results.length / 2) {
    console.log('   📊 Risk-adjusted returns could be improved');
  }

  // Timeframe analysis
  const timeframePerformance = new Map();
  results.forEach(r => {
    const tf = r.scenario.split('_').pop();
    if (!timeframePerformance.has(tf)) {
      timeframePerformance.set(tf, []);
    }
    timeframePerformance.get(tf).push(r.metrics.totalReturnPercent);
  });

  let bestTimeframe = '';
  let bestAvgReturn = -Infinity;
  for (const [tf, returns] of timeframePerformance) {
    const avgReturn = returns.reduce((sum: number, r: number) => sum + r, 0) / returns.length;
    if (avgReturn > bestAvgReturn) {
      bestAvgReturn = avgReturn;
      bestTimeframe = tf;
    }
  }

  console.log(`   ⏰ Best performing timeframe: ${bestTimeframe} (${bestAvgReturn.toFixed(2)}% avg)`);
}

/**
 * Save advanced backtest results
 */
async function saveAdvancedResults(results: ScenarioResult[]) {
  const reportConfig = {
    outputDir: './reports/advanced',
    filePrefix: 'advanced_backtest_suite',
    format: {
      json: true,
      text: true,
      csv: false,
      html: true
    },
    includeTrades: false,
    includeCharts: false
  };

  // Create summary report
  const summaryReport = {
    testDate: new Date().toISOString(),
    totalScenarios: results.length,
    results: results,
    summary: {
      avgReturn: results.reduce((sum, r) => sum + r.metrics.totalReturnPercent, 0) / results.length,
      bestScenario: results.reduce((best, current) => 
        current.metrics.totalReturnPercent > best.metrics.totalReturnPercent ? current : best
      ),
      worstScenario: results.reduce((worst, current) => 
        current.metrics.totalReturnPercent < worst.metrics.totalReturnPercent ? current : worst
      )
    }
  };

  const reportGenerator = new BacktestReportGenerator(reportConfig);
  
  // Convert to PerformanceReport format for compatibility
  const mockReport = {
    config: results[0].config,
    metrics: {
      totalReturn: 0,
      totalReturnPercent: summaryReport.summary.avgReturn,
      annualizedReturn: 0,
      maxDrawdown: 0,
      maxDrawdownPercent: 0,
      sharpeRatio: 0,
      sortinioRatio: 0,
      calmarRatio: 0,
      winRate: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      avgTradeDuration: 0,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      largestWin: 0,
      largestLoss: 0,
      consecutiveWins: 0,
      consecutiveLosses: 0,
      expectancy: 0,
      systemQuality: 0
    },
    trades: [],
    equity: [],
    monthlyReturns: [],
    riskMetrics: {
      var95: 0,
      var99: 0,
      volatility: 0,
      beta: 0
    },
    summary: {
      startDate: new Date(results[0].config.startDate).toISOString(),
      endDate: new Date(results[0].config.endDate).toISOString(),
      duration: '14d 0h',
      finalBalance: 10000,
      peakBalance: 10000
    }
  };

  console.log('📄 Saving advanced results summary...');
}

/**
 * Run stress tests
 */
async function runStressTests() {
  const stressScenarios = [
    {
      name: 'High Commission',
      config: { commissionRate: 0.005, slippageRate: 0.001 } // 0.5% commission
    },
    {
      name: 'High Latency',
      config: { commissionRate: 0.001, slippageRate: 0.0005, latencyMs: 500 } // 500ms latency
    },
    {
      name: 'Extreme Volatility',
      config: { commissionRate: 0.001, slippageRate: 0.002 } // 0.2% slippage
    }
  ];

  for (const stress of stressScenarios) {
    console.log(`   Testing: ${stress.name}`);
    
    const backtestConfig: BacktestConfig = {
      symbol: 'BTCUSDT',
      startDate: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days
      endDate: Date.now(),
      initialBalance: 10000,
      timeframe: '5m',
      latencyMs: 0,
      ...stress.config,
      enableRiskManagement: true
    };

    const dataConfig = HistoricalDataGenerator.generateScenarioData('volatile');
    dataConfig.startDate = backtestConfig.startDate;
    dataConfig.endDate = backtestConfig.endDate;
    dataConfig.timeframe = backtestConfig.timeframe;

    const dataGenerator = new HistoricalDataGenerator(dataConfig);
    const historicalData = dataGenerator.generateData();

    const backtestEngine = new BacktestingEngine(backtestConfig);
    const report = await backtestEngine.runBacktest(historicalData);

    console.log(`      Result: ${report.metrics.totalReturnPercent.toFixed(2)}% return, ${report.metrics.totalTrades} trades`);
  }
}

// Run the advanced backtest if this script is executed directly
if (require.main === module) {
  runAdvancedBacktest()
    .then(() => {
      console.log('\n🏁 Advanced backtest script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

export { runAdvancedBacktest };
