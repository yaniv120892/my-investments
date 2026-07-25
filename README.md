# My Investments – Personal Investment Tracker

My Investments is a simple web app that helps you see your entire portfolio in one place. Add your holdings across categories like stocks/ETFs, cryptocurrencies, pension and education funds, money‑market funds, and foreign currencies. The app fetches live market data, converts everything to NIS, and presents a clean dashboard with allocation and performance over time.

What you can do:

- Add and edit investments and amounts you hold
- Get automatic, periodic price updates from public market data sources
- View total portfolio value in NIS and allocation by category
- Track historical snapshots to understand trends over time

Who it’s for:

- Individuals who want a clear, up‑to‑date view of their personal investments without spreadsheets

Built with Next.js and TypeScript, backed by PostgreSQL (via Prisma) and Redis for caching.

This repository contains the app’s source code only.

## Scheduled snapshots

`/api/snapshot` walks every user, prices their holdings, and writes a `HoldingSnapshot` row per holding. It is the job that builds the historical data behind the performance chart, so it needs to run on a schedule.

The endpoint authorizes a request if **either**:

- it carries `Authorization: Bearer <CRON_SECRET>` matching the `CRON_SECRET` environment variable, or
- it carries a valid session cookie (a logged-in human triggering it by hand) — `POST` only.

`GET` accepts the bearer secret only. Vercel Cron can only issue `GET` requests, and a `GET` that a browser session could authorize would be triggerable cross-site by any page embedding the URL.

If `CRON_SECRET` is unset or empty, the bearer path always rejects. Set it before wiring any scheduler, otherwise every scheduled run will 401.

### Vercel

`vercel.json` already declares the schedule:

```json
{
  "crons": [{ "path": "/api/snapshot", "schedule": "0 22 * * 1-5" }]
}
```

1. Add `CRON_SECRET` to the project's environment variables (Settings → Environment Variables). Use a random string of at least 16 characters.
2. Redeploy. The cron appears under Settings → Cron Jobs.

Vercel sends `CRON_SECRET` automatically as an `Authorization: Bearer` header, so no custom-header configuration is needed — which is just as well, because Vercel crons cannot send custom headers. Schedules are always interpreted in UTC. On the Hobby plan a cron may fire anywhere within the scheduled hour, and only once-per-day expressions are accepted.

### GitHub Actions

```yaml
name: Portfolio snapshot
on:
  schedule:
    - cron: "0 22 * * 1-5"
  workflow_dispatch:

jobs:
  snapshot:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger snapshot
        run: |
          curl --fail-with-body -X POST \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            "${{ secrets.SNAPSHOT_BASE_URL }}/api/snapshot"
```

Store `CRON_SECRET` and `SNAPSHOT_BASE_URL` as repository secrets. GitHub's scheduler is also UTC and can lag by several minutes under load.

### Plain crontab

```cron
0 22 * * 1-5 curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-app.example.com/api/snapshot
```

`crontab` uses the host's local timezone, so adjust the hour if the machine is not on UTC.

### Triggering by hand

```bash
SNAPSHOT_BASE_URL=https://your-app.example.com CRON_SECRET=... npm run snapshot:trigger
```

### Why 22:00 UTC on weekdays

The portfolio spans Israeli and US markets. The US close is 21:00 UTC in winter (EST) and 20:00 UTC in summer (EDT); the Tel Aviv Stock Exchange closes several hours earlier. Because cron schedules are fixed to UTC and do not shift with daylight saving, 22:00 UTC clears the later of the two closes year-round with an hour to spare for closing prices to settle at the data providers. `1-5` restricts runs to Monday–Friday, since weekend runs would only duplicate Friday's closing prices.
