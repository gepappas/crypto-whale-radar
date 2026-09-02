const DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';
const LATENCY_LIMIT_MS = 500;
const FAILURE_COOLDOWN_MS = 30_000;

interface ProviderState { failures: number; unhealthyUntil: number; lastLatencyMs: number | null }

export class RpcFallbackManager {
  private readonly providers: string[];
  private readonly state = new Map<string, ProviderState>();
  private cursor = 0;

  constructor(providers: string[] = []) {
    this.providers = [...new Set([...(providers.filter(Boolean)), DEFAULT_RPC])];
    for (const provider of this.providers) this.state.set(provider, { failures: 0, unhealthyUntil: 0, lastLatencyMs: null });
  }

  private candidates() {
    const now = Date.now();
    return this.providers
      .map((url, index) => ({ url, index, state: this.state.get(url)! }))
      .filter(({ state }) => state.unhealthyUntil <= now)
      .sort((a, b) => (a.state.lastLatencyMs ?? Infinity) - (b.state.lastLatencyMs ?? Infinity));
  }

  async request<T>(method: string, params: unknown[] = []): Promise<T> {
    const ordered = this.candidates();
    if (!ordered.length) throw new Error('All RPC providers are temporarily unhealthy');
    const start = this.cursor++ % ordered.length;
    const attempts = [...ordered.slice(start), ...ordered.slice(0, start)];
    let lastError: unknown;
    for (const candidate of attempts) {
      const began = performance.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);
        const response = await fetch(candidate.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }), signal: controller.signal });
        clearTimeout(timeout);
        if (response.status === 429 || response.status >= 500) throw new Error(`RPC ${response.status}`);
        const payload = await response.json() as { result?: T; error?: { message?: string } };
        if (payload.error) throw new Error(payload.error.message || 'RPC request failed');
        const latency = Math.round(performance.now() - began);
        candidate.state.lastLatencyMs = latency;
        candidate.state.failures = 0;
        if (latency > LATENCY_LIMIT_MS) candidate.state.unhealthyUntil = Date.now() + FAILURE_COOLDOWN_MS;
        return payload.result as T;
      } catch (error) {
        lastError = error;
        candidate.state.failures += 1;
        candidate.state.unhealthyUntil = Date.now() + Math.min(FAILURE_COOLDOWN_MS * candidate.state.failures, 120_000);
      }
    }
    throw lastError instanceof Error ? lastError : new Error('RPC request failed');
  }
}

export const rpcFallback = new RpcFallbackManager(
  (import.meta.env.VITE_SOLANA_RPC_URLS as string | undefined)?.split(',').map((value) => value.trim()) ?? [],
);
