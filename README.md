# Crypto Whale Radar

Real-time crypto intelligence platform: whale-transaction tracking, market-manipulation detection, Hyperliquid perps analytics, orderflow scanning, and an AI "council" of trading agents — built as a React/TypeScript SPA with optional Express + Postgres backend.

Detects unusual whale activity, evaluates manipulation risk, and surfaces market transitions through a 24/7 early-warning system. Combines live market feeds, technical analysis, AI-driven signal generation, and optional trading automation under human control.

![Version](https://img.shields.io/badge/version-0.0.1-blue)
![React](https://img.shields.io/badge/React-18.3-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-5.4-646CFF?logo=vite)

> **Risk warning:** Cryptocurrency trading is highly speculative and can result in total loss. This software is for research and engineering purposes. Keep dry-run mode enabled until you have independently reviewed the code, infrastructure, exchange permissions, and all risk controls.

## Documentation

- [Changelog](./CHANGELOG.md) — release history and notable implementation changes
- [Roadmap](./ROADMAP.md) — current product direction and planned work
- [Hyperliquid deployment](./HYPERLIQUID_DEPLOY.md)
- [Nexus MCP server](./mcp-nexus-bot/README.md)

## What's New

The latest changes are documented in [`CHANGELOG.md`](./CHANGELOG.md). This keeps the main project guide focused on setup and usage while preserving the full engineering history separately.

## Highlights

- Whale Radar scanner for manipulation candidates and threat scoring
- Live whale activity and exchange order-flow views with frame-paced RAF buffering for bursty streams
- Wallet tracker with heuristic CEX, MEV/bot, fresh-wallet, and smart-money tags
- Trading Hub with technical analysis, screening, sentiment, timeframes, patterns, and backtesting
- Hyperliquid explorer, wallet tracking, block and transaction views, and opportunity panels
- Nexus terminal for whale watch, arbitrage, grid strategies, volume making, portfolio views, and the Crystal Ball signal engine
- Persistent alerts, tracked tokens, scan sessions, portfolios, whale events, and signal outcomes
- Forward-looking signal evaluation at 1-hour, 4-hour, and 24-hour horizons
- Optional browser push notifications
- Optional CCXT execution bridge and Freqtrade strategy bridge
- MCP server for operating Nexus through Claude Desktop, Claude Code, or another MCP client
- Defensive execution controls: bearer authentication, dry-run defaults, cooldowns, sizing limits, and live-trading confirmation gates
- AI execution safety: disabled/shadow/live modes, human approval queue, risk caps, cooldowns, and local audit history

## Architecture

```text
┌──────────────────────────────┐
│ React + Vite frontend         │
│ src/                          │
└──────────────┬───────────────┘
               │ /api (Vite proxy in development)
               ▼
┌──────────────────────────────┐
│ Express API                   │
│ server/                       │
└──────────────┬───────────────┘
               │
               ▼
┌──────────────────────────────┐
│ PostgreSQL                    │
│ scans, alerts, portfolio,    │
│ tracked tokens, outcomes     │
└──────────────────────────────┘
```

The frontend also consumes public market and blockchain sources, including Hyperliquid, Binance, Bybit, CoinGecko, RugCheck, Ethplorer, and DexScreener where the relevant feature requires them. Supabase can optionally provide the Hyperliquid cache and edge-function bridges.

## Technology

### Frontend

- React 18
- Vite 5
- TypeScript
- React Router
- Tailwind CSS
- TanStack Query
- Recharts
- Radix UI primitives and shadcn-style components
- Vitest and Playwright

### Backend

- Node.js
- Express
- TypeScript
- PostgreSQL via `pg`
- CCXT for supported exchange integrations
- `web-push` for browser notifications

## Requirements

- Node.js 18+ recommended
- Bun 1.3.8 (canonical package manager; workspace-aware)
- PostgreSQL for persistence and API-backed features
- Optional: Supabase CLI for edge functions and local Supabase development
- Optional: Railway or another Node-compatible host for the Express API

## Getting started

### 1. Install dependencies

Bun is the canonical package manager for the root project and the `mcp-nexus-bot` workspace:

```bash
bun install --frozen-lockfile
bun run dev
```

For the MCP workspace:

```bash
bun --cwd mcp-nexus-bot run build
```

```

### 2. Configure the frontend

Copy the example environment file:

```bash
cp .env.example .env.local
```

For basic frontend development, the app can run without the optional Supabase and trading variables. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` when using the custom Hyperliquid cache or Supabase-backed features.

### 3. Start the frontend

```bash
npm run dev
```

The Vite development server normally runs on `http://localhost:8080`.

### 4. Start the API server

Install the API dependencies and start it in a second terminal:

```bash
cd server
npm install
npm run dev
```

The API defaults to `http://localhost:3001`.

To run both services from the project root:

```bash
npm run dev:all
```

The Vite configuration proxies `/api` requests to the local API server.

## Database setup

The API uses PostgreSQL. Set `DATABASE_URL` in the API server environment, then run the base schema:

```bash
npm run db:migrate
```

This executes `server/schema.sql`. Incremental changes are stored in `server/migrations/`; apply any migrations that are not already present in your database.

The schema includes:

- `scan_sessions` and `scan_coins` for scan history
- `portfolio` and `tracked_tokens` for portfolio/watchlist data
- `alerts` and `whale_events` for persistent market activity
- `signal_outcomes` for forward performance measurement
- Views including `v_latest_scan`, `v_top_threats`, `v_portfolio_live`, and `v_signal_eval`

For a production deployment, use a migration process appropriate to your hosting provider rather than relying on ad-hoc schema changes.

## Environment variables

Never commit secrets. The root `.env.example` documents the complete configuration surface.

### API and database

| Variable | Required | Purpose |
|---|---:|---|
| `DATABASE_URL` | API features | PostgreSQL connection string |
| `API_AUTH_TOKEN` | Production API | Shared bearer token for protected routes |
| `API_PORT` | No | Express port; defaults to `3001` |
| `CORS_ORIGIN` | Production | Comma-separated allowed frontend origins |
| `COINGECKO_API_KEY` | Optional | CoinGecko access for price-filling jobs |

The public API routes are intentionally limited. Protected routes require:

```http
Authorization: Bearer <API_AUTH_TOKEN>
```

Do not expose `API_AUTH_TOKEN` through a `VITE_` variable or browser code.

### Optional frontend/Supabase cache

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key |

### Nexus execution bridge

Configure these on the API server only unless the variable is explicitly a Supabase secret:

- `NEXUS_DRY_RUN` — defaults to safe dry-run behavior
- `NEXUS_LIVE_TRADING_CONFIRM=I_UNDERSTAND_THE_RISK` — required for live execution
- `NEXUS_COOLDOWN_MINUTES` — post-trade per-pair cooldown
- `NEXUS_GRID_POLL_MS` — grid worker polling interval
- Exchange credentials such as `BINANCE_API_KEY`, `BINANCE_API_SECRET`, `OKX_API_KEY`, `OKX_API_SECRET`, and `OKX_API_PASSPHRASE`

Only configure credentials for exchanges you intend to use. Use the smallest possible exchange permissions and never enable withdrawals.

### Optional Freqtrade bridge

- `FREQTRADE_API_URL`
- `FREQTRADE_API_USERNAME`
- `FREQTRADE_API_PASSWORD`
- `NEXUS_STRATEGY_MAX_STAKE_USD`

Freqtrade's own `dry_run` setting controls whether Freqtrade places real orders.

### Optional web push

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`

Generate VAPID keys with `npx web-push generate-vapid-keys`. Keep the private key on the API server only.

## Application routes

| Route | Description |
|---|---|
| `/` | Whale Radar dashboard |
| `/orderflow` | Order-flow and market activity view |
| `/trading-hub` | Trading dashboard |
| `/trading-hub/technical` | Technical analysis |
| `/trading-hub/backtest` | Strategy backtesting |
| `/trading-hub/screener` | Market screener |
| `/trading-hub/sentiment` | Sentiment analysis |
| `/trading-hub/timeframes` | Multi-timeframe analysis |
| `/trading-hub/patterns` | Pattern analysis |
| `/nexus/whale` | Nexus whale watch |
| `/nexus/arbitrage` | Nexus arbitrage command center |
| `/nexus/grid` | Grid strategy studio |
| `/nexus/volume` | Volume maker |
| `/nexus/portfolio` | Nexus portfolio |
| `/nexus/crystal-ball` | Signal and forecasting engine |

## API routes

The Express server exposes these route groups:

- `GET /api/health` — dependency-free process health check
- `GET /api/health/db` — PostgreSQL health check
- `/api/scan` — run a scan; public read endpoint used by the SPA
- `/api/scans` — scan history and results
- `/api/portfolio` — portfolio data
- `/api/tracked` — tracked-token/watchlist data
- `/api/alerts` — alert history and outcomes
- `/api/whale-events` — persisted whale events
- `/api/whales` — whale data and summaries
- `/api/signal-outcomes` — signal recording, evaluation, and price filling
- `/api/nexus-bot` — guarded bot status, portfolio, grids, and execution actions
- `/api/push` — push subscription and notification endpoints

Most routes require `API_AUTH_TOKEN`. Check the route implementation before exposing a new endpoint publicly.

## Production deployment

### Frontend

Build the static frontend:

```bash
npm run build
```

Serve the generated `dist/` directory with a static host, or deploy it to a platform that supports Vite applications. Configure the SPA fallback so application routes resolve to `index.html`.

### Express API

Build and start the API:

```bash
npm run build:server
cd server
npm start
```

Set `DATABASE_URL`, `API_AUTH_TOKEN`, and `CORS_ORIGIN` in the API host. Confirm that the frontend origin is included in `CORS_ORIGIN` and that secrets are not included in the frontend build.

### Railway

The repository includes a `Procfile` and a dedicated `server/` package. Deploy the API as its own service, provide the API/database variables, and set the frontend's API base or proxy according to your hosting topology.

### Hyperliquid cache

For the optional Supabase cache and edge-function setup, see [`HYPERLIQUID_DEPLOY.md`](./HYPERLIQUID_DEPLOY.md). The cache is not required for the basic frontend to render; the UI shows an error state when its optional configuration is unavailable.

## Development commands

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite frontend |
| `npm run dev:api` | Start the Express API from the root |
| `npm run dev:all` | Start frontend and API together |
| `npm run build` | Build the frontend and prerender shells |
| `npm run build:server` | Install and TypeScript-build the API |
| `npm run lint` | Run ESLint |
| `npm run test` | Run the Vitest suite once |
| `npm run test:watch` | Run Vitest in watch mode |
| `npm run preview` | Preview the production frontend build |
| `npm run db:migrate` | Apply `server/schema.sql` using `DATABASE_URL` |
| `npm run fill-prices` | Request signal outcome price filling locally |

## AI execution safety

AI-initiated execution is separated from the intelligence dashboard and defaults to `disabled`. The Nexus safety panel supports `disabled`, `shadow`, and `live` modes, with live intents gated by human approval, AI-specific notional caps, per-pair cooldowns, and an append-only local audit trail. These controls do not place trades during normal verification; keep both AI and exchange execution in dry-run mode until the full deployment is independently reviewed.

## Nexus MCP server

The optional `mcp-nexus-bot/` package exposes Nexus tools to MCP-compatible clients. Set up and build it with:

```bash
cd mcp-nexus-bot
npm install
npm run build
```

Configure `NEXUS_BOT_API_URL` and `NEXUS_BOT_API_TOKEN` in your MCP client. See [`mcp-nexus-bot/README.md`](./mcp-nexus-bot/README.md) for the available tools and client configuration.

Keep the API in dry-run mode while testing the MCP integration.

## Security and operational guidance

- Keep `NEXUS_DRY_RUN` enabled by default.
- Treat live-trading confirmation as a deliberate operational change, not a normal environment toggle.
- Use exchange API keys without withdrawal permissions.
- Keep API, database, exchange, VAPID, and Freqtrade credentials server-side.
- Set a strong random `API_AUTH_TOKEN` and use HTTPS in production.
- Restrict `CORS_ORIGIN` to known frontend origins.
- Monitor the API health endpoint, database connectivity, worker logs, rate limits, and exchange responses.
- Review all bot gates before enabling live trading.
- Do not assume a backtest or signal win rate predicts future performance.

## Troubleshooting

### The frontend loads but data is missing

Confirm the relevant public API or Supabase variables are configured, then inspect the browser Network panel. For API-backed data, verify that the Express server is running and that Vite is proxying `/api` to port `3001`.

### The API returns `503 Server auth not configured`

Set `API_AUTH_TOKEN` on the API server and restart it. Protected routes intentionally fail closed when the token is missing.

### The API returns `401 Unauthorized`

Send the token as a bearer token and verify it matches the API server value exactly:

```bash
curl -H "Authorization: Bearer $API_AUTH_TOKEN" http://localhost:3001/api/portfolio
```

### Database checks fail

Verify `DATABASE_URL`, network access, and that `server/schema.sql` plus required migrations have been applied. Use `/api/health` to distinguish process health from `/api/health/db` database health.

### Hyperliquid cache requests fail

Review [`HYPERLIQUID_DEPLOY.md`](./HYPERLIQUID_DEPLOY.md), especially edge-function deployment, Supabase variables, and the rate limit/cache table migrations.

## Project structure

```text
src/
  components/       Reusable dashboard, Nexus, Hyperliquid, and UI components
  hooks/            Market data, websocket, scanner, and trading hooks
  pages/            Route-level screens
  integrations/     Supabase client and integration helpers
  lib/              Shared analysis, caching, and calculation utilities
server/
  routes/           Express API route groups
  services/         Trading, scanning, push, and worker services
  migrations/       Incremental PostgreSQL migrations
  schema.sql        Base PostgreSQL schema
mcp-nexus-bot/      Optional MCP wrapper for Nexus bot operations
public/             Static assets, manifests, OpenAPI metadata, and service worker
```

## License

This project is licensed under the MIT License. See the repository's license file or distribution terms for the applicable copyright notice.

## Disclaimer

Crypto Whale Radar does not provide financial, investment, tax, or legal advice. You are solely responsible for your decisions, funds, credentials, infrastructure, and compliance obligations. Use at your own risk.
