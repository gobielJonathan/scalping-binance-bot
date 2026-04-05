# Trading Dashboard

A modern, real-time cryptocurrency trading dashboard built with Vue 3, TypeScript, and TradingView charts. Features comprehensive portfolio management, position tracking, real-time market data, and professional trading interfaces.

## ✨ Features

- **🚀 Real-time Data**: Live portfolio, positions, and market data updates via WebSocket
- **📊 Advanced Charts**: TradingView Lightweight Charts with technical indicators
- **📱 Responsive Design**: Mobile-first design with PWA support
- **🎨 Professional UI**: Bootstrap 5 with custom dark theme
- **⚡ High Performance**: Optimized with code splitting and lazy loading
- **🛡️ Type Safety**: Full TypeScript implementation
- **🧪 Comprehensive Testing**: Unit, integration, and E2E tests
- **♿ Accessible**: WCAG 2.1 AA compliant

## 🏗️ Architecture

- **Frontend**: Vue 3 Composition API + TypeScript
- **State Management**: Pinia stores with real-time synchronization  
- **Styling**: Bootstrap 5 + CSS custom properties
- **Charts**: TradingView Lightweight Charts
- **Testing**: Vitest + Playwright
- **Build**: Vite with optimized bundling

## 📦 Quick Start

### Prerequisites

- Node.js 20.19.0+ or 22.12.0+
- pnpm package manager

### Development Setup

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env

# Start development server
pnpm dev
```

The dashboard will be available at `http://localhost:5173`

### Environment Configuration

Create `.env` file with your API endpoints:

```bash
# API Configuration
VITE_API_BASE_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080

# Feature Flags
VITE_ENABLE_LOGGING=true
VITE_ENABLE_DEBUG=true
VITE_ENABLE_PWA=true

# Trading Configuration
VITE_DEFAULT_SYMBOLS=BTCUSDT,ETHUSDT,ADAUSDT
VITE_REFRESH_INTERVAL=30000
```

## 🧪 Testing

### Run All Tests

```bash
# Unit and integration tests
pnpm test

# Unit tests with coverage
pnpm test:coverage

# E2E tests
pnpm test:e2e

# Run all tests
pnpm test:all
```

### Test Categories

- **Unit Tests**: Component logic and utilities
- **Integration Tests**: API services and store integration
- **E2E Tests**: Complete user workflows and cross-browser testing

## 🚀 Production Build

```bash
# Type check
pnpm type-check

# Lint and format
pnpm lint
pnpm format

# Build for production
pnpm build

# Preview production build
pnpm preview
```

## 🎨 Dashboard Widgets

### Portfolio Widget
- Real-time balance and P&L tracking
- Performance metrics and drawdown analysis
- Historical equity charts

### Positions Widget
- Active position monitoring
- Real-time P&L updates
- Position management actions

### Market Data Widget
- Live price feeds
- 24h change tracking
- Volume and volatility indicators

### Trading Chart
- TradingView integration
- Multiple timeframes
- Technical indicators
- Volume analysis

### Performance Widget
- Win rate and profit factor
- Risk metrics
- Trade statistics

### System Status Widget
- API connection status
- WebSocket connectivity
- Error monitoring

## 🔧 Development

### Available Scripts

```bash
pnpm dev              # Start development server
pnpm build            # Build for production
pnpm preview          # Preview production build
pnpm test             # Run unit tests
pnpm test:e2e         # Run E2E tests
pnpm test:coverage    # Run tests with coverage
pnpm lint             # Lint code
pnpm format           # Format code
pnpm type-check       # Type checking
```

### Code Standards

- **TypeScript**: Strict mode enabled
- **Vue 3**: Composition API with `<script setup>`
- **Testing**: Comprehensive test coverage required
- **Accessibility**: WCAG 2.1 AA compliance
- **Performance**: Core Web Vitals optimization

## 📚 Documentation

- [Component API Reference](./docs/components/API_REFERENCE.md)
- [Architecture Overview](./docs/developer/ARCHITECTURE.md)
- [Contributing Guide](./docs/developer/CONTRIBUTING.md)
- [Deployment Guide](./docs/deployment/PRODUCTION_DEPLOYMENT.md)
- [Troubleshooting](./docs/developer/TROUBLESHOOTING.md)

## 🌐 Browser Support

- **Desktop**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Mobile**: Chrome 90+, Safari 14+, Firefox 88+
- **Features**: Modern JavaScript (ES2020), CSS Grid, WebSocket, WebWorkers

## 📊 Performance

- **Bundle Size**: ~180KB gzipped (including TradingView)
- **First Load**: <1.5s on 3G
- **Lighthouse Score**: 95+ for Performance, Accessibility, SEO
- **Real-time Updates**: <100ms WebSocket latency

## 🛡️ Security

- Content Security Policy (CSP) headers
- XSS protection
- CSRF mitigation
- Secure WebSocket connections (WSS)
- Environment variable protection

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./docs/developer/CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch
3. Add comprehensive tests
4. Follow code standards
5. Submit a pull request

## 🆘 Support

- **Documentation**: Check the `docs/` directory
- **Issues**: Report bugs via GitHub Issues
- **Questions**: Use GitHub Discussions
- **Security**: Report security issues privately

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
pnpm install
```

### Compile and Hot-Reload for Development

```sh
pnpm dev
```

### Type-Check, Compile and Minify for Production

```sh
pnpm build
```

### Lint with [ESLint](https://eslint.org/)

```sh
pnpm lint
```
