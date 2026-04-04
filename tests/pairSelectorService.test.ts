import { PairSelectorService } from '../src/services/pairSelectorService';
import { MarketData } from '../src/types';

// Helper to create a minimal MarketData fixture
function makeMarketData(partial: Partial<MarketData> & Pick<MarketData, 'symbol' | 'price' | 'volume24h' | 'priceChangePercent24h'>): MarketData {
  return {
    priceChange24h: 0,
    bid: partial.price,
    ask: partial.price,
    spread: 0,
    timestamp: Date.now(),
    ...partial,
  };
}

// A minimal BinanceService stub whose getPrice() is fully configurable per test
function makeBinanceServiceStub(tickers: MarketData[]) {
  return {
    getPrice: jest.fn().mockResolvedValue(tickers),
  } as unknown as import('../src/services/binanceService').BinanceService;
}

describe('PairSelectorService', () => {
  describe('getVolatilityScores', () => {
    it('filters out non-USDT symbols', async () => {
      const tickers = [
        makeMarketData({ symbol: 'BTCUSDT', price: 50000, volume24h: 1000, priceChangePercent24h: 5 }),
        makeMarketData({ symbol: 'ETHBTC',  price: 0.06,  volume24h: 1000, priceChangePercent24h: 3 }),
      ];
      const service = new PairSelectorService(makeBinanceServiceStub(tickers));
      const scores = await service.getVolatilityScores({ minVolume24hUsdt: 0 });

      expect(scores.map((s) => s.symbol)).toEqual(['BTCUSDT']);
    });

    it('filters out pairs below the minimum USDT volume threshold', async () => {
      const tickers = [
        makeMarketData({ symbol: 'BTCUSDT', price: 50000,   volume24h: 1000,  priceChangePercent24h: 10 }),
        makeMarketData({ symbol: 'LOWUSDT', price: 1,       volume24h: 100,   priceChangePercent24h: 20 }),
      ];
      const service = new PairSelectorService(makeBinanceServiceStub(tickers));
      // BTC: 50000 * 1000 = 50_000_000  ✓
      // LOW:  1    * 100  =        100  ✗  (below 1_000_000 threshold)
      const scores = await service.getVolatilityScores({ minVolume24hUsdt: 1_000_000 });

      expect(scores.map((s) => s.symbol)).toEqual(['BTCUSDT']);
    });

    it('sorts results by score descending (higher volatility first)', async () => {
      const tickers = [
        makeMarketData({ symbol: 'AAUSDT', price: 10, volume24h: 1_000_000, priceChangePercent24h: 2  }),
        makeMarketData({ symbol: 'BBUSDT', price: 10, volume24h: 1_000_000, priceChangePercent24h: 10 }),
        makeMarketData({ symbol: 'CCUSDT', price: 10, volume24h: 1_000_000, priceChangePercent24h: 5  }),
      ];
      const service = new PairSelectorService(makeBinanceServiceStub(tickers));
      const scores = await service.getVolatilityScores({ minVolume24hUsdt: 0 });

      expect(scores[0].symbol).toBe('BBUSDT');
      expect(scores[1].symbol).toBe('CCUSDT');
      expect(scores[2].symbol).toBe('AAUSDT');
    });

    it('treats negative price change (falling price) as equally volatile as positive', async () => {
      const tickers = [
        makeMarketData({ symbol: 'XUSDT', price: 10, volume24h: 1_000_000, priceChangePercent24h: -8 }),
        makeMarketData({ symbol: 'YUSDT', price: 10, volume24h: 1_000_000, priceChangePercent24h:  8 }),
      ];
      const service = new PairSelectorService(makeBinanceServiceStub(tickers));
      const scores = await service.getVolatilityScores({ minVolume24hUsdt: 0 });

      expect(scores[0].score).toBeCloseTo(scores[1].score, 5);
    });

    it('returns an empty array when no tickers pass the filters', async () => {
      const tickers = [
        makeMarketData({ symbol: 'POORUSDT', price: 1, volume24h: 1, priceChangePercent24h: 1 }),
      ];
      const service = new PairSelectorService(makeBinanceServiceStub(tickers));
      const scores = await service.getVolatilityScores({ minVolume24hUsdt: 1_000_000_000 });

      expect(scores).toHaveLength(0);
    });
  });

  describe('selectTopVolatilityPairs', () => {
    it('returns the top N symbols by score', async () => {
      const tickers = [
        makeMarketData({ symbol: 'AAUSDT', price: 10, volume24h: 1_000_000, priceChangePercent24h: 1  }),
        makeMarketData({ symbol: 'BBUSDT', price: 10, volume24h: 1_000_000, priceChangePercent24h: 5  }),
        makeMarketData({ symbol: 'CCUSDT', price: 10, volume24h: 1_000_000, priceChangePercent24h: 3  }),
        makeMarketData({ symbol: 'DDUSDT', price: 10, volume24h: 1_000_000, priceChangePercent24h: 4  }),
      ];
      const service = new PairSelectorService(makeBinanceServiceStub(tickers));
      const pairs = await service.selectTopVolatilityPairs({ topN: 2, minVolume24hUsdt: 0 });

      expect(pairs).toHaveLength(2);
      expect(pairs[0]).toBe('BBUSDT');
      expect(pairs[1]).toBe('DDUSDT');
    });

    it('falls back to provided fallback pairs when no tickers pass the filters', async () => {
      const tickers = [
        makeMarketData({ symbol: 'LOWUSDT', price: 1, volume24h: 1, priceChangePercent24h: 50 }),
      ];
      const service = new PairSelectorService(makeBinanceServiceStub(tickers));
      const fallback = ['BTCUSDT', 'ETHUSDT'];
      const pairs = await service.selectTopVolatilityPairs(
        { topN: 2, minVolume24hUsdt: 1_000_000_000 },
        fallback,
      );

      expect(pairs).toEqual(fallback);
    });

    it('falls back to provided fallback pairs when getPrice throws', async () => {
      const stub = {
        getPrice: jest.fn().mockRejectedValue(new Error('network error')),
      } as unknown as import('../src/services/binanceService').BinanceService;

      const service = new PairSelectorService(stub);
      const fallback = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'];
      const pairs = await service.selectTopVolatilityPairs({ topN: 3 }, fallback);

      expect(pairs).toEqual(fallback);
    });

    it('respects topN when fewer matching pairs are available', async () => {
      const tickers = [
        makeMarketData({ symbol: 'ONLYUSDT', price: 10, volume24h: 2_000_000, priceChangePercent24h: 7 }),
      ];
      const service = new PairSelectorService(makeBinanceServiceStub(tickers));
      const pairs = await service.selectTopVolatilityPairs({ topN: 5, minVolume24hUsdt: 0 });

      expect(pairs).toHaveLength(1);
      expect(pairs[0]).toBe('ONLYUSDT');
    });

    it('applies the topN limit to fallback pairs as well', async () => {
      const tickers: MarketData[] = [];
      const service = new PairSelectorService(makeBinanceServiceStub(tickers));
      const fallback = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT'];
      const pairs = await service.selectTopVolatilityPairs({ topN: 2 }, fallback);

      expect(pairs).toHaveLength(2);
    });
  });
});
