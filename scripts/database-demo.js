#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3');

/**
 * Simple demonstration of the crypto trading bot database functionality
 */
async function demonstrateDatabase() {
  console.log('🚀 Starting crypto trading bot database demonstration...\n');
  
  const dataDir = path.resolve('./data');
  const dbPath = path.join(dataDir, 'demo_trading_bot.db');
  
  // Ensure data directory exists
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }
      
      console.log('✅ Connected to trading bot database');
      
      // Create tables
      db.serialize(() => {
        // Trades table
        db.run(`CREATE TABLE IF NOT EXISTS trades (
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
          mode TEXT NOT NULL CHECK (mode IN ('paper', 'live')),
          orderId TEXT,
          notes TEXT,
          createdAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000),
          updatedAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
        )`);

        // Signals table
        db.run(`CREATE TABLE IF NOT EXISTS signals (
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
          createdAt INTEGER NOT NULL DEFAULT (strftime('%s', 'now') * 1000)
        )`);

        // Portfolio history table
        db.run(`CREATE TABLE IF NOT EXISTS portfolio_history (
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
        )`);

        console.log('✅ Database tables created successfully');
        
        // Generate sample data
        generateSampleData(db)
          .then(() => {
            console.log('✅ Sample data generated successfully');
            return queryAndDisplayData(db);
          })
          .then(() => {
            console.log('✅ Data queries completed successfully');
            
            // Close database
            db.close((err) => {
              if (err) {
                reject(err);
              } else {
                console.log('✅ Database connection closed');
                console.log(`\n📄 Database file created at: ${dbPath}`);
                console.log('\n🎉 Database demonstration completed successfully!');
                resolve();
              }
            });
          })
          .catch(reject);
      });
    });
  });
}

