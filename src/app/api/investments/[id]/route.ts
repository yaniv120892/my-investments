import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const { type, assetName, ticker, quantity } = await request.json();

    if (!type || !assetName || !quantity) {
      return NextResponse.json(
        { error: "Type, asset name, and quantity are required" },
        { status: 400 }
      );
    }

    const investment = await prisma.investment.update({
      where: { id, userId },
      data: {
        type: type,
        assetName,
        ticker,
        quantity: parseFloat(quantity),
      },
    });

    return NextResponse.json(investment);
  } catch (error) {
    console.error("Error updating investment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    await prisma.investment.delete({
      where: { id, userId },
    });

    return NextResponse.json({ message: "Investment deleted successfully" });
  } catch (error) {
    console.error("Error deleting investment:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
