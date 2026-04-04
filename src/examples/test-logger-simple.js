try {
  console.log('Testing basic logger import...');
  const logger = require('../services/logger.ts');
  console.log('Logger imported successfully');
} catch (error) {
  console.error('Logger import failed:', error);
}

console.log('Test completed');