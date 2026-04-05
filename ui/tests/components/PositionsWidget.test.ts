/**
 * Component tests for Positions Widget
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'
import { mountWithPinia, waitForAnimation } from '../utils/test-utils'
import { TestDataFactory } from '../utils/test-factories'
import PositionsWidget from '@/components/widgets/PositionsWidget.vue'

// Mock the positions store
const mockPositionsStore = {
  data: [],
  isLoading: false,
  hasError: false,
  error: null,
  fetchData: vi.fn(),
  activePositions: [],
  longPositions: [],
  shortPositions: [],
  totalPnL: 0,
  unrealizedPnL: 0
}

vi.mock('@/stores/positions', () => ({
  usePositionsStore: () => mockPositionsStore
}))

describe('PositionsWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.assign(mockPositionsStore, {
      data: [],
      isLoading: false,
      hasError: false,
      error: null,
      activePositions: [],
      longPositions: [],
      shortPositions: [],
      totalPnL: 0,
      unrealizedPnL: 0
    })
  })

  it('should render empty state when no positions', () => {
    const wrapper = mountWithPinia(PositionsWidget)
    
    expect(wrapper.find('[data-testid="positions-empty"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('No active positions')
  })

  it('should render positions list correctly', async () => {
    const mockPositions = TestDataFactory.createMultiplePositions(3)
    mockPositionsStore.data = mockPositions
    mockPositionsStore.activePositions = mockPositions
    
    const wrapper = mountWithPinia(PositionsWidget)
    await nextTick()
    
    expect(wrapper.findAll('[data-testid="position-item"]')).toHaveLength(3)
    expect(wrapper.text()).toContain('BTCUSDT')
    expect(wrapper.text()).toContain('ETHUSDT')
  })

  it('should display position details correctly', async () => {
    const mockPosition = TestDataFactory.createPosition({
      symbol: 'BTCUSDT',
      side: 'long',
      size: 0.1,
      entryPrice: 45000,
      markPrice: 45500,
      pnl: 50,
      pnlPercentage: 1.11
    })
    
    mockPositionsStore.data = [mockPosition]
    mockPositionsStore.activePositions = [mockPosition]
    
    const wrapper = mountWithPinia(PositionsWidget)
    await nextTick()
    
    expect(wrapper.text()).toContain('BTCUSDT')
    expect(wrapper.text()).toContain('Long')
    expect(wrapper.text()).toContain('0.1')
    expect(wrapper.text()).toContain('45,000')
    expect(wrapper.text()).toContain('45,500')
    expect(wrapper.text()).toContain('$50.00')
    expect(wrapper.text()).toContain('1.11%')
  })

  it('should show positive P&L with green styling', async () => {
    const mockPosition = TestDataFactory.createPosition({
      pnl: 150,
      pnlPercentage: 2.5
    })
    
    mockPositionsStore.data = [mockPosition]
    mockPositionsStore.activePositions = [mockPosition]
    
    const wrapper = mountWithPinia(PositionsWidget)
    await nextTick()
    
    const pnlElement = wrapper.find('[data-testid="position-pnl"]')
    expect(pnlElement.classes()).toContain('text-success')
    expect(pnlElement.text()).toContain('+$150.00')
  })

  it('should show negative P&L with red styling', async () => {
    const mockPosition = TestDataFactory.createPosition({
      pnl: -75,
      pnlPercentage: -1.2
    })
    
    mockPositionsStore.data = [mockPosition]
    mockPositionsStore.activePositions = [mockPosition]
    
    const wrapper = mountWithPinia(PositionsWidget)
    await nextTick()
    
    const pnlElement = wrapper.find('[data-testid="position-pnl"]')
    expect(pnlElement.classes()).toContain('text-danger')
    expect(pnlElement.text()).toContain('-$75.00')
  })

  it('should distinguish between long and short positions', async () => {
    const longPosition = TestDataFactory.createPosition({ side: 'long', symbol: 'BTCUSDT' })
    const shortPosition = TestDataFactory.createPosition({ side: 'short', symbol: 'ETHUSDT' })
    
    mockPositionsStore.data = [longPosition, shortPosition]
    mockPositionsStore.activePositions = [longPosition, shortPosition]
    mockPositionsStore.longPositions = [longPosition]
    mockPositionsStore.shortPositions = [shortPosition]
    
    const wrapper = mountWithPinia(PositionsWidget)
    await nextTick()
    
    const longElement = wrapper.find('[data-testid="position-side-long"]')
    const shortElement = wrapper.find('[data-testid="position-side-short"]')
    
    expect(longElement.classes()).toContain('text-success')
    expect(longElement.text()).toContain('Long')
    expect(shortElement.classes()).toContain('text-danger')
    expect(shortElement.text()).toContain('Short')
  })

  it('should show total P&L summary', async () => {
    const mockPositions = [
      TestDataFactory.createPosition({ pnl: 100 }),
      TestDataFactory.createPosition({ pnl: -50 }),
      TestDataFactory.createPosition({ pnl: 25 })
    ]
    
    mockPositionsStore.data = mockPositions
    mockPositionsStore.activePositions = mockPositions
    mockPositionsStore.totalPnL = 75
    mockPositionsStore.unrealizedPnL = 75
    
    const wrapper = mountWithPinia(PositionsWidget)
    await nextTick()
    
    expect(wrapper.find('[data-testid="positions-total-pnl"]').text()).toContain('$75.00')
  })

  it('should handle position closing action', async () => {
    const mockPosition = TestDataFactory.createPosition()
    mockPositionsStore.data = [mockPosition]
    mockPositionsStore.activePositions = [mockPosition]
    
    const wrapper = mountWithPinia(PositionsWidget)
    await nextTick()
    
    const closeButton = wrapper.find('[data-testid="position-close-btn"]')
    await closeButton.trigger('click')
    
    expect(wrapper.emitted('position-close')).toBeTruthy()
    expect(wrapper.emitted('position-close')[0]).toEqual([mockPosition.id])
  })

  it('should sort positions by P&L', async () => {
    const positions = [
      TestDataFactory.createPosition({ pnl: -50, symbol: 'ETHUSDT' }),
      TestDataFactory.createPosition({ pnl: 100, symbol: 'BTCUSDT' }),
      TestDataFactory.createPosition({ pnl: 25, symbol: 'ADAUSDT' })
    ]
    
    mockPositionsStore.data = positions
    mockPositionsStore.activePositions = positions
    
    const wrapper = mountWithPinia(PositionsWidget)
    await nextTick()
    
    const sortButton = wrapper.find('[data-testid="sort-by-pnl"]')
    await sortButton.trigger('click')
    
    // Should sort positions by P&L (highest first)
    const positionItems = wrapper.findAll('[data-testid="position-item"]')
    expect(positionItems[0].text()).toContain('BTCUSDT') // +100
    expect(positionItems[1].text()).toContain('ADAUSDT') // +25
    expect(positionItems[2].text()).toContain('ETHUSDT') // -50
  })

  it('should filter positions by type', async () => {
    const longPosition = TestDataFactory.createPosition({ side: 'long', symbol: 'BTCUSDT' })
    const shortPosition = TestDataFactory.createPosition({ side: 'short', symbol: 'ETHUSDT' })
    
    mockPositionsStore.data = [longPosition, shortPosition]
    mockPositionsStore.activePositions = [longPosition, shortPosition]
    
    const wrapper = mountWithPinia(PositionsWidget)
    await nextTick()
    
    // Filter to show only long positions
    const longFilterButton = wrapper.find('[data-testid="filter-long"]')
    await longFilterButton.trigger('click')
    
    expect(wrapper.findAll('[data-testid="position-item"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('BTCUSDT')
    expect(wrapper.text()).not.toContain('ETHUSDT')
  })

  it('should show loading state', () => {
    mockPositionsStore.isLoading = true
    
    const wrapper = mountWithPinia(PositionsWidget)
    
    expect(wrapper.find('[data-testid="positions-loading"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Loading positions')
  })

  it('should handle error state', () => {
    mockPositionsStore.hasError = true
    mockPositionsStore.error = { code: 'FETCH_ERROR', message: 'Failed to load positions' }
    
    const wrapper = mountWithPinia(PositionsWidget)
    
    expect(wrapper.find('[data-testid="positions-error"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Failed to load positions')
  })

  it('should refresh data when refresh button is clicked', async () => {
    const wrapper = mountWithPinia(PositionsWidget)
    
    const refreshButton = wrapper.find('[data-testid="positions-refresh"]')
    await refreshButton.trigger('click')
    
    expect(mockPositionsStore.fetchData).toHaveBeenCalled()
  })

  it('should animate new positions', async () => {
    const wrapper = mountWithPinia(PositionsWidget)
    
    // Add a new position
    const newPosition = TestDataFactory.createPosition()
    mockPositionsStore.data = [newPosition]
    mockPositionsStore.activePositions = [newPosition]
    
    await wrapper.vm.$forceUpdate()
    await waitForAnimation(wrapper)
    
    const positionItem = wrapper.find('[data-testid="position-item"]')
    expect(positionItem.classes()).toContain('animate-slideInUp')
  })
})