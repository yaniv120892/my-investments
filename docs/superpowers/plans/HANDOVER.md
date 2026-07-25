# Handover Prompt

Paste everything below the line into a new session.

---

Work in `/Users/yanivdaye/Develop/my-investments`. `cd` there first and read its
`CLAUDE.md` (plus `~/.claude/shared-rules.md`) before changing anything — coding
standards there are binding.

## Task

Execute the implementation plan at
`docs/superpowers/plans/2026-07-24-sheet-driven-portfolio-tracker.md`.

Read that plan and the design it references
(`docs/superpowers/specs/2026-07-24-sheet-driven-portfolio-tracker-design.md`)
before writing code. The plan has 14 tasks, is strictly TDD, and contains
complete code for every step — follow it task by task rather than improvising.
Use the `superpowers:subagent-driven-development` skill (fresh subagent per task)
unless I say otherwise.

## What this project is

A personal investment tracker replacing a hand-maintained Google Sheet. It
imports 29 holdings once, prices them live from free providers, and shows
allocation, rebalancing drift, and currency exposure. Next.js 15 + TypeScript +
Prisma/Postgres + Upstash Redis + Chart.js. Single user, auth kept, hosted as-is.

Portfolio is ~1,499,009 NIS across Interactive Brokers (USD), Binance (crypto),
Excellence Pro (TASE, NIS), plus two manually-valued illiquid positions.

## What is already done — do not redo

- **Brainstorm and design are complete and approved.** All open questions are
  resolved. Do not re-litigate scope.
- **Commit `1db7361` fixed the FX bug.** The old code called a Bank of Israel
  endpoint that does not resolve, with an empty API key, then used the missing
  rate as a truthiness guard — so raw USD was summed into a NIS total,
  understating the portfolio by 37%. The snapshot route additionally hardcoded
  a rate of 3.65 and fabricated `quantity * 100` prices that were written to the
  database. Both are fixed. `FxRateProvider` (frankfurter.dev, free, no key) and
  `src/utils/describeError.ts` exist and are reused by the plan.
- Working tree is clean, on `main`, everything committed.

## Decisions already made — treat as settled

- Extend this repo; do not start a new project.
- Providers **throw**, never return `null`.
- **Never emit a portfolio total computed from incomplete data** — if any holding
  fails to price, `totalValue` is `null` and the failures are listed in the UI.
  This is the single most important rule; it is what the whole rewrite is for.
- FX is fetched **once per request**, before any holdings loop. If it fails, the
  request fails with 503.
- No cost basis (the sheet has none), so no P&L, no XIRR, no dividends. Do not
  add them.
- Free providers only. No paid market-data vendor.

## Gotchas that will cost you time if you miss them

1. **Use an arm64 node, and do NOT reinstall `node_modules`.** This is an Apple
   M1 Max. `node_modules` holds arm64 binaries and is correct. If your shell is
   Rosetta-translated (`sysctl -n sysctl.proc_translated` returns `1`), it picks
   up the x86_64 node at `/usr/local/bin/node` and `npm run build` fails with
   `Cannot find module '../lightningcss.darwin-x64.node'`. Fix by switching node,
   not by reinstalling:
   `export PATH="$HOME/.nvm/versions/node/v24.13.0/bin:$PATH"` — then confirm
   `node -p "process.arch"` prints `arm64`. Running
   `rm -rf node_modules && npm install` from a Rosetta shell would install x64
   binaries and break the native build. `npm run build` is verified passing on
   current `HEAD` with an arm64 node.

2. **Bizportal price field is `שער נעילה` (closing), NOT `שער בסיס` (base).**
   These pages have no `שער אחרון` label at all. Reading the wrong field produces
   a plausible-looking price that is off by ~1%. Also, the `<dd>` nests the daily
   change before the price:
   `<dd><span class="drop">-1.32%</span><span>244,290</span></dd>` — take the
   **last** `<span>`; `.text()` yields `-1.32%244,290`.

3. **Bizportal has two page layouts.** Traded funds (`/tradedfund/`) use the
   `<dt>/<dd>` list above; mutual funds (`/mutualfunds/`) use `.top-area-cube`
   with `.label` = `מחיר פדיון` and `.num`. Security 5109889 is a mutual fund;
   1159250 / 1159094 / 1159169 are traded funds. Requesting `/tradedfund/` with
   `redirect: "follow"` works for both. A traded-fund page *also* contains one
   `.top-area-cube` labelled `שווי יחידה` that is always `--`, so do not detect
   layout by its presence — key on which price label is found.

4. **All TASE prices are in agorot — multiply by 0.01.** Confirmed by the sheet's
   own `=IL_FUND(5109889)*0.01` formula.

5. **Task 8 drops the `Investment` and `InvestmentSnapshot` tables.** I confirmed
   there is nothing worth preserving. It is intended.

6. **MATIC is held but missing from the sheet's summary block**, so the sheet's
   own totals understate reality by ~800 NIS. Import both MATIC and POL. The
   reconciliation test in Task 10 accounts for this.

7. Finnhub free tier covers US symbols only — it returns "You don't have access
   to this resource" for `.L`. The three Irish UCITS therefore import as MANUAL.
   Do not waste time hunting for a free source; Yahoo rate-limits (429) and
   justETF is JS-rendered. Both were already tried.

## Verification

- `npm run test:unit` — unit tests only
- `FINNHUB_API_KEY=$(grep '^FINNHUB_API_KEY=' .env | cut -d= -f2) npm run test:run`
  — includes contract tests that hit live APIs
- Final check: dashboard total should land near 1,499,009 NIS. Off by ~3x means
  currency conversion regressed; off by ~37% means the original FX bug is back.

Start by confirming the build prerequisite, then begin at Task 1.
