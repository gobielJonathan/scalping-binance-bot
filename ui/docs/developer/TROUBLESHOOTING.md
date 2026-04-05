# Trading Dashboard Troubleshooting Guide

## Common Issues and Solutions

### Development Issues

#### 1. Dependencies Installation Failed

**Problem**: `pnpm install` fails with peer dependency warnings or errors

**Solutions**:
```bash
# Clear pnpm cache and reinstall
pnpm store prune
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Force resolve peer dependencies
pnpm install --force

# Use specific Node.js version
nvm use 20.19.0
pnpm install
```

#### 2. TypeScript Compilation Errors

**Problem**: Type checking fails with unknown types or imports

**Solutions**:
```bash
# Restart TypeScript server
# In VS Code: Cmd+Shift+P -> "TypeScript: Restart TS Server"

# Check TypeScript configuration
pnpm type-check

# Clear TypeScript cache
rm -rf node_modules/.cache
pnpm install
```

#### 3. Vite Development Server Issues

**Problem**: Hot reload not working or server won't start

**Solutions**:
```bash
# Clear Vite cache
rm -rf node_modules/.vite
pnpm dev

# Use different port
pnpm dev --port 3001

# Check for port conflicts
lsof -ti:5173
kill -9 <PID>
```

### Testing Issues

#### 1. Vitest Tests Failing

**Problem**: Tests fail with import errors or module not found

**Solutions**:
```bash
# Check test configuration
cat vitest.config.ts

# Run tests with verbose output
pnpm test --verbose

# Clear test cache
pnpm test --no-cache

# Fix common test issues
```

Common test fixes:
```typescript
// Mock external dependencies
vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => ({
    addAreaSeries: vi.fn(),
    resize: vi.fn(),
    remove: vi.fn()
  }))
}))

// Fix async test timing
await wrapper.vm.$nextTick()
await waitFor(100)
```

#### 2. E2E Tests Failing

**Problem**: Playwright tests timeout or fail to connect

**Solutions**:
```bash
# Install browsers
pnpm playwright install

# Run with headed mode for debugging
pnpm test:e2e:headed

# Check test configuration
cat playwright.config.ts

# Run specific test
pnpm playwright test dashboard.spec.ts
```

### Build Issues

#### 1. Production Build Fails

**Problem**: `pnpm build` fails with TypeScript or bundle errors

**Solutions**:
```bash
# Check TypeScript errors
pnpm type-check

# Build with verbose output
pnpm build --debug

# Check for circular dependencies
npx madge --circular --extensions ts,vue src/

# Analyze bundle size
pnpm build --analyze
```

#### 2. Large Bundle Size

**Problem**: Bundle size exceeds limits or performs poorly

**Solutions**:
```typescript
// vite.config.ts - optimize chunks
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-vue': ['vue', 'pinia'],
          'vendor-charts': ['lightweight-charts'],
          'vendor-utils': ['gsap', 'class-variance-authority']
        }
      }
    }
  }
})
```

Check bundle analysis:
```bash
pnpm build --analyze
# Open dist/stats.html to analyze bundle
```

### Runtime Issues

#### 1. WebSocket Connection Problems

**Problem**: Real-time data not updating or connection fails

**Solutions**:
```typescript
// Check WebSocket configuration
const wsUrl = import.meta.env.VITE_WS_URL
console.log('WebSocket URL:', wsUrl)

// Verify connection status
webSocketService.getStatus() // should return 'connected'

// Enable debug logging
localStorage.setItem('debug', 'websocket:*')
```

**Debugging steps**:
1. Check network tab in browser DevTools
2. Verify WebSocket URL is correct
3. Check CORS settings on server
4. Test with WebSocket testing tools

#### 2. API Request Failures

**Problem**: HTTP requests fail with network or CORS errors

**Solutions**:
```typescript
// Check API configuration
const apiUrl = import.meta.env.VITE_API_BASE_URL
console.log('API URL:', apiUrl)

// Enable request logging
apiService.enableLogging(true)

// Check for CORS issues
// Verify server allows origin: http://localhost:5173
```

**Common fixes**:
```typescript
// Add request interceptor for debugging
apiService.addRequestInterceptor((config) => {
  console.log('Request:', config)
  return config
})

apiService.addResponseInterceptor(
  (response) => {
    console.log('Response:', response)
    return response
  },
  (error) => {
    console.error('API Error:', error)
    return Promise.reject(error)
  }
)
```

#### 3. Performance Issues

**Problem**: Dashboard is slow or unresponsive

**Solutions**:

1. **Check for memory leaks**:
```javascript
// Monitor memory usage
const observer = new PerformanceObserver((list) => {
  console.log(list.getEntries())
})
observer.observe({entryTypes: ['memory']})

// Check for unmounted event listeners
window.addEventListener('beforeunload', () => {
  console.log('Event listeners:', getEventListeners(window))
})
```

2. **Optimize component updates**:
```vue
<script setup lang="ts">
// Use computed for expensive calculations
const expensiveValue = computed(() => {
  return heavyCalculation(props.data)
})

// Debounce frequent updates
const debouncedUpdate = useDebounceFn(() => {
  updateData()
}, 300)
</script>
```

3. **Profile component rendering**:
```typescript
// Enable Vue DevTools performance tab
app.config.performance = true
```

#### 4. Chart Rendering Issues

**Problem**: TradingView charts not displaying or rendering incorrectly

**Solutions**:

