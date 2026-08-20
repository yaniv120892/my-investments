# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

Single-user portfolio tracker replacing a hand-maintained Google Sheet. One
Next.js 15 (App Router) app holds the UI, the API routes, and the pricing
logic. It stores holdings, prices them live from free providers, and shows
allocation, target drift, rebalancing, and currency exposure in NIS.

Stack: Next.js 15 + React 19 + TypeScript, Prisma/Postgres, Upstash Redis
(quote and FX cache), Chart.js, Tailwind v4, Vitest.

Out of scope by design: cost basis and transactions, XIRR, dividends,
benchmark comparison, two-way sheet sync, multi-user.

## Commands

```bash
npm run dev              # Next dev server with Turbopack
npm run build            # prisma generate && next build
npm run lint             # next lint
npm test                 # test:unit — terminates, so the pre-push gate can run it
npm run test:watch       # vitest watch
npm run test:unit        # vitest run, excluding *.contract.test.ts
npm run test:contract    # the live-network contract tests only
npm run test:run         # everything, contract tests included
npm run db:migrate       # prisma migrate dev
npm run db:deploy        # prisma migrate deploy
npm run db:studio        # prisma studio
npm run setup            # db:generate && db:migrate
npm run db:import-sheet  # one-off importer, scripts/importFromSheet.ts
npm run snapshot:trigger # POST /api/snapshot against SNAPSHOT_BASE_URL
```

The Prisma schema lives at `src/prisma/schema.prisma`, not the default
location, so every Prisma command passes `--schema`. `postinstall` runs
`prisma generate`.

`npm test` is deliberately `test:unit` rather than `vitest`: watch mode never
exits, and the pre-push quality gate runs `npm run test`.

## Architecture

- `src/app/` — App Router. `(auth)/` login and signup; `(app)/` the six
  authenticated pages (dashboard, holdings, allocation, rebalancing, history,
  settings) inside the `AppShell` sidebar layout.
- `src/app/api/**/route.ts` — all endpoints. `auth/{login,logout,signup,verify}`,
  `holdings` (+ `[id]`, `history`, `manual-values`), `platforms`,
  `user/settings`, `snapshot`.
  Routes read the caller from the `x-user-id` header and return `{ error }`
  with a status; there is no shared handler wrapper.
- `src/middleware.ts` — the only place a session is verified. It reads the
  `auth-token` cookie, verifies the JWT with `src/lib/auth-edge.ts`, redirects
  unauthenticated page requests to `/login`, and sets `x-user-id` /
  `x-user-email` on authenticated `/api/*` requests.
- `src/lib/providers/` — one `PriceProvider` per remote `PriceSource`
  (`FinnhubProvider`, `BinanceProvider`, `MayaEtfProvider`, `MayaFundProvider`
  over the shared `mayaApi.ts`), each wrapped in `CachedPriceProvider` by
  `providerRegistry.ts`. `FxRateProvider` supplies rates to NIS.
- `src/lib/pricing/` — `portfolioPricingService.ts` (`priceHoldings`),
  `nisRateBook.ts` (per-run FX memoisation), `allocation.ts`,
  `supportedCurrencies.ts`.
- `src/lib/holdings/` — write path split into schemas (zod) → validator →
  service → repository, with typed errors mapped to responses by
  `holdingWriteErrorResponse.ts`.
- `src/lib/` — `db.ts` (Prisma + Accelerate), `redis.ts`, `auth.ts`,
  `auth-edge.ts`, `emailService.ts`, `telegramNotifier.ts`,
  `snapshotAuthorization.ts`, `usePortfolioView.ts`, `hooks.ts` +
  `queryClient.ts` (TanStack Query).
- `src/components/` — `shell/` (AppShell, PageHeader), `dashboard/` cards,
  and the shared pieces. `DisplayCurrencyProvider` + `CurrencyToggle` hold the
  display currency; `PricingFailuresAlert` renders what could not be priced and
  `StaleManualValuesAlert` what has not been re-read lately, with
  `ManualValuesModal` as the monthly review form. `PortfolioChart` defers to
  `PortfolioChartCanvas` so Chart.js only loads when a chart is actually on
  screen.
- `src/theme.ts`, `src/utils/` (pure helpers), `src/types/`.

## Key invariants

- **A total is never rendered from incomplete data.** `priceHoldings` returns
  `totalValueNis: null` whenever `failures` is non-empty, alongside
  `pricedValueNis` and the failure list. The UI shows the failures and
  suppresses the total. Do not add a fallback that sums what priced.
- **Pricing is explicitly routed, never inferred.** Each holding carries its
  own `priceSource`, `sourceSymbol`, and `currency`; the registry maps source
  to provider. `fetchQuote` throws on failure and never returns null, and no
  provider substitutes for another — a price from the wrong exchange is much
  harder to notice than a hard failure.
- **Maya's two products live on endpoints that do not overlap**, and an id the
  endpoint does not serve returns a WAF 403 as often as a 404 — so a caller
  cannot tell "wrong product" from "blocked" and must not guess. That is why
  `MAYA_ETF` and `MAYA_FUND` are separate price sources, each naming exactly
  one endpoint. Maya quotes are in agorot: multiply by 0.01.
