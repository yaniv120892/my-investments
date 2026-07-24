import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getMarketData,
  convertToNIS,
  getUSDToNISRate,
} from "@/lib/marketDataService";
import { sendSnapshotNotification } from "@/lib/telegramNotifier";
import { describeError } from "@/utils/describeError";
import type { InvestmentSnapshot } from "@prisma/client";

interface SkippedUser {
  userId: string;
  reasons: string[];
}

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

    let usdToNISRate: number;
    try {
      const rateData = await getUSDToNISRate();
      usdToNISRate = rateData.price;
    } catch (error) {
      return NextResponse.json(
        {
          error: `Unable to fetch the USD/NIS exchange rate; no snapshots were written (${describeError(
            error
          )})`,
        },
        { status: 503 }
      );
    }

    const skippedUsers: SkippedUser[] = [];

    for (const user of users) {
      if (user.investments.length === 0) {
        continue;
      }

      let currentTotalValue = 0;
      const snapshots: InvestmentSnapshot[] = [];
      const valuations: { investmentId: string; valueInNIS: number }[] = [];
      const failures: string[] = [];

      for (const investment of user.investments) {
        try {
          if (!investment.ticker) {
            throw new Error(
              `${investment.assetName}: no ticker configured`
            );
          }

          const marketData = await getMarketData(
            investment.ticker,
            investment.type
          );

          if (!marketData || marketData.price <= 0) {
            throw new Error(
              `${investment.assetName}: no price returned by any provider (ticker: ${investment.ticker}, type: ${investment.type})`
            );
          }

          const valueInNIS = convertToNIS(
            investment.quantity * marketData.price,
            marketData.currency,
            usdToNISRate
          );

          valuations.push({ investmentId: investment.id, valueInNIS });
          currentTotalValue += valueInNIS;
        } catch (error) {
          failures.push(describeError(error));
        }
      }

      if (failures.length > 0) {
        skippedUsers.push({ userId: user.id, reasons: failures });
        continue;
      }

      for (const valuation of valuations) {
        const snapshot = await prisma.investmentSnapshot.create({
          data: {
            investmentId: valuation.investmentId,
            date: new Date(),
            valueInNIS: valuation.valueInNIS,
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

      try {
        await sendSnapshotNotification({
          date: new Date(),
          netWorth: currentTotalValue,
          changePercent,
          previousNetWorth:
            previousTotalValue > 0 ? previousTotalValue : undefined,
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
      usersProcessed: users.length - skippedUsers.length,
      usersSkipped: skippedUsers.length,
      skipped: skippedUsers,
    });
  } catch (error) {
    console.error("Snapshot error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
