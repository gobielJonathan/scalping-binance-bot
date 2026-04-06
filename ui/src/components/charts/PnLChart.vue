<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { createChart, AreaSeries, type IChartApi, type ISeriesApi } from 'lightweight-charts'
import chartService, { type ChartTheme } from '@/services/chart'
import {
  transformPnLData,
  debounce,
  getChartDimensions,
  getPnLColor,
  formatPrice,
} from '@/utils/chart'
import type { Portfolio } from '@/types/api'

interface Props {
  data: Portfolio[]
  currentPnL?: number
  height?: number | string
  theme?: 'dark' | 'light'
  interval?: '1H' | '1D' | '1W' | '1M'
  realtime?: boolean
  showWatermark?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  height: 300,
  theme: 'dark',
  interval: '1D',
  realtime: true,
  showWatermark: true,
})

const emit = defineEmits<{
  ready: []
  error: [error: Error]
  intervalChange: [interval: string]
}>()

const containerRef = ref<HTMLDivElement>()
const chart = ref<IChartApi | null>(null)
const areaSeries = ref<ISeriesApi<any> | null>(null)
const isInitialized = ref(false)
const hasError = ref(false)
const errorMessage = ref('')
const selectedInterval = ref(props.interval)

const chartHeight = computed(() => {
  const height = props.height
  return typeof height === 'string' ? height : `${height}px`
})

const chartTheme = computed<ChartTheme>(() => {
  return chartService.getChartTheme(props.theme)
})

const filteredData = computed(() => {
  if (props.data.length === 0) return []
  const now = Date.now()
  const intervals: Record<string, number> = {
    '1H': 60 * 60 * 1000,
    '1D': 24 * 60 * 60 * 1000,
    '1W': 7 * 24 * 60 * 60 * 1000,
    '1M': 30 * 24 * 60 * 60 * 1000,
  }
  const timeThreshold = intervals[props.interval] ?? intervals['1D']
  return props.data.filter((item) => {
    const itemTime = new Date(item.updatedAt).getTime()
    return now - itemTime <= (timeThreshold || 86400000)
  })
})

const isDataValid = computed(() => {
  return (
    Array.isArray(filteredData.value) &&
    filteredData.value.length > 0 &&
    filteredData.value.every((item) => typeof item.pnl === 'number')
  )
})

const currentBalance = computed(() => {
  return filteredData.value.length > 0 ? filteredData.value[filteredData.value.length - 1]?.totalBalance ?? 0 : 0
})

const totalPnL = computed(() => {
  return filteredData.value.length > 0 ? filteredData.value[filteredData.value.length - 1]?.pnl ?? 0 : 0
})

const pnLColor = computed(() => {
  return getPnLColor(totalPnL.value)
})

const initChart = () => {
  if (!containerRef.value || isInitialized.value) return

  try {
    const dimensions = getChartDimensions(containerRef.value)
    const chartInstance = createChart(containerRef.value, {
      ...chartService.getDefaultChartOptions(dimensions.width, dimensions.height, chartTheme.value),
    } as any)

    chart.value = chartInstance

    const series = chartInstance.addSeries(AreaSeries, {
      lineColor: pnLColor.value,
      topColor: totalPnL.value >= 0 ? 'rgba(38, 194, 129, 0.2)' : 'rgba(231, 76, 60, 0.2)',
      bottomColor: 'rgba(0, 0, 0, 0)',
      lineWidth: 2,
      crosshairMarkerVisible: true,
      priceFormat: { type: 'price' as any, precision: 2, minMove: 0.01 },
    } as any)

    areaSeries.value = series

    updateChartData()
    chartInstance.timeScale().fitContent()
    setupEventListeners()
    isInitialized.value = true
    emit('ready')
  } catch (error) {
    handleError(error as Error)
  }
}

const updateChartData = () => {
  if (!isDataValid.value || !areaSeries.value || !chart.value) return

  try {
    const pnlData = transformPnLData(
      filteredData.value.map((item) => ({
        timestamp: new Date(item.updatedAt).getTime() / 1000,
        value: item.pnl,
      }))
    )

    areaSeries.value.setData(pnlData as any)
    chart.value.timeScale().fitContent()
  } catch (error) {
    handleError(error as Error)
  }
}

