import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { settings: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({
      email: user.email,
      darkMode: user.settings?.darkMode || false,
      baseCurrency: user.settings?.baseCurrency || "NIS",
    });
  } catch (error) {
    console.error("Error fetching user settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = request.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { darkMode, baseCurrency } = await request.json();

    const settings = await prisma.settings.upsert({
      where: { userId },
      update: {
        ...(darkMode !== undefined && { darkMode }),
        ...(baseCurrency && { baseCurrency }),
      },
      create: {
        userId,
        darkMode: darkMode || false,
        baseCurrency: baseCurrency || "NIS",
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Error updating user settings:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
