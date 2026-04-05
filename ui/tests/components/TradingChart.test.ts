/**
 * Component tests for TradingView Chart Component
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { mountWithPinia, waitForAnimation } from '../utils/test-utils'
import { TestDataFactory } from '../utils/test-factories'
import TradingChart from '@/components/charts/TradingChart.vue'

// Mock TradingView Lightweight Charts
const mockChart = {
  addAreaSeries: vi.fn(),
  addLineSeries: vi.fn(),
  addCandlestickSeries: vi.fn(),
  timeScale: vi.fn().mockReturnValue({
    subscribeVisibleTimeRangeChange: vi.fn(),
    setVisibleRange: vi.fn()
  }),
  resize: vi.fn(),
  remove: vi.fn(),
  subscribeCrosshairMove: vi.fn()
}

const mockSeries = {
  setData: vi.fn(),
  update: vi.fn()
}

mockChart.addAreaSeries.mockReturnValue(mockSeries)
mockChart.addLineSeries.mockReturnValue(mockSeries)
mockChart.addCandlestickSeries.mockReturnValue(mockSeries)

vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => mockChart),
  ColorType: {
    Solid: 'solid',
    VerticalGradient: 'verticalGradient'
  },
  LineStyle: {
    Solid: 'solid',
    Dotted: 'dotted',
    Dashed: 'dashed'
  }
}))

// Mock the chart service
const mockChartService = {
  createChart: vi.fn(),
  updateChart: vi.fn(),
  addSeries: vi.fn(),
  subscribeToUpdates: vi.fn()
}

vi.mock('@/services/chart', () => ({
  default: mockChartService
}))

describe('TradingChart Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render chart container', () => {
    const wrapper = mountWithPinia(TradingChart)
    
    expect(wrapper.find('[data-testid="trading-chart"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="chart-container"]').exists()).toBe(true)
  })

  it('should initialize chart with default props', async () => {
    const wrapper = mountWithPinia(TradingChart)
    await nextTick()
    
    expect(mockChart.addAreaSeries).toHaveBeenCalled()
    expect(wrapper.vm.chartType).toBe('area')
  })

  it('should handle different chart types', async () => {
    const wrapper = mountWithPinia(TradingChart, {
      props: { chartType: 'candlestick' }
    })
    await nextTick()
    
    expect(mockChart.addCandlestickSeries).toHaveBeenCalled()
  })

  it('should update chart data when props change', async () => {
    const initialData = TestDataFactory.createChartData(50)
    
    const wrapper = mountWithPinia(TradingChart, {
      props: { data: initialData }
    })
    await nextTick()
    
    expect(mockSeries.setData).toHaveBeenCalledWith(initialData)
    
    // Update with new data
    const newData = TestDataFactory.createChartData(75)
    await wrapper.setProps({ data: newData })
    
    expect(mockSeries.setData).toHaveBeenCalledWith(newData)
  })

  it('should handle real-time data updates', async () => {
    const wrapper = mountWithPinia(TradingChart)
    await nextTick()
    
    const newDataPoint = {
      time: new Date().toISOString(),
      value: 45000
    }
    
    wrapper.vm.updateChart(newDataPoint)
    
    expect(mockSeries.update).toHaveBeenCalledWith(newDataPoint)
  })

  it('should resize chart on container resize', async () => {
    const wrapper = mountWithPinia(TradingChart)
    await nextTick()
    
    // Simulate container resize
    const container = wrapper.find('[data-testid="chart-container"]')
    Object.defineProperty(container.element, 'offsetWidth', { value: 800 })
    Object.defineProperty(container.element, 'offsetHeight', { value: 400 })
    
    window.dispatchEvent(new Event('resize'))
    await nextTick()
    
    expect(mockChart.resize).toHaveBeenCalledWith(800, 400)
  })

  it('should apply dark theme correctly', async () => {
    const wrapper = mountWithPinia(TradingChart, {
      props: { theme: 'dark' }
    })
    await nextTick()
    
    const chartContainer = wrapper.find('[data-testid="chart-container"]')
    expect(chartContainer.classes()).toContain('dark-theme')
  })

  it('should handle loading state', () => {
    const wrapper = mountWithPinia(TradingChart, {
      props: { loading: true }
    })
    
    expect(wrapper.find('[data-testid="chart-loading"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Loading chart')
  })

  it('should show error state when chart fails to load', async () => {
    const wrapper = mountWithPinia(TradingChart, {
      props: { error: 'Failed to load chart data' }
    })
    
    expect(wrapper.find('[data-testid="chart-error"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Failed to load chart data')
  })

  it('should handle time range selection', async () => {
    const wrapper = mountWithPinia(TradingChart)
    await nextTick()
    
    const timeRangeButtons = wrapper.findAll('[data-testid="time-range-btn"]')
    expect(timeRangeButtons.length).toBeGreaterThan(0)
    
    // Click 1H time range
    await timeRangeButtons[0].trigger('click')
    
    expect(wrapper.emitted('time-range-changed')).toBeTruthy()
    expect(wrapper.emitted('time-range-changed')[0]).toEqual(['1H'])
  })

  it('should display chart indicators', async () => {
    const wrapper = mountWithPinia(TradingChart, {
      props: { 
        indicators: ['sma', 'ema', 'rsi'],
        showIndicators: true
      }
    })
    await nextTick()
    
    expect(wrapper.find('[data-testid="chart-indicators"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('SMA')
    expect(wrapper.text()).toContain('EMA')
    expect(wrapper.text()).toContain('RSI')
  })

  it('should handle crosshair interaction', async () => {
    const wrapper = mountWithPinia(TradingChart)
    await nextTick()
    
    expect(mockChart.subscribeCrosshairMove).toHaveBeenCalled()
    
    // Simulate crosshair move
    const crosshairCallback = mockChart.subscribeCrosshairMove.mock.calls[0][0]
    const mockCrosshairData = {
      time: '2024-01-01T12:00:00Z',
      point: { x: 100, y: 200 },
      seriesPrices: new Map([['series1', 45000]])
    }
    
    crosshairCallback(mockCrosshairData)
    
    expect(wrapper.vm.crosshairData).toEqual(mockCrosshairData)
  })

  it('should export chart as image', async () => {
    const wrapper = mountWithPinia(TradingChart)
    await nextTick()
    
    // Mock canvas toDataURL
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => 'data:image/png;base64,mockdata')
    
    const exportButton = wrapper.find('[data-testid="chart-export"]')
    await exportButton.trigger('click')
    
    expect(wrapper.emitted('chart-exported')).toBeTruthy()
  })

  it('should handle zoom and pan interactions', async () => {
    const wrapper = mountWithPinia(TradingChart)
    await nextTick()
    
    // Test zoom functionality
    const zoomInButton = wrapper.find('[data-testid="zoom-in"]')
    const zoomOutButton = wrapper.find('[data-testid="zoom-out"]')
    
    await zoomInButton.trigger('click')
    await zoomOutButton.trigger('click')
    
    expect(wrapper.emitted('zoom-changed')).toBeTruthy()
  })

  it('should cleanup chart on component unmount', async () => {
    const wrapper = mountWithPinia(TradingChart)
    await nextTick()
    
    wrapper.unmount()
    
    expect(mockChart.remove).toHaveBeenCalled()
  })

  it('should handle volume data display', async () => {
    const candlestickData = [
      { time: '2024-01-01', open: 44000, high: 45000, low: 43500, close: 44800, volume: 1000 },
      { time: '2024-01-02', open: 44800, high: 46000, low: 44500, close: 45500, volume: 1200 }
    ]
    
    const wrapper = mountWithPinia(TradingChart, {
      props: { 
        chartType: 'candlestick',
        data: candlestickData,
        showVolume: true
      }
    })
    await nextTick()
    
    expect(mockChart.addCandlestickSeries).toHaveBeenCalled()
    expect(wrapper.find('[data-testid="volume-panel"]').exists()).toBe(true)
  })

  it('should display current price line', async () => {
    const wrapper = mountWithPinia(TradingChart, {
      props: { 
        currentPrice: 45250,
        showCurrentPrice: true
      }
    })
    await nextTick()
    
    expect(wrapper.find('[data-testid="current-price-line"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('45,250')
  })
})