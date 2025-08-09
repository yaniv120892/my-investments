import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getMarketData, convertToNIS } from "@/lib/marketDataService";
import { sendSnapshotNotification } from "@/lib/telegramNotifier";
import type { InvestmentSnapshot } from "@prisma/client";

export async function POST() {
  try {
    const users = await prisma.user.findMany({
      include: {
        investments: {
          include: {
            snapshots: {
              orderBy: { date: "desc" },
              take: 1,
            },
          },
        },
      },
    });

    for (const user of users) {
      if (user.investments.length === 0) continue;

      let currentTotalValue = 0;
      const snapshots: InvestmentSnapshot[] = [];

      for (const investment of user.investments) {
        let currentValue = 0;

        if (investment.ticker) {
          const marketData = await getMarketData(
            investment.ticker,
            investment.type
          );
          if (marketData) {
            currentValue = investment.quantity * marketData.price;
            if (marketData.currency !== "NIS") {
              const usdToNISRate = 3.65;
              currentValue = convertToNIS(
                currentValue,
                marketData.currency,
                usdToNISRate
              );
            }
          } else {
            currentValue = investment.quantity * 100;
          }
        } else {
          currentValue = investment.quantity * 100;
        }

        currentTotalValue += currentValue;

        const snapshot = await prisma.investmentSnapshot.create({
          data: {
            investmentId: investment.id,
            date: new Date(),
            valueInNIS: currentValue,
          },
        });

        snapshots.push(snapshot);
      }

      let changePercent = 0;
      let previousTotalValue = 0;

      if (user.investments[0].snapshots.length > 0) {
        const lastSnapshotDate = user.investments[0].snapshots[0].date;
        const previousSnapshots = await prisma.investmentSnapshot.findMany({
          where: {
            investment: { userId: user.id },
            date: lastSnapshotDate,
          },
        });

        previousTotalValue = previousSnapshots.reduce(
          (sum, snap) => sum + snap.valueInNIS,
          0
        );

        if (previousTotalValue > 0) {
          changePercent =
            ((currentTotalValue - previousTotalValue) / previousTotalValue) *
            100;
        }
      }

      await sendSnapshotNotification({
        date: new Date(),
        netWorth: currentTotalValue,
        changePercent,
        previousNetWorth:
          previousTotalValue > 0 ? previousTotalValue : undefined,
      });
    }

    return NextResponse.json({
      message: "Snapshot completed successfully",
      usersProcessed: users.length,
    });
  } catch (error) {
    console.error("Snapshot error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
