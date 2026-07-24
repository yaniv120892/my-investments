# Design: Sheet-Driven Live Portfolio Tracker

Status: proposed
Date: 2026-07-24
Supersedes: manual maintenance of the Google Sheet
Questions: `2026-07-24-sheet-driven-portfolio-tracker-questions.md`

## Goal

Replace a hand-maintained Google Sheet with a live dashboard: import the 27
holdings once, price them automatically from free providers, and surface the
allocation and rebalancing views the sheet forces the user to recompute by hand.

## Why now — the existing app is silently wrong

`my-investments` already has auth, Prisma/Postgres, Redis caching, Chart.js
dashboards and daily snapshots. It is not being used because its price layer
fails silently.

**Root cause.** `getUSDToNISRate()` calls `https://api.boi.gov.il/currency/rate`
with `Bearer ${process.env.BOI_API_KEY}`. Two independent faults: `BOI_API_KEY`
is empty in `.env`, and the host does not resolve at all (connection failure, not
an auth error). The function therefore always returns `null`.

The consequence is in `src/app/api/investments/route.ts:43-56`:

```ts
if (usdToNISRate) {                       // never true
  currentValue = convertToNIS(currentValue, marketData.currency, usdToNISRate);
}
categoryTotals[category] = (categoryTotals[category] || 0) + currentValue;
```

When the rate is missing the conversion is skipped but the value is still summed,
so **raw USD is added to a NIS total**. 55.3% of the portfolio is USD-denominated,
so the dashboard reports ≈942,133 against a true 1,499,009 — **understated by
556,876 NIS (37%)**, with no error shown.

Three secondary faults:

- `if (!usdToNISRate)` retries the dead call for every holding — 27 failed network
  round trips per page load.
- Every provider catches to `console.warn` and returns `null`; nothing reaches the UI.
- `getMarketData` has `default: return null`, so `PENSION`, `EDUCATION_FUND`,
  `INVESTMENT_FUND` and `MONEY_MARKET` can never be priced.

The design below treats "never produce a total you cannot justify" as the primary
requirement.

## Source data

The sheet's summary blocks are all derived — verified: every figure is
`quantity × price × FX`, and all 27 positions reconcile to the stated totals
within rounding. Only the broker blocks and two hand-typed valuations are input.

| Platform | Currency | Positions | Value (NIS) | % |
|---|---|---|---|---|
| Interactive Brokers | USD | 10 | 743,264 | 49.6% |
| Excellence Pro | NIS (agorot) | 4 | 585,083 | 39.0% |
| Binance | USD | 13 | 85,743 | 5.7% |
| — (manual) | NIS | שרה, BTB | 84,919 | 5.7% |

## Provider layer

Explicit per-holding routing. Each holding records its own `priceSource`,
`sourceSymbol` and `currency`; a registry maps source to provider. No inference,
no fallback substitution — a price from the wrong exchange is harder to notice
than a hard failure.

```
PriceProvider (interface)
  fetchQuote(sourceSymbol): Promise<Quote>   // throws on failure; never returns null

  FinnhubProvider    US-listed equities/ETFs    /api/v1/quote           USD
  BinanceProvider    crypto                     /api/v3/ticker/price    USD
  BizportalProvider  TASE by security number    HTML scrape, ÷100       NIS
  ManualProvider     user-entered valuation     from DB                 NIS
  FxRateProvider     USD→NIS                    frankfurter.dev         —
```

All verified live against the actual holdings:

| Segment | Value | % | Provider | Verified |
|---|---|---|---|---|
| IBKR US-listed | 719,874 | 48.0% | Finnhub (existing key) | 7/7 within 0.3% |
| Excellence Pro TASE | 585,083 | 39.0% | Bizportal | 4/4, incl. TLV 125 |
| Binance crypto | 85,743 | 5.7% | Binance | 13/13 |
| USD→NIS | affects 55.3% | — | frankfurter.dev | 3.0541, free, no key |

**92.8% automated with free providers and no new API keys.** The remaining 7.2%
(שרה 5.7%, Irish UCITS 1.6%) has no free source and stays manual.

### Ticker mapping (resolved empirically)

Matched live quotes against the sheet's own prices; all within 0.3%:

| Sheet name | Symbol | Live | Sheet |
|---|---|---|---|
| S&P | `SPY` | 738.93 | 741.20 |
| NASDAQ | `QQQ` | 684.25 | 682.99 |
| Dow Jones | `DIA` | 518.76 | 518.52 |
| MSCI | `EEM` | 63.33 | 63.27 |
| VNQ | `VNQ` | 100.81 | 100.92 |
| Boaing | `BA` | 209.52 | 209.61 |
| Disney | `DIS` | 94.85 | 94.77 |

