# Scalping Strategy Workflow

This document describes the complete workflow of the Binance scalping bot, from initialization through signal generation, order execution, and position management.

---

## 1. Bot Initialization

```mermaid
flowchart TD
    A([Bot Start]) --> B[Load Configuration\n.env / config/index.ts]
    B --> C[Instantiate Core Services\nScalpingStrategy · RiskManager\nOrderManager · DashboardService]
    C --> D[Connect to Binance API\nREST + WebSocket]
    D --> E{Pair Selection\nMode?}
    E -- static --> F[Use TRADING_PAIRS\nenv variable]
    E -- dynamic --> G[Fetch top N volatile pairs\nby 24 h volume filter]
    F --> H[Initialize MarketDataService\nWebSocket streams per pair]
    G --> H
    H --> I[Load Historical Candles\n5 m interval, last 500]
    I --> J{Dashboard\nEnabled?}
    J -- yes --> K[Start HTTP Server\ndefault port 3000]
    J -- no --> L
    K --> L([Enter Main Trading Loop])
```

---

## 2. Main Trading Loop (every 5 seconds)

```mermaid
flowchart TD
    START([Every 5 Seconds]) --> A[Update Market Data\nWebSocket candles & ticker]
    A --> B[Monitor Open Positions\nCheck SL / TP / time exits]
    B --> C[Iterate Through Trading Pairs]

    C --> D{More pairs\nto process?}
    D -- yes --> E[Fetch Current Candles\n& Ticker for Pair]
    E --> F[Generate Trading Signal\nScalpingStrategy.generateSignal]
    F --> G{Signal\nType?}
    G -- BUY or SELL --> H{Risk\nConstraints OK?}
    H -- yes --> I[Calculate Order Size\nposition sizing]
    I --> J[Execute Order\nOrderManager.executeOrder]
    J --> K[Register Position\nRiskManager portfolio]
    K --> D
    H -- no --> L[Skip pair\nlog rejection reason]
    L --> D
    G -- HOLD --> D

    D -- done --> M[Update Dashboard\nPortfolio · P&L · Metrics]
    M --> N[Check Daily Risk Limits]
    N --> O{Limit\nBreached?}
    O -- critical --> P[Emergency Stop\nClose All Positions]
    O -- warning --> Q[Reduce Position Sizes]
    O -- ok --> R([Wait 5 s → repeat])
    P --> R
    Q --> R
```

---

## 3. Signal Generation – Technical Indicator Analysis

```mermaid
flowchart TD
    A([generateSignal called\nwith last 500 candles]) --> B[Compute Technical Indicators]

    B --> B1[EMA 9 & EMA 21\ntrend direction]
    B --> B2[RSI 14\nmomentum / overbought / oversold]
    B --> B3[MACD 12-26-9\ntrend momentum divergence]
    B --> B4[Bollinger Bands 20 ± 2σ\nsupport / resistance / volatility]
    B --> B5[Volume Analysis\nvs 20-candle average]

    B1 & B2 & B3 & B4 & B5 --> C[Evaluate BUY Conditions\naccumulate strength & confidence]

    C --> C1{EMA-9 crosses\nabove EMA-21?}
    C1 -- yes → +30 str +25 conf --> D
    C1 -- EMA-9 > EMA-21 → +15 str +10 conf --> D

    C --> C2{RSI < 30\noversold bounce?}
    C2 -- yes → +25 str +20 conf --> D
    C2 -- RSI 30-40 → +15 str +10 conf --> D

    C --> C3{MACD > Signal\n& MACD < 0?}
    C3 -- bullish divergence → +20 str +15 conf --> D

    C --> C4{Price ≤ BB\nLower × 1.002?}
    C4 -- near support → +20 str +15 conf --> D

    C --> C5{Volume > 1.2×\naverage?}
    C5 -- confirmation → +10 str +10 conf --> D

    D{BUY strength ≥ 50\nAND confidence ≥ 40?}
    D -- yes --> SIGNAL_BUY([Signal: BUY])
    D -- no --> E[Evaluate SELL Conditions]

    E --> E1{EMA-9 crosses\nbelow EMA-21?}
    E1 -- yes → +30 str +25 conf --> F
    E1 -- EMA-9 < EMA-21 → +15 str +10 conf --> F

    E --> E2{RSI > 70\noverbought reversal?}
    E2 -- yes → +25 str +20 conf --> F
    E2 -- RSI 60-70 → +15 str +10 conf --> F

    E --> E3{MACD < Signal\n& MACD > 0?}
    E3 -- bearish divergence → +20 str +15 conf --> F

    E --> E4{Price ≥ BB\nUpper × 0.998?}
    E4 -- near resistance → +20 str +15 conf --> F

    E --> E5{Volume > 1.2×\naverage?}
    E5 -- confirmation → +10 str +10 conf --> F

    F{SELL strength ≥ 50\nAND confidence ≥ 40?}
    F -- yes --> SIGNAL_SELL([Signal: SELL])
    F -- no --> SIGNAL_HOLD([Signal: HOLD])
```

