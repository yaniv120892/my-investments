# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Project Overview

Single-user portfolio tracker replacing a hand-maintained Google Sheet. One
Next.js 15 (App Router) app holds the UI, the API routes, and the pricing
logic. It stores holdings, prices them live from free providers, and shows
allocation, target drift, rebalancing, and currency exposure in NIS.

Stack: Next.js 15 + React 19 + TypeScript, Prisma/Postgres, Upstash Redis
(quote and FX cache), MUI v7 + Emotion, Chart.js, Vitest.

Out of scope by design: cost basis and transactions, XIRR, dividends,
benchmark comparison, two-way sheet sync, multi-user.

## Commands

```bash
npm run dev              # Next dev server with Turbopack
npm run build            # prisma generate && next build
npm run lint             # eslint, no warnings tolerated
npm run lint:fix         # eslint --fix
npm run format           # prettier --write
npm run format:check     # prettier --check
npm run prettier         # alias of format:check, the name the pre-push gate looks for
npm run typecheck        # tsc --noEmit
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
npm run db:add-savings   # adds the hand-priced savings, scripts/addSavingsHoldings.ts
npm run snapshot:trigger # POST /api/snapshot against SNAPSHOT_BASE_URL
docker-compose up -d     # local Postgres on 5432
```

The Prisma schema lives at `src/prisma/schema.prisma`, not the default
location, so every Prisma command passes `--schema`. `DATABASE_URL` is Neon's
pooled endpoint, so the datasource also names `directUrl` (`DIRECT_URL`, the
host without `-pooler`); `prisma generate` and `next build` do not read it, so a
deploy cannot break on a missing value, but `db:migrate` and `db:studio` will. `postinstall` runs
`prisma generate`.

`db:import-sheet` replaces the whole portfolio and is spent — it was the
one-time move off the Google Sheet. `db:add-savings` is the opposite: it only
adds, skipping any holding whose name already exists, because it runs against a
live portfolio. It reads the balances from a JSON file
(`scripts/savingsValues.example.json` is the template; a filled-in copy is
gitignored) and refuses to create anything unless every row has one, since a
holding with no manual value fails to price and one failure hides the total.

`npm test` is deliberately `test:unit` rather than `vitest`: watch mode never
exits, and the pre-push quality gate runs `npm run test`.

That gate runs `build`, `lint`, `prettier`, and `test` by those exact names, each
under `--if-present` — so a script it cannot find is skipped in silence rather
than reported. `prettier` exists only to be found: it aliases `format:check`, and
without it the formatting gate passes by never running. `.claude/ship.json` names
the same commands for the delivery pipeline, along with what a fresh checkout
needs before the app will start.

Lint enforces the craft rules mechanically — braces, `T[]` over `Array<T>`,
explicit class access modifiers, `await` over `.then()`, and a denylist of
abbreviated identifiers — so they are caught before review rather than in it.
In `eslint.config.mjs`, `eslint-config-prettier` must stay **above** the rule
block: it switches `curly` off along with the formatting rules, and below the
block it silently disables the rule instead of the formatting. Prettier skips
`src/lib/providers/__tests__/fixtures`, which stays byte-faithful to what the
provider actually returned.

## Architecture

- `src/app/` — App Router. `(auth)/` login and signup; `(app)/` the six
  authenticated pages (dashboard, holdings, allocation, rebalancing, history,
  settings) inside the `AppShell` sidebar layout.
- `src/app/api/**/route.ts` — all endpoints. `auth/{login,logout,signup,verify}`,
  `holdings` (+ `[id]`, `history`, `manual-values`), `platforms`,
  `user/settings`, `snapshot`, `targets`. `targets` is `GET`/`PUT` only:
  "the class targets sum to 100" is a whole-document invariant a single-class
  `PATCH` could never validate.
  Routes read the caller from the `x-user-id` header and return `{ error }`
  with a status; there is no shared handler wrapper. Validation failures also
  carry `fieldErrors` keyed by input name — `holdingWriteErrorResponse.ts`
  writes it, `src/lib/apiError.ts` reads it back into the form that raised it,
  so a rejected field names itself in the UI.
