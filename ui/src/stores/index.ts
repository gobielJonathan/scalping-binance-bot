/**
 * Pinia Store Setup & Exports
 * Central store configuration and exports
 */

// Export all stores
export { usePortfolioStore } from './portfolio'
export { usePositionsStore } from './positions'
export { useTradesStore } from './trades'
export { useMarketStore } from './market'
export { useSystemStore } from './system'

// For backwards compatibility, re-export legacy store patterns if needed
export { useAppStore } from './app'
