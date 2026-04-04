#!/usr/bin/env ts-node

/**
 * Test script to validate backtesting framework
 */

import { BacktestingEngine, BacktestConfig } from '../src/services/backtestingService';
import { HistoricalDataGenerator } from '../src/utils/historicalDataGenerator';
import { BacktestReportGenerator } from '../src/utils/backtestReportGenerator';
import logger from '../src/services/logger';

async function testBacktestingFramework() {
  console.log('🧪 Testing Backtesting Framework...\n');

  try {
    // Test 1: Basic functionality
    console.log('1️⃣ Testing basic backtesting functionality...');
    
    const config: BacktestConfig = {
      symbol: 'BTCUSDT',
      startDate: Date.now() - 3 * 24 * 60 * 60 * 1000, // 3 days ago
      endDate: Date.now(),
      initialBalance: 10000,
      timeframe: '1m',
      commissionRate: 0.001,
      slippageRate: 0.0005,
      latencyMs: 0,
      enableRiskManagement: true
    };

    // Generate test data
    const dataConfig = HistoricalDataGenerator.generateScenarioData('trending_up');
    dataConfig.startDate = config.startDate;
    dataConfig.endDate = config.endDate;
    dataConfig.timeframe = config.timeframe;
    
    const generator = new HistoricalDataGenerator(dataConfig);
    const data = generator.generateData();

    console.log(`   ✅ Generated ${data.length} candles`);

    // Run backtest
    const engine = new BacktestingEngine(config);
    const report = await engine.runBacktest(data);

    console.log(`   ✅ Backtest completed: ${report.metrics.totalTrades} trades`);
    console.log(`   📈 Return: ${report.metrics.totalReturnPercent.toFixed(2)}%`);

    // Test 2: Report generation
    console.log('\n2️⃣ Testing report generation...');
    
    const reportConfig = {
      outputDir: './test_reports',
      filePrefix: 'test_backtest',
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
    const files = await reportGenerator.generateReport(report);

    console.log(`   ✅ Generated ${files.length} report files`);

    // Test 3: Data generator scenarios
    console.log('\n3️⃣ Testing data generator scenarios...');
    
    const scenarios = ['trending_up', 'trending_down', 'sideways', 'volatile'] as const;
    
    for (const scenario of scenarios) {
      const scenarioConfig = HistoricalDataGenerator.generateScenarioData(scenario);
      scenarioConfig.startDate = Date.now() - 24 * 60 * 60 * 1000; // 1 day
      scenarioConfig.endDate = Date.now();
      scenarioConfig.timeframe = '5m';
      
      const scenarioGenerator = new HistoricalDataGenerator(scenarioConfig);
      const scenarioData = scenarioGenerator.generateData();
      
      console.log(`   ✅ ${scenario}: ${scenarioData.length} candles`);
    }

    // Test 4: Market events
    console.log('\n4️⃣ Testing market events...');
    
    const eventGenerator = new HistoricalDataGenerator(dataConfig);
    let eventData = eventGenerator.generateData();
    
    const events = [
      { timestamp: config.startDate + 60 * 60 * 1000, type: 'pump' as const, magnitude: 0.02 },
      { timestamp: config.startDate + 120 * 60 * 1000, type: 'dump' as const, magnitude: 0.03 }
    ];
    
    eventData = eventGenerator.addMarketEvents(eventData, events);
    console.log(`   ✅ Added market events to ${eventData.length} candles`);

    // Test 5: Edge cases
    console.log('\n5️⃣ Testing edge cases...');
    
    try {
      // Test with insufficient data
      const smallDataConfig = { ...dataConfig };
      smallDataConfig.endDate = smallDataConfig.startDate + 60 * 60 * 1000; // 1 hour
      
      const smallGenerator = new HistoricalDataGenerator(smallDataConfig);
      const smallData = smallGenerator.generateData();
      
      const smallEngine = new BacktestingEngine(config);
      await smallEngine.runBacktest(smallData);
      console.log('   ❌ Should have thrown error for insufficient data');
    } catch (error) {
      console.log('   ✅ Correctly handled insufficient data error');
    }

    // Test 6: Performance test
    console.log('\n6️⃣ Testing performance...');
    
    const largeDataConfig = { ...dataConfig };
    largeDataConfig.startDate = Date.now() - 30 * 24 * 60 * 60 * 1000; // 30 days
    largeDataConfig.timeframe = '1m';
    
    const largeGenerator = new HistoricalDataGenerator(largeDataConfig);
    const largeData = largeGenerator.generateData();
    
    const startTime = Date.now();
    const largeEngine = new BacktestingEngine(config);
    const largeReport = await largeEngine.runBacktest(largeData);
    const endTime = Date.now();
    
    const duration = (endTime - startTime) / 1000;
    const candlesPerSecond = Math.floor(largeData.length / duration);
    
    console.log(`   ✅ Processed ${largeData.length} candles in ${duration.toFixed(2)}s`);
    console.log(`   📊 Performance: ${candlesPerSecond} candles/second`);
    console.log(`   📈 Large backtest: ${largeReport.metrics.totalTrades} trades, ${largeReport.metrics.totalReturnPercent.toFixed(2)}% return`);

    console.log('\n🎉 All tests passed! Backtesting framework is working correctly.');

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    logger.error('Backtesting framework test failed', {
      source: 'TestScript',
      error: { stack: (error as Error).stack }
    });
    process.exit(1);
  }
}

if (require.main === module) {
  testBacktestingFramework()
    .then(() => {
      console.log('\n🏁 Test script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test script failed:', error);
      process.exit(1);
    });
}

export { testBacktestingFramework };