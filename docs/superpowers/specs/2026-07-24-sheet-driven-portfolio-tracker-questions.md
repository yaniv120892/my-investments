# Brainstorming Questions: Sheet-Driven Live Portfolio Tracker

Please answer each question below and let me know when done.

**Update (after reading the sheet):** Q2 (access), Q4 (cost basis) and Q5 (asset
types) from the first draft are now answered by the data itself — see "What the
sheet actually contains" below. The remaining open questions start at Q1.

Context: `my-investments` (this repo) already exists — Next.js 15 + Prisma/Postgres
+ Redis, auth, live prices (Finnhub / Binance / Bank of Israel), NIS normalization,
allocation pie, portfolio line chart, daily snapshots. Missing: sheet ingestion and
cost basis.

---

## What the sheet actually contains

The sheet is one tab with three stacked blocks. Only the third is real input;
everything above it is computed.

**Block A (rows 1-7) — headline totals.** Derived. Equity 1,352,466 / crypto 85,743
/ non-equity 0; liquid 1,414,089 (94.335%) vs illiquid 84,919 (5.665%); grand
total 1,499,009.

**Block B (rows 10-36) — per-position summary.** Derived. Columns: פלטפורמה,
נזילות, אחוז מנייתי, אחוז קריפטו, אחוז לא מנייתי, סכום בש״ח, אחוז מסה״כ השקעות,
plus an unlabelled "% within its own platform" column.

**Block C (rows 38-52) — the actual source data.** Three broker blocks, each
`name / כמות / מחיר`, plus a USD→NIS rate of 3.04635:

| Platform | Holdings | Currency |
|---|---|---|
| אינטראקטיב ברוקרס (IBKR) | Dow Jones, MSCI, S&P, NASDAQ, Boaing, Disney, VNQ, Irish MSCI, Irish S&P, Irish NASDAQ | USD |
| Binance | BTC, ETH, ADA, 1INCH, SHIB, BNB, DOGE, DOT, CAKE, MATIC, SOL, DAR, POL | USD |
| אקסלנס פרו (Excellence Pro) | iShares CORE S&P 500 (1159250), iShares CORE MSCI EUROPE (1159094), iShares CORE MSCI EM IMI (1159169), TLV 125 — plus מצוי/רצוי target columns | NIS |

Two positions have no quantity or price and are typed in by hand: **שרה** (84,919,
illiquid) and **BTB – הלוואות חברתיות** (0, illiquid).

I verified the arithmetic: every value in Blocks A and B is `quantity × price ×
FX`. All 27 positions reconcile to the reported totals within rounding. So the
importer only ever needs to read Block C plus the two manual rows — the app
recomputes the rest.

**Three data-quality issues found:**

1. **MATIC is orphaned.** It sits in the Binance block (698.03 units, ~516 NIS)
   but has no row in the summary table, so it is silently excluded from your
   totals. POL is there and counted. This looks like a leftover from the
   MATIC→POL migration.
2. **`Irish NASDAQ` and `NASDAQ` carry the identical price** (682.99). Those are
   different instruments — a US-listed ETF and an Irish-domiciled UCITS one — so
   one of them is almost certainly a stale copy-paste.
3. ~~Crypto prices look far staler than the equity prices.~~ **Retracted after
   testing.** Live Binance quotes confirm BTC $64,205 vs your $64,114 and ETH
   $1,863.22 vs your $1,862.80 — the sheet is current. Only **DAR** (0.11299 in
   the sheet vs 0.21707 live) and **MATIC** have drifted. The sheet is
   well-maintained; the value of this project is removing the manual upkeep, not
   correcting rot.

---

## 1. Extend this repo, or start fresh?

You asked for a "new project", but `my-investments` already implements most of it.
Starting fresh means rebuilding auth, price providers, caching, and charts.

**Options:**
- Option A (recommended): Extend `my-investments`. Add sheet import + cost basis + platform modeling on top of what works.
- Option B: New repo, but lift the price providers / market data service from `my-investments`.
- Option C: New repo, clean slate, different stack (say which).
- Option D: Extend, but treat it as a heavy rewrite — keep the repo, replace the data model and dashboard.

> 

---

## 2. Confirm the ticker mapping

This is the one thing I cannot infer reliably, and the importer is worthless
without it. Your sheet uses informal names; live price APIs need real symbols.
My best guesses are pre-filled — correct the ones I got wrong.

| Sheet name | Qty | Sheet price | My guess | Confidence |
|---|---|---|---|---|
| Dow Jones | 68 | 518.52 | `DIA` | medium |
| S&P | 148 | 741.20 | `SPY` | medium |
| NASDAQ | 89 | 682.99 | `QQQ` | medium |
| MSCI | 239 | 63.27 | `IEMG`? `ACWI`? | **low — please specify** |
| VNQ | 137 | 100.92 | `VNQ` | high |
| Boaing | 5 | 209.61 | `BA` (Boeing) | high |
| Disney | 6 | 94.77 | `DIS` | high |
| Irish MSCI | 18 | 52.15 | UCITS — ISIN needed | **low** |
| Irish S&P | 5 | 801.39 | `CSPX`? | **low** |
| Irish NASDAQ | 4 | 682.99 | `CNDX`? | **low** |

