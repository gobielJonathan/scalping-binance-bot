<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { usePortfolioStore } from '@/stores'
import { useCardHoverAnimation } from '@/composables/animations'
import * as animations from '@/utils/animations'
import WidgetContainer from '../layout/WidgetContainer.vue'

const portfolioStore = usePortfolioStore()

// Computed properties for displaying values
const currentBalance = computed(() => portfolioStore.currentBalance)
const availableBalance = computed(() => portfolioStore.availableBalance)
const lockedFunds = computed(() => portfolioStore.lockedFunds)
const equity = computed(() => portfolioStore.equity)
const investedBalance = computed(() => portfolioStore.investedBalance)

const totalPnl = computed(() => portfolioStore.totalPnl)
const totalPnlPercent = computed(() => portfolioStore.totalPnlPercent)
const dailyPnl = computed(() => portfolioStore.dailyPnl)
const dailyPnlPercent = computed(() => portfolioStore.dailyPnlPercent)
const weeklyPnl = computed(() => portfolioStore.weeklyPnl)
const weeklyPnlPercent = computed(() => portfolioStore.weeklyPnlPercent)
const monthlyPnl = computed(() => portfolioStore.monthlyPnl)
const monthlyPnlPercent = computed(() => portfolioStore.monthlyPnlPercent)

// Additional metrics
const maxDrawdown = computed(() => {
  // Calculate from history
  if (portfolioStore.equityHistory.length < 2) return 0
  let maxEquity = 0
  let maxDD = 0
  for (const entry of portfolioStore.equityHistory) {
    if (entry.equity > maxEquity) {
      maxEquity = entry.equity
    }
    const dd = ((maxEquity - entry.equity) / maxEquity) * 100
    if (dd > maxDD) {
      maxDD = dd
    }
  }
  return maxDD
})

const accountGrowth = computed(() => {
  if (portfolioStore.balanceHistory.length < 2) return 0
  const oldBalance = portfolioStore.balanceHistory[0]?.balance || currentBalance.value
  return ((currentBalance.value - oldBalance) / oldBalance) * 100
})

// Animation refs
const containerRef = ref<HTMLElement>()
const { cardRef: card1, onMouseEnter: enter1, onMouseLeave: leave1 } = useCardHoverAnimation()
const { cardRef: card2, onMouseEnter: enter2, onMouseLeave: leave2 } = useCardHoverAnimation()
const { cardRef: card3, onMouseEnter: enter3, onMouseLeave: leave3 } = useCardHoverAnimation()
const { cardRef: card4, onMouseEnter: enter4, onMouseLeave: leave4 } = useCardHoverAnimation()
const { cardRef: card5, onMouseEnter: enter5, onMouseLeave: leave5 } = useCardHoverAnimation()
const { cardRef: card6, onMouseEnter: enter6, onMouseLeave: leave6 } = useCardHoverAnimation()
const { cardRef: card7, onMouseEnter: enter7, onMouseLeave: leave7 } = useCardHoverAnimation()
const { cardRef: card8, onMouseEnter: enter8, onMouseLeave: leave8 } = useCardHoverAnimation()
const { cardRef: card9, onMouseEnter: enter9, onMouseLeave: leave9 } = useCardHoverAnimation()

// Utility functions for formatting
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

const formatPercent = (value: number) => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

const getPnLColor = (value: number) => {
  return value >= 0 ? 'profit' : 'loss'
}

// Load portfolio on mount
onMounted(() => {
  portfolioStore.fetchPortfolio()
  
  // Animate cascade on mount
  if (containerRef.value) {
    const cards = containerRef.value.querySelectorAll('.metric-card')
    animations.animateCascade(
      cards as NodeListOf<HTMLElement>,
      0.12,
      0.8,
    )
  }
})
</script>

