/**
 * Component tests for Market Data Widget
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { mountWithPinia, waitForAnimation } from '../utils/test-utils'
import { TestDataFactory } from '../utils/test-factories'
import MarketDataWidget from '@/components/widgets/MarketDataWidget.vue'

// Mock the market store
const mockMarketStore = {
  marketData: [],
  isLoading: false,
  hasError: false,
  error: null,
  fetchMarketData: vi.fn(),
  getSymbolPrice: vi.fn(),
  getPriceChange: vi.fn(),
  topGainers: [],
  topLosers: []
}

vi.mock('@/stores/market', () => ({
  useMarketStore: () => mockMarketStore
}))

describe('MarketDataWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(mockMarketStore, {
      marketData: [],
      isLoading: false,
      hasError: false,
      error: null,
      topGainers: [],
      topLosers: []
    })
  })

  it('should render market data correctly', async () => {
    const mockMarketData = [
      TestDataFactory.createMarketData({ symbol: 'BTCUSDT', price: 45000, change24h: 2.5 }),
      TestDataFactory.createMarketData({ symbol: 'ETHUSDT', price: 3000, change24h: -1.2 }),
      TestDataFactory.createMarketData({ symbol: 'ADAUSDT', price: 0.5, change24h: 5.8 })
    ]
    
    mockMarketStore.marketData = mockMarketData
    
    const wrapper = mountWithPinia(MarketDataWidget)
    await nextTick()
    
    expect(wrapper.text()).toContain('BTCUSDT')
    expect(wrapper.text()).toContain('$45,000.00')
    expect(wrapper.text()).toContain('+2.5%')
    
    expect(wrapper.text()).toContain('ETHUSDT')
    expect(wrapper.text()).toContain('$3,000.00')
    expect(wrapper.text()).toContain('-1.2%')
  })

  it('should show positive price changes in green', async () => {
    const mockData = TestDataFactory.createMarketData({ 
      symbol: 'BTCUSDT', 
      change24h: 3.5 
    })
    
    mockMarketStore.marketData = [mockData]
    
    const wrapper = mountWithPinia(MarketDataWidget)
    await nextTick()
    
    const changeElement = wrapper.find('[data-testid="price-change-positive"]')
    expect(changeElement.classes()).toContain('text-success')
    expect(changeElement.text()).toContain('+3.5%')
  })

  it('should show negative price changes in red', async () => {
    const mockData = TestDataFactory.createMarketData({ 
      symbol: 'BTCUSDT', 
      change24h: -2.1 
    })
    
    mockMarketStore.marketData = [mockData]
    
    const wrapper = mountWithPinia(MarketDataWidget)
    await nextTick()
    
    const changeElement = wrapper.find('[data-testid="price-change-negative"]')
    expect(changeElement.classes()).toContain('text-danger')
    expect(changeElement.text()).toContain('-2.1%')
  })

  it('should display volume information', async () => {
    const mockData = TestDataFactory.createMarketData({ 
      symbol: 'BTCUSDT', 
      volume: 1234567890 
    })
    
    mockMarketStore.marketData = [mockData]
    
    const wrapper = mountWithPinia(MarketDataWidget)
    await nextTick()
    
    expect(wrapper.find('[data-testid="volume"]').text()).toContain('1.23B')
  })

  it('should show 24h high and low prices', async () => {
    const mockData = TestDataFactory.createMarketData({ 
      symbol: 'BTCUSDT',
      high24h: 46000,
      low24h: 44000
    })
    
    mockMarketStore.marketData = [mockData]
    
    const wrapper = mountWithPinia(MarketDataWidget)
    await nextTick()
    
    expect(wrapper.text()).toContain('46,000')
    expect(wrapper.text()).toContain('44,000')
  })

  it('should handle real-time price updates', async () => {
    const initialData = TestDataFactory.createMarketData({ 
      symbol: 'BTCUSDT', 
      price: 45000 
    })
    
    mockMarketStore.marketData = [initialData]
    
    const wrapper = mountWithPinia(MarketDataWidget)
    await nextTick()
    
    // Update price
    const updatedData = { ...initialData, price: 45500 }
    mockMarketStore.marketData = [updatedData]
    
    await wrapper.vm.$forceUpdate()
    await waitForAnimation(wrapper)
    
    expect(wrapper.text()).toContain('45,500')
    
    // Should animate price change
    const priceElement = wrapper.find('[data-testid="price-value"]')
    expect(priceElement.classes()).toContain('animate-pulse')
  })

  it('should show top gainers section', async () => {
    const mockGainers = [
      TestDataFactory.createMarketData({ symbol: 'ADAUSDT', change24h: 8.5 }),
      TestDataFactory.createMarketData({ symbol: 'DOGEUSDT', change24h: 6.2 })
    ]
    
    mockMarketStore.topGainers = mockGainers
    
    const wrapper = mountWithPinia(MarketDataWidget)
    await nextTick()
    
    const gainersSection = wrapper.find('[data-testid="top-gainers"]')
    expect(gainersSection.exists()).toBe(true)
    expect(gainersSection.text()).toContain('ADAUSDT')
    expect(gainersSection.text()).toContain('+8.5%')
  })

  it('should show top losers section', async () => {
    const mockLosers = [
      TestDataFactory.createMarketData({ symbol: 'LINKUSDT', change24h: -5.2 }),
      TestDataFactory.createMarketData({ symbol: 'XRPUSDT', change24h: -3.8 })
    ]
    
    mockMarketStore.topLosers = mockLosers
    
    const wrapper = mountWithPinia(MarketDataWidget)
    await nextTick()
    
    const losersSection = wrapper.find('[data-testid="top-losers"]')
    expect(losersSection.exists()).toBe(true)
    expect(losersSection.text()).toContain('LINKUSDT')
    expect(losersSection.text()).toContain('-5.2%')
  })

  it('should filter symbols by search input', async () => {
    const mockMarketData = [
      TestDataFactory.createMarketData({ symbol: 'BTCUSDT' }),
      TestDataFactory.createMarketData({ symbol: 'ETHUSDT' }),
      TestDataFactory.createMarketData({ symbol: 'ADAUSDT' })
    ]
    
    mockMarketStore.marketData = mockMarketData
    
    const wrapper = mountWithPinia(MarketDataWidget)
    await nextTick()
    
    const searchInput = wrapper.find('[data-testid="symbol-search"]')
    await searchInput.setValue('BTC')
    await nextTick()
    
    expect(wrapper.findAll('[data-testid="market-item"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('BTCUSDT')
    expect(wrapper.text()).not.toContain('ETHUSDT')
  })

  it('should sort by price change', async () => {
    const mockMarketData = [
      TestDataFactory.createMarketData({ symbol: 'BTCUSDT', change24h: 1.5 }),
      TestDataFactory.createMarketData({ symbol: 'ETHUSDT', change24h: -2.1 }),
      TestDataFactory.createMarketData({ symbol: 'ADAUSDT', change24h: 5.8 })
    ]
    
    mockMarketStore.marketData = mockMarketData
    
    const wrapper = mountWithPinia(MarketDataWidget)
    await nextTick()
    
    const sortButton = wrapper.find('[data-testid="sort-by-change"]')
    await sortButton.trigger('click')
    
    const marketItems = wrapper.findAll('[data-testid="market-item"]')
    expect(marketItems[0].text()).toContain('ADAUSDT') // +5.8%
    expect(marketItems[1].text()).toContain('BTCUSDT') // +1.5%
    expect(marketItems[2].text()).toContain('ETHUSDT') // -2.1%
  })

  it('should handle loading state', () => {
    mockMarketStore.isLoading = true
    
    const wrapper = mountWithPinia(MarketDataWidget)
    
    expect(wrapper.find('[data-testid="market-loading"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Loading market data')
  })

  it('should handle error state', () => {
    mockMarketStore.hasError = true
    mockMarketStore.error = { code: 'API_ERROR', message: 'Failed to fetch market data' }
    
    const wrapper = mountWithPinia(MarketDataWidget)
    
    expect(wrapper.find('[data-testid="market-error"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Failed to fetch market data')
  })

  it('should refresh data when refresh button is clicked', async () => {
    const wrapper = mountWithPinia(MarketDataWidget)
    
    const refreshButton = wrapper.find('[data-testid="market-refresh"]')
    await refreshButton.trigger('click')
    
    expect(mockMarketStore.fetchMarketData).toHaveBeenCalled()
  })

  it('should format large numbers correctly', async () => {
    const mockData = TestDataFactory.createMarketData({ 
      symbol: 'BTCUSDT',
      volume: 1234567890,
      price: 45123.456789
    })
    
    mockMarketStore.marketData = [mockData]
    
    const wrapper = mountWithPinia(MarketDataWidget)
    await nextTick()
    
    // Volume should be formatted as 1.23B
    expect(wrapper.text()).toContain('1.23B')
    
    // Price should be rounded to appropriate decimal places
    expect(wrapper.text()).toContain('45,123.46')
  })

  it('should handle symbol favoriting', async () => {
    const mockData = TestDataFactory.createMarketData({ symbol: 'BTCUSDT' })
    mockMarketStore.marketData = [mockData]
    
    const wrapper = mountWithPinia(MarketDataWidget)
    await nextTick()
    
    const favoriteButton = wrapper.find('[data-testid="favorite-symbol"]')
    await favoriteButton.trigger('click')
    
    expect(wrapper.emitted('symbol-favorited')).toBeTruthy()
    expect(wrapper.emitted('symbol-favorited')[0]).toEqual(['BTCUSDT'])
  })
})