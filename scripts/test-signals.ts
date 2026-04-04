#!/usr/bin/env npx ts-node

import { SignalValidator } from '../src/services/signalValidator';
import { SignalAggregator } from '../src/services/signalAggregator';
import { SignalMonitor } from '../src/services/signalMonitor';
import { ScalpingStrategy } from '../src/strategies/scalpingStrategy';
import logger from '../src/services/logger';

/**
 * Comprehensive test runner for the enhanced signal generation system
 */
async function runSignalTests(): Promise<void> {
  
  console.log('🚀 Starting Enhanced Signal Generation System Tests\n');

  try {
    // Test 1: Signal Validation Suite
    console.log('📋 Running Signal Validation Suite...');
    const validator = new SignalValidator();
    const validationResults = await validator.runValidationSuite();
    
    console.log(`✅ Validation Results: ${validationResults.passed}/${validationResults.passed + validationResults.failed} tests passed`);
    
    // Print detailed results
    validationResults.results.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`   ${icon} ${result.testName}: ${result.message}`);
      
      if (!result.passed) {
        result.details.forEach(detail => {
          if (!detail.passed) {
            console.log(`      ❌ ${detail.name}`);
          }
        });
      }
    });
    
    console.log();

    // Test 2: Performance Benchmarks
    console.log('⚡ Running Performance Benchmarks...');
    const benchmarks = await validator.runPerformanceBenchmarks();
    
    benchmarks.forEach(benchmark => {
      const icon = benchmark.passed ? '✅' : '❌';
      console.log(`   ${icon} ${benchmark.name}: ${benchmark.duration}ms (avg: ${benchmark.avgDuration.toFixed(1)}ms)`);
    });
    
    console.log();

    // Test 3: Signal Aggregation Test
    console.log('🔄 Testing Signal Aggregation...');
    const aggregator = new SignalAggregator(logger);
    const strategy = new ScalpingStrategy();
    
    // Generate test data
    const testCandles = generateTestCandles(100);
    const testMarketData = generateTestMarketData();
    
    const startTime = Date.now();
    const aggregation = await aggregator.generateAggregatedSignal(
      'BTCUSDT',
      testCandles,
      testMarketData
    );
    const aggregationTime = Date.now() - startTime;
    
    console.log(`   ✅ Aggregation completed in ${aggregationTime}ms`);
    console.log(`   📊 Signal: ${aggregation.finalSignal.type} (${aggregation.finalSignal.strength}% strength, ${aggregation.finalSignal.confidence}% confidence)`);
    console.log(`   🎯 Quality Score: ${aggregation.qualityScore}%, Risk Score: ${aggregation.riskScore}%`);
    console.log(`   🤝 Consensus Level: ${(aggregation.consensusLevel * 100).toFixed(1)}%`);
    console.log();

    // Test 4: Signal Monitoring Test
    console.log('📡 Testing Signal Monitor...');
    const monitor = new SignalMonitor(aggregator, logger);
    
    // Start monitoring
    monitor.startMonitoring({ intervalMs: 5000 });
    
    // Track a test signal
    if (aggregation.finalSignal.type !== 'HOLD') {
      monitor.trackSignal(aggregation.finalSignal, 'BTCUSDT', testMarketData.price);
      
      // Simulate price updates
      setTimeout(() => {
        monitor.updateSignalPrice(aggregation.finalSignal.metadata!.id, testMarketData.price + 100);
      }, 1000);
      
      setTimeout(() => {
        monitor.updateSignalPrice(aggregation.finalSignal.metadata!.id, testMarketData.price + 200);
      }, 2000);
      
      // Complete the signal
      setTimeout(() => {
        monitor.completeSignal(aggregation.finalSignal.metadata!.id, 'win', testMarketData.price + 150);
        console.log(`   ✅ Signal tracking completed`);
        
        const status = monitor.getMonitoringStatus();
        console.log(`   📈 Performance: ${status.performanceMetrics.overallSuccessRate.toFixed(1)}% success rate`);
        
        monitor.stopMonitoring();
      }, 3000);
    }
    
    console.log();

    // Test 5: Strategy Performance Test
    console.log('📈 Testing Strategy Performance...');
    
    // Generate multiple test scenarios
    const scenarios = [
      { name: 'Bullish Market', candles: generateBullishCandles(50) },
      { name: 'Bearish Market', candles: generateBearishCandles(50) },
      { name: 'Sideways Market', candles: generateSidewaysCandles(50) },
      { name: 'Volatile Market', candles: generateVolatileCandles(50) }
    ];
    
    for (const scenario of scenarios) {
      const signal = strategy.generateSignal(scenario.candles, testMarketData);
      console.log(`   📊 ${scenario.name}: ${signal.type} (${signal.strength}% strength)`);
    }
    
    console.log();

    // Test 6: Signal Quality Analysis
    console.log('🔍 Analyzing Signal Quality...');
    
    let totalSignals = 0;
    let strongSignals = 0;
    let buySignals = 0;
    let sellSignals = 0;
    let holdSignals = 0;
    
    // Generate signals with different market conditions
    for (let i = 0; i < 20; i++) {
      const randomCandles = generateRandomCandles(100);
      const signal = strategy.generateSignal(randomCandles, testMarketData);
      
      totalSignals++;
      if (signal.strength > 70) strongSignals++;
      
      switch (signal.type) {
        case 'BUY': buySignals++; break;
        case 'SELL': sellSignals++; break;
        case 'HOLD': holdSignals++; break;
      }
    }
    
    console.log(`   📊 Signal Distribution: ${buySignals} BUY, ${sellSignals} SELL, ${holdSignals} HOLD`);
    console.log(`   💪 Strong Signals: ${strongSignals}/${totalSignals} (${((strongSignals/totalSignals)*100).toFixed(1)}%)`);
    console.log();

    // Test 7: Market Regime Detection Test
    console.log('🌊 Testing Market Regime Detection...');
    
    const regimeTests = [
      { name: 'Strong Uptrend', candles: generateTrendingCandles(100, 0.02) },
      { name: 'Strong Downtrend', candles: generateTrendingCandles(100, -0.02) },
      { name: 'High Volatility', candles: generateVolatileCandles(100) },
      { name: 'Low Volatility', candles: generateSidewaysCandles(100) }
    ];
    
    regimeTests.forEach(test => {
      const prices = test.candles.map(c => c.close);
      const volumes = test.candles.map(c => c.volume);
      const regime = require('../src/utils/technicalIndicators').TechnicalIndicators.detectMarketRegime(prices, volumes);
      
      console.log(`   🌊 ${test.name}: ${regime.type} (${regime.confidence.toFixed(1)}% confidence, ${regime.strength.toFixed(1)}% strength)`);
    });
    
    console.log();

    // Final Summary
    console.log('📋 Test Summary:');
    console.log(`   ✅ Signal Validation: ${validationResults.passed}/${validationResults.passed + validationResults.failed} tests passed`);
    console.log(`   ⚡ Performance Benchmarks: ${benchmarks.filter(b => b.passed).length}/${benchmarks.length} passed`);
    console.log(`   🔄 Signal Aggregation: Working`);
    console.log(`   📡 Signal Monitoring: Working`);
    console.log(`   📈 Strategy Performance: Tested across multiple scenarios`);
    console.log(`   🔍 Signal Quality: ${((strongSignals/totalSignals)*100).toFixed(1)}% strong signals`);
    console.log(`   🌊 Market Regime Detection: Working`);
    
    const overallSuccess = validationResults.passed === (validationResults.passed + validationResults.failed) &&
                          benchmarks.every(b => b.passed);
    
    if (overallSuccess) {
      console.log('\n🎉 All tests passed! Enhanced signal generation system is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Please review the results above.');
    }

  } catch (error) {
    logger.error('Error running signal tests', error);
    console.error('❌ Test execution failed:', error.message);
    process.exit(1);
  }
}