---

## 4. Order Execution

```mermaid
flowchart TD
    A([Signal: BUY or SELL]) --> B[Risk Gate\nRiskManager.canOpenTrade]

    B --> C{Checks}
    C --> C1{Emergency\nstop active?}
    C --> C2{Daily loss\nlimit exceeded?}
    C --> C3{Open positions\n< maxConcurrent 3?}
    C --> C4{Available balance\n≥ position value?}
    C --> C5{Total exposure\n≤ 60% portfolio?}

    C1 -- yes --> REJECT([Reject Order])
    C2 -- yes --> REJECT
    C3 -- no --> REJECT
    C4 -- no --> REJECT
    C5 -- yes / above --> REJECT

    C1 -- no --> OK
    C2 -- no --> OK
    C3 -- yes --> OK
    C4 -- yes --> OK
    C5 -- no / within limit --> OK

    OK[All checks passed] --> D[Calculate Order Size\nBalance × RiskPerTrade / StopLossDist\n× signalConfidence × signalStrength × 0.8]

    D --> E[Build Order Request\nsymbol · side · MARKET · quantity]

    E --> F{Trading\nMode?}
    F -- paper --> G[PaperTradingService\nSimulate slippage 2 bps + volume + vol\nSimulate fees 0.1%]
    F -- live --> H[BinanceService.placeOrder\nMARKET order\nWait for fill confirmation]

    G --> I[Create Position Object]
    H --> I

    I --> I1[entryPrice = filled price\nstopLoss  = entry ± 0.3%\ntakeProfit = entry ± 0.6%\nstatus = OPEN]

    I1 --> J[Register in Portfolio\nRiskManager.openPositions\nUpdate locked / available balance]

    J --> K{Live\ntrading?}
    K -- yes --> L[Place Stop-Loss Order\nBinance STOP_LOSS type]
    K -- no --> M
    L --> M[Save to Database\nBroadcast to Dashboard]
    M --> N([Position Open])
```

---

## 5. Position Monitoring & Exit Conditions

```mermaid
flowchart TD
    A([Every 5 s – for each open position]) --> B[Fetch Current Market Price]
    B --> C[Recalculate P&L\npnl = price diff × qty − fees]

    C --> D{Price gap\n> 2× stop distance\npast stop-loss?}
    D -- yes → flash crash --> X[Immediate Market Cut-Loss]

    D -- no --> E{Stop-Loss\nTriggered?}
    E -- BUY: price ≤ stopLoss\nSELL: price ≥ stopLoss --> X

    E -- no --> F{Take-Profit\nTriggered?}
    F -- BUY: price ≥ takeProfit\nSELL: price ≤ takeProfit --> Y[Close Position – Profit Locked]

    F -- no --> G{Scalping\nTime Exit?}
    G -- position > 5 min\nAND P&L > 0 --> Y
    G -- P&L > 0.7% --> Y
    G -- loss > stopLoss% safety net --> X

    G -- none met --> H([Continue Monitoring])

    X --> Z[Close Position Process]
    Y --> Z

    Z --> Z1[Execute Opposite MARKET Order\nBUY→SELL / SELL→BUY]
    Z1 --> Z2[Calculate Final P&L\nexitPrice − entryPrice × qty − totalFees]
    Z2 --> Z3[Update Portfolio Balance\navailableBalance += proceeds + pnl]
    Z3 --> Z4[Record Trade History\nUpdate win / loss metrics\nSharpe · drawdown · streak]
    Z4 --> Z5[Broadcast to Dashboard\nSave to Database]
    Z5 --> END([Position Closed])
```

---

## 6. Risk Management Overview

