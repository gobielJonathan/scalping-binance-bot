#!/usr/bin/env ts-node

/**
 * Main backtest runner script
 * Entry point for all backtesting operations
 */

import { runBasicBacktest } from './basic-backtest';
import { runAdvancedBacktest } from './advanced-backtest';
import { runOptimization } from './optimization-backtest';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';

  console.log('🤖 Crypto Trading Bot - Backtesting Suite\n');

  switch (command) {
    case 'basic':
      console.log('Running basic backtest...');
      await runBasicBacktest();
      break;

    case 'advanced':
      console.log('Running advanced backtest suite...');
      await runAdvancedBacktest();
      break;

    case 'optimize':
      console.log('Running strategy optimization...');
      await runOptimization();
      break;

    case 'all':
      console.log('Running complete backtesting suite...');
      try {
        console.log('\n1️⃣ Starting basic backtest...');
        await runBasicBacktest();
        
        console.log('\n2️⃣ Starting advanced backtest...');
        await runAdvancedBacktest();
        
        console.log('\n3️⃣ Starting optimization...');
        await runOptimization();
        
        console.log('\n✅ Complete backtesting suite finished!');
      } catch (error) {
        console.error('\n❌ Suite execution failed:', error);
        process.exit(1);
      }
      break;

    case 'help':
    case '-h':
    case '--help':
    default:
      console.log('Available commands:');
      console.log('  basic     - Run basic backtest with default parameters');
      console.log('  advanced  - Run comprehensive backtest across multiple scenarios');
      console.log('  optimize  - Run parameter optimization to find best settings');
      console.log('  all       - Run complete backtesting suite');
      console.log('  help      - Show this help message');
      console.log('');
      console.log('Examples:');
      console.log('  npm run backtest basic');
      console.log('  ts-node scripts/backtest.ts advanced');
      console.log('  ts-node scripts/backtest.ts optimize');
      break;
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}