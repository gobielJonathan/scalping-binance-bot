# TradingView Lightweight Charts Integration

This document provides a comprehensive guide for the TradingView Lightweight Charts integration in the crypto trading bot UI.

## Overview

The chart integration includes three main chart components built with TradingView Lightweight Charts v5.1.0:

1. **TradingChart** - Multi-purpose price chart (candlestick, line, area)
2. **PnLChart** - Profit & Loss timeline visualization
3. **MarketChart** - Advanced candlestick charts with moving averages and volume

## Installation & Setup

All dependencies are already installed:

```bash
npm install lightweight-charts@^5.1.0
```

## Components

### TradingChart Component

Reusable chart wrapper for candlestick, line, and area charts.

**Usage:**
```vue
<script setup>
import { TradingChart } from '@/components/charts'
import type { OHLCV } from '@/types/api'

const chartData: OHLCV[] = [/* ... */]
</script>

<template>
  <trading-chart 
    symbol="BTC/USD"
    :data="chartData"
    :type="'candlestick'"
    interval="1h"
    height="400px"
    theme="dark"
    show-volume
    show-ma
    :ma-length="20"
    @ready="() => console.log('Chart ready')"
    @error="(error) => console.error(error)"
  />
</template>
```

**Props:**
- `symbol` (string): Trading pair symbol (e.g., 'BTC/USD')
- `data` (OHLCV[]): Candlestick data array
- `type` ('candlestick' | 'line' | 'area'): Chart type (default: 'candlestick')
- `interval` (string): Timeframe (1m, 5m, 15m, 1h, 4h, 1d)
- `height` (number | string): Chart height (default: 400px)
- `theme` ('dark' | 'light'): Color theme (default: 'dark')
- `showVolume` (boolean): Show volume histogram (default: true)
- `showMA` (boolean): Show moving averages (default: false)
- `maLength` (number): Moving average period (default: 20)
- `enableCrossHair` (boolean): Enable crosshair (default: true)
- `responsive` (boolean): Enable responsive resizing (default: true)

**Events:**
- `ready`: Emitted when chart is initialized
- `error`: Emitted on chart errors with error object

### PnLChart Component

Specialized for profit/loss visualization with time interval selection.

**Usage:**
```vue
<pnl-chart 
  :data="portfolioHistory"
  height="300px"
  theme="dark"
  interval="1D"
  show-watermark
  @intervalChange="(interval) => console.log(interval)"
  @error="(error) => console.error(error)"
/>
```

**Props:**
- `data` (Portfolio[]): Portfolio history data
- `currentPnL` (number): Current P&L value
- `height` (number | string): Chart height (default: 300px)
- `theme` ('dark' | 'light'): Color theme (default: 'dark')
- `interval` ('1H' | '1D' | '1W' | '1M'): Time range (default: '1D')
- `realtime` (boolean): Enable real-time updates (default: true)
- `showWatermark` (boolean): Show balance watermark (default: true)

**Events:**
- `ready`: Emitted when chart is initialized
- `error`: Emitted on chart errors
- `intervalChange`: Emitted when user changes time interval

**Features:**
- Area chart with positive/negative coloring
- Time interval selector (1H, 1D, 1W, 1M)
- Real-time P&L updates support
- Balance watermark display

### MarketChart Component

Advanced candlestick charts with technical indicators.

**Usage:**
```vue
<market-chart 
  symbol="ETH/USD"
  :data="marketData"
  interval="1h"
  height="500px"
  theme="dark"
  show-volume
  show-ma
  show-price
  @priceUpdate="(price) => console.log(price)"
  @error="(error) => console.error(error)"
/>
```

**Props:**
- `symbol` (string): Trading pair symbol
- `data` (OHLCV[]): Historical price data
- `currentPrice` (number): Current price
- `height` (number | string): Chart height (default: 500px)
- `theme` ('dark' | 'light'): Color theme (default: 'dark')
- `interval` (string): Timeframe
- `showVolume` (boolean): Show volume histogram (default: true)
- `showMA` (boolean): Show MA(20) and MA(50) (default: true)
- `enableCrossHair` (boolean): Enable crosshair (default: true)
- `showPrice` (boolean): Show price header (default: true)

