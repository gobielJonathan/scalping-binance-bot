<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { PnLChart } from '@/components/charts'
import apiService from '@/services/api'
import websocket from '@/services/websocket'
import { useResponsive } from '@/composables'
import type { Portfolio } from '@/types/api'

// PrimeVue components
import Card from 'primevue/card'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import SelectButton from 'primevue/selectbutton'
import Skeleton from 'primevue/skeleton'
import Chip from 'primevue/chip'

const { isMobile } = useResponsive()

// ─── Loading State ──────────────────────────────────────────────────────────
const loading = ref(true)

// ─── Types ───────────────────────────────────────────────────────────────────
interface OpenPosition {
  symbol: string
  quantity: number
  entryPrice: number
  currentPrice: number
  pnl: number
  stopLoss?: number
}

interface AnalyticsStats {
  total: {
    trades: number; closedTrades: number; openTrades: number
    uniqueSymbols: number; totalPnl: number; totalFees: number
    winRate: number; profitFactor: number; bestTrade: number; worstTrade: number
  }
  today: { trades: number; pnl: number; wins: number }
  week: { trades: number; pnl: number }
}

interface AnalyticsTrade {
  id?: string | number
  symbol: string
  side: string
  outcome: 'WIN' | 'LOSS' | 'BREAKEVEN'
  pnlRounded: number
  pnlPercentRounded: number
  openTimeFormatted: string
  closeTimeFormatted: string | null
  status: string
  openTime?: number
}

interface MarketSymbol {
  symbol: string
  price: number
  priceChange24h: number
  priceChangePercent24h: number
  volume24h: number
}

interface Signal {
  id?: string | number
  symbol: string
  direction: 'BUY' | 'SELL'
  strength?: string | number
  timestamp: number | string
  price?: number
  indicator?: string
}

// ─── State ───────────────────────────────────────────────────────────────────
const totalBalance = ref(0)
const analyticsStats = ref<AnalyticsStats | null>(null)
const openPositions = ref<OpenPosition[]>([])
const marketData = ref<MarketSymbol[]>([])
const signals = ref<Signal[]>([])
const trades = ref<AnalyticsTrade[]>([])
const tradesPagination = ref({ total: 0, limit: 20, offset: 0, pages: 0 })
const portfolioHistory = ref<Portfolio[]>([])
const pnlInterval = ref<'1H' | '1D' | '1W'>('1D')

// ─── Computed ─────────────────────────────────────────────────────────────
const dailyPnL = computed(() => analyticsStats.value?.today.pnl ?? 0)
const winRate = computed(() => analyticsStats.value?.total.winRate ?? 0)
const totalOpenTrades = computed(() => analyticsStats.value?.total.openTrades ?? 0)
const hasDailyGain = computed(() => dailyPnL.value >= 0)

const pnlIntervalOptions = [
  { label: '1H', value: '1H' },
  { label: '1D', value: '1D' },
  { label: '1W', value: '1W' },
]

// ─── Data Loaders ────────────────────────────────────────────────────────────

const loadStats = async () => {
  const res = await apiService.getAnalyticsStats({ mode: 'paper' })
  if (res.success && res.data) analyticsStats.value = res.data as AnalyticsStats
}

// Portfolio and market data are pushed by the server via websocket (no dedicated REST
// endpoints exist for /api/portfolio or /api/market/data).

const loadTrades = async (offset = 0) => {
  const res = await apiService.getAnalyticsTrades({
    mode: 'paper',
    limit: 20,
    offset,
    sortBy: 'closeTime',
    sortOrder: 'DESC',
  })
  if (res.success && res.data) {
    const data = res.data as any
    trades.value = data.trades ?? []
    tradesPagination.value = data.pagination ?? { total: 0, limit: 20, offset, pages: 0 }
  }
}

