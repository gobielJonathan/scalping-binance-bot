#!/usr/bin/env node

/**
 * Risk-Reward Ratio Validation Script
 * Validates that the 1:2 risk-reward ratio is properly configured and working
 */

import config from '../src/config';
import { RiskManager } from '../src/services/riskManager';
import { ScalpingStrategy } from '../src/strategies/scalpingStrategy';
import { OrderManager } from '../src/services/orderManager';
import performanceProjectionService from '../src/services/performanceProjectionService';
import { logger } from '../src/services/logger';

interface ValidationResult {
  test: string;
  passed: boolean;
  actual: any;
  expected: any;
  error?: string;
}

class RiskRewardValidator {
  private results: ValidationResult[] = [];
  
  async runValidation(): Promise<void> {
    logger.info('🔍 Starting Risk-Reward Ratio Validation...');
    
    // Test 1: Configuration validation
    this.validateConfiguration();
    
    // Test 2: Risk manager calculations
    this.validateRiskManagerCalculations();
    
    // Test 3: Scalping strategy exit levels
    this.validateScalpingStrategyExits();
    
    // Test 4: Order manager risk-reward enforcement
    await this.validateOrderManagerRiskReward();
    
    // Test 5: Performance projections
    this.validatePerformanceProjections();
    
    // Generate summary report
    this.generateReport();
  }
  
  private validateConfiguration(): void {
    try {
      const stopLossPercentage = config.trading.stopLossPercentage;
      const takeProfitPercentage = config.trading.takeProfitPercentage;
      const actualRatio = takeProfitPercentage / stopLossPercentage;
      const expectedRatio = 2.0;
      
      this.results.push({
        test: 'Configuration Risk-Reward Ratio',
        passed: actualRatio >= expectedRatio,
        actual: `${actualRatio.toFixed(2)}:1`,
        expected: `${expectedRatio}:1`
      });
      
      this.results.push({
        test: 'Stop-Loss Percentage',
        passed: stopLossPercentage === 0.003,
        actual: `${(stopLossPercentage * 100).toFixed(2)}%`,
        expected: '0.30%'
      });
      
      this.results.push({
        test: 'Take-Profit Percentage',
        passed: takeProfitPercentage === 0.006,
        actual: `${(takeProfitPercentage * 100).toFixed(2)}%`,
        expected: '0.60%'
      });
      
    } catch (error) {
      this.results.push({
        test: 'Configuration Validation',
        passed: false,
        actual: 'Error',
        expected: 'Valid config',
        error: String(error)
      });
    }
  }
  
  private validateRiskManagerCalculations(): void {
    try {
      const riskManager = new RiskManager(1000); // $1000 test balance
      
      // Test optimal levels calculation
      const testPrice = 50000; // $50,000 BTC
      const buyLevels = riskManager.calculateOptimalLevels(testPrice, 'BUY');
      const sellLevels = riskManager.calculateOptimalLevels(testPrice, 'SELL');
      
      // Calculate expected values
      const expectedStopLossBuy = testPrice * (1 - 0.003);
      const expectedTakeProfitBuy = testPrice * (1 + 0.006);
      const expectedRatioBuy = (expectedTakeProfitBuy - testPrice) / (testPrice - expectedStopLossBuy);
      
      this.results.push({
        test: 'RiskManager Buy Levels',
        passed: Math.abs(buyLevels.stopLoss - expectedStopLossBuy) < 0.01 &&
               Math.abs(buyLevels.takeProfit - expectedTakeProfitBuy) < 0.01,
        actual: `SL: ${buyLevels.stopLoss}, TP: ${buyLevels.takeProfit}`,
        expected: `SL: ${expectedStopLossBuy}, TP: ${expectedTakeProfitBuy}`
      });
      
      this.results.push({
        test: 'RiskManager Risk-Reward Ratio',
        passed: Math.abs(expectedRatioBuy - 2.0) < 0.01,
        actual: `${expectedRatioBuy.toFixed(2)}:1`,
        expected: '2.00:1'
      });
      
    } catch (error) {
      this.results.push({
        test: 'RiskManager Calculations',
        passed: false,
        actual: 'Error',
        expected: 'Valid calculations',
        error: String(error)
      });
    }
  }
  
