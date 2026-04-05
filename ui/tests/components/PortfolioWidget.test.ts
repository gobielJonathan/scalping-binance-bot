/**
 * Component tests for Portfolio Widget
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { mountWithPinia, waitForAnimation } from '../utils/test-utils'
import { TestDataFactory } from '../utils/test-factories'
import PortfolioWidget from '@/components/widgets/PortfolioWidget.vue'

// Mock the portfolio store
const mockPortfolioStore = {
  data: null,
  isLoading: false,
  hasError: false,
  error: null,
  fetchData: vi.fn(),
  totalValue: 0,
  profitability: 0,
  performance: { winRate: 0 }
}

vi.mock('@/stores/portfolio', () => ({
  usePortfolioStore: () => mockPortfolioStore
}))

describe('PortfolioWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(mockPortfolioStore, {
      data: null,
      isLoading: false,
      hasError: false,
      error: null,
      totalValue: 0,
      profitability: 0,
      performance: { winRate: 0 }
    })
  })

  it('should render widget with loading state', () => {
    mockPortfolioStore.isLoading = true
    
    const wrapper = mountWithPinia(PortfolioWidget)
    
    expect(wrapper.find('[data-testid="portfolio-loading"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Loading')
  })

  it('should render portfolio data correctly', async () => {
    const mockPortfolio = TestDataFactory.createPortfolio({
      balance: 10000,
      pnl: 150.50,
      pnlPercentage: 1.51
    })
    
    mockPortfolioStore.data = mockPortfolio
    mockPortfolioStore.totalValue = 10150.50
    mockPortfolioStore.profitability = 1.51
    
    const wrapper = mountWithPinia(PortfolioWidget)
    await nextTick()
    
    expect(wrapper.find('[data-testid="portfolio-balance"]').text()).toContain('$10,000.00')
    expect(wrapper.find('[data-testid="portfolio-pnl"]').text()).toContain('$150.50')
    expect(wrapper.find('[data-testid="portfolio-pnl-percentage"]').text()).toContain('1.51%')
  })

  it('should show positive P&L with green styling', async () => {
    const mockPortfolio = TestDataFactory.createPortfolio({
      pnl: 250,
      pnlPercentage: 2.5
    })
    
    mockPortfolioStore.data = mockPortfolio
    
    const wrapper = mountWithPinia(PortfolioWidget)
    await nextTick()
    
    const pnlElement = wrapper.find('[data-testid="portfolio-pnl"]')
    expect(pnlElement.classes()).toContain('text-success')
    expect(pnlElement.text()).toContain('+$250.00')
  })

  it('should show negative P&L with red styling', async () => {
    const mockPortfolio = TestDataFactory.createPortfolio({
      pnl: -150,
      pnlPercentage: -1.5
    })
    
    mockPortfolioStore.data = mockPortfolio
    
    const wrapper = mountWithPinia(PortfolioWidget)
    await nextTick()
    
    const pnlElement = wrapper.find('[data-testid="portfolio-pnl"]')
    expect(pnlElement.classes()).toContain('text-danger')
    expect(pnlElement.text()).toContain('-$150.00')
  })

  it('should handle error state gracefully', () => {
    mockPortfolioStore.hasError = true
    mockPortfolioStore.error = { code: 'NETWORK_ERROR', message: 'Connection failed' }
    
    const wrapper = mountWithPinia(PortfolioWidget)
    
    expect(wrapper.find('[data-testid="portfolio-error"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Connection failed')
  })

  it('should refresh data when refresh button is clicked', async () => {
    const wrapper = mountWithPinia(PortfolioWidget)
    
    const refreshButton = wrapper.find('[data-testid="portfolio-refresh"]')
    await refreshButton.trigger('click')
    
    expect(mockPortfolioStore.fetchData).toHaveBeenCalled()
  })

  it('should format numbers with proper locale formatting', async () => {
    const mockPortfolio = TestDataFactory.createPortfolio({
      balance: 1234567.89,
      pnl: 12345.67
    })
    
    mockPortfolioStore.data = mockPortfolio
    
    const wrapper = mountWithPinia(PortfolioWidget)
    await nextTick()
    
    // Should format with thousands separators
    expect(wrapper.text()).toContain('1,234,567.89')
    expect(wrapper.text()).toContain('12,345.67')
  })

  it('should animate value changes', async () => {
    const wrapper = mountWithPinia(PortfolioWidget)
    
    // Initial state
    mockPortfolioStore.data = TestDataFactory.createPortfolio({ balance: 10000 })
    await wrapper.vm.$forceUpdate()
    await nextTick()
    
    // Update with new value
    mockPortfolioStore.data = TestDataFactory.createPortfolio({ balance: 10500 })
    await wrapper.vm.$forceUpdate()
    await waitForAnimation(wrapper)
    
    // Should trigger animation classes
    expect(wrapper.find('[data-testid="portfolio-balance"]').classes()).toContain('animate-pulse')
  })

  it('should emit events for user interactions', async () => {
    const wrapper = mountWithPinia(PortfolioWidget)
    
    // Mock click on portfolio details
    await wrapper.find('[data-testid="portfolio-details"]').trigger('click')
    
    expect(wrapper.emitted('portfolio-clicked')).toBeTruthy()
  })

  it('should handle responsive design classes', () => {
    const wrapper = mountWithPinia(PortfolioWidget)
    
    const widgetElement = wrapper.find('[data-testid="portfolio-widget"]')
    expect(widgetElement.classes()).toContain('col-xl-4')
    expect(widgetElement.classes()).toContain('col-lg-6')
    expect(widgetElement.classes()).toContain('col-12')
  })

  it('should show drawdown information', async () => {
    const mockPortfolio = TestDataFactory.createPortfolio({
      drawdown: -5.2
    })
    
    mockPortfolioStore.data = mockPortfolio
    
    const wrapper = mountWithPinia(PortfolioWidget)
    await nextTick()
    
    expect(wrapper.find('[data-testid="portfolio-drawdown"]').text()).toContain('-5.2%')
  })

  it('should display win rate and trade statistics', async () => {
    const mockPortfolio = TestDataFactory.createPortfolio({
      winRate: 68.5,
      totalTrades: 123
    })
    
    mockPortfolioStore.data = mockPortfolio
    mockPortfolioStore.performance = { winRate: 68.5 }
    
    const wrapper = mountWithPinia(PortfolioWidget)
    await nextTick()
    
    expect(wrapper.text()).toContain('68.5%')
    expect(wrapper.text()).toContain('123')
  })
})