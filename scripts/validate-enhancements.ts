#!/usr/bin/env ts-node

/**
 * Validation script for portfolio tracking and risk management enhancements
 * 
 * This script validates:
 * 1. Portfolio tracking functionality
 * 2. Enhanced position sizing algorithms
 * 3. Advanced loss limits system
 * 4. Integration between all components
 * 5. Performance under different market conditions
 */

import { PortfolioTracker } from '../src/services/portfolioTracker';
import { RiskManager } from '../src/services/riskManager';
import { IntegrationService } from '../src/services/integrationService';
import { OrderManager } from '../src/services/orderManager';
import { MarketData, TradePosition, TradingSignal } from '../src/types';
import { OrderType } from 'binance-api-node';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

class ValidationSuite {
  private riskManager: RiskManager;
  private portfolioTracker: PortfolioTracker;
  private orderManager: OrderManager;
  private integrationService: IntegrationService;
  private testResults: { name: string; success: boolean; details?: string; duration?: number }[] = [];

  constructor() {
    this.initializeServices();
  }

  private initializeServices(): void {
    console.log(`${colors.cyan}Initializing services...${colors.reset}`);
    
    this.riskManager = new RiskManager(50000); // $50,000 initial capital
    this.portfolioTracker = new PortfolioTracker(this.riskManager);
    this.orderManager = new OrderManager(this.riskManager);
    this.integrationService = new IntegrationService(
      this.portfolioTracker,
      this.riskManager,
      this.orderManager
    );
    
    console.log(`${colors.green}✓ Services initialized${colors.reset}`);
  }

  /**
   * Run all validation tests
   */
  async runAllTests(): Promise<void> {
    console.log(`${colors.bright}${colors.blue}=== Portfolio Tracking & Risk Management Validation ===${colors.reset}\n`);

    const testSuites = [
      { name: 'Portfolio Tracking', method: this.testPortfolioTracking.bind(this) },
      { name: 'Position Sizing Algorithms', method: this.testPositionSizing.bind(this) },
      { name: 'Enhanced Loss Limits', method: this.testLossLimits.bind(this) },
      { name: 'Risk Metrics Calculation', method: this.testRiskMetrics.bind(this) },
      { name: 'Integration Service', method: this.testIntegrationService.bind(this) },
      { name: 'Performance Under Stress', method: this.testPerformance.bind(this) },
      { name: 'Market Scenarios', method: this.testMarketScenarios.bind(this) }
    ];

    for (const suite of testSuites) {
      await this.runTestSuite(suite.name, suite.method);
    }

    this.printSummary();
  }

