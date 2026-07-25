# Sheet-Driven Live Portfolio Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace a hand-maintained Google Sheet with a live dashboard that imports 27 holdings once, prices them from free providers, and shows allocation, rebalancing drift, and currency exposure.

**Architecture:** Explicit per-holding price routing. Each holding stores its own `priceSource` + `sourceSymbol` + `currency`; a registry maps source to a provider that throws rather than returning null. A pricing service collects successes and failures separately and refuses to emit a portfolio total when anything failed. Schema moves from a flat `Investment` to `Platform` → `Holding` → `HoldingSnapshot`.

**Tech Stack:** Next.js 15.4.5 (App Router), TypeScript 5, Prisma 6 + PostgreSQL, Upstash Redis, Chart.js 4 + react-chartjs-2, cheerio 1.1 (already a dependency), Vitest (added in Task 1).

**Spec:** `docs/superpowers/specs/2026-07-24-sheet-driven-portfolio-tracker-design.md`

## Global Constraints

- **Providers throw, never return `null`.** A missing price is an error, not an absence.
- **Never emit a portfolio total computed from incomplete data.** If any holding fails to price, `totalValue` is `null` and the failures are listed.
- **FX is fetched once per request, before any holdings loop.** If it fails, the whole request fails with 503.
- **Bizportal prices are in agorot — multiply by `0.01`.** Confirmed by the sheet's own `=IL_FUND(5109889)*0.01`.
- **Bizportal traded-fund price field is `שער נעילה` (closing), NOT `שער בסיס` (base).** There is no `שער אחרון` label on these pages.
- **All monetary values stored in NIS.** Display currency is a render-time toggle using the live rate; never store duplicate converted values.
- Coding standards from `~/.claude/shared-rules.md` apply: `T[]` not `Array<T>`, explicit `public`/`private` on all class members, braces on all control flow, no `as` casts, no ESLint suppressions, actionable error messages that interpolate the offending values, `switch` over `else if` chains, public methods above private ones, no abbreviated identifiers.
- Commit messages follow Conventional Commits. Personal project — scope is a module name, not a ticket.

## Environment Prerequisite: use an arm64 node

This machine is an **Apple M1 Max**. `node_modules` contains arm64 native binaries (`lightningcss-darwin-arm64`, `@tailwindcss/oxide-darwin-arm64`) and is **correct** — do not reinstall it.

`npm run build` fails with `Cannot find module '../lightningcss.darwin-x64.node'` **only when run from a Rosetta-translated shell**, which resolves `/usr/local/bin/node` (an x86_64 build). Check with:

```bash
uname -m                          # x86_64 under Rosetta, arm64 native
sysctl -n sysctl.proc_translated  # 1 means Rosetta
node -p "process.arch"            # must be arm64
```

If `process.arch` is `x64`, prepend an arm64 node to `PATH` before running anything:

```bash
export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH"
node -p "process.arch"   # arm64
npm run build
```

All nvm-installed nodes on this machine (v22.22.0, v24.2.0, v24.13.0) are arm64.

**Do NOT run `rm -rf node_modules && npm install` from a Rosetta shell.** It would replace the correct arm64 binaries with x64 ones and break the build in the normal native shell. Verified working: `npm run build` completes successfully with an arm64 node against current `HEAD`.

There is also a stray `/Users/yanivdaye/package-lock.json` causing a "multiple lockfiles" warning. Harmless.

## Reference Data

The sheet's own figures, used for import reconciliation in Task 10. Verified: every summary value equals `quantity × price × FX`, and all 27 positions reconcile within rounding.

| Platform | Currency | Positions | Value (NIS) |
|---|---|---|---|
| Interactive Brokers | USD | 10 | 743,264 |
| Excellence Pro | NIS | 4 | 585,083 |
| Binance | USD | 13 | 85,743 |
| (manual) | NIS | 2 | 84,919 |
| **Grand total** | | **29** | **1,499,009** |

Sheet FX rate: `3.04635`.

### Interactive Brokers

| Sheet name | Symbol | Source | Qty | Sheet price |
|---|---|---|---|---|
| S&P | `IVV` | FINNHUB | 148 | 741.20 |
| NASDAQ | `QQQ` | FINNHUB | 89 | 682.99 |
| Dow Jones | `DIA` | FINNHUB | 68 | 518.52 |
| MSCI | `EEM` | FINNHUB | 239 | 63.27 |
| VNQ | `VNQ` | FINNHUB | 137 | 100.92 |
| Boaing | `BA` | FINNHUB | 5 | 209.61 |
| Disney | `DIS` | FINNHUB | 6 | 94.77 |
| Irish MSCI | — | MANUAL | 18 | 52.15 |
| Irish S&P | — | MANUAL | 5 | 801.39 |
| Irish NASDAQ | — | MANUAL | 4 | 682.99 |

**`S&P` is `IVV`, not `SPY`.** Confirmed two ways: the pre-migration database (backed up to `backups/pre-migration-2026-07-24.json`) recorded `IVV`, and IVV's live price of 742.36 matches the sheet's 741.20 to 0.16% where SPY's 738.93 is 0.31% off. Using SPY would misprice the single largest position (148 units, ~334k NIS) by roughly 1,500 NIS.

The three Irish UCITS have no free price source, so they import as MANUAL with `manualValueNis = quantity × sheetPrice × 3.04635`: Irish MSCI 2,860; Irish S&P 12,207; Irish NASDAQ 8,323. The old database recorded `SWRD` and `CSPX` for two of them, but neither is usable on the Finnhub free tier — `CSPX` returns a price of 0, and `SWRD` resolves to an unrelated $4.25 instrument rather than the London-listed UCITS. Do not wire either up.

`Irish NASDAQ` carries QQQ's exact price (682.99). This is **not** a copy-paste error, as originally supposed — the old database mapped that holding to `QQQ` deliberately, so the sheet is valuing it as a QQQ proxy on purpose. It still imports as MANUAL, because a UCITS priced off a US-listed ETF is a modelling choice the owner should make explicitly rather than one the importer should bake in silently.

### Excellence Pro (BIZPORTAL, NIS)

| Fund | Security ID | Qty | Sheet price | Target % |
|---|---|---|---|---|
| iShares CORE S&P 500 | 1159250 | 126 | 2442.90 | 54.0 |
| iShares CORE MSCI EUROPE | 1159094 | 342 | 363.40 | 22.5 |
| iShares CORE MSCI EM IMI | 1159169 | 573 | 160.90 | 13.5 |
| TLV 125 | 5109889 | 13240 | 4.5921 | 10.0 |

5109889 is a **mutual fund**; the other three are **traded funds**. Different page layouts — see Task 5.

### Binance (BINANCE, USD)

| Symbol | Qty | Target % |
|---|---|---|
| BTC | 0.319043 | 35 |
| ETH | 2.84245873 | 25 |
| ADA | 2129.13 | 15 |
| BNB | 2.23062261 | 4 |
| DOGE | 2441.40 | 3 |
| DOT | 28.09343628 | 3 |
| SHIB | 41837962.57 | 3 |
| CAKE | 85.82799929 | 3 |
| 1INCH | 107.3157289 | 3 |
| SOL | 3.06246084 | 2 |
| DAR | 185.8019098 | 1 |
| MATIC | 698.029446 | — |
| POL | 701.8623572 | — |

MATIC is confirmed still held but is **missing from the sheet's summary block**, so the sheet's own totals understate the portfolio. Import both MATIC and POL as separate holdings. MATIC therefore does not appear in the 85,743 crypto subtotal — reconciliation in Task 10 must account for this.

### Manual holdings

| Name | Class | Liquidity | Value (NIS) |
|---|---|---|---|
| שרה | EQUITY | ILLIQUID | 84,919 |
| BTB – הלוואות חברתיות | NON_EQUITY | ILLIQUID | 0 |

## File Structure

**Create:**
- `vitest.config.ts` — test runner config
- `src/lib/providers/types.ts` — `Quote`, `PriceProvider`, `Currency`
- `src/lib/providers/FinnhubProvider.ts` — US-listed equities/ETFs
- `src/lib/providers/BinanceProvider.ts` — crypto (replaces `CryptoPriceProvider`)
- `src/lib/providers/BizportalProvider.ts` — TASE, two layouts
- `src/lib/providers/providerRegistry.ts` — source → provider
- `src/lib/pricing/portfolioPricingService.ts` — valuation orchestration
- `src/lib/pricing/portfolioPricingService.types.ts` — valuation/failure types
- `src/lib/pricing/allocation.ts` — pure allocation + drift math
- `scripts/importFromSheet.ts` — one-time importer
- `src/app/api/holdings/route.ts` — priced holdings endpoint
- `src/components/TargetDrift.tsx`, `AllocationBreakdown.tsx`, `CurrencyExposure.tsx`
- Tests colocated under `src/**/__tests__/`

**Modify:**
- `src/prisma/schema.prisma` — new models, drop old
- `src/lib/marketDataService.ts` — delegate to registry
- `src/app/api/snapshot/route.ts` — per-holding snapshots
- `src/app/dashboard/page.tsx` — new views
- `src/lib/api.ts`, `src/lib/hooks.ts`, `src/types/index.ts`
- `package.json` — test scripts

**Delete:**
- `src/lib/providers/CryptoPriceProvider.ts` (superseded by `BinanceProvider`)
- `src/components/AllocationTargets.tsx` (superseded by `TargetDrift`)

`FxRateProvider.ts`, `describeError.ts` already exist from commit `1db7361` and are reused unchanged.

---

### Task 1: Test infrastructure

The repo has no test framework. Everything downstream is TDD, so this comes first.

**Files:**
- Create: `vitest.config.ts`
- Create: `src/utils/__tests__/describeError.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing
- Produces: `npm test` (watch), `npm run test:run` (single pass), `npm run test:unit` (excludes contract tests)

- [ ] **Step 1: Install dev dependencies**

```bash
cd /Users/yanivdaye/Develop/my-investments
npm install -D vitest@^2 @vitejs/plugin-react vite-tsconfig-paths
```

- [ ] **Step 2: Create `vitest.config.ts`**

Contract tests hit live third-party APIs, so they must be separable from unit tests.

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.ts"],
    testTimeout: 30000,
  },
});
```

- [ ] **Step 3: Add scripts to `package.json`**

Add to the `"scripts"` block:

```json
"test": "vitest",
"test:run": "vitest run",
"test:unit": "vitest run --exclude '**/*.contract.test.ts'"
```

- [ ] **Step 4: Write a test proving the harness works**

Create `src/utils/__tests__/describeError.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { describeError } from "@/utils/describeError";

describe("describeError", () => {
  it("returns the message of an Error", () => {
    expect(describeError(new Error("boom"))).toBe("boom");
  });

  it("stringifies non-Error values", () => {
    expect(describeError("plain string")).toBe("plain string");
    expect(describeError(42)).toBe("42");
  });
});
```

- [ ] **Step 5: Run the tests**