1. **Check container dimensions**:
```typescript
// Ensure chart container has dimensions
const container = ref<HTMLElement>()

onMounted(() => {
  if (container.value) {
    const { width, height } = container.value.getBoundingClientRect()
    console.log('Chart container size:', { width, height })
    
    if (width === 0 || height === 0) {
      console.error('Chart container has no dimensions')
    }
  }
})
```

2. **Handle resize events**:
```typescript
// Proper chart resize handling
const resizeObserver = new ResizeObserver(entries => {
  for (const entry of entries) {
    const { width, height } = entry.contentRect
    chart.resize(width, height)
  }
})

onMounted(() => {
  if (container.value) {
    resizeObserver.observe(container.value)
  }
})

onUnmounted(() => {
  resizeObserver.disconnect()
  chart.remove()
})
```

### Styling Issues

#### 1. CSS Not Loading or Incorrect

**Problem**: Styles not applying or Bootstrap classes not working

**Solutions**:
```typescript
// Check CSS imports in main.ts
import 'bootstrap/dist/css/bootstrap.min.css'
import '@/styles/global.css'

// Verify CSS custom properties
:root {
  --primary-color: #007bff;
  /* Check if variables are defined */
}

// Use browser DevTools to inspect styles
```

#### 2. Dark Mode Not Working

**Problem**: Theme switching doesn't work or styles incorrect

**Solutions**:
```typescript
// Check theme application
const isDark = useDark()
const toggleTheme = useToggle(isDark)

// Verify data attribute
document.documentElement.getAttribute('data-theme')

// Check CSS theme selectors
[data-theme="dark"] {
  --bg-primary: #1a1d29;
  /* Verify dark theme variables */
}
```

## Error Messages and Solutions

### Common Error Messages

#### "Module not found: Can't resolve '@/'"

**Solution**: Check path alias configuration in `vite.config.ts`:
```typescript
resolve: {
  alias: {
    '@': fileURLToPath(new URL('./src', import.meta.url))
  }
}
```

#### "Cannot find module 'vue' or its corresponding type declarations"

**Solution**: 
```bash
pnpm install vue@latest
pnpm install -D @vue/tsconfig
```

#### "WebSocket connection to 'ws://localhost:8080' failed"

**Solutions**:
1. Verify WebSocket server is running
2. Check firewall settings
3. Update WebSocket URL in environment variables

#### "Failed to fetch dynamically imported module"

**Solution**: Clear browser cache and rebuild:
```bash
pnpm build
# Clear browser cache (Cmd+Shift+R)
```

### Browser-Specific Issues

#### Safari Issues

1. **WebSocket connection fails**:
```typescript
// Add specific Safari handling
if (navigator.userAgent.includes('Safari')) {
  websocketOptions.transports = ['websocket']
}
```

2. **CSS custom properties not working**:
```css
/* Provide fallbacks for Safari */
.widget {
  background: #ffffff; /* fallback */
  background: var(--widget-bg, #ffffff);
}
```

#### Mobile Browser Issues

1. **Touch events not working**:
```typescript
// Add touch event support
element.addEventListener('touchstart', handleTouch, { passive: true })
```

2. **Viewport issues**:
```html
<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
```

## Debug Tools and Techniques

### Vue DevTools

1. Install Vue DevTools browser extension
2. Enable in development:
```typescript
// main.ts
if (process.env.NODE_ENV === 'development') {
  app.config.devtools = true
}
```

### Performance Monitoring

```typescript
// Add performance monitoring
const observer = new PerformanceObserver((list) => {
  list.getEntries().forEach((entry) => {
    if (entry.entryType === 'navigation') {
      console.log('Page load time:', entry.duration)
    }
  })
})

observer.observe({ entryTypes: ['navigation', 'paint'] })
```

### Network Debugging

```typescript
// Monitor all fetch requests
const originalFetch = window.fetch
window.fetch = async (...args) => {
  console.log('Fetch:', args[0])
  const response = await originalFetch(...args)
  console.log('Response:', response.status, response.statusText)
  return response
}
```

### State Debugging

```typescript
// Add Pinia debugging
const store = usePortfolioStore()

// Watch for state changes
watch(() => store.$state, (newState) => {
  console.log('Store state changed:', newState)
}, { deep: true })
```

## Getting Help

### Log Collection

When reporting issues, include:

1. **Browser information**:
```javascript
console.log({
  userAgent: navigator.userAgent,
  viewport: { width: window.innerWidth, height: window.innerHeight },
  timestamp: new Date().toISOString()
})
```

2. **Application state**:
```javascript
// Export current state for debugging
const debugInfo = {
  route: router.currentRoute.value,
  stores: {
    portfolio: portfolioStore.$state,
    positions: positionsStore.$state
  },
  config: {
    apiUrl: import.meta.env.VITE_API_BASE_URL,
    wsUrl: import.meta.env.VITE_WS_URL
  }
}
console.log('Debug info:', debugInfo)
```

3. **Console errors**:
```javascript
// Capture console errors
window.addEventListener('error', (event) => {
  console.error('Global error:', event.error)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason)
})
```

### Creating Bug Reports

Include the following in bug reports:

1. **Steps to reproduce**
2. **Expected behavior**
3. **Actual behavior**
4. **Environment details** (browser, OS, Node.js version)
5. **Console errors**
6. **Screenshots/videos** if applicable
7. **Debug information** from above

### Support Channels

- GitHub Issues: For bug reports and feature requests
- GitHub Discussions: For questions and general help
- Documentation: Check docs/ directory for detailed guides
- Code review: Request review for complex issues