- `src/middleware.ts` — the only place a session is verified. It reads the
  `auth-token` cookie, verifies the JWT with `src/lib/auth-edge.ts`, and sets
  `x-user-id` / `x-user-email` on authenticated `/api/*` requests. An
  unauthenticated **page** request is redirected to `/login`; an unauthenticated
  **`/api/*`** request gets a 401 it can read, because `fetch` follows a redirect
  and reports a 200, so the caller's `response.json()` fails as a syntax error
  rather than as the auth failure it is. A public route survives an expired
  cookie — rejecting `/api/auth/login` would lock its holder out of the endpoint
  that fixes the problem. The browser turns that 401 into a redirect once, in
  `queryClient`'s cache-level `onError`.
- `src/lib/providers/` — one `PriceProvider` per remote `PriceSource`
  (`FinnhubProvider`, `BinanceProvider`, `MayaEtfProvider`, `MayaFundProvider`
  over the shared `mayaApi.ts`), each wrapped in `CachedPriceProvider` by
  `providerRegistry.ts`. `FxRateProvider` supplies rates to NIS.
- `src/lib/pricing/` — `portfolioPricingService.ts` (`priceHoldings`),
  `nisRateBook.ts` (per-run FX memoisation), `allocation.ts`,
  `supportedCurrencies.ts`, `investablePortfolio.ts` (splits liquid from
  illiquid — the only place `Liquidity` is consulted) and
  `contributionPlanner.ts` (`planContribution`, the buy-only allocator).
- `src/lib/holdings/` — write path split into schemas (zod) → validator →
  service → repository, with typed errors mapped to responses by
  `holdingWriteErrorResponse.ts`.
- `src/lib/targets/` — the portfolio-level target model, mirroring that same
  path, with `targetPercentRules.ts` naming the sum-to-100 rule once.
- `src/lib/` — `db.ts` (the one `PrismaClient`, memoised on `globalThis`
  outside production so dev hot-reload does not open a connection per edit),
  `redis.ts`, `auth.ts`, `auth-edge.ts`, `authTokens.ts` (the cookie and
  header names the middleware and the routes agree on, import-free so the edge
  runtime can load it), `emailService.ts`, `telegramNotifier.ts`,
  `snapshotAuthorization.ts`, `api.ts` + `apiError.ts` (the browser's typed
  fetch layer), `usePortfolioView.ts`, `hooks.ts` + `queryClient.ts`
  (TanStack Query).
- `src/components/` — `shell/` (AppShell, PageHeader), `dashboard/` cards,
  and the shared pieces. `DisplayCurrencyProvider` + `CurrencyToggle` hold the
  display currency; `PricingFailuresAlert` renders what could not be priced and
  `StaleManualValuesAlert` what has not been re-read lately, with
  `ManualValuesModal` as the monthly review form. `PortfolioChart` defers to
  `PortfolioChartCanvas` so Chart.js only loads when a chart is actually on
  screen.
- `src/theme.ts`, `src/utils/` (pure helpers), `src/types/`.
- A module's shared types live beside it in `<module>.types.ts`, and the module
  re-exports them, so a type has one definition and callers still import from
  the implementation. `src/types/` holds only what belongs to no single module.

## Key invariants

- **A total is never rendered from incomplete data.** `priceHoldings` returns
  `totalValueNis: null` whenever `failures` is non-empty, alongside
  `pricedValueNis` and the failure list. The UI shows the failures and
  suppresses the total. Do not add a fallback that sums what priced.
- **A contribution plan is refused, never built on partial data.**
  `planContribution` takes `PricingResult.totalValueNis` verbatim and returns a
  `PRICING_INCOMPLETE` refusal when it is null — the same reason the UI
  suppresses a total. A plan built on 22 of 29 holdings buys the wrong thing and
  looks right. A refusal is a _value_ on the `ContributionPlan` union, not a
  throw, so it is directly testable. Unbalanced _stored_ targets are the
  exception and do throw: `targetWriteValidator` is the only way targets are
  written and it rejects them, so reaching the planner with a bad set means a
  caller skipped that boundary.