  /**
   * Run a test suite and capture results
   */
  private async runTestSuite(suiteName: string, testMethod: () => Promise<void>): Promise<void> {
    console.log(`${colors.yellow}Testing: ${suiteName}${colors.reset}`);
    const startTime = Date.now();

    try {
      await testMethod();
      const duration = Date.now() - startTime;
      this.testResults.push({ name: suiteName, success: true, duration });
      console.log(`${colors.green}✓ ${suiteName} passed (${duration}ms)${colors.reset}\n`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.testResults.push({ 
        name: suiteName, 
        success: false, 
        details: error instanceof Error ? error.message : String(error),
        duration 
      });
      console.log(`${colors.red}✗ ${suiteName} failed (${duration}ms)${colors.reset}`);
      console.log(`${colors.red}  Error: ${error instanceof Error ? error.message : String(error)}${colors.reset}\n`);
    }
  }

  /**
   * Test portfolio tracking functionality
   */
  private async testPortfolioTracking(): Promise<void> {
    const marketData = this.createMockMarketData();
    
    // Test 1: Initial portfolio metrics
    const initialMetrics = this.portfolioTracker.updatePortfolioMetrics(marketData);
    this.assert(initialMetrics.timestamp > 0, 'Portfolio metrics should have timestamp');
    this.assert(initialMetrics.totalValue >= 50000, 'Initial portfolio value should be correct');

    // Test 2: Add positions and recalculate
    const position = this.createMockPosition('portfolio-test-1', 'BTCUSDT', 1.0, 50000);
    this.riskManager.addPosition(position);
    
    const updatedMetrics = this.portfolioTracker.updatePortfolioMetrics(marketData);
    this.assert(updatedMetrics.totalRiskExposure > 0, 'Should have risk exposure with open positions');
    this.assert(!!updatedMetrics.positionContribution, 'Should calculate position contribution');

    // Test 3: Risk decomposition
    const positionRisks = this.portfolioTracker.getPositionRisk(marketData);
    this.assert(positionRisks.length === 1, 'Should return risk analysis for one position');
    this.assert(positionRisks[0].riskScore > 0, 'Position should have risk score');

    // Test 4: Alerts generation
    // Create a high-risk scenario
    const largePosition = this.createMockPosition('large-pos', 'BTCUSDT', 10.0, 45000);
    this.riskManager.addPosition(largePosition);
    
    this.portfolioTracker.updatePortfolioMetrics(marketData);
    const alerts = this.portfolioTracker.getAlerts();
    this.assert(alerts.length > 0, 'Should generate alerts for high-risk positions');

    console.log(`  ✓ Portfolio metrics calculated correctly`);
    console.log(`  ✓ Risk analysis working`);
    console.log(`  ✓ Alerts generated for high-risk scenarios`);
  }

  /**
   * Test position sizing algorithms
   */
  private async testPositionSizing(): Promise<void> {
    const marketData = this.createMockMarketData()[0];
    const signal = this.createMockSignal();

    // Test 1: Fixed position sizing
    this.riskManager.setPositionSizingParameters({ method: 'FIXED' });
    const fixedSize = this.riskManager.calculateOptimalPositionSize('BTCUSDT', 50000);
    this.assert(fixedSize > 0, 'Fixed position sizing should return positive value');

    // Test 2: Kelly Criterion
    // Set up performance metrics for Kelly calculation
    const performanceMetrics = this.riskManager.getPerformanceMetrics();
    performanceMetrics.totalTrades = 50;
    performanceMetrics.winningTrades = 32;
    performanceMetrics.avgWin = 250;
    performanceMetrics.avgLoss = -150;

    this.riskManager.setPositionSizingParameters({ method: 'KELLY', kellyFraction: 0.25 });
    const kellySize = this.riskManager.calculateOptimalPositionSize('BTCUSDT', 50000);
    this.assert(kellySize > 0, 'Kelly position sizing should return positive value');

    // Test 3: Volatility-adjusted sizing
    this.riskManager.setPositionSizingParameters({ method: 'VOLATILITY_ADJUSTED' });
    const volAdjustedSize = this.riskManager.calculateOptimalPositionSize('BTCUSDT', 50000, signal, marketData);
    this.assert(volAdjustedSize > 0, 'Volatility-adjusted sizing should return positive value');

    // Test 4: Risk parity
    this.riskManager.setPositionSizingParameters({ method: 'RISK_PARITY' });
    const riskParitySize = this.riskManager.calculateOptimalPositionSize('BTCUSDT', 50000);
    this.assert(riskParitySize > 0, 'Risk parity sizing should return positive value');

    // Test 5: Dynamic sizing
    this.riskManager.setPositionSizingParameters({ method: 'DYNAMIC' });
    const dynamicSize = this.riskManager.calculateOptimalPositionSize('BTCUSDT', 50000, signal, marketData);
    this.assert(dynamicSize > 0, 'Dynamic sizing should return positive value');

    console.log(`  ✓ Fixed position sizing: ${fixedSize.toFixed(4)} BTC`);
    console.log(`  ✓ Kelly criterion sizing: ${kellySize.toFixed(4)} BTC`);
    console.log(`  ✓ Volatility-adjusted: ${volAdjustedSize.toFixed(4)} BTC`);
    console.log(`  ✓ Risk parity: ${riskParitySize.toFixed(4)} BTC`);
    console.log(`  ✓ Dynamic sizing: ${dynamicSize.toFixed(4)} BTC`);
  }

  /**
   * Test enhanced loss limits functionality
   */
  private async testLossLimits(): Promise<void> {
    // Test 1: Configure multiple loss limits
    this.riskManager.setLossLimits({
      daily_dollar: {
        type: 'DOLLAR',
        value: 2500, // $2,500 daily loss limit
        warningThreshold: 80,
        enabled: true,
        autoReduction: true
      },
      daily_percentage: {
        type: 'PERCENTAGE',
        value: 5, // 5% daily loss limit
        warningThreshold: 75,
        enabled: true,
        autoReduction: true
      },
      max_drawdown: {
        type: 'DRAWDOWN',
        value: 15, // 15% max drawdown
        warningThreshold: 80,
        enabled: true,
        autoReduction: false
      }
    });

    // Test 2: Normal trading (should be allowed)
    const normalOrder = {
      symbol: 'BTCUSDT',
      side: 'BUY' as const,
      type: 'MARKET' as OrderType,
      quantity: 0.1
    };
    
    let riskCheck = this.riskManager.canOpenTrade(normalOrder, 50000);
    this.assert(riskCheck.allowed, 'Normal trading should be allowed');

    // Test 3: Simulate losses approaching limit
    this.riskManager.getPortfolio().dailyPnl = -2000; // Approaching dollar limit
    riskCheck = this.riskManager.canOpenTrade(normalOrder, 50000);
    this.assert(!!riskCheck.warnings && riskCheck.warnings.length > 0, 'Should generate warnings near limits');

    // Test 4: Breach loss limit
    this.riskManager.getPortfolio().dailyPnl = -3000; // Exceed dollar limit
    riskCheck = this.riskManager.canOpenTrade(normalOrder, 50000);
    this.assert(!riskCheck.allowed, 'Trading should be blocked when limits are exceeded');
    this.assert(!!riskCheck.reason && riskCheck.reason.includes('loss limit'), 'Should specify loss limit breach');

    // Test 5: Auto position reduction
    this.riskManager.getPortfolio().dailyPnl = -2200; // Near limit but not exceeded
    const initialRiskPercent = this.riskManager.getPositionSizingParams().baseRiskPercent;
    
    // Trigger auto reduction through consecutive losses
    for (let i = 0; i < 4; i++) {
      const pos = this.createMockPosition(`loss-${i}`, 'BTCUSDT', 0.1, 50000);
      this.riskManager.addPosition(pos);
      this.riskManager.closePosition(pos.id, 49000, 5); // Simulate loss
    }

    const newRiskPercent = this.riskManager.getPositionSizingParams().baseRiskPercent;
    this.assert(newRiskPercent < initialRiskPercent, 'Auto reduction should decrease position sizing');

    console.log(`  ✓ Loss limits configured and enforced`);
    console.log(`  ✓ Warnings generated near limits`);
    console.log(`  ✓ Trading blocked when limits breached`);
    console.log(`  ✓ Auto position reduction triggered`);
  }

  /**
   * Test risk metrics calculation
   */
  private async testRiskMetrics(): Promise<void> {
    // Create a portfolio with multiple positions
    const positions = [
      this.createMockPosition('risk-1', 'BTCUSDT', 0.5, 50000),
      this.createMockPosition('risk-2', 'ETHUSDT', 8.0, 3000),
      this.createMockPosition('risk-3', 'BNBUSDT', 150.0, 300)
    ];

    positions.forEach(pos => this.riskManager.addPosition(pos));

    // Generate portfolio history for metrics calculation
    const marketData = this.createMockMarketData();
    for (let i = 0; i < 50; i++) {
      // Simulate price movements
      const simulatedData = marketData.map(data => ({
        ...data,
        price: data.price * (1 + (Math.random() - 0.5) * 0.03) // ±1.5% movement
      }));
      
      this.portfolioTracker.updatePortfolioMetrics(simulatedData);
    }

    // Test comprehensive risk health
    const riskHealth = this.riskManager.getEnhancedRiskHealth();
    this.assert(riskHealth.status !== undefined, 'Risk status should be defined');
    this.assert(riskHealth.metrics.currentRisk > 0, 'Should calculate current risk');
    this.assert(riskHealth.metrics.riskUtilization >= 0, 'Risk utilization should be non-negative');
    this.assert(!!riskHealth.lossLimitStatus, 'Should provide loss limit status');

    // Test portfolio metrics
    const portfolioMetrics = this.portfolioTracker.updatePortfolioMetrics(marketData);
    this.assert(portfolioMetrics.portfolioVaR95 >= 0, 'VaR 95% should be calculated');
    this.assert(portfolioMetrics.portfolioVaR99 >= portfolioMetrics.portfolioVaR95, 'VaR 99% should be >= VaR 95%');
    this.assert(portfolioMetrics.concentrationRisk >= 0, 'Concentration risk should be calculated');
    this.assert(!!portfolioMetrics.correlationMatrix, 'Correlation matrix should be calculated');

    console.log(`  ✓ Risk health status: ${riskHealth.status}`);
    console.log(`  ✓ VaR 95%: ${portfolioMetrics.portfolioVaR95.toFixed(2)}%`);
    console.log(`  ✓ VaR 99%: ${portfolioMetrics.portfolioVaR99.toFixed(2)}%`);
    console.log(`  ✓ Concentration risk: ${portfolioMetrics.concentrationRisk.toFixed(1)}%`);
    console.log(`  ✓ Current risk utilization: ${riskHealth.metrics.riskUtilization.toFixed(1)}%`);
  }

  /**
   * Test integration service functionality
   */
  private async testIntegrationService(): Promise<void> {
    const marketData = this.createMockMarketData();
    
    // Add some positions
    const position = this.createMockPosition('integration-1', 'BTCUSDT', 0.2, 49000);
    this.riskManager.addPosition(position);

    // Test 1: Dashboard update
    const dashboardUpdate = await this.integrationService.updateSystems(marketData);
    this.assert(dashboardUpdate.timestamp > 0, 'Dashboard update should have timestamp');
    this.assert(dashboardUpdate.portfolio !== undefined, 'Should include portfolio metrics');
    this.assert(dashboardUpdate.risk !== undefined, 'Should include risk assessment');
    this.assert(dashboardUpdate.positions.length > 0, 'Should include position summaries');

    // Test 2: Benchmark comparison
    const comparison = this.integrationService.getBenchmarkComparison();
    this.assert(comparison.benchmark.symbol === 'BTC', 'Should have BTC benchmark');
    this.assert(comparison.portfolio !== undefined, 'Should include portfolio performance');
    this.assert(comparison.outperformance !== undefined, 'Should calculate outperformance');

    // Test 3: Risk-adjusted returns
    const riskAdjusted = this.integrationService.calculateRiskAdjustedReturns();
    this.assert(riskAdjusted.sharpeRatio !== undefined, 'Should calculate Sharpe ratio');
    this.assert(riskAdjusted.sortinoRatio !== undefined, 'Should calculate Sortino ratio');
    this.assert(riskAdjusted.maxDrawdown >= 0, 'Max drawdown should be non-negative');

    // Test 4: Portfolio report export
    const report = this.integrationService.exportPortfolioReport();
    this.assert(report.summary !== undefined, 'Should include portfolio summary');
    this.assert(report.performance !== undefined, 'Should include performance metrics');
    this.assert(report.exportDate > 0, 'Should have export date');

    // Test 5: System health
    const health = this.integrationService.getSystemHealth();
    this.assert(health.status !== undefined, 'Should report system health status');
    this.assert(health.components !== undefined, 'Should report component health');

    console.log(`  ✓ Dashboard updates working`);
    console.log(`  ✓ Benchmark comparison available`);
    console.log(`  ✓ Risk-adjusted returns calculated`);
    console.log(`  ✓ Portfolio report export functional`);
    console.log(`  ✓ System health monitoring active`);
  }

  /**
   * Test performance under stress conditions
   */
  private async testPerformance(): Promise<void> {
    const startTime = Date.now();

    // Test 1: Large number of positions
    console.log(`    Creating 200 positions...`);
    for (let i = 0; i < 200; i++) {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'DOTUSDT'];
      const symbol = symbols[i % symbols.length];
      const position = this.createMockPosition(`perf-${i}`, symbol, 0.01, 50000 + i);
      this.riskManager.addPosition(position);
    }

    const positionsTime = Date.now() - startTime;
    this.assert(positionsTime < 1000, 'Should create 200 positions quickly');

    // Test 2: Rapid portfolio updates
    console.log(`    Performing 500 rapid updates...`);
    const updateStartTime = Date.now();
    
    for (let i = 0; i < 500; i++) {
      const marketData = this.createMockMarketData().map(data => ({
        ...data,
        price: data.price * (1 + (Math.random() - 0.5) * 0.02)
      }));
      
      this.portfolioTracker.updatePortfolioMetrics(marketData);
    }

    const updateTime = Date.now() - updateStartTime;
    this.assert(updateTime < 5000, 'Should handle 500 updates in reasonable time');

    // Test 3: Complex calculations
    console.log(`    Running complex risk calculations...`);
    const calcStartTime = Date.now();
    
    const riskHealth = this.riskManager.getEnhancedRiskHealth();
    const portfolioMetrics = this.portfolioTracker.updatePortfolioMetrics(this.createMockMarketData());
    const positionRisks = this.portfolioTracker.getPositionRisk(this.createMockMarketData());

    const calcTime = Date.now() - calcStartTime;
    this.assert(calcTime < 1000, 'Complex calculations should complete quickly');

    const totalTime = Date.now() - startTime;

    console.log(`  ✓ 200 positions created in ${positionsTime}ms`);
    console.log(`  ✓ 500 portfolio updates in ${updateTime}ms`);
    console.log(`  ✓ Complex calculations in ${calcTime}ms`);
    console.log(`  ✓ Total performance test: ${totalTime}ms`);
  }

