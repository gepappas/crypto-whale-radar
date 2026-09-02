import type { WalletEntry } from './whaleRadarState';

export type WalletTag = 'CEX' | 'MEV' | 'SMART_MONEY' | 'FRESH' | 'TRACKED';

const CEX_NAMES = /binance|coinbase|kraken|okx|bybit|exchange|cex/i;
const MEV_NAMES = /mev|arb|arbitrage|bot|market.?maker/i;

export function inferWalletTag(wallet: Pick<WalletEntry, 'label' | 'skillScore' | 'closedTrades' | 'lastActivity' | 'recentTxCount24h'>): WalletTag {
  const label = wallet.label || '';
  if (CEX_NAMES.test(label)) return 'CEX';
  if (MEV_NAMES.test(label)) return 'MEV';
  if ((wallet.skillScore ?? 0) >= 70 && (wallet.closedTrades ?? 0) >= 5) return 'SMART_MONEY';
  if (wallet.lastActivity && Date.now() - Date.parse(wallet.lastActivity) < 7 * 86_400_000 && (wallet.recentTxCount24h ?? 0) <= 3) return 'FRESH';
  return 'TRACKED';
}

export const WALLET_TAG_LABELS: Record<WalletTag, string> = {
  CEX: 'CEX', MEV: 'MEV/BOT', SMART_MONEY: 'SMART MONEY', FRESH: 'FRESH', TRACKED: 'TRACKED',
};
