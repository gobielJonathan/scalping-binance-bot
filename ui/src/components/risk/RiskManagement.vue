<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { usePositionsStore, usePortfolioStore, useTradesStore } from '@/stores'
import WidgetContainer from '../layout/WidgetContainer.vue'
import type { Position } from '@/types/api'

interface RiskLimit {
  id: string
  name: string
  type: 'daily_loss' | 'position_size' | 'total_exposure' | 'drawdown' | 'correlation'
  value: number
  currentValue: number
  threshold: number
  enabled: boolean
  breached: boolean
}

interface PositionRisk {
  positionId: string
  symbol: string
  riskScore: number
  var: number // Value at Risk
  maxLoss: number
  correlation: number
  concentration: number
}

interface CorrelationMatrix {
  [symbol: string]: { [symbol: string]: number }
}

const positionsStore = usePositionsStore()
const portfolioStore = usePortfolioStore()
const tradesStore = useTradesStore()

// Local state
const selectedTab = ref<'overview' | 'limits' | 'calculator' | 'heatmap'>('overview')
const showAdvancedSettings = ref(false)

// Position size calculator
const calculator = ref({
  accountBalance: 10000,
  riskPercent: 2,
  entryPrice: 0,
  stopLoss: 0,
  symbol: 'BTC/USD'
})

// Risk limits configuration
const riskLimits = ref<RiskLimit[]>([
  {
    id: 'daily-loss',
    name: 'Daily Loss Limit',
    type: 'daily_loss',
    value: 500,
    currentValue: 0,
    threshold: 80,
    enabled: true,
    breached: false
  },
  {
    id: 'position-size',
    name: 'Max Position Size',
    type: 'position_size',
    value: 5000,
    currentValue: 0,
    threshold: 90,
    enabled: true,
    breached: false
  },
  {
    id: 'total-exposure',
    name: 'Total Exposure',
    type: 'total_exposure',
    value: 20000,
    currentValue: 0,
    threshold: 85,
    enabled: true,
    breached: false
  },
  {
    id: 'max-drawdown',
    name: 'Max Drawdown',
    type: 'drawdown',
    value: 10,
    currentValue: 0,
    threshold: 80,
    enabled: true,
    breached: false
  },
  {
    id: 'correlation',
    name: 'Correlation Limit',
    type: 'correlation',
    value: 0.8,
    currentValue: 0,
    threshold: 90,
    enabled: true,
    breached: false
  }
])

// Computed properties
const positions = computed(() => positionsStore.positions)
const portfolio = computed(() => portfolioStore.portfolio)
const totalExposure = computed(() => positionsStore.totalExposure)
const totalUnrealizedPnl = computed(() => positionsStore.totalUnrealizedPnl)

// Risk calculations
const overallRiskScore = computed(() => {
  const risks = positionRisks.value
  if (risks.length === 0) return 0
  
  const avgRisk = risks.reduce((sum, r) => sum + r.riskScore, 0) / risks.length
  const concentrationRisk = calculateConcentrationRisk()
  const correlationRisk = calculateCorrelationRisk()
  
  return Math.min(100, (avgRisk + concentrationRisk + correlationRisk) / 3)
})

const positionRisks = computed((): PositionRisk[] => {
  return positions.value.map(position => {
    const var95 = calculateVaR(position)
    const maxLoss = position.quantity * position.entryPrice * 0.1 // 10% max loss assumption
    const concentration = (position.quantity * position.currentPrice) / (portfolio.value?.totalBalance || 1)
    const correlation = calculateSymbolCorrelation(position.symbol)
    
    // Risk score based on multiple factors
    const riskScore = Math.min(100, (
      (Math.abs(position.pnlPercent) * 2) + // Current P&L impact
      (concentration * 100) + // Concentration risk
      (Math.abs(var95) / position.currentPrice * 100) + // VaR risk
      (correlation * 50) // Correlation risk
    ) / 4)
    
    return {
      positionId: position.id,
      symbol: position.symbol,
      riskScore,
      var: var95,
      maxLoss,
      correlation,
      concentration: concentration * 100
    }
  })
})

const correlationMatrix = computed((): CorrelationMatrix => {
  const symbols = [...new Set(positions.value.map(p => p.symbol))]
  const matrix: CorrelationMatrix = {}
  
  // Mock correlation data (would be calculated from historical price data)
  symbols.forEach(symbol1 => {
    matrix[symbol1] = {}
    symbols.forEach(symbol2 => {
      if (symbol1 === symbol2) {
        matrix[symbol1]![symbol2] = 1.0
      } else {
        // Mock correlations - in reality, calculate from price history
        const correlation = symbol1.includes('BTC') && symbol2.includes('BTC') ? 0.8 :
                          symbol1.includes('ETH') && symbol2.includes('ETH') ? 0.7 :
                          0.3 + Math.random() * 0.4
        matrix[symbol1]![symbol2] = correlation
      }
    })
  })
  
  return matrix
})