<template>
  <widget-container
    title="Portfolio Summary"
    :loading="portfolioStore.loadingPortfolio"
    :error="!!portfolioStore.errorPortfolio"
  >
    <div ref="containerRef" class="portfolio-grid">
      <!-- Current Balance Section -->
      <div 
        ref="card1"
        class="metric-card balance-card"
        @mouseenter="enter1"
        @mouseleave="leave1"
      >
        <div class="metric-label">Total Balance</div>
        <div class="metric-value animate-value">{{ formatCurrency(currentBalance) }}</div>
        <div class="metric-sub">Available: {{ formatCurrency(availableBalance) }}</div>
      </div>

      <!-- Equity Section -->
      <div 
        ref="card2"
        class="metric-card equity-card"
        @mouseenter="enter2"
        @mouseleave="leave2"
      >
        <div class="metric-label">Current Equity</div>
        <div class="metric-value animate-value">{{ formatCurrency(equity) }}</div>
        <div class="metric-sub">Invested: {{ formatCurrency(investedBalance) }}</div>
      </div>

      <!-- Daily P&L Section -->
      <div 
        ref="card3"
        class="metric-card"
        :class="{ 'profit-card': dailyPnl >= 0, 'loss-card': dailyPnl < 0 }"
        @mouseenter="enter3"
        @mouseleave="leave3"
      >
        <div class="metric-label">Daily P&L</div>
        <div :class="['metric-value', 'animate-value', getPnLColor(dailyPnl)]">
          {{ formatCurrency(dailyPnl) }}
        </div>
        <div :class="['metric-sub', getPnLColor(dailyPnlPercent)]">
          {{ formatPercent(dailyPnlPercent) }}
          <span :class="dailyPnlPercent > 0 ? 'indicator-up' : dailyPnlPercent < 0 ? 'indicator-down' : ''">
            {{ animations.getDirectionalIndicator(dailyPnlPercent) }}
          </span>
        </div>
      </div>

      <!-- Weekly P&L Section -->
      <div 
        ref="card4"
        class="metric-card"
        :class="{ 'profit-card': weeklyPnl >= 0, 'loss-card': weeklyPnl < 0 }"
        @mouseenter="enter4"
        @mouseleave="leave4"
      >
        <div class="metric-label">Weekly P&L</div>
        <div :class="['metric-value', 'animate-value', getPnLColor(weeklyPnl)]">
          {{ formatCurrency(weeklyPnl) }}
        </div>
        <div :class="['metric-sub', getPnLColor(weeklyPnlPercent)]">
          {{ formatPercent(weeklyPnlPercent) }}
          <span :class="weeklyPnlPercent > 0 ? 'indicator-up' : weeklyPnlPercent < 0 ? 'indicator-down' : ''">
            {{ animations.getDirectionalIndicator(weeklyPnlPercent) }}
          </span>
        </div>
      </div>

      <!-- Monthly P&L Section -->
      <div 
        ref="card5"
        class="metric-card"
        :class="{ 'profit-card': monthlyPnl >= 0, 'loss-card': monthlyPnl < 0 }"
        @mouseenter="enter5"
        @mouseleave="leave5"
      >
        <div class="metric-label">Monthly P&L</div>
        <div :class="['metric-value', 'animate-value', getPnLColor(monthlyPnl)]">
          {{ formatCurrency(monthlyPnl) }}
        </div>
        <div :class="['metric-sub', getPnLColor(monthlyPnlPercent)]">
          {{ formatPercent(monthlyPnlPercent) }}
          <span :class="monthlyPnlPercent > 0 ? 'indicator-up' : monthlyPnlPercent < 0 ? 'indicator-down' : ''">
            {{ animations.getDirectionalIndicator(monthlyPnlPercent) }}
          </span>
        </div>
      </div>

      <!-- Total P&L Section -->
      <div 
        ref="card6"
        class="metric-card"
        :class="{ 'profit-card': totalPnl >= 0, 'loss-card': totalPnl < 0 }"
        @mouseenter="enter6"
        @mouseleave="leave6"
      >
        <div class="metric-label">Total P&L</div>
        <div :class="['metric-value', 'animate-value', getPnLColor(totalPnl)]">
          {{ formatCurrency(totalPnl) }}
        </div>
        <div :class="['metric-sub', getPnLColor(totalPnlPercent)]">
          {{ formatPercent(totalPnlPercent) }}
          <span :class="totalPnlPercent > 0 ? 'indicator-up' : totalPnlPercent < 0 ? 'indicator-down' : ''">
            {{ animations.getDirectionalIndicator(totalPnlPercent) }}
          </span>
        </div>
      </div>

      <!-- Max Drawdown Section -->
      <div 
        ref="card7"
        class="metric-card warning-card"
        @mouseenter="enter7"
        @mouseleave="leave7"
      >
        <div class="metric-label">Max Drawdown</div>
        <div class="metric-value loss">-{{ maxDrawdown.toFixed(2) }}%</div>
        <div class="metric-sub">Account dip</div>
      </div>

      <!-- Account Growth Section -->
      <div 
        ref="card8"
        class="metric-card"
        :class="{ 'profit-card': accountGrowth >= 0, 'loss-card': accountGrowth < 0 }"
        @mouseenter="enter8"
        @mouseleave="leave8"
      >
        <div class="metric-label">Account Growth</div>
        <div :class="['metric-value', 'animate-value', getPnLColor(accountGrowth)]">
          {{ formatPercent(accountGrowth) }}
        </div>
        <div class="metric-sub">Total change</div>
      </div>

      <!-- Locked Funds Section -->
      <div 
        ref="card9"
        class="metric-card lock-card"
        @mouseenter="enter9"
        @mouseleave="leave9"
      >
        <div class="metric-label">Locked Funds</div>
        <div class="metric-value animate-value">{{ formatCurrency(lockedFunds) }}</div>
        <div class="metric-sub">In open positions</div>
      </div>
    </div>
  </widget-container>
