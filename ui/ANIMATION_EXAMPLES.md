/**
 * Animation Composable Examples
 * Demonstrates how to use all animation composables in components
 */

// ============================================================================
// 1. VALUE ANIMATION EXAMPLE
// ============================================================================
/*
<script setup>
import { computed } from 'vue'
import { usePortfolioStore } from '@/stores'
import { useValueAnimation } from '@/composables/animations'

const portfolioStore = usePortfolioStore()
const { elementRef } = useValueAnimation(
  () => portfolioStore.currentBalance,
  {
    decimals: 2,
    duration: 'medium',
    onValueUpdate: (value) => {
      // Optional: do something with the animated value
      console.log('Current animated value:', value)
    }
  }
)
</script>

<template>
  <div ref="elementRef">{{ portfolioStore.currentBalance }}</div>
</template>
*/

// ============================================================================
// 2. CARD HOVER ANIMATION EXAMPLE
// ============================================================================
/*
<script setup>
import { useCardHoverAnimation } from '@/composables/animations'

const { cardRef, onMouseEnter, onMouseLeave } = useCardHoverAnimation()
</script>

<template>
  <div
    ref="cardRef"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    class="metric-card"
  >
    <h3>Hover me!</h3>
    <p>The card will lift and scale smoothly</p>
  </div>
</template>

<style scoped>
.metric-card {
  padding: 1rem;
  background: #1a1f29;
  border: 1px solid #323a47;
  border-radius: 0.75rem;
  cursor: pointer;
  transition: all 0.3s ease;
}
</style>
*/

// ============================================================================
// 3. CASCADE ANIMATION EXAMPLE
// ============================================================================
/*
<script setup>
import { useCascadeAnimation } from '@/composables/animations'

const { containerRef } = useCascadeAnimation({
  staggerDelay: 0.15,
  duration: 0.8
})
</script>

<template>
  <div ref="containerRef">
    <div class="widget" data-animate>
      <h3>Widget 1</h3>
    </div>
    <div class="widget" data-animate>
      <h3>Widget 2</h3>
    </div>
    <div class="widget" data-animate>
      <h3>Widget 3</h3>
    </div>
    <div class="widget" data-animate>
      <h3>Widget 4</h3>
    </div>
  </div>
</template>

<style scoped>
.widget {
  padding: 1.5rem;
  background: #252d3a;
  border-radius: 0.75rem;
  margin-bottom: 1rem;
}
</style>
*/

// ============================================================================
// 4. PULSE ANIMATION EXAMPLE (Real-time Data)
// ============================================================================
/*
<script setup>
import { computed } from 'vue'
import { usePulseAnimation } from '@/composables/animations'
import { useWebsocketStore } from '@/stores'

const websocketStore = useWebsocketStore()
const isConnected = computed(() => websocketStore.isConnected)

const { pulseRef, startPulse, stopPulse } = usePulseAnimation({
  enabled: isConnected,
  duration: 1.5
})
</script>

<template>
  <div class="live-status">
    <span ref="pulseRef" class="status-dot"></span>
    <span class="status-text">{{ isConnected ? 'Live' : 'Offline' }}</span>
  </div>
</template>

<style scoped>
.live-status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #26c281;
}
</style>
*/

// ============================================================================
// 5. NOTIFICATION ANIMATION EXAMPLE
// ============================================================================
/*
<script setup>
import { ref } from 'vue'
import { useNotificationAnimation } from '@/composables/animations'

const showSuccess = ref(false)
const { notificationRef, show, hide } = useNotificationAnimation('success')

const handleAction = async () => {
  try {
    // Do something
    showSuccess.value = true
  } catch (error) {
    console.error(error)
  }
}
</script>

<template>
  <div>
    <button @click="handleAction">Trigger Action</button>
    
    <div v-if="showSuccess" ref="notificationRef" class="notification success">
      <span class="icon">✓</span>
      <span class="message">Action completed successfully!</span>
      <button @click="showSuccess = false">Dismiss</button>
    </div>
  </div>
</template>

<style scoped>
.notification {
  padding: 1rem 1.5rem;
  border-radius: 0.75rem;
  border-left: 4px solid;
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
}

.notification.success {
  background: rgba(38, 194, 129, 0.1);
  border-color: #26c281;
  color: #26c281;
}

.notification.error {
  background: rgba(231, 76, 60, 0.1);
  border-color: #e74c3c;
  color: #e74c3c;
}

.icon {
  font-weight: bold;
  font-size: 1.2rem;
}

.message {
  flex: 1;
}
</style>
*/