/** Build synthetic portfolio history from analytics trades for the PnL chart */
const buildPortfolioHistory = async () => {
  const res = await apiService.getAnalyticsTrades({
    mode: 'paper',
    limit: 200,
    sortBy: 'closeTime',
    sortOrder: 'ASC',
  })
  if (!res.success || !res.data) return
  const data = res.data as any
  const rows: AnalyticsTrade[] = data.trades ?? []
  let running = totalBalance.value || 10000
  portfolioHistory.value = rows.map((t, i) => {
    running += t.pnlRounded ?? 0
    return {
      id: `ph-${i}`,
      accountId: 'account-1',
      totalBalance: running,
      availableBalance: running * 0.9,
      equity: running,
      investedBalance: running * 0.7,
      pnl: running - (totalBalance.value || 10000),
      pnlPercent: ((running - (totalBalance.value || 10000)) / (totalBalance.value || 10000)) * 100,
      updatedAt: t.closeTimeFormatted ?? t.openTimeFormatted,
    } as Portfolio
  })
}

// ─── Socket Signals ──────────────────────────────────────────────────────────
const handleNewSignal = (signal: any) => {
  signals.value = [signal, ...signals.value].slice(0, 30)
}

const handleDashboardData = (data: any) => {
  // Portfolio
  if (data.portfolio) {
    totalBalance.value = data.portfolio.totalBalance ?? totalBalance.value
    if (Array.isArray(data.portfolio.openPositions)) {
      openPositions.value = data.portfolio.openPositions
    }
  }
  // Positions (some servers send separately)
  if (Array.isArray(data.activePositions) && data.activePositions.length > 0) {
    openPositions.value = data.activePositions
  }
  // Market data
  if (Array.isArray(data.marketData) && data.marketData.length > 0) {
    marketData.value = data.marketData
  }
  // Signals
  if (Array.isArray(data.recentSignals)) {
    signals.value = data.recentSignals.slice(0, 30)
  }
}

const handleMarketData = (data: any) => {
  if (!data) return
  // Server emits single symbol updates; merge into the list
  const incoming: MarketSymbol = {
    symbol: data.symbol,
    price: data.price ?? data.lastPrice ?? 0,
    priceChange24h: data.priceChange24h ?? 0,
    priceChangePercent24h: data.priceChangePercent24h ?? 0,
    volume24h: data.volume24h ?? 0,
  }
  const idx = marketData.value.findIndex((m) => m.symbol === incoming.symbol)
  if (idx >= 0) {
    marketData.value[idx] = incoming
  } else {
    marketData.value = [...marketData.value, incoming]
  }
}

let unsubSignal: (() => void) | null = null
let unsubDashboard: (() => void) | null = null
let unsubMarketData: (() => void) | null = null

// ─── Trade Table Pagination ───────────────────────────────────────────────────
const onTradePage = (event: any) => {
  loadTrades(event.first)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number, decimals = 2) =>
  n?.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) ?? '—'

const outcomeTag = (outcome: string) => {
  if (outcome === 'WIN') return 'success'
  if (outcome === 'LOSS') return 'danger'
  return 'secondary'
}

const signalTag = (dir: string) => (dir === 'BUY' ? 'success' : 'danger')

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([loadStats(), loadTrades()])
  await buildPortfolioHistory()
  loading.value = false
  unsubSignal = websocket.subscribe('new-signal' as any, handleNewSignal)
  unsubDashboard = websocket.subscribe('dashboard-data' as any, handleDashboardData)
  unsubMarketData = websocket.subscribe('market-data' as any, handleMarketData)
})

onUnmounted(() => {
  unsubSignal?.()
  unsubDashboard?.()
  unsubMarketData?.()
})
</script>

