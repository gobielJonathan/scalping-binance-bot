<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  AreaSeries,
  HistogramSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type AreaData,
  type HistogramData,
} from 'lightweight-charts'
import chartService, { ChartType, type ChartTheme } from '@/services/chart'
import {
  transformOHLCVToChartData,
  transformMovingAverageData,
  debounce,
  getChartDimensions,
  isValidOHLCVData,
} from '@/utils/chart'
import type { OHLCV } from '@/types/api'

/**
 * Props for TradingChart component
 */
interface Props {
  /**
   * Trading symbol (e.g., 'BTC/USD')
   */
  symbol: string

  /**
   * Chart data (OHLCV candles)
   */
  data: OHLCV[]

  /**
   * Chart type (candlestick, line, area)
   */
  type?: ChartType

  /**
   * Time interval (1m, 5m, 15m, 1h, 4h, 1d)
   */
  interval?: string

  /**
   * Chart height in pixels
   */
  height?: number | string

  /**
   * Chart theme (dark, light)
   */
  theme?: 'dark' | 'light'

  /**
   * Show volume histogram
   */
  showVolume?: boolean

  /**
   * Show moving average line
   */
  showMA?: boolean

  /**
   * Moving average period
   */
  maLength?: number

  /**
   * Enable crosshair
   */
  enableCrossHair?: boolean

  /**
   * Responsive height adjustment
   */
  responsive?: boolean
}

/**
 * Props with defaults
 */
const props = withDefaults(defineProps<Props>(), {
  type: ChartType.CANDLESTICK,
  interval: '1h',
  height: 400,
  theme: 'dark',
  showVolume: true,
  showMA: false,
  maLength: 20,
  enableCrossHair: true,
  responsive: true,
})

/**
 * Emits
 */
const emit = defineEmits<{
  ready: []
  error: [error: Error]
}>()

// ============================================================================
// Refs
// ============================================================================

const containerRef = ref<HTMLDivElement>()
const chart = ref<IChartApi | null>(null)
const candlestickSeries = ref<ISeriesApi<'Candlestick'> | null>(null)
const volumeSeries = ref<ISeriesApi<'Histogram'> | null>(null)
const maSeries = ref<ISeriesApi<'Line'> | null>(null)
const isInitialized = ref(false)
const hasError = ref(false)
const errorMessage = ref('')

// ============================================================================
// Computed
// ============================================================================

const chartHeight = computed(() => {
  const height = props.height
  if (typeof height === 'string') {
    return height
  }
  return `${height}px`
})

const chartTheme = computed<ChartTheme>(() => {
  return chartService.getChartTheme(props.theme)
})

const isDataValid = computed(() => {
  return Array.isArray(props.data) && props.data.length > 0 && props.data.every(isValidOHLCVData)
})

// ============================================================================
// Methods
// ============================================================================

/**
 * Initialize chart
 */
const initChart = () => {
  if (!containerRef.value || isInitialized.value) {
    return
  }

  try {
    const dimensions = getChartDimensions(containerRef.value)

    // Create chart instance
    const chartInstance = createChart(containerRef.value, {
      ...chartService.getDefaultChartOptions(dimensions.width, dimensions.height, chartTheme.value),
    })

    chart.value = chartInstance

    // Set watermark
    chartInstance.applyOptions({
    })

    // Add series based on chart type
    if (props.type === ChartType.CANDLESTICK) {
      addCandlestickSeries()
      if (props.showVolume) {
        addVolumeSeries()
      }
    } else if (props.type === ChartType.LINE) {
      addLineSeries()
    } else if (props.type === ChartType.AREA) {
      addAreaSeries()
    }

    // Add moving average if enabled
    if (props.showMA && props.type === ChartType.CANDLESTICK) {
      addMovingAverageSeries()
    }

    // Update chart with data
    updateChartData()

    // Fit content
    chartInstance.timeScale().fitContent()

    // Setup event listeners
    setupEventListeners()

    isInitialized.value = true
    emit('ready')
  } catch (error) {
    handleError(error as Error)
  }
}

/**
 * Add candlestick series
 */
const addCandlestickSeries = () => {
  if (!chart.value) return

  const series = chart.value.addSeries(CandlestickSeries, {
    ...chartService.getCandlestickSeriesOptions(chartTheme.value),
  } as any)

  candlestickSeries.value = series as any
}

/**
 * Add volume histogram series
 */
const addVolumeSeries = () => {
  if (!chart.value) return

  const series = chart.value.addSeries(HistogramSeries, {
    color: '#26c281',
    priceFormat: {
      type: 'volume' as any,
    },
    priceScaleId: 'volume',
    scaleMargins: {
      top: 0.8,
      bottom: 0,
    },
  } as any)

  volumeSeries.value = series as any
}

/**
 * Add line series
 */
const addLineSeries = () => {
  if (!chart.value) return

  const series = chart.value.addSeries(LineSeries, {
    color: '#3498db',
    lineWidth: 2,
    crosshairMarkerVisible: true,
    priceFormat: {
      type: 'price' as any,
      precision: 8,
      minMove: 0.00000001,
    },
  } as any)

  candlestickSeries.value = series as any
}