Run: `npm run test:run`
Expected: PASS, 2 tests. This also proves the `@/` path alias resolves.

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts package.json package-lock.json src/utils/__tests__/describeError.test.ts
git commit -m "test: add vitest harness with unit and contract test separation"
```

---

### Task 2: Provider contract

Defines the interface every provider implements. Small, but it is the seam the next four tasks are written against, so it gets its own gate.

**Files:**
- Create: `src/lib/providers/types.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type Currency = "USD" | "NIS"`
  - `interface Quote { price: number; currency: Currency; fetchedAt: Date; source: string }`
  - `interface PriceProvider { readonly source: PriceSource; fetchQuote(sourceSymbol: string): Promise<Quote> }`

- [ ] **Step 1: Create `src/lib/providers/types.ts`**

`PriceSource` comes from the Prisma enum added in Task 8. Until then TypeScript will error on that import — expected, and resolved by Task 8. Nothing imports this file until Task 3.

```ts
import type { PriceSource } from "@prisma/client";

export type Currency = "USD" | "NIS";

export interface Quote {
  price: number;
  currency: Currency;
  fetchedAt: Date;
  source: string;
}

export interface PriceProvider {
  readonly source: PriceSource;
  fetchQuote(sourceSymbol: string): Promise<Quote>;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/providers/types.ts
git commit -m "feat(providers): add price provider contract"
```

---

### Task 3: FinnhubProvider

Replaces the free function `getStockPrice`, which returned `null` on failure.

**Files:**
- Create: `src/lib/providers/FinnhubProvider.ts`
- Create: `src/lib/providers/__tests__/FinnhubProvider.test.ts`
- Create: `src/lib/providers/__tests__/FinnhubProvider.contract.test.ts`

**Interfaces:**
- Consumes: `Quote`, `PriceProvider` from Task 2
- Produces: `class FinnhubProvider implements PriceProvider`, singleton `finnhubProvider`

- [ ] **Step 1: Write the failing unit tests**

Create `src/lib/providers/__tests__/FinnhubProvider.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { FinnhubProvider } from "@/lib/providers/FinnhubProvider";

function mockFetch(body: unknown, ok = true, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, status, json: async () => body })
  );
}

describe("FinnhubProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a USD quote from the current-price field", async () => {
    mockFetch({ c: 738.93 });
    const quote = await new FinnhubProvider("key").fetchQuote("SPY");
    expect(quote.price).toBe(738.93);
    expect(quote.currency).toBe("USD");
    expect(quote.source).toBe("Finnhub");
  });

  it("throws naming the symbol when the response is not ok", async () => {
    mockFetch({}, false, 429);
    await expect(new FinnhubProvider("key").fetchQuote("SPY")).rejects.toThrow(
      /SPY.*429/s
    );
  });

  it("throws when the price is zero, which Finnhub returns for unknown symbols", async () => {
    mockFetch({ c: 0 });
    await expect(
      new FinnhubProvider("key").fetchQuote("NOPE")
    ).rejects.toThrow(/NOPE/);
  });

  it("throws when the price field is absent", async () => {
    mockFetch({ d: null });
    await expect(new FinnhubProvider("key").fetchQuote("SPY")).rejects.toThrow(
      /SPY/
    );
  });

  it("throws when no API key is configured", async () => {
    await expect(new FinnhubProvider("").fetchQuote("SPY")).rejects.toThrow(
      /FINNHUB_API_KEY/
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/providers/__tests__/FinnhubProvider.test.ts`
Expected: FAIL — cannot resolve `@/lib/providers/FinnhubProvider`.

- [ ] **Step 3: Implement**

Create `src/lib/providers/FinnhubProvider.ts`. `c: 0` is Finnhub's response for an unknown symbol, so it must be rejected rather than treated as a real price.

```ts
import { PriceSource } from "@prisma/client";
import type { Currency, PriceProvider, Quote } from "@/lib/providers/types";

const FINNHUB_QUOTE_URL = "https://finnhub.io/api/v1/quote";
const FINNHUB_CURRENCY: Currency = "USD";

export class FinnhubProvider implements PriceProvider {
  public readonly source = PriceSource.FINNHUB;

  private readonly apiKey: string;

  public constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  public async fetchQuote(sourceSymbol: string): Promise<Quote> {
    if (!this.apiKey) {
      throw new Error(
        `FINNHUB_API_KEY is not configured, cannot price symbol ${sourceSymbol}`
      );
    }

    const url = `${FINNHUB_QUOTE_URL}?symbol=${encodeURIComponent(
      sourceSymbol
    )}&token=${this.apiKey}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Finnhub quote request failed (symbol: ${sourceSymbol}, status: ${response.status})`
      );
    }

    const data: { c?: number } = await response.json();
    const price = data?.c;

    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
      throw new Error(
        `Finnhub returned no usable price (symbol: ${sourceSymbol}, received: ${JSON.stringify(
          data
        )})`
      );
    }

    return {
      price,
      currency: FINNHUB_CURRENCY,
      fetchedAt: new Date(),
      source: "Finnhub",
    };
  }
}

export const finnhubProvider = new FinnhubProvider(
  process.env.FINNHUB_API_KEY ?? ""
);
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/providers/__tests__/FinnhubProvider.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the contract test**

Create `src/lib/providers/__tests__/FinnhubProvider.contract.test.ts`. This is what catches Finnhub changing its free-tier policy.

```ts
import { describe, expect, it } from "vitest";
import { FinnhubProvider } from "@/lib/providers/FinnhubProvider";

const apiKey = process.env.FINNHUB_API_KEY ?? "";

describe.skipIf(!apiKey)("FinnhubProvider contract", () => {
  const provider = new FinnhubProvider(apiKey);

  it.each([
    ["IVV", 100, 2000],
    ["QQQ", 100, 2000],
    ["DIA", 100, 2000],
    ["EEM", 10, 500],
    ["VNQ", 10, 500],
    ["BA", 20, 1000],
    ["DIS", 20, 1000],
  ])("prices %s within a sane range", async (symbol, low, high) => {
    const quote = await provider.fetchQuote(symbol);
    expect(quote.currency).toBe("USD");
    expect(quote.price).toBeGreaterThan(low);
    expect(quote.price).toBeLessThan(high);
  });

  it("rejects an unknown symbol rather than returning zero", async () => {
    await expect(provider.fetchQuote("ZZZZNOTREAL")).rejects.toThrow();
  });
});
```

- [ ] **Step 6: Run the contract test**

Run: `FINNHUB_API_KEY=$(grep '^FINNHUB_API_KEY=' .env | cut -d= -f2) npx vitest run src/lib/providers/__tests__/FinnhubProvider.contract.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 7: Commit**

```bash
git add src/lib/providers/FinnhubProvider.ts src/lib/providers/__tests__/
git commit -m "feat(providers): add FinnhubProvider that throws instead of returning null"
```

---

### Task 4: BinanceProvider

Ports `CryptoPriceProvider` to the throwing contract. The symbol normalisation logic is correct and is kept verbatim.

**Files:**
- Create: `src/lib/providers/BinanceProvider.ts`
- Create: `src/lib/providers/__tests__/BinanceProvider.test.ts`
- Create: `src/lib/providers/__tests__/BinanceProvider.contract.test.ts`
- Delete: `src/lib/providers/CryptoPriceProvider.ts`

**Interfaces:**
- Consumes: `Quote`, `PriceProvider` from Task 2
- Produces: `class BinanceProvider implements PriceProvider`, singleton `binanceProvider`

- [ ] **Step 1: Write the failing unit tests**

Create `src/lib/providers/__tests__/BinanceProvider.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { BinanceProvider } from "@/lib/providers/BinanceProvider";

function mockFetch(body: unknown, ok = true, status = 200): ReturnType<typeof vi.fn> {
  const spy = vi.fn().mockResolvedValue({ ok, status, json: async () => body });
  vi.stubGlobal("fetch", spy);
  return spy;
}

describe("BinanceProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns a USD quote parsed from the string price", async () => {
    mockFetch({ symbol: "BTCUSDT", price: "64205.03000000" });
    const quote = await new BinanceProvider().fetchQuote("BTC");
    expect(quote.price).toBeCloseTo(64205.03);
    expect(quote.currency).toBe("USD");
  });

  it.each([
    ["BTC", "BTCUSDT"],
    ["btc", "BTCUSDT"],
    ["BTCUSDT", "BTCUSDT"],
    ["BTCUSD", "BTCUSDT"],
    ["1INCH", "1INCHUSDT"],
    ["BTC - קריפטו", "BTCUSDT"],
  ])("normalises %s to the pair %s", async (input, expected) => {
    const spy = mockFetch({ price: "1.0" });
    await new BinanceProvider().fetchQuote(input);
    expect(spy.mock.calls[0][0]).toContain(expected);
  });

  it("throws naming the pair when the response is not ok", async () => {
    mockFetch({}, false, 400);
    await expect(new BinanceProvider().fetchQuote("NOPE")).rejects.toThrow(
      /NOPEUSDT.*400/s
    );
  });

  it("throws when the price is not parseable", async () => {
    mockFetch({ price: "not-a-number" });
    await expect(new BinanceProvider().fetchQuote("BTC")).rejects.toThrow(
      /BTCUSDT/
    );
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/providers/__tests__/BinanceProvider.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/providers/BinanceProvider.ts`. The sheet writes crypto names as `BTC - קריפטו`, so normalisation must strip non-alphanumerics — hence the existing regex is retained.

```ts
import { PriceSource } from "@prisma/client";
import type { Currency, PriceProvider, Quote } from "@/lib/providers/types";

const BINANCE_TICKER_URL = "https://api.binance.com/api/v3/ticker/price";
const BINANCE_CURRENCY: Currency = "USD";

export class BinanceProvider implements PriceProvider {
  public readonly source = PriceSource.BINANCE;

  public async fetchQuote(sourceSymbol: string): Promise<Quote> {
    const pair = this.normalizeToBinancePair(sourceSymbol);
    const url = `${BINANCE_TICKER_URL}?symbol=${encodeURIComponent(pair)}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Binance quote request failed (pair: ${pair}, status: ${response.status})`
      );
    }

    const data: { price?: string } = await response.json();
    const price = typeof data?.price === "string" ? parseFloat(data.price) : NaN;

    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(
        `Binance returned no usable price (pair: ${pair}, received: ${JSON.stringify(
          data
        )})`
      );
    }

    return {
      price,
      currency: BINANCE_CURRENCY,
      fetchedAt: new Date(),
      source: "Binance",
    };
  }

  private normalizeToBinancePair(symbol: string): string {
    const ticker = String(symbol)
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "");

    if (ticker.endsWith("USDT")) {
      return ticker;
    }
    if (ticker.endsWith("USD")) {
      return ticker.replace(/USD$/, "USDT");
    }
    return `${ticker}USDT`;
  }
}

export const binanceProvider = new BinanceProvider();
```

Note: `"BTC - קריפטו"` strips to `BTC` because Hebrew characters are non-`[A-Z0-9]`.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/providers/__tests__/BinanceProvider.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Write the contract test covering all 13 held coins**

Create `src/lib/providers/__tests__/BinanceProvider.contract.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { BinanceProvider } from "@/lib/providers/BinanceProvider";

const HELD_COINS = [
  "BTC", "ETH", "ADA", "1INCH", "SHIB", "BNB", "DOGE",
  "DOT", "CAKE", "MATIC", "SOL", "DAR", "POL",
];

