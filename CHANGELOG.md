# Changelog

All notable changes to Crypto Whale Radar are documented here.

The project follows a practical, source-based changelog: entries describe changes that are implemented in the repository, including migrations, reliability fixes, product capabilities, and important operational decisions.

## Unreleased

- Added wallet classification tags for CEX wallets, MEV/arbitrage bots, fresh wallets, and skill-scored smart money.
- Surfaced wallet categories in the Whale Radar wallet tracker while retaining heuristic labels until server-backed intelligence is available.
- Standardized the repository on Bun 1.3.8, removed npm lockfile drift, and added the `mcp-nexus-bot` workspace.
- Added strict package-manager and local AI/session ignore policies.
- Added Zod validation for public Supabase configuration and MCP bridge environment variables without logging secrets.
- Added GitHub Actions CI jobs for frontend type-checking/linting, Playwright E2E, and MCP compilation.
- Fixed the TanStack Query workspace dependency required by the production Vite build.
- Added RAF-buffered, frame-paced delivery for whale WebSocket and stream callbacks, with bounded queues and teardown cleanup.
- Completed the first Phase 1 performance milestone; feed virtualization and Web Worker signal calculations remain planned after measuring the actual high-cardinality render paths.
- Added AI execution safety controls with disabled, shadow, and live modes, fail-closed defaults, and normalized risk settings.
- Added a human approval queue for AI execution intents with approve/reject actions and recent audit visibility.
- Added AI-specific notional caps, per-pair cooldown enforcement, and requested/approved/rejected/blocked/executed audit events.
- Integrated an AI arbitrage entry point with the existing Nexus protection chain while preserving manual execution paths.
- Documented the next architecture milestone: durable server-side regime monitoring and trade-ledger reconciliation.
- Documentation reorganized from the prototype repository format.
- Main project guide refreshed for the upgraded `crypto-whale-radar` repository.
- Roadmap and release history split into [`ROADMAP.md`](./ROADMAP.md) and this file.
- Supabase/Vite environment compatibility documented and supported through the Vite configuration.

## v9.43 — Edge-function migration series continued

- Migrated the `whale-events`, public `whales`, and `scans` vertical slices to Supabase Edge Function target implementations.
- Added database views for whale-event summaries and top scan threats.
- Replaced dynamically generated multi-row SQL placeholders with native Supabase bulk inserts, eliminating an entire class of offset bugs.
- Preserved the public `whales` GET interface and its intentional no-JWT deployment requirement.
- Kept the existing Express routes unchanged until a tested production cutover.

## v9.42 — Signal outcomes

- Added a Supabase Edge Function target for signal recording and outcome evaluation.
- Added an RPC for expression-index deduplication when recording signal fires.
- Added scheduled 1-hour, 4-hour, and 24-hour price filling through `pg_cron` and `pg_net`.

## v9.41 — Portfolio and tracked tokens

- Added Supabase target implementations for portfolio and tracked-token operations.
- Added a portfolio PnL view for latest scan data.
- Added an atomic tracked-token upsert RPC that preserves an existing `coin_id` when omitted.

## v9.40 — Production architecture mapping

- Migrated alerts to a Supabase Edge Function target with atomic pin toggling and scheduled price filling.
- Documented which routes are suitable for Edge Functions and which correctly remain Express-only because they need persistent workers or execution bridges.
- Identified unused market-data edge-function surface area for future cleanup.

## v9.39 — Production hygiene

- Removed hidden fabricated price fallbacks from Crystal Ball analysis.
- Replaced fabricated insider-risk fallback rows with explicit no-data states.
- Hardened the whale-stream lifecycle with `waitUntil`, stale-instance protection, connection timeouts, and a silent-death watchdog.
- Removed redundant client-side Binance streaming while retaining a real fallback path.

## v9.38 — Persistence tiers

- Added EARLY, DEVELOPING, and CONFIRMED regime persistence tiers.
- Changed regime alerts to fire once per tier within a regime streak.
- Escalated actionable alert severity as persistence increases.

## Earlier releases

Earlier product work includes the regime engine, signal-family grouping, regime backtesting, relative-strength and liquidity signals, decision-outcome tracking, multi-channel alerts, wallet activity tracking, AI Council enhancements, Hyperliquid analytics, Nexus execution safeguards, Freqtrade integration, push notifications, PWA support, and MCP access.

For the full historical detail from the prototype branch, consult the repository history and the source changes associated with each release.

## Versioning notes

Version labels in historical entries reflect the prototype release series. The upgraded repository uses the current package metadata and deployment versioning independently from the prototype labels.