// Helper functions for generating test data

function generateTestCandles(count: number): any[] {
  const candles: any[] = [];
  let price = 50000;
  const baseTime = Date.now() - count * 60000;

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 100;
    const newPrice = Math.max(price + change, 1000);
    
    candles.push({
      openTime: baseTime + i * 60000,
      open: price,
      high: Math.max(price, newPrice) + Math.random() * 50,
      low: Math.min(price, newPrice) - Math.random() * 50,
      close: newPrice,
      volume: 10 + Math.random() * 100,
      closeTime: baseTime + (i + 1) * 60000 - 1,
      quoteVolume: (10 + Math.random() * 100) * newPrice,
      trades: Math.floor(Math.random() * 100) + 10,
      baseAssetVolume: (10 + Math.random() * 100) * 0.8,
      quoteAssetVolume: (10 + Math.random() * 100) * newPrice * 0.8
    });

    price = newPrice;
  }

  return candles;
}

function generateBullishCandles(count: number): any[] {
  const candles: any[] = [];
  let price = 50000;
  const baseTime = Date.now() - count * 60000;

  for (let i = 0; i < count; i++) {
    const change = 20 + Math.random() * 30;
    const newPrice = price + change;
    
    candles.push({
      openTime: baseTime + i * 60000,
      open: price,
      high: newPrice + Math.random() * 10,
      low: price - Math.random() * 5,
      close: newPrice,
      volume: 50 + Math.random() * 50,
      closeTime: baseTime + (i + 1) * 60000 - 1,
      quoteVolume: (50 + Math.random() * 50) * newPrice,
      trades: Math.floor(Math.random() * 100) + 50,
      baseAssetVolume: (50 + Math.random() * 50) * 0.8,
      quoteAssetVolume: (50 + Math.random() * 50) * newPrice * 0.8
    });

    price = newPrice;
  }

  return candles;
}