**Events:**
- `ready`: Emitted when chart is initialized
- `error`: Emitted on chart errors
- `priceUpdate`: Emitted with latest price on data update

**Features:**
- Candlestick price visualization
- Volume histogram
- Moving averages (20 and 50)
- Price header with 24h high/low and volume
- Legend for indicators

## Services

### Chart Service (`src/services/chart.ts`)

Provides data transformation and configuration utilities.

**Key Methods:**
- `fetchHistoricalData(params)` - Fetch OHLCV data from API
- `transformCandlestickChartData(candles)` - Format for candlestick display
- `transformLineChartData(candles)` - Format for line charts
- `transformPnLData(data)` - Format P&L data
- `getChartTheme(themeName)` - Get theme configuration
- `getCandlestickSeriesOptions(theme)` - Candlestick styling
- `getDefaultChartOptions(width, height, theme)` - Chart defaults
- `validateChartData(data)` - Validate data integrity

**Themes:**
- `dark`: Professional dark trading theme
- `light`: Light theme for daytime use

### Chart Utilities (`src/utils/chart.ts`)

Helper functions for data formatting and manipulation.

**Data Transformation:**
- `transformOHLCVToChartData()` - OHLCV to chart format
- `transformCandlestickData()` - Candlestick with volume
- `transformPnLData()` - P&L time series
- `transformMovingAverageData()` - Moving average calculation
- `aggregateOHLCVData()` - Timeframe aggregation

**Formatting:**
- `formatPrice(price, precision)` - Price formatting
- `formatVolume(volume)` - Volume abbreviation
- `formatChartTime(timestamp, interval)` - Time formatting
- `formatPercentChange(value)` - Percentage formatting

**Calculations:**
- `calculateMovingAverage(prices, period)` - MA calculation
- `calculatePercentChange(current, previous)` - % change
- `getPnLColor(value)` - Color for P&L value

**Utilities:**
- `getChartDimensions(container)` - Container dimensions
- `getResponsiveChartHeight(container)` - Responsive sizing
- `debounce(func, wait)` - Debounce function
- `isValidOHLCVData(data)` - Validate OHLCV data

## API Integration

### Endpoint: `/api/market/candles`

Fetch historical OHLCV data.

**Parameters:**
- `symbol` (string): Trading pair (BTC/USD, ETH/USD, etc.)
- `interval` (string): Timeframe (1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w, 1M)
- `limit` (number): Number of candles (default: 500)
- `startTime` (number): Unix timestamp start (optional)
- `endTime` (number): Unix timestamp end (optional)

**Response:**
```typescript
interface OHLCV {
  time: number          // Unix timestamp
  open: number          // Opening price
  high: number          // Highest price
  low: number           // Lowest price
  close: number         // Closing price
  volume: number        // Trading volume
}
```

### WebSocket Events

Real-time data updates via Socket.IO:

**Event: `market-data`**
New candlestick data for subscribed symbols.

**Event: `portfolio-update`**
Portfolio P&L changes for PnL chart updates.

## Theme Configuration

### Dark Theme (Default)
```typescript
{
  backgroundColor: '#1a1a2e',
  textColor: '#e0e0e0',
  gridColor: '#2a2a3e',
  candleUpColor: '#26c281',      // Green
  candleDownColor: '#e74c3c',    // Red
  volumeUpColor: 'rgba(38, 194, 129, 0.3)',
  volumeDownColor: 'rgba(231, 76, 60, 0.3)',
  maColor: '#3498db',             // Blue
}
```

### Custom Theme
Create custom themes by extending the default configuration:

```typescript
const customTheme: ChartTheme = {
  backgroundColor: '#ffffff',
  textColor: '#333333',
  gridColor: '#e0e0e0',
  // ... other properties
}
```

## Data Format Requirements

### OHLCV Data Structure
```typescript
interface OHLCV {
  time: number          // Unix timestamp (seconds)
  open: number          // > 0
  high: number          // >= max(open, close)
  low: number           // <= min(open, close)
  close: number         // > 0
  volume: number        // >= 0
}
```