  /**
   * Test different market scenarios
   */
  private async testMarketScenarios(): Promise<void> {
    // Scenario 1: Bull market
    await this.testMarketScenario('Bull Market', (basePrice) => basePrice * 1.05);
    
    // Scenario 2: Bear market
    await this.testMarketScenario('Bear Market', (basePrice) => basePrice * 0.95);
    
    // Scenario 3: High volatility
    await this.testMarketScenario('High Volatility', (basePrice) => basePrice * (1 + (Math.random() - 0.5) * 0.1));
    
    // Scenario 4: Market crash
    await this.testMarketScenario('Market Crash', (basePrice) => basePrice * 0.8);
  }

  private async testMarketScenario(scenarioName: string, priceTransform: (price: number) => number): Promise<void> {
    // Reset for clean test
    this.riskManager = new RiskManager(50000);
    this.portfolioTracker = new PortfolioTracker(this.riskManager);
    
    // Add initial position
    const position = this.createMockPosition('scenario-test', 'BTCUSDT', 1.0, 50000);
    this.riskManager.addPosition(position);

    // Simulate scenario over 20 periods
    let finalValue = 50000;
    for (let i = 0; i < 20; i++) {
      const marketData = this.createMockMarketData().map(data => ({
        ...data,
        price: priceTransform(data.price)
      }));
      
      finalValue = marketData[0].price;
      this.portfolioTracker.updatePortfolioMetrics(marketData);
    }

    const metrics = this.portfolioTracker.getPortfolioHistory().slice(-1)[0];
    const riskHealth = this.riskManager.getEnhancedRiskHealth();

    console.log(`    ${scenarioName}:`);
    console.log(`      Final BTC price: $${finalValue.toFixed(2)}`);
    console.log(`      Portfolio value: $${metrics?.totalValue?.toFixed(2) || 'N/A'}`);
    console.log(`      Risk status: ${riskHealth.status}`);
    console.log(`      Max drawdown: ${metrics?.maxDrawdown?.toFixed(2) || 0}%`);
  }