// Portfolio heat map data
const portfolioHeatmap = computed(() => {
  const symbols = positions.value.map(p => p.symbol)
  const uniqueSymbols = [...new Set(symbols)]
  
  return uniqueSymbols.map(symbol => {
    const symbolPositions = positions.value.filter(p => p.symbol === symbol)
    const totalValue = symbolPositions.reduce((sum, p) => sum + (p.quantity * p.currentPrice), 0)
    const totalPnl = symbolPositions.reduce((sum, p) => sum + p.pnl, 0)
    const pnlPercent = totalValue > 0 ? (totalPnl / totalValue) * 100 : 0
    
    const risk = positionRisks.value.find(r => r.symbol === symbol)
    
    return {
      symbol,
      value: totalValue,
      pnl: totalPnl,
      pnlPercent,
      riskScore: risk?.riskScore || 0,
      concentration: (totalValue / (portfolio.value?.totalBalance || 1)) * 100
    }
  })
})

// Position size calculator result
const calculatorResult = computed(() => {
  if (!calculator.value.entryPrice || !calculator.value.stopLoss || calculator.value.entryPrice === calculator.value.stopLoss) {
    return null
  }
  
  const riskAmount = (calculator.value.accountBalance * calculator.value.riskPercent) / 100
  const priceRisk = Math.abs(calculator.value.entryPrice - calculator.value.stopLoss)
  const positionSize = riskAmount / priceRisk
  const positionValue = positionSize * calculator.value.entryPrice
  const leverage = positionValue / riskAmount
  
  return {
    positionSize,
    positionValue,
    riskAmount,
    leverage,
    riskPercent: (riskAmount / calculator.value.accountBalance) * 100
  }
})

// Utility functions
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

const formatPercent = (value: number) => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

const formatNumber = (value: number, decimals: number = 2) => {
  return value.toFixed(decimals)
}

const calculateVaR = (position: Position, confidence: number = 0.95): number => {
  // Simplified VaR calculation - in reality, use historical simulation or Monte Carlo
  const volatility = 0.02 // Assume 2% daily volatility
  const zScore = confidence === 0.95 ? 1.645 : confidence === 0.99 ? 2.33 : 1.96
  const var95 = position.currentPrice * volatility * zScore
  return var95
}

const calculateConcentrationRisk = (): number => {
  if (!portfolio.value || positions.value.length === 0) return 0
  
  const totalBalance = portfolio.value.totalBalance
  const maxConcentration = Math.max(...positions.value.map(p => 
    (p.quantity * p.currentPrice) / totalBalance * 100
  ))
  
  // Risk increases exponentially with concentration
  return Math.min(100, Math.pow(maxConcentration / 20, 2) * 100)
}

const calculateCorrelationRisk = (): number => {
  if (positions.value.length < 2) return 0
  
  const correlations: number[] = []
  for (let i = 0; i < positions.value.length; i++) {
    for (let j = i + 1; j < positions.value.length; j++) {
      const symbol1 = positions.value[i]?.symbol
      const symbol2 = positions.value[j]?.symbol
      if (symbol1 && symbol2) {
        const correlation = correlationMatrix.value[symbol1]?.[symbol2] || 0
        correlations.push(Math.abs(correlation))
      }
    }
  }
  
  const avgCorrelation = correlations.length > 0 ? 
    correlations.reduce((sum, c) => sum + c, 0) / correlations.length : 0
  
  return avgCorrelation * 100
}

const calculateSymbolCorrelation = (symbol: string): number => {
  const otherSymbols = positions.value
    .filter(p => p.symbol !== symbol)
    .map(p => p.symbol)
  
  if (otherSymbols.length === 0) return 0
  
  const correlations = otherSymbols.map(otherSymbol => 
    Math.abs(correlationMatrix.value[symbol]?.[otherSymbol] || 0)
  )
  
  return correlations.reduce((sum, c) => sum + c, 0) / correlations.length
}

const getRiskColor = (riskScore: number): string => {
  if (riskScore < 25) return 'var(--trading-profit)'
  if (riskScore < 50) return 'var(--trading-accent-blue)'
  if (riskScore < 75) return 'var(--trading-warning)'
  return 'var(--trading-loss)'
}

const getRiskLevel = (riskScore: number): string => {
  if (riskScore < 25) return 'Low'
  if (riskScore < 50) return 'Medium'
  if (riskScore < 75) return 'High'
  return 'Critical'
}

const updateRiskLimit = (limitId: string, value: number) => {
  const limit = riskLimits.value.find(l => l.id === limitId)
  if (limit) {
    limit.value = value
    checkRiskLimits()
  }
}

const toggleRiskLimit = (limitId: string) => {
  const limit = riskLimits.value.find(l => l.id === limitId)
  if (limit) {
    limit.enabled = !limit.enabled
  }
}