### Bizportal

`GET https://www.bizportal.co.il/<type>/quote/generalview/<securityId>`, following
redirects. Prices are quoted in agorot; multiply by 0.01 — independently confirmed
by the sheet's own `=IL_FUND(5109889)*0.01` formula.

**Two page types with genuinely different markup.** Bizportal redirects between
them in both directions, so the provider may request either path and follow the
redirect, but it must then detect and parse whichever layout it lands on. Parsing
uses `cheerio`, already a dependency.

*Traded fund (ETF)* — `/tradedfund/`. A definition list; the price is the **last
`<span>`** of the `<dd>` following the `<dt>` whose text is `שער נעילה`:

```html
<dt>שער נעילה</dt><dd><span class="drop" dir="ltr">-1.32%</span><span>244,290</span></dd>
```

The first span is the daily change (class `drop`/`rise`), the last is the price.
Taking `dd.text()` concatenates them into `-1.32%244,290` and must be avoided.

*Mutual fund (קרן נאמנות)* — `/mutualfunds/`. Price is in
`.top-area-cube` blocks, matching `.label` = `מחיר פדיון` and reading `.num`.
Use the **redemption** price (`מחיר פדיון`) — realisable value on exit. On 5109889
redemption and purchase were equal.

**The correct field is `שער נעילה` (closing), not `שער בסיס` (base).** The traded
fund pages carry no `שער אחרון` label at all. An earlier extraction attempt fell
through to `שער בסיס`, producing an apparent ~1% drift that was an artifact of
reading the wrong field. Verified against the sheet with the correct field:

| Security | Type | Agorot | ×0.01 | Sheet | Drift |
|---|---|---|---|---|---|
| 1159250 | traded | 244,290 | 2442.90 | 2442.90 | **0.000%** |
| 1159094 | traded | 36,290 | 362.90 | 363.40 | −0.138% |
| 1159169 | traded | 16,090 | 160.90 | 160.90 | **0.000%** |
| 5109889 (TLV 125) | mutual | 459.21 | 4.5921 | 4.5921 | **0.000%** |

Three of four match to four decimal places; the three traded funds together price
at 524,113 against the sheet's 524,284 (−0.03%).

Note that a traded-fund page *also* contains one `.top-area-cube`, labelled
`שווי יחידה` and always empty (`--`). Layout detection must therefore not rely on
the presence of `.top-area-cube` alone — key on which price label is present.

This is an HTML scrape and will break when the markup changes. It is therefore
covered by a contract test (below), parses both layouts, and fails loudly rather
than returning a stale or zero price.

### Sources rejected

- **Bank of Israel** (`api.boi.gov.il`) — host does not resolve. The official
  SDMX endpoint at `edge.boi.gov.il` does work but returns verbose SDMX-JSON for
  no benefit over frankfurter.dev.
- **Yahoo Finance** — HTTP 429 from this network on every symbol including `SPY`.
- **Finnhub for `.L` symbols** — free tier returns "You don't have access to this
  resource". Symbol *search* works, quotes do not.
- **justETF** — JS-rendered; no quote in the served HTML.
- **TASE official / Maya** — Akamai bot protection; `api.tase.co.il` returns 403.

### Manual holdings

שרה (84,919, 5.7%) and the three Irish UCITS (23,390, 1.6%) have no free source.
They store a user-entered NIS value plus `manualValueUpdatedAt`, and the UI shows
the age of that figure and flags it once it exceeds a threshold. Total 7.2%.

## Data model

The current `InvestmentType` enum conflates asset class with product type and
cannot express the two axes the sheet actually uses. Replace it with orthogonal
`assetClass` and `liquidity`, and add `Platform`.

```prisma
model Platform {
  id           String    @id @default(uuid())
  userId       String
  name         String
  baseCurrency String
  holdings     Holding[]
  @@unique([userId, name])
}

model Holding {
  id            String        @id @default(uuid())
  userId        String
  platformId    String
  assetName     String
  assetClass    AssetClass
  liquidity     Liquidity
  quantity      Float
  priceSource   PriceSource
  sourceSymbol  String?       // null only when priceSource = MANUAL
  currency      String
  targetPercent Float?        // within its platform group

  manualValueNis       Float?
  manualValueUpdatedAt DateTime?

  snapshots     HoldingSnapshot[]
}

enum AssetClass  { EQUITY CRYPTO NON_EQUITY }
enum Liquidity   { LIQUID ILLIQUID }
enum PriceSource { FINNHUB BINANCE BIZPORTAL MANUAL }
```