  /**
   * Helper methods
   */
  private createMockMarketData(): MarketData[] {
    return [
      {
        symbol: 'BTCUSDT',
        price: 50000,
        volume24h: 1000000,
        priceChange24h: 1000,
        priceChangePercent24h: 2.04,
        bid: 49995,
        ask: 50005,
        spread: 10,
        timestamp: Date.now()
      },
      {
        symbol: 'ETHUSDT',
        price: 3000,
        volume24h: 800000,
        priceChange24h: -50,
        priceChangePercent24h: -1.64,
        bid: 2998,
        ask: 3002,
        spread: 4,
        timestamp: Date.now()
      },
      {
        symbol: 'BNBUSDT',
        price: 300,
        volume24h: 500000,
        priceChange24h: 15,
        priceChangePercent24h: 5.26,
        bid: 299.5,
        ask: 300.5,
        spread: 1,
        timestamp: Date.now()
      }
    ];
  }

  private createMockPosition(id: string, symbol: string, quantity: number, entryPrice: number): TradePosition {
    return {
      id,
      symbol,
      side: 'BUY',
      quantity,
      entryPrice,
      currentPrice: entryPrice,
      stopLoss: entryPrice * 0.97,
      takeProfit: entryPrice * 1.05,
      pnl: 0,
      pnlPercent: 0,
      status: 'OPEN',
      openTime: Date.now() - Math.random() * 3600000, // Random time in last hour
      fees: 1
    };
  }

