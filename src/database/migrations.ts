const fs = require('fs');
const path = require('path');
import { DatabaseService } from '../database';
import config from '../config';
import { logger } from '../services/logger';

/**
 * Migration utilities for database schema updates and data migrations
 */
export class DatabaseMigrationService {
  private dbService: DatabaseService;

  constructor() {
    this.dbService = new DatabaseService();
  }

  /**
   * Check if database needs migration
   */
  async checkMigrationNeeded(): Promise<boolean> {
    try {
      const dbPath = path.resolve(config.database.path);
      
      // If database doesn't exist, no migration needed
      if (!fs.existsSync(dbPath)) {
        return false;
      }

      await this.dbService.initializeDatabase();
      
      // Check if migrations table exists
      const migrationTableExists = await this.dbService.queryGet(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'"
      );

      if (!migrationTableExists) {
        return true; // Old database without migration tracking
      }

      // Check if we have latest migration
      const latestMigration = await this.dbService.queryGet(
        'SELECT version FROM migrations ORDER BY applied_at DESC LIMIT 1'
      );

      // Compare with expected latest version
      const expectedVersion = '1.0.2';
      return !latestMigration || latestMigration.version !== expectedVersion;
      
    } catch (error) {
      logger.warn('Error checking migration status:', { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
      return false;
    }
  }

  /**
   * Migrate old data format to new schema
   */
  async migrateFromOldFormat(oldDataPath?: string): Promise<void> {
    logger.info('Starting database migration...');

    try {
      // Initialize new database
      await this.dbService.initializeDatabase();

      // Look for old data files
      const dataDir = oldDataPath || path.join(path.dirname(config.database.path), '../old_data');
      
      if (fs.existsSync(dataDir)) {
        logger.info(`Found old data directory: ${dataDir}`);
        await this.migrateFromFiles(dataDir);
      }

      // Look for old SQLite databases with different schema
      const oldDbPath = oldDataPath || config.database.path.replace('.db', '_old.db');
      if (fs.existsSync(oldDbPath)) {
        logger.info(`Found old database: ${oldDbPath}`);
        await this.migrateFromOldDatabase(oldDbPath);
      }

      logger.info('Database migration completed successfully!');
      
    } catch (error) {
      logger.error('Migration failed:', { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
      throw error;
    }
  }

  /**
   * Migrate from JSON/CSV files
   */
  private async migrateFromFiles(dataDir: string): Promise<void> {
    const files = fs.readdirSync(dataDir);

    for (const file of files) {
      const filePath = path.join(dataDir, file);
      const stat = fs.statSync(filePath);

      if (!stat.isFile()) continue;

      if (file.includes('trades') && file.endsWith('.json')) {
        await this.migrateTrades(filePath);
      } else if (file.includes('portfolio') && file.endsWith('.json')) {
        await this.migratePortfolio(filePath);
      } else if (file.includes('signals') && file.endsWith('.json')) {
        await this.migrateSignals(filePath);
      }
    }
  }

  /**
   * Migrate from old database with different schema
   */
  private async migrateFromOldDatabase(oldDbPath: string): Promise<void> {
    const sqlite3 = require('sqlite3');
    const oldDb = new sqlite3.Database(oldDbPath);

    try {
      // Get table structure from old database
      const tables = await this.queryOldDatabase(oldDb, 
        "SELECT name FROM sqlite_master WHERE type='table'"
      );

      for (const table of tables) {
        const tableName = table.name;
        logger.info(`Migrating table: ${tableName}`);

        if (tableName === 'trades' || tableName === 'trade_history') {
          await this.migrateOldTrades(oldDb, tableName);
        } else if (tableName === 'portfolio' || tableName === 'portfolio_snapshots') {
          await this.migrateOldPortfolio(oldDb, tableName);
        }
      }

    } finally {
      oldDb.close();
    }
  }

  /**
   * Migrate trades from JSON file
   */
  private async migrateTrades(filePath: string): Promise<void> {
    logger.info(`Migrating trades from: ${filePath}`);
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const trades = Array.isArray(data) ? data : data.trades || [];

    for (const trade of trades) {
      try {
        // Map old format to new format
        const newTrade = {
          symbol: trade.symbol || trade.pair || 'BTCUSDT',
          side: trade.side || trade.direction || 'BUY',
          type: trade.type || 'MARKET',
          quantity: trade.quantity || trade.amount || 0,
          entryPrice: trade.entryPrice || trade.price || trade.entry || 0,
          exitPrice: trade.exitPrice || trade.exit,
          stopLoss: trade.stopLoss || trade.sl,
          takeProfit: trade.takeProfit || trade.tp,
          pnl: trade.pnl || trade.profit || trade.loss,
          pnlPercent: trade.pnlPercent || trade.profitPercent,
          fees: trade.fees || trade.commission || 0,
          status: this.normalizeStatus(trade.status),
          openTime: this.normalizeTimestamp(trade.openTime || trade.timestamp || trade.created),
          closeTime: this.normalizeTimestamp(trade.closeTime || trade.closed),
          strategyId: trade.strategy || trade.strategyId || 'imported',
          mode: trade.mode || 'paper',
          orderId: trade.orderId || trade.id,
          notes: trade.notes || trade.reason
        };

        await this.dbService.saveTrade(newTrade);
        
      } catch (error) {
        logger.warn('Failed to migrate trade:', { trade, error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
      }
    }

    logger.info(`Migrated ${trades.length} trades`);
  }

  /**
   * Migrate portfolio data from JSON file
   */
  private async migratePortfolio(filePath: string): Promise<void> {
    logger.info(`Migrating portfolio from: ${filePath}`);
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const snapshots = Array.isArray(data) ? data : data.snapshots || [];

    for (const snapshot of snapshots) {
      try {
        const newSnapshot = {
          timestamp: this.normalizeTimestamp(snapshot.timestamp || snapshot.date),
          totalBalance: snapshot.totalBalance || snapshot.balance || 0,
          availableBalance: snapshot.availableBalance || snapshot.available || 0,
          lockedBalance: snapshot.lockedBalance || snapshot.locked || 0,
          totalPnl: snapshot.totalPnl || snapshot.pnl || 0,
          totalPnlPercent: snapshot.totalPnlPercent || snapshot.pnlPercent || 0,
          dailyPnl: snapshot.dailyPnl || 0,
          dailyPnlPercent: snapshot.dailyPnlPercent || 0,
          openPositionsCount: snapshot.openPositions || snapshot.positions || 0,
          riskExposure: snapshot.riskExposure || snapshot.risk || 0,
          maxDrawdown: snapshot.maxDrawdown || snapshot.drawdown || 0,
          mode: snapshot.mode || 'paper',
          date: this.formatDate(snapshot.timestamp || snapshot.date)
        };

        await this.dbService.updatePortfolio(newSnapshot);
        
      } catch (error) {
        logger.warn('Failed to migrate portfolio snapshot:', { snapshot, error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
      }
    }

    logger.info(`Migrated ${snapshots.length} portfolio snapshots`);
  }

  /**
   * Migrate signals from JSON file
   */
  private async migrateSignals(filePath: string): Promise<void> {
    logger.info(`Migrating signals from: ${filePath}`);
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const signals = Array.isArray(data) ? data : data.signals || [];

    for (const signal of signals) {
      try {
        const newSignal = {
          symbol: signal.symbol || signal.pair || 'BTCUSDT',
          type: signal.type || signal.action || 'HOLD',
          strength: signal.strength || signal.score || 50,
          confidence: signal.confidence || signal.certainty || 50,
          reason: signal.reason || signal.description || 'Imported signal',
          timestamp: this.normalizeTimestamp(signal.timestamp || signal.time),
          indicators: JSON.stringify(signal.indicators || signal.data || {}),
          processed: signal.processed !== false, // Default to processed
          strategyId: signal.strategy || signal.strategyId || 'imported',
          mode: signal.mode || 'paper'
        };

        await this.dbService.saveSignal(newSignal);
        
      } catch (error) {
        logger.warn('Failed to migrate signal:', { signal, error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
      }
    }

    logger.info(`Migrated ${signals.length} signals`);
  }

  /**
   * Migrate trades from old database
   */
  private async migrateOldTrades(oldDb: any, tableName: string): Promise<void> {
    const trades = await this.queryOldDatabase(oldDb, `SELECT * FROM ${tableName}`);

    for (const trade of trades) {
      try {
        const newTrade = {
          symbol: trade.symbol || trade.pair || 'BTCUSDT',
          side: trade.side || 'BUY',
          type: trade.type || 'MARKET',
          quantity: trade.quantity || trade.amount || 0,
          entryPrice: trade.entry_price || trade.entryPrice || trade.price || 0,
          exitPrice: trade.exit_price || trade.exitPrice,
          stopLoss: trade.stop_loss || trade.stopLoss,
          takeProfit: trade.take_profit || trade.takeProfit,
          pnl: trade.pnl || trade.profit,
          pnlPercent: trade.pnl_percent || trade.pnlPercent,
          fees: trade.fees || 0,
          status: this.normalizeStatus(trade.status),
          openTime: this.normalizeTimestamp(trade.open_time || trade.openTime || trade.created_at),
          closeTime: this.normalizeTimestamp(trade.close_time || trade.closeTime || trade.updated_at),
          strategyId: trade.strategy_id || trade.strategy || 'imported',
          mode: trade.mode || 'paper',
          orderId: trade.order_id || trade.orderId
        };

        await this.dbService.saveTrade(newTrade);
        
      } catch (error) {
        logger.warn('Failed to migrate old trade:', { trade, error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
      }
    }

    logger.info(`Migrated ${trades.length} trades from ${tableName}`);
  }

  /**
   * Migrate portfolio from old database
   */
  private async migrateOldPortfolio(oldDb: any, tableName: string): Promise<void> {
    const snapshots = await this.queryOldDatabase(oldDb, `SELECT * FROM ${tableName}`);

    for (const snapshot of snapshots) {
      try {
        const newSnapshot = {
          timestamp: this.normalizeTimestamp(snapshot.timestamp || snapshot.created_at),
          totalBalance: snapshot.total_balance || snapshot.totalBalance || 0,
          availableBalance: snapshot.available_balance || snapshot.availableBalance || 0,
          lockedBalance: snapshot.locked_balance || snapshot.lockedBalance || 0,
          totalPnl: snapshot.total_pnl || snapshot.totalPnl || 0,
          totalPnlPercent: snapshot.total_pnl_percent || snapshot.totalPnlPercent || 0,
          dailyPnl: snapshot.daily_pnl || snapshot.dailyPnl || 0,
          dailyPnlPercent: snapshot.daily_pnl_percent || snapshot.dailyPnlPercent || 0,
          openPositionsCount: snapshot.open_positions_count || snapshot.openPositions || 0,
          riskExposure: snapshot.risk_exposure || snapshot.riskExposure || 0,
          maxDrawdown: snapshot.max_drawdown || snapshot.maxDrawdown || 0,
          mode: snapshot.mode || 'paper',
          date: this.formatDate(snapshot.timestamp || snapshot.created_at || snapshot.date)
        };

        await this.dbService.updatePortfolio(newSnapshot);
        
      } catch (error) {
        logger.warn('Failed to migrate old portfolio:', { snapshot, error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
      }
    }

    logger.info(`Migrated ${snapshots.length} portfolio snapshots from ${tableName}`);
  }

  /**
   * Create backup before migration
   */
  async createPreMigrationBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = config.database.path.replace('.db', `_pre_migration_${timestamp}.db`);
    
    if (fs.existsSync(config.database.path)) {
      fs.copyFileSync(config.database.path, backupPath);
      logger.info(`Pre-migration backup created: ${backupPath}`);
    }
    
    return backupPath;
  }

  /**
   * Validate migrated data
   */
  async validateMigration(): Promise<{
    success: boolean;
    stats: {
      trades: number;
      signals: number;
      portfolioSnapshots: number;
      performanceMetrics: number;
    };
    errors: string[];
  }> {
    const errors: string[] = [];
    
    try {
      await this.dbService.initializeDatabase();
      
      const stats = await this.dbService.getDatabaseStats();
      const tradesCount = stats.tables.find(t => t.name === 'trades')?.count || 0;
      const signalsCount = stats.tables.find(t => t.name === 'signals')?.count || 0;
      const portfolioCount = stats.tables.find(t => t.name === 'portfolio_history')?.count || 0;
      const performanceCount = stats.tables.find(t => t.name === 'performance')?.count || 0;

      // Basic validation checks
      if (tradesCount > 0) {
        const invalidTrades = await this.dbService.queryAll(
          'SELECT id FROM trades WHERE quantity <= 0 OR entryPrice <= 0'
        );
        if (invalidTrades.length > 0) {
          errors.push(`Found ${invalidTrades.length} trades with invalid quantity or price`);
        }
      }

      if (signalsCount > 0) {
        const invalidSignals = await this.dbService.queryAll(
          'SELECT id FROM signals WHERE strength < 0 OR strength > 100 OR confidence < 0 OR confidence > 100'
        );
        if (invalidSignals.length > 0) {
          errors.push(`Found ${invalidSignals.length} signals with invalid strength/confidence`);
        }
      }

      return {
        success: errors.length === 0,
        stats: {
          trades: tradesCount,
          signals: signalsCount,
          portfolioSnapshots: portfolioCount,
          performanceMetrics: performanceCount
        },
        errors
      };
      
    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        success: false,
        stats: { trades: 0, signals: 0, portfolioSnapshots: 0, performanceMetrics: 0 },
        errors
      };
    }
  }

  async close(): Promise<void> {
    await this.dbService.close();
  }

  // Helper methods
  private queryOldDatabase(db: any, sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      db.all(sql, params, (err: any, rows: any[]) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  private normalizeStatus(status: any): 'OPEN' | 'CLOSED' | 'CANCELLED' {
    if (!status) return 'CLOSED';
    
    const statusStr = status.toString().toUpperCase();
    if (statusStr.includes('OPEN') || statusStr.includes('ACTIVE')) return 'OPEN';
    if (statusStr.includes('CANCEL')) return 'CANCELLED';
    return 'CLOSED';
  }

  private normalizeTimestamp(timestamp: any): number {
    if (!timestamp) return Date.now();
    
    if (typeof timestamp === 'number') {
      // Handle both seconds and milliseconds
      return timestamp > 1e10 ? timestamp : timestamp * 1000;
    }
    
    if (typeof timestamp === 'string') {
      return new Date(timestamp).getTime();
    }
    
    return Date.now();
  }

  private formatDate(timestamp: any): string {
    const date = new Date(this.normalizeTimestamp(timestamp));
    return date.toISOString().split('T')[0];
  }
}

// CLI for migration
async function runMigrationCLI() {
  const migration = new DatabaseMigrationService();
  
  try {
    logger.info('Checking if migration is needed...');
    const needsMigration = await migration.checkMigrationNeeded();
    
    if (!needsMigration) {
      logger.info('Database is up to date, no migration needed');
      return;
    }

    logger.warn('Database migration required');
    
    // Create backup
    await migration.createPreMigrationBackup();
    
    // Run migration
    await migration.migrateFromOldFormat();
    
    // Validate results
    const validation = await migration.validateMigration();
    
    logger.info('Migration Results:');
    logger.info(`Trades: ${validation.stats.trades}`);
    logger.info(`Signals: ${validation.stats.signals}`);
    logger.info(`Portfolio Snapshots: ${validation.stats.portfolioSnapshots}`);
    logger.info(`Performance Metrics: ${validation.stats.performanceMetrics}`);
    
    if (validation.errors.length > 0) {
      logger.warn('Validation Warnings:');
      validation.errors.forEach(error => logger.warn(`  - ${error}`));
    }
    
    logger.info(validation.success ? 'Migration completed successfully!' : 'Migration completed with warnings');
    
  } catch (error) {
    logger.error('Migration failed:', { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
    process.exit(1);
  } finally {
    await migration.close();
  }
}

// Export for programmatic use
export default DatabaseMigrationService;

// Run migration if called directly
if (require.main === module) {
  runMigrationCLI();
}