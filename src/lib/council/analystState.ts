import type { CoinData, WhaleTrade } from '@/lib/whaleRadarState';
import type { AgentMarketState, AnalystReport } from '@/types/council';
import type { RegimeReading } from '@/lib/regime/types';

function confidence(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function consensus(reports: AnalystReport[]): AgentMarketState['consensus'] {
  const score = reports.reduce((total, report) => total + (report.bias === 'bullish' ? 1 : report.bias === 'bearish' ? -1 : 0), 0);
  if (score >= 2) return 'bullish';
  if (score <= -2) return 'bearish';
  if (score !== 0) return 'mixed';
  return 'neutral';
}

export function buildAnalystState(
  coin: CoinData,
  whaleTrades: WhaleTrade[],
  regime?: RegimeReading | null,
): AgentMarketState {
  const change = coin.change ?? 0;
  const whaleBias = (coin.score ?? 0) >= 60 ? 'bullish' : (coin.score ?? 0) <= 35 ? 'bearish' : 'neutral';
  const flowTrades = whaleTrades.filter((trade) => trade.sym.toUpperCase().startsWith(coin.symbol.toUpperCase())).slice(0, 8);
  const buyFlow = flowTrades.filter((trade) => trade.side.toLowerCase().includes('buy')).reduce((sum, trade) => sum + trade.usdt, 0);
  const sellFlow = flowTrades.filter((trade) => trade.side.toLowerCase().includes('sell')).reduce((sum, trade) => sum + trade.usdt, 0);
  const flowBias = buyFlow > sellFlow * 1.15 ? 'bullish' : sellFlow > buyFlow * 1.15 ? 'bearish' : 'neutral';
  const regimeBias = regime?.score >= 60 ? 'bullish' : regime?.score <= 40 ? 'bearish' : 'neutral';
  const reports: AnalystReport[] = [
    {
      analyst: 'technical', label: 'TECHNICAL DESK', bias: change > 2 ? 'bullish' : change < -2 ? 'bearish' : 'neutral',
      confidence: confidence(50 + Math.abs(change) * 5),
      thesis: change > 2 ? 'Momentum is expanding to the upside.' : change < -2 ? 'Momentum is deteriorating and downside pressure is active.' : 'Price action is range-bound without a decisive impulse.',
      evidence: [`24h change ${change >= 0 ? '+' : ''}${change.toFixed(2)}%`, `Volume/mcap ${Math.round(coin.vmcap ?? 0)}%`], riskFlags: Math.abs(change) > 12 ? ['Extended daily move'] : [],
    },
    {
      analyst: 'flow', label: 'WHALE FLOW DESK', bias: flowBias, confidence: confidence(flowTrades.length ? 55 + Math.abs(buyFlow - sellFlow) / Math.max(buyFlow + sellFlow, 1) * 35 : 35),
      thesis: flowTrades.length ? `${buyFlow >= sellFlow ? 'Buy' : 'Sell'}-side whale flow leads recent prints.` : 'No recent symbol-specific whale prints are available.',
      evidence: [`${flowTrades.length} recent whale prints`, `Buy $${Math.round(buyFlow).toLocaleString()} · Sell $${Math.round(sellFlow).toLocaleString()}`], riskFlags: coin.threat === 'CRITICAL' ? ['Critical whale threat'] : [],
    },
    {
      analyst: 'sentiment', label: 'SENTIMENT DESK', bias: whaleBias, confidence: confidence(40 + (coin.score ?? 0) * 0.55),
      thesis: coin.reasons?.[0] ?? 'Sentiment proxy is inconclusive; treat the signal as unconfirmed.', evidence: [`Whale signal score ${Math.round(coin.score ?? 0)}/100`, coin.threat ? `Threat ${coin.threat}` : 'Threat unavailable'], riskFlags: coin.category ? [coin.category] : [],
    },
    {
      analyst: 'fundamentals', label: 'REGIME & FUNDAMENTALS', bias: regimeBias, confidence: confidence(regime ? 50 + Math.abs(regime.score - 50) : 30),
      thesis: regime ? `${regime.regime} regime with ${regime.agreeing}/${regime.active} signals agreeing.` : 'Market-wide regime data is not available for this read.', evidence: regime?.reasons?.slice(0, 2) ?? ['Awaiting regime confirmation'], riskFlags: regime?.tier !== 'confirmed' ? ['Regime not confirmed'] : [],
    },
  ];
  return { generatedAt: new Date().toISOString(), symbol: coin.symbol.toUpperCase(), reports, consensus: consensus(reports), confidence: confidence(reports.reduce((sum, report) => sum + report.confidence, 0) / reports.length) };
}

export function formatAnalystState(state: AgentMarketState) {
  return state.reports.map((report) => `${report.label}: ${report.bias.toUpperCase()} (${report.confidence}%). ${report.thesis}`).join('\n');
}

export function analystStateToPrompt(state: AgentMarketState) {
  return `SHARED ANALYST STATE (${state.symbol}, ${state.consensus.toUpperCase()} ${state.confidence}%):\n${formatAnalystState(state)}`;
}

export type { AgentMarketState, AnalystReport };
