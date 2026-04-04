import config from '../config';

console.log('Config test:', {
  logLevel: config.logging.level,
  logDirectory: config.logging.directory,
  monitoringEnabled: config.monitoring.enabled
});

console.log('Simple test completed');