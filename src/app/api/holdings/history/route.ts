import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { USER_ID_HEADER } from "@/lib/authTokens";
import { describeError } from "@/utils/describeError";

interface DailyTotal {
  date: string;
  totalValue: number;
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get(USER_ID_HEADER);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "6m";

    const snapshots = await prisma.holdingSnapshot.findMany({
      where: {
        holding: { userId },
        date: { gte: calculateStartDateFromPeriod(period) },
      },
      orderBy: { date: "asc" },
    });

    const dailyTotals = aggregateByDate(snapshots);

    return NextResponse.json({
      data: dailyTotals.map((entry, index) => {
        const previousValue =
          index > 0 ? dailyTotals[index - 1].totalValue : entry.totalValue;
        const changeAmount = entry.totalValue - previousValue;

        return {
          date: entry.date,
          totalValue: entry.totalValue,
          changeAmount,
          changePercent:
            previousValue > 0 ? (changeAmount / previousValue) * 100 : 0,
        };
      }),
      period,
    });
  } catch (error) {
    console.error("Error fetching holding history:", describeError(error));
    return NextResponse.json(
      { error: `Unable to fetch history (${describeError(error)})` },
      { status: 500 }
    );
  }
}

function calculateStartDateFromPeriod(period: string): Date {
  const now = new Date();

  switch (period) {
    case "1m":
      return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    case "3m":
      return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    case "6m":
      return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    case "1y":
      return new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    case "all":
    default:
      return new Date(0);
  }
}

function aggregateByDate(
  snapshots: { date: Date; valueNis: number }[]
): DailyTotal[] {
  const totalsByDate = new Map<string, number>();

  for (const snapshot of snapshots) {
    const dateKey = snapshot.date.toISOString().split("T")[0];
    totalsByDate.set(
      dateKey,
      (totalsByDate.get(dateKey) || 0) + snapshot.valueNis
    );
  }

  return Array.from(totalsByDate.entries())
    .map(([date, totalValue]) => ({ date, totalValue }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
