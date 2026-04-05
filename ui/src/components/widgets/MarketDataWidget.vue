<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMarketStore } from '@/stores'
import WidgetContainer from '../layout/WidgetContainer.vue'
import type { Ticker } from '@/types/api'

const marketStore = useMarketStore()

// Local state
const watchedSymbols = ref(['BTC/USD', 'ETH/USD', 'SOL/USD', 'XRP/USD', 'ADA/USD'])
const selectedSymbol = ref<string | null>(null)

// Computed properties
const allTickers = computed(() => marketStore.allTickers)

const filteredTickers = computed(() => {
  return allTickers.value.filter((ticker) =>
    watchedSymbols.value.includes(ticker.symbol)
  )
})

const topGainers = computed(() => {
  return [...allTickers.value]
    .sort((a, b) => b.priceChangePercent24h - a.priceChangePercent24h)
    .slice(0, 3)
})

const topLosers = computed(() => {
  return [...allTickers.value]
    .sort((a, b) => a.priceChangePercent24h - b.priceChangePercent24h)
    .slice(0, 3)
})

// Utility functions
const formatPrice = (price: number) => {
  if (price < 1) {
    return price.toFixed(8).replace(/\.?0+$/, '')
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(price)
}

const formatVolume = (volume: number) => {
  if (volume >= 1e9) {
    return (volume / 1e9).toFixed(2) + 'B'
  }
  if (volume >= 1e6) {
    return (volume / 1e6).toFixed(2) + 'M'
  }
  if (volume >= 1e3) {
    return (volume / 1e3).toFixed(2) + 'K'
  }
  return volume.toFixed(0)
}

const formatSpread = (bid: number, ask: number) => {
  if (bid === 0 || ask === 0) return '—'
  const spread = ask - bid
  const spreadPercent = ((spread / bid) * 100).toFixed(3)
  return `${spreadPercent}%`
}

const getChangeColor = (value: number) => {
  return value >= 0 ? 'profit' : 'loss'
}

const getChangeIcon = (value: number) => {
  return value >= 0 ? '↑' : '↓'
}

// Add or remove watched symbol
const toggleWatchedSymbol = (symbol: string) => {
  const index = watchedSymbols.value.indexOf(symbol)
  if (index > -1) {
    watchedSymbols.value.splice(index, 1)
  } else {
    watchedSymbols.value.push(symbol)
  }
}

// Load market data on mount
onMounted(() => {
  // Subscribe to watched symbols
  watchedSymbols.value.forEach((symbol) => {
    marketStore.watchSymbol(symbol)
  })
})
</script>

<template>
  <widget-container
    title="Market Data"
    :loading="false"
  >
    <div class="market-widget">
      <!-- Main Watched Symbols Section -->
      <div class="section">
        <h6 class="section-title">Watched Pairs</h6>
        <div class="tickers-grid">
          <div
            v-for="ticker in filteredTickers"
            :key="ticker.symbol"
            class="ticker-card"
            :class="{ active: selectedSymbol === ticker.symbol }"
            @click="selectedSymbol = ticker.symbol"
          >
            <div class="ticker-header">
              <div class="ticker-symbol">{{ ticker.symbol }}</div>
              <div :class="['ticker-change', getChangeColor(ticker.priceChangePercent24h)]">
                {{ getChangeIcon(ticker.priceChangePercent24h) }}
                {{ Math.abs(ticker.priceChangePercent24h).toFixed(2) }}%
              </div>
            </div>

            <div class="ticker-price">
              {{ formatPrice(ticker.lastPrice) }}
            </div>

            <div class="ticker-details">
              <div class="detail-row">
                <span class="detail-label">24h High</span>
                <span class="detail-value">{{ formatPrice(ticker.high24h) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">24h Low</span>
                <span class="detail-value">{{ formatPrice(ticker.low24h) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Volume</span>
                <span class="detail-value">{{ formatVolume(ticker.volume24h) }}</span>
              </div>
              <div class="detail-row">
                <span class="detail-label">Spread</span>
                <span class="detail-value">{{ formatSpread(ticker.bid, ticker.ask) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Top Gainers Section -->
      <div class="section">
        <h6 class="section-title">Top Gainers (24h)</h6>
        <div class="list-container">
          <div
            v-for="ticker in topGainers"
            :key="`gainer-${ticker.symbol}`"
            class="list-item gainer"
          >
            <div class="list-symbol">{{ ticker.symbol }}</div>
            <div class="list-price">{{ formatPrice(ticker.lastPrice) }}</div>
            <div :class="['list-change', 'profit']">
              ↑ {{ ticker.priceChangePercent24h.toFixed(2) }}%
            </div>
          </div>
        </div>
      </div>

      <!-- Top Losers Section -->
      <div class="section">
        <h6 class="section-title">Top Losers (24h)</h6>
        <div class="list-container">
          <div
            v-for="ticker in topLosers"
            :key="`loser-${ticker.symbol}`"
            class="list-item loser"
          >
            <div class="list-symbol">{{ ticker.symbol }}</div>
            <div class="list-price">{{ formatPrice(ticker.lastPrice) }}</div>
            <div :class="['list-change', 'loss']">
              ↓ {{ Math.abs(ticker.priceChangePercent24h).toFixed(2) }}%
            </div>
          </div>
        </div>
      </div>

      <!-- Bid/Ask Spreads Section -->
      <div class="section">
        <h6 class="section-title">Bid/Ask Details</h6>
        <div class="spreads-table">
          <div class="spread-header">
            <div class="spread-col">Symbol</div>
            <div class="spread-col">Bid</div>
            <div class="spread-col">Ask</div>
            <div class="spread-col">Spread</div>
          </div>
          <div
            v-for="ticker in filteredTickers"
            :key="`spread-${ticker.symbol}`"
            class="spread-row"
          >
            <div class="spread-col">{{ ticker.symbol }}</div>
            <div class="spread-col">{{ formatPrice(ticker.bid) }}</div>
            <div class="spread-col">{{ formatPrice(ticker.ask) }}</div>
            <div class="spread-col">{{ formatSpread(ticker.bid, ticker.ask) }}</div>
          </div>
        </div>
      </div>
    </div>
  </widget-container>
</template>

<style scoped>
.market-widget {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-lg);
}

.section {
  border-bottom: 1px solid var(--trading-border);
  padding-bottom: var(--trading-spacing-lg);
}

.section:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.section-title {
  margin: 0 0 var(--trading-spacing-md) 0;
  font-size: 0.875rem;
  text-transform: uppercase;
  color: var(--trading-text-secondary);
  letter-spacing: 0.05em;
  font-weight: 600;
}

.tickers-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: var(--trading-spacing-md);
}

.ticker-card {
  padding: var(--trading-spacing-lg);
  background: var(--trading-bg-tertiary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-lg);
  cursor: pointer;
  transition: all 0.3s ease;
}

.ticker-card:hover {
  border-color: var(--trading-border-light);
  background: var(--trading-bg-hover);
}

.ticker-card.active {
  border-color: var(--trading-accent-blue);
  background: rgba(52, 152, 219, 0.05);
}

.ticker-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--trading-spacing-md);
}

.ticker-symbol {
  font-weight: 700;
  color: var(--trading-text-primary);
  font-size: 0.95rem;
}

.ticker-change {
  font-size: 0.8rem;
  font-weight: 600;
}

.ticker-change.profit {
  color: var(--trading-profit);
}

.ticker-change.loss {
  color: var(--trading-loss);
}

.ticker-price {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--trading-text-primary);
  margin-bottom: var(--trading-spacing-md);
  word-break: break-word;
}

.ticker-details {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-xs);
  font-size: 0.8rem;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-label {
  color: var(--trading-text-tertiary);
  font-weight: 600;
}

.detail-value {
  color: var(--trading-text-primary);
  font-weight: 500;
  text-align: right;
}

.list-container {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-sm);
}

.list-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--trading-spacing-md);
  background: var(--trading-bg-tertiary);
  border: 1px solid var(--trading-border);
  border-left: 4px solid transparent;
  border-radius: var(--trading-radius-md);
  transition: all 0.2s ease;
}

.list-item:hover {
  background: var(--trading-bg-hover);
  border-color: var(--trading-border-light);
}

.list-item.gainer {
  border-left-color: var(--trading-profit);
}

.list-item.loser {
  border-left-color: var(--trading-loss);
}

.list-symbol {
  font-weight: 700;
  color: var(--trading-text-primary);
  min-width: 100px;
}

.list-price {
  flex: 1;
  text-align: center;
  color: var(--trading-text-secondary);
  font-size: 0.9rem;
}

.list-change {
  text-align: right;
  font-weight: 600;
  font-size: 0.9rem;
  min-width: 100px;
}

.list-change.profit {
  color: var(--trading-profit);
}

.list-change.loss {
  color: var(--trading-loss);
}

.spreads-table {
  display: flex;
  flex-direction: column;
  gap: 0;
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  overflow: hidden;
}

.spread-header {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 0;
  background: var(--trading-bg-tertiary);
  border-bottom: 1px solid var(--trading-border);
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  color: var(--trading-text-secondary);
  letter-spacing: 0.05em;
}

.spread-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 0;
  border-bottom: 1px solid var(--trading-border);
}

.spread-row:last-child {
  border-bottom: none;
}

.spread-col {
  padding: var(--trading-spacing-md);
  color: var(--trading-text-primary);
  font-size: 0.85rem;
  text-align: right;
}

.spread-row .spread-col:first-child,
.spread-header .spread-col:first-child {
  text-align: left;
  font-weight: 600;
}

/* Responsive design */
@media (max-width: 768px) {
  .tickers-grid {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }

  .ticker-price {
    font-size: 1.25rem;
  }

  .spreads-table {
    font-size: 0.8rem;
  }

  .spread-col {
    padding: var(--trading-spacing-sm);
  }
}

@media (max-width: 576px) {
  .tickers-grid {
    grid-template-columns: 1fr;
  }

  .list-item {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--trading-spacing-sm);
  }

  .list-price {
    width: 100%;
    text-align: left;
  }

  .list-change {
    width: 100%;
    text-align: left;
  }

  .spreads-table {
    font-size: 0.75rem;
  }

  .spread-header,
  .spread-row {
    grid-template-columns: repeat(2, 1fr);
  }

  .spread-col {
    padding: var(--trading-spacing-xs);
  }
}
</style>