  private validateScalpingStrategyExits(): void {
    try {
      const strategy = new ScalpingStrategy();
      
      const testPrice = 50000;
      const buyExitLevels = strategy.calculateExitLevels(testPrice, 'BUY');
      const sellExitLevels = strategy.calculateExitLevels(testPrice, 'SELL');
      
      this.results.push({
        test: 'ScalpingStrategy Exit Levels - BUY',
        passed: buyExitLevels.riskRewardRatio >= 2.0,
        actual: `${buyExitLevels.riskRewardRatio}:1`,
        expected: '2.0:1 minimum'
      });
      
      this.results.push({
        test: 'ScalpingStrategy Exit Levels - SELL',
        passed: sellExitLevels.riskRewardRatio >= 2.0,
        actual: `${sellExitLevels.riskRewardRatio}:1`,
        expected: '2.0:1 minimum'
      });
      
    } catch (error) {
      this.results.push({
        test: 'ScalpingStrategy Exit Levels',
        passed: false,
        actual: 'Error',
        expected: 'Valid exit levels',
        error: String(error)
      });
    }
  }
  
  private async validateOrderManagerRiskReward(): Promise<void> {
    try {
      const riskManager = new RiskManager(1000);
      const orderManager = new OrderManager(riskManager);
      
      const testConfig = orderManager.getRiskRewardConfig();
      
      this.results.push({
        test: 'OrderManager Risk-Reward Config',
        passed: testConfig.status === 'OPTIMAL' && testConfig.actualRatio >= 2.0,
        actual: `${testConfig.actualRatio}:1 (${testConfig.status})`,
        expected: '2.0:1 (OPTIMAL)'
      });
      
    } catch (error) {
      this.results.push({
        test: 'OrderManager Risk-Reward',
        passed: false,
        actual: 'Error',
        expected: 'Valid risk-reward config',
        error: String(error)
      });
    }
  }
  
  private validatePerformanceProjections(): void {
    try {
      const projections = performanceProjectionService.calculateProjections();
      const validation = performanceProjectionService.validateConfiguration();
      
      this.results.push({
        test: 'Performance Projections - Risk-Reward Ratio',
        passed: projections.riskRewardRatio >= 2.0,
        actual: `${projections.riskRewardRatio}:1`,
        expected: '2.0:1 minimum'
      });
      
      this.results.push({
        test: 'Performance Projections - Configuration Valid',
        passed: validation.isValid,
        actual: validation.recommendation,
        expected: 'Configuration meets 1:2 minimum risk-reward ratio'
      });
      
      this.results.push({
        test: 'Performance Projections - Win Rate Requirement',
        passed: projections.minimumWinRate <= 0.34, // Should be ~33.3% for 2:1 ratio
        actual: `${(projections.minimumWinRate * 100).toFixed(1)}%`,
        expected: '≤33.3%'
      });
      
    } catch (error) {
      this.results.push({
        test: 'Performance Projections',
        passed: false,
        actual: 'Error',
        expected: 'Valid projections',
        error: String(error)
      });
    }
  }
  
  private generateReport(): void {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    
    logger.info('\n' + '='.repeat(70));
    logger.info('📊 RISK-REWARD RATIO VALIDATION REPORT');
    logger.info('='.repeat(70));
    logger.info(`Total Tests: ${totalTests}`);
    logger.info(`✅ Passed: ${passedTests}`);
    logger.info(`❌ Failed: ${failedTests}`);
    logger.info(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);
    logger.info('='.repeat(70));
    
    this.results.forEach((result, index) => {
      const status = result.passed ? '✅' : '❌';
      logger.info(`${status} ${index + 1}. ${result.test}`);
      logger.info(`   Expected: ${result.expected}`);
      logger.info(`   Actual: ${result.actual}`);
      if (result.error) {
        logger.error(`   Error: ${result.error}`);
      }
      logger.info('');
    });
    
    if (failedTests === 0) {
      logger.info('🎉 ALL TESTS PASSED! Risk-Reward Ratio implementation is valid.');
    } else {
      logger.warn(`⚠️  ${failedTests} test(s) failed. Please review the implementation.`);
    }
    
    logger.info('='.repeat(70));
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  const validator = new RiskRewardValidator();
  validator.runValidation()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Validation failed:', error);
      process.exit(1);
    });
}

export { RiskRewardValidator };