# Roadmap

Crypto Whale Radar is being developed as a personal 24/7 crypto early-warning system: detect that market conditions are starting to shift, explain why, and hand the decision to a human. Automatic execution remains optional and deliberately separated from the core intelligence product.

## Current product direction

The project prioritizes confidence over prediction and transition detection over price-target calling. The primary output is a clear market read such as: "independent signals agree and the regime moved from NEUTRAL to EARLY BULL."

## P0 — Next priority

### Server-side 24/7 regime engine

Move regime monitoring out of browser-only React state into a server-side or scheduled architecture that continues working when all browser tabs are closed.

Expected capabilities:

- Collect market signals on a server or scheduled Edge Function.
- Compute and persist regime state in Supabase/Postgres.
- Maintain durable regime history for backtesting and analysis.
- Dispatch Telegram/Discord alerts independently of an open browser tab.
- Let the dashboard read persisted state rather than own the monitoring loop.

This requires an architecture decision and Supabase deployment access.

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

## Optional AI-safety candidates

These are real candidates if AI-to-execution wiring is expanded later. They are not required for the current human-led early-warning direction:

- Tri-state AI trading mode: `disabled`, `shadow`, and `live`.
- Human approval queue for AI-initiated trades.
- Audit log for every AI and MCP tool call, including rejected calls.
- AI-specific risk caps separate from general Nexus protections.

## Execution features

Nexus grid, arbitrage, volume-maker, Strategy Trader, Freqtrade, and related execution bridges remain available and protected by dry-run defaults, authentication, cooldowns, sizing limits, and live-trading confirmation gates. They are deprioritized rather than removed while the intelligence and early-warning system remains the main product direction.

## Guiding principles

1. Never present fabricated market data as real.
2. Prefer durable server-side state for 24/7 behavior.
3. Preserve human control over consequential actions.
4. Keep execution paths fail-closed and dry-run by default.
5. Document architectural tradeoffs rather than claiming an untested migration is live.