const checkRiskLimits = () => {
  riskLimits.value.forEach(limit => {
    if (!limit.enabled) return
    
    switch (limit.type) {
      case 'daily_loss':
        const dailyPnl = tradesStore.totalPnl // Simplified - should be daily only
        limit.currentValue = Math.abs(Math.min(0, dailyPnl))
        break
      case 'position_size':
        const maxPosition = Math.max(...positions.value.map(p => p.quantity * p.currentPrice), 0)
        limit.currentValue = maxPosition
        break
      case 'total_exposure':
        limit.currentValue = totalExposure.value
        break
      case 'drawdown':
        const maxEquity = portfolio.value?.equity || 0
        const currentEquity = portfolio.value?.equity || 0
        const drawdown = maxEquity > 0 ? ((maxEquity - currentEquity) / maxEquity) * 100 : 0
        limit.currentValue = drawdown
        break
      case 'correlation':
        limit.currentValue = calculateCorrelationRisk() / 100
        break
    }
    
    const utilizationPercent = (limit.currentValue / limit.value) * 100
    limit.breached = utilizationPercent > limit.threshold
  })
}

// Actions
const selectTab = (tab: typeof selectedTab.value) => {
  selectedTab.value = tab
}

const resetCalculator = () => {
  calculator.value = {
    accountBalance: portfolio.value?.totalBalance || 10000,
    riskPercent: 2,
    entryPrice: 0,
    stopLoss: 0,
    symbol: 'BTC/USD'
  }
}

const applyCalculatorResult = () => {
  if (calculatorResult.value) {
    // This would typically place an order with the calculated size
    console.log('Apply calculator result:', calculatorResult.value)
  }
}

// Watch for changes and update risk limits
watch([positions, portfolio, () => tradesStore.totalPnl], checkRiskLimits, { deep: true })

// Initialize
onMounted(() => {
  checkRiskLimits()
  if (portfolio.value) {
    calculator.value.accountBalance = portfolio.value.totalBalance
  }
})
</script>

