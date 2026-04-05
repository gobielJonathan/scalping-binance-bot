#!/usr/bin/env node

import { DatabaseService } from '../src/database/databaseService';
import { PaperTradingValidator } from '../src/services/paperTradingValidator';
import { PaperTradingService } from '../src/services/paperTradingService';
import { RiskManager } from '../src/services/riskManager';
import { logger } from '../src/services/logger';
import config from '../src/config';
import fs from 'fs';

interface ValidationOptions {
  days?: number;
  outputFormat?: 'json' | 'table' | 'csv';
  outputFile?: string;
  continuous?: boolean;
  autoAdjust?: boolean;
}

class PaperTradingValidationScript {
  private dbService: DatabaseService;
  private validator: PaperTradingValidator;
  private paperTradingService: PaperTradingService;

  constructor() {
    this.dbService = new DatabaseService();
    this.validator = new PaperTradingValidator(this.dbService);
    
    // Initialize paper trading service for testing
    const riskManager = new RiskManager(config.trading.initialCapital);
    this.paperTradingService = new PaperTradingService(
      config.trading.initialCapital,
      riskManager,
      this.dbService
    );
    
    this.validator.setPaperTradingService(this.paperTradingService);
  }

  /**
   * Run paper trading validation
   */
  async runValidation(options: ValidationOptions = {}): Promise<void> {
    try {
      logger.info('Starting paper trading validation script');

      const {
        days = 7,
        outputFormat = 'table',
        outputFile,
        continuous = false,
        autoAdjust = false
      } = options;

      if (continuous) {
        await this.runContinuousValidation();
      } else {
        const report = await this.validator.generateValidationReport(days);
        await this.outputReport(report, outputFormat, outputFile);
      }

    } catch (error) {
      logger.error('Error running validation script:', error);
      process.exit(1);
    }
  }