function generateSampleData(db) {
  return new Promise((resolve, reject) => {
    console.log('\n📊 Generating sample trading data...');
    
    const signals = [];
    const trades = [];
    const portfolios = [];
    
    const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'DOGEUSDT'];
    const strategies = ['ema_crossover', 'rsi_oversold', 'bollinger_bounce', 'macd_divergence'];
    
    // Generate signals and trades
    for (let i = 0; i < 20; i++) {
      const signalId = `signal_${Date.now()}_${i}`;
      const tradeId = `trade_${Date.now()}_${i}`;
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const strategy = strategies[Math.floor(Math.random() * strategies.length)];
      const side = Math.random() > 0.5 ? 'BUY' : 'SELL';
      const timestamp = Date.now() - Math.random() * 86400000 * 7; // Within last 7 days
      
      // Signal data
      signals.push({
        id: signalId,
        symbol,
        type: side,
        strength: Math.floor(Math.random() * 40) + 60, // 60-100
        confidence: Math.floor(Math.random() * 30) + 70, // 70-100
        reason: `${strategy} strategy triggered`,
        timestamp,
        indicators: JSON.stringify({
          ema9: 45000 + Math.random() * 5000,
          ema21: 44000 + Math.random() * 5000,
          rsi: Math.random() * 100,
          macd: Math.random() * 200 - 100
        }),
        processed: true,
        tradeId,
        strategyId: strategy,
        mode: 'paper'
      });
      
      // Trade data
      const entryPrice = 45000 + Math.random() * 10000;
      const quantity = 0.001 + Math.random() * 0.01;
      const pnlPercent = (Math.random() * 8) - 4; // -4% to +4%
      const pnl = entryPrice * quantity * (pnlPercent / 100);
      
      trades.push({
        id: tradeId,
        symbol,
        side,
        type: 'MARKET',
        quantity,
        entryPrice,
        exitPrice: entryPrice * (1 + pnlPercent / 100),
        pnl,
        pnlPercent,
        fees: entryPrice * quantity * 0.001, // 0.1% fee
        status: 'CLOSED',
        openTime: timestamp,
        closeTime: timestamp + Math.random() * 3600000, // Close within 1 hour
        strategyId: strategy,
        mode: 'paper'
      });
    }
    
    // Generate portfolio snapshots
    let runningBalance = 1000;
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dailyPnl = (Math.random() * 40) - 20; // -$20 to +$20
      runningBalance += dailyPnl;
      
      portfolios.push({
        id: `portfolio_${Date.now()}_${i}`,
        timestamp: date.getTime(),
        totalBalance: runningBalance,
        availableBalance: runningBalance * 0.8,
        lockedBalance: runningBalance * 0.2,
        totalPnl: runningBalance - 1000,
        totalPnlPercent: ((runningBalance - 1000) / 1000) * 100,
        dailyPnl,
        dailyPnlPercent: (dailyPnl / runningBalance) * 100,
        openPositionsCount: Math.floor(Math.random() * 3),
        riskExposure: Math.random() * 0.1,
        maxDrawdown: Math.random() * 0.05,
        mode: 'paper',
        date: dateStr
      });
    }
    
    // Insert all data
    let completed = 0;
    const total = signals.length + trades.length + portfolios.length;
    
    function checkComplete() {
      completed++;
      if (completed === total) {
        resolve();
      }
    }
    
    // Insert signals
    signals.forEach(signal => {
      db.run(`INSERT INTO signals (
        id, symbol, type, strength, confidence, reason, timestamp, indicators,
        processed, tradeId, strategyId, mode
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        signal.id, signal.symbol, signal.type, signal.strength, signal.confidence,
        signal.reason, signal.timestamp, signal.indicators, signal.processed,
        signal.tradeId, signal.strategyId, signal.mode
      ], (err) => {
        if (err) reject(err);
        else checkComplete();
      });
    });
    
    // Insert trades
    trades.forEach(trade => {
      db.run(`INSERT INTO trades (
        id, symbol, side, type, quantity, entryPrice, exitPrice, pnl, pnlPercent,
        fees, status, openTime, closeTime, strategyId, mode
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        trade.id, trade.symbol, trade.side, trade.type, trade.quantity,
        trade.entryPrice, trade.exitPrice, trade.pnl, trade.pnlPercent,
        trade.fees, trade.status, trade.openTime, trade.closeTime,
        trade.strategyId, trade.mode
      ], (err) => {
        if (err) reject(err);
        else checkComplete();
      });
    });
    
    // Insert portfolios
    portfolios.forEach(portfolio => {
      db.run(`INSERT OR REPLACE INTO portfolio_history (
        id, timestamp, totalBalance, availableBalance, lockedBalance, totalPnl,
        totalPnlPercent, dailyPnl, dailyPnlPercent, openPositionsCount,
        riskExposure, maxDrawdown, mode, date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        portfolio.id, portfolio.timestamp, portfolio.totalBalance,
        portfolio.availableBalance, portfolio.lockedBalance, portfolio.totalPnl,
        portfolio.totalPnlPercent, portfolio.dailyPnl, portfolio.dailyPnlPercent,
        portfolio.openPositionsCount, portfolio.riskExposure, portfolio.maxDrawdown,
        portfolio.mode, portfolio.date
      ], (err) => {
        if (err) reject(err);
        else checkComplete();
      });
    });
  });
}

function queryAndDisplayData(db) {
  return new Promise((resolve, reject) => {
    console.log('\n📈 Querying and displaying data...\n');
    
    // Get trade statistics
    db.get(`SELECT 
      COUNT(*) as totalTrades,
      COUNT(CASE WHEN pnl > 0 THEN 1 END) as winningTrades,
      COUNT(CASE WHEN pnl <= 0 THEN 1 END) as losingTrades,
      SUM(pnl) as totalPnl,
      AVG(pnl) as avgPnl,
      MAX(pnl) as bestTrade,
      MIN(pnl) as worstTrade
    FROM trades WHERE status = 'CLOSED'`, (err, stats) => {
      if (err) {
        reject(err);
        return;
      }
      
      console.log('📊 Trade Statistics:');
      console.log(`  Total Trades: ${stats.totalTrades}`);
      console.log(`  Winning Trades: ${stats.winningTrades}`);
      console.log(`  Losing Trades: ${stats.losingTrades}`);
      console.log(`  Win Rate: ${((stats.winningTrades / stats.totalTrades) * 100).toFixed(2)}%`);
      console.log(`  Total PnL: $${stats.totalPnl.toFixed(2)}`);
      console.log(`  Average PnL: $${stats.avgPnl.toFixed(2)}`);
      console.log(`  Best Trade: $${stats.bestTrade.toFixed(2)}`);
      console.log(`  Worst Trade: $${stats.worstTrade.toFixed(2)}`);
      
      // Get recent trades
      db.all(`SELECT symbol, side, pnl, pnlPercent, strategyId 
              FROM trades 
              ORDER BY openTime DESC 
              LIMIT 5`, (err, recentTrades) => {
        if (err) {
          reject(err);
          return;
        }
        
        console.log('\n🔄 Recent Trades:');
        recentTrades.forEach((trade, index) => {
          const pnlColor = trade.pnl >= 0 ? '🟢' : '🔴';
          console.log(`  ${index + 1}. ${trade.symbol} ${trade.side} - ${pnlColor} $${trade.pnl.toFixed(2)} (${trade.pnlPercent.toFixed(2)}%) - ${trade.strategyId}`);
        });
        
        // Get portfolio performance
        db.all(`SELECT date, totalBalance, dailyPnl, totalPnlPercent 
                FROM portfolio_history 
                ORDER BY date DESC 
                LIMIT 7`, (err, portfolios) => {
          if (err) {
            reject(err);
            return;
          }
          
          console.log('\n💰 Portfolio Performance (Last 7 Days):');
          portfolios.forEach(portfolio => {
            const changeColor = portfolio.dailyPnl >= 0 ? '🟢' : '🔴';
            console.log(`  ${portfolio.date}: $${portfolio.totalBalance.toFixed(2)} ${changeColor} $${portfolio.dailyPnl.toFixed(2)} (Total: ${portfolio.totalPnlPercent.toFixed(2)}%)`);
          });
          
          // Get signal summary
          db.all(`SELECT strategyId, COUNT(*) as count, AVG(strength) as avgStrength
                  FROM signals 
                  GROUP BY strategyId 
                  ORDER BY count DESC`, (err, strategies) => {
            if (err) {
              reject(err);
              return;
            }
            
            console.log('\n🎯 Strategy Signal Summary:');
            strategies.forEach(strategy => {
              console.log(`  ${strategy.strategyId}: ${strategy.count} signals (avg strength: ${strategy.avgStrength.toFixed(1)})`);
            });
            
            resolve();
          });
        });
      });
    });
  });
}

// Run demonstration
demonstrateDatabase().catch(console.error);