# Public API & Socket Event Reference

This document lists all available REST API endpoints and socket events exposed by the Scalping Binance Bot dashboard server.

---

## Table of Contents

- [REST API Endpoints](#rest-api-endpoints)
  - [System](#system)
  - [Portfolio](#portfolio)
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

#### `GET /api/status` — Response

```json
{
  "trading": false,
  "mode": "paper",
  "pairs": ["BTCUSDT", "ETHUSDT"],
  "lastUpdate": 1712230920000
}
```

---

### Portfolio

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/portfolio` | Current portfolio snapshot (balance, PnL, open positions) |

#### `GET /api/portfolio` — Response

```json
{
  "totalBalance": 0,
  "availableBalance": 0,
  "dailyPnl": 0,
  "openPositions": []
}
```

---

### Paper Trading

> These endpoints are only available when `TRADING_MODE=paper` is set. They return `404` in live mode.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/paper-trading/metrics` | Simulated trading metrics (slippage, fees, accuracy, PnL) |
| `GET` | `/api/paper-trading/validation` | Validation accuracy report for the paper trading engine |
| `GET` | `/api/paper-trading/executions` | Execution history (fills, timing, success rate) |
| `POST` | `/api/paper-trading/reset` | Reset all paper trading statistics |
| `GET` | `/api/paper-trading/export` | Export paper trading data as JSON |

#### `GET /api/paper-trading/metrics` — Response

```json
{
  "totalSimulatedTrades": 0,
  "totalSimulatedVolume": 0,
  "averageSlippage": "0.00%",
  "totalSimulatedFees": 0,
  "executionAccuracy": "100.00%",
  "largestOrder": 0,
  "averageOrderSize": 0,
  "currentOpenPositions": 0,
  "totalPnl": 0,
  "dailyPnl": 0,
  "riskExposure": 0,
  "availableBalance": 0,
  "recentSlippage": 0
}
```

#### `GET /api/paper-trading/validation` — Response

```json
{
  "overallAccuracy": "95.2%",
  "slippageAccuracy": "93.8%",
  "feeAccuracy": "97.1%",
  "executionTimeAccuracy": "94.6%",
  "status": "EXCELLENT",
  "lastValidation": 1712230920000,
  "recommendations": []
}
```

#### `GET /api/paper-trading/executions` — Response

```json
{
  "executions": [],
  "totalExecutions": 0,
  "averageExecutionTime": 0,
  "successRate": 100
}
```

#### `POST /api/paper-trading/reset` — Response

```json
{ "message": "Paper trading statistics reset successfully" }
```

#### `GET /api/paper-trading/export` — Response

```json
{
  "exportData": {},
  "timestamp": 1712230920000,
  "format": "json"
}
```

---

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

Common query parameters accepted by most `GET` analytics endpoints:

| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | `number` | Start timestamp (Unix ms) |
| `endDate` | `number` | End timestamp (Unix ms) |
| `symbols` | `string` | Comma-separated list of trading pairs (e.g. `BTCUSDT,ETHUSDT`) |
| `mode` | `string` | `paper` (default) or `live` |

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/analytics/summary` | Condensed analytics summary for dashboard widgets |
| `GET` | `/api/analytics/report` | Full analytics report |
| `GET` | `/api/analytics/performance/symbol` | Performance breakdown by trading pair |
| `GET` | `/api/analytics/performance/time-of-day` | Performance breakdown by hour of day |
| `GET` | `/api/analytics/performance/day-of-week` | Performance breakdown by day of week |
| `GET` | `/api/analytics/drawdown` | Drawdown analysis |
| `GET` | `/api/analytics/streaks` | Win/loss streak analysis |
| `GET` | `/api/analytics/risk` | Risk metrics |
| `GET` | `/api/analytics/trends` | Market trend analysis |
| `GET` | `/api/analytics/trades` | Paginated trade history |
| `GET` | `/api/analytics/stats` | Quick statistics for dashboard widgets |
| `POST` | `/api/analytics/export` | Export analytics data to file |
| `DELETE` | `/api/analytics/cache` | Clear the analytics cache |

#### `GET /api/analytics/trades` — Additional Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | `number` | `100` | Page size |
| `offset` | `number` | `0` | Page offset |
| `sortBy` | `string` | `openTime` | Column to sort by |
| `sortOrder` | `string` | `DESC` | `ASC` or `DESC` |

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

---

### Manual Override

> All manual override `POST` endpoints require a `userId` field in the request body. The user must be in the authorized user list (`admin`, `trader1` by default). Unauthorized requests return `401`.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/manual/emergency-stop` | Immediately halt all trading activity |
| `POST` | `/api/manual/resume-trading` | Resume trading (requires admin or approval) |
| `POST` | `/api/manual/close-position` | Close a specific open position |
| `POST` | `/api/manual/close-all-positions` | Close all open positions |
| `POST` | `/api/manual/pause-trading` | Temporarily pause automatic trade execution |
| `POST` | `/api/manual/adjust-parameter` | Update a strategy parameter at runtime |
| `POST` | `/api/manual/update-threshold` | Update a risk threshold value |
| `POST` | `/api/manual/approve-command` | Approve a pending override command |
| `POST` | `/api/manual/reject-command` | Reject a pending override command |
| `GET` | `/api/manual/commands` | List all recorded override commands |
| `GET` | `/api/manual/parameters` | List current strategy parameters |
| `GET` | `/api/manual/thresholds` | List current risk thresholds |
| `GET` | `/api/manual/status` | Full system status snapshot |

#### `POST /api/manual/emergency-stop` — Request Body

```json
{
  "userId": "admin",
  "reason": "Unusual market volatility"
}
```

#### `POST /api/manual/resume-trading` — Request Body

```json
{
  "userId": "admin",
  "reason": "Market conditions normalized"
}
```

#### `POST /api/manual/close-position` — Request Body

```json
{
  "userId": "admin",
  "positionId": "pos_1712230920000",
  "reason": "Taking profits manually"
}
```

#### `POST /api/manual/close-all-positions` — Request Body

```json
{
  "userId": "admin",
  "reason": "End of trading session"
}
```

#### `POST /api/manual/pause-trading` — Request Body

```json
{
  "userId": "admin",
  "reason": "Scheduled maintenance"
}
```

#### `POST /api/manual/adjust-parameter` — Request Body

```json
{
  "userId": "admin",
  "parameter": "riskPerTrade",
  "value": 0.01
}
```

Available adjustable parameters:

| Parameter | Type | Range | Description |
|-----------|------|-------|-------------|
| `riskPerTrade` | `number` | 0.001 – 0.05 | Max risk per trade as a fraction of balance |
| `maxConcurrentTrades` | `number` | 1 – 20 | Maximum simultaneous open positions |
| `stopLossPercentage` | `number` | 0.005 – 0.1 | Stop loss percentage |
| `takeProfitPercentage` | `number` | 0.005 – 0.2 | Take profit percentage |
| `tradingEnabled` | `boolean` | — | Enable or disable automatic trading |

#### `POST /api/manual/update-threshold` — Request Body

```json
{
  "userId": "admin",
  "metric": "DAILY_LOSS",
  "threshold": -0.04
}
```

Available risk threshold metrics:

| Metric | Default Threshold | Action |
|--------|-------------------|--------|
| `DAILY_LOSS` | `-0.05` | `EMERGENCY_STOP` |
| `DRAWDOWN` | `-0.15` | `REDUCE_EXPOSURE` |
| `EXPOSURE` | `0.80` | `STOP_NEW_TRADES` |

---

## Socket Events (Socket.IO)

The dashboard uses **Socket.IO** over the same HTTP server. Connect to `ws://localhost:3000` (or the configured port).

### Client → Server

Events that a connected browser client can send to the server:

| Event | Payload | Description |
|-------|---------|-------------|
| `manual-control` | `{ action, user }` | Request a manual control action |
| `update-parameter` | `{ parameter, oldValue, newValue }` | Request a strategy parameter change |
| `emergency-stop` | `{ reason, user }` | Request an emergency stop |
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

#### `emergency-stop` Payload Example

```json
{
  "reason": "Manual stop requested",
  "user": "admin"
}
```

---

### Server → Client

Events broadcast by the server to connected clients:

| Event | Direction | Description |
|-------|-----------|-------------|
| `dashboard-data` | → single client | Initial full dashboard snapshot sent upon connection |
| `portfolio-update` | → all clients | Portfolio data changed (balance, positions, PnL) |
| `new-signal` | → all clients | A new trading signal was generated |
| `trade-executed` | → all clients | A trade order was executed |
| `market-data` | → all clients | Real-time market data update |
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