  /**
   * Run specific validation tests
   */
  async runValidationTests(): Promise<void> {
    console.log('🔬 Running Paper Trading Validation Tests\n');

    // Test 1: Basic accuracy validation
    console.log('📊 Test 1: Basic Accuracy Validation');
    const basicValidation = await this.validator.validatePaperTradingAccuracy(7);
    this.printTestResult('Basic Validation', basicValidation.accuracy.overallAccuracy > 70);

    // Test 2: Order execution validation
    console.log('\n📊 Test 2: Order Execution Validation');
    try {
      const executionValidation = await this.validator.validateOrderExecution('BTCUSDT', 0.01);
      const priceAccuracyGood = executionValidation.accuracy.priceAccuracy > 95;
      this.printTestResult('Order Execution', priceAccuracyGood);
    } catch (error) {
      this.printTestResult('Order Execution', false, 'Service unavailable');
    }

    // Test 3: Slippage calculation accuracy
    console.log('\n📊 Test 3: Slippage Calculation Accuracy');
    const slippageAccuracy = basicValidation.accuracy.slippageAccuracy;
    this.printTestResult('Slippage Accuracy', slippageAccuracy > 80);

    // Test 4: Fee calculation accuracy
    console.log('\n📊 Test 4: Fee Calculation Accuracy');
    const feeAccuracy = basicValidation.accuracy.feeAccuracy;
    this.printTestResult('Fee Accuracy', feeAccuracy > 85);

    // Test 5: Execution time simulation
    console.log('\n📊 Test 5: Execution Time Simulation');
    const execTimeAccuracy = basicValidation.accuracy.executionTimeAccuracy;
    this.printTestResult('Execution Time', execTimeAccuracy > 75);

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('📋 VALIDATION SUMMARY');
    console.log('='.repeat(50));
    console.log(`Overall Accuracy: ${basicValidation.accuracy.overallAccuracy.toFixed(2)}%`);
    console.log(`Paper Trades: ${basicValidation.paperTrade.totalTrades}`);
    console.log(`Status: ${this.getValidationStatus(basicValidation.accuracy.overallAccuracy)}`);
    
    if (basicValidation.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      basicValidation.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`);
      });
    }
  }

  /**
   * Benchmark paper trading performance
   */
  async runPerformanceBenchmark(): Promise<void> {
    console.log('🚀 Running Paper Trading Performance Benchmark\n');

    const startTime = Date.now();
    const iterations = 100;
    const symbol = 'BTCUSDT';
    const quantity = 0.01;

    console.log(`Simulating ${iterations} order executions...`);

    // Mock market data for benchmarking
    const mockMarketData = {
      symbol,
      price: 50000,
      volume24h: 1000000,
      priceChange24h: 500,
      priceChangePercent24h: 1.0,
      bid: 49995,
      ask: 50005,
      spread: 10,
      timestamp: Date.now()
    };

    const orderRequest = {
      symbol,
      side: 'BUY' as const,
      type: 'MARKET' as const,
      quantity
    };

    let successCount = 0;
    const executionTimes: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const execStart = Date.now();
      
      try {
        this.paperTradingService.updateMarketData(mockMarketData);
        await this.paperTradingService.executePaperTrade(orderRequest, mockMarketData);
        successCount++;
      } catch (error) {
        console.error(`Execution ${i + 1} failed:`, error);
      }

      const execTime = Date.now() - execStart;
      executionTimes.push(execTime);
    }

    const totalTime = Date.now() - startTime;
    const avgExecutionTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
    const successRate = (successCount / iterations) * 100;

    console.log('\n📈 PERFORMANCE RESULTS');
    console.log('='.repeat(30));
    console.log(`Total Executions: ${iterations}`);
    console.log(`Successful: ${successCount}`);
    console.log(`Success Rate: ${successRate.toFixed(2)}%`);
    console.log(`Total Time: ${totalTime}ms`);
    console.log(`Avg Execution Time: ${avgExecutionTime.toFixed(2)}ms`);
    console.log(`Throughput: ${(iterations / (totalTime / 1000)).toFixed(2)} orders/sec`);

    const metrics = this.paperTradingService.getPaperTradingMetrics();
    console.log(`Total Fees: ${metrics.totalSimulatedFees.toFixed(6)}`);
    console.log(`Avg Slippage: ${metrics.averageSlippage}`);
  }

  /**
   * Generate comparison report with different market conditions
   */
  async generateMarketConditionComparison(): Promise<void> {
    console.log('📊 Generating Market Condition Comparison Report\n');

    const scenarios = [
      { name: 'Normal Market', volatility: 1.0, volume: 1000000, spread: 0.01 },
      { name: 'High Volatility', volatility: 3.0, volume: 800000, spread: 0.03 },
      { name: 'Low Liquidity', volatility: 1.5, volume: 200000, spread: 0.05 },
      { name: 'Bull Market', volatility: 2.0, volume: 2000000, spread: 0.015 },
      { name: 'Bear Market', volatility: 2.5, volume: 1500000, spread: 0.025 }
    ];

    console.log('Testing different market conditions...\n');

    for (const scenario of scenarios) {
      const marketData = {
        symbol: 'BTCUSDT',
        price: 50000,
        volume24h: scenario.volume,
        priceChange24h: scenario.volatility * 100,
        priceChangePercent24h: scenario.volatility,
        bid: 50000 * (1 - scenario.spread / 2),
        ask: 50000 * (1 + scenario.spread / 2),
        spread: 50000 * scenario.spread,
        timestamp: Date.now()
      };

      const orderRequest = {
        symbol: 'BTCUSDT',
        side: 'BUY' as const,
        type: 'MARKET' as const,
        quantity: 0.1
      };

      this.paperTradingService.updateMarketData(marketData);
      const result = await this.paperTradingService.executePaperTrade(orderRequest, marketData);

      console.log(`📈 ${scenario.name}:`);
      if (result) {
        console.log(`  Entry Price: $${result.entryPrice.toFixed(2)}`);
        console.log(`  Fees: $${result.fees.toFixed(6)}`);
        console.log(`  Expected Slippage: ~${(scenario.volatility * 0.02).toFixed(4)}%`);
      }
      console.log('');
    }
  }

  /**
   * Output validation report in specified format
   */
  private async outputReport(report: any, format: string, outputFile?: string): Promise<void> {
    let output: string;

    switch (format) {
      case 'json':
        output = JSON.stringify(report, null, 2);
        break;
      case 'csv':
        output = this.reportToCSV(report);
        break;
      default: // table
        output = this.reportToTable(report);
        break;
    }

    if (outputFile) {
      fs.writeFileSync(outputFile, output);
      console.log(`Report saved to ${outputFile}`);
    } else {
      console.log(output);
    }
  }

  /**
   * Convert report to table format
   */
  private reportToTable(report: any): string {
    let table = '\n🔍 PAPER TRADING VALIDATION REPORT\n';
    table += '='.repeat(50) + '\n';
    table += `Validation Period: ${report.summary.validationPeriod}\n`;
    table += `Overall Accuracy: ${report.summary.overallAccuracy}\n`;
    table += `Status: ${report.summary.status}\n\n`;

    table += '📊 DETAILED METRICS\n';
    table += '-'.repeat(30) + '\n';
    table += `Slippage - Paper: ${report.metrics.slippage.paper}, Live: ${report.metrics.slippage.live}, Accuracy: ${report.metrics.slippage.accuracy}\n`;
    table += `Fees - Paper: ${report.metrics.fees.paper}, Live: ${report.metrics.fees.live}, Accuracy: ${report.metrics.fees.accuracy}\n`;
    table += `Execution - Paper: ${report.metrics.executionTime.paper}, Live: ${report.metrics.executionTime.live}, Accuracy: ${report.metrics.executionTime.accuracy}\n\n`;

    table += `Trade Volume - Paper: ${report.tradeVolume.paperTrades}, Live: ${report.tradeVolume.liveTrades}\n\n`;

    if (report.recommendations.length > 0) {
      table += '💡 RECOMMENDATIONS\n';
      table += '-'.repeat(20) + '\n';
      report.recommendations.forEach((rec: string, i: number) => {
        table += `${i + 1}. ${rec}\n`;
      });
    }

    table += `\nGenerated: ${report.timestamp}\n`;
    return table;
  }

  /**
   * Convert report to CSV format
   */
  private reportToCSV(report: any): string {
    const headers = [
      'Metric', 'Paper_Value', 'Live_Value', 'Accuracy_Percent', 'Status'
    ];

    const rows = [
      ['Slippage', report.metrics.slippage.paper, report.metrics.slippage.live, report.metrics.slippage.accuracy, 'OK'],
      ['Fees', report.metrics.fees.paper, report.metrics.fees.live, report.metrics.fees.accuracy, 'OK'],
      ['Execution_Time', report.metrics.executionTime.paper, report.metrics.executionTime.live, report.metrics.executionTime.accuracy, 'OK'],
      ['Overall', '', '', report.summary.overallAccuracy, report.summary.status]
    ];

    let csv = headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.join(',') + '\n';
    });

    return csv;
  }

  /**
   * Print test result
   */
  private printTestResult(testName: string, passed: boolean, note?: string): void {
    const status = passed ? '✅ PASS' : '❌ FAIL';
    const noteText = note ? ` (${note})` : '';
    console.log(`${status} ${testName}${noteText}`);
  }

  /**
   * Get validation status
   */
  private getValidationStatus(accuracy: number): string {
    if (accuracy >= 90) return '🟢 EXCELLENT';
    if (accuracy >= 75) return '🟡 GOOD';
    if (accuracy >= 60) return '🟠 FAIR';
    return '🔴 NEEDS IMPROVEMENT';
  }

  /**
   * Run continuous validation
   */
  private async runContinuousValidation(): Promise<void> {
    console.log('🔄 Starting continuous validation mode...');
    await this.validator.runContinuousValidation();
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const script = new PaperTradingValidationScript();

  try {
    switch (args[0]) {
      case 'validate':
        const days = parseInt(args[1]) || 7;
        const format = args[2] || 'table';
        const outputFile = args[3];
        await script.runValidation({ days, outputFormat: format as any, outputFile });
        break;

      case 'test':
        await script.runValidationTests();
        break;

      case 'benchmark':
        await script.runPerformanceBenchmark();
        break;

      case 'compare':
        await script.generateMarketConditionComparison();
        break;

      case 'continuous':
        await script.runValidation({ continuous: true });
        break;

      default:
        console.log('📋 Paper Trading Validation Script\n');
        console.log('Usage:');
        console.log('  npm run validate:paper validate [days] [format] [outputFile] - Run validation');
        console.log('  npm run validate:paper test                                  - Run validation tests');
        console.log('  npm run validate:paper benchmark                            - Run performance benchmark');
        console.log('  npm run validate:paper compare                              - Compare market conditions');
        console.log('  npm run validate:paper continuous                           - Run continuous validation');
        console.log('\nFormats: table, json, csv');
        console.log('Example: npm run validate:paper validate 30 json report.json');
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { PaperTradingValidationScript };