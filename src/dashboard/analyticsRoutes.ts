import {Router} from 'express';
import { TradeAnalyticsService } from '../services/tradeAnalyticsService';
import { DatabaseService } from '../database/databaseService';
import { logger } from '../services/logger';
import BinanceService from '../services/binanceService';
import config from '../config';

const router = Router();
const analyticsService = new TradeAnalyticsService();
const databaseService = new DatabaseService();
const binanceService = new BinanceService();

// Initialize once and reuse the same promise so concurrent requests never
// race through initializeDatabase() at the same time.
const initPromise: Promise<void> = (async () => {
  await databaseService.initializeDatabase();
  await analyticsService.initialize();
})();

/**
 * Initialize analytics service
 */
router.use(async (req, res, next) => {
  try {
    await initPromise;
    next();
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to initialize analytics service', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
});

/**
 * GET /api/analytics/summary
 * Get analytics summary for dashboard
 */
router.get('/summary', async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      symbols, 
      mode = 'paper' 
    } = req.query;

    const options: any = {};
    
    if (startDate) options.startDate = parseInt(startDate as string);
    if (endDate) options.endDate = parseInt(endDate as string);
    if (symbols) options.symbols = (symbols as string).split(',');
    if (mode) options.mode = mode as 'paper' | 'live';

    const report = await analyticsService.generateReport(options);
    
    // Return condensed summary for dashboard
    res.json({
      summary: report.summary,
      period: report.period,
      insights: report.insights.slice(0, 3), // Top 3 insights
      warnings: report.warnings.slice(0, 2), // Top 2 warnings
      generated: report.generated
    });
    
  } catch (error) {
    logger.error('Analytics summary error:', { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
    res.status(500).json({ 
      error: 'Failed to generate analytics summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/report
 * Get full analytics report
 */
router.get('/report', async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      symbols, 
      mode = 'paper' 
    } = req.query;

    const options: any = {};
    
    if (startDate) options.startDate = parseInt(startDate as string);
    if (endDate) options.endDate = parseInt(endDate as string);
    if (symbols) options.symbols = (symbols as string).split(',');
    if (mode) options.mode = mode as 'paper' | 'live';

    const report = await analyticsService.generateReport(options);
    res.json(report);
    
  } catch (error) {
    logger.error('Analytics report error:', { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
    res.status(500).json({ 
      error: 'Failed to generate analytics report',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/performance/symbol
 * Get performance breakdown by trading symbol
 */
router.get('/performance/symbol', async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      mode = 'paper' 
    } = req.query;

    const options: any = {};
    
    if (startDate) options.startDate = parseInt(startDate as string);
    if (endDate) options.endDate = parseInt(endDate as string);
    if (mode) options.mode = mode as 'paper' | 'live';

    const performance = await analyticsService.getPerformanceBySymbol(options);
    res.json(performance);
    
  } catch (error) {
    logger.error('Symbol performance error:', { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
    res.status(500).json({ 
      error: 'Failed to get symbol performance',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/performance/time-of-day
 * Get performance breakdown by time of day
 */
router.get('/performance/time-of-day', async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      mode = 'paper' 
    } = req.query;

    const options: any = {};
    
    if (startDate) options.startDate = parseInt(startDate as string);
    if (endDate) options.endDate = parseInt(endDate as string);
    if (mode) options.mode = mode as 'paper' | 'live';

    const performance = await analyticsService.getPerformanceByTimeOfDay(options);
    res.json(performance);
    
  } catch (error) {
    logger.error('Time of day performance error:', { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
    res.status(500).json({ 
      error: 'Failed to get time of day performance',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/performance/day-of-week
 * Get performance breakdown by day of week
 */
router.get('/performance/day-of-week', async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      mode = 'paper' 
    } = req.query;

    const options: any = {};
    
    if (startDate) options.startDate = parseInt(startDate as string);
    if (endDate) options.endDate = parseInt(endDate as string);
    if (mode) options.mode = mode as 'paper' | 'live';

    const performance = await analyticsService.getPerformanceByDayOfWeek(options);
    res.json(performance);
    
  } catch (error) {
    logger.error('Day of week performance error:', { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
    res.status(500).json({ 
      error: 'Failed to get day of week performance',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/drawdown
 * Get drawdown analysis
 */
router.get('/drawdown', async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      symbols, 
      mode = 'paper' 
    } = req.query;

    const options: any = {};
    
    if (startDate) options.startDate = parseInt(startDate as string);
    if (endDate) options.endDate = parseInt(endDate as string);
    if (symbols) options.symbols = (symbols as string).split(',');
    if (mode) options.mode = mode as 'paper' | 'live';

    const report = await analyticsService.generateReport(options);
    res.json(report.drawdown);
    
  } catch (error) {
    logger.error('Drawdown analysis error:', { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
    res.status(500).json({ 
      error: 'Failed to get drawdown analysis',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/streaks
 * Get win/loss streak analysis
 */
router.get('/streaks', async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      symbols, 
      mode = 'paper' 
    } = req.query;

    const options: any = {};
    
    if (startDate) options.startDate = parseInt(startDate as string);
    if (endDate) options.endDate = parseInt(endDate as string);
    if (symbols) options.symbols = (symbols as string).split(',');
    if (mode) options.mode = mode as 'paper' | 'live';

    const report = await analyticsService.generateReport(options);
    res.json(report.streaks);
    
  } catch (error) {
    logger.error('Streak analysis error:', { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
    res.status(500).json({ 
      error: 'Failed to get streak analysis',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/risk
 * Get risk metrics
 */
router.get('/risk', async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      symbols, 
      mode = 'paper' 
    } = req.query;

    const options: any = {};
    
    if (startDate) options.startDate = parseInt(startDate as string);
    if (endDate) options.endDate = parseInt(endDate as string);
    if (symbols) options.symbols = (symbols as string).split(',');
    if (mode) options.mode = mode as 'paper' | 'live';

    const report = await analyticsService.generateReport(options);
    res.json(report.risk);
    
  } catch (error) {
    logger.error('Risk metrics error:', { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
    res.status(500).json({ 
      error: 'Failed to get risk metrics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/trends
 * Get trend analysis
 */
router.get('/trends', async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      symbols, 
      mode = 'paper' 
    } = req.query;

    const options: any = {};
    
    if (startDate) options.startDate = parseInt(startDate as string);
    if (endDate) options.endDate = parseInt(endDate as string);
    if (symbols) options.symbols = (symbols as string).split(',');
    if (mode) options.mode = mode as 'paper' | 'live';

    const report = await analyticsService.generateReport(options);
    res.json(report.trends);
    
  } catch (error) {
    logger.error('Trend analysis error:', { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
    res.status(500).json({ 
      error: 'Failed to get trend analysis',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/analytics/export
 * Export analytics data
 */
router.post('/export', async (req, res) => {
  try {
    const { 
      format = 'json',
      includeCharts = false,
      dateRange,
      symbols,
      groupBy = 'day',
      metrics
    } = req.body;

    const exportOptions = {
      format: format as 'json' | 'csv' | 'xlsx' | 'pdf',
      includeCharts,
      dateRange,
      symbols,
      groupBy,
      metrics
    };

    const filePath = await analyticsService.exportAnalytics(exportOptions);
    
    res.json({
      success: true,
      filePath,
      format,
      generated: Date.now()
    });
    
  } catch (error) {
    logger.error('Analytics export error:', { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
    res.status(500).json({ 
      error: 'Failed to export analytics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/trades
 * Get trade history with analytics context
 */
router.get('/trades', async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      symbols, 
      mode = 'paper',
      limit = '100',
      offset = '0',
      sortBy = 'openTime',
      sortOrder = 'DESC'
    } = req.query;

    let query = `
      SELECT t.*, 
             CASE 
               WHEN t.pnl > 0 THEN 'WIN'
               WHEN t.pnl < 0 THEN 'LOSS'
               ELSE 'BREAKEVEN'
             END as outcome,
             ROUND(t.pnlPercent, 2) as pnlPercentRounded,
             ROUND(t.pnl, 2) as pnlRounded,
             datetime(t.openTime/1000, 'unixepoch') as openTimeFormatted,
             datetime(t.closeTime/1000, 'unixepoch') as closeTimeFormatted,
             CASE 
               WHEN t.closeTime IS NOT NULL 
               THEN (t.closeTime - t.openTime) / 1000.0 / 3600.0 
               ELSE NULL 
             END as durationHours
      FROM trades t 
      WHERE 1=1
    `;
    
    const params: any[] = [];

    if (startDate) {
      query += ' AND t.openTime >= ?';
      params.push(parseInt(startDate as string));
    }

    if (endDate) {
      query += ' AND t.openTime <= ?';
      params.push(parseInt(endDate as string));
    }

    if (symbols) {
      const symbolList = (symbols as string).split(',');
      query += ` AND t.symbol IN (${symbolList.map(() => '?').join(',')})`;
      params.push(...symbolList);
    }

    if (mode) {
      query += ' AND t.mode = ?';
      params.push(mode);
    }

    query += ` ORDER BY t.${sortBy} ${sortOrder}`;
    query += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit as string), parseInt(offset as string));

    const trades = await databaseService.queryAll(query, params);
    
    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM trades t WHERE 1=1';
    const countParams: any[] = [];

    if (startDate) {
      countQuery += ' AND t.openTime >= ?';
      countParams.push(parseInt(startDate as string));
    }

    if (endDate) {
      countQuery += ' AND t.openTime <= ?';
      countParams.push(parseInt(endDate as string));
    }

    if (symbols) {
      const symbolList = (symbols as string).split(',');
      countQuery += ` AND t.symbol IN (${symbolList.map(() => '?').join(',')})`;
      countParams.push(...symbolList);
    }

    if (mode) {
      countQuery += ' AND t.mode = ?';
      countParams.push(mode);
    }

    const countResult = await databaseService.queryGet(countQuery, countParams) as { total: number };

    res.json({
      trades,
      pagination: {
        total: countResult.total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        pages: Math.ceil(countResult.total / parseInt(limit as string))
      }
    });
    
  } catch (error) {
    logger.error('Trade history error:', { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
    res.status(500).json({ 
      error: 'Failed to get trade history',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/analytics/stats
 * Get quick statistics for dashboard widgets
 */
router.get('/stats', async (req, res) => {
  try {
    const { mode = 'paper' } = req.query;
    
    // Get basic counts and metrics
    const stats = await databaseService.queryAll(`
      SELECT 
        COUNT(*) as totalTrades,
        COUNT(CASE WHEN status = 'CLOSED' THEN 1 END) as closedTrades,
        COUNT(CASE WHEN status = 'OPEN' THEN 1 END) as openTrades,
        COUNT(CASE WHEN pnl > 0 THEN 1 END) as winningTrades,
        COUNT(CASE WHEN pnl < 0 THEN 1 END) as losingTrades,
        COUNT(DISTINCT symbol) as uniqueSymbols,
        SUM(CASE WHEN status = 'CLOSED' THEN pnl ELSE 0 END) as totalPnl,
        AVG(CASE WHEN status = 'CLOSED' AND pnl > 0 THEN pnl END) as avgWin,
        AVG(CASE WHEN status = 'CLOSED' AND pnl < 0 THEN ABS(pnl) END) as avgLoss,
        MAX(pnl) as bestTrade,
        MIN(pnl) as worstTrade,
        SUM(fees) as totalFees
      FROM trades 
      WHERE mode = ?
    `, [mode]);

    const todayStats = await databaseService.queryAll(`
      SELECT 
        COUNT(*) as todayTrades,
        SUM(CASE WHEN status = 'CLOSED' THEN pnl ELSE 0 END) as todayPnl,
        COUNT(CASE WHEN pnl > 0 THEN 1 END) as todayWins
      FROM trades 
      WHERE mode = ? 
        AND DATE(openTime/1000, 'unixepoch') = DATE('now')
    `, [mode]);

    const thisWeekStats = await databaseService.queryAll(`
      SELECT 
        COUNT(*) as weekTrades,
        SUM(CASE WHEN status = 'CLOSED' THEN pnl ELSE 0 END) as weekPnl
      FROM trades 
      WHERE mode = ? 
        AND DATE(openTime/1000, 'unixepoch') >= DATE('now', 'weekday 0', '-6 days')
    `, [mode]);

    const result = stats[0];
    const todayResult = todayStats[0];
    const weekResult = thisWeekStats[0];

    // Fetch latest balance snapshot for this mode
    let latestBalance = await databaseService.queryGet(`
      SELECT totalBalance, availableBalance
      FROM portfolio_history
      WHERE mode = ?
      ORDER BY timestamp DESC
      LIMIT 1
    `, [mode]) as { totalBalance: number; availableBalance: number } | undefined;

    // If no balance in DB, fetch live USDT balance from Binance and persist it
    if (!latestBalance?.totalBalance && config.trading.mode !== 'paper') {
      try {
        const usdtBalances = await binanceService.getBalance('USDT');
        const usdt = usdtBalances[0];
        if (usdt) {
          const totalBalance = usdt.total;
          const availableBalance = usdt.free;
          const now = Date.now();
          const today = new Date().toISOString().split('T')[0];

          await databaseService.updatePortfolio({
            timestamp: now,
            totalBalance,
            availableBalance,
            lockedBalance: usdt.locked,
            totalPnl: 0,
            totalPnlPercent: 0,
            dailyPnl: 0,
            dailyPnlPercent: 0,
            openPositionsCount: 0,
            riskExposure: 0,
            maxDrawdown: 0,
            mode: mode as 'paper' | 'live',
            date: today,
          });

          latestBalance = { totalBalance, availableBalance };
          logger.info('Seeded portfolio_history from Binance USDT balance', {
            source: 'analyticsRoutes',
            context: { totalBalance, mode },
          });
        }
      } catch (binanceErr) {
        logger.warn('Could not fetch Binance balance as fallback', {
          source: 'analyticsRoutes',
          error: { stack: binanceErr instanceof Error ? binanceErr.stack : String(binanceErr) },
        });
      }
    }
    
    // Calculate derived metrics
    const winRate = result.closedTrades > 0 
      ? (result.winningTrades / result.closedTrades) * 100 
      : 0;
    
    const profitFactor = result.avgLoss > 0 
      ? (result.winningTrades * result.avgWin) / (result.losingTrades * result.avgLoss)
      : 0;

    res.json({
      balance: {
        totalBalance: latestBalance?.totalBalance ?? null,
        availableBalance: latestBalance?.availableBalance ?? null,
      },
      total: {
        trades: result.totalTrades,
        closedTrades: result.closedTrades,
        openTrades: result.openTrades,
        uniqueSymbols: result.uniqueSymbols,
        totalPnl: result.totalPnl || 0,
        totalFees: result.totalFees || 0,
        winRate: Math.round(winRate * 100) / 100,
        profitFactor: Math.round(profitFactor * 100) / 100,
        bestTrade: result.bestTrade || 0,
        worstTrade: result.worstTrade || 0
      },
      today: {
        trades: todayResult.todayTrades,
        pnl: todayResult.todayPnl || 0,
        wins: todayResult.todayWins
      },
      week: {
        trades: weekResult.weekTrades,
        pnl: weekResult.weekPnl || 0
      }
    });
    
  } catch (error) {
    logger.error('Analytics stats error:', { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
    res.status(500).json({ 
      error: 'Failed to get analytics stats',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * DELETE /api/analytics/cache
 * Clear analytics cache
 */
router.delete('/cache', async (req, res) => {
  try {
    analyticsService.clearCache();
    res.json({ 
      success: true, 
      message: 'Analytics cache cleared',
      timestamp: Date.now()
    });
  } catch (error) {
    logger.error('Cache clear error:', { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
    res.status(500).json({ 
      error: 'Failed to clear cache',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;