// ============================================================================
// 6. COUNTER ANIMATION EXAMPLE
// ============================================================================
/*
<script setup>
import { computed } from 'vue'
import { useCounterAnimation } from '@/composables/animations'
import { usePortfolioStore } from '@/stores'

const portfolioStore = usePortfolioStore()
const totalTrades = computed(() => portfolioStore.totalTrades)

const { elementRef } = useCounterAnimation(
  () => totalTrades.value,
  {
    duration: 0.8,
    decimals: 0
  }
)
</script>

<template>
  <div class="counter">
    <span class="label">Total Trades</span>
    <span ref="elementRef" class="count">0</span>
  </div>
</template>

<style scoped>
.counter {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.label {
  font-size: 0.875rem;
  color: #a0a6b2;
  margin-bottom: 0.5rem;
}

.count {
  font-size: 2rem;
  font-weight: bold;
  color: #f0f2f5;
}
</style>
*/

// ============================================================================
// 7. BUTTON ANIMATION EXAMPLE
// ============================================================================
/*
<script setup>
import { useButtonAnimation } from '@/composables/animations'

const { buttonRef, handleClick } = useButtonAnimation()

const onButtonClick = () => {
  handleClick(() => {
    // Your action here
    console.log('Button clicked with animation!')
  })
}
</script>

<template>
  <button ref="buttonRef" @click="onButtonClick" class="action-button">
    Click Me
  </button>
</template>

<style scoped>
.action-button {
  padding: 0.75rem 1.5rem;
  background: #3498db;
  color: white;
  border: none;
  border-radius: 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-button:hover {
  background: #2980b9;
}

.action-button:active {
  transform: scale(0.98);
}
</style>
*/

// ============================================================================
// 8. ROW HIGHLIGHT ANIMATION EXAMPLE
// ============================================================================
/*
<script setup>
import { ref } from 'vue'
import { useRowHighlightAnimation } from '@/composables/animations'

const selectedRowId = ref<string | null>(null)

const rows = [
  { id: '1', symbol: 'BTC/USDT', price: 42500, change: '+2.5%' },
  { id: '2', symbol: 'ETH/USDT', price: 2250, change: '-1.2%' },
  { id: '3', symbol: 'XRP/USDT', price: 0.52, change: '+0.8%' },
]

const selectRow = (rowId: string) => {
  selectedRowId.value = rowId
  highlight()
}

const { rowRef, highlight } = useRowHighlightAnimation()
</script>

<template>
  <table class="trades-table">
    <thead>
      <tr>
        <th>Symbol</th>
        <th>Price</th>
        <th>Change</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="row in rows"
        :key="row.id"
        :ref="selectedRowId === row.id ? rowRef : undefined"
        :class="{ 'selected-row': selectedRowId === row.id }"
        @click="selectRow(row.id)"
        class="interactive-row"
      >
        <td>{{ row.symbol }}</td>
        <td>{{ row.price }}</td>
        <td>{{ row.change }}</td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.trades-table {
  width: 100%;
  border-collapse: collapse;
}

.interactive-row {
  transition: all 0.2s ease;
  cursor: pointer;
}

.interactive-row:hover {
  background: rgba(52, 152, 219, 0.1);
}

.selected-row {
  background: rgba(52, 152, 219, 0.2);
}

th, td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid #323a47;
}
</style>
*/

// ============================================================================
// 9. FADE IN ANIMATION EXAMPLE
// ============================================================================
/*
<script setup>
import { useFadeInAnimation } from '@/composables/animations'

const { elementRef: contentRef } = useFadeInAnimation({
  duration: 0.6,
  delay: 0.3
})

const { elementRef: imageRef } = useFadeInAnimation({
  duration: 0.8,
  delay: 0.1
})
</script>

<template>
  <div class="container">
    <img ref="imageRef" src="/chart.png" alt="Chart" class="chart-image" />
    <div ref="contentRef" class="content">
      <h2>Portfolio Overview</h2>
      <p>Your investments and performance metrics</p>
    </div>
  </div>
</template>

<style scoped>
.container {
  display: flex;
  gap: 2rem;
}

.chart-image {
  width: 300px;
  height: 300px;
  border-radius: 0.75rem;
}

.content {
  flex: 1;
}
</style>
*/

// ============================================================================
// 10. COMPLETE WIDGET WITH MULTIPLE ANIMATIONS
// ============================================================================
/*
<script setup>
import { computed, onMounted, ref } from 'vue'
import {
  useValueAnimation,
  useCardHoverAnimation,
  usePulseAnimation,
  useCascadeAnimation
} from '@/composables/animations'
import { usePortfolioStore } from '@/stores'

const portfolioStore = usePortfolioStore()
const containerRef = ref<HTMLElement>()

// Value animations
const { elementRef: balanceRef } = useValueAnimation(
  () => portfolioStore.currentBalance,
  { decimals: 2 }
)

const { elementRef: equityRef } = useValueAnimation(
  () => portfolioStore.equity,
  { decimals: 2 }
)

// Card hover animations
const { cardRef: card1, onMouseEnter: enter1, onMouseLeave: leave1 } = useCardHoverAnimation()
const { cardRef: card2, onMouseEnter: enter2, onMouseLeave: leave2 } = useCardHoverAnimation()

// Pulse animation for live indicator
const { pulseRef } = usePulseAnimation({ enabled: true })

// Cascade on mount
const { containerRef: cascadeRef } = useCascadeAnimation({
  staggerDelay: 0.1,
  duration: 0.6
})

onMounted(() => {
  portfolioStore.fetchPortfolio()
})
</script>

<template>
  <div class="widget-container">
    <div class="widget-header">
      <h3>Portfolio</h3>
      <div class="live-indicator">
        <span ref="pulseRef" class="indicator-dot"></span>
        <span>Live</span>
      </div>
    </div>

    <div ref="cascadeRef" class="metrics-grid">
      <div
        ref="card1"
        @mouseenter="enter1"
        @mouseleave="leave1"
        class="metric-card"
        data-animate
      >
        <div class="metric-label">Total Balance</div>
        <div ref="balanceRef" class="metric-value">$0.00</div>
      </div>

      <div
        ref="card2"
        @mouseenter="enter2"
        @mouseleave="leave2"
        class="metric-card"
        data-animate
      >
        <div class="metric-label">Equity</div>
        <div ref="equityRef" class="metric-value">$0.00</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.widget-container {
  background: #252d3a;
  border: 1px solid #323a47;
  border-radius: 0.75rem;
  padding: 1.5rem;
}

.widget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.live-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: #26c281;
}

.indicator-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #26c281;
  animation: pulse 1.5s ease-in-out infinite;
}

.metrics-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.metric-card {
  padding: 1rem;
  background: #1a1f29;
  border: 1px solid #323a47;
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.metric-label {
  font-size: 0.75rem;
  color: #6e7684;
  margin-bottom: 0.5rem;
}

.metric-value {
  font-size: 1.5rem;
  font-weight: bold;
  color: #f0f2f5;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(0.8);
  }
}
</style>
*/

export const examples = {
  valueAnimation: 'Example 1',
  cardHoverAnimation: 'Example 2',
  cascadeAnimation: 'Example 3',
  pulseAnimation: 'Example 4',
  notificationAnimation: 'Example 5',
  counterAnimation: 'Example 6',
  buttonAnimation: 'Example 7',
  rowHighlightAnimation: 'Example 8',
  fadeInAnimation: 'Example 9',
  completeWidget: 'Example 10',
}