describe("BinanceProvider contract", () => {
  const provider = new BinanceProvider();

  it.each(HELD_COINS)("prices %s", async (symbol) => {
    const quote = await provider.fetchQuote(symbol);
    expect(quote.currency).toBe("USD");
    expect(quote.price).toBeGreaterThan(0);
  });

  it("rejects an unknown pair", async () => {
    await expect(provider.fetchQuote("ZZZZNOTREAL")).rejects.toThrow();
  });
});
```

- [ ] **Step 6: Run the contract test**

Run: `npx vitest run src/lib/providers/__tests__/BinanceProvider.contract.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 7: Delete the superseded provider**

`CryptoPriceProvider` is still imported by `src/lib/marketDataService.ts`. Repoint that import now:

```bash
rm src/lib/providers/CryptoPriceProvider.ts
```

In `src/lib/marketDataService.ts`, replace:

```ts
import { cryptoPriceProvider } from "@/lib/providers/CryptoPriceProvider";
```

with:

```ts
import { binanceProvider } from "@/lib/providers/BinanceProvider";
```

and inside `getMarketData`, replace `return cryptoPriceProvider.getPrice(symbol);` with:

```ts
    case InvestmentType.CRYPTO: {
      const quote = await binanceProvider.fetchQuote(symbol);
      return {
        price: quote.price,
        currency: quote.currency,
        lastUpdated: quote.fetchedAt,
        source: quote.source,
      };
    }
```

`getMarketData` is fully replaced in Task 9; this keeps the tree compiling in between.

- [ ] **Step 8: Verify the tree still typechecks**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no output. (`src/lib/providers/types.ts` will error on `PriceSource` until Task 8 — if so, proceed; it resolves there.)

- [ ] **Step 9: Commit**

```bash
git add -A src/lib/providers src/lib/marketDataService.ts
git commit -m "feat(providers): replace CryptoPriceProvider with throwing BinanceProvider"
```

---

### Task 5: BizportalProvider

Prices TASE securities — 39% of the portfolio. Two page layouts, and the field choice is subtle enough that getting it wrong produces a plausible-but-wrong number.

**Files:**
- Create: `src/lib/providers/BizportalProvider.ts`
- Create: `src/lib/providers/__tests__/BizportalProvider.test.ts`
- Create: `src/lib/providers/__tests__/BizportalProvider.contract.test.ts`
- Create: `src/lib/providers/__tests__/fixtures/bizportal-traded.html`
- Create: `src/lib/providers/__tests__/fixtures/bizportal-mutual.html`

**Interfaces:**
- Consumes: `Quote`, `PriceProvider` from Task 2
- Produces: `class BizportalProvider implements PriceProvider`, singleton `bizportalProvider`. `sourceSymbol` is the Israeli security number as a string, e.g. `"1159250"`.

- [ ] **Step 1: Capture real fixtures**

Do not hand-write these — the whole point is parsing real markup.

```bash
mkdir -p src/lib/providers/__tests__/fixtures
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
curl -sL -H "User-Agent: $UA" \
  "https://www.bizportal.co.il/tradedfund/quote/generalview/1159250" \
  -o src/lib/providers/__tests__/fixtures/bizportal-traded.html
curl -sL -H "User-Agent: $UA" \
  "https://www.bizportal.co.il/mutualfunds/quote/generalview/5109889" \
  -o src/lib/providers/__tests__/fixtures/bizportal-mutual.html
ls -la src/lib/providers/__tests__/fixtures/
```

Expected: two files, each roughly 170-200 KB.

- [ ] **Step 2: Write the failing unit tests**

Create `src/lib/providers/__tests__/BizportalProvider.test.ts`. Fixture prices are whatever the market did on capture day, so assert on ranges and on the *field selection*, not on frozen values.

```ts
import { readFileSync } from "fs";
import { join } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BizportalProvider } from "@/lib/providers/BizportalProvider";

const FIXTURES = join(__dirname, "fixtures");
const tradedHtml = readFileSync(join(FIXTURES, "bizportal-traded.html"), "utf8");
const mutualHtml = readFileSync(join(FIXTURES, "bizportal-mutual.html"), "utf8");

function mockFetch(html: string, ok = true, status = 200): void {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok, status, text: async () => html })
  );
}

describe("BizportalProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses a traded fund and converts agorot to NIS", async () => {
    mockFetch(tradedHtml);
    const quote = await new BizportalProvider().fetchQuote("1159250");
    expect(quote.currency).toBe("NIS");
    expect(quote.price).toBeGreaterThan(1000);
    expect(quote.price).toBeLessThan(5000);
  });

  it("takes the closing rate, not the base rate, for a traded fund", async () => {
    mockFetch(tradedHtml);
    const quote = await new BizportalProvider().fetchQuote("1159250");
    const asAgorot = Math.round(quote.price * 100);
    const baseRate = Number(
      /שער בסיס[\s\S]{0,200}?<dd>([\d,]+)<\/dd>/
        .exec(tradedHtml)?.[1]
        ?.replace(/,/g, "") ?? "0"
    );
    if (baseRate > 0) {
      expect(asAgorot).not.toBe(baseRate);
    }
  });

  it("does not concatenate the percentage change into the price", async () => {
    mockFetch(tradedHtml);
    const quote = await new BizportalProvider().fetchQuote("1159250");
    expect(Number.isFinite(quote.price)).toBe(true);
    expect(quote.price).toBeGreaterThan(0);
  });

  it("parses a mutual fund redemption price and converts agorot to NIS", async () => {
    mockFetch(mutualHtml);
    const quote = await new BizportalProvider().fetchQuote("5109889");
    expect(quote.currency).toBe("NIS");
    expect(quote.price).toBeGreaterThan(1);
    expect(quote.price).toBeLessThan(100);
  });

  it("throws naming the security when the request fails", async () => {
    mockFetch("", false, 500);
    await expect(
      new BizportalProvider().fetchQuote("1159250")
    ).rejects.toThrow(/1159250.*500/s);
  });

  it("throws when neither layout is recognised", async () => {
    mockFetch("<html><body>nothing useful here</body></html>");
    await expect(
      new BizportalProvider().fetchQuote("9999999")
    ).rejects.toThrow(/9999999/);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/lib/providers/__tests__/BizportalProvider.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `src/lib/providers/BizportalProvider.ts`.

Critical details, all empirically verified:
- Traded fund markup is `<dt>שער נעילה</dt><dd><span class="drop">-1.32%</span><span>244,290</span></dd>`. The price is the **last** `<span>`; `dd.text()` yields `-1.32%244,290`.
- The label is `שער נעילה` (closing). `שער בסיס` (base) is a *different, wrong* number, and `שער אחרון` does not exist on these pages.
- Mutual fund markup is `.top-area-cube` with `.label` = `מחיר פדיון` and `.num` = `459.21`.
- A traded-fund page also contains one `.top-area-cube` labelled `שווי יחידה` that is always `--`, so layout detection must key on the price label, not on the presence of `.top-area-cube`.

```ts
import * as cheerio from "cheerio";
import { PriceSource } from "@prisma/client";
import type { Currency, PriceProvider, Quote } from "@/lib/providers/types";

const BIZPORTAL_URL = "https://www.bizportal.co.il/tradedfund/quote/generalview";
const BIZPORTAL_CURRENCY: Currency = "NIS";
const AGOROT_TO_NIS = 0.01;
const TRADED_FUND_PRICE_LABEL = "שער נעילה";
const MUTUAL_FUND_PRICE_LABEL = "מחיר פדיון";

export class BizportalProvider implements PriceProvider {
  public readonly source = PriceSource.BIZPORTAL;

  public async fetchQuote(sourceSymbol: string): Promise<Quote> {
    const url = `${BIZPORTAL_URL}/${encodeURIComponent(sourceSymbol)}`;
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; my-investments/1.0)" },
      redirect: "follow",
    });

    if (!response.ok) {
      throw new Error(
        `Bizportal request failed (security: ${sourceSymbol}, status: ${response.status}, url: ${url})`
      );
    }

    const html = await response.text();
    const agorot =
      this.parseTradedFundAgorot(html) ?? this.parseMutualFundAgorot(html);

    if (agorot === null) {
      throw new Error(
        `Bizportal page contained neither a "${TRADED_FUND_PRICE_LABEL}" nor a "${MUTUAL_FUND_PRICE_LABEL}" price (security: ${sourceSymbol}, url: ${url}). The page markup has probably changed.`
      );
    }

    return {
      price: agorot * AGOROT_TO_NIS,
      currency: BIZPORTAL_CURRENCY,
      fetchedAt: new Date(),
      source: "Bizportal",
    };
  }

  private parseTradedFundAgorot(html: string): number | null {
    const $ = cheerio.load(html);
    let agorot: number | null = null;

    $("dt").each((_index, element) => {
      const label = $(element).clone().children().remove().end().text().trim();
      if (label !== TRADED_FUND_PRICE_LABEL) {
        return;
      }
      const priceText = $(element).next("dd").find("span").last().text();
      const parsed = this.parseNumber(priceText);
      if (parsed !== null) {
        agorot = parsed;
      }
    });

    return agorot;
  }

  private parseMutualFundAgorot(html: string): number | null {
    const $ = cheerio.load(html);
    let agorot: number | null = null;

    $(".top-area-cube").each((_index, element) => {
      const label = $(element).find(".label").first().text().trim();
      if (label !== MUTUAL_FUND_PRICE_LABEL) {
        return;
      }
      const parsed = this.parseNumber($(element).find(".num").first().text());
      if (parsed !== null) {
        agorot = parsed;
      }
    });

    return agorot;
  }

  private parseNumber(text: string): number | null {
    const parsed = parseFloat(text.replace(/,/g, "").trim());
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  }
}

export const bizportalProvider = new BizportalProvider();
```

Requesting `/tradedfund/` always works: Bizportal 301s to `/mutualfunds/` for mutual funds, and `redirect: "follow"` handles it. Verified against 5109889.

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/lib/providers/__tests__/BizportalProvider.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Write the contract test**

Create `src/lib/providers/__tests__/BizportalProvider.contract.test.ts`. This is the highest-value test in the suite — it is the tripwire for the scrape breaking.

```ts
import { describe, expect, it } from "vitest";
import { BizportalProvider } from "@/lib/providers/BizportalProvider";

