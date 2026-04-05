# Trading Dashboard Deployment Guide

## Production Build

### Prerequisites

- Node.js 20.19.0+ or 22.12.0+
- pnpm package manager
- Trading bot API server
- WebSocket server for real-time data

### Environment Configuration

#### Required Environment Variables

```bash
# API Configuration
VITE_API_BASE_URL=https://your-trading-api.com
VITE_WS_URL=wss://your-websocket.com

# Feature Flags
VITE_ENABLE_LOGGING=false
VITE_ENABLE_DEBUG=false
VITE_ENABLE_PWA=true
VITE_ENABLE_ANALYTICS=true

# Trading Configuration
VITE_DEFAULT_SYMBOLS=BTCUSDT,ETHUSDT,ADAUSDT
VITE_REFRESH_INTERVAL=30000
VITE_RECONNECT_ATTEMPTS=5
VITE_REQUEST_TIMEOUT=10000

# Security
VITE_CSP_NONCE=random-nonce-here
VITE_RATE_LIMIT_REQUESTS=100
VITE_RATE_LIMIT_WINDOW=60000
```

#### Production Environment File

Create `.env.production`:

```bash
VITE_API_BASE_URL=https://api.yourtradingbot.com
VITE_WS_URL=wss://ws.yourtradingbot.com
VITE_ENABLE_LOGGING=false
VITE_ENABLE_DEBUG=false
VITE_ENABLE_PWA=true
```

### Build Process

#### 1. Install Dependencies

```bash
pnpm install --frozen-lockfile
```

#### 2. Type Check

```bash
pnpm type-check
```

#### 3. Lint and Format

```bash
pnpm lint
pnpm format
```

#### 4. Run Tests

```bash
pnpm test:coverage
pnpm test:e2e
```

#### 5. Build for Production

```bash
pnpm build
```

The build output will be in the `dist/` directory.

### Build Optimization

