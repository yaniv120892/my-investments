import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { priceHoldings } from "@/lib/pricing/portfolioPricingService";
import {
  isCronSecretAuthorized,
  isSnapshotRequestAuthorized,
} from "@/lib/snapshotAuthorization";
import {
  sendErrorNotification,
  sendSnapshotNotification,
} from "@/lib/telegramNotifier";
import { describeError } from "@/utils/describeError";

interface SkippedUser {
  userId: string;
  reasons: string[];
}

interface SnapshotRunSummary {
  usersProcessed: number;
  usersWithHoldings: number;
  snapshotRowsWritten: number;
  skipped: SkippedUser[];
}

export async function POST(request: NextRequest) {
  if (!isSnapshotRequestAuthorized(request.headers)) {
    return unauthorized(
      "provide a valid session cookie or a CRON_SECRET bearer token"
    );
  }

  return runSnapshot();
}

export async function GET(request: NextRequest) {
  if (!isCronSecretAuthorized(request.headers)) {
    return unauthorized("scheduled runs require a CRON_SECRET bearer token");
  }

  return runSnapshot();
}

function unauthorized(reason: string): NextResponse {
  return NextResponse.json(
    { error: `Unauthorized: ${reason}` },
    { status: 401 }
  );
}

async function runSnapshot(): Promise<NextResponse> {
  const startedAt = Date.now();

  try {
    const summary = await writeSnapshots();
    const durationMs = Date.now() - startedAt;
    logSnapshotCompletion(summary, durationMs);

    const body = {
      usersProcessed: summary.usersProcessed,
      usersSkipped: summary.skipped.length,
      snapshotRowsWritten: summary.snapshotRowsWritten,
      durationMs,
      skipped: summary.skipped,
    };

    // A run that prices nobody used to answer 200 with usersSkipped set, so
    // Vercel recorded a successful cron and five weeks of empty history looked
    // exactly like five weeks of working history.
    if (wroteNothingDespiteHoldings(summary)) {
      return NextResponse.json(
        {
          error: `Snapshot wrote no rows for ${summary.usersWithHoldings} user(s) with holdings`,
          ...body,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: "Snapshot completed", ...body });
  } catch (error) {
    // The per-holding failures above are announced one user at a time, but
    // anything thrown out of the loop — an FX outage, a database error — kills
    // every remaining user at once and would otherwise be the one total failure
    // nobody hears about.
    await notifyFailedSnapshot(error);
    return NextResponse.json(
      { error: `Snapshot failed (${describeError(error)})` },
      { status: 500 }
    );
  }
}

async function writeSnapshots(): Promise<SnapshotRunSummary> {
  const users = await prisma.user.findMany({ include: { holdings: true } });

  const skipped: SkippedUser[] = [];
  let usersProcessed = 0;
  let usersWithHoldings = 0;
  let snapshotRowsWritten = 0;

  for (const user of users) {
    if (user.holdings.length === 0) {
      continue;
    }

    usersWithHoldings += 1;

    const pricing = await priceHoldings(user.holdings);

    if (pricing.failures.length > 0) {
      const reasons = pricing.failures.map(
        (failure) => `${failure.assetName}: ${failure.reason}`
      );
      skipped.push({ userId: user.id, reasons });
      await notifySkippedSnapshot(user.id, reasons);
      continue;
    }

    const date = new Date();
    const quantityByHoldingId = new Map(
      user.holdings.map((holding) => [holding.id, holding.quantity])
    );

    for (const valuation of pricing.valuations) {
      const quantity = quantityByHoldingId.get(valuation.holdingId) ?? 0;
      await prisma.holdingSnapshot.create({
        data: {
          holdingId: valuation.holdingId,
          date,
          quantity,
          unitPrice:
            valuation.unitPrice ??
            (quantity > 0 ? valuation.valueInNis / quantity : 0),
          currency: valuation.currency,
          fxRateUsed: valuation.fxRateUsed,
          valueNis: valuation.valueInNis,
        },
      });
      snapshotRowsWritten += 1;
    }

    usersProcessed += 1;
    await notifySnapshot(user.id, date, pricing.totalValueNis ?? 0);
  }

  return { usersProcessed, usersWithHoldings, snapshotRowsWritten, skipped };
}

function wroteNothingDespiteHoldings(summary: SnapshotRunSummary): boolean {
  return summary.snapshotRowsWritten === 0 && summary.usersWithHoldings > 0;
}

/**
 * Vercel keeps Hobby runtime logs for about an hour, so the only evidence a run
 * ever leaves is what it says while finishing. One line per run carries the
 * counts, and a run that wrote nothing says so at error level with the users it
 * skipped — a skipped user reads differently from the total failure logged by
 * notifyFailedSnapshot.
 */
function logSnapshotCompletion(
  summary: SnapshotRunSummary,
  durationMs: number
): void {
  const counts = `usersProcessed=${summary.usersProcessed} usersWithHoldings=${summary.usersWithHoldings} usersSkipped=${summary.skipped.length} snapshotRowsWritten=${summary.snapshotRowsWritten} durationMs=${durationMs}`;

  if (wroteNothingDespiteHoldings(summary)) {
    const skippedUserIds = summary.skipped
      .map((entry) => entry.userId)
      .join(", ");
    console.error(
      `Snapshot run wrote no rows: ${counts} skippedUserIds=${skippedUserIds || "none"}`
    );
    return;
  }

  console.log(`Snapshot run completed: ${counts}`);
}

async function notifyFailedSnapshot(error: unknown): Promise<void> {
  const reason = describeError(error);
  console.error("Snapshot error:", reason);

  const wasSent = await sendErrorNotification(
    `Snapshot run failed before it could finish, so no user was priced: ${reason}`
  );

  if (!wasSent) {
    console.error(
      `Snapshot run failed and the Telegram alert could not be delivered; reason: ${reason}`
    );
  }
}

/**
 * A snapshot is all-or-nothing: one unpriced holding would otherwise write a
 * short day and put a fake dip in the net-worth chart. That makes a broken
 * provider look like silence, so the skip has to announce itself — Bizportal's
 * geo-block cost three and a half weeks of history before anyone noticed.
 */
async function notifySkippedSnapshot(
  userId: string,
  reasons: string[]
): Promise<void> {
  // sendErrorNotification reports failure by returning false rather than
  // throwing, so discarding it would leave the alert about a silent failure
  // failing silently itself.
  const wasSent = await sendErrorNotification(
    `No snapshot written for user ${userId} — ${
      reasons.length
    } holding(s) could not be priced:\n\n${reasons.join("\n")}`
  );

  if (!wasSent) {
    console.error(
      `Snapshot skipped for user ${userId} and the Telegram alert could not be delivered; reasons: ${reasons.join(
        "; "
      )}`
    );
  }
}

async function notifySnapshot(
  userId: string,
  date: Date,
  netWorth: number
): Promise<void> {
  const previous = await prisma.holdingSnapshot.findFirst({
    where: { holding: { userId }, date: { lt: date } },
    orderBy: { date: "desc" },
    select: { date: true },
  });

  let previousNetWorth = 0;
  if (previous) {
    const rows = await prisma.holdingSnapshot.findMany({
      where: { holding: { userId }, date: previous.date },
      select: { valueNis: true },
    });
    previousNetWorth = rows.reduce((sum, row) => sum + row.valueNis, 0);
  }

  const changePercent =
    previousNetWorth > 0
      ? ((netWorth - previousNetWorth) / previousNetWorth) * 100
      : 0;

  try {
    await sendSnapshotNotification({
      date,
      netWorth,
      changePercent,
      previousNetWorth: previousNetWorth > 0 ? previousNetWorth : undefined,
    });
  } catch (error) {
    console.warn(
      `Snapshot notification failed for user ${userId}:`,
      describeError(error)
    );
  }
}
