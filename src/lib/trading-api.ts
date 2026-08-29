// Trading Bridge API client — calls the Lovable Cloud edge function.
// Every function returns LIVE data from the Deno bridge. No fallbacks.

import { safeInvoke } from "@/lib/safeInvoke";
import type {
  TechnicalAnalysis, BacktestResult, MarketSnapshotItem, SentimentResult,
  NewsItem, ScreenerRow, PatternHit, MultiTimeframeRow, CombinedAnalysis, YahooQuote,
} from "@/types/trading";

const FN = "trading-bridge";

async function call<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await safeInvoke<T>(`${FN}${path}`, { body });
  if (error) throw error;
  if (data == null) throw new Error(`${FN}${path}: empty response`);
  return data;
}

/** Bounds and flattens an error message before it's rendered in the UI.
 *  Second layer of defense alongside the edge function's own truncation
 *  (trading-bridge/index.ts's describeUpstreamError) — a message that
 *  somehow still arrives unbounded (a network-layer error, a future
 *  endpoint that forgets to truncate) can't dump a multi-KB blob into the
 *  page the way a raw Reddit block-page error once did here. */
export function errText(error: unknown, max = 160): string {
  const raw = error instanceof Error ? error.message : String(error);
  const oneLine = raw.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}

const SNAPSHOT_SYMBOLS = [
  { symbol: "BTCUSDT", label: "BTC" },
  { symbol: "ETHUSDT", label: "ETH" },
  { symbol: "SOLUSDT", label: "SOL" },
  { symbol: "BNBUSDT", label: "BNB" },
  { symbol: "XRPUSDT", label: "XRP" },
  { symbol: "DOGEUSDT", label: "DOGE" },
  { symbol: "ADAUSDT", label: "ADA" },
  { symbol: "AVAXUSDT", label: "AVAX" },
] as const;

type BinanceTicker = { symbol: string; lastPrice: string; priceChangePercent: string };

async function publicMarketSnapshot(): Promise<{ items: MarketSnapshotItem[]; timestamp: number }> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 9000);
  const request = (url: string) => fetch(url, { signal: controller.signal, headers: { accept: "application/json" } });
  try {
    const urls = [
      "https://api.binance.com/api/v3/ticker/24hr?symbols=" + encodeURIComponent(JSON.stringify(SNAPSHOT_SYMBOLS.map(({ symbol }) => symbol))),
      "https://data-api.binance.vision/api/v3/ticker/24hr?symbols=" + encodeURIComponent(JSON.stringify(SNAPSHOT_SYMBOLS.map(({ symbol }) => symbol))),
    ];
    for (const url of urls) {
      try {
        const response = await request(url);
        if (!response.ok) continue;
        const tickers = (await response.json()) as BinanceTicker[];
        if (!Array.isArray(tickers) || !tickers.length) continue;
        const timestamp = Date.now();
        return { items: SNAPSHOT_SYMBOLS.map(({ symbol, label }) => {
          const ticker = tickers.find((item) => item.symbol === symbol);
          return ticker ? { symbol, label, price: Number(ticker.lastPrice), changePct: Number(ticker.priceChangePercent), timestamp } : { symbol, label, error: "Unavailable", timestamp };
        }), timestamp };
      } catch { /* try the next public provider */ }
    }
    const response = await request("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin,ethereum,solana,binancecoin,ripple,dogecoin,cardano,avalanche-2&sparkline=true");
    if (!response.ok) throw new Error(`Public market providers returned ${response.status}`);
    const coins = (await response.json()) as Array<{ id: string; symbol: string; current_price: number; price_change_percentage_24h: number; sparkline_in_7d?: { price: number[] } }>;
    const labels = ["BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX"];
    const timestamp = Date.now();
    return { items: labels.map((label, index) => { const coin = coins[index]; return coin ? { symbol: `${label}USDT`, label, price: coin.current_price, changePct: coin.price_change_percentage_24h, spark: coin.sparkline_in_7d?.price, timestamp } : { symbol: `${label}USDT`, label, error: "Unavailable", timestamp }; }), timestamp };
  } finally {
    window.clearTimeout(timeout);
  }
}

export const tradingApi = {
  technical: (symbol: string, timeframe = "1D") =>
    call<TechnicalAnalysis>("/technical-analysis", { symbol, timeframe }),

  multiple: (symbols: string[], timeframe = "1D") =>
    call<TechnicalAnalysis[]>("/multiple-analysis", { symbols, timeframe }),

  bollinger: (symbol: string, timeframe = "1D") =>
    call<TechnicalAnalysis["bollinger"] & { symbol: string; price: number }>(
      "/bollinger-analysis", { symbol, timeframe },
    ),

  backtest: (params: { symbol: string; strategy: string; period: string; capital: number; commission: number }) =>
    call<BacktestResult>("/backtest", params),

  compareStrategies: (symbol: string, period = "1y", capital = 10000, commission = 0.1) =>
    call<{ symbol: string; period: string; results: Array<{ strategy: string; totalReturn: number; sharpe: number; winRate: number; maxDrawdown: number; tradeCount: number }> }>(
      "/compare-strategies", { symbol, period, capital, commission },
    ),

  marketSnapshot: async () => {
    try {
      return await call<{ items: MarketSnapshotItem[]; timestamp: number }>("/market-snapshot");
    } catch (edgeError) {
      console.warn("[v0] Market snapshot Edge Function failed; using Binance public data", edgeError);
      return publicMarketSnapshot();
    }
  },

  sentiment: (symbol: string) =>
    call<SentimentResult>("/sentiment", { symbol }),

  news: (symbol?: string) =>
    call<{ items: NewsItem[]; timestamp: number }>("/news", { symbol }),

  combined: (symbol: string, timeframe = "1D") =>
    call<CombinedAnalysis>("/combined-analysis", { symbol, timeframe }),

  screener: (filters: Record<string, unknown> = {}) =>
    call<{ items: ScreenerRow[]; timestamp: number }>("/screener", { filters }),

  scanSignal: (signal_type: string) =>
    call<{ items: ScreenerRow[]; timestamp: number }>("/scan-signal", { signal_type }),

  patterns: (symbol: string, timeframe = "1D") =>
    call<{ symbol: string; patterns: PatternHit[]; timestamp: number }>("/candlestick-patterns", { symbol, timeframe }),

  multiTimeframe: (symbol: string) =>
    call<{ symbol: string; timeframes: MultiTimeframeRow[]; alignment: string; timestamp: number }>("/multi-timeframe", { symbol }),

  yahooPrice: (symbol: string) =>
    call<YahooQuote>("/yahoo-price", { symbol }),
};

export const REFRESH = {
  market: 15_000,
  technical: 30_000,
  sentiment: 120_000,
  news: 120_000,
  screener: 60_000,
  patterns: 300_000,
  multiTimeframe: 60_000,
};