describe("BizportalProvider contract", () => {
  const provider = new BizportalProvider();

  it.each([
    ["1159250", "iShares CORE S&P 500", 1000, 5000],
    ["1159094", "iShares CORE MSCI EUROPE", 100, 1000],
    ["1159169", "iShares CORE MSCI EM IMI", 50, 500],
    ["5109889", "TLV 125 (mutual fund)", 1, 100],
  ])("prices %s — %s", async (securityId, _name, low, high) => {
    const quote = await provider.fetchQuote(securityId);
    expect(quote.currency).toBe("NIS");
    expect(quote.price).toBeGreaterThan(low);
    expect(quote.price).toBeLessThan(high);
  });

  it("throws for a security number that does not exist", async () => {
    await expect(provider.fetchQuote("9999999")).rejects.toThrow();
  });
});
```

- [ ] **Step 7: Run the contract test**

Run: `npx vitest run src/lib/providers/__tests__/BizportalProvider.contract.test.ts`
Expected: PASS, 5 tests.

If a range assertion fails, check whether the price genuinely moved or the parser regressed to `שער בסיס`. Compare against the sheet: 1159250 ≈ 2442.90, 1159094 ≈ 363.40, 1159169 ≈ 160.90, 5109889 ≈ 4.5921.

- [ ] **Step 8: Commit**

```bash
git add src/lib/providers/BizportalProvider.ts src/lib/providers/__tests__/
git commit -m "feat(providers): add BizportalProvider for TASE securities"
```

---

### Task 6: Provider registry

**Files:**
- Create: `src/lib/providers/providerRegistry.ts`
- Create: `src/lib/providers/__tests__/providerRegistry.test.ts`

**Interfaces:**
- Consumes: `finnhubProvider`, `binanceProvider`, `bizportalProvider`
- Produces: `getProvider(source: PriceSource): PriceProvider` — throws for `MANUAL`

`MANUAL` deliberately has no provider. Manual holdings carry a stored NIS value rather than a symbol, so they cannot satisfy `fetchQuote(sourceSymbol)`; Task 9's pricing service branches on `MANUAL` before ever consulting the registry.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/providers/__tests__/providerRegistry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PriceSource } from "@prisma/client";
import { getProvider } from "@/lib/providers/providerRegistry";

describe("getProvider", () => {
  it.each([
    [PriceSource.FINNHUB],
    [PriceSource.BINANCE],
    [PriceSource.BIZPORTAL],
  ])("returns a provider whose source matches %s", (source) => {
    expect(getProvider(source).source).toBe(source);
  });

  it("throws for MANUAL, which has no remote provider", () => {
    expect(() => getProvider(PriceSource.MANUAL)).toThrow(/MANUAL/);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/providers/__tests__/providerRegistry.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/providers/providerRegistry.ts`. The `satisfies Record<PriceSource, ...>` makes adding a new `PriceSource` a compile error until it is handled — per the enum-exhaustiveness rule.

```ts
import { PriceSource } from "@prisma/client";
import type { PriceProvider } from "@/lib/providers/types";
import { finnhubProvider } from "@/lib/providers/FinnhubProvider";
import { binanceProvider } from "@/lib/providers/BinanceProvider";
import { bizportalProvider } from "@/lib/providers/BizportalProvider";

const PROVIDERS = {
  [PriceSource.FINNHUB]: finnhubProvider,
  [PriceSource.BINANCE]: binanceProvider,
  [PriceSource.BIZPORTAL]: bizportalProvider,
  [PriceSource.MANUAL]: null,
} satisfies Record<PriceSource, PriceProvider | null>;

export function getProvider(source: PriceSource): PriceProvider {
  const provider = PROVIDERS[source];

  if (!provider) {
    throw new Error(
      `No remote price provider exists for source ${source}; manual holdings must be valued from their stored value`
    );
  }

  return provider;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/providers/__tests__/providerRegistry.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/providers/providerRegistry.ts src/lib/providers/__tests__/providerRegistry.test.ts
git commit -m "feat(providers): add exhaustive provider registry"
```

---

### Task 7: Allocation and drift math

Pure functions, no I/O — written before the schema so the dashboard logic is testable in isolation.

**Files:**
- Create: `src/lib/pricing/allocation.ts`
- Create: `src/lib/pricing/__tests__/allocation.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `interface WeightedItem { key: string; valueInNis: number; targetPercent: number | null }`
  - `interface AllocationSlice { key: string; valueInNis: number; actualPercent: number; targetPercent: number | null; driftPercent: number | null; rebalanceAmountNis: number | null }`
  - `computeAllocation(items: WeightedItem[]): AllocationSlice[]`
  - `groupBy<T>(items: T[], toKey: (item: T) => string, toValue: (item: T) => number): Record<string, number>`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/pricing/__tests__/allocation.test.ts`. The Excellence Pro numbers are the real ones from the sheet, so the drift figures are directly checkable.

```ts
import { describe, expect, it } from "vitest";
import { computeAllocation, groupBy } from "@/lib/pricing/allocation";

describe("computeAllocation", () => {
  it("computes actual percentages that sum to 100", () => {
    const slices = computeAllocation([
      { key: "a", valueInNis: 250, targetPercent: null },
      { key: "b", valueInNis: 750, targetPercent: null },
    ]);
    expect(slices.find((s) => s.key === "a")?.actualPercent).toBeCloseTo(25);
    expect(slices.find((s) => s.key === "b")?.actualPercent).toBeCloseTo(75);
  });

  it("computes drift and the rebalance amount against a target", () => {
    const slices = computeAllocation([
      { key: "over", valueInNis: 600, targetPercent: 50 },
      { key: "under", valueInNis: 400, targetPercent: 50 },
    ]);
    const over = slices.find((s) => s.key === "over");
    expect(over?.driftPercent).toBeCloseTo(10);
    expect(over?.rebalanceAmountNis).toBeCloseTo(-100);

    const under = slices.find((s) => s.key === "under");
    expect(under?.driftPercent).toBeCloseTo(-10);
    expect(under?.rebalanceAmountNis).toBeCloseTo(100);
  });

  it("matches the real Excellence Pro drift from the spreadsheet", () => {
    const slices = computeAllocation([
      { key: "1159250", valueInNis: 307805, targetPercent: 54.0 },
      { key: "1159094", valueInNis: 124283, targetPercent: 22.5 },
      { key: "1159169", valueInNis: 92196, targetPercent: 13.5 },
      { key: "5109889", valueInNis: 60799, targetPercent: 10.0 },
    ]);
    expect(slices.find((s) => s.key === "1159250")?.actualPercent).toBeCloseTo(52.61, 1);
    expect(slices.find((s) => s.key === "1159094")?.actualPercent).toBeCloseTo(21.24, 1);
    expect(slices.find((s) => s.key === "1159169")?.actualPercent).toBeCloseTo(15.76, 1);
    expect(slices.find((s) => s.key === "5109889")?.actualPercent).toBeCloseTo(10.39, 1);
  });

  it("leaves target-derived fields null when no target is set", () => {
    const slices = computeAllocation([
      { key: "a", valueInNis: 100, targetPercent: null },
    ]);
    expect(slices[0].targetPercent).toBeNull();
    expect(slices[0].driftPercent).toBeNull();
    expect(slices[0].rebalanceAmountNis).toBeNull();
  });

  it("returns an empty array for no items", () => {
    expect(computeAllocation([])).toEqual([]);
  });

  it("reports zero percentages when the total is zero rather than dividing by zero", () => {
    const slices = computeAllocation([
      { key: "btb", valueInNis: 0, targetPercent: null },
    ]);
    expect(slices[0].actualPercent).toBe(0);
  });

  it("sorts slices by value descending", () => {
    const slices = computeAllocation([
      { key: "small", valueInNis: 1, targetPercent: null },
      { key: "big", valueInNis: 100, targetPercent: null },
    ]);
    expect(slices.map((s) => s.key)).toEqual(["big", "small"]);
  });
});

describe("groupBy", () => {
  it("sums values per key", () => {
    const totals = groupBy(
      [
        { platform: "IBKR", value: 10 },
        { platform: "IBKR", value: 5 },
        { platform: "Binance", value: 3 },
      ],
      (row) => row.platform,
      (row) => row.value
    );
    expect(totals).toEqual({ IBKR: 15, Binance: 3 });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/lib/pricing/__tests__/allocation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `src/lib/pricing/allocation.ts`:

```ts
export interface WeightedItem {
  key: string;
  valueInNis: number;
  targetPercent: number | null;
}

export interface AllocationSlice {
  key: string;
  valueInNis: number;
  actualPercent: number;
  targetPercent: number | null;
  driftPercent: number | null;
  rebalanceAmountNis: number | null;
}

export function computeAllocation(items: WeightedItem[]): AllocationSlice[] {
  const total = items.reduce((sum, item) => sum + item.valueInNis, 0);

  return items
    .map((item) => {
      const actualPercent = total > 0 ? (item.valueInNis / total) * 100 : 0;
      const hasTarget = item.targetPercent !== null;

      return {
        key: item.key,
        valueInNis: item.valueInNis,
        actualPercent,
        targetPercent: item.targetPercent,
        driftPercent: hasTarget ? actualPercent - item.targetPercent! : null,
        rebalanceAmountNis: hasTarget
          ? (item.targetPercent! / 100) * total - item.valueInNis
          : null,
      };
    })
    .sort((a, b) => b.valueInNis - a.valueInNis);
}

