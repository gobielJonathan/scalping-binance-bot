# Quick Start Guide - Trading Dashboard

## Installation Complete ✅

All dependencies are installed. Your trading dashboard is ready to build!

## 5-Minute Setup

### 1. Configure Environment (Optional)
Create `.env` file in project root:
```env
VITE_API_BASE_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
```

### 2. Start Development Server
```bash
pnpm dev
```
Opens http://localhost:5173

### 3. Connect to Trading Bot API
The WebSocket service is ready in `src/services/websocket.ts`. Initialize it in your component:

```typescript
import websocketService from '@/services/websocket'

export default {
  async setup() {
    // Connect to API
    await websocketService.connect()
    
    // Subscribe to portfolio updates
    websocketService.subscribe('portfolio:updated', (portfolio) => {
      console.log('Portfolio:', portfolio)
    })
  }
}
```

## Essential Files

| File | Purpose | Use When |
|------|---------|----------|
| `src/types/api.ts` | API data types | Building components that use trading data |
| `src/services/websocket.ts` | Real-time connection | Need live data from trading bot |
| `src/config/environment.ts` | Configuration | Need API endpoints or feature flags |

## Common Tasks

### Display Portfolio Data
```typescript
import { ref } from 'vue'
import websocketService from '@/services/websocket'
import type { Portfolio } from '@/types/api'

const portfolio = ref<Portfolio | null>(null)

websocketService.subscribe('portfolio:updated', (data) => {
  portfolio.value = data
})
```

### Place an Order
```typescript
websocketService.emitToServer('order:create', {
  symbol: 'BTC/USD',
  side: 'buy',
  type: 'market',
  quantity: 0.1,
})
```

### Get Trade History
```typescript
const trades = await websocketService.request('get:trades', {
  limit: 50,
  symbol: 'BTC/USD'
})
```

### Use Bootstrap Components
```vue
<template>
  <div class="container-fluid">
    <div class="row">
      <div class="col-md-8">
        <div class="card">
          <div class="card-body">
            <h5 class="card-title">Portfolio</h5>
            <p>Balance: {{ portfolio?.totalBalance }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import 'bootstrap/dist/css/bootstrap.css'
</script>
```

## Useful Commands

```bash
# Development
pnpm dev              # Start dev server on http://localhost:5173

# Building
pnpm build            # Production build
pnpm preview          # Preview production build locally

# Quality
pnpm run type-check   # Check TypeScript types
pnpm lint             # Run linting (oxlint + eslint)

# Formatting
pnpm run format       # Format code with oxfmt
```

## Trading Bot API Endpoints

All endpoints connect via WebSocket to `http://localhost:3000`

### Real-time Events (Subscribe)
- `portfolio:updated` - Balance/PnL changes
- `position:opened` - New position
- `position:updated` - Position changes
- `order:filled` - Order executed
- `trade:executed` - Trade completed
- `ticker:update` - Price updates
- `market:data` - Candlestick data

### Actions (Emit)
```typescript
// Create order
websocketService.emitToServer('order:create', {
  symbol: string
  side: 'buy' | 'sell'
  type: 'market' | 'limit'
  quantity: number
  price?: number
})

// Cancel order
websocketService.emitToServer('order:cancel', { orderId: string })

// Close position
websocketService.emitToServer('position:close', { positionId: string })
```

### Requests (Request-Response)
```typescript
// Get trades
const trades = await websocketService.request('get:trades', {
  limit: 50,
  offset: 0
})

// Get orders
const orders = await websocketService.request('get:orders', {
  status: 'open' // or 'all'
})

// Get positions
const positions = await websocketService.request('get:positions', {})

// Get market data
const candles = await websocketService.request('get:candles', {
  symbol: 'BTC/USD',
  interval: '1h',
  limit: 100
})
```

## Installed Libraries

### UI & Styling
- **bootstrap 5.3.8** - UI components
- **tailwind-merge** - CSS utilities
- **clsx** - Class name builder

### Charts
- **lightweight-charts** - Financial charts

### Animations
- **gsap** - Animation library
- **@vueuse/core** - Vue utilities (animations, watchers, etc.)

### State
- **pinia** - State management
- **vue** - Framework

### Real-time
- **socket.io-client** - WebSocket communication

## TypeScript Types

All API responses are typed. IntelliSense will show available fields:

```typescript
import type { Portfolio, Position, Order, Trade } from '@/types/api'

const portfolio: Portfolio = { ... }
const position: Position = { ... }
const order: Order = { ... }
const trade: Trade = { ... }
```

## Development Tips

1. **Use WebSocket Service Singleton**
   - It maintains connection across components
   - Subscribe once per component, unsubscribe on unmount

2. **Type Your Data**
   - Import types from `src/types/api.ts`
   - Get IDE autocomplete and type safety

3. **Handle Connection States**
   ```typescript
   const connected = ref(false)
   onMounted(async () => {
     try {
       await websocketService.connect()
       connected.value = true
     } catch (error) {
       console.error('Connection failed:', error)
     }
   })
   ```

4. **Clean Up Subscriptions**
   ```typescript
   onMounted(() => {
     const unsubscribe = websocketService.subscribe('event', handler)
     onBeforeUnmount(unsubscribe) // Cleanup
   })
   ```

5. **Enable Logging in Development**
   - Set `VITE_ENABLE_LOGGING=true` in `.env`
   - Check browser console for connection details

## Need Help?

- **Configuration**: See `src/config/environment.ts`
- **Service**: See `src/services/websocket.ts`
- **Types**: See `src/types/api.ts`
- **Setup Details**: See `SETUP_VERIFICATION.md`

## Next: Create Components

Now build your components! Start with:
1. Portfolio Dashboard
2. Order Placement Form
3. Trade History Table
4. Price Chart

Happy coding! 🚀