<template>
  <widget-container
    title="Risk Management"
    :loading="positionsStore.isLoading || portfolioStore.isLoading"
    :error="positionsStore.hasError || portfolioStore.hasError"
  >
    <template #header-actions>
      <div class="risk-summary">
        <div class="risk-indicator">
          <div 
            class="risk-gauge"
            :style="{ 
              background: `conic-gradient(${getRiskColor(overallRiskScore)} 0deg ${overallRiskScore * 3.6}deg, var(--trading-bg-secondary) ${overallRiskScore * 3.6}deg 360deg)`
            }"
          >
            <div class="risk-gauge-inner">
              <span class="risk-score">{{ Math.round(overallRiskScore) }}</span>
            </div>
          </div>
          <span class="risk-label">{{ getRiskLevel(overallRiskScore) }} Risk</span>
        </div>
      </div>
    </template>

    <div class="risk-management">
      <!-- Navigation Tabs -->
      <div class="risk-tabs">
        <button 
          :class="['tab', { active: selectedTab === 'overview' }]"
          @click="selectTab('overview')"
        >
          Overview
        </button>
        
        <button 
          :class="['tab', { active: selectedTab === 'limits' }]"
          @click="selectTab('limits')"
        >
          Risk Limits
        </button>
        
        <button 
          :class="['tab', { active: selectedTab === 'calculator' }]"
          @click="selectTab('calculator')"
        >
          Position Calculator
        </button>
        
        <button 
          :class="['tab', { active: selectedTab === 'heatmap' }]"
          @click="selectTab('heatmap')"
        >
          Portfolio Heatmap
        </button>
      </div>

      <!-- Overview Tab -->
      <div v-if="selectedTab === 'overview'" class="overview-content">
        <!-- Risk Metrics Grid -->
        <div class="risk-metrics-grid">
          <div class="risk-metric-card">
            <h5>Overall Risk Score</h5>
            <div class="metric-main">
              <span 
                class="metric-value large"
                :style="{ color: getRiskColor(overallRiskScore) }"
              >
                {{ Math.round(overallRiskScore) }}
              </span>
              <span class="metric-unit">/100</span>
            </div>
            <div class="metric-description">
              {{ getRiskLevel(overallRiskScore) }} risk level
            </div>
          </div>

          <div class="risk-metric-card">
            <h5>Total Exposure</h5>
            <div class="metric-main">
              <span class="metric-value">{{ formatCurrency(totalExposure) }}</span>
            </div>
            <div class="metric-description">
              {{ portfolio ? formatPercent((totalExposure / portfolio.totalBalance) * 100) : '0%' }} of balance
            </div>
          </div>

          <div class="risk-metric-card">
            <h5>Unrealized P&L</h5>
            <div class="metric-main">
              <span 
                :class="['metric-value', totalUnrealizedPnl >= 0 ? 'profit' : 'loss']"
              >
                {{ formatCurrency(totalUnrealizedPnl) }}
              </span>
            </div>
            <div class="metric-description">
              {{ portfolio ? formatPercent((totalUnrealizedPnl / portfolio.totalBalance) * 100) : '0%' }} of balance
            </div>
          </div>

          <div class="risk-metric-card">
            <h5>Open Positions</h5>
            <div class="metric-main">
              <span class="metric-value">{{ positions.length }}</span>
            </div>
            <div class="metric-description">
              {{ positions.filter(p => p.pnl < 0).length }} losing positions
            </div>
          </div>
        </div>

        <!-- Position Risk Table -->
        <div class="position-risks-section">
          <h4>Position Risk Analysis</h4>
          
          <div v-if="positionRisks.length === 0" class="empty-state">
            <div class="empty-icon">🏦</div>
            <p>No open positions to analyze</p>
          </div>

          <div v-else class="risk-table-container">
            <table class="risk-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th class="numeric">Risk Score</th>
                  <th class="numeric">VaR (95%)</th>
                  <th class="numeric">Concentration</th>
                  <th class="numeric">Correlation</th>
                  <th class="numeric">Max Loss</th>
                </tr>
              </thead>
              <tbody>
                <tr 
                  v-for="risk in positionRisks"
                  :key="risk.positionId"
                  class="risk-row"
                >
                  <td class="symbol-cell">
                    <div class="symbol-badge">{{ risk.symbol }}</div>
                  </td>
                  <td class="numeric">
                    <div class="risk-score-cell">
                      <span 
                        class="score"
                        :style="{ color: getRiskColor(risk.riskScore) }"
                      >
                        {{ Math.round(risk.riskScore) }}
                      </span>
                      <div 
                        class="score-bar"
                        :style="{ 
                          width: `${risk.riskScore}%`,
                          backgroundColor: getRiskColor(risk.riskScore)
                        }"
                      ></div>
                    </div>
                  </td>
                  <td class="numeric">{{ formatCurrency(risk.var) }}</td>
                  <td class="numeric">{{ formatPercent(risk.concentration) }}</td>
                  <td class="numeric">{{ formatPercent(risk.correlation * 100) }}</td>
                  <td class="numeric loss">{{ formatCurrency(risk.maxLoss) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Risk Limits Tab -->
      <div v-if="selectedTab === 'limits'" class="limits-content">
        <h4>Risk Limit Configuration</h4>
        
        <div class="limits-grid">
          <div 
            v-for="limit in riskLimits"
            :key="limit.id"
            :class="['limit-card', { breached: limit.breached, disabled: !limit.enabled }]"
          >
            <div class="limit-header">
              <div class="limit-info">
                <h5>{{ limit.name }}</h5>
                <label class="limit-toggle">
                  <input 
                    type="checkbox" 
                    :checked="limit.enabled"
                    @change="toggleRiskLimit(limit.id)"
                  >
                  <span class="toggle-slider"></span>
                </label>
              </div>
              
              <div v-if="limit.breached" class="breach-indicator">
                <span class="breach-icon">⚠️</span>
                BREACHED
              </div>
            </div>

            <div class="limit-progress">
              <div class="progress-header">
                <span class="current-value">
                  {{ limit.type.includes('percent') || limit.type === 'correlation' ? 
                      formatPercent(limit.currentValue * 100) : 
                      formatCurrency(limit.currentValue) }}
                </span>
                <span class="max-value">
                  / {{ limit.type.includes('percent') || limit.type === 'correlation' ? 
                        formatPercent(limit.value * 100) : 
                        formatCurrency(limit.value) }}
                </span>
              </div>
              
              <div class="progress-bar">
                <div 
                  class="progress-fill"
                  :style="{ 
                    width: `${Math.min(100, (limit.currentValue / limit.value) * 100)}%`,
                    backgroundColor: limit.breached ? 'var(--trading-loss)' : 
                                   (limit.currentValue / limit.value) * 100 > limit.threshold ? 'var(--trading-warning)' : 
                                   'var(--trading-profit)'
                  }"
                ></div>
                <div 
                  class="threshold-marker"
                  :style="{ left: `${limit.threshold}%` }"
                ></div>
              </div>
              
              <div class="progress-labels">
                <span class="usage-percent">
                  {{ Math.round((limit.currentValue / limit.value) * 100) }}% used
                </span>
                <span class="threshold-label">
                  {{ limit.threshold }}% threshold
                </span>
              </div>
            </div>

            <div class="limit-controls">
              <label>Limit Value</label>
              <input 
                type="number"
                :value="limit.value"
                @input="updateRiskLimit(limit.id, parseFloat(($event.target as HTMLInputElement).value))"
                class="limit-input"
                :step="limit.type === 'correlation' ? 0.1 : limit.type.includes('percent') ? 1 : 100"
              >
              
              <label>Alert Threshold (%)</label>
              <input 
                type="range"
                :value="limit.threshold"
                @input="limit.threshold = parseFloat(($event.target as HTMLInputElement).value)"
                min="0"
                max="100"
                step="5"
                class="threshold-slider"
              >
            </div>
          </div>
        </div>
      </div>

      <!-- Position Size Calculator Tab -->
      <div v-if="selectedTab === 'calculator'" class="calculator-content">
        <h4>Position Size Calculator</h4>
        
        <div class="calculator-grid">
          <div class="calculator-inputs">
            <h5>Input Parameters</h5>
            
            <div class="input-group">
              <label>Account Balance ($)</label>
              <input 
                v-model.number="calculator.accountBalance"
                type="number"
                step="100"
                min="0"
                class="calc-input"
              >
            </div>

            <div class="input-group">
              <label>Risk Per Trade (%)</label>
              <input 
                v-model.number="calculator.riskPercent"
                type="number"
                step="0.1"
                min="0"
                max="100"
                class="calc-input"
              >
            </div>

            <div class="input-group">
              <label>Symbol</label>
              <select v-model="calculator.symbol" class="calc-select">
                <option value="BTC/USD">BTC/USD</option>
                <option value="ETH/USD">ETH/USD</option>
                <option value="ADA/USD">ADA/USD</option>
                <option value="DOT/USD">DOT/USD</option>
              </select>
            </div>

            <div class="input-group">
              <label>Entry Price ($)</label>
              <input 
                v-model.number="calculator.entryPrice"
                type="number"
                step="0.01"
                min="0"
                class="calc-input"
              >
            </div>

            <div class="input-group">
              <label>Stop Loss ($)</label>
              <input 
                v-model.number="calculator.stopLoss"
                type="number"
                step="0.01"
                min="0"
                class="calc-input"
              >
            </div>

            <div class="calculator-actions">
              <button class="calc-btn secondary" @click="resetCalculator">
                Reset
              </button>
              <button 
                v-if="calculatorResult"
                class="calc-btn primary" 
                @click="applyCalculatorResult"
              >
                Apply Result
              </button>
            </div>
          </div>

          <div class="calculator-results">
            <h5>Calculated Results</h5>
            
            <div v-if="!calculatorResult" class="no-results">
              <p>Enter entry price and stop loss to calculate position size</p>
            </div>

            <div v-else class="results-grid">
              <div class="result-card">
                <div class="result-label">Position Size</div>
                <div class="result-value">{{ formatNumber(calculatorResult.positionSize, 6) }}</div>
                <div class="result-unit">{{ calculator.symbol.split('/')[0] }}</div>
              </div>

              <div class="result-card">
                <div class="result-label">Position Value</div>
                <div class="result-value">{{ formatCurrency(calculatorResult.positionValue) }}</div>
                <div class="result-unit">USD</div>
              </div>

              <div class="result-card">
                <div class="result-label">Risk Amount</div>
                <div class="result-value">{{ formatCurrency(calculatorResult.riskAmount) }}</div>
                <div class="result-unit">{{ formatPercent(calculatorResult.riskPercent) }} of balance</div>
              </div>

              <div class="result-card">
                <div class="result-label">Effective Leverage</div>
                <div class="result-value">{{ formatNumber(calculatorResult.leverage, 2) }}x</div>
                <div class="result-unit">Leverage ratio</div>
              </div>
            </div>

            <div v-if="calculatorResult" class="risk-warning">
              <div class="warning-header">⚠️ Risk Warning</div>
              <ul class="warning-list">
                <li>This calculation assumes the stop loss will be executed at the exact price specified</li>
                <li>Market gaps and slippage can result in larger losses than calculated</li>
                <li>Consider additional factors like correlation and market volatility</li>
                <li>Never risk more than you can afford to lose</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Portfolio Heatmap Tab -->
      <div v-if="selectedTab === 'heatmap'" class="heatmap-content">
        <h4>Portfolio Risk Heatmap</h4>
        
        <div v-if="portfolioHeatmap.length === 0" class="empty-state">
          <div class="empty-icon">🗺️</div>
          <p>No positions to display in heatmap</p>
        </div>

        <div v-else class="heatmap-container">
          <div class="heatmap-legend">
            <div class="legend-item">
              <div class="legend-color low-risk"></div>
              <span>Low Risk</span>
            </div>
            <div class="legend-item">
              <div class="legend-color medium-risk"></div>
              <span>Medium Risk</span>
            </div>
            <div class="legend-item">
              <div class="legend-color high-risk"></div>
              <span>High Risk</span>
            </div>
            <div class="legend-item">
              <div class="legend-color critical-risk"></div>
              <span>Critical Risk</span>
            </div>
          </div>

          <div class="heatmap-grid">
            <div 
              v-for="item in portfolioHeatmap"
              :key="item.symbol"
              class="heatmap-cell"
              :style="{ 
                backgroundColor: getRiskColor(item.riskScore),
                width: `${Math.max(120, Math.min(300, item.concentration * 10))}px`,
                height: `${Math.max(80, Math.min(200, item.concentration * 6))}px`
              }"
            >
              <div class="cell-content">
                <div class="cell-symbol">{{ item.symbol }}</div>
                <div class="cell-value">{{ formatCurrency(item.value) }}</div>
                <div class="cell-pnl" :class="item.pnl >= 0 ? 'profit' : 'loss'">
                  {{ formatCurrency(item.pnl) }}
                </div>
                <div class="cell-concentration">{{ formatPercent(item.concentration) }}</div>
                <div class="cell-risk">Risk: {{ Math.round(item.riskScore) }}</div>
              </div>
            </div>
          </div>

          <div class="heatmap-info">
            <div class="info-item">
              <span class="info-label">Cell size represents concentration in portfolio</span>
            </div>
            <div class="info-item">
              <span class="info-label">Color represents risk level</span>
            </div>
            <div class="info-item">
              <span class="info-label">Diversification score: {{ formatPercent(100 - calculateConcentrationRisk()) }}</span>
            </div>
          </div>
        </div>

        <!-- Correlation Matrix -->
        <div class="correlation-section">
          <h5>Symbol Correlation Matrix</h5>
          
          <div class="correlation-matrix">
            <table class="correlation-table">
              <thead>
                <tr>
                  <th></th>
                  <th v-for="symbol in Object.keys(correlationMatrix)" :key="symbol">
                    {{ symbol.split('/')[0] }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, symbol1) in correlationMatrix" :key="symbol1">
                  <td class="symbol-header">{{ symbol1.split('/')[0] }}</td>
                  <td 
                    v-for="(correlation, symbol2) in row" 
                    :key="symbol2"
                    class="correlation-cell"
                    :style="{ 
                      backgroundColor: `rgba(${correlation > 0.5 ? '231, 76, 60' : '38, 194, 129'}, ${Math.abs(correlation) * 0.7})`,
                      color: Math.abs(correlation) > 0.5 ? 'white' : 'var(--trading-text-primary)'
                    }"
                  >
                    {{ formatNumber(correlation, 2) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </widget-container>
</template>

<style scoped>
.risk-management {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-xl);
}

.risk-summary {
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-md);
}