</template>

<style scoped>
.portfolio-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: var(--trading-spacing-md);
}

.metric-card {
  padding: var(--trading-spacing-lg);
  background: var(--trading-bg-tertiary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-lg);
  transition: all 0.3s ease;
  cursor: pointer;
  will-change: transform, box-shadow;
}

.metric-card:hover {
  border-color: var(--trading-border-light);
  background: var(--trading-bg-hover);
}

.metric-label {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--trading-text-tertiary);
  margin-bottom: var(--trading-spacing-xs);
  font-weight: 600;
}

.metric-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--trading-text-primary);
  line-height: 1.2;
  margin-bottom: var(--trading-spacing-xs);
  word-break: break-word;
  transition: all 0.3s ease;
}

.metric-value.animate-value {
  will-change: color;
}

.metric-sub {
  font-size: 0.75rem;
  color: var(--trading-text-tertiary);
  line-height: 1.3;
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

/* Card variants */
.balance-card {
  background: linear-gradient(135deg, rgba(52, 152, 219, 0.1), rgba(52, 152, 219, 0.05));
  border-color: rgba(52, 152, 219, 0.3);
}

.equity-card {
  background: linear-gradient(135deg, rgba(155, 89, 182, 0.1), rgba(155, 89, 182, 0.05));
  border-color: rgba(155, 89, 182, 0.3);
}

.profit-card {
  background: linear-gradient(135deg, rgba(46, 204, 113, 0.1), rgba(46, 204, 113, 0.05));
  border-color: rgba(46, 204, 113, 0.3);
}

.loss-card {
  background: linear-gradient(135deg, rgba(231, 76, 60, 0.1), rgba(231, 76, 60, 0.05));
  border-color: rgba(231, 76, 60, 0.3);
}

.warning-card {
  background: linear-gradient(135deg, rgba(241, 196, 15, 0.1), rgba(241, 196, 15, 0.05));
  border-color: rgba(241, 196, 15, 0.3);
}

.lock-card {
  background: linear-gradient(135deg, rgba(189, 195, 199, 0.1), rgba(189, 195, 199, 0.05));
  border-color: rgba(189, 195, 199, 0.3);
}

/* Color classes for values */
.profit {
  color: var(--trading-profit);
}

.loss {
  color: var(--trading-loss);
}

/* Responsive design */
@media (max-width: 768px) {
  .portfolio-grid {
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: var(--trading-spacing-sm);
  }

  .metric-value {
    font-size: 1.25rem;
  }
}

@media (max-width: 576px) {
  .portfolio-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .metric-card {
    padding: var(--trading-spacing-md);
  }

  .metric-label {
    font-size: 0.7rem;
  }

  .metric-value {
    font-size: 1rem;
  }

  .metric-sub {
    font-size: 0.7rem;
  }
}
</style>
