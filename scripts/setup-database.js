#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

/**
 * Setup script to initialize the crypto trading bot database service
 */
async function setupDatabase() {
  console.log('🚀 Setting up Crypto Trading Bot Database Service...\n');
  
  try {
    // 1. Create necessary directories
    const directories = [
      './data',
      './logs',
      './src/database'
    ];
    
    console.log('📁 Creating directories...');
    directories.forEach(dir => {
      const fullPath = path.resolve(dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`  ✅ Created: ${dir}`);
      } else {
        console.log(`  ✓ Already exists: ${dir}`);
      }
    });
    
    // 2. Check database dependencies
    console.log('\n📦 Checking dependencies...');
    try {
      require('sqlite3');
      console.log('  ✅ SQLite3: Available');
    } catch (err) {
      console.log('  ❌ SQLite3: Not found - run: npm install sqlite3');
      return;
    }
    
    // 3. Create .env file if it doesn't exist
    const envPath = path.resolve('./.env');
    if (!fs.existsSync(envPath)) {
      console.log('\n⚙️ Creating .env file...');
      const envContent = `# Crypto Trading Bot Configuration
# Database
DATABASE_PATH=./data/trading_bot.db

# Trading Configuration
TRADING_MODE=paper
INITIAL_CAPITAL=500
RISK_PER_TRADE=0.08
STOP_LOSS_PERCENTAGE=0.003
TAKE_PROFIT_PERCENTAGE=0.005
DAILY_LOSS_LIMIT=0.15
MAX_CONCURRENT_TRADES=3
TRADING_PAIRS=BTCUSDT,ETHUSDT,BNBUSDT

# Binance API (for live trading)
BINANCE_API_KEY=your_api_key_here
BINANCE_SECRET_KEY=your_secret_key_here
BINANCE_TESTNET=true

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/trading_bot.log
LOG_DIRECTORY=./logs

# Dashboard
DASHBOARD_PORT=3000
DASHBOARD_ENABLED=true
`;
      
      fs.writeFileSync(envPath, envContent);
      console.log('  ✅ Created .env file with default configuration');
    } else {
      console.log('  ✓ .env file already exists');
    }
    
    // 4. Test database functionality
    console.log('\n🧪 Testing database functionality...');
    const sqlite3 = require('sqlite3');
    const testDbPath = path.resolve('./data/setup_test.db');
    
    const db = new sqlite3.Database(testDbPath, (err) => {
      if (err) {
        console.error('  ❌ Database test failed:', err.message);
        return;
      }
      
      // Test table creation
      db.run(`CREATE TABLE IF NOT EXISTS test (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )`, (err) => {
        if (err) {
          console.error('  ❌ Table creation failed:', err.message);
          return;
        }
        
        // Test data operations
        db.run('INSERT INTO test (name) VALUES (?)', ['setup_test'], (err) => {
          if (err) {
            console.error('  ❌ Data insertion failed:', err.message);
            return;
          }
          
          db.get('SELECT * FROM test WHERE name = ?', ['setup_test'], (err, row) => {
            if (err) {
              console.error('  ❌ Data retrieval failed:', err.message);
              return;
            }
            
            console.log('  ✅ Database functionality verified');
            
            // Cleanup and close
            db.close((err) => {
              if (err) {
                console.error('  ❌ Database close failed:', err.message);
              }
              
              // Remove test database
              if (fs.existsSync(testDbPath)) {
                fs.unlinkSync(testDbPath);
              }
              
              // 5. Display setup summary
              console.log('\n' + '='.repeat(60));
              console.log('🎉 Database Service Setup Complete!');
              console.log('='.repeat(60));
              
              console.log('\n📋 What was set up:');
              console.log('  • Data directory for database files');
              console.log('  • Logs directory for application logs');
              console.log('  • Environment configuration file (.env)');
              console.log('  • Database functionality verified');
              
              console.log('\n🚀 Next steps:');
              console.log('  1. Configure your .env file with appropriate values');
              console.log('  2. For live trading, add your Binance API credentials');
              console.log('  3. Run the database demo: node scripts/database-demo.js');
              console.log('  4. Start using the database service in your trading bot');
              
              console.log('\n📖 Usage examples:');
              console.log('  • View database demo: node scripts/database-demo.js');
              console.log('  • Check database health: node scripts/check-database.js');
              console.log('  • Run tests: npm test src/database/');
              
              console.log('\n📂 File locations:');
              console.log('  • Database: ./data/trading_bot.db');
              console.log('  • Logs: ./logs/trading_bot.log');
              console.log('  • Config: ./.env');
              console.log('  • Source: ./src/database/');
              
              console.log('\n✨ Your crypto trading bot database service is ready!');
            });
          });
        });
      });
    });
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('  • Ensure you have Node.js installed');
    console.log('  • Run: npm install');
    console.log('  • Check file permissions');
    process.exit(1);
  }
}

// Run setup
setupDatabase();