.risk-indicator {
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-sm);
}

.risk-gauge {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 50%;
}

.risk-gauge-inner {
  position: absolute;
  top: 4px;
  left: 4px;
  right: 4px;
  bottom: 4px;
  background: var(--trading-bg-primary);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.risk-score {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--trading-text-primary);
}

.risk-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--trading-text-secondary);
}

.risk-tabs {
  display: flex;
  background: var(--trading-bg-tertiary);
  border-radius: var(--trading-radius-md);
  padding: var(--trading-spacing-xs);
  gap: var(--trading-spacing-xs);
}

.tab {
  flex: 1;
  padding: var(--trading-spacing-sm) var(--trading-spacing-md);
  background: none;
  border: none;
  border-radius: var(--trading-radius-sm);
  color: var(--trading-text-secondary);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}

.tab:hover {
  color: var(--trading-text-primary);
  background: var(--trading-bg-hover);
}

.tab.active {
  background: var(--trading-accent-blue);
  color: white;
}

.overview-content,
.limits-content,
.calculator-content,
.heatmap-content {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-xl);
}

.risk-metrics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--trading-spacing-lg);
}

.risk-metric-card {
  background: var(--trading-bg-tertiary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  padding: var(--trading-spacing-lg);
}

.risk-metric-card h5 {
  margin: 0 0 var(--trading-spacing-md) 0;
  color: var(--trading-text-secondary);
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metric-main {
  display: flex;
  align-items: baseline;
  gap: var(--trading-spacing-xs);
  margin-bottom: var(--trading-spacing-sm);
}

.metric-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--trading-text-primary);
}

