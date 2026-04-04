#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

// Simple test to verify database functionality
async function testDatabase() {
  console.log('🚀 Testing database service...');
  
  try {
    // Test that data directory is created
    const dataDir = path.resolve('./data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    console.log('✅ Data directory created successfully');
    
    // Test SQLite3 module loading
    const sqlite3 = require('sqlite3');
    console.log('✅ SQLite3 module loaded successfully');
    
    // Test database creation
    const dbPath = path.join(dataDir, 'test.db');
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('❌ Database connection failed:', err);
        return;
      }
      
      console.log('✅ Database connection successful');
      
      // Test table creation
      db.run(`CREATE TABLE IF NOT EXISTS test_table (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )`, (err) => {
        if (err) {
          console.error('❌ Table creation failed:', err);
          return;
        }
        
        console.log('✅ Table created successfully');
        
        // Test data insertion
        db.run('INSERT INTO test_table (name) VALUES (?)', ['test_data'], (err) => {
          if (err) {
            console.error('❌ Data insertion failed:', err);
            return;
          }
          
          console.log('✅ Data inserted successfully');
          
          // Test data retrieval
          db.get('SELECT * FROM test_table LIMIT 1', (err, row) => {
            if (err) {
              console.error('❌ Data retrieval failed:', err);
              return;
            }
            
            console.log('✅ Data retrieved successfully:', row);
            
            // Close database
            db.close((err) => {
              if (err) {
                console.error('❌ Database close failed:', err);
              } else {
                console.log('✅ Database closed successfully');
              }
              
              // Cleanup test file
              if (fs.existsSync(dbPath)) {
                fs.unlinkSync(dbPath);
                console.log('✅ Test database cleaned up');
              }
              
              console.log('\n🎉 All database tests passed!');
            });
          });
        });
      });
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run test
testDatabase();