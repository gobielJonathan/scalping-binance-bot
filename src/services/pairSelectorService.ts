import { BinanceService } from './binanceService';
import { MarketData } from '../types';
import { logger } from './logger';

export interface VolatilityScore {
  symbol: string;
  priceChangePercent: number;
  quoteVolume24h: number;
  score: number;
}

export interface PairSelectorOptions {
  quoteAsset?: string;
  topN?: number;
  minVolume24hUsdt?: number;
}

/**
 * Service that dynamically selects high-volatility trading pairs from Binance.
 *
 * The volatility score is computed as:
 *   |priceChangePercent24h| * log10(quoteVolume + 1)
 *
 * This rewards pairs that have both large price swings AND sufficient liquidity,
 * which is ideal for scalping strategies seeking better profit opportunities.
 */
export class PairSelectorService {
  constructor(private readonly binanceService: BinanceService) {}

  /**
   * Fetch all 24-hour tickers and compute a volatility score for each symbol.
   * Symbols are filtered by quote asset and minimum USD-denominated volume.
   */
  async getVolatilityScores(options: PairSelectorOptions = {}): Promise<VolatilityScore[]> {
    const {
      quoteAsset = 'USDT',
      minVolume24hUsdt = 10_000_000,
    } = options;

    const allTickers = await this.binanceService.getPrice() as MarketData[];

    const scores: VolatilityScore[] = [];

    for (const ticker of allTickers) {
      if (!ticker.symbol.endsWith(quoteAsset)) continue;

      // Estimate USD-denominated 24h volume (baseVolume * lastPrice)
      const quoteVolume24h = ticker.volume24h * ticker.price;

      if (quoteVolume24h < minVolume24hUsdt) continue;

      const priceChangePercent = ticker.priceChangePercent24h;

      // Composite score: magnitude of price move weighted by liquidity
      const score = Math.abs(priceChangePercent) * Math.log10(quoteVolume24h + 1);

      scores.push({
        symbol: ticker.symbol,
        priceChangePercent,
        quoteVolume24h,
        score,
      });
    }

    return scores.sort((a, b) => b.score - a.score);
  }

  /**
   * Return the top N trading symbols ranked by volatility score.
   *
   * Falls back to the provided `fallbackPairs` if the Binance API call fails,
   * so the bot can always start even without connectivity.
   */
  async selectTopVolatilityPairs(
    options: PairSelectorOptions = {},
    fallbackPairs: string[] = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'],
  ): Promise<string[]> {
    const { topN = 5 } = options;

    try {
      const scores = await this.getVolatilityScores(options);

      if (scores.length === 0) {
        logger.warn('PairSelectorService: No pairs matched the filters — using fallback pairs');
        return fallbackPairs.slice(0, topN);
      }

      const selected = scores.slice(0, topN).map((s) => s.symbol);

      console.info(`Top ${selected.length} high-volatility pairs selected`);
      scores.slice(0, topN).forEach((s, i) => {
        const rank = `${i + 1}.`.padEnd(4);
        const symbol = s.symbol.padEnd(12);
        const change = `${s.priceChangePercent >= 0 ? '+' : ''}${s.priceChangePercent.toFixed(2)}%`.padStart(8);
        const vol = `$${(s.quoteVolume24h / 1_000_000).toFixed(1)}M`.padStart(10);
        console.info(`   ${rank}${symbol} change: ${change}  vol: ${vol}  score: ${s.score.toFixed(2)}`);
      });

      return selected;
    } catch (error) {
      logger.error('PairSelectorService: Failed to fetch ticker data —', { error: error instanceof Error ? { stack: error.stack, code: (error as any).code } : { stack: String(error) } });
      logger.warn(`Falling back to default pairs: ${fallbackPairs.join(', ')}`);
      return fallbackPairs.slice(0, topN);
    }
  }
}
