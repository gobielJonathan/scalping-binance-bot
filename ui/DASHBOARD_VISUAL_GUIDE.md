# Dashboard Layout Visual Guide

## Component Hierarchy

```
App.vue (Theme CSS imported)
└── DashboardLayout.vue (Main Dashboard Container)
    └── DashboardGrid.vue (12-Column Bootstrap Grid)
        ├── WidgetContainer (Portfolio Summary - Full Width)
        │   └── Portfolio Metrics (4 cards showing balance, daily/weekly/monthly P&L)
        │
        ├── WidgetContainer (Price Chart - 8 columns)
        │   └── Chart Placeholder (400px height, ready for TradingView/Chart.js)
        │
        ├── WidgetContainer (Market Data - 4 columns)
        │   └── Price Tickers (BTC, ETH, SOL with live prices)
        │
        ├── WidgetContainer (Open Positions - 6 columns)
        │   └── Positions Table (Symbol, Qty, Entry Price, Current Price, P&L)
        │
        ├── WidgetContainer (Recent Trades - 6 columns)
        │   └── Trade History (Last 3 closed trades with P&L)
        │
        └── WidgetContainer (System Status - Full Width)
            └── Status Cards (API connection, latency, sync time, alerts)
```

## Desktop Layout (1200px+)

```
┌─────────────────────────────────────────────────────────────┐
│ Trading Dashboard                              [≡] [+ Trade] │
│ Real-time portfolio and market overview                      │
└─────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ Portfolio Summary                                          │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐     │
│ │ Balance  │ │ Daily P&L│ │Weekly P&L│ │Monthly P&L│     │
│ │$25,847.5 │ │ +$1,248  │ │ +$3,421  │ │ +$8,754   │     │
│ │          │ │  5.09%   │ │  15.32%  │ │  51.20%   │     │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘     │
└────────────────────────────────────────────────────────────┘

┌──────────────────────────────────┐ ┌────────────────────┐
│  Price Chart (2/3 width)         │ │ Market Data        │
│                                  │ │ ┌────────────────┐ │
│        [Chart Area]              │ │ │ BTC: $43,500   │ │
│        (400px height)            │ │ │ ↑ 2.35%        │ │
│                                  │ │ └────────────────┘ │
│                                  │ │ ┌────────────────┐ │
│                                  │ │ │ ETH: $2,350    │ │
│                                  │ │ │ ↑ 4.76%        │ │
│                                  │ │ └────────────────┘ │
│                                  │ │ ┌────────────────┐ │
│                                  │ │ │ SOL: $102      │ │
│                                  │ │ │ ↑ 7.37%        │ │
│                                  │ │ └────────────────┘ │
└──────────────────────────────────┘ └────────────────────┘

┌──────────────────────────────────┐ ┌────────────────────┐
│ Open Positions (1/2 width)       │ │ Recent Trades      │
│ ┌────┬────┬───────┬───────┬──┐  │ │ (1/2 width)       │
│ │Sym │Qty │Entry  │Current│P&L│  │ │ ┌──────────────┐ │
│ ├────┼────┼───────┼───────┼──┤  │ │ │ BTC/USD SELL │ │
│ │BTC │0.5 │42,000 │43,500 │..│  │ │ │ +$250 (5.2%) │ │
│ │ETH │5.0 │2,100  │2,350  │..│  │ │ └──────────────┘ │
│ │SOL │25  │95     │102    │..│  │ │ ┌──────────────┐ │
│ └────┴────┴───────┴───────┴──┘  │ │ │ BTC/USD SELL │ │
│                                  │ │ │ +$250 (5.2%) │ │
│                                  │ │ └──────────────┘ │
│                                  │ │ ┌──────────────┐ │
│                                  │ │ │ BTC/USD SELL │ │
│                                  │ │ │ +$250 (5.2%) │ │
│                                  │ │ └──────────────┘ │
└──────────────────────────────────┘ └────────────────────┘

┌────────────────────────────────────────────────────────────┐
│ System Status                                              │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────┐│
│ │ ● Connected│ │ ⚡ 45ms   │ │ 🔄 HH:MM:SS│ │ 🔔 2    ││
│ │ API        │ │ Latency    │ │ Last Sync  │ │ Alerts  ││
│ └────────────┘ └────────────┘ └────────────┘ └──────────┘│
└────────────────────────────────────────────────────────────┘
```