.metric-value.large {
  font-size: 2rem;
}

.metric-value.profit {
  color: var(--trading-profit);
}

.metric-value.loss {
  color: var(--trading-loss);
}

.metric-unit {
  font-size: 1rem;
  color: var(--trading-text-tertiary);
  font-weight: 600;
}

.metric-description {
  font-size: 0.8rem;
  color: var(--trading-text-tertiary);
}

.position-risks-section h4 {
  margin: 0 0 var(--trading-spacing-lg) 0;
  color: var(--trading-text-primary);
  font-size: 1.1rem;
  font-weight: 600;
  padding-bottom: var(--trading-spacing-sm);
  border-bottom: 1px solid var(--trading-border);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--trading-spacing-xl);
  color: var(--trading-text-tertiary);
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: var(--trading-spacing-md);
  opacity: 0.5;
}

.empty-state p {
  margin: 0;
  font-size: 0.875rem;
}

.risk-table-container {
  overflow-x: auto;
  background: var(--trading-bg-tertiary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
}

.risk-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.risk-table thead {
  background: var(--trading-bg-secondary);
}

.risk-table th {
  padding: var(--trading-spacing-md);
  text-align: left;
  color: var(--trading-text-secondary);
  font-weight: 600;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 1px solid var(--trading-border);
}

.risk-table th.numeric {
  text-align: right;
}

.risk-row {
  border-bottom: 1px solid var(--trading-border);
  transition: background-color 0.2s ease;
}

.risk-row:hover {
  background: var(--trading-bg-hover);
}

.risk-table td {
  padding: var(--trading-spacing-md);
  color: var(--trading-text-primary);
}

.risk-table .numeric {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.risk-table .loss {
  color: var(--trading-loss);
}

.symbol-cell .symbol-badge {
  display: inline-block;
  padding: var(--trading-spacing-xs) var(--trading-spacing-md);
  background: linear-gradient(135deg, rgba(52, 152, 219, 0.1), rgba(52, 152, 219, 0.05));
  border: 1px solid rgba(52, 152, 219, 0.3);
  border-radius: var(--trading-radius-sm);
  font-weight: 700;
  font-size: 0.875rem;
}

.risk-score-cell {
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-sm);
}

.risk-score-cell .score {
  font-weight: 700;
  min-width: 30px;
}

.score-bar {
  height: 4px;
  border-radius: 2px;
  min-width: 20px;
  max-width: 40px;
}

.limits-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: var(--trading-spacing-lg);
}

