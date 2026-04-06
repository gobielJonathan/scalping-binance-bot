<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { createChart, CandlestickSeries, HistogramSeries, LineSeries, type IChartApi, type ISeriesApi } from 'lightweight-charts'
import chartService, { type ChartTheme } from '@/services/chart'
import {
  transformMovingAverageData,
  debounce,
  getChartDimensions,
  isValidOHLCVData,
  formatPrice,
  formatVolume,
} from '@/utils/chart'
import type { OHLCV } from '@/types/api'

interface Props {
  symbol: string
  data: OHLCV[]
  currentPrice?: number
  height?: number | string
  theme?: 'dark' | 'light'
  interval?: string
  showVolume?: boolean
  showMA?: boolean
  enableCrossHair?: boolean
  showPrice?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  height: 500,
  theme: 'dark',
  interval: '1h',
  showVolume: true,
  showMA: true,
  enableCrossHair: true,
  showPrice: true,
})

const emit = defineEmits<{
  ready: []
  error: [error: Error]
  priceUpdate: [price: number]
}>()

const containerRef = ref<HTMLDivElement>()
const chart = ref<IChartApi | null>(null)
const candlestickSeries = ref<ISeriesApi<any> | null>(null)
const volumeSeries = ref<ISeriesApi<any> | null>(null)
const ma20Series = ref<ISeriesApi<any> | null>(null)
const ma50Series = ref<ISeriesApi<any> | null>(null)
const isInitialized = ref(false)
const hasError = ref(false)
const errorMessage = ref('')
const latestPrice = ref(0)
const highPrice = ref(0)
const lowPrice = ref(0)
const volumeValue = ref(0)

const chartHeight = computed(() => {
  const height = props.height
  return typeof height === 'string' ? height : `${height}px`
})

const chartTheme = computed<ChartTheme>(() => {
  return chartService.getChartTheme(props.theme)
})

const isDataValid = computed(() => {
  return Array.isArray(props.data) && props.data.length > 0 && props.data.every(isValidOHLCVData)
})

const priceChange = computed(() => {
  if (props.data.length < 2) return 0
  const previous = props.data[props.data.length - 2]?.close ?? 0
  const current = props.data[props.data.length - 1]?.close ?? 0
  return ((current - previous) / (previous || 1)) * 100
})

const priceChangeColor = computed(() => {
  return priceChange.value >= 0
    ? 'var(--trading-accent-green)'
    : 'var(--trading-accent-red)'
})

