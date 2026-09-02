import type { CoinData } from './whaleRadarState';

export interface DynamicAlertThresholds {
  volumeToMcapPct: number;
  priceChangePct: number;
  whaleNotionalUsd: number;
}

/**
 * Scales alert sensitivity to the token's liquidity context. High-turnover,
 * large-cap assets need stronger relative moves; thin small-cap assets remain
 * visible without using an unsafe fixed dollar threshold.
 */
export function getDynamicAlertThresholds(
  marketCap: number,
  volume24h: number,
  base: Pick<DynamicAlertThresholds, 'volumeToMcapPct' | 'priceChangePct' | 'whaleNotionalUsd'>,
): DynamicAlertThresholds {
  const mcap = Math.max(marketCap, 10_000);
  const volume = Math.max(volume24h, 0);
  const turnover = volume / mcap;
  const sizeFactor = Math.min(2, Math.max(0.65, Math.log10(mcap / 10_000) / 5));
  const activityFactor = Math.min(1.35, Math.max(0.7, Math.sqrt(Math.max(turnover, 0.01) / 0.25)));
  return {
    volumeToMcapPct: Math.round(Math.max(5, base.volumeToMcapPct * sizeFactor / activityFactor)),
    priceChangePct: Math.round(Math.max(3, base.priceChangePct * sizeFactor)),
    whaleNotionalUsd: Math.round(Math.max(1_000, Math.min(base.whaleNotionalUsd * 10, base.whaleNotionalUsd * sizeFactor * activityFactor))),
  };
}

export function getCoinAlertThresholds(coin: Pick<CoinData, 'mcap' | 'volume'>, base: Pick<DynamicAlertThresholds, 'volumeToMcapPct' | 'priceChangePct' | 'whaleNotionalUsd'>) {
  return getDynamicAlertThresholds(coin.mcap, coin.volume, base);
}