.limit-card {
  background: var(--trading-bg-tertiary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  padding: var(--trading-spacing-lg);
  transition: all 0.2s ease;
}

.limit-card.breached {
  border-color: var(--trading-loss);
  background: linear-gradient(135deg, var(--trading-bg-tertiary), rgba(231, 76, 60, 0.05));
}

.limit-card.disabled {
  opacity: 0.6;
}

.limit-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--trading-spacing-lg);
}

.limit-info {
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-md);
}

.limit-card h5 {
  margin: 0;
  color: var(--trading-text-primary);
  font-size: 1rem;
  font-weight: 600;
}

.limit-toggle {
  position: relative;
  width: 44px;
  height: 24px;
}

.limit-toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--trading-bg-secondary);
  transition: 0.2s;
  border-radius: 24px;
  border: 1px solid var(--trading-border);
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 2px;
  bottom: 2px;
  background-color: var(--trading-text-tertiary);
  transition: 0.2s;
  border-radius: 50%;
}

.limit-toggle input:checked + .toggle-slider {
  background-color: var(--trading-accent-blue);
  border-color: var(--trading-accent-blue);
}

.limit-toggle input:checked + .toggle-slider:before {
  transform: translateX(20px);
  background-color: white;
}

.breach-indicator {
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-xs);
  color: var(--trading-loss);
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.breach-icon {
  font-size: 1rem;
}

.limit-progress {
  margin-bottom: var(--trading-spacing-lg);
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--trading-spacing-sm);
}

.current-value,
.max-value {
  font-size: 0.875rem;
  font-weight: 600;
}

.current-value {
  color: var(--trading-text-primary);
}

.max-value {
  color: var(--trading-text-secondary);
}

.progress-bar {
  position: relative;
  height: 8px;
  background: var(--trading-bg-secondary);
  border-radius: 4px;
  margin-bottom: var(--trading-spacing-sm);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.threshold-marker {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--trading-text-primary);
  opacity: 0.7;
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--trading-text-tertiary);
}

.limit-controls {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-sm);
}

.limit-controls label {
  font-size: 0.8rem;
  color: var(--trading-text-secondary);
  font-weight: 600;
}

.limit-input {
  padding: var(--trading-spacing-sm) var(--trading-spacing-md);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  background: var(--trading-bg-secondary);
  color: var(--trading-text-primary);
  font-size: 0.875rem;
}

.limit-input:focus {
  outline: none;
  border-color: var(--trading-accent-blue);
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.threshold-slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--trading-bg-secondary);
  outline: none;
  border: none;
  cursor: pointer;
}

.threshold-slider::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--trading-accent-blue);
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.calculator-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--trading-spacing-xl);
}

.calculator-inputs,
.calculator-results {
  background: var(--trading-bg-tertiary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  padding: var(--trading-spacing-xl);
}

.calculator-inputs h5,
.calculator-results h5 {
  margin: 0 0 var(--trading-spacing-lg) 0;
  color: var(--trading-text-primary);
  font-size: 1rem;
  font-weight: 600;
  padding-bottom: var(--trading-spacing-sm);
  border-bottom: 1px solid var(--trading-border);
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-xs);
  margin-bottom: var(--trading-spacing-lg);
}

.input-group label {
  font-size: 0.8rem;
  color: var(--trading-text-secondary);
  font-weight: 600;
}

.calc-input,
.calc-select {
  padding: var(--trading-spacing-sm) var(--trading-spacing-md);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  background: var(--trading-bg-secondary);
  color: var(--trading-text-primary);
  font-size: 0.875rem;
}

.calc-input:focus,
.calc-select:focus {
  outline: none;
  border-color: var(--trading-accent-blue);
  box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
}

.calculator-actions {
  display: flex;
  gap: var(--trading-spacing-md);
  margin-top: var(--trading-spacing-lg);
}

.calc-btn {
  flex: 1;
  padding: var(--trading-spacing-sm) var(--trading-spacing-lg);
  border-radius: var(--trading-radius-md);
  border: 1px solid;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.calc-btn.primary {
  background: linear-gradient(135deg, var(--trading-accent-blue), #2980b9);
  border-color: var(--trading-accent-blue);
  color: white;
}

.calc-btn.primary:hover {
  background: linear-gradient(135deg, #2980b9, #2471a3);
}

.calc-btn.secondary {
  background: var(--trading-bg-secondary);
  border-color: var(--trading-border);
  color: var(--trading-text-primary);
}

.calc-btn.secondary:hover {
  background: var(--trading-bg-hover);
  border-color: var(--trading-border-light);
}

.no-results {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--trading-spacing-xl);
  color: var(--trading-text-tertiary);
  font-size: 0.875rem;
  text-align: center;
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--trading-spacing-lg);
  margin-bottom: var(--trading-spacing-xl);
}

.result-card {
  background: var(--trading-bg-secondary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  padding: var(--trading-spacing-lg);
  text-align: center;
}

.result-label {
  font-size: 0.75rem;
  color: var(--trading-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--trading-spacing-xs);
}

.result-value {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--trading-text-primary);
  margin-bottom: var(--trading-spacing-xs);
}

.result-unit {
  font-size: 0.8rem;
  color: var(--trading-text-tertiary);
}

.risk-warning {
  background: rgba(243, 156, 18, 0.1);
  border: 1px solid rgba(243, 156, 18, 0.3);
  border-radius: var(--trading-radius-md);
  padding: var(--trading-spacing-lg);
}

.warning-header {
  color: var(--trading-warning);
  font-weight: 700;
  margin-bottom: var(--trading-spacing-md);
}

.warning-list {
  margin: 0;
  padding-left: var(--trading-spacing-lg);
  color: var(--trading-text-secondary);
  font-size: 0.8rem;
  line-height: 1.5;
}

.warning-list li {
  margin-bottom: var(--trading-spacing-xs);
}

.heatmap-legend {
  display: flex;
  justify-content: center;
  gap: var(--trading-spacing-lg);
  margin-bottom: var(--trading-spacing-xl);
  flex-wrap: wrap;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: var(--trading-spacing-sm);
}

.legend-color {
  width: 16px;
  height: 16px;
  border-radius: 2px;
}

.legend-color.low-risk {
  background: var(--trading-profit);
}

.legend-color.medium-risk {
  background: var(--trading-accent-blue);
}

.legend-color.high-risk {
  background: var(--trading-warning);
}

.legend-color.critical-risk {
  background: var(--trading-loss);
}

.legend-item span {
  font-size: 0.8rem;
  color: var(--trading-text-secondary);
}

.heatmap-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--trading-spacing-md);
  justify-content: center;
  margin-bottom: var(--trading-spacing-xl);
}

