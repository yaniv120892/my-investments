# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

Single-user portfolio tracker replacing a hand-maintained Google Sheet. One
Next.js 15 (App Router) app holds the UI, the API routes, and the pricing
logic. It stores holdings, prices them live from free providers, and shows
allocation, target drift, and currency exposure in NIS.

Stack: Next.js 15 + React 19 + TypeScript, Prisma/Postgres, Upstash Redis
(quote cache), Chart.js, Tailwind v4, Vitest.

Out of scope by design: cost basis and transactions, XIRR, dividends,
benchmark comparison, two-way sheet sync, multi-user.

## Commands

```bash
npm run dev              # Next dev server with Turbopack
npm run build            # prisma generate && next build
npm run lint             # next lint
npm test                 # vitest watch
npm run test:run         # vitest run (includes live contract tests)
npm run test:unit        # vitest run, excluding *.contract.test.ts
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

`test:unit` is the suite to run while developing. `test:run` additionally hits
live provider APIs and will fail on a network problem or a missing
`FINNHUB_API_KEY`, which is the point — see Testing below.

## Architecture

- `src/app/` — App Router. Pages: `/` (landing), `/login`, `/signup`,
  `/dashboard`, `/settings`.
- `src/app/api/**/route.ts` — all endpoints. `auth/{login,logout,signup,verify}`,
  `holdings` (+ `[id]`, `history`), `platforms`, `user/settings`, `snapshot`.
  Routes read the caller from the `x-user-id` header and return
  `{ error }` with a status; there is no shared handler wrapper.
- `src/middleware.ts` — the only place a session is verified. It reads the
  `auth-token` cookie, verifies the JWT with `src/lib/auth-edge.ts`, redirects
  unauthenticated page requests to `/login`, and sets `x-user-id` /
  `x-user-email` on authenticated `/api/*` requests.
- `src/lib/providers/` — one `PriceProvider` per `PriceSource`, plus
  `FxRateProvider` (USD→NIS, frankfurter.dev) and `providerRegistry.ts`.
- `src/lib/pricing/` — `portfolioPricingService.ts` (`priceHoldings`),
  `allocation.ts`, `supportedCurrencies.ts`.
- `src/lib/holdings/` — write path split into schemas (zod) → validator →
  service → repository, with typed errors mapped to responses by
  `holdingWriteErrorResponse.ts`.
- `src/lib/` — `db.ts` (Prisma + Accelerate), `redis.ts`, `auth.ts`,
  `auth-edge.ts`, `emailService.ts`, `telegramNotifier.ts`,
  `snapshotAuthorization.ts`, `hooks.ts` + `queryClient.ts` (TanStack Query).
- `src/components/`, `src/utils/` (pure helpers), `src/types/`.

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
- **The FX rate is fetched once per request, before the holdings loop, and a
  failure is fatal.** Over half the portfolio is USD-denominated. The bug that
  prompted this design summed raw USD into a NIS total by using a missing rate
  as a truthiness guard, understating the portfolio by 37%. `convertToNis`
  throws on any currency other than NIS and USD.
- **Bizportal quotes are in agorot and must be multiplied by 0.01**, and the
  correct field is `שער נעילה` (closing) for a traded fund and `מחיר פדיון`
  (redemption) for a mutual fund. Bizportal redirects between the two page
  layouts in both directions, so the provider must detect which one it landed
  on rather than trusting the requested path. Both layouts have fixtures under
  `src/lib/providers/__tests__/fixtures/`.
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
  price range. They exist to catch the Bizportal scrape breaking and Finnhub
  changing its free-tier policy. Excluded from `test:unit` because they need
  network and a key.
- Unit tests on the pricing service use mocked providers and must keep
  covering the case that caused the rewrite: FX unavailable fails, and never
  falls through to summing mixed currencies.

## Database (Prisma)

Postgres via `@prisma/client` + Accelerate. Models: `User`, `Settings`
(baseCurrency, darkMode), `Platform` (unique per `[userId, name]`), `Holding`,
`HoldingSnapshot` (unique per `[holdingId, date]`).

Enums: `AssetClass` (EQUITY | CRYPTO | NON_EQUITY), `Liquidity` (LIQUID |
ILLIQUID), `PriceSource` (FINNHUB | BINANCE | BIZPORTAL | MANUAL).

`MANUAL` holdings are the illiquid positions with no free price source. They
store `manualValueNis` + `manualValueUpdatedAt`, and pricing them throws when
no value is stored so they surface as a failure rather than a zero.

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
