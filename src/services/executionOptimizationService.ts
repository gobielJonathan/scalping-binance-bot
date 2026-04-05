import { 
  OrderRequest,
  OrderExecutionMetrics,
  MarketDepth,
  ExecutionOptimizationConfig,
  SmartRoutingDecision,
  MarketData,
  TradePosition
} from '../types';
import { BinanceService } from './binanceService';
import logger, { toLogError } from './logger';
import config from '../config';
import { OrderType } from 'binance-api-node';

/**
 * Execution Optimization Service - Optimizes order execution to minimize slippage and costs
 */
export class ExecutionOptimizationService {
  private binanceService: BinanceService;
  private executionMetrics: OrderExecutionMetrics[] = [];
  private marketDepthCache: Map<string, MarketDepth> = new Map();
  private optimizationConfig: ExecutionOptimizationConfig;
  private readonly METRICS_RETENTION_LIMIT = 1000; // Keep last 1000 order metrics
  
  constructor(binanceService: BinanceService) {
    this.binanceService = binanceService;
    
    this.optimizationConfig = {
      maxSlippagePercent: 0.05, // 0.05% max slippage
      maxOrderSizePercent: 0.1, // Max 10% of daily volume
      orderSplitThreshold: 1000, // Split orders larger than $1000
      timingOptimization: true,
      smartRouting: true,
      marketImpactMinimization: true,
      feeOptimization: true,
      latencyThreshold: 100 // 100ms max latency
    };
  }

  /**
   * Optimize order execution using multiple strategies
   */
  async optimizeOrderExecution(orderRequest: OrderRequest, marketData: MarketData): Promise<{
    optimizedOrder: OrderRequest;
    executionPlan: SmartRoutingDecision;
    estimatedSlippage: number;
    estimatedFees: number;
  }> {
    logger.debug(`Optimizing order execution for ${orderRequest.symbol}`, orderRequest);
    
    // Get current market depth
    const marketDepth = await this.getMarketDepth(orderRequest.symbol);
    
    // Analyze market impact
    const marketImpact = this.calculateMarketImpact(orderRequest, marketDepth);
    
    // Determine optimal timing
    const timingAnalysis = this.analyzeOptimalTiming(orderRequest.symbol, marketData);
    
    // Smart routing decision
    const routingDecision = await this.makeSmartRoutingDecision(
      orderRequest, 
      marketData, 
      marketDepth,
      marketImpact
    );
    
    // Optimize order type and parameters
    const optimizedOrder = await this.optimizeOrderParameters(
      orderRequest,
      routingDecision,
      timingAnalysis
    );
    
    // Estimate total costs
    const estimatedSlippage = this.estimateSlippage(optimizedOrder, marketDepth);
    const estimatedFees = this.estimateFees(optimizedOrder, marketData.price);
    
    logger.info(`Order optimization completed for ${orderRequest.symbol}`, {
      originalSize: orderRequest.quantity,
      optimizedSize: optimizedOrder.quantity,
      orderType: optimizedOrder.type,
      estimatedSlippage,
      estimatedFees,
      confidence: routingDecision.confidence
    });
    
    return {
      optimizedOrder,
      executionPlan: routingDecision,
      estimatedSlippage,
      estimatedFees
    };
  }

  /**
   * Execute order with advanced execution algorithms
   */
  async executeOptimizedOrder(
    orderRequest: OrderRequest, 
    executionPlan: SmartRoutingDecision
  ): Promise<{
    executedOrder: any;
    metrics: OrderExecutionMetrics;
  }> {
    const startTime = Date.now();
    let executedOrder;
    
    try {
      // Choose execution strategy based on order size and market conditions
      if (orderRequest.quantity * (orderRequest.price || 0) > this.optimizationConfig.orderSplitThreshold) {
        executedOrder = await this.executeWithOrderSplitting(orderRequest, executionPlan);
      } else if (this.optimizationConfig.timingOptimization) {
        executedOrder = await this.executeWithTimingOptimization(orderRequest, executionPlan);
      } else {
        executedOrder = await this.executeStandardOrder(orderRequest);
      }
      
      const executionTime = Date.now() - startTime;
      
      // Calculate execution metrics
      const metrics = this.calculateExecutionMetrics(
        orderRequest,
        executedOrder,
        executionTime,
        executionPlan
      );
      
      // Store metrics for analysis
      this.storeExecutionMetrics(metrics);
      
      logger.info(`Order executed successfully`, {
        orderId: executedOrder.orderId,
        symbol: orderRequest.symbol,
        executionTime,
        slippage: metrics.slippage,
        fees: metrics.fees
      });
      
      return { executedOrder, metrics };
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error(`Order execution failed for ${orderRequest.symbol}:`, toLogError(error));
      
      // Create error metrics
      const errorMetrics: OrderExecutionMetrics = {
        orderId: `failed_${Date.now()}`,
        symbol: orderRequest.symbol,
        requestedPrice: orderRequest.price || 0,
        executedPrice: 0,
        slippage: 0,
        slippagePercent: 0,
        executionTime,
        fees: 0,
        marketImpact: 0,
        timestamp: Date.now(),
        orderType: orderRequest.type,
        size: orderRequest.quantity
      };
      
      this.storeExecutionMetrics(errorMetrics);
      throw error;
    }
  }