```mermaid
flowchart TD
    A([Risk Manager – continuous]) --> B[Track Portfolio State]

    B --> B1[Daily P&L\nvs dailyLossLimit 15%]
    B --> B2[Max Drawdown\nvs peak balance 25% limit]
    B --> B3[Open Exposure\n≤ 60% of portfolio]
    B --> B4[Position Count\n≤ maxConcurrentTrades 3]

    B1 --> C{Daily loss\n≥ 80% of limit?}
    C -- warning --> D[Reduce new position sizes]
    C -- critical ≥ 100% --> E[HALT new trades]

    B2 --> F{Drawdown\n≥ 80% of limit?}
    F -- warning --> D
    F -- critical ≥ 100% --> E

    E --> G[Emergency Stop\nClose ALL open positions\nImmediately]

    B --> H[Position Sizing Method\nVOLATILITY_ADJUSTED default]
    H --> H1[Base = Balance × 8% / StopDist]
    H1 --> H2[Scale by historical volatility\nlower volatility → larger size]
    H2 --> H3[Apply Kelly fraction 0.25\nfor conservative sizing]
    H3 --> H4[Cap: max 25% · min 0.1%\nof portfolio balance]
    H4 --> I([Optimal Position Size])

    B --> J[Daily Reset at start of day]
    J --> J1[Reset dailyPnL = 0\nReset loss limit counters\nRefresh performance metrics]
```

---

## 7. Complete End-to-End Architecture

```mermaid
flowchart LR
    subgraph BINANCE["Binance API"]
        REST[REST API\nOrder Placement]
        WS[WebSocket\nMarket Data Streams]
    end

    subgraph DATA["Data Layer"]
        MDS[MarketDataService\nCandles · Ticker · UserStream]
        TI[TechnicalIndicators\nEMA · RSI · MACD · BB · Volume]
        DB[(SQLite Database\ntrades · positions · metrics)]
    end

    subgraph STRATEGY["Strategy Layer"]
        SS[ScalpingStrategy\ngenerateSignal]
        SA[SignalAggregator\nmulti-strategy fusion]
        SV[SignalValidator\nquality gate]
    end

    subgraph EXECUTION["Execution Layer"]
        OM[OrderManager\nexecuteOrder · closePosition]
        PT[PaperTradingService\nslippage & fee simulation]
        EO[ExecutionOptimization\nslippage minimization]
    end

    subgraph RISK["Risk Layer"]
        RM[RiskManager\nportfolio · sizing · limits]
        ES[EmergencyStopService\nbreaker circuit]
    end

    subgraph MONITORING["Monitoring Layer"]
        DASH[Dashboard\nHTTP + WebSocket UI]
        LOG[Logger\nWinston]
        MON[MonitoringService\nalerts & health]
    end

    WS -->|real-time candles| MDS
    MDS -->|candle history| TI
    TI -->|indicator values| SS
    SS -->|BUY·SELL·HOLD signal| SA
    SA -->|aggregated signal| SV
    SV -->|validated signal| OM

    OM -->|risk gate| RM
    RM -->|approved size| OM
    OM -- paper --> PT
    OM -- live --> REST
    PT -->|simulated fill| RM
    REST -->|actual fill| RM

    RM -->|breach detected| ES
    ES -->|force close all| OM

    OM -->|trade events| DB
    OM -->|position updates| DASH
    RM -->|portfolio state| DASH
    SS -->|signal stream| DASH
    OM -->|execution log| LOG
    RM -->|risk log| LOG
    MON -->|health alerts| LOG
```

---

## Key Parameters Reference

| Parameter | Default | Purpose |
|---|---|---|
| EMA Short / Long | 9 / 21 | Trend direction crossover |
| RSI Period | 14 | Momentum; oversold < 30, overbought > 70 |
| MACD | 12-26-9 | Trend momentum & divergence |
| Bollinger Bands | 20 ± 2σ | Support / resistance / volatility |
| Volume Multiplier | 1.2× avg | Signal confirmation filter |
| Signal Threshold | strength ≥ 50, confidence ≥ 40 | Quality gate for execution |
| Stop Loss | 0.3% | Hard exit on adverse price move |
| Take Profit | 0.6% (1:2 R/R) | Profit target per trade |
| Risk Per Trade | 8% of capital | Position sizing limit |
| Max Concurrent Trades | 3 | Portfolio diversification |
| Max Total Exposure | 60% of portfolio | Risk concentration limit |
| Daily Loss Limit | 15% | Emergency brake |
| Max Drawdown | 25% from peak | Equity protection |
| Scalping Time Exit | 5 min + P&L > 0 | Time-based profit lock |
| Loop Interval | 5 seconds | Trade frequency |
| Candle Timeframe | 5 m | Analysis resolution |
