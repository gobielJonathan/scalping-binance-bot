# Database Service Documentation

The database service provides comprehensive data persistence for the crypto trading bot using SQLite. It manages trade history, portfolio data, performance metrics, and configuration snapshots with automatic migrations and robust error handling.

## Features

- **SQLite Database**: Fast, reliable, serverless database with WAL mode for better performance
- **Comprehensive Schema**: Tables for trades, portfolio history, signals, performance metrics, and configurations
- **Transaction Management**: ACID transactions with automatic rollback on errors
- **Data Validation**: Input validation and constraints to ensure data integrity
- **Performance Optimized**: Indexes, connection pooling, and query optimization
- **Backup & Export**: Multiple export formats (JSON, CSV, SQL) and automatic backups
- **Migration Support**: Automatic schema migrations and data migration utilities
- **Error Handling**: Robust error handling with detailed logging
- **Type Safety**: Full TypeScript support with comprehensive type definitions

## Quick Start

```typescript
import { DatabaseService } from './database';

const dbService = new DatabaseService();

// Initialize the database
await dbService.initializeDatabase();

// Save a trade
const tradeId = await dbService.saveTrade({
  symbol: 'BTCUSDT',
  side: 'BUY',
  type: 'MARKET',
  quantity: 0.001,
  entryPrice: 45000,
  fees: 0.45,
  status: 'OPEN',
  openTime: Date.now(),
  strategyId: 'my_strategy',
  mode: 'paper'
});

// Get trade history
const trades = await dbService.getTradeHistory({
  symbol: 'BTCUSDT',
  limit: 10
});

// Close when done
await dbService.close();
```

## Database Schema

### Tables Overview

| Table | Description | Key Features |
|-------|-------------|--------------|
| `trades` | Trade records with entry/exit details | Foreign key to signals, automatic timestamps |
| `portfolio_history` | Daily portfolio snapshots | Unique constraint on date+mode |
| `signals` | Trading signal history | JSON indicators, processing status |
| `performance` | Performance metrics and statistics | Period-based metrics, unique constraints |
| `config` | Configuration snapshots | Versioning, active status management |

### Trades Table

```sql
CREATE TABLE trades (
  id TEXT PRIMARY KEY,                    -- Unique trade identifier
  symbol TEXT NOT NULL,                   -- Trading pair (e.g., BTCUSDT)
  side TEXT NOT NULL,                     -- BUY or SELL
  type TEXT NOT NULL,                     -- MARKET, LIMIT, STOP_LOSS, TAKE_PROFIT
  quantity REAL NOT NULL,                 -- Trade quantity
  entryPrice REAL NOT NULL,              -- Entry price
  exitPrice REAL,                        -- Exit price (when closed)
  stopLoss REAL,                         -- Stop loss price
  takeProfit REAL,                       -- Take profit price
  pnl REAL,                              -- Profit/Loss amount
  pnlPercent REAL,                       -- Profit/Loss percentage
  fees REAL NOT NULL DEFAULT 0,          -- Trading fees
  status TEXT NOT NULL,                   -- OPEN, CLOSED, CANCELLED
  openTime INTEGER NOT NULL,             -- Trade open timestamp
  closeTime INTEGER,                     -- Trade close timestamp
  strategyId TEXT NOT NULL,              -- Strategy identifier
  signalId TEXT,                         -- Related signal ID (FK)
  mode TEXT NOT NULL,                    -- paper or live
  orderId TEXT,                          -- Exchange order ID
  notes TEXT,                            -- Additional notes
  createdAt INTEGER NOT NULL,            -- Record creation timestamp
  updatedAt INTEGER NOT NULL             -- Last update timestamp
);
```

### Portfolio History Table

```sql
CREATE TABLE portfolio_history (
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
  mode TEXT NOT NULL,                    -- paper or live
  date TEXT NOT NULL,                    -- YYYY-MM-DD format
  createdAt INTEGER NOT NULL
);
```

### Signals Table