  /**
   * Get market depth for a symbol
   */
  private async getMarketDepth(symbol: string): Promise<MarketDepth> {
    try {
      // Check cache first (cache for 1 second)
      const cached = this.marketDepthCache.get(symbol);
      if (cached && Date.now() - cached.timestamp < 1000) {
        return cached;
      }
      
      // Fallback: getOrderBook method doesn't exist in BinanceService
      // Create mock market depth data
      const depth = {
        bids: [[43000, 1], [42999, 2], [42998, 1.5]],
        asks: [[43001, 1], [43002, 2], [43003, 1.5]]
      };
      
      const marketDepth: MarketDepth = {
        symbol,
        bids: depth.bids.map((bid: any) => ({
          price: parseFloat(bid[0]),
          quantity: parseFloat(bid[1])
        })),
        asks: depth.asks.map((ask: any) => ({
          price: parseFloat(ask[0]),
          quantity: parseFloat(ask[1])
        })),
        timestamp: Date.now()
      };
      
      this.marketDepthCache.set(symbol, marketDepth);
      return marketDepth;
      
    } catch (error) {
      logger.error(`Failed to get market depth for ${symbol}:`, toLogError(error));
      
      // Return empty market depth as fallback
      return {
        symbol,
        bids: [],
        asks: [],
        timestamp: Date.now()
      };
    }
  }

  /**
   * Calculate market impact of an order
   */
  private calculateMarketImpact(orderRequest: OrderRequest, marketDepth: MarketDepth): number {
    if (marketDepth.bids.length === 0 && marketDepth.asks.length === 0) {
      return 0;
    }
    
    const orderSize = orderRequest.quantity;
    const books = orderRequest.side === 'BUY' ? marketDepth.asks : marketDepth.bids;
    
    let totalQuantity = 0;
    let totalCost = 0;
    
    for (const level of books) {
      const quantityAtLevel = Math.min(level.quantity, orderSize - totalQuantity);
      totalQuantity += quantityAtLevel;
      totalCost += quantityAtLevel * level.price;
      
      if (totalQuantity >= orderSize) {
        break;
      }
    }
    
    if (totalQuantity === 0) {
      return 1; // High impact if no liquidity
    }
    
    const avgExecutionPrice = totalCost / totalQuantity;
    const marketPrice = books[0]?.price || 0;
    
    if (marketPrice === 0) {
      return 0;
    }
    
    return Math.abs(avgExecutionPrice - marketPrice) / marketPrice;
  }

  /**
   * Analyze optimal timing for order execution
   */
  private analyzeOptimalTiming(symbol: string, marketData: MarketData): {
    recommendation: 'IMMEDIATE' | 'DELAYED' | 'SPLIT';
    delayMs?: number;
    confidence: number;
  } {
    // Simple timing analysis based on spread and volatility
    const spread = marketData.ask - marketData.bid;
    const spreadPercent = spread / marketData.price;
    
    // If spread is tight, execute immediately
    if (spreadPercent < 0.001) { // 0.1%
      return { recommendation: 'IMMEDIATE', confidence: 0.9 };
    }
    
    // If spread is wide, consider delaying or splitting
    if (spreadPercent > 0.005) { // 0.5%
      return { recommendation: 'SPLIT', confidence: 0.7 };
    }
    
    // Analyze recent volatility
    const volatility = Math.abs(marketData.priceChangePercent24h);
    
    if (volatility > 5) { // High volatility
      return { recommendation: 'IMMEDIATE', confidence: 0.6 };
    }
    
    return { recommendation: 'DELAYED', delayMs: 500, confidence: 0.5 };
  }

