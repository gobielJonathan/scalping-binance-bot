import { 
  AdvancedMarketAnalysisService,
  MultiTimeframeAnalyzer 
} from '../services';
import {
  VolatilityAnalyzer,
  VolumeAnalyzer,
  PatternRecognizer
} from '../utils';
import { Candle, TradingSignal } from '../types';

/**
 * Example implementation showing how to use the advanced market analysis features
 */
export class AdvancedTradingStrategy {
  private advancedAnalysis: AdvancedMarketAnalysisService;
  private multiTimeframeAnalyzer: MultiTimeframeAnalyzer;
  private volatilityAnalyzer: VolatilityAnalyzer;
  private volumeAnalyzer: VolumeAnalyzer;
  private patternRecognizer: PatternRecognizer;

  constructor() {
    this.advancedAnalysis = new AdvancedMarketAnalysisService();
    this.multiTimeframeAnalyzer = new MultiTimeframeAnalyzer();
    this.volatilityAnalyzer = new VolatilityAnalyzer();
    this.volumeAnalyzer = new VolumeAnalyzer();
    this.patternRecognizer = new PatternRecognizer();
  }

  /**
   * Generate enhanced trading signals using all advanced analysis modules
   */
  public generateAdvancedSignal(
    candleData: { [timeframe: string]: Candle[] },
    symbol: string
  ): TradingSignal {
    try {
      // Perform comprehensive market analysis
      const analysis = this.advancedAnalysis.analyzeMarket(candleData, symbol);

      console.log('=== Advanced Market Analysis Results ===');
      console.log(`Symbol: ${symbol}`);
      console.log(`Market Environment: ${analysis.marketConditions.environment}`);
      console.log(`Trading Opportunity: ${analysis.marketConditions.tradingOpportunity}`);
      console.log(`Overall Confidence: ${analysis.confidence}%`);

      // Log multi-timeframe analysis
      console.log('\n--- Multi-Timeframe Analysis ---');
      console.log(`Combined Signal: ${analysis.multiTimeframe.combinedSignal.type} (${analysis.multiTimeframe.combinedSignal.strength}%)`);
      console.log(`Timeframe Alignment - Bullish: ${(analysis.multiTimeframe.alignment.bullish * 100).toFixed(1)}%, Bearish: ${(analysis.multiTimeframe.alignment.bearish * 100).toFixed(1)}%`);
      console.log(`Strongest Timeframe: ${analysis.multiTimeframe.strongestTimeframe}`);

      // Log volatility analysis
      console.log('\n--- Volatility Analysis ---');
      console.log(`Market Regime: ${analysis.volatility.regime.type} (${analysis.volatility.regime.strength}% strength)`);
      console.log(`Volatility Ratio: ${analysis.volatility.metrics.volatilityRatio.toFixed(2)}x`);
      console.log(`Recommended Action: ${analysis.volatility.strategy.recommendedAction}`);
      
      if (analysis.volatility.alerts.length > 0) {
        console.log('Volatility Alerts:', analysis.volatility.alerts);
      }

      // Log volume analysis
      console.log('\n--- Volume Analysis ---');
      console.log(`Volume Ratio (20): ${analysis.volume.metrics.volumeRatio20.toFixed(2)}x`);
      console.log(`Volume Trend: ${analysis.volume.metrics.volumeTrend}`);
      console.log(`Price-Volume Relationship: ${analysis.volume.priceAnalysis.trendValidation}`);
      
      if (analysis.volume.anomalies.length > 0) {
        console.log(`Volume Anomalies Detected: ${analysis.volume.anomalies.length}`);
        analysis.volume.anomalies.forEach(anomaly => {
          console.log(`  - ${anomaly.type}: ${anomaly.description} (${anomaly.severity})`);
        });
      }

      // Log pattern analysis
      console.log('\n--- Pattern Analysis ---');
      console.log(`Market Structure: ${analysis.patterns.marketStructure.trend} (${analysis.patterns.marketStructure.trendStrength}% strength)`);
      
      if (analysis.patterns.candlestick.length > 0) {
        console.log('Candlestick Patterns:');
        analysis.patterns.candlestick.forEach(pattern => {
          console.log(`  - ${pattern.name}: ${pattern.tradingSignal} (${pattern.confidence}% confidence)`);
        });
      }

      if (analysis.patterns.supportResistance.length > 0) {
        console.log('Key Levels:');
        analysis.patterns.supportResistance.slice(0, 3).forEach(level => {
          console.log(`  - ${level.type.toUpperCase()} at ${level.price.toFixed(4)} (${level.strength} strength, ${level.priceDistance.toFixed(2)}% away)`);
        });
      }

      // Log risk metrics
      console.log('\n--- Risk Management ---');
      console.log(`Recommended Position Size: ${(analysis.riskMetrics.volatilityAdjustedSize * 100).toFixed(0)}%`);
      console.log(`Stop Loss: ${analysis.riskMetrics.recommendedStopLoss.toFixed(2)}%`);
      console.log(`Take Profit: ${analysis.riskMetrics.recommendedTakeProfit.toFixed(2)}%`);
      console.log(`Max Risk: ${analysis.riskMetrics.maxRisk.toFixed(2)}%`);

      // Get recommendations
      const recommendations = this.advancedAnalysis.getAdvancedRecommendations(analysis);
      console.log('\n--- Trading Recommendations ---');
      recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });

      return analysis.combinedSignal;

    } catch (error) {
      console.error('Error in advanced signal generation:', error);
      
      // Fallback to basic signal if advanced analysis fails
      const basicSignal: TradingSignal = {
        type: 'HOLD',
        strength: 0,
        confidence: 0,
        reason: 'Advanced analysis failed, using safe default',
        timestamp: Date.now(),
        indicators: {} as any
      };
      
      return basicSignal;
    }
  }

  /**
   * Enhance an existing signal with advanced analysis
   */
  public enhanceExistingSignal(
    originalSignal: TradingSignal,
    candleData: { [timeframe: string]: Candle[] },
    symbol: string
  ): TradingSignal {
    try {
      const enhancement = this.advancedAnalysis.enhanceSignal(originalSignal, candleData, symbol);

      console.log('\n=== Signal Enhancement Results ===');
      console.log(`Original Signal: ${originalSignal.type} (${originalSignal.strength}% strength, ${originalSignal.confidence}% confidence)`);
      console.log(`Enhanced Signal: ${enhancement.enhancedSignal.type} (${enhancement.enhancedSignal.strength}% strength, ${enhancement.enhancedSignal.confidence}% confidence)`);
      console.log(`Signal Reliability: ${enhancement.reliability}%`);
      
      if (enhancement.enhancements.length > 0) {
        console.log('Applied Enhancements:');
        enhancement.enhancements.forEach((enhancement, index) => {
          console.log(`  ${index + 1}. ${enhancement}`);
        });
      }

      return enhancement.enhancedSignal;

    } catch (error) {
      console.error('Error in signal enhancement:', error);
      return originalSignal; // Return original if enhancement fails
    }
  }

  /**
   * Analyze individual modules for detailed insights
   */
  public analyzeIndividualModules(candleData: { [timeframe: string]: Candle[] }, symbol: string): void {
    const candles = candleData['1m'] || candleData['3m'] || candleData['5m'];
    
    if (!candles || candles.length < 100) {
      console.error('Insufficient candle data for individual module analysis');
      return;
    }

    console.log('\n=== Individual Module Analysis ===');

    try {
      // Multi-timeframe analysis
      console.log('\n1. Multi-Timeframe Analysis:');
      const mtfAnalysis = this.multiTimeframeAnalyzer.analyze(candleData, symbol);
      console.log(`   Alignment Score: Bullish ${(mtfAnalysis.alignment.bullish * 100).toFixed(1)}%, Bearish ${(mtfAnalysis.alignment.bearish * 100).toFixed(1)}%`);
      console.log(`   Is Aligned: ${this.multiTimeframeAnalyzer.isTimeframeAlignment(mtfAnalysis)}`);
      
      const recommendations = this.multiTimeframeAnalyzer.getTimeframeRecommendations(mtfAnalysis);
      if (recommendations.length > 0) {
        console.log('   Recommendations:', recommendations);
      }

      // Volatility analysis
      console.log('\n2. Volatility Analysis:');
      const volMetrics = this.volatilityAnalyzer.calculateVolatilityMetrics(candles);
      console.log(`   ATR: ${volMetrics.atr.toFixed(6)} (${volMetrics.atrPercent.toFixed(2)}%)`);
      console.log(`   Volatility Trend: ${volMetrics.volatilityTrend}`);
      
      const volBreakouts = this.volatilityAnalyzer.detectVolatilityBreakouts(candles);
      if (volBreakouts.length > 0) {
        console.log(`   Recent Breakouts: ${volBreakouts.slice(-3).map(b => `${b.type} (${b.strength.toFixed(1)})`).join(', ')}`);
      }

      // Volume analysis
      console.log('\n3. Volume Analysis:');
      const volMetrics2 = this.volumeAnalyzer.calculateVolumeMetrics(candles);
      console.log(`   Current Volume: ${volMetrics2.currentVolume.toFixed(0)}`);
      console.log(`   Volume Ratio: ${volMetrics2.volumeRatio20.toFixed(2)}x normal`);
      console.log(`   VWAP: ${volMetrics2.vwap.toFixed(4)}`);
      
      const volumeBreakouts = this.volumeAnalyzer.detectVolumeBreakouts(candles);
      if (volumeBreakouts.length > 0) {
        console.log(`   Volume Patterns: ${volumeBreakouts.slice(-3).map(b => `${b.type} (${b.strength.toFixed(1)})`).join(', ')}`);
      }

      // Pattern analysis
      console.log('\n4. Pattern Recognition:');
      const patterns = this.patternRecognizer.recognizeCandlestickPatterns(candles);
      if (patterns.length > 0) {
        console.log(`   Recent Patterns: ${patterns.slice(-3).map(p => `${p.name} (${p.confidence}%)`).join(', ')}`);
      }

      const supportResistance = this.patternRecognizer.detectSupportResistanceLevels(candles);
      if (supportResistance.length > 0) {
        console.log(`   Key Levels: ${supportResistance.slice(0, 2).map(l => `${l.type} ${l.price.toFixed(4)}`).join(', ')}`);
      }

    } catch (error) {
      console.error('Error in individual module analysis:', error);
    }
  }

  /**
   * Get optimized trading parameters based on current market conditions
   */
  public getOptimizedParameters(candles: Candle[]): {
    positionSize: number;
    stopLoss: number;
    takeProfit: number;
    timeframe: string;
    confidence: number;
  } {
    try {
      const optimizedParams = this.volatilityAnalyzer.optimizeParametersForVolatility(candles);
      const strategy = this.volatilityAnalyzer.generateVolatilityStrategy(candles);
      
      return {
        positionSize: optimizedParams.positionSize,
        stopLoss: optimizedParams.stopLoss,
        takeProfit: optimizedParams.takeProfit,
        timeframe: optimizedParams.timeframe,
        confidence: strategy.regime.confidence
      };
    } catch (error) {
      console.error('Error getting optimized parameters:', error);
      
      // Return conservative defaults
      return {
        positionSize: 0.5,
        stopLoss: 1.0,
        takeProfit: 2.0,
        timeframe: '3m',
        confidence: 50
      };
    }
  }
}

// Example usage function
export function exampleUsage() {
  console.log('Advanced Market Analysis Example');
  console.log('================================');
  
  const strategy = new AdvancedTradingStrategy();
  
  // Example candle data structure (you would get this from your data source)
  const mockCandleData: { [timeframe: string]: Candle[] } = {
    '1m': [], // Array of 1-minute candles
    '3m': [], // Array of 3-minute candles
    '5m': []  // Array of 5-minute candles
  };
  
  // Note: In real implementation, you would populate mockCandleData with actual market data
  console.log('Note: This is a mock example. In production, populate candleData with real market data.');
  
  try {
    // Generate advanced trading signal
    // const signal = strategy.generateAdvancedSignal(mockCandleData, 'BTCUSDT');
    
    // Analyze individual modules
    // strategy.analyzeIndividualModules(mockCandleData, 'BTCUSDT');
    
    // Get optimized parameters
    // const params = strategy.getOptimizedParameters(mockCandleData['1m']);
    
    console.log('Example completed successfully. Uncomment the lines above to run with real data.');
    
  } catch (error) {
    console.error('Example execution error:', error);
  }
}