# Trading Dashboard Components API Reference

## Overview

The trading dashboard is built with Vue 3 composition API and provides a comprehensive set of components for trading interfaces. All components follow TypeScript best practices and include full accessibility support.

## Widget Components

### PortfolioWidget

The Portfolio Widget displays account balance, equity, P&L, and performance metrics.

#### Props

```typescript
interface PortfolioWidgetProps {
  refreshInterval?: number  // Auto-refresh interval in ms (default: 30000)
  showDetailed?: boolean   // Show detailed metrics (default: true)
  theme?: 'light' | 'dark' // Theme override (default: follows system)
}
```

#### Events

```typescript
interface PortfolioWidgetEvents {
  'portfolio-clicked': () => void      // User clicks on portfolio details
  'refresh-triggered': () => void      // Manual refresh triggered
  'error-occurred': (error: Error) => void  // Error in data loading
}
```

#### Usage Example

```vue
<template>
  <PortfolioWidget 
    :refresh-interval="15000"
    :show-detailed="true"
    @portfolio-clicked="navigateToDetails"
    @error-occurred="handleError"
  />
</template>

<script setup lang="ts">
import { PortfolioWidget } from '@/components/widgets'

function navigateToDetails() {
  // Handle navigation to portfolio details
}

function handleError(error: Error) {
  // Handle error display
}
</script>
```

#### Styling

The widget uses Bootstrap 5 classes and CSS custom properties:

```css
.portfolio-widget {
  --primary-color: #007bff;
  --success-color: #28a745;
  --danger-color: #dc3545;
  --widget-padding: 1rem;
  --widget-radius: 0.5rem;
}
```

### PositionsWidget

Displays active trading positions with real-time P&L updates.

#### Props

```typescript
interface PositionsWidgetProps {
  maxPositions?: number    // Maximum positions to display (default: 10)
  sortBy?: 'pnl' | 'symbol' | 'size'  // Default sorting (default: 'pnl')
  filterBy?: 'all' | 'long' | 'short'  // Position type filter (default: 'all')
  showCharts?: boolean     // Show mini charts (default: false)
}
```

#### Events

```typescript
interface PositionsWidgetEvents {
  'position-clicked': (positionId: string) => void
  'position-close': (positionId: string) => void
  'filter-changed': (filter: string) => void
}
```

#### Usage Example

```vue
<template>
  <PositionsWidget 
    :max-positions="5"
    sort-by="pnl"
    filter-by="all"
    @position-close="closePosition"
  />
</template>

<script setup lang="ts">
async function closePosition(positionId: string) {
  try {
    await tradesService.closePosition(positionId)
  } catch (error) {
    console.error('Failed to close position:', error)
  }
}
</script>
```

### MarketDataWidget

Real-time market data display with price changes and volume information.

#### Props

```typescript
interface MarketDataWidgetProps {
  symbols?: string[]       // Symbols to display (default: ['BTCUSDT', 'ETHUSDT'])
  showVolume?: boolean     // Show volume data (default: true)
  showChange?: boolean     // Show 24h change (default: true)
  updateInterval?: number  // Update interval in ms (default: 1000)
}
```

#### Events

```typescript
interface MarketDataWidgetEvents {
  'symbol-clicked': (symbol: string) => void
  'symbol-favorited': (symbol: string) => void
}
```

### TradingChart

Interactive TradingView Lightweight Charts integration.

#### Props

```typescript
interface TradingChartProps {
  symbol?: string          // Trading symbol (default: 'BTCUSDT')
  chartType?: 'area' | 'line' | 'candlestick'  // Chart type (default: 'area')
  data?: ChartData[]       // Chart data points
  theme?: 'light' | 'dark' // Chart theme (default: 'dark')
  showVolume?: boolean     // Show volume panel (default: true)
  showIndicators?: boolean // Show technical indicators (default: false)
  indicators?: string[]    // Active indicators (default: [])
  timeRange?: string       // Time range (default: '1D')
  height?: number          // Chart height in pixels (default: 400)
  loading?: boolean        // Loading state (default: false)
  error?: string          // Error message
}
```

#### Events

```typescript
interface TradingChartEvents {
  'time-range-changed': (range: string) => void
  'crosshair-moved': (data: CrosshairData) => void
  'zoom-changed': (zoom: ZoomData) => void
  'chart-exported': (dataUrl: string) => void
}
```

#### Usage Example

```vue
<template>
  <TradingChart 
    symbol="BTCUSDT"
    chart-type="candlestick"
    :show-volume="true"
    :show-indicators="true"
    :indicators="['sma', 'ema']"
    @time-range-changed="handleTimeRangeChange"
  />
</template>

<script setup lang="ts">
function handleTimeRangeChange(range: string) {
  // Fetch new data for the selected time range
}
</script>
```

## Layout Components

### WidgetContainer

Base container for all dashboard widgets with consistent styling and error boundaries.

#### Props

```typescript
interface WidgetContainerProps {
  title: string           // Widget title
  loading?: boolean       // Loading state (default: false)
  error?: string         // Error message
  refreshable?: boolean  // Show refresh button (default: true)
  collapsible?: boolean  // Allow collapse (default: false)
  size?: 'sm' | 'md' | 'lg'  // Widget size (default: 'md')
}
```

#### Slots