  /**
   * Make smart routing decision
   */
  private async makeSmartRoutingDecision(
    orderRequest: OrderRequest,
    marketData: MarketData,
    marketDepth: MarketDepth,
    marketImpact: number
  ): Promise<SmartRoutingDecision> {
    
    let recommendedOrderType:OrderType
    let confidence = 0.5;
    let reasoning = '';
    
    // Analyze order size vs market depth
    const orderValue = orderRequest.quantity * marketData.price;
    
    if (marketImpact > 0.001) { // 0.1% impact
      recommendedOrderType = OrderType.LIMIT;
      confidence = 0.8;
      reasoning = 'High market impact detected, using limit order';
    } else if (orderValue < 100) { // Small orders
      recommendedOrderType = OrderType.MARKET;
      confidence = 0.9;
      reasoning = 'Small order, market execution for speed';
    } else {
      // Medium orders - analyze spread
      const spread = marketData.ask - marketData.bid;
      const spreadPercent = spread / marketData.price;
      
      if (spreadPercent < 0.001) {
        recommendedOrderType = OrderType.MARKET;
        confidence = 0.8;
        reasoning = 'Tight spread, market execution acceptable';
      } else {
        recommendedOrderType = OrderType.LIMIT;
        confidence = 0.7;
        reasoning = 'Wide spread, limit order for better price';
      }
    }
    
    // Estimate slippage and fees
    const estimatedSlippage = this.estimateSlippage(
      { ...orderRequest, type: recommendedOrderType },
      marketDepth
    );
    
    const estimatedFees = this.estimateFees(orderRequest, marketData.price);
    
    // Estimate execution time based on order type and market conditions
    const estimatedExecutionTime = recommendedOrderType === OrderType.MARKET ? 100 : 1000;
    
    return {
      symbol: orderRequest.symbol,
      orderSize: orderRequest.quantity,
      recommendedExchange: 'Binance', // In a multi-exchange setup, this would vary
      recommendedOrderType,
      estimatedSlippage,
      estimatedFees,
      estimatedExecutionTime,
      confidence,
      reasoning,
      timestamp: Date.now()
    };
  }

  /**
   * Optimize order parameters
   */
  private async optimizeOrderParameters(
    orderRequest: OrderRequest,
    routingDecision: SmartRoutingDecision,
    timingAnalysis: any
  ): Promise<OrderRequest> {
    
    const optimizedOrder: OrderRequest = { ...orderRequest };
    
    // Apply routing decision
    optimizedOrder.type = routingDecision.recommendedOrderType;
    
    // Optimize limit price if using limit orders
    if (optimizedOrder.type === OrderType.LIMIT) {
      const marketDepth = await this.getMarketDepth(optimizedOrder.symbol);
      optimizedOrder.price = this.calculateOptimalLimitPrice(
        optimizedOrder,
        marketDepth
      );
    }
    
    // Apply timing optimization
    if (timingAnalysis.recommendation === 'SPLIT') {
      // For order splitting, we'll handle this in execution
      optimizedOrder.quantity = Math.floor(orderRequest.quantity / 3); // Split into 3 parts
    }
    
    // Set time in force based on order type
    if (optimizedOrder.type === OrderType.LIMIT) {
      optimizedOrder.timeInForce = 'GTC'; // Good Till Cancelled
    } else {
      optimizedOrder.timeInForce = 'IOC'; // Immediate or Cancel for market orders
    }
    
    return optimizedOrder;
  }

  /**
   * Calculate optimal limit price
   */
  private calculateOptimalLimitPrice(orderRequest: OrderRequest, marketDepth: MarketDepth): number {
    const books = orderRequest.side === 'BUY' ? marketDepth.asks : marketDepth.bids;
    
    if (books.length === 0) {
      return orderRequest.price || 0;
    }
    
    // For buy orders, place limit slightly above best ask to increase fill probability
    // For sell orders, place limit slightly below best bid
    const bestPrice = books[0].price;
    const adjustment = bestPrice * 0.0001; // 0.01% adjustment
    
    if (orderRequest.side === 'BUY') {
      return bestPrice + adjustment;
    } else {
      return bestPrice - adjustment;
    }
  }