<template>
  <div class="min-h-screen bg-[#0f1419] text-[#f0f2f5] p-4 md:p-6">

    <!-- ── Header ───────────────────────────────────────────────────────── -->
    <div class="flex items-center justify-between mb-6 flex-wrap gap-3">
      <div>
        <h1 class="text-2xl font-bold text-white m-0">Trading Dashboard</h1>
        <p class="text-[#a0a6b2] text-sm mt-1 m-0">Real-time portfolio &amp; market overview</p>
      </div>
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-[#252d3a] border border-[#323a47]">
          <span :class="['w-2 h-2 rounded-full', analyticsStats ? 'bg-[#26c281] animate-pulse' : 'bg-[#e74c3c]']"></span>
          {{ analyticsStats ? 'Live' : 'Connecting…' }}
        </span>
      </div>
    </div>

    <!-- ── Row 1: Stat Cards ─────────────────────────────────────────────── -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">

      <!-- Total Balance -->
      <Card class="!bg-[#1a1f29] !border-[#323a47] !rounded-xl">
        <template #content>
          <div v-if="loading" class="space-y-2">
            <Skeleton width="60%" height="0.75rem" />
            <Skeleton width="80%" height="1.5rem" />
          </div>
          <template v-else>
            <p class="text-[#a0a6b2] text-xs uppercase tracking-wider mb-1 m-0">Total Balance</p>
            <p class="text-xl font-bold text-white m-0">${{ fmt(totalBalance) }}</p>
          </template>
        </template>
      </Card>

      <!-- Daily PnL -->
      <Card class="!bg-[#1a1f29] !border-[#323a47] !rounded-xl">
        <template #content>
          <div v-if="loading" class="space-y-2">
            <Skeleton width="60%" height="0.75rem" />
            <Skeleton width="80%" height="1.5rem" />
          </div>
          <template v-else>
            <p class="text-[#a0a6b2] text-xs uppercase tracking-wider mb-1 m-0">Daily P&amp;L</p>
            <p class="text-xl font-bold m-0" :class="hasDailyGain ? 'text-[#26c281]' : 'text-[#e74c3c]'">
              {{ hasDailyGain ? '+' : '' }}${{ fmt(Math.abs(dailyPnL)) }}
            </p>
          </template>
        </template>
      </Card>

      <!-- Win Rate -->
      <Card class="!bg-[#1a1f29] !border-[#323a47] !rounded-xl">
        <template #content>
          <div v-if="loading" class="space-y-2">
            <Skeleton width="60%" height="0.75rem" />
            <Skeleton width="80%" height="1.5rem" />
          </div>
          <template v-else>
            <p class="text-[#a0a6b2] text-xs uppercase tracking-wider mb-1 m-0">Win Rate</p>
            <p class="text-xl font-bold text-[#3498db] m-0">{{ fmt(winRate, 1) }}%</p>
          </template>
        </template>
      </Card>

      <!-- Total Open Trades -->
      <Card class="!bg-[#1a1f29] !border-[#323a47] !rounded-xl">
        <template #content>
          <div v-if="loading" class="space-y-2">
            <Skeleton width="60%" height="0.75rem" />
            <Skeleton width="80%" height="1.5rem" />
          </div>
          <template v-else>
            <p class="text-[#a0a6b2] text-xs uppercase tracking-wider mb-1 m-0">Total Open Trades</p>
            <p class="text-xl font-bold text-white m-0">{{ totalOpenTrades }}</p>
          </template>
        </template>
      </Card>
    </div>

    <!-- ── Row 2: PnL Chart + Open Trades ───────────────────────────────── -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

      <!-- PnL Chart -->
      <Card class="!bg-[#1a1f29] !border-[#323a47] !rounded-xl">
        <template #header>
          <div class="flex items-center justify-between px-4 pt-4">
            <span class="text-sm font-semibold text-[#f0f2f5]">P&amp;L Chart</span>
            <SelectButton
              v-model="pnlInterval"
              :options="pnlIntervalOptions"
              option-label="label"
              option-value="value"
              size="small"
              class="pnl-interval-select"
            />
          </div>
        </template>
        <template #content>
          <div v-if="loading" class="flex flex-col gap-2 px-1">
            <Skeleton height="200px" class="rounded-lg" />
          </div>
          <template v-else-if="portfolioHistory.length > 0">
            <PnLChart
              :data="portfolioHistory"
              height="220px"
              theme="dark"
              :interval="pnlInterval"
              :show-watermark="false"
              @error="(e: Error) => console.error('PnL chart error', e)"
            />
          </template>
          <div
            v-else
            class="flex items-center justify-center h-[220px] text-[#6e7684] text-sm"
          >
            No trade history to plot
          </div>
        </template>
      </Card>

      <!-- Open Trades -->
      <Card class="!bg-[#1a1f29] !border-[#323a47] !rounded-xl">
        <template #header>
          <div class="px-4 pt-4">
            <span class="text-sm font-semibold text-[#f0f2f5]">Open Trades</span>
          </div>
        </template>
        <template #content>
          <div v-if="loading" class="flex flex-col gap-2">
            <Skeleton v-for="n in 3" :key="n" height="2.5rem" class="rounded-lg" />
          </div>
          <div v-else-if="openPositions.length === 0" class="text-[#6e7684] text-sm text-center py-6">
            No open positions
          </div>
          <div v-else class="flex flex-col gap-2 max-h-[240px] overflow-y-auto pr-1">
            <div
              v-for="pos in openPositions"
              :key="pos.symbol"
              class="flex items-center justify-between py-2 px-3 rounded-lg bg-[#252d3a] border border-[#323a47]"
            >
              <div class="flex items-center gap-2 min-w-0">
                <span class="font-semibold text-sm text-white truncate">{{ pos.symbol }}</span>
                <span class="text-[#a0a6b2] text-xs">×{{ pos.quantity }}</span>
              </div>
              <div class="flex flex-col items-end gap-0.5 text-xs shrink-0">
                <span class="text-[#a0a6b2]">Open: <span class="text-white font-medium">${{ fmt(pos.entryPrice) }}</span></span>
                <span class="text-[#a0a6b2]">
                  SL:
                  <span class="font-medium" :class="pos.stopLoss ? 'text-[#e74c3c]' : 'text-[#6e7684]'">
                    {{ pos.stopLoss ? '$' + fmt(pos.stopLoss) : '—' }}
                  </span>
                </span>
              </div>
              <div class="shrink-0 ml-3">
                <span :class="['text-sm font-bold', pos.pnl >= 0 ? 'text-[#26c281]' : 'text-[#e74c3c]']">
                  {{ pos.pnl >= 0 ? '+' : '' }}${{ fmt(pos.pnl) }}
                </span>
              </div>
            </div>
          </div>
        </template>
      </Card>
    </div>

    <!-- ── Row 3: Market Data + Signal Market ───────────────────────────── -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">

      <!-- Market Data -->
      <Card class="!bg-[#1a1f29] !border-[#323a47] !rounded-xl">
        <template #header>
          <div class="px-4 pt-4">
            <span class="text-sm font-semibold text-[#f0f2f5]">Market Data</span>
          </div>
        </template>
        <template #content>
          <div v-if="loading" class="flex flex-col gap-2">
            <Skeleton v-for="n in 4" :key="n" height="2rem" class="rounded" />
          </div>
          <DataTable
            v-else
            :value="marketData"
            :rows="6"
            paginator
            :paginator-template="'PrevPageLink PageLinks NextPageLink'"
            size="small"
            class="market-table"
            striped-rows
          >
            <Column field="symbol" header="Symbol" class="font-semibold !text-white" />
            <Column field="price" header="Price">
              <template #body="{ data }">
                <span class="font-mono text-white">${{ fmt(data.price) }}</span>
              </template>
            </Column>
            <Column field="priceChangePercent24h" header="24h %">
              <template #body="{ data }">
                <span :class="data.priceChangePercent24h >= 0 ? 'text-[#26c281]' : 'text-[#e74c3c]'">
                  {{ data.priceChangePercent24h >= 0 ? '+' : '' }}{{ fmt(data.priceChangePercent24h, 2) }}%
                </span>
              </template>
            </Column>
            <Column field="volume24h" header="Volume 24h">
              <template #body="{ data }">
                <span class="text-[#a0a6b2]">{{ fmt(data.volume24h, 0) }}</span>
              </template>
            </Column>
            <template #empty>
              <div class="text-[#6e7684] text-sm text-center py-4">No market data available</div>
            </template>
          </DataTable>
        </template>
      </Card>

      <!-- Signal Market -->
      <Card class="!bg-[#1a1f29] !border-[#323a47] !rounded-xl">
        <template #header>
          <div class="px-4 pt-4">
            <span class="text-sm font-semibold text-[#f0f2f5]">Signal Market</span>
          </div>
        </template>
        <template #content>
          <div v-if="loading" class="flex flex-col gap-2">
            <Skeleton v-for="n in 4" :key="n" height="2.5rem" class="rounded-lg" />
          </div>
          <div v-else-if="signals.length === 0" class="text-[#6e7684] text-sm text-center py-6">
            Waiting for signals…
          </div>
          <div v-else class="flex flex-col gap-2 max-h-[260px] overflow-y-auto pr-1">
            <div
              v-for="sig in signals"
              :key="sig.id ?? sig.timestamp"
              class="flex items-center justify-between py-2 px-3 rounded-lg bg-[#252d3a] border border-[#323a47]"
            >
              <div class="flex items-center gap-2 min-w-0">
                <Tag :severity="signalTag(sig.direction)" :value="sig.direction" class="text-xs" />
                <span class="font-semibold text-sm text-white truncate">{{ sig.symbol }}</span>
                <span v-if="sig.indicator" class="text-[#6e7684] text-xs truncate">{{ sig.indicator }}</span>
              </div>
              <div class="flex flex-col items-end gap-0.5 text-xs shrink-0">
                <span v-if="sig.price" class="text-[#a0a6b2]">@ <span class="text-white">${{ fmt(sig.price) }}</span></span>
                <span v-if="sig.strength" class="text-[#a0a6b2]">
                  Strength: <span class="text-[#3498db] font-medium">{{ sig.strength }}</span>
                </span>
              </div>
            </div>
          </div>
        </template>
      </Card>
    </div>

    <!-- ── Row 4: History Trades ─────────────────────────────────────────── -->
    <Card class="!bg-[#1a1f29] !border-[#323a47] !rounded-xl">
      <template #header>
        <div class="px-4 pt-4">
          <span class="text-sm font-semibold text-[#f0f2f5]">History Trades</span>
        </div>
      </template>
      <template #content>
        <div v-if="loading" class="flex flex-col gap-2">
          <Skeleton v-for="n in 5" :key="n" height="2.5rem" class="rounded" />
        </div>
        <DataTable
          v-else
          :value="trades"
          :rows="tradesPagination.limit"
          :total-records="tradesPagination.total"
          lazy
          paginator
          :paginator-template="'FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink'"
          size="small"
          class="history-table"
          striped-rows
          @page="onTradePage"
        >
          <Column field="symbol" header="Symbol">
            <template #body="{ data }">
              <span class="font-semibold text-white">{{ data.symbol }}</span>
            </template>
          </Column>
          <Column field="side" header="Side">
            <template #body="{ data }">
              <Tag
                :value="data.side"
                :severity="data.side === 'BUY' || data.side === 'buy' ? 'success' : 'danger'"
                class="text-xs"
              />
            </template>
          </Column>
          <Column field="outcome" header="Outcome">
            <template #body="{ data }">
              <Tag :value="data.outcome" :severity="outcomeTag(data.outcome)" class="text-xs" />
            </template>
          </Column>
          <Column field="pnlRounded" header="P&L">
            <template #body="{ data }">
              <span :class="data.pnlRounded >= 0 ? 'text-[#26c281] font-bold' : 'text-[#e74c3c] font-bold'">
                {{ data.pnlRounded >= 0 ? '+' : '' }}${{ fmt(data.pnlRounded) }}
              </span>
            </template>
          </Column>
          <Column field="pnlPercentRounded" header="%">
            <template #body="{ data }">
              <span :class="data.pnlPercentRounded >= 0 ? 'text-[#26c281]' : 'text-[#e74c3c]'">
                {{ data.pnlPercentRounded >= 0 ? '+' : '' }}{{ fmt(data.pnlPercentRounded, 2) }}%
              </span>
            </template>
          </Column>
          <Column field="openTimeFormatted" header="Opened">
            <template #body="{ data }">
              <span class="text-[#a0a6b2] text-xs">{{ data.openTimeFormatted }}</span>
            </template>
          </Column>
          <Column field="closeTimeFormatted" header="Closed">
            <template #body="{ data }">
              <span class="text-[#a0a6b2] text-xs">{{ data.closeTimeFormatted ?? '—' }}</span>
            </template>
          </Column>
          <template #empty>
            <div class="text-[#6e7684] text-sm text-center py-4">No trade history</div>
          </template>
        </DataTable>
      </template>
    </Card>

  </div>
</template>

<style>
/* Scope PrimeVue DataTable to dark trading theme */
.market-table .p-datatable-table,
.history-table .p-datatable-table {
  background: transparent !important;
}
.market-table .p-datatable-thead > tr > th,
.history-table .p-datatable-thead > tr > th {
  background: #252d3a !important;
  color: #a0a6b2 !important;
  border-color: #323a47 !important;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 0.5rem 0.75rem;
}
.market-table .p-datatable-tbody > tr > td,
.history-table .p-datatable-tbody > tr > td {
  background: transparent !important;
  border-color: #323a47 !important;
  color: #f0f2f5 !important;
  padding: 0.5rem 0.75rem;
}
.market-table .p-datatable-tbody > tr:nth-child(odd) > td,
.history-table .p-datatable-tbody > tr:nth-child(odd) > td {
  background: #1e2530 !important;
}
.market-table .p-datatable-paginator-bottom,
.history-table .p-datatable-paginator-bottom {
  background: #1a1f29 !important;
  border-color: #323a47 !important;
  color: #a0a6b2 !important;
}
.market-table .p-paginator-page,
.history-table .p-paginator-page,
.market-table .p-paginator-prev,
.history-table .p-paginator-prev,
.market-table .p-paginator-next,
.history-table .p-paginator-next,
.market-table .p-paginator-first,
.history-table .p-paginator-first,
.market-table .p-paginator-last,
.history-table .p-paginator-last {
  color: #a0a6b2 !important;
  background: transparent !important;
  border: none !important;
}
.market-table .p-paginator-page.p-highlight,
.history-table .p-paginator-page.p-highlight {
  background: #3498db !important;
  color: white !important;
  border-radius: 0.375rem;
}

/* PnL interval SelectButton */
.pnl-interval-select .p-selectbutton .p-button {
  background: #252d3a !important;
  border-color: #323a47 !important;
  color: #a0a6b2 !important;
  font-size: 0.7rem;
  padding: 0.2rem 0.6rem;
}
.pnl-interval-select .p-selectbutton .p-button.p-highlight {
  background: #3498db !important;
  color: white !important;
  border-color: #3498db !important;
}

/* PrimeVue Card dark override */
.p-card {
  background: #1a1f29 !important;
  border: 1px solid #323a47 !important;
  color: #f0f2f5 !important;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3) !important;
}
.p-card .p-card-content {
  padding: 0.75rem 1rem 1rem;
}
.p-card .p-card-header {
  padding: 0;
}
</style>
