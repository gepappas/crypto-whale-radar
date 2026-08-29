/**
 * Binance REST endpoints are frequently unreachable straight from the browser
 * (regional blocks / missing CORS headers on error responses), which surfaces as
 * a bare "TypeError: Failed to fetch". Route every REST read through the
 * server-side proxy edge function, which already allowlists api.binance.com.
 *
 * WebSocket streams are unaffected and keep connecting directly.
 */
const PROXY = `https://${
  import.meta.env.VITE_SUPABASE_PROJECT_ID
}.functions.supabase.co/coingecko-proxy`;

const DIRECT_ALLOWED_HOSTS = new Set([
  'api.binance.com',
  'data-api.binance.vision',
  'api.bybit.com',
  'www.okx.com',
  'api.kraken.com',
  'api.exchange.coinbase.com',
  'api.gateio.ws',
]);

export function proxied(url: string): string {
  if (!import.meta.env.VITE_SUPABASE_PROJECT_ID) return url;
  try {
    const host = new URL(url).hostname;
    if (!DIRECT_ALLOWED_HOSTS.has(host)) return `${PROXY}?url=${encodeURIComponent(url)}`;
  } catch {
    return `${PROXY}?url=${encodeURIComponent(url)}`;
  }
  return url;
}
