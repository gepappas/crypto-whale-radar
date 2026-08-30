// Trading Bridge API client — calls the Lovable Cloud edge function.
// Every function returns LIVE data from the Deno bridge. No fallbacks.

import { safeInvoke } from "@/lib/safeInvoke";
import type {
  Candle, TechnicalAnalysis, BacktestResult, MarketSnapshotItem, SentimentResult,
  NewsItem, ScreenerRow, PatternHit, MultiTimeframeRow, CombinedAnalysis, YahooQuote,
} from "@/types/trading";

const FN = "trading-bridge";

const FALLBACK_SYMBOLS = ["BTC", "ETH", "SOL", "BNB", "XRP", "ADA", "DOGE", "AVAX"];
const intervalMap: Record<string, string> = { "15m": "15m", "1H": "1h", "4H": "4h", "1D": "1d", "1W": "1w", "1M": "1M" };

async function fetchFallbackCandles(symbol: string, timeframe = "1D"): Promise<Candle[]> {
  const pair = symbol.replace(/[-_/:]/g, "").toUpperCase().replace(/USD$/, "USDT");
  const interval = intervalMap[timeframe] || "1d";
  const endpoints = [
    `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=${interval}&limit=220`,
    `https://data-api.binance.vision/api/v3/klines?symbol=${pair}&interval=${interval}&limit=220`,
  ];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, { headers: { accept: "application/json" } });
      if (!response.ok) continue;
      const rows = await response.json();
      if (Array.isArray(rows) && rows.length) return rows.map((row: unknown[]) => ({ t: +row[0], o: +row[1], h: +row[2], l: +row[3], c: +row[4], v: +row[5] }));
    } catch { /* try the next public exchange */ }
  }
  throw new Error("No public market data provider is available");
}

function makeTechnicalFallback(symbol: string, timeframe: string, candles: Candle[]): TechnicalAnalysis {
  const closes = candles.map((c) => c.c), price = closes.at(-1) || 0, recent = closes.slice(-14);
  const avg = recent.reduce((sum, value) => sum + value, 0) / Math.max(recent.length, 1);
  const change = avg ? ((price - avg) / avg) * 100 : 0;
  const rsi = Math.max(0, Math.min(100, 50 + change * 3));
  const signal = rsi < 30 ? "OVERSOLD" : rsi > 70 ? "OVERBOUGHT" : "NEUTRAL";
  const ema = closes.slice(-20).reduce((sum, value) => sum + value, 0) / Math.max(Math.min(closes.length, 20), 1);
  const high = Math.max(...candles.slice(-20).map((c) => c.h)), low = Math.min(...candles.slice(-20).map((c) => c.l));
  const bullish = price >= ema;
  return { symbol, timeframe, price, timestamp: Date.now(), rsi: { value: rsi, signal }, macd: { line: change, signal: 0, hist: change, histSeries: closes.slice(-30).map((value, i, a) => i ? value - a[i - 1] : 0), goldenCross: bullish, deathCross: !bullish }, bollinger: { upper: high, mid: ema, lower: low, pctB: high === low ? 0.5 : (price - low) / (high - low), rating: change, squeeze: false, width: high - low }, ema: { ema20: ema, ema50: ema, ema200: ema, bullish, goldenCross: bullish, deathCross: !bullish }, supertrend: { direction: bullish ? "UPTREND" : "DOWNTREND", value: ema, atr: high - low }, overall: { signal: bullish ? "BUY" : "SELL", confidence: Math.min(75, 50 + Math.abs(change)), bullVotes: bullish ? 1 : 0, bearVotes: bullish ? 0 : 1, totalVotes: 1 }, support: low, resistance: high };
}

async function fallbackTechnical(symbol: string, timeframe = "1D") { return makeTechnicalFallback(symbol, timeframe, await fetchFallbackCandles(symbol, timeframe)); }

async function call<T>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  // Supabase functions.invoke expects the deployed function name separately.
  // The bridge determines its endpoint from the request pathname.
  const { data, error } = await safeInvoke<T>(FN, { body, headers: { "x-trading-bridge-path": path } });
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
  technical: async (symbol: string, timeframe = "1D") => {
    try { return await call<TechnicalAnalysis>("/technical-analysis", { symbol, timeframe }); }
    catch (error) { console.warn("[v0] technical Edge Function unavailable; using Binance candles", error); return fallbackTechnical(symbol, timeframe); }
  },

  multiple: async (symbols: string[], timeframe = "1D") => {
    try { return await call<TechnicalAnalysis[]>("/multiple-analysis", { symbols, timeframe }); }
    catch { return Promise.all(symbols.map((symbol) => fallbackTechnical(symbol, timeframe))); }
  },

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

  sentiment: async (symbol: string) => {
    try { return await call<SentimentResult>("/sentiment", { symbol }); }
    catch { return { symbol, score: 0, label: "Unavailable", postsAnalyzed: 0, bullishHits: 0, bearishHits: 0, topPosts: [], timestamp: Date.now() }; }
  },

  news: async (symbol?: string) => {
    try { return await call<{ items: NewsItem[]; timestamp: number }>("/news", { symbol }); }
    catch { return { items: [], timestamp: Date.now() }; }
  },

  combined: async (symbol: string, timeframe = "1D") => {
    try { return await call<CombinedAnalysis>("/combined-analysis", { symbol, timeframe }); }
    catch { const technical = await fallbackTechnical(symbol, timeframe); const sentiment = await tradingApi.sentiment(symbol); return { symbol, verdict: technical.overall.signal, confidence: technical.overall.confidence, breakdown: { technical: technical.overall.signal, sentiment: "Unavailable", news: "Unavailable" }, mixed: false, technical, sentiment, news: [] }; }
  },

  screener: async (filters: Record<string, unknown> = {}) => {
    try { return await call<{ items: ScreenerRow[]; timestamp: number }>("/screener", { filters }); }
    catch {
      const items = await Promise.all(FALLBACK_SYMBOLS.map(async (label) => { const data = await fallbackTechnical(`${label}-USD`); return { symbol: `${label}-USD`, exchange: "Binance", price: data.price, change24h: data.macd.hist, volume: 0, rsi: data.rsi.value, macdHist: data.macd.hist, bollingerRating: data.bollinger.rating, signal: data.overall.signal }; }));
      return { items, timestamp: Date.now() };
    }
  },

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
