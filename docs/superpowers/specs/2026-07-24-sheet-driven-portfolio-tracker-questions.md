# Brainstorming Questions: Sheet-Driven Live Portfolio Tracker

Please answer each question below and let me know when done.

Context: `my-investments` (this repo) already exists and covers a lot of the ask —
Next.js 15 + Prisma/Postgres + Redis, auth, live prices (Finnhub / Binance / Bank of
Israel), NIS normalization, allocation pie, portfolio line chart, daily snapshots.
The two things it does NOT have are Google Sheet ingestion and cost basis.

---

## 1. Extend this repo, or start fresh?

You asked for a "new project", but `my-investments` already implements most of it.
Starting fresh means rebuilding auth, price providers, caching, and charts.

**Options:**
- Option A (recommended): Extend `my-investments`. Add sheet import + cost basis + richer charts on top of what works.
- Option B: New repo, but lift the price providers / market data service from `my-investments`.
- Option C: New repo, clean slate, different stack (say which).
- Option D: Extend, but treat it as a heavy rewrite — keep the repo, replace the data model and dashboard.

> 

---

## 2. How do I get at your sheet?

The CSV export URL returns 401 because the sheet is private, and the Chrome
extension isn't connected. I need the actual columns and a few sample rows to
design the importer.

**Options:**
- Option A: Set the sheet to "Anyone with the link — Viewer" (temporarily is fine) and tell me. I'll read it via the CSV export endpoint.
- Option B: File → Download → CSV, drop the file somewhere under `~/Develop/`, and tell me the path.
- Option C: Paste the header row + 3-5 representative rows here (redact numbers if you like — I mainly need column names, types, and ticker formats).
- Option D: Reconnect the Claude Chrome extension so I can read it from your logged-in session.

> 

---

## 3. Sheet as source of truth, or one-time migration?

**Options:**
- Option A: **One-time import.** Read the sheet once, move everything into Postgres, then manage holdings in the app. The sheet is retired.
- Option B: **Sheet stays the source of truth.** App re-reads it (on demand or on a schedule) via the Google Sheets API and just renders. You keep editing the sheet.
- Option C: **Two-way sync.** Edit in either place. (Materially more work and conflict-prone — flagging that up front.)
- Option D: **Repeatable one-way import.** Re-runnable "sync from sheet" button; sheet wins on conflict, but the app owns history/snapshots.

> 

---

## 4. Does your sheet track cost basis / transactions?

This determines the data model more than anything else.

**Options:**
- Option A: Just current holdings — ticker + quantity. No purchase price.
- Option B: Holdings + a single average purchase price per position.
- Option C: A full transaction log — individual buys/sells with date, quantity, price, fees.
- Option D: Something else (describe).

> 

---

## 5. What asset types are actually in the sheet?

The existing app supports STOCK, CRYPTO, PENSION, EDUCATION_FUND, INVESTMENT_FUND,
MONEY_MARKET, FOREIGN_CURRENCY. Anything in your sheet that doesn't fit those?
Israeli assets in particular — TASE-listed stocks, kranot hishtalmut, gemel
lehashkaa, pension funds — are not covered by Finnhub and need a different data
source or manual valuation.

> 

---

## 6. Which graphs and views actually matter to you?

Pick as many as you want; I'll cut the rest (YAGNI).

**Options:**
- Portfolio value over time (already exists)
- Allocation by asset type (already exists)
- Allocation by individual holding
- Per-holding gain/loss table, sorted by contribution
- Time-weighted or money-weighted return (XIRR) — requires transactions (Q4 Option C)
- Benchmark comparison (portfolio vs. S&P 500 / other index)
- Currency exposure breakdown (USD vs. NIS vs. other)
- Dividend income tracking
- Contribution/deposit history vs. market growth (how much of my gain is me depositing vs. the market)

> 

---

## 7. Base currency and where you'll run this

**Options:**
- Currency: NIS (as today) / USD / both with a toggle?
- Hosting: keep as-is (Vercel + Upstash + hosted Postgres, judging by the config)? Or run locally only?
- Is this still single-user-with-auth, or do you want to strip auth since it's just you?

> 

---

## 8. What's actually wrong with the current app?

You went to build a new project rather than open this one — that's a signal. Was
something broken, was it too slow, did the data model annoy you, or had you just
forgotten it was there?

> 

---
