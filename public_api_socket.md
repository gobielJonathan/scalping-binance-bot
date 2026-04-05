# Public API & Socket Event Reference

This document lists all available REST API endpoints and socket events exposed by the Scalping Binance Bot dashboard server.

---

## Table of Contents

- [REST API Endpoints](#rest-api-endpoints)
  - [System](#system)
  - [Portfolio](#portfolio)
  - [Market Data](#market-data)
  - [Paper Trading](#paper-trading)
  - [Performance](#performance)
  - [Analytics](#analytics)
  - [Manual Override](#manual-override)
- [Socket Events (Socket.IO)](#socket-events-socketio)
  - [Client → Server](#client--server)
  - [Server → Client](#server--client)
- [Binance WebSocket Streams](#binance-websocket-streams)
- [Internal EventEmitter Events](#internal-eventemitter-events)
- [Binance REST API Calls](#binance-rest-api-calls)

---

## REST API Endpoints

The dashboard HTTP server runs on port **3000** by default (configurable).

### System

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | Serve main dashboard HTML page |
| `GET` | `/control` | Serve manual control dashboard HTML page |
| `GET` | `/api/health` | Health check — returns server status, uptime, and timestamp |
| `GET` | `/api/status` | Trading status — returns trading flag, mode, pairs, and last update |

#### `GET /api/health` — Response

```json
{
  "status": "healthy",
  "timestamp": 1712230920000,
  "uptime": 3600.5
}
```


### Performance

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/performance/projections` | Performance projections based on the 1:2 risk-reward configuration |

#### `GET /api/performance/projections` — Response

```json
{
  "current": { },
  "comparison": { },
  "validation": { },
  "timestamp": 1712230920000
}
```

---

### Analytics

All analytics endpoints are prefixed with `/api/analytics`.  
Each request initialises `TradeAnalyticsService` and `DatabaseService` automatically; a `500` is returned if initialisation fails.

Common query parameters accepted by most `GET` analytics endpoints:

| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | `number` | Start timestamp (Unix ms) |
| `endDate` | `number` | End timestamp (Unix ms) |
| `symbols` | `string` | Comma-separated list of trading pairs (e.g. `BTCUSDT,ETHUSDT`) |
| `mode` | `string` | `paper` (default) or `live` |

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/analytics/summary` | Condensed analytics summary — top 3 insights and top 2 warnings |
| `GET` | `/api/analytics/report` | Full analytics report (all fields) |
| `GET` | `/api/analytics/performance/symbol` | Performance breakdown by trading symbol |
| `GET` | `/api/analytics/performance/time-of-day` | Performance breakdown by time of day |
| `GET` | `/api/analytics/performance/day-of-week` | Performance breakdown by day of week |
| `GET` | `/api/analytics/drawdown` | Drawdown analysis (`report.drawdown`) |
| `GET` | `/api/analytics/streaks` | Win/loss streak analysis (`report.streaks`) |
| `GET` | `/api/analytics/risk` | Risk metrics (`report.risk`) |
| `GET` | `/api/analytics/trends` | Trend analysis (`report.trends`) |
| `GET` | `/api/analytics/trades` | Trade history with analytics context (paginated) |
| `GET` | `/api/analytics/stats` | Quick statistics for dashboard widgets |
| `POST` | `/api/analytics/export` | Export analytics data to file |
| `DELETE` | `/api/analytics/cache` | Clear the analytics in-memory cache |

#### `GET /api/analytics/summary` — Response

```json
{
  "summary": { ... },
  "period": { ... },
  "insights": [ "...", "...", "..." ],
  "warnings": [ "...", "..." ],
  "generated": 1712230920000
}
```

#### `GET /api/analytics/trades` — Additional Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | `number` | `100` | Page size |
| `offset` | `number` | `0` | Page offset |
| `sortBy` | `string` | `openTime` | Column to sort by |
| `sortOrder` | `string` | `DESC` | `ASC` or `DESC` |

Each trade row includes computed fields: `outcome` (`WIN` / `LOSS` / `BREAKEVEN`), `pnlRounded`, `pnlPercentRounded`, `openTimeFormatted`, `closeTimeFormatted`, `durationHours`.

#### `GET /api/analytics/trades` — Response

```json
{
  "trades": [ { ... } ],
  "pagination": {
    "total": 250,
    "limit": 100,
    "offset": 0,
    "pages": 3
  }
}
```

#### `GET /api/analytics/stats` — Response

```json
{
  "total": {
    "trades": 250,
    "closedTrades": 240,
    "openTrades": 10,
    "uniqueSymbols": 5,
    "totalPnl": 1234.56,
    "totalFees": 12.34,
    "winRate": 62.5,
    "profitFactor": 1.8,
    "bestTrade": 150.0,
    "worstTrade": -80.0
  },
  "today": {
    "trades": 12,
    "pnl": 45.0,
    "wins": 8
  },
  "week": {
    "trades": 60,
    "pnl": 320.0
  }
}
```

#### `POST /api/analytics/export` — Request Body

```json
{
  "format": "json",
  "includeCharts": false,
  "dateRange": { "start": 0, "end": 0 },
  "symbols": ["BTCUSDT"],
  "groupBy": "day",
  "metrics": []
}
```

Supported `format` values: `json` | `csv` | `xlsx` | `pdf`

#### `POST /api/analytics/export` — Response

```json
{
  "success": true,
  "filePath": "/exports/analytics_2026-04-05.json",
  "format": "json",
  "generated": 1712230920000
}
```

#### `DELETE /api/analytics/cache` — Response

```json
{
  "success": true,
  "message": "Analytics cache cleared",
  "timestamp": 1712230920000
}
```


## Socket Events (Socket.IO)

The dashboard uses **Socket.IO** over the same HTTP server. Connect to `ws://localhost:3000` (or the configured port).

### Client → Server

Events that a connected browser client can send to the server:

| Event | Payload | Description |
|-------|---------|-------------|
| `manual-control` | `{ action, user }` | Request a manual control action |
| `update-parameter` | `{ parameter, oldValue, newValue }` | Request a strategy parameter change |
| `emergency-stop` | `{ reason, user }` | Request an emergency stop |
| `subscribe:ticker` | `{ symbol }` | Subscribe to real-time ticker updates for a symbol |
| `unsubscribe:ticker` | `{ symbol }` | Unsubscribe from ticker updates |
| `subscribe:candles` | `{ symbol, interval? }` | Subscribe to real-time candle updates (default interval: `5m`) |
| `unsubscribe:candles` | `{ symbol, interval? }` | Unsubscribe from candle updates |
| `disconnect` | — | Fires automatically when the client disconnects |

#### `manual-control` Payload Example

```json
{
  "action": "PAUSE_TRADING",
  "user": "admin"
}
```

#### `update-parameter` Payload Example

```json
{
  "parameter": "riskPerTrade",
  "oldValue": 0.01,
  "newValue": 0.005
}
```

#### `subscribe:ticker` Payload Example

```json
{ "symbol": "BTCUSDT" }
```

On subscribe the server immediately emits a `market:ticker` snapshot if data is available.

#### `subscribe:candles` Payload Example

```json
{ "symbol": "BTCUSDT", "interval": "5m" }
```

On subscribe the server immediately emits a `market:candles:snapshot` with up to 100 recent candles.



Events broadcast by the server to connected clients:

| Event | Direction | Description |
|-------|-----------|-------------|
| `dashboard-data` | → single client | Initial full dashboard snapshot sent upon connection |
| `portfolio-update` | → all clients | Portfolio data changed (balance, positions, PnL) |
| `new-signal` | → all clients | A new trading signal was generated |
| `trade-executed` | → all clients | A trade order was executed |
| `market-data` | → all clients | Real-time market data update (broadcast to all) |
| `market:ticker` | → subscribed room | Real-time ticker update for a specific symbol (room: `BTCUSDT`) |
| `market:candle` | → subscribed room | Real-time candle update for a symbol+interval (room: `BTCUSDT_5m`) |
| `market:candles:snapshot` | → requesting client | Full candle history snapshot sent on `subscribe:candles` |
| `market:metrics` | → all clients | Stream performance metrics (every 30 s) |
| `system-status` | → all clients | System status changed (e.g. emergency stop) |
| `system-update` | → all clients | Generic system update (e.g. manual control action) |
| `emergency-alert` | → all clients | Emergency alert broadcast |
| `manual-override` | → all clients | A manual override action was applied |
| `execution-metrics` | → all clients | Execution optimisation metrics |
| `manual-control-response` | → requesting client | Response to a `manual-control` event |
| `parameter-update-response` | → requesting client | Response to an `update-parameter` event |
| `emergency-stop-response` | → requesting client | Response to an `emergency-stop` event |

#### `dashboard-data` Payload Example

```json
{
  "portfolio": {
    "totalBalance": 10000,
    "availableBalance": 10000,
    "lockedBalance": 0,
    "totalPnl": 0,
    "totalPnlPercent": 0,
    "dailyPnl": 0,
    "dailyPnlPercent": 0,
    "openPositions": [],
    "riskExposure": 0,
    "maxDrawdown": 0
  },
  "activePositions": [],
  "recentSignals": [],
  "marketData": [],
  "performance": {
    "dailyPnl": 0,
    "weeklyPnl": 0,
    "monthlyPnl": 0,
    "totalTrades": 0,
    "winRate": 0
  }
}
```

#### `emergency-alert` Payload Example

```json
{
  "type": "EMERGENCY_STOP",
  "reason": "Daily loss limit reached",
  "triggeredBy": "system",
  "timestamp": 1712230920000
}
```

#### `system-update` Payload Example

```json
{
  "type": "MANUAL_CONTROL",
  "action": "PAUSE_TRADING",
  "user": "admin",
  "timestamp": 1712230920000
}
```

---

## Binance WebSocket Streams

The bot connects directly to Binance's WebSocket API for real-time market data.

Base URL: `wss://stream.binance.com:9443/ws/`  
Testnet URL: `wss://testnet.binance.vision/ws/`

| Stream Pattern | Description |
|----------------|-------------|
| `{symbol}@ticker` | 24-hour rolling price ticker for a symbol (e.g. `btcusdt@ticker`) |
| `{symbol}@kline_{interval}` | Candlestick stream at the given interval |
| User data stream | Order updates, trade fills, and account balance changes |

Supported kline intervals:

| Interval | Description |
|----------|-------------|
| `1m` | 1 minute |
| `3m` | 3 minutes |
| `5m` | 5 minutes |
| `15m` | 15 minutes |
| `30m` | 30 minutes |
| `1h` | 1 hour |
| `4h` | 4 hours |
| `1d` | 1 day |

WebSocket connection lifecycle events handled internally:

| Event | Description |
|-------|-------------|
| `open` | Connection established |
| `message` | Data frame received |
| `error` | Connection error |
| `close` | Connection closed (triggers automatic reconnect with exponential back-off) |

---

## Internal EventEmitter Events

These events are emitted internally between services and are not exposed over the network. They are documented here for developers integrating with the bot programmatically.

### MarketDataService Events

| Event | Payload | Description |
|-------|---------|-------------|
| `started` | — | Service started and streams are active |
| `stopped` | — | Service stopped and all streams closed |
| `candleUpdate` | `{ symbol, interval, candle, isClosed }` | A new candle tick arrived; `isClosed` indicates a completed bar |
| `marketDataUpdate` | `{ symbol, candle \| marketData, timestamp }` | Market data refreshed for a symbol |
| `performanceMetrics` | metrics object | Periodic stream performance statistics |
| `historicalDataRefreshed` | `{ symbol, interval, candles }` | Historical candle data (re)loaded |

### SignalMonitor Events

| Event | Payload | Description |
|-------|---------|-------------|
| `monitoring-started` | — | Signal monitor started |
| `monitoring-stopped` | — | Signal monitor stopped |
| `signal-tracked` | signal object | A new signal is now being tracked |
| `signal-updated` | signal object | An existing signal was updated |
| `signal-completed` | signal object | A tracked signal reached its final state |
| `signal-alert` | `{ type, signal }` | Alert raised for a tracked signal |
| `performance-updated` | metrics object | Signal performance metrics recalculated |
| `performance-alert` | alert object | A performance threshold was breached |

`signal-alert` type values: `large-adverse-move` | `exceeded-expected-move` | `strength-performance-mismatch`

### MonitoringService Events

| Event | Payload | Description |
|-------|---------|-------------|
| `metrics` | system metrics object | Periodic system resource metrics |
| `healthStatus` | health object | Overall system health status |
| `alert` | alert object | A system-level alert was raised |

---

## Binance REST API Calls

The following Binance REST API endpoints are called by `BinanceService`. All calls comply with Binance's rate limit of **1 200 requests per minute** and use the `binance-api-node` library under the hood.

Base URL (live): `https://api.binance.com`  
Base URL (testnet): `https://testnet.binance.vision`

### Account & Balance

| Method | Binance Endpoint | Service Method | Description |
|--------|-----------------|----------------|-------------|
| `GET` | `/api/v3/account` | `getAccountInfo()` | Full account information including commissions and permissions |
| `GET` | `/api/v3/account` | `getBalance(asset?)` | Asset balances; optionally filtered by asset symbol |

### Orders

| Method | Binance Endpoint | Service Method | Description |
|--------|-----------------|----------------|-------------|
| `GET` | `/api/v3/openOrders` | `getOpenOrders(symbol?)` | All open orders; optionally filtered by symbol |
| `POST` | `/api/v3/order` | `placeOrder(orderRequest)` | Place a new order |
| `DELETE` | `/api/v3/order` | `cancelOrder(symbol, orderId)` | Cancel an existing order |

Supported order types for `placeOrder`:

| Order Type | Description |
|------------|-------------|
| `LIMIT` | Limit order |
| `MARKET` | Market order |
| `STOP_LOSS` | Stop-loss order |
| `STOP_LOSS_LIMIT` | Stop-loss limit order |
| `TAKE_PROFIT` | Take-profit order |
| `TAKE_PROFIT_LIMIT` | Take-profit limit order |

### Market Data

| Method | Binance Endpoint | Service Method | Description |
|--------|-----------------|----------------|-------------|
| `GET` | `/api/v3/exchangeInfo` | `getSymbolInfo(symbol?)` | Exchange and symbol trading rules |
| `GET` | `/api/v3/klines` | `getKlines(symbol, interval, limit?)` | Historical candlestick data (default limit: 500) |
| `GET` | `/api/v3/ticker/24hr` | `getPrice(symbol?)` | 24-hour price change statistics |

### Connectivity

| Method | Binance Endpoint | Service Method | Description |
|--------|-----------------|----------------|-------------|
| `GET` | `/api/v3/ping` | `testConnection()` | Test API connectivity |
| `GET` | `/api/v3/time` | `getServerTime()` | Binance server time |

### WebSocket Stream Methods

| Service Method | Binance Stream | Description |
|----------------|---------------|-------------|
| `startPriceStream(symbols, callback)` | `{symbol}@ticker` | Subscribe to live ticker for one or more symbols |
| `startKlineStream(symbol, interval, callback)` | `{symbol}@kline_{interval}` | Subscribe to live candlestick stream |
| `startUserDataStream(callback)` | User data stream | Subscribe to account order and balance events |
| `disconnect()` | — | Close all active WebSocket connections |
