#!/usr/bin/env ts-node

/**
 * Strategy optimization script using parameter sweeping
 * Tests different strategy parameters to find optimal settings
 */

import { BacktestingEngine, BacktestConfig } from '../src/services/backtestingService';
import { HistoricalDataGenerator } from '../src/utils/historicalDataGenerator';
import { BacktestReportGenerator } from '../src/utils/backtestReportGenerator';
import logger from '../src/services/logger';
import fs from 'fs';
import path from 'path';

interface OptimizationParameter {
  name: string;
  values: number[];
  applyToConfig: (config: any, value: number) => void;
}

interface OptimizationResult {
  parameters: Record<string, number>;
  metrics: {
    totalReturnPercent: number;
    winRate: number;
    maxDrawdownPercent: number;
    sharpeRatio: number;
    profitFactor: number;
    totalTrades: number;
    score: number; // Composite score
  };
}

async function runOptimization() {
  console.log('🔧 Starting strategy optimization...\n');

  try {
    // Define parameters to optimize
    const optimizationParams: OptimizationParameter[] = [
      {
        name: 'commissionRate',
        values: [0.0005, 0.001, 0.0015, 0.002],
        applyToConfig: (config, value) => { config.commissionRate = value; }
      },
      {
        name: 'slippageRate',
        values: [0.0002, 0.0005, 0.001, 0.0015],
        applyToConfig: (config, value) => { config.slippageRate = value; }
      },
      {
        name: 'initialBalance',
        values: [5000, 10000, 20000],
        applyToConfig: (config, value) => { config.initialBalance = value; }
      }
    ];

    // Generate base historical data
    console.log('📊 Generating historical data for optimization...');
    const dataConfig = HistoricalDataGenerator.generateScenarioData('trending_up');
    dataConfig.startDate = Date.now() - 10 * 24 * 60 * 60 * 1000; // 10 days
    dataConfig.endDate = Date.now();
    dataConfig.timeframe = '5m';

    const dataGenerator = new HistoricalDataGenerator(dataConfig);
    const historicalData = dataGenerator.generateData();
    console.log(`✅ Generated ${historicalData.length} candles for optimization`);

    // Generate all parameter combinations
    const parameterCombinations = generateParameterCombinations(optimizationParams);
    console.log(`🔬 Testing ${parameterCombinations.length} parameter combinations...\n`);

    const results: OptimizationResult[] = [];
    const totalCombinations = parameterCombinations.length;
    let completedCount = 0;

    // Test each combination
    for (const combination of parameterCombinations) {
      completedCount++;
      const progress = ((completedCount / totalCombinations) * 100).toFixed(1);
      
      process.stdout.write(`\r⚡ Testing combination ${completedCount}/${totalCombinations} (${progress}%)`);

      // Create backtest config with current parameters
      const backtestConfig: BacktestConfig = {
        symbol: 'BTCUSDT',
        startDate: dataConfig.startDate,
        endDate: dataConfig.endDate,
        initialBalance: 10000,
        timeframe: '5m',
        commissionRate: 0.001,
        slippageRate: 0.0005,
        latencyMs: 0,
        enableRiskManagement: true
      };

      // Apply parameter values
      for (const [paramName, value] of Object.entries(combination)) {
        const param = optimizationParams.find(p => p.name === paramName);
        if (param) {
          param.applyToConfig(backtestConfig, value);
        }
      }

      try {
        // Run backtest
        const backtestEngine = new BacktestingEngine(backtestConfig);
        const report = await backtestEngine.runBacktest(historicalData);

        // Calculate composite score
        const score = calculateCompositeScore(report.metrics);

        results.push({
          parameters: combination,
          metrics: {
            totalReturnPercent: report.metrics.totalReturnPercent,
            winRate: report.metrics.winRate,
            maxDrawdownPercent: report.metrics.maxDrawdownPercent,
            sharpeRatio: report.metrics.sharpeRatio,
            profitFactor: report.metrics.profitFactor,
            totalTrades: report.metrics.totalTrades,
            score
          }
        });

      } catch (error) {
        logger.warn('Optimization run failed for parameter combination', {
          source: 'OptimizationScript',
          context: { combination, error: (error as Error).message }
        });
      }
    }

    console.log('\n\n✅ Optimization completed!\n');

    // Sort results by score
    results.sort((a, b) => b.metrics.score - a.metrics.score);

    // Display top results
    console.log('🏆 TOP 10 PARAMETER COMBINATIONS:');
    console.log('='.repeat(120));
    console.log(
      'Rank'.padEnd(6) +
      'Score'.padEnd(8) + 
      'Return %'.padEnd(10) + 
      'Win Rate'.padEnd(10) + 
      'Sharpe'.padEnd(8) + 
      'Max DD'.padEnd(8) + 
      'Trades'.padEnd(8) +
      'Parameters'
    );
    console.log('='.repeat(120));

    for (let i = 0; i < Math.min(10, results.length); i++) {
      const result = results[i];
      const paramStr = Object.entries(result.parameters)
        .map(([key, value]) => `${key}=${value}`)
        .join(', ');

      const line = 
        `${i + 1}`.padEnd(6) +
        result.metrics.score.toFixed(2).padEnd(8) +
        result.metrics.totalReturnPercent.toFixed(2).padEnd(10) +
        result.metrics.winRate.toFixed(1).padEnd(10) +
        result.metrics.sharpeRatio.toFixed(2).padEnd(8) +
        result.metrics.maxDrawdownPercent.toFixed(2).padEnd(8) +
        result.metrics.totalTrades.toString().padEnd(8) +
        paramStr;
      
      console.log(line);
    }

    // Parameter sensitivity analysis
    console.log('\n📊 PARAMETER SENSITIVITY ANALYSIS:');
    console.log('='.repeat(80));
    
    for (const param of optimizationParams) {
      analyzeParameterSensitivity(param.name, results);
    }

    // Generate optimization report
    await generateOptimizationReport(results, optimizationParams);

    // Run validation backtest with best parameters
    console.log('\n🧪 VALIDATION BACKTEST WITH OPTIMAL PARAMETERS:');
    console.log('='.repeat(60));
    await runValidationBacktest(results[0].parameters, optimizationParams);

    console.log('\n✅ Strategy optimization completed successfully!');

  } catch (error) {
    console.error('\n❌ Optimization failed:', error);
    logger.error('Strategy optimization failed', {
      source: 'OptimizationScript',
      error: { stack: (error as Error).stack }
    });
    process.exit(1);
  }
}