export function groupBy<T>(
  items: T[],
  toKey: (item: T) => string,
  toValue: (item: T) => number
): Record<string, number> {
  return items.reduce((totals: Record<string, number>, item) => {
    const key = toKey(item);
    totals[key] = (totals[key] || 0) + toValue(item);
    return totals;
  }, {});
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/pricing/__tests__/allocation.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pricing/allocation.ts src/lib/pricing/__tests__/allocation.test.ts
git commit -m "feat(pricing): add allocation and rebalance drift calculations"
```

---

### Task 8: Schema migration

Destructive. Confirmed there is nothing worth preserving in the database.

**Files:**
- Modify: `src/prisma/schema.prisma`
- Modify: `src/types/index.ts`

**Interfaces:**
- Consumes: nothing
- Produces: Prisma models `Platform`, `Holding`, `HoldingSnapshot`; enums `AssetClass`, `Liquidity`, `PriceSource`. Unblocks the `PriceSource` import in Task 2.

- [ ] **Step 1: Replace the models in `src/prisma/schema.prisma`**

Delete the `Investment` and `InvestmentSnapshot` models and the `InvestmentType` enum. Keep `User` and `Settings`, changing `User.investments` to `User.holdings`. Add:

```prisma
model Platform {
  id           String    @id @default(uuid())
  userId       String
  name         String
  baseCurrency String
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  user         User      @relation(fields: [userId], references: [id])
  holdings     Holding[]

  @@unique([userId, name])
}

model Holding {
  id            String      @id @default(uuid())
  userId        String
  platformId    String
  assetName     String
  assetClass    AssetClass
  liquidity     Liquidity
  quantity      Float
  priceSource   PriceSource
  sourceSymbol  String?
  currency      String
  targetPercent Float?

  manualValueNis       Float?
  manualValueUpdatedAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User              @relation(fields: [userId], references: [id])
  platform  Platform          @relation(fields: [platformId], references: [id])
  snapshots HoldingSnapshot[]

  @@index([userId])
}

model HoldingSnapshot {
  id         String   @id @default(uuid())
  holdingId  String
  date       DateTime
  quantity   Float
  unitPrice  Float
  currency   String
  fxRateUsed Float
  valueNis   Float
  holding    Holding  @relation(fields: [holdingId], references: [id])

  @@unique([holdingId, date])
  @@index([date])
}

enum AssetClass {
  EQUITY
  CRYPTO
  NON_EQUITY
}

enum Liquidity {
  LIQUID
  ILLIQUID
}

enum PriceSource {
  FINNHUB
  BINANCE
  BIZPORTAL
  MANUAL
}
```

In `model User`, replace `investments  Investment[]` with:

```prisma
  holdings    Holding[]
  platforms   Platform[]
```

- [ ] **Step 2: Generate the migration**

```bash
npm run db:migrate -- --name replace_investments_with_platform_holdings
```

Prisma will warn about dropping `Investment` and `InvestmentSnapshot`. Accept — this is intended and confirmed.

- [ ] **Step 3: Verify the client regenerated**

Run: `npx prisma generate --schema src/prisma/schema.prisma`
Expected: "Generated Prisma Client".

Run: `node -e "const{PriceSource,AssetClass,Liquidity}=require('@prisma/client');console.log(Object.keys(PriceSource),Object.keys(AssetClass),Object.keys(Liquidity))"`
Expected: `[ 'FINNHUB', 'BINANCE', 'BIZPORTAL', 'MANUAL' ] [ 'EQUITY', 'CRYPTO', 'NON_EQUITY' ] [ 'LIQUID', 'ILLIQUID' ]`

- [ ] **Step 4: Update `src/types/index.ts`**

Delete `InvestmentType`, `Investment`, `InvestmentSnapshot`, `InvestmentFormData`. Replace with:

```ts
export interface HoldingFormData {
  platformId: string;
  assetName: string;
  assetClass: AssetClass;
  liquidity: Liquidity;
  quantity: number;
  priceSource: PriceSource;
  sourceSymbol?: string;
  currency: string;
  targetPercent?: number;
  manualValueNis?: number;
}
```

Add at the top: `import type { AssetClass, Liquidity, PriceSource } from "@prisma/client";`

Also update `User.investments` to `holdings: Holding[]` and delete `PortfolioSummary.categoryTotals`'s old shape if it references `InvestmentType`.

- [ ] **Step 5: Confirm the provider contract now compiles**

Run: `npx vitest run src/lib/providers/__tests__/providerRegistry.test.ts`
Expected: PASS, 4 tests — `PriceSource` now resolves.

- [ ] **Step 6: Commit**

```bash
git add src/prisma src/types/index.ts
git commit -m "feat(prisma): replace Investment with Platform, Holding and HoldingSnapshot"
```

---

### Task 9: Portfolio pricing service

The orchestration layer, and where the "never emit an unjustified total" rule lives.

**Files:**
- Create: `src/lib/pricing/portfolioPricingService.types.ts`
- Create: `src/lib/pricing/portfolioPricingService.ts`
- Create: `src/lib/pricing/__tests__/portfolioPricingService.test.ts`
- Delete: `src/lib/marketDataService.ts`

**Interfaces:**
- Consumes: `getProvider` (Task 6), `fxRateProvider` (existing), `describeError` (existing)
- Produces:
  - `interface HoldingValuation { holdingId: string; assetName: string; valueInNis: number; unitPrice: number | null; currency: string; fetchedAt: Date }`
  - `interface PricingFailure { holdingId: string; assetName: string; sourceSymbol: string | null; reason: string }`
  - `interface PricingResult { valuations: HoldingValuation[]; failures: PricingFailure[]; usdToNisRate: number; totalValueNis: number | null; pricedValueNis: number }`
  - `priceHoldings(holdings: Holding[]): Promise<PricingResult>`

- [ ] **Step 1: Create the types file**

Create `src/lib/pricing/portfolioPricingService.types.ts`:

```ts
export interface HoldingValuation {
  holdingId: string;
  assetName: string;
  valueInNis: number;
  unitPrice: number | null;
  currency: string;
  fetchedAt: Date;
}

export interface PricingFailure {
  holdingId: string;
  assetName: string;
  sourceSymbol: string | null;
  reason: string;
}

export interface PricingResult {
  valuations: HoldingValuation[];
  failures: PricingFailure[];
  usdToNisRate: number;
  totalValueNis: number | null;
  pricedValueNis: number;
}
```

- [ ] **Step 2: Write the failing tests**

Create `src/lib/pricing/__tests__/portfolioPricingService.test.ts`. The third test is the regression guard for the bug that motivated this whole rewrite.

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssetClass, Liquidity, PriceSource } from "@prisma/client";
import type { Holding } from "@prisma/client";

const fetchQuote = vi.fn();
const getUsdToNisRate = vi.fn();

vi.mock("@/lib/providers/providerRegistry", () => ({
  getProvider: () => ({ source: PriceSource.FINNHUB, fetchQuote }),
}));

vi.mock("@/lib/providers/FxRateProvider", () => ({
  fxRateProvider: { getUsdToNisRate: () => getUsdToNisRate() },
}));

const { priceHoldings } = await import("@/lib/pricing/portfolioPricingService");

function holding(overrides: Partial<Holding> = {}): Holding {
  return {
    id: "h1",
    userId: "u1",
    platformId: "p1",
    assetName: "S&P",
    assetClass: AssetClass.EQUITY,
    liquidity: Liquidity.LIQUID,
    quantity: 148,
    priceSource: PriceSource.FINNHUB,
    sourceSymbol: "SPY",
    currency: "USD",
    targetPercent: null,
    manualValueNis: null,
    manualValueUpdatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Holding;
}

describe("priceHoldings", () => {
  beforeEach(() => {
    fetchQuote.mockReset();
    getUsdToNisRate.mockReset();
    getUsdToNisRate.mockResolvedValue({ price: 3.0541 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("converts a USD holding into NIS", async () => {
    fetchQuote.mockResolvedValue({
      price: 738.93,
      currency: "USD",
      fetchedAt: new Date(),
      source: "Finnhub",
    });
    const result = await priceHoldings([holding()]);
    expect(result.failures).toHaveLength(0);
    expect(result.valuations[0].valueInNis).toBeCloseTo(148 * 738.93 * 3.0541, 0);
    expect(result.totalValueNis).toBeCloseTo(148 * 738.93 * 3.0541, 0);
  });

  it("does not convert a holding already priced in NIS", async () => {
    fetchQuote.mockResolvedValue({
      price: 2442.9,
      currency: "NIS",
      fetchedAt: new Date(),
      source: "Bizportal",
    });
    const result = await priceHoldings([
      holding({ quantity: 126, currency: "NIS", priceSource: PriceSource.BIZPORTAL }),
    ]);
    expect(result.valuations[0].valueInNis).toBeCloseTo(126 * 2442.9, 0);
  });

  it("suppresses the total when any holding fails, and never sums unconverted values", async () => {
    fetchQuote
      .mockResolvedValueOnce({
        price: 100,
        currency: "USD",
        fetchedAt: new Date(),
        source: "Finnhub",
      })
      .mockRejectedValueOnce(new Error("provider exploded"));

    const result = await priceHoldings([
      holding({ id: "ok", quantity: 1 }),
      holding({ id: "bad", assetName: "Broken", sourceSymbol: "ZZZ" }),
    ]);

    expect(result.totalValueNis).toBeNull();
    expect(result.pricedValueNis).toBeCloseTo(100 * 3.0541, 0);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].holdingId).toBe("bad");
    expect(result.failures[0].reason).toContain("provider exploded");
  });

  it("values a manual holding from its stored NIS amount without calling a provider", async () => {
    const result = await priceHoldings([
      holding({
        id: "sara",
        assetName: "שרה",
        priceSource: PriceSource.MANUAL,
        sourceSymbol: null,
        currency: "NIS",
        quantity: 1,
        manualValueNis: 84919,
        liquidity: Liquidity.ILLIQUID,
      }),
    ]);
    expect(fetchQuote).not.toHaveBeenCalled();
    expect(result.valuations[0].valueInNis).toBe(84919);
    expect(result.valuations[0].unitPrice).toBeNull();
    expect(result.totalValueNis).toBe(84919);
  });

  it("fails a manual holding that has no stored value", async () => {
    const result = await priceHoldings([
      holding({
        priceSource: PriceSource.MANUAL,
        sourceSymbol: null,
        manualValueNis: null,
      }),
    ]);
    expect(result.failures).toHaveLength(1);
    expect(result.totalValueNis).toBeNull();
  });

  it("fails a market holding with no source symbol", async () => {
    const result = await priceHoldings([holding({ sourceSymbol: null })]);
    expect(result.failures[0].reason).toMatch(/source symbol/i);
    expect(fetchQuote).not.toHaveBeenCalled();
  });

  it("propagates an FX failure rather than returning a partial result", async () => {
    getUsdToNisRate.mockRejectedValue(new Error("fx down"));
    await expect(priceHoldings([holding()])).rejects.toThrow(/fx down/);
  });

  it("fetches the FX rate once regardless of holding count", async () => {
    fetchQuote.mockResolvedValue({
      price: 1,
      currency: "USD",
      fetchedAt: new Date(),
      source: "Finnhub",
    });
    await priceHoldings([holding({ id: "a" }), holding({ id: "b" }), holding({ id: "c" })]);
    expect(getUsdToNisRate).toHaveBeenCalledTimes(1);
  });

  it("returns a zero total and no failures for an empty portfolio", async () => {
    const result = await priceHoldings([]);
    expect(result.totalValueNis).toBe(0);
    expect(result.failures).toEqual([]);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run src/lib/pricing/__tests__/portfolioPricingService.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `src/lib/pricing/portfolioPricingService.ts`:

```ts
import { PriceSource } from "@prisma/client";
import type { Holding } from "@prisma/client";
import { getProvider } from "@/lib/providers/providerRegistry";
import { fxRateProvider } from "@/lib/providers/FxRateProvider";
import { describeError } from "@/utils/describeError";
import type {
  HoldingValuation,
  PricingFailure,
  PricingResult,
} from "@/lib/pricing/portfolioPricingService.types";

export type {
  HoldingValuation,
  PricingFailure,
  PricingResult,
} from "@/lib/pricing/portfolioPricingService.types";

export async function priceHoldings(
  holdings: Holding[]
): Promise<PricingResult> {
  const rate = await fxRateProvider.getUsdToNisRate();
  const usdToNisRate = rate.price;

  const valuations: HoldingValuation[] = [];
  const failures: PricingFailure[] = [];

  for (const holding of holdings) {
    try {
      valuations.push(await valueHolding(holding, usdToNisRate));
    } catch (error) {
      failures.push({
        holdingId: holding.id,
        assetName: holding.assetName,
        sourceSymbol: holding.sourceSymbol,
        reason: describeError(error),
      });
    }
  }

  const pricedValueNis = valuations.reduce(
    (sum, valuation) => sum + valuation.valueInNis,
    0
  );

  return {
    valuations,
    failures,
    usdToNisRate,
    totalValueNis: failures.length === 0 ? pricedValueNis : null,
    pricedValueNis,
  };
}

async function valueHolding(
  holding: Holding,
  usdToNisRate: number
): Promise<HoldingValuation> {
  if (holding.priceSource === PriceSource.MANUAL) {
    return valueManualHolding(holding);
  }

  if (!holding.sourceSymbol) {
    throw new Error(
      `Holding has no source symbol but its price source is ${holding.priceSource} (holding: ${holding.assetName})`
    );
  }

  const provider = getProvider(holding.priceSource);
  const quote = await provider.fetchQuote(holding.sourceSymbol);

  return {
    holdingId: holding.id,
    assetName: holding.assetName,
    valueInNis: convertToNis(
      holding.quantity * quote.price,
      quote.currency,
      usdToNisRate
    ),
    unitPrice: quote.price,
    currency: quote.currency,
    fetchedAt: quote.fetchedAt,
  };
}

function valueManualHolding(holding: Holding): HoldingValuation {
  if (
    holding.manualValueNis === null ||
    !Number.isFinite(holding.manualValueNis)
  ) {
    throw new Error(
      `Manual holding has no stored value; set one in settings (holding: ${holding.assetName})`
    );
  }

  return {
    holdingId: holding.id,
    assetName: holding.assetName,
    valueInNis: holding.manualValueNis,
    unitPrice: null,
    currency: "NIS",
    fetchedAt: holding.manualValueUpdatedAt ?? holding.updatedAt,
  };
}

export function convertToNis(
  amount: number,
  fromCurrency: string,
  usdToNisRate: number
): number {
  switch (fromCurrency) {
    case "NIS":
      return amount;
    case "USD":
      return amount * usdToNisRate;
    default:
      throw new Error(
        `Cannot convert to NIS from unsupported currency (currency: ${fromCurrency}, amount: ${amount})`
      );
  }
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/lib/pricing/__tests__/portfolioPricingService.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 6: Delete the superseded service**

```bash
rm src/lib/marketDataService.ts
```

`src/app/api/investments/route.ts` and `src/app/api/snapshot/route.ts` still import it; they are replaced in Tasks 11 and 12. The tree will not typecheck until then — expected.

- [ ] **Step 7: Commit**

```bash
git add -A src/lib/pricing src/lib/marketDataService.ts
git commit -m "feat(pricing): add portfolio pricing service that refuses unjustified totals"
```

---

### Task 10: Sheet importer

One-time script. Its real deliverable is the reconciliation — if imported totals do not match the sheet, the import is wrong.

**Files:**
- Create: `scripts/importFromSheet.ts`
- Create: `scripts/sheetData.ts`
- Create: `scripts/__tests__/sheetData.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: Prisma models from Task 8
- Produces: `SHEET_PLATFORMS`, `SHEET_HOLDINGS`, `SHEET_TOTALS`, `reconcile()`; npm script `db:import-sheet`

- [ ] **Step 1: Create the static sheet data**

The sheet is retired after this, so the data is transcribed rather than parsed at runtime. Create `scripts/sheetData.ts`:

```ts
import { AssetClass, Liquidity, PriceSource } from "@prisma/client";

export const SHEET_FX_RATE = 3.04635;

export interface SheetHolding {
  platform: string;
  assetName: string;
  assetClass: AssetClass;
  liquidity: Liquidity;
  quantity: number;
  priceSource: PriceSource;
  sourceSymbol: string | null;
  currency: string;
  sheetPrice: number | null;
  targetPercent: number | null;
  manualValueNis: number | null;
}

export const SHEET_PLATFORMS = [
  { name: "Interactive Brokers", baseCurrency: "USD" },
  { name: "Binance", baseCurrency: "USD" },
  { name: "Excellence Pro", baseCurrency: "NIS" },
  { name: "Other", baseCurrency: "NIS" },
];

const ibkr = (
  assetName: string,
  quantity: number,
  sourceSymbol: string,
  sheetPrice: number
): SheetHolding => ({
  platform: "Interactive Brokers",
  assetName,
  assetClass: AssetClass.EQUITY,
  liquidity: Liquidity.LIQUID,
  quantity,
  priceSource: PriceSource.FINNHUB,
  sourceSymbol,
  currency: "USD",
  sheetPrice,
  targetPercent: null,
  manualValueNis: null,
});

const irish = (
  assetName: string,
  quantity: number,
  sheetPrice: number,
  manualValueNis: number
): SheetHolding => ({
  platform: "Interactive Brokers",
  assetName,
  assetClass: AssetClass.EQUITY,
  liquidity: Liquidity.LIQUID,
  quantity,
  priceSource: PriceSource.MANUAL,
  sourceSymbol: null,
  currency: "NIS",
  sheetPrice,
  targetPercent: null,
  manualValueNis,
});

const crypto = (
  symbol: string,
  quantity: number,
  targetPercent: number | null
): SheetHolding => ({
  platform: "Binance",
  assetName: symbol,
  assetClass: AssetClass.CRYPTO,
  liquidity: Liquidity.LIQUID,
  quantity,
  priceSource: PriceSource.BINANCE,
  sourceSymbol: symbol,
  currency: "USD",
  sheetPrice: null,
  targetPercent,
  manualValueNis: null,
});

const excellence = (
  assetName: string,
  securityId: string,
  quantity: number,
  sheetPrice: number,
  targetPercent: number
): SheetHolding => ({
  platform: "Excellence Pro",
  assetName,
  assetClass: AssetClass.EQUITY,
  liquidity: Liquidity.LIQUID,
  quantity,
  priceSource: PriceSource.BIZPORTAL,
  sourceSymbol: securityId,
  currency: "NIS",
  sheetPrice,
  targetPercent,
  manualValueNis: null,
});

export const SHEET_HOLDINGS: SheetHolding[] = [
  ibkr("S&P", 148, "IVV", 741.2),
  ibkr("NASDAQ", 89, "QQQ", 682.99),
  ibkr("Dow Jones", 68, "DIA", 518.52),
  ibkr("MSCI", 239, "EEM", 63.27),
  ibkr("VNQ", 137, "VNQ", 100.92),
  ibkr("Boeing", 5, "BA", 209.61),
  ibkr("Disney", 6, "DIS", 94.77),
  irish("Irish MSCI", 18, 52.15, 2860),
  irish("Irish S&P", 5, 801.39, 12207),
  irish("Irish NASDAQ", 4, 682.99, 8323),

  excellence("iShares CORE S&P 500", "1159250", 126, 2442.9, 54.0),
  excellence("iShares CORE MSCI EUROPE", "1159094", 342, 363.4, 22.5),
  excellence("iShares CORE MSCI EM IMI", "1159169", 573, 160.9, 13.5),
  excellence("TLV 125", "5109889", 13240, 4.5921, 10.0),

  crypto("BTC", 0.319043, 35),
  crypto("ETH", 2.84245873, 25),
  crypto("ADA", 2129.13, 15),
  crypto("BNB", 2.23062261, 4),
  crypto("DOGE", 2441.4, 3),
  crypto("DOT", 28.09343628, 3),
  crypto("SHIB", 41837962.57, 3),
  crypto("CAKE", 85.82799929, 3),
  crypto("1INCH", 107.3157289, 3),
  crypto("SOL", 3.06246084, 2),
  crypto("DAR", 185.8019098, 1),
  crypto("MATIC", 698.029446, null),
  crypto("POL", 701.8623572, null),

  {
    platform: "Other",
    assetName: "שרה",
    assetClass: AssetClass.EQUITY,
    liquidity: Liquidity.ILLIQUID,
    quantity: 1,
    priceSource: PriceSource.MANUAL,
    sourceSymbol: null,
    currency: "NIS",
    sheetPrice: null,
    targetPercent: null,
    manualValueNis: 84919,
  },
  {
    platform: "Other",
    assetName: "BTB - הלוואות חברתיות",
    assetClass: AssetClass.NON_EQUITY,
    liquidity: Liquidity.ILLIQUID,
    quantity: 1,
    priceSource: PriceSource.MANUAL,
    sourceSymbol: null,
    currency: "NIS",
    sheetPrice: null,
    targetPercent: null,
    manualValueNis: 0,
  },
];

export const SHEET_TOTALS = {
  interactiveBrokers: 743264,
  excellencePro: 585083,
  binanceExcludingMatic: 85743,
  manual: 84919,
  grandTotal: 1499009,
};
```

- [ ] **Step 2: Write the failing reconciliation test**

Create `scripts/__tests__/sheetData.test.ts`. MATIC is deliberately excluded because the sheet's own summary omits it.

```ts
import { describe, expect, it } from "vitest";
import { PriceSource } from "@prisma/client";
import {
  SHEET_FX_RATE,
  SHEET_HOLDINGS,
  SHEET_TOTALS,
} from "../sheetData";

function valueOf(platform: string, excludeAssetNames: string[] = []): number {
  return SHEET_HOLDINGS.filter(
    (holding) =>
      holding.platform === platform &&
      !excludeAssetNames.includes(holding.assetName)
  ).reduce((sum, holding) => {
    if (holding.manualValueNis !== null) {
      return sum + holding.manualValueNis;
    }
    const nis =
      holding.currency === "USD"
        ? holding.quantity * (holding.sheetPrice ?? 0) * SHEET_FX_RATE
        : holding.quantity * (holding.sheetPrice ?? 0);
    return sum + nis;
  }, 0);
}

describe("sheet data reconciliation", () => {
  it("has 29 holdings", () => {
    expect(SHEET_HOLDINGS).toHaveLength(29);
  });

  it("reconciles Interactive Brokers to the sheet total", () => {
    expect(valueOf("Interactive Brokers")).toBeCloseTo(
      SHEET_TOTALS.interactiveBrokers,
      -1
    );
  });

  it("reconciles Excellence Pro to the sheet total", () => {
    expect(valueOf("Excellence Pro")).toBeCloseTo(
      SHEET_TOTALS.excellencePro,
      -1
    );
  });

  it("reconciles the manual holdings to the sheet total", () => {
    expect(valueOf("Other")).toBeCloseTo(SHEET_TOTALS.manual, -1);
  });

  it("gives every non-manual holding a source symbol", () => {
    for (const holding of SHEET_HOLDINGS) {
      if (holding.priceSource === PriceSource.MANUAL) {
        expect(holding.sourceSymbol).toBeNull();
        expect(holding.manualValueNis).not.toBeNull();
      } else {
        expect(holding.sourceSymbol).toBeTruthy();
      }
    }
  });

  it("includes MATIC, which the sheet summary omits", () => {
    expect(
      SHEET_HOLDINGS.some((holding) => holding.assetName === "MATIC")
    ).toBe(true);
    expect(SHEET_HOLDINGS.some((holding) => holding.assetName === "POL")).toBe(
      true
    );
  });

  it("has Excellence Pro targets summing to 100", () => {
    const total = SHEET_HOLDINGS.filter(
      (holding) => holding.platform === "Excellence Pro"
    ).reduce((sum, holding) => sum + (holding.targetPercent ?? 0), 0);
    expect(total).toBeCloseTo(100, 5);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run scripts/__tests__/sheetData.test.ts`
Expected: FAIL — cannot resolve `../sheetData`.

- [ ] **Step 4: Run again after creating the data file**

The data file was created in Step 1, so this should now pass.

Run: `npx vitest run scripts/__tests__/sheetData.test.ts`
Expected: PASS, 7 tests.

If the IBKR or Excellence reconciliation fails, a transcribed quantity or price is wrong — fix the data, not the test.

- [ ] **Step 5: Write the importer**

Create `scripts/importFromSheet.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { SHEET_HOLDINGS, SHEET_PLATFORMS } from "./sheetData";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = process.env.IMPORT_USER_EMAIL;
  if (!email) {
    throw new Error(
      "IMPORT_USER_EMAIL is required so the importer knows which user to attach holdings to"
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error(`No user found with email ${email}; sign up first`);
  }

  await prisma.holdingSnapshot.deleteMany({
    where: { holding: { userId: user.id } },
  });
  await prisma.holding.deleteMany({ where: { userId: user.id } });
  await prisma.platform.deleteMany({ where: { userId: user.id } });

  const platformIdByName = new Map<string, string>();
  for (const platform of SHEET_PLATFORMS) {
    const created = await prisma.platform.create({
      data: {
        userId: user.id,
        name: platform.name,
        baseCurrency: platform.baseCurrency,
      },
    });
    platformIdByName.set(platform.name, created.id);
  }

  for (const holding of SHEET_HOLDINGS) {
    const platformId = platformIdByName.get(holding.platform);
    if (!platformId) {
      throw new Error(
        `Holding references unknown platform (asset: ${holding.assetName}, platform: ${holding.platform})`
      );
    }

    await prisma.holding.create({
      data: {
        userId: user.id,
        platformId,
        assetName: holding.assetName,
        assetClass: holding.assetClass,
        liquidity: holding.liquidity,
        quantity: holding.quantity,
        priceSource: holding.priceSource,
        sourceSymbol: holding.sourceSymbol,
        currency: holding.currency,
        targetPercent: holding.targetPercent,
        manualValueNis: holding.manualValueNis,
        manualValueUpdatedAt:
          holding.manualValueNis !== null ? new Date() : null,
      },
    });
  }

  const count = await prisma.holding.count({ where: { userId: user.id } });
  console.log(
    `Imported ${count} holdings across ${SHEET_PLATFORMS.length} platforms for ${email}`
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 6: Add the npm script**

Add to `"scripts"` in `package.json`:

```json
"db:import-sheet": "npx tsx scripts/importFromSheet.ts"
```

Install the runner:

```bash
npm install -D tsx
```

- [ ] **Step 7: Run the import**

```bash
IMPORT_USER_EMAIL=<your signup email> npm run db:import-sheet
```

Expected: `Imported 29 holdings across 4 platforms for <email>`

- [ ] **Step 8: Verify against the live providers**

```bash
npx prisma studio --schema src/prisma/schema.prisma
```

Confirm 29 `Holding` rows and 4 `Platform` rows, and that MATIC and POL both exist.

- [ ] **Step 9: Commit**

```bash
git add scripts package.json package-lock.json
git commit -m "feat(import): add one-time sheet importer with reconciliation tests"
```

---

### Task 11: Holdings API route

**Files:**
- Create: `src/app/api/holdings/route.ts`
- Delete: `src/app/api/investments/route.ts`
- Delete: `src/app/api/investments/[id]/route.ts`
- Modify: `src/lib/api.ts`, `src/lib/hooks.ts`

**Interfaces:**
- Consumes: `priceHoldings` (Task 9), `computeAllocation`/`groupBy` (Task 7)
- Produces: `GET /api/holdings` returning `HoldingsResponse`

- [ ] **Step 1: Implement the route**

Create `src/app/api/holdings/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { priceHoldings } from "@/lib/pricing/portfolioPricingService";
import { computeAllocation, groupBy } from "@/lib/pricing/allocation";
import { describeError } from "@/utils/describeError";

export async function GET(request: NextRequest) {
  const userId = request.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const holdings = await prisma.holding.findMany({
    where: { userId },
    include: { platform: true },
    orderBy: { assetName: "asc" },
  });

  try {
    const pricing = await priceHoldings(holdings);
    const valueByHoldingId = new Map(
      pricing.valuations.map((valuation) => [
        valuation.holdingId,
        valuation.valueInNis,
      ])
    );

    const pricedHoldings = holdings
      .filter((holding) => valueByHoldingId.has(holding.id))
      .map((holding) => ({
        holding,
        valueInNis: valueByHoldingId.get(holding.id) ?? 0,
      }));

    return NextResponse.json({
      holdings: holdings.map((holding) => ({
        ...holding,
        valueInNis: valueByHoldingId.get(holding.id) ?? null,
      })),
      summary: {
        totalValueNis: pricing.totalValueNis,
        pricedValueNis: pricing.pricedValueNis,
        isComplete: pricing.failures.length === 0,
        holdingCount: holdings.length,
        pricedCount: pricing.valuations.length,
        usdToNisRate: pricing.usdToNisRate,
        lastUpdated: new Date(),
      },
      allocation: {
        byAssetClass: groupBy(
          pricedHoldings,
          (row) => row.holding.assetClass,
          (row) => row.valueInNis
        ),
        byLiquidity: groupBy(
          pricedHoldings,
          (row) => row.holding.liquidity,
          (row) => row.valueInNis
        ),
        byPlatform: groupBy(
          pricedHoldings,
          (row) => row.holding.platform.name,
          (row) => row.valueInNis
        ),
        byCurrency: groupBy(
          pricedHoldings,
          (row) => row.holding.currency,
          (row) => row.valueInNis
        ),
      },
      drift: buildDriftByPlatform(pricedHoldings),
      failures: pricing.failures,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: `Unable to price the portfolio, so no totals can be shown (${describeError(
          error
        )})`,
      },
      { status: 503 }
    );
  }
}

function buildDriftByPlatform(
  pricedHoldings: {
    holding: { id: string; assetName: string; targetPercent: number | null; platform: { name: string } };
    valueInNis: number;
  }[]
) {
  const platformNames = [
    ...new Set(pricedHoldings.map((row) => row.holding.platform.name)),
  ];

  return platformNames
    .map((platformName) => {
      const rows = pricedHoldings.filter(
        (row) => row.holding.platform.name === platformName
      );
      const hasTargets = rows.some(
        (row) => row.holding.targetPercent !== null
      );
      if (!hasTargets) {
        return null;
      }
      return {
        platformName,
        slices: computeAllocation(
          rows.map((row) => ({
            key: row.holding.assetName,
            valueInNis: row.valueInNis,
            targetPercent: row.holding.targetPercent,
          }))
        ),
      };
    })
    .filter((entry) => entry !== null);
}
```

- [ ] **Step 2: Delete the old routes**

```bash
rm -rf src/app/api/investments
```

- [ ] **Step 3: Update `src/lib/api.ts`**

Replace `PortfolioResponse`, `PortfolioData`, and `PricingFailure` with:

```ts
import type { AssetClass, Holding, Liquidity, Platform } from "@prisma/client";

export interface PricingFailure {
  holdingId: string;
  assetName: string;
  sourceSymbol: string | null;
  reason: string;
}

export interface AllocationSlice {
  key: string;
  valueInNis: number;
  actualPercent: number;
  targetPercent: number | null;
  driftPercent: number | null;
  rebalanceAmountNis: number | null;
}

export interface PlatformDrift {
  platformName: string;
  slices: AllocationSlice[];
}

export type PricedHolding = Holding & {
  platform: Platform;
  valueInNis: number | null;
};

export interface HoldingsResponse {
  holdings: PricedHolding[];
  summary: {
    totalValueNis: number | null;
    pricedValueNis: number;
    isComplete: boolean;
    holdingCount: number;
    pricedCount: number;
    usdToNisRate: number;
    lastUpdated: string;
  };
  allocation: {
    byAssetClass: Record<AssetClass, number>;
    byLiquidity: Record<Liquidity, number>;
    byPlatform: Record<string, number>;
    byCurrency: Record<string, number>;
  };
  drift: PlatformDrift[];
  failures: PricingFailure[];
}
```

Update the `api.investments` object to `api.holdings` with `list: () => fetch("/api/holdings")`, following the existing method shape in that file.

- [ ] **Step 4: Update `src/lib/hooks.ts`**

Rename `usePortfolio` to `useHoldings`, pointing at `/api/holdings` and typed as `HoldingsResponse`. Delete `useDeleteInvestment` and any other hooks referencing `/api/investments`.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: errors only in `src/app/dashboard/page.tsx` and `src/app/api/snapshot/route.ts`, fixed in Tasks 12 and 13.

- [ ] **Step 6: Commit**

```bash
git add -A src/app/api src/lib/api.ts src/lib/hooks.ts
git commit -m "feat(api): replace investments route with holdings route"
```

---

### Task 12: Snapshot route

**Files:**
- Modify: `src/app/api/snapshot/route.ts`

**Interfaces:**
- Consumes: `priceHoldings` (Task 9)
- Produces: `POST /api/snapshot` writing `HoldingSnapshot` rows

- [ ] **Step 1: Rewrite the route**

Replace the entire contents of `src/app/api/snapshot/route.ts`:

```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { priceHoldings } from "@/lib/pricing/portfolioPricingService";
import { sendSnapshotNotification } from "@/lib/telegramNotifier";
import { describeError } from "@/utils/describeError";

interface SkippedUser {
  userId: string;
  reasons: string[];
}

export async function POST() {
  try {
    const users = await prisma.user.findMany({
      include: { holdings: true },
    });

    const skipped: SkippedUser[] = [];
    let processed = 0;

    for (const user of users) {
      if (user.holdings.length === 0) {
        continue;
      }

      const pricing = await priceHoldings(user.holdings);

      if (pricing.failures.length > 0) {
        skipped.push({
          userId: user.id,
          reasons: pricing.failures.map(
            (failure) => `${failure.assetName}: ${failure.reason}`
          ),
        });
        continue;
      }

      const date = new Date();
      const quantityByHoldingId = new Map(
        user.holdings.map((holding) => [holding.id, holding.quantity])
      );

      for (const valuation of pricing.valuations) {
        await prisma.holdingSnapshot.create({
          data: {
            holdingId: valuation.holdingId,
            date,
            quantity: quantityByHoldingId.get(valuation.holdingId) ?? 0,
            unitPrice: valuation.unitPrice ?? valuation.valueInNis,
            currency: valuation.currency,
            fxRateUsed: pricing.usdToNisRate,
            valueNis: valuation.valueInNis,
          },
        });
      }

      processed += 1;

      try {
        await sendSnapshotNotification({
          date,
          netWorth: pricing.totalValueNis ?? 0,
          changePercent: 0,
        });
      } catch (error) {
        console.warn(
          `Snapshot notification failed for user ${user.id}:`,
          describeError(error)
        );
      }
    }

    return NextResponse.json({
      message: "Snapshot completed",
      usersProcessed: processed,
      usersSkipped: skipped.length,
      skipped,
    });
  } catch (error) {
    console.error("Snapshot error:", describeError(error));
    return NextResponse.json(
      { error: `Snapshot failed (${describeError(error)})` },
      { status: 500 }
    );
  }
}
```

`changePercent` is set to 0 here; the history endpoint computes change from `HoldingSnapshot` rows instead, which is the correct home for it now that snapshots are per-holding.

- [ ] **Step 2: Run the snapshot against real data**

```bash
npm run dev
```

In another terminal:

```bash
curl -s -X POST http://localhost:3000/api/snapshot | head -40
```

Expected: `{"message":"Snapshot completed","usersProcessed":1,"usersSkipped":0,"skipped":[]}`

If `usersSkipped` is 1, read `skipped[0].reasons` — a provider is failing, and that is the system working as designed.

- [ ] **Step 3: Verify the rows**

```bash
npx prisma studio --schema src/prisma/schema.prisma
```

Expected: 29 `HoldingSnapshot` rows, each with a populated `fxRateUsed` and `unitPrice`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/snapshot/route.ts
git commit -m "feat(snapshot): write per-holding snapshots with audit fields"
```

---

### Task 13: Dashboard

**Files:**
- Create: `src/components/AllocationBreakdown.tsx`
- Create: `src/components/TargetDrift.tsx`
- Create: `src/components/CurrencyExposure.tsx`
- Modify: `src/app/dashboard/page.tsx`
- Modify: `src/components/PortfolioChart.tsx`
- Delete: `src/components/AllocationTargets.tsx`, `src/components/AssetAllocation.tsx`, `src/components/AddInvestmentModal.tsx`, `src/components/EditInvestmentModal.tsx`
- Modify: `src/utils/format.ts`

**Interfaces:**
- Consumes: `HoldingsResponse` (Task 11)
- Produces: rendered dashboard

- [ ] **Step 1: Add a currency formatter that honours the toggle**

In `src/utils/format.ts`, replace `getInvestmentTypeLabel` (which referenced the deleted `InvestmentType`) and add:

```ts
export type DisplayCurrency = "NIS" | "USD";

export function formatMoney(
  valueInNis: number,
  displayCurrency: DisplayCurrency,
  usdToNisRate: number
): string {
  const value =
    displayCurrency === "USD" ? valueInNis / usdToNisRate : valueInNis;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: displayCurrency === "USD" ? "USD" : "ILS",
    maximumFractionDigits: 0,
  }).format(value);
}

export function getAssetClassLabel(assetClass: string): string {
  switch (assetClass) {
    case "EQUITY":
      return "Equity";
    case "CRYPTO":
      return "Crypto";
    case "NON_EQUITY":
      return "Non-Equity";
    default:
      return assetClass;
  }
}
```

- [ ] **Step 2: Create `AllocationBreakdown.tsx`**

A reusable bar list, used for asset class, liquidity, and platform.

```tsx
"use client";

import { computeAllocation } from "@/lib/pricing/allocation";
import { formatMoney, type DisplayCurrency } from "@/utils/format";

interface AllocationBreakdownProps {
  title: string;
  totals: Record<string, number>;
  displayCurrency: DisplayCurrency;
  usdToNisRate: number;
  labelFor?: (key: string) => string;
}

const COLORS = [
  "#3B82F6", "#10B981", "#F59E0B", "#EF4444",
  "#8B5CF6", "#06B6D4", "#84CC16",
];

export default function AllocationBreakdown({
  title,
  totals,
  displayCurrency,
  usdToNisRate,
  labelFor,
}: AllocationBreakdownProps) {
  const slices = computeAllocation(
    Object.entries(totals).map(([key, valueInNis]) => ({
      key,
      valueInNis,
      targetPercent: null,
    }))
  );

  if (slices.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        {title}
      </h3>
      <div className="space-y-3">
        {slices.map((slice, index) => (
          <div key={slice.key}>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-700 dark:text-gray-300">
                {labelFor ? labelFor(slice.key) : slice.key}
              </span>
              <span className="text-gray-600 dark:text-gray-400">
                {formatMoney(slice.valueInNis, displayCurrency, usdToNisRate)} ·{" "}
                {slice.actualPercent.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded">
              <div
                className="h-2 rounded"
                style={{
                  width: `${slice.actualPercent}%`,
                  backgroundColor: COLORS[index % COLORS.length],
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `TargetDrift.tsx`**

The highest-value view: what to buy and what to sell.

```tsx
"use client";

import type { PlatformDrift } from "@/lib/api";
import { formatMoney, type DisplayCurrency } from "@/utils/format";

interface TargetDriftProps {
  drift: PlatformDrift[];
  displayCurrency: DisplayCurrency;
  usdToNisRate: number;
}

export default function TargetDrift({
  drift,
  displayCurrency,
  usdToNisRate,
}: TargetDriftProps) {
  if (drift.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {drift.map((platform) => (
        <div
          key={platform.platformName}
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
        >
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Rebalancing — {platform.platformName}
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400">
                  <th className="py-2 pr-4">Asset</th>
                  <th className="py-2 pr-4 text-right">Actual</th>
                  <th className="py-2 pr-4 text-right">Target</th>
                  <th className="py-2 pr-4 text-right">Drift</th>
                  <th className="py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {platform.slices.map((slice) => (
                  <tr
                    key={slice.key}
                    className="border-t border-gray-100 dark:border-gray-700"
                  >
                    <td className="py-2 pr-4 text-gray-900 dark:text-white">
                      {slice.key}
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-700 dark:text-gray-300">
                      {slice.actualPercent.toFixed(1)}%
                    </td>
                    <td className="py-2 pr-4 text-right text-gray-700 dark:text-gray-300">
                      {slice.targetPercent === null
                        ? "—"
                        : `${slice.targetPercent.toFixed(1)}%`}
                    </td>
                    <td
                      className={`py-2 pr-4 text-right ${
                        (slice.driftPercent ?? 0) >= 0
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-blue-600 dark:text-blue-400"
                      }`}
                    >
                      {slice.driftPercent === null
                        ? "—"
                        : `${slice.driftPercent >= 0 ? "+" : ""}${slice.driftPercent.toFixed(1)}%`}
                    </td>
                    <td className="py-2 text-right text-gray-900 dark:text-white">
                      {slice.rebalanceAmountNis === null
                        ? "—"
                        : `${slice.rebalanceAmountNis >= 0 ? "Buy " : "Sell "}${formatMoney(
                            Math.abs(slice.rebalanceAmountNis),
                            displayCurrency,
                            usdToNisRate
                          )}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Create `CurrencyExposure.tsx`**

```tsx
"use client";

import AllocationBreakdown from "@/components/AllocationBreakdown";
import type { DisplayCurrency } from "@/utils/format";

interface CurrencyExposureProps {
  byCurrency: Record<string, number>;
  displayCurrency: DisplayCurrency;
  usdToNisRate: number;
}

export default function CurrencyExposure({
  byCurrency,
  displayCurrency,
  usdToNisRate,
}: CurrencyExposureProps) {
  return (
    <AllocationBreakdown
      title="Currency Exposure"
      totals={byCurrency}
      displayCurrency={displayCurrency}
      usdToNisRate={usdToNisRate}
      labelFor={(key) => (key === "USD" ? "USD-denominated" : "NIS-denominated")}
    />
  );
}
```

- [ ] **Step 5: Rewrite `src/app/dashboard/page.tsx`**

Replace the body with a version that: reads `useHoldings()`; holds `displayCurrency` state defaulting to `"NIS"` with a NIS/USD toggle button; renders the failure panel and suppresses the total when `summary.totalValueNis === null`; then renders `TargetDrift`, the three `AllocationBreakdown` instances (asset class, liquidity, platform), `CurrencyExposure`, and `PortfolioChart`.

Keep the existing loading spinner and error block. Reuse the failure panel markup already added in commit `1db7361`, changing `portfolioSummary` to the new field names (`totalValueNis`, `pricedCount`, `holdingCount`) and `failure.ticker` to `failure.sourceSymbol`.

- [ ] **Step 6: Update `PortfolioChart.tsx`**

Change `useInvestmentHistory` to read from the rewritten history endpoint and drop the `gainLoss` dataset — without cost basis there is no gain/loss to plot. Keep only the "Portfolio Value" line and remove the `y1` axis and the two metric tiles that referenced `gainLoss`.

- [ ] **Step 7: Delete superseded components**

```bash
rm src/components/AllocationTargets.tsx src/components/AssetAllocation.tsx \
   src/components/AddInvestmentModal.tsx src/components/EditInvestmentModal.tsx
```

- [ ] **Step 8: Typecheck, lint, build**

```bash
npx tsc --noEmit -p tsconfig.json
npm run lint
npm run build
```

Expected: all clean. If `build` fails on `lightningcss`, revisit the Environment Prerequisite.

- [ ] **Step 9: Verify in the browser**

```bash
npm run dev
```

Open `http://localhost:3000/dashboard`. Confirm:
- Total is roughly 1.5M NIS (it will differ from 1,499,009 by live price movement, and will be *higher* by ~800 NIS because MATIC is now counted).
- Toggling to USD divides by roughly 3.05.
- Rebalancing tables appear for Excellence Pro and Binance.
- Currency exposure shows roughly 55% USD.

- [ ] **Step 10: Commit**

```bash
git add -A src/components src/app/dashboard src/utils/format.ts
git commit -m "feat(dashboard): add rebalancing drift, allocation and currency exposure views"
```

---

### Task 14: Full verification

- [ ] **Step 1: Run the unit suite**

Run: `npm run test:unit`
Expected: PASS. Roughly 45 tests across providers, pricing, allocation, and sheet data.

- [ ] **Step 2: Run the contract suite**

Run: `FINNHUB_API_KEY=$(grep '^FINNHUB_API_KEY=' .env | cut -d= -f2) npm run test:run`
Expected: PASS including contract tests.

A Bizportal contract failure means the scrape broke — check whether the parser regressed to `שער בסיס`.

- [ ] **Step 3: Reconcile the live total against the sheet**

```bash
npm run dev
```

Compare the dashboard total against 1,499,009. Differences should be explainable by: live vs sheet FX (3.0541 vs 3.04635, about −0.25%), intraday price movement, and MATIC now being included (about +800 NIS).

If the total is off by roughly a factor of 3, currency conversion has regressed. If it is off by roughly 37%, the original FX bug has returned.

- [ ] **Step 4: Commit any fixes and push**

```bash
git push origin main
```

---

## Self-Review

**Spec coverage**

| Spec section | Task |
|---|---|
| Provider layer, explicit routing | 2, 3, 4, 5, 6 |
| Ticker mapping | 10 (`sheetData.ts`) |
| Bizportal, both layouts, agorot, closing rate | 5 |
| Rejected sources | documented, no task needed |
| Manual holdings + last-updated | 8 (schema), 9 (valuation), 10 (import) |
| Data model, Platform/Holding/HoldingSnapshot | 8 |
| Migration, destructive | 8 |
| Import + reconciliation | 10 |
| Dashboard: drift, allocation, currency, value over time | 13 |
| Currency toggle | 13 |
| Error handling, never emit unjustified total | 9, 11, 12, 13 |
| FX fetched once, fails hard | 9 |
| Non-critical side effects wrapped | 12 |
| Testing: contract, unit, reconciliation | 3, 4, 5, 9, 10, 14 |
| Cut: cost basis, XIRR, dividends, benchmark | not planned, correctly |

**Type consistency check**

- `Quote` (Task 2) is consumed unchanged in Tasks 3, 4, 5.
- `PriceProvider.fetchQuote(sourceSymbol: string)` — identical across all three providers and the registry.
- `AllocationSlice` (Task 7) is re-declared identically in `src/lib/api.ts` (Task 11) for client use; fields match exactly.
- `PricingFailure` uses `sourceSymbol`, not `ticker`. Task 13 Step 5 explicitly calls out renaming the field when reusing the panel from commit `1db7361`.
- `priceHoldings` returns `totalValueNis` (nullable); the API exposes it under the same name; the dashboard checks `=== null`.
- `convertToNis` is defined once, in Task 9, and exported from the pricing service. The old `convertToNIS` in `marketDataService.ts` is deleted with that file.

**Known deviation from spec**

The spec lists a `ManualProvider`. It is not implemented as a `PriceProvider`, because manual holdings carry a stored NIS value rather than a symbol and so cannot satisfy `fetchQuote(sourceSymbol)`. Task 9 branches on `PriceSource.MANUAL` before consulting the registry, and Task 6's registry throws for `MANUAL`. Same behaviour, cleaner seam.