const initChart = () => {
  if (!containerRef.value || isInitialized.value) return

  try {
    const dimensions = getChartDimensions(containerRef.value)
    const chartInstance = createChart(containerRef.value, {
      ...chartService.getDefaultChartOptions(dimensions.width, dimensions.height, chartTheme.value),
    } as any)

    chart.value = chartInstance

    const candleSeriesApi = chartInstance.addSeries(CandlestickSeries, {
      ...chartService.getCandlestickSeriesOptions(chartTheme.value),
    } as any)
    candlestickSeries.value = candleSeriesApi

    if (props.showVolume) {
      const volSeriesApi = chartInstance.addSeries(HistogramSeries, {
        color: '#26c281',
        scaleMargins: { top: 0.8, bottom: 0 },
      } as any)
      volumeSeries.value = volSeriesApi
    }

    if (props.showMA) {
      const ma20SeriesApi = chartInstance.addSeries(LineSeries, {
        color: '#f39c12',
        lineWidth: 1,
        title: 'MA20',
      } as any)
      ma20Series.value = ma20SeriesApi

      const ma50SeriesApi = chartInstance.addSeries(LineSeries, {
        color: '#9b59b6',
        lineWidth: 1,
        title: 'MA50',
      } as any)
      ma50Series.value = ma50SeriesApi
    }

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
  if (!isDataValid.value || !chart.value) return

  try {
    const chartData = chartService.transformCandlestickChartData(props.data)

    if (candlestickSeries.value) {
      candlestickSeries.value.setData(chartData.candlesticks as any)
    }

    if (props.showVolume && volumeSeries.value) {
      volumeSeries.value.setData(chartData.volumes as any)
    }

    if (props.showMA) {
      if (ma20Series.value) {
        const ma20Data = transformMovingAverageData(
          props.data.map((d) => ({ time: Math.floor(d.time), close: d.close })),
          20
        )
        ma20Series.value.setData(ma20Data as any)
      }

      if (ma50Series.value) {
        const ma50Data = transformMovingAverageData(
          props.data.map((d) => ({ time: Math.floor(d.time), close: d.close })),
          50
        )
        ma50Series.value.setData(ma50Data as any)
      }
    }

    const lastCandle = props.data[props.data.length - 1]
    if (lastCandle) {
      latestPrice.value = lastCandle.close
      highPrice.value = Math.max(...props.data.map((d) => d.high))
      lowPrice.value = Math.min(...props.data.map((d) => d.low))
      volumeValue.value = lastCandle.volume
      emit('priceUpdate', latestPrice.value)
    }

    chart.value?.timeScale().fitContent()
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

const handleError = (error: Error) => {
  hasError.value = true
  errorMessage.value = error.message
  emit('error', error)
  console.error('MarketChart error:', error)
}

const cleanup = () => {
  if (chart.value) {
    chart.value.remove()
    chart.value = null
  }
  isInitialized.value = false
}

watch(() => props.data, updateChartData, { deep: false })

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
  <div class="market-chart-wrapper">
    <div v-if="props.showPrice && isDataValid" class="market-chart-header">
      <div class="price-info">
        <div class="price-label">Current Price</div>
        <div class="price-value">{{ formatPrice(latestPrice, 2) }}</div>
        <div class="price-change" :style="{ color: priceChangeColor }">
          {{ priceChange >= 0 ? '+' : '' }}{{ priceChange.toFixed(2) }}%
        </div>
      </div>
      <div class="price-stats">
        <div class="stat">
          <span class="stat-label">24H High</span>
          <span class="stat-value">{{ formatPrice(highPrice, 2) }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">24H Low</span>
          <span class="stat-value">{{ formatPrice(lowPrice, 2) }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">Volume</span>
          <span class="stat-value">{{ formatVolume(volumeValue) }}</span>
        </div>
      </div>
    </div>

    <div v-if="hasError" class="market-chart-error">
      <p class="error-icon">⚠️</p>
      <p class="error-message">{{ errorMessage }}</p>
    </div>

    <div
      v-show="!hasError"
      ref="containerRef"
      class="market-chart-container"
      :style="{ height: chartHeight }"
    />

    <div v-if="isDataValid && props.showMA" class="market-chart-legend">
      <div class="legend-item ma20">
        <span class="legend-dot"></span>
        <span class="legend-label">MA(20)</span>
      </div>
      <div class="legend-item ma50">
        <span class="legend-dot"></span>
        <span class="legend-label">MA(50)</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.market-chart-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.market-chart-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: var(--trading-spacing-md);
  background: var(--trading-bg-secondary);
  border-bottom: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-lg) var(--trading-radius-lg) 0 0;
  gap: var(--trading-spacing-lg);
}

.price-info {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-xs);
}

.price-label {
  font-size: 0.75rem;
  color: var(--trading-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.price-value {
  font-size: 1.75rem;
  font-weight: 600;
  font-family: 'Courier New', monospace;
  color: var(--trading-text-primary);
}

.price-change {
  font-size: 0.875rem;
  font-weight: 500;
  font-family: 'Courier New', monospace;
}

.price-stats {
  display: flex;
  gap: var(--trading-spacing-lg);
}

.stat {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-xs);
  align-items: flex-end;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--trading-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: 0.875rem;
  font-weight: 500;
  font-family: 'Courier New', monospace;
  color: var(--trading-text-primary);
}

.market-chart-container {
  position: relative;
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.market-chart-error {
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

.market-chart-legend {
  display: flex;
  gap: var(--trading-spacing-lg);
  padding: var(--trading-spacing-md);
  background: var(--trading-bg-secondary);
  border-top: 1px solid var(--trading-border);
  border-radius: 0 0 var(--trading-radius-lg) var(--trading-radius-lg);
  font-size: 0.75rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-xs);
  color: var(--trading-text-secondary);
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.legend-item.ma20 .legend-dot {
  background-color: #f39c12;
}

.legend-item.ma50 .legend-dot {
  background-color: #9b59b6;
}

.legend-label {
  font-weight: 500;
}
</style>