/**
 * Generate all parameter combinations
 */
function generateParameterCombinations(params: OptimizationParameter[]): Array<Record<string, number>> {
  function* combinations(
    paramIndex: number,
    current: Record<string, number>
  ): Generator<Record<string, number>> {
    if (paramIndex >= params.length) {
      yield { ...current };
      return;
    }

    const param = params[paramIndex];
    for (const value of param.values) {
      current[param.name] = value;
      yield* combinations(paramIndex + 1, current);
    }
  }

  return Array.from(combinations(0, {}));
}

/**
 * Calculate composite performance score
 */
function calculateCompositeScore(metrics: any): number {
  // Weighted scoring formula
  const weights = {
    totalReturn: 0.3,
    sharpeRatio: 0.25,
    winRate: 0.15,
    profitFactor: 0.15,
    maxDrawdown: 0.15 // Negative weight (lower is better)
  };

  // Normalize metrics to 0-100 scale
  const normalizedReturn = Math.max(0, Math.min(100, metrics.totalReturnPercent + 50)); // -50% to 50% -> 0-100
  const normalizedSharpe = Math.max(0, Math.min(100, metrics.sharpeRatio * 25)); // 0-4 -> 0-100
  const normalizedWinRate = metrics.winRate; // Already 0-100
  const normalizedProfitFactor = Math.max(0, Math.min(100, (metrics.profitFactor - 0.5) * 50)); // 0.5-2.5 -> 0-100
  const normalizedDrawdown = Math.max(0, 100 - metrics.maxDrawdownPercent); // Lower drawdown = higher score

  const score = 
    (normalizedReturn * weights.totalReturn) +
    (normalizedSharpe * weights.sharpeRatio) +
    (normalizedWinRate * weights.winRate) +
    (normalizedProfitFactor * weights.profitFactor) +
    (normalizedDrawdown * weights.maxDrawdown);

  return score;
}