#### Vite Configuration (vite.config.ts)

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  
  build: {
    target: 'es2020',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-vue': ['vue', 'pinia'],
          'vendor-ui': ['bootstrap', 'gsap'],
          'vendor-charts': ['lightweight-charts'],
          'vendor-socket': ['socket.io-client']
        }
      }
    },
    
    // Source maps for production debugging
    sourcemap: process.env.NODE_ENV === 'development',
    
    // Optimize bundle size
    chunkSizeWarningLimit: 1000
  },
  
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  
  // PWA configuration
  pwa: {
    registerType: 'autoUpdate',
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg}']
    }
  }
})
```

## Deployment Options

### 1. Static Hosting (Recommended)

#### Netlify

1. Build the project: `pnpm build`
2. Deploy the `dist/` folder
3. Configure redirects in `public/_redirects`:

```
/*    /index.html   200
/api/*  https://your-api.com/api/:splat  200
```

#### Vercel

```json
{
  "version": 2,
  "builds": [
    {
      "src": "package.json",
      "use": "@vercel/static-build"
    }
  ],
  "routes": [
    { "handle": "filesystem" },
    { "src": "/(.*)", "dest": "/index.html" }
  ]
}
```

#### GitHub Pages

```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest
    
    steps:
    - name: Checkout
      uses: actions/checkout@v3
      
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'
        cache: 'pnpm'
        
    - name: Install dependencies
      run: pnpm install --frozen-lockfile
      
    - name: Build
      run: pnpm build
      
    - name: Deploy to GitHub Pages
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./dist
```

### 2. Container Deployment

#### Dockerfile

```dockerfile
# Multi-stage build for smaller image
FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Production stage
FROM nginx:alpine

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

#### Nginx Configuration

```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;
    
    # Security headers
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";
    
    server {
        listen 80;
        server_name _;
        root /usr/share/nginx/html;
        index index.html;
        
        # Enable compression for static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
        
        # API proxy
        location /api/ {
            proxy_pass http://your-api-server:8080/api/;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
        
        # WebSocket proxy
        location /ws {
            proxy_pass http://your-ws-server:8080;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
        
        # Handle client-side routing
        location / {
            try_files $uri $uri/ /index.html;
        }
    }
}
```

#### Docker Compose

```yaml
version: '3.8'

services:
  trading-dashboard:
    build: .
    ports:
      - "80:80"
    environment:
      - NGINX_HOST=localhost
    depends_on:
      - api-server
      
  api-server:
    image: your-trading-api:latest
    ports:
      - "8080:8080"
    environment:
      - DATABASE_URL=postgresql://...
      - REDIS_URL=redis://...
      
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
```

### 3. CDN Configuration

#### CloudFlare Settings

```javascript
// cloudflare-workers.js
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    
    // Cache static assets
    if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$/)) {
      const cache = caches.default
      const cacheKey = new Request(url.toString(), request)
      
      let response = await cache.match(cacheKey)
      if (!response) {
        response = await fetch(request)
        if (response.ok) {
          const headers = new Headers(response.headers)
          headers.set('Cache-Control', 'public, max-age=31536000')
          response = new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers
          })
          ctx.waitUntil(cache.put(cacheKey, response.clone()))
        }
      }
      return response
    }
    
    return fetch(request)
  }
}
```

## Performance Optimization

### Bundle Analysis

```bash
# Analyze bundle size
pnpm build --analyze

# Visualize bundle with rollup-plugin-visualizer
pnpm add -D rollup-plugin-visualizer
```

### Optimization Checklist

#### JavaScript

- [x] Code splitting by routes and features
- [x] Tree shaking for unused code
- [x] Minification with esbuild
- [x] Modern browser targets (ES2020+)
- [x] Dynamic imports for large dependencies

#### CSS

- [x] Critical CSS inlining
- [x] CSS purging for unused styles
- [x] CSS minification
- [x] CSS compression

#### Images

- [x] WebP format for modern browsers
- [x] Lazy loading for images
- [x] Image optimization and compression
- [x] Responsive images with srcset

#### Caching

- [x] Long-term caching for static assets
- [x] Service Worker for offline caching
- [x] CDN configuration
- [x] Browser cache headers

### Performance Metrics

Target metrics for production:

- **Lighthouse Score**: 90+
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1
- **First Input Delay**: < 100ms

## Security Configuration

### Content Security Policy

```html
<meta http-equiv="Content-Security-Policy" 
      content="
        default-src 'self';
        script-src 'self' 'unsafe-inline' https://unpkg.com;
        style-src 'self' 'unsafe-inline';
        img-src 'self' data: https:;
        connect-src 'self' https://api.yourdomain.com wss://ws.yourdomain.com;
        font-src 'self' data:;
      ">
```

### Security Headers

```nginx
# Nginx security headers
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### Environment Security

```bash
# Never commit these to git
# .env.production.local
JWT_SECRET=your-secret-here
API_KEY=your-api-key-here
ENCRYPTION_KEY=your-encryption-key-here
```

## Monitoring and Logging

### Production Logging

```typescript
// logging.ts
interface LogLevel {
  error: 0
  warn: 1
  info: 2
  debug: 3
}

class Logger {
  private level: keyof LogLevel
  
  constructor(level: keyof LogLevel = 'info') {
    this.level = level
  }
  
  error(message: string, meta?: any) {
    if (this.shouldLog('error')) {
      console.error(`[ERROR] ${message}`, meta)
      // Send to error tracking service
      this.sendToErrorService('error', message, meta)
    }
  }
  
  private sendToErrorService(level: string, message: string, meta?: any) {
    // Implementation for error tracking (e.g., Sentry, LogRocket)
  }
}
```

### Error Tracking

```typescript
// error-tracking.ts
import * as Sentry from '@sentry/vue'

Sentry.init({
  app,
  dsn: process.env.VITE_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  beforeSend(event, hint) {
    // Filter out known issues
    if (event.exception) {
      const error = hint.originalException
      if (error?.message?.includes('Network Error')) {
        return null // Don't send network errors
      }
    }
    return event
  }
})
```

### Performance Monitoring

```typescript
// performance.ts
class PerformanceMonitor {
  static trackMetric(name: string, value: number, tags?: Record<string, string>) {
    // Send metrics to analytics service
    analytics.track('performance_metric', {
      metric_name: name,
      metric_value: value,
      ...tags
    })
  }
  
  static trackPageLoad() {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
    this.trackMetric('page_load_time', navigation.loadEventEnd - navigation.fetchStart)
  }
}
```

## Health Checks

### Application Health Check

```typescript
// health.ts
export async function healthCheck(): Promise<HealthStatus> {
  const checks = await Promise.allSettled([
    checkApiConnection(),
    checkWebSocketConnection(),
    checkLocalStorage(),
    checkCriticalServices()
  ])
  
  return {
    status: checks.every(check => check.status === 'fulfilled') ? 'healthy' : 'unhealthy',
    checks: checks.map((check, index) => ({
      name: ['api', 'websocket', 'storage', 'services'][index],
      status: check.status === 'fulfilled' ? 'pass' : 'fail',
      details: check.status === 'rejected' ? check.reason : undefined
    }))
  }
}
```

### Monitoring Endpoints

```nginx
# Health check endpoint
location /health {
    access_log off;
    return 200 "healthy\n";
    add_header Content-Type text/plain;
}

# Ready check endpoint
location /ready {
    access_log off;
    try_files /health.html =503;
}
```

## Scaling Considerations

### Horizontal Scaling

- Use CDN for global distribution
- Load balance multiple instances
- Configure session affinity if needed
- Implement graceful shutdowns

### Monitoring and Alerting

- Set up uptime monitoring
- Configure performance alerts
- Monitor error rates
- Track user experience metrics

### Backup Strategy

- Backup deployment artifacts
- Version control all configuration
- Document rollback procedures
- Test disaster recovery plans