```sql
CREATE TABLE signals (
  id TEXT PRIMARY KEY,
  symbol TEXT NOT NULL,
  type TEXT NOT NULL,                    -- BUY, SELL, HOLD
  strength INTEGER NOT NULL,             -- 0-100
  confidence INTEGER NOT NULL,           -- 0-100
  reason TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  indicators TEXT NOT NULL,              -- JSON string of indicators
  processed BOOLEAN NOT NULL DEFAULT 0,
  tradeId TEXT,                         -- Related trade ID (FK)
  strategyId TEXT NOT NULL,
  mode TEXT NOT NULL,
  createdAt INTEGER NOT NULL
);
```

## Core Methods

### Trade Management

```typescript
// Save a new trade
const tradeId = await dbService.saveTrade(trade);

// Update existing trade
await dbService.updateTrade(tradeId, { pnl: 50, status: 'CLOSED' });

// Get trade history with filters
const trades = await dbService.getTradeHistory({
  symbol: 'BTCUSDT',
  status: 'CLOSED',
  startDate: Date.now() - 86400000,
  limit: 50
});
```

### Signal Management

```typescript
// Save trading signal
const signalId = await dbService.saveSignal({
  symbol: 'BTCUSDT',
  type: 'BUY',
  strength: 85,
  confidence: 78,
  reason: 'Strong momentum',
  timestamp: Date.now(),
  indicators: JSON.stringify(technicalData),
  processed: false,
  strategyId: 'ema_strategy',
  mode: 'paper'
});

// Get unprocessed signals
const signals = await dbService.getUnprocessedSignals('paper');

// Mark signal as processed
await dbService.markSignalProcessed(signalId, tradeId);
```

### Portfolio Tracking

```typescript
// Update portfolio snapshot
const portfolioId = await dbService.updatePortfolio({
  timestamp: Date.now(),
  totalBalance: 1000,
  availableBalance: 950,
  lockedBalance: 50,
  totalPnl: 50,
  totalPnlPercent: 5,
  dailyPnl: 10,
  dailyPnlPercent: 1,
  openPositionsCount: 2,
  riskExposure: 0.05,
  maxDrawdown: 0.02,
  mode: 'paper',
  date: '2023-12-01'
});

// Get portfolio history
const history = await dbService.getPortfolioHistory('paper', 30);
```

### Performance Metrics

```typescript
// Calculate and save performance metrics
const dbUtils = new DatabaseUtils(dbService);
const metrics = await dbUtils.calculatePerformanceMetrics('paper', 'daily');
const metricsId = await dbService.savePerformanceMetrics(metrics);

// Get performance metrics
const performances = await dbService.getPerformanceMetrics('paper', 'daily', 30);
```

## Advanced Features

### Transactions

```typescript
// Execute multiple operations atomically
const result = await dbService.transaction(async () => {
  const signalId = await dbService.saveSignal(signal);
  const tradeId = await dbService.saveTrade(trade);
  await dbService.markSignalProcessed(signalId, tradeId);
  return { signalId, tradeId };
});
```

### Backup and Export

```typescript
// Create database backup
const backupPath = await dbService.backupDatabase();

// Export data in various formats
const exportPath = await dbService.exportData({
  format: 'json',
  tables: ['trades', 'signals'],
  dateRange: {
    start: Date.now() - 86400000 * 30,
    end: Date.now()
  },
  includeConfig: true
});
```

### Database Statistics

```typescript
// Get database health and statistics
const stats = await dbService.getDatabaseStats();
console.log('Tables:', stats.tables);
console.log('Total size:', stats.totalSize);
console.log('Vacuum needed:', stats.vacuumNeeded);

// Database health check
const dbUtils = new DatabaseUtils(dbService);
const health = await dbUtils.checkDatabaseHealth();
```

### Data Cleanup

```typescript
// Cleanup old data (keep last 90 days)
const deletedCount = await dbService.cleanup(90);
console.log(`Cleaned up ${deletedCount} old records`);
```

## Migration and Upgrades

The database service includes automatic migration capabilities:

```typescript
import { DatabaseMigrationService } from './database/migrations';

const migration = new DatabaseMigrationService();

// Check if migration is needed
const needsMigration = await migration.checkMigrationNeeded();

if (needsMigration) {
  // Create backup before migration
  await migration.createPreMigrationBackup();
  
  // Run migration
  await migration.migrateFromOldFormat();
  
  // Validate results
  const validation = await migration.validateMigration();
}
```

## Utilities and Helpers

### DatabaseUtils Class

```typescript
import { DatabaseUtils } from './database';

const dbUtils = new DatabaseUtils(dbService);

// Convert between formats
const dbSignal = DatabaseUtils.convertSignalToDatabase(tradingSignal, 'strategy', 'paper');
const tradingSignal = DatabaseUtils.convertSignalFromDatabase(dbSignal);

// Get summary data
const tradesSummary = await dbUtils.getTradesSummary('paper', 30);
const recentSignals = await dbUtils.getRecentSignals('paper', 50);
```

## Configuration

The database service uses configuration from `src/config/index.ts`:

```typescript
export interface Config {
  database: {
    path: string;  // SQLite database file path
  };
  // ... other config
}
```

Environment variables:
- `DATABASE_PATH`: Override database file path

## Error Handling

The service includes comprehensive error handling:

```typescript
try {
  await dbService.saveTrade(trade);
} catch (error) {
  if (error.message.includes('UNIQUE constraint')) {
    // Handle duplicate trade
  } else if (error.message.includes('FOREIGN KEY constraint')) {
    // Handle missing reference
  } else {
    // Handle other errors
  }
}
```

## Performance Considerations

- **Indexes**: Automatically created on commonly queried columns
- **WAL Mode**: Enabled for better concurrent access
- **Connection Pooling**: Managed connection pool for efficiency
- **Query Optimization**: Optimized queries with proper LIMIT and filtering
- **Batch Operations**: Use transactions for bulk operations

## Testing

Comprehensive test suite included:

```bash
# Run database tests
npm test src/database/database.test.ts

# Run specific test group
npm test -- --testNamePattern="Trade Operations"
```

## Examples

See `src/database/examples.ts` for comprehensive usage examples including:
- Basic CRUD operations
- Paper trading scenario simulation
- Performance calculation examples
- Error handling patterns

## Best Practices

1. **Always Initialize**: Call `initializeDatabase()` before use
2. **Use Transactions**: For multiple related operations
3. **Handle Errors**: Wrap database calls in try-catch blocks
4. **Close Connections**: Always call `close()` when done
5. **Regular Backups**: Implement regular backup schedule
6. **Monitor Performance**: Use database statistics for monitoring
7. **Data Validation**: Validate data before insertion
8. **Index Maintenance**: Monitor query performance and add indexes as needed

## Troubleshooting

### Common Issues

1. **Database Locked**: Multiple connections - use proper connection management
2. **Schema Mismatch**: Run migration service to update schema
3. **Large Database**: Use cleanup() method and consider archiving old data
4. **Performance Issues**: Check indexes and query patterns

### Debug Mode

Enable SQLite debugging:

```typescript
// Add to development config
process.env.DEBUG = 'sqlite:*';
```

## Integration with Trading Bot

The database service integrates seamlessly with the trading bot:

```typescript
// In your trading strategy
class MyTradingStrategy {
  constructor(private dbService: DatabaseService) {}
  
  async executeSignal(signal: TradingSignal) {
    // Save signal
    const signalId = await this.dbService.saveSignal(
      DatabaseUtils.convertSignalToDatabase(signal, this.strategyId, this.mode)
    );
    
    // Execute trade
    const trade = await this.executeTrade(signal);
    
    // Save trade and link to signal
    const tradeId = await this.dbService.saveTrade(
      DatabaseUtils.convertTradeToDatabase(trade, this.strategyId, this.mode, signalId)
    );
    
    // Mark signal as processed
    await this.dbService.markSignalProcessed(signalId, tradeId);
  }
}
```

This database service provides a robust foundation for persistent data management in your crypto trading bot, ensuring data integrity, performance, and scalability.