- **The `MAYA_HEADERS` in `mayaApi.ts` are load-bearing.** `mayaapi.tase.co.il`
  serves only what looks like its own front end; without `X-Maya-With` *and*
  `Accept-Language` the same request 403s from Node while succeeding from curl.
  Change nothing there without re-running `mayaApi.contract.test.ts`.
- **FX is memoised per pricing run, and a failure is fatal to the holding.**
  `NisRateBook` keys on the in-flight promise so concurrent callers share one
  lookup, and evicts on failure so one blip does not condemn the rest of the
  run. The USD rate is always fetched, even with no USD holding, because the
  dashboard converts every displayed figure with it. The bug that prompted
  this design summed raw USD into a NIS total by using a missing rate as a
  truthiness guard, understating the portfolio by 37%.
- **Only NIS, USD, and EUR convert.** `SUPPORTED_CURRENCIES` is the whole list;
  anything else throws rather than passing through unconverted.
- **Quote failures are deliberately not cached.** `CachedPriceProvider` caches
  successes for the FX TTL only, so a recovered upstream is picked up at once
  instead of after an hour. The cost is that an outage leaves a holding with no
  price rather than a stale one — which is what turns a bad provider day into a
  skipped snapshot.
- **A manual value is a reading, not a price.** `PATCH /api/holdings/manual-values`
  re-stamps `manualValueUpdatedAt` on every line of the review, including one
  whose number did not move: the owner is asserting what the statement says
  today. `PATCH /api/holdings/[id]` does the opposite and re-stamps only on a
  change, so renaming an asset cannot pass an old value off as a fresh reading.
  A review is validated whole and written whole — a monthly pass that
  half-applies leaves the table unreadable. Anything past
  `MANUAL_VALUE_MAX_AGE_DAYS` (35, a month plus slack) is shown as stale;
  nothing else in the app notices an old manual value, because it never fails
  to price.
- **`x-user-id` and `x-user-email` are proof of authentication**, so the
  middleware strips any client-sent copy on every path where it does not set
  them itself. Never trust them from a request the middleware did not process.
- `GET /api/snapshot` accepts the `CRON_SECRET` bearer token only — never a
  session — because Vercel Cron can only issue GETs and a session-authorized
  GET would be triggerable cross-site. `POST` accepts either.
- Non-critical side effects (cache writes, Telegram notifications) are caught
  and logged; they never fail the read path. Pricing failures are logged at
  error level because a run that prices 22 of 29 holdings otherwise looks
  identical in the logs to a complete one.
- Redis is a cache, not a store: `getCachedData` swallows errors and returns
  null, so every read path must work with the cache down.

## Testing

The providers are the entire risk surface; the rest is arithmetic.

- `*.contract.test.ts` run against the live APIs and assert shape plus a sane
  price range. They exist to catch Maya's WAF rules shifting and Finnhub
  changing its free-tier policy. Excluded from `test:unit` because they need
  network and a key; run them with `npm run test:contract`.
- Unit tests mock the network through `__tests__/mockFetch.ts` and JSON
  fixtures. The pricing suite must keep covering the case that caused the
  rewrite: FX unavailable fails, and never falls through to summing mixed
  currencies.

## Database (Prisma)

Postgres via `@prisma/client` + Accelerate. Models: `User`, `Settings`
(baseCurrency, darkMode), `Platform` (unique per `[userId, name]`), `Holding`,
`HoldingSnapshot` (unique per `[holdingId, date]`).

Enums: `AssetClass` (EQUITY | CRYPTO | NON_EQUITY), `Liquidity` (LIQUID |
ILLIQUID), `PriceSource` (FINNHUB | BINANCE | MAYA_ETF | MAYA_FUND | MANUAL).

`MANUAL` holdings are the illiquid positions with no free price source — the
pension funds, the study funds (קרן השתלמות), short-term savings, and anything
else read off a statement. They store `manualValueNis` +
`manualValueUpdatedAt`, and pricing them throws when no value is stored so they
surface as a failure rather than a zero.

No free provider serves an individual's balance in these: the pension clearing
house (המסלקה הפנסיונית) is open to licensed entities only, and the open
`data.gov.il` gemel-net / pensia-net datasets publish a fund's monthly yield,
never a member's holding. So the balances are entered by hand, and the app's
job is to keep saying how old each reading is rather than to guess a newer one.

## Crons (vercel.json)

| Path            | Schedule                    |
| --------------- | --------------------------- |
| `/api/snapshot` | `0 22 * * 1-5` (weekdays)   |

The snapshot writes one `HoldingSnapshot` row per holding and skips any user
with a pricing failure entirely, so history never contains a partial day.

## Deployment

Vercel, region `fra1`. Set every variable from `.env.example`; `CRON_SECRET`
must be set or the scheduled snapshot 401s, and `FINNHUB_API_KEY` must be set
or every US equity fails to price.

## Documentation

This file is the only design document. Per-feature plans, specs, and handover
notes are not committed — `docs/superpowers/`, `.superpowers/`, and
`.claude/worktrees/` are gitignored, and agent scratch output stays there or in
the session. A spec that describes work already shipped is worse than no spec:
it drifts, and readers cannot tell it from current intent.

So a PR that changes anything this file states — architecture, an invariant, a
command, a route, a cron, a model — updates the matching section in the same
PR. Record the rule the code now follows, not the story of the change; git log
already holds that. If a change fits no existing section and is not a rule
future work must follow, it does not belong here.