## Tablet Layout (768px-991px)

```
┌──────────────────────────┐
│ Trading Dashboard  [≡][+]│
└──────────────────────────┘

┌──────────────────────────┐
│ Portfolio Summary         │
│ ┌────────┐ ┌────────┐   │
│ │ Balance│ │Daily P&L│  │
│ └────────┘ └────────┘   │
│ ┌────────┐ ┌────────┐   │
│ │Weekly  │ │Monthly │   │
│ └────────┘ └────────┘   │
└──────────────────────────┘

┌──────────────────────────┐
│  Price Chart (Full)      │
│                          │
│                          │
└──────────────────────────┘

┌──────────────────────────┐
│ Market Data (Full)       │
│ ┌────────────────────┐  │
│ │ BTC: $43,500 ↑    │  │
│ └────────────────────┘  │
│ ┌────────────────────┐  │
│ │ ETH: $2,350 ↑     │  │
│ └────────────────────┘  │
│ ┌────────────────────┐  │
│ │ SOL: $102 ↑       │  │
│ └────────────────────┘  │
└──────────────────────────┘

┌──────────────────────────┐
│ Open Positions (Full)    │
│ ┌────┬────┬───────┬──┐  │
│ │Sym │Qty │Entry  │P&L│  │
│ │BTC │0.5 │42,000 │..│  │
│ └────┴────┴───────┴──┘  │
└──────────────────────────┘

┌──────────────────────────┐
│ Recent Trades (Full)     │
│ ┌────────────────────┐  │
│ │ BTC/USD: +$250    │  │
│ │ 1 hour ago (5.2%) │  │
│ └────────────────────┘  │
└──────────────────────────┘

┌──────────────────────────┐
│ System Status (Full)     │
│ ┌──────┐ ┌──────┐       │
│ │● 45ms│ │Last: │       │
│ └──────┘ └──────┘       │
└──────────────────────────┘
```

## Mobile Layout (576px-767px)

```
┌────────────────────┐
│ Dashboard [≡] [+] │
└────────────────────┘

[Portfolio Summary - stacked cards]
  Balance: $25,847.50
  Daily P&L: +$1,248 (5.09%)
  Weekly P&L: +$3,421 (15.32%)
  Monthly P&L: +$8,754 (51.20%)

[Price Chart - full width]

[Market Data - stacked]
  BTC: $43,500 ↑ 2.35%
  ETH: $2,350 ↑ 4.76%
  SOL: $102 ↑ 7.37%

[Open Positions - scrollable table]
  Sym  Qty  Entry Entry Current  P&L
  BTC  0.5  42k   43.5k  750
  ETH  5    2.1k  2.35k  1.25k
  SOL  25   95    102    175

[Recent Trades - stacked]
  BTC/USD SELL  +$250 (5.2%)
  [1 hour ago]
  
  BTC/USD SELL  +$250 (5.2%)
  [2 hours ago]

[System Status - stacked cards]
  API: ● Connected
  Latency: ⚡ 45ms
  Last Sync: 🔄 HH:MM:SS
  Alerts: 🔔 2
```

## Color Scheme Reference

### Backgrounds
```
Primary:    #0f1419  (Main background)
Secondary:  #1a1f29  (Widget backgrounds)
Tertiary:   #252d3a  (Section backgrounds)
Hover:      #2d3748  (Interactive states)
Border:     #323a47  (Subtle borders)
```

### Text Colors
```
Primary:    #f0f2f5  (Main text, headings)
Secondary:  #a0a6b2  (Labels, descriptions)
Tertiary:   #6e7684  (Muted, placeholder text)
```

### Trading Indicators
```
Profit:     #26c281  (Green - gains)
Loss:       #e74c3c  (Red - losses)
Neutral:    #3498db  (Blue - neutral data)
Warning:    #f39c12  (Orange - alerts)
```

## Responsive Behavior Details