```vue
<template>
  <WidgetContainer title="My Widget">
    <template #actions>
      <!-- Custom action buttons -->
    </template>
    
    <template #default>
      <!-- Widget content -->
    </template>
    
    <template #footer>
      <!-- Widget footer -->
    </template>
  </WidgetContainer>
</template>
```

### DashboardGrid

Responsive grid layout for dashboard widgets.

#### Props

```typescript
interface DashboardGridProps {
  columns?: number        // Grid columns (default: 12)
  gap?: string           // Grid gap (default: '1rem')
  responsive?: boolean   // Responsive behavior (default: true)
}
```

## Common Types

### Trading Types

```typescript
interface Portfolio {
  balance: number
  equity: number
  pnl: number
  pnlPercentage: number
  drawdown: number
  winRate: number
  totalTrades: number
  lastUpdated: string
}

interface Position {
  id: string
  symbol: string
  side: 'long' | 'short'
  size: number
  entryPrice: number
  markPrice: number
  pnl: number
  pnlPercentage: number
  timestamp: string
}

interface Trade {
  id: string
  symbol: string
  side: 'buy' | 'sell'
  size: number
  price: number
  timestamp: string
  status: 'filled' | 'pending' | 'cancelled'
}

interface MarketData {
  symbol: string
  price: number
  change24h: number
  volume: number
  high24h: number
  low24h: number
  timestamp: string
}
```

### Chart Types

```typescript
interface ChartData {
  time: string
  value: number
  volume?: number
}

interface CandlestickData {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

interface CrosshairData {
  time: string
  point: { x: number; y: number }
  seriesPrices: Map<string, number>
}
```

## Theming

### CSS Custom Properties

All components support theming through CSS custom properties:

```css
:root {
  /* Colors */
  --primary-color: #007bff;
  --secondary-color: #6c757d;
  --success-color: #28a745;
  --danger-color: #dc3545;
  --warning-color: #ffc107;
  --info-color: #17a2b8;
  
  /* Background */
  --bg-primary: #ffffff;
  --bg-secondary: #f8f9fa;
  --bg-dark: #1a1d29;
  --bg-card: #ffffff;
  
  /* Text */
  --text-primary: #212529;
  --text-secondary: #6c757d;
  --text-light: #ffffff;
  
  /* Borders */
  --border-color: #dee2e6;
  --border-radius: 0.5rem;
  
  /* Animations */
  --animation-duration: 0.3s;
  --animation-easing: cubic-bezier(0.4, 0.0, 0.2, 1);
}

[data-theme="dark"] {
  --bg-primary: #1a1d29;
  --bg-secondary: #2a2e3a;
  --bg-card: #2a2e3a;
  --text-primary: #ffffff;
  --text-secondary: #a0aec0;
  --border-color: #4a5568;
}
```

### Dark Mode

Enable dark mode by adding the `data-theme="dark"` attribute to the root element:

```javascript
document.documentElement.setAttribute('data-theme', 'dark')
```

## Accessibility

All components follow WCAG 2.1 AA guidelines:

- Proper ARIA labels and roles
- Keyboard navigation support
- Screen reader compatibility
- High contrast color ratios
- Focus indicators

### Screen Reader Support

```vue
<template>
  <div 
    role="region" 
    :aria-label="$t('portfolio.title')"
    aria-live="polite"
  >
    <h2 id="portfolio-heading">{{ title }}</h2>
    <div 
      aria-labelledby="portfolio-heading"
      aria-describedby="portfolio-description"
    >
      <!-- Content -->
    </div>
  </div>
</template>
```

## Performance

### Optimization Strategies

1. **Lazy Loading**: Components are loaded on demand
2. **Virtual Scrolling**: Large lists use virtual scrolling
3. **Memoization**: Expensive computations are memoized
4. **Throttling**: Real-time updates are throttled
5. **Tree Shaking**: Only used components are bundled

### Bundle Size

- Core widgets: ~45KB gzipped
- Chart components: ~120KB gzipped (including TradingView)
- Full dashboard: ~180KB gzipped

## Testing

### Component Testing

```typescript
import { mountWithPinia } from '@/tests/utils'
import PortfolioWidget from '@/components/widgets/PortfolioWidget.vue'

test('renders portfolio data correctly', async () => {
  const wrapper = mountWithPinia(PortfolioWidget, {
    props: { refreshInterval: 1000 }
  })
  
  expect(wrapper.find('[data-testid="portfolio-balance"]')).toBeTruthy()
})
```

### E2E Testing

```typescript
test('dashboard loads all widgets', async ({ page }) => {
  await page.goto('/')
  
  await expect(page.locator('[data-testid="portfolio-widget"]')).toBeVisible()
  await expect(page.locator('[data-testid="positions-widget"]')).toBeVisible()
})
```

## Contributing

### Development Setup

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Start development server: `pnpm dev`
4. Run tests: `pnpm test`

### Component Guidelines

1. Use TypeScript for all components
2. Follow composition API patterns
3. Include comprehensive prop validation
4. Add data-testid attributes for testing
5. Support both light and dark themes
6. Include accessibility attributes
7. Document all props and events

### Code Style

- Use ESLint and Prettier configurations
- Follow Vue 3 composition API best practices
- Use descriptive variable and function names
- Include JSDoc comments for public APIs