import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getMarketData,
  convertToNIS,
  getUSDToNISRate,
} from "@/lib/marketDataService";

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

    const categoryTotals: Record<string, number> = {};
    let totalValue = 0;
    const assetCount = investments.length;
    const prices: Record<string, { unitPrice: number; currency: string }> = {};

    // Fetch USD->NIS rate once when needed
    let usdToNISRate = 0;

    for (const investment of investments) {
      let currentValue = 0;

      if (investment.ticker) {
        const marketData = await getMarketData(
          investment.ticker,
          investment.type
        );
        if (marketData && marketData.price > 0) {
          prices[investment.id] = {
            unitPrice: marketData.price,
            currency: marketData.currency,
          };
          currentValue = investment.quantity * marketData.price;
          if (marketData.currency !== "NIS") {
            if (!usdToNISRate) {
              const rateData = await getUSDToNISRate();
              if (rateData && rateData.price > 0) {
                usdToNISRate = rateData.price;
              }
            }
            if (usdToNISRate) {
              currentValue = convertToNIS(
                currentValue,
                marketData.currency,
                usdToNISRate
              );
            }
          }
        }
      } else {
        // No ticker, no price
        currentValue = 0;
      }

      const category = investment.type;
      categoryTotals[category] = (categoryTotals[category] || 0) + currentValue;
      totalValue += currentValue;
    }

    const summary = {
      totalValue,
      categoryTotals,
      assetCount,
      lastUpdated: new Date(),
    };

    return NextResponse.json({
      investments,
      summary,
      prices,
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
