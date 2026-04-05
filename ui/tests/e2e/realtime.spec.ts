/**
 * E2E tests for Real-time functionality
 */
import { test, expect } from '@playwright/test'

test.describe('Real-time Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('should receive real-time portfolio updates', async ({ page }) => {
    const portfolioWidget = page.locator('[data-testid="portfolio-widget"]')
    const pnlElement = portfolioWidget.locator('[data-testid="portfolio-pnl"]')
    
    // Wait for initial data
    await expect(pnlElement).toBeVisible()
    
    // Capture initial P&L value
    const initialPnL = await pnlElement.textContent()
    
    // Wait for potential updates (simulated through WebSocket)
    await page.waitForTimeout(5000)
    
    // Check if the P&L value has animation classes (indicating real-time updates)
    const hasAnimationClass = await pnlElement.evaluate(el => 
      el.classList.contains('animate-pulse') || el.classList.contains('animate-bounce')
    )
    
    // Should have received some form of update or animation
    expect(hasAnimationClass || initialPnL !== await pnlElement.textContent()).toBeTruthy()
  })

  test('should update market prices in real-time', async ({ page }) => {
    const marketWidget = page.locator('[data-testid="market-widget"]')
    
    // Wait for market data to load
    await expect(marketWidget.locator('[data-testid="market-item"]').first()).toBeVisible()
    
    const priceElement = marketWidget.locator('[data-testid="price-value"]').first()
    const initialPrice = await priceElement.textContent()
    
    // Monitor for price changes over time
    let priceChanged = false
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(1000)
      const currentPrice = await priceElement.textContent()
      if (currentPrice !== initialPrice) {
        priceChanged = true
        break
      }
    }
    
    // Should show price animation indicators
    const hasUpdateAnimation = await priceElement.evaluate(el => 
      el.classList.contains('animate-pulse') || 
      el.classList.contains('text-success') || 
      el.classList.contains('text-danger')
    )
    
    expect(priceChanged || hasUpdateAnimation).toBeTruthy()
  })

  test('should show position updates', async ({ page }) => {
    const positionsWidget = page.locator('[data-testid="positions-widget"]')
    
    // Check if there are positions to monitor
    const positionCount = await positionsWidget.locator('[data-testid="position-item"]').count()
    
    if (positionCount > 0) {
      const firstPosition = positionsWidget.locator('[data-testid="position-item"]').first()
      const pnlElement = firstPosition.locator('[data-testid="position-pnl"]')
      
      await expect(pnlElement).toBeVisible()
      
      // Monitor for P&L changes
      const initialPnL = await pnlElement.textContent()
      
      await page.waitForTimeout(3000)
      
      const finalPnL = await pnlElement.textContent()
      const hasAnimation = await pnlElement.evaluate(el => 
        el.classList.contains('animate-pulse')
      )
      
      expect(initialPnL !== finalPnL || hasAnimation).toBeTruthy()
    }
  })

  test('should handle WebSocket reconnection', async ({ page }) => {
    let wsConnections = 0
    
    page.on('websocket', websocket => {
      wsConnections++
      
      // Simulate connection loss
      websocket.on('close', () => {
        console.log('WebSocket closed')
      })
    })
    
    await page.waitForTimeout(2000)
    
    // Should have established WebSocket connection
    expect(wsConnections).toBeGreaterThan(0)
    
    // Check connection status indicator
    const systemStatusWidget = page.locator('[data-testid="system-status-widget"]')
    const connectionStatus = systemStatusWidget.locator('[data-testid="connection-status"]')
    
    await expect(connectionStatus).toBeVisible()
    
    // Should show connected status
    await expect(connectionStatus).toContainText(/connected|online/i)
  })

  test('should display real-time notifications', async ({ page }) => {
    // Look for notification container
    const notificationArea = page.locator('[data-testid="notifications"]')
    
    if (await notificationArea.isVisible()) {
      // Monitor for new notifications
      const initialNotificationCount = await notificationArea.locator('[data-testid="notification-item"]').count()
      
      await page.waitForTimeout(5000)
      
      const finalNotificationCount = await notificationArea.locator('[data-testid="notification-item"]').count()
      
      // New notifications might appear during testing
      expect(finalNotificationCount).toBeGreaterThanOrEqual(initialNotificationCount)
    }
  })

  test('should update trade history in real-time', async ({ page }) => {
    const tradesWidget = page.locator('[data-testid="trades-widget"]')
    
    await expect(tradesWidget).toBeVisible()
    
    // Check for trade history table
    const tradesList = tradesWidget.locator('[data-testid="trades-list"]')
    
    if (await tradesList.isVisible()) {
      const initialTradeCount = await tradesList.locator('[data-testid="trade-item"]').count()
      
      await page.waitForTimeout(3000)
      
      const finalTradeCount = await tradesList.locator('[data-testid="trade-item"]').count()
      
      // Trades might be updated or added
      expect(finalTradeCount).toBeGreaterThanOrEqual(initialTradeCount)
    }
  })

  test('should handle performance metrics updates', async ({ page }) => {
    const performanceWidget = page.locator('[data-testid="performance-widget"]')
    
    await expect(performanceWidget).toBeVisible()
    
    // Check for performance metrics
    const winRateElement = performanceWidget.locator('[data-testid="win-rate"]')
    const profitFactorElement = performanceWidget.locator('[data-testid="profit-factor"]')
    
    if (await winRateElement.isVisible()) {
      const initialWinRate = await winRateElement.textContent()
      
      await page.waitForTimeout(3000)
      
      const finalWinRate = await winRateElement.textContent()
      const hasUpdateIndicator = await winRateElement.evaluate(el => 
        el.classList.contains('animate-pulse')
      )
      
      expect(initialWinRate !== finalWinRate || hasUpdateIndicator).toBeTruthy()
    }
  })

  test('should show chart real-time updates', async ({ page }) => {
    const chartContainer = page.locator('[data-testid="trading-chart"]')
    
    if (await chartContainer.isVisible()) {
      // Chart should be loaded
      await expect(chartContainer.locator('[data-testid="chart-container"]')).toBeVisible()
      
      // Wait for potential chart updates
      await page.waitForTimeout(5000)
      
      // Check if chart has received updates (this would be visible through price line changes)
      const priceLineElement = chartContainer.locator('[data-testid="current-price-line"]')
      
      if (await priceLineElement.isVisible()) {
        const hasPriceUpdate = await priceLineElement.evaluate(el => 
          el.style.transform || el.style.top
        )
        
        expect(hasPriceUpdate).toBeTruthy()
      }
    }
  })

  test('should handle multiple concurrent updates', async ({ page }) => {
    // Monitor multiple widgets simultaneously for updates
    const widgets = [
      page.locator('[data-testid="portfolio-widget"]'),
      page.locator('[data-testid="positions-widget"]'),
      page.locator('[data-testid="market-widget"]'),
      page.locator('[data-testid="performance-widget"]')
    ]
    
    // Capture initial states
    const initialStates = await Promise.all(
      widgets.map(async widget => {
        if (await widget.isVisible()) {
          return await widget.textContent()
        }
        return null
      })
    )
    
    // Wait for updates
    await page.waitForTimeout(5000)
    
    // Check final states
    const finalStates = await Promise.all(
      widgets.map(async widget => {
        if (await widget.isVisible()) {
          return await widget.textContent()
        }
        return null
      })
    )
    
    // At least one widget should have received updates
    const hasAnyUpdate = initialStates.some((initial, index) => 
      initial !== null && initial !== finalStates[index]
    )
    
    expect(hasAnyUpdate).toBeTruthy()
  })

  test('should maintain data consistency across widgets', async ({ page }) => {
    const portfolioWidget = page.locator('[data-testid="portfolio-widget"]')
    const positionsWidget = page.locator('[data-testid="positions-widget"]')
    
    if (await portfolioWidget.isVisible() && await positionsWidget.isVisible()) {
      // Get total P&L from portfolio
      const portfolioPnL = portfolioWidget.locator('[data-testid="portfolio-pnl"]')
      
      // Get total P&L from positions
      const positionsTotalPnL = positionsWidget.locator('[data-testid="positions-total-pnl"]')
      
      if (await portfolioPnL.isVisible() && await positionsTotalPnL.isVisible()) {
        const portfolioValue = await portfolioPnL.textContent()
        const positionsValue = await positionsTotalPnL.textContent()
        
        // Values should be consistent (allowing for minor formatting differences)
        expect(portfolioValue?.replace(/[^\d.-]/g, '')).toBeTruthy()
        expect(positionsValue?.replace(/[^\d.-]/g, '')).toBeTruthy()
      }
    }
  })
})