Crypto symbols (BTC, ETH, ADA, BNB, DOGE, DOT, SHIB, CAKE, 1INCH, SOL, DAR, POL)
map cleanly to Binance pairs already — no action needed, except: **do you still
hold MATIC, or should it be folded into POL?**

The Excellence Pro holdings are TASE-listed and identified by Israeli security
number (1159250 / 1159094 / 1159169). Finnhub does not cover these. See Q3.

> 

---

## 3. Israeli assets — where do prices come from?

Roughly 39% of your portfolio (585,083 NIS) sits in Excellence Pro on TASE
securities, and Finnhub cannot price them. Options:

- Option A: Scrape/query the TASE ("maya") site by security number.
- Option B: Find a market data vendor covering TASE (most paid tiers do).
- Option C: Leave Excellence Pro holdings manually valued — you update those four numbers occasionally, everything else is live.
- Option D: Map each to a proxy (e.g. price the iShares S&P 500 tracker off `SPY` + USD/NIS) and accept small tracking error.

> 

---

## 4. Sheet as source of truth, or one-time migration?

**Options:**
- Option A: **One-time import.** Read the sheet once, move into Postgres, manage holdings in the app from then on. Sheet retired.
- Option B: **Sheet stays source of truth.** App re-reads it on a schedule and just renders.
- Option C: **Two-way sync.** (Materially more work and conflict-prone — flagging that up front.)
- Option D: **Repeatable one-way import.** Re-runnable "sync from sheet" button; sheet wins on conflict, app owns history/snapshots.

> 

---

## 5. Cost basis — the sheet has none. What do you want?

Your sheet only ever stores current quantity and current price, so there is no
way to compute true return from it. To get real P&L, one of:

- Option A: **Don't bother.** Track value over time from today forward; snapshots give you trend but never "how much did I actually make".
- Option B: **Enter approximate cost basis once** per position (avg buy price), and get real P&L from then on.
- Option C: **Import real transaction history** — IBKR and Binance both export it, Excellence Pro probably as CSV. Most work, but gives true XIRR/money-weighted return.
- Option D: Start with A, design the schema so C can be added later without migration pain.

> 

---

## 6. Model "platform" as a first-class concept?

Your sheet is organised by broker, and the unlabelled column in Block B is
"% within platform" — so you clearly think in those terms. The current schema has
no notion of a platform/account at all.

- Option A: Add `Platform`/`Account` to the schema; group and chart by it.
- Option B: Ignore it; a flat list of holdings is enough.

> 

---

## 7. Which graphs and views actually matter?

Pick as many as you want; I'll cut the rest (YAGNI).

**Options:**
- Portfolio value over time (already exists)
- Allocation by asset type: equity / crypto / non-equity (mirrors your Block A)
- Liquid vs illiquid split (mirrors your Block A)
- Allocation by platform (IBKR / Binance / Excellence Pro)
- Allocation by individual holding
- **Target vs actual drift** — you already track this manually in the מצוי/רצוי columns and the crypto target column. Natural fit, and it tells you what to rebalance.
- Per-holding gain/loss table (needs Q5 B or C)
- XIRR / money-weighted return (needs Q5 C)
- Benchmark comparison (portfolio vs S&P 500)
- Currency exposure (USD vs NIS)
- Dividend income tracking

> 

---

## 8. Base currency, hosting, auth

- Currency: NIS (as today) / USD / toggle?
- Hosting: keep Vercel + Upstash + hosted Postgres? Or local-only?
- Keep auth, or strip it since it's just you?

> 

---

## 9. What's actually wrong with the current app?

You went to build a new project rather than open this one — that's a signal. Was
something broken, too slow, did the data model annoy you, or had you just
forgotten it was there?

> 

---

---

## Answers (recorded 2026-07-24)

- **Q1** — A: extend this repo; audit providers; free providers only.
- **Q2** — Resolved empirically by matching live quotes against sheet prices:
  `S&P→SPY`, `NASDAQ→QQQ`, `Dow Jones→DIA`, `VNQ→VNQ`, `Boaing→BA`,
  `Disney→DIS`, `MSCI→EEM` (63.33 live vs 63.27 sheet). All within 0.3%.
- **Q3** — A: scrape TASE by security number. Bizportal verified working
  (`/tradedfund/quote/generalview/<id>`, prices in agorot, ÷100).
- **Q4** — A: one-time import; app becomes source of truth.
- **Q5** — A: no cost basis; track value forward from import.
- **Q6** — A: Platform is first-class.
- **Q7** — Delegated. Chosen: target-vs-actual drift, allocation
  (class / liquidity / platform), currency exposure, value over time.
  Cut: per-holding P&L, XIRR, dividends.
- **Q8** — Currency toggle NIS/USD; hosting unchanged; keep auth.
- **Q9** — Root-caused: dead FX provider silently understating the portfolio
  by 37%. See design doc.
- **Follow-up decisions** — Provider architecture A (explicit per-holding
  routing); failure mode: refuse the total and flag the holding; Sara + Irish
  UCITS handled as manual values with a last-updated date.

### Still open

- **TLV 125 security number** — needed to price it via Bizportal (60,799 NIS, 4.1%).
- **Do you still hold MATIC?** It is in your Binance block (~516 NIS) but absent
  from the summary table, so it is currently excluded from your totals.