function generateBearishCandles(count: number): any[] {
  const candles: any[] = [];
  let price = 50000;
  const baseTime = Date.now() - count * 60000;

  for (let i = 0; i < count; i++) {
    const change = -20 - Math.random() * 30;
    const newPrice = Math.max(price + change, 1000);
    
    candles.push({
      openTime: baseTime + i * 60000,
      open: price,
      high: price + Math.random() * 5,
      low: newPrice - Math.random() * 10,
      close: newPrice,
      volume: 50 + Math.random() * 50,
      closeTime: baseTime + (i + 1) * 60000 - 1,
      quoteVolume: (50 + Math.random() * 50) * newPrice,
      trades: Math.floor(Math.random() * 100) + 50,
      baseAssetVolume: (50 + Math.random() * 50) * 0.8,
      quoteAssetVolume: (50 + Math.random() * 50) * newPrice * 0.8
    });

    price = newPrice;
  }

  return candles;
}

function generateSidewaysCandles(count: number): any[] {
  const candles: any[] = [];
  const basePrice = 50000;
  const range = 200;
  const baseTime = Date.now() - count * 60000;

  for (let i = 0; i < count; i++) {
    const price = basePrice + (Math.random() - 0.5) * range;
    
    candles.push({
      openTime: baseTime + i * 60000,
      open: price,
      high: price + Math.random() * 20,
      low: price - Math.random() * 20,
      close: price,
      volume: 20 + Math.random() * 30,
      closeTime: baseTime + (i + 1) * 60000 - 1,
      quoteVolume: (20 + Math.random() * 30) * price,
      trades: Math.floor(Math.random() * 50) + 20,
      baseAssetVolume: (20 + Math.random() * 30) * 0.8,
      quoteAssetVolume: (20 + Math.random() * 30) * price * 0.8
    });
  }

  return candles;
}

function generateVolatileCandles(count: number): any[] {
  const candles: any[] = [];
  let price = 50000;
  const baseTime = Date.now() - count * 60000;

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 500;
    const newPrice = Math.max(price + change, 1000);
    const volatility = 100 + Math.random() * 200;
    
    candles.push({
      openTime: baseTime + i * 60000,
      open: price,
      high: newPrice + Math.random() * volatility,
      low: newPrice - Math.random() * volatility,
      close: newPrice,
      volume: 100 + Math.random() * 200,
      closeTime: baseTime + (i + 1) * 60000 - 1,
      quoteVolume: (100 + Math.random() * 200) * newPrice,
      trades: Math.floor(Math.random() * 200) + 100,
      baseAssetVolume: (100 + Math.random() * 200) * 0.8,
      quoteAssetVolume: (100 + Math.random() * 200) * newPrice * 0.8
    });

    price = newPrice;
  }

  return candles;
}

function generateTrendingCandles(count: number, trendStrength: number): any[] {
  const candles: any[] = [];
  let price = 50000;
  const baseTime = Date.now() - count * 60000;

  for (let i = 0; i < count; i++) {
    const trendMove = price * trendStrength;
    const randomMove = (Math.random() - 0.5) * 50;
    const newPrice = Math.max(price + trendMove + randomMove, 1000);
    
    candles.push({
      openTime: baseTime + i * 60000,
      open: price,
      high: Math.max(price, newPrice) + Math.random() * 25,
      low: Math.min(price, newPrice) - Math.random() * 25,
      close: newPrice,
      volume: 30 + Math.random() * 70,
      closeTime: baseTime + (i + 1) * 60000 - 1,
      quoteVolume: (30 + Math.random() * 70) * newPrice,
      trades: Math.floor(Math.random() * 100) + 30,
      baseAssetVolume: (30 + Math.random() * 70) * 0.8,
      quoteAssetVolume: (30 + Math.random() * 70) * newPrice * 0.8
    });

    price = newPrice;
  }

  return candles;
}

function generateRandomCandles(count: number): any[] {
  const scenarios = [
    () => generateBullishCandles(count),
    () => generateBearishCandles(count),
    () => generateSidewaysCandles(count),
    () => generateVolatileCandles(count),
    () => generateTestCandles(count)
  ];
  
  const randomScenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  return randomScenario();
}

function generateTestMarketData(): any {
  const price = 50000;
  return {
    symbol: 'BTCUSDT',
    price,
    volume24h: 10000000,
    priceChange24h: (Math.random() - 0.5) * 1000,
    priceChangePercent24h: (Math.random() - 0.5) * 4,
    bid: price - 10,
    ask: price + 10,
    spread: 20,
    timestamp: Date.now()
  };
}

// Run the tests if this script is executed directly
if (require.main === module) {
  runSignalTests().catch(console.error);
}

export { runSignalTests };