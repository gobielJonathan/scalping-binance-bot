export { default as DatabaseService } from './databaseService';
export { default as DatabaseUtils } from './databaseUtils';

// Re-export database-related types for convenience
export type {
  DatabaseTrade,
  DatabasePortfolioSnapshot,
  DatabaseSignal,
  DatabasePerformanceMetrics,
  DatabaseConfig,
  DatabaseQuery,
  DatabaseTransactionCallback,
  DatabaseExportOptions
} from '../types';