const setupEventListeners = () => {
  if (!chart.value) return

  const handleResize = debounce(() => {
    if (!containerRef.value || !chart.value) return
    const dimensions = getChartDimensions(containerRef.value)
    chart.value.applyOptions({
      width: dimensions.width,
      height: dimensions.height,
    })
  }, 300)

  window.addEventListener('resize', handleResize)
  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
  })
}

const handleIntervalChange = (interval: '1H' | '1D' | '1W' | '1M') => {
  selectedInterval.value = interval
  emit('intervalChange', interval)
}

const handleError = (error: Error) => {
  hasError.value = true
  errorMessage.value = error.message
  emit('error', error)
  console.error('PnLChart error:', error)
}

const cleanup = () => {
  if (chart.value) {
    chart.value.remove()
    chart.value = null
  }
  isInitialized.value = false
}

watch(() => props.data, updateChartData, { deep: false })
watch(() => props.interval, (newInterval) => {
  selectedInterval.value = newInterval
  updateChartData()
})
watch(() => props.theme, () => {
  if (isInitialized.value) {
    cleanup()
    initChart()
  }
})
watch(() => props.height, () => {
  if (!containerRef.value || !chart.value) return
  const dimensions = getChartDimensions(containerRef.value)
  chart.value.applyOptions({ height: dimensions.height })
})

onMounted(() => {
  initChart()
})

onUnmounted(() => {
  cleanup()
})
</script>

<template>
  <div class="pnl-chart-wrapper">
    <div class="pnl-chart-header">
      <div class="pnl-info">
        <div class="pnl-label">Total P&L</div>
        <div class="pnl-value" :style="{ color: pnLColor }">
          {{ totalPnL >= 0 ? '+' : '-' }}${{ Math.abs(totalPnL).toFixed(2) }}
        </div>
      </div>

      <div class="interval-selector">
        <button
          v-for="interval in ['1H', '1D', '1W', '1M']"
          :key="interval"
          class="interval-button"
          :class="{ active: selectedInterval === interval }"
          @click="handleIntervalChange(interval as '1H' | '1D' | '1W' | '1M')"
        >
          {{ interval }}
        </button>
      </div>
    </div>

    <div v-if="hasError" class="pnl-chart-error">
      <p class="error-icon">⚠️</p>
      <p class="error-message">{{ errorMessage }}</p>
    </div>

    <div
      v-show="!hasError"
      ref="containerRef"
      class="pnl-chart-container"
      :style="{ height: chartHeight }"
    />
  </div>
</template>

<style scoped>
.pnl-chart-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.pnl-chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--trading-spacing-md);
  background: var(--trading-bg-secondary);
  border-bottom: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-lg) var(--trading-radius-lg) 0 0;
  gap: var(--trading-spacing-lg);
}

.pnl-info {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-xs);
}

.pnl-label {
  font-size: 0.75rem;
  color: var(--trading-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.pnl-value {
  font-size: 1.5rem;
  font-weight: 600;
  font-family: 'Courier New', monospace;
}

.interval-selector {
  display: flex;
  gap: var(--trading-spacing-sm);
}

.interval-button {
  padding: var(--trading-spacing-xs) var(--trading-spacing-md);
  background: var(--trading-bg-tertiary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  color: var(--trading-text-secondary);
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.interval-button:hover {
  background: var(--trading-bg-primary);
  border-color: var(--trading-accent-blue);
}

.interval-button.active {
  background: var(--trading-accent-blue);
  color: white;
  border-color: var(--trading-accent-blue);
}

.pnl-chart-container {
  position: relative;
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  border-radius: 0 0 var(--trading-radius-lg) var(--trading-radius-lg);
  overflow: hidden;
}

.pnl-chart-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  padding: var(--trading-spacing-lg);
  background: var(--trading-bg-secondary);
  color: var(--trading-text-secondary);
  border-radius: 0 0 var(--trading-radius-lg) var(--trading-radius-lg);
}

.error-icon {
  font-size: 2rem;
  margin: 0 0 var(--trading-spacing-md) 0;
}

.error-message {
  margin: 0;
  font-size: 0.875rem;
  text-align: center;
  color: var(--trading-text-tertiary);
}
</style>