- **Allocation is buy-only and liquid-only.** The planner never emits a sell —
  directing new money is the alternative to selling. Illiquid holdings (pension,
  קרן השתלמות) are reported as fixed context and never receive an allocation,
  because no contribution can be directed into them; naming them would be
  unactionable. `investablePortfolio.ts` is the single place that split is made,
  and it withholds `investableValueNis` (and every class share) whenever pricing
  is incomplete, for the same reason `priceHoldings` withholds its total.
- **Pricing is explicitly routed, never inferred.** Each holding carries its
  own `priceSource`, `sourceSymbol`, and `currency`; the registry maps source
  to provider. `fetchQuote` throws on failure and never returns null, and no
  provider substitutes for another — a price from the wrong exchange is much
  harder to notice than a hard failure.
- **Maya's two products live on endpoints that do not overlap**, and an id the
  endpoint does not serve returns a WAF 403 as often as a 404 — so a caller
  cannot tell "wrong product" from "blocked" and must not guess. That is why
  `MAYA_ETF` and `MAYA_FUND` are separate price sources, each naming exactly
  one endpoint. Maya quotes are in agorot: multiply by 0.01. Each endpoint
  passes `fetchMayaJson` a zod schema so a renamed field fails as a shape
  mismatch naming the fields Maya sent, not as "no usable rate"; that parse
  stays outside the JSON try/catch, which exists to name the WAF challenge
  page and would otherwise swallow it.
  A traded fund has no `LastRate` between the open and its first deal, so the
  ETF endpoint falls back to `BaseRate`, the previous close — one throw
  suppresses the whole portfolio total, and an hour-long hole is not worth
  that.
- **The `MAYA_HEADERS` in `mayaApi.ts` are load-bearing.** `mayaapi.tase.co.il`
  serves only what looks like its own front end; without `X-Maya-With` _and_
  `Accept-Language` the same request 403s from Node while succeeding from curl.
  Change nothing there without re-running `mayaApi.contract.test.ts`.
- **FX is memoised per pricing run, and a failure is fatal to the holding.**
  `NisRateBook` keys on the in-flight promise so concurrent callers share one
  lookup, and evicts on failure so one blip does not condemn the rest of the
  run. The USD rate is always fetched, even with no USD holding, because the
  dashboard converts every displayed figure with it. A missing rate is never a
  truthiness guard: the holding fails, and mixed currencies are never summed.
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
  A review is validated whole and written whole — one transaction, keyed by
  holding id so a rejected line names itself, because a monthly pass that
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
- **Telegram messages go out as HTML**, so anything interpolated from an error
  is escaped first: a provider failure routinely carries a query string, and
  one unescaped `&` makes Telegram reject the alert about the failure.
- **Every holding is created and updated through `holdingWriteService`**, the
  scripts included, so a row a script writes is a row the holdings page would
  accept. Two exceptions: `importFromSheet.ts`, which is spent; and
  `Holding.withinClassWeight`, which belongs to the target model and is written
  only by `targetRepository`. The holdings write path never reads or sets it —
  `createHoldingSchema` is a `strictObject` that omits it, so `POST`/`PATCH
/api/holdings` structurally cannot touch it.
- Redis is a cache, not a store: `getCachedData` swallows errors and returns
  null, so every read path must work with the cache down. Unconfigured Upstash
  is therefore survivable, and says so once at boot rather than as an error
  line per key.

## Testing

The providers are the entire risk surface; the rest is arithmetic — with one
exception. `contributionPlanner` is arithmetic that moves real money, so its
water-filling breakpoints, its tie behaviour, and its pricing-failure refusal
are pinned by tests against the real portfolio's numbers. Two of those cases
must never be deleted: that a null `totalValueNis` refuses even when every
supplied holding has a value, and that tied fill ratios split by target weight
identically however the input is ordered.

- `*.contract.test.ts` run against the live APIs and assert shape plus a sane
  price range. They exist to catch Maya's WAF rules shifting and Finnhub
  changing its free-tier policy. Excluded from `test:unit` because they need
  network and a key; run them with `npm run test:contract`.
- Unit tests mock the network through `__tests__/mockFetch.ts` and JSON
  fixtures. The pricing suite must keep asserting that an unavailable FX rate
  fails the holding and never falls through to summing mixed currencies.
- `vitest.config.mts` includes `scripts/**/*.test.ts` as well as `src/`, so the
  one-off scripts are covered by the same run.

## Database (Prisma)

Postgres via `@prisma/client`. Every query goes through the single client
exported by `src/lib/db.ts`; nothing else constructs a `PrismaClient` on a
request path. Models: `User`, `Settings` (baseCurrency, darkMode, one row per
user), `Platform` (unique per `[userId, name]`), `Holding`, `HoldingSnapshot`
(unique per `[holdingId, date]`), `AssetClassTarget` (unique per
`[userId, assetClass]`).

`AssetClassTarget` is a model rather than three columns on `Settings` because
the invariant is "all three present and summing to 100": rows make that state
whole — three rows or none, written in one `$transaction` — where nullable
columns would let a half-set target persist for every reader to defend against.
It also survives a fourth `AssetClass` member without a migration, and keeps
portfolio policy out of a model that holds preferences and loads on every page.

`Holding.withinClassWeight` is a **relative weight, not a percent**, and is
deliberately not constrained to sum to anything: holdings are written one at a
time, so a cross-row sum has no single write path to hang a guard off, and
adding a holding would silently invalidate every sibling. Null means "no new
money here". It is read only by the target model; `Holding.targetPercent` and
the per-platform drift on the Rebalancing page are untouched by it, and neither
reads the other.

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

| Path            | Schedule                  |
| --------------- | ------------------------- |
| `/api/snapshot` | `0 22 * * 1-5` (weekdays) |

The snapshot writes one `HoldingSnapshot` row per holding and skips any user
with a pricing failure entirely, so history never contains a partial day.

## Deployment

Vercel, region `fra1` — Binance answers 451 to US-hosted requests, so a US
region breaks every crypto holding rather than merely slowing it down. Set
every variable from `.env.example`; `CRON_SECRET`
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

## Agent configuration

`.claude/` is committed so a session gets the same setup wherever it runs — a
laptop with `~/.claude` installed, Claude Code on the web, a routine, a Claude
Tag run. The two halves reach a session by different routes.

`settings.json` only _references_ the `yaniv120892/claude-config` marketplace
and names the plugins to enable, so skills, commands and hooks are fetched
rather than copied and stay current. Only `pr-workflows` and `dev-workflows`
are enabled; `issue-tracker` wants a Jira this project does not have,
`infra-workflows` a Helm/AWS stack it does not use, and `cmux` a terminal no
remote session has. Plugin keys apply only once the workspace is trusted.

The marketplace repo is public, so fetching it needs no credentials — but a
`github` source clones over SSH by default, and a fresh container has no key
and no `known_hosts` entry. `CLAUDE_CODE_PLUGIN_PREFER_HTTPS` is what keeps
that clone on HTTPS; without it the plugins are a laptop-only feature again.

`rules/` is copied, because that route does not exist for rules: a plugin
cannot carry `paths:`-scoped rules, and a symlink into `~/.claude` resolves to
nothing in a fresh container. Each file is byte-identical to its upstream apart
from a provenance comment naming the commit it came from, and `.prettierignore`
keeps it that way so re-syncing one is a diff of the rule text alone. Upstream
is the source of truth: change a rule there, then re-copy. The `paths:`
frontmatter is what keeps them free — they load only when a matching file is
read, not on every prompt.

`ship.json` is this repo's own, not synced from anywhere.
