import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getMarketData,
  convertToNIS,
  getUSDToNISRate,
} from "@/lib/marketDataService";
import { describeError } from "@/utils/describeError";

interface PricingFailure {
  investmentId: string;
  assetName: string;
  ticker: string | null;
  reason: string;
}

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const investments = await prisma.investment.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    let usdToNISRate: number;
    try {
      const rateData = await getUSDToNISRate();
      usdToNISRate = rateData.price;
    } catch (error) {
      return NextResponse.json(
        {
          error: `Unable to fetch the USD/NIS exchange rate, so portfolio totals cannot be calculated (${describeError(
            error
          )})`,
        },
        { status: 503 }
      );
    }

    const categoryTotals: Record<string, number> = {};
    let pricedValue = 0;
    const prices: Record<string, { unitPrice: number; currency: string }> = {};
    const failures: PricingFailure[] = [];

    for (const investment of investments) {
      try {
        if (!investment.ticker) {
          throw new Error("No ticker configured for this investment");
        }

        const marketData = await getMarketData(
          investment.ticker,
          investment.type
        );

        if (!marketData || marketData.price <= 0) {
          throw new Error(
            `No price returned by any provider (ticker: ${investment.ticker}, type: ${investment.type})`
          );
        }

        const valueInNIS = convertToNIS(
          investment.quantity * marketData.price,
          marketData.currency,
          usdToNISRate
        );

        prices[investment.id] = {
          unitPrice: marketData.price,
          currency: marketData.currency,
        };
        categoryTotals[investment.type] =
          (categoryTotals[investment.type] || 0) + valueInNIS;
        pricedValue += valueInNIS;
      } catch (error) {
        failures.push({
          investmentId: investment.id,
          assetName: investment.assetName,
          ticker: investment.ticker,
          reason: describeError(error),
        });
      }
    }

    const isComplete = failures.length === 0;

    const summary = {
      totalValue: isComplete ? pricedValue : null,
      pricedValue,
      isComplete,
      categoryTotals,
      assetCount: investments.length,
      pricedCount: investments.length - failures.length,
      usdToNISRate,
      lastUpdated: new Date(),
    };

    return NextResponse.json({
      investments,
      summary,
      prices,
      failures,
    });
  } catch (error) {
    console.error("Error fetching investments:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { type, assetName, ticker, quantity } = await request.json();

    if (!type || !assetName || !quantity) {
      return NextResponse.json(
        { error: "Type, asset name, and quantity are required" },
        { status: 400 }
      );
    }

    const investment = await prisma.investment.create({
      data: {
        userId,
        type: type,
        assetName,
        ticker,
        quantity: parseFloat(quantity),
      },
    });

    return NextResponse.json(investment, { status: 201 });
  } catch (error) {
    console.error("Error creating investment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
