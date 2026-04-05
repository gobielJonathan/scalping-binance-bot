/**
 * E2E tests for Dashboard page
 */
import { test, expect } from '@playwright/test'

test.describe('Trading Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the dashboard
    await page.goto('/')
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle')
  })

  test('should load dashboard with all widgets', async ({ page }) => {
    // Check that all main widgets are present
    await expect(page.locator('[data-testid="portfolio-widget"]')).toBeVisible()
    await expect(page.locator('[data-testid="positions-widget"]')).toBeVisible()
    await expect(page.locator('[data-testid="trades-widget"]')).toBeVisible()
    await expect(page.locator('[data-testid="market-widget"]')).toBeVisible()
    await expect(page.locator('[data-testid="performance-widget"]')).toBeVisible()
    await expect(page.locator('[data-testid="system-status-widget"]')).toBeVisible()
  })

  test('should display portfolio information', async ({ page }) => {
    const portfolioWidget = page.locator('[data-testid="portfolio-widget"]')
    
    // Wait for portfolio data to load
    await expect(portfolioWidget.locator('[data-testid="portfolio-balance"]')).toBeVisible()
    
    // Check that balance and P&L are displayed
    await expect(portfolioWidget.locator('[data-testid="portfolio-balance"]')).toContainText('$')
    await expect(portfolioWidget.locator('[data-testid="portfolio-pnl"]')).toBeVisible()
  })

  test('should show real-time market data updates', async ({ page }) => {
    const marketWidget = page.locator('[data-testid="market-widget"]')
    
    // Wait for market data to load
    await expect(marketWidget.locator('[data-testid="market-item"]')).toBeVisible()
    
    // Check that price data is displayed
    await expect(marketWidget).toContainText('BTCUSDT')
    await expect(marketWidget).toContainText('$')
  })

  test('should display active positions', async ({ page }) => {
    const positionsWidget = page.locator('[data-testid="positions-widget"]')
    
    // Check if positions are displayed or empty state
    const hasPositions = await positionsWidget.locator('[data-testid="position-item"]').count()
    
    if (hasPositions > 0) {
      await expect(positionsWidget.locator('[data-testid="position-item"]').first()).toBeVisible()
      await expect(positionsWidget.locator('[data-testid="position-pnl"]').first()).toBeVisible()
    } else {
      await expect(positionsWidget.locator('[data-testid="positions-empty"]')).toBeVisible()
    }
  })

  test('should handle widget refresh functionality', async ({ page }) => {
    const portfolioWidget = page.locator('[data-testid="portfolio-widget"]')
    
    // Click refresh button
    await portfolioWidget.locator('[data-testid="portfolio-refresh"]').click()
    
    // Should show loading state briefly
    await expect(portfolioWidget.locator('[data-testid="portfolio-loading"]')).toBeVisible()
    
    // Loading should disappear
    await expect(portfolioWidget.locator('[data-testid="portfolio-loading"]')).not.toBeVisible()
  })

  test('should navigate between different sections', async ({ page }) => {
    // Test navigation if available
    const navMenu = page.locator('[data-testid="nav-menu"]')
    
    if (await navMenu.isVisible()) {
      await navMenu.locator('[data-testid="nav-dashboard"]').click()
      await expect(page).toHaveURL(/.*dashboard/)
      
      await navMenu.locator('[data-testid="nav-trades"]').click()
      await expect(page).toHaveURL(/.*trades/)
    }
  })

  test('should handle error states gracefully', async ({ page }) => {
    // Simulate network error by blocking API calls
    await page.route('**/api/**', route => {
      route.abort('failed')
    })
    
    await page.reload()
    await page.waitForLoadState('networkidle')
    
    // Should show error states in widgets
    const errorElements = page.locator('[data-testid*="error"]')
    await expect(errorElements.first()).toBeVisible({ timeout: 10000 })
  })

  test('should maintain responsive design on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    // Check that widgets adapt to mobile layout
    await expect(page.locator('[data-testid="portfolio-widget"]')).toBeVisible()
    
    // Widgets should stack vertically on mobile
    const widgets = page.locator('[class*="col-"]')
    const firstWidget = widgets.first()
    const secondWidget = widgets.nth(1)
    
    if (await widgets.count() > 1) {
      const firstBox = await firstWidget.boundingBox()
      const secondBox = await secondWidget.boundingBox()
      
      if (firstBox && secondBox) {
        // On mobile, second widget should be below first widget
        expect(secondBox.y).toBeGreaterThan(firstBox.y + firstBox.height - 50)
      }
    }
  })

  test('should handle WebSocket connection', async ({ page }) => {
    // Monitor WebSocket connections
    let websocketConnected = false
    
    page.on('websocket', websocket => {
      websocketConnected = true
    })
    
    await page.waitForTimeout(3000)
    
    // WebSocket connection should be established for real-time data
    expect(websocketConnected).toBeTruthy()
  })

  test('should display system status correctly', async ({ page }) => {
    const systemStatusWidget = page.locator('[data-testid="system-status-widget"]')
    
    await expect(systemStatusWidget).toBeVisible()
    
    // Should show connection status
    await expect(systemStatusWidget.locator('[data-testid="connection-status"]')).toBeVisible()
    
    // Should show API status
    await expect(systemStatusWidget.locator('[data-testid="api-status"]')).toBeVisible()
  })

  test('should handle trade execution flow', async ({ page }) => {
    const tradesWidget = page.locator('[data-testid="trades-widget"]')
    
    // Look for trade button or form
    const tradeButton = tradesWidget.locator('[data-testid="new-trade-btn"]')
    
    if (await tradeButton.isVisible()) {
      await tradeButton.click()
      
      // Should open trade form or modal
      await expect(page.locator('[data-testid="trade-form"]')).toBeVisible()
      
      // Fill trade form
      await page.locator('[data-testid="trade-symbol"]').fill('BTCUSDT')
      await page.locator('[data-testid="trade-amount"]').fill('0.01')
      await page.locator('[data-testid="trade-side-buy"]').click()
      
      // Submit trade (should be disabled in demo mode)
      const submitButton = page.locator('[data-testid="trade-submit"]')
      if (await submitButton.isEnabled()) {
        await submitButton.click()
        
        // Should show confirmation or result
        await expect(page.locator('[data-testid="trade-result"]')).toBeVisible()
      }
    }
  })
})