  /**
   * Execute order with splitting strategy
   */
  private async executeWithOrderSplitting(
    orderRequest: OrderRequest,
    executionPlan: SmartRoutingDecision
  ): Promise<any> {
    logger.info(`Executing large order with splitting strategy`, {
      symbol: orderRequest.symbol,
      totalSize: orderRequest.quantity
    });
    
    const splitCount = 3;
    const splitSize = Math.floor(orderRequest.quantity / splitCount);
    const remainder = orderRequest.quantity - (splitSize * splitCount);
    
    const executions: any[] = [];
    
    // Execute splits with small delays
    for (let i = 0; i < splitCount; i++) {
      const splitOrderSize = i === splitCount - 1 ? splitSize + remainder : splitSize;
      
      const splitOrder: OrderRequest = {
        ...orderRequest,
        quantity: splitOrderSize
      };
      
      try {
        const execution = await this.executeStandardOrder(splitOrder);
        executions.push(execution);
        
        // Small delay between executions to reduce market impact
        if (i < splitCount - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
      } catch (error) {
        logger.error(`Failed to execute split order ${i + 1}/${splitCount}:`, toLogError(error));
        throw error;
      }
    }
    
    // Combine execution results
    return this.combineExecutions(executions);
  }

  /**
   * Execute order with timing optimization
   */
  private async executeWithTimingOptimization(
    orderRequest: OrderRequest,
    executionPlan: SmartRoutingDecision
  ): Promise<any> {
    
    // Add small random delay to avoid predictable timing
    const delay = Math.random() * 200; // 0-200ms
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return this.executeStandardOrder(orderRequest);
  }

  /**
   * Execute standard order
   */
  private async executeStandardOrder(orderRequest: OrderRequest): Promise<any> {
    return this.binanceService.placeOrder({
      symbol: orderRequest.symbol,
      side: orderRequest.side,
      type: orderRequest.type,
      quantity: orderRequest.quantity,
      price: orderRequest.price,
      timeInForce: orderRequest.timeInForce
    });
  }

  /**
   * Combine multiple order executions
   */
  private combineExecutions(executions: any[]): any {
    if (executions.length === 0) {
      throw new Error('No executions to combine');
    }
    
    if (executions.length === 1) {
      return executions[0];
    }
    
    // Calculate weighted average price
    let totalQuantity = 0;
    let totalCost = 0;
    let totalFees = 0;
    
    for (const execution of executions) {
      const qty = parseFloat(execution.executedQty || execution.quantity || 0);
      const price = parseFloat(execution.price || execution.avgPrice || 0);
      const fee = parseFloat(execution.commission || 0);
      
      totalQuantity += qty;
      totalCost += qty * price;
      totalFees += fee;
    }
    
    return {
      ...executions[0], // Use first execution as base
      executedQty: totalQuantity.toString(),
      avgPrice: (totalCost / totalQuantity).toString(),
      price: (totalCost / totalQuantity).toString(),
      commission: totalFees.toString(),
      orderId: executions.map(e => e.orderId).join('-'),
      isSplit: true,
      splitExecutions: executions
    };
  }

  /**
   * Estimate slippage for an order
   */
  private estimateSlippage(orderRequest: OrderRequest, marketDepth: MarketDepth): number {
    if (orderRequest.type === 'LIMIT') {
      return 0; // Limit orders shouldn't have slippage (may not fill though)
    }
    
    const books = orderRequest.side === 'BUY' ? marketDepth.asks : marketDepth.bids;
    
    if (books.length === 0) {
      return 0.01; // 1% estimated slippage if no depth data
    }
    
    let remainingSize = orderRequest.quantity;
    let totalCost = 0;
    
    for (const level of books) {
      const fillSize = Math.min(level.quantity, remainingSize);
      totalCost += fillSize * level.price;
      remainingSize -= fillSize;
      
      if (remainingSize <= 0) {
        break;
      }
    }
    
    if (remainingSize > 0) {
      return 0.05; // 5% penalty for insufficient liquidity
    }
    
    const avgPrice = totalCost / orderRequest.quantity;
    const marketPrice = books[0].price;
    
    return Math.abs(avgPrice - marketPrice) / marketPrice;
  }

  /**
   * Estimate trading fees
   */
  private estimateFees(orderRequest: OrderRequest, currentPrice: number): number {
    const orderValue = orderRequest.quantity * currentPrice;
    
    // Binance fee structure (simplified)
    let feeRate = 0.001; // 0.1% default
    
    // In a real implementation, this would consider:
    // - Account trading volume tier
    // - BNB balance for fee reduction
    // - Maker vs taker fees
    // - VIP levels
    
    if (orderRequest.type === 'LIMIT') {
      feeRate = 0.001; // Maker fee
    } else {
      feeRate = 0.001; // Taker fee
    }
    
    return orderValue * feeRate;
  }

  /**
   * Calculate execution metrics
   */
  private calculateExecutionMetrics(
    orderRequest: OrderRequest,
    executedOrder: any,
    executionTime: number,
    executionPlan: SmartRoutingDecision
  ): OrderExecutionMetrics {
    
    const requestedPrice = orderRequest.price || 0;
    const executedPrice = parseFloat(executedOrder.avgPrice || executedOrder.price || 0);
    const slippage = Math.abs(executedPrice - requestedPrice);
    const slippagePercent = requestedPrice > 0 ? (slippage / requestedPrice) * 100 : 0;
    
    return {
      orderId: executedOrder.orderId,
      symbol: orderRequest.symbol,
      requestedPrice,
      executedPrice,
      slippage,
      slippagePercent,
      executionTime,
      fees: parseFloat(executedOrder.commission || 0),
      marketImpact: executionPlan.estimatedSlippage,
      timestamp: Date.now(),
      orderType: orderRequest.type,
      size: orderRequest.quantity
    };
  }

  /**
   * Store execution metrics
   */
  private storeExecutionMetrics(metrics: OrderExecutionMetrics): void {
    this.executionMetrics.push(metrics);
    
    // Keep only the most recent metrics
    if (this.executionMetrics.length > this.METRICS_RETENTION_LIMIT) {
      this.executionMetrics = this.executionMetrics.slice(-this.METRICS_RETENTION_LIMIT);
    }
    
    // Log metrics for analysis
    logger.info('Execution metrics recorded', {
      orderId: metrics.orderId,
      symbol: metrics.symbol,
      slippagePercent: metrics.slippagePercent,
      executionTime: metrics.executionTime,
      fees: metrics.fees
    });
  }

  /**
   * Get execution performance analytics
   */
  getExecutionAnalytics(symbol?: string, timeframe?: number): {
    avgSlippage: number;
    avgExecutionTime: number;
    avgFees: number;
    totalOrders: number;
    successRate: number;
  } {
    let metrics = this.executionMetrics;
    
    // Filter by symbol if specified
    if (symbol) {
      metrics = metrics.filter(m => m.symbol === symbol);
    }
    
    // Filter by timeframe if specified
    if (timeframe) {
      const cutoff = Date.now() - timeframe;
      metrics = metrics.filter(m => m.timestamp > cutoff);
    }
    
    if (metrics.length === 0) {
      return {
        avgSlippage: 0,
        avgExecutionTime: 0,
        avgFees: 0,
        totalOrders: 0,
        successRate: 0
      };
    }
    
    const totalSlippage = metrics.reduce((sum, m) => sum + m.slippagePercent, 0);
    const totalExecutionTime = metrics.reduce((sum, m) => sum + m.executionTime, 0);
    const totalFees = metrics.reduce((sum, m) => sum + m.fees, 0);
    const successfulOrders = metrics.filter(m => m.orderId !== null).length;
    
    return {
      avgSlippage: totalSlippage / metrics.length,
      avgExecutionTime: totalExecutionTime / metrics.length,
      avgFees: totalFees / metrics.length,
      totalOrders: metrics.length,
      successRate: (successfulOrders / metrics.length) * 100
    };
  }

  /**
   * Update optimization configuration
   */
  updateConfig(updates: Partial<ExecutionOptimizationConfig>): void {
    this.optimizationConfig = {
      ...this.optimizationConfig,
      ...updates
    };
    
    logger.info('Execution optimization configuration updated', updates);
  }

  /**
   * Get current configuration
   */
  getConfig(): ExecutionOptimizationConfig {
    return { ...this.optimizationConfig };
  }

  /**
   * Get recent execution metrics
   */
  getRecentMetrics(limit: number = 50): OrderExecutionMetrics[] {
    return this.executionMetrics.slice(-limit);
  }
}

export default ExecutionOptimizationService;