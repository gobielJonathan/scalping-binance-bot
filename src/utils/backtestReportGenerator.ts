import { PerformanceReport, BacktestMetrics } from '../services/backtestingService';
import { TradePosition } from '../types';
import logger from '../services/logger';
import fs from 'fs';
import path from 'path';

export interface ReportFormat {
  json: boolean;
  text: boolean;
  csv: boolean;
  html: boolean;
}

export interface ReportConfig {
  outputDir: string;
  filePrefix: string;
  format: ReportFormat;
  includeTrades: boolean;
  includeCharts: boolean;
}

/**
 * Generates comprehensive backtesting reports
 */
export class BacktestReportGenerator {
  private config: ReportConfig;
  
  constructor(config: ReportConfig) {
    this.config = config;
    this.ensureOutputDirectory();
  }

  /**
   * Generate all report formats
   */
  async generateReport(report: PerformanceReport): Promise<string[]> {
    const generatedFiles: string[] = [];

    logger.info('Generating backtest report', {
      source: 'BacktestReportGenerator',
      context: {
        symbol: report.config.symbol,
        totalTrades: report.metrics.totalTrades,
        totalReturn: report.metrics.totalReturnPercent
      }
    });

    try {
      if (this.config.format.json) {
        const jsonFile = await this.generateJsonReport(report);
        generatedFiles.push(jsonFile);
      }

      if (this.config.format.text) {
        const textFile = await this.generateTextReport(report);
        generatedFiles.push(textFile);
      }

      if (this.config.format.csv && this.config.includeTrades) {
        const csvFile = await this.generateCsvReport(report);
        generatedFiles.push(csvFile);
      }

      if (this.config.format.html) {
        const htmlFile = await this.generateHtmlReport(report);
        generatedFiles.push(htmlFile);
      }

      logger.info('Backtest report generated successfully', {
        source: 'BacktestReportGenerator',
        context: {
          filesGenerated: generatedFiles.length,
          files: generatedFiles
        }
      });

      return generatedFiles;
    } catch (error) {
      logger.error('Failed to generate backtest report', {
        source: 'BacktestReportGenerator',
        error: { 
          stack: (error as Error).stack || undefined
        }
      });
      throw error;
    }
  }

  /**
   * Generate JSON format report
   */
  private async generateJsonReport(report: PerformanceReport): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${this.config.filePrefix}_${timestamp}.json`;
    const filePath = path.join(this.config.outputDir, filename);

    const reportData = {
      generatedAt: new Date().toISOString(),
      ...report,
      trades: this.config.includeTrades ? report.trades : undefined
    };

    fs.writeFileSync(filePath, JSON.stringify(reportData, null, 2));
    return filePath;
  }

  /**
   * Generate text format report
   */
  private async generateTextReport(report: PerformanceReport): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${this.config.filePrefix}_${timestamp}.txt`;
    const filePath = path.join(this.config.outputDir, filename);

    const content = this.formatTextReport(report);
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  /**
   * Generate CSV format for trades
   */
  private async generateCsvReport(report: PerformanceReport): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${this.config.filePrefix}_trades_${timestamp}.csv`;
    const filePath = path.join(this.config.outputDir, filename);

    const csvContent = this.formatTradesCsv(report.trades);
    fs.writeFileSync(filePath, csvContent);
    return filePath;
  }

  /**
   * Generate HTML format report
   */
  private async generateHtmlReport(report: PerformanceReport): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${this.config.filePrefix}_${timestamp}.html`;
    const filePath = path.join(this.config.outputDir, filename);

    const htmlContent = this.formatHtmlReport(report);
    fs.writeFileSync(filePath, htmlContent);
    return filePath;
  }

  /**
   * Format text report content
   */
  private formatTextReport(report: PerformanceReport): string {
    const { config, metrics, summary } = report;
    
    const lines = [
      '='.repeat(80),
      '                     BACKTESTING PERFORMANCE REPORT',
      '='.repeat(80),
      '',
      'STRATEGY CONFIGURATION',
      '-'.repeat(40),
      `Symbol:              ${config.symbol}`,
      `Timeframe:           ${config.timeframe}`,
      `Period:              ${summary.startDate} to ${summary.endDate}`,
      `Duration:            ${summary.duration}`,
      `Initial Balance:     $${config.initialBalance.toLocaleString()}`,
      `Commission Rate:     ${(config.commissionRate * 100).toFixed(3)}%`,
      `Slippage Rate:       ${(config.slippageRate * 100).toFixed(3)}%`,
      `Risk Management:     ${config.enableRiskManagement ? 'Enabled' : 'Disabled'}`,
      '',
      'PERFORMANCE SUMMARY',
      '-'.repeat(40),
      `Final Balance:       $${summary.finalBalance.toLocaleString()}`,
      `Peak Balance:        $${summary.peakBalance.toLocaleString()}`,
      `Total Return:        $${metrics.totalReturn.toLocaleString()}`,
      `Total Return %:      ${metrics.totalReturnPercent.toFixed(2)}%`,
      `Annualized Return:   ${metrics.annualizedReturn.toFixed(2)}%`,
      `Max Drawdown:        $${metrics.maxDrawdown.toLocaleString()}`,
      `Max Drawdown %:      ${metrics.maxDrawdownPercent.toFixed(2)}%`,
      '',
      'TRADING STATISTICS',
      '-'.repeat(40),
      `Total Trades:        ${metrics.totalTrades}`,
      `Winning Trades:      ${metrics.winningTrades}`,
      `Losing Trades:       ${metrics.losingTrades}`,
      `Win Rate:            ${metrics.winRate.toFixed(2)}%`,
      `Profit Factor:       ${metrics.profitFactor.toFixed(2)}`,
      `Average Win:         $${metrics.avgWin.toFixed(2)}`,
      `Average Loss:        $${metrics.avgLoss.toFixed(2)}`,
      `Largest Win:         $${metrics.largestWin.toFixed(2)}`,
      `Largest Loss:        $${metrics.largestLoss.toFixed(2)}`,
      `Consecutive Wins:    ${metrics.consecutiveWins}`,
      `Consecutive Losses:  ${metrics.consecutiveLosses}`,
      `Avg Trade Duration:  ${metrics.avgTradeDuration.toFixed(2)} hours`,
      `Expectancy:          $${metrics.expectancy.toFixed(2)}`,
      '',
      'RISK METRICS',
      '-'.repeat(40),
      `Sharpe Ratio:        ${metrics.sharpeRatio.toFixed(2)}`,
      `Sortino Ratio:       ${metrics.sortinioRatio.toFixed(2)}`,
      `Calmar Ratio:        ${metrics.calmarRatio.toFixed(2)}`,
      `System Quality:      ${metrics.systemQuality.toFixed(2)}`,
      `VaR (95%):           ${(report.riskMetrics.var95 * 100).toFixed(2)}%`,
      `VaR (99%):           ${(report.riskMetrics.var99 * 100).toFixed(2)}%`,
      `Volatility:          ${(report.riskMetrics.volatility * 100).toFixed(2)}%`,
      '',
    ];

    if (this.config.includeTrades && report.trades.length > 0) {
      lines.push(
        'MONTHLY PERFORMANCE',
        '-'.repeat(40)
      );

      for (const monthData of report.monthlyReturns) {
        lines.push(`${monthData.month}:        ${monthData.return.toFixed(2)}% (${monthData.trades} trades)`);
      }

      lines.push('');
    }

    lines.push(
      'PERFORMANCE ANALYSIS',
      '-'.repeat(40),
      this.generatePerformanceAnalysis(metrics),
      '',
      'RECOMMENDATIONS',
      '-'.repeat(40),
      this.generateRecommendations(metrics),
      '',
      '='.repeat(80),
      `Report generated: ${new Date().toLocaleString()}`,
      '='.repeat(80)
    );

    return lines.join('\n');
  }

  /**
   * Format trades as CSV
   */
  private formatTradesCsv(trades: TradePosition[]): string {
    const headers = [
      'Trade ID',
      'Symbol',
      'Side',
      'Quantity',
      'Entry Price',
      'Exit Price',
      'Stop Loss',
      'Take Profit',
      'P&L',
      'P&L %',
      'Fees',
      'Open Time',
      'Close Time',
      'Duration (hours)',
      'Status'
    ];

    const rows = trades.map(trade => [
      trade.id,
      trade.symbol,
      trade.side,
      trade.quantity.toFixed(6),
      trade.entryPrice.toFixed(2),
      trade.currentPrice.toFixed(2),
      trade.stopLoss.toFixed(2),
      trade.takeProfit.toFixed(2),
      trade.pnl.toFixed(2),
      trade.pnlPercent.toFixed(2),
      trade.fees.toFixed(2),
      new Date(trade.openTime).toISOString(),
      trade.closeTime ? new Date(trade.closeTime).toISOString() : '',
      trade.closeTime ? ((trade.closeTime - trade.openTime) / (1000 * 60 * 60)).toFixed(2) : '',
      trade.status
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  /**
   * Format HTML report
   */
  private formatHtmlReport(report: PerformanceReport): string {
    const { config, metrics, summary } = report;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Backtest Report - ${config.symbol}</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 20px; line-height: 1.6; }
        .header { text-align: center; background: #f5f5f5; padding: 20px; border-radius: 8px; }
        .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px; }
        .metric-card { background: #f9f9f9; padding: 15px; border-radius: 5px; text-align: center; }
        .metric-value { font-size: 1.5em; font-weight: bold; color: #2c3e50; }
        .positive { color: #27ae60; }
        .negative { color: #e74c3c; }
        .neutral { color: #f39c12; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
        .chart-placeholder { background: #f0f0f0; height: 300px; display: flex; align-items: center; justify-content: center; border-radius: 5px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Backtesting Performance Report</h1>
        <h2>${config.symbol} - ${config.timeframe}</h2>
        <p>${summary.startDate} to ${summary.endDate}</p>
    </div>

    <div class="section">
        <h3>Key Performance Metrics</h3>
        <div class="metrics-grid">
            <div class="metric-card">
                <div class="metric-value ${this.getColorClass(metrics.totalReturnPercent)}">${metrics.totalReturnPercent.toFixed(2)}%</div>
                <div>Total Return</div>
            </div>
            <div class="metric-card">
                <div class="metric-value ${this.getColorClass(metrics.winRate - 50)}">${metrics.winRate.toFixed(2)}%</div>
                <div>Win Rate</div>
            </div>
            <div class="metric-card">
                <div class="metric-value ${this.getColorClass(-metrics.maxDrawdownPercent)}">${metrics.maxDrawdownPercent.toFixed(2)}%</div>
                <div>Max Drawdown</div>
            </div>
            <div class="metric-card">
                <div class="metric-value ${this.getColorClass(metrics.sharpeRatio)}">${metrics.sharpeRatio.toFixed(2)}</div>
                <div>Sharpe Ratio</div>
            </div>
            <div class="metric-card">
                <div class="metric-value">${metrics.totalTrades}</div>
                <div>Total Trades</div>
            </div>
            <div class="metric-card">
                <div class="metric-value ${this.getColorClass(metrics.profitFactor - 1)}">${metrics.profitFactor.toFixed(2)}</div>
                <div>Profit Factor</div>
            </div>
        </div>
    </div>

    <div class="section">
        <h3>Trading Statistics</h3>
        <table>
            <tr><td><strong>Total Trades</strong></td><td>${metrics.totalTrades}</td></tr>
            <tr><td><strong>Winning Trades</strong></td><td>${metrics.winningTrades}</td></tr>
            <tr><td><strong>Losing Trades</strong></td><td>${metrics.losingTrades}</td></tr>
            <tr><td><strong>Average Win</strong></td><td>$${metrics.avgWin.toFixed(2)}</td></tr>
            <tr><td><strong>Average Loss</strong></td><td>$${metrics.avgLoss.toFixed(2)}</td></tr>
            <tr><td><strong>Largest Win</strong></td><td>$${metrics.largestWin.toFixed(2)}</td></tr>
            <tr><td><strong>Largest Loss</strong></td><td>$${metrics.largestLoss.toFixed(2)}</td></tr>
            <tr><td><strong>Avg Trade Duration</strong></td><td>${metrics.avgTradeDuration.toFixed(2)} hours</td></tr>
        </table>
    </div>

    <div class="section">
        <h3>Risk Metrics</h3>
        <table>
            <tr><td><strong>Sharpe Ratio</strong></td><td>${metrics.sharpeRatio.toFixed(2)}</td></tr>
            <tr><td><strong>Sortino Ratio</strong></td><td>${metrics.sortinioRatio.toFixed(2)}</td></tr>
            <tr><td><strong>Calmar Ratio</strong></td><td>${metrics.calmarRatio.toFixed(2)}</td></tr>
            <tr><td><strong>VaR (95%)</strong></td><td>${(report.riskMetrics.var95 * 100).toFixed(2)}%</td></tr>
            <tr><td><strong>VaR (99%)</strong></td><td>${(report.riskMetrics.var99 * 100).toFixed(2)}%</td></tr>
            <tr><td><strong>Volatility</strong></td><td>${(report.riskMetrics.volatility * 100).toFixed(2)}%</td></tr>
        </table>
    </div>

    ${this.config.includeCharts ? this.generateChartsHtml(report) : ''}

    <div class="section">
        <h3>Performance Analysis</h3>
        <p>${this.generatePerformanceAnalysis(metrics)}</p>
    </div>

    <div class="section">
        <h3>Recommendations</h3>
        <p>${this.generateRecommendations(metrics)}</p>
    </div>

    <div class="section">
        <p><em>Report generated: ${new Date().toLocaleString()}</em></p>
    </div>
</body>
</html>`;
  }

  /**
   * Generate charts HTML section
   */
  private generateChartsHtml(_report: PerformanceReport): string {
    return `
    <div class="section">
        <h3>Performance Charts</h3>
        <div class="chart-placeholder">
            Equity Curve Chart
            <br><small>(Chart implementation requires additional charting library)</small>
        </div>
        <br>
        <div class="chart-placeholder">
            Drawdown Chart
            <br><small>(Chart implementation requires additional charting library)</small>
        </div>
        <br>
        <div class="chart-placeholder">
            Monthly Returns Chart
            <br><small>(Chart implementation requires additional charting library)</small>
        </div>
    </div>`;
  }

  /**
   * Get CSS color class based on value
   */
  private getColorClass(value: number): string {
    if (value > 0) return 'positive';
    if (value < 0) return 'negative';
    return 'neutral';
  }

  /**
   * Generate performance analysis text
   */
  private generatePerformanceAnalysis(metrics: BacktestMetrics): string {
    const analysis: string[] = [];

    // Overall performance
    if (metrics.totalReturnPercent > 10) {
      analysis.push('Strong positive returns demonstrate effective strategy performance.');
    } else if (metrics.totalReturnPercent > 0) {
      analysis.push('Modest positive returns, strategy shows potential but may need optimization.');
    } else {
      analysis.push('Negative returns indicate strategy needs significant improvement.');
    }

    // Win rate analysis
    if (metrics.winRate > 60) {
      analysis.push('High win rate suggests good signal quality.');
    } else if (metrics.winRate > 40) {
      analysis.push('Moderate win rate is acceptable if profit factor is strong.');
    } else {
      analysis.push('Low win rate requires review of entry/exit criteria.');
    }

    // Sharpe ratio analysis
    if (metrics.sharpeRatio > 1.5) {
      analysis.push('Excellent risk-adjusted returns with strong Sharpe ratio.');
    } else if (metrics.sharpeRatio > 1.0) {
      analysis.push('Good risk-adjusted performance.');
    } else if (metrics.sharpeRatio > 0.5) {
      analysis.push('Moderate risk-adjusted returns, consider risk management improvements.');
    } else {
      analysis.push('Poor risk-adjusted returns, strategy may be too risky.');
    }

    // Drawdown analysis
    if (metrics.maxDrawdownPercent < 10) {
      analysis.push('Low maximum drawdown indicates good capital preservation.');
    } else if (metrics.maxDrawdownPercent < 20) {
      analysis.push('Moderate drawdown levels are manageable.');
    } else {
      analysis.push('High drawdown levels may be concerning for risk management.');
    }

    return analysis.join(' ');
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(metrics: BacktestMetrics): string {
    const recommendations: string[] = [];

    if (metrics.winRate < 40) {
      recommendations.push('Consider improving signal quality or tightening entry criteria.');
    }

    if (metrics.profitFactor < 1.2) {
      recommendations.push('Review risk/reward ratios and consider wider profit targets.');
    }

    if (metrics.maxDrawdownPercent > 15) {
      recommendations.push('Implement stronger risk management and position sizing controls.');
    }

    if (metrics.sharpeRatio < 1.0) {
      recommendations.push('Focus on reducing volatility while maintaining returns.');
    }

    if (metrics.avgTradeDuration > 24) {
      recommendations.push('Consider shorter holding periods to reduce exposure time.');
    }

    if (metrics.consecutiveLosses > 5) {
      recommendations.push('Implement daily loss limits to prevent extended losing streaks.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Strong performance across all metrics. Consider scaling up position sizes.');
    }

    return recommendations.join(' ');
  }

  /**
   * Ensure output directory exists
   */
  private ensureOutputDirectory(): void {
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  /**
   * Generate performance summary for console output
   */
  static generateQuickSummary(report: PerformanceReport): string {
    const { metrics, summary } = report;
    
    return `
╔══════════════════════════════════════════════════════════════════════════════╗
║                            BACKTEST SUMMARY                                  ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ Symbol: ${report.config.symbol.padEnd(15)} │ Period: ${summary.duration.padEnd(25)} ║
║ Trades: ${metrics.totalTrades.toString().padEnd(15)} │ Win Rate: ${metrics.winRate.toFixed(1).padEnd(23)}% ║
║ Return: ${metrics.totalReturnPercent.toFixed(2).padEnd(14)}% │ Max DD: ${metrics.maxDrawdownPercent.toFixed(2).padEnd(24)}% ║
║ Sharpe: ${metrics.sharpeRatio.toFixed(2).padEnd(15)} │ Profit Factor: ${metrics.profitFactor.toFixed(2).padEnd(18)} ║
╚══════════════════════════════════════════════════════════════════════════════╝`;
  }
}