Snapshots record the inputs, not just the result, so history stays auditable when
a provider is later found to have been wrong:

```prisma
model HoldingSnapshot {
  id         String   @id @default(uuid())
  holdingId  String
  date       DateTime
  quantity   Float
  unitPrice  Float
  currency   String
  fxRateUsed Float
  valueNis   Float
  @@unique([holdingId, date])
}
```

Cost basis is out of scope (no data exists for it), but `HoldingSnapshot` is
per-holding rather than portfolio-level, so a `Transaction` table can be added
later without migrating anything.

### Migration

Destructive: `Investment` and `InvestmentSnapshot` are replaced. Confirmed that
the database holds nothing worth preserving, so the migration drops and recreates
rather than backfilling.

## Import

A one-time script, not a product feature — the sheet is retired afterwards.

1. Read the sheet's CSV export.
2. Parse the three broker blocks (`name / כמות / מחיר`) plus the two manual rows.
3. Apply the ticker mapping table above.
4. Write `Platform` and `Holding` rows.
5. **Reconcile:** recompute every total from the imported rows and assert it
   matches the sheet's own figure. Abort on mismatch.

Step 5 is the point of the script. The same reconciliation already ran during
analysis, so the expected values are known: 1,499,009 grand total, 743,264 IBKR,
585,083 Excellence Pro, 85,743 crypto.

Two known data issues, carried as explicit import decisions rather than silently
resolved:

- **MATIC — confirmed still held, so it is imported.** It is missing from the
  sheet's summary block, meaning the user's own totals currently understate the
  portfolio. Its sheet price (0.242556) is also stale against a live 0.3794, so
  importing it both adds a missing position and corrects it. MATIC and POL are
  imported as separate holdings, since both are held.
- **`Irish NASDAQ` carries QQQ's exact price** (682.99), which cannot be right for
  an Irish-domiciled UCITS. Imported as a manual holding with a stale-value flag.

## Dashboard

Chosen for value given no cost basis exists:

1. **Target vs actual drift** — the highest-value view. Targets are currently
   maintained by hand in three separate places (מצוי/רצוי, the crypto 35/25/15
   column, per-platform %). This is the calculation the sheet forces the user to
   redo manually, and it is directly actionable: what to buy, what to sell.
2. **Allocation** — by asset class, liquidity, and platform. Reproduces the
   sheet's Block A automatically.
3. **Currency exposure** — 55.3% of the portfolio is USD-denominated and nothing
   surfaces that today. The FX bug is what happens when that stays invisible.
4. **Value over time** — existing component, accrues value as snapshots build.

Cut: per-holding P&L and XIRR (impossible without cost basis), dividends (YAGNI).

Currency toggle: values are stored in NIS and native currency; the toggle
re-renders using the live rate rather than storing duplicates.

## Error handling

The central rule: **a total is never rendered from incomplete data.**

- `fetchQuote` throws on failure. No provider returns `null`.
- The pricing service collects per-holding results into
  `{ priced[], failed[{ holding, source, error }] }`.
- If `failed` is non-empty, the API returns the priced holdings *and* the failure
  list, and the UI renders the failures while **suppressing the portfolio total**.
- The FX rate is fetched **once per request**, before the holdings loop. If it
  fails, the request fails — it is not recoverable, since 55% of the portfolio
  depends on it.
- Non-critical side effects (cache writes, snapshot persistence) are wrapped and
  logged; they never fail the read path.

Caching keeps the existing Redis layer with a shorter TTL for quotes than for the
FX rate. Cached values carry their fetch timestamp so staleness is displayable.

## Testing

The providers are the entire risk surface; everything else is arithmetic.

- **Contract tests, one per provider**, against the live API, asserting shape and
  a sane price range. These catch the Bizportal scrape breaking and Finnhub
  changing its free-tier policy — the two most likely future failures.
- **Unit tests on the pricing service** with mocked providers, covering the case
  that caused this rewrite: *FX unavailable must fail, never fall through to
  summing mixed currencies.*
- **Reconciliation test on the importer** against the known sheet totals.

## Out of scope

Cost basis and transactions; XIRR; dividends; benchmark comparison; two-way sheet
sync; multi-user.

## Open items

None blocking. All three prior open items are resolved: TLV 125 is security
5109889 (verified, exact match), MATIC is still held and will be imported, and the
database contains nothing worth preserving.