/**
 * Add area series
 */
const addAreaSeries = () => {
  if (!chart.value) return

  const series = chart.value.addSeries(AreaSeries, {
    lineColor: '#3498db',
    topColor: 'rgba(52, 152, 219, 0.2)',
    bottomColor: 'rgba(52, 152, 219, 0.02)',
    lineWidth: 2,
    crosshairMarkerVisible: true,
    priceFormat: {
      type: 'price' as any,
      precision: 8,
      minMove: 0.00000001,
    },
  } as any)

  candlestickSeries.value = series as any
}

/**
 * Add moving average series
 */
const addMovingAverageSeries = () => {
  if (!chart.value) return

  const series = chart.value.addSeries(LineSeries, {
    color: chartTheme.value.maColor,
    lineWidth: 1,
    lineStyle: 1,
    title: `MA ${props.maLength}`,
    crosshairMarkerVisible: true,
    priceFormat: {
      type: 'price' as any,
      precision: 8,
      minMove: 0.00000001,
    },
  } as any)

  maSeries.value = series as any
}

/**
 * Update chart with new data
 */
const updateChartData = () => {
  if (!isDataValid.value || !chart.value) {
    return
  }

  try {
    if (props.type === ChartType.CANDLESTICK && candlestickSeries.value) {
      const chartData = chartService.transformCandlestickChartData(props.data)
      const candleData = chartData.candlesticks as CandlestickData[]
      candlestickSeries.value.setData(candleData)

      if (props.showVolume && volumeSeries.value) {
        const volumeData = chartData.volumes as HistogramData[]
        volumeSeries.value.setData(volumeData)
      }

      if (props.showMA && maSeries.value) {
        const maData = transformMovingAverageData(
          props.data.map((d) => ({
            time: Math.floor(d.time),
            close: d.close,
          })),
          props.maLength
        ) as LineData[]
        maSeries.value.setData(maData)
      }
    } else if (props.type === ChartType.LINE && candlestickSeries.value) {
      const lineData = transformOHLCVToChartData(props.data).map((item) => ({
        time: item.time,
        value: item.close,
      })) as LineData[]
      candlestickSeries.value.setData(lineData)
    } else if (props.type === ChartType.AREA && candlestickSeries.value) {
      const areaData = transformOHLCVToChartData(props.data).map((item) => ({
        time: item.time,
        value: item.close,
      })) as AreaData[]
      candlestickSeries.value.setData(areaData)
    }

    // Fit content after data update
    chart.value.timeScale().fitContent()
  } catch (error) {
    handleError(error as Error)
  }
}

/**
 * Setup event listeners
 */
const setupEventListeners = () => {
  if (!chart.value) return

  // Handle window resize
  const handleResize = debounce(() => {
    if (!containerRef.value || !chart.value) return

    const dimensions = getChartDimensions(containerRef.value)
    chart.value.applyOptions({
      width: dimensions.width,
      height: dimensions.height,
    })
  }, 300)

  window.addEventListener('resize', handleResize)

  // Cleanup on unmount
  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
  })
}

/**
 * Handle errors
 */
const handleError = (error: Error) => {
  hasError.value = true
  errorMessage.value = error.message
  emit('error', error)
  console.error('TradingChart error:', error)
}

/**
 * Cleanup chart
 */
const cleanup = () => {
  if (chart.value) {
    chart.value.remove()
    chart.value = null
  }
  candlestickSeries.value = null
  volumeSeries.value = null
  maSeries.value = null
  isInitialized.value = false
}

// ============================================================================
// Watchers
// ============================================================================

watch(() => props.data, updateChartData, { deep: false })

watch(() => props.theme, () => {
  if (isInitialized.value) {
    cleanup()
    initChart()
  }
})

watch(
  () => props.height,
  () => {
    if (!containerRef.value || !chart.value) return
    const dimensions = getChartDimensions(containerRef.value)
    chart.value.applyOptions({
      height: dimensions.height,
    })
  }
)

// ============================================================================
// Lifecycle
// ============================================================================

onMounted(() => {
  initChart()
})

onUnmounted(() => {
  cleanup()
})
</script>

<template>
  <div class="trading-chart-wrapper">
    <div
      v-if="hasError"
      class="trading-chart-error"
    >
      <p class="error-icon">⚠️</p>
      <p class="error-message">{{ errorMessage }}</p>
    </div>

    <div
      v-show="!hasError"
      ref="containerRef"
      class="trading-chart-container"
      :style="{ height: chartHeight }"
    />
  </div>
</template>

<style scoped>
.trading-chart-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.trading-chart-container {
  position: relative;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.trading-chart-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  padding: var(--trading-spacing-lg);
  background: var(--trading-bg-secondary);
  border-radius: var(--trading-radius-lg);
  border: 1px solid var(--trading-border);
  color: var(--trading-text-secondary);
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
