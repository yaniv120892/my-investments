import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "6m";
    const groupBy = searchParams.get("groupBy") || "day";

    const startDate = calculateStartDateFromPeriod(period);
    const snapshots = await fetchUserSnapshots(userId, startDate);
    const portfolioHistory = aggregateSnapshotsByDate(snapshots);
    const processedData = calculateGainsAndLosses(portfolioHistory);

    return NextResponse.json({
      data: processedData,
      period,
      groupBy,
    });
  } catch (error) {
    console.error("Error fetching investment history:", error);
    return NextResponse.json(
      { error: "Internal server error" },
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

async function fetchUserSnapshots(userId: string, startDate: Date) {
  return await prisma.investmentSnapshot.findMany({
    where: {
      investment: {
        userId: userId,
      },
      date: {
        gte: startDate,
      },
    },
    include: {
      investment: {
        select: {
          assetName: true,
          type: true,
        },
      },
    },
    orderBy: {
      date: "asc",
    },
  });
}

interface SnapshotWithInvestment {
  date: Date;
  valueInNIS: number;
  investment: {
    assetName: string;
    type: string;
  };
}

function aggregateSnapshotsByDate(snapshots: SnapshotWithInvestment[]) {
  const portfolioHistory = new Map<string, number>();

  snapshots.forEach((snapshot) => {
    const dateKey = snapshot.date.toISOString().split("T")[0];
    const currentValue = portfolioHistory.get(dateKey) || 0;
    portfolioHistory.set(dateKey, currentValue + snapshot.valueInNIS);
  });

  return Array.from(portfolioHistory.entries())
    .map(([date, totalValue]) => ({
      date,
      totalValue,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function calculateGainsAndLosses(
  historyData: Array<{ date: string; totalValue: number }>
) {
  return historyData.map((entry, index) => {
    const previousValue =
      index > 0 ? historyData[index - 1].totalValue : entry.totalValue;
    const gainLoss = entry.totalValue - previousValue;
    const gainLossPercent =
      previousValue > 0 ? (gainLoss / previousValue) * 100 : 0;

    return {
      date: entry.date,
      totalValue: entry.totalValue,
      gainLoss,
      gainLossPercent,
    };
  });
}