  private createMockSignal(): TradingSignal {
    return {
      type: 'BUY',
      strength: 85,
      confidence: 78,
      reason: 'Strong bullish momentum',
      timestamp: Date.now(),
      indicators: {
        ema9: 49800,
        ema21: 49200,
        rsi: 65,
        macd: 150,
        macdSignal: 120,
        macdHistogram: 30,
        bollingerUpper: 51000,
        bollingerMiddle: 50000,
        bollingerLower: 49000,
        volume: 1000000,
        priceChange: 1000,
        priceChangePercent: 2.04
      }
    };
  }

  private assert(condition: boolean, message: string): void {
    if (!condition) {
      throw new Error(message);
    }
  }

  /**
   * Print test results summary
   */
  private printSummary(): void {
    const totalTests = this.testResults.length;
    const passedTests = this.testResults.filter(test => test.success).length;
    const failedTests = totalTests - passedTests;
    const totalDuration = this.testResults.reduce((sum, test) => sum + (test.duration || 0), 0);

    console.log(`${colors.bright}=== VALIDATION SUMMARY ===${colors.reset}`);
    console.log(`Total test suites: ${totalTests}`);
    console.log(`${colors.green}Passed: ${passedTests}${colors.reset}`);
    console.log(`${colors.red}Failed: ${failedTests}${colors.reset}`);
    console.log(`Total duration: ${totalDuration}ms\n`);

    if (failedTests > 0) {
      console.log(`${colors.red}Failed tests:${colors.reset}`);
      this.testResults
        .filter(test => !test.success)
        .forEach(test => {
          console.log(`  ${colors.red}✗ ${test.name}: ${test.details}${colors.reset}`);
        });
      console.log();
    }

    if (passedTests === totalTests) {
      console.log(`${colors.green}${colors.bright}🎉 All validation tests passed!${colors.reset}`);
      console.log(`${colors.green}Portfolio tracking and risk management enhancements are working correctly.${colors.reset}`);
    } else {
      console.log(`${colors.yellow}⚠️  Some tests failed. Please review and fix issues before deployment.${colors.reset}`);
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new ValidationSuite();
  validator.runAllTests().catch(error => {
    console.error(`${colors.red}Validation suite failed:${colors.reset}`, error);
    process.exit(1);
  });
}

export { ValidationSuite };