/**
 * Analyze parameter sensitivity
 */
function analyzeParameterSensitivity(paramName: string, results: OptimizationResult[]) {
  const paramValues = new Map<number, OptimizationResult[]>();
  
  // Group results by parameter value
  for (const result of results) {
    const value = result.parameters[paramName];
    if (!paramValues.has(value)) {
      paramValues.set(value, []);
    }
    paramValues.get(value)!.push(result);
  }

  console.log(`\n${paramName}:`);
  
  for (const [value, groupResults] of paramValues) {
    const avgScore = groupResults.reduce((sum, r) => sum + r.metrics.score, 0) / groupResults.length;
    const avgReturn = groupResults.reduce((sum, r) => sum + r.metrics.totalReturnPercent, 0) / groupResults.length;
    
    console.log(`  ${value}: Avg Score=${avgScore.toFixed(2)}, Avg Return=${avgReturn.toFixed(2)}%`);
  }
}

/**
 * Generate optimization report
 */
async function generateOptimizationReport(results: OptimizationResult[], params: OptimizationParameter[]) {
  const reportDir = './reports/optimization';
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = path.join(reportDir, `optimization_${timestamp}.json`);

  const report = {
    timestamp: new Date().toISOString(),
    totalCombinations: results.length,
    parameters: params.map(p => ({
      name: p.name,
      values: p.values
    })),
    results: results.slice(0, 50), // Top 50 results
    summary: {
      bestScore: results[0]?.metrics.score || 0,
      bestParameters: results[0]?.parameters || {},
      avgScore: results.reduce((sum, r) => sum + r.metrics.score, 0) / results.length,
      scoreStdDev: calculateStandardDeviation(results.map(r => r.metrics.score))
    }
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`📄 Optimization report saved: ${reportPath}`);
}

/**
 * Calculate standard deviation
 */
function calculateStandardDeviation(values: number[]): number {
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Run validation backtest with different market conditions
 */
async function runValidationBacktest(
  optimalParams: Record<string, number>,
  optimizationParams: OptimizationParameter[]
) {
  const scenarios = ['trending_down', 'sideways', 'volatile'];
  
  for (const scenario of scenarios) {
    console.log(`\nValidating with ${scenario} market...`);
    
    // Generate validation data
    const dataConfig = HistoricalDataGenerator.generateScenarioData(scenario);
    dataConfig.startDate = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
    dataConfig.endDate = Date.now();
    dataConfig.timeframe = '5m';

    const dataGenerator = new HistoricalDataGenerator(dataConfig);
    const historicalData = dataGenerator.generateData();

    // Create config with optimal parameters
    const backtestConfig: BacktestConfig = {
      symbol: 'BTCUSDT',
      startDate: dataConfig.startDate,
      endDate: dataConfig.endDate,
      initialBalance: 10000,
      timeframe: '5m',
      commissionRate: 0.001,
      slippageRate: 0.0005,
      latencyMs: 0,
      enableRiskManagement: true
    };

    // Apply optimal parameters
    for (const [paramName, value] of Object.entries(optimalParams)) {
      const param = optimizationParams.find(p => p.name === paramName);
      if (param) {
        param.applyToConfig(backtestConfig, value);
      }
    }

    // Run validation backtest
    const backtestEngine = new BacktestingEngine(backtestConfig);
    const report = await backtestEngine.runBacktest(historicalData);

    console.log(`  Return: ${report.metrics.totalReturnPercent.toFixed(2)}%`);
    console.log(`  Sharpe: ${report.metrics.sharpeRatio.toFixed(2)}`);
    console.log(`  Max DD: ${report.metrics.maxDrawdownPercent.toFixed(2)}%`);
    console.log(`  Trades: ${report.metrics.totalTrades}`);
  }
}

// Run optimization if this script is executed directly
if (require.main === module) {
  runOptimization()
    .then(() => {
      console.log('\n🏁 Optimization script completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

export { runOptimization };