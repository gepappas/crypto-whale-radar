# Roadmap

Crypto Whale Radar is being developed as a personal 24/7 crypto early-warning system: detect that market conditions are starting to shift, explain why, and hand the decision to a human. Automatic execution remains optional and deliberately separated from the core intelligence product.

## Current product direction

The project prioritizes confidence over prediction and transition detection over price-target calling. The primary output is a clear market read such as: "independent signals agree and the regime moved from NEUTRAL to EARLY BULL."

## Completed repository hardening

- Bun 1.3.8 is the canonical package manager with a synchronized `bun.lock`.
- Root workspaces now include `mcp-nexus-bot`.
- Added strict package-manager policy and ignored local AI/session artifacts.
- Added Zod validation for public Supabase configuration and MCP bridge environment variables.
- Added GitHub Actions coverage for frontend checks, Playwright, and MCP compilation.

## P0 — Next priority

### Enterprise data-layer hardening

- **Completed:** Solana RPC fallback manager with provider health scoring, 500ms latency threshold, rate-limit/error detection, bounded cooldowns, and automatic failover via `VITE_SOLANA_RPC_URLS`.
- **Completed:** Generic exchange WebSocket reconnection now uses capped exponential backoff with jitter.
- **Completed:** Generic exchange-feed trades use bounded in-memory deduplication; chain-native transaction-hash dedupe remains planned for server-side feeds.
- **Existing:** The primary whale WebSocket hook already has capped backoff, jitter, fallback polling, and circuit-breaker behavior.
- **Completed:** Initial wallet tagging for CEX labels, MEV/arbitrage bots, fresh wallets, and skill-scored smart money; tags are surfaced in the wallet tracker.
- **Planned:** Replace heuristic tags with server-backed address intelligence and clustering, including cross-chain bridge attribution.
- **Planned:** Dynamic alert thresholds derived from token market cap and 24-hour volume.
- **Planned:** Cross-chain bridge tracking for Arbitrum Bridge, LayerZero, Wormhole, and compatible bridge event signatures.

### Enterprise frontend and real-time UX

- **Planned:** Virtualize confirmed high-cardinality live-feed rows with `@tanstack/react-virtual`.
- **Planned:** Decouple high-frequency stream state from the main render cycle using a focused external store/query cache while preserving the existing RAF buffering.
- **Planned:** Optional Web Push and sound notifications with explicit permission, per-alert controls, and service-worker lifecycle handling.

### MCP bot infrastructure and security

- **Planned:** Queue and rate-limit Telegram, Discord, and X/Twitter notifications with retries, backpressure, and provider-specific quotas.
- **Planned:** Keep private keys and provider credentials server-only; audit frontend bundles and route sensitive calls through backend/MCP proxies.
- **Planned:** Add an authenticated `/health` endpoint exposing process and stream liveness for external monitoring.


### Performance and real-time stream optimization

- **Completed:** RAF-buffered WebSocket delivery with bounded queues and teardown cleanup.
- **Next:** Add virtualization only to confirmed high-cardinality whale/order-flow row containers.
- **Next:** Move pure whale swarm and signal-outcome calculations into a typed Web Worker with a synchronous fallback.

### Durable regime monitoring and reconciliation

Move the remaining browser-owned monitoring and execution-adjacent state toward durable server-side services. The first milestone is the 24/7 regime engine; the second is durable trade-ledger reconciliation so bot restarts and closed browser tabs cannot lose operational state.

### Server-side 24/7 regime engine

Move regime monitoring out of browser-only React state into a server-side or scheduled architecture that continues working when all browser tabs are closed.

Expected capabilities:

- Collect market signals on a server or scheduled Edge Function.
- Compute and persist regime state in Supabase/Postgres.
- Maintain durable regime history for backtesting and analysis.
- Dispatch Telegram/Discord alerts independently of an open browser tab.
- Let the dashboard read persisted state rather than own the monitoring loop.

This requires an architecture decision and Supabase deployment access.

## Delivery sequence

1. Stabilize data streams: RPC failover, WebSocket backoff, and transaction deduplication.
2. Add analytics enrichment: wallet clusters, dynamic thresholds, and bridge tracking.
3. Optimize the live UI: virtualization, decoupled state, and opt-in notifications.
4. Harden the MCP bot: notification queues, secret-boundary checks, and health monitoring.

All production changes should preserve dry-run defaults, avoid exposing secrets in frontend bundles, and include observable failure behavior.

## P1 — No remaining strategic gaps

The previously identified strategic items are shipped, including:

- Signal-family grouping.
- Backtesting of regime calls.
- BTC/ETH relative strength.
- Stablecoin and liquidity flow.
- Decision-outcome tracking.
- Three-tier persistence ladder.

## P2 — Longer-term opportunities

- Feed personal outcome learning back into signal weights.
- Adapt signal weights using accumulated historical performance.
- Expand the homepage beyond the current regime-panel placement.
- Continue improving optional execution features without making them the core product.

## Shipped AI safety controls

The AI-to-execution boundary now has a fail-closed safety layer:

- Tri-state AI trading mode: `disabled`, `shadow`, and `live`.
- Human approval queue for AI-initiated trades.
- Append-only local audit events for requested, approved, rejected, blocked, and executed intents.
- AI-specific notional caps and per-pair cooldown enforcement.
- Guarded AI arbitrage entry point integrated with existing Nexus protections.

These controls remain local/browser-scoped for now; durable server-side audit and approval state belongs to the P0 architecture work.

## Execution features

Nexus grid, arbitrage, volume-maker, Strategy Trader, Freqtrade, and related execution bridges remain available and protected by dry-run defaults, authentication, cooldowns, sizing limits, and live-trading confirmation gates. They are deprioritized rather than removed while the intelligence and early-warning system remains the main product direction.

## Guiding principles

1. Never present fabricated market data as real.
2. Prefer durable server-side state for 24/7 behavior.
3. Preserve human control over consequential actions.
4. Keep execution paths fail-closed and dry-run by default.
5. Document architectural tradeoffs rather than claiming an untested migration is live.
