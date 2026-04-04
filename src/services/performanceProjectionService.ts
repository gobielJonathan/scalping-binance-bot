/**
 * Performance projection service for 1:2 risk-reward ratio
 * Calculates expected returns, win rates, and risk metrics
 */

import config from '../config';

export interface PerformanceProjection {
  riskRewardRatio: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  minimumWinRate: number;
  projectedWinRate: number;
  expectedDailyReturn: number;
  expectedMonthlyReturn: number;
  maxDrawdownRisk: number;
  profitFactor: number;
  breakEvenTrades: number;
}

export class PerformanceProjectionService {
  private readonly riskRewardRatio: number;
  private readonly stopLossPercent: number;
  private readonly takeProfitPercent: number;

  constructor() {
    this.stopLossPercent = config.trading.stopLossPercentage;
    this.takeProfitPercent = config.trading.takeProfitPercentage;
    this.riskRewardRatio = this.takeProfitPercent / this.stopLossPercent;
  }

  /**
   * Calculate comprehensive performance projections
   */
  calculateProjections(): PerformanceProjection {
    // Minimum win rate required for profitability with 1:2 ratio
    // Formula: 1 / (1 + risk-reward-ratio)
    const minimumWinRate = 1 / (1 + this.riskRewardRatio);
    
    // Projected win rate (conservative estimate for scalping)
    // With better risk-reward, we can accept lower win rate
    const projectedWinRate = 0.45; // 45% (conservative for scalping)
    
    // Expected daily return calculation
    const avgWinPercent = this.takeProfitPercent;
    const avgLossPercent = this.stopLossPercent;
    const dailyTrades = 25; // Conservative estimate for scalping
    
    const expectedDailyReturn = this.calculateExpectedReturn(
      projectedWinRate,
      avgWinPercent,
      avgLossPercent,
      dailyTrades
    );
    
    // Expected monthly return (compound growth)
    const tradingDaysPerMonth = 22;
    const expectedMonthlyReturn = Math.pow(1 + expectedDailyReturn, tradingDaysPerMonth) - 1;
    
    // Maximum drawdown risk (worst-case scenario)
    const consecutiveLosses = 5; // Risk management limit
    const maxDrawdownRisk = consecutiveLosses * avgLossPercent;
    
    // Profit factor
    const profitFactor = (projectedWinRate * avgWinPercent) / ((1 - projectedWinRate) * avgLossPercent);
    
    // Break-even point (how many wins needed to cover losses)
    const breakEvenTrades = Math.ceil(1 / this.riskRewardRatio);
    
    return {
      riskRewardRatio: Number(this.riskRewardRatio.toFixed(1)),
      stopLossPercent: this.stopLossPercent,
      takeProfitPercent: this.takeProfitPercent,
      minimumWinRate: Number(minimumWinRate.toFixed(3)),
      projectedWinRate: projectedWinRate,
      expectedDailyReturn: Number(expectedDailyReturn.toFixed(4)),
      expectedMonthlyReturn: Number(expectedMonthlyReturn.toFixed(4)),
      maxDrawdownRisk: Number(maxDrawdownRisk.toFixed(4)),
      profitFactor: Number(profitFactor.toFixed(2)),
      breakEvenTrades: breakEvenTrades
    };
  }

  /**
   * Calculate expected return based on win rate and trade outcomes
   */
  private calculateExpectedReturn(
    winRate: number,
    avgWinPercent: number,
    avgLossPercent: number,
    tradesPerDay: number
  ): number {
    const expectedValuePerTrade = (winRate * avgWinPercent) - ((1 - winRate) * avgLossPercent);
    return expectedValuePerTrade * tradesPerDay;
  }

  /**
   * Get performance comparison between old and new ratio
   */
  getPerformanceComparison(): {
    oldRatio: any;
    newRatio: any;
    improvement: any;
  } {
    // Old configuration (0.3% risk, 0.5% reward = 1.67:1)
    const oldRatio = {
      ratio: 1.67,
      minimumWinRate: 0.375, // 37.5%
      projectedWinRate: 0.70, // Needed higher win rate
      expectedDailyReturn: this.calculateExpectedReturn(0.70, 0.005, 0.003, 25)
    };

    const newProjections = this.calculateProjections();
    
    const improvement = {
      ratioImprovement: ((this.riskRewardRatio - oldRatio.ratio) / oldRatio.ratio * 100).toFixed(1),
      winRateReduction: ((oldRatio.projectedWinRate - newProjections.projectedWinRate) * 100).toFixed(1),
      returnImprovement: ((newProjections.expectedDailyReturn - oldRatio.expectedDailyReturn) / oldRatio.expectedDailyReturn * 100).toFixed(1)
    };

    return {
      oldRatio,
      newRatio: newProjections,
      improvement
    };
  }

  /**
   * Validate if current configuration meets 1:2 minimum
   */
  validateConfiguration(): {
    isValid: boolean;
    actualRatio: number;
    targetRatio: number;
    recommendation: string;
  } {
    const targetRatio = 2.0;
    const isValid = this.riskRewardRatio >= targetRatio;
    
    let recommendation: string;
    if (isValid) {
      recommendation = 'Configuration meets 1:2 minimum risk-reward ratio';
    } else {
      const requiredTakeProfit = this.stopLossPercent * targetRatio;
      recommendation = `Increase take-profit to ${(requiredTakeProfit * 100).toFixed(2)}% to achieve 1:2 ratio`;
    }

    return {
      isValid,
      actualRatio: Number(this.riskRewardRatio.toFixed(2)),
      targetRatio,
      recommendation
    };
  }

  /**
   * Get formatted performance summary for dashboard
   */
  getFormattedSummary(): any {
    const projections = this.calculateProjections();
    
    return {
      riskManagement: {
        riskRewardRatio: `${projections.riskRewardRatio}:1`,
        stopLoss: `${(projections.stopLossPercent * 100).toFixed(1)}%`,
        takeProfit: `${(projections.takeProfitPercent * 100).toFixed(1)}%`,
        minimumWinRate: `${(projections.minimumWinRate * 100).toFixed(1)}%`
      },
      projectedPerformance: {
        targetWinRate: `${(projections.projectedWinRate * 100).toFixed(0)}%`,
        dailyReturn: `${(projections.expectedDailyReturn * 100).toFixed(2)}%`,
        monthlyReturn: `${(projections.expectedMonthlyReturn * 100).toFixed(1)}%`,
        profitFactor: projections.profitFactor
      },
      riskMetrics: {
        maxDrawdown: `${(projections.maxDrawdownRisk * 100).toFixed(1)}%`,
        breakEvenRatio: `1 win covers ${projections.breakEvenTrades} losses`
      }
    };
  }
}

export default new PerformanceProjectionService();