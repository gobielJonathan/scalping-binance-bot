import * as sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';
import config from '../config';
import {
  DatabaseTrade,
  DatabasePortfolioSnapshot,
  DatabaseSignal,
  DatabasePerformanceMetrics,
  DatabaseConfig,
  DatabaseQuery,
  DatabaseTransactionCallback,
  DatabaseExportOptions,
  TradingSignal,
  TradePosition,
  Portfolio,
  TechnicalIndicators
} from '../types';

export class DatabaseService {
  private db: sqlite3.Database | null = null;
  private dbPath: string;
  private isInitialized: boolean = false;
  private connectionPool: sqlite3.Database[] = [];
  private readonly maxPoolSize = 5;

  constructor() {
    this.dbPath = path.resolve(config.database.path);
    this.ensureDirectoryExists();
  }

  /**
   * Initialize the database connection and create tables
   */
  async initializeDatabase(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(new Error(`Failed to connect to database: ${err.message}`));
          return;
        }

        // Enable foreign keys and WAL mode for better performance
        this.db!.serialize(() => {
          this.db!.run('PRAGMA foreign_keys = ON');
          this.db!.run('PRAGMA journal_mode = WAL');
          this.db!.run('PRAGMA synchronous = NORMAL');
          this.db!.run('PRAGMA cache_size = -64000'); // 64MB cache
          this.db!.run('PRAGMA temp_store = memory');

          this.createTables()
            .then(() => this.runMigrations())
            .then(() => {
              this.isInitialized = true;
              resolve();
            })
            .catch(reject);
        });
      });
    });
  }

  /**
   * Create all required database tables
   */
  private async createTables(): Promise<void> {
    const tables = [
      // Trades table
      `CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
        type TEXT NOT NULL CHECK (type IN ('MARKET', 'LIMIT', 'STOP_LOSS', 'TAKE_PROFIT')),
        quantity REAL NOT NULL,
        entryPrice REAL NOT NULL,
        exitPrice REAL,
        stopLoss REAL,
        takeProfit REAL,
        pnl REAL,
        pnlPercent REAL,
        fees REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL CHECK (status IN ('OPEN', 'CLOSED', 'CANCELLED')),
        openTime INTEGER NOT NULL,
        closeTime INTEGER,
        strategyId TEXT NOT NULL,
        signalId TEXT,
        mode TEXT NOT NULL CHECK (mode IN ('paper', 'live')),
        orderId TEXT,
        notes TEXT,
        createdAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updatedAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        FOREIGN KEY (signalId) REFERENCES signals (id)
      )`,

      // Portfolio history table
      `CREATE TABLE IF NOT EXISTS portfolio_history (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        totalBalance REAL NOT NULL,
        availableBalance REAL NOT NULL,
        lockedBalance REAL NOT NULL,
        totalPnl REAL NOT NULL,
        totalPnlPercent REAL NOT NULL,
        dailyPnl REAL NOT NULL,
        dailyPnlPercent REAL NOT NULL,
        openPositionsCount INTEGER NOT NULL,
        riskExposure REAL NOT NULL,
        maxDrawdown REAL NOT NULL,
        mode TEXT NOT NULL CHECK (mode IN ('paper', 'live')),
        date TEXT NOT NULL,
        createdAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        UNIQUE(date, mode)
      )`,

      // Trading signals table
      `CREATE TABLE IF NOT EXISTS signals (
        id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('BUY', 'SELL', 'HOLD')),
        strength INTEGER NOT NULL CHECK (strength >= 0 AND strength <= 100),
        confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
        reason TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        indicators TEXT NOT NULL,
        processed BOOLEAN NOT NULL DEFAULT 0,
        tradeId TEXT,
        strategyId TEXT NOT NULL,
        mode TEXT NOT NULL CHECK (mode IN ('paper', 'live')),
        createdAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        FOREIGN KEY (tradeId) REFERENCES trades (id)
      )`,

      // Performance metrics table
      `CREATE TABLE IF NOT EXISTS performance (
        id TEXT PRIMARY KEY,
        timestamp INTEGER NOT NULL,
        period TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly', 'yearly')),
        totalTrades INTEGER NOT NULL,
        winningTrades INTEGER NOT NULL,
        losingTrades INTEGER NOT NULL,
        winRate REAL NOT NULL,
        totalReturn REAL NOT NULL,
        totalReturnPercent REAL NOT NULL,
        maxDrawdown REAL NOT NULL,
        avgWin REAL NOT NULL,
        avgLoss REAL NOT NULL,
        profitFactor REAL NOT NULL,
        sharpeRatio REAL,
        sortinioRatio REAL,
        calmarRatio REAL,
        volatility REAL NOT NULL,
        bestTrade REAL NOT NULL,
        worstTrade REAL NOT NULL,
        avgTradeReturn REAL NOT NULL,
        mode TEXT NOT NULL CHECK (mode IN ('paper', 'live')),
        createdAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        UNIQUE(period, timestamp, mode)
      )`,

      // Configuration table
      `CREATE TABLE IF NOT EXISTS config (
        id TEXT PRIMARY KEY,
        configType TEXT NOT NULL CHECK (configType IN ('trading', 'indicators', 'risk', 'general')),
        configData TEXT NOT NULL,
        version TEXT NOT NULL,
        description TEXT,
        isActive BOOLEAN NOT NULL DEFAULT 0,
        createdAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
        updatedAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      )`
    ];

    for (const table of tables) {
      await this.run(table);
    }

    // Create indexes for better performance
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_trades_symbol ON trades(symbol)',
      'CREATE INDEX IF NOT EXISTS idx_trades_timestamp ON trades(openTime)',
      'CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status)',
      'CREATE INDEX IF NOT EXISTS idx_trades_mode ON trades(mode)',
      'CREATE INDEX IF NOT EXISTS idx_portfolio_date ON portfolio_history(date)',
      'CREATE INDEX IF NOT EXISTS idx_portfolio_mode ON portfolio_history(mode)',
      'CREATE INDEX IF NOT EXISTS idx_signals_symbol ON signals(symbol)',
      'CREATE INDEX IF NOT EXISTS idx_signals_timestamp ON signals(timestamp)',
      'CREATE INDEX IF NOT EXISTS idx_signals_processed ON signals(processed)',
      'CREATE INDEX IF NOT EXISTS idx_performance_period ON performance(period)',
      'CREATE INDEX IF NOT EXISTS idx_config_type ON config(configType)',
      'CREATE INDEX IF NOT EXISTS idx_config_active ON config(isActive)'
    ];

    for (const index of indexes) {
      await this.run(index);
    }
  }

  /**
   * Run database migrations
   */
  private async runMigrations(): Promise<void> {
    // Create migrations table if it doesn't exist
    await this.run(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT UNIQUE NOT NULL,
        applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);

    const migrations = [
      {
        version: '1.0.0',
        sql: 'SELECT 1' // Placeholder for initial schema
      },
      {
        version: '1.0.1',
        sql: `
          CREATE TRIGGER IF NOT EXISTS update_trades_timestamp
          AFTER UPDATE ON trades
          BEGIN
            UPDATE trades SET updatedAt = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
          END
        `
      },
      {
        version: '1.0.2',
        sql: `
          CREATE TRIGGER IF NOT EXISTS update_config_timestamp
          AFTER UPDATE ON config
          BEGIN
            UPDATE config SET updatedAt = strftime('%s', 'now') * 1000 WHERE id = NEW.id;
          END
        `
      },
      {
        version: '1.1.0',
        sql: `ALTER TABLE trades ADD COLUMN marginMode TEXT DEFAULT 'isolated_margin'`
      },
      {
        version: '1.1.1',
        sql: `ALTER TABLE trades ADD COLUMN leverage REAL DEFAULT 1`
      },
      {
        version: '1.1.2',
        sql: `ALTER TABLE trades ADD COLUMN liquidationPrice REAL`
      },
      {
        version: '1.1.3',
        sql: `ALTER TABLE trades ADD COLUMN borrowedAmount REAL DEFAULT 0`
      }
    ];

    for (const migration of migrations) {
      const exists = await this.get('SELECT version FROM migrations WHERE version = ?', [migration.version]);
      if (!exists) {
        await this.run(migration.sql);
        await this.run('INSERT INTO migrations (version) VALUES (?)', [migration.version]);
      }
    }
  }

  /**
   * Save a trade to the database
   */
  async saveTrade(trade: Omit<DatabaseTrade, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    const id = this.generateId();
    const now = Date.now();

    const dbTrade: DatabaseTrade = {
      ...trade,
      id,
      createdAt: now,
      updatedAt: now
    };

    await this.run(`
      INSERT INTO trades (
        id, symbol, side, type, quantity, entryPrice, exitPrice, stopLoss, takeProfit,
        pnl, pnlPercent, fees, status, openTime, closeTime, strategyId, signalId,
        mode, orderId, notes, marginMode, leverage, liquidationPrice, borrowedAmount,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      dbTrade.id, dbTrade.symbol, dbTrade.side, dbTrade.type, dbTrade.quantity,
      dbTrade.entryPrice, dbTrade.exitPrice, dbTrade.stopLoss, dbTrade.takeProfit,
      dbTrade.pnl, dbTrade.pnlPercent, dbTrade.fees, dbTrade.status,
      dbTrade.openTime, dbTrade.closeTime, dbTrade.strategyId, dbTrade.signalId,
      dbTrade.mode, dbTrade.orderId, dbTrade.notes,
      dbTrade.marginMode, dbTrade.leverage, dbTrade.liquidationPrice ?? null, dbTrade.borrowedAmount,
      dbTrade.createdAt, dbTrade.updatedAt
    ]);

    return id;
  }

  /**
   * Update an existing trade
   */
  async updateTrade(id: string, updates: Partial<DatabaseTrade>): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    const fields = Object.keys(updates).filter(key => key !== 'id' && key !== 'createdAt');
    if (fields.length === 0) return;

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => updates[field as keyof DatabaseTrade]);
    values.push(Date.now()); // updatedAt
    values.push(id);

    await this.run(
      `UPDATE trades SET ${setClause}, updatedAt = ? WHERE id = ?`,
      values
    );
  }

  /**
   * Get trade history with optional filters
   */
  async getTradeHistory(filters: {
    symbol?: string;
    status?: string;
    mode?: 'paper' | 'live';
    startDate?: number;
    endDate?: number;
    limit?: number;
    offset?: number;
  } = {}): Promise<DatabaseTrade[]> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    let sql = 'SELECT * FROM trades WHERE 1=1';
    const params: any[] = [];

    if (filters.symbol) {
      sql += ' AND symbol = ?';
      params.push(filters.symbol);
    }

    if (filters.status) {
      sql += ' AND status = ?';
      params.push(filters.status);
    }

    if (filters.mode) {
      sql += ' AND mode = ?';
      params.push(filters.mode);
    }

    if (filters.startDate) {
      sql += ' AND openTime >= ?';
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      sql += ' AND openTime <= ?';
      params.push(filters.endDate);
    }

    sql += ' ORDER BY openTime DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }

    if (filters.offset) {
      sql += ' OFFSET ?';
      params.push(filters.offset);
    }

    return this.all(sql, params);
  }

  /**
   * Save portfolio snapshot
   */
  async updatePortfolio(portfolio: Omit<DatabasePortfolioSnapshot, 'id' | 'createdAt'>): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    const id = this.generateId();
    const now = Date.now();

    await this.run(`
      INSERT OR REPLACE INTO portfolio_history (
        id, timestamp, totalBalance, availableBalance, lockedBalance, totalPnl,
        totalPnlPercent, dailyPnl, dailyPnlPercent, openPositionsCount,
        riskExposure, maxDrawdown, mode, date, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, portfolio.timestamp, portfolio.totalBalance, portfolio.availableBalance,
      portfolio.lockedBalance, portfolio.totalPnl, portfolio.totalPnlPercent,
      portfolio.dailyPnl, portfolio.dailyPnlPercent, portfolio.openPositionsCount,
      portfolio.riskExposure, portfolio.maxDrawdown, portfolio.mode, portfolio.date, now
    ]);

    return id;
  }

  /**
   * Get portfolio history
   */
  async getPortfolioHistory(mode: 'paper' | 'live', days: number = 30): Promise<DatabasePortfolioSnapshot[]> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    return this.all(
      'SELECT * FROM portfolio_history WHERE mode = ? AND timestamp >= ? ORDER BY timestamp DESC',
      [mode, cutoffTime]
    );
  }

  /**
   * Save trading signal
   */
  async saveSignal(signal: Omit<DatabaseSignal, 'id' | 'createdAt'>): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    const id = this.generateId();
    const now = Date.now();

    await this.run(`
      INSERT INTO signals (
        id, symbol, type, strength, confidence, reason, timestamp,
        indicators, processed, tradeId, strategyId, mode, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, signal.symbol, signal.type, signal.strength, signal.confidence,
      signal.reason, signal.timestamp, signal.indicators, signal.processed,
      signal.tradeId, signal.strategyId, signal.mode, now
    ]);

    return id;
  }

  /**
   * Get unprocessed signals
   */
  async getUnprocessedSignals(mode: 'paper' | 'live'): Promise<DatabaseSignal[]> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    return this.all(
      'SELECT * FROM signals WHERE processed = 0 AND mode = ? ORDER BY timestamp ASC',
      [mode]
    );
  }

  /**
   * Mark signal as processed
   */
  async markSignalProcessed(signalId: string, tradeId?: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    await this.run(
      'UPDATE signals SET processed = 1, tradeId = ? WHERE id = ?',
      [tradeId, signalId]
    );
  }

  /**
   * Save performance metrics
   */
  async savePerformanceMetrics(metrics: Omit<DatabasePerformanceMetrics, 'id' | 'createdAt'>): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    const id = this.generateId();
    const now = Date.now();

    await this.run(`
      INSERT OR REPLACE INTO performance (
        id, timestamp, period, totalTrades, winningTrades, losingTrades,
        winRate, totalReturn, totalReturnPercent, maxDrawdown, avgWin,
        avgLoss, profitFactor, sharpeRatio, sortinioRatio, calmarRatio,
        volatility, bestTrade, worstTrade, avgTradeReturn, mode, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, metrics.timestamp, metrics.period, metrics.totalTrades,
      metrics.winningTrades, metrics.losingTrades, metrics.winRate,
      metrics.totalReturn, metrics.totalReturnPercent, metrics.maxDrawdown,
      metrics.avgWin, metrics.avgLoss, metrics.profitFactor,
      metrics.sharpeRatio, metrics.sortinioRatio, metrics.calmarRatio,
      metrics.volatility, metrics.bestTrade, metrics.worstTrade,
      metrics.avgTradeReturn, metrics.mode, now
    ]);

    return id;
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(
    mode: 'paper' | 'live',
    period?: 'daily' | 'weekly' | 'monthly' | 'yearly',
    limit: number = 30
  ): Promise<DatabasePerformanceMetrics[]> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    let sql = 'SELECT * FROM performance WHERE mode = ?';
    const params: any[] = [mode];

    if (period) {
      sql += ' AND period = ?';
      params.push(period);
    }

    sql += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);

    return this.all(sql, params);
  }

  /**
   * Save configuration snapshot
   */
  async saveConfig(config: Omit<DatabaseConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    const id = this.generateId();
    const now = Date.now();

    // Deactivate other configs of the same type if this one is active
    if (config.isActive) {
      await this.run(
        'UPDATE config SET isActive = 0 WHERE configType = ?',
        [config.configType]
      );
    }

    await this.run(`
      INSERT INTO config (
        id, configType, configData, version, description, isActive, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      id, config.configType, config.configData, config.version,
      config.description, config.isActive, now, now
    ]);

    return id;
  }

  /**
   * Get active configuration
   */
  async getActiveConfig(configType: string): Promise<DatabaseConfig | null> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    const result = await this.get(
      'SELECT * FROM config WHERE configType = ? AND isActive = 1 ORDER BY createdAt DESC LIMIT 1',
      [configType]
    );

    return result || null;
  }

  /**
   * Execute database transaction
   */
  async transaction<T>(callback: DatabaseTransactionCallback<T>): Promise<T> {
    if (!this.isInitialized || !this.db) {
      throw new Error('Database not initialized');
    }

    return new Promise((resolve, reject) => {
      this.db!.serialize(async () => {
        try {
          await this.run('BEGIN TRANSACTION');
          const result = await callback();
          await this.run('COMMIT');
          resolve(result);
        } catch (error) {
          await this.run('ROLLBACK');
          reject(error);
        }
      });
    });
  }

  /**
   * Backup database to file
   */
  async backupDatabase(backupPath?: string): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const defaultPath = path.join(path.dirname(this.dbPath), `backup_${timestamp}.db`);
    const finalPath = backupPath || defaultPath;

    return new Promise((resolve, reject) => {
      try {
        fs.copyFileSync(this.dbPath, finalPath);
        resolve(finalPath);
      } catch (err) {
        reject(new Error(`Backup failed: ${err instanceof Error ? err.message : 'Unknown error'}`));
      }
    });
  }

  /**
   * Export data in various formats
   */
  async exportData(options: DatabaseExportOptions): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const exportPath = path.join(path.dirname(this.dbPath), `export_${timestamp}.${options.format}`);

    if (options.format === 'json') {
      return this.exportToJson(exportPath, options);
    } else if (options.format === 'csv') {
      return this.exportToCsv(exportPath, options);
    } else if (options.format === 'sql') {
      return this.exportToSql(exportPath, options);
    }

    throw new Error(`Unsupported export format: ${options.format}`);
  }

  /**
   * Get database statistics
   */
  async getDatabaseStats(): Promise<{
    tables: Array<{ name: string; count: number; size: string }>;
    totalSize: number;
    vacuumNeeded: boolean;
  }> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    const tables = ['trades', 'portfolio_history', 'signals', 'performance', 'config'];
    const stats: Array<{ name: string; count: number; size: string }> = [];

    for (const table of tables) {
      const countResult = await this.get(`SELECT COUNT(*) as count FROM ${table}`);
      const count = countResult?.count || 0;
      
      // Get table size estimation (not exact in SQLite)
      const sizeResult = await this.get(`
        SELECT page_count * page_size as size 
        FROM pragma_page_count('${table}'), pragma_page_size
      `);
      const size = sizeResult?.size || 0;

      stats.push({
        name: table,
        count,
        size: this.formatBytes(size)
      });
    }

    // Check if vacuum is needed
    const pragmaResult = await this.get('PRAGMA integrity_check');
    const vacuumNeeded = pragmaResult?.integrity_check !== 'ok';

    return {
      tables: stats,
      totalSize: stats.reduce((sum, table) => sum + parseInt(table.size.replace(/\D/g, '') || '0'), 0),
      vacuumNeeded
    };
  }

  /**
   * Cleanup old data
   */
  async cleanup(retentionDays: number = 90): Promise<number> {
    if (!this.isInitialized) {
      throw new Error('Database not initialized');
    }

    const cutoffTime = Date.now() - (retentionDays * 24 * 60 * 60 * 1000);
    let deletedRecords = 0;

    await this.transaction(async () => {
      // Delete old closed trades
      const tradeResult = await this.run(
        'DELETE FROM trades WHERE status = "CLOSED" AND closeTime < ?',
        [cutoffTime]
      );
      deletedRecords += tradeResult.changes || 0;

      // Delete old portfolio snapshots (keep daily records)
      const portfolioResult = await this.run(
        'DELETE FROM portfolio_history WHERE timestamp < ?',
        [cutoffTime]
      );
      deletedRecords += portfolioResult.changes || 0;

      // Delete old processed signals
      const signalResult = await this.run(
        'DELETE FROM signals WHERE processed = 1 AND timestamp < ?',
        [cutoffTime]
      );
      deletedRecords += signalResult.changes || 0;
    });

    return deletedRecords;
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db!.close((err) => {
          if (err) {
            reject(err);
          } else {
            this.isInitialized = false;
            resolve();
          }
        });
      });
    }
  }

  /**
   * Public method to execute SELECT queries that return multiple rows
   */
  async queryAll(sql: string, params: any[] = []): Promise<any[]> {
    return this.all(sql, params);
  }

  /**
   * Public method to execute SELECT queries that return a single row
   */
  async queryGet(sql: string, params: any[] = []): Promise<any> {
    return this.get(sql, params);
  }

  // Helper methods
  private async run(sql: string, params: any[] = []): Promise<sqlite3.RunResult> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    return new Promise((resolve, reject) => {
      this.db!.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      });
    });
  }

  private async get(sql: string, params: any[] = []): Promise<any> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    return new Promise((resolve, reject) => {
      this.db!.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  private async all(sql: string, params: any[] = []): Promise<any[]> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    return new Promise((resolve, reject) => {
      this.db!.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  private generateId(): string {
    return randomUUID();
  }

  private ensureDirectoryExists(): void {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private async exportToJson(exportPath: string, options: DatabaseExportOptions): Promise<string> {
    const data: any = {};
    const tables = options.tables || ['trades', 'portfolio_history', 'signals', 'performance'];

    for (const table of tables) {
      let sql = `SELECT * FROM ${table}`;
      const params: any[] = [];

      if (options.dateRange && table === 'trades') {
        sql += ' WHERE openTime BETWEEN ? AND ?';
        params.push(options.dateRange.start, options.dateRange.end);
      }

      data[table] = await this.all(sql, params);
    }

    if (options.includeConfig) {
      data.config = await this.all('SELECT * FROM config WHERE isActive = 1');
    }

    fs.writeFileSync(exportPath, JSON.stringify(data, null, 2));
    return exportPath;
  }

  private async exportToCsv(exportPath: string, options: DatabaseExportOptions): Promise<string> {
    const tables = options.tables || ['trades'];
    let csvContent = '';

    for (const table of tables) {
      const rows = await this.all(`SELECT * FROM ${table}`);
      if (rows.length === 0) continue;

      // Add table header
      csvContent += `\n\n--- ${table.toUpperCase()} ---\n`;
      
      // Add CSV headers
      const headers = Object.keys(rows[0]);
      csvContent += headers.join(',') + '\n';

      // Add data rows
      for (const row of rows) {
        const values = headers.map(header => {
          const value = row[header];
          return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
        });
        csvContent += values.join(',') + '\n';
      }
    }

    fs.writeFileSync(exportPath, csvContent);
    return exportPath;
  }

  private async exportToSql(exportPath: string, options: DatabaseExportOptions): Promise<string> {
    const backup = await this.backupDatabase(exportPath);
    return backup;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export default DatabaseService;