### Portfolio Summary Widget
- **Desktop:** 4 cards in a row (25% each)
- **Tablet:** 2x2 grid (50% each)
- **Mobile:** Full width, stacked vertically
- **Extra Small:** Full width, single column

### Chart & Market Data
- **Desktop:** Chart 8/12, Market 4/12
- **Tablet:** Both full width, stacked
- **Mobile:** Full width, stacked
- **Extra Small:** Full width with reduced height

### Positions & Trades
- **Desktop:** Side by side (50% each)
- **Tablet:** Both full width, stacked
- **Mobile:** Full width, stacked
- **Extra Small:** Full width, optimized table scroll

### System Status
- **Desktop:** 4 cards in a row (25% each)
- **Tablet:** 2x2 grid (50% each)
- **Mobile:** Full width, stacked
- **Extra Small:** Full width, single column

## Widget Container Anatomy

```
┌─ widget-card ───────────────────────────────┐
│ ┌─ widget-header ─────────────────────────┐ │
│ │ ┌─ Title ───────┐  ┌─ Actions ────┐   │ │
│ │ │ Widget Title  │  │ [Icon] [icon]│   │ │
│ │ └───────────────┘  └───────────────┘   │ │
│ └─────────────────────────────────────────┘ │
│ ┌─ widget-content ────────────────────────┐ │
│ │ ┌─ widget-body ──────────────────────┐  │ │
│ │ │                                    │  │ │
│ │ │  [Main Content Area]               │  │ │
│ │ │  - Tables                          │  │ │
│ │ │  - Charts                          │  │ │
│ │ │  - Data Cards                      │  │ │
│ │ │                                    │  │ │
│ │ └────────────────────────────────────┘  │ │
│ └─────────────────────────────────────────┘ │
│ ┌─ widget-footer (optional) ──────────────┐ │
│ │ [Button] [Button]                       │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
 
[Loading Overlay - semi-transparent with spinner]
[Error Overlay - semi-transparent with error icon]
```

## CSS Grid Layout Formula

### 12-Column System
```
Col Span    Width       Use Case
────────────────────────────────────────
1 column    8.33%       Quarter widgets
2 columns   16.67%      Small cards
3 columns   25%         Status indicators
4 columns   33.33%      Market data
6 columns   50%         Positions, trades
8 columns   66.67%      Charts
12 columns  100%        Full width
```

### Responsive Adjustments
```
Desktop (1200px+):    span 1-12 columns
Tablet (768-991px):   adjust to 2-col grid
Mobile (576-767px):   convert to 1-column
Extra Small (<576px): optimize spacing
```

## Spacing & Typography Hierarchy

```
Heading Scale:
  h1: 2.5rem   (40px)  - Page title
  h2: 2rem     (32px)  - Section header
  h3: 1.5rem   (24px)  - Widget title
  h4: 1.25rem  (20px)  - Subsection
  h5: 1rem     (16px)  - Card title ← Widget headers use this
  h6: 0.875rem (14px)  - Small title

Data Values:
  Primary:     1.5rem (24px) - Large numbers
  Secondary:   1rem   (16px) - Regular data
  Label:       0.75rem (12px) - Uppercase labels

Body Text:
  Default:     0.875rem (14px) - Article/description text
  Small:       0.75rem  (12px) - Captions
  Tiny:        0.625rem (10px) - Helpers
```

## Interaction States

### Widget Card States
```
Normal:   #1a1f29 bg, #323a47 border
Hover:    #2d3748 bg, #3d4655 border, shadow increase
Active:   blue top border (3px), accent glow
Error:    red border, error bg overlay
Loading:  semi-transparent overlay, spinning indicator
Success:  green border, success indicators
```

### Data Value States
```
Profit:   #26c281 (green text)
Loss:     #e74c3c (red text)
Neutral:  #a0a6b2 (gray text)
Warning:  #f39c12 (orange text)
```

## Animation Effects

```
Fade In:      300ms ease-in-out (widgets loading)
Slide In:     300ms ease-out    (content entry)
Hover:        300ms ease        (card interactions)
Spin:         800ms infinite    (loading spinner)
Pulse:        2s infinite       (status indicators)
```

---

This visual guide helps developers understand the responsive layout structure, component nesting, and visual hierarchy of the trading dashboard.