### Validation
All OHLCV data is validated with `isValidOHLCVData()`:
- All required fields must be numbers
- `high >= max(open, close)`
- `low <= min(open, close)`

### Portfolio Data Structure
```typescript
interface Portfolio {
  id: string
  totalBalance: number      // Total account balance
  equity: number            // Current equity
  pnl: number              // Profit & Loss
  pnlPercent: number       // P&L percentage
  updatedAt: string        // ISO timestamp
}
```

## Usage Examples

### Basic Candlestick Chart
```vue
<template>
  <trading-chart 
    symbol="BTC/USD"
    :data="chartData"
    type="candlestick"
    interval="1h"
    height="400px"
    show-volume
  />
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { TradingChart } from '@/components/charts'
import apiService from '@/services/api'

const chartData = ref([])

onMounted(async () => {
  const response = await apiService.getHistoricalData('BTC/USD', '1h', 500)
  if (response.success && Array.isArray(response.data)) {
    chartData.value = response.data
  }
})
</script>
```

### P&L Timeline with Real-Time Updates
```vue
<template>
  <pnl-chart 
    :data="portfolioHistory"
    interval="1D"
    @intervalChange="handleIntervalChange"
  />
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { PnLChart } from '@/components/charts'
import websocket from '@/services/websocket'

const portfolioHistory = ref([])

onMounted(() => {
  // Subscribe to portfolio updates
  websocket.on('portfolio:updated', (portfolio) => {
    portfolioHistory.value.push(portfolio)
  })
})

const handleIntervalChange = (interval) => {
  console.log('Time range changed to:', interval)
}
</script>
```

### Multi-Indicator Market Chart
```vue
<template>
  <market-chart 
    symbol="ETH/USD"
    :data="marketData"
    interval="4h"
    height="600px"
    show-volume
    show-ma
    show-price
    @priceUpdate="handlePriceUpdate"
  />
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { MarketChart } from '@/components/charts'
import apiService from '@/services/api'

const marketData = ref([])
const currentPrice = ref(0)

onMounted(async () => {
  const response = await apiService.getHistoricalData('ETH/USD', '4h', 500)
  if (response.success) {
    marketData.value = response.data
  }
})

const handlePriceUpdate = (price) => {
  currentPrice.value = price
}
</script>
```

## Performance Optimization

### Data Loading
- Load historical data in chunks (max 500-1000 candles per request)
- Implement pagination for large datasets
- Cache historical data locally when possible

### Chart Rendering
- Use debounced resize handlers (300ms delay)
- Lazy load charts when they come into viewport
- Implement virtual scrolling for multiple charts

### WebSocket
- Batch real-time updates (100ms debounce)
- Only update visible series
- Clean up subscriptions on component unmount

## Troubleshooting

### Chart Not Rendering
1. Verify container has defined height
2. Check data array is not empty
3. Validate OHLCV data structure
4. Check browser console for errors

### Performance Issues
1. Reduce number of visible candles
2. Disable MA calculation for large datasets
3. Use simpler chart type (line instead of candlestick)
4. Implement data pagination

### WebSocket Updates Not Working
1. Verify socket connection is active
2. Check event names match server implementation
3. Ensure component is properly subscribed
4. Monitor network tab for message delivery

## Browser Compatibility

TradingView Lightweight Charts requires:
- Modern browser with ES6+ support
- Canvas API support
- Window.requestAnimationFrame support

**Supported Browsers:**
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Further Resources

- [TradingView Lightweight Charts Docs](https://tradingview.github.io/lightweight-charts/)
- [Chart Types Guide](https://tradingview.github.io/lightweight-charts/docs/user-guide/chart-types)
- [Customization Guide](https://tradingview.github.io/lightweight-charts/docs/user-guide/customization)

## Contributing

When adding new chart features:
1. Update chart service with transformation methods
2. Add utilities to chart utils if needed
3. Create component in `src/components/charts/`
4. Document props and events
5. Add usage example to this README
6. Test with various data sizes and timeframes