.heatmap-cell {
  border-radius: var(--trading-radius-md);
  padding: var(--trading-spacing-md);
  color: white;
  transition: all 0.2s ease;
  cursor: pointer;
  position: relative;
  overflow: hidden;
}

.heatmap-cell:hover {
  transform: scale(1.05);
  z-index: 10;
  box-shadow: var(--trading-shadow-lg);
}

.cell-content {
  display: flex;
  flex-direction: column;
  gap: var(--trading-spacing-xs);
  height: 100%;
  justify-content: center;
  text-align: center;
}

.cell-symbol {
  font-weight: 700;
  font-size: 0.9rem;
}

.cell-value,
.cell-pnl {
  font-size: 0.8rem;
  font-weight: 600;
}

.cell-concentration,
.cell-risk {
  font-size: 0.7rem;
  opacity: 0.9;
}

.heatmap-info {
  display: flex;
  justify-content: center;
  gap: var(--trading-spacing-xl);
  flex-wrap: wrap;
  padding: var(--trading-spacing-lg);
  background: var(--trading-bg-tertiary);
  border-radius: var(--trading-radius-md);
  margin-bottom: var(--trading-spacing-xl);
}

.info-item {
  display: flex;
  align-items: center;
}

.info-label {
  font-size: 0.8rem;
  color: var(--trading-text-secondary);
  text-align: center;
}

.correlation-section {
  background: var(--trading-bg-tertiary);
  border: 1px solid var(--trading-border);
  border-radius: var(--trading-radius-md);
  padding: var(--trading-spacing-xl);
}

.correlation-section h5 {
  margin: 0 0 var(--trading-spacing-lg) 0;
  color: var(--trading-text-primary);
  font-size: 1rem;
  font-weight: 600;
  padding-bottom: var(--trading-spacing-sm);
  border-bottom: 1px solid var(--trading-border);
}

.correlation-matrix {
  overflow-x: auto;
}

.correlation-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.8rem;
}

.correlation-table th,
.correlation-table td {
  padding: var(--trading-spacing-sm);
  text-align: center;
  border: 1px solid var(--trading-border);
  min-width: 60px;
}

.correlation-table th {
  background: var(--trading-bg-secondary);
  color: var(--trading-text-secondary);
  font-weight: 600;
}

.symbol-header {
  background: var(--trading-bg-secondary);
  color: var(--trading-text-secondary);
  font-weight: 600;
  text-align: center;
}

.correlation-cell {
  font-weight: 600;
  transition: all 0.2s ease;
}

.correlation-cell:hover {
  transform: scale(1.1);
  z-index: 10;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

/* Responsive design */
@media (max-width: 768px) {
  .calculator-grid {
    grid-template-columns: 1fr;
  }

  .results-grid {
    grid-template-columns: 1fr;
  }

  .risk-metrics-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .limits-grid {
    grid-template-columns: 1fr;
  }

  .heatmap-grid {
    justify-content: stretch;
  }

  .heatmap-cell {
    min-width: 100px !important;
    min-height: 60px !important;
    flex: 1;
  }

  .correlation-table {
    font-size: 0.7rem;
  }

  .correlation-table th,
  .correlation-table td {
    padding: var(--trading-spacing-xs);
    min-width: 40px;
  }
}

@media (max-width: 576px) {
  .risk-metrics-grid {
    grid-template-columns: 1fr;
  }

  .risk-tabs {
    flex-direction: column;
  }

  .tab {
    text-align: center;
  }

  .risk-summary {
    justify-content: center;
  }

  .heatmap-info {
    flex-direction: column;
    text-align: center;
  }

  .limit-header {
    flex-direction: column;
    gap: var(--trading-spacing-md);
    align-items: flex-start;
  }

  .calculator-actions {
    flex-direction: column;